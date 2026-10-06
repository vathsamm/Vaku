import React, { useState, useMemo } from 'react';
import { 
  Sparkles, Check, Clock, X, Trash2, ArrowRight, Play, Wand2, 
  RefreshCw, AlertCircle, Film, ExternalLink, Layers, Plus, RotateCcw, Maximize2, Bookmark, Calendar,
  Volume2, VolumeX, FolderInput
} from 'lucide-react';
import { HiggsfieldJob, VideoEditorClip, DB, VideoEditorProject } from '../../../types';
import { TimelineClipsVaultView } from './TimelineClipsVaultView';

export interface RoundAiGenerateButtonProps {
  jobs: HiggsfieldJob[];
  onClick: () => void;
  isOpen?: boolean;
}

/**
 * Round AI Generate Button:
 * - Circular round button with vibrant AI gradient
 * - Outside revolving animation (rotating glowing multi-color ring) when generating
 * - Red notification badge showing ONLY how many unreviewed clips are waiting
 * - Disappears completely when all clips are reviewed
 */
export const RoundAiGenerateButton: React.FC<RoundAiGenerateButtonProps> = ({
  jobs,
  onClick,
  isOpen = false,
}) => {
  const activeJobs = jobs.filter(j => j.status === 'processing' || j.status === 'pending');
  // ONLY unreviewed completed clips ready for user decision
  const unreviewedJobs = jobs.filter(j => j.status === 'completed');
  const unreviewedCount = unreviewedJobs.length;
  const hasRunning = activeJobs.length > 0;
  const latestRunning = activeJobs[0];

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer revolving ring: revolves around the round button when generating */}
      {hasRunning && (
        <div className="absolute -inset-1.5 rounded-full pointer-events-none z-10 flex items-center justify-center">
          <div 
            className="w-full h-full rounded-full border-2 border-transparent border-t-amber-400 border-r-purple-400 border-b-pink-500 animate-spin" 
            style={{ animationDuration: '1.1s' }}
          />
          <div 
            className="absolute -inset-0.5 rounded-full border border-amber-300/30 animate-pulse" 
          />
        </div>
      )}

      {/* Main ROUND Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`group relative w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-full flex flex-col items-center justify-center transition-all duration-200 active:scale-90 cursor-pointer select-none shadow-xl ${
          hasRunning
            ? 'bg-gradient-to-tr from-purple-950 via-purple-900 to-indigo-950 border-2 border-purple-400 text-white shadow-[0_0_16px_rgba(168,85,247,0.7)]'
            : unreviewedCount > 0
            ? 'bg-gradient-to-tr from-purple-700 via-pink-600 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 border border-purple-300/70 text-white shadow-[0_0_12px_rgba(168,85,247,0.5)]'
            : 'bg-gradient-to-tr from-gray-900 via-purple-950 to-gray-900 hover:from-purple-900 hover:to-indigo-900 border border-purple-500/50 hover:border-purple-400 text-purple-200 hover:text-white'
        }`}
        title={`AI Video (Flux Video Edit 3.0): ${
          hasRunning 
            ? `${latestRunning?.progress || 0}% revolving & rendering... Click to view details` 
            : unreviewedCount > 0
            ? `${unreviewedCount} unreviewed AI video${unreviewedCount > 1 ? 's' : ''} ready! Click to review`
            : 'AI Video Gallery (Flux Video Edit 3.0)'
        }`}
        aria-label="AI Video Generation"
      >
        {hasRunning ? (
          <div className="flex flex-col items-center justify-center leading-none">
            <Sparkles size={11} className="text-amber-300 animate-pulse" />
            <span className="text-[7.5px] font-mono font-black text-amber-300 mt-0.5">
              {latestRunning.progress || 0}%
            </span>
          </div>
        ) : (
          <Sparkles 
            size={15} 
            className={`transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12 ${
              unreviewedCount > 0 ? "text-amber-300 drop-shadow" : "text-purple-300"
            }`} 
          />
        )}

        {/* RED notification badge showing ONLY how many unreviewed clips are waiting */}
        {unreviewedCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-mono font-black text-[9px] flex items-center justify-center border-2 border-gray-950 shadow-[0_0_8px_rgba(239,68,68,0.85)] animate-in zoom-in-75 duration-200"
            title={`${unreviewedCount} unreviewed clip${unreviewedCount > 1 ? 's' : ''} awaiting action`}
          >
            {unreviewedCount}
          </span>
        )}

        {/* Indicator when running and no completed unreviewed jobs */}
        {hasRunning && unreviewedCount === 0 && (
          <span 
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-gray-950 flex items-center justify-center animate-pulse"
            title="Rendering in progress"
          >
            <span className="w-1 h-1 rounded-full bg-black" />
          </span>
        )}
      </button>
    </div>
  );
};

export interface TopAiVideoBubbleProps {
  jobs: HiggsfieldJob[];
  onOpenTray: () => void;
  isOpen?: boolean;
}

/**
 * Backward-compatible alias for round button
 */
export const TopAiVideoBubble: React.FC<TopAiVideoBubbleProps> = ({ jobs, onOpenTray, isOpen }) => {
  return <RoundAiGenerateButton jobs={jobs} onClick={onOpenTray} isOpen={isOpen} />;
};

export interface OutsideAiVideoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: HiggsfieldJob[];
  activeClips?: VideoEditorClip[];
  onSelectJobForReview: (job: HiggsfieldJob) => void;
  onOpenAiPromptMode: (clipIndex?: number) => void;
  onTrashJob?: (job: HiggsfieldJob) => Promise<void>;
  onRestoreJob?: (job: HiggsfieldJob) => Promise<void>;
  onDeleteAndReplace?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  onReplaceKeepVariant?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  onAddToTimeline?: (job: HiggsfieldJob) => void;
  onDirectlySave?: (job: HiggsfieldJob) => void;
  onApplyTake?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  onSwitchVariant?: (clipIdx: number, variantIdx: number) => void;
  onSwitchVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateVariantGroup?: (clipIdx: number, mode?: 'empty_ai' | 'upload' | 'picker') => void;
  onDeleteVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onDeleteClipVariant?: (clipIdx: number, variantIdx: number) => void;
  onDeleteSpecificClip?: (clipIdx: number) => void;
  onInitiateReplaceClip?: (clipIdx: number) => void;
  onSelectClipIndex?: (clipIdx: number) => void;
  targetClipIndex?: number;
  totalClipsCount?: number;
  db?: DB;
  activeProject?: VideoEditorProject | null;
  masterBucketName?: string;
  updateProjectClips?: (clips: VideoEditorClip[], history?: boolean) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  initialCompartment?: 'review' | 'clips' | 'trash';
  onOpenPickerForVariant?: (clipIdx: number) => void;
  onTakeFullClip?: (sourceClip: VideoEditorClip) => void;
  onTakeSingleClip?: (singleClip: VideoEditorClip) => void;
  onTakeVariantGroup?: (grp: { id?: string; label?: string; clips: VideoEditorClip[] }) => void;
}

interface DateGroup {
  dateKey: string;
  dateLabel: string;
  jobs: HiggsfieldJob[];
}

const formatDateGroup = (ts?: number): string => {
  if (!ts) return 'Recent';
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Outside AI Video Drawer / Gallery
 * Features:
 * - 3 Compartments: Review, Clips (renamed from Added), Trash
 * - In "Clips" compartment: Export-style vertical scroll of all timeline clips with connected vertical dots
 * - Horizontal scroll of each clip's active take, variants, and AI takes
 * - Top numbered boxes [1] [2] [3]... for quick instant jumping
 * - Real-time Replace, Delete, Use Take, Delete Variant controls
 * - No filter bar and no top-right "+ New" button as requested
 */
export const OutsideAiVideoDrawer: React.FC<OutsideAiVideoDrawerProps> = ({
  isOpen,
  onClose,
  jobs,
  activeClips = [],
  onSelectJobForReview,
  onOpenAiPromptMode,
  onTrashJob,
  onRestoreJob,
  onDeleteAndReplace,
  onReplaceKeepVariant,
  onAddToTimeline,
  onDirectlySave,
  onApplyTake,
  onSwitchVariant,
  onSwitchVariantGroup,
  onCreateVariantGroup,
  onDeleteVariantGroup,
  onDeleteClipVariant,
  onDeleteSpecificClip,
  onInitiateReplaceClip,
  onSelectClipIndex,
  targetClipIndex = 0,
  totalClipsCount = 1,
  db,
  activeProject,
  masterBucketName,
  updateProjectClips,
  showToast,
  initialCompartment,
  onOpenPickerForVariant,
  onTakeFullClip,
  onTakeSingleClip,
  onTakeVariantGroup,
}) => {
  const [activeCompartment, setActiveCompartment] = useState<'review' | 'clips' | 'trash'>(initialCompartment || 'clips');
  const [selectedJob, setSelectedJob] = useState<HiggsfieldJob | null>(null);
  const [previewingJob, setPreviewingJob] = useState<HiggsfieldJob | null>(null);
  const [previewingClipInfo, setPreviewingClipInfo] = useState<{
    title: string;
    url: string;
    clipIndex: number;
    variantIndex?: number;
    isVariant?: boolean;
    isActive?: boolean;
  } | null>(null);
  const [selectedNavClipIdx, setSelectedNavClipIdx] = useState<number | null>(null);
  const [draggingJob, setDraggingJob] = useState<HiggsfieldJob | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Separate jobs by compartment
  const reviewJobs = useMemo(() => jobs.filter(j => j.status === 'completed' || j.status === 'processing' || j.status === 'pending'), [jobs]);
  const addedJobs = useMemo(() => jobs.filter(j => j.status === 'added'), [jobs]);
  const trashJobs = useMemo(() => jobs.filter(j => j.status === 'trashed' || j.status === 'failed'), [jobs]);

  // Sync selectedNavClipIdx with targetClipIndex
  React.useEffect(() => {
    if (targetClipIndex !== undefined && targetClipIndex >= 0) {
      setSelectedNavClipIdx(targetClipIndex);
    }
  }, [targetClipIndex]);

  // If there is any review open review tab, if no review then open variant (clips) tab directly
  React.useEffect(() => {
    if (isOpen) {
      if (initialCompartment) {
        setActiveCompartment(initialCompartment);
      } else {
        const hasUnreviewed = reviewJobs.length > 0;
        setActiveCompartment(hasUnreviewed ? 'review' : 'clips');
      }
    }
  }, [isOpen, initialCompartment, reviewJobs.length]);

  // Long press timer ref for preview popup
  const longPressTimerRef = React.useRef<any>(null);
  const isLongPressActiveRef = React.useRef<boolean>(false);
  const [longPressPreviewJob, setLongPressPreviewJob] = useState<HiggsfieldJob | null>(null);

  const currentList = 
    activeCompartment === 'review' ? reviewJobs :
    activeCompartment === 'clips' ? addedJobs : trashJobs;

  // Group by creation date, sorted newest first for review and trash
  const dateGroups = useMemo((): DateGroup[] => {
    const map = new Map<string, DateGroup>();
    const sorted = [...currentList].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    sorted.forEach(job => {
      const ts = job.createdAt || Date.now();
      const label = formatDateGroup(ts);
      const dateKey = new Date(ts).toDateString();
      if (!map.has(dateKey)) {
        map.set(dateKey, { dateKey, dateLabel: label, jobs: [] });
      }
      map.get(dateKey)!.jobs.push(job);
    });
    return Array.from(map.values());
  }, [currentList]);

  // Available clip indices with counts in Added
  const addedClipIndices = useMemo(() => {
    const counts = new Map<number, number>();
    addedJobs.forEach(j => {
      const idx = j.clipIndex ?? 0;
      counts.set(idx, (counts.get(idx) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  }, [addedJobs]);

  if (!isOpen) return null;

  const handleStartLongPress = (job: HiggsfieldJob) => {
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setLongPressPreviewJob(job);
      setSelectedJob(job);
    }, 400);
  };

  const handleEndLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isLongPressActiveRef.current) {
      setLongPressPreviewJob(null);
    }
  };

  const handleExecuteAction = async (action: 'save' | 'replace' | 'variant' | 'timeline' | 'trash' | 'restore' | 'apply_take', job: HiggsfieldJob) => {
    const jobClipIdx = job.clipIndex ?? targetClipIndex;

    if (action === 'save') {
      if (onDirectlySave) {
        onDirectlySave(job);
      }
      setSelectedJob(null);
      // Instantly switch view to clips section so user sees the newly saved clip in that clip's vault
      setActiveCompartment('clips');
      setSelectedNavClipIdx(jobClipIdx);
    } else if (action === 'apply_take') {
      if (onApplyTake) {
        onApplyTake(job, jobClipIdx);
      } else if (onReplaceKeepVariant) {
        onReplaceKeepVariant(job, jobClipIdx);
      }
      setSelectedJob(null);
      onClose();
    } else if (action === 'replace') {
      if (onDeleteAndReplace) {
        onDeleteAndReplace(job, jobClipIdx);
      } else {
        onSelectJobForReview(job);
      }
      setSelectedJob(null);
      onClose();
    } else if (action === 'variant') {
      if (onReplaceKeepVariant) {
        onReplaceKeepVariant(job, jobClipIdx);
      }
      setSelectedJob(null);
      onClose();
    } else if (action === 'timeline') {
      if (onAddToTimeline) {
        onAddToTimeline(job);
      }
      setSelectedJob(null);
      onClose();
    } else if (action === 'trash') {
      if (onTrashJob) {
        await onTrashJob(job);
      }
      setSelectedJob(null);
    } else if (action === 'restore') {
      if (onRestoreJob) {
        await onRestoreJob(job);
      }
      setSelectedJob(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end animate-in fade-in duration-150 select-none">
      {/* Darkened backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity" 
      />

      {/* Outside Bar Panel on complete different page layer */}
      <aside 
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm sm:max-w-md h-full bg-gray-950/98 border-l border-purple-500/50 shadow-2xl flex flex-col text-white backdrop-blur-2xl animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Header: Title & Close Button (No + New button) */}
        <div className="p-3 sm:p-4 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 bg-gray-950">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-950/80 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
              <Sparkles size={16} className="text-amber-300" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-white truncate">AI Video Gallery</h3>
              <p className="text-[10px] text-purple-300 font-mono">
                {activeCompartment === 'clips' ? 'Timeline Clips & Variants' : activeCompartment === 'review' ? 'Generations Review' : 'Trash Archive'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeCompartment === 'clips' && (
              <>
                {/* Audio Mute/Unmute Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsAudioMuted(prev => !prev)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                    !isAudioMuted
                      ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                      : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                  }`}
                  title={isAudioMuted ? "Unmute preview sound" : "Mute preview sound"}
                >
                  {isAudioMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>

                {/* Import Icon Button (Just one icon, no text) */}
                <button
                  type="button"
                  onClick={() => setShowImportModal(true)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 hover:text-amber-300 flex items-center justify-center transition cursor-pointer active:scale-95 shadow-xs"
                  title="Import clips from other projects or buckets"
                >
                  <FolderInput size={15} className="stroke-[2.5]" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-850 flex items-center justify-center transition cursor-pointer active:scale-95"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* TOP COMPARTMENTS: Review | Clips | Trash */}
        <div className="p-2 bg-gray-950 border-b border-gray-850 flex items-center gap-1.5 shrink-0">
          {/* Compartment 1: Review */}
          <button
            type="button"
            onClick={() => { setActiveCompartment('review'); setSelectedJob(null); }}
            onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('comp-review'); }}
            onDragLeave={() => setActiveDropTarget(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setActiveDropTarget(null);
              if (draggingJob && draggingJob.status === 'trashed' && onRestoreJob) {
                await onRestoreJob(draggingJob);
              }
              setActiveCompartment('review');
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDropTarget === 'comp-review'
                ? 'bg-purple-500 ring-2 ring-white scale-105 text-white'
                : activeCompartment === 'review'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <span>Review</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeCompartment === 'review' 
                ? (reviewJobs.filter(j => j.status === 'completed').length > 0 ? 'bg-red-600 text-white' : 'bg-purple-900 text-purple-200')
                : 'bg-black/50 text-gray-400'
            }`}>
              {reviewJobs.length}
            </span>
          </button>

          {/* Compartment 2: Clips (Changed from Added to Clips!) */}
          <button
            type="button"
            onClick={() => { setActiveCompartment('clips'); setSelectedJob(null); }}
            onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('comp-clips'); }}
            onDragLeave={() => setActiveDropTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              setActiveDropTarget(null);
              if (draggingJob) {
                handleExecuteAction('save', draggingJob);
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDropTarget === 'comp-clips'
                ? 'bg-purple-500 ring-2 ring-white scale-105 text-white'
                : activeCompartment === 'clips'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <span>Variant</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeCompartment === 'clips' ? 'bg-purple-900 text-purple-200' : 'bg-black/50 text-gray-400'
            }`}>
              {activeClips.length}
            </span>
          </button>

          {/* Compartment 3: Trash */}
          <button
            type="button"
            onClick={() => { setActiveCompartment('trash'); setSelectedJob(null); }}
            onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('comp-trash'); }}
            onDragLeave={() => setActiveDropTarget(null)}
            onDrop={async (e) => {
              e.preventDefault();
              setActiveDropTarget(null);
              if (draggingJob && draggingJob.status !== 'trashed' && onTrashJob) {
                await onTrashJob(draggingJob);
                setActiveCompartment('trash');
              }
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeDropTarget === 'comp-trash'
                ? 'bg-rose-500 ring-2 ring-white scale-105 text-white'
                : activeCompartment === 'trash'
                ? 'bg-rose-600 text-white shadow-md'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850'
            }`}
          >
            <span>Trash</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeCompartment === 'trash' ? 'bg-rose-900 text-rose-200' : 'bg-black/50 text-gray-400'
            }`}>
              {trashJobs.length}
            </span>
          </button>
        </div>

        {/* COMPARTMENT BODY */}
        {activeCompartment === 'clips' ? (
          <TimelineClipsVaultView
            activeClips={activeClips}
            targetClipIndex={targetClipIndex}
            jobs={jobs}
            db={db}
            activeProject={activeProject}
            masterBucketName={masterBucketName}
            updateProjectClips={updateProjectClips}
            onSelectClipIndex={onSelectClipIndex}
            onSwitchVariant={onSwitchVariant}
            onSwitchVariantGroup={onSwitchVariantGroup}
            onCreateVariantGroup={onCreateVariantGroup}
            onDeleteVariantGroup={onDeleteVariantGroup}
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
            onOpenPickerForVariant={onOpenPickerForVariant}
            onTakeFullClip={onTakeFullClip}
            onTakeSingleClip={onTakeSingleClip}
            onTakeVariantGroup={onTakeVariantGroup}
          />
        ) : (
          /* REVIEW AND TRASH COMPARTMENTS (NO FILTER BAR) */
          <div className="flex-1 overflow-y-auto p-2 sm:p-2.5 no-scrollbar">
            {currentList.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                  <Film size={22} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-200">
                    {activeCompartment === 'review' ? 'No AI Videos Ready to Review' : 'Trash Folder is Empty'}
                  </p>
                  <p className="text-xs text-gray-500 max-w-[240px] mx-auto">
                    {activeCompartment === 'review'
                      ? 'Generate new AI clips from your timeline to see them here.'
                      : 'Deleted or failed clips will be archived here.'}
                  </p>
                </div>
                {activeCompartment === 'review' && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAiPromptMode();
                    }}
                    className="mt-2 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition active:scale-95 shadow cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    <span>Start AI Video Edit</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {dateGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-1.5">
                    {/* Clean Date Section Header */}
                    <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                      <Calendar size={10} className="text-purple-400 shrink-0" />
                      <span>{group.dateLabel}</span>
                      <span className="text-[8.5px] font-mono text-gray-500">({group.jobs.length})</span>
                      <div className="flex-1 h-px bg-gray-800/80 ml-1" />
                    </div>

                    {/* 3 IN A ROW GRID */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {group.jobs.map((job) => {
                        const isProcessing = job.status === 'processing' || job.status === 'pending';
                        const isSelected = selectedJob?.id === job.id;
                        const jobClipIdx = job.clipIndex ?? 0;

                        return (
                          <div
                            key={job.id}
                            draggable={Boolean(job.video_url)}
                            onDragStart={(e) => {
                              setDraggingJob(job);
                              setSelectedJob(job);
                              e.dataTransfer.setData('application/json', JSON.stringify(job));
                              e.dataTransfer.setData('text/plain', job.video_url || '');
                            }}
                            onDragEnd={() => {
                              setDraggingJob(null);
                              setActiveDropTarget(null);
                            }}
                            onPointerDown={() => handleStartLongPress(job)}
                            onPointerUp={handleEndLongPress}
                            onPointerCancel={handleEndLongPress}
                            onClick={() => {
                              if (!isLongPressActiveRef.current) {
                                setSelectedJob(job);
                                if (job.video_url) {
                                  setPreviewingJob(job);
                                }
                              }
                            }}
                            className={`relative aspect-[9/16] rounded-xl overflow-hidden bg-black border transition-all cursor-pointer group shadow-md select-none flex flex-col justify-between ${
                              isSelected
                                ? 'ring-2 ring-purple-400 border-purple-400 shadow-purple-900/60 scale-[0.98]'
                                : 'border-gray-800 hover:border-purple-500/70'
                            }`}
                          >
                            {/* Video preview / thumbnail */}
                            {job.video_url ? (
                              <video
                                src={job.video_url}
                                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-gray-500 p-1">
                                <Film size={20} className="text-gray-600 mb-1" />
                                <span className="text-[8px] font-mono text-gray-500">Processing</span>
                              </div>
                            )}

                            {/* Top status & Clip target badge */}
                            <div className="relative z-10 p-1 flex items-center justify-between pointer-events-none">
                              <span className="px-1 py-0.2 rounded bg-black/80 backdrop-blur-xs text-[7px] font-mono font-bold text-purple-300 uppercase border border-white/10 shadow">
                                #{jobClipIdx + 1}
                              </span>

                              {job.status === 'completed' ? (
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-black flex items-center justify-center text-[8px] font-black shadow">
                                  ✓
                                </span>
                              ) : job.status === 'added' ? (
                                <span className="px-1 py-0.2 rounded bg-purple-600 text-white text-[7px] font-black uppercase shadow">
                                  Take
                                </span>
                              ) : job.status === 'trashed' ? (
                                <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] font-bold shadow">
                                  ✕
                                </span>
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                              )}
                            </div>

                            {/* Rendering Progress on Card */}
                            {isProcessing && (
                              <div className="relative z-10 px-1.5 py-1 bg-black/85 backdrop-blur-xs m-1 rounded border border-purple-500/40 space-y-0.5">
                                <div className="w-full bg-black h-1 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all duration-300"
                                    style={{ width: `${Math.max(10, job.progress)}%` }}
                                  />
                                </div>
                                <div className="text-[7.5px] font-mono text-amber-300 text-center truncate">
                                  {job.progress}%
                                </div>
                              </div>
                            )}

                            {/* Center play icon overlay on hover */}
                            {job.video_url && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewingJob(job);
                                }}
                                className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                                title="Click to preview video"
                              >
                                <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                                  <Play size={12} className="fill-white translate-x-0.5" />
                                </div>
                              </div>
                            )}

                            {/* Bottom Prompt & Duration Overlay */}
                            <div className="relative z-10 p-1.5 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none flex flex-col gap-0.5">
                              <p className="text-[8.5px] font-semibold text-white line-clamp-1 leading-tight drop-shadow-sm">
                                &ldquo;{job.prompt}&rdquo;
                              </p>
                              <div className="flex items-center justify-between text-[7.5px] text-gray-400 font-mono">
                                <span>{job.duration ? `${job.duration.toFixed(1)}s` : '5s'}</span>
                                {isSelected && (
                                  <span className="text-purple-300 font-bold">Selected</span>
                                )}
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
        )}

        {/* BOTTOM POP-UP ACTION BAR WITH CONTEXT-AWARE 4 BUTTONS */}
        {(selectedJob || draggingJob) && (() => {
          const target = selectedJob || draggingJob!;
          const targetIdx = target.clipIndex ?? targetClipIndex;
          const isAddedMode = activeCompartment === 'clips';
          const isTrashMode = activeCompartment === 'trash';

          return (
            <div className="p-2 sm:p-2.5 bg-gray-950 border-t border-purple-500/50 shadow-2xl flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-150 shrink-0">
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-[10.5px] font-bold text-purple-200 truncate flex items-center gap-1 max-w-[200px]">
                  <Sparkles size={11} className="text-amber-400 shrink-0" />
                  <span className="truncate">Clip #{targetIdx + 1}: &ldquo;{target.prompt}&rdquo;</span>
                </span>
                <span className="text-[9px] text-gray-400 font-mono">
                  {draggingJob ? 'Drop into action' : 'Choose option'}
                </span>
              </div>

              {/* 4 CONTEXTUAL ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-1.5">
                {isAddedMode ? (
                  <>
                    {/* BUTTON 1 (Added Mode): USE AS ACTIVE TAKE ON THIS CLIP */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('apply_take', target)}
                      className="px-2 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95 shadow-purple-950/60"
                      title={`Make this variant the active playing take for Clip #${targetIdx + 1}`}
                    >
                      <Sparkles size={13} className="text-amber-300" />
                      <span className="truncate">Use as Active Take</span>
                    </button>

                    {/* BUTTON 2 (Added Mode): DELETE AND REPLACE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('replace', target)}
                      className="px-2 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title={`Replace Clip #${targetIdx + 1} with this video`}
                    >
                      <RefreshCw size={13} />
                      <span className="truncate">Delete & Replace</span>
                    </button>

                    {/* BUTTON 3 (Added Mode): ADD TO TIMELINE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('timeline', target)}
                      className="px-2 py-2 rounded-xl bg-gray-900 hover:bg-gray-850 border border-purple-500/40 text-purple-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Append as a new separate clip on timeline"
                    >
                      <Plus size={13} />
                      <span className="truncate">Add to Timeline</span>
                    </button>

                    {/* BUTTON 4 (Added Mode): TO TRASH */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('trash', target)}
                      className="px-2 py-2 rounded-xl bg-gray-900 hover:bg-rose-950/80 border border-gray-800 hover:border-rose-700/60 font-bold text-xs text-rose-400 flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Move variant to Trash"
                    >
                      <Trash2 size={13} className="text-rose-400" />
                      <span className="truncate">To Trash</span>
                    </button>
                  </>
                ) : isTrashMode ? (
                  <>
                    {/* BUTTON 1 (Trash Mode): RESTORE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('restore', target)}
                      className="px-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Restore back to Review compartment"
                    >
                      <RotateCcw size={13} />
                      <span className="truncate">Restore Clip</span>
                    </button>

                    {/* BUTTON 2 (Trash Mode): DELETE AND REPLACE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('replace', target)}
                      className="px-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Replace clip on timeline"
                    >
                      <RefreshCw size={13} />
                      <span className="truncate">Delete & Replace</span>
                    </button>

                    {/* BUTTON 3 (Trash Mode): ADD TO TIMELINE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('timeline', target)}
                      className="px-2 py-2 rounded-xl bg-gray-900 hover:bg-gray-850 border border-purple-500/40 text-purple-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Append to timeline"
                    >
                      <Plus size={13} />
                      <span className="truncate">Add to Timeline</span>
                    </button>

                    {/* BUTTON 4 (Trash Mode): DIRECTLY SAVE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('save', target)}
                      className="px-2 py-2 rounded-xl bg-gray-900 hover:bg-emerald-950/80 border border-gray-800 hover:border-emerald-600/50 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer active:scale-95"
                      title="Save directly to Added section"
                    >
                      <Bookmark size={13} />
                      <span className="truncate">Directly Save</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* BUTTON 1 (Review Mode): DIRECTLY SAVE TO THIS CLIP'S VAULT */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('save', target)}
                      onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('action-save'); }}
                      onDragLeave={() => setActiveDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setActiveDropTarget(null);
                        handleExecuteAction('save', target);
                      }}
                      className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer ${
                        activeDropTarget === 'action-save'
                          ? 'bg-emerald-500 text-white ring-2 ring-white scale-105'
                          : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-950/60'
                      }`}
                      title={`Save as variant for Clip #${targetIdx + 1} and transfer to Added section`}
                    >
                      <Bookmark size={13} className="text-white fill-white/20" />
                      <span className="truncate">Directly Save</span>
                    </button>

                    {/* BUTTON 2 (Review Mode): DELETE AND REPLACE */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('replace', target)}
                      onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('action-replace'); }}
                      onDragLeave={() => setActiveDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setActiveDropTarget(null);
                        handleExecuteAction('replace', target);
                      }}
                      className={`px-2 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer ${
                        activeDropTarget === 'action-replace'
                          ? 'bg-purple-500 ring-2 ring-white scale-105'
                          : 'bg-purple-600 hover:bg-purple-500 active:scale-95 shadow-purple-950/60'
                      }`}
                      title={`Delete previous clip and replace with this AI version on timeline`}
                    >
                      <RefreshCw size={13} />
                      <span className="truncate">Delete & Replace</span>
                    </button>

                    {/* BUTTON 3 (Review Mode): KEEP AS VARIANT */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('variant', target)}
                      onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('action-variant'); }}
                      onDragLeave={() => setActiveDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setActiveDropTarget(null);
                        handleExecuteAction('variant', target);
                      }}
                      className={`px-2 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer ${
                        activeDropTarget === 'action-variant'
                          ? 'bg-indigo-500 ring-2 ring-white scale-105'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:scale-95'
                      }`}
                      title={`Keep previous clip as variant take (navigable via dots)`}
                    >
                      <Layers size={13} className="text-amber-300" />
                      <span className="truncate">Keep as Variant</span>
                    </button>

                    {/* BUTTON 4 (Review Mode): MOVE TO TRASH */}
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('trash', target)}
                      onDragOver={(e) => { e.preventDefault(); setActiveDropTarget('action-trash'); }}
                      onDragLeave={() => setActiveDropTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setActiveDropTarget(null);
                        handleExecuteAction('trash', target);
                      }}
                      className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer ${
                        activeDropTarget === 'action-trash'
                          ? 'bg-rose-700 text-white ring-2 ring-white scale-105'
                          : 'bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 hover:text-rose-200 active:scale-95'
                      }`}
                      title="Move clip to Trash"
                    >
                      <Trash2 size={13} className="text-rose-400" />
                      <span className="truncate">To Trash</span>
                    </button>
                  </>
                )}
              </div>

              {/* Extra helper: Add to Timeline button if not in added mode */}
              {!isAddedMode && (
                <button
                  type="button"
                  onClick={() => handleExecuteAction('timeline', target)}
                  className="w-full py-1.5 rounded-lg bg-gray-900 hover:bg-gray-850 border border-purple-500/30 text-purple-200 hover:text-white text-[10.5px] font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add to Timeline as New Clip</span>
                </button>
              )}
            </div>
          );
        })()}

        {/* LONG PRESS VIDEO PREVIEW POPUP */}
        {longPressPreviewJob && longPressPreviewJob.video_url && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md pointer-events-none animate-in zoom-in-95 duration-100">
            <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-purple-400 bg-black flex flex-col justify-between">
              <video
                src={longPressPreviewJob.video_url}
                autoPlay
                playsInline
                loop
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="relative z-10 p-2 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-purple-600">
                  Clip #{(longPressPreviewJob.clipIndex ?? 0) + 1}
                </span>
                <span className="text-[10px] text-gray-300 font-mono">
                  {longPressPreviewJob.duration ? `${longPressPreviewJob.duration.toFixed(1)}s` : '5s'}
                </span>
              </div>
              <div className="relative z-10 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
                <p className="text-xs font-bold text-white line-clamp-2">
                  &ldquo;{longPressPreviewJob.prompt}&rdquo;
                </p>
                <p className="text-[9.5px] text-purple-300 mt-1">Release to choose action</p>
              </div>
            </div>
          </div>
        )}

        {/* FULL SCREEN VIDEO PREVIEW MODAL WITH CONTEXT-AWARE 4 BUTTONS */}
        {previewingJob && (() => {
          const pJobClipIdx = previewingJob.clipIndex ?? targetClipIndex;
          const isAddedMode = activeCompartment === 'clips';
          const isTrashMode = activeCompartment === 'trash';

          return (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
              <div 
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-sm bg-gray-950 border border-purple-500/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-2 p-3 text-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-[9px] font-mono font-bold text-purple-300 shrink-0">
                      Clip #{pJobClipIdx + 1}
                    </span>
                    <span className="text-xs font-bold text-purple-200 truncate">
                      &ldquo;{previewingJob.prompt}&rdquo;
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewingJob(null)}
                    className="w-6 h-6 rounded-lg text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                {previewingJob.video_url && (
                  <div className="relative aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-gray-800">
                    <video
                      src={previewingJob.video_url}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* ALL 4 ACTION BUTTONS INSIDE PREVIEW MODAL */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {isAddedMode ? (
                    <>
                      {/* BUTTON 1 (Added): USE AS ACTIVE TAKE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('apply_take', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                        title={`Make this the active playing take for Clip #${pJobClipIdx + 1}`}
                      >
                        <Sparkles size={13} className="text-amber-300" />
                        <span>Use as Active Take</span>
                      </button>

                      {/* BUTTON 2 (Added): DELETE AND REPLACE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('replace', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 font-bold text-xs text-purple-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Delete previous clip and replace"
                      >
                        <RefreshCw size={13} />
                        <span>Delete & Replace</span>
                      </button>

                      {/* BUTTON 3 (Added): ADD TO TIMELINE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('timeline', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-850 border border-purple-500/40 font-bold text-xs text-purple-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Add as new clip on timeline"
                      >
                        <Plus size={13} />
                        <span>Add to Timeline</span>
                      </button>

                      {/* BUTTON 4 (Added): TO TRASH */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('trash', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gray-900 hover:bg-rose-950/80 border border-gray-800 hover:border-rose-700/60 font-bold text-xs text-rose-400 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                        title="Move variant to Trash"
                      >
                        <Trash2 size={13} className="text-rose-400" />
                        <span>To Trash</span>
                      </button>
                    </>
                  ) : isTrashMode ? (
                    <>
                      {/* BUTTON 1 (Trash): RESTORE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('restore', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                        title="Restore to Review"
                      >
                        <RotateCcw size={13} />
                        <span>Restore Clip</span>
                      </button>

                      {/* BUTTON 2 (Trash): DELETE AND REPLACE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('replace', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                        title="Replace clip on timeline"
                      >
                        <RefreshCw size={13} />
                        <span>Delete & Replace</span>
                      </button>

                      {/* BUTTON 3 (Trash): ADD TO TIMELINE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('timeline', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-850 border border-purple-500/40 font-bold text-xs text-purple-200 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Add to timeline"
                      >
                        <Plus size={13} />
                        <span>Add to Timeline</span>
                      </button>

                      {/* BUTTON 4 (Trash): DIRECTLY SAVE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('save', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gray-900 hover:bg-emerald-950/80 border border-gray-800 hover:border-emerald-600/50 font-bold text-xs text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Save to Added section"
                      >
                        <Bookmark size={13} />
                        <span>Directly Save</span>
                      </button>
                    </>
                  ) : (
                    <>
                      {/* BUTTON 1 (Review): DIRECTLY SAVE (PUSH TO ADDED SECTION) */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('save', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-emerald-950/60"
                        title={`Save as variant for Clip #${pJobClipIdx + 1} and transfer to Added section`}
                      >
                        <Bookmark size={13} className="text-white fill-white/20" />
                        <span>Directly Save</span>
                      </button>

                      {/* BUTTON 2 (Review): DELETE AND REPLACE */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('replace', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-purple-950/60"
                        title="Delete previous clip and replace"
                      >
                        <RefreshCw size={13} />
                        <span>Delete & Replace</span>
                      </button>

                      {/* BUTTON 3 (Review): KEEP AS VARIANT */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('variant', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 font-bold text-xs text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-md"
                        title="Keep previous take as variant dots"
                      >
                        <Layers size={13} className="text-amber-300" />
                        <span>Keep as Variant</span>
                      </button>

                      {/* BUTTON 4 (Review): TO TRASH */}
                      <button
                        type="button"
                        onClick={() => {
                          handleExecuteAction('trash', previewingJob);
                          setPreviewingJob(null);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-gray-900 hover:bg-rose-950/80 border border-gray-800 hover:border-rose-700/60 font-bold text-xs text-rose-400 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                        title="Move clip to Trash"
                      >
                        <Trash2 size={13} className="text-rose-400" />
                        <span>To Trash</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* FULL SCREEN VIDEO PREVIEW MODAL FOR CLIPS & VARIANTS */}
        {previewingClipInfo && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
            <div 
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-gray-950 border border-purple-500/60 rounded-2xl overflow-hidden shadow-2xl flex flex-col gap-2.5 p-3 text-white"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-[9px] font-mono font-bold text-purple-300 shrink-0">
                    Clip #{previewingClipInfo.clipIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {previewingClipInfo.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewingClipInfo(null)}
                  className="w-6 h-6 rounded-lg text-gray-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {previewingClipInfo.url && (
                <div className="relative aspect-[9/16] max-h-[50vh] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-gray-800">
                  <video
                    src={previewingClipInfo.url}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* ACTION BUTTONS FOR PREVIEWED CLIP / VARIANT */}
              <div className="flex items-center gap-2 pt-1">
                {previewingClipInfo.isVariant && !previewingClipInfo.isActive && onSwitchVariant && (
                  <button
                    type="button"
                    onClick={() => {
                      onSwitchVariant(previewingClipInfo.clipIndex, previewingClipInfo.variantIndex ?? 0);
                      setPreviewingClipInfo(null);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                  >
                    <Sparkles size={13} className="text-amber-300" />
                    <span>Use as Active Take</span>
                  </button>
                )}

                {previewingClipInfo.isVariant && onDeleteClipVariant && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteClipVariant(previewingClipInfo.clipIndex, previewingClipInfo.variantIndex ?? 0);
                      setPreviewingClipInfo(null);
                    }}
                    className="py-2 px-3 rounded-xl bg-gray-900 hover:bg-rose-950 border border-gray-800 hover:border-rose-700 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 size={13} />
                    <span>Delete Take</span>
                  </button>
                )}

                {previewingClipInfo.isActive && (
                  <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5">
                    <Check size={14} className="text-emerald-400 stroke-[3]" />
                    <span>Currently Active on Timeline</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export interface HiggsfieldGenerationBubbleProps {
  jobs: HiggsfieldJob[];
  onSelectJobForReview?: (job: HiggsfieldJob) => void;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onOpenAiPromptMode?: () => void;
  onOpenVariantTab?: () => void;
}

/**
 * Backward compatible wrapper component that renders the round AI generate button
 */
export const HiggsfieldGenerationBubble: React.FC<HiggsfieldGenerationBubbleProps> = ({
  jobs,
  isOpen,
  setIsOpen,
  onOpenAiPromptMode,
  onOpenVariantTab,
}) => {
  const handleClick = () => {
    const unreviewedCount = jobs.filter(j => j.status === 'completed' || j.status === 'processing' || j.status === 'pending').length;
    if (unreviewedCount > 0) {
      // Open review tab
      setIsOpen(true);
    } else {
      // If there is no review then it should be opening variant tab directly
      if (onOpenVariantTab) {
        onOpenVariantTab();
      } else {
        setIsOpen(true);
      }
    }
  };

  return (
    <RoundAiGenerateButton
      jobs={jobs}
      onClick={handleClick}
      isOpen={isOpen}
    />
  );
};
