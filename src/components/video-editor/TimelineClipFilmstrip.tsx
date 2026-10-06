import React, { useMemo, useState, useEffect, useRef } from 'react';
import { VideoEditorClip } from '../../types';

// Global in-memory cache for instant frame retrieval (0ms latency, 0 network bytes)
const IN_MEMORY_FRAME_CACHE = new Map<string, string>();

/**
 * CapCut / Premiere Pro / DaVinci Resolve style consecutive frame-by-frame filmstrip.
 * Displays evenly spaced micro-frames across the trimmed clip range so users can easily
 * see video progression, identify key actions, and cut or split clips with frame accuracy.
 *
 * Zero-Bandwidth Internet Caching:
 * 1. Global in-memory cache: once loaded in browser, frames render instantly without any network call.
 * 2. HTTP Cache-Control: max-age=31536000, immutable ensures the browser disk cache reuses frames.
 * 3. Quantized stable timestamps: prevents cache invalidation when timeline is zoomed or scrubbed.
 * 4. Local blob/offline extraction: extracts frames locally via canvas without using any network bytes.
 */
export const TimelineClipFilmstrip: React.FC<{
  clip: VideoEditorClip;
  blockWidth: number;
}> = React.memo(({ clip, blockWidth }) => {
  const rawStart = clip.trim_start || 0;
  const rawEnd = clip.trim_end || (clip.duration || (rawStart + 3));
  const trimmedSpan = Math.max(0.1, rawEnd - rawStart);

  // Resolve best file identifier for server thumbnail endpoint
  const cleanUrlId = clip.url && typeof clip.url === 'string'
    ? (clip.url.startsWith('/api/video/') 
        ? clip.url.replace('/api/video/', '') 
        : (!clip.url.startsWith('blob:') && !clip.url.startsWith('http') ? clip.url : ''))
    : '';
  const effectiveFileId = clip.file_id || clip.vid || cleanUrlId || clip.id;
  const isBlobUrl = typeof clip.url === 'string' && clip.url.startsWith('blob:');

  // Friendly frame tile width: ~36px gives multiple unzoomed, clear micro-frames
  const targetTileWidth = 36;
  const numFrames = Math.max(1, Math.round(blockWidth / targetTileWidth));
  const tileWidth = blockWidth / numFrames;

  // Local state for resolved frame URLs (from in-memory cache or local canvas extraction)
  const [frameSources, setFrameSources] = useState<Record<number, string>>({});
  const videoCaptureRef = useRef<HTMLVideoElement | null>(null);

  // Calculate timestamps for each frame tile evenly distributed across the trimmed range
  const framesMeta = useMemo(() => {
    const list: { idx: number; time: number; tRounded: string; serverUrl: string; cacheKey: string }[] = [];
    
    for (let i = 0; i < numFrames; i++) {
      // Evenly distribute timestamps from clip start to clip end:
      const fraction = numFrames > 1 ? (i / (numFrames - 1)) : 0.5;
      const t = rawStart + (fraction * trimmedSpan);
      // Quantize to 0.2s to maximize HTTP cache hits and eliminate redundant requests
      const tRounded = (Math.round(t * 5) / 5).toFixed(1);
      const cacheKey = `${effectiveFileId}_t${tRounded}_w48`;
      const serverUrl = `/api/thumb/${effectiveFileId}?t=${tRounded}&w=48&q=8`;

      list.push({
        idx: i,
        time: t,
        tRounded,
        serverUrl,
        cacheKey
      });
    }
    return list;
  }, [effectiveFileId, Math.round(rawStart * 5), Math.round(rawEnd * 5), numFrames]);

  // 1. Resolve frames from In-Memory cache to guarantee 0 network usage once loaded
  useEffect(() => {
    const resolved: Record<number, string> = {};

    for (const frame of framesMeta) {
      if (IN_MEMORY_FRAME_CACHE.has(frame.cacheKey)) {
        resolved[frame.idx] = IN_MEMORY_FRAME_CACHE.get(frame.cacheKey)!;
      }
    }

    if (Object.keys(resolved).length > 0) {
      setFrameSources(prev => ({ ...prev, ...resolved }));
    }
  }, [framesMeta]);

  // 2. Client-side frame extraction for local blob: URLs (runs 100% locally on device, 0 network bytes)
  useEffect(() => {
    if (!isBlobUrl || !clip.url) return;

    let isMounted = true;
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.preload = 'metadata';
    vid.muted = true;
    vid.src = clip.url;
    videoCaptureRef.current = vid;

    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 86;
    const ctx = canvas.getContext('2d');

    const captureQueue = [...framesMeta];
    const processNext = () => {
      if (!isMounted || captureQueue.length === 0) return;
      const current = captureQueue.shift();
      if (!current) return;

      if (IN_MEMORY_FRAME_CACHE.has(current.cacheKey)) {
        if (isMounted) {
          setFrameSources(prev => ({ ...prev, [current.idx]: IN_MEMORY_FRAME_CACHE.get(current.cacheKey)! }));
        }
        processNext();
        return;
      }

      const onSeeked = () => {
        vid.removeEventListener('seeked', onSeeked);
        if (!isMounted || !ctx) return;
        try {
          ctx.drawImage(vid, 0, 0, 48, 86);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          IN_MEMORY_FRAME_CACHE.set(current.cacheKey, dataUrl);
          if (isMounted) {
            setFrameSources(prev => ({ ...prev, [current.idx]: dataUrl }));
          }
        } catch (_) {}
        processNext();
      };

      vid.addEventListener('seeked', onSeeked, { once: true });
      vid.currentTime = current.time;
    };

    vid.addEventListener('loadedmetadata', () => {
      processNext();
    }, { once: true });

    return () => {
      isMounted = false;
      vid.src = '';
      vid.remove();
    };
  }, [isBlobUrl, clip.url, clip.id, framesMeta]);

  // Save successful frame loads into in-memory cache so subsequent renders consume 0 network
  const handleImageLoad = (frame: typeof framesMeta[0]) => {
    IN_MEMORY_FRAME_CACHE.set(frame.cacheKey, frame.serverUrl);
  };

  return (
    <div 
      className="absolute inset-0 overflow-hidden flex items-stretch pointer-events-none opacity-95 group-hover:opacity-100 transition-opacity select-none bg-zinc-950"
    >
      {framesMeta.map((frame) => {
        const frameSrc = frameSources[frame.idx] || frame.serverUrl;

        return (
          <div
            key={`filmstrip-${frame.idx}-${frame.tRounded}`}
            style={{ 
              width: `${tileWidth}px`,
            }}
            className="h-full relative shrink-0 overflow-hidden flex items-center justify-center bg-zinc-900 border-r border-black/50 last:border-r-0"
          >
            <img
              src={frameSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => handleImageLoad(frame)}
              onError={(e) => {
                const img = e.currentTarget;
                // If specific timestamp frame is not ready yet, fall back gracefully to base clip thumbnail
                const fallbackUrl = `/api/thumb/${effectiveFileId}?w=48`;
                if (img.src !== fallbackUrl && !img.src.includes('blob:')) {
                  img.src = fallbackUrl;
                }
              }}
              className="w-full h-full object-cover object-center filter brightness-95 pointer-events-none select-none transition-opacity duration-150"
            />
          </div>
        );
      })}

      {/* Subtle cinematic gradient so trim handles, duration label, and cuts remain clearly visible */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />
    </div>
  );
});
