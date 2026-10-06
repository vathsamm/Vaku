import React from 'react';
import { RotateCcw, X, Gauge, Maximize2, Volume2, Repeat, Play, Pause, Scissors, ArrowLeft, ArrowRight, RefreshCw, Axe } from 'lucide-react';
import { VideoEditorClip, VideoEditorAudioClip } from '../../../types';

export interface InlineLiveControlStripProps {
  activeInlineControl: 'speed' | 'scale' | 'audio_speed' | 'audio_volume' | 'trim' | 'loop' | null;
  setActiveInlineControl: (ctrl: 'speed' | 'scale' | 'audio_speed' | 'audio_volume' | 'trim' | 'loop' | null) => void;
  selectedClip: VideoEditorClip | null;
  selectedTimelineClipIndex: number | null;
  selectedAudioClip: VideoEditorAudioClip | null;
  selectedAudioClipIndex: number | null;
  handleResetClipTrim: (idx: number) => void;
  handleAdjustTrim: (idx: number, type: 'start' | 'end', delta: number) => void;
  handleSetTrimToPlayhead: (idx: number, type: 'start' | 'end') => void;
  handleUpdateClipSpeed: (idx: number, speed: number) => void;
  handleUpdateClipScale: (idx: number, scale: number) => void;
  handleUpdateAudioVolume: (idx: number, vol: number) => void;
  handleUpdateAudioSpeed: (idx: number, speed: number) => void;
  isLoopingClip?: boolean;
  loopClipIndex?: number | null;
  onToggleLoop?: (clipIdx?: number) => void;
  loopTrimTarget?: 'beginning' | 'end';
  setLoopTrimTarget?: (target: 'beginning' | 'end') => void;
  isPlaying?: boolean;
  togglePlayPause?: () => void;
  handleCombineClips?: (direction: 'prev' | 'next') => void;
  isCombiningClips?: boolean;
  totalClipsCount?: number;
  handleAutoChopBoundary?: (clipIdx: number, target?: 'beginning' | 'end' | 'both') => void;
  isAnalyzingBoundary?: boolean;
}

export const InlineLiveControlStrip: React.FC<InlineLiveControlStripProps> = ({
  activeInlineControl,
  setActiveInlineControl,
  selectedClip,
  selectedTimelineClipIndex,
  selectedAudioClip,
  selectedAudioClipIndex,
  handleResetClipTrim,
  handleAdjustTrim,
  handleSetTrimToPlayhead,
  handleUpdateClipSpeed,
  handleUpdateClipScale,
  handleUpdateAudioVolume,
  handleUpdateAudioSpeed,
  isLoopingClip = false,
  loopClipIndex = null,
  onToggleLoop,
  loopTrimTarget = 'end',
  setLoopTrimTarget,
  isPlaying = false,
  togglePlayPause,
  handleCombineClips,
  isCombiningClips = false,
  totalClipsCount = 0,
  handleAutoChopBoundary,
  isAnalyzingBoundary = false,
}) => {
  if (!activeInlineControl) return null;

  return (
    <div className="bg-zinc-950 border-t border-zinc-800 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-2 shrink-0 z-20 animate-in slide-in-from-bottom duration-150 w-full max-w-full overflow-hidden">
      {/* 0. LOOP & QUICK-TRIM CONTROLS (Live Endless Loop with Start/End Quick Trimming & Integrated Long Merge Buttons) */}
      {activeInlineControl === 'loop' && selectedClip && selectedTimelineClipIndex !== null && (() => {
        const currentTarget = loopTrimTarget || 'end';

        return (
          <div className="flex flex-col gap-1.5 w-full max-w-full overflow-hidden">
            {/* ROW 1: Reset, Boundary Chop, Long Previous Merge, Long Next Merge, Close (Black & White UI) */}
            <div className="flex items-center justify-between gap-1.5 w-full">
              {/* Reset Button */}
              <button
                type="button"
                onClick={() => handleResetClipTrim(selectedTimelineClipIndex)}
                className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] sm:text-[10.5px] font-bold shrink-0 border border-zinc-700 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
                title="Reset trim to full original clip"
              >
                <RotateCcw size={11} className="text-white" />
                <span>Reset</span>
              </button>

              {/* Boundary Chop Button (Checks boundaries & auto-chops corner frames/missing frames) */}
              <button
                type="button"
                disabled={isAnalyzingBoundary}
                onClick={() => handleAutoChopBoundary && handleAutoChopBoundary(selectedTimelineClipIndex, currentTarget)}
                className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[10px] sm:text-[10.5px] font-bold shrink-0 border border-zinc-700 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                title="Check boundaries of video clip and deeply cut corner frames / transition flash automatically"
                aria-label="Boundary Chop"
              >
                {isAnalyzingBoundary ? (
                  <RefreshCw size={11} className="animate-spin text-white shrink-0" />
                ) : (
                  <Axe size={11} className="text-white shrink-0" />
                )}
                <span>Boundary</span>
              </button>

              {/* Long Previous Merge and Next Merge Buttons */}
              {handleCombineClips && (
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  {/* Previous Merge */}
                  <button
                    type="button"
                    disabled={selectedTimelineClipIndex <= 0 || isCombiningClips}
                    onClick={() => handleCombineClips('prev')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10.5px] sm:text-[11px] font-bold border transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 truncate ${
                      selectedTimelineClipIndex > 0 && !isCombiningClips
                        ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white shadow-xs'
                        : 'bg-zinc-950 text-white/30 border-zinc-900 cursor-not-allowed opacity-40'
                    }`}
                    title={selectedTimelineClipIndex > 0 ? `Merge with previous clip #${selectedTimelineClipIndex}` : 'No previous clip on timeline'}
                    aria-label="Previous Merge"
                  >
                    {isCombiningClips ? (
                      <RefreshCw size={11} className="animate-spin text-white shrink-0" />
                    ) : (
                      <ArrowLeft size={12} className={selectedTimelineClipIndex > 0 ? "text-white shrink-0" : "text-white/30 shrink-0"} />
                    )}
                    <span className="truncate">Previous Merge</span>
                  </button>

                  {/* Next Merge */}
                  <button
                    type="button"
                    disabled={(totalClipsCount > 0 ? selectedTimelineClipIndex >= totalClipsCount - 1 : false) || isCombiningClips}
                    onClick={() => handleCombineClips('next')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[10.5px] sm:text-[11px] font-bold border transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 truncate ${
                      (totalClipsCount > 0 ? selectedTimelineClipIndex < totalClipsCount - 1 : true) && !isCombiningClips
                        ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white shadow-xs'
                        : 'bg-zinc-950 text-white/30 border-zinc-900 cursor-not-allowed opacity-40'
                    }`}
                    title={totalClipsCount > 0 && selectedTimelineClipIndex < totalClipsCount - 1 ? `Merge with next clip #${selectedTimelineClipIndex + 2}` : 'No next clip on timeline'}
                    aria-label="Next Merge"
                  >
                    <span className="truncate">Next Merge</span>
                    {isCombiningClips ? (
                      <RefreshCw size={11} className="animate-spin text-white shrink-0" />
                    ) : (
                      <ArrowRight size={12} className={(totalClipsCount > 0 ? selectedTimelineClipIndex < totalClipsCount - 1 : true) ? "text-white shrink-0" : "text-white/30 shrink-0"} />
                    )}
                  </button>
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveInlineControl(null);
                  if (onToggleLoop && isLoopingClip) {
                    onToggleLoop(selectedTimelineClipIndex);
                  }
                }}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0 transition"
                title="Close loop panel"
                aria-label="Close Loop Controls"
              >
                <X size={15} />
              </button>
            </div>

            {/* ROW 2: Shortform Target Switcher (Start / End) + Quick-Trim & Add Buttons (Pure Black & White UI) */}
            <div className="flex items-center justify-between gap-1 w-full py-0.5 overflow-hidden">
              {/* Shortform Target Switcher: [ Start ] vs [ End ] */}
              <div className="flex items-center bg-black p-0.5 rounded-lg border border-zinc-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setLoopTrimTarget && setLoopTrimTarget('beginning')}
                  className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[10.5px] font-bold transition cursor-pointer active:scale-95 ${
                    currentTarget === 'beginning'
                      ? 'bg-white text-black shadow-xs font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Trim start of clip"
                >
                  Start
                </button>

                <button
                  type="button"
                  onClick={() => setLoopTrimTarget && setLoopTrimTarget('end')}
                  className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[10.5px] font-bold transition cursor-pointer active:scale-95 ${
                    currentTarget === 'end'
                      ? 'bg-white text-black shadow-xs font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Trim end of clip (Default)"
                >
                  End
                </button>
              </div>

              {/* Quick-Trim Group: -0.2s (primary highlight in B&W), -0.4s, -1s */}
              <div className="flex items-center gap-1 bg-black px-1.5 py-0.5 rounded-lg border border-zinc-800 shrink-0">
                <Scissors size={11} className="text-white shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    if (currentTarget === 'end') {
                      handleAdjustTrim(selectedTimelineClipIndex, 'end', -0.2);
                    } else {
                      handleAdjustTrim(selectedTimelineClipIndex, 'start', 0.2);
                    }
                  }}
                  className="px-2 py-0.5 bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black rounded text-[10.5px] sm:text-[11px] font-mono font-black transition cursor-pointer active:scale-95 shadow-xs"
                  title={`Trim -0.2s from ${currentTarget === 'end' ? 'end' : 'start'}`}
                >
                  -0.2s
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentTarget === 'end') {
                      handleAdjustTrim(selectedTimelineClipIndex, 'end', -0.4);
                    } else {
                      handleAdjustTrim(selectedTimelineClipIndex, 'start', 0.4);
                    }
                  }}
                  className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-white border border-zinc-700 rounded text-[10px] sm:text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95"
                  title={`Trim -0.4s from ${currentTarget === 'end' ? 'end' : 'start'}`}
                >
                  -0.4s
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentTarget === 'end') {
                      handleAdjustTrim(selectedTimelineClipIndex, 'end', -1.0);
                    } else {
                      handleAdjustTrim(selectedTimelineClipIndex, 'start', 1.0);
                    }
                  }}
                  className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 text-white border border-zinc-700 rounded text-[10px] sm:text-[10.5px] font-mono font-bold transition cursor-pointer active:scale-95"
                  title={`Trim -1s from ${currentTarget === 'end' ? 'end' : 'start'}`}
                >
                  -1s
                </button>
              </div>

              {/* Quick-Add Group: +0.2s, +0.5s */}
              <div className="flex items-center gap-1 bg-black px-1.5 py-0.5 rounded-lg border border-zinc-800 shrink-0">
                <span className="text-[9px] font-semibold text-zinc-400 pl-0.5">
                  +
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (currentTarget === 'end') {
                      handleAdjustTrim(selectedTimelineClipIndex, 'end', 0.2);
                    } else {
                      handleAdjustTrim(selectedTimelineClipIndex, 'start', -0.2);
                    }
                  }}
                  className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 rounded text-[9.5px] sm:text-[10px] font-mono transition cursor-pointer active:scale-95"
                  title={`Add +0.2s to ${currentTarget === 'end' ? 'end' : 'start'}`}
                >
                  +0.2s
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentTarget === 'end') {
                      handleAdjustTrim(selectedTimelineClipIndex, 'end', 0.5);
                    } else {
                      handleAdjustTrim(selectedTimelineClipIndex, 'start', -0.5);
                    }
                  }}
                  className="px-1.5 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 rounded text-[9.5px] sm:text-[10px] font-mono transition cursor-pointer active:scale-95"
                  title={`Add +0.5s to ${currentTarget === 'end' ? 'end' : 'start'}`}
                >
                  +0.5s
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1. TRIM CONTROLS */}
      {activeInlineControl === 'trim' && selectedClip && selectedTimelineClipIndex !== null && (() => {
        const dur = selectedClip.duration && selectedClip.duration > 0 ? selectedClip.duration : 4.0;
        const trimStart = selectedClip.trim_start || 0;
        const trimEnd = selectedClip.trim_end !== undefined ? selectedClip.trim_end : dur;
        const trimmedSpan = Math.max(0.1, trimEnd - trimStart);
        return (
          <div className="flex flex-wrap items-center justify-between gap-1.5 w-full max-w-full text-xs">
            {/* Reset Button */}
            <button
              type="button"
              onClick={() => handleResetClipTrim(selectedTimelineClipIndex)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-amber-400 hover:text-amber-300 rounded-lg text-[11px] font-bold shrink-0 border border-gray-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
              title="Reset trim to full original clip"
            >
              <RotateCcw size={11} />
              <span>Full</span>
            </button>

            {/* Trim Start Controls */}
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-gray-800">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Start</span>
              <span className="font-mono text-amber-300 font-bold text-[11px] min-w-[34px] text-center">
                {trimStart.toFixed(2)}s
              </span>
              <button
                type="button"
                onClick={() => handleAdjustTrim(selectedTimelineClipIndex, 'start', -0.1)}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer"
                title="Cut -0.1s off start"
              >
                -0.1s
              </button>
              <button
                type="button"
                onClick={() => handleAdjustTrim(selectedTimelineClipIndex, 'start', 0.1)}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer"
                title="Add +0.1s to start"
              >
                +0.1s
              </button>
              <button
                type="button"
                onClick={() => handleSetTrimToPlayhead(selectedTimelineClipIndex, 'start')}
                className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 rounded text-[10px] font-semibold transition active:scale-95 cursor-pointer"
                title="Set trim start at current playhead position"
              >
                @ Playhead
              </button>
            </div>

            {/* Trim End Controls */}
            <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-gray-800">
              <span className="text-[10px] font-bold text-gray-400 uppercase">End</span>
              <span className="font-mono text-amber-300 font-bold text-[11px] min-w-[34px] text-center">
                {trimEnd.toFixed(2)}s
              </span>
              <button
                type="button"
                onClick={() => handleAdjustTrim(selectedTimelineClipIndex, 'end', -0.1)}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer"
                title="Trim -0.1s off end"
              >
                -0.1s
              </button>
              <button
                type="button"
                onClick={() => handleAdjustTrim(selectedTimelineClipIndex, 'end', 0.1)}
                className="px-1.5 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded text-[10px] font-bold transition active:scale-95 cursor-pointer"
                title="Extend +0.1s to end"
              >
                +0.1s
              </button>
              <button
                type="button"
                onClick={() => handleSetTrimToPlayhead(selectedTimelineClipIndex, 'end')}
                className="px-1.5 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 rounded text-[10px] font-semibold transition active:scale-95 cursor-pointer"
                title="Set trim end at current playhead position"
              >
                @ Playhead
              </button>
            </div>

            {/* Readout */}
            <span className="text-[10px] font-mono text-amber-300/90 font-bold shrink-0 bg-amber-950/40 px-2 py-1 rounded border border-amber-500/20">
              {trimmedSpan.toFixed(2)}s / {dur.toFixed(1)}s
            </span>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setActiveInlineControl(null)}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer shrink-0"
              title="Close trim controls"
            >
              <X size={14} />
            </button>
          </div>
        );
      })()}

      {/* 2. SPEED CONTROLS */}
      {activeInlineControl === 'speed' && selectedClip && selectedTimelineClipIndex !== null && (
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
          {/* Reset Button in Front */}
          <button
            type="button"
            onClick={() => handleUpdateClipSpeed(selectedTimelineClipIndex, 1.0)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-cyan-400 hover:text-cyan-300 rounded-lg text-[11px] font-bold shrink-0 border border-gray-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
            title="Reset playback speed to 1.0x (100%)"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-1 text-cyan-400 font-bold text-xs shrink-0">
            <Gauge size={13} />
            <span className="font-mono text-white bg-black/50 px-1.5 py-0.5 rounded border border-cyan-500/30 text-[11px]">
              {selectedClip.speed ? `${selectedClip.speed}x` : '1.0x'}
            </span>
          </div>
          
          <input
            type="range"
            min="0.25"
            max="3.0"
            step="0.05"
            value={selectedClip.speed || 1.0}
            onChange={(e) => handleUpdateClipSpeed(selectedTimelineClipIndex, parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setActiveInlineControl(null)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer shrink-0"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. SCALE / ZOOM CONTROLS */}
      {activeInlineControl === 'scale' && selectedClip && selectedTimelineClipIndex !== null && (
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
          {/* Reset Button in Front */}
          <button
            type="button"
            onClick={() => handleUpdateClipScale(selectedTimelineClipIndex, 1.0)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-purple-400 hover:text-purple-300 rounded-lg text-[11px] font-bold shrink-0 border border-gray-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
            title="Reset zoom to 100%"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-1 text-purple-400 font-bold text-xs shrink-0">
            <Maximize2 size={13} />
            <span className="font-mono text-white bg-black/50 px-1.5 py-0.5 rounded border border-purple-500/30 text-[11px]">
              {Math.round((selectedClip.scale || 1.0) * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.05"
            value={selectedClip.scale || 1.0}
            onChange={(e) => handleUpdateClipScale(selectedTimelineClipIndex, parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-purple-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setActiveInlineControl(null)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer shrink-0"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. AUDIO VOLUME CONTROLS */}
      {activeInlineControl === 'audio_volume' && selectedAudioClip && selectedAudioClipIndex !== null && (
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
          {/* Reset Button in Front */}
          <button
            type="button"
            onClick={() => handleUpdateAudioVolume(selectedAudioClipIndex, 1.0)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-pink-400 hover:text-pink-300 rounded-lg text-[11px] font-bold shrink-0 border border-gray-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
            title="Reset volume to 100%"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-1 text-pink-400 font-bold text-xs shrink-0">
            <Volume2 size={13} />
            <span className="font-mono text-white bg-black/50 px-1.5 py-0.5 rounded border border-pink-500/30 text-[11px]">
              {Math.round((selectedAudioClip.volume !== undefined ? selectedAudioClip.volume : 1.0) * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="2.0"
            step="0.05"
            value={selectedAudioClip.volume !== undefined ? selectedAudioClip.volume : 1.0}
            onChange={(e) => handleUpdateAudioVolume(selectedAudioClipIndex, parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-pink-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setActiveInlineControl(null)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer shrink-0"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. AUDIO SPEED CONTROLS */}
      {activeInlineControl === 'audio_speed' && selectedAudioClip && selectedAudioClipIndex !== null && (
        <div className="flex items-center gap-2 w-full max-w-full overflow-hidden">
          {/* Reset Button in Front */}
          <button
            type="button"
            onClick={() => handleUpdateAudioSpeed(selectedAudioClipIndex, 1.0)}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-cyan-400 hover:text-cyan-300 rounded-lg text-[11px] font-bold shrink-0 border border-gray-700/60 transition cursor-pointer active:scale-95 flex items-center gap-1 shadow-xs"
            title="Reset music speed to 1.0x"
          >
            <RotateCcw size={11} />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-1 text-cyan-400 font-bold text-xs shrink-0">
            <Gauge size={13} />
            <span className="font-mono text-white bg-black/50 px-1.5 py-0.5 rounded border border-cyan-500/30 text-[11px]">
              {selectedAudioClip.speed ? `${selectedAudioClip.speed}x` : '1.0x'}
            </span>
          </div>

          <input
            type="range"
            min="0.25"
            max="3.0"
            step="0.05"
            value={selectedAudioClip.speed || 1.0}
            onChange={(e) => handleUpdateAudioSpeed(selectedAudioClipIndex, parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-cyan-400 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setActiveInlineControl(null)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 cursor-pointer shrink-0"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
