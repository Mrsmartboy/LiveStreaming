import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Hls from 'hls.js';
import api from '../services/api';

export default function WatchRecording() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [levels, setLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Progress states
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [progressDetails, setProgressDetails] = useState<{
    percent: number;
    segments: number;
    stage: 'waiting' | 'transcoding' | 'uploading';
    uploaded?: number;
    totalFiles?: number;
  } | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let pollInterval: any;

    const startPlayer = (hlsUrl: string) => {
      setIsTranscoding(false);
      setError('');
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls({
          startLevel: -1, // auto
          capLevelToPlayerSize: true,
          enableWorker: true,
          lowLatencyMode: false,
          abrEwmaDefaultEstimate: 800000, // Starts at ~360p bandwidth estimate to avoid initial 1080p spikes
          maxBufferLength: 15,            // Buffer 15 seconds ahead of playhead
          maxMaxBufferLength: 30,         // Keep max 30 seconds buffered
        });
        hlsRef.current = hls;

        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          setLevels(
            data.levels.map((l) => ({
              height: l.height,
              bitrate: l.bitrate,
            }))
          );
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentQuality(data.level);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
            setError('Failed to load video stream.');
          }
        });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoRef.current.src = hlsUrl;
      } else {
        setError('HLS playback is not supported in this browser.');
      }
    };

    const checkProgress = async () => {
      try {
        const { data } = await api.get(`/recordings/${sessionId}/transcode-progress`);
        if (data.status === 'completed') {
          clearInterval(pollInterval);
          // Fetch updated session and play
          const sessionRes = await api.get(`/sessions/${sessionId}`);
          setSession(sessionRes.data);
          if (sessionRes.data.hlsUrl) {
            startPlayer(sessionRes.data.hlsUrl);
          }
        } else if (data.status !== 'not_found') {
          setIsTranscoding(true);
          setProgressDetails({
            percent: data.progress,
            segments: data.segments || 0,
            stage: data.stage || 'waiting',
            uploaded: data.uploaded,
            totalFiles: data.totalFiles,
          });
        }
      } catch (err) {
        console.error('Check transcode progress error:', err);
      }
    };

    const load = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}`);
        setSession(data);

        const hlsUrl = data.hlsUrl;
        if (!hlsUrl) {
          // It's still transcoding, start polling
          setIsTranscoding(true);
          checkProgress();
          pollInterval = setInterval(checkProgress, 2000);
          return;
        }

        startPlayer(hlsUrl);
      } catch {
        setError('Failed to load session.');
      }
    };

    load();

    return () => {
      hlsRef.current?.destroy();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionId]);

  const handleQualityChange = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentQuality(level);
    }
  };

  const qualityLabel = (height: number, bitrate: number) => {
    const mbps = (bitrate / 1_000_000).toFixed(1);
    if (height <= 144) return `144p (${mbps} Mbps)`;
    if (height <= 360) return `360p (${mbps} Mbps)`;
    if (height <= 480) return `480p (${mbps} Mbps)`;
    if (height <= 720) return `720p (${mbps} Mbps)`;
    if (height <= 1080) return `1080p (${mbps} Mbps)`;
    return `${height}p (${mbps} Mbps)`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="font-semibold text-sm">{session?.title || 'Recording'}</h1>
            {session?.endedAt && (
              <p className="text-xs text-slate-500">
                Recorded on {new Date(session.endedAt).toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>

        {/* Quality selector */}
        {levels.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Quality:</span>
            <select
              value={currentQuality}
              onChange={(e) => handleQualityChange(parseInt(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-sm text-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={-1}>Auto</option>
              {levels.map((l, i) => (
                <option key={i} value={i}>
                  {qualityLabel(l.height, l.bitrate)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Video player / Transcoding progress */}
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 56px)' }}>
        {error ? (
          <div className="text-center px-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Stream Unavailable</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md">{error}</p>
            <button onClick={() => navigate(-1)} className="btn-brand">Go Back</button>
          </div>
        ) : isTranscoding ? (
          <div className="text-center px-6 max-w-md w-full">
            <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <svg className="w-10 h-10 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-1">Processing Recording</h2>
            <p className="text-xs text-indigo-400 font-semibold tracking-wider uppercase mb-6">
              {progressDetails?.stage === 'waiting' && 'Stage 1: Waiting in queue...'}
              {progressDetails?.stage === 'transcoding' && 'Stage 2: Transcoding to HLS'}
              {progressDetails?.stage === 'uploading' && 'Stage 3: Uploading HLS segments'}
              {!progressDetails?.stage && 'Queueing Recording...'}
            </p>

            {/* Progress bar container */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-3.5 mb-3 overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${progressDetails?.percent || 0}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 mb-6">
              <span>Progress: {progressDetails?.percent || 0}%</span>
              {progressDetails?.stage === 'transcoding' && (
                <span>Segments completed: {progressDetails.segments}</span>
              )}
              {progressDetails?.stage === 'uploading' && (
                <span>Uploaded: {progressDetails?.uploaded || 0} / {progressDetails?.totalFiles || 0} files</span>
              )}
              {(progressDetails?.stage === 'waiting' || !progressDetails?.stage) && (
                <span>Waiting for worker...</span>
              )}
            </div>

            <div className="bg-slate-900/50 border border-slate-900 rounded-2xl p-4 text-left text-slate-500 text-xs leading-relaxed">
              We are transcoding this video into multiple adaptive resolutions (144p, 360p, 720p, and 1080p) to ensure smooth playback for all networks. This screen will update automatically.
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black relative group">
            <video
              ref={videoRef}
              controls
              autoPlay
              className="w-full h-full object-contain"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Current quality badge */}
            {isPlaying && currentQuality >= 0 && levels[currentQuality] && (
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-xs text-white px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                {levels[currentQuality].height}p
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
