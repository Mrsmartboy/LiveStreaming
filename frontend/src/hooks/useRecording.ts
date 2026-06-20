import { useRef, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';

interface UseRecordingOptions {
  sessionId: string;
  room: Room | null;
  onUploadComplete?: (url: string) => void;
  onError?: (msg: string) => void;
}

export function useRecording({ sessionId, room, onUploadComplete, onError }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    chunksRef.current = [];

    try {
      // 1. Capture the screen/tab with system/tab audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // @ts-ignore
          preferCurrentTab: true,
          frameRate: { ideal: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      screenStreamRef.current = screenStream;

      // 2. Capture microphone stream (voice)
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = micStream;
      } catch (e) {
        console.warn('Microphone not available or permission denied:', e);
      }

      // 3. Set up Web Audio Context to mix them
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioContext;
      const dest = audioContext.createMediaStreamDestination();

      // Connect screen audio to mixer if it exists
      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length > 0) {
        const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTracks[0]]));
        screenSource.connect(dest);
      }

      // Connect mic audio to mixer if it exists
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioContext.createMediaStreamSource(new MediaStream([micStream.getAudioTracks()[0]]));
        micSource.connect(dest);
      }

      // Connect all remote audio tracks from the LiveKit room if available
      const remoteSources = new Map<string, MediaStreamAudioSourceNode>();

      const handleRemoteTrackSubscribed = (track: any, publication: any) => {
        if (track.kind === 'audio' && track.mediaStreamTrack) {
          const source = audioContext.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
          source.connect(dest);
          remoteSources.set(publication.trackSid, source);
          console.log(`🎙️ Mixed remote audio track: ${publication.trackSid}`);
        }
      };

      const handleRemoteTrackUnsubscribed = (track: any, publication: any) => {
        if (track.kind === 'audio') {
          const source = remoteSources.get(publication.trackSid);
          if (source) {
            source.disconnect();
            remoteSources.delete(publication.trackSid);
            console.log(`🎙️ Disconnected remote audio track: ${publication.trackSid}`);
          }
        }
      };

      if (room) {
        // Mix existing remote audio tracks
        room.remoteParticipants.forEach((participant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.track && pub.kind === 'audio' && pub.track.mediaStreamTrack) {
              const source = audioContext.createMediaStreamSource(new MediaStream([pub.track.mediaStreamTrack]));
              source.connect(dest);
              remoteSources.set(pub.trackSid, source);
              console.log(`🎙️ Mixed existing remote audio track: ${pub.trackSid}`);
            }
          });
        });

        // Listen for new ones
        room.on(RoomEvent.TrackSubscribed, handleRemoteTrackSubscribed);
        room.on(RoomEvent.TrackUnsubscribed, handleRemoteTrackUnsubscribed);
      }

      // 4. Combine screen video with mixed audio
      const mixedStream = new MediaStream();
      mixedStream.addTrack(screenStream.getVideoTracks()[0]);

      const mixedAudioTracks = dest.stream.getAudioTracks();
      if (mixedAudioTracks.length > 0) {
        mixedStream.addTrack(mixedAudioTracks[0]);
      } else if (screenAudioTracks.length > 0) {
        // Fallback to screen audio only if mixing failed
        mixedStream.addTrack(screenAudioTracks[0]);
      }

      // 5. Set up MediaRecorder using the mixedStream
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      console.log(`🎬 Screen recording started with mixed audio: mime=${mimeType}, tracks=${mixedStream.getTracks().length}`);

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 3_000_000, // 3 Mbps for good screen quality
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Unregister LiveKit events
        if (room) {
          room.off(RoomEvent.TrackSubscribed, handleRemoteTrackSubscribed);
          room.off(RoomEvent.TrackUnsubscribed, handleRemoteTrackUnsubscribed);
        }
        remoteSources.forEach((source) => source.disconnect());
        remoteSources.clear();

        // Cleanup screen stream tracks
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;

        // Cleanup microphone stream tracks
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;

        audioCtxRef.current?.close();
        audioCtxRef.current = null;

        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`📦 Screen recording blob: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);

        if (blob.size < 1000) {
          onError?.('Recording is too small — it may be empty.');
          return;
        }

        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('recording', blob, `recording-${sessionId}-${Date.now()}.webm`);
          const res = await fetch(`/api/recordings/${sessionId}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: formData,
          });

          if (res.ok) {
            const { url } = await res.json();
            onUploadComplete?.(url);
          } else {
            // Fallback: direct browser download
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `recording-${sessionId}-${Date.now()}.webm`;
            a.click();
            onUploadComplete?.('');
          }
        } catch {
          // Fallback: direct browser download
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `recording-${sessionId}-${Date.now()}.webm`;
          a.click();
          onUploadComplete?.('');
        } finally {
          setIsUploading(false);
        }
      };

      // If user stops sharing via browser's native "Stop sharing" button
      screenStream.getVideoTracks()[0].onended = () => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
          setIsRecording(false);
        }
      };

      recorder.start(1000); // chunk every second
      setIsRecording(true);
    } catch (err: any) {
      // User cancelled the screen share prompt
      if (err.name === 'NotAllowedError') {
        onError?.('Screen recording permission denied.');
      } else {
        onError?.(`Failed to start recording: ${err.message}`);
      }
    }
  }, [sessionId, room, onUploadComplete, onError]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, isUploading, start, stop };
}
