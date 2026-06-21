import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  Track,
  Participant,
  VideoPresets,
  ScreenSharePresets,
  AudioPresets,
} from 'livekit-client';

export interface LiveKitState {
  room: Room | null;
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  connectionState: ConnectionState;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  isNoiseCancellationEnabled: boolean;
  error: string | null;
}

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const rnnoiseProcessorRef = useRef<any>(null);
  const isNoiseCancellationEnabledRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioNodesRef = useRef<Map<string, {
    source: MediaStreamAudioSourceNode;
    highpass: BiquadFilterNode;
    peaking: BiquadFilterNode;
    compressor: DynamicsCompressorNode;
    gain: GainNode;
    audioElement: HTMLMediaElement;
  }>>(new Map());

  const [state, setState] = useState<LiveKitState>({
    room: null,
    localParticipant: null,
    remoteParticipants: [],
    connectionState: ConnectionState.Disconnected,
    isMicEnabled: false,
    isCameraEnabled: false,
    isScreenSharing: false,
    isNoiseCancellationEnabled: false,
    error: null,
  });

  const syncParticipants = useCallback(() => {
    if (!roomRef.current) return;
    setState((prev) => ({
      ...prev,
      remoteParticipants: [...roomRef.current!.remoteParticipants.values()],
      isMicEnabled: roomRef.current!.localParticipant.isMicrophoneEnabled,
      isCameraEnabled: roomRef.current!.localParticipant.isCameraEnabled,
    }));
  }, []);

  const connect = useCallback(
    async (wsUrl: string, token: string, publishMedia = false) => {
      try {
        // Cleanup existing room
        if (roomRef.current) {
          await roomRef.current.disconnect();
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: VideoPresets.h720.resolution,
          },
          publishDefaults: {
            videoEncoding: VideoPresets.h720.encoding,
            screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
            videoSimulcastLayers: [
              VideoPresets.h180,
              VideoPresets.h360,
              VideoPresets.h720,
            ],
            audioPreset: AudioPresets.speech,
            dtx: true,
          },
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          },
        });
        roomRef.current = room;

        // Wire up events
        room.on(RoomEvent.ConnectionStateChanged, (cs: ConnectionState) => {
          setState((prev) => ({ ...prev, connectionState: cs }));
        });

        room.on(RoomEvent.ParticipantConnected, syncParticipants);
        room.on(RoomEvent.ParticipantDisconnected, syncParticipants);

        // Auto-attach remote audio tracks so they play through the speakers
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            if (track.mediaStreamTrack) {
              try {
                if (!audioContextRef.current) {
                  audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') {
                  ctx.resume();
                }

                // 1. Prime the WebRTC track in Chromium by attaching it to an audio element and muting it
                const audioElement = track.attach();
                audioElement.muted = true; // Mute so it doesn't play directly through speakers twice

                // 2. Create source from the remote media stream track
                const source = ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));

                // Prevent V8 Garbage Collection from claiming the source node mid-session
                if (!(window as any)._activeAudioSources) {
                  (window as any)._activeAudioSources = new Set();
                }
                (window as any)._activeAudioSources.add(source);

                // 3. High-pass filter (cutoff 150 Hz) - removes boomy bass / rumble from low-pitched voices
                const highpass = ctx.createBiquadFilter();
                highpass.type = 'highpass';
                highpass.frequency.value = 150;

                // 4. Peaking filter (center frequency 3000 Hz, boost +6dB) - increases clarity/intelligibility
                const peaking = ctx.createBiquadFilter();
                peaking.type = 'peaking';
                peaking.frequency.value = 3000;
                peaking.Q.value = 1.0;
                peaking.gain.value = 6;

                // 5. Dynamics Compressor - levels the volume of low/quiet voices
                const compressor = ctx.createDynamicsCompressor();
                compressor.threshold.value = -24;
                compressor.knee.value = 30;
                compressor.ratio.value = 4;
                compressor.attack.value = 0.01;
                compressor.release.value = 0.25;

                // 6. Gain Node (+3.5dB makeup gain) - increases the volume to make quiet voices highly audible
                const gain = ctx.createGain();
                gain.gain.value = 1.5;

                // Connect the chain
                source.connect(highpass);
                highpass.connect(peaking);
                peaking.connect(compressor);
                compressor.connect(gain);
                gain.connect(ctx.destination);

                const sid = publication?.trackSid || track.sid;
                if (sid) {
                  remoteAudioNodesRef.current.set(sid, { source, highpass, peaking, compressor, gain, audioElement });
                  console.log(`🎙️ Automatically enhanced remote audio track: ${sid}`);
                }
              } catch (err) {
                console.error('Failed to set up automatic voice clarity/leveling, falling back to raw playback', err);
                track.attach();
              }
            } else {
              // Fallback if no mediaStreamTrack is present
              track.attach();
            }
          }
          syncParticipants();
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
          if (track.kind === Track.Kind.Audio) {
            const sid = publication?.trackSid || track.sid;
            if (sid) {
              const nodes = remoteAudioNodesRef.current.get(sid);
              if (nodes) {
                nodes.source.disconnect();
                if ((window as any)._activeAudioSources) {
                  (window as any)._activeAudioSources.delete(nodes.source);
                }
                nodes.highpass.disconnect();
                nodes.peaking.disconnect();
                nodes.compressor.disconnect();
                nodes.gain.disconnect();
                if (nodes.audioElement) {
                  track.detach(nodes.audioElement);
                }
                remoteAudioNodesRef.current.delete(sid);
              }
            }
            track.detach();
          }
          syncParticipants();
        });

        room.on(RoomEvent.LocalTrackPublished, async (publication) => {
          if (publication.track?.kind === Track.Kind.Audio) {
            const audioTrack = publication.track;
            if (isNoiseCancellationEnabledRef.current && audioTrack.setProcessor) {
              try {
                if (!rnnoiseProcessorRef.current) {
                  const { DenoiseTrackProcessor } = await import('livekit-rnnoise-processor');
                  rnnoiseProcessorRef.current = new DenoiseTrackProcessor();
                }
                await audioTrack.setProcessor(rnnoiseProcessorRef.current);
                console.log('🎙️ RNNoise processor applied to newly published audio track.');
              } catch (e) {
                console.error('Failed to set RNNoise processor on new track:', e);
              }
            }
          }
          syncParticipants();
        });
        room.on(RoomEvent.LocalTrackUnpublished, syncParticipants);
        room.on(RoomEvent.Disconnected, () => {
          setState((prev) => ({
            ...prev,
            connectionState: ConnectionState.Disconnected,
            remoteParticipants: [],
          }));
        });

        await room.connect(wsUrl, token);

        // Unblock browser audio — must be called after user gesture / connect
        await room.startAudio();

        setState((prev) => ({
          ...prev,
          room,
          localParticipant: room.localParticipant,
          connectionState: ConnectionState.Connected,
          error: null,
        }));

        if (publishMedia) {
          await room.localParticipant.enableCameraAndMicrophone();
        }

        syncParticipants();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to connect to room';
        console.error('LiveKit connect error:', err);
        setState((prev) => ({ ...prev, error: msg, connectionState: ConnectionState.Disconnected }));
      }
    },
    [syncParticipants]
  );

  const disconnect = useCallback(async () => {
    if (roomRef.current) {
      const localAudioTrack = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as any;
      if (localAudioTrack && localAudioTrack.stopProcessor) {
        await localAudioTrack.stopProcessor().catch(console.error);
      }
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    rnnoiseProcessorRef.current = null;

    // Clean up Web Audio nodes
    remoteAudioNodesRef.current.forEach((nodes) => {
      nodes.source.disconnect();
      if ((window as any)._activeAudioSources) {
        (window as any)._activeAudioSources.delete(nodes.source);
      }
      nodes.highpass.disconnect();
      nodes.peaking.disconnect();
      nodes.compressor.disconnect();
      nodes.gain.disconnect();
    });
    remoteAudioNodesRef.current.clear();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close().catch(console.error);
    }
    audioContextRef.current = null;

    setState({
      room: null,
      localParticipant: null,
      remoteParticipants: [],
      connectionState: ConnectionState.Disconnected,
      isMicEnabled: false,
      isCameraEnabled: false,
      isScreenSharing: false,
      isNoiseCancellationEnabled: isNoiseCancellationEnabledRef.current,
      error: null,
    });
  }, []);

  const toggleMic = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setMicrophoneEnabled(
      !roomRef.current.localParticipant.isMicrophoneEnabled
    );
    setState((prev) => ({ ...prev, isMicEnabled: roomRef.current!.localParticipant.isMicrophoneEnabled }));
  }, []);

  /** Explicitly set mic on or off — use this instead of toggleMic for force-mute */
  const setMicEnabled = useCallback(async (enabled: boolean) => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setMicrophoneEnabled(enabled);
    setState((prev) => ({ ...prev, isMicEnabled: roomRef.current!.localParticipant.isMicrophoneEnabled }));
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setCameraEnabled(
      !roomRef.current.localParticipant.isCameraEnabled
    );
    setState((prev) => ({ ...prev, isCameraEnabled: roomRef.current!.localParticipant.isCameraEnabled }));
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    const current = state.isScreenSharing;
    await roomRef.current.localParticipant.setScreenShareEnabled(!current);
    setState((prev) => ({
      ...prev,
      isScreenSharing: !!roomRef.current?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track,
    }));
  }, [state.isScreenSharing]);

  const setNoiseCancellationEnabled = useCallback(async (enabled: boolean) => {
    isNoiseCancellationEnabledRef.current = enabled;
    setState((prev) => ({ ...prev, isNoiseCancellationEnabled: enabled }));

    if (roomRef.current) {
      const localAudioTrack = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as any;
      if (localAudioTrack && localAudioTrack.setProcessor) {
        try {
          if (enabled) {
            if (!rnnoiseProcessorRef.current) {
              const { DenoiseTrackProcessor } = await import('livekit-rnnoise-processor');
              rnnoiseProcessorRef.current = new DenoiseTrackProcessor();
            }
            await localAudioTrack.setProcessor(rnnoiseProcessorRef.current);
            console.log('🎙️ RNNoise processor applied dynamically.');
          } else {
            await localAudioTrack.stopProcessor();
            console.log('🎙️ RNNoise processor stopped dynamically.');
          }
        } catch (e) {
          console.error('Failed to update RNNoise processor state:', e);
        }
      }
    }
  }, []);

  // Periodic check to resume suspended AudioContext (fixes 5-minute background/silence sleep in Chrome)
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(console.error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        const localAudioTrack = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as any;
        if (localAudioTrack && localAudioTrack.stopProcessor) {
          localAudioTrack.stopProcessor().catch(console.error);
        }
        roomRef.current.disconnect();
      }
      rnnoiseProcessorRef.current = null;

      // Clean up Web Audio nodes
      remoteAudioNodesRef.current.forEach((nodes) => {
        nodes.source.disconnect();
        if ((window as any)._activeAudioSources) {
          (window as any)._activeAudioSources.delete(nodes.source);
        }
        nodes.highpass.disconnect();
        nodes.peaking.disconnect();
        nodes.compressor.disconnect();
        nodes.gain.disconnect();
      });
      remoteAudioNodesRef.current.clear();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    toggleMic,
    setMicEnabled,
    toggleCamera,
    toggleScreenShare,
    setNoiseCancellationEnabled,
    startAudio: () => roomRef.current?.startAudio(),
  };
}

// ── Utility: attach a participant's video track to a DOM element ───────────
export function attachVideoTrack(participant: Participant, element: HTMLVideoElement | null): () => void {
  if (!element) return () => {};

  const pub = participant.getTrackPublication(Track.Source.Camera);
  if (pub?.track) {
    pub.track.attach(element);
  }

  const onPublished = () => {
    const p = participant.getTrackPublication(Track.Source.Camera);
    if (p?.track) p.track.attach(element);
  };

  participant.on('trackSubscribed', onPublished);

  return () => {
    participant.off('trackSubscribed', onPublished);
    const p = participant.getTrackPublication(Track.Source.Camera);
    if (p?.track) p.track.detach(element);
  };
}
