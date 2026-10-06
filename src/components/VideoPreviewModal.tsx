import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Film, X, Download, Play, Pause, Volume2, VolumeX } from 'lucide-react';

export interface VideoPreviewModalProps {
  video: { title: string; url: string; fileId?: string; duration?: number; isMuted?: boolean } | null;
  onClose: () => void;
  onOpenInEditor?: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  onClose,
  onOpenInEditor
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(Boolean(video?.isMuted));

  const handleStopAndClose = () => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (_) {}
    }
    onClose();
  };

  // Immediate audio/video pause on unmount or browser back/navigation
  useEffect(() => {
    const vid = videoRef.current;
    
    const handlePopState = () => {
      if (vid) {
        try {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
        } catch (_) {}
      }
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handlePopState();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (vid) {
        try {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
        } catch (_) {}
      }
    };
  }, [onClose]);

  // Autoplay and volume setup
  useEffect(() => {
    if (!video || !videoRef.current) return;
    const vid = videoRef.current;
    setIsPlaying(true);
    vid.muted = isMuted;

    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // If browser blocks unmuted autoplay, fallback to muted autoplay
          vid.muted = true;
          setIsMuted(true);
          vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        });
    }
  }, [video, isMuted]);

  if (!video) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none animate-in fade-in duration-150"
      onClick={handleStopAndClose}
    >
      <div 
        className="flex flex-col items-center justify-center gap-3 w-full max-w-sm pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP BAR OUTSIDE FRAME: Dismiss & Quick Actions */}
        <div className="flex items-center justify-between w-full max-w-[320px] px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
            <Film size={14} className="text-purple-400" />
            <span>Video Preview</span>
          </div>
          <button
            type="button"
            onClick={handleStopAndClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition cursor-pointer"
            title="Close Preview (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* TRUE 9:16 PORTRAIT FRAME CONTAINER: 100% PURE VIDEO, NO TEXT OVERLAY */}
        <div 
          onClick={togglePlay}
          className="relative h-[min(66vh,540px)] aspect-[9/16] max-w-[85vw] bg-black rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] ring-1 ring-white/20 border border-purple-500/40 flex items-center justify-center shrink-0 cursor-pointer group"
        >
          <video 
            ref={videoRef}
            src={video.url} 
            playsInline
            loop
            preload="auto"
            muted={isMuted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-cover rounded-2xl sm:rounded-3xl pointer-events-none"
          />

          {/* PAUSE / PLAY CENTER GLYPH (only appears when paused or hovered) */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none animate-in fade-in duration-150">
              <div className="w-14 h-14 rounded-full bg-purple-600/95 text-white flex items-center justify-center shadow-xl border border-white/30 backdrop-blur-md">
                <Play size={24} className="fill-white translate-x-0.5" />
              </div>
            </div>
          )}

          {/* Bottom Video Floating Quick Play/Pause & Mute Pills */}
          <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between pointer-events-auto">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-md transition cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={14} className="fill-white" /> : <Play size={14} className="fill-white ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 shadow-md transition cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>
        </div>

        {/* OUTSIDE THE FRAME AT THE BOTTOM: ALL MENTIONING INFO & ACTION BUTTONS */}
        <div className="flex flex-col items-center gap-2.5 w-full max-w-[320px] px-2 text-center pointer-events-auto select-none">
          <div className="flex items-center justify-center gap-2 max-w-full">
            <span className="text-white text-xs sm:text-sm font-bold truncate max-w-[220px] drop-shadow-md">
              {video.title || 'Clip Preview'}
            </span>
            {typeof video.duration === 'number' && video.duration > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-400/50 text-purple-300 font-mono font-bold text-[11px] shrink-0 shadow-sm">
                {video.duration.toFixed(1)}s
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 w-full pt-0.5">
            <button
              type="button"
              onClick={() => {
                const a = document.createElement('a');
                a.href = video.url;
                a.download = `${video.title || 'clip'}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/10 shadow"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
            {onOpenInEditor && (
              <button
                type="button"
                onClick={() => {
                  handleStopAndClose();
                  onOpenInEditor();
                }}
                className="py-1.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-purple-900/50 cursor-pointer"
              >
                <Film size={13} />
                <span>Open in Editor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
