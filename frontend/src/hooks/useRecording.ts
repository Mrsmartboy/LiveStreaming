import { useRef, useState, useCallback } from 'react';

interface UseRecordingOptions {
  sessionId: string;
  onUploadComplete?: (url: string) => void;
  onError?: (msg: string) => void;
}

export function useRecording({ sessionId, onUploadComplete, onError }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /** Mix all active audio tracks from the room into a single MediaStream */
  const buildAudioStream = useCallback((): MediaStream | null => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      // Collect all playing <audio> elements LiveKit injected into the DOM
      document.querySelectorAll('audio').forEach((el) => {
        if (el.srcObject instanceof MediaStream) {
          const src = ctx.createMediaStreamSource(el.srcObject);
          src.connect(dest);
        }
      });

      return dest.stream;
    } catch {
      return null;
    }
  }, []);

  const start = useCallback(() => {
    chunksRef.current = [];
    const stream = buildAudioStream();
    if (!stream || stream.getTracks().length === 0) {
      onError?.('No audio stream available. Make sure microphones are active.');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeType });
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

    recorder.start(1000); // collect chunk every second
    setIsRecording(true);
  }, [sessionId, buildAudioStream, onUploadComplete, onError]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, isUploading, start, stop };
}
