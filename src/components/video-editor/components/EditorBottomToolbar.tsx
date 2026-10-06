import React, { useState, useEffect } from 'react';
import { 
  Scissors, Gauge, Volume2, Copy, Trash2, Layers, Check, 
  Edit2, Type, Maximize2, RefreshCw, Plus, Sparkles, Music, Cpu, SlidersHorizontal,
  ArrowLeft, ArrowRight, X, Repeat, Axe, Download
} from 'lucide-react';
import { 
  VideoEditorAudioClip, VideoEditorClip, VideoEditorCaption, 
  VideoEditorProject, VideoEditorTitleTemplate 
} from '../../../types';

export interface EditorBottomToolbarProps {
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  selectedAudioClip: VideoEditorAudioClip | null;
  selectedAudioClipIndex: number | null;
  setSelectedAudioClipIndex: (idx: number | null) => void;
  handleChopAudioClip: (idx: number) => void;
  totalDuration: number;
  activeAudioClips: VideoEditorAudioClip[];
  updateProjectAudioClips: (clips: VideoEditorAudioClip[], history?: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  activeInlineControl: 'speed' | 'scale' | 'audio_speed' | 'audio_volume' | 'trim' | 'loop' | null;
  setActiveInlineControl: React.Dispatch<React.SetStateAction<'speed' | 'scale' | 'audio_speed' | 'audio_volume' | 'trim' | 'loop' | null>>;
  handleDuplicateAudioClip: (idx: number) => void;
  handleDeleteAudioClip: (idx: number) => void;
  pauseAllPlayback: () => void;
  handleOpenCombineAudioModal: () => void;
  selectedCaptionId: string | null;
  setSelectedCaptionId: (id: string | null) => void;
  setCaptionViewMode: (v: 'list' | 'settings') => void;
  setShowTextDrawer: (v: boolean) => void;
  handleDuplicateClip: (idx: number | null) => void;
  handleDeleteCaption: (id: string) => void;
  selectedTimelineClipIndex: number | null;
  setSelectedTimelineClipIndex: (idx: number | null) => void;
  selectedClip: VideoEditorClip | null;
  handleSplitSelectedClip: () => void;
  handleChopSelectedClip: () => void;
  handleOpenChopStudio?: () => void;
  isChopping: boolean;
  handleInitiateReplaceClip: (idx: number) => void;
  handleDeleteSelectedClip: () => void;
  activeClips: VideoEditorClip[];
  setShowClipPicker: (v: boolean) => void;
  setShowAutoConfirmModal: (v: boolean) => void;
  setAudioPickMode: (mode: { mode: 'append' | 'replace'; targetIndex?: number }) => void;
  setShowAudioLibrary: (v: boolean) => void;
  activeProject: VideoEditorProject | null;
  setTitleViewMode: (v: 'list' | 'detail') => void;
  setShowTitleTemplateDrawer: (v: boolean) => void;
  activeTitleTemplate: VideoEditorTitleTemplate | null;
  setShowGpuCpuConfirmModal: (v: boolean) => void;
  enableGpuEnhancement: boolean;
  activeCaptions: VideoEditorCaption[];
  handleCombineClips?: (direction: 'prev' | 'next') => void;
  isCombiningClips?: boolean;
  isLoopingClip?: boolean;
  loopClipIndex?: number | null;
  onToggleLoop?: (clipIdx?: number) => void;
  onOpenAiPromptMode?: () => void;
  onSwitchClipVariant?: (clipIdx: number, variantIdx: number) => void;
  onOpenVariantDrawer?: (clipIdx?: number) => void;
  onDownloadActiveClips?: () => void;
  isDownloadingClips?: boolean;
}

export const EditorBottomToolbar: React.FC<EditorBottomToolbarProps> = ({
  isPlaying,
  setIsPlaying,
  selectedAudioClip,
  selectedAudioClipIndex,
  setSelectedAudioClipIndex,
  handleChopAudioClip,
  totalDuration,
  activeAudioClips,
  updateProjectAudioClips,
  showToast,
  activeInlineControl,
  setActiveInlineControl,
  handleDuplicateAudioClip,
  handleDeleteAudioClip,
  pauseAllPlayback,
  handleOpenCombineAudioModal,
  selectedCaptionId,
  setSelectedCaptionId,
  setCaptionViewMode,
  setShowTextDrawer,
  handleDuplicateClip,
  handleDeleteCaption,
  selectedTimelineClipIndex,
  setSelectedTimelineClipIndex,
  selectedClip,
  handleSplitSelectedClip,
  handleChopSelectedClip,
  handleOpenChopStudio,
  isChopping,
  handleInitiateReplaceClip,
  handleDeleteSelectedClip,
  activeClips,
  setShowClipPicker,
  setShowAutoConfirmModal,
  setAudioPickMode,
  setShowAudioLibrary,
  activeProject,
  setTitleViewMode,
  setShowTitleTemplateDrawer,
  activeTitleTemplate,
  setShowGpuCpuConfirmModal,
  enableGpuEnhancement,
  activeCaptions,
  handleCombineClips,
  isCombiningClips = false,
  isLoopingClip = false,
  loopClipIndex = null,
  onToggleLoop,
  onOpenAiPromptMode,
  onSwitchClipVariant,
  onOpenVariantDrawer,
  onDownloadActiveClips,
  isDownloadingClips = false,
}) => {
  return (
    <div 
      onPointerDownCapture={() => { if (isPlaying) setIsPlaying(false); }}
      className="h-13.5 sm:h-14.5 bg-gray-950/98 border-t border-gray-800/90 px-1 sm:px-1.5 flex items-center justify-start sm:justify-center gap-1 sm:gap-1.5 shrink-0 z-20 select-none overflow-x-auto scrollbar-none"
    >
      {selectedAudioClip && selectedAudioClipIndex !== null ? (
        /* AUDIO EDITING SUITE */
        <>
          {/* CUT AUDIO / SPLIT AT PLAYHEAD */}
          <button
            type="button"
            onClick={() => handleChopAudioClip(selectedAudioClipIndex)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Cut audio clip into 2 at current playhead"
            aria-label="Cut Music"
          >
            <Scissors size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Cut</span>
          </button>

          {/* 1-TAP FIT / TRIM TO VIDEO END */}
          {totalDuration > 0 && (
            <button
              type="button"
              onClick={() => {
                const clipStart = selectedAudioClip.start_time !== undefined ? selectedAudioClip.start_time : 0;
                const maxAllowed = Math.max(0.2, totalDuration - clipStart);
                const speed = selectedAudioClip.speed || 1;
                const targetTrimEnd = (selectedAudioClip.trim_start || 0) + (maxAllowed * speed);
                const targetDuration = Math.max(selectedAudioClip.duration || 0, targetTrimEnd);
                const updatedClips = [...activeAudioClips];
                updatedClips[selectedAudioClipIndex] = {
                  ...selectedAudioClip,
                  duration: targetDuration,
                  trim_end: Number(targetTrimEnd.toFixed(2))
                };
                updateProjectAudioClips(updatedClips, true);
                showToast("Audio track trimmed to video end", "success");
              }}
              className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
              title="Fit audio to end of video"
              aria-label="Fit End"
            >
              <Scissors size={16} className="text-white" />
              <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Fit End</span>
            </button>
          )}

          {/* AUDIO SPEED BUTTON */}
          <button
            type="button"
            onClick={() => setActiveInlineControl(prev => prev === 'audio_speed' ? null : 'audio_speed')}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeInlineControl === 'audio_speed'
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Music playback speed (inline slider)"
            aria-label="Music Speed"
          >
            <Gauge size={16} className={activeInlineControl === 'audio_speed' ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeInlineControl === 'audio_speed' ? "text-black font-black" : "text-white"}`}>
              {selectedAudioClip.speed && selectedAudioClip.speed !== 1 ? `${selectedAudioClip.speed}x` : 'Speed'}
            </span>
          </button>

          {/* AUDIO VOLUME BUTTON */}
          <button
            type="button"
            onClick={() => setActiveInlineControl(prev => prev === 'audio_volume' ? null : 'audio_volume')}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeInlineControl === 'audio_volume'
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Music volume level (0% - 200%)"
            aria-label="Music Volume"
          >
            <Volume2 size={16} className={activeInlineControl === 'audio_volume' ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeInlineControl === 'audio_volume' ? "text-black font-black" : "text-white"}`}>
              {selectedAudioClip.volume !== undefined && selectedAudioClip.volume !== 1 ? `${Math.round(selectedAudioClip.volume * 100)}%` : 'Volume'}
            </span>
          </button>

          {/* DUPLICATE AUDIO CLIP */}
          <button
            type="button"
            onClick={() => handleDuplicateAudioClip(selectedAudioClipIndex)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Duplicate this audio track"
            aria-label="Duplicate Music"
          >
            <Copy size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Duplicate</span>
          </button>

          {/* DELETE AUDIO CLIP */}
          <button
            type="button"
            onClick={() => handleDeleteAudioClip(selectedAudioClipIndex)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Delete this audio track"
            aria-label="Delete Music"
          >
            <Trash2 size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Delete</span>
          </button>

          {/* COMBINE AUDIO BUTTON */}
          {activeAudioClips.length > 1 && (
            <button
              type="button"
              onClick={() => {
                pauseAllPlayback();
                handleOpenCombineAudioModal();
              }}
              className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
              title="Combine and merge all timeline audio tracks into a single synced audio file"
              aria-label="Combine Music"
            >
              <Layers size={16} className="text-white" />
              <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Combine</span>
            </button>
          )}

          {/* DESELECT / DONE BUTTON */}
          <button
            type="button"
            onClick={() => {
              setSelectedAudioClipIndex(null);
              setActiveInlineControl(null);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1 font-bold"
            title="Exit audio focus and return to timeline tools"
            aria-label="Done"
          >
            <Check size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Done</span>
          </button>
        </>
      ) : selectedCaptionId !== null ? (
        /* SCENARIO 2: CAPTION / TEXT SELECTED */
        <>
          {/* 1. EDIT TEXT */}
          <button
            type="button"
            onClick={() => {
              setCaptionViewMode('settings');
              setShowTextDrawer(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Edit Caption Text"
            aria-label="Edit Text"
          >
            <Edit2 size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Edit</span>
          </button>

          {/* 2. STYLE / TEMPLATES */}
          <button
            type="button"
            onClick={() => {
              setCaptionViewMode('list');
              setShowTextDrawer(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Caption Templates & Styles"
            aria-label="Style"
          >
            <Type size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Style</span>
          </button>

          {/* 3. DUPLICATE CAPTION */}
          <button
            type="button"
            onClick={() => handleDuplicateClip(null)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Duplicate this caption"
            aria-label="Duplicate"
          >
            <Copy size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Duplicate</span>
          </button>

          {/* 4. DELETE CAPTION */}
          <button
            type="button"
            onClick={() => {
              handleDeleteCaption(selectedCaptionId);
              setSelectedCaptionId(null);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Delete this caption"
            aria-label="Delete"
          >
            <Trash2 size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Delete</span>
          </button>

          {/* 5. DONE */}
          <button
            type="button"
            onClick={() => setSelectedCaptionId(null)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1 font-bold"
            title="Exit caption focus"
            aria-label="Done"
          >
            <Check size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Done</span>
          </button>
        </>
      ) : selectedTimelineClipIndex !== null && selectedClip ? (
        /* SCENARIO 3: VIDEO CLIP SELECTED */
        <>
          {/* 1. SPLIT CLIP */}
          <button
            type="button"
            onClick={handleSplitSelectedClip}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Split clip at playhead"
            aria-label="Split"
          >
            <Scissors size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Split</span>
          </button>

          {/* 2. CHOP CLIP */}
          <button
            type="button"
            onClick={handleChopSelectedClip}
            disabled={isChopping}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[62px] h-11 sm:h-11.5 rounded-lg border transition flex flex-col items-center justify-center gap-0.5 shadow-xs px-1 shrink-0 ${
              isChopping
                ? 'bg-zinc-950 border-zinc-900 text-white/30 cursor-not-allowed opacity-40'
                : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white cursor-pointer active:scale-95'
            }`}
            title="Chop: Cut clip along exact scene transitions"
            aria-label="Chop"
          >
            {isChopping ? (
              <RefreshCw size={16} className="text-white/40 animate-spin" />
            ) : (
              <Axe size={16} className="text-white" />
            )}
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">
              {isChopping ? 'Chop...' : 'Chop'}
            </span>
          </button>

          {/* 2.5 AI GEN */}
          {onOpenAiPromptMode && (
            <button
              type="button"
              onClick={onOpenAiPromptMode}
              className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1 font-bold"
              title="AI Gen: Transform selected clip"
              aria-label="AI Gen"
            >
              <Sparkles size={16} className="text-white" />
              <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">
                AI Gen
              </span>
            </button>
          )}


          {/* 3. REPLACE CLIP */}
          <button
            type="button"
            onClick={() => handleInitiateReplaceClip(selectedTimelineClipIndex)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Replace this clip from bucket folders or use Auto"
            aria-label="Replace"
          >
            <RefreshCw size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">
              Replace
            </span>
          </button>

          {/* 4. SPEED (Inline Slider) */}
          <button
            type="button"
            onClick={() => setActiveInlineControl(prev => prev === 'speed' ? null : 'speed')}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeInlineControl === 'speed'
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Playback speed (inline slider)"
            aria-label="Speed"
          >
            <Gauge size={16} className={activeInlineControl === 'speed' ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeInlineControl === 'speed' ? "text-black font-black" : "text-white"}`}>
              {selectedClip?.speed && selectedClip.speed !== 1 ? `${selectedClip.speed}x` : 'Speed'}
            </span>
            {selectedClip?.speed && selectedClip.speed !== 1 && (
              <span className={`absolute -top-0.5 -right-0.5 px-1 font-mono font-black text-[7px] rounded-full leading-tight shadow ${activeInlineControl === 'speed' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                {selectedClip.speed}x
              </span>
            )}
          </button>

          {/* 5. ZOOM / SCALE (Inline Slider) */}
          <button
            type="button"
            onClick={() => setActiveInlineControl(prev => prev === 'scale' ? null : 'scale')}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeInlineControl === 'scale'
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Resize / Zoom clip (inline slider)"
            aria-label="Zoom / Scale"
          >
            <Maximize2 size={16} className={activeInlineControl === 'scale' ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeInlineControl === 'scale' ? "text-black font-black" : "text-white"}`}>
              {selectedClip?.scale && selectedClip.scale !== 1 ? `${Math.round(selectedClip.scale * 100)}%` : 'Zoom'}
            </span>
            {selectedClip?.scale && selectedClip.scale !== 1 && (
              <span className={`absolute -top-0.5 -right-0.5 px-1 font-mono font-black text-[7px] rounded-full leading-tight shadow ${activeInlineControl === 'scale' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                {Math.round(selectedClip.scale * 100)}%
              </span>
            )}
          </button>

          {/* 6. LOOP CLIP (Endless Loop with Start/End Quick Trimming & Integrated Combine - Absolutely NO Rotation Animation) */}
          <button
            type="button"
            onClick={() => {
              if (onToggleLoop) {
                onToggleLoop(selectedTimelineClipIndex);
              } else {
                setActiveInlineControl(prev => prev === 'loop' ? null : 'loop');
              }
            }}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              isLoopingClip && loopClipIndex === selectedTimelineClipIndex
                ? 'bg-white text-black border-white font-black'
                : activeInlineControl === 'loop'
                ? 'bg-zinc-800 text-white border-zinc-500'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Loop this clip continuously, combine with adjacent clips, and quick-trim"
            aria-label="Loop Clip"
          >
            <Repeat size={16} className={isLoopingClip && loopClipIndex === selectedTimelineClipIndex ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${isLoopingClip && loopClipIndex === selectedTimelineClipIndex ? "text-black font-black" : "text-white"}`}>
              {isLoopingClip && loopClipIndex === selectedTimelineClipIndex ? 'Looping' : 'Loop'}
            </span>
            {isLoopingClip && loopClipIndex === selectedTimelineClipIndex && (
              <span className="absolute -top-0.5 -right-0.5 px-1 bg-black text-white font-mono font-black text-[7px] rounded-full leading-tight shadow border border-zinc-700">
                ON
              </span>
            )}
          </button>

          {/* 7. DUPLICATE CLIP */}
          <button
            type="button"
            onClick={() => handleDuplicateClip(selectedTimelineClipIndex)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Duplicate this clip"
            aria-label="Duplicate"
          >
            <Copy size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Duplicate</span>
          </button>

          {/* 8. DELETE CLIP */}
          <button
            type="button"
            onClick={handleDeleteSelectedClip}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Delete selected clip"
            aria-label="Delete"
          >
            <Trash2 size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Delete</span>
          </button>

          {/* 9. DESELECT / DONE */}
          <button
            type="button"
            onClick={() => {
              setSelectedTimelineClipIndex(null);
              setActiveInlineControl(null);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1 font-bold"
            title="Exit clip focus and return to main toolbar"
            aria-label="Done"
          >
            <Check size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Done</span>
          </button>

          {/* 10. DOWNLOAD ALL ACTIVE CLIPS IN STRIP (Last Button) */}
          {onDownloadActiveClips && (
            <button
              type="button"
              onClick={onDownloadActiveClips}
              disabled={isDownloadingClips || activeClips.length === 0}
              className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[62px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs relative shrink-0 px-1 cursor-pointer active:scale-95 ${
                isDownloadingClips
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 animate-pulse'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={`Download all ${activeClips.length} active clips in strip to gallery`}
              aria-label="Download Clips"
            >
              {isDownloadingClips ? (
                <RefreshCw size={16} className="text-amber-300 animate-spin" />
              ) : (
                <Download size={16} className="text-white" />
              )}
              <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${isDownloadingClips ? 'text-amber-300' : 'text-white'}`}>
                {isDownloadingClips ? 'Saving...' : 'Download'}
              </span>
              {activeClips.length > 0 && !isDownloadingClips && (
                <span className="absolute -top-0.5 -right-0.5 px-1 bg-amber-400 text-black font-mono font-black text-[7px] rounded-full leading-tight shadow">
                  {activeClips.length}
                </span>
              )}
            </button>
          )}
        </>
      ) : activeClips.length === 0 ? (
        /* SCENARIO 4: TIMELINE IS EMPTY */
        <>
          {/* 1. ADD / PICK CLIPS */}
          <button
            type="button"
            onClick={() => setShowClipPicker(true)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black border border-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1 font-black"
            title="Add video clips from buckets"
            aria-label="Add Videos"
          >
            <Plus size={16} className="stroke-[2.5] text-black" />
            <span className="text-[9.5px] sm:text-[10px] font-black tracking-tight text-black">Add</span>
          </button>

          {/* 2. AUTO ASSEMBLE */}
          <button
            type="button"
            onClick={() => setShowAutoConfirmModal(true)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Auto-assemble timeline clips from bucket folders in order (B1 → B8)"
            aria-label="Auto"
          >
            <Sparkles size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Auto</span>
          </button>

          {/* 3. AUDIO / MUSIC */}
          <button
            type="button"
            onClick={() => {
              setAudioPickMode({ mode: 'append' });
              setShowAudioLibrary(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1"
            title="Open Audio Library & Manage Background Music"
            aria-label="Audio"
          >
            <Music size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Audio</span>
            {activeProject?.audio_url && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-black shadow" />
            )}
          </button>

          {/* 4. TEXT / CAPTION */}
          <button
            type="button"
            onClick={() => {
              setCaptionViewMode('list');
              setShowTextDrawer(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1"
            title="Caption Studio (T)"
            aria-label="Text"
          >
            <div className="flex items-center justify-center font-black font-sans text-xs text-white leading-none">
              T
            </div>
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Text</span>
          </button>

          {/* 5. AI TITLE & HASHTAGS */}
          <button
            type="button"
            onClick={() => {
              setTitleViewMode('detail');
              setShowTitleTemplateDrawer(true);
            }}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeTitleTemplate
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white'
            }`}
            title={`AI Title & Hashtag Studio • ${activeTitleTemplate ? `Active: "${activeTitleTemplate.name}"` : 'None active'}`}
            aria-label="AI Title & Hashtags"
          >
            <Sparkles size={16} className={activeTitleTemplate ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeTitleTemplate ? "text-black font-black" : "text-white"}`}>
              AI Title
            </span>
            {activeTitleTemplate && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-black rounded-full border border-white shadow" title={`Active: ${activeTitleTemplate.name}`} />
            )}
          </button>

          {/* 6. GPU / CPU MODE TOGGLE */}
          <button
            type="button"
            onClick={() => setShowGpuCpuConfirmModal(true)}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              enableGpuEnhancement
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
            }`}
            title={enableGpuEnhancement ? "GPU Mode active (Dual-T4). Click to switch to CPU." : "CPU Mode active (Standard). Click to switch to GPU."}
            aria-label={enableGpuEnhancement ? "GPU Mode" : "CPU Mode"}
          >
            <Cpu size={16} className={enableGpuEnhancement ? "text-black stroke-[2.2]" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${enableGpuEnhancement ? "text-black font-black" : "text-white"}`}>
              {enableGpuEnhancement ? "GPU" : "CPU"}
            </span>
            {enableGpuEnhancement && (
              <span className="absolute -top-0.5 -right-0.5 px-1 bg-black text-white font-mono font-black text-[7px] rounded-full leading-tight shadow border border-zinc-700">
                ON
              </span>
            )}
          </button>

          {/* 7. DOWNLOAD ALL ACTIVE CLIPS IN STRIP (Last Button) */}
          {onDownloadActiveClips && (
            <button
              type="button"
              onClick={onDownloadActiveClips}
              disabled={isDownloadingClips || activeClips.length === 0}
              className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[62px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs relative shrink-0 px-1 cursor-pointer active:scale-95 ${
                isDownloadingClips
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 animate-pulse'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={`Download all ${activeClips.length} active clips in strip to gallery`}
              aria-label="Download Clips"
            >
              {isDownloadingClips ? (
                <RefreshCw size={16} className="text-amber-300 animate-spin" />
              ) : (
                <Download size={16} className="text-white" />
              )}
              <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${isDownloadingClips ? 'text-amber-300' : 'text-white'}`}>
                {isDownloadingClips ? 'Saving...' : 'Download'}
              </span>
              {activeClips.length > 0 && !isDownloadingClips && (
                <span className="absolute -top-0.5 -right-0.5 px-1 bg-amber-400 text-black font-mono font-black text-[7px] rounded-full leading-tight shadow">
                  {activeClips.length}
                </span>
              )}
            </button>
          )}
        </>
      ) : (
        /* SCENARIO 5: DEFAULT / GLOBAL TIMELINE */
        <>
          {/* 1. ADD CLIPS */}
          <button
            type="button"
            onClick={() => setShowClipPicker(true)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Add more clips to timeline"
            aria-label="Add"
          >
            <Plus size={16} className="text-white stroke-[2.5]" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Add</span>
          </button>

          {/* 2. SPLIT AT PLAYHEAD */}
          <button
            type="button"
            onClick={handleSplitSelectedClip}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Split clip at playhead"
            aria-label="Split"
          >
            <Scissors size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Split</span>
          </button>

          {/* 3. LOOP CLIP UNDER SLIDER (Absolutely NO Rotation Animation) */}
          <button
            type="button"
            onClick={() => onToggleLoop ? onToggleLoop() : null}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              isLoopingClip
                ? 'bg-white text-black border-white font-black'
                : activeInlineControl === 'loop'
                ? 'bg-zinc-800 text-white border-zinc-500'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white hover:border-zinc-700'
            }`}
            title="Loop whichever clip is under the slider and quick-trim"
            aria-label="Loop Clip"
          >
            <Repeat size={16} className={isLoopingClip ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${isLoopingClip ? "text-black font-black" : "text-white"}`}>
              {isLoopingClip ? 'Looping' : 'Loop'}
            </span>
            {isLoopingClip && (
              <span className="absolute -top-0.5 -right-0.5 px-1 bg-black text-white font-mono font-black text-[7px] rounded-full leading-tight shadow border border-zinc-700">
                ON
              </span>
            )}
          </button>

          {/* 4. AUTO ASSEMBLE */}
          <button
            type="button"
            onClick={() => setShowAutoConfirmModal(true)}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 shrink-0 px-1"
            title="Auto-assemble timeline clips from bucket folders in order (B1 → B8)"
            aria-label="Auto"
          >
            <Sparkles size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Auto</span>
          </button>

          {/* 5. AUDIO / MUSIC */}
          <button
            type="button"
            onClick={() => {
              setAudioPickMode({ mode: 'append' });
              setShowAudioLibrary(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1"
            title="Open Audio Library & Manage Background Music"
            aria-label="Audio"
          >
            <Music size={16} className="text-white" />
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Audio</span>
            {activeProject?.audio_url && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full border border-black shadow" />
            )}
          </button>

          {/* 6. TEXT / CAPTION */}
          <button
            type="button"
            onClick={() => {
              setCaptionViewMode('list');
              setShowTextDrawer(true);
            }}
            className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1"
            title="Caption Studio (T)"
            aria-label="Text"
          >
            <div className="flex items-center justify-center font-black font-sans text-xs text-white leading-none">
              T
            </div>
            <span className="text-[9.5px] sm:text-[10px] font-bold text-white tracking-tight">Text</span>
            {activeCaptions.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 px-1 py-0.2 bg-white text-black font-mono font-black text-[7px] rounded-full leading-tight shadow">
                {activeCaptions.length}
              </span>
            )}
          </button>

          {/* 7. AI TITLE & HASHTAGS */}
          <button
            type="button"
            onClick={() => {
              setTitleViewMode('detail');
              setShowTitleTemplateDrawer(true);
            }}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-sm cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              activeTitleTemplate
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white'
            }`}
            title={`AI Title & Hashtag Studio • ${activeTitleTemplate ? `Active: "${activeTitleTemplate.name}"` : 'None active'}`}
            aria-label="AI Title & Hashtags"
          >
            <Sparkles size={16} className={activeTitleTemplate ? "text-black" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${activeTitleTemplate ? "text-black font-black" : "text-white"}`}>
              AI Title
            </span>
            {activeTitleTemplate && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-black rounded-full border border-white shadow" title={`Active: ${activeTitleTemplate.name}`} />
            )}
          </button>

          {/* 8. COMBINE AUDIO */}
          {activeAudioClips.length > 1 && (
            <button
              type="button"
              onClick={() => {
                pauseAllPlayback();
                handleOpenCombineAudioModal();
              }}
              className="flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1"
              title={`Combine & merge all ${activeAudioClips.length} timeline audio tracks`}
              aria-label="Combine"
            >
              <Layers size={16} className="text-white" />
              <span className="text-[9.5px] sm:text-[10px] font-bold tracking-tight text-white">
                Combine
              </span>
              <span className="absolute -top-0.5 -right-0.5 px-1 bg-white text-black font-mono font-black text-[7px] rounded-full leading-tight shadow">
                {activeAudioClips.length}
              </span>
            </button>
          )}

          {/* 9. GPU / CPU MODE TOGGLE */}
          <button
            type="button"
            onClick={() => setShowGpuCpuConfirmModal(true)}
            className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[60px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer active:scale-95 relative shrink-0 px-1 ${
              enableGpuEnhancement
                ? 'bg-white text-black border-white font-black'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
            }`}
            title={enableGpuEnhancement ? "GPU Mode active (Dual-T4). Click to switch to CPU." : "CPU Mode active (Standard). Click to switch to GPU."}
            aria-label={enableGpuEnhancement ? "GPU Mode" : "CPU Mode"}
          >
            <Cpu size={16} className={enableGpuEnhancement ? "text-black stroke-[2.2]" : "text-white"} />
            <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${enableGpuEnhancement ? "text-black font-black" : "text-white"}`}>
              {enableGpuEnhancement ? "GPU" : "CPU"}
            </span>
            {enableGpuEnhancement && (
              <span className="absolute -top-0.5 -right-0.5 px-1 bg-black text-white font-mono font-black text-[7px] rounded-full leading-tight shadow border border-zinc-700">
                ON
              </span>
            )}
          </button>

          {/* 10. DOWNLOAD ALL ACTIVE CLIPS IN STRIP (Last Button) */}
          {onDownloadActiveClips && (
            <button
              type="button"
              onClick={onDownloadActiveClips}
              disabled={isDownloadingClips || activeClips.length === 0}
              className={`flex-1 min-w-[44px] sm:min-w-[48px] max-w-[62px] h-11 sm:h-11.5 border rounded-lg transition flex flex-col items-center justify-center gap-0.5 shadow-xs relative shrink-0 px-1 cursor-pointer active:scale-95 ${
                isDownloadingClips
                  ? 'bg-amber-950/80 border-amber-500/70 text-amber-300 animate-pulse'
                  : 'bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-800 hover:border-zinc-700 text-white'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={`Download all ${activeClips.length} active clips in strip to gallery`}
              aria-label="Download Clips"
            >
              {isDownloadingClips ? (
                <RefreshCw size={16} className="text-amber-300 animate-spin" />
              ) : (
                <Download size={16} className="text-white" />
              )}
              <span className={`text-[9.5px] sm:text-[10px] font-bold tracking-tight ${isDownloadingClips ? 'text-amber-300' : 'text-white'}`}>
                {isDownloadingClips ? 'Saving...' : 'Download'}
              </span>
              {activeClips.length > 0 && !isDownloadingClips && (
                <span className="absolute -top-0.5 -right-0.5 px-1 bg-amber-400 text-black font-mono font-black text-[7px] rounded-full leading-tight shadow">
                  {activeClips.length}
                </span>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
