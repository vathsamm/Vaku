import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, Pause, Film, Plus, Volume2, VolumeX, Edit2, 
  Bookmark, Trash2, UploadCloud, Layers 
} from 'lucide-react';
import { 
  VideoEditorClip, VideoEditorAudioClip, VideoEditorCaption, 
  VideoEditorProject, VideoEditorCaptionTemplate, AudioItem,
  HiggsfieldJob, getClipVariantGroups
} from '../../../types';
import { CAPTION_FONTS } from '../constants';
import { HiggsfieldGenerationBubble } from './HiggsfieldGenerationBubble';

export interface VideoPreviewStageProps {
  videoViewportRef: React.RefObject<HTMLDivElement | null>;
  activeProject: VideoEditorProject | null;
  activeClips: VideoEditorClip[];
  currentPlayingClip: VideoEditorClip | null;
  currentClipIndex: number;
  previousClipIndex: number;
  loadedClipIds: Set<string>;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  clipBlobUrls: Record<string, string>;
  getMemoryBlobUrl: (fid: string) => string | null;
  config: any;
  getIsClipMuted: (clip?: VideoEditorClip | null) => boolean;
  applyVideoElementAudio: (clipId: string, el: HTMLVideoElement, clip: VideoEditorClip) => void;
  handleSyncClipMetadataDuration: (clipId: string, realDur: number) => void;
  timelineClipsMeta: any[];
  syncAudioTracksToTime: (time: number, isPlaying: boolean) => void;
  handleActiveTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>, idx: number) => void;
  handleVideoEnded: (idx: number) => void;
  togglePlayPause: () => void;
  isPlaying: boolean;
  showVerticalCenterGuide: boolean;
  showHorizontalCenterGuide: boolean;
  activeCaptions: VideoEditorCaption[];
  isCaptionVisible: (caption: VideoEditorCaption, currentClipIdx: number, totalClips: number, allCaptions: VideoEditorCaption[]) => boolean;
  selectedCaptionId: string | null;
  setSelectedCaptionId: (id: string | null) => void;
  handleOpenCaptionTemplateEditor: (caption: VideoEditorCaption) => void;
  handleCaptionPointerDown: (e: React.PointerEvent, caption: VideoEditorCaption) => void;
  handleCaptionContextMenu: (e: React.MouseEvent, caption: VideoEditorCaption) => void;
  handleCaptionCornerResizePointerDown: (e: React.PointerEvent, caption: VideoEditorCaption, corner: 'tl' | 'tr' | 'bl' | 'br') => void;
  handleCaptionWidthResizePointerDown: (e: React.PointerEvent, caption: VideoEditorCaption, side: 'left' | 'right') => void;
  lastCaptionTapRef: React.MutableRefObject<{ id: string; time: number } | null>;
  captionContextMenu: { caption: VideoEditorCaption; x: number; y: number } | null;
  setCaptionContextMenu: (menu: { caption: VideoEditorCaption; x: number; y: number } | null) => void;
  handleSaveAsTemplate: (caption: VideoEditorCaption) => void;
  handleUpdateCaption: (captionId: string, updates: Partial<VideoEditorCaption>) => void;
  setCaptionDefaults: React.Dispatch<React.SetStateAction<any>>;
  captionDefaults: any;
  masterBucketFid: string;
  captionTemplates: VideoEditorCaptionTemplate[];
  handleUpdateTemplate: (tpl: VideoEditorCaptionTemplate) => void;
  handleDeleteCaption: (id: string) => void;
  showToast: (msg: string, type?: any) => void;
  starredAudios: AudioItem[];
  activeAudioClips: VideoEditorAudioClip[];
  getBucketAudioSettings: (targetFid?: string | null) => any;
  updateProjectAudio: (audio: AudioItem) => void;
  handleReplaceAudioClip: (clipIdx: number, audio: AudioItem) => void;
  availableCaptionTemplates: VideoEditorCaptionTemplate[];
  selectedCaption: VideoEditorCaption | null;
  handleToggleCaptionOnProject: (tpl: VideoEditorCaptionTemplate) => void;
  openClipPicker: () => void;
  setNewProjectName: (name: string) => void;
  setShowNewProjectModal: (v: boolean) => void;
  projects: VideoEditorProject[];
  clipAudioLongPressTimerRef: React.MutableRefObject<any>;
  clipAudioLongPressTriggeredRef: React.MutableRefObject<boolean>;
  setShowMuteAllClipsModal: (v: boolean) => void;
  handleToggleCurrentClipMute: () => void;
  setCaptionViewMode: (mode: 'list' | 'settings') => void;
  setShowTextDrawer: (v: boolean) => void;
  setImportModalType?: (type: any) => void;
  onOpenAudioLibrary?: () => void;
  isLoopingClip?: boolean;
  loopClipIndex?: number | null;
  higgsfieldJobs?: HiggsfieldJob[];
  onSelectHiggsfieldJobForReview?: (job: HiggsfieldJob) => void;
  isHiggsfieldTrayOpen?: boolean;
  setIsHiggsfieldTrayOpen?: (v: boolean) => void;
  onOpenAiPromptMode?: () => void;
  onSwitchClipVariant?: (clipIdx: number, variantIdx: number) => void;
  onSwitchVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateVariantGroup?: (clipIdx: number, mode: 'empty_ai' | 'upload' | 'picker') => void;
  onUploadClipForConcept?: (clipIdx: number, files: FileList | File[], asNewConcept?: boolean) => void;
  onOpenVariantDrawer?: (clipIdx?: number) => void;
  onSelectTimelineClip?: (clipIdx: number) => void;
}

export const VideoPreviewStage: React.FC<VideoPreviewStageProps> = ({
  videoViewportRef,
  activeProject,
  activeClips,
  currentPlayingClip,
  currentClipIndex,
  previousClipIndex,
  loadedClipIds,
  videoElementsRef,
  clipBlobUrls,
  getMemoryBlobUrl,
  config,
  getIsClipMuted,
  applyVideoElementAudio,
  handleSyncClipMetadataDuration,
  timelineClipsMeta,
  syncAudioTracksToTime,
  handleActiveTimeUpdate,
  handleVideoEnded,
  togglePlayPause,
  isPlaying,
  showVerticalCenterGuide,
  showHorizontalCenterGuide,
  activeCaptions,
  isCaptionVisible,
  selectedCaptionId,
  setSelectedCaptionId,
  handleOpenCaptionTemplateEditor,
  handleCaptionPointerDown,
  handleCaptionContextMenu,
  handleCaptionCornerResizePointerDown,
  handleCaptionWidthResizePointerDown,
  lastCaptionTapRef,
  captionContextMenu,
  setCaptionContextMenu,
  handleSaveAsTemplate,
  handleUpdateCaption,
  setCaptionDefaults,
  captionDefaults,
  masterBucketFid,
  captionTemplates,
  handleUpdateTemplate,
  handleDeleteCaption,
  showToast,
  starredAudios,
  activeAudioClips,
  getBucketAudioSettings,
  updateProjectAudio,
  handleReplaceAudioClip,
  availableCaptionTemplates,
  selectedCaption,
  handleToggleCaptionOnProject,
  openClipPicker,
  setNewProjectName,
  setShowNewProjectModal,
  projects,
  clipAudioLongPressTimerRef,
  clipAudioLongPressTriggeredRef,
  setShowMuteAllClipsModal,
  handleToggleCurrentClipMute,
  setCaptionViewMode,
  setShowTextDrawer,
  onOpenAudioLibrary,
  isLoopingClip = false,
  loopClipIndex = null,
  higgsfieldJobs = [],
  onSelectHiggsfieldJobForReview = () => {},
  isHiggsfieldTrayOpen = false,
  setIsHiggsfieldTrayOpen = () => {},
  onOpenAiPromptMode = () => {},
  onSwitchClipVariant,
  onSwitchVariantGroup,
  onCreateVariantGroup,
  onUploadClipForConcept,
  onOpenVariantDrawer,
  onSelectTimelineClip,
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const lastWheelTimeRef = useRef<number>(0);
  const pointerStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeIndicator, setSwipeIndicator] = useState<{ text: string; direction: 'up' | 'down' | 'left' | 'right' } | null>(null);
  const swipeIndicatorTimerRef = useRef<any>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const [frameDimensions, setFrameDimensions] = useState<{ width: number; height: number } | null>(null);

  // State for Empty Concept Slot screen (activated via vertical upside/downside scroll or tapping '+')
  const [isEmptyConceptSlotActive, setIsEmptyConceptSlotActive] = useState<boolean>(false);

  // When switching timeline clips, reset empty concept slot state
  useEffect(() => {
    setIsEmptyConceptSlotActive(false);
  }, [currentClipIndex]);

  // Resolve Concepts for the current timeline position (e.g. Concept A, Concept B...)
  const variantGroups = useMemo(() => {
    return getClipVariantGroups(currentPlayingClip);
  }, [currentPlayingClip]);

  const activeGroupIdx = Math.min(
    Math.max(0, currentPlayingClip?.active_variant_group_index ?? 0),
    Math.max(0, variantGroups.length - 1)
  );

  const activeGroup = variantGroups[activeGroupIdx] || {
    id: `vg_A_${currentPlayingClip?.id || currentClipIndex}`,
    label: 'A',
    clips: currentPlayingClip ? [currentPlayingClip] : [],
    active_clip_index: 0
  };

  // Resolve Variants inside the currently active Concept (horizontal dots)
  const conceptVariants: VideoEditorClip[] = useMemo(() => {
    if (activeGroup.clips && activeGroup.clips.length > 0) {
      return activeGroup.clips;
    }
    if (currentPlayingClip?.variants && currentPlayingClip.variants.length > 0) {
      return currentPlayingClip.variants;
    }
    return currentPlayingClip ? [currentPlayingClip] : [];
  }, [activeGroup.clips, currentPlayingClip]);

  const activeVariantInConceptIdx = Math.min(
    Math.max(0, activeGroup.active_clip_index ?? currentPlayingClip?.active_variant_index ?? 0),
    Math.max(0, conceptVariants.length - 1)
  );

  // Automatically return back to normal concept whenever playback starts or active clip changes
  useEffect(() => {
    if (isPlaying && isEmptyConceptSlotActive) {
      setIsEmptyConceptSlotActive(false);
    }
  }, [isPlaying, isEmptyConceptSlotActive]);

  useEffect(() => {
    setIsEmptyConceptSlotActive(false);
  }, [currentClipIndex]);

  // Vertical navigation: Switch between Concepts (or scroll into empty concept slot)
  const handleSwitchConcept = useCallback((nextGroupIdx: number, direction: 'up' | 'down') => {
    if (nextGroupIdx >= variantGroups.length || nextGroupIdx < 0) {
      // Swiped past boundary (top or bottom): display the Empty Concept Slot screen!
      setIsEmptyConceptSlotActive(true);
      const nextLetter = String.fromCharCode(65 + variantGroups.length);
      setSwipeIndicator({
        text: `New Concept Slot (${nextLetter})`,
        direction
      });
    } else {
      setIsEmptyConceptSlotActive(false);
      onSwitchVariantGroup?.(currentClipIndex, nextGroupIdx);
      const targetGrp = variantGroups[nextGroupIdx];
      const grpLetter = targetGrp?.label || String.fromCharCode(65 + nextGroupIdx);
      setSwipeIndicator({
        text: `Concept ${grpLetter} (${nextGroupIdx + 1}/${variantGroups.length})`,
        direction
      });
    }
    if (swipeIndicatorTimerRef.current) clearTimeout(swipeIndicatorTimerRef.current);
    swipeIndicatorTimerRef.current = setTimeout(() => setSwipeIndicator(null), 850);
  }, [variantGroups, onSwitchVariantGroup, currentClipIndex]);

  // Horizontal navigation: Switch between Variants (dots) in current Concept
  const handleSwitchVariantWithinConcept = useCallback((nextIdx: number, direction: 'left' | 'right') => {
    if (conceptVariants.length <= 1 || !onSwitchClipVariant) return;
    const clampedIdx = (nextIdx + conceptVariants.length) % conceptVariants.length;
    onSwitchClipVariant(currentClipIndex, clampedIdx);
    const grpLetter = activeGroup.label || 'A';
    setSwipeIndicator({
      text: `Concept ${grpLetter} · Variant ${clampedIdx + 1}/${conceptVariants.length}`,
      direction
    });
    if (swipeIndicatorTimerRef.current) clearTimeout(swipeIndicatorTimerRef.current);
    swipeIndicatorTimerRef.current = setTimeout(() => setSwipeIndicator(null), 800);
  }, [conceptVariants.length, onSwitchClipVariant, currentClipIndex, activeGroup.label]);

  // Unified single-fire swipe handler (works identically for touch and mouse drag without double-firing)
  const lastSwipeHandledTimeRef = useRef<number>(0);

  const handleSwipeAction = useCallback((diffX: number, diffY: number) => {
    const now = Date.now();
    if (now - lastSwipeHandledTimeRef.current < 260) return;
    lastSwipeHandledTimeRef.current = now;

    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    const minThreshold = 20;

    if (absX < minThreshold && absY < minThreshold) return;

    if (absX >= absY) {
      // HORIZONTAL SWIPE -> VARIANTS (DOTS) IN CURRENT CONCEPT
      if (conceptVariants.length > 1) {
        const nextIdx = diffX < 0 ? activeVariantInConceptIdx + 1 : activeVariantInConceptIdx - 1;
        handleSwitchVariantWithinConcept(nextIdx, diffX < 0 ? 'left' : 'right');
      } else if (onOpenVariantDrawer) {
        onOpenVariantDrawer(currentClipIndex);
      }
    } else {
      // VERTICAL SWIPE -> CONCEPTS (TOP TO BOTTOM OR BOTTOM TO TOP)
      if (isEmptyConceptSlotActive) {
        // Return back to normal concept
        setIsEmptyConceptSlotActive(false);
        const grpLetter = activeGroup.label || 'A';
        setSwipeIndicator({
          text: `Concept ${grpLetter}`,
          direction: diffY < 0 ? 'up' : 'down'
        });
        if (swipeIndicatorTimerRef.current) clearTimeout(swipeIndicatorTimerRef.current);
        swipeIndicatorTimerRef.current = setTimeout(() => setSwipeIndicator(null), 800);
      } else {
        if (diffY < 0) {
          // Finger moved bottom to top (swipe UP):
          // Go to next concept, or open empty concept slot if no next concept exists
          if (activeGroupIdx + 1 < variantGroups.length) {
            handleSwitchConcept(activeGroupIdx + 1, 'up');
          } else {
            handleSwitchConcept(variantGroups.length, 'up');
          }
        } else {
          // Finger moved top to bottom (swipe DOWN):
          // Go to previous concept, or open empty concept slot if no previous concept exists
          if (activeGroupIdx > 0) {
            handleSwitchConcept(activeGroupIdx - 1, 'down');
          } else {
            handleSwitchConcept(-1, 'down');
          }
        }
      }
    }
  }, [
    conceptVariants.length,
    activeVariantInConceptIdx,
    handleSwitchVariantWithinConcept,
    onOpenVariantDrawer,
    currentClipIndex,
    isEmptyConceptSlotActive,
    activeGroup.label,
    activeGroupIdx,
    variantGroups.length,
    handleSwitchConcept
  ]);

  // Trigger Play/Pause with automatic snap-back from empty concept slot:
  // "without uploading I play the video it will back to the normal position like first variant which ever it is there it will be appeared"
  const handleTriggerPlayPause = useCallback(() => {
    if (isEmptyConceptSlotActive) {
      setIsEmptyConceptSlotActive(false);
    }
    togglePlayPause();
  }, [isEmptyConceptSlotActive, togglePlayPause]);

  // Wheel / Trackpad Handler:
  // Horizontal scroll switches Variants (dots) within the active Concept.
  // Vertical scroll (upside / downside) switches Concepts (A, B, C...) or enters Empty Concept Slot!
  const handleVideoWheel = useCallback((e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 200) return;

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    const minThreshold = 18;

    if (absX > minThreshold || absY > minThreshold) {
      lastWheelTimeRef.current = now;
      if (absX >= absY) {
        // HORIZONTAL SCROLL -> SWITCH VARIANT (DOTS) IN CURRENT CONCEPT
        if (conceptVariants.length > 1) {
          const nextIdx = e.deltaX > 0 ? activeVariantInConceptIdx + 1 : activeVariantInConceptIdx - 1;
          handleSwitchVariantWithinConcept(nextIdx, e.deltaX > 0 ? 'right' : 'left');
        }
      } else {
        // VERTICAL SCROLL -> SWITCH CONCEPTS (UPSIDE / DOWNSIDE)
        if (isEmptyConceptSlotActive) {
          // Scroll back up or down to existing concept
          setIsEmptyConceptSlotActive(false);
        } else {
          if (e.deltaY > 0) {
            // Scroll down
            if (activeGroupIdx + 1 < variantGroups.length) {
              handleSwitchConcept(activeGroupIdx + 1, 'down');
            } else {
              handleSwitchConcept(variantGroups.length, 'down');
            }
          } else {
            // Scroll up
            if (activeGroupIdx > 0) {
              handleSwitchConcept(activeGroupIdx - 1, 'up');
            } else {
              handleSwitchConcept(-1, 'up');
            }
          }
        }
      }
    }
  }, [conceptVariants.length, activeVariantInConceptIdx, handleSwitchVariantWithinConcept, isEmptyConceptSlotActive, activeGroupIdx, variantGroups.length, handleSwitchConcept]);

  // Strictly enforce 9:16 aspect ratio: measures available stage area and calculates exact 9:16 frame
  // Prevents any stretching or cropping when top header or bottom editor sections resize
  useEffect(() => {
    const el = stageWrapperRef.current;
    if (!el) return;

    const updateDimensions = () => {
      if (!stageWrapperRef.current) return;
      const rect = stageWrapperRef.current.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // Reserve space on sides for outside bubbles (~40px each side = 80px) and slight vertical breathing room (8px)
      const maxW = Math.max(100, rect.width - 80);
      const maxH = Math.max(140, rect.height - 8);

      const targetAspect = 9 / 16;
      let w = maxH * targetAspect;
      let h = maxH;

      if (w > maxW) {
        w = maxW;
        h = w / targetAspect;
      }

      setFrameDimensions({
        width: Math.round(w),
        height: Math.round(h),
      });
    };

    updateDimensions();

    const ro = new ResizeObserver(() => {
      updateDimensions();
    });
    ro.observe(el);

    window.addEventListener('resize', updateDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  return (
    <div 
      ref={stageWrapperRef}
      className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-1 sm:p-2 relative overflow-hidden bg-black select-none"
    >
      {/* Centered Stage Wrapper */}
      <div className="relative flex items-center justify-center h-full w-full max-h-full max-w-full overflow-visible">
        {/* Strictly Fixed 9:16 Stage Frame Container */}
        <div 
          className="relative aspect-[9/16] shrink-0 flex items-center justify-center overflow-visible shadow-2xl"
          style={
            frameDimensions
              ? {
                  width: `${frameDimensions.width}px`,
                  height: `${frameDimensions.height}px`,
                  aspectRatio: '9 / 16',
                }
              : {
                  aspectRatio: '9 / 16',
                  maxHeight: '100%',
                  maxWidth: 'calc(100% - 80px)',
                  height: '100%',
                  width: 'auto',
                }
          }
        >
          {/* Outside Left Top: Quick Music Switcher Column (Floating OUTSIDE the video clip at the top on left) */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="absolute right-full mr-2 sm:mr-3 top-2 flex flex-col gap-1 items-center p-0.5 sm:p-1 rounded-xl bg-gray-950/95 backdrop-blur-md border border-pink-500/40 z-35 shadow-2xl max-h-[34%] overflow-y-auto no-scrollbar w-7 sm:w-8.5 pointer-events-auto"
            title="Audio Bubbles (Quick Music Switcher)"
          >
            <span className="text-[7.5px] sm:text-[8px] font-mono font-bold text-pink-400 uppercase tracking-wider px-0.5">M</span>
            {starredAudios.map((audio, i) => {
              const isCurrentlyActive = activeAudioClips.some(c => c.audio_id === audio.id || c.url === audio.url);
              const bucketAudioSettings = getBucketAudioSettings(masterBucketFid);
              const audioMode = activeProject?.audio_modes?.[audio.id] || bucketAudioSettings?.audio_modes?.[audio.id] || audio.mode || 'change';
              const isAudioAll = audioMode === 'all';

              return (
                <button
                  key={audio.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeAudioClips.length <= 1) {
                      updateProjectAudio(audio);
                    } else {
                      handleReplaceAudioClip(0, audio);
                    }
                  }}
                  className={`group relative w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full font-mono font-bold text-[8.5px] sm:text-[9px] flex items-center justify-center shadow-xs transition-all active:scale-90 cursor-pointer ${
                    isAudioAll
                      ? 'bg-orange-500 hover:bg-orange-400 text-white font-black shadow-md border border-orange-300/40'
                      : isCurrentlyActive
                      ? 'bg-pink-600 border border-white text-white ring-2 ring-pink-400/60 shadow-pink-500/50'
                      : 'bg-black/80 hover:bg-pink-600/90 border border-pink-400/40 text-pink-200 hover:text-white'
                  } ${
                    isCurrentlyActive && isAudioAll
                      ? 'ring-2 ring-white border-2 border-white shadow-[0_0_12px_rgba(249,115,22,0.9)] scale-105 z-10'
                      : ''
                  }`}
                  title={`Quick Music M${i + 1}: "${audio.name}" (${Math.round(audio.duration || 0)}s) • Mode: ${isAudioAll ? 'All (Fixed on every video)' : 'Change (Rotates)'} • Click to apply to video`}
                >
                  <span>M{i + 1}</span>
                  {isCurrentlyActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 border border-black shadow" title="Active on timeline" />
                  )}
                </button>
              );
            })}

            {/* Plus button to open Audio Library */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenAudioLibrary) {
                  onOpenAudioLibrary();
                }
              }}
              className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-black/70 hover:bg-pink-950/90 border border-dashed border-pink-500/50 hover:border-pink-400 text-pink-300 font-mono font-bold text-[10px] flex items-center justify-center transition active:scale-90 cursor-pointer"
              title="Add music or open Audio Library"
            >
              +
            </button>
          </div>

          {/* Connected Left Edge: Sleek Compact Concept Tabs (Directly attached/docked to the left edge of the video frame, distinct from music/captions) */}
          {currentPlayingClip && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute right-full mr-0 top-[48%] -translate-y-1/2 flex flex-col gap-0.5 items-end z-35 pointer-events-auto select-none"
              title="Concept Tabs: Tap to switch concept"
            >
              {variantGroups.map((grp, gIdx) => {
                const isAct = !isEmptyConceptSlotActive && gIdx === activeGroupIdx;
                const grpLabel = grp.label || String.fromCharCode(65 + gIdx);
                const vCount = grp.clips?.length || 1;
                return (
                  <button
                    key={`connected-concept-tab-${grp.id || gIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEmptyConceptSlotActive(false);
                      if (onSwitchVariantGroup) {
                        onSwitchVariantGroup(currentClipIndex, gIdx);
                      }
                    }}
                    className={`group relative w-4 sm:w-4.5 h-4 sm:h-4.5 rounded-l-[3px] border-y border-l transition-all active:scale-90 cursor-pointer flex items-center justify-center font-mono font-black text-[7.5px] sm:text-[8px] ${
                      isAct
                        ? 'bg-amber-400 text-black border-amber-300 shadow-sm z-10 translate-x-[1px]'
                        : 'bg-black/90 hover:bg-zinc-900 text-amber-300/80 hover:text-white border-amber-500/30'
                    }`}
                    title={`Concept ${grpLabel} (${vCount} ${vCount === 1 ? 'variant' : 'variants'}) • Tap to switch`}
                    aria-label={`Concept ${grpLabel}`}
                  >
                    <span>{grpLabel}</span>
                  </button>
                );
              })}

              {/* Plus button to open empty concept slot (Attached compact notch) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEmptyConceptSlotActive(prev => !prev);
                }}
                className={`w-4 sm:w-4.5 h-3.5 sm:h-4 rounded-l-[3px] border-y border-l transition-all active:scale-90 cursor-pointer flex items-center justify-center font-mono font-bold text-[8.5px] ${
                  isEmptyConceptSlotActive
                    ? 'bg-amber-400 text-black border-amber-300 font-black z-10 translate-x-[1px]'
                    : 'bg-black/80 hover:bg-zinc-900 border-dashed border-amber-500/40 text-amber-300'
                }`}
                title={`Add New Concept (${String.fromCharCode(65 + variantGroups.length)})`}
                aria-label="Add concept"
              >
                +
              </button>
            </div>
          )}

          {/* 9:16 PREVIEW VIEWPORT (Connected flush to top and bottom with zero vertical space) */}
          <div 
            ref={videoViewportRef}
            onClick={() => setSelectedCaptionId(null)}
            onWheel={handleVideoWheel}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest('button') || target?.closest('[id^="caption-overlay-"]')) {
                return;
              }
              pointerStartPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
            }}
            onPointerUp={(e) => {
              if (!pointerStartPosRef.current) return;
              // Handle desktop mouse drags cleanly; mobile touch is handled by onTouchEnd
              if (e.pointerType === 'mouse') {
                const diffX = e.clientX - pointerStartPosRef.current.x;
                const diffY = e.clientY - pointerStartPosRef.current.y;
                handleSwipeAction(diffX, diffY);
              }
              pointerStartPosRef.current = null;
            }}
            onPointerCancel={() => {
              pointerStartPosRef.current = null;
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                touchStartXRef.current = e.touches[0].clientX;
                touchStartYRef.current = e.touches[0].clientY;
              }
            }}
            onTouchEnd={(e) => {
              if (touchStartXRef.current === null || touchStartYRef.current === null) return;
              const diffX = e.changedTouches[0].clientX - touchStartXRef.current;
              const diffY = e.changedTouches[0].clientY - touchStartYRef.current;
              handleSwipeAction(diffX, diffY);
              touchStartXRef.current = null;
              touchStartYRef.current = null;
            }}
            onTouchCancel={() => {
              touchStartXRef.current = null;
              touchStartYRef.current = null;
            }}
            style={{ touchAction: 'none' }}
            className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800/80 flex flex-col justify-between group select-none touch-none"
          >
          {/* Top Viewport Overlay */}
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between pointer-events-none">
            {currentPlayingClip ? (
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-black/75 backdrop-blur-md border border-white/20 text-white rounded-lg text-[10px] font-mono font-bold">
                  {currentClipIndex + 1}/{activeClips.length}
                </span>
                {currentPlayingClip.bucket_name && !/upload/i.test(currentPlayingClip.bucket_name) && (
                  <span className="px-2 py-0.5 bg-purple-600/80 backdrop-blur-md border border-purple-400/40 text-white rounded-lg text-[10px] font-bold">
                    {currentPlayingClip.bucket_name}
                  </span>
                )}
                {currentPlayingClip.speed && currentPlayingClip.speed !== 1.0 && (
                  <span className="px-1.5 py-0.5 bg-amber-400 text-black rounded text-[9px] font-black">
                    {currentPlayingClip.speed}x
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-gray-500 font-mono">Empty Timeline</span>
            )}

            {/* Corner Audio Button: Tap toggles mute for this specific clip; Long-press mutes all clips */}
            {(() => {
              const isClipMuted = getIsClipMuted(currentPlayingClip);
              return (
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    clipAudioLongPressTriggeredRef.current = false;
                    if (clipAudioLongPressTimerRef.current) clearTimeout(clipAudioLongPressTimerRef.current);
                    clipAudioLongPressTimerRef.current = setTimeout(() => {
                      clipAudioLongPressTriggeredRef.current = true;
                      setShowMuteAllClipsModal(true);
                    }, 520);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (clipAudioLongPressTimerRef.current) {
                      clearTimeout(clipAudioLongPressTimerRef.current);
                      clipAudioLongPressTimerRef.current = null;
                    }
                    if (!clipAudioLongPressTriggeredRef.current) {
                      handleToggleCurrentClipMute();
                    }
                  }}
                  onPointerLeave={() => {
                    if (clipAudioLongPressTimerRef.current) {
                      clearTimeout(clipAudioLongPressTimerRef.current);
                      clipAudioLongPressTimerRef.current = null;
                    }
                  }}
                  onPointerCancel={() => {
                    if (clipAudioLongPressTimerRef.current) {
                      clearTimeout(clipAudioLongPressTimerRef.current);
                      clipAudioLongPressTimerRef.current = null;
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMuteAllClipsModal(true);
                  }}
                  className={`w-6 h-6 rounded-md pointer-events-auto transition cursor-pointer select-none border backdrop-blur-md active:scale-90 flex items-center justify-center shadow-xs ${
                    isClipMuted
                      ? 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/50 text-rose-300'
                      : 'bg-black/60 hover:bg-black/80 border-white/20 text-white/90'
                  }`}
                  title={
                    isClipMuted
                      ? `Audio muted for clip #${currentClipIndex + 1}. Tap to unmute, long-press to mute all clips.`
                      : `Audio active for clip #${currentClipIndex + 1}. Tap to mute this clip, long-press to mute all clips.`
                  }
                  aria-label="Clip Audio Mute"
                >
                  {isClipMuted ? (
                    <VolumeX size={11} className="text-rose-400 stroke-[2.2]" />
                  ) : (
                    <Volume2 size={11} className="text-white/90 stroke-[2]" />
                  )}
                </button>
              );
            })()}
          </div>

          {/* Video Player Engine */}
          {!activeProject ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-gray-300 bg-gray-950/95 z-20">
              <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-600/50 flex items-center justify-center text-purple-400 mb-3 shadow-lg">
                <Film size={24} />
              </div>
              <h3 className="text-sm font-black text-white">No Project Active</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                Create a project to start assembling 9:16 vertical videos.
              </p>
              <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-[220px]">
                <button
                  type="button"
                  onClick={() => {
                    setNewProjectName(`Project ${projects.length + 1}`);
                    setShowNewProjectModal(true);
                  }}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create New Project</span>
                </button>
              </div>
            </div>
          ) : activeClips.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-gray-400">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-2">
                <Film size={20} className="stroke-[1.8]" />
              </div>
              <p className="text-xs font-bold text-gray-200">Timeline is Empty</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                Tap below or on the timeline strip to start.
              </p>
              <button
                type="button"
                onClick={openClipPicker}
                className="mt-3 px-3 py-1.5 bg-white/10 hover:bg-white/15 active:bg-white/25 active:scale-95 text-gray-200 hover:text-white text-xs font-medium rounded-md border border-white/15 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Add clips"
              >
                <Plus size={13} className="text-gray-300" />
                <span>Add Clips</span>
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
              {/* Subtle corner loading indicator only when current active clip is actually buffering */}
              {activeClips.length > 0 && loadedClipIds.size === 0 && (
                <div className="absolute bottom-3 right-3 z-25 bg-black/80 px-2 py-1 rounded-full border border-amber-400/40 flex items-center gap-1.5 pointer-events-none animate-in fade-in">
                  <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-amber-300">Readying...</span>
                </div>
              )}

              {activeClips.map((clip, idx) => {
                const isLoopingThis = Boolean(isLoopingClip && loopClipIndex !== null && loopClipIndex !== undefined);
                const activeFocusIndex = isLoopingThis ? (loopClipIndex ?? currentClipIndex) : currentClipIndex;
                const isCurrent = idx === activeFocusIndex;
                const isNext = !isLoopingThis && idx === currentClipIndex + 1;
                const isPrevious = !isLoopingThis && idx === previousClipIndex;
                const effFileId = clip.file_id || clip.vid;
                const activeSrc = clip.url || clipBlobUrls[clip.id] || getMemoryBlobUrl(effFileId) || (effFileId ? `/api/video/${effFileId}` : '');
                const isLocalBlob = activeSrc.startsWith('blob:');

                // Zero-waste mounting: Only mount the video element for the active playing clip or immediate neighbor clips
                // Distant clips consume ZERO network and ZERO RAM until selected!
                const shouldMountVideo = isCurrent || isNext || isPrevious || isLocalBlob;
                if (!shouldMountVideo) {
                  return null;
                }

                const posterSrc = `/api/thumb/${effFileId}?w=160`;
                // Ultra data saving: Only preload bytes for the currently active playing clip or local memory blobs.
                // Inactive network clips only load lightweight metadata, saving 90%+ internet bandwidth.
                const clipPreload = isLocalBlob ? "auto" : (isCurrent ? "auto" : "none");

                return (
                  <video
                    key={`${clip.id}_vg${clip.active_variant_group_index ?? 0}_vc${clip.active_variant_index ?? 0}_${clip.url || ''}`}
                    ref={(el) => {
                      if (el) {
                        videoElementsRef.current.set(clip.id, el);
                        applyVideoElementAudio(clip.id, el, clip);
                        if (isLoopingThis && idx !== loopClipIndex && !el.paused) {
                          try { el.pause(); } catch (_) {}
                        }
                      } else {
                        videoElementsRef.current.delete(clip.id);
                      }
                    }}
                    src={activeSrc}
                    poster={posterSrc}
                    playsInline
                    preload={clipPreload}
                    muted={getIsClipMuted(clip)}
                    onError={() => {
                      console.warn("Video clip stream notice:", clip.id);
                    }}
                    onPlay={(e) => {
                      if (getIsClipMuted(clip)) {
                        e.currentTarget.muted = true;
                      } else {
                        applyVideoElementAudio(clip.id, e.currentTarget, clip);
                      }
                    }}
                    onLoadedData={(e) => {
                      if (getIsClipMuted(clip)) {
                        e.currentTarget.muted = true;
                      } else {
                        applyVideoElementAudio(clip.id, e.currentTarget, clip);
                      }
                      loadedClipIds.add(clip.id);
                    }}
                    onCanPlay={(e) => {
                      if (getIsClipMuted(clip)) {
                        e.currentTarget.muted = true;
                      } else {
                        applyVideoElementAudio(clip.id, e.currentTarget, clip);
                      }
                      loadedClipIds.add(clip.id);
                    }}
                    onLoadedMetadata={(e) => {
                      const realDur = e.currentTarget.duration;
                      if (realDur && !isNaN(realDur) && realDur > 0.1) {
                        if (!clip.duration || clip.duration <= 0 || clip.trim_end === undefined || clip.trim_end <= 0 || Math.abs(clip.duration - realDur) > 0.25) {
                          handleSyncClipMetadataDuration(clip.id, realDur);
                        }
                      }
                      const startT = clip.trim_start || 0;
                      // Only set initial trim start on first metadata load if video is at 0 and not current/playing
                      if (!isCurrent && startT > 0 && e.currentTarget.currentTime === 0) {
                        try { e.currentTarget.currentTime = startT; } catch (_) {}
                      }
                    }}
                    onWaiting={() => {
                      // Video buffering
                    }}
                    onPlaying={() => {
                      if (isCurrent && isPlaying) {
                        const vid = videoElementsRef.current.get(clip.id);
                        const meta = timelineClipsMeta[idx];
                        if (vid && meta) {
                          const cur = vid.currentTime;
                          const projTime = meta.projectStartTime + Math.max(0, cur - meta.trimStart) / meta.speed;
                          syncAudioTracksToTime(projTime, true);
                        }
                      }
                    }}
                    onTimeUpdate={(e) => {
                      const mustBeMuted = getIsClipMuted(clip);
                      if (mustBeMuted) {
                        if (!e.currentTarget.muted) e.currentTarget.muted = true;
                        if (e.currentTarget.volume !== 0) {
                          try { e.currentTarget.volume = 0; } catch (_) {}
                        }
                      }
                      handleActiveTimeUpdate(e, idx);
                    }}
                    onEnded={() => handleVideoEnded(idx)}
                    onClick={handleTriggerPlayPause}
                    className={`w-full h-full object-contain select-none ${
                      isCurrent
                        ? 'opacity-100 relative z-10 pointer-events-auto cursor-pointer'
                        : isPrevious
                        ? 'opacity-100 absolute inset-0 pointer-events-none z-5'
                        : 'opacity-0 absolute inset-0 pointer-events-none z-0'
                    }`}
                    style={{
                      transform: clip.scale && clip.scale !== 1 ? `scale(${clip.scale})` : undefined,
                      transformOrigin: 'center center'
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Minimalist Empty Concept Space: Just 1 light white '+' button at the center */}
          {isEmptyConceptSlotActive && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                setIsEmptyConceptSlotActive(false);
              }}
              className="absolute inset-0 z-25 bg-black/90 backdrop-blur-xs flex items-center justify-center cursor-pointer select-none animate-in fade-in duration-150"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEmptyConceptSlotActive(false);
                  if (onCreateVariantGroup) {
                    onCreateVariantGroup(currentClipIndex, 'picker');
                  }
                }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/25 hover:border-white/50 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-2xl hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
                title="Add video clip for this Concept"
                aria-label="Add clip"
              >
                <Plus size={26} className="stroke-[2] text-white/90" />
              </button>
            </div>
          )}

          {/* Clean Center Play/Pause Control */}
          {activeClips.length > 0 && !isEmptyConceptSlotActive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerPlayPause();
              }}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className={`absolute inset-0 m-auto w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center cursor-pointer shadow-2xl transition-all duration-200 z-30 border ${
                !isPlaying
                  ? 'bg-black/70 hover:bg-black/90 text-white border-white/30 scale-100 opacity-100 hover:scale-105 active:scale-95'
                  : 'bg-black/35 hover:bg-black/75 text-white border-white/20 opacity-0 hover:opacity-90 scale-95 hover:scale-100'
              }`}
              title={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? (
                <Pause size={22} className="text-white fill-white" />
              ) : (
                <Play size={24} className="ml-1 text-white fill-white" />
              )}
            </button>
          )}

          {/* Horizontal Variant Dots (Pure Minimalist Space-Saving Dots without Numbers) */}
          {!isEmptyConceptSlotActive && currentPlayingClip && conceptVariants.length > 1 && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-35 flex items-center justify-center gap-1 bg-black/50 backdrop-blur-xs px-1.5 py-0.5 rounded-full border border-white/10 shadow-md pointer-events-auto select-none"
              title={`Variant ${activeVariantInConceptIdx + 1} of ${conceptVariants.length}. Swipe horizontally or tap to switch.`}
            >
              {conceptVariants.map((_c, vIdx) => {
                const isCurrentVar = activeVariantInConceptIdx === vIdx;
                return (
                  <button
                    key={`concept-var-dot-${vIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (vIdx !== activeVariantInConceptIdx && onSwitchClipVariant) {
                        onSwitchClipVariant(currentClipIndex, vIdx);
                      } else if (onOpenVariantDrawer) {
                        onOpenVariantDrawer(currentClipIndex);
                      }
                    }}
                    className={`transition-all rounded-full cursor-pointer p-0.5 flex items-center justify-center ${
                      isCurrentVar 
                        ? 'w-2 h-1 bg-amber-400 rounded-full shadow-[0_0_4px_rgba(251,191,36,0.8)]' 
                        : 'w-1 h-1 bg-white/40 hover:bg-white/70 rounded-full'
                    }`}
                    title={`Variant #${vIdx + 1} of ${conceptVariants.length}`}
                    aria-label={`Variant ${vIdx + 1}`}
                  />
                );
              })}
            </div>
          )}

          {/* Swipe Feedback HUD Toast over Video */}
          {swipeIndicator && (
            <div className="absolute inset-0 m-auto w-fit h-fit max-w-[200px] z-50 pointer-events-none flex flex-col items-center justify-center gap-1 bg-black/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/30 shadow-2xl animate-in zoom-in-95 duration-100">
              <span className="text-xs font-black text-white tracking-wide">
                {swipeIndicator.text}
              </span>
              <span className="text-[9px] font-bold text-amber-300">
                {swipeIndicator.direction === 'up' || swipeIndicator.direction === 'down' ? '↕ Vertical Swipe' : '↔ Horizontal Swipe'}
              </span>
            </div>
          )}

          {/* Center Alignment Snapping Guidelines */}
          {showVerticalCenterGuide && (
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-400 z-40 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-in fade-in duration-75">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 bg-amber-400 text-black text-[8px] font-mono font-black rounded-full shadow whitespace-nowrap">
                CENTER X
              </div>
            </div>
          )}

          {showHorizontalCenterGuide && (
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-amber-400 z-40 pointer-events-none shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-in fade-in duration-75">
              <div className="absolute left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.2 bg-amber-400 text-black text-[8px] font-mono font-black rounded-full shadow whitespace-nowrap">
                CENTER Y
              </div>
            </div>
          )}

          {/* Captions Overlay on Video */}
          {activeCaptions.map((caption) => {
            const isVisible = isCaptionVisible(caption, currentClipIndex, activeClips.length, activeCaptions);
            if (!isVisible) return null;

            const isSelected = selectedCaptionId === caption.id;
            const fontSize = caption.font_size || 24;
            const strokeColor = caption.stroke_color || '#000000';
            const baseStroke = Math.max(1, Math.round(fontSize * 0.08));
            const strokeWidth = Math.max(0.78, Math.round(baseStroke * 0.78 * 10) / 10);

            return (
              <div
                key={caption.id}
                id={`caption-overlay-${caption.id}`}
                onPointerDown={(e) => {
                  const now = Date.now();
                  if (lastCaptionTapRef.current && lastCaptionTapRef.current.id === caption.id && (now - lastCaptionTapRef.current.time) < 350) {
                    e.stopPropagation();
                    handleOpenCaptionTemplateEditor(caption);
                    lastCaptionTapRef.current = null;
                    return;
                  }
                  lastCaptionTapRef.current = { id: caption.id, time: now };
                  handleCaptionPointerDown(e, caption);
                }}
                onContextMenu={(e) => handleCaptionContextMenu(e, caption)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCaptionId(caption.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleOpenCaptionTemplateEditor(caption);
                }}
                className="absolute z-35 select-none touch-none cursor-move transition-shadow flex flex-col items-center justify-center text-center"
                style={{
                  left: `${caption.x_pct}%`,
                  top: `${caption.y_pct}%`,
                  width: `${caption.box_width_pct || 80}%`,
                  maxWidth: 'calc(100% - 16px)',
                  minWidth: '60px',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              >
                {/* Active Caption Bounding Box & Resize Handles */}
                {isSelected && (
                  <div className="absolute -inset-1.5 border border-white/90 rounded pointer-events-none shadow-[0_0_6px_rgba(0,0,0,0.8)]">
                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionCornerResizePointerDown(e, caption, 'tl')}
                      className="absolute -top-4 -left-4 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none z-50"
                      title="Scale size"
                    >
                      <div className="w-3.5 h-3.5 sm:w-3 sm:h-3 bg-white border-2 border-black rounded-full shadow-md hover:scale-125 transition-transform" />
                    </div>

                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionCornerResizePointerDown(e, caption, 'tr')}
                      className="absolute -top-4 -right-4 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none z-50"
                      title="Scale size"
                    >
                      <div className="w-3.5 h-3.5 sm:w-3 sm:h-3 bg-white border-2 border-black rounded-full shadow-md hover:scale-125 transition-transform" />
                    </div>

                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionCornerResizePointerDown(e, caption, 'bl')}
                      className="absolute -bottom-4 -left-4 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center cursor-nesw-resize pointer-events-auto touch-none z-50"
                      title="Scale size"
                    >
                      <div className="w-3.5 h-3.5 sm:w-3 sm:h-3 bg-white border-2 border-black rounded-full shadow-md hover:scale-125 transition-transform" />
                    </div>

                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionCornerResizePointerDown(e, caption, 'br')}
                      className="absolute -bottom-4 -right-4 w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center cursor-nwse-resize pointer-events-auto touch-none z-50"
                      title="Scale size"
                    >
                      <div className="w-3.5 h-3.5 sm:w-3 sm:h-3 bg-white border-2 border-black rounded-full shadow-md hover:scale-125 transition-transform" />
                    </div>

                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionWidthResizePointerDown(e, caption, 'left')}
                      className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-10 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none z-50 group/handle"
                      title="Drag left/right to adjust line wrap width"
                    >
                      <div className="w-2 h-5 bg-white border border-black rounded-full shadow-md group-hover/handle:bg-amber-300 group-hover/handle:scale-110 transition-all" />
                    </div>

                    <div
                      data-caption-handle="true"
                      onPointerDown={(e) => handleCaptionWidthResizePointerDown(e, caption, 'right')}
                      className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-10 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none z-50 group/handle"
                      title="Drag left/right to adjust line wrap width"
                    >
                      <div className="w-2 h-5 bg-white border border-black rounded-full shadow-md group-hover/handle:bg-amber-300 group-hover/handle:scale-110 transition-all" />
                    </div>
                  </div>
                )}

                {/* Caption Text Styling */}
                <span
                  className="w-full text-center break-words select-none pointer-events-none whitespace-pre-line block"
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: caption.is_bold === false ? 400 : 700,
                    color: '#ffffff',
                    WebkitTextStroke: `${Math.max(1.2, Math.round(strokeWidth * 2 * 10) / 10)}px ${strokeColor}`,
                    paintOrder: 'stroke fill',
                    lineHeight: 1.25,
                    letterSpacing: 'normal',
                    textAlign: 'center',
                    textWrap: 'balance' as any,
                    fontFamily: caption.font_family || CAPTION_FONTS[0].family,
                    display: 'block',
                    margin: '0 auto',
                    textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 4px rgba(0,0,0,0.85)'
                  }}
                >
                  {caption.text?.trim() || caption.text}
                </span>
              </div>
            );
          })}

          {/* Quick Context Menu on Caption */}
          {captionContextMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                left: `${captionContextMenu.x}px`,
                top: `${captionContextMenu.y}px`
              }}
              className="absolute z-50 bg-gray-900/98 border border-purple-500/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 min-w-[190px] flex flex-col gap-1 text-white"
            >
              <button
                type="button"
                onClick={() => {
                  handleOpenCaptionTemplateEditor(captionContextMenu.caption);
                  setCaptionContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-purple-600 rounded-lg flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Edit2 size={13} className="text-amber-300" />
                <span>Edit Caption Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSaveAsTemplate(captionContextMenu.caption);
                  setCaptionContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-white hover:bg-purple-600 rounded-lg flex items-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Bookmark size={13} className="text-emerald-300" />
                <span>Save as New Template</span>
              </button>

              {/* Quick Font Switcher */}
              <div className="pt-1 border-t border-gray-800">
                <span className="text-[9px] font-bold text-gray-400 px-2 block mb-1">Quick Font</span>
                <div className="grid grid-cols-2 gap-1 px-0.5">
                  {CAPTION_FONTS.slice(0, 4).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        handleUpdateCaption(captionContextMenu.caption.id, { font_family: f.family });
                        setCaptionDefaults((prev: any) => ({ ...prev, font_family: f.family }));
                        try {
                          localStorage.setItem(`master_caption_defaults_${masterBucketFid}`, JSON.stringify({
                            ...captionDefaults,
                            font_family: f.family
                          }));
                        } catch (_) {}
                        fetch('/api/action', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'save_caption_defaults',
                            payload: { master_bucket_fid: masterBucketFid, defaults: { ...captionDefaults, font_family: f.family } }
                          })
                        }).catch(() => {});
                        if (captionContextMenu.caption.template_id) {
                          const linkedTpl = captionTemplates.find(t => t.id === captionContextMenu.caption.template_id);
                          if (linkedTpl) {
                            handleUpdateTemplate({ ...linkedTpl, font_family: f.family });
                          }
                        }
                        showToast(`Font set to ${f.name}`, "info");
                        setCaptionContextMenu(null);
                      }}
                      className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[10px] font-bold text-gray-200 hover:text-white truncate text-center transition cursor-pointer"
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleDeleteCaption(captionContextMenu.caption.id);
                  setCaptionContextMenu(null);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-rose-300 hover:bg-rose-950/70 rounded-lg flex items-center gap-2 cursor-pointer transition active:scale-95 mt-0.5 border-t border-gray-800"
              >
                <Trash2 size={13} className="text-rose-400" />
                <span>Delete Caption</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Caption & AI Generation Column (Floating OUTSIDE the video clip on the right) */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute left-full ml-2 sm:ml-3 top-2 flex flex-col gap-2 items-center pointer-events-auto z-35"
        >
          {/* Dedicated Big AI Generation Bubble (Flux Video Edit 3.0) */}
          <HiggsfieldGenerationBubble
            jobs={higgsfieldJobs}
            onSelectJobForReview={onSelectHiggsfieldJobForReview}
            isOpen={isHiggsfieldTrayOpen}
            setIsOpen={setIsHiggsfieldTrayOpen}
            onOpenAiPromptMode={onOpenAiPromptMode}
            onOpenVariantTab={onOpenVariantDrawer}
          />

          {/* Caption Switcher Column */}
          <div 
            className="flex flex-col gap-1 items-center p-0.5 sm:p-1 rounded-xl bg-gray-950/95 backdrop-blur-md border border-purple-500/40 shadow-2xl max-h-[60vh] overflow-y-auto no-scrollbar w-7 sm:w-8.5"
            title="Caption Bubbles (Quick Caption Switcher)"
          >
          <span className="text-[7.5px] sm:text-[8px] font-mono font-bold text-purple-400 uppercase tracking-wider px-0.5">C</span>
          {availableCaptionTemplates.map((tpl, i) => {
            const isAll = tpl.mode === 'all' || tpl.mode === 'must' || tpl.is_must === true || tpl.for_all_videos === true;
            const onVideoCap = activeCaptions.find(
              c => c.template_id === tpl.id || (c.text.trim().toLowerCase() === tpl.text.trim().toLowerCase())
            );
            const isSelected = Boolean(
              selectedCaption && (
                selectedCaption.template_id === tpl.id ||
                (selectedCaption.text && selectedCaption.text.trim().toLowerCase() === tpl.text.trim().toLowerCase())
              )
            );

            const masterIdx = captionTemplates.findIndex(t => t.id === tpl.id);
            const label = tpl.name && /^C\d+$/i.test(tpl.name)
              ? tpl.name.toUpperCase()
              : `C${masterIdx >= 0 ? masterIdx + 1 : i + 1}`;

            return (
              <button
                key={tpl.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCaptionOnProject(tpl);
                }}
                className={`group relative w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-full font-mono font-bold text-[8.5px] sm:text-[9px] flex items-center justify-center shadow-xs transition-all active:scale-90 cursor-pointer ${
                  isAll
                    ? 'bg-amber-400 text-black font-black shadow-md border border-amber-300'
                    : onVideoCap
                    ? 'bg-purple-600 border border-white text-white ring-2 ring-purple-400/60 shadow-purple-500/50'
                    : isSelected
                    ? 'bg-purple-600 border border-purple-400 text-white'
                    : 'bg-black/80 hover:bg-purple-600/90 border border-purple-400/40 text-purple-200 hover:text-white'
                } ${
                  onVideoCap && isAll
                    ? 'ring-2 ring-white border-2 border-white shadow-[0_0_12px_rgba(251,191,36,0.9)] scale-105 z-10'
                    : ''
                }`}
                title={`Quick Caption ${label}: "${tpl.text}" • Mode: ${isAll ? 'All (Fixed on every video)' : 'Change (Rotates)'} • Click to toggle on video`}
              >
                <span>{label}</span>
                {onVideoCap && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-black shadow" title="Active on video" />
                )}
              </button>
            );
          })}

          {/* Plus button to open Caption Studio */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCaptionViewMode('list');
              setShowTextDrawer(true);
            }}
            className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-black/70 hover:bg-purple-950/90 border border-dashed border-purple-500/50 hover:border-purple-400 text-purple-300 font-mono font-bold text-[10px] flex items-center justify-center transition active:scale-90 cursor-pointer"
            title="Add text / caption or open Caption Studio"
          >
            +
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
