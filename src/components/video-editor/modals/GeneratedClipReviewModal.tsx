import React, { useRef, useState } from 'react';
import { 
  X, Trash2, RefreshCw, Layers, Bookmark, Play, Pause, 
  Sparkles, Check, ArrowLeft, Disc 
} from 'lucide-react';
import { HiggsfieldJob, VideoEditorClip } from '../../../types';

export interface GeneratedClipReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: HiggsfieldJob | null;
  targetClip: VideoEditorClip | null;
  targetClipIndex: number | null;
  onTrash: (job: HiggsfieldJob) => Promise<void>;
  onDeleteAndReplace: (job: HiggsfieldJob, targetClipIndex: number) => void;
  onReplaceKeepVariant: (job: HiggsfieldJob, targetClipIndex: number) => void;
  onDirectlySave: (job: HiggsfieldJob) => void;
}

export const GeneratedClipReviewModal: React.FC<GeneratedClipReviewModalProps> = ({
  isOpen,
  onClose,
  job,
  targetClip,
  targetClipIndex,
  onTrash,
  onDeleteAndReplace,
  onReplaceKeepVariant,
  onDirectlySave,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrashing, setIsTrashing] = useState(false);

  if (!isOpen || !job) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTrashClick = async () => {
    setIsTrashing(true);
    try {
      await onTrash(job);
      onClose();
    } finally {
      setIsTrashing(false);
    }
  };

  const resolvedClipIdx = targetClipIndex !== null ? targetClipIndex : (job.clipIndex ?? 0);

  return (
    <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 text-white animate-in fade-in duration-150 overflow-y-auto">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-gray-950 border border-purple-500/60 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Review AI Video</h3>
              <p className="text-[10px] text-purple-300 font-mono">Flux Video Edit 3.0</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* Video Preview Player */}
        <div className="relative aspect-[9/16] max-h-[46vh] bg-black mx-auto overflow-hidden rounded-2xl my-2 border border-gray-800 shadow-inner group">
          <video
            ref={videoRef}
            src={job.video_url}
            loop
            playsInline
            controls={false}
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            className="w-full h-full object-contain cursor-pointer"
          />

          {/* Center Play/Pause Overlay */}
          {!isPlaying && (
            <div 
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer pointer-events-auto"
            >
              <div className="w-12 h-12 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition active:scale-90">
                <Play size={20} className="ml-1 fill-white" />
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-black/75 border border-white/20 text-[10px] font-mono font-bold">
            Clip #{resolvedClipIdx + 1} Target
          </div>
        </div>

        {/* Prompt details box */}
        <div className="px-4 py-2 bg-gray-900/60 border-y border-gray-800/80 shrink-0 text-xs">
          <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 mb-0.5">
            <span className="uppercase tracking-wider">Prompt Used:</span>
            <span className="text-amber-400 font-mono">Flux Video Edit 3.0 • 5 cr utilised</span>
          </div>
          <p className="text-xs text-purple-200 font-medium italic line-clamp-2">
            "{job.prompt}"
          </p>
        </div>

        {/* The 4 Action Buttons Requested By User */}
        <div className="p-3.5 sm:p-4 bg-gray-950 flex flex-col gap-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {/* BUTTON 1: TRASH */}
            <button
              type="button"
              onClick={handleTrashClick}
              disabled={isTrashing}
              className="py-2.5 px-3 rounded-xl bg-gray-900 hover:bg-rose-950/70 border border-gray-800 hover:border-rose-700/60 text-gray-300 hover:text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
              title="Move to server Trash folder without touching timeline"
            >
              <Trash2 size={14} className="text-rose-400" />
              <span>To Trash</span>
            </button>

            {/* BUTTON 2: DELETE AND REPLACE */}
            <button
              type="button"
              onClick={() => {
                onDeleteAndReplace(job, resolvedClipIdx);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/60 text-purple-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
              title="Delete previous clip and replace with this generated clip"
            >
              <RefreshCw size={14} className="text-purple-400" />
              <span>Delete & Replace</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* BUTTON 3: ONLY REPLACE (KEEP OLD IN VARIANTS WITH DOTS) */}
            <button
              type="button"
              onClick={() => {
                onReplaceKeepVariant(job, resolvedClipIdx);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-purple-950/50"
              title="Replace on timeline but keep previous clip as variant takes (navigable via dots)"
            >
              <Layers size={14} className="text-amber-300" />
              <span>Replace (Keep Dots)</span>
            </button>

            {/* BUTTON 4: DIRECTLY SAVE */}
            <button
              type="button"
              onClick={() => {
                onDirectlySave(job);
                onClose();
              }}
              className="py-2.5 px-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-750 hover:border-gray-600 text-gray-200 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
              title="Directly save to project library without replacing timeline clip"
            >
              <Bookmark size={14} className="text-emerald-400" />
              <span>Directly Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
