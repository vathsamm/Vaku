import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, UploadCloud, Check, Sparkles, X, Calendar, Plus, Film, Layers } from 'lucide-react';
import { VideoData, VideoEditorClip, HiggsfieldJob, DB, VideoEditorProject } from '../../../types';
import { useUltraDataSaver } from '../../../utils/dataSaver';
import { LongPressVideoPreviewOverlay } from '../../LongPressVideoPreview';
import { TimelineClipsVaultView } from '../components/TimelineClipsVaultView';
import { ImportProjectClipsModal } from '../modals/ImportProjectClipsModal';

export interface UploadDateGroup {
  dateKey: string;
  dateLabel: string;
  clips: [string, VideoData][];
}

export interface ClipPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketName: string;
  replaceTargetClipIndex: number | null;
  insertTargetClipIndex?: number | null;
  setInsertTargetClipIndex?: (idx: number | null) => void;
  selectedClipIdsInPicker: string[];
  handleAddSelectedClipsToTimeline: () => void;
  handleAutoReplaceFromBucket: () => void;
  activePickerClips: [string, VideoData][];
  uploadDateGroups: UploadDateGroup[];
  startPickerLongPress: (clipPreviewData: any, e: any) => void;
  movePickerLongPress: (e: any) => void;
  endPickerLongPress: () => void;
  checkDidPickerLongPress: () => boolean;
  togglePickerClipSelection: (vid: string) => void;
  activeClips: VideoEditorClip[];
  updateProjectClips: (clips: VideoEditorClip[], history?: boolean) => void;
  setSelectedTimelineClipIndex: (idx: number) => void;
  setCurrentClipIndex: (idx: number) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  pickerUploadInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingClips: boolean;
  uploadClipsProgress: number;
  uploadClipsStats?: { current: number; total: number } | null;
  handleUploadVideosToMasterBucket: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pickerActivePreview: any;
  closePickerPreview: () => void;
  addedJobs?: HiggsfieldJob[];
  onAddAiJobToTimeline?: (job: HiggsfieldJob) => void;
  onReplaceWithAiJob?: (job: HiggsfieldJob, targetIndex: number) => void;
  db?: DB;
  activeProject?: VideoEditorProject | null;
  onSwitchVariant?: (clipIdx: number, variantIdx: number) => void;
  onDeleteClipVariant?: (clipIdx: number, variantIdx: number) => void;
  onDeleteSpecificClip?: (clipIdx: number) => void;
  onInitiateReplaceClip?: (clipIdx: number) => void;
  onOpenAiPromptMode?: (clipIdx?: number) => void;
  onTrashJob?: (job: HiggsfieldJob) => Promise<void>;
  onApplyTake?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  onReplaceKeepVariant?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  variantTargetClipIndex?: number | null;
  setVariantTargetClipIndex?: (idx: number | null) => void;
  initialTab?: 'uploads' | 'clips';
  onTakeFullClip?: (sourceClip: VideoEditorClip) => void;
  onTakeSingleClip?: (singleClip: VideoEditorClip) => void;
  onSwitchVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateVariantGroup?: (clipIdx: number, mode?: 'empty_ai' | 'upload' | 'picker') => void;
  onDeleteVariantGroup?: (clipIdx: number, groupIdx: number) => void;
}

export const ClipPickerModal: React.FC<ClipPickerModalProps> = ({
  isOpen,
  onClose,
  masterBucketName,
  replaceTargetClipIndex,
  insertTargetClipIndex,
  setInsertTargetClipIndex,
  selectedClipIdsInPicker,
  handleAddSelectedClipsToTimeline,
  handleAutoReplaceFromBucket,
  activePickerClips,
  uploadDateGroups,
  startPickerLongPress,
  movePickerLongPress,
  endPickerLongPress,
  checkDidPickerLongPress,
  togglePickerClipSelection,
  activeClips,
  updateProjectClips,
  setSelectedTimelineClipIndex,
  setCurrentClipIndex,
  showToast,
  pickerUploadInputRef,
  isUploadingClips,
  uploadClipsProgress,
  uploadClipsStats,
  handleUploadVideosToMasterBucket,
  pickerActivePreview,
  closePickerPreview,
  addedJobs = [],
  onAddAiJobToTimeline,
  onReplaceWithAiJob,
  db,
  activeProject,
  onSwitchVariant,
  onDeleteClipVariant,
  onDeleteSpecificClip,
  onInitiateReplaceClip,
  onOpenAiPromptMode,
  onTrashJob,
  onApplyTake,
  onReplaceKeepVariant,
  variantTargetClipIndex,
  setVariantTargetClipIndex,
  initialTab,
  onTakeFullClip,
  onTakeSingleClip,
  onSwitchVariantGroup,
  onCreateVariantGroup,
  onDeleteVariantGroup,
}) => {
  const { config } = useUltraDataSaver();
  const [activeTab, setActiveTab] = useState<'uploads' | 'clips'>(
    initialTab || (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined ? 'clips' : 'uploads')
  );
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);

  // Sync tab whenever modal opens or initialTab/variantTarget changes
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined) {
        setActiveTab('clips');
      }
      if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined) {
        setIsMultiSelectMode(true);
      }
    }
  }, [isOpen, initialTab, variantTargetClipIndex]);

  // Filter reviewed & added AI generation jobs only
  const validAddedJobs = useMemo(() => {
    return addedJobs.filter(j => j.status === 'added' && Boolean(j.video_url || j.file_id));
  }, [addedJobs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] w-full h-full bg-gray-950 flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* 1. TOP HEADER - CLEAN, FIXED, ZERO OVERLAPPING ACROSS MOBILE & DESKTOP */}
      <div className="h-11 px-2.5 sm:px-3 border-b border-gray-800 flex items-center justify-between bg-gray-900 shrink-0 z-30">
        {/* Left: Mode Title & Info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border shrink-0 ${
            activeTab === 'clips'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : replaceTargetClipIndex !== null
              ? 'bg-amber-600/30 border-amber-500/40 text-amber-300'
              : variantTargetClipIndex !== null
              ? 'bg-purple-600/30 border-purple-500/40 text-purple-300'
              : 'bg-purple-600/30 border-purple-500/40 text-purple-300'
          }`}>
            {activeTab === 'clips' ? <Layers size={14} className="text-amber-400" /> : (replaceTargetClipIndex !== null ? <RefreshCw size={14} /> : <Film size={14} />)}
          </div>
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            {activeTab === 'clips' 
              ? 'Variant' 
              : (replaceTargetClipIndex !== null 
                  ? 'Replace Clip' 
                  : (variantTargetClipIndex !== null 
                      ? `Choose Variants (#${variantTargetClipIndex + 1})` 
                      : 'Add Clips'))}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-400 font-mono shrink-0">
            {activeTab === 'clips' ? `(${activeClips.length} ${activeClips.length === 1 ? 'clip' : 'clips'})` : `(${activePickerClips.length} ${activePickerClips.length === 1 ? 'video' : 'videos'})`}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'uploads' ? (
            /* Inside Upload Section: Exactly TWO buttons: Variant + Close */
            <>
              <button
                type="button"
                onClick={() => setActiveTab('clips')}
                className="h-7.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 border border-amber-500/50 text-amber-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Switch to Variant Takes view"
              >
                <Layers size={13} className="text-amber-400 stroke-[2.5]" />
                <span>Variant</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl text-gray-400 hover:text-white flex items-center justify-center hover:bg-gray-800 transition cursor-pointer shrink-0"
                title="Close"
              >
                <X size={17} />
              </button>
            </>
          ) : (
            /* Inside Variant / Clips view: Uploads + Close */
            <>
              <button
                type="button"
                onClick={() => setActiveTab('uploads')}
                className="h-7.5 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/50 border border-purple-500/50 text-purple-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Switch to Uploads view"
              >
                <Film size={13} className="text-purple-400 stroke-[2.5]" />
                <span>Uploads</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl text-gray-400 hover:text-white flex items-center justify-center hover:bg-gray-800 transition cursor-pointer shrink-0"
                title="Close"
              >
                <X size={17} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. MAIN BODY */}
      {activeTab === 'clips' ? (
        <TimelineClipsVaultView
          activeClips={activeClips}
          targetClipIndex={variantTargetClipIndex ?? replaceTargetClipIndex ?? (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined ? insertTargetClipIndex : 0)}
          jobs={validAddedJobs}
          db={db}
          activeProject={activeProject}
          masterBucketName={masterBucketName}
          updateProjectClips={updateProjectClips}
          onSelectClipIndex={setSelectedTimelineClipIndex}
          onSwitchVariant={onSwitchVariant}
          onDeleteClipVariant={onDeleteClipVariant}
          onDeleteSpecificClip={onDeleteSpecificClip}
          onInitiateReplaceClip={onInitiateReplaceClip}
          onOpenAiPromptMode={onOpenAiPromptMode}
          onTrashJob={onTrashJob}
          onApplyTake={onApplyTake}
          onReplaceKeepVariant={onReplaceKeepVariant}
          showToast={showToast}
          onCloseParent={onClose}
          isAudioMuted={isAudioMuted}
          onToggleMute={() => setIsAudioMuted(prev => !prev)}
          showImportModal={showImportModal}
          setShowImportModal={setShowImportModal}
          insertTargetClipIndex={insertTargetClipIndex}
          replaceTargetClipIndex={replaceTargetClipIndex}
          variantTargetClipIndex={variantTargetClipIndex}
          onTakeFullClip={onTakeFullClip}
          onTakeSingleClip={onTakeSingleClip}
          onSwitchVariantGroup={onSwitchVariantGroup}
          onCreateVariantGroup={onCreateVariantGroup}
          onDeleteVariantGroup={onDeleteVariantGroup}
          onOpenPickerForVariant={(clipIdx) => {
            if (setVariantTargetClipIndex) setVariantTargetClipIndex(clipIdx);
            setActiveTab('uploads');
            setIsMultiSelectMode(true);
          }}
        />
      ) : (
        /* UPLOADS TAB: WITH MATCHING SECOND STRIP & CLEAN SCROLLING */
        <div className="flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden">
          {/* Contextual Second Strip for Uploads Section */}
          <div className="px-3 py-2 bg-gray-950 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 z-20">
            {insertTargetClipIndex !== null && insertTargetClipIndex !== undefined ? (
              /* CONTEXTUAL 3-BOX INSERTION STRIP: [Clip A] -> [+] -> [Clip B] */
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
                {insertTargetClipIndex > 0 && activeClips[insertTargetClipIndex - 1] && (
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-mono font-bold">
                    <span className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                      {insertTargetClipIndex}
                    </span>
                    <span className="text-[11px]">Clip #{insertTargetClipIndex}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono font-black text-xs shadow-lg shadow-purple-950/80 ring-2 ring-purple-400 animate-pulse">
                  <Plus size={14} className="stroke-[3]" />
                  <span className="text-[11px] uppercase tracking-wide">Adding Here (#{insertTargetClipIndex + 1})</span>
                </div>

                {insertTargetClipIndex < activeClips.length && activeClips[insertTargetClipIndex] && (
                  <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-mono font-bold">
                    <span className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                      {insertTargetClipIndex + 1}
                    </span>
                    <span className="text-[11px]">Clip #{insertTargetClipIndex + 1}</span>
                  </div>
                )}
              </div>
            ) : replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined ? (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 font-mono font-bold text-xs ring-1 ring-amber-400">
                  <span>Replacing Clip #{replaceTargetClipIndex + 1}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
                {activeClips.map((_, idx) => (
                  <span
                    key={idx}
                    className="min-w-[32px] h-[32px] px-2 rounded-xl flex items-center justify-center font-mono font-black text-xs bg-gray-900 text-gray-300 border border-gray-800"
                  >
                    {idx + 1}
                  </span>
                ))}
              </div>
            )}

            <div className="px-2 py-1 rounded-lg bg-gray-900/90 border border-gray-800 text-[10.5px] font-mono text-purple-300 font-bold shrink-0">
              {activePickerClips.length} {activePickerClips.length === 1 ? 'Upload' : 'Uploads'}
            </div>
          </div>

          {/* Scrollable Gallery Content */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 bg-gray-950 pb-24 relative">
            {activePickerClips.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <button
                  type="button"
                  onClick={() => pickerUploadInputRef.current?.click()}
                  className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-850 flex items-center justify-center text-gray-400 hover:text-purple-300 mb-3 shadow-inner cursor-pointer transition active:scale-95 group"
                  title="Click to upload video clips"
                >
                  <UploadCloud size={26} className="text-purple-400/80 group-hover:scale-110 transition-transform" />
                </button>
                <p className="text-sm font-bold text-gray-200">No Uploads Yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                  Raw video clips uploaded to <span className="text-purple-300 font-semibold">{masterBucketName}</span> will be gathered here, separated by upload date.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {uploadDateGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-2.5">
                    {/* Fixed edge-to-edge solid sticky separator with ZERO overlap/bleed */}
                    <div className="sticky top-0 z-20 -mx-2.5 sm:-mx-4 px-3 py-1.5 bg-gray-950 border-b border-gray-800 flex items-center justify-between shadow-md">
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <Calendar size={12} className="text-purple-400" />
                        <span>{group.dateLabel}</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 font-bold px-1.5 py-0.2 bg-gray-900 rounded border border-gray-800">
                        {group.clips.length} {group.clips.length === 1 ? 'clip' : 'clips'}
                      </span>
                    </div>

                    {/* 9:16 Video Clip Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3 auto-rows-max items-start">
                      {group.clips.map(([vid, v]) => {
                        const selIndex = selectedClipIdsInPicker.indexOf(vid);
                        const isSelected = selIndex !== -1;
                        const dur = typeof v.duration === 'number' ? v.duration : 4.0;
                        const thumbKey = v.file_id || v.id || vid;
                        const posterUrl = (config.enabled && config.microThumbnails)
                          ? `/api/thumb/${thumbKey}?ultra=1`
                          : `/api/thumb/${thumbKey}`;
                        const clipSrc = (v.url && (v.url.startsWith('/api/') || v.url.startsWith('http') || v.url.startsWith('blob:') || v.url.startsWith('data:')))
                          ? v.url 
                          : (v.file_id ? `/api/video/${v.file_id}` : (v.id ? `/api/video/${v.id}` : (vid ? `/api/video/${vid}` : (v.url || null))));

                        const clipPreviewData = {
                          videoSrc: clipSrc || `/api/video/${thumbKey}`,
                          posterUrl,
                          title: v.name || v.source_name || 'Uploaded Clip',
                          duration: dur
                        };

                        return (
                          <div key={vid} className="w-full flex flex-col select-none">
                            <div
                              onTouchStart={(e) => startPickerLongPress(clipPreviewData, e)}
                              onTouchMove={movePickerLongPress}
                              onTouchEnd={endPickerLongPress}
                              onTouchCancel={endPickerLongPress}
                              onMouseDown={(e) => startPickerLongPress(clipPreviewData, e)}
                              onMouseMove={movePickerLongPress}
                              onMouseUp={endPickerLongPress}
                              onClick={() => {
                                if (checkDidPickerLongPress()) return;

                                // Multi-select enabled, clips already selected, or in variant mode:
                                if (isMultiSelectMode || selectedClipIdsInPicker.length > 0 || (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined)) {
                                  togglePickerClipSelection(vid);
                                  return;
                                }

                                // Single click instant add when not in multi-select mode
                                if (selectedClipIdsInPicker.length === 0 && replaceTargetClipIndex === null) {
                                  const newClip: VideoEditorClip = {
                                    id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                                    vid: vid,
                                    url: v.url || '',
                                    file_id: v.file_id || null,
                                    bucket_id: v.folder_id || 'uploads',
                                    bucket_name: 'Uploads',
                                    duration: dur,
                                    speed: 1.0,
                                    scale: 1.0,
                                    trim_start: 0,
                                    trim_end: dur,
                                    is_muted: false,
                                    volume: 1.0,
                                  };
                                  const updated = [...activeClips];
                                  if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
                                    updated.splice(insertTargetClipIndex, 0, newClip);
                                    updateProjectClips(updated, true);
                                    setSelectedTimelineClipIndex(insertTargetClipIndex);
                                    setCurrentClipIndex(insertTargetClipIndex);
                                    if (setInsertTargetClipIndex) setInsertTargetClipIndex(null);
                                    onClose();
                                    showToast(`Inserted clip at position #${insertTargetClipIndex + 1}!`, 'success');
                                    return;
                                  }
                                  updated.push(newClip);
                                  updateProjectClips(updated, true);
                                  setSelectedTimelineClipIndex(updated.length - 1);
                                  setCurrentClipIndex(updated.length - 1);
                                  onClose();
                                  showToast('Added to timeline!', 'success');
                                  return;
                                }
                                togglePickerClipSelection(vid);
                              }}
                              className={`relative aspect-[9/16] w-full bg-gray-900 rounded-xl overflow-hidden cursor-pointer border-2 transition-all shadow group ${
                                isSelected
                                  ? 'border-purple-500 ring-2 ring-purple-500 shadow-purple-950/70 scale-[1.02]'
                                  : 'border-gray-800 hover:border-purple-500/50'
                              }`}
                            >
                              <img
                                src={posterUrl}
                                alt={v.name || 'Clip'}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none opacity-90 group-hover:opacity-100"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />

                              {/* Multi-Selection Badge */}
                              <div className="absolute top-1.5 inset-x-1.5 z-30 flex items-center justify-between gap-1 pointer-events-none">
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePickerClipSelection(vid);
                                  }}
                                  className="flex items-center gap-1 pointer-events-auto min-w-0 cursor-pointer p-0.5"
                                  title={isSelected ? "Unselect clip" : "Select clip (Multi-select)"}
                                >
                                  {isSelected ? (
                                    <div className="w-5.5 h-5.5 rounded-full bg-purple-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center shadow-lg ring-2 ring-purple-300 animate-in zoom-in shrink-0">
                                      #{selIndex + 1}
                                    </div>
                                  ) : (
                                    <div className="w-5.5 h-5.5 rounded-full bg-black/70 border border-white/40 text-white flex items-center justify-center opacity-70 group-hover:opacity-100 shrink-0">
                                      <Plus size={11} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Neatly Contained Duration Tag (zero overflow) */}
                              <div className="absolute inset-x-0 bottom-0 z-30 p-1 bg-gradient-to-t from-black via-black/70 to-transparent flex items-center justify-between text-[8.5px] pointer-events-none">
                                <span className="font-mono text-white font-bold bg-black/80 px-1 py-0.2 rounded border border-white/10">
                                  {dur.toFixed(1)}s
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for uploads */}
      <input
        ref={pickerUploadInputRef}
        type="file"
        accept="video/*"
        multiple
        disabled={isUploadingClips}
        onChange={handleUploadVideosToMasterBucket}
        className="hidden"
      />

      {/* Floating Bottom Action Bar for Multi-Selected Clips */}
      {activeTab === 'uploads' && selectedClipIdsInPicker.length > 0 && (
        <div className="absolute bottom-5 inset-x-0 z-40 flex items-center justify-center pointer-events-none px-4">
          <button
            type="button"
            onClick={handleAddSelectedClipsToTimeline}
            className="pointer-events-auto max-w-sm w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-2xl shadow-purple-950/90 border border-purple-400/40 flex items-center justify-center gap-2 cursor-pointer transition animate-in slide-in-from-bottom-2 duration-150"
          >
            <Check size={16} className="stroke-[3]" />
            <span>
              {variantTargetClipIndex !== null
                ? `Add ${selectedClipIdsInPicker.length} Selected Clip${selectedClipIdsInPicker.length === 1 ? '' : 's'} as Variants`
                : `Add ${selectedClipIdsInPicker.length} Selected Clip${selectedClipIdsInPicker.length === 1 ? '' : 's'} to Timeline`}
            </span>
          </button>
        </div>
      )}

      {/* Floating Upload Button */}
      {activeTab === 'uploads' && (
        <div className={`absolute right-5 sm:right-6 z-40 transition-all ${
          selectedClipIdsInPicker.length > 0 ? 'bottom-20' : 'bottom-6 sm:bottom-8'
        }`}>
          <button
            type="button"
            onClick={() => pickerUploadInputRef.current?.click()}
            disabled={isUploadingClips}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white shadow-xl shadow-purple-950/80 border-2 border-purple-400/60 flex items-center justify-center transition-all cursor-pointer ring-2 ring-purple-500/30 disabled:opacity-90"
            title="Upload Video Clips (+)"
          >
            {isUploadingClips ? (
              <div className="flex flex-col items-center justify-center leading-none select-none pointer-events-none">
                <RefreshCw size={12} className="animate-spin text-white mb-0.5" />
                <span className="text-[10px] font-black font-mono tracking-tight text-white drop-shadow-sm">
                  {uploadClipsStats ? `${uploadClipsStats.current}/${uploadClipsStats.total}` : (uploadClipsProgress > 0 ? `${uploadClipsProgress}%` : '...')}
                </span>
              </div>
            ) : (
              <Plus size={22} className="text-white stroke-[2.5]" />
            )}
          </button>
        </div>
      )}

      {/* Long Press Video Preview Overlay */}
      <LongPressVideoPreviewOverlay
        preview={pickerActivePreview}
        onClose={closePickerPreview}
      />

      {/* Import From Other Projects Modal */}
      <ImportProjectClipsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        db={db}
        activeProject={activeProject}
        activeClips={activeClips}
        updateProjectClips={updateProjectClips}
        insertTargetClipIndex={insertTargetClipIndex}
        replaceTargetClipIndex={replaceTargetClipIndex}
        variantTargetClipIndex={variantTargetClipIndex}
        showToast={showToast}
        onTakeFullClip={onTakeFullClip}
        onTakeSingleClip={onTakeSingleClip}
      />
    </div>
  );
};
