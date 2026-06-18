import React, { useEffect, useRef } from 'react';
import { Participant, Track } from 'livekit-client';
import { attachVideoTrack } from '../hooks/useLiveKit';

interface VideoPlayerProps {
  participant: Participant;
  isLocal?: boolean;
  className?: string;
}

export default function VideoPlayer({ participant, isLocal = false, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  // Attach camera video
  useEffect(() => {
    return attachVideoTrack(participant, videoRef.current);
  }, [participant]);

  // Attach screen share
  useEffect(() => {
    const pub = participant.getTrackPublication(Track.Source.ScreenShare);
    if (pub?.track && screenRef.current) {
      pub.track.attach(screenRef.current);
    }

    const onTrack = () => {
      const p = participant.getTrackPublication(Track.Source.ScreenShare);
      if (p?.track && screenRef.current) p.track.attach(screenRef.current);
    };
    participant.on('trackSubscribed', onTrack);
    return () => {
      participant.off('trackSubscribed', onTrack);
      const p = participant.getTrackPublication(Track.Source.ScreenShare);
      if (p?.track && screenRef.current) p.track.detach(screenRef.current);
    };
  }, [participant]);

  const hasScreenShare = !!participant.getTrackPublication(Track.Source.ScreenShare)?.track;
  const isMicEnabled = participant.isMicrophoneEnabled;
  const isCameraEnabled = participant.isCameraEnabled;

  return (
    <div className={`relative group ${className}`}>
      {/* Main Video */}
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="w-full h-full object-cover"
        />
        {/* No video placeholder */}
        {!isCameraEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-indigo-400">
                  {participant.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <span className="text-slate-400 text-sm">Camera off</span>
            </div>
          </div>
        )}
      </div>

      {/* Screen Share Overlay */}
      {hasScreenShare && (
        <div className="video-container mt-2">
          <video ref={screenRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-contain bg-slate-950" />
          <div className="absolute top-2 left-2 bg-indigo-500/80 text-white text-xs px-2 py-0.5 rounded-full">
            Screen Share
          </div>
        </div>
      )}

      {/* Participant Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-white text-sm font-medium truncate max-w-[70%]">
          {participant.name || participant.identity}
          {isLocal && <span className="text-indigo-300 ml-1">(You)</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Mic indicator */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isMicEnabled ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}>
            {isMicEnabled ? (
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
                <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
