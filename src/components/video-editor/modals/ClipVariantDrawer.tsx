import React, { useState } from 'react';
import { 
  X, Layers, Plus, UploadCloud, Sparkles, Film, Check, Trash2, 
  Play, Pause, ArrowRight
} from 'lucide-react';
import { VideoEditorClip, HiggsfieldJob, getClipVariantGroups } from '../../../types';
import { useUltraDataSaver } from '../../../utils/dataSaver';

export interface ClipVariantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clip: VideoEditorClip | null;
  clipIndex: number;
  jobs?: HiggsfieldJob[];
  onApplyTake?: (job: HiggsfieldJob, targetClipIndex: number) => void;
  onOpenAiPromptMode?: (clipIdx?: number) => void;
  onTrashJob?: (job: HiggsfieldJob) => Promise<void>;
  onSwitchVariant: (clipIdx: number, variantIdx: number, groupIdx?: number) => void;
  onDeleteVariant: (clipIdx: number, variantIdx: number) => void;
  onSwitchVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateVariantGroup?: (clipIdx: number, mode?: 'empty_ai' | 'upload' | 'picker') => void;
  onDeleteVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateEmptyVariant: (clipIdx: number) => void;
  onOpenUploadForVariant: (clipIdx: number, asNewConcept?: boolean) => void;
  onOpenPickerForVariant: (clipIdx: number, asNewConcept?: boolean) => void;
  isUploadingVariant?: boolean;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onOpenVaultDrawer?: () => void;
}

export const ClipVariantDrawer: React.FC<ClipVariantDrawerProps> = ({
  isOpen,
  onClose,
  clip,
  clipIndex,
  jobs = [],
  onApplyTake,
  onOpenAiPromptMode,
  onTrashJob,
  onSwitchVariant,
  onDeleteVariant,
  onSwitchVariantGroup,
  onCreateVariantGroup,
  onDeleteVariantGroup,
  onCreateEmptyVariant,
  onOpenUploadForVariant,
  onOpenPickerForVariant,
  isUploadingVariant = false,
  showToast,
  onOpenVaultDrawer
}) => {
  const { config } = useUltraDataSaver();
  const [playingCardKey, setPlayingCardKey] = useState<string | null>(null);
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);

  if (!isOpen || !clip) return null;

  const variantGroups = getClipVariantGroups(clip);
  const activeGroupIdx = Math.min(
    Math.max(0, clip.active_variant_group_index ?? 0),
    Math.max(0, variantGroups.length - 1)
  );

  const letterLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const nextGroupLetter = letterLabels[variantGroups.length] || `${variantGroups.length + 1}`;

  // Find all approved/completed AI takes for this clip position
  const relatedAiJobs = jobs.filter(j => 
    (j.status === 'added' || j.status === 'completed') && 
    ((j.clipIndex ?? -1) === clipIndex || (clip.id && j.clipId === clip.id))
  );

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150">
      {/* Tap backdrop to dismiss */}
      <div className="flex-1 w-full" onClick={onClose} />

      {/* Main Bottom Sheet Container */}
      <div 
        className="w-full max-w-2xl mx-auto bg-gray-950 border-t border-purple-500/40 rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-white animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Indicator */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-700/80" />
        </div>

        {/* Header Row */}
        <div className="px-4 py-2.5 border-b border-gray-800 flex items-center justify-between bg-gray-900/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <Layers size={14} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
                <span>Clip Position #{clipIndex + 1} · Concepts & Variants</span>
                <span className="text-[10px] font-mono font-bold text-amber-300 px-1.5 py-0.2 bg-amber-950/80 border border-amber-500/40 rounded">
                  {variantGroups.length} {variantGroups.length === 1 ? 'Concept' : 'Concepts'}
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 truncate">
                Vertical swipe switches Concept (A / B) · Horizontal swipe switches Variant takes (dots)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-5">
          {/* Quick Concept Switcher Strip */}
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <span>Concepts (Vertical Axis · Up / Down)</span>
              </span>
              <span className="text-[9.5px] text-gray-400 font-mono">
                Shown on left side of clip
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {variantGroups.map((grp, gIdx) => {
                const isGrpActive = gIdx === activeGroupIdx;
                const grpLetter = grp.label || letterLabels[gIdx] || `${gIdx + 1}`;
                const clipsCount = grp.clips?.length || 1;
                return (
                  <button
                    key={`pill-${grp.id || gIdx}`}
                    type="button"
                    onClick={() => {
                      setPlayingCardKey(null);
                      onSwitchVariantGroup?.(clipIndex, gIdx);
                    }}
                    className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 cursor-pointer font-mono text-xs font-black transition-all shrink-0 ${
                      isGrpActive
                        ? 'bg-amber-500 text-black border-amber-300 shadow-md shadow-amber-950/50 scale-102'
                        : 'bg-gray-950/90 text-gray-300 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span>Concept {grpLetter}</span>
                    <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${
                      isGrpActive ? 'bg-black/20 text-black' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {clipsCount} {clipsCount === 1 ? 'dot' : 'dots'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ALL CONCEPTS DISPLAYED UNDER THE SAME POSITION SLOT */}
          <div className="space-y-4">
            {variantGroups.map((grp, gIdx) => {
              const isGrpActive = gIdx === activeGroupIdx;
              const grpLetter = grp.label || letterLabels[gIdx] || `${gIdx + 1}`;
              const grpClips: VideoEditorClip[] = grp.clips && grp.clips.length > 0
                ? grp.clips
                : [clip];
              const activeClipInThisGroup = Math.min(
                Math.max(0, grp.active_clip_index ?? (isGrpActive ? clip.active_variant_index ?? 0 : 0)),
                Math.max(0, grpClips.length - 1)
              );

              return (
                <div 
                  key={grp.id || gIdx}
                  className={`rounded-2xl border p-3 transition-all ${
                    isGrpActive
                      ? 'bg-gray-900/90 border-amber-500/60 shadow-xl'
                      : 'bg-gray-950/70 border-gray-800/80 hover:border-gray-700'
                  }`}
                >
                  {/* Concept Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800/80">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-black font-mono flex items-center gap-1 shadow-sm ${
                        isGrpActive
                          ? 'bg-amber-400 text-black'
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {isGrpActive && <Check size={11} className="stroke-[3]" />}
                        <span>Concept {grpLetter}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono font-medium">
                        {grpClips.length} {grpClips.length === 1 ? 'Variant clip (1 dot)' : `Variant clips (${grpClips.length} dots)`}
                      </span>
                      {isGrpActive && (
                        <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.2 rounded">
                          Active Concept
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isGrpActive && (
                        <button
                          type="button"
                          onClick={() => onSwitchVariantGroup?.(clipIndex, gIdx)}
                          className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-amber-400 hover:text-black text-amber-300 font-bold text-[10px] transition cursor-pointer"
                        >
                          Make Active
                        </button>
                      )}

                      {variantGroups.length > 1 && onDeleteVariantGroup && (
                        <button
                          type="button"
                          onClick={() => onDeleteVariantGroup(clipIndex, gIdx)}
                          className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-gray-900 transition cursor-pointer"
                          title={`Delete Concept ${grpLetter}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Strip of Variant Takes inside this Concept */}
                  <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar">
                    {grpClips.map((v, cIdx) => {
                      const isThisActive = isGrpActive && activeClipInThisGroup === cIdx;
                      const dur = typeof v.duration === 'number' ? v.duration : (clip.duration || 4.0);
                      const thumbKey = v.file_id || v.id || clip.file_id || clip.id;
                      const posterUrl = (config.enabled && config.microThumbnails)
                        ? `/api/thumb/${thumbKey}?ultra=1`
                        : `/api/thumb/${thumbKey}`;
                      const videoSrc = v.url || (v.file_id ? `/api/video/${v.file_id}` : '');
                      const cardKey = `${grpLetter}_${cIdx}`;
                      const isPlaying = playingCardKey === cardKey;

                      return (
                        <div
                          key={v.id || cIdx}
                          onClick={() => {
                            onSwitchVariant(clipIndex, cIdx, gIdx);
                            showToast?.(`Concept ${grpLetter}: Switched to Variant #${cIdx + 1} (${cIdx + 1}/${grpClips.length})`, 'success');
                          }}
                          className={`relative w-28 sm:w-32 aspect-[9/16] shrink-0 rounded-xl overflow-hidden bg-black border-2 transition-all cursor-pointer shadow-lg flex flex-col justify-between p-1.5 group select-none ${
                            isThisActive
                              ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-amber-950/80 scale-[1.02]'
                              : 'border-gray-800 hover:border-gray-600 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {/* Background Video / Poster */}
                          {videoSrc && isPlaying ? (
                            <video
                              src={videoSrc}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                            />
                          ) : (
                            <img
                              src={posterUrl}
                              alt={`Concept ${grpLetter} Take ${cIdx + 1}`}
                              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}

                          {/* Top Row: Dot Number & Delete */}
                          <div className="relative z-10 flex items-center justify-between">
                            <span className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] shadow flex items-center gap-0.5 ${
                              isThisActive
                                ? 'bg-amber-500 text-black'
                                : 'bg-black/80 text-white border border-white/20'
                            }`}>
                              {isThisActive && <Check size={9} className="stroke-[3]" />}
                              <span>{grpLetter}·{cIdx + 1}</span>
                            </span>

                            <div className="flex items-center gap-1">
                              {videoSrc && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlayingCardKey(prev => prev === cardKey ? null : cardKey);
                                  }}
                                  className="w-5 h-5 rounded bg-black/80 text-white hover:text-amber-300 flex items-center justify-center cursor-pointer transition"
                                  title={isPlaying ? "Pause" : "Play preview"}
                                >
                                  {isPlaying ? <Pause size={9} /> : <Play size={9} className="translate-x-0.2" />}
                                </button>
                              )}

                              {grpClips.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteVariant(clipIndex, cIdx);
                                  }}
                                  className="w-5 h-5 rounded bg-black/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                                  title={`Delete Variant #${cIdx + 1} from Concept ${grpLetter}`}
                                >
                                  <Trash2 size={9} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Bottom Row: Duration & Active Label */}
                          <div className="relative z-10 flex items-center justify-between">
                            <span className="text-[8px] font-mono text-gray-300 bg-black/80 px-1 py-0.2 rounded font-bold">
                              {dur.toFixed(1)}s
                            </span>
                            {isThisActive && (
                              <span className="text-[7.5px] font-black uppercase text-amber-300 bg-black/90 px-1 py-0.2 rounded border border-amber-400/40">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions for this Concept: Upload multiple videos or pick multiple clips */}
                  <div className="mt-2 pt-2 border-t border-gray-800/60 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isGrpActive) {
                          onSwitchVariantGroup?.(clipIndex, gIdx);
                        }
                        onOpenUploadForVariant(clipIndex, false);
                        onClose();
                      }}
                      disabled={isUploadingVariant}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-gray-900 hover:bg-indigo-950/60 border border-gray-800 hover:border-indigo-500/50 text-indigo-300 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
                      title="Upload one or multiple video files into this concept"
                    >
                      <UploadCloud size={13} />
                      <span>Upload Video(s) to Concept {grpLetter}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isGrpActive) {
                          onSwitchVariantGroup?.(clipIndex, gIdx);
                        }
                        onOpenPickerForVariant(clipIndex, false);
                        onClose();
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-gray-900 hover:bg-amber-950/60 border border-gray-800 hover:border-amber-500/50 text-amber-300 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      title="Pick multiple clips from library into this concept"
                    >
                      <Film size={13} />
                      <span>Pick Clips for Concept {grpLetter}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ADD COMPLETELY NEW CONCEPT (Concept B, C...) */}
          <div className="bg-gray-900/50 border-2 border-dashed border-purple-500/40 rounded-2xl p-3 sm:p-4 text-center">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/60 border border-purple-500/50 flex items-center justify-center mx-auto text-purple-300 mb-2 shadow">
              <Plus size={20} className="stroke-[2.5]" />
            </div>
            <h4 className="text-xs sm:text-sm font-black text-white">
              Add New Concept {nextGroupLetter}
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5 max-w-sm mx-auto">
              Want a completely different batch/concept for position #{clipIndex + 1}? Add Concept {nextGroupLetter} and swipe vertically (up/down) to switch.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => {
                  onOpenUploadForVariant(clipIndex, true);
                  onClose();
                }}
                disabled={isUploadingVariant}
                className="py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50"
              >
                <UploadCloud size={14} />
                <span>Upload Video(s) for Concept {nextGroupLetter}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenPickerForVariant(clipIndex, true);
                  onClose();
                }}
                className="py-2 px-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-purple-400 text-purple-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Film size={14} />
                <span>Choose Clips for Concept {nextGroupLetter}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-gray-950 border-t border-gray-900 flex items-center justify-between text-[10px] text-gray-500">
          <span>
            Active: <strong className="text-amber-300 font-mono">Concept {letterLabels[activeGroupIdx]} · Variant #{((variantGroups[activeGroupIdx]?.active_clip_index ?? clip.active_variant_index ?? 0) + 1)}/{(variantGroups[activeGroupIdx]?.clips?.length || 1)}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold cursor-pointer transition shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
