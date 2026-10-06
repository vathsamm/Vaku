import React from 'react';
import { 
  Play, Pause, ZoomIn, ZoomOut, VolumeX, Plus, Music, 
  MoreVertical, Layers, Scissors, Edit2, ArrowLeft, ArrowRight, Copy, Trash2, Volume2, Type,
  Repeat
} from 'lucide-react';
import { VideoEditorClip, VideoEditorAudioClip } from '../../../types';
import { TimelineClipFilmstrip } from '../TimelineClipFilmstrip';
import { CAPTION_PALETTES } from '../constants';

export interface TimelineSectionProps {
  projectCurrentTime: number;
  totalDuration: number;
  formatTimecode: (t: number) => string;
  isPlaying: boolean;
  togglePlayPause: () => void;
  timelineZoom: number;
  setTimelineZoom: React.Dispatch<React.SetStateAction<number>>;
  timelineTrackHeight: number;
  timelineTrackRef: React.RefObject<HTMLDivElement | null>;
  handleTimelineTrackScroll: (e: any) => void;
  handleTimelineTouchStart: (e: React.TouchEvent) => void;
  handleTimelineTouchMove: (e: React.TouchEvent) => void;
  handleTimelineTouchEnd: (e?: any) => void;
  handleTimelineWheel: (e: React.WheelEvent) => void;
  scrollDebounceTimerRef: React.MutableRefObject<any>;
  isUserScrubbingTrackRef: React.MutableRefObject<boolean>;
  pauseAllPlayback: () => void;
  activeClips: VideoEditorClip[];
  selectedTimelineClipIndex: number | null;
  setSelectedTimelineClipIndex: (idx: number | null) => void;
  currentClipIndex: number;
  dragOverTargetIndex: number | null;
  draggedClipIndex: number | null;
  getClipEffectiveDuration: (clip: VideoEditorClip) => number;
  trimmingHandle: 'start' | 'end' | null;
  handleDragStartClip: (e: any, idx: number) => void;
  handleDragOverClip: (e: any, idx: number) => void;
  handleDropClip: (e: any, idx: number) => void;
  handleDragEndClip: () => void;
  handleClipTouchStart: (idx: number, e: any) => void;
  handleClipTouchMove: (e: any) => void;
  handleClipTouchEnd: () => void;
  didScrubClipRef?: React.MutableRefObject<boolean>;
  setSelectedAudioClipIndex: (idx: number | null) => void;
  setSelectedCaptionId: (id: string | null) => void;
  activeInlineControl: any;
  setActiveInlineControl: (ctrl: any) => void;
  timelineClipsMeta: any[];
  seekToProjectTime: (time: number) => void;
  handleTrimPointerDown: (e: any, idx: number, handle: 'start' | 'end') => void;
  getIsClipMuted: (clip: any) => boolean;
  openClipPicker: () => void;
  openClipPickerAt?: (insertIdx: number) => void;
  captionLayersSpans: any[];
  selectedCaptionId: string | null;
  handleOpenCaptionTemplateEditor: (cap: any) => void;
  setCaptionViewMode: (mode: 'list' | 'settings') => void;
  setShowTextDrawer: (v: boolean) => void;
  audioLayers: any[];
  activeAudioClips: VideoEditorAudioClip[];
  selectedAudioClipIndex: number | null;
  activeDraggingAudioId: string | null;
  audioDragVisual: any;
  activeAudioOptionsIndex: number | null;
  setActiveAudioOptionsIndex: (idx: number | null) => void;
  getAudioClipEffectiveDuration: (clip: any) => number;
  handleAudioClipPointerDown: (e: any, idx: number) => void;
  handleAudioTrimPointerDown: (e: any, idx: number, handle: 'start' | 'end') => void;
  handleUpdateAudioVolume: (idx: number, vol: number) => void;
  handleMoveAudioClipToLayer: (idx: number, layer: number) => void;
  updateProjectAudioClips: (clips: any[], hist?: boolean) => void;
  showToast: (msg: string, type?: any) => void;
  handleChopAudioClip: (idx: number) => void;
  setAudioPickMode: (mode: any) => void;
  setShowAudioLibrary: (v: boolean) => void;
  handleMoveAudioClip: (idx: number, target: number) => void;
  handleDuplicateAudioClip: (idx: number) => void;
  handleDeleteAudioClip: (idx: number) => void;
  totalVideoClipsWidth: number;
  draggedAudioClipIndex?: number | null;
  setDraggedAudioClipIndex?: (idx: number | null) => void;
  isLoopingClip?: boolean;
  onToggleLoop?: () => void;
  onSelectTimelineClip?: (idx: number) => void;
  onSwitchClipVariant?: (clipIdx: number, variantIdx: number) => void;
  onOpenVariantDrawer?: (clipIdx: number) => void;
  higgsfieldJobs?: any[];
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  projectCurrentTime,
  totalDuration,
  formatTimecode,
  isPlaying,
  togglePlayPause,
  timelineZoom,
  setTimelineZoom,
  timelineTrackHeight,
  timelineTrackRef,
  handleTimelineTrackScroll,
  handleTimelineTouchStart,
  handleTimelineTouchMove,
  handleTimelineTouchEnd,
  handleTimelineWheel,
  scrollDebounceTimerRef,
  isUserScrubbingTrackRef,
  pauseAllPlayback,
  activeClips,
  selectedTimelineClipIndex,
  setSelectedTimelineClipIndex,
  currentClipIndex,
  dragOverTargetIndex,
  draggedClipIndex,
  getClipEffectiveDuration,
  trimmingHandle,
  handleDragStartClip,
  handleDragOverClip,
  handleDropClip,
  handleDragEndClip,
  handleClipTouchStart,
  handleClipTouchMove,
  handleClipTouchEnd,
  didScrubClipRef,
  setSelectedAudioClipIndex,
  setSelectedCaptionId,
  activeInlineControl,
  setActiveInlineControl,
  timelineClipsMeta,
  seekToProjectTime,
  handleTrimPointerDown,
  getIsClipMuted,
  openClipPicker,
  openClipPickerAt,
  captionLayersSpans,
  selectedCaptionId,
  handleOpenCaptionTemplateEditor,
  setCaptionViewMode,
  setShowTextDrawer,
  audioLayers,
  activeAudioClips,
  selectedAudioClipIndex,
  activeDraggingAudioId,
  audioDragVisual,
  activeAudioOptionsIndex,
  setActiveAudioOptionsIndex,
  getAudioClipEffectiveDuration,
  handleAudioClipPointerDown,
  handleAudioTrimPointerDown,
  handleUpdateAudioVolume,
  handleMoveAudioClipToLayer,
  updateProjectAudioClips,
  showToast,
  handleChopAudioClip,
  setAudioPickMode,
  setShowAudioLibrary,
  handleMoveAudioClip,
  handleDuplicateAudioClip,
  handleDeleteAudioClip,
  totalVideoClipsWidth,
  draggedAudioClipIndex = null,
  setDraggedAudioClipIndex,
  isLoopingClip = false,
  onToggleLoop,
  onSelectTimelineClip,
  onSwitchClipVariant,
  onOpenVariantDrawer,
  higgsfieldJobs = [],
}) => {
  return (
    <section className="bg-gray-950 border-t border-gray-800/90 flex flex-col shrink-0 z-20 select-none">
      {/* Timeline Strip Header: Exact Timecode, Center Play Button, Zoom Controls & Clip Counter */}
      <div className="h-6.5 sm:h-7 px-2 sm:px-3 bg-gray-900/95 border-b border-gray-800 flex items-center justify-between relative select-none">
        {/* Playhead Timecode Indicator */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] sm:text-xs">
          <span className="font-black text-amber-300">
            {formatTimecode(projectCurrentTime)}
          </span>
          <span className="text-gray-500 font-bold">/</span>
          <span className="text-gray-400 font-medium">
            {formatTimecode(totalDuration)}
          </span>
        </div>

        {/* Center Control: Play/Pause perfectly centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
          <button
            type="button"
            onClick={togglePlayPause}
            className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-full bg-amber-400 hover:bg-amber-300 text-black flex items-center justify-center shadow-md transition active:scale-95 cursor-pointer shrink-0"
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={12} className="fill-black stroke-[2.5]" />
            ) : (
              <Play size={12} className="fill-black ml-0.5 stroke-[2.5]" />
            )}
          </button>
        </div>

        {/* Zoom Controls + Clip Count */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-0.5 bg-gray-800/90 border border-gray-750 px-1 py-0.2 rounded-md">
            <button
              type="button"
              onClick={() => setTimelineZoom(prev => Math.max(20, prev - 12))}
              className="p-0.5 text-gray-300 hover:text-white rounded hover:bg-gray-700 transition cursor-pointer"
              title="Zoom out timeline (pinch or click)"
              aria-label="Zoom out"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[9.5px] font-mono text-gray-200 font-bold min-w-[28px] text-center">
              {Math.round((timelineZoom / 65) * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setTimelineZoom(prev => Math.min(220, prev + 12))}
              className="p-0.5 text-gray-300 hover:text-white rounded hover:bg-gray-700 transition cursor-pointer"
              title="Zoom in timeline (pinch or click)"
              aria-label="Zoom in"
            >
              <ZoomIn size={12} />
            </button>
          </div>

          <span className="text-[9.5px] sm:text-[10px] text-gray-300 font-medium">
            {activeClips.length} {activeClips.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
      </div>

      {/* Timeline Track with Fixed Center Needle */}
      <div 
        onPointerDownCapture={(e) => {
          const target = e.target as HTMLElement | null;
          const isClip = Boolean(target?.closest('[data-timeline-clip-idx]'));
          if ((isLoopingClip || activeInlineControl === 'loop') && isClip) {
            return;
          }
          pauseAllPlayback();
        }}
        style={{ minHeight: `${timelineTrackHeight}px`, height: `${timelineTrackHeight}px`, maxHeight: `${timelineTrackHeight}px` }}
        className="relative w-full bg-gray-950 select-none border-b border-gray-800 overflow-hidden"
      >
        {/* Fixed Center Playhead Needle */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 pointer-events-none z-30 flex flex-col items-center">
          <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
          <div className="w-[1.5px] flex-1 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.9)] -mb-0.5" />
        </div>

        {/* Scrollable Track */}
        <div 
          ref={timelineTrackRef}
          onScroll={handleTimelineTrackScroll}
          onTouchStart={handleTimelineTouchStart}
          onTouchMove={handleTimelineTouchMove}
          onTouchEnd={handleTimelineTouchEnd}
          onMouseDown={() => { 
            if (!isLoopingClip && activeInlineControl !== 'loop') {
              pauseAllPlayback(); 
              isUserScrubbingTrackRef.current = true; 
            }
          }}
          onMouseUp={() => { 
            if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
            scrollDebounceTimerRef.current = setTimeout(() => { isUserScrubbingTrackRef.current = false; }, 200); 
          }}
          onWheel={handleTimelineWheel}
          onClick={(e) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[data-timeline-clip-idx]') && !target?.closest('[data-trim-handle="true"]')) {
              setSelectedTimelineClipIndex(null);
            }
          }}
          className={`w-full h-full overflow-x-auto ${
            timelineTrackHeight >= 260 ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800' : 'overflow-y-hidden'
          } scrollbar-track-transparent flex items-start select-none`}
        >
          {/* Left 50% Spacer */}
          <div className="shrink-0 w-1/2 h-full pointer-events-none" />

          {/* Multi-Track Stack: Track 1 (Video Clips) + Track 2+ (Caption Layers) + Track 3+ (Audio Layers) */}
          <div className="flex flex-col justify-start gap-1 shrink-0 pb-0 min-w-max">
            {/* Track 1: Sequential Video Clips Strip - Strictly Rectangular & Thicker */}
            <div className="flex items-stretch shrink-0 gap-0 sticky top-0 z-20 bg-gray-950 h-15 sm:h-16 border-t border-b border-gray-800">
              {activeClips.length === 0 ? (
                <button
                  type="button"
                  onClick={openClipPicker}
                  className="h-full px-4 bg-gray-900/90 hover:bg-purple-950/70 border-r border-dashed border-purple-500/50 hover:border-purple-400 rounded-none flex items-center justify-center gap-2 text-purple-300 hover:text-white transition cursor-pointer shadow-sm active:scale-95"
                  title="Add video clips from buckets"
                >
                  <Plus size={14} className="text-purple-400" />
                  <span className="text-xs font-bold font-mono">+ Add Video Clip</span>
                </button>
              ) : (
                activeClips.map((clip, idx) => {
                  const isSelected = idx === selectedTimelineClipIndex;
                  const isPlayingThis = idx === currentClipIndex;
                  const isDragTarget = idx === dragOverTargetIndex && draggedClipIndex !== idx;
                  const isBeingDragged = idx === draggedClipIndex;
                  const effDuration = getClipEffectiveDuration(clip);
                  const blockWidth = Math.max(38, Math.round(effDuration * timelineZoom));

                  return (
                    <div
                      key={clip.id}
                      data-timeline-clip-idx={idx}
                      draggable={!trimmingHandle && !isSelected}
                      onDragStart={(e) => handleDragStartClip(e, idx)}
                      onDragOver={(e) => handleDragOverClip(e, idx)}
                      onDrop={(e) => handleDropClip(e, idx)}
                      onDragEnd={handleDragEndClip}
                      onTouchStart={(e) => handleClipTouchStart(idx, e)}
                      onTouchMove={handleClipTouchMove}
                      onTouchEnd={handleClipTouchEnd}
                      onMouseDown={() => {
                        if (!isLoopingClip && activeInlineControl !== 'loop') {
                          pauseAllPlayback();
                          isUserScrubbingTrackRef.current = true;
                        }
                      }}
                      onClick={() => {
                        if (didScrubClipRef?.current) {
                          return;
                        }
                        if (onSelectTimelineClip) {
                          onSelectTimelineClip(idx);
                        } else {
                          pauseAllPlayback();
                          setSelectedTimelineClipIndex(idx);
                          setSelectedAudioClipIndex(null);
                          setSelectedCaptionId(null);
                          if (activeInlineControl !== 'trim' && activeInlineControl !== 'speed' && activeInlineControl !== 'scale' && activeInlineControl !== 'loop') {
                            setActiveInlineControl(null);
                          }
                        }
                      }}
                      style={{ width: `${blockWidth}px` }}
                      className={`relative h-full rounded-none shrink-0 cursor-pointer flex flex-col justify-between transition-colors select-none group touch-manipulation overflow-visible ${
                        isSelected 
                          ? 'z-20 border-2 border-amber-400 shadow-lg shadow-amber-950/60' 
                          : isBeingDragged
                          ? 'opacity-40 border border-dashed border-purple-400'
                          : isDragTarget
                          ? 'border border-purple-400 ring-1 ring-purple-400'
                          : isPlayingThis
                          ? 'border border-purple-500/80'
                          : 'border-y-0 border-r border-gray-800/80 hover:border-gray-700 bg-gray-900'
                      }`}
                    >
                      {/* Video Filmstrip Frame-by-Frame Preview */}
                      {(clip.file_id || clip.vid || clip.url || clip.id) && (
                        <TimelineClipFilmstrip
                          clip={clip}
                          blockWidth={blockWidth}
                        />
                      )}

                      {/* Top Accent Strip */}
                      <div className={`h-0.5 w-full shrink-0 z-10 ${
                        isSelected 
                          ? 'bg-amber-400' 
                          : isPlayingThis 
                            ? 'bg-purple-500' 
                            : 'bg-gray-700'
                      }`} />

                      {/* Left Trim Handle - Rectangular and Flush */}
                      {isSelected && (
                        <div
                          data-trim-handle="true"
                          onPointerDown={(e) => handleTrimPointerDown(e, idx, 'start')}
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`absolute left-0 inset-y-0 ${blockWidth < 52 ? 'w-2' : 'w-2.5 sm:w-3'} bg-amber-400 hover:bg-amber-300 z-30 cursor-ew-resize flex items-center justify-center rounded-none select-none touch-none active:bg-yellow-200 shadow-sm`}
                          title="Drag to trim start (micro-adjust)"
                        >
                          <div className="w-[1.2px] h-3.5 bg-black/90 pointer-events-none" />
                        </div>
                      )}

                      {/* Right Trim Handle - Rectangular and Flush */}
                      {isSelected && (
                        <div
                          data-trim-handle="true"
                          onPointerDown={(e) => handleTrimPointerDown(e, idx, 'end')}
                          onTouchStart={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`absolute right-0 inset-y-0 ${blockWidth < 52 ? 'w-2' : 'w-2.5 sm:w-3'} bg-amber-400 hover:bg-amber-300 z-30 cursor-ew-resize flex items-center justify-center rounded-none select-none touch-none active:bg-yellow-200 shadow-sm`}
                          title="Drag to trim end (micro-adjust)"
                        >
                          <div className="w-[1.2px] h-3.5 bg-black/90 pointer-events-none" />
                        </div>
                      )}

                      {/* Status Indicators: Mute & Speed (Top Right) */}
                      <div className="absolute top-1.5 right-1.5 z-30 pointer-events-none flex items-center gap-1">
                        {getIsClipMuted(clip) && blockWidth >= 28 && (
                          <span className="p-0.5 rounded bg-black/85 text-rose-400 border border-black/60 shadow-xs" title="Audio muted">
                            <VolumeX size={8.5} className="stroke-[2.5]" />
                          </span>
                        )}
                        {clip.speed && clip.speed !== 1 && blockWidth >= 38 && (
                          <span className="px-1 py-0.2 rounded bg-black/85 text-cyan-300 font-mono font-black text-[8px] border border-black/60 shadow-xs">
                            {clip.speed}x
                          </span>
                        )}
                      </div>

                      {/* Duration Badge: Inset neatly in bottom-left corner with clearance from trim handles */}
                      {blockWidth >= 22 && (
                        <div className={`absolute bottom-1.5 ${isSelected ? 'left-3.5 sm:left-4' : 'left-1.5'} z-30 pointer-events-none flex items-center`}>
                          <span className="px-1.2 py-0.2 rounded bg-black/80 backdrop-blur-xs text-white/95 font-mono font-bold text-[8.5px] sm:text-[9px] leading-none whitespace-nowrap border border-white/20 shadow-xs">
                            {effDuration.toFixed(1)}s
                          </span>
                        </div>
                      )}

                      {/* Overlapping '+' Insert Button on the seam between consecutive clips */}
                      {idx < activeClips.length - 1 && (
                        <div 
                          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-40 pointer-events-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (openClipPickerAt) {
                                openClipPickerAt(idx + 1);
                              } else {
                                openClipPicker();
                              }
                            }}
                            className="w-5 h-5 rounded-full bg-white hover:bg-purple-100 text-gray-900 hover:text-purple-600 shadow-[0_2px_8px_rgba(0,0,0,0.85)] border border-gray-300 flex items-center justify-center transition-transform hover:scale-125 active:scale-90 cursor-pointer"
                            title={`Insert clip between Clip #${idx + 1} and #${idx + 2}`}
                            aria-label={`Insert clip between #${idx + 1} and #${idx + 2}`}
                          >
                            <Plus size={11} className="stroke-[3]" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* `+ ADD` Button at End of Sequential Clips - Flush Rectangular */}
              {activeClips.length > 0 && (
                <button
                  type="button"
                  onClick={openClipPicker}
                  className="h-full w-9 bg-gray-900 hover:bg-purple-600/80 border-r border-dashed border-gray-700 hover:border-purple-400 rounded-none flex items-center justify-center text-gray-400 hover:text-white transition shrink-0 cursor-pointer shadow-sm active:scale-95 group"
                  title="Add clips from buckets"
                  aria-label="Add clip"
                >
                  <Plus size={13} className="text-purple-400 group-hover:text-white transition" />
                </button>
              )}
            </div>


            {/* Track 2+: Dynamic Caption Layers */}
            {captionLayersSpans.length > 0 && (
              captionLayersSpans.map((layerObj) => (
                <div key={`cap-layer-${layerObj.layerIndex}`} className="flex items-center shrink-0 gap-0.5 h-5 sm:h-5.5 relative">
                  <div className="absolute -left-6 top-0.5 z-20 flex items-center">
                    <span className="text-[7.5px] font-mono px-1 py-0.2 bg-purple-950/80 border border-purple-500/40 text-purple-300 rounded shrink-0 select-none">
                      T{layerObj.layerIndex + 1}
                    </span>
                  </div>
                  {layerObj.spans.map((span: any, sIdx: number) => {
                    const hasCap = span.caption !== null;
                    const isCapSelected = hasCap && span.caption?.id === selectedCaptionId;
                    const palette = CAPTION_PALETTES[span.paletteIdx % CAPTION_PALETTES.length];

                    return (
                      <div
                        key={`cap-span-${layerObj.layerIndex}-${sIdx}-${span.caption?.id || 'empty'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseAllPlayback();
                          if (hasCap && span.caption) {
                            setSelectedCaptionId(span.caption.id);
                            setSelectedTimelineClipIndex(null);
                            setSelectedAudioClipIndex(null);
                            const meta = timelineClipsMeta[span.startClipIdx];
                            if (meta) seekToProjectTime(meta.projectStartTime);
                          } else if (layerObj.layerIndex === 0) {
                            const meta = timelineClipsMeta[span.startClipIdx];
                            if (meta) seekToProjectTime(meta.projectStartTime);
                            setCaptionViewMode('list');
                            setShowTextDrawer(true);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (hasCap && span.caption) {
                            setSelectedCaptionId(span.caption.id);
                            setSelectedTimelineClipIndex(null);
                            setSelectedAudioClipIndex(null);
                            handleOpenCaptionTemplateEditor(span.caption);
                          }
                        }}
                        style={{ width: `${span.totalWidth}px` }}
                        title={hasCap && span.caption ? `"${span.caption.text}" (${span.clipsCount} clips connected - click to select, double click to edit)` : "Empty"}
                        className={`h-full rounded-xs shrink-0 flex items-center px-1.5 overflow-hidden transition-all text-[9px] font-bold select-none relative ${
                          hasCap
                            ? isCapSelected
                              ? 'bg-amber-400 text-black border-2 border-white shadow-md z-10 cursor-pointer'
                              : `${palette.bg} ${palette.text} border ${palette.border} cursor-pointer hover:brightness-110`
                            : layerObj.layerIndex > 0
                              ? 'bg-transparent border-transparent opacity-0 pointer-events-none'
                              : 'border border-dashed border-gray-800/80 hover:border-gray-700 bg-gray-950/60 hover:bg-gray-900 text-gray-600 hover:text-gray-400 cursor-pointer'
                        }`}
                      >
                        {hasCap && span.caption ? (
                          <div className="flex items-center gap-1.5 truncate w-full pointer-events-none leading-none">
                            <Type size={10} className="shrink-0 stroke-[2.5]" />
                            <span className="truncate font-black text-[8.5px] sm:text-[9.5px]">
                              {span.caption.text || "Empty"}
                            </span>
                            {span.clipsCount > 1 && span.totalWidth >= 65 && (
                              <span className="ml-auto text-[7.5px] font-mono px-1 py-0.2 bg-black/40 rounded opacity-85 shrink-0">
                                {span.clipsCount} clips
                              </span>
                            )}
                          </div>
                        ) : (
                          span.totalWidth >= 38 && (
                            <span className="text-[7.5px] font-mono opacity-50 truncate pointer-events-none">
                              + Text
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                  <div className="w-9 h-full shrink-0" />
                </div>
              ))
            )}

            {/* Track 3+: Interactive Multi-Track Audio Layers */}
            {audioLayers.length > 0 && (
              audioLayers.map((layerGroup) => {
                const maxLayerAudioEndPx = layerGroup.clips.reduce((max: number, c: VideoEditorAudioClip) => {
                  const cStart = c.start_time || 0;
                  const cDur = getAudioClipEffectiveDuration(c);
                  return Math.max(max, Math.round((cStart + cDur) * timelineZoom));
                }, 0);
                const audioAddBtnLeft = Math.max(totalVideoClipsWidth + 52, maxLayerAudioEndPx + 24);
                const layerTrackWidth = audioAddBtnLeft + 70;

                return (
                  <div
                    key={`audio-layer-${layerGroup.layerIndex}`}
                    style={{ width: `${layerTrackWidth}px` }}
                    className="relative shrink-0 h-6 sm:h-6.5 select-none"
                  >
                    <div className="absolute -left-6 top-1 z-20 flex items-center">
                      <span className="text-[7.5px] font-mono px-1 py-0.2 bg-pink-950/90 border border-pink-500/40 text-pink-300 rounded shrink-0 select-none">
                        A{layerGroup.layerIndex + 1}
                      </span>
                    </div>
                    {layerGroup.clips.map((audioClip: VideoEditorAudioClip) => {
                      const aIdx = activeAudioClips.findIndex(c => c.id === audioClip.id);
                      const isSelected = aIdx === selectedAudioClipIndex;
                      const isDraggingThis = audioClip.id === activeDraggingAudioId;
                      const dragVisual = isDraggingThis ? audioDragVisual : null;
                      const isOptionsOpen = activeAudioOptionsIndex === aIdx;
                      const naturalDur = getAudioClipEffectiveDuration(audioClip);
                      const clipStart = audioClip.start_time !== undefined ? audioClip.start_time : 0;
                      const displayStartTime = dragVisual ? dragVisual.currentStartTime : clipStart;
                      const leftPx = clipStart === 0 ? 0 : Math.round(clipStart * timelineZoom);
                      const blockWidth = Math.max(28, Math.round(naturalDur * timelineZoom));

                      return (
                        <div
                          key={audioClip.id || `aud_${aIdx}`}
                          data-timeline-audio-idx={aIdx}
                          onPointerDown={(e) => handleAudioClipPointerDown(e, aIdx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            pauseAllPlayback();
                            setSelectedAudioClipIndex(aIdx);
                            setSelectedTimelineClipIndex(null);
                            setSelectedCaptionId(null);
                            setActiveInlineControl(null);
                          }}
                          style={{
                            position: 'absolute',
                            left: `${leftPx}px`,
                            width: `${blockWidth}px`,
                            top: '1px',
                            bottom: '1px',
                            touchAction: 'none',
                            transform: dragVisual ? `translate(${dragVisual.deltaX}px, ${dragVisual.deltaY}px)` : undefined,
                            zIndex: isDraggingThis ? 45 : isSelected ? 20 : 10
                          }}
                          className={`rounded-md border flex items-center px-1.5 gap-1 text-[8.5px] font-bold select-none shadow-xs group relative ${
                            isDraggingThis
                              ? 'bg-pink-900 border-pink-300 ring-2 ring-cyan-400 text-pink-50 shadow-2xl opacity-95 scale-[1.02] cursor-grabbing'
                              : isSelected
                              ? 'bg-pink-900 border-pink-400 ring-2 ring-pink-500/60 text-white shadow-md cursor-pointer'
                              : 'bg-pink-950/80 hover:bg-pink-900/90 border-pink-500/40 hover:border-pink-400 text-pink-200 cursor-pointer'
                          }`}
                          title={`Audio #${aIdx + 1} (Layer ${layerGroup.layerIndex + 1}): "${audioClip.name}" (${Math.round(naturalDur)}s at ${clipStart.toFixed(1)}s) • Long press to drag, drag corner to resize`}
                        >
                          {/* Left corner trim handle */}
                          {isSelected && !isDraggingThis && (
                            <div
                              data-audio-no-drag="true"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAudioTrimPointerDown(e, aIdx, 'start');
                              }}
                              className="absolute left-0 top-0 bottom-0 w-3.5 bg-pink-400 hover:bg-pink-300 rounded-l cursor-ew-resize z-40 flex items-center justify-center shadow-md select-none touch-none active:bg-pink-200 border-r border-black/50"
                              title="Drag corner to reduce/expand audio start"
                            >
                              <div className="w-[1.5px] h-3 bg-black/90 rounded-full pointer-events-none" />
                            </div>
                          )}

                          <Music size={10} className={`shrink-0 text-pink-400 pointer-events-none ${isDraggingThis ? 'animate-bounce' : 'animate-pulse'}`} />
                          <span className="truncate flex-1 group-hover:text-white pointer-events-none">{audioClip.name}</span>

                          {/* Duration & Start badge */}
                          <span className="text-[7.5px] font-mono text-pink-300/80 bg-black/40 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5 pointer-events-none">
                            <span>{displayStartTime > 0 ? `${displayStartTime.toFixed(1)}s · ` : ''}{Math.round(naturalDur)}s{dragVisual && dragVisual.targetLayer !== layerGroup.layerIndex ? ` · Strip A${dragVisual.targetLayer + 1}` : ''}</span>
                          </span>

                          {/* Corner options button */}
                          <button
                            data-audio-no-drag="true"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveAudioOptionsIndex(isOptionsOpen ? null : aIdx);
                            }}
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition cursor-pointer ${
                              isOptionsOpen ? 'bg-pink-500 text-black shadow' : 'hover:bg-black/50 text-pink-300 hover:text-white'
                            }`}
                            title="Audio track menu: Chop, Volume, Replace, Move to Layer, Delete"
                          >
                            <MoreVertical size={10} />
                          </button>

                          {/* Slide-down context options menu */}
                          {isOptionsOpen && (
                            <div
                              data-audio-no-drag="true"
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-0 bottom-full mb-1.5 z-50 bg-gray-900/98 border border-pink-500/70 rounded-xl p-2.5 shadow-2xl backdrop-blur-md min-w-[220px] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 text-white"
                            >
                              <div className="flex items-center justify-between pb-1.5 border-b border-gray-800 text-[10px]">
                                <span className="font-bold text-pink-300 truncate max-w-[140px]">{audioClip.name}</span>
                                <span className="font-mono text-gray-400 text-[8.5px]">Layer {layerGroup.layerIndex + 1} · {Math.round(naturalDur)}s</span>
                              </div>

                              {/* Volume Slider */}
                              <div className="flex flex-col gap-1 py-1">
                                <div className="flex items-center justify-between text-[9px] text-gray-300">
                                  <span className="flex items-center gap-1"><Volume2 size={10} className="text-pink-400" /> Volume</span>
                                  <span className="font-mono font-bold text-pink-300">{Math.round((audioClip.volume ?? 1) * 100)}%</span>
                                </div>
                                <input 
                                  type="range"
                                  min={0}
                                  max={2}
                                  step={0.05}
                                  value={audioClip.volume ?? 1}
                                  onChange={(e) => handleUpdateAudioVolume(aIdx, parseFloat(e.target.value))}
                                  className="w-full h-1 bg-gray-800 accent-pink-500 rounded cursor-pointer"
                                />
                              </div>

                              {/* Move to another Audio Strip */}
                              <div className="flex flex-col gap-1 py-1 border-t border-b border-gray-800/80 my-0.5">
                                <div className="flex items-center justify-between text-[9px] text-gray-300 font-bold">
                                  <span className="flex items-center gap-1"><Layers size={10} className="text-pink-400" /> Strip Layer</span>
                                  <span className="font-mono text-pink-300 text-[8.5px]">Current: A{(audioClip.track_layer || 0) + 1}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {[0, 1, 2, 3].map((layerNum) => {
                                    const isCur = (audioClip.track_layer || 0) === layerNum;
                                    return (
                                      <button
                                        key={layerNum}
                                        type="button"
                                        onClick={() => {
                                          handleMoveAudioClipToLayer(aIdx, layerNum);
                                          setActiveAudioOptionsIndex(null);
                                        }}
                                        className={`px-2 py-0.8 rounded text-[8.5px] font-bold transition cursor-pointer ${
                                          isCur 
                                            ? 'bg-pink-600 text-white' 
                                            : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
                                        }`}
                                      >
                                        Strip A{layerNum + 1}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* 1-tap Fit to Video End */}
                              {totalDuration > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const clipStart = audioClip.start_time !== undefined ? audioClip.start_time : 0;
                                    const maxAllowed = Math.max(0.2, totalDuration - clipStart);
                                    const speed = audioClip.speed || 1;
                                    const targetTrimEnd = (audioClip.trim_start || 0) + (maxAllowed * speed);
                                    const targetDuration = Math.max(audioClip.duration || 0, targetTrimEnd);
                                    const updatedClips = [...activeAudioClips];
                                    updatedClips[aIdx] = {
                                      ...audioClip,
                                      duration: targetDuration,
                                      trim_end: Number(targetTrimEnd.toFixed(2))
                                    };
                                    updateProjectAudioClips(updatedClips, true);
                                    setActiveAudioOptionsIndex(null);
                                    showToast("Trimmed audio track to video end", "success");
                                  }}
                                  className="w-full px-2 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 hover:text-white rounded-lg text-[9.5px] font-bold flex items-center gap-1.5 transition text-left cursor-pointer"
                                >
                                  <Scissors size={11} className="text-amber-400 shrink-0" />
                                  <span>Fit / Trim to Video End</span>
                                </button>
                              )}

                              {/* Chop at Playhead */}
                              <button
                                type="button"
                                onClick={() => {
                                  handleChopAudioClip(aIdx);
                                  setActiveAudioOptionsIndex(null);
                                }}
                                className="w-full px-2 py-1.5 bg-pink-950/60 hover:bg-pink-900/80 text-pink-200 hover:text-white rounded-lg text-[9.5px] font-bold flex items-center gap-1.5 transition text-left cursor-pointer"
                              >
                                <Scissors size={11} className="text-pink-400 shrink-0" />
                                <span>Chop at Playhead ({formatTimecode(projectCurrentTime)})</span>
                              </button>

                              {/* Replace Track from Dashboard */}
                              <button
                                type="button"
                                onClick={() => {
                                  setAudioPickMode({ mode: 'replace', clipIndex: aIdx });
                                  setActiveAudioOptionsIndex(null);
                                  setShowAudioLibrary(true);
                                }}
                                className="w-full px-2 py-1.5 bg-gray-800/80 hover:bg-gray-750 text-gray-200 hover:text-white rounded-lg text-[9.5px] font-bold flex items-center gap-1.5 transition text-left cursor-pointer"
                              >
                                <Edit2 size={11} className="text-cyan-400 shrink-0" />
                                <span>Replace from Audio Dashboard</span>
                              </button>

                              {/* Move Order */}
                              <div className="grid grid-cols-2 gap-1 pt-0.5">
                                <button
                                  type="button"
                                  disabled={aIdx === 0}
                                  onClick={() => handleMoveAudioClip(aIdx, aIdx - 1)}
                                  className="px-2 py-1 bg-gray-800 hover:bg-gray-750 disabled:opacity-35 text-gray-300 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  <ArrowLeft size={10} /> Move Left
                                </button>
                                <button
                                  type="button"
                                  disabled={aIdx === activeAudioClips.length - 1}
                                  onClick={() => handleMoveAudioClip(aIdx, aIdx + 1)}
                                  className="px-2 py-1 bg-gray-800 hover:bg-gray-750 disabled:opacity-35 text-gray-300 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                                >
                                  Move Right <ArrowRight size={10} />
                                </button>
                              </div>

                              {/* Duplicate Audio Clip */}
                              <button
                                type="button"
                                onClick={() => {
                                  handleDuplicateAudioClip(aIdx);
                                  setActiveAudioOptionsIndex(null);
                                }}
                                className="w-full px-2 py-1.5 bg-gray-800/80 hover:bg-gray-750 text-gray-200 hover:text-white rounded-lg text-[9.5px] font-bold flex items-center gap-1.5 transition text-left cursor-pointer"
                              >
                                <Copy size={11} className="text-purple-400 shrink-0" />
                                <span>Duplicate Track</span>
                              </button>

                              {/* Delete Audio Clip */}
                              <button
                                type="button"
                                onClick={() => {
                                  handleDeleteAudioClip(aIdx);
                                  setActiveAudioOptionsIndex(null);
                                }}
                                className="w-full px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 rounded-lg text-[9.5px] font-bold flex items-center gap-1.5 transition text-left cursor-pointer mt-0.5"
                              >
                                <Trash2 size={11} className="text-red-400 shrink-0" />
                                <span>Delete Audio Track</span>
                              </button>
                            </div>
                          )}

                          {/* Right corner trim handle */}
                          {isSelected && !isDraggingThis && (
                            <div
                              data-audio-no-drag="true"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                handleAudioTrimPointerDown(e, aIdx, 'end');
                              }}
                              className="absolute right-0 top-0 bottom-0 w-3.5 bg-pink-400 hover:bg-pink-300 rounded-r cursor-ew-resize z-40 flex items-center justify-center shadow-md select-none touch-none active:bg-pink-200 border-l border-black/50"
                              title="Drag corner to reduce/expand audio end"
                            >
                              <div className="w-[1.5px] h-3 bg-black/90 rounded-full pointer-events-none" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {/* Add New Audio Strip Button */}
            {audioLayers.length > 0 && (
              <div className="relative shrink-0 flex items-center gap-1.5 my-0.5 select-none pl-1">
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    const maxLayer = activeAudioClips.reduce((max, c) => Math.max(max, c.track_layer || 0), -1);
                    setAudioPickMode({ mode: 'append', targetLayer: maxLayer + 1 });
                    setShowAudioLibrary(true);
                  }}
                  className="px-2 py-0.5 bg-gray-900/60 hover:bg-pink-950/50 border border-dashed border-gray-800 hover:border-pink-500/50 text-gray-400 hover:text-pink-300 rounded-md flex items-center gap-1 text-[8px] font-bold transition cursor-pointer shadow-xs active:scale-95"
                  title="Add audio track on a new strip"
                >
                  <Plus size={9} className="text-pink-400" />
                  <span>Add New Strip (A{audioLayers.length + 1})</span>
                </button>
              </div>
            )}

            {/* Drop target zone to create new audio layer when dragging an audio clip */}
            {draggedAudioClipIndex !== null && (
              <div
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedAudioClipIndex !== null && setDraggedAudioClipIndex) {
                    const maxLayer = Math.max(0, ...activeAudioClips.map(c => c.track_layer || 0));
                    handleMoveAudioClipToLayer(draggedAudioClipIndex, maxLayer + 1);
                    setDraggedAudioClipIndex(null);
                  }
                }}
                className="h-5 sm:h-5.5 border border-dashed border-pink-400/80 bg-pink-950/40 rounded flex items-center justify-center text-[8.5px] font-bold text-pink-300 transition animate-pulse shrink-0"
              >
                <span>+ Drop here to create new audio layer (Play simultaneously)</span>
              </div>
            )}
          </div>

          {/* Right 50% Spacer so end of timeline aligns with fixed center needle */}
          <div className="shrink-0 w-1/2 h-full pointer-events-none" />
        </div>
      </div>
    </section>
  );
};
