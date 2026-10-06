import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface LongPressPreviewData {
  videoSrc: string;
  posterUrl?: string;
  title?: string;
  duration?: number;
}

interface LongPressVideoPreviewProps {
  preview: LongPressPreviewData | null;
  onClose: () => void;
}

export const LongPressVideoPreviewOverlay: React.FC<LongPressVideoPreviewProps> = ({ preview, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Immediate release & navigation listener
  useEffect(() => {
    if (!preview) return;

    const handleRelease = () => {
      handleStopAndClose();
    };

    const handlePopState = () => {
      handleStopAndClose();
    };

    window.addEventListener('pointerup', handleRelease, { capture: true });
    window.addEventListener('touchend', handleRelease, { capture: true });
    window.addEventListener('touchcancel', handleRelease, { capture: true });
    window.addEventListener('mouseup', handleRelease, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePopState);

    return () => {
      window.removeEventListener('pointerup', handleRelease, { capture: true });
      window.removeEventListener('touchend', handleRelease, { capture: true });
      window.removeEventListener('touchcancel', handleRelease, { capture: true });
      window.removeEventListener('mouseup', handleRelease, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePopState);

      // Robust unmount cleanup: stop audio/video immediately
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (_) {}
      }
    };
  }, [preview]);

  // Audio auto-play handling
  useEffect(() => {
    if (!preview || !videoRef.current) return;
    const vid = videoRef.current;
    vid.muted = false;
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Fallback to muted if browser rejects unmuted autoplay
        vid.muted = true;
        vid.play().catch(() => {});
      });
    }
  }, [preview]);

  if (!preview) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md transition-opacity duration-150 p-4 select-none touch-none animate-in fade-in"
      onPointerUp={handleStopAndClose}
      onTouchEnd={handleStopAndClose}
      onMouseUp={handleStopAndClose}
    >
      <div 
        className="flex flex-col items-center justify-center gap-3 w-full max-w-sm pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TRUE 9:16 PORTRAIT FRAME CONTAINER: 100% PURE VIDEO, ZERO TEXT OVERLAY */}
        <div 
          className="relative h-[min(68vh,560px)] aspect-[9/16] max-w-[85vw] bg-black rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.9)] ring-1 ring-white/20 border border-purple-500/40 flex items-center justify-center shrink-0 animate-in zoom-in-95 duration-150"
        >
          <video
            ref={videoRef}
            src={preview.videoSrc}
            poster={preview.posterUrl}
            autoPlay
            playsInline
            loop
            preload="auto"
            className="w-full h-full object-cover rounded-2xl sm:rounded-3xl"
          />
        </div>

        {/* OUTSIDE THE FRAME AT THE BOTTOM: ALL MENTIONING INFO */}
        <div className="flex flex-col items-center gap-1.5 w-full max-w-[320px] px-2 text-center pointer-events-none select-none">
          <div className="flex items-center justify-center gap-2 max-w-full">
            <span className="text-white text-xs sm:text-sm font-bold truncate max-w-[220px] drop-shadow-md">
              {preview.title || 'Clip Preview'}
            </span>
            {typeof preview.duration === 'number' && preview.duration > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-400/50 text-purple-300 font-mono font-bold text-[11px] shrink-0 shadow-sm">
                {preview.duration.toFixed(1)}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-[10.5px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span>Release finger to close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
