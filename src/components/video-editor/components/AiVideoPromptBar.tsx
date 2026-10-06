import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Sparkles, X,
  ArrowUp, ChevronDown
} from 'lucide-react';
import { VideoEditorClip } from '../../../types';

export interface AiVideoPromptBarProps {
  selectedClip: VideoEditorClip | null;
  selectedClipIndex: number | null;
  totalClipsCount?: number;
  allClips?: VideoEditorClip[];
  onSelectClipIndex?: (index: number) => void;
  onSwitchVariant?: (clipIndex: number, variantIndex: number) => void;
  onClose: () => void;
  onGenerate: (prompt: string, model: string, specificClipIndex?: number) => Promise<void>;
  isGenerating: boolean;
  higgsfieldCredits?: number;
  onOpenSettings?: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const AiVideoPromptBar: React.FC<AiVideoPromptBarProps> = ({
  selectedClip,
  selectedClipIndex,
  totalClipsCount = 1,
  allClips = [],
  onSelectClipIndex,
  onSwitchVariant,
  onClose,
  onGenerate,
  isGenerating,
  showToast,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Active clip index resolution: strictly respect selected clip index
  const currIndex = (selectedClipIndex !== null && selectedClipIndex !== undefined && selectedClipIndex >= 0)
    ? selectedClipIndex
    : 0;
  const totalClips = Math.max(1, totalClipsCount, allClips.length);

  // Resolved current clip specifically for the selected index
  const currentClip = (allClips && allClips[currIndex]) ? allClips[currIndex] : selectedClip;

  // Variants resolution for current clip
  const variants = currentClip?.variants && currentClip.variants.length > 0 ? currentClip.variants : [];
  const activeVariantIdx = currentClip?.active_variant_index ?? 0;
  const activeVariant = (variants && typeof activeVariantIdx === 'number' && variants[activeVariantIdx])
    ? variants[activeVariantIdx]
    : null;

  // Specific clip duration: accurately reflects the chosen clip / active take and exact trim/cut span!
  const tStart = typeof currentClip?.trim_start === 'number' ? currentClip.trim_start : 0;
  const fullSourceDur = activeVariant?.duration || currentClip?.orig_duration || currentClip?.duration || 5;
  const tEnd = (typeof currentClip?.trim_end === 'number' && currentClip.trim_end > tStart)
    ? currentClip.trim_end
    : fullSourceDur;
  const clipDur = Math.max(0.5, Math.round(Math.max(0.2, tEnd - tStart) * 10) / 10);
  const initialCost = Math.round(Math.max(0.5, clipDur) * 10) / 10;
  const [estimatedCost, setEstimatedCost] = useState<number>(initialCost);

  // Detect virtual keyboard open / close:
  // When keyboard opens, expand all the way upside to cover the video player so no video is seen.
  // When keyboard disappears, return back to lower position showing the video player.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const baseHeight = window.innerHeight;

    const handleViewportChange = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const diff = Math.max(0, baseHeight - vv.height);
      const isOpen = diff > 80;
      setIsKeyboardActive(isOpen);
      if (isOpen) {
        setViewportHeight(vv.height);
      } else {
        setViewportHeight(null);
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  // Instantly fetch and verify accurate cost from server when selected clip or duration changes
  useEffect(() => {
    let cancelled = false;
    const dur = clipDur;
    const localCost = Math.round(Math.max(0.5, dur) * 10) / 10;
    setEstimatedCost(localCost);

    fetch('/api/higgsfield/estimate_cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: dur, model: 'flux_3_video_edit' })
    })
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.ok && typeof d.cost === 'number') {
          setEstimatedCost(d.cost);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [currIndex, currentClip?.id, currentClip?.duration, currentClip?.trim_start, currentClip?.trim_end, activeVariant?.duration, activeVariantIdx, clipDur]);

  const handleTriggerGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt to transform this clip', 'warning');
      return;
    }
    const promptToSend = prompt.trim();
    textareaRef.current?.blur();
    setIsKeyboardActive(false);
    await onGenerate(promptToSend, 'flux_3_video_edit', currIndex);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isGenerating && prompt.trim()) {
      e.preventDefault();
      handleTriggerGenerate();
    } else if (e.key === 'Escape') {
      if (isKeyboardActive) {
        textareaRef.current?.blur();
        setIsKeyboardActive(false);
      } else {
        onClose();
      }
    }
  };

  const handlePrevClip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currIndex > 0 && onSelectClipIndex) {
      onSelectClipIndex(currIndex - 1);
    }
  };

  const handleNextClip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currIndex < totalClips - 1 && onSelectClipIndex) {
      onSelectClipIndex(currIndex + 1);
    }
  };

  const handleSelectVariantTake = (e: React.MouseEvent, vIdx: number) => {
    e.stopPropagation();
    if (onSwitchVariant) {
      onSwitchVariant(currIndex, vIdx);
    }
  };

  return (
    <div 
      style={isKeyboardActive && viewportHeight ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` } : undefined}
      className={
        isKeyboardActive 
          ? "fixed inset-0 z-[110] w-full h-full flex flex-col bg-zinc-950 select-none overflow-hidden transition-all duration-150"
          : "flex-1 w-full min-h-0 flex flex-col bg-zinc-950 border-t border-purple-500/40 select-none overflow-hidden relative z-30 transition-all duration-150"
      }
    >
      {/* 1. TOP HEADER: MINIMAL & CLEAN (NO DURATION, NO CREDIT COUNT, NO OVERLAP) */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/90 border-b border-zinc-800/80 shrink-0">
        {/* Exit / Close button */}
        <button
          type="button"
          onClick={() => {
            if (isKeyboardActive) {
              textareaRef.current?.blur();
              setIsKeyboardActive(false);
            } else {
              onClose();
            }
          }}
          disabled={isGenerating}
          className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-90 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-750 transition cursor-pointer shrink-0"
          title={isKeyboardActive ? "Close keyboard (show video)" : "Exit AI Edit"}
          aria-label={isKeyboardActive ? "Close keyboard" : "Exit AI Edit"}
        >
          <X size={14} />
        </button>

        {/* Clean subtle title */}
        <span className="text-xs font-bold text-zinc-300 tracking-wide font-sans select-none flex items-center gap-1.5">
          <Sparkles size={13} className="text-purple-400" />
          AI Video Prompt
        </span>

        {/* Right: Done button if keyboard is active, or empty spacer to keep title centered */}
        {isKeyboardActive ? (
          <button
            type="button"
            onClick={() => {
              textareaRef.current?.blur();
              setIsKeyboardActive(false);
            }}
            className="h-7 px-2.5 rounded-lg bg-purple-950/70 border border-purple-500/40 text-purple-200 hover:text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition cursor-pointer shrink-0"
            title="Show video preview"
          >
            <span>Done</span>
            <ChevronDown size={13} />
          </button>
        ) : (
          <div className="w-7 shrink-0" />
        )}
      </div>

      {/* 2. CENTER: SPACIOUS CLEAN NOTEBOOK TEXT BOX */}
      <div className="flex-1 flex flex-col px-3.5 py-2.5 overflow-y-auto min-h-0 relative">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setIsKeyboardActive(true)}
          onBlur={() => {
            setTimeout(() => {
              if (window.visualViewport && window.innerHeight - window.visualViewport.height <= 80) {
                setIsKeyboardActive(false);
              }
            }, 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Describe what you want AI to generate or transform in Clip #${currIndex + 1}...\n\ne.g., "Hyper-clean cinematic lighting, 4K quality, smooth motion"`}
          disabled={isGenerating}
          rows={isKeyboardActive ? 6 : 4}
          className="w-full flex-1 bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base outline-none resize-none font-medium leading-relaxed"
        />
      </div>

      {/* 3. BOTTOM STRIP: PREV/NEXT CLIP SWITCHER ON LEFT, GENERATE BUTTON WITH CREDITS INSIDE ON RIGHT */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-850 bg-zinc-950 shrink-0 gap-2">
        {/* Left Side: Clip Switcher (< Clip 1/4 >) and Takes */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-8 flex items-center bg-zinc-900 rounded-xl border border-zinc-800 px-1 shadow-xs shrink-0">
            <button
              type="button"
              onClick={handlePrevClip}
              disabled={currIndex <= 0 || isGenerating}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-90 ${
                currIndex > 0 ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 cursor-not-allowed'
              }`}
              title="Previous Clip"
              aria-label="Previous Clip"
            >
              <ChevronLeft size={15} />
            </button>

            <span className="px-2 text-xs font-bold text-purple-200 font-mono select-none whitespace-nowrap">
              Clip {currIndex + 1}/{totalClips} • {clipDur}s{tStart > 0 || tEnd < fullSourceDur - 0.05 ? ` (${tStart.toFixed(1)}s-${tEnd.toFixed(1)}s)` : ''}
            </span>

            <button
              type="button"
              onClick={handleNextClip}
              disabled={currIndex >= totalClips - 1 || isGenerating}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer active:scale-90 ${
                currIndex < totalClips - 1 ? 'text-zinc-200 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 cursor-not-allowed'
              }`}
              title="Next Clip"
              aria-label="Next Clip"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Variant Takes Dots (if multiple takes exist on this clip) */}
          {variants.length > 1 && (
            <div className="h-8 flex items-center gap-1 px-2 rounded-xl bg-purple-950/60 border border-purple-500/30 shrink-0">
              <span className="text-[8.5px] font-mono text-purple-300 font-bold uppercase tracking-tight">Takes:</span>
              <div className="flex items-center gap-1">
                {variants.map((v, vIdx) => {
                  const isActive = activeVariantIdx === vIdx;
                  return (
                    <button
                      key={v.id || vIdx}
                      type="button"
                      onClick={(e) => handleSelectVariantTake(e, vIdx)}
                      className={`transition-all cursor-pointer rounded-full active:scale-90 ${
                        isActive
                          ? 'w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-amber-300 ring-2 ring-purple-300'
                          : 'w-1.5 h-1.5 bg-zinc-600 hover:bg-zinc-400'
                      }`}
                      title={`Take #${vIdx + 1}`}
                      aria-label={`Take ${vIdx + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Clear Button if typed */}
          {prompt.length > 0 && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 px-1.5 py-1 rounded-md hover:bg-zinc-900 transition cursor-pointer shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right Side: GENERATE BUTTON WITH CREDIT CONSUMING INSIDE */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleTriggerGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="h-8.5 px-3.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-500 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white flex items-center gap-1.5 shadow-lg shadow-purple-950/80 border border-purple-400/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0"
          title={`Generate AI video consuming ${estimatedCost} cr`}
          aria-label="Generate AI video"
        >
          {isGenerating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-xs font-mono font-black text-amber-300 tracking-tight">
                {estimatedCost} cr
              </span>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowUp size={12} className="stroke-[3] text-white" />
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
