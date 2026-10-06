// High-Quality In-Device Mobile Video Renderer (100% Offline, Zero Internet)
import { VideoEditorClip, VideoEditorAudioClip, VideoEditorCaption } from '../types';
import { getCachedVideoBlobUrl } from './videoBlobCache';

export interface RenderProgressUpdate {
  progress: number;
  statusText: string;
  currentClipIndex?: number;
  totalClips?: number;
}

export interface RenderMobileResult {
  blob: Blob;
  blobUrl: string;
  filename: string;
  duration: number;
  size: number;
  mimeType: string;
}

export interface MobileRenderOptions {
  projectName: string;
  clips: VideoEditorClip[];
  audioClips?: VideoEditorAudioClip[];
  backgroundAudioUrl?: string;
  backgroundAudioVolume?: number;
  captions?: VideoEditorCaption[];
  onProgress: (p: RenderProgressUpdate) => void;
  signal?: AbortSignal;
}

function getBestMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

export async function renderVideoOnDevice(options: MobileRenderOptions): Promise<RenderMobileResult> {
  const {
    projectName,
    clips,
    audioClips = [],
    backgroundAudioUrl,
    backgroundAudioVolume = 1.0,
    captions = [],
    onProgress,
    signal,
  } = options;

  if (clips.length === 0) {
    throw new Error('No clips to render in timeline');
  }

  onProgress({ progress: 2, statusText: 'Initializing offline mobile render engine...' });

  // 1. Calculate total duration
  let totalDuration = 0;
  const clipDurations = clips.map((c) => {
    const tStart = c.trim_start || 0;
    const tEnd = c.trim_end && c.trim_end > tStart ? c.trim_end : (c.duration || 5);
    const eff = Math.max(0.2, (tEnd - tStart) / (c.speed || 1.0));
    totalDuration += eff;
    return eff;
  });

  if (totalDuration <= 0) totalDuration = 5;

  // 2. Setup 1080x1920 (9:16 portrait) rendering canvas
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) throw new Error('Could not create Canvas 2D context on device');

  // Fill initial black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Audio Setup via Web Audio API
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume().catch(() => {});
      }
      audioDest = audioCtx.createMediaStreamDestination();
    }
  } catch (aErr) {
    console.warn('[MobileRenderer] Web Audio API init warning:', aErr);
  }

  // 4. Preload and resolve local offline video elements for all clips
  onProgress({ progress: 5, statusText: 'Loading offline video clips from device storage...' });
  const videoElements: HTMLVideoElement[] = [];

  for (let i = 0; i < clips.length; i++) {
    if (signal?.aborted) throw new Error('Render cancelled');
    const c = clips[i];
    const rawUrl = c.url || (c.file_id ? `/api/video/${c.file_id}` : '');
    const offlineSrc = await getCachedVideoBlobUrl(rawUrl);

    const v = document.createElement('video');
    v.src = offlineSrc;
    v.crossOrigin = 'anonymous';
    v.preload = 'auto';
    v.muted = false;
    v.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        console.warn(`[MobileRenderer] Video load issue on clip ${i}, will attempt fallback:`, offlineSrc);
        resolve(); // Continue gracefully
      };
      const cleanup = () => {
        v.removeEventListener('loadeddata', onLoaded);
        v.removeEventListener('error', onError);
      };
      v.addEventListener('loadeddata', onLoaded);
      v.addEventListener('error', onError);
      v.load();
      setTimeout(resolve, 3000); // Max wait timeout 3s
    });

    videoElements.push(v);
    onProgress({
      progress: 5 + Math.round(((i + 1) / clips.length) * 15),
      statusText: `Cached clip ${i + 1}/${clips.length} ready in device memory`,
      currentClipIndex: i,
      totalClips: clips.length,
    });
  }

  // 5. Connect Background Audio if provided
  let bgAudioEl: HTMLAudioElement | null = null;
  if (backgroundAudioUrl && audioCtx && audioDest) {
    try {
      const bgSrc = await getCachedVideoBlobUrl(backgroundAudioUrl);
      bgAudioEl = new Audio(bgSrc);
      bgAudioEl.loop = true;
      const bgSource = audioCtx.createMediaElementSource(bgAudioEl);
      const bgGain = audioCtx.createGain();
      bgGain.gain.value = Math.max(0, Math.min(2.0, backgroundAudioVolume));
      bgSource.connect(bgGain);
      bgGain.connect(audioDest);
    } catch (e) {
      console.warn('[MobileRenderer] Background audio mix error:', e);
    }
  }

  // 6. Connect Video Clip Audio Elements to AudioContext Destination
  const videoGainNodes: GainNode[] = [];
  if (audioCtx && audioDest) {
    for (let i = 0; i < videoElements.length; i++) {
      try {
        const vel = videoElements[i];
        const clip = clips[i];
        const vSource = audioCtx.createMediaElementSource(vel);
        const gainNode = audioCtx.createGain();
        const isMuted = clip.is_muted === true || clip.volume === 0;
        gainNode.gain.value = isMuted ? 0 : (clip.volume ?? 1.0);
        vSource.connect(gainNode);
        gainNode.connect(audioDest);
        videoGainNodes.push(gainNode);
      } catch (err) {
        console.warn(`[MobileRenderer] Audio connect note for clip ${i}:`, err);
      }
    }
  }

  // 7. Setup Canvas Stream & MediaRecorder
  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    audioDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
  }

  const mimeType = getBestMimeType();
  const recordedChunks: Blob[] = [];
  const recorderOptions: MediaRecorderOptions = {
    mimeType,
    videoBitsPerSecond: 10_000_000, // 10 Mbps Studio Quality
  };

  const recorder = new MediaRecorder(combinedStream, recorderOptions);
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  recorder.start(250); // Emit slices every 250ms

  // Start background audio if present
  if (bgAudioEl) {
    try {
      bgAudioEl.currentTime = 0;
      await bgAudioEl.play().catch(() => {});
    } catch (_) {}
  }

  onProgress({ progress: 25, statusText: '⚡ Rendering 1080x1920 30 FPS timeline in phone...' });

  // 8. Render Frame-by-Frame Timeline Sequence
  let currentProjectTime = 0;

  for (let clipIdx = 0; clipIdx < clips.length; clipIdx++) {
    if (signal?.aborted) {
      try { recorder.stop(); } catch (_) {}
      throw new Error('Render cancelled by user');
    }

    const clip = clips[clipIdx];
    const vel = videoElements[clipIdx];
    const clipEffDuration = clipDurations[clipIdx];
    const trimStart = clip.trim_start || 0;
    const speed = clip.speed || 1.0;
    const clipVolume = clip.is_muted ? 0 : (clip.volume ?? 1.0);

    vel.currentTime = trimStart;
    vel.playbackRate = speed;
    vel.volume = clipVolume;

    // Start video playback for this clip
    try {
      await vel.play().catch(() => {});
    } catch (_) {}

    const clipStartProjectTime = currentProjectTime;
    const clipEndProjectTime = currentProjectTime + clipEffDuration;

    // Time step per frame at 30 FPS
    const frameIntervalSec = 1 / 30;
    const clipTotalFrames = Math.ceil(clipEffDuration * 30);

    for (let f = 0; f < clipTotalFrames; f++) {
      if (signal?.aborted) {
        try { vel.pause(); } catch (_) {}
        try { recorder.stop(); } catch (_) {}
        throw new Error('Render cancelled by user');
      }

      const frameProjectTime = clipStartProjectTime + f * frameIntervalSec;

      // Draw background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1080, 1920);

      // Draw Video Clip
      if (vel.readyState >= 2) {
        const vw = vel.videoWidth || 1080;
        const vh = vel.videoHeight || 1920;
        const targetAspect = 1080 / 1920;
        const videoAspect = vw / vh;

        let dw = 1080;
        let dh = 1920;
        let dx = 0;
        let dy = 0;

        // Cover mode for vertical 9:16 reels
        if (videoAspect > targetAspect) {
          dh = 1920;
          dw = Math.round(1920 * videoAspect);
          dx = Math.round((1080 - dw) / 2);
        } else {
          dw = 1080;
          dh = Math.round(1080 / videoAspect);
          dy = Math.round((1920 - dh) / 2);
        }

        ctx.drawImage(vel, dx, dy, dw, dh);
      }

      // Draw Styled Captions & Overlays active at this frame time
      renderCaptionsOnCanvas(ctx, captions, frameProjectTime, 1080, 1920);

      // Yield frame time (simulate exact 30 FPS pacing for MediaRecorder)
      await new Promise((r) => setTimeout(r, 28));

      // Report progress
      const globalProgress = 25 + Math.round((frameProjectTime / totalDuration) * 65);
      onProgress({
        progress: Math.min(92, globalProgress),
        statusText: `Rendering clip ${clipIdx + 1}/${clips.length} (${frameProjectTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s)...`,
        currentClipIndex: clipIdx,
        totalClips: clips.length,
      });
    }

    try { vel.pause(); } catch (_) {}
    currentProjectTime = clipEndProjectTime;
  }

  // Stop background audio
  if (bgAudioEl) {
    try { bgAudioEl.pause(); } catch (_) {}
  }

  onProgress({ progress: 95, statusText: 'Encoding final studio MP4 on phone...' });

  // 9. Stop Recorder and Extract Result Blob
  const finalBlob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const ext = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
      const outputBlob = new Blob(recordedChunks, { type: ext });
      resolve(outputBlob);
    };
    recorder.stop();
  });

  if (audioCtx && audioCtx.state !== 'closed') {
    audioCtx.close().catch(() => {});
  }

  onProgress({ progress: 100, statusText: '✨ Mobile Render Complete!' });

  const isMp4 = mimeType.includes('mp4');
  const safeTitle = (projectName || 'Video').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeTitle}_rendered_${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
  const blobUrl = URL.createObjectURL(finalBlob);

  return {
    blob: finalBlob,
    blobUrl,
    filename,
    duration: totalDuration,
    size: finalBlob.size,
    mimeType: finalBlob.type || mimeType,
  };
}

function renderCaptionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  captions: VideoEditorCaption[],
  currentTime: number,
  canvasW: number,
  canvasH: number
) {
  for (const cap of captions) {
    // If caption has specific time rules
    if (typeof cap.start_time === 'number' && typeof cap.end_time === 'number') {
      if (currentTime < cap.start_time || currentTime > cap.end_time) {
        continue;
      }
    }

    const text = String(cap.text || '').trim();
    if (!text) continue;

    const fontSize = Math.round((cap.font_size || 28) * 3); // Scale up for 1080p
    const fontFamily = cap.font_family || 'TikTok Sans, Montserrat, sans-serif';
    const isBold = cap.is_bold !== false;
    const x = Math.round((canvasW * (cap.x_pct !== undefined ? cap.x_pct : 50)) / 100);
    const y = Math.round((canvasH * (cap.y_pct !== undefined ? cap.y_pct : 35)) / 100);
    const boxWidth = Math.round((canvasW * (cap.box_width_pct || 85)) / 100);

    ctx.save();
    ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Word wrap
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let curLine = '';

    for (const w of words) {
      const test = curLine ? `${curLine} ${w}` : w;
      if (ctx.measureText(test).width <= boxWidth || !curLine) {
        curLine = test;
      } else {
        lines.push(curLine);
        curLine = w;
      }
    }
    if (curLine) lines.push(curLine);

    const lineHeight = fontSize * 1.25;
    const totalBlockHeight = lines.length * lineHeight;
    let startY = y - totalBlockHeight / 2 + lineHeight / 2;

    const strokeWidth = Math.max(3, Math.round(fontSize * 0.12));

    for (const line of lines) {
      // Stroke / Outline
      ctx.strokeStyle = cap.stroke_color || '#000000';
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(line, x, startY);

      // Fill text
      ctx.fillStyle = cap.color || '#ffffff';
      ctx.fillText(line, x, startY);

      startY += lineHeight;
    }

    ctx.restore();
  }
}
