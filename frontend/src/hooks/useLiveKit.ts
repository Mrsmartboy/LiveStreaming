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
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            // Helper to check if participant is mentor
            const isParticipantMentor = (p: Participant | null) => {
              if (!p) return false;
              try {
                const meta = JSON.parse(p.metadata || '{}');
                return meta.role === 'MENTOR';
              } catch {
                return false;
              }
            };

            const isLocalMentor = isParticipantMentor(room.localParticipant);
            const isRemoteMentor = isParticipantMentor(participant);

            // Students only hear the mentor. Mentors hear all students who speak.
            if (isLocalMentor || isRemoteMentor) {
              // attach() with no args creates a hidden <audio> element on the page and plays it
              track.attach();
            }
          }
          syncParticipants();
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
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
