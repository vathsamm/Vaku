import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Loader2, Film, UploadCloud, FolderInput, Layers, X, RefreshCw, ChevronRight, Plus 
} from 'lucide-react';
import { 
  DB, VideoData, FolderData, VideoEditorClip, VideoEditorProject,
  VideoEditorCaption, VideoEditorCaptionTemplate, VideoEditorCaptionDefault, AudioItem, VideoEditorAudioClip,
  VideoEditorTitleTemplate, isAiBucket, isAnyBucket, HiggsfieldJob, getClipVariantGroups
} from '../types';
import { useUltraDataSaver } from '../utils/dataSaver';
import { getCachedVideoBlobUrl, getMemoryBlobUrl, getExistingLocalBlobUrl, getLocalClipBlob, normalizeClipKey } from '../utils/videoBlobCache';
import { renderVideoOnDevice } from '../utils/mobileVideoRenderer';
import { AudioLibraryModal } from './AudioLibraryModal';
import { ExportGenerationHistoryModal } from './ExportGenerationHistoryModal';
import { SocialShareModal } from './SocialShareModal';
import { ImportProjectModal } from './ImportProjectModal';
import { ImportBucketSettingsModal } from './ImportBucketSettingsModal';
import { BucketSettingsModal } from './BucketSettingsModal';
import { useLongPressPreview } from '../utils/useLongPressPreview';
import {
  CAPTION_FONTS,
  CAPTION_TEXT_COLORS,
  CAPTION_PALETTES,
  CAPTION_STROKE_COLORS,
  DEFAULT_TITLE_PROMPT,
  EditorHeader,
  EditorBottomToolbar,
  VideoPreviewStage,
  TimelineSection,
  InlineLiveControlStrip,
  EditorEmptyProjectSetup,
  ClipPickerModal,
  EditorCreateProjectModal,
  CombineAudioModal,
  EditorConfirmDialogs,
  ExportModal,
  CaptionStudioModal,
  AiTitleStudioModal,
  ChopStudioModal,
  AiVideoPromptBar,
  GeneratedClipReviewModal,
  OutsideAiVideoDrawer,
  ClipVariantDrawer,
  ImportProjectClipsModal
} from './video-editor';

export {
  CAPTION_FONTS,
  CAPTION_TEXT_COLORS,
  CAPTION_PALETTES,
  CAPTION_STROKE_COLORS
};

interface MobileVideoEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketFid: string;
  masterBucketName: string;
  editorMode: 'general' | 'ai';
  db: DB;
  setDb?: React.Dispatch<React.SetStateAction<DB | null>>;
  onSaveProject: (project: VideoEditorProject) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRenameProject: (projectId: string, newName: string) => Promise<void>;
  onToggleStar: (vid: string) => void;
  onToggleDefault: (vid: string) => void;
  onToggleFreeze?: (vid: string) => void;
  onTogglePinProject?: (projectId: string) => void;
  onMarkClipsUsed?: (vids: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  initialProjectId?: string | null;
  currentUserEmail?: string;
  isAdmin?: boolean;
  usersList?: any[];
  onOpenSettings?: () => void;
}

export const MobileVideoEditorModal: React.FC<MobileVideoEditorModalProps> = ({
  isOpen,
  onClose,
  masterBucketFid,
  masterBucketName,
  editorMode,
  db,
  setDb = () => {},
  onSaveProject,
  onRenameProject,
  onMarkClipsUsed,
  showToast,
  initialProjectId,
  currentUserEmail,
  isAdmin,
  usersList,
  onOpenSettings,
}) => {
  // All buckets belonging to this master bucket (unified: all buckets together, no AI vs General segregation)
  const masterBuckets = useMemo(() => {
    if (!db || !db.folders) return [];
    return Object.entries(db.folders)
      .filter(([id, f]) => {
        if (id === 'root' || db.deleted_folders?.[id]) return false;
        if (f.parent !== masterBucketFid) return false;
        return isAnyBucket(f.name, f);
      })
      .sort((a, b) => {
        const isAiA = isAiBucket(a[1].name, a[1]);
        const isAiB = isAiBucket(b[1].name, b[1]);
        if (isAiA !== isAiB) {
          return isAiA ? 1 : -1;
        }
        const numA = parseInt(a[1].name.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b[1].name.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
  }, [db, masterBucketFid]);

  // Helper to match bucket ID directly, via shared mirror, or child folder hierarchy
  const isProjectInMasterBucket = useCallback((projBucketFid?: string, targetFid?: string): boolean => {
    if (!projBucketFid || !targetFid) return false;
    if (projBucketFid === targetFid) return true;
    if (db?.folders?.[targetFid]?.sharedSourceFid && db.folders[targetFid].sharedSourceFid === projBucketFid) return true;
    if (db?.folders?.[projBucketFid]?.sharedSourceFid && db.folders[projBucketFid].sharedSourceFid === targetFid) return true;
    let cur = db?.folders?.[projBucketFid];
    let depth = 0;
    while (cur && cur.parent && cur.parent !== 'root' && depth < 5) {
      if (cur.parent === targetFid) return true;
      cur = db?.folders?.[cur.parent];
      depth++;
    }
    let tCur = db?.folders?.[targetFid];
    depth = 0;
    while (tCur && tCur.parent && tCur.parent !== 'root' && depth < 5) {
      if (tCur.parent === projBucketFid) return true;
      tCur = db?.folders?.[tCur.parent];
      depth++;
    }
    return false;
  }, [db]);

  // Projects list for THIS Master Bucket (strictly showing ONLY projects created from this master bucket)
  const projects = useMemo(() => {
    if (!db || !db.video_editor_projects) return [];
    return Object.values(db.video_editor_projects)
      .filter(p => isProjectInMasterBucket(p.master_bucket_fid, masterBucketFid))
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const timeA = a.updated_at || a.last_modified || a.created_at || 0;
        const timeB = b.updated_at || b.last_modified || b.created_at || 0;
        return timeB - timeA;
      });
  }, [db, masterBucketFid, isProjectInMasterBucket]);

  // Active Project State
  const [activeProject, setActiveProject] = useState<VideoEditorProject | null>(() => {
    if (initialProjectId && db?.video_editor_projects?.[initialProjectId]) {
      return db.video_editor_projects[initialProjectId];
    }
    return null;
  });
  const activeProjectRef = useRef<VideoEditorProject | null>(activeProject);
  activeProjectRef.current = activeProject;
  const initializedProjectIdRef = useRef<string | null>(null);

  // Comprehensive Undo / Redo history stacks (Tracking clips, captions, typography/timing, audio tracks, and generation jobs)
  interface EditorHistorySnapshot {
    clips: VideoEditorClip[];
    captions: VideoEditorCaption[];
    audio_clips: VideoEditorAudioClip[];
    vault_unused_clips?: VideoEditorClip[];
    audio_id?: string;
    audio_url?: string;
    audio_name?: string;
    audio_duration?: number;
    audio_volume?: number;
    jobs?: HiggsfieldJob[];
  }
  const [undoStack, setUndoStack] = useState<EditorHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorHistorySnapshot[]>([]);

  // Dedicated Separate Space Tracking for Bottom Render Status Bar (Guarantees zero overlap with buttons)
  const [hasBottomRenderBar, setHasBottomRenderBar] = useState<boolean>(() => {
    return typeof document !== 'undefined' && (
      document.documentElement.dataset.hasBottomRenderBar === 'true' ||
      Boolean(document.getElementById('bottom-render-status-dock'))
    );
  });

  useEffect(() => {
    const handleBarVisible = (e: any) => {
      setHasBottomRenderBar(Boolean(e.detail?.visible));
    };
    window.addEventListener('bottom-bar-visible', handleBarVisible);

    const check = () => {
      const el = document.getElementById('bottom-render-status-dock');
      setHasBottomRenderBar(Boolean(el));
    };
    check();
    const interval = setInterval(check, 800);

    return () => {
      window.removeEventListener('bottom-bar-visible', handleBarVisible);
      clearInterval(interval);
    };
  }, []);

  // Editing Project Name inline
  const [isEditingName, setIsEditingName] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');

  // New Project Dialog modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Full-Screen Clip Picker Modal State
  const [showClipPicker, setShowClipPicker] = useState(false);
  const [clipPickerInitialTab, setClipPickerInitialTab] = useState<'uploads' | 'clips'>('uploads');
  const [activePickerBucketIndex, setActivePickerBucketIndex] = useState(0);
  const [selectedClipIdsInPicker, setSelectedClipIdsInPicker] = useState<string[]>([]);
  const [replaceTargetClipIndex, setReplaceTargetClipIndex] = useState<number | null>(null);
  const [insertTargetClipIndex, setInsertTargetClipIndex] = useState<number | null>(null);
  const [variantTargetClipIndex, setVariantTargetClipIndex] = useState<number | null>(null);
  const [showVariantDrawer, setShowVariantDrawer] = useState(false);
  const variantUploadInputRef = useRef<HTMLInputElement | null>(null);
  const createNewVariantGroupOnAddRef = useRef<boolean>(false);
  const [isUploadingVariantClip, setIsUploadingVariantClip] = useState(false);

  // Add Clip Options Modal state (3 partitions: upload section, manual upload, another project + variant)
  const [showAddClipChoiceModal, setShowAddClipChoiceModal] = useState<boolean>(false);
  const [addClipChoiceTargetIndex, setAddClipChoiceTargetIndex] = useState<number | null>(null);

  // Replace Clip Options Modal state (Uploads vs Variant section vs Import vs Cancel)
  const [showReplaceChoiceModal, setShowReplaceChoiceModal] = useState<boolean>(false);
  const [replaceChoiceTargetIndex, setReplaceChoiceTargetIndex] = useState<number | null>(null);

  // Dedicated Import from another project modal for timeline insertion/replacement
  const [showProjectClipsImportModal, setShowProjectClipsImportModal] = useState<boolean>(false);

  // Bucket Orientation & Freeze Settings Modal state
  const [showBucketSettingsModal, setShowBucketSettingsModal] = useState(false);
  // Import Bucket Settings Modal state (Import from other projects in same Master Bucket)
  const [showImportBucketSettingsModal, setShowImportBucketSettingsModal] = useState(false);

  // Higgsfield AI Video Generation (Flux Video Edit 3.0) States
  const [isAiPromptMode, setIsAiPromptMode] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [higgsfieldJobs, setHiggsfieldJobs] = useState<HiggsfieldJob[]>([]);
  const higgsfieldJobsRef = useRef<HiggsfieldJob[]>([]);
  useEffect(() => {
    higgsfieldJobsRef.current = higgsfieldJobs;
  }, [higgsfieldJobs]);
  const [isHiggsfieldTrayOpen, setIsHiggsfieldTrayOpen] = useState(false);
  const [reviewingJob, setReviewingJob] = useState<HiggsfieldJob | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [higgsfieldCredits, setHiggsfieldCredits] = useState(150);

  // Dedicated isolated Uploads folder for this Master Bucket
  const uploadsFid = `uploads_${masterBucketFid}`;
  const [isUploadingClips, setIsUploadingClips] = useState(false);
  const [uploadClipsProgress, setUploadClipsProgress] = useState(0);
  const [uploadClipsStats, setUploadClipsStats] = useState<{ current: number; total: number } | null>(null);
  const pickerUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Long-press to preview video inside bucket clip picker
  const { 
    activePreview: pickerActivePreview, 
    startLongPress: startPickerLongPress, 
    moveLongPress: movePickerLongPress, 
    endLongPress: endPickerLongPress, 
    checkDidLongPress: checkDidPickerLongPress, 
    closePreview: closePickerPreview 
  } = useLongPressPreview();

  const handleUploadVideosToMasterBucket = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const totalFiles = files.length;
    setIsUploadingClips(true);
    setUploadClipsProgress(10);
    setUploadClipsStats({ current: 1, total: totalFiles });
    showToast(`Uploading ${totalFiles} video(s)...`, 'info');

    try {
      if (!db.folders?.[uploadsFid]) {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_folder',
            payload: { id: uploadsFid, name: 'Uploads', parent: masterBucketFid, is_uploads: true }
          })
        });
      }

      for (let i = 0; i < totalFiles; i++) {
        setUploadClipsStats({ current: i + 1, total: totalFiles });
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', uploadsFid);
        formData.append('master_bucket_fid', masterBucketFid);
        formData.append('is_upload', 'true');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.ok && data.video) {
          if (setDb) {
            setDb((prev: any) => ({
              ...prev,
              videos: { ...prev.videos, [data.video.id]: data.video }
            }));
          }
          if (replaceTargetClipIndex !== null && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
            const vDur = typeof data.video.duration === 'number' ? data.video.duration : 4.0;
            const replacedClip: VideoEditorClip = {
              id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              vid: data.video.id,
              url: data.video.url || (data.video.file_id ? `/api/video/${data.video.file_id}` : ''),
              file_id: data.video.file_id || null,
              bucket_id: uploadsFid,
              bucket_name: 'Uploads',
              duration: vDur,
              speed: 1.0,
              scale: 1.0,
              trim_start: 0,
              trim_end: vDur,
              is_muted: false,
              volume: 1.0,
            };
            const updated = [...activeClips];
            updated[replaceTargetClipIndex] = replacedClip;
            updateProjectClips(updated, true);
            setSelectedTimelineClipIndex(replaceTargetClipIndex);
            setCurrentClipIndex(replaceTargetClipIndex);
            setReplaceTargetClipIndex(null);
            setShowClipPicker(false);
            showToast(`Replaced clip #${replaceTargetClipIndex + 1} with uploaded video!`, 'success');
          } else if (insertTargetClipIndex !== null) {
            const vDur = typeof data.video.duration === 'number' ? data.video.duration : 4.0;
            const newClip: VideoEditorClip = {
              id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              vid: data.video.id,
              url: data.video.url || (data.video.file_id ? `/api/video/${data.video.file_id}` : ''),
              file_id: data.video.file_id || null,
              bucket_id: uploadsFid,
              bucket_name: 'Uploads',
              duration: vDur,
              speed: 1.0,
              scale: 1.0,
              trim_start: 0,
              trim_end: vDur,
              is_muted: false,
              volume: 1.0,
            };
            const updated = [...activeClips];
            const insertPos = Math.min(Math.max(0, insertTargetClipIndex), updated.length);
            updated.splice(insertPos, 0, newClip);
            updateProjectClips(updated, true);
            setSelectedTimelineClipIndex(insertPos);
            setCurrentClipIndex(insertPos);
            if (i === totalFiles - 1) {
              setInsertTargetClipIndex(null);
              setShowClipPicker(false);
            } else {
              setInsertTargetClipIndex(insertPos + 1);
            }
            showToast(`Uploaded & inserted clip at position #${insertPos + 1}!`, 'success');
          }
        }
        setUploadClipsProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
      showToast(`Uploaded ${totalFiles} video(s) to Uploads!`, 'success');
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploadingClips(false);
      setUploadClipsProgress(0);
      setUploadClipsStats(null);
      if (e.target) e.target.value = '';
    }
  };

  // Ordered buckets respecting project-level bucket_order strictly per project (Uploads is always first!)
  const orderedMasterBuckets = useMemo(() => {
    const uFolder: FolderData = db?.folders?.[uploadsFid] || {
      name: 'Uploads',
      parent: masterBucketFid,
      is_uploads: true,
      created_at: Date.now(),
    };
    const uploadsTab: [string, FolderData] = [uploadsFid, uFolder];

    let sortedBuckets = [...masterBuckets].filter(([id]) => id !== uploadsFid);
    const customOrder = activeProject?.bucket_order;
    if (customOrder && customOrder.length > 0) {
      const bucketMap = new Map(sortedBuckets.map(b => [b[0], b]));
      const result: [string, FolderData][] = [];
      customOrder.forEach(id => {
        const b = bucketMap.get(id);
        if (b) {
          result.push(b);
          bucketMap.delete(id);
        }
      });
      bucketMap.forEach(b => result.push(b));
      sortedBuckets = result;
    }

    return [uploadsTab, ...sortedBuckets];
  }, [masterBuckets, activeProject?.bucket_order, uploadsFid, db?.folders, masterBucketFid]);

  // Import settings from another project in the SAME master bucket
  const handleImportBucketSettings = (sourceProject: VideoEditorProject, options: {
    importFrozenClips: boolean;
    importDefaultClips: boolean;
    importStarredClips: boolean;
    importBucketOrder: boolean;
    importFrozenBuckets: boolean;
  }) => {
    if (!activeProject) return;

    const updated: VideoEditorProject = {
      ...activeProject,
      project_frozen_vids: options.importFrozenClips 
        ? [...(sourceProject.project_frozen_vids || [])]
        : activeProject.project_frozen_vids,
      project_default_vids: options.importDefaultClips
        ? { ...(sourceProject.project_default_vids || {}) }
        : activeProject.project_default_vids,
      project_starred_vids: options.importStarredClips
        ? [...(sourceProject.project_starred_vids || [])]
        : activeProject.project_starred_vids,
      bucket_order: options.importBucketOrder
        ? (sourceProject.bucket_order ? [...sourceProject.bucket_order] : activeProject.bucket_order)
        : activeProject.bucket_order,
      frozen_bucket_ids: options.importFrozenBuckets
        ? [...(sourceProject.frozen_bucket_ids || [])]
        : activeProject.frozen_bucket_ids,
      updated_at: Date.now()
    };

    setActiveProject(updated);
    onSaveProject(updated);
    showToast(`Imported bucket settings from "${sourceProject.name}"!`, "success");
  };

  // Video Playback Engine State (Seamless Multi-Video Engine)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const { config } = useUltraDataSaver();
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const currentClipIndexRef = useRef(0);
  currentClipIndexRef.current = currentClipIndex;
  const [previousClipIndex, setPreviousClipIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const [clipCurrentTime, setClipCurrentTime] = useState(0);
  const [projectCurrentTime, setProjectCurrentTime] = useState(0);
  const projectCurrentTimeRef = useRef(0);
  const lastStateUpdateTimeRef = useRef(0);
  const lastAudioSyncTimeRef = useRef(0);
  const touchStartScrollRef = useRef<{ clientX: number; scrollLeft: number } | null>(null);
  const lastScrubStateUpdateTimeRef = useRef(0);
  const pendingScrubTimeRef = useRef<{ clipId: string; time: number } | null>(null);
  const isVideoSeekingRef = useRef<boolean>(false);
  const clipTouchStartRef = useRef<{ clientX: number; scrollLeft: number; startX: number; startY: number } | null>(null);
  const didScrubClipRef = useRef<boolean>(false);
  const isMuted = false;
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const lastPreCuedClipIndexRef = useRef<number | null>(null);

  // High-Performance In-Memory & CacheStorage Video Blob Engine
  // Eliminates network latency during multi-clip playback, making clip changes 100% butter-smooth even on 2G / low network
  const [clipBlobUrls, setClipBlobUrls] = useState<Record<string, string>>({});
  const clipBlobUrlsRef = useRef<Record<string, string>>({});
  clipBlobUrlsRef.current = clipBlobUrls;

  // Caption Studio Drawer State (Continuous Template List & Settings View)
  const [showTextDrawer, setShowTextDrawer] = useState<boolean>(false);
  const [captionViewMode, setCaptionViewMode] = useState<'list' | 'settings'>('list');
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<VideoEditorCaptionTemplate | null>(null);
  const [showNewCaptionPrompt, setShowNewCaptionPrompt] = useState<boolean>(false);
  const [newCaptionPromptText, setNewCaptionPromptText] = useState<string>('');
  const [templateProjectActive, setTemplateProjectActive] = useState<boolean>(true);
  const lastCaptionTapRef = useRef<{ id: string; time: number } | null>(null);

  // Modal state for transferring / importing between projects ('caption' | 'audio' | 'title')
  const [importModalType, setImportModalType] = useState<'caption' | 'audio' | 'title' | null>(null);

  // Caption Templates (C1, C2, C3...) - Persisted per Project (Isolated from project to project)
  const [captionTemplates, setCaptionTemplates] = useState<VideoEditorCaptionTemplate[]>(() => {
    let list: VideoEditorCaptionTemplate[] = [];
    if (activeProject && Array.isArray(activeProject.caption_templates) && activeProject.caption_templates.length > 0) {
      list = activeProject.caption_templates;
    } else if (db?.folder_caption_templates?.[masterBucketFid] && db.folder_caption_templates[masterBucketFid].length > 0) {
      list = db.folder_caption_templates[masterBucketFid];
    } else {
      try {
        const stored = localStorage.getItem(`master_caption_templates_${masterBucketFid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
        }
      } catch (_) {}
    }
    return list.map(t => {
      const isAll = t.mode === 'all' || t.mode === 'must' || Boolean(t.is_must);
      return {
        ...t,
        mode: isAll ? 'all' : 'change',
        is_must: isAll,
        for_all_videos: isAll
      };
    });
  });

  // Master Bucket Caption Defaults (Default position above half, default size)
  const [captionDefaults, setCaptionDefaults] = useState<VideoEditorCaptionDefault>(() => {
    let saved: any = null;
    try {
      const s = localStorage.getItem(`master_caption_defaults_${masterBucketFid}`);
      if (s) saved = JSON.parse(s);
    } catch (e) {}
    const dbDef = db?.folder_caption_defaults?.[masterBucketFid];
    const base = saved || dbDef;
    return {
      x_pct: base?.x_pct ?? 50,
      y_pct: base?.y_pct ?? 35, // default above half of video
      font_size: base?.font_size ?? 24,
      is_bold: base?.is_bold ?? true, // Bold weight by default matching viral TikTok headline captions
      font_family: base?.font_family && !base.font_family.includes('system-ui') ? base.font_family : CAPTION_FONTS[0].family,
      color: '#ffffff',
      stroke_color: '#000000',
      clip_rule: base?.clip_rule || 'all'
    };
  });

  // Project-level isolated captions: Hidden vs Available for this active project
  const [newCaptionMode, setNewCaptionMode] = useState<'must' | 'change'>('change');
  const projectHiddenCaptionIds = useMemo(() => new Set(activeProject?.hidden_caption_ids || []), [activeProject?.hidden_caption_ids]);
  const availableCaptionTemplates = useMemo(() => captionTemplates.filter(t => !projectHiddenCaptionIds.has(t.id)), [captionTemplates, projectHiddenCaptionIds]);
  const hiddenCaptionTemplates = useMemo(() => captionTemplates.filter(t => projectHiddenCaptionIds.has(t.id)), [captionTemplates, projectHiddenCaptionIds]);

  // Default Social Reel Title & Hashtags Prompt (imported from ./video-editor)

  // AI Title & Hashtag Templates (Template 1, Template 2...) - Persisted per Project (Isolated from project to project)
  const [titleTemplates, setTitleTemplates] = useState<VideoEditorTitleTemplate[]>(() => {
    if (activeProject && Array.isArray(activeProject.title_templates)) {
      return activeProject.title_templates;
    }
    return [];
  });

  const [showTitleTemplateDrawer, setShowTitleTemplateDrawer] = useState<boolean>(false);
  const [titleViewMode, setTitleViewMode] = useState<'list' | 'detail'>('detail');
  const [selectedTitleTemplateId, setSelectedTitleTemplateId] = useState<string | null>(null);
  const [editingTitleName, setEditingTitleName] = useState<string>('');
  const [editingTitlePrompt, setEditingTitlePrompt] = useState<string>('');
  const [isPromptSaved, setIsPromptSaved] = useState<boolean>(true);
  const [isTestingTitleGen, setIsTestingTitleGen] = useState<boolean>(false);
  const [testTitleResult, setTestTitleResult] = useState<{ title: string; hashtags: string } | null>(null);
  const [titleCopiedType, setTitleCopiedType] = useState<'title' | 'hashtags' | 'all' | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ type: 'title_template' | 'caption_template'; id: string; name: string } | null>(null);

  // Combine / Merge Audio Tracks Modal State
  const [showCombineAudioModal, setShowCombineAudioModal] = useState<boolean>(false);
  const [showChopStudioModal, setShowChopStudioModal] = useState<boolean>(false);
  const [combineAudioName, setCombineAudioName] = useState<string>('');
  const [combineFolderId, setCombineFolderId] = useState<string>('root');
  const [isCreatingNewCombineFolder, setIsCreatingNewCombineFolder] = useState<boolean>(false);
  const [newCombineFolderName, setNewCombineFolderName] = useState<string>('');
  const [isCombiningAudios, setIsCombiningAudios] = useState<boolean>(false);

  // Auto-Assemble Confirmation Modal State
  const [showAutoConfirmModal, setShowAutoConfirmModal] = useState<boolean>(false);

  // GPU / CPU Mode Switch Confirmation Modal State
  const [showGpuCpuConfirmModal, setShowGpuCpuConfirmModal] = useState<boolean>(false);

  // Clip Audio Mute State & Long-Press Mute All Modal
  const [showMuteAllClipsModal, setShowMuteAllClipsModal] = useState<boolean>(false);
  const clipAudioLongPressTimerRef = useRef<any>(null);
  const clipAudioLongPressTriggeredRef = useRef<boolean>(false);

  // Active Title Template for current project (project default if set, else first)
  const activeTitleTemplate = useMemo(() => {
    if (activeProject?.active_title_template_id) {
      const found = titleTemplates.find(t => t.id === activeProject.active_title_template_id);
      if (found) return found;
    }
    const active = titleTemplates.find(t => t.is_active);
    if (active) return active;
    return titleTemplates[0] || null;
  }, [activeProject?.active_title_template_id, titleTemplates]);

  // Synchronize caption templates with the active project & master bucket
  useEffect(() => {
    if (activeProject) {
      const bucketTemplates = db?.folder_caption_templates?.[masterBucketFid] || [];
      const projectTemplates = Array.isArray(activeProject.caption_templates) ? activeProject.caption_templates : [];
      let localTemplates: VideoEditorCaptionTemplate[] = [];
      try {
        const stored = localStorage.getItem(`master_caption_templates_${masterBucketFid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localTemplates = parsed;
        }
      } catch (_) {}

      // Combine sources, prioritizing the one with the newest updated_at, strictly deduplicated by text
      const combinedMap = new Map<string, VideoEditorCaptionTemplate>();
      const mergeTpl = (t: VideoEditorCaptionTemplate) => {
        if (!t || !t.text || !t.text.trim()) return;
        const textKey = t.text.trim().toLowerCase();
        const isAll = t.mode === 'all' || t.mode === 'must' || Boolean(t.is_must);
        const norm: VideoEditorCaptionTemplate = {
          ...t,
          mode: isAll ? 'all' : 'change',
          is_must: isAll,
          for_all_videos: isAll
        };
        const prev = combinedMap.get(textKey);
        if (!prev) {
          combinedMap.set(textKey, norm);
        } else {
          // If either was 'all', preserve 'all' mode
          const shouldBeAll = prev.is_must || norm.is_must || prev.mode === 'all' || norm.mode === 'all';
          const prevTime = prev.updated_at || prev.created_at || 0;
          const currTime = norm.updated_at || norm.created_at || 0;
          const winner = currTime >= prevTime ? { ...prev, ...norm } : { ...norm, ...prev };
          winner.mode = shouldBeAll ? 'all' : 'change';
          winner.is_must = shouldBeAll;
          winner.for_all_videos = shouldBeAll;
          combinedMap.set(textKey, winner);
        }
      };

      localTemplates.forEach(mergeTpl);
      bucketTemplates.forEach(mergeTpl);
      projectTemplates.forEach(mergeTpl);

      // Renumber templates sequentially C1, C2, ... if default named
      const combined = Array.from(combinedMap.values()).map((t, idx) => {
        if (!t.name || /^C\d+$/i.test(t.name)) {
          return { ...t, name: `C${idx + 1}` };
        }
        return t;
      });

      if (combined.length > 0) {
        setCaptionTemplates(combined);
      } else if (activeProject.caption_templates === undefined && Array.isArray(activeProject.captions) && activeProject.captions.length > 0) {
        // Synthesize templates only for legacy projects that never had caption_templates initialized
        const synthMap = new Map<string, VideoEditorCaptionTemplate>();
        activeProject.captions.forEach((c, i) => {
          if (!c || !c.text || !c.text.trim()) return;
          const k = c.text.trim().toLowerCase();
          if (!synthMap.has(k)) {
            synthMap.set(k, {
              id: c.template_id || c.id || `cap_${i}`,
              name: `C${synthMap.size + 1}`,
              text: c.text,
              mode: 'change',
              is_must: false,
              for_all_videos: false,
              font_size: c.font_size,
              font_family: c.font_family,
              box_width_pct: c.box_width_pct,
              is_bold: c.is_bold,
              x_pct: c.x_pct,
              y_pct: c.y_pct,
              color: c.color || '#ffffff',
              stroke_color: c.stroke_color || '#000000',
              clip_rule: c.clip_rule || 'all',
              created_at: Date.now()
            });
          }
        });
        setCaptionTemplates(Array.from(synthMap.values()));
      } else {
        setCaptionTemplates([]);
      }

      // Automatically guarantee any template marked 'all' (or 'must') is included on this video if not hidden
      const allTemplates = combined.filter(t => t.mode === 'all' || t.mode === 'must' || t.is_must === true);
      const hiddenIds = new Set(activeProject.hidden_caption_ids || []);

      // Strictly deduplicate existing project captions by normalized text
      const cleanExistingCaps: VideoEditorCaption[] = [];
      const seenTexts = new Set<string>();
      (activeProject.captions || []).forEach(c => {
        if (!c || !c.text || !c.text.trim()) return;
        const k = c.text.trim().toLowerCase();
        if (!seenTexts.has(k)) {
          seenTexts.add(k);
          cleanExistingCaps.push(c);
        }
      });

      const missingAllCaps: VideoEditorCaption[] = [];

      allTemplates.forEach(tpl => {
        const tplKey = tpl.text.trim().toLowerCase();
        if (!hiddenIds.has(tpl.id) && !hiddenIds.has(tplKey)) {
          if (!seenTexts.has(tplKey)) {
            seenTexts.add(tplKey);
            missingAllCaps.push({
              id: `cap_all_${tpl.id}_${Date.now()}`,
              template_id: tpl.id,
              text: tpl.text,
              font_family: tpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
              font_size: tpl.font_size || 24,
              is_bold: tpl.is_bold ?? true,
              box_width_pct: tpl.box_width_pct || 85,
              color: tpl.color || '#ffffff',
              stroke_color: tpl.stroke_color || '#000000',
              x_pct: tpl.x_pct !== undefined ? tpl.x_pct : 50,
              y_pct: tpl.y_pct !== undefined ? tpl.y_pct : 35,
              clip_rule: tpl.clip_rule || 'all',
              clip_count: tpl.clip_count || 1,
              clip_indices: tpl.clip_indices ? [...tpl.clip_indices] : []
            });
          }
        }
      });

      const hasDuplicatesRemoved = cleanExistingCaps.length !== (activeProject.captions || []).length;
      if (missingAllCaps.length > 0 || hasDuplicatesRemoved) {
        const nextCaps = [...cleanExistingCaps, ...missingAllCaps];
        const updatedProj = { ...activeProject, captions: nextCaps, caption_templates: combined, updated_at: Date.now() };
        setActiveProject(updatedProj);
        onSaveProject(updatedProj);
      }
    }
  }, [activeProject?.id, masterBucketFid, db?.folder_caption_templates]);

  // Synchronize title templates with the active project
  useEffect(() => {
    if (activeProject) {
      if (Array.isArray(activeProject.title_templates)) {
        setTitleTemplates(activeProject.title_templates);
      } else {
        setTitleTemplates([]);
      }
    }
  }, [activeProject?.id]);

  // Sync testTitleResult with current project's generated title if already present
  useEffect(() => {
    if (activeProject?.generated_title && !testTitleResult) {
      const curT = activeProject.generated_title.trim();
      const isBadFallback = curT === 'Lustige Tasse' || curT === 'Social Reel' || curT === 'Social Video' || !activeProject?.generated_hashtags || activeProject.generated_hashtags.trim() === '#Deutsch #Deutschland';
      if (!isBadFallback) {
        setTestTitleResult({
          title: activeProject.generated_title,
          hashtags: activeProject.generated_hashtags || ''
        });
      }
    }
  }, [activeProject?.generated_title, activeProject?.generated_hashtags, testTitleResult]);

  // Execute template on current project (generates title & hashtags and updates activeProject)
  const handleExecuteTemplateOnProject = useCallback(async (tpl: VideoEditorTitleTemplate) => {
    const cleanPrompt = tpl.prompt.trim();
    if (!cleanPrompt) {
      showToast("Prompt template is empty", "warning");
      return;
    }
    setIsTestingTitleGen(true);
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_title_hashtags',
          payload: {
            prompt: cleanPrompt,
            projectName: activeProject?.name || 'Project',
            bucketName: masterBucketName || 'Master Bucket',
            clipNames: (activeProject?.clips || []).map(c => c.bucket_name || c.vid),
            projectId: activeProject?.id
          }
        })
      });
      const data = await res.json();
      if (data && data.success && data.title) {
        const titleRes = data.title;
        const hashtagsRes = data.hashtags || '';
        setTestTitleResult({ title: titleRes, hashtags: hashtagsRes });
        if (data.db && setDb) setDb(data.db);

        // Update title template with last generated result
        const updatedTpls = titleTemplates.map(t => {
          if (t.id === tpl.id) {
            return {
              ...t,
              last_generated_title: titleRes,
              last_generated_hashtags: hashtagsRes,
              updated_at: Date.now()
            };
          }
          return t;
        });
        setTitleTemplates(updatedTpls);

        if (activeProject) {
          const updatedProj: VideoEditorProject = {
            ...activeProject,
            title_templates: updatedTpls,
            generated_title: titleRes,
            generated_hashtags: hashtagsRes,
            share_caption: `${titleRes}\n\n${hashtagsRes}`,
            active_title_template_id: tpl.id,
            updated_at: Date.now()
          };
          setActiveProject(updatedProj);
          onSaveProject(updatedProj);
        }
        showToast(`Title & hashtags generated!`, "success");
      } else {
        showToast(data?.error || "Generation failed", "error");
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setIsTestingTitleGen(false);
    }
  }, [activeProject, masterBucketName, onSaveProject, setDb, showToast, titleTemplates]);

  // Star a template for THIS project (becomes default & instantly generates title and hashtags)
  const handleStarTitleTemplateForProject = useCallback(async (tpl: VideoEditorTitleTemplate) => {
    if (!activeProject) return;

    // 1. Mark this template as default for this specific project
    const updatedTpls = titleTemplates.map(t => ({
      ...t,
      is_active: t.id === tpl.id
    }));
    setTitleTemplates(updatedTpls);

    const updatedProj: VideoEditorProject = {
      ...activeProject,
      title_templates: updatedTpls,
      active_title_template_id: tpl.id,
      updated_at: Date.now()
    };
    setActiveProject(updatedProj);
    onSaveProject(updatedProj);

    showToast(`⭐ Set "${tpl.name}" as default for project`, "info");
    // Immediately utilize this template and generate title and hashtags
    await handleExecuteTemplateOnProject(tpl);
  }, [activeProject, handleExecuteTemplateOnProject, onSaveProject, showToast, titleTemplates]);

  // Open detail view for a template (view prompt & sample output)
  const handleOpenTitleTemplateDetail = useCallback((tpl: VideoEditorTitleTemplate) => {
    setSelectedTitleTemplateId(tpl.id);
    setEditingTitleName(tpl.name);
    setEditingTitlePrompt(tpl.prompt);
    setIsPromptSaved(true);

    if (tpl.last_generated_title) {
      setTestTitleResult({
        title: tpl.last_generated_title,
        hashtags: tpl.last_generated_hashtags || ''
      });
    } else if (activeProject?.generated_title) {
      const curT = activeProject.generated_title.trim();
      const isBadFallback = !curT || curT === 'Lustige Tasse' || curT === 'Social Reel' || curT === 'Social Video';
      if (!isBadFallback) {
        setTestTitleResult({
          title: activeProject.generated_title,
          hashtags: activeProject.generated_hashtags || ''
        });
      } else {
        setTestTitleResult(null);
      }
    } else {
      setTestTitleResult(null);
    }
    setTitleViewMode('detail');
  }, [activeProject?.generated_title, activeProject?.generated_hashtags]);

  // Save current prompt details (name and prompt text) - strictly isolated to this project
  const handleSaveCurrentPromptDetail = useCallback((nameToSave?: string, promptToSave?: string) => {
    if (!selectedTitleTemplateId) return;
    const finalName = (nameToSave !== undefined ? nameToSave : editingTitleName).trim() || 'Template';
    const finalPrompt = promptToSave !== undefined ? promptToSave : editingTitlePrompt;

    const updated = titleTemplates.map(t => {
      if (t.id === selectedTitleTemplateId) {
        return { ...t, name: finalName, prompt: finalPrompt, updated_at: Date.now() };
      }
      return t;
    });
    setTitleTemplates(updated);
    if (activeProject) {
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        title_templates: updated,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    setIsPromptSaved(true);
  }, [selectedTitleTemplateId, editingTitleName, editingTitlePrompt, titleTemplates, activeProject, onSaveProject]);

  // Add new title & hashtag template strictly for this project
  const handleAddNewTitleTemplate = useCallback(() => {
    const nextNum = titleTemplates.length + 1;
    const newTpl: VideoEditorTitleTemplate = {
      id: `title_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `Template ${nextNum}`,
      prompt: DEFAULT_TITLE_PROMPT,
      is_active: titleTemplates.length === 0,
      created_at: Date.now()
    };
    const updated = [...titleTemplates, newTpl];
    setTitleTemplates(updated);
    if (activeProject) {
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        title_templates: updated,
        active_title_template_id: activeProject.active_title_template_id || newTpl.id,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    setSelectedTitleTemplateId(newTpl.id);
    setEditingTitleName(newTpl.name);
    setEditingTitlePrompt(newTpl.prompt);
    setIsPromptSaved(true);
    setTitleViewMode('detail');
    showToast(`Created "${newTpl.name}"`, "success");
  }, [DEFAULT_TITLE_PROMPT, activeProject, onSaveProject, showToast, titleTemplates]);

  // Delete a Title Template strictly for this project
  const handleExecuteDeleteTitleTemplate = useCallback(async (templateId: string, templateName?: string) => {
    const target = titleTemplates.find(t => t.id === templateId);
    const updated = titleTemplates.filter(t => t.id !== templateId);
    setTitleTemplates(updated);
    if (selectedTitleTemplateId === templateId) {
      setSelectedTitleTemplateId(updated[0]?.id || null);
      if (titleViewMode === 'detail') {
        setTitleViewMode('list');
      }
    }
    if (activeProject) {
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        title_templates: updated,
        active_title_template_id: activeProject.active_title_template_id === templateId ? (updated[0]?.id || undefined) : activeProject.active_title_template_id,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    showToast(`Deleted template "${templateName || target?.name || 'Template'}"`, "info");
  }, [activeProject, onSaveProject, selectedTitleTemplateId, showToast, titleTemplates, titleViewMode]);

  // Request deletion with confirmation dialog
  const handleDeleteTitleTemplate = useCallback((templateId: string, templateName?: string) => {
    const target = titleTemplates.find(t => t.id === templateId);
    setDeleteConfirmDialog({
      type: 'title_template',
      id: templateId,
      name: templateName || target?.name || 'Template'
    });
  }, [titleTemplates]);

  // Retry generating title & hashtags for current prompt
  const handleRetryCurrentPrompt = useCallback(async () => {
    if (!editingTitlePrompt.trim()) {
      showToast("Please enter a prompt template first", "warning");
      return;
    }
    // Save prompt immediately
    handleSaveCurrentPromptDetail(editingTitleName, editingTitlePrompt);

    const targetTpl = titleTemplates.find(t => t.id === selectedTitleTemplateId) || {
      id: selectedTitleTemplateId || `title_tpl_${Date.now()}`,
      name: editingTitleName || 'Template',
      prompt: editingTitlePrompt
    };

    await handleExecuteTemplateOnProject({
      ...targetTpl,
      name: editingTitleName || targetTpl.name,
      prompt: editingTitlePrompt
    });
  }, [editingTitleName, editingTitlePrompt, handleExecuteTemplateOnProject, handleSaveCurrentPromptDetail, selectedTitleTemplateId, showToast, titleTemplates]);

  // Computed display title and hashtags for Title & Hashtags drawer (filters out stale invalid fallback)
  const currentSelectedTitleTemplate = useMemo(() => {
    return titleTemplates.find(t => t.id === selectedTitleTemplateId);
  }, [titleTemplates, selectedTitleTemplateId]);

  const displayTitle = useMemo(() => {
    if (testTitleResult?.title && testTitleResult.title !== 'Lustige Tasse' && testTitleResult.title !== 'Social Reel' && testTitleResult.title !== 'Social Video') {
      return testTitleResult.title;
    }
    if (currentSelectedTitleTemplate?.last_generated_title) {
      return currentSelectedTitleTemplate.last_generated_title;
    }
    const projT = activeProject?.generated_title;
    if (projT && projT !== 'Lustige Tasse' && projT !== 'Social Reel' && projT !== 'Social Video') {
      return projT;
    }
    return '';
  }, [testTitleResult?.title, currentSelectedTitleTemplate?.last_generated_title, activeProject?.generated_title]);

  const displayHashtags = useMemo(() => {
    if (testTitleResult?.hashtags) {
      return testTitleResult.hashtags;
    }
    if (currentSelectedTitleTemplate?.last_generated_hashtags) {
      return currentSelectedTitleTemplate.last_generated_hashtags;
    }
    const projH = activeProject?.generated_hashtags;
    if (projH) {
      return projH;
    }
    return '';
  }, [testTitleResult?.hashtags, currentSelectedTitleTemplate?.last_generated_hashtags, activeProject?.generated_hashtags]);

  const handleUpdateGeneratedContent = useCallback((newTitle: string, newHashtags: string) => {
    setTestTitleResult({ title: newTitle, hashtags: newHashtags });
    if (activeProject) {
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        generated_title: newTitle,
        generated_hashtags: newHashtags,
        share_caption: `${newTitle}\n\n${newHashtags}`,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
  }, [activeProject, onSaveProject]);

  // Video Viewport Ref for Coordinate Math
  const videoViewportRef = useRef<HTMLDivElement | null>(null);
  const dragCaptionRef = useRef<{
    captionId: string;
    startClientX: number;
    startClientY: number;
    initXPct: number;
    initYPct: number;
  } | null>(null);

  // Center alignment guideline states for caption dragging
  const [showVerticalCenterGuide, setShowVerticalCenterGuide] = useState<boolean>(false);
  const [showHorizontalCenterGuide, setShowHorizontalCenterGuide] = useState<boolean>(false);

  // Caption right-click quick context menu
  const [captionContextMenu, setCaptionContextMenu] = useState<{
    x: number;
    y: number;
    caption: VideoEditorCaption;
  } | null>(null);

  // Inline Bottom Controls for Speed, Scale/Zoom, Trim, Audio Volume, Audio Speed & Loop Quick-Trim
  const [activeInlineControl, setActiveInlineControl] = useState<'speed' | 'scale' | 'trim' | 'audio_volume' | 'audio_speed' | 'loop' | null>(null);

  // Clip Loop State (Allows looping only the specific clip under the slider with live quick-trimming)
  const [isLoopingClip, setIsLoopingClip] = useState<boolean>(false);
  const isLoopingClipRef = useRef<boolean>(false);
  isLoopingClipRef.current = isLoopingClip;

  const [loopClipIndex, setLoopClipIndex] = useState<number | null>(null);
  const loopClipIndexRef = useRef<number | null>(null);
  loopClipIndexRef.current = loopClipIndex;

  // Trim target inside loop popup: 'end' by default!
  const [loopTrimTarget, setLoopTrimTarget] = useState<'beginning' | 'end'>('end');

  // Clip loading / buffering tracking
  const [loadedClipIds] = useState<Set<string>>(new Set());

  // Selected Timeline Clip for CapCut-Style Trimming & Controls
  const [selectedTimelineClipIndex, setSelectedTimelineClipIndex] = useState<number | null>(null);
  const [timelineZoom, setTimelineZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('ai_studio_video_editor_timeline_zoom');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 220) return val;
      }
    } catch (_) {}
    return 65;
  }); // px per second, spacious by default
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(65);

  // Keep timeline zoom level persisted across sessions
  useEffect(() => {
    try {
      localStorage.setItem('ai_studio_video_editor_timeline_zoom', String(timelineZoom));
    } catch (_) {}
  }, [timelineZoom]);

  // Keep active project ID persisted per master bucket and in global editor state
  useEffect(() => {
    if (activeProject && masterBucketFid) {
      try {
        localStorage.setItem(`ai_studio_last_active_project_${masterBucketFid}`, activeProject.id);
        localStorage.setItem('ai_studio_video_editor_project_id', activeProject.id);
        const url = new URL(window.location.href);
        url.searchParams.set('project', activeProject.id);
        window.history.replaceState(null, '', url.toString());
      } catch (_) {}
    }
  }, [activeProject?.id, masterBucketFid]);

  // Helper to format seconds to CapCut standard mm:ss.f timecode
  const formatTimecode = (sec: number) => {
    if (isNaN(sec) || sec < 0) return "00:00.0";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Trimming Pointer Drag State (CapCut Handles)
  const [trimmingHandle, setTrimmingHandle] = useState<'start' | 'end' | null>(null);
  const isUserScrubbingTrackRef = useRef<boolean>(false);
  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Drag-to-Reorder & Long-Press State (Desktop & Mobile)
  const [draggedClipIndex, setDraggedClipIndex] = useState<number | null>(null);
  const [dragOverTargetIndex, setDragOverTargetIndex] = useState<number | null>(null);
  const [isLongPressing, setIsLongPressing] = useState<boolean>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Export State & GPU Enhancement (Turned OFF by default as requested)
  const [showExportModal, setShowExportModal] = useState(false);
  const [useKaggleGpu, setUseKaggleGpu] = useState(true);
  const [enableGpuEnhancement, setEnableGpuEnhancement] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('remixx_enable_gpu_enhancement');
      return stored === 'true'; // strictly false by default!
    } catch {
      return false;
    }
  });
  const [enableProteusUpscale, setEnableProteusUpscale] = useState<boolean>(false);
  const [showInternalGenHistory, setShowInternalGenHistory] = useState(false);
  const [historyFilterProjectId, setHistoryFilterProjectId] = useState<string | null>(null);
  // Per-project exporting state map: prevents export state in Project A from blocking Project B or other video clips
  const [exportingProjectIds, setExportingProjectIds] = useState<{
    [projectId: string]: {
      isExporting: boolean;
      progress: number;
      statusText: string;
      sessionId?: string;
      projectName?: string;
      startedAt?: number;
    }
  }>({});

  const currentProjectId = activeProject?.id || '';
  const currentProjectExport = currentProjectId ? exportingProjectIds[currentProjectId] : undefined;
  const isExporting = Boolean(currentProjectExport?.isExporting);
  const exportProgress = currentProjectExport?.progress ?? 0;
  const exportStatusText = currentProjectExport?.statusText ?? '';

  const setIsExporting = useCallback((val: boolean | ((prev: boolean) => boolean), targetPid?: string) => {
    const pid = targetPid || activeProject?.id;
    if (!pid) return;
    setExportingProjectIds(prev => {
      const cur = Boolean(prev[pid]?.isExporting);
      const nextVal = typeof val === 'function' ? val(cur) : val;
      if (!nextVal) {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      }
      return {
        ...prev,
        [pid]: {
          ...(prev[pid] || { progress: 0, statusText: '', projectName: activeProject?.name }),
          isExporting: nextVal,
          startedAt: prev[pid]?.startedAt || Date.now()
        }
      };
    });
  }, [activeProject?.id, activeProject?.name]);

  const setExportProgress = useCallback((val: number | ((prev: number) => number), targetPid?: string) => {
    const pid = targetPid || activeProject?.id;
    if (!pid) return;
    setExportingProjectIds(prev => {
      const cur = prev[pid]?.progress ?? 0;
      const nextVal = typeof val === 'function' ? val(cur) : val;
      return {
        ...prev,
        [pid]: {
          ...(prev[pid] || { isExporting: true, statusText: '', projectName: activeProject?.name }),
          progress: nextVal
        }
      };
    });
  }, [activeProject?.id, activeProject?.name]);

  const setExportStatusText = useCallback((val: string | ((prev: string) => string), targetPid?: string) => {
    const pid = targetPid || activeProject?.id;
    if (!pid) return;
    setExportingProjectIds(prev => {
      const cur = prev[pid]?.statusText ?? '';
      const nextVal = typeof val === 'function' ? val(cur) : val;
      return {
        ...prev,
        [pid]: {
          ...(prev[pid] || { isExporting: true, progress: 0, projectName: activeProject?.name }),
          statusText: nextVal
        }
      };
    });
  }, [activeProject?.id, activeProject?.name]);

  const [exportResult, setExportResult] = useState<{ 
    downloadUrl: string; 
    filename: string; 
    size?: number; 
    duration?: number;
    isLocalMobileRender?: boolean;
    vid?: string; 
    folder_id?: string; 
    telegram_sent?: boolean;
    telegram_bot_sent?: boolean;
    generated_title?: string;
    generated_hashtags?: string;
    share_caption?: string;
  } | null>(null);
  const [socialShareVideoTarget, setSocialShareVideoTarget] = useState<{
    video: VideoData;
    url: string;
    title: string;
    hashtags: string;
    caption: string;
  } | null>(null);
  const [isDownloadingBlob, setIsDownloadingBlob] = useState(false);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const exportProgressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exportSessionIdRef = useRef<string | null>(null);
  const exportSessionStartTimeRef = useRef<number>(0);
  const isExportingRef = useRef(isExporting);
  isExportingRef.current = isExporting;
  const exportingProjectIdsRef = useRef(exportingProjectIds);
  exportingProjectIdsRef.current = exportingProjectIds;

  // Bulletproof video downloader that fetches full blob first to avoid truncated/corrupt downloads
  const handleDownloadExportedVideo = useCallback(async (downloadUrl: string, filename: string) => {
    if (!downloadUrl) return;
    setIsDownloadingBlob(true);
    try {
      showToast("Downloading full MP4 file...", "info");

      const candidates: string[] = [downloadUrl];
      if (exportResult) {
        if ((exportResult as any).telegram_file_id) candidates.push(`/api/video/${(exportResult as any).telegram_file_id}`);
        if ((exportResult as any).file_id) candidates.push(`/api/video/${(exportResult as any).file_id}`);
        if (exportResult.vid) candidates.push(`/api/video/${exportResult.vid}`);
      }

      let downloadBlob: Blob | null = null;
      let lastErr = '';

      for (const cand of candidates) {
        try {
          const resp = await fetch(cand);
          if (!resp.ok) {
            lastErr = `HTTP ${resp.status}`;
            continue;
          }
          const cType = (resp.headers.get('content-type') || '').toLowerCase();
          if (cType.includes('application/json') || cType.includes('text/html')) {
            lastErr = "Video stream not ready";
            continue;
          }
          const blob = await resp.blob();
          if (blob.size < 2000) {
            lastErr = "File stream incomplete";
            continue;
          }
          downloadBlob = blob;
          break;
        } catch (fErr: any) {
          lastErr = fErr.message || "Fetch failed";
        }
      }

      if (!downloadBlob) {
        throw new Error(lastErr || "Failed to download master video file");
      }

      const blobUrl = URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      showToast("Download finished successfully!", "success");
    } catch (err: any) {
      console.warn("Download issue:", err);
      showToast(`Download note: ${err?.message || 'Download failed'}`, "error");
    } finally {
      setIsDownloadingBlob(false);
    }
  }, [showToast, exportResult]);

  const handleCancelExport = useCallback((targetProjectId?: string) => {
    const pid = targetProjectId || activeProject?.id;
    if (exportProgressTimerRef.current) {
      clearInterval(exportProgressTimerRef.current);
      exportProgressTimerRef.current = null;
    }
    if (exportAbortControllerRef.current) {
      try {
        exportAbortControllerRef.current.abort();
      } catch {}
      exportAbortControllerRef.current = null;
    }
    if (pid) {
      const pState = exportingProjectIdsRef.current[pid];
      const sid = pState?.sessionId || exportSessionIdRef.current;
      setExportingProjectIds(prev => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      try {
        sessionStorage.removeItem('active_export_task');
        if (sid) {
          window.dispatchEvent(new CustomEvent('render-status-update', {
            detail: { id: sid, status: 'cleared', projectId: pid }
          }));
        }
        window.dispatchEvent(new CustomEvent('render-status-update', {
          detail: { id: pid, status: 'cleared', projectId: pid }
        }));
      } catch (_) {}
    } else {
      setExportingProjectIds({});
      try {
        sessionStorage.removeItem('active_export_task');
        window.dispatchEvent(new CustomEvent('render-status-update', {
          detail: { status: 'cleared' }
        }));
      } catch (_) {}
    }
    setExportResult(null);
    setShowExportModal(false);
    showToast("Export cancelled", "info");
  }, [activeProject?.id, showToast]);

  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<string | null>(null);

  const handleSendExportResultToTelegram = async () => {
    const vid = exportResult?.vid;
    if (!vid) {
      setTelegramFeedback("Video identifier not found");
      return;
    }
    setIsSendingToTelegram(true);
    setTelegramFeedback(null);
    try {
      const res = await fetch('/api/editor/send_export_to_telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid, video_id: vid, id: vid })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExportResult(prev => prev ? { ...prev, telegram_sent: true, telegram_bot_sent: true } : null);
        setTelegramFeedback("Delivered to Telegram!");
        showToast("Delivered to Telegram!", "success");
      } else {
        setTelegramFeedback(data.error || "Failed to send to Telegram");
        showToast(data.error || "Telegram send failed", "error");
      }
    } catch (err: any) {
      setTelegramFeedback(`Error: ${err.message}`);
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  // Active Export Completion & Progress Listener
  useEffect(() => {
    const handleJobCompleted = (e: any) => {
      const j = e.detail;
      if (!j) return;
      const currentPid = activeProject?.id;
      const currentPName = (activeProject?.name || '').toLowerCase().trim();
      const jobPName = (j.projectName || '').toLowerCase().trim();

      // Find matched project strictly among exporting projects or active project
      let matchedPid: string | undefined = Object.keys(exportingProjectIdsRef.current).find(pid => {
        if (j.projectId && j.projectId === pid) return true;
        const pState = exportingProjectIdsRef.current[pid];
        if (pState?.sessionId && (j.jobId === pState.sessionId || pState.sessionId.includes(j.jobId) || j.jobId.includes(pState.sessionId))) return true;
        if (pState?.projectName && jobPName && pState.projectName.toLowerCase().trim() === jobPName) return true;
        const pObj = db?.video_editor_projects?.[pid];
        if (pObj?.name && jobPName && jobPName === pObj.name.toLowerCase().trim()) return true;
        return false;
      });

      // If matchedPid not found among exportingProjectIds, check if j explicitly belongs to current project
      if (!matchedPid && currentPid) {
        if (j.projectId && j.projectId === currentPid) {
          matchedPid = currentPid;
        } else if (currentPName && jobPName && currentPName === jobPName) {
          matchedPid = currentPid;
        }
      }

      if (matchedPid) {
        setExportingProjectIds(prev => {
          const next = { ...prev };
          delete next[matchedPid!];
          return next;
        });

        if (exportProgressTimerRef.current) {
          clearInterval(exportProgressTimerRef.current);
          exportProgressTimerRef.current = null;
        }

        const safeFilename = j.filename || `${(j.projectName || activeProject?.name || 'video_project').replace(/\s+/g, '_')}_hd.mp4`;
        const effectiveDownloadUrl = j.downloadUrl || (j.vid ? `/api/video/${j.vid}` : `/api/merged_video/${safeFilename}`);
        const resData = {
          downloadUrl: effectiveDownloadUrl,
          filename: safeFilename,
          size: j.size,
          vid: j.vid,
          folder_id: j.folder_id,
          telegram_sent: Boolean(j.telegram_bot_sent),
          telegram_bot_sent: Boolean(j.telegram_bot_sent),
          generated_title: j.generated_title,
          generated_hashtags: j.generated_hashtags,
          share_caption: j.share_caption
        };

        if (matchedPid === currentPid) {
          setExportResult(resData);
          // Do not pop up modal: keep bottom bar clean as user requested
          showToast("🎉 Video render complete! Master MP4 Ready!", "success");
        } else {
          showToast(`🎉 Video render complete for "${j.projectName}"! Ready in Export History.`, "success");
        }
      }
    };

    const handleStatusUpdate = (e: any) => {
      const d = e.detail;
      if (!d) return;

      if (d.status === 'cleared') {
        const clearId = d.id;
        setExportingProjectIds(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(pid => {
            if (pid === clearId || next[pid]?.sessionId === clearId || (d.projectId && pid === d.projectId) || (next[pid]?.projectName && d.projectName && next[pid].projectName?.toLowerCase().trim() === d.projectName.toLowerCase().trim())) {
              delete next[pid];
            }
          });
          return next;
        });
        return;
      }

      const currentPid = activeProject?.id;
      const currentPName = (activeProject?.name || '').toLowerCase().trim();
      const dPName = (d.projectName || '').toLowerCase().trim();

      let matchedPid: string | undefined = Object.keys(exportingProjectIdsRef.current).find(pid => {
        if (d.projectId && d.projectId === pid) return true;
        const pState = exportingProjectIdsRef.current[pid];
        if (pState?.sessionId && (d.id === pState.sessionId || pState.sessionId.includes(d.id) || d.id.includes(pState.sessionId))) return true;
        if (pState?.projectName && dPName && pState.projectName.toLowerCase().trim() === dPName) return true;
        const pObj = db?.video_editor_projects?.[pid];
        if (pObj?.name && dPName && dPName === pObj.name.toLowerCase().trim()) return true;
        return false;
      });

      // Strictly isolate: NEVER match currentPid unless the update explicitly matches currentPid or currentPName!
      if (!matchedPid && currentPid) {
        if (d.projectId && d.projectId === currentPid) {
          matchedPid = currentPid;
        } else if (currentPName && dPName && currentPName === dPName) {
          matchedPid = currentPid;
        }
      }

      if (matchedPid) {
        if (d.status === 'completed') {
          setExportingProjectIds(prev => {
            const next = { ...prev };
            delete next[matchedPid!];
            return next;
          });
          if (exportProgressTimerRef.current) {
            clearInterval(exportProgressTimerRef.current);
            exportProgressTimerRef.current = null;
          }
          if (d.downloadUrl) {
            const resData = {
              downloadUrl: d.downloadUrl,
              filename: d.filename || 'export.mp4',
              size: d.size,
              vid: d.vid,
              folder_id: d.folder_id,
              telegram_sent: Boolean(d.telegram_bot_sent),
              telegram_bot_sent: Boolean(d.telegram_bot_sent),
              generated_title: d.generated_title,
              generated_hashtags: d.generated_hashtags
            };
            if (matchedPid === currentPid) {
              setExportResult(resData);
              // Do not auto-pop up export modal
              showToast("🎉 Video render complete! Master MP4 Ready!", "success");
            } else {
              showToast(`🎉 Video render complete for "${d.projectName}"! Ready in Export History.`, "success");
            }
          }
        } else if (d.status === 'failed') {
          setExportingProjectIds(prev => {
            const next = { ...prev };
            delete next[matchedPid!];
            return next;
          });
          if (exportProgressTimerRef.current) {
            clearInterval(exportProgressTimerRef.current);
            exportProgressTimerRef.current = null;
          }
          showToast(`Export failed for "${d.projectName || 'video'}": ${d.error || 'Unknown error'}`, "error");
        } else if (typeof d.progress === 'number') {
          setExportingProjectIds(prev => ({
            ...prev,
            [matchedPid!]: {
              ...prev[matchedPid!],
              isExporting: true,
              progress: Math.max(prev[matchedPid!]?.progress || 0, d.progress),
              statusText: d.statusText || prev[matchedPid!]?.statusText || ''
            }
          }));
        }
      }
    };

    window.addEventListener('kaggle-job-completed', handleJobCompleted);
    window.addEventListener('render-status-update', handleStatusUpdate);

    return () => {
      window.removeEventListener('kaggle-job-completed', handleJobCompleted);
      window.removeEventListener('render-status-update', handleStatusUpdate);
    };
  }, [activeProject, db?.video_editor_projects, showToast]);

  // While any project is exporting, poll Kaggle jobs every 2 seconds for rock-solid status receiving
  useEffect(() => {
    const hasAnyActiveExport = Object.values(exportingProjectIds).some(p => p.isExporting);
    if (!hasAnyActiveExport) {
      if (exportProgressTimerRef.current) {
        clearInterval(exportProgressTimerRef.current);
        exportProgressTimerRef.current = null;
      }
      return;
    }
    const email = currentUserEmail || '';
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/kaggle/jobs?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data.jobs)) return;

        const currentExpMap = exportingProjectIdsRef.current;
        const now = Date.now();

        Object.entries(currentExpMap).forEach(([pid, pState]) => {
          if (!pState.isExporting) return;
          const pObj = db?.video_editor_projects?.[pid];
          const normPName = (pState.projectName || pObj?.name || '').toLowerCase().trim();

          const matchingJob = data.jobs.find((j: any) => {
            if (pState.sessionId && (j.jobId === pState.sessionId || pState.sessionId.includes(j.jobId) || j.jobId.includes(pState.sessionId))) {
              return true;
            }
            if (j.projectId === pid) return true;
            if (normPName && j.projectName && j.projectName.toLowerCase().trim() === normPName) {
              return true;
            }
            return false;
          });

          if (matchingJob) {
            if (matchingJob.status === 'completed') {
              setExportingProjectIds(prev => {
                const next = { ...prev };
                delete next[pid];
                return next;
              });
              if (exportProgressTimerRef.current) {
                clearInterval(exportProgressTimerRef.current);
                exportProgressTimerRef.current = null;
              }
              const safeFilename = matchingJob.filename || `${(matchingJob.projectName || normPName || 'video_project').replace(/\s+/g, '_')}_hd.mp4`;
              const effectiveDownloadUrl = matchingJob.downloadUrl || (matchingJob.vid ? `/api/video/${matchingJob.vid}` : `/api/merged_video/${safeFilename}`);
              const resData = {
                downloadUrl: effectiveDownloadUrl,
                filename: safeFilename,
                size: matchingJob.size,
                vid: matchingJob.vid,
                folder_id: matchingJob.folder_id,
                telegram_sent: Boolean(matchingJob.telegram_bot_sent),
                telegram_bot_sent: Boolean(matchingJob.telegram_bot_sent),
                generated_title: matchingJob.generated_title,
                generated_hashtags: matchingJob.generated_hashtags,
                share_caption: matchingJob.share_caption
              };

              if (pid === activeProject?.id) {
                setExportResult(resData);
                // Do not auto-pop up export modal
                showToast("🎉 Video render complete! Master MP4 Ready!", "success");
              } else {
                showToast(`🎉 Video render complete for "${matchingJob.projectName}"! Ready in Export History.`, "success");
              }
            } else if (matchingJob.status === 'failed') {
              setExportingProjectIds(prev => {
                const next = { ...prev };
                delete next[pid];
                return next;
              });
              if (exportProgressTimerRef.current) {
                clearInterval(exportProgressTimerRef.current);
                exportProgressTimerRef.current = null;
              }
              showToast(`Export failed for "${matchingJob.projectName}": ${matchingJob.error || 'Kaggle error'}`, "error");
            } else if (typeof matchingJob.progress === 'number') {
              setExportingProjectIds(prev => ({
                ...prev,
                [pid]: {
                  ...prev[pid],
                  isExporting: true,
                  progress: Math.max(prev[pid]?.progress || 0, matchingJob.progress),
                  statusText: matchingJob.statusText || prev[pid]?.statusText || ''
                }
              }));
            }
          } else {
            // Also check db.kaggle_jobs directly in case it already completed
            const dbJob = db?.kaggle_jobs?.[pState.sessionId || ''] || 
              Object.values(db?.kaggle_jobs || {}).find((kj: any) => 
                kj.projectId === pid || 
                (normPName && kj.projectName && kj.projectName.toLowerCase().trim() === normPName)
              );
            if (dbJob?.status === 'completed') {
              setExportingProjectIds(prev => {
                const next = { ...prev };
                delete next[pid];
                return next;
              });
              if (pid === activeProject?.id && dbJob.downloadUrl) {
                setExportResult({
                  downloadUrl: dbJob.downloadUrl,
                  filename: dbJob.filename || 'export.mp4',
                  size: dbJob.size,
                  vid: dbJob.vid,
                  folder_id: dbJob.folder_id,
                  telegram_sent: Boolean(dbJob.telegram_bot_sent),
                  telegram_bot_sent: Boolean(dbJob.telegram_bot_sent),
                  generated_title: dbJob.generated_title,
                  generated_hashtags: dbJob.generated_hashtags
                });
                // Do not auto-pop up export modal
                showToast("🎉 Video render complete! Master MP4 Ready!", "success");
              }
            } else if (pState.startedAt && (now - pState.startedAt > 35 * 60 * 1000)) {
              // Safety timeout: If export has been running for > 35 minutes with no matching job, auto-clear
              setExportingProjectIds(prev => {
                const next = { ...prev };
                delete next[pid];
                return next;
              });
            }
          }
        });
      } catch (_) {}
    }, 2000);

    return () => clearInterval(pollTimer);
  }, [exportingProjectIds, activeProject, currentUserEmail, db?.video_editor_projects, db?.kaggle_jobs, showToast]);

  // Synchronize or initialize active project cleanly when opened
  useEffect(() => {
    if (!isOpen) {
      initializedProjectIdRef.current = null;
      return;
    }

    // 1. If initialProjectId was explicitly requested, ALWAYS load that project!
    if (initialProjectId) {
      const p = db?.video_editor_projects?.[initialProjectId] || projects.find(item => item.id === initialProjectId);
      if (p) {
        if (activeProject?.id !== p.id) {
          setActiveProject(p);
          setProjectNameInput(p.name);
          initializedProjectIdRef.current = p.id;
          if (Array.isArray(p.caption_templates) && p.caption_templates.length > 0) {
            setCaptionTemplates(p.caption_templates);
          } else {
            const bucketTpls = db?.folder_caption_templates?.[masterBucketFid];
            if (Array.isArray(bucketTpls) && bucketTpls.length > 0) {
              setCaptionTemplates(bucketTpls);
            } else {
              setCaptionTemplates([]);
            }
          }
          setTitleTemplates(Array.isArray(p.title_templates) ? p.title_templates : []);
          setSelectedCaptionId(null);
          setSelectedAudioClipIndex(null);
          setSelectedTimelineClipIndex(null);
          setCurrentClipIndex(0);
          setProjectCurrentTime(0);
          setUndoStack([]);
          setRedoStack([]);
          try {
            localStorage.setItem(`ai_studio_last_active_project_${masterBucketFid}`, p.id);
          } catch (_) {}
        }
        return;
      }
      // If initialProjectId was requested but not found in db yet, wait for db state update.
      // NEVER fall back to old project when a specific project was requested!
      return;
    }

    // 2. If activeProject is already set and valid, keep it and do not overwrite!
    if (activeProject && db?.video_editor_projects?.[activeProject.id]) {
      return;
    }

    // 3. Fallback only when NO initialProjectId was requested:
    if (projects.length > 0) {
      let candidate: VideoEditorProject | undefined;
      try {
        const savedId = localStorage.getItem(`ai_studio_last_active_project_${masterBucketFid}`);
        if (savedId) {
          candidate = projects.find(p => p.id === savedId);
        }
      } catch (_) {}
      const target = candidate || projects[0];
      setActiveProject(target);
      setProjectNameInput(target.name);
      initializedProjectIdRef.current = target.id;
    } else if (!activeProject) {
      // 4. Zero projects exist and no active project: auto-generate a fresh draft project silently!
      const defaultProjName = `${masterBucketName || 'Video'} Project 1`;
      const autoProj: VideoEditorProject = {
        id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: defaultProjName,
        master_bucket_fid: masterBucketFid,
        mode: editorMode,
        clips: [],
        captions: [],
        caption_templates: [],
        title_templates: [],
        active_title_template_id: undefined,
        audio_clips: [],
        starred_audio_ids: [],
        audio_modes: {},
        hidden_audio_ids: [],
        audio_id: undefined,
        audio_url: undefined,
        audio_name: undefined,
        createdBy: currentUserEmail,
        ownerId: currentUserEmail,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      setActiveProject(autoProj);
      setProjectNameInput(autoProj.name);
      initializedProjectIdRef.current = autoProj.id;
      onSaveProject(autoProj);
    }
  }, [isOpen, masterBucketFid, initialProjectId, db?.video_editor_projects, projects]);

  // Synchronize activeProject with latest server/db state whenever db updates
  useEffect(() => {
    if (activeProject?.id && db?.video_editor_projects?.[activeProject.id]) {
      const serverProj = db.video_editor_projects[activeProject.id];
      if (serverProj.updated_at && serverProj.updated_at > (activeProject.updated_at || 0)) {
        setActiveProject(serverProj);
      }
    }
  }, [db?.video_editor_projects, activeProject?.id, activeProject?.updated_at]);

  // Seamlessly persist active project ID to localStorage & URL so reopening returns to exact project
  useEffect(() => {
    if (activeProject?.id) {
      try {
        localStorage.setItem(`ai_studio_last_active_project_${masterBucketFid}`, activeProject.id);
        localStorage.setItem('ai_studio_editor_project_id', activeProject.id);
        const url = new URL(window.location.href);
        url.searchParams.set('project', activeProject.id);
        window.history.replaceState({}, '', url.toString());
      } catch (_) {}
    }
  }, [activeProject?.id, masterBucketFid]);

  // Audio Library Modal State & Audio Playback Element
  const [showAudioLibrary, setShowAudioLibrary] = useState(false);
  const [audioPickMode, setAudioPickMode] = useState<{ mode: 'replace' | 'append', clipIndex?: number, targetLayer?: number } | null>(null);
  const [selectedAudioClipIndex, setSelectedAudioClipIndex] = useState<number | null>(null);
  const [activeAudioOptionsIndex, setActiveAudioOptionsIndex] = useState<number | null>(null);
  const [draggedAudioClipIndex, setDraggedAudioClipIndex] = useState<number | null>(null);
  const [trimmingAudioHandle, setTrimmingAudioHandle] = useState<'start' | 'end' | null>(null);
  const audioElementsMapRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const allManagedAudioElementsRef = useRef<Set<HTMLAudioElement>>(new Set());
  const animIdRef = useRef<number | null>(null);

  // Instant Full-Stop Playback Pause (Halts all active videos & audio elements synchronously)
  const pauseAllPlayback = useCallback(() => {
    // 1. Immediately flag playing state as stopped so tick and event listeners cease all playback triggers
    isPlayingRef.current = false;
    setIsPlaying(false);

    // 2. Cancel any pending animation frame immediately
    if (animIdRef.current !== null) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }

    // 3. Immediately pause all video elements
    videoElementsRef.current.forEach(el => {
      try {
        if (!el.paused) el.pause();
      } catch (_) {}
    });

    // 4. Immediately pause all registered audio elements in map
    audioElementsMapRef.current.forEach(el => {
      try {
        if (!el.paused) el.pause();
      } catch (_) {}
    });

    // 5. Pause all managed audio elements including any created or detached
    allManagedAudioElementsRef.current.forEach(el => {
      try {
        if (!el.paused) el.pause();
      } catch (_) {}
    });

    // 6. Failsafe: pause all <audio> elements in the DOM
    try {
      const allDomAudios = document.querySelectorAll('audio');
      allDomAudios.forEach(a => {
        try { if (!a.paused) a.pause(); } catch (_) {}
      });
    } catch (_) {}
  }, []);

  // Enforce zero background playback or time drift whenever isPlaying is false
  useEffect(() => {
    if (!isPlaying) {
      pauseAllPlayback();
    }
  }, [isPlaying, pauseAllPlayback]);

  // Audio touch long-press timer ref
  const audioLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to create snapshot for Undo / Redo
  const createProjectSnapshot = useCallback((proj: VideoEditorProject): EditorHistorySnapshot => {
    return {
      clips: (proj.clips || []).map(c => ({
        id: c.id,
        vid: c.vid,
        url: c.url,
        file_id: c.file_id || null,
        bucket_id: c.bucket_id || '',
        bucket_name: c.bucket_name || '',
        duration: c.duration,
        speed: c.speed,
        scale: c.scale,
        trim_start: c.trim_start,
        trim_end: c.trim_end,
        is_muted: c.is_muted,
        volume: c.volume,
        is_starred: c.is_starred,
        is_default: c.is_default,
        is_frozen: c.is_frozen,
        last_used_at: c.last_used_at,
        created_at: c.created_at,
        source_job_id: c.source_job_id,
        source_prompt: c.source_prompt,
        variants: c.variants ? c.variants.map(v => ({ ...v })) : undefined,
        active_variant_index: c.active_variant_index,
        variant_groups: c.variant_groups ? c.variant_groups.map(g => ({
          ...g,
          clips: (g.clips || []).map(gc => ({ ...gc }))
        })) : undefined,
        active_variant_group_index: c.active_variant_group_index,
      })),
      captions: (proj.captions || []).map(cap => ({ ...cap })),
      audio_clips: (proj.audio_clips || []).map(ac => ({ ...ac })),
      vault_unused_clips: (proj.vault_unused_clips || []).map(vc => ({ ...vc })),
      audio_id: proj.audio_id,
      audio_url: proj.audio_url,
      audio_name: proj.audio_name,
      audio_duration: proj.audio_duration,
      audio_volume: proj.audio_volume,
      jobs: higgsfieldJobsRef.current ? higgsfieldJobsRef.current.map(j => ({ ...j })) : undefined,
    };
  }, []);

  const pushHistorySnapshot = useCallback(() => {
    const proj = activeProjectRef.current;
    if (!proj) return;
    const snap = createProjectSnapshot(proj);
    setUndoStack(prev => [...prev.slice(-50), snap]);
    setRedoStack([]);
  }, [createProjectSnapshot]);

  // Helper to ensure audio clips maintain valid start times and are automatically cut & resized till video end
  const autoCorrectAudioClipsForVideoDuration = useCallback((clips: VideoEditorAudioClip[], targetTotalDur: number): VideoEditorAudioClip[] => {
    if (clips.length === 0) return clips;
    if (!targetTotalDur || targetTotalDur <= 0) {
      return clips.map(clip => ({
        ...clip,
        start_time: Math.max(0, Number((clip.start_time !== undefined ? clip.start_time : 0).toFixed(2)))
      }));
    }

    return clips.map(clip => {
      const origStartTime = Math.max(0, Number((clip.start_time !== undefined ? clip.start_time : 0).toFixed(2)));
      // If start_time is already at or beyond video end, reposition to 0
      const safeStartTime = origStartTime >= targetTotalDur ? 0 : origStartTime;
      const maxAllowedSpan = Math.max(0.1, targetTotalDur - safeStartTime);
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const rawTrimStart = Math.max(0, clip.trim_start || 0);

      // Auto cut/resize audio strip so it ends exactly at targetTotalDur
      const targetTrimEnd = rawTrimStart + (maxAllowedSpan * speed);
      const roundedTrimEnd = Number(targetTrimEnd.toFixed(2));
      const targetDuration = Math.max(clip.duration || 0, roundedTrimEnd);

      return {
        ...clip,
        duration: targetDuration,
        start_time: safeStartTime,
        trim_start: rawTrimStart,
        trim_end: roundedTrimEnd
      };
    });
  }, []);

  // Helper to commit changes to the active project and record Undo state
  const updateProjectClips = useCallback((newClips: VideoEditorClip[], pushUndo = true, persist = true) => {
    const proj = activeProjectRef.current;
    if (!proj) return;

    if (pushUndo) {
      pushHistorySnapshot();
    }

    setExportResult(null);

    // Calculate new total video duration to automatically cut and fit audio strip
    const newTotalVideoDur = newClips.reduce((sum, c) => {
      const dur = c.duration && c.duration > 0 ? c.duration : 4.0;
      const start = Math.max(0, c.trim_start || 0);
      const rawEnd = (c.trim_end !== undefined && c.trim_end > start) ? c.trim_end : dur;
      const end = Math.max(start + 0.2, Math.min(dur, rawEnd));
      const speed = c.speed && c.speed > 0 ? c.speed : 1.0;
      return sum + Math.max(0.1, (end - start) / speed);
    }, 0);

    let updatedAudioClips = proj.audio_clips || [];
    if (newTotalVideoDur > 0 && updatedAudioClips.length > 0) {
      updatedAudioClips = autoCorrectAudioClipsForVideoDuration(updatedAudioClips, newTotalVideoDur);
    }

    const updated: VideoEditorProject = {
      ...proj,
      clips: newClips,
      audio_clips: updatedAudioClips,
      audio_duration: updatedAudioClips[0]?.duration || proj.audio_duration,
      updated_at: Date.now()
    };
    activeProjectRef.current = updated;
    setActiveProject(updated);
    if (persist) {
      onSaveProject(updated);
    }
  }, [pushHistorySnapshot, onSaveProject, autoCorrectAudioClipsForVideoDuration]);

  // Dynamically calibrate real duration from HTML video metadata if placeholder/0 was loaded
  const handleSyncClipMetadataDuration = useCallback((clipId: string, realDur: number) => {
    setActiveProject(prev => {
      if (!prev || !prev.clips) return prev;
      const idx = prev.clips.findIndex(c => c.id === clipId);
      if (idx === -1) return prev;
      const target = prev.clips[idx];
      if (target.duration && target.duration > 0 && Math.abs(target.duration - realDur) < 0.2) {
        return prev;
      }
      const updatedClips = [...prev.clips];
      const isUncut = !target.trim_end || target.trim_end === target.duration || target.trim_end <= 0;
      updatedClips[idx] = {
        ...target,
        duration: Number(realDur.toFixed(2)),
        trim_end: isUncut ? Number(realDur.toFixed(2)) : target.trim_end
      };
      return {
        ...prev,
        clips: updatedClips
      };
    });
  }, []);

  // Calculated Project Metrics
  const activeClips = activeProject?.clips || [];

  const [isDownloadingAllClips, setIsDownloadingAllClips] = useState(false);

  // Polling Higgsfield credits & generation jobs for this project
  const prevCompletedJobsCountRef = useRef<number>(-1);

  const fetchHiggsfieldData = useCallback(async () => {
    try {
      const [statusRes, jobsRes] = await Promise.all([
        fetch('/api/higgsfield/status'),
        activeProject?.id ? fetch(`/api/higgsfield/jobs?projectId=${activeProject.id}`) : Promise.resolve(null)
      ]);
      const statusData = await statusRes.json();
      if (statusData?.ok && statusData.higgsfield) {
        setHiggsfieldCredits(statusData.higgsfield.credits);
      }
      if (jobsRes) {
        const jobsData = await jobsRes.json();
        if (jobsData?.ok && Array.isArray(jobsData.jobs)) {
          const sorted = jobsData.jobs.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          setHiggsfieldJobs(sorted);
          const completedCount = sorted.filter((j: any) => j.status === 'completed').length;
          if (prevCompletedJobsCountRef.current !== -1 && completedCount > prevCompletedJobsCountRef.current) {
            showToast(`✓ AI Video generation complete! ${completedCount} ready. Click top bubble to view.`, "success");
          }
          prevCompletedJobsCountRef.current = completedCount;
        }
      }
    } catch (_) {}
  }, [activeProject?.id, showToast]);

  useEffect(() => {
    fetchHiggsfieldData();
    const handleStatusUpdate = (e: any) => {
      if (e?.detail?.credits !== undefined) {
        setHiggsfieldCredits(e.detail.credits);
      }
      fetchHiggsfieldData();
    };
    window.addEventListener('higgsfield-status-updated', handleStatusUpdate);

    const hasActive = higgsfieldJobs.some(j => j.status === 'processing' || j.status === 'pending');
    const timer = setInterval(fetchHiggsfieldData, hasActive ? 2500 : 15000);

    return () => {
      window.removeEventListener('higgsfield-status-updated', handleStatusUpdate);
      clearInterval(timer);
    };
  }, [fetchHiggsfieldData, higgsfieldJobs]);

  const handleOpenAiPromptMode = useCallback((specificClipIdx?: number) => {
    if (typeof specificClipIdx === 'number' && specificClipIdx >= 0 && specificClipIdx < activeClips.length) {
      setSelectedTimelineClipIndex(specificClipIdx);
      setCurrentClipIndex(specificClipIdx);
    } else {
      const fallbackIdx = (selectedTimelineClipIndex !== null && selectedTimelineClipIndex >= 0 && selectedTimelineClipIndex < activeClips.length)
        ? selectedTimelineClipIndex
        : currentClipIndex;
      setSelectedTimelineClipIndex(fallbackIdx);
      setCurrentClipIndex(fallbackIdx);
    }
    setIsAiPromptMode(true);
  }, [selectedTimelineClipIndex, activeClips.length, currentClipIndex]);

  const handleSelectHiggsfieldJobForReview = useCallback((job: HiggsfieldJob) => {
    setReviewingJob(job);
    setIsReviewModalOpen(true);
  }, []);

  const handleTrashGeneratedJob = useCallback(async (job: HiggsfieldJob) => {
    try {
      await fetch('/api/higgsfield/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, file_id: job.file_id })
      });
      setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'trashed' } : j));
      showToast("Clip moved to trash folder", "info");
    } catch (_) {
      showToast("Failed to move to trash", "error");
    }
  }, [showToast]);

  const handleDeleteAndReplace = useCallback((job: HiggsfieldJob, targetClipIndex: number) => {
    if (!activeProject) return;
    const clipIdx = (targetClipIndex >= 0 && targetClipIndex < activeClips.length)
      ? targetClipIndex
      : (activeClips.findIndex(c => c.id === job.clipId) !== -1 ? activeClips.findIndex(c => c.id === job.clipId) : (selectedTimelineClipIndex ?? currentClipIndex ?? 0));

    if (clipIdx < 0 || clipIdx >= activeClips.length) {
      showToast("Target clip not found", "error");
      return;
    }
    const prevClip = activeClips[clipIdx];
    const genDuration = job.duration || (typeof prevClip.trim_end === 'number' && typeof prevClip.trim_start === 'number' && prevClip.trim_end > prevClip.trim_start ? Number((prevClip.trim_end - prevClip.trim_start).toFixed(2)) : prevClip.duration);
    const newVariant: VideoEditorClip = {
      ...prevClip,
      id: `variant_${job.id}_${Date.now()}`,
      vid: job.file_id || job.id,
      url: job.video_url || `/api/video/${job.file_id}`,
      file_id: job.file_id || prevClip.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: undefined,
      created_at: job.createdAt || Date.now(),
      source_job_id: job.id,
      source_prompt: job.prompt
    };
    const newClip: VideoEditorClip = {
      ...prevClip,
      url: job.video_url || `/api/video/${job.file_id}`,
      file_id: job.file_id || prevClip.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: [newVariant],
      active_variant_index: 0
    };
    const updated = [...activeClips];
    updated[clipIdx] = newClip;
    updateProjectClips(updated, true);
    fetch('/api/higgsfield/mark_added', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(() => {});
    setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'added' } : j));
    showToast(`Clip #${clipIdx + 1} replaced with AI version`, "success");
  }, [activeProject, activeClips, selectedTimelineClipIndex, currentClipIndex, updateProjectClips, showToast]);

  const handleReplaceKeepVariant = useCallback((job: HiggsfieldJob, targetClipIndex: number) => {
    if (!activeProject) return;
    const clipIdx = (targetClipIndex >= 0 && targetClipIndex < activeClips.length)
      ? targetClipIndex
      : (activeClips.findIndex(c => c.id === job.clipId) !== -1 ? activeClips.findIndex(c => c.id === job.clipId) : (selectedTimelineClipIndex ?? currentClipIndex ?? 0));

    if (clipIdx < 0 || clipIdx >= activeClips.length) {
      showToast("Target clip not found", "error");
      return;
    }
    const prevClip = activeClips[clipIdx];
    const existingVariants: VideoEditorClip[] = prevClip.variants && prevClip.variants.length > 0
      ? [...prevClip.variants]
      : [{ ...prevClip, variants: undefined, created_at: prevClip.created_at || (Date.now() - 3600000) }];

    const genDuration = job.duration || (typeof prevClip.trim_end === 'number' && typeof prevClip.trim_start === 'number' && prevClip.trim_end > prevClip.trim_start ? Number((prevClip.trim_end - prevClip.trim_start).toFixed(2)) : prevClip.duration);
    const newVariant: VideoEditorClip = {
      ...prevClip,
      id: `variant_${job.id}_${Date.now()}`,
      vid: job.file_id || job.id,
      url: job.video_url || `/api/video/${job.file_id}`,
      file_id: job.file_id || prevClip.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: undefined,
      created_at: job.createdAt || Date.now(),
      source_job_id: job.id,
      source_prompt: job.prompt
    };

    const alreadyIdx = existingVariants.findIndex(v => v.source_job_id === job.id || (v.url && v.url === newVariant.url));
    const allVariants = alreadyIdx !== -1 ? existingVariants : [...existingVariants, newVariant];
    const activeVarIdx = alreadyIdx !== -1 ? alreadyIdx : allVariants.length - 1;

    const updatedClip: VideoEditorClip = {
      ...prevClip,
      url: newVariant.url,
      file_id: newVariant.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: allVariants,
      active_variant_index: activeVarIdx
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);
    fetch('/api/higgsfield/mark_added', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(() => {});
    setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'added' } : j));
    showToast(`Clip replaced! ${allVariants.length} takes now available in vault for Clip #${clipIdx + 1}`, "success");
  }, [activeProject, activeClips, selectedTimelineClipIndex, currentClipIndex, updateProjectClips, showToast]);

  const handleApplyTake = useCallback((job: HiggsfieldJob, targetClipIndex: number) => {
    if (!activeProject) return;
    const clipIdx = (targetClipIndex >= 0 && targetClipIndex < activeClips.length)
      ? targetClipIndex
      : (activeClips.findIndex(c => c.id === job.clipId) !== -1 ? activeClips.findIndex(c => c.id === job.clipId) : (selectedTimelineClipIndex ?? currentClipIndex ?? 0));

    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const prevClip = activeClips[clipIdx];

    const existingVariants: VideoEditorClip[] = (prevClip.variants && prevClip.variants.length > 0)
      ? [...prevClip.variants]
      : [{ ...prevClip, variants: undefined, created_at: prevClip.created_at || (Date.now() - 3600000) }];

    const genDuration = job.duration || (typeof prevClip.trim_end === 'number' && typeof prevClip.trim_start === 'number' && prevClip.trim_end > prevClip.trim_start ? Number((prevClip.trim_end - prevClip.trim_start).toFixed(2)) : prevClip.duration);
    const newVariant: VideoEditorClip = {
      ...prevClip,
      id: `variant_${job.id}_${Date.now()}`,
      vid: job.file_id || job.id,
      url: job.video_url || `/api/video/${job.file_id}`,
      file_id: job.file_id || prevClip.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: undefined,
      created_at: job.createdAt || Date.now(),
      source_job_id: job.id,
      source_prompt: job.prompt
    };

    let allVariants = [...existingVariants];
    const matchIdx = allVariants.findIndex(v => v.source_job_id === job.id || (v.url && v.url === newVariant.url));
    let activeVarIdx = matchIdx;
    if (matchIdx === -1) {
      allVariants.push(newVariant);
      activeVarIdx = allVariants.length - 1;
    }

    const updatedClip: VideoEditorClip = {
      ...prevClip,
      url: newVariant.url,
      file_id: newVariant.file_id,
      duration: genDuration,
      orig_duration: genDuration,
      trim_start: 0,
      trim_end: genDuration,
      is_cut: false,
      variants: allVariants,
      active_variant_index: activeVarIdx
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    showToast(`Clip #${clipIdx + 1} active take switched (${allVariants.length} takes in vault)`, "success");
  }, [activeProject, activeClips, selectedTimelineClipIndex, currentClipIndex, updateProjectClips, showToast]);

  const handleAddToTimeline = useCallback((job: HiggsfieldJob) => {
    if (!activeProject) return;
    const dur = job.duration || 5;
    const newClip: VideoEditorClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      vid: job.file_id || `hf_${Date.now()}`,
      url: job.video_url || `/api/video/${job.file_id}`,
      file_id: job.file_id || `hf_${Date.now()}.mp4`,
      bucket_id: activeProject.master_bucket_fid,
      bucket_name: 'AI Generations',
      duration: dur,
      speed: 1,
      trim_start: 0,
      trim_end: dur,
      created_at: job.createdAt || Date.now(),
      source_job_id: job.id,
      source_prompt: job.prompt
    };
    const updated = [...activeClips, newClip];
    updateProjectClips(updated, true);
    fetch('/api/higgsfield/mark_added', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(() => {});
    setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'added' } : j));
    showToast("AI clip inserted on timeline as a new clip", "success");
  }, [activeProject, activeClips, updateProjectClips, showToast]);

  const handleRestoreGeneratedJob = useCallback(async (job: HiggsfieldJob) => {
    try {
      await fetch('/api/higgsfield/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, file_id: job.file_id })
      });
      setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'completed' } : j));
      showToast("Clip restored back to Review compartment", "success");
    } catch (_) {
      showToast("Failed to restore clip", "error");
    }
  }, [showToast]);

  const handleDirectlySave = useCallback((job: HiggsfieldJob) => {
    fetch('/api/higgsfield/mark_added', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id })
    }).catch(() => {});
    setHiggsfieldJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'added' } : j));

    // Resolve the exact target clip it was generated from and save specifically into that clip's vault
    const targetClipIdx = activeClips.findIndex(c => c.id === job.clipId);
    const resolvedIdx = targetClipIdx !== -1 
      ? targetClipIdx 
      : (typeof job.clipIndex === 'number' && job.clipIndex < activeClips.length ? job.clipIndex : (selectedTimelineClipIndex ?? currentClipIndex ?? 0));

    if (resolvedIdx >= 0 && resolvedIdx < activeClips.length) {
      const prevClip = activeClips[resolvedIdx];
      const existingVariants: VideoEditorClip[] = (prevClip.variants && prevClip.variants.length > 0)
        ? [...prevClip.variants]
        : [{ ...prevClip, variants: undefined, created_at: prevClip.created_at || (Date.now() - 3600000) }];

      const newVariant: VideoEditorClip = {
        ...prevClip,
        id: `variant_${job.id}_${Date.now()}`,
        vid: job.file_id || job.id,
        url: job.video_url || `/api/video/${job.file_id}`,
        file_id: job.file_id || prevClip.file_id,
        duration: job.duration || prevClip.duration,
        variants: undefined,
        created_at: job.createdAt || Date.now(),
        source_job_id: job.id,
        source_prompt: job.prompt
      };

      const alreadyExists = existingVariants.some(v => v.source_job_id === job.id || (v.url && v.url === newVariant.url));
      const updatedVariants = alreadyExists ? existingVariants : [...existingVariants, newVariant];

      const updatedClip: VideoEditorClip = {
        ...prevClip,
        variants: updatedVariants
      };

      const updated = [...activeClips];
      updated[resolvedIdx] = updatedClip;
      updateProjectClips(updated, true);
      showToast(`Saved specifically into Clip #${resolvedIdx + 1}'s vault (${updatedVariants.length} takes available)!`, "success");
    } else {
      showToast("AI clip saved directly to Added section & library!", "success");
    }
  }, [activeClips, selectedTimelineClipIndex, currentClipIndex, updateProjectClips, showToast]);

  // High-Performance In-Memory & CacheStorage Video Blob Engine
  // Eliminates network latency during multi-clip playback, making clip changes 100% butter-smooth even on 2G / low network
  useEffect(() => {
    let isCancelled = false;

    const prefetchClip = async (clip: VideoEditorClip) => {
      const effFileId = clip.file_id || clip.vid;
      if (!effFileId || clipBlobUrlsRef.current[clip.id]) return;

      try {
        // Fast, zero-network check: If video is already cached in phone memory/IndexedDB, use it immediately!
        // If not in IndexedDB, the HTML5 <video> element will stream it natively via byte-range requests.
        // This eliminates 100% of background double-downloading!
        const bUrl = await getExistingLocalBlobUrl(effFileId);
        if (bUrl && !isCancelled) {
          clipBlobUrlsRef.current[clip.id] = bUrl;
          setClipBlobUrls(prev => {
            if (prev[clip.id] === bUrl) return prev;
            return { ...prev, [clip.id]: bUrl };
          });
        }
      } catch (err) {
        console.warn('[VideoCache] Prefetch lookup notice for clip:', clip.id, err);
      }
    };

    // Ultra Data-Saver: Prefetch strictly on-demand (only active focus clip and at most immediate next clip)
    // Never spam the network downloading the entire timeline in parallel!
    const runPrefetchQueue = async () => {
      const activeIdx = (isLoopingClipRef.current && loopClipIndexRef.current !== null)
        ? loopClipIndexRef.current
        : currentClipIndexRef.current;
      
      const currentClip = activeClips[activeIdx];
      if (currentClip) {
        await prefetchClip(currentClip);
      }

      // If not in single-clip loop mode, prepare the next immediate clip
      if (!isCancelled && !isLoopingClipRef.current && activeIdx + 1 < activeClips.length) {
        const nextClip = activeClips[activeIdx + 1];
        if (nextClip) {
          await prefetchClip(nextClip);
        }
      }
    };

    runPrefetchQueue();

    return () => {
      isCancelled = true;
    };
  }, [activeClips, isLoopingClip, loopClipIndex]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(clipBlobUrlsRef.current).forEach(url => {
        try { URL.revokeObjectURL(url); } catch (_) {}
      });
    };
  }, []);

  // Helper to determine if a video clip should be muted (checks global isMuted, clip.is_muted, volume)
  // By default, audio is ON (unmuted)
  const getIsClipMuted = useCallback((clip?: VideoEditorClip | null): boolean => {
    if (!clip) return false;
    if (isMuted) return true;
    if (clip.is_muted === true) return true;
    if (clip.is_muted === false) return false;
    if (clip.volume !== undefined && clip.volume <= 0.001) return true;
    // Default: audio is ON (unmuted)
    return false;
  }, [isMuted]);

  // Synchronously enforce DOM property muted and volume on a specific video element
  const applyVideoElementAudio = useCallback((clipId: string, el: HTMLVideoElement | null | undefined, clip?: VideoEditorClip | null) => {
    if (!el) return;
    const targetClip = clip || activeClips.find(c => c.id === clipId);
    const muted = getIsClipMuted(targetClip);
    el.muted = muted;
    el.defaultMuted = muted;
    const targetVol = muted ? 0 : Math.max(0, Math.min(1, targetClip?.volume ?? 1));
    try {
      el.volume = targetVol;
    } catch (_) {}
  }, [activeClips, getIsClipMuted]);

  // Continuously synchronize audio/mute state across all mounted video elements
  useEffect(() => {
    activeClips.forEach(c => {
      const el = videoElementsRef.current.get(c.id);
      if (el) {
        applyVideoElementAudio(c.id, el, c);
      }
    });
  }, [activeClips, isMuted, db?.videos, applyVideoElementAudio]);

  const getClipEffectiveDuration = useCallback((clip: VideoEditorClip) => {
    const dur = clip.orig_duration || (clip.duration && clip.duration > 0 ? clip.duration : 4.0);
    const start = Math.max(0, clip.trim_start || 0);
    const rawEnd = (clip.trim_end !== undefined && clip.trim_end > start) ? clip.trim_end : dur;
    const end = Math.max(start + 0.1, Math.min(dur, rawEnd));
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
    return Math.max(0.1, (end - start) / speed);
  }, []);
  
  // Calculate per-clip layout timing & proportional pixel positioning in project timeline
  const timelineClipsMeta = useMemo(() => {
    let accumulatedTime = 0;
    let accumulatedPixels = 0;
    return activeClips.map((clip, idx) => {
      const originalDur = clip.orig_duration || (clip.duration && clip.duration > 0 ? clip.duration : 4.0);
      const trimStart = Math.max(0, clip.trim_start || 0);
      const rawTrimEnd = (clip.trim_end !== undefined && clip.trim_end > trimStart) ? clip.trim_end : originalDur;
      const trimEnd = Math.max(trimStart + 0.1, Math.min(originalDur, rawTrimEnd));
      const trimmedSpan = Math.max(0.1, trimEnd - trimStart);
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1.0;
      const effectiveDur = trimmedSpan / speed;
      const projectStartTime = accumulatedTime;
      const projectEndTime = accumulatedTime + effectiveDur;
      accumulatedTime += effectiveDur;

      // Exactly matches Track 1 rendering: Math.max(22, ...) + 2px gap (gap-0.5)
      const pixelWidth = Math.max(22, Math.round(effectiveDur * timelineZoom));
      const pixelStart = accumulatedPixels;
      const pixelEnd = accumulatedPixels + pixelWidth;
      accumulatedPixels += (idx < activeClips.length - 1 ? pixelWidth + 2 : pixelWidth);

      return {
        clip,
        originalDur,
        trimStart,
        trimEnd,
        speed,
        effectiveDur,
        projectStartTime,
        projectEndTime,
        pixelWidth,
        pixelStart,
        pixelEnd,
      };
    });
  }, [activeClips, timelineZoom, getClipEffectiveDuration]);

  const totalDuration = useMemo(() => {
    if (timelineClipsMeta.length === 0) return 0;
    return timelineClipsMeta[timelineClipsMeta.length - 1].projectEndTime;
  }, [timelineClipsMeta]);

  const totalTimelinePixels = useMemo(() => {
    if (timelineClipsMeta.length === 0) return 0;
    return timelineClipsMeta[timelineClipsMeta.length - 1].pixelEnd;
  }, [timelineClipsMeta]);

  // Higgsfield FLUX 3.0 Video Generation Handler
  // Accurately extracts and respects exact cut/trimmed segment bounds
  const handleTriggerAiGenerate = useCallback(async (prompt: string, model: string, specificClipIndex?: number) => {
    if (!activeProject) return;
    const clipIdx = (typeof specificClipIndex === 'number' && specificClipIndex >= 0 && specificClipIndex < activeClips.length)
      ? specificClipIndex
      : (selectedTimelineClipIndex !== null && selectedTimelineClipIndex >= 0 && selectedTimelineClipIndex < activeClips.length)
        ? selectedTimelineClipIndex
        : currentClipIndex;

    const targetClip = activeClips[clipIdx];
    if (!targetClip) {
      showToast("Please select a video clip to generate with AI", "warning");
      return;
    }

    const meta = timelineClipsMeta[clipIdx];
    const origDur = meta ? meta.originalDur : (targetClip.orig_duration || targetClip.duration || 5);
    const metaTrimStart = meta ? meta.trimStart : Math.max(0, targetClip.trim_start || 0);
    const rawTrimEnd = meta ? meta.trimEnd : (typeof targetClip.trim_end === 'number' && targetClip.trim_end > metaTrimStart ? targetClip.trim_end : origDur);
    const metaTrimEnd = Math.max(metaTrimStart + 0.1, rawTrimEnd);
    const effectiveDur = Math.max(0.2, Number((metaTrimEnd - metaTrimStart).toFixed(2)));
    const isCut = Boolean(
      targetClip.is_cut === true ||
      metaTrimStart > 0.02 ||
      (origDur > 0 && metaTrimEnd < origDur - 0.05) ||
      (targetClip.orig_duration && targetClip.duration && targetClip.duration < targetClip.orig_duration - 0.05)
    );

    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/higgsfield/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: targetClip.id,
          clipIndex: clipIdx,
          prompt: prompt.trim(),
          model: model || 'flux_3_video_edit',
          file_id: targetClip.file_id || targetClip.vid,
          originalClipUrl: targetClip.url,
          duration: effectiveDur,
          orig_duration: origDur,
          trim_start: metaTrimStart,
          trim_end: metaTrimEnd,
          is_cut: isCut
        })
      });
      const data = await res.json();
      if (data?.ok && data.job) {
        if (typeof data.remainingCredits === 'number') {
          setHiggsfieldCredits(data.remainingCredits);
        }
        setHiggsfieldJobs(prev => [data.job, ...prev.filter(j => j.id !== data.job.id)]);
        showToast(`AI Video generation queued for Clip #${clipIdx + 1} (${effectiveDur.toFixed(1)}s)`, "success");
        fetchHiggsfieldData();
      } else {
        showToast(data?.error || "AI generation failed to start", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to trigger AI generation", "error");
    } finally {
      setIsGeneratingAi(false);
    }
  }, [activeProject, activeClips, selectedTimelineClipIndex, currentClipIndex, timelineClipsMeta, fetchHiggsfieldData, showToast]);

  // Download All Active Clips in Strip (Accurately downloads sliced segments for cut clips)
  const handleDownloadAllActiveClips = useCallback(async () => {
    if (!activeProject || activeClips.length === 0) {
      showToast("No active clips to download", "info");
      return;
    }

    if (isDownloadingAllClips) return;
    setIsDownloadingAllClips(true);
    showToast(`Downloading all ${activeClips.length} active clips to your device...`, "info");

    try {
      let downloadedCount = 0;
      for (let idx = 0; idx < activeClips.length; idx++) {
        const clip = activeClips[idx];
        const meta = timelineClipsMeta[idx];
        const origDur = meta ? meta.originalDur : (clip.orig_duration || clip.duration || 0);
        const tStart = meta ? meta.trimStart : (typeof clip.trim_start === 'number' ? clip.trim_start : 0);
        const rawEnd = meta ? meta.trimEnd : (typeof clip.trim_end === 'number' && clip.trim_end > tStart ? clip.trim_end : origDur);
        const tEnd = rawEnd > tStart ? rawEnd : (origDur > tStart ? origDur : tStart + (clip.duration || 5));
        const segDur = Math.max(0.1, Number((tEnd - tStart).toFixed(2)));

        const isCut = Boolean(
          clip.is_cut ||
          tStart > 0.02 ||
          (origDur > 0 && tEnd < origDur - 0.05) ||
          (clip.orig_duration && clip.duration && clip.duration < clip.orig_duration - 0.05)
        );

        const fileId = clip.file_id || clip.vid || clip.id || '';
        const projName = (activeProject.name || 'project').replace(/[^\w.-]/g, '_');
        const clipFilename = `${projName}_clip_${idx + 1}_${Date.now()}.mp4`;

        let downloadUrl = '';
        if (isCut) {
          // Precisely download the cut segment
          downloadUrl = `/api/video/segment?fileId=${encodeURIComponent(fileId)}&url=${encodeURIComponent(clip.url || '')}&trim_start=${tStart.toFixed(3)}&trim_end=${tEnd.toFixed(3)}&duration=${segDur}&is_cut=true&filename=${encodeURIComponent(clipFilename)}`;
        } else {
          // If not cut, use direct stream or standard video endpoint
          if (clip.url && (clip.url.startsWith('http') || clip.url.startsWith('/api/merged_video/') || clip.url.startsWith('/renders/'))) {
            downloadUrl = clip.url;
          } else if (fileId) {
            downloadUrl = `/api/video/${encodeURIComponent(fileId)}`;
          } else if (clip.url) {
            downloadUrl = clip.url;
          }
        }

        if (!downloadUrl) continue;

        try {
          const resp = await fetch(downloadUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = clipFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
            downloadedCount++;
          } else {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = clipFilename;
            a.target = '_blank';
            a.rel = 'noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            downloadedCount++;
          }
        } catch (_) {
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = clipFilename;
          a.target = '_blank';
          a.rel = 'noreferrer';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          downloadedCount++;
        }

        // Small pacing delay between clips so browser does not block multi-file downloads
        if (idx < activeClips.length - 1) {
          await new Promise(r => setTimeout(r, 450));
        }
      }

      showToast(`Downloaded ${downloadedCount} of ${activeClips.length} clips to your device`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to download active clips", "error");
    } finally {
      setIsDownloadingAllClips(false);
    }
  }, [activeProject, activeClips, timelineClipsMeta, isDownloadingAllClips, showToast]);

  // Helper to get effective duration of an audio clip
  const getAudioClipEffectiveDuration = useCallback((clip: VideoEditorAudioClip): number => {
    const dur = clip.duration && clip.duration > 0 ? clip.duration : 30.0;
    const start = clip.trim_start || 0;
    const end = (clip.trim_end !== undefined && clip.trim_end > start) ? clip.trim_end : dur;
    const speed = clip.speed || 1.0;
    return Math.max(0.1, (end - start) / speed);
  }, []);

  // Helper to reliably resolve candidate playable URLs for any audio clip (mirroring AudioDashboard's resilient ladder)
  const getAudioClipUrlCandidates = useCallback((clip: VideoEditorAudioClip): string[] => {
    const audItem = clip.audio_id 
      ? (db?.audios?.[clip.audio_id] || Object.values(db?.audios || {}).find(a => a.id === clip.audio_id || a.file_id === clip.audio_id))
      : null;
    const fileId = clip.file_id || audItem?.file_id || clip.audio_id;
    const audioFilename = clip.url ? clip.url.split('/').pop()?.split('?')[0] : (audItem?.url ? audItem.url.split('/').pop()?.split('?')[0] : '');
    
    const candidates = [
      (clip as any).data_url,
      (audItem as any)?.data_url,
      clip.url,
      audItem?.url,
      clip.audio_id ? `/api/audio/${clip.audio_id}` : null,
      fileId ? `/api/audio/${fileId}` : null,
      fileId ? `/api/video/${fileId}` : null,
      audioFilename ? `/api/render_asset/${audioFilename}` : null,
      audioFilename ? `/renders/${audioFilename}` : null,
      clip.audio_id ? `/api/audio/stream/${clip.audio_id}` : null,
    ].filter(Boolean) as string[];

    return Array.from(new Set(candidates));
  }, [db?.audios]);

  // Active Audio Clips (Sequential/layered audio timeline)
  // Always respects whatever music has been added to this video project
  const activeAudioClips: VideoEditorAudioClip[] = useMemo(() => {
    // 1. Explicit audio clips on project timeline
    if (activeProject?.audio_clips && activeProject.audio_clips.length > 0) {
      return activeProject.audio_clips;
    }
    // 2. Project-level background music (audio_url or audio_id)
    if (activeProject?.audio_url || activeProject?.audio_id) {
      const dbAud = activeProject.audio_id 
        ? (db?.audios?.[activeProject.audio_id] || Object.values(db?.audios || {}).find(a => a.id === activeProject.audio_id || a.file_id === activeProject.audio_id)) 
        : null;
      const resolvedUrl = activeProject.audio_url || dbAud?.url || (activeProject.audio_id ? `/api/audio/${activeProject.audio_id}` : '');
      if (resolvedUrl) {
        const dur = activeProject.audio_duration || dbAud?.duration || 30;
        return [{
          id: 'aud_clip_primary',
          audio_id: activeProject.audio_id || dbAud?.id,
          name: activeProject.audio_name || dbAud?.name || 'Background Soundtrack',
          url: resolvedUrl,
          file_id: activeProject.audio_id || dbAud?.file_id,
          duration: dur,
          start_time: 0,
          trim_start: 0,
          trim_end: dur,
          speed: 1,
          volume: activeProject.audio_volume ?? 1,
          track_layer: 0
        }];
      }
    }
    return [];
  }, [activeProject?.audio_clips, activeProject?.audio_url, activeProject?.audio_name, activeProject?.audio_duration, activeProject?.audio_volume, activeProject?.audio_id, db?.audios]);

  // Helper to retrieve folder_audio_settings for current master bucket, parent folder, or root bucket
  const getBucketAudioSettings = useCallback((targetFid?: string | null) => {
    if (!targetFid || !db?.folder_audio_settings) return null;
    // 1. Direct match on current master bucket
    const direct = db.folder_audio_settings[targetFid];
    if (direct && ((direct.starred_audio_ids && direct.starred_audio_ids.length > 0) || direct.default_audio_id)) {
      return direct;
    }
    // 2. Parent / ancestor folder check if in a sub-bucket within project hierarchy
    let curr = db.folders?.[targetFid]?.parent;
    let guard = 0;
    while (curr && curr !== 'root' && guard < 20) {
      guard++;
      const parentSettings = db.folder_audio_settings[curr];
      if (parentSettings && ((parentSettings.starred_audio_ids && parentSettings.starred_audio_ids.length > 0) || parentSettings.default_audio_id)) {
        return parentSettings;
      }
      curr = db.folders?.[curr]?.parent;
    }
    // STRICT: Never fall back to 'root' or global settings.
    // If this specific bucket or its project folder has no starred/default tracks, return null so NO music is added or swapped!
    return null;
  }, [db?.folder_audio_settings, db?.folders]);

  // Starred Audio tracks for M1, M2, M3, M4 Quick Music Switcher
  const starredAudios: AudioItem[] = useMemo(() => {
    const all = Object.values(db?.audios || {});
    const projStarredIds = activeProject?.starred_audio_ids || [];
    const hiddenSet = new Set(activeProject?.hidden_audio_ids || []);

    // 1. Explicitly starred on active project
    if (projStarredIds.length > 0) {
      const list = projStarredIds
        .filter(id => !hiddenSet.has(id))
        .map(id => all.find(a => a.id === id) || (db?.audios && db.audios[id]))
        .filter(Boolean) as AudioItem[];
      if (list.length > 0) return list;
    }

    // 2. Master bucket folder audio settings
    const bucketAudioSettings = getBucketAudioSettings(masterBucketFid);
    const bucketStarredIds = bucketAudioSettings?.starred_audio_ids || [];
    if (bucketStarredIds.length > 0) {
      const list = bucketStarredIds
        .filter(id => !hiddenSet.has(id))
        .map(id => all.find(a => a.id === id) || (db?.audios && db.audios[id]))
        .filter(Boolean) as AudioItem[];
      if (list.length > 0) return list;
    }

    // 3. Audio clips currently on project timeline
    if (activeProject?.audio_clips && activeProject.audio_clips.length > 0) {
      const clipsAudios = activeProject.audio_clips
        .map(c => all.find(a => a.id === c.audio_id || a.url === c.url))
        .filter(Boolean) as AudioItem[];
      if (clipsAudios.length > 0) return clipsAudios;
    }

    // 4. Audios in db belonging to this master bucket or marked starred
    const bucketAudios = all.filter(a => 
      !hiddenSet.has(a.id) && (
        a.folder_id === masterBucketFid ||
        (a as any).master_bucket_fid === masterBucketFid ||
        a.is_starred
      )
    );
    if (bucketAudios.length > 0) return bucketAudios;

    // 5. Any audios in database not hidden (up to 8)
    const availableAudios = all.filter(a => !hiddenSet.has(a.id));
    if (availableAudios.length > 0) return availableAudios.slice(0, 8);

    return [];
  }, [db?.audios, activeProject?.starred_audio_ids, activeProject?.hidden_audio_ids, activeProject?.audio_clips, masterBucketFid, getBucketAudioSettings]);

  // Commit updated audio clips to project and synchronize legacy single-audio fields
  const updateProjectAudioClips = useCallback((newAudioClips: VideoEditorAudioClip[], pushUndo = true, persist = true) => {
    const proj = activeProjectRef.current;
    if (!proj) return;
    if (pushUndo) {
      pushHistorySnapshot();
    }
    const cleanClips = newAudioClips.map(clip => ({
      ...clip,
      start_time: Math.max(0, Number((clip.start_time !== undefined ? clip.start_time : 0).toFixed(2)))
    }));

    const primary = cleanClips[0];
    const updated: VideoEditorProject = {
      ...proj,
      audio_clips: cleanClips,
      audio_id: primary ? (primary.audio_id || primary.id) : undefined,
      audio_url: primary ? primary.url : undefined,
      audio_name: primary ? primary.name : undefined,
      audio_duration: primary ? primary.duration : undefined,
      audio_volume: primary ? primary.volume : undefined,
      updated_at: Date.now()
    };
    activeProjectRef.current = updated;
    setActiveProject(updated);
    if (persist) {
      onSaveProject(updated);
    }
  }, [pushHistorySnapshot, onSaveProject]);

  // Helper to attach or remove background soundtrack for the active project
  const updateProjectAudio = useCallback((audio: AudioItem | null) => {
    if (!activeProject) return;
    pushHistorySnapshot();
    if (!audio) {
      const updated: VideoEditorProject = {
        ...activeProject,
        audio_id: undefined,
        audio_url: undefined,
        audio_name: undefined,
        audio_duration: undefined,
        audio_clips: [],
        updated_at: Date.now()
      };
      setActiveProject(updated);
      onSaveProject(updated);
      showToast("Audio tracks removed from project", "info");
      return;
    }

    // Project background music always starts at 0:00 to cover the video from the beginning
    const maxAllowedDur = totalDuration > 0 ? totalDuration : (audio.duration || 30);
    const audioDur = audio.duration || 30;
    const initialTrimEnd = Math.min(audioDur, Number(maxAllowedDur.toFixed(2)));

    const newClip: VideoEditorAudioClip = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      audio_id: audio.id,
      name: audio.name,
      url: audio.url,
      duration: audioDur,
      start_time: 0,
      trim_start: 0,
      trim_end: initialTrimEnd,
      speed: 1,
      volume: 1,
      track_layer: 0
    };

    const boundedClips = totalDuration > 0
      ? autoCorrectAudioClipsForVideoDuration([newClip], totalDuration)
      : [newClip];

    const updated: VideoEditorProject = {
      ...activeProject,
      audio_id: audio.id,
      audio_url: audio.url,
      audio_name: audio.name,
      audio_duration: audio.duration,
      audio_clips: boundedClips,
      starred_audio_ids: Array.from(new Set([...(activeProject.starred_audio_ids || []), audio.id])),
      updated_at: Date.now()
    };
    activeProjectRef.current = updated;
    setActiveProject(updated);
    onSaveProject(updated);
    showToast(`Inserted "${audio.name}" fitted to video`, "success");
  }, [activeProject, totalDuration, onSaveProject, pushHistorySnapshot, autoCorrectAudioClipsForVideoDuration, showToast]);

  // Helper to determine the best track layer for an audio clip at a target start time
  // If the target or current strip has a collision at playhead, smoothly finds the next strip!
  const findAvailableAudioLayer = useCallback((startTime: number, dur: number, preferredLayer?: number): number => {
    const endTime = startTime + dur;
    const maxExistingLayer = activeAudioClips.reduce((max, c) => Math.max(max, c.track_layer || 0), -1);

    // If preferredLayer was explicitly requested:
    if (preferredLayer !== undefined && preferredLayer >= 0) {
      // 1. Check if the requested strip has space for this clip at startTime
      const clipsOnPref = activeAudioClips.filter(c => (c.track_layer || 0) === preferredLayer);
      const hasCollision = clipsOnPref.some(c => {
        const cStart = c.start_time !== undefined ? c.start_time : 0;
        const cDur = getAudioClipEffectiveDuration(c);
        const cEnd = cStart + cDur;
        return Math.max(startTime, cStart) < Math.min(endTime, cEnd) - 0.05;
      });
      if (!hasCollision) {
        return preferredLayer;
      }

      // 2. Requested strip is blocked at this playhead: smoothly search next strip (preferredLayer + 1...)
      for (let layer = preferredLayer + 1; layer <= Math.max(0, maxExistingLayer); layer++) {
        const clips = activeAudioClips.filter(c => (c.track_layer || 0) === layer);
        const collision = clips.some(c => {
          const cStart = c.start_time !== undefined ? c.start_time : 0;
          const cDur = getAudioClipEffectiveDuration(c);
          const cEnd = cStart + cDur;
          return Math.max(startTime, cStart) < Math.min(endTime, cEnd) - 0.05;
        });
        if (!collision) return layer;
      }

      // All strips from preferredLayer upwards are occupied at playhead: allocate next fresh strip!
      return Math.max(maxExistingLayer + 1, preferredLayer + 1);
    }

    // No preferred layer specified: scan from Strip 1 (layer 0) upwards
    for (let layer = 0; layer <= Math.max(0, maxExistingLayer); layer++) {
      const clipsOnLayer = activeAudioClips.filter(c => (c.track_layer || 0) === layer);
      const hasCollision = clipsOnLayer.some(c => {
        const cStart = c.start_time !== undefined ? c.start_time : 0;
        const cDur = getAudioClipEffectiveDuration(c);
        const cEnd = cStart + cDur;
        // Collision if intervals overlap at the needle position
        return Math.max(startTime, cStart) < Math.min(endTime, cEnd) - 0.05;
      });

      if (!hasCollision) {
        return layer;
      }
    }

    // All existing layers have collision at this playhead position: smoothly add to next strip!
    return Math.max(0, maxExistingLayer) + 1;
  }, [activeAudioClips, getAudioClipEffectiveDuration]);

  // Add an additional audio clip to the timeline starting at the center mark / playhead
  // Automatically detects if the current strip is occupied and smoothly moves to next strip!
  const handleAddAudioClip = useCallback((audio: AudioItem, targetLayer?: number) => {
    // Filter out synthetic temporary primary placeholder so it doesn't get cloned
    const existingRealClips = (activeProject?.audio_clips || []).filter(c => c.id !== 'aud_clip_primary');
    const hasLayer0Clips = existingRealClips.some(c => (c.track_layer || 0) === 0);

    // If placing on layer 0 and layer 0 is currently empty, start cleanly at 0.0s for full music coverage
    let targetStartTime = (targetLayer === 0 && !hasLayer0Clips) || existingRealClips.length === 0
      ? 0
      : Math.max(0, Number(projectCurrentTimeRef.current.toFixed(2)));

    if (totalDuration > 0 && targetStartTime >= totalDuration - 0.2) {
      targetStartTime = 0;
    }
    const maxAllowedDur = totalDuration > 0 ? Math.max(0.2, totalDuration - targetStartTime) : (audio.duration || 30);
    const audioDur = audio.duration || 30;
    const initialTrimEnd = Math.min(audioDur, Number(maxAllowedDur.toFixed(2)));
    const effDur = Math.max(0.1, initialTrimEnd);

    // Smoothly resolve layer: if space on current strip, use it; otherwise automatically put on next strip
    const assignedLayer = findAvailableAudioLayer(targetStartTime, effDur, targetLayer);

    const newClip: VideoEditorAudioClip = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      audio_id: audio.id,
      file_id: audio.file_id || audio.id,
      name: audio.name,
      url: audio.url,
      duration: audioDur,
      start_time: targetStartTime,
      trim_start: 0,
      trim_end: initialTrimEnd,
      speed: 1,
      volume: 1,
      track_layer: assignedLayer
    };

    const updated = [...existingRealClips, newClip];
    if (activeProject) {
      pushHistorySnapshot();
      const curStarred = new Set(activeProject.starred_audio_ids || []);
      if (audio.id) curStarred.add(audio.id);
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        starred_audio_ids: Array.from(curStarred),
        audio_id: audio.id,
        audio_url: audio.url,
        audio_name: audio.name,
        audio_duration: audioDur,
        audio_clips: updated,
        updated_at: Date.now()
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    setSelectedAudioClipIndex(updated.length - 1);
    setSelectedTimelineClipIndex(null as any);
    setSelectedCaptionId(null);
    showToast(`Added "${audio.name}" to Strip A${assignedLayer + 1} at ${targetStartTime.toFixed(1)}s`, "success");
  }, [activeProject, totalDuration, findAvailableAudioLayer, onSaveProject, pushHistorySnapshot, showToast]);

  // Replace a specific audio clip in the timeline
  const handleReplaceAudioClip = useCallback((clipIdx: number, audio: AudioItem) => {
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const oldClip = activeAudioClips[clipIdx];
    const dur = audio.duration || 30;
    const replaced: VideoEditorAudioClip = {
      id: oldClip.id || `aud_${Date.now()}`,
      audio_id: audio.id,
      file_id: audio.file_id || audio.id,
      name: audio.name,
      url: audio.url,
      duration: dur,
      start_time: oldClip.start_time !== undefined ? oldClip.start_time : 0,
      trim_start: 0,
      trim_end: dur,
      speed: oldClip.speed || 1,
      volume: oldClip.volume ?? 1,
      track_layer: oldClip.track_layer || 0
    };
    const updated = [...activeAudioClips];
    updated[clipIdx] = replaced;
    updateProjectAudioClips(updated, true);
    if (activeProject && audio.id) {
      const curStarred = new Set(activeProject.starred_audio_ids || []);
      curStarred.add(audio.id);
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        starred_audio_ids: Array.from(curStarred),
        audio_id: audio.id,
        audio_url: audio.url,
        audio_name: audio.name,
        audio_duration: dur,
        audio_clips: updated,
        updated_at: Date.now()
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    showToast(`Replaced track with "${audio.name}"`, "success");
  }, [activeAudioClips, updateProjectAudioClips, activeProject, onSaveProject, showToast]);

  // Move audio clip from one index to another (drag-to-reorder, arrows)
  const handleMoveAudioClip = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= activeAudioClips.length || toIdx >= activeAudioClips.length) return;
    const updated = [...activeAudioClips];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    updateProjectAudioClips(updated, true);
    setSelectedAudioClipIndex(toIdx);
  }, [activeAudioClips, updateProjectAudioClips]);

  // Move audio clip to a specific track layer (0 = Layer 1, 1 = Layer 2 for simultaneous playback)
  const handleMoveAudioClipToLayer = useCallback((clipIdx: number, newLayer: number) => {
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const targetClip = activeAudioClips[clipIdx];
    const cleanLayer = Math.max(0, newLayer);
    const updated = [...activeAudioClips];
    updated[clipIdx] = { ...targetClip, track_layer: cleanLayer };
    updateProjectAudioClips(updated, true);
    showToast(`Moved music to Audio Layer ${cleanLayer + 1} (Plays simultaneously)`, "info");
  }, [activeAudioClips, updateProjectAudioClips, showToast]);

  // Delete audio clip from timeline
  const handleDeleteAudioClip = useCallback((clipIdx: number) => {
    if (isPlaying) setIsPlaying(false);
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const updated = activeAudioClips.filter((_, i) => i !== clipIdx);
    updateProjectAudioClips(updated, true);
    setSelectedAudioClipIndex(null);
    setActiveInlineControl(null);
    showToast("Audio clip removed", "info");
  }, [activeAudioClips, updateProjectAudioClips, isPlaying, showToast]);

  // Chop / Split audio clip at current playhead position
  const handleChopAudioClip = useCallback((clipIdx: number) => {
    const target = activeAudioClips[clipIdx];
    if (!target) return;

    // Start time of this audio clip in project timeline
    const audioStartTime = target.start_time !== undefined ? target.start_time : 0;
    const relativeTime = projectCurrentTime - audioStartTime;
    const clipEffDur = getAudioClipEffectiveDuration(target);

    if (relativeTime <= 0.2 || relativeTime >= clipEffDur - 0.2) {
      showToast("Position playhead inside the audio clip to chop", "warning");
      return;
    }

    const speed = target.speed || 1;
    const localSplit = (target.trim_start || 0) + (relativeTime * speed);

    const firstHalf: VideoEditorAudioClip = {
      ...target,
      id: `aud_${Date.now()}_a`,
      trim_end: Number(localSplit.toFixed(2))
    };

    // Ensure the second half strictly fits within the remaining video duration
    const maxAllowedDurForSecond = totalDuration > 0 ? Math.max(0.1, totalDuration - projectCurrentTime) : 9999;
    const secondHalfTrimStart = Number(localSplit.toFixed(2));
    const targetTrimEnd = (target.trim_end !== undefined && target.trim_end > secondHalfTrimStart)
      ? target.trim_end
      : (target.duration || 30);
    const calculatedSecondTrimEnd = Math.min(targetTrimEnd, secondHalfTrimStart + (maxAllowedDurForSecond * speed));

    const secondHalf: VideoEditorAudioClip = {
      ...target,
      id: `aud_${Date.now()}_b`,
      start_time: Number(projectCurrentTime.toFixed(2)),
      trim_start: secondHalfTrimStart,
      trim_end: Number(calculatedSecondTrimEnd.toFixed(2))
    };

    const updated = [...activeAudioClips];
    updated.splice(clipIdx, 1, firstHalf, secondHalf);
    updateProjectAudioClips(updated, true);
    setSelectedAudioClipIndex(clipIdx + 1);
    showToast("Chopped audio track into 2 clips", "success");
  }, [activeAudioClips, getAudioClipEffectiveDuration, projectCurrentTime, totalDuration, updateProjectAudioClips, showToast]);

  // Duplicate an audio clip in the timeline
  const handleDuplicateAudioClip = useCallback((clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const target = activeAudioClips[clipIdx];
    const effDur = getAudioClipEffectiveDuration(target);
    const newStart = Number(((target.start_time || 0) + effDur).toFixed(2));
    if (totalDuration > 0 && newStart >= totalDuration - 0.1) {
      showToast("Cannot duplicate: audio track already reaches video end", "warning");
      return;
    }
    const maxAllowed = totalDuration > 0 ? Math.max(0.1, totalDuration - newStart) : effDur;
    const boundedEff = Math.min(effDur, maxAllowed);
    const speed = target.speed || 1;
    const duplicated: VideoEditorAudioClip = {
      ...target,
      id: `aud_dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      start_time: newStart,
      trim_end: Number(((target.trim_start || 0) + (boundedEff * speed)).toFixed(2))
    };
    const updated = [...activeAudioClips];
    updated.splice(clipIdx + 1, 0, duplicated);
    updateProjectAudioClips(updated, true);
    setSelectedAudioClipIndex(clipIdx + 1);
    showToast("Duplicated audio track", "success");
  }, [activeAudioClips, getAudioClipEffectiveDuration, totalDuration, updateProjectAudioClips, showToast]);

  // Update audio volume (0% to 200%)
  const handleUpdateAudioVolume = useCallback((clipIdx: number, newVol: number) => {
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const cleanVol = Math.max(0, Math.min(2, Math.round(newVol * 100) / 100));
    const targetClip = activeAudioClips[clipIdx];
    const updated = [...activeAudioClips];
    updated[clipIdx] = { ...targetClip, volume: cleanVol };
    updateProjectAudioClips(updated);
  }, [activeAudioClips, updateProjectAudioClips]);

  // Update audio speed (0.25x to 3.0x)
  const handleUpdateAudioSpeed = useCallback((clipIdx: number, newSpeed: number) => {
    if (clipIdx < 0 || clipIdx >= activeAudioClips.length) return;
    const cleanSpeed = Math.max(0.25, Math.min(3, Math.round(newSpeed * 100) / 100));
    const targetClip = activeAudioClips[clipIdx];
    const updated = [...activeAudioClips];
    updated[clipIdx] = { ...targetClip, speed: cleanSpeed };
    updateProjectAudioClips(updated);
  }, [activeAudioClips, updateProjectAudioClips]);

  // Toggle Mute on Currently Playing or Selected Video Clip
  const handleToggleClipMuteByIndex = useCallback((targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= activeClips.length) return;
    const clip = activeClips[targetIdx];
    if (!clip) return;
    const isCurrentlyMuted = getIsClipMuted(clip);
    const nextMuted = !isCurrentlyMuted;

    const updatedClips = activeClips.map((c, idx) => {
      if (idx === targetIdx) {
        return {
          ...c,
          is_muted: nextMuted,
          volume: nextMuted ? 0 : (c.volume && c.volume > 0.001 ? c.volume : 1.0)
        };
      }
      return c;
    });

    updateProjectClips(updatedClips, true, true);

    const vidEl = videoElementsRef.current.get(clip.id);
    if (vidEl) {
      vidEl.muted = nextMuted;
      vidEl.defaultMuted = nextMuted;
      try {
        vidEl.volume = nextMuted ? 0 : (clip.volume && clip.volume > 0.001 ? clip.volume : 1.0);
      } catch (_) {}
    }

    if (clip.vid && db?.videos?.[clip.vid] && setDb) {
      setDb(prev => {
        if (!prev || !prev.videos || !prev.videos[clip.vid!]) return prev;
        return {
          ...prev,
          videos: {
            ...prev.videos,
            [clip.vid!]: {
              ...prev.videos[clip.vid!],
              audio_muted: nextMuted
            }
          }
        };
      });
    }

    showToast(
      nextMuted 
        ? `Muted audio for clip #${targetIdx + 1} (${clip.bucket_name || 'Clip'})` 
        : `Unmuted audio for clip #${targetIdx + 1} (${clip.bucket_name || 'Clip'})`,
      "info"
    );
  }, [activeClips, getIsClipMuted, updateProjectClips, db?.videos, setDb, showToast]);

  const handleToggleCurrentClipMute = useCallback(() => {
    if (activeClips.length === 0) return;
    const targetIdx = (currentClipIndex >= 0 && currentClipIndex < activeClips.length) ? currentClipIndex : 0;
    handleToggleClipMuteByIndex(targetIdx);
  }, [activeClips.length, currentClipIndex, handleToggleClipMuteByIndex]);

  // Mute or Unmute Audio for All Video Clips in Current Project
  const handleMuteAllClips = useCallback((mute: boolean) => {
    if (activeClips.length === 0) {
      setShowMuteAllClipsModal(false);
      return;
    }
    const updatedClips = activeClips.map(c => ({
      ...c,
      is_muted: mute,
      volume: mute ? 0 : (c.volume && c.volume > 0.001 ? c.volume : 1.0)
    }));
    updateProjectClips(updatedClips, true, true);

    videoElementsRef.current.forEach((el) => {
      if (el) {
        el.muted = isMuted || mute;
        try {
          el.volume = (isMuted || mute) ? 0 : 1.0;
        } catch (_) {}
      }
    });

    setShowMuteAllClipsModal(false);
    showToast(
      mute 
        ? `Muted original audio from all ${activeClips.length} video clips` 
        : `Restored audio for all ${activeClips.length} video clips`,
      "success"
    );
  }, [activeClips, isMuted, updateProjectClips, showToast]);

  // Open Combine & Merge Audios Modal
  const handleOpenCombineAudioModal = useCallback(() => {
    if (activeAudioClips.length === 0) {
      showToast("Add at least one audio track to the timeline to combine", "warning");
      return;
    }
    const defaultName = `${activeProject?.name || masterBucketName || 'Reel'} Combined Audio`;
    setCombineAudioName(defaultName);
    setCombineFolderId('root');
    setIsCreatingNewCombineFolder(false);
    setNewCombineFolderName('');
    setShowCombineAudioModal(true);
  }, [activeAudioClips.length, activeProject?.name, masterBucketName, showToast]);

  // Execute Audio Merging on Server Pipeline
  const handleExecuteCombineAudios = useCallback(async () => {
    if (isCombiningAudios) return;
    if (activeAudioClips.length === 0) {
      showToast("No audio tracks on timeline to combine", "warning");
      return;
    }
    const trimmedName = combineAudioName.trim() || `${activeProject?.name || 'Reel'} Combined Audio`;
    let targetFolderId = combineFolderId;

    setIsCombiningAudios(true);
    try {
      // If user specified a brand new folder, create it first
      if (isCreatingNewCombineFolder && newCombineFolderName.trim()) {
        try {
          const fRes = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_audio_folder',
              payload: {
                name: newCombineFolderName.trim(),
                userEmail: currentUserEmail
              }
            })
          });
          const fData = await fRes.json();
          if (fRes.ok && fData.folder?.id) {
            targetFolderId = fData.folder.id;
          }
        } catch (_) {}
      }

      // Call server to blend, delay-sync, and merge tracks with FFmpeg
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'combine_audio_tracks',
          payload: {
            audio_clips: activeAudioClips,
            name: trimmedName,
            folder_id: targetFolderId,
            master_bucket_fid: masterBucketFid
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.audio) {
        throw new Error(data.error || "Failed to combine audio tracks");
      }

      const newAudio: AudioItem = data.audio;
      if (data.db && setDb) {
        setDb(data.db);
        try {
          localStorage.setItem('remixx_cached_db', JSON.stringify(data.db));
        } catch (_) {}
      }

      // Build single unified timeline audio clip spanning the entire synced duration
      const effectiveAudioUrl = newAudio.url || `/api/audio/${newAudio.id}`;
      const mergedTimelineClip: VideoEditorAudioClip = {
        id: `aud_${Date.now()}_${newAudio.id}`,
        audio_id: newAudio.id,
        file_id: newAudio.file_id || newAudio.id,
        name: newAudio.name,
        url: effectiveAudioUrl,
        duration: newAudio.duration,
        trim_start: 0,
        trim_end: newAudio.duration,
        speed: 1,
        volume: 1,
        start_time: 0,
        track_layer: 0
      };

      // Ensure newly combined track is added to starred_audio_ids so it's starred in this project and master bucket
      const currentStarred = new Set(activeProject?.starred_audio_ids || []);
      currentStarred.add(newAudio.id);

      if (activeProject) {
        const updatedProj: VideoEditorProject = {
          ...activeProject,
          audio_clips: [mergedTimelineClip],
          starred_audio_ids: Array.from(currentStarred),
          audio_id: newAudio.id,
          audio_url: effectiveAudioUrl,
          audio_name: newAudio.name,
          audio_duration: newAudio.duration,
          audio_volume: 1,
          updated_at: Date.now()
        };
        setActiveProject(updatedProj);
        onSaveProject(updatedProj);
      }

      setSelectedAudioClipIndex(0);
      setShowCombineAudioModal(false);
      showToast(`Merged & synced ${activeAudioClips.length} tracks into "${newAudio.name}"! Saved to folder and starred ⭐`, "success");
    } catch (err: any) {
      console.error("Combine audios error:", err);
      showToast(err.message || "Failed to combine audios", "error");
    } finally {
      setIsCombiningAudios(false);
    }
  }, [
    activeAudioClips,
    activeProject,
    combineAudioName,
    combineFolderId,
    currentUserEmail,
    isCombiningAudios,
    isCreatingNewCombineFolder,
    masterBucketFid,
    newCombineFolderName,
    onSaveProject,
    setDb,
    showToast
  ]);

  // Micro-Trimming for Audio Clips (Handle Dragging)
  const handleAudioTrimPointerDown = useCallback((
    e: React.PointerEvent<HTMLDivElement>,
    clipIdx: number,
    handleType: 'start' | 'end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pauseAllPlayback();
    isUserScrubbingTrackRef.current = true;
    const clip = activeAudioClips[clipIdx];
    if (!clip) return;

    const dur = clip.duration && clip.duration > 0 ? clip.duration : 30.0;
    const trimStart = clip.trim_start || 0;
    const trimEnd = clip.trim_end !== undefined ? clip.trim_end : dur;
    const pxPerSec = timelineZoom;

    setTrimmingAudioHandle(handleType);
    setSelectedAudioClipIndex(clipIdx);

    const startX = e.clientX;
    const initialTrimStart = trimStart;
    const initialTrimEnd = trimEnd;

    const targetElement = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      targetElement.setPointerCapture(pointerId);
    } catch (_) {}

    let latestClips = activeAudioClips;

    const onWindowPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const deltaX = ev.clientX - startX;
      const deltaSec = deltaX / pxPerSec;

      const currentProj = activeProjectRef.current;
      const currentAudioClips = currentProj?.audio_clips || activeAudioClips;
      const targetClips = [...currentAudioClips];
      const targetClip = targetClips[clipIdx];
      if (!targetClip) return;

      if (handleType === 'start') {
        const newStart = Math.max(0, Math.min(initialTrimEnd - 0.2, initialTrimStart + deltaSec));
        const rounded = Math.round(newStart * 50) / 50;
        targetClips[clipIdx] = { ...targetClip, trim_start: rounded };
      } else {
        const newEnd = Math.min(dur, Math.max(initialTrimStart + 0.2, initialTrimEnd + deltaSec));
        const rounded = Math.round(newEnd * 50) / 50;
        targetClips[clipIdx] = { ...targetClip, trim_end: rounded };
      }

      latestClips = targetClips;
      updateProjectAudioClips(targetClips, false, false);
    };

    const onWindowPointerUp = () => {
      try {
        targetElement.releasePointerCapture(pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      setTrimmingAudioHandle(null);
      isUserScrubbingTrackRef.current = false;
      updateProjectAudioClips(latestClips, true, true);
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp);
  }, [activeAudioClips, timelineZoom, totalDuration, updateProjectAudioClips]);

  // Free-Form Audio Pointer Drag State (Smooth horizontal time shift & vertical layer change)
  // Free-Form Audio Pointer Drag State (Requires explicit Long-Press to drag, allowing normal timeline scrolling on swipe)
  const audioDragStateRef = useRef<{
    clipId: string;
    clipIdx: number;
    startClientX: number;
    startClientY: number;
    initStartTime: number;
    initLayer: number;
    isLongPressActive: boolean;
    hasMoved: boolean;
    pointerId: number;
  } | null>(null);
  const [activeDraggingAudioId, setActiveDraggingAudioId] = useState<string | null>(null);
  const [audioDragVisual, setAudioDragVisual] = useState<{
    clipId: string;
    deltaX: number;
    deltaY: number;
    currentStartTime: number;
    targetLayer: number;
  } | null>(null);
  const audioDragVisualRef = useRef<{
    clipId: string;
    deltaX: number;
    deltaY: number;
    currentStartTime: number;
    targetLayer: number;
  } | null>(null);
  audioDragVisualRef.current = audioDragVisual;

  const handleAudioClipPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clipIdx: number
  ) => {
    // If clicking on trim handle or options menu button, ignore drag
    if ((e.target as HTMLElement).closest('[data-audio-no-drag]')) return;
    if (trimmingAudioHandle) return;

    const targetClip = activeAudioClips[clipIdx];
    if (!targetClip) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const initStartTime = targetClip.start_time !== undefined ? targetClip.start_time : 0;
    const initLayer = targetClip.track_layer || 0;

    // Clear any pending timer
    if (audioLongPressTimerRef.current) {
      clearTimeout(audioLongPressTimerRef.current);
      audioLongPressTimerRef.current = null;
    }

    audioDragStateRef.current = {
      clipId: targetClip.id,
      clipIdx,
      startClientX: startX,
      startClientY: startY,
      initStartTime,
      initLayer,
      isLongPressActive: false,
      hasMoved: false,
      pointerId
    };

    // Long press timer (260ms): Responsive hold to activate drag mode without accidental drags on swipe
    audioLongPressTimerRef.current = setTimeout(() => {
      if (!audioDragStateRef.current) return;
      audioDragStateRef.current.isLongPressActive = true;
      setActiveDraggingAudioId(targetClip.id);
      setSelectedAudioClipIndex(clipIdx);
      setSelectedTimelineClipIndex(null as any);
      pauseAllPlayback();
      isUserScrubbingTrackRef.current = true;
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(35);
        }
      } catch (_) {}
      showToast("Audio drag activated: Drag left/right to reposition or up/down to switch strip", "info");
    }, 260);

    const onPointerMove = (ev: PointerEvent) => {
      if (!audioDragStateRef.current) return;
      const state = audioDragStateRef.current;
      const deltaX = ev.clientX - state.startClientX;
      const deltaY = ev.clientY - state.startClientY;
      const moveDistance = Math.hypot(deltaX, deltaY);

      // If long press has not triggered yet:
      if (!state.isLongPressActive) {
        // If user moved more than 12px before 260ms, this is a normal timeline scrolling swipe!
        if (moveDistance > 12) {
          if (audioLongPressTimerRef.current) {
            clearTimeout(audioLongPressTimerRef.current);
            audioLongPressTimerRef.current = null;
          }
          // Remove drag listeners immediately so native timeline strip scrolls completely naturally
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
          audioDragStateRef.current = null;
        }
        return;
      }

      // Long press is active: user deliberately held down and is now repositioning audio
      ev.preventDefault();
      ev.stopPropagation();
      state.hasMoved = true;

      const deltaSec = deltaX / timelineZoom;
      let safeStartTime = Math.max(0, Math.round((state.initStartTime + deltaSec) * 20) / 20);

      // Detect vertical layer shift (each layer row is ~26px high)
      const layerShift = Math.round(deltaY / 26);
      let targetLayer = Math.max(0, Math.min(3, state.initLayer + layerShift));
      const curDur = getAudioClipEffectiveDuration(targetClip);

      // Overlap Prevention: Check for collisions with other clips on targetLayer
      const checkCollision = (startTime: number, layer: number) => {
        return activeAudioClips.some(c => {
          if (c.id === state.clipId) return false;
          if ((c.track_layer || 0) !== layer) return false;
          const cStart = c.start_time !== undefined ? c.start_time : 0;
          const cDur = getAudioClipEffectiveDuration(c);
          const cEnd = cStart + cDur;
          const sEnd = startTime + curDur;
          return startTime < cEnd && cStart < sEnd;
        });
      };

      if (checkCollision(safeStartTime, targetLayer)) {
        // Find closest non-overlapping boundary on this layer
        const otherClips = activeAudioClips
          .filter(c => c.id !== state.clipId && (c.track_layer || 0) === targetLayer)
          .sort((a, b) => (a.start_time || 0) - (b.start_time || 0));

        let resolved = false;
        for (const other of otherClips) {
          const oStart = other.start_time !== undefined ? other.start_time : 0;
          const oDur = getAudioClipEffectiveDuration(other);
          const oEnd = oStart + oDur;

          if (deltaSec >= 0 && safeStartTime < oEnd && safeStartTime + curDur > oStart) {
            if (oStart - curDur >= 0 && !checkCollision(oStart - curDur, targetLayer)) {
              safeStartTime = oStart - curDur;
              resolved = true;
              break;
            } else if (!checkCollision(oEnd, targetLayer)) {
              safeStartTime = oEnd;
              resolved = true;
              break;
            }
          } else if (deltaSec < 0 && safeStartTime < oEnd && safeStartTime + curDur > oStart) {
            if (!checkCollision(oEnd, targetLayer)) {
              safeStartTime = oEnd;
              resolved = true;
              break;
            } else if (oStart - curDur >= 0 && !checkCollision(oStart - curDur, targetLayer)) {
              safeStartTime = oStart - curDur;
              resolved = true;
              break;
            }
          }
        }

        // If still colliding on this layer, shift to next available non-overlapping layer
        if (!resolved && checkCollision(safeStartTime, targetLayer)) {
          for (let l = 0; l <= 3; l++) {
            if (!checkCollision(safeStartTime, l)) {
              targetLayer = l;
              break;
            }
          }
        }
      }

      const visual = {
        clipId: state.clipId,
        deltaX,
        deltaY,
        currentStartTime: safeStartTime,
        targetLayer
      };
      setAudioDragVisual(visual);
      audioDragVisualRef.current = visual;
    };

    const onPointerUp = () => {
      if (audioLongPressTimerRef.current) {
        clearTimeout(audioLongPressTimerRef.current);
        audioLongPressTimerRef.current = null;
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      isUserScrubbingTrackRef.current = false;

      const state = audioDragStateRef.current;
      const dragVisual = audioDragVisualRef.current;
      if (state?.isLongPressActive && state?.hasMoved && dragVisual) {
        setActiveProject(currentProj => {
          if (!currentProj) return currentProj;
          const curClips = currentProj.audio_clips || [];
          const targetIdx = curClips.findIndex(c => c.id === state.clipId);
          if (targetIdx === -1) return currentProj;

          const updatedClips = [...curClips];
          updatedClips[targetIdx] = {
            ...updatedClips[targetIdx],
            start_time: dragVisual.currentStartTime,
            track_layer: dragVisual.targetLayer
          };
          updateProjectAudioClips(updatedClips, true, true);
          return {
            ...currentProj,
            audio_clips: updatedClips
          };
        });
        showToast(
          dragVisual.targetLayer !== state.initLayer
            ? `Moved audio to Strip A${dragVisual.targetLayer + 1} (${dragVisual.currentStartTime.toFixed(1)}s)`
            : `Repositioned audio to ${dragVisual.currentStartTime.toFixed(1)}s`,
          "success"
        );
      }

      setActiveDraggingAudioId(null);
      setAudioDragVisual(null);
      audioDragVisualRef.current = null;
      audioDragStateRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Clean up audio playback element when modal unmounts
  useEffect(() => {
    return () => {
      audioElementsMapRef.current.forEach(el => el.pause());
      audioElementsMapRef.current.clear();
    };
  }, []);

  // Ensure audio clips maintain valid start times and are automatically cut & resized till video end (if clips dropped/trimmed or audio overhangs)
  useEffect(() => {
    if (!activeProject || totalDuration <= 0 || activeAudioClips.length === 0) return;
    if (audioDragStateRef.current || isUserScrubbingTrackRef.current || activeDraggingAudioId) return;
    const hasNegative = activeAudioClips.some(c => (c.start_time || 0) < 0);
    const hasOverhanging = activeAudioClips.some(c => {
      const cStart = c.start_time !== undefined ? c.start_time : 0;
      const cDur = getAudioClipEffectiveDuration(c);
      return (cStart + cDur) > totalDuration + 0.25 || cStart >= totalDuration;
    });

    if (hasNegative || hasOverhanging) {
      const corrected = autoCorrectAudioClipsForVideoDuration(activeAudioClips, totalDuration);
      updateProjectAudioClips(corrected, false, true);
    }
  }, [activeAudioClips, totalDuration, activeProject?.id, activeDraggingAudioId, autoCorrectAudioClipsForVideoDuration, getAudioClipEffectiveDuration, updateProjectAudioClips]);

  const handleUndo = () => {
    const proj = activeProjectRef.current;
    if (!proj || undoStack.length === 0) return;
    const previousSnap = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    const currentSnap = createProjectSnapshot(proj);
    setRedoStack(prev => [...prev, currentSnap]);

    const updated: VideoEditorProject = {
      ...proj,
      clips: previousSnap.clips || [],
      captions: previousSnap.captions || [],
      audio_clips: previousSnap.audio_clips || [],
      audio_id: previousSnap.audio_id,
      audio_url: previousSnap.audio_url,
      audio_name: previousSnap.audio_name,
      audio_duration: previousSnap.audio_duration,
      audio_volume: previousSnap.audio_volume,
      updated_at: Date.now()
    };
    activeProjectRef.current = updated;
    setActiveProject(updated);
    onSaveProject(updated);

    // Guaranteed AI Generation Safety:
    // If an undo reverts a clip replacement, ensure the generated clip is restored to Review and never disappears
    if (previousSnap.jobs && previousSnap.jobs.length > 0) {
      setHiggsfieldJobs(previousSnap.jobs);
      higgsfieldJobsRef.current = previousSnap.jobs;
      previousSnap.jobs.forEach(pj => {
        if (pj.status === 'completed') {
          fetch('/api/higgsfield/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: pj.id, file_id: pj.file_id })
          }).catch(() => {});
        }
      });
    }

    showToast("Action undone", "info");
  };

  const handleRedo = () => {
    const proj = activeProjectRef.current;
    if (!proj || redoStack.length === 0) return;
    const nextSnap = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    const currentSnap = createProjectSnapshot(proj);
    setUndoStack(prev => [...prev, currentSnap]);

    const updated: VideoEditorProject = {
      ...proj,
      clips: nextSnap.clips || [],
      captions: nextSnap.captions || [],
      audio_clips: nextSnap.audio_clips || [],
      audio_id: nextSnap.audio_id,
      audio_url: nextSnap.audio_url,
      audio_name: nextSnap.audio_name,
      audio_duration: nextSnap.audio_duration,
      audio_volume: nextSnap.audio_volume,
      updated_at: Date.now()
    };
    activeProjectRef.current = updated;
    setActiveProject(updated);
    onSaveProject(updated);

    if (nextSnap.jobs && nextSnap.jobs.length > 0) {
      setHiggsfieldJobs(nextSnap.jobs);
      higgsfieldJobsRef.current = nextSnap.jobs;
    }

    showToast("Action redone", "info");
  };

  // Synchronize Caption Templates & Defaults when masterBucketFid changes
  useEffect(() => {
    try {
      let localTemplates: VideoEditorCaptionTemplate[] = [];
      try {
        const stored = localStorage.getItem(`master_caption_templates_${masterBucketFid}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) localTemplates = parsed;
        }
      } catch (_) {}

      const bucketTemplates = db?.folder_caption_templates?.[masterBucketFid] || [];
      const projectTemplates = activeProject?.caption_templates && activeProject.caption_templates.length > 0 ? activeProject.caption_templates : [];
      const combinedMap = new Map<string, VideoEditorCaptionTemplate>();

      const mergeTpl = (t: any) => {
        if (!t || !t.id) return;
        const isAll = t.mode === 'all' || t.mode === 'must' || Boolean(t.is_must);
        const norm: VideoEditorCaptionTemplate = {
          ...t,
          mode: isAll ? 'all' : 'change',
          is_must: isAll,
          for_all_videos: isAll
        };
        const prev = combinedMap.get(norm.id);
        if (!prev) {
          combinedMap.set(norm.id, norm);
        } else {
          const prevTime = prev.updated_at || prev.created_at || 0;
          const currTime = norm.updated_at || norm.created_at || 0;
          if (currTime >= prevTime) {
            combinedMap.set(norm.id, { ...prev, ...norm });
          } else {
            combinedMap.set(norm.id, { ...norm, ...prev });
          }
        }
      };

      localTemplates.forEach(mergeTpl);
      bucketTemplates.forEach(mergeTpl);
      projectTemplates.forEach(mergeTpl);
      const combined = Array.from(combinedMap.values());
      if (combined.length > 0) {
        setCaptionTemplates(combined);
      }

      const localDefs = localStorage.getItem(`master_caption_defaults_${masterBucketFid}`);
      if (localDefs) {
        const parsed = JSON.parse(localDefs);
        setCaptionDefaults({
          ...parsed,
          font_family: parsed.font_family && !parsed.font_family.includes('system-ui') ? parsed.font_family : CAPTION_FONTS[0].family,
          is_bold: parsed.is_bold !== undefined ? parsed.is_bold : true
        });
      } else if (db?.folder_caption_defaults?.[masterBucketFid]) {
        const d = db.folder_caption_defaults[masterBucketFid];
        setCaptionDefaults({
          ...d,
          font_family: d.font_family && !d.font_family.includes('system-ui') ? d.font_family : CAPTION_FONTS[0].family,
          is_bold: d.is_bold !== undefined ? d.is_bold : true
        });
      } else {
        setCaptionDefaults({
          x_pct: 50,
          y_pct: 35,
          font_size: 24,
          box_width_pct: 85,
          font_family: CAPTION_FONTS[0].family,
          color: '#ffffff',
          stroke_color: '#000000',
          is_bold: true,
          clip_rule: 'all'
        });
      }
    } catch (e) {}
  }, [masterBucketFid, db?.folder_caption_templates, db?.folder_caption_defaults]);

  // Active Captions for current project - strictly exclude any captions hidden for this specific project
  const activeCaptions: VideoEditorCaption[] = useMemo(() => {
    const raw = activeProject?.captions || [];
    const hiddenIds = activeProject?.hidden_caption_ids || [];
    if (hiddenIds.length === 0) return raw;

    const hiddenSet = new Set(hiddenIds);
    const hiddenTexts = new Set(
      captionTemplates
        .filter(t => hiddenSet.has(t.id))
        .map(t => t.text.trim().toLowerCase())
    );

    return raw.filter(c => {
      if (c.template_id && hiddenSet.has(c.template_id)) return false;
      if (c.text && hiddenTexts.has(c.text.trim().toLowerCase())) return false;
      return true;
    });
  }, [activeProject?.captions, activeProject?.hidden_caption_ids, captionTemplates]);

  const selectedCaption: VideoEditorCaption | null = useMemo(() => {
    if (!selectedCaptionId && activeCaptions.length > 0) return activeCaptions[0];
    return activeCaptions.find(c => c.id === selectedCaptionId) || null;
  }, [activeCaptions, selectedCaptionId]);

  // Save updated captions into project
  const updateProjectCaptions = useCallback((newCaptions: VideoEditorCaption[], pushUndo = true, shouldPersist = true) => {
    if (!activeProject) return;
    if (pushUndo) {
      pushHistorySnapshot();
    }
    const updated: VideoEditorProject = {
      ...activeProject,
      captions: newCaptions,
      updated_at: Date.now()
    };
    setActiveProject(updated);
    if (shouldPersist) {
      onSaveProject(updated);
    }
  }, [activeProject, onSaveProject, pushHistorySnapshot]);

  // Add a new caption (trending white text with black border stroke, placed above half of the video)
  const handleAddCaption = useCallback((customText?: string, overrides?: Partial<VideoEditorCaption>) => {
    const newCap: VideoEditorCaption = {
      id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: customText !== undefined ? customText : (selectedCaption ? selectedCaption.text : "Your caption"),
      is_bold: overrides?.is_bold !== undefined ? overrides.is_bold : (captionDefaults.is_bold !== undefined ? captionDefaults.is_bold : true), // Bold by default matching TikTok headline
      font_size: captionDefaults.font_size || 24,
      box_width_pct: captionDefaults.box_width_pct !== undefined ? captionDefaults.box_width_pct : 85,
      font_family: overrides?.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
      color: '#ffffff',
      stroke_color: '#000000',
      x_pct: captionDefaults.x_pct !== undefined ? captionDefaults.x_pct : 50,
      y_pct: captionDefaults.y_pct !== undefined ? captionDefaults.y_pct : 35,
      clip_rule: captionDefaults.clip_rule || 'all',
      clip_count: captionDefaults.clip_count || 2,
      clip_indices: [],
      ...overrides
    };
    const updated = [...activeCaptions, newCap];
    updateProjectCaptions(updated, true);
    setSelectedCaptionId(newCap.id);
    showToast("Caption added over video", "success");
    return newCap;
  }, [activeCaptions, captionDefaults, selectedCaption, updateProjectCaptions, showToast]);

  // Update an existing template (edit name, text, position, size, clip rule)
  const handleUpdateTemplate = useCallback(async (updatedTpl: VideoEditorCaptionTemplate) => {
    const targetId = updatedTpl.id;
    const now = Date.now();
    const isAll = updatedTpl.mode === 'all' || updatedTpl.mode === 'must' || updatedTpl.is_must === true;
    const normalizedUpdatedTpl: VideoEditorCaptionTemplate = {
      ...updatedTpl,
      mode: isAll ? 'all' : 'change',
      is_must: isAll,
      for_all_videos: isAll,
      updated_at: now
    };

    // Synchronously compute the updated list from captionTemplates
    const baseList = captionTemplates.length > 0
      ? captionTemplates
      : (activeProjectRef.current?.caption_templates || db?.folder_caption_templates?.[masterBucketFid] || []);
    
    const exists = baseList.some(t => t.id === targetId);
    const nextList = exists
      ? baseList.map(t => t.id === targetId ? { ...t, ...normalizedUpdatedTpl } : t)
      : [...baseList, normalizedUpdatedTpl];

    setCaptionTemplates(nextList);

    try {
      localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(nextList));
    } catch (_) {}

    try {
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_caption_template',
          payload: { master_bucket_fid: masterBucketFid, template: normalizedUpdatedTpl }
        })
      }).catch(() => {});
    } catch (_) {}

    if (setDb) {
      setDb(prev => {
        if (!prev) return prev;
        const currentFmt = { ...(prev.folder_caption_templates || {}) };
        currentFmt[masterBucketFid] = nextList;
        return { ...prev, folder_caption_templates: currentFmt };
      });
    }

    const currentProj = activeProjectRef.current;
    if (currentProj) {
      const updatedProj: VideoEditorProject = {
        ...currentProj,
        caption_templates: nextList,
        updated_at: now
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    setEditingTemplate(prev => (prev && prev.id === targetId ? { ...prev, ...normalizedUpdatedTpl } : prev));
    showToast(`Template "${normalizedUpdatedTpl.name || 'Caption'}" updated!`, "success");
  }, [masterBucketFid, showToast, setDb, onSaveProject, captionTemplates, db?.folder_caption_templates]);

  // Update a caption (supports live preview drag with shouldPersist = false)
  const handleUpdateCaption = useCallback((captionId: string, updates: Partial<VideoEditorCaption>, pushUndo = true, shouldPersist = true) => {
    setActiveProject(prev => {
      if (!prev) return prev;
      const currentCaps = prev.captions || [];
      const updated = currentCaps.map(c => c.id === captionId ? { ...c, ...updates } : c);
      if (shouldPersist) {
        if (pushUndo) pushHistorySnapshot();
        const updatedProj = { ...prev, captions: updated, updated_at: Date.now() };
        onSaveProject(updatedProj);
        return updatedProj;
      }
      return { ...prev, captions: updated };
    });

    // If persisting and this caption is linked to a template, synchronize updates to the template!
    if (shouldPersist) {
      setCaptionTemplates(prevTpls => {
        const currentCap = activeCaptions.find(c => c.id === captionId);
        const targetTplId = updates.template_id !== undefined ? updates.template_id : currentCap?.template_id;
        if (!targetTplId) return prevTpls;

        const targetTpl = prevTpls.find(t => t.id === targetTplId);
        if (!targetTpl) return prevTpls;

        const updatedTpl: VideoEditorCaptionTemplate = {
          ...targetTpl,
          ...(updates.text !== undefined ? { text: updates.text } : {}),
          ...(updates.font_size !== undefined ? { font_size: updates.font_size } : {}),
          ...(updates.font_family !== undefined ? { font_family: updates.font_family } : {}),
          ...(updates.is_bold !== undefined ? { is_bold: updates.is_bold } : {}),
          ...(updates.box_width_pct !== undefined ? { box_width_pct: updates.box_width_pct } : {}),
          ...(updates.x_pct !== undefined ? { x_pct: updates.x_pct } : {}),
          ...(updates.y_pct !== undefined ? { y_pct: updates.y_pct } : {}),
          ...(updates.clip_rule !== undefined ? { clip_rule: updates.clip_rule } : {}),
          ...(updates.clip_count !== undefined ? { clip_count: updates.clip_count } : {}),
          ...(updates.clip_indices !== undefined ? { clip_indices: updates.clip_indices } : {}),
          updated_at: Date.now()
        };

        const updatedList = prevTpls.map(t => t.id === targetTplId ? updatedTpl : t);
        try {
          localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(updatedList));
          fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_caption_template',
              payload: { master_bucket_fid: masterBucketFid, template: updatedTpl }
            })
          }).catch(() => {});
        } catch (_) {}

        setEditingTemplate(curr => (curr && curr.id === targetTplId ? { ...curr, ...updatedTpl } : curr));
        return updatedList;
      });
    }
  }, [activeCaptions, masterBucketFid, onSaveProject, pushHistorySnapshot]);

  // Delete a caption
  const handleDeleteCaption = useCallback((captionId: string) => {
    const currentProj = activeProjectRef.current || activeProject;
    const targetCap = activeCaptions.find(c => c.id === captionId) || (currentProj?.captions || []).find(c => c.id === captionId);
    const updated = (currentProj?.captions || []).filter(c => c.id !== captionId);
    
    if (selectedCaptionId === captionId) {
      setSelectedCaptionId(updated.length > 0 ? updated[0].id : null);
    }

    // Hide any corresponding template & text for this project so auto-all sync NEVER resurrects it
    const curHidden = new Set(currentProj?.hidden_caption_ids || []);
    curHidden.add(captionId);

    const targetText = targetCap?.text?.trim().toLowerCase();
    if (targetCap?.template_id) {
      curHidden.add(targetCap.template_id);
    }
    if (targetText) {
      curHidden.add(targetText);
    }

    // Also remove matching template from active captionTemplates list if any
    const updatedTpls = captionTemplates.filter(t => {
      if (targetCap?.template_id && t.id === targetCap.template_id) return false;
      if (targetText && t.text.trim().toLowerCase() === targetText) return false;
      return true;
    });
    setCaptionTemplates(updatedTpls);

    try {
      localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(updatedTpls));
      if (targetCap?.template_id) {
        fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_caption_template',
            payload: { master_bucket_fid: masterBucketFid, templateId: targetCap.template_id }
          })
        }).catch(() => {});
      }
    } catch (_) {}

    if (setDb) {
      setDb(prev => {
        if (!prev) return prev;
        const currentFmt = { ...(prev.folder_caption_templates || {}) };
        currentFmt[masterBucketFid] = updatedTpls;
        return { ...prev, folder_caption_templates: currentFmt };
      });
    }

    if (currentProj) {
      const updatedProj: VideoEditorProject = {
        ...currentProj,
        captions: updated,
        caption_templates: updatedTpls,
        hidden_caption_ids: Array.from(curHidden),
        updated_at: Date.now()
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    pushHistorySnapshot();
    showToast("Caption deleted", "info");
  }, [activeCaptions, activeProject, captionTemplates, masterBucketFid, onSaveProject, pushHistorySnapshot, selectedCaptionId, setDb, showToast]);

  // Save caption as a template for this Master Bucket (named C1, C2, C3...)
  const handleSaveAsTemplate = useCallback(async (caption: VideoEditorCaption, customName?: string, forAllVideos: boolean = false) => {
    const nextNum = captionTemplates.length + 1;
    const tplName = customName || `C${nextNum}`;
    const newTpl: VideoEditorCaptionTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: tplName,
      text: caption.text,
      mode: forAllVideos ? 'all' : 'change', // generally change should be enabled by default
      is_must: forAllVideos,
      is_bold: caption.is_bold ?? false,
      font_size: caption.font_size,
      box_width_pct: caption.box_width_pct || 80,
      font_family: caption.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
      color: '#ffffff',
      stroke_color: '#000000',
      x_pct: caption.x_pct !== undefined ? caption.x_pct : 50,
      y_pct: caption.y_pct !== undefined ? caption.y_pct : 35,
      clip_rule: caption.clip_rule || 'all',
      clip_count: caption.clip_count || 2,
      clip_indices: caption.clip_indices ? [...caption.clip_indices] : [],
      for_all_videos: forAllVideos,
      created_at: Date.now()
    };
    const updatedTpls = [...captionTemplates, newTpl];
    setCaptionTemplates(updatedTpls);
    // Link this caption to the newly created template so modifications stay in sync
    handleUpdateCaption(caption.id, { template_id: newTpl.id });
    try {
      localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(updatedTpls));
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_caption_template',
          payload: { master_bucket_fid: masterBucketFid, template: newTpl }
        })
      }).catch(() => {});
    } catch (e) {}

    if (setDb) {
      setDb(prev => {
        if (!prev) return prev;
        const currentFmt = { ...(prev.folder_caption_templates || {}) };
        currentFmt[masterBucketFid] = updatedTpls;
        return { ...prev, folder_caption_templates: currentFmt };
      });
    }

    const currentProj = activeProjectRef.current || activeProject;
    if (currentProj) {
      const updatedProj: VideoEditorProject = {
        ...currentProj,
        caption_templates: updatedTpls,
        updated_at: Date.now()
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    showToast(`Saved template "${tplName}" (${forAllVideos ? 'All / Must' : 'Change'})!`, "success");
  }, [captionTemplates, captionDefaults, handleUpdateCaption, masterBucketFid, setDb, onSaveProject, activeProject, showToast]);

  // Toggle All vs Change mode on caption template
  // All: guaranteed on every video clip across all projects and remains during Auto & Export
  // Change: auto-swaps between all change captions every time Auto is clicked
  const handleToggleTemplateMode = useCallback(async (templateId: string, newMode: 'all' | 'change' | 'must') => {
    const targetTpl = captionTemplates.find(t => t.id === templateId);
    if (!targetTpl) return;
    const isAll = newMode === 'all' || newMode === 'must';
    const targetTextKey = (targetTpl.text || '').trim().toLowerCase();

    // 1. Update this template AND any other templates with matching text to maintain complete consistency
    const now = Date.now();
    const updatedTpls = captionTemplates.map(t => {
      const match = t.id === templateId || (t.text && t.text.trim().toLowerCase() === targetTextKey);
      if (match) {
        return {
          ...t,
          mode: isAll ? ('all' as const) : ('change' as const),
          is_must: isAll,
          for_all_videos: isAll,
          updated_at: now
        };
      }
      return t;
    });

    const updatedTarget = updatedTpls.find(t => t.id === templateId) || {
      ...targetTpl,
      mode: isAll ? ('all' as const) : ('change' as const),
      is_must: isAll,
      for_all_videos: isAll,
      updated_at: now
    };

    await handleUpdateTemplate(updatedTarget);

    // 2. Synchronize active project canvas captions
    if (isAll) {
      // Find if this text is already present on canvas
      const existingIdx = activeCaptions.findIndex(
        c => c.template_id === templateId || (c.text && c.text.trim().toLowerCase() === targetTextKey)
      );
      if (existingIdx >= 0) {
        // Promote the existing caption to must, updating its template_id and rule
        const updated = activeCaptions.map((c, i) => i === existingIdx ? {
          ...c,
          template_id: targetTpl.id,
          clip_rule: targetTpl.clip_rule || c.clip_rule || 'all',
          clip_count: targetTpl.clip_count || c.clip_count || 1
        } : c);
        // Ensure no other duplicate caption with the same text remains
        const clean = updated.filter((c, i) => i === existingIdx || (c.text && c.text.trim().toLowerCase() !== targetTextKey));
        updateProjectCaptions(clean, true);
      } else {
        const tplFont = targetTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family;
        const newCap: VideoEditorCaption = {
          id: `cap_all_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          template_id: targetTpl.id,
          text: targetTpl.text,
          font_family: tplFont,
          font_size: targetTpl.font_size || captionDefaults.font_size || 24,
          is_bold: targetTpl.is_bold ?? true,
          box_width_pct: targetTpl.box_width_pct || 85,
          color: targetTpl.color || '#ffffff',
          stroke_color: targetTpl.stroke_color || '#000000',
          x_pct: targetTpl.x_pct !== undefined ? targetTpl.x_pct : (captionDefaults.x_pct ?? 50),
          y_pct: targetTpl.y_pct !== undefined ? targetTpl.y_pct : (captionDefaults.y_pct ?? 35),
          clip_rule: targetTpl.clip_rule || 'all',
          clip_count: targetTpl.clip_count || 1,
          clip_indices: targetTpl.clip_indices ? [...targetTpl.clip_indices] : []
        };
        const clean = activeCaptions.filter(c => (c.text || '').trim().toLowerCase() !== targetTextKey);
        updateProjectCaptions([...clean, newCap], true);
      }
    } else {
      // Switched to Change: if multiple on canvas, keep only one
      const clean = activeCaptions.filter((c, i) => {
        if ((c.text || '').trim().toLowerCase() !== targetTextKey) return true;
        return i === activeCaptions.findIndex(x => (x.text || '').trim().toLowerCase() === targetTextKey);
      });
      if (clean.length !== activeCaptions.length) {
        updateProjectCaptions(clean, true);
      }
    }

    showToast(
      isAll
        ? `⭐ Set For All: "${targetTpl.name || 'Caption'}" will show on every video!`
        : `🔄 Set to Change: "${targetTpl.name || 'Caption'}" will rotate on Auto.`,
      "info"
    );
  }, [captionTemplates, activeCaptions, captionDefaults, handleUpdateTemplate, updateProjectCaptions, showToast]);

  // Project-level isolation: Hide/Unhide caption specifically for the current project
  // "if I hide it is specifically hidden from using in that specific project... separately listed for that project"
  const handleToggleHideCaptionForProject = useCallback((templateId: string) => {
    const currentHidden = activeProject?.hidden_caption_ids || [];
    const isCurrentlyHidden = currentHidden.includes(templateId);
    const newHidden = isCurrentlyHidden
      ? currentHidden.filter(id => id !== templateId)
      : [...currentHidden, templateId];

    const targetTpl = captionTemplates.find(t => t.id === templateId);

    // If hiding, also strictly remove from active project captions so it completely disappears from editor canvas & timeline
    let updatedActiveCaptions = activeProject?.captions || [];
    if (!isCurrentlyHidden) {
      updatedActiveCaptions = (activeProject?.captions || []).filter(c => {
        if (c.template_id === templateId) return false;
        if (targetTpl && c.text.trim().toLowerCase() === targetTpl.text.trim().toLowerCase()) return false;
        return true;
      });
      if (selectedCaptionId && !updatedActiveCaptions.some(c => c.id === selectedCaptionId)) {
        setSelectedCaptionId(updatedActiveCaptions.length > 0 ? updatedActiveCaptions[0].id : null);
      }
    }

    if (activeProject) {
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        hidden_caption_ids: newHidden,
        captions: updatedActiveCaptions,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    showToast(
      isCurrentlyHidden
        ? `Restored "${targetTpl?.name || targetTpl?.text || 'Caption'}" to this project!`
        : `Hidden "${targetTpl?.name || targetTpl?.text || 'Caption'}" for this project only (other projects keep it).`,
      "info"
    );
  }, [activeProject, captionTemplates, onSaveProject, selectedCaptionId, showToast]);

  // Instantly open template editor when double tapping/clicking caption over screen
  const handleOpenCaptionTemplateEditor = useCallback((caption: VideoEditorCaption) => {
    setSelectedCaptionId(caption.id);
    setSelectedTimelineClipIndex(null);
    setSelectedAudioClipIndex(null);

    // Find linked template or matching template by ID or text
    let targetTpl = caption.template_id ? captionTemplates.find(t => t.id === caption.template_id) : null;
    if (!targetTpl) {
      targetTpl = captionTemplates.find(t => t.name.toLowerCase() === caption.text.trim().toLowerCase() || t.text.trim().toLowerCase() === caption.text.trim().toLowerCase());
    }

    if (targetTpl) {
      if (caption.template_id !== targetTpl.id) {
        handleUpdateCaption(caption.id, { template_id: targetTpl.id });
      }
      setEditingTemplate({
        ...targetTpl,
        mode: targetTpl.mode || (targetTpl.is_must ? 'must' : 'change'),
        is_must: targetTpl.mode === 'must' || Boolean(targetTpl.is_must),
        text: caption.text,
        x_pct: caption.x_pct !== undefined ? caption.x_pct : (targetTpl.x_pct ?? 50),
        y_pct: caption.y_pct !== undefined ? caption.y_pct : (targetTpl.y_pct ?? 35),
        clip_rule: caption.clip_rule || targetTpl.clip_rule || 'all',
        clip_count: caption.clip_count || targetTpl.clip_count || 2,
        clip_indices: caption.clip_indices || targetTpl.clip_indices || [],
        font_size: caption.font_size || targetTpl.font_size,
        font_family: caption.font_family || targetTpl.font_family || CAPTION_FONTS[0].family,
        is_bold: caption.is_bold ?? targetTpl.is_bold ?? false,
        box_width_pct: caption.box_width_pct || targetTpl.box_width_pct || 80
      });
    } else {
      // If caption is not linked to any template yet, open template editor pre-populated as C{next}
      const nextNum = captionTemplates.length + 1;
      const draftTpl: VideoEditorCaptionTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `C${nextNum}`,
        text: caption.text,
        mode: 'change', // generally change should be enabled by default
        is_must: false,
        font_size: caption.font_size || 24,
        font_family: caption.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
        is_bold: caption.is_bold ?? false,
        box_width_pct: caption.box_width_pct || 80,
        x_pct: caption.x_pct !== undefined ? caption.x_pct : 50,
        y_pct: caption.y_pct !== undefined ? caption.y_pct : 35,
        clip_rule: caption.clip_rule || 'all',
        clip_count: caption.clip_count || 2,
        clip_indices: caption.clip_indices ? [...caption.clip_indices] : [],
        for_all_videos: true,
        created_at: Date.now()
      };
      setEditingTemplate(draftTpl);
    }
    setTemplateProjectActive(true);
    setCaptionViewMode('settings');
    setShowTextDrawer(true);
  }, [captionTemplates, captionDefaults, handleUpdateCaption]);

  // Format the clip rule label in light text below the caption in list view
  const formatTemplateRuleDisplay = useCallback((tpl: VideoEditorCaptionTemplate) => {
    if (tpl.clip_rule === 'end') {
      const cnt = tpl.clip_count || 1;
      return cnt === 1 ? 'Selected: Last clip' : `Selected: Last ${cnt} clips`;
    }
    if (tpl.clip_rule === 'start') {
      const cnt = tpl.clip_count || 1;
      return cnt === 1 ? 'Selected: First clip' : `Selected: First ${cnt} clips`;
    }
    if (tpl.clip_rule === 'until_next') {
      return 'Selected: Until next caption';
    }
    return 'Selected: All clips';
  }, []);

  // Helper to determine if an active caption represents a MUST / ALL caption
  const isMustCaption = useCallback((caption: VideoEditorCaption): boolean => {
    if (caption.template_id) {
      const tpl = captionTemplates.find(t => t.id === caption.template_id);
      if (tpl) {
        return tpl.mode === 'all' || tpl.mode === 'must' || tpl.is_must === true || tpl.for_all_videos === true;
      }
    }
    const match = captionTemplates.find(t => 
      (t.name && t.name.toLowerCase() === caption.text.trim().toLowerCase()) || 
      t.text.trim().toLowerCase() === caption.text.trim().toLowerCase()
    );
    if (match) {
      return match.mode === 'all' || match.mode === 'must' || match.is_must === true || match.for_all_videos === true;
    }
    return false;
  }, [captionTemplates]);

  // Toggle a caption template on the current project video (Star ⭐ button or bubble switcher)
  // For ALL / MUST captions: can be toggled/added alongside other captions (all stay)
  // For CHANGE captions: clicking replaces any currently selected/active change caption instead of adding a duplicate second caption!
  const handleToggleCaptionOnProject = useCallback((tpl: VideoEditorCaptionTemplate) => {
    const isTemplateMust = tpl.mode === 'all' || tpl.mode === 'must' || tpl.is_must === true || tpl.for_all_videos === true;

    const existingIdx = activeCaptions.findIndex(
      c => c.template_id === tpl.id || (c.text.trim() === tpl.text.trim() && c.font_family === tpl.font_family)
    );

    if (existingIdx >= 0) {
      // Currently on video -> Remove it (unstar)
      const removedCapId = activeCaptions[existingIdx].id;
      const updated = activeCaptions.filter((_, i) => i !== existingIdx);
      updateProjectCaptions(updated, true);
      if (selectedCaptionId === removedCapId) {
        setSelectedCaptionId(updated.length > 0 ? updated[0].id : null);
      }
      showToast(`Removed "${tpl.text}" from video`, "info");
      return;
    }

    // If it was hidden in this project, unhide it automatically when user adds it
    if (activeProject && (activeProject.hidden_caption_ids || []).includes(tpl.id)) {
      const unhidden = (activeProject.hidden_caption_ids || []).filter(id => id !== tpl.id);
      const updatedProj = { ...activeProject, hidden_caption_ids: unhidden, updated_at: Date.now() };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    const tplFont = tpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family;
    const masterIdx = captionTemplates.findIndex(t => t.id === tpl.id);
    const label = tpl.name && /^C\d+$/i.test(tpl.name)
      ? tpl.name.toUpperCase()
      : `C${masterIdx >= 0 ? masterIdx + 1 : 1}`;

    if (!isTemplateMust) {
      // CHANGE CAPTION:
      // Replace whichever change caption is already selected or default active on the video,
      // instead of adding a duplicate second caption!
      const curSelected = activeCaptions.find(c => c.id === selectedCaptionId);
      let targetChangeCap: VideoEditorCaption | null = null;

      if (curSelected && !isMustCaption(curSelected)) {
        targetChangeCap = curSelected;
      } else {
        targetChangeCap = activeCaptions.find(c => !isMustCaption(c)) || null;
      }

      const newCap: VideoEditorCaption = {
        id: `cap_change_${tpl.id}_${Date.now()}`,
        template_id: tpl.id,
        text: tpl.text,
        font_family: tplFont,
        font_size: tpl.font_size || targetChangeCap?.font_size || captionDefaults.font_size || 24,
        is_bold: tpl.is_bold ?? targetChangeCap?.is_bold ?? true,
        box_width_pct: tpl.box_width_pct || targetChangeCap?.box_width_pct || 85,
        color: tpl.color || targetChangeCap?.color || '#ffffff',
        stroke_color: tpl.stroke_color || targetChangeCap?.stroke_color || '#000000',
        x_pct: tpl.x_pct !== undefined ? tpl.x_pct : (targetChangeCap?.x_pct ?? (captionDefaults.x_pct ?? 50)),
        y_pct: tpl.y_pct !== undefined ? tpl.y_pct : (targetChangeCap?.y_pct ?? (captionDefaults.y_pct ?? 35)),
        clip_rule: tpl.clip_rule || targetChangeCap?.clip_rule || 'all',
        clip_count: tpl.clip_count || targetChangeCap?.clip_count || 1,
        clip_indices: tpl.clip_indices ? [...tpl.clip_indices] : (targetChangeCap?.clip_indices ? [...targetChangeCap.clip_indices] : [])
      };

      // Keep all MUST captions, filtering out any duplicate with the exact same text, and replace any change caption with newCap
      const targetTextKey = (tpl.text || '').trim().toLowerCase();
      const mustCaps = activeCaptions.filter(c => isMustCaption(c) && (c.text || '').trim().toLowerCase() !== targetTextKey);
      const updated = [...mustCaps, newCap];

      updateProjectCaptions(updated, true);
      setSelectedCaptionId(newCap.id);
      setSelectedTimelineClipIndex(null);
      setSelectedAudioClipIndex(null);

      if (targetChangeCap) {
        showToast(`Changed caption to ${label}: "${tpl.text}"`, "success");
      } else {
        showToast(`Added ${label}: "${tpl.text}" to video`, "success");
      }
    } else {
      // MUST CAPTION:
      // Always included/accumulated on video, replacing any existing change caption with identical text so text never repeats
      const targetTextKey = (tpl.text || '').trim().toLowerCase();
      const otherCaps = activeCaptions.filter(c => (c.text || '').trim().toLowerCase() !== targetTextKey);

      const newCap: VideoEditorCaption = {
        id: `cap_must_${tpl.id}_${Date.now()}`,
        template_id: tpl.id,
        text: tpl.text,
        font_family: tplFont,
        font_size: tpl.font_size || captionDefaults.font_size || 24,
        is_bold: tpl.is_bold ?? true,
        box_width_pct: tpl.box_width_pct || 85,
        color: tpl.color || '#ffffff',
        stroke_color: tpl.stroke_color || '#000000',
        x_pct: tpl.x_pct !== undefined ? tpl.x_pct : (captionDefaults.x_pct ?? 50),
        y_pct: tpl.y_pct !== undefined ? tpl.y_pct : (captionDefaults.y_pct ?? 35),
        clip_rule: tpl.clip_rule || 'all',
        clip_count: tpl.clip_count || 1,
        clip_indices: tpl.clip_indices ? [...tpl.clip_indices] : []
      };
      const updated = [...otherCaps, newCap];
      updateProjectCaptions(updated, true);
      setSelectedCaptionId(newCap.id);
      setSelectedTimelineClipIndex(null);
      setSelectedAudioClipIndex(null);
      showToast(`Added MUST caption ${label}: "${tpl.text}" to video (⭐)`, "success");
    }
  }, [activeCaptions, captionDefaults, captionTemplates, isMustCaption, selectedCaptionId, updateProjectCaptions, showToast, activeProject, onSaveProject]);

  // Open settings page for a caption template
  const handleOpenTemplateSettings = useCallback((tpl: VideoEditorCaptionTemplate) => {
    const isStarred = activeCaptions.some(
      c => c.template_id === tpl.id || (c.text.trim() === tpl.text.trim() && c.font_family === tpl.font_family)
    );
    setTemplateProjectActive(isStarred);
    setEditingTemplate({ ...tpl });
    setCaptionViewMode('settings');
  }, [activeCaptions]);

  // Save template settings and sync with master bucket templates and project video
  const handleSaveTemplateSettings = useCallback(async (tplToSave: VideoEditorCaptionTemplate, makeActiveInProject: boolean) => {
    const isTplAll = tplToSave.mode === 'all' || tplToSave.mode === 'must' || tplToSave.is_must === true;
    const now = Date.now();
    const normalizedTpl: VideoEditorCaptionTemplate = {
      ...tplToSave,
      mode: isTplAll ? 'all' : 'change',
      is_must: isTplAll,
      for_all_videos: isTplAll,
      updated_at: now
    };

    // 1. Update/Add in captionTemplates
    // 1. Update/Add in captionTemplates, strictly deduplicating by normalized text
    const textKey = (normalizedTpl.text || '').trim().toLowerCase();
    const isExisting = captionTemplates.some(t => t.id === normalizedTpl.id || (t.text && t.text.trim().toLowerCase() === textKey));
    let updatedTpls: VideoEditorCaptionTemplate[];
    if (isExisting) {
      updatedTpls = captionTemplates.map(t => (t.id === normalizedTpl.id || (t.text && t.text.trim().toLowerCase() === textKey)) ? { ...t, ...normalizedTpl, updated_at: now } : t);
    } else {
      updatedTpls = [...captionTemplates, { ...normalizedTpl, created_at: normalizedTpl.created_at || now }];
    }

    // Clean up any remaining duplicate templates with matching text
    const seenTplTexts = new Set<string>();
    updatedTpls = updatedTpls.filter(t => {
      const k = (t.text || '').trim().toLowerCase();
      if (!k) return false;
      if (seenTplTexts.has(k)) return false;
      seenTplTexts.add(k);
      return true;
    }).map((t, idx) => {
      if (!t.name || /^C\d+$/i.test(t.name)) {
        return { ...t, name: `C${idx + 1}` };
      }
      return t;
    });

    setCaptionTemplates(updatedTpls);

    // Save to master bucket storage and API
    try {
      localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(updatedTpls));
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_caption_template',
          payload: { master_bucket_fid: masterBucketFid, template: normalizedTpl }
        })
      }).catch(() => {});
    } catch (_) {}

    if (setDb) {
      setDb(prev => {
        if (!prev) return prev;
        const currentFmt = { ...(prev.folder_caption_templates || {}) };
        currentFmt[masterBucketFid] = updatedTpls;
        return { ...prev, folder_caption_templates: currentFmt };
      });
    }

    // Persist caption_templates strictly inside activeProject for project-to-project isolation
    const currentProj = activeProjectRef.current || activeProject;
    if (currentProj) {
      const updatedProj: VideoEditorProject = {
        ...currentProj,
        caption_templates: updatedTpls,
        updated_at: now
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }

    // 2. Synchronize to active project video according to makeActiveInProject or if set to 'all'
    if (makeActiveInProject || isTplAll) {
      const existingCapIdx = activeCaptions.findIndex(
        c => c.template_id === normalizedTpl.id || (c.text && c.text.trim().toLowerCase() === textKey)
      );

      if (existingCapIdx >= 0) {
        // Update the existing on-canvas caption
        const rawUpdated = activeCaptions.map((c, i) => i === existingCapIdx ? {
          ...c,
          template_id: normalizedTpl.id,
          text: normalizedTpl.text,
          font_family: normalizedTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          font_size: normalizedTpl.font_size || 24,
          is_bold: normalizedTpl.is_bold ?? true,
          box_width_pct: normalizedTpl.box_width_pct || 85,
          color: normalizedTpl.color || '#ffffff',
          stroke_color: normalizedTpl.stroke_color || '#000000',
          x_pct: normalizedTpl.x_pct !== undefined ? normalizedTpl.x_pct : 50,
          y_pct: normalizedTpl.y_pct !== undefined ? normalizedTpl.y_pct : 35,
          clip_rule: normalizedTpl.clip_rule || 'all',
          clip_count: normalizedTpl.clip_count || 1,
          clip_indices: normalizedTpl.clip_indices ? [...normalizedTpl.clip_indices] : []
        } : c);
        // Ensure no duplicate on canvas
        const seenActive = new Set<string>();
        const cleanUpdated = rawUpdated.filter(c => {
          const k = (c.text || '').trim().toLowerCase();
          if (seenActive.has(k)) return false;
          seenActive.add(k);
          return true;
        });
        updateProjectCaptions(cleanUpdated, true);
      } else {
        // Add as a new on-canvas caption, ensuring no duplicate text exists
        const newCap: VideoEditorCaption = {
          id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          template_id: normalizedTpl.id,
          text: normalizedTpl.text,
          font_family: normalizedTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          font_size: normalizedTpl.font_size || 24,
          is_bold: normalizedTpl.is_bold ?? true,
          box_width_pct: normalizedTpl.box_width_pct || 85,
          color: normalizedTpl.color || '#ffffff',
          stroke_color: normalizedTpl.stroke_color || '#000000',
          x_pct: normalizedTpl.x_pct !== undefined ? normalizedTpl.x_pct : 50,
          y_pct: normalizedTpl.y_pct !== undefined ? normalizedTpl.y_pct : 35,
          clip_rule: normalizedTpl.clip_rule || 'all',
          clip_count: normalizedTpl.clip_count || 1,
          clip_indices: normalizedTpl.clip_indices ? [...normalizedTpl.clip_indices] : []
        };
        const rawUpdated = [...activeCaptions.filter(c => (c.text || '').trim().toLowerCase() !== textKey), newCap];
        updateProjectCaptions(rawUpdated, true);
        setSelectedCaptionId(newCap.id);
      }
    } else {
      // If unstarred and not 'all', remove from video
      const updated = activeCaptions.filter(
        c => !(c.template_id === normalizedTpl.id || (c.text && c.text.trim().toLowerCase() === textKey))
      );
      if (updated.length !== activeCaptions.length) {
        updateProjectCaptions(updated, true);
        if (selectedCaptionId && !updated.some(c => c.id === selectedCaptionId)) {
          setSelectedCaptionId(updated.length > 0 ? updated[0].id : null);
        }
      }
    }

    showToast(`Caption "${normalizedTpl.text}" saved!`, "success");
    setCaptionViewMode('list');
    setEditingTemplate(null);
  }, [captionTemplates, activeCaptions, captionDefaults, masterBucketFid, selectedCaptionId, setDb, updateProjectCaptions, onSaveProject, activeProject, showToast]);

  // Delete a saved template
  const handleDeleteTemplate = useCallback(async (templateId: string, templateName: string) => {
    const currentProj = activeProjectRef.current || activeProject;
    const targetTpl = captionTemplates.find(t => t.id === templateId);
    const targetText = targetTpl?.text?.trim().toLowerCase();

    const updatedTpls = captionTemplates.filter(t => t.id !== templateId && (!targetText || t.text.trim().toLowerCase() !== targetText));
    setCaptionTemplates(updatedTpls);

    // Also remove from project active captions if present (matching templateId OR text)
    const updatedCaps = (currentProj?.captions || []).filter(c => 
      c.template_id !== templateId && 
      (!targetText || (c.text || '').trim().toLowerCase() !== targetText)
    );
    if (selectedCaptionId && !updatedCaps.some(c => c.id === selectedCaptionId)) {
      setSelectedCaptionId(updatedCaps.length > 0 ? updatedCaps[0].id : null);
    }

    try {
      localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(updatedTpls));
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_caption_template',
          payload: { master_bucket_fid: masterBucketFid, templateId }
        })
      });
    } catch (e) {}

    if (setDb) {
      setDb(prev => {
        if (!prev) return prev;
        const currentFmt = { ...(prev.folder_caption_templates || {}) };
        currentFmt[masterBucketFid] = updatedTpls;
        return { ...prev, folder_caption_templates: currentFmt };
      });
    }

    // Persist caption_templates strictly inside activeProject for project-to-project isolation
    if (currentProj) {
      const curHidden = new Set(currentProj.hidden_caption_ids || []);
      curHidden.add(templateId);
      if (targetText) curHidden.add(targetText);
      const updatedProj: VideoEditorProject = {
        ...currentProj,
        caption_templates: updatedTpls,
        captions: updatedCaps,
        hidden_caption_ids: Array.from(curHidden),
        updated_at: Date.now()
      };
      activeProjectRef.current = updatedProj;
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    }
    pushHistorySnapshot();
    showToast(`Deleted template "${templateName}"`, "info");
  }, [captionTemplates, masterBucketFid, setDb, pushHistorySnapshot, showToast, selectedCaptionId, activeProject, onSaveProject]);

  // Transfer / Import Caption, Audio, or Title templates from any project
  // "it is completely isolated from project to project... copy the same template from there...
  // if I modify anything it should not be affecting any other projects...
  // continuously it should not wipe out the data when I import the different thing"
  const handleImportFromProject = useCallback((itemsToImport: any[], sourceProject: VideoEditorProject, type: 'caption' | 'audio' | 'title') => {
    if (!activeProject || !itemsToImport || itemsToImport.length === 0) return;

    if (type === 'caption') {
      // Continuous importing: does NOT wipe out existing captions!
      // Creates fresh unique copies of the caption templates so modifications in current project never affect source project.
      const currentTemplates = Array.isArray(activeProject.caption_templates) 
        ? [...activeProject.caption_templates]
        : [...captionTemplates];
      
      const existingTextMap = new Map<string, VideoEditorCaptionTemplate>();
      currentTemplates.forEach(t => {
        if (t && t.text && t.text.trim()) {
          existingTextMap.set(t.text.trim().toLowerCase(), t);
        }
      });

      const newTemplates: VideoEditorCaptionTemplate[] = [];
      itemsToImport.forEach((item, idx) => {
        const itemText = (item.text || '').trim();
        if (!itemText) return;
        const textKey = itemText.toLowerCase();
        const isIncomingAll = item.mode === 'all' || item.mode === 'must' || Boolean(item.is_must);

        if (existingTextMap.has(textKey)) {
          // If already in project, elevate to 'all' if incoming is 'all'
          const existingTpl = existingTextMap.get(textKey)!;
          if (isIncomingAll && existingTpl.mode !== 'all') {
            existingTpl.mode = 'all';
            existingTpl.is_must = true;
            existingTpl.for_all_videos = true;
          }
          return;
        }

        const templateNumber = currentTemplates.length + newTemplates.length + 1;
        const tpl: VideoEditorCaptionTemplate = {
          id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`,
          name: item.name ? (item.name.startsWith('C') ? `C${templateNumber}` : item.name) : `C${templateNumber}`,
          text: itemText,
          mode: isIncomingAll ? 'all' : 'change',
          is_must: isIncomingAll,
          is_starred: Boolean(item.is_starred),
          is_default: Boolean(item.is_default),
          font_size: item.font_size || 24,
          font_family: item.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          box_width_pct: item.box_width_pct || 85,
          is_bold: item.is_bold !== undefined ? item.is_bold : true,
          x_pct: item.x_pct !== undefined ? item.x_pct : 50,
          y_pct: item.y_pct !== undefined ? item.y_pct : 35,
          color: item.color || '#ffffff',
          stroke_color: item.stroke_color || '#000000',
          clip_rule: item.clip_rule || 'all',
          clip_count: item.clip_count || 2,
          clip_indices: item.clip_indices ? [...item.clip_indices] : [],
          for_all_videos: isIncomingAll,
          created_at: Date.now()
        };
        existingTextMap.set(textKey, tpl);
        newTemplates.push(tpl);
      });

      const mergedTemplates = [...currentTemplates, ...newTemplates];
      setCaptionTemplates(mergedTemplates);
      try {
        localStorage.setItem(`master_caption_templates_${masterBucketFid}`, JSON.stringify(mergedTemplates));
        if (newTemplates.length > 0) {
          fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save_caption_template',
              payload: { master_bucket_fid: masterBucketFid, template: newTemplates[0] }
            })
          }).catch(() => {});
        }
      } catch (_) {}
      if (setDb) {
        setDb(prev => {
          if (!prev) return prev;
          const currentFmt = { ...(prev.folder_caption_templates || {}) };
          currentFmt[masterBucketFid] = mergedTemplates;
          return { ...prev, folder_caption_templates: currentFmt };
        });
      }

      // If activeProject has no active timeline captions, add the first imported one or MUST ones onto the video canvas
      // Strictly deduplicate by text so duplicate captions are never added to canvas
      const seenActiveTexts = new Set<string>();
      const updatedActiveCaptions: VideoEditorCaption[] = [];
      (activeProject.captions || []).forEach(c => {
        if (!c || !c.text || !c.text.trim()) return;
        const k = c.text.trim().toLowerCase();
        if (!seenActiveTexts.has(k)) {
          seenActiveTexts.add(k);
          updatedActiveCaptions.push(c);
        }
      });

      newTemplates.forEach((t) => {
        if (t.is_must || updatedActiveCaptions.length === 0) {
          const tTextKey = (t.text || '').trim().toLowerCase();
          if (!seenActiveTexts.has(tTextKey)) {
            seenActiveTexts.add(tTextKey);
            updatedActiveCaptions.push({
              id: `cap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              template_id: t.id,
              text: t.text,
              is_bold: t.is_bold,
              font_size: t.font_size,
              box_width_pct: t.box_width_pct,
              font_family: t.font_family,
              color: t.color || '#ffffff',
              stroke_color: t.stroke_color || '#000000',
              x_pct: t.x_pct,
              y_pct: t.y_pct,
              clip_rule: t.clip_rule,
              clip_count: t.clip_count,
              clip_indices: t.clip_indices
            });
          }
        }
      });

      const updatedProj: VideoEditorProject = {
        ...activeProject,
        caption_templates: mergedTemplates,
        captions: updatedActiveCaptions,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
      if (updatedActiveCaptions.length > 0 && !selectedCaptionId) {
        setSelectedCaptionId(updatedActiveCaptions[0].id);
      }
      showToast(`Successfully imported ${newTemplates.length} new caption${newTemplates.length === 1 ? '' : 's'} from "${sourceProject.name}"!`, "success");
    }

    if (type === 'audio') {
      // Continuous importing: does NOT wipe out existing music!
      const currentStarred = Array.isArray(activeProject.starred_audio_ids)
        ? [...activeProject.starred_audio_ids]
        : [];
      const currentModes = { ...(activeProject.audio_modes || {}) };

      itemsToImport.forEach((item) => {
        const audioId = item.id;
        if (audioId) {
          if (!currentStarred.includes(audioId)) {
            currentStarred.push(audioId);
          }
          if (item.mode) {
            currentModes[audioId] = item.mode;
          }
        }
      });

      // If current project has no active audio track, set first imported as active
      let activeAudioId = activeProject.audio_id;
      let activeAudioUrl = activeProject.audio_url;
      let activeAudioName = activeProject.audio_name;
      let activeAudioClips = [...(activeProject.audio_clips || [])];

      if (!activeAudioId && itemsToImport.length > 0) {
        const firstItem = itemsToImport[0];
        activeAudioId = firstItem.id;
        activeAudioUrl = firstItem.url;
        activeAudioName = firstItem.name;
        
        const audioData = db?.audios?.[firstItem.id];
        const audioDuration = audioData?.duration || firstItem.duration || 30;
        activeAudioClips = [{
          id: `aclip_${Date.now()}`,
          audio_id: firstItem.id,
          name: firstItem.name,
          url: firstItem.url,
          duration: audioDuration,
          start_time: 0,
          trim_start: 0,
          trim_end: Math.min(totalDuration || 30, audioDuration),
          volume: 1.0,
          speed: 1.0,
          is_muted: false,
          track_layer: 0
        }];
      }

      const updatedProj: VideoEditorProject = {
        ...activeProject,
        starred_audio_ids: currentStarred,
        audio_modes: currentModes,
        audio_id: activeAudioId,
        audio_url: activeAudioUrl,
        audio_name: activeAudioName,
        audio_clips: activeAudioClips,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
      showToast(`Successfully imported ${itemsToImport.length} music track${itemsToImport.length === 1 ? '' : 's'} into Star Bucket from "${sourceProject.name}"!`, "success");
    }

    if (type === 'title') {
      // Continuous importing: does NOT wipe out existing title prompts!
      const currentTemplates = Array.isArray(activeProject.title_templates)
        ? [...activeProject.title_templates]
        : [...titleTemplates];

      const existingCount = currentTemplates.length;
      const newTemplates: VideoEditorTitleTemplate[] = itemsToImport.map((item, idx) => {
        const num = existingCount + idx + 1;
        return {
          id: `title_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`,
          name: item.name ? (item.name.startsWith('Template') ? `Template ${num}` : item.name) : `Template ${num}`,
          prompt: item.prompt || '',
          is_active: currentTemplates.length === 0 && idx === 0,
          created_at: Date.now()
        };
      });

      const mergedTemplates = [...currentTemplates, ...newTemplates];
      setTitleTemplates(mergedTemplates);

      const activeTitleId = activeProject.active_title_template_id || (mergedTemplates[0]?.id);
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        title_templates: mergedTemplates,
        active_title_template_id: activeTitleId,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
      setSelectedTitleTemplateId(activeTitleId);
      showToast(`Successfully imported ${newTemplates.length} AI title template${newTemplates.length === 1 ? '' : 's'} from "${sourceProject.name}"!`, "success");
    }
  }, [activeProject, captionTemplates, captionDefaults, db?.audios, onSaveProject, selectedCaptionId, showToast, totalDuration, titleTemplates]);

  // Universal Multi-Template Synchronization Schedule Engine
  const getCaptionSchedule = useCallback((
    caption: VideoEditorCaption,
    allCaps?: VideoEditorCaption[],
    totalClipsParam?: number
  ): {
    activeClipIndices: number[];
    isSynced: boolean;
    partnerCaptionId?: string;
    partnerName?: string;
    partnerRuleText?: string;
    displayRange: string;
    summaryText: string;
  } => {
    const totalClips = totalClipsParam !== undefined ? totalClipsParam : activeClips.length;
    if (totalClips <= 0) {
      return {
        activeClipIndices: [],
        isSynced: false,
        displayRange: 'No clips',
        summaryText: 'Video has no clips'
      };
    }

    const capsList = allCaps || activeCaptions;
    const rule = caption.clip_rule || 'all';

    const getCapName = (c: VideoEditorCaption) => {
      if (c.template_id) {
        const t = captionTemplates.find(tpl => tpl.id === c.template_id);
        if (t?.name) return t.name;
      }
      return c.text ? (c.text.length > 15 ? c.text.substring(0, 15) + '…' : c.text) : 'Caption';
    };

    // 1. END RULE: Last N clips
    if (rule === 'end') {
      const count = Math.max(1, Math.min(totalClips, caption.clip_count || 1));
      const startIdx = Math.max(0, totalClips - count);
      const activeIndices = Array.from({ length: totalClips - startIdx }, (_, i) => startIdx + i);

      // Check if there is an earlier partner caption syncing into this one (e.g. until_next or start)
      const partner = capsList.find(c => c.id !== caption.id && (c.clip_rule === 'until_next' || c.clip_rule === 'start'));
      const isSynced = Boolean(partner);
      const partnerName = partner ? getCapName(partner) : undefined;
      const displayRange = `Clips ${startIdx + 1} to ${totalClips}`;
      const summaryText = partner
        ? `Synced with ${partnerName}: Active on last ${count} clip(s) (Clips ${startIdx + 1}–${totalClips}), taking over when ${partnerName} finishes.`
        : `Active on last ${count} clip(s) of the video (Clips ${startIdx + 1}–${totalClips}).`;

      return {
        activeClipIndices: activeIndices,
        isSynced,
        partnerCaptionId: partner?.id,
        partnerName,
        partnerRuleText: partner?.clip_rule === 'until_next' ? 'Until Next' : partner?.clip_rule,
        displayRange,
        summaryText
      };
    }

    // 2. START RULE: First N clips
    if (rule === 'start') {
      const count = Math.max(1, Math.min(totalClips, caption.clip_count || 1));
      const activeIndices = Array.from({ length: count }, (_, i) => i);
      const partner = capsList.find(c => c.id !== caption.id && (c.clip_rule === 'until_next' || c.clip_rule === 'end'));
      const isSynced = Boolean(partner);
      const partnerName = partner ? getCapName(partner) : undefined;
      const displayRange = `Clips 1 to ${count}`;
      const summaryText = partner
        ? `Active on first ${count} clip(s) (Clips 1–${count}), followed by ${partnerName}.`
        : `Active on first ${count} clip(s) from the start (Clips 1–${count}).`;

      return {
        activeClipIndices: activeIndices,
        isSynced,
        partnerCaptionId: partner?.id,
        partnerName,
        partnerRuleText: partner?.clip_rule,
        displayRange,
        summaryText
      };
    }

    // 3. UNTIL_LAST_2 RULE
    if (rule === 'until_last_2') {
      const cutoff = Math.max(1, totalClips - 2);
      const activeIndices = Array.from({ length: cutoff }, (_, i) => i);
      return {
        activeClipIndices: activeIndices,
        isSynced: true,
        displayRange: `Clips 1 to ${cutoff}`,
        summaryText: `Shows until the last 2 clips (Clips 1–${cutoff}).`
      };
    }

    // 4. CUSTOM RULE
    if (rule === 'custom') {
      const indices = (caption.clip_indices || []).filter(i => i >= 0 && i < totalClips);
      const activeIndices = indices.length > 0 ? indices : Array.from({ length: totalClips }, (_, i) => i);
      return {
        activeClipIndices: activeIndices,
        isSynced: false,
        displayRange: indices.length > 0 ? `Clips ${indices.map(i => i + 1).join(', ')}` : `All Clips`,
        summaryText: `Showing on custom selected clips: ${indices.map(i => i + 1).join(', ')}.`
      };
    }

    // 5. UNTIL_NEXT RULE: Seamlessly synced with partner caption / template
    if (rule === 'until_next') {
      const otherCaps = capsList.filter(c => c.id !== caption.id);
      // Look for an 'end' caption first (e.g. Template 2 configured for last 2 clips)
      const endPartner = otherCaps.find(c => c.clip_rule === 'end');
      const myIdxInList = capsList.findIndex(c => c.id === caption.id);
      const nextInList = myIdxInList >= 0 && myIdxInList < capsList.length - 1 ? capsList[myIdxInList + 1] : null;
      const partner = endPartner || nextInList || otherCaps[0] || null;

      let startClip = 0;
      const priorStart = otherCaps.find(c => c.clip_rule === 'start');
      if (priorStart) {
        startClip = Math.min(totalClips - 1, priorStart.clip_count || 1);
      }

      let endCutoff = totalClips;
      if (partner) {
        if (partner.clip_rule === 'end') {
          const endCount = Math.max(1, Math.min(totalClips, partner.clip_count || 1));
          endCutoff = Math.max(startClip + 1, totalClips - endCount);
        } else if (partner.clip_rule === 'custom' && partner.clip_indices && partner.clip_indices.length > 0) {
          const minCustom = Math.min(...partner.clip_indices);
          endCutoff = Math.max(startClip + 1, minCustom);
        } else if (partner.clip_rule === 'start') {
          startClip = Math.min(totalClips - 1, partner.clip_count || 1);
          endCutoff = totalClips;
        } else {
          endCutoff = Math.max(startClip + 1, Math.floor(totalClips / 2));
        }
      }

      if (endCutoff <= startClip) {
        endCutoff = totalClips > 1 ? Math.min(totalClips, startClip + 1) : 1;
      }

      const activeIndices = Array.from({ length: Math.max(1, endCutoff - startClip) }, (_, i) => startClip + i);
      const partnerName = partner ? getCapName(partner) : undefined;
      const displayRange = `Clips ${startClip + 1} to ${endCutoff}`;
      const summaryText = partner
        ? `Synced with ${partnerName}: Active continuously from Clip ${startClip + 1} to ${endCutoff} (stops when ${partnerName} starts on Clip ${endCutoff + 1}).`
        : `Shows continuously until the next caption appears (currently Clips 1 to ${totalClips}).`;

      return {
        activeClipIndices: activeIndices,
        isSynced: Boolean(partner),
        partnerCaptionId: partner?.id,
        partnerName,
        partnerRuleText: partner?.clip_rule === 'end' ? `Last ${partner.clip_count || 2} clips` : partner?.clip_rule,
        displayRange,
        summaryText
      };
    }

    // 6. ALL RULE (Default)
    const activeIndices = Array.from({ length: totalClips }, (_, i) => i);
    return {
      activeClipIndices: activeIndices,
      isSynced: false,
      displayRange: `Clips 1 to ${totalClips}`,
      summaryText: `Shows continuously across all clips (Clips 1 to ${totalClips}).`
    };
  }, [activeCaptions, activeClips.length, captionTemplates]);

  // Check if caption should be visible on the currently active clip
  const isCaptionVisible = useCallback((caption: VideoEditorCaption, clipIdx: number, totalClips: number, allCaps?: VideoEditorCaption[]) => {
    // If hidden for this specific project, never visible in editor or timeline
    if (caption.template_id && projectHiddenCaptionIds.has(caption.template_id)) {
      return false;
    }
    const sched = getCaptionSchedule(caption, allCaps, totalClips);
    return sched.activeClipIndices.includes(clipIdx);
  }, [getCaptionSchedule, projectHiddenCaptionIds]);

  // Pointer drag to move caption anywhere on the video screen
  const handleCaptionPointerDown = (e: React.PointerEvent, caption: VideoEditorCaption) => {
    // If the click originated from a resize handle, don't drag the whole caption!
    if ((e.target as HTMLElement).closest('[data-caption-handle]')) return;

    if (isPlaying) pauseAllPlayback();
    e.stopPropagation();
    setSelectedCaptionId(caption.id);
    setSelectedTimelineClipIndex(null);
    setSelectedAudioClipIndex(null);
    const viewport = videoViewportRef.current;
    if (!viewport) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    dragCaptionRef.current = {
      captionId: caption.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initXPct: caption.x_pct,
      initYPct: caption.y_pct
    };

    let latestXPct = caption.x_pct;
    let latestYPct = caption.y_pct;

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragCaptionRef.current || !videoViewportRef.current) return;
      const rect = videoViewportRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const deltaX = ev.clientX - dragCaptionRef.current.startClientX;
      const deltaY = ev.clientY - dragCaptionRef.current.startClientY;

      const rawXPct = dragCaptionRef.current.initXPct + (deltaX / rect.width) * 100;
      const rawYPct = dragCaptionRef.current.initYPct + (deltaY / rect.height) * 100;

      // Smart Magnetic Center Snapping (Horizontal & Vertical alignment guides)
      let finalXPct = rawXPct;
      let isCenterSnapX = false;
      if (Math.abs(rawXPct - 50) < 2.0) {
        finalXPct = 50;
        isCenterSnapX = true;
      }

      let finalYPct = rawYPct;
      let isCenterSnapY = false;
      if (Math.abs(rawYPct - 50) < 2.0) {
        finalYPct = 50;
        isCenterSnapY = true;
      }

      setShowVerticalCenterGuide(isCenterSnapX);
      setShowHorizontalCenterGuide(isCenterSnapY);

      // Keep caption comfortably inside video viewport (5% to 95%) - NOT locked by halfW!
      finalXPct = Math.min(95, Math.max(5, finalXPct));
      finalYPct = Math.min(95, Math.max(5, finalYPct));

      latestXPct = Math.round(finalXPct * 10) / 10;
      latestYPct = Math.round(finalYPct * 10) / 10;

      // Local preview update only (shouldPersist = false) so the browser NEVER freezes!
      handleUpdateCaption(dragCaptionRef.current.captionId, {
        x_pct: latestXPct,
        y_pct: latestYPct
      }, false, false);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        (ev.target as HTMLElement)?.releasePointerCapture(ev.pointerId);
      } catch (_) {}
      setShowVerticalCenterGuide(false);
      setShowHorizontalCenterGuide(false);
      if (dragCaptionRef.current) {
        // Persist final position ONCE to backend!
        handleUpdateCaption(dragCaptionRef.current.captionId, {
          x_pct: latestXPct,
          y_pct: latestYPct
        }, true, true);
      }
      dragCaptionRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  };

  // Right-click over caption to quickly save as template
  const handleCaptionContextMenu = (e: React.MouseEvent, caption: VideoEditorCaption) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCaptionId(caption.id);
    const viewport = videoViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const x = Math.min(rect.width - 170, Math.max(10, e.clientX - rect.left));
    const y = Math.min(rect.height - 50, Math.max(10, e.clientY - rect.top));
    setCaptionContextMenu({ x, y, caption });
  };

  // Pointer drag to scale caption font size from any of the 4 active corners (tl, tr, bl, br)
  const handleCaptionCornerResizePointerDown = (
    e: React.PointerEvent,
    caption: VideoEditorCaption,
    corner: 'tl' | 'tr' | 'bl' | 'br'
  ) => {
    e.stopPropagation();
    setSelectedCaptionId(caption.id);
    const viewport = videoViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initFontSize = caption.font_size || 22;
    const initWidthPct = caption.box_width_pct || 85;

    let latestFontSize = initFontSize;
    let latestWidthPct = initWidthPct;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startClientX;
      const deltaY = ev.clientY - startClientY;
      let delta = 0;
      if (corner === 'br') delta = (deltaX + deltaY) / 2;
      else if (corner === 'tr') delta = (deltaX - deltaY) / 2;
      else if (corner === 'bl') delta = (-deltaX + deltaY) / 2;
      else if (corner === 'tl') delta = (-deltaX - deltaY) / 2;

      // Font size can scale down smoothly to 8px and up to 96px
      const newSize = Math.min(96, Math.max(8, Math.round(initFontSize + delta * 0.35)));

      // Also scale container box_width_pct so dragging corner inward physically shrinks the box without arbitrary stops
      const widthDeltaPct = (delta / rect.width) * 100 * 1.1;
      const newWidthPct = Math.min(96, Math.max(12, Math.round(initWidthPct + widthDeltaPct)));

      latestFontSize = newSize;
      latestWidthPct = newWidthPct;

      handleUpdateCaption(caption.id, { 
        font_size: newSize,
        box_width_pct: newWidthPct
      }, false, false);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        (ev.target as HTMLElement)?.releasePointerCapture(ev.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      handleUpdateCaption(caption.id, {
        font_size: latestFontSize,
        box_width_pct: latestWidthPct
      }, true, true);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  };

  // Pointer drag to resize caption width from left or right handles (controls text alignment & wrapping)
  const handleCaptionWidthResizePointerDown = (
    e: React.PointerEvent,
    caption: VideoEditorCaption,
    side: 'left' | 'right'
  ) => {
    e.stopPropagation();
    setSelectedCaptionId(caption.id);
    const viewport = videoViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}

    const startClientX = e.clientX;
    const initWidthPct = caption.box_width_pct !== undefined ? caption.box_width_pct : 80;

    let latestWidth = initWidthPct;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startClientX;
      const sign = side === 'right' ? 1 : -1;
      const widthDeltaPct = (deltaX * sign / rect.width) * 100 * 2;
      const newWidthPct = Math.min(96, Math.max(15, Math.round(initWidthPct + widthDeltaPct)));
      latestWidth = newWidthPct;
      handleUpdateCaption(caption.id, { box_width_pct: newWidthPct }, false, false);
    };

    const onPointerUp = (ev: PointerEvent) => {
      try {
        (ev.target as HTMLElement)?.releasePointerCapture(ev.pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      handleUpdateCaption(caption.id, { box_width_pct: latestWidth }, true, true);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
  };

  // Create New Project
  const handleCreateProject = async (nameOrEvent?: string | React.FormEvent) => {
    let customName: string | undefined;
    if (typeof nameOrEvent === 'string') {
      customName = nameOrEvent;
    } else if (nameOrEvent && 'preventDefault' in nameOrEvent) {
      nameOrEvent.preventDefault();
    }
    const cleanName = (customName || newProjectName).trim();
    if (!cleanName) {
      showToast("Please enter a project name to continue", "warning");
      return;
    }

    // Clean slate for new project: completely isolated with no music, no captions, and no title templates unless imported
    const newProj: VideoEditorProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      master_bucket_fid: masterBucketFid,
      mode: editorMode,
      clips: [],
      captions: [],
      caption_templates: [],
      title_templates: [],
      active_title_template_id: undefined,
      audio_clips: [],
      starred_audio_ids: [],
      audio_modes: {},
      hidden_audio_ids: [],
      audio_id: undefined,
      audio_url: undefined,
      audio_name: undefined,
      createdBy: currentUserEmail,
      ownerId: currentUserEmail,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    await onSaveProject(newProj);
    initializedProjectIdRef.current = newProj.id;
    setActiveProject(newProj);
    setCaptionTemplates([]);
    setTitleTemplates([]);
    setSelectedCaptionId(null);
    setSelectedAudioClipIndex(null);
    setSelectedTimelineClipIndex(null);
    setCurrentClipIndex(0);
    setProjectCurrentTime(0);
    setProjectNameInput(cleanName);
    setUndoStack([]);
    setRedoStack([]);
    setShowNewProjectModal(false);
    showToast(`Created project "${cleanName}"`, "success");
  };

  // Switch to an existing project
  const handleSelectProject = (proj: VideoEditorProject) => {
    initializedProjectIdRef.current = proj.id;
    setActiveProject(proj);
    setProjectNameInput(proj.name);
    setCurrentClipIndex(0);
    setSelectedTimelineClipIndex(null);
    setIsPlaying(false);
    setUndoStack([]);
    setRedoStack([]);
    setExportResult(null);
    showToast(`Switched to "${proj.name}"`, "info");
  };

  // Rename Project
  const handleSaveRename = async () => {
    if (!activeProject) return;
    const clean = projectNameInput.trim();
    if (!clean || clean === activeProject.name) {
      setIsEditingName(false);
      setProjectNameInput(activeProject.name);
      return;
    }
    await onRenameProject(activeProject.id, clean);
    setActiveProject(prev => prev ? { ...prev, name: clean } : null);
    setIsEditingName(false);
    showToast(`Project renamed to "${clean}"`, "success");
  };

  // Persistent Multi-Track Audio Engine: Direct in-memory HTMLAudioElement instances (matching AudioDashboard)
  // 100% immune to React component re-renders, DOM unmounting, or browser styling
  const getOrCreateAudioElement = useCallback((clip: VideoEditorAudioClip): HTMLAudioElement | null => {
    let el = audioElementsMapRef.current.get(clip.id);
    const candidates = getAudioClipUrlCandidates(clip);
    if (candidates.length === 0) return null;

    if (!el) {
      el = new Audio(candidates[0]);
      el.preload = (config.enabled && config.noAudioPreload) ? "none" : "auto";
      (el as any).playsInline = true;
      (el as any)._candidates = candidates;
      (el as any)._candIdx = 0;
      (el as any)._currentLoadedSrc = candidates[0];

      const advanceCandidate = () => {
        const curEl = audioElementsMapRef.current.get(clip.id);
        if (!curEl) return;
        const candList = (curEl as any)._candidates || candidates;
        const nextIdx = ((curEl as any)._candIdx || 0) + 1;
        if (nextIdx < candList.length) {
          (curEl as any)._candIdx = nextIdx;
          (curEl as any)._currentLoadedSrc = candList[nextIdx];
          curEl.src = candList[nextIdx];
          if (typeof (curEl as any)._pendingSeekTime === 'number') {
            try { curEl.currentTime = (curEl as any)._pendingSeekTime; } catch (_) {}
          }
          if (isPlayingRef.current) {
            curEl.play().catch(() => advanceCandidate());
          }
        }
      };
      (el as any)._advanceCandidate = advanceCandidate;

      // Resilient fallback: if the primary candidate fails with 404 or format issue, try next candidate
      el.addEventListener('error', advanceCandidate);

      // Seek to exact pending time as soon as audio metadata is loaded
      el.addEventListener('loadedmetadata', () => {
        if (typeof (el as any)._pendingSeekTime === 'number') {
          try { el.currentTime = (el as any)._pendingSeekTime; } catch (_) {}
        }
      });

      audioElementsMapRef.current.set(clip.id, el);
      allManagedAudioElementsRef.current.add(el);
    } else {
      (el as any)._candidates = candidates;
      const curIdx = (el as any)._candIdx || 0;
      const targetUrl = candidates[curIdx] || candidates[0];
      if ((el as any)._currentLoadedSrc !== targetUrl) {
        (el as any)._currentLoadedSrc = targetUrl;
        el.src = targetUrl;
        if (typeof (el as any)._pendingSeekTime === 'number') {
          try { el.currentTime = (el as any)._pendingSeekTime; } catch (_) {}
        }
      }
    }

    const isAudioMuted = isMuted || Boolean(clip.is_muted);
    el.muted = isAudioMuted;
    el.volume = isAudioMuted ? 0 : Math.max(0, Math.min(1, clip.volume ?? 1));
    el.playbackRate = clip.speed || 1.0;
    return el;
  }, [getAudioClipUrlCandidates, isMuted]);

  // Clean up detached audio players when clips are deleted from project
  useEffect(() => {
    const activeIds = new Set(activeAudioClips.map(c => c.id));
    audioElementsMapRef.current.forEach((el, id) => {
      if (!activeIds.has(id)) {
        try {
          if (!el.paused) el.pause();
          el.src = '';
        } catch (_) {}
        audioElementsMapRef.current.delete(id);
        allManagedAudioElementsRef.current.delete(el);
      }
    });
  }, [activeAudioClips]);

  // Rock-Solid Audio-Video Synchronization Engine
  const syncAudioTracksToTime = useCallback((time: number, playActive: boolean, isExplicitSeek: boolean = false) => {
    const effectivePlayActive = Boolean(playActive && isPlayingRef.current);

    if (activeAudioClips.length === 0) {
      audioElementsMapRef.current.forEach(el => {
        try { if (!el.paused) el.pause(); } catch (_) {}
      });
      allManagedAudioElementsRef.current.forEach(el => {
        try { if (!el.paused) el.pause(); } catch (_) {}
      });
      return;
    }

    // 1. Direct Instant Stop: when not playing or when scrubbed past totalDuration
    if (!effectivePlayActive || (totalDuration > 0 && time >= totalDuration)) {
      audioElementsMapRef.current.forEach(el => {
        try { if (!el.paused) el.pause(); } catch (_) {}
      });
      allManagedAudioElementsRef.current.forEach(el => {
        try { if (!el.paused) el.pause(); } catch (_) {}
      });

      // Synchronize exact pre-cue time while paused or scrubbing
      activeAudioClips.forEach(clip => {
        const clipStart = clip.start_time !== undefined ? clip.start_time : 0;
        const naturalDur = getAudioClipEffectiveDuration(clip);
        const clipEnd = clipStart + naturalDur;
        if (time >= clipStart && time < clipEnd) {
          const audioEl = getOrCreateAudioElement(clip);
          if (audioEl) {
            const offsetInClip = time - clipStart;
            const targetRate = clip.speed || 1.0;
            const exactAudioTime = Math.max(0, (clip.trim_start || 0) + (offsetInClip * targetRate));
            (audioEl as any)._pendingSeekTime = exactAudioTime;
            try { audioEl.currentTime = exactAudioTime; } catch (_) {}
          }
        }
      });
      return;
    }

    // 2. Active Playback: Start & phase-align clips covering current time
    const activePlayingClipIds = new Set<string>();

    activeAudioClips.forEach(clip => {
      const naturalDur = getAudioClipEffectiveDuration(clip);
      const clipStart = clip.start_time !== undefined ? clip.start_time : 0;
      const maxAllowed = totalDuration > 0 ? Math.max(0, totalDuration - clipStart) : naturalDur;
      const effDur = Math.min(naturalDur, maxAllowed);
      const clipEnd = clipStart + effDur;

      if (time >= clipStart && time < clipEnd) {
        activePlayingClipIds.add(clip.id);

        const audioEl = getOrCreateAudioElement(clip);
        if (!audioEl) return;

        const isAudioMuted = isMuted || Boolean(clip.is_muted);
        if (audioEl.muted !== isAudioMuted) audioEl.muted = isAudioMuted;
        const targetRate = clip.speed || 1.0;
        const targetVol = isAudioMuted ? 0 : Math.max(0, Math.min(1, clip.volume ?? 1));
        if (Math.abs(audioEl.volume - targetVol) > 0.03) audioEl.volume = targetVol;

        const offsetInClip = time - clipStart;
        const exactAudioTime = Math.max(0, (clip.trim_start || 0) + (offsetInClip * targetRate));
        (audioEl as any)._pendingSeekTime = exactAudioTime;

        if (isExplicitSeek) {
          // Hard seek only on direct user gesture, clip switch, or scrubbing
          try { audioEl.currentTime = exactAudioTime; } catch (_) {}
          audioEl.playbackRate = targetRate;
        } else if (audioEl.readyState >= 1) {
          // Butter-smooth rate nudging during continuous playback (ZERO audio buffer flushes)
          const timeDiff = audioEl.currentTime - exactAudioTime;
          const absDiff = Math.abs(timeDiff);
          if (absDiff > 1.2 && !isUserScrubbingTrackRef.current) {
            // Only hard seek on massive desync (>1.2s) when explicitly needed, never short stutter loop
            try { audioEl.currentTime = exactAudioTime; } catch (_) {}
            audioEl.playbackRate = targetRate;
          } else if (absDiff > 0.08) {
            const nudge = timeDiff > 0 ? 0.95 : 1.05;
            audioEl.playbackRate = Math.max(0.2, Math.min(2.0, targetRate * nudge));
          } else {
            audioEl.playbackRate = targetRate;
          }
        }

        if (audioEl.paused) {
          try { audioEl.currentTime = exactAudioTime; } catch (_) {}
          const playPromise = audioEl.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              console.warn("Audio play note:", clip.name, err);
              if (typeof (audioEl as any)._advanceCandidate === 'function') {
                (audioEl as any)._advanceCandidate();
              }
            });
          }
        }
      }
    });

    // Pause clips outside current playback window
    audioElementsMapRef.current.forEach((el, id) => {
      if (!activePlayingClipIds.has(id)) {
        try { if (!el.paused) el.pause(); } catch (_) {}
      }
    });
  }, [activeAudioClips, isMuted, totalDuration, getAudioClipEffectiveDuration, getOrCreateAudioElement]);

  // Synchronize Background Multi-Track Audio Playback whenever audio clips, mute state, or play state change
  useEffect(() => {
    syncAudioTracksToTime(projectCurrentTimeRef.current, isPlaying, false);
  }, [syncAudioTracksToTime, isPlaying]);

  // Group active audio clips into distinct playback layers (Layer 0, Layer 1...)
  // Automatically prevents overlaps by assigning overlapping audio clips on the same layer into distinct sub-tracks!
  const audioLayers = useMemo(() => {
    if (activeAudioClips.length === 0) return [];
    
    // Sort clips chronologically by start time
    const sorted = [...activeAudioClips].sort((a, b) => (a.start_time || 0) - (b.start_time || 0));
    const trackRows: { layerIndex: number; clips: VideoEditorAudioClip[] }[] = [];

    sorted.forEach(clip => {
      const preferredLayer = clip.track_layer || 0;
      const cStart = clip.start_time || 0;
      const cDur = getAudioClipEffectiveDuration(clip);
      const cEnd = cStart + cDur;

      // Try placing in preferredLayer first if it doesn't overlap any existing clip on that row
      let placed = false;
      for (const row of trackRows) {
        if (row.layerIndex === preferredLayer) {
          const overlaps = row.clips.some(existing => {
            const eStart = existing.start_time || 0;
            const eDur = getAudioClipEffectiveDuration(existing);
            const eEnd = eStart + eDur;
            return cStart < eEnd && eStart < cEnd;
          });
          if (!overlaps) {
            row.clips.push(clip);
            placed = true;
            break;
          }
        }
      }

      if (!placed) {
        // Find existing row without collision or create new row
        const targetRow = trackRows.find(row => {
          return row.layerIndex >= preferredLayer && !row.clips.some(existing => {
            const eStart = existing.start_time || 0;
            const eDur = getAudioClipEffectiveDuration(existing);
            const eEnd = eStart + eDur;
            return cStart < eEnd && eStart < cEnd;
          });
        });

        if (targetRow) {
          targetRow.clips.push(clip);
        } else {
          // Find next available layer index
          const usedLayers = new Set(trackRows.map(r => r.layerIndex));
          let nextLayer = preferredLayer;
          while (usedLayers.has(nextLayer)) {
            nextLayer++;
          }
          trackRows.push({
            layerIndex: nextLayer,
            clips: [clip]
          });
        }
      }
    });

    return trackRows.sort((a, b) => a.layerIndex - b.layerIndex);
  }, [activeAudioClips, getAudioClipEffectiveDuration]);

  // Exact screen pixel width of all sequential video clips combined including inter-clip gaps
  const totalVideoClipsWidth = useMemo(() => {
    if (activeClips.length === 0) return 0;
    const clipsWidth = activeClips.reduce((acc, c) => {
      const effDur = getClipEffectiveDuration(c);
      return acc + Math.max(22, Math.round(effDur * timelineZoom));
    }, 0);
    const gaps = Math.max(0, activeClips.length - 1) * 2; // gap-0.5 is 2px
    return clipsWidth + gaps;
  }, [activeClips, timelineZoom, getClipEffectiveDuration]);

  // Track 2+: Multi-Layer Connected Caption Spans (Supports simultaneous/overlapping captions on the same clips)
  const captionLayersSpans = useMemo(() => {
    if (activeClips.length === 0 || activeCaptions.length === 0) return [];
    const clipWidths = activeClips.map(clip => {
      const effDuration = getClipEffectiveDuration(clip);
      return Math.max(22, Math.round(effDuration * timelineZoom));
    });

    // Partition activeCaptions into layers such that overlapping captions go to separate layers
    const layersOfCaptions: VideoEditorCaption[][] = [];
    activeCaptions.forEach(cap => {
      let placed = false;
      for (let l = 0; l < layersOfCaptions.length; l++) {
        const conflict = layersOfCaptions[l].some(existing => {
          return activeClips.some((_, clipIdx) => 
            isCaptionVisible(existing, clipIdx, activeClips.length, activeCaptions) &&
            isCaptionVisible(cap, clipIdx, activeClips.length, activeCaptions)
          );
        });
        if (!conflict) {
          layersOfCaptions[l].push(cap);
          placed = true;
          break;
        }
      }
      if (!placed) {
        layersOfCaptions.push([cap]);
      }
    });

    interface SpanItem {
      caption: VideoEditorCaption | null;
      startClipIdx: number;
      endClipIdx: number;
      totalWidth: number;
      clipsCount: number;
      paletteIdx: number;
    }

    let colorCounter = 0;
    return layersOfCaptions.map((layerCaptions, layerIdx) => {
      const spans: SpanItem[] = [];
      let currentSpan: SpanItem | null = null;

      activeClips.forEach((_, idx) => {
        const capsOnClip = layerCaptions.filter(c => isCaptionVisible(c, idx, activeClips.length, activeCaptions));
        const cap = capsOnClip.length > 0 ? capsOnClip[0] : null;
        const clipW = clipWidths[idx];

        if (!currentSpan) {
          currentSpan = {
            caption: cap,
            startClipIdx: idx,
            endClipIdx: idx,
            totalWidth: clipW,
            clipsCount: 1,
            paletteIdx: cap ? colorCounter++ % CAPTION_PALETTES.length : 0
          };
        } else {
          const same = (currentSpan.caption === null && cap === null) ||
                       (currentSpan.caption !== null && cap !== null && currentSpan.caption.id === cap.id);
          if (same) {
            currentSpan.endClipIdx = idx;
            currentSpan.totalWidth += clipW + 2;
            currentSpan.clipsCount += 1;
          } else {
            spans.push(currentSpan);
            currentSpan = {
              caption: cap,
              startClipIdx: idx,
              endClipIdx: idx,
              totalWidth: clipW,
              clipsCount: 1,
              paletteIdx: cap ? colorCounter++ % CAPTION_PALETTES.length : 0
            };
          }
        }
      });

      if (currentSpan) {
        spans.push(currentSpan);
      }
      return { layerIndex: layerIdx, spans };
    });
  }, [activeClips, activeCaptions, timelineZoom, isCaptionVisible, getClipEffectiveDuration]);

  // Snug Timeline Track Viewport Height: Fits ONLY active tracks with zero wasted space and no vertical scroll
  const timelineTrackHeight = useMemo(() => {
    const videoHeight = 64; // Video player strip (h-15 / h-16)
    const captionHeight = captionLayersSpans.length > 0 ? captionLayersSpans.length * 24 : 0;
    const audioHeight = audioLayers.length > 0 ? (audioLayers.length * 28 + 24) : 0;
    const totalRequired = videoHeight + captionHeight + audioHeight;
    // Keep compact and freeze scrolling unless tracks reach middle of screen (~260px)
    return Math.min(260, Math.max(64, totalRequired));
  }, [captionLayersSpans.length, audioLayers.length]);

  // Convert project time into exact pixel offset along the strip
  const getPixelForTime = useCallback((time: number) => {
    if (timelineClipsMeta.length === 0) return 0;
    const clamped = Math.max(0, Math.min(totalDuration, time));
    for (const meta of timelineClipsMeta) {
      if (clamped >= meta.projectStartTime && clamped <= meta.projectEndTime) {
        const ratio = meta.effectiveDur > 0 ? (clamped - meta.projectStartTime) / meta.effectiveDur : 0;
        return meta.pixelStart + ratio * meta.pixelWidth;
      }
    }
    if (clamped >= totalDuration) {
      return totalTimelinePixels;
    }
    return 0;
  }, [timelineClipsMeta, totalDuration, totalTimelinePixels]);

  // Convert pixel scroll offset into project time
  const getTimeForPixel = useCallback((px: number) => {
    if (timelineClipsMeta.length === 0) return 0;
    for (const meta of timelineClipsMeta) {
      if (px >= meta.pixelStart && px <= meta.pixelEnd) {
        const ratio = meta.pixelWidth > 0 ? (px - meta.pixelStart) / meta.pixelWidth : 0;
        return meta.projectStartTime + ratio * meta.effectiveDur;
      }
    }
    if (px < 0) return 0;
    return totalDuration;
  }, [timelineClipsMeta, totalDuration]);

  const lastClipSwitchTimeRef = useRef<number>(0);

  // Dedicated seamless clip advancement function (called at 60fps tick, timeUpdate, or onEnded)
  const advanceToNextClip = useCallback((clipIdx: number) => {
    if (clipIdx !== currentClipIndexRef.current) return;
    if (!isPlayingRef.current) return;
    const now = performance.now();
    // Debounce to prevent cascading or premature multi-clip jump
    if (now - lastClipSwitchTimeRef.current < 250) return;
    lastClipSwitchTimeRef.current = now;
    lastPreCuedClipIndexRef.current = null;

    // Single-Clip Loop: If this clip is set to loop endlessly, restart from its trimStart
    if (isLoopingClipRef.current && loopClipIndexRef.current === clipIdx) {
      const meta = timelineClipsMeta[clipIdx];
      const vid = videoElementsRef.current.get(meta?.clip.id);
      if (vid && meta) {
        try { vid.currentTime = meta.trimStart; } catch (_) {}
        if (vid.paused && isPlayingRef.current) {
          vid.play().catch(() => {});
        }
        projectCurrentTimeRef.current = meta.projectStartTime;
        setProjectCurrentTime(meta.projectStartTime);
        syncAudioTracksToTime(meta.projectStartTime, true, false);
      }
      return;
    }

    const nextIdx = clipIdx + 1;
    if (nextIdx < timelineClipsMeta.length) {
      const nextMeta = timelineClipsMeta[nextIdx];
      const nextVid = videoElementsRef.current.get(nextMeta.clip.id);
      const curVid = videoElementsRef.current.get(timelineClipsMeta[clipIdx]?.clip.id);

      // Gapless continuous playback: keep previous video rendered underneath so there is 0 black screen or stutter
      setPreviousClipIndex(clipIdx);
      currentClipIndexRef.current = nextIdx;
      setCurrentClipIndex(nextIdx);
      projectCurrentTimeRef.current = nextMeta.projectStartTime;
      setProjectCurrentTime(nextMeta.projectStartTime);

      if (nextVid) {
        nextVid.playbackRate = nextMeta.speed;
        applyVideoElementAudio(nextMeta.clip.id, nextVid, nextMeta.clip);
        if (Math.abs(nextVid.currentTime - nextMeta.trimStart) > 0.08) {
          try { nextVid.currentTime = nextMeta.trimStart; } catch (_) {}
        }
        if (isPlayingRef.current) {
          const playPromise = nextVid.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              if (curVid && curVid !== nextVid && !curVid.paused) {
                try { curVid.pause(); } catch (_) {}
              }
              setTimeout(() => {
                setPreviousClipIndex(prev => prev === clipIdx ? null : prev);
              }, 80);
            }).catch(() => {
              // Resilient fallback for iframe autoplay restrictions
              nextVid.muted = true;
              nextVid.play().then(() => {
                if (curVid && curVid !== nextVid && !curVid.paused) {
                  try { curVid.pause(); } catch (_) {}
                }
                setTimeout(() => {
                  setPreviousClipIndex(prev => prev === clipIdx ? null : prev);
                }, 80);
              }).catch(() => {});
            });
          }
        }
      }

      if (isPlayingRef.current) {
        syncAudioTracksToTime(nextMeta.projectStartTime, true, false);
      }
    } else {
      // Loop back to beginning - seamless continuous transition
      const firstMeta = timelineClipsMeta[0];
      const firstVid = videoElementsRef.current.get(firstMeta?.clip.id);
      const curVid = videoElementsRef.current.get(timelineClipsMeta[clipIdx]?.clip.id);

      setPreviousClipIndex(clipIdx);
      currentClipIndexRef.current = 0;
      setCurrentClipIndex(0);

      if (firstVid) {
        firstVid.playbackRate = firstMeta.speed;
        applyVideoElementAudio(firstMeta.clip.id, firstVid, firstMeta.clip);
        if (Math.abs(firstVid.currentTime - firstMeta.trimStart) > 0.08) {
          try { firstVid.currentTime = firstMeta.trimStart; } catch (_) {}
        }
        if (isPlayingRef.current) {
          const playPromise = firstVid.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              if (curVid && curVid !== firstVid && !curVid.paused) {
                try { curVid.pause(); } catch (_) {}
              }
              setTimeout(() => {
                setPreviousClipIndex(prev => prev === clipIdx ? null : prev);
              }, 80);
            }).catch(() => {});
          }
        }
      }

      if (curVid && curVid !== firstVid && !curVid.paused) {
        try { curVid.pause(); } catch (_) {}
      }

      // Pre-cue and pause all other clips so they don't linger at ended=true
      timelineClipsMeta.forEach((m) => {
        const v = videoElementsRef.current.get(m.clip.id);
        if (v && v !== firstVid) {
          try {
            v.pause();
            v.currentTime = m.trimStart;
          } catch (_) {}
        }
      });

      if (firstVid && firstMeta) {
        firstVid.playbackRate = firstMeta.speed || 1;
        applyVideoElementAudio(firstMeta.clip.id, firstVid, firstMeta.clip);
        try { firstVid.currentTime = firstMeta.trimStart; } catch (_) {}
        if (isPlayingRef.current) {
          const playPromise = firstVid.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              firstVid.muted = true;
              firstVid.play().catch(() => {});
            });
          }
        }
      }

      if (curVid && curVid !== firstVid && !curVid.paused) {
        try { curVid.pause(); } catch (_) {}
      }

      projectCurrentTimeRef.current = 0;
      setProjectCurrentTime(0);
      if (isPlayingRef.current) {
        syncAudioTracksToTime(0, true, true);
      }
    }
  }, [timelineClipsMeta, applyVideoElementAudio, syncAudioTracksToTime]);

  // 60fps Butter-Smooth Playhead & Timeline Scroll Sync without stutter, lag, or video/audio drift
  useEffect(() => {
    if (!isPlaying) {
      if (!isUserScrubbingTrackRef.current && timelineTrackRef.current && !trimmingHandle) {
        const targetPx = getPixelForTime(projectCurrentTimeRef.current);
        if (Math.abs(timelineTrackRef.current.scrollLeft - targetPx) > 1.0) {
          timelineTrackRef.current.scrollLeft = targetPx;
        }
      }
      return;
    }

    const tick = () => {
      if (!isPlayingRef.current) return;
      const isLoop = isLoopingClipRef.current && loopClipIndexRef.current !== null;
      const activeIdx = isLoop ? loopClipIndexRef.current! : currentClipIndexRef.current;
      const activeMeta = timelineClipsMeta[activeIdx];
      const vid = activeMeta ? videoElementsRef.current.get(activeMeta.clip.id) : null;

      if (vid && activeMeta) {
        const mustBeMuted = getIsClipMuted(activeMeta.clip);
        if (mustBeMuted) {
          if (!vid.muted) vid.muted = true;
          if (vid.volume !== 0) {
            try { vid.volume = 0; } catch (_) {}
          }
        }
      }

      if (vid && !isUserScrubbingTrackRef.current && !trimmingHandle) {
        const cur = vid.currentTime;
        const timeSinceSwitch = performance.now() - lastClipSwitchTimeRef.current;

        // 1. Proactive pre-cue of NEXT clip (DISABLED while in single-clip loop mode)
        if (!isLoopingClipRef.current) {
          const nextIdx = currentClipIndexRef.current + 1;
          if (nextIdx < timelineClipsMeta.length) {
            const nextMeta = timelineClipsMeta[nextIdx];
            const nextVid = videoElementsRef.current.get(nextMeta.clip.id);
            if (nextVid) {
              if (nextVid.preload !== "auto") nextVid.preload = "auto";
              if (nextVid.readyState >= 1) {
                if (lastPreCuedClipIndexRef.current !== nextIdx && !nextVid.seeking && Math.abs(nextVid.currentTime - nextMeta.trimStart) > 0.05) {
                  lastPreCuedClipIndexRef.current = nextIdx;
                  nextVid.playbackRate = nextMeta.speed;
                  try { nextVid.currentTime = nextMeta.trimStart; } catch (_) {}
                }
              }
            }
          } else if (timelineClipsMeta.length > 1 && cur >= activeMeta.trimEnd - 0.40) {
            // Pre-cue clip 0 for zero-lag seamless loop
            const firstMeta = timelineClipsMeta[0];
            const firstVid = videoElementsRef.current.get(firstMeta.clip.id);
            if (firstVid && firstVid.paused && Math.abs(firstVid.currentTime - firstMeta.trimStart) > 0.06) {
              try { firstVid.currentTime = firstMeta.trimStart; } catch (_) {}
            }
          }
        }

        // 2. Precise 60fps clip boundary detection (Instant seamless switch with 0ms delay)
        if (isLoopingClipRef.current && loopClipIndexRef.current !== null) {
          const targetLoopIdx = loopClipIndexRef.current;
          const loopMeta = timelineClipsMeta[targetLoopIdx];
          const loopVid = videoElementsRef.current.get(loopMeta?.clip.id);
          if (loopVid && loopMeta) {
            const loopCur = loopVid.currentTime;
            if (loopCur >= loopMeta.trimEnd - 0.03 || loopVid.ended) {
              try { loopVid.currentTime = loopMeta.trimStart; } catch (_) {}
              if (loopVid.paused && isPlayingRef.current) {
                loopVid.play().catch(() => {});
              }
              projectCurrentTimeRef.current = loopMeta.projectStartTime;
              setProjectCurrentTime(loopMeta.projectStartTime);
              syncAudioTracksToTime(loopMeta.projectStartTime, true, false);
              lastClipSwitchTimeRef.current = performance.now();
              if (isPlayingRef.current) {
                animIdRef.current = requestAnimationFrame(tick);
              }
              return;
            }
          }
        } else if (timeSinceSwitch > 250 && !vid.seeking && !vid.paused) {
          const reachedEnd = cur >= activeMeta.trimEnd - 0.03 && cur > activeMeta.trimStart + 0.1;
          const naturalEnded = vid.ended && cur > activeMeta.trimStart + 0.1;
          if (reachedEnd || naturalEnded) {
            advanceToNextClip(currentClipIndexRef.current);
            if (isPlayingRef.current) {
              animIdRef.current = requestAnimationFrame(tick);
            }
            return;
          }
        }

        const projTime = Math.min(
          totalDuration,
          activeMeta.projectStartTime + Math.max(0, cur - activeMeta.trimStart) / activeMeta.speed
        );
        projectCurrentTimeRef.current = projTime;

        // Hardware-direct 60fps playhead scrolling without component re-renders
        if (timelineTrackRef.current) {
          const targetPx = getPixelForTime(projTime);
          timelineTrackRef.current.scrollLeft = targetPx;
        }

        const now = performance.now();

        // Lock audio tracks to current video frame time with smooth phase alignment only when video is actively advancing
        if (!vid.paused && !vid.seeking && vid.readyState >= 2 && now - lastAudioSyncTimeRef.current > 250) {
          lastAudioSyncTimeRef.current = now;
          syncAudioTracksToTime(projTime, true, false);
        }

        // Throttle React state update to ~150ms to prevent heavy component re-render thrashing
        if (now - lastStateUpdateTimeRef.current > 150) {
          lastStateUpdateTimeRef.current = now;
          setProjectCurrentTime(projTime);
        }
      }

      if (isPlayingRef.current) {
        animIdRef.current = requestAnimationFrame(tick);
      }
    };

    if (isPlayingRef.current) {
      animIdRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [isPlaying, timelineClipsMeta, trimmingHandle, getPixelForTime, totalDuration, syncAudioTracksToTime, advanceToNextClip]);

  const currentPlayingClip = activeClips[currentClipIndex] || null;

  // Instant Seeking across all clips in project timeline without reloading delay
  const seekToProjectTime = useCallback((targetTime: number, shouldPlay?: boolean) => {
    if (timelineClipsMeta.length === 0) return;
    lastPreCuedClipIndexRef.current = null;
    const clampedTime = Math.max(0, Math.min(totalDuration, targetTime));
    projectCurrentTimeRef.current = clampedTime;
    setPreviousClipIndex(null);
    
    // Find which clip contains this project time
    let foundIdx = timelineClipsMeta.findIndex(
      m => clampedTime >= m.projectStartTime && clampedTime < m.projectEndTime
    );
    if (foundIdx === -1) {
      foundIdx = clampedTime >= totalDuration ? timelineClipsMeta.length - 1 : 0;
    }

    const meta = timelineClipsMeta[foundIdx];
    const offsetInClip = Math.max(0, clampedTime - meta.projectStartTime);
    const localVideoTime = Math.min(meta.trimEnd, meta.trimStart + (offsetInClip * meta.speed));

    // Pause all inactive videos
    videoElementsRef.current.forEach((el, id) => {
      if (id !== meta.clip.id) {
        try { if (!el.paused) el.pause(); } catch (_) {}
      }
    });

    const targetEl = videoElementsRef.current.get(meta.clip.id);
    const shouldStartPlaying = shouldPlay !== undefined ? shouldPlay : isPlaying;
    if (targetEl) {
      targetEl.playbackRate = meta.speed;
      applyVideoElementAudio(meta.clip.id, targetEl, meta.clip);
      
      if (shouldStartPlaying) {
        pendingScrubTimeRef.current = null;
        try { targetEl.currentTime = localVideoTime; } catch (_) {}
        targetEl.play().catch(() => {
          targetEl.muted = true;
          targetEl.play().catch(() => {});
        });
      } else {
        // CONTINUOUS NON-BLOCKING LIVE FRAME RENDERING:
        // When finger is moving, queue seeks if decoder is currently decoding (targetEl.seeking is true).
        // This ensures the browser NEVER aborts ongoing frame decoding, delivering a silky-smooth
        // continuous stream of video frames while your finger is sliding!
        const executeSeek = (el: HTMLVideoElement, time: number) => {
          if (el.seeking || isVideoSeekingRef.current) {
            pendingScrubTimeRef.current = { clipId: meta.clip.id, time };
            return;
          }

          isVideoSeekingRef.current = true;
          pendingScrubTimeRef.current = null;

          let seekSafetyTimeout: any = setTimeout(() => {
            el.removeEventListener('seeked', onSeeked);
            isVideoSeekingRef.current = false;
            if (pendingScrubTimeRef.current && pendingScrubTimeRef.current.clipId === meta.clip.id) {
              const nextTime = pendingScrubTimeRef.current.time;
              pendingScrubTimeRef.current = null;
              try {
                el.currentTime = nextTime;
                isVideoSeekingRef.current = true;
                el.addEventListener('seeked', onSeeked, { once: true });
              } catch (_) {
                isVideoSeekingRef.current = false;
              }
            }
          }, 120);

          const onSeeked = () => {
            if (seekSafetyTimeout) {
              clearTimeout(seekSafetyTimeout);
              seekSafetyTimeout = null;
            }
            el.removeEventListener('seeked', onSeeked);
            isVideoSeekingRef.current = false;
            if (pendingScrubTimeRef.current && pendingScrubTimeRef.current.clipId === meta.clip.id) {
              const nextTime = pendingScrubTimeRef.current.time;
              pendingScrubTimeRef.current = null;
              try {
                el.currentTime = nextTime;
                isVideoSeekingRef.current = true;
                el.addEventListener('seeked', onSeeked, { once: true });
              } catch (_) {
                isVideoSeekingRef.current = false;
              }
            }
          };

          el.addEventListener('seeked', onSeeked, { once: true });

          try {
            el.currentTime = time;
          } catch (_) {
            if (seekSafetyTimeout) clearTimeout(seekSafetyTimeout);
            isVideoSeekingRef.current = false;
          }
        };

        executeSeek(targetEl, localVideoTime);

        try { if (!targetEl.paused) targetEl.pause(); } catch (_) {}
      }
    }

    // Direct synchronization of audio tracks at seek time
    syncAudioTracksToTime(clampedTime, shouldStartPlaying, true);

    if (currentClipIndexRef.current !== foundIdx) {
      currentClipIndexRef.current = foundIdx;
      setCurrentClipIndex(foundIdx);
    }

    setClipCurrentTime(localVideoTime);
    setProjectCurrentTime(clampedTime);
  }, [timelineClipsMeta, totalDuration, isPlaying, isMuted, syncAudioTracksToTime, applyVideoElementAudio]);

  const handleSelectClipInAiMode = useCallback((idx: number) => {
    if (idx < 0 || idx >= activeClips.length) return;
    setSelectedTimelineClipIndex(idx);
    setCurrentClipIndex(idx);
  }, [activeClips.length]);

  const handleSwitchClipVariant = useCallback((clipIdx: number, variantIdx: number, groupIdx?: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({
      ...g,
      clips: [...g.clips]
    }));
    const targetGrpIdx = typeof groupIdx === 'number'
      ? Math.min(Math.max(0, groupIdx), groups.length - 1)
      : Math.min(Math.max(0, clip.active_variant_group_index ?? 0), groups.length - 1);
    const activeGrp = groups[targetGrpIdx];
    if (!activeGrp || variantIdx < 0 || variantIdx >= activeGrp.clips.length) return;

    activeGrp.active_clip_index = variantIdx;
    const targetVariant = activeGrp.clips[variantIdx];
    const targetDur = targetVariant.duration || clip.duration || 5;

    const updatedClip: VideoEditorClip = {
      ...clip,
      url: targetVariant.url,
      file_id: targetVariant.file_id || clip.file_id,
      duration: targetDur,
      trim_start: targetVariant.trim_start ?? 0,
      trim_end: targetVariant.trim_end ?? targetDur,
      variants: activeGrp.clips,
      active_variant_index: variantIdx,
      variant_groups: groups,
      active_variant_group_index: targetGrpIdx
    };
    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    // Invalidate cached blob for this clip so video element immediately streams the new variant take
    setClipBlobUrls(prev => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });

    // Immediately open this clip and take on the current scene screen
    setSelectedTimelineClipIndex(clipIdx);
    setCurrentClipIndex(clipIdx);
    const meta = timelineClipsMeta[clipIdx];
    if (meta) {
      seekToProjectTime(meta.projectStartTime + 0.05, true);
    }

    const dotNum = variantIdx + 1;
    showToast(`Concept ${activeGrp.label} · Variant ${dotNum} (${dotNum}/${activeGrp.clips.length})`, "info");
  }, [activeClips, timelineClipsMeta, seekToProjectTime, updateProjectClips, showToast]);

  const handleSwitchVariantGroup = useCallback((clipIdx: number, groupIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    if (groupIdx < 0 || groupIdx >= groups.length) return;

    const targetGroup = groups[groupIdx];
    const activeClipIdx = Math.min(
      Math.max(0, targetGroup.active_clip_index ?? 0),
      Math.max(0, targetGroup.clips.length - 1)
    );
    const targetTake = targetGroup.clips[activeClipIdx] || clip;

    const updatedClip: VideoEditorClip = {
      ...clip,
      url: targetTake.url,
      file_id: targetTake.file_id || clip.file_id,
      duration: targetTake.duration || clip.duration,
      trim_start: targetTake.trim_start ?? 0,
      trim_end: targetTake.trim_end ?? (targetTake.duration || clip.duration),
      variant_groups: groups,
      active_variant_group_index: groupIdx,
      variants: targetGroup.clips,
      active_variant_index: activeClipIdx
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    setClipBlobUrls(prev => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });

    setSelectedTimelineClipIndex(clipIdx);
    setCurrentClipIndex(clipIdx);
    const meta = timelineClipsMeta[clipIdx];
    if (meta) {
      seekToProjectTime(meta.projectStartTime + 0.05, true);
    }

    showToast(`Switched to Concept ${targetGroup.label} (${targetGroup.clips.length} ${targetGroup.clips.length === 1 ? 'variant' : 'variants'})`, "info");
  }, [activeClips, timelineClipsMeta, seekToProjectTime, updateProjectClips, showToast]);

  const handleDeleteVariantGroup = useCallback((clipIdx: number, groupIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    if (groups.length <= 1 || groupIdx < 0 || groupIdx >= groups.length) return;

    const letterLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const removedLabel = groups[groupIdx]?.label || letterLabels[groupIdx] || `${groupIdx + 1}`;
    const remainingGroups = groups
      .filter((_, idx) => idx !== groupIdx)
      .map((g, idx) => ({
        ...g,
        label: letterLabels[idx] || `${idx + 1}`
      }));

    let newGroupIdx = clip.active_variant_group_index ?? 0;
    if (newGroupIdx === groupIdx) {
      newGroupIdx = Math.max(0, groupIdx - 1);
    } else if (newGroupIdx > groupIdx) {
      newGroupIdx -= 1;
    }
    newGroupIdx = Math.min(newGroupIdx, remainingGroups.length - 1);

    const activeGroup = remainingGroups[newGroupIdx];
    const activeClipIdx = Math.min(
      Math.max(0, activeGroup.active_clip_index ?? 0),
      Math.max(0, activeGroup.clips.length - 1)
    );
    const targetTake = activeGroup.clips[activeClipIdx] || clip;

    const updatedClip: VideoEditorClip = {
      ...clip,
      url: targetTake.url,
      file_id: targetTake.file_id || clip.file_id,
      duration: targetTake.duration || clip.duration,
      variant_groups: remainingGroups,
      active_variant_group_index: newGroupIdx,
      variants: activeGroup.clips,
      active_variant_index: activeClipIdx
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    setClipBlobUrls(prev => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });

    showToast(`Deleted Variant ${removedLabel} from Clip #${clipIdx + 1}`, "info");
  }, [activeClips, updateProjectClips, showToast]);

  const handleDeleteClipVariant = useCallback((clipIdx: number, variantIdx: number, groupIdx?: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    const targetGroupIdx = typeof groupIdx === 'number'
      ? Math.min(Math.max(0, groupIdx), groups.length - 1)
      : Math.min(Math.max(0, clip.active_variant_group_index ?? 0), groups.length - 1);
    const activeGroup = groups[targetGroupIdx];
    if (!activeGroup || !activeGroup.clips || variantIdx < 0 || variantIdx >= activeGroup.clips.length) return;

    const updatedVariants = activeGroup.clips.filter((_, idx) => idx !== variantIdx);
    if (updatedVariants.length === 0) {
      if (groups.length > 1) {
        handleDeleteVariantGroup(clipIdx, targetGroupIdx);
      }
      return;
    }

    let newActiveIdx = activeGroup.active_clip_index ?? clip.active_variant_index ?? 0;
    if (newActiveIdx === variantIdx) {
      newActiveIdx = Math.max(0, variantIdx - 1);
    } else if (newActiveIdx > variantIdx) {
      newActiveIdx -= 1;
    }

    const targetTake = updatedVariants[newActiveIdx] || updatedVariants[0];
    activeGroup.clips = updatedVariants;
    activeGroup.active_clip_index = newActiveIdx;

    const isCurrentActiveGroup = targetGroupIdx === (clip.active_variant_group_index ?? 0);
    const currentActiveGroup = groups[clip.active_variant_group_index ?? 0] || activeGroup;
    const currentActiveTake = currentActiveGroup.clips[currentActiveGroup.active_clip_index || 0] || clip;

    const updatedClip: VideoEditorClip = {
      ...clip,
      url: isCurrentActiveGroup ? targetTake.url : currentActiveTake.url,
      file_id: isCurrentActiveGroup ? (targetTake.file_id || clip.file_id) : (currentActiveTake.file_id || clip.file_id),
      duration: isCurrentActiveGroup ? (targetTake.duration || clip.duration) : (currentActiveTake.duration || clip.duration),
      variant_groups: groups,
      active_variant_group_index: clip.active_variant_group_index ?? 0,
      variants: currentActiveGroup.clips,
      active_variant_index: currentActiveGroup.active_clip_index || 0
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    setClipBlobUrls(prev => {
      const next = { ...prev };
      delete next[clip.id];
      return next;
    });

    showToast(`Deleted take #${variantIdx + 1} from Concept ${activeGroup.label} on Clip #${clipIdx + 1}`, "info");
  }, [activeClips, handleDeleteVariantGroup, updateProjectClips, showToast]);

  const handleDeleteSpecificClip = useCallback((clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const updated = activeClips.filter((_, idx) => idx !== clipIdx);
    updateProjectClips(updated, true);
    setClipBlobUrls(prev => {
      const next = { ...prev };
      if (clip?.id) delete next[clip.id];
      return next;
    });
    const newIdx = Math.min(clipIdx, Math.max(0, updated.length - 1));
    setSelectedTimelineClipIndex(updated.length > 0 ? newIdx : null);
    setCurrentClipIndex(updated.length > 0 ? newIdx : 0);
    showToast(`Deleted Clip #${clipIdx + 1}`, "info");
  }, [activeClips, updateProjectClips, showToast]);

  const handleSelectClipFromClipsDrawer = useCallback((clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    setSelectedTimelineClipIndex(clipIdx);
    setCurrentClipIndex(clipIdx);
  }, [activeClips.length]);

  // Handle user dragging or scrolling the timeline track
  const handleTimelineTrackScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isPlaying) return;
    const scrollX = e.currentTarget.scrollLeft;
    const targetTime = getTimeForPixel(scrollX);
    seekToProjectTime(targetTime, false);
  };

  // Two-finger Pinch-to-Zoom Handlers (Mobile & Touchpad) & Single-finger Live Frame Scrub
  const handleTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    pauseAllPlayback();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialZoomRef.current = timelineZoom;
      isUserScrubbingTrackRef.current = false;
      return;
    }
    isUserScrubbingTrackRef.current = true;
    if (e.touches.length === 1 && timelineTrackRef.current) {
      touchStartScrollRef.current = {
        clientX: e.touches[0].clientX,
        scrollLeft: timelineTrackRef.current.scrollLeft
      };
    }
  };

  const handleTimelineTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / initialPinchDistRef.current;
      const newZoom = Math.min(220, Math.max(20, Math.round(initialZoomRef.current * scale)));
      setTimelineZoom(newZoom);
      return;
    }
    // Single finger live swipe: actively move video frame in real time as finger moves across track
    if (e.touches.length === 1 && touchStartScrollRef.current && timelineTrackRef.current) {
      const deltaX = touchStartScrollRef.current.clientX - e.touches[0].clientX;
      const newScroll = Math.max(0, touchStartScrollRef.current.scrollLeft + deltaX);
      timelineTrackRef.current.scrollLeft = newScroll;
      const targetTime = getTimeForPixel(newScroll);
      seekToProjectTime(targetTime, false);
    }
  };

  const handleTimelineTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartScrollRef.current = null;
    if (e.touches.length < 2) {
      initialPinchDistRef.current = null;
    }
    if (e.touches.length === 0) {
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
      scrollDebounceTimerRef.current = setTimeout(() => { isUserScrubbingTrackRef.current = false; }, 200);
      setProjectCurrentTime(projectCurrentTimeRef.current);
    }
  };

  // Desktop Mouse Wheel & Trackpad Pinch Zoom
  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 8 : -8;
      setTimelineZoom(prev => Math.min(220, Math.max(20, prev + delta)));
      return;
    }
    isUserScrubbingTrackRef.current = true;
    if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
    scrollDebounceTimerRef.current = setTimeout(() => { isUserScrubbingTrackRef.current = false; }, 250);
  };

  // Seamless time update and instant clip switching (ZERO buffering gap, ZERO black frame)
  const handleActiveTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>, clipIdx: number) => {
    if (!isPlayingRef.current || !isPlaying || clipIdx !== currentClipIndexRef.current) return;
    const vid = e.currentTarget;
    const meta = timelineClipsMeta[clipIdx];
    if (!meta) return;

    const cur = vid.currentTime;
    // Instant seamless switch to next clip when reaching trimEnd (only after clip has actually started playing)
    const timeSinceSwitch = performance.now() - lastClipSwitchTimeRef.current;
    if (timeSinceSwitch > 250 && !vid.seeking && !vid.paused && cur > meta.trimStart + 0.15 && cur >= meta.trimEnd - 0.05) {
      if (isLoopingClipRef.current && loopClipIndexRef.current === clipIdx) {
        try { vid.currentTime = meta.trimStart; } catch (_) {}
        if (vid.paused && isPlayingRef.current) {
          vid.play().catch(() => {});
        }
        projectCurrentTimeRef.current = meta.projectStartTime;
        setProjectCurrentTime(meta.projectStartTime);
        syncAudioTracksToTime(meta.projectStartTime, true, false);
        return;
      }
      advanceToNextClip(clipIdx);
    }
  };

  // Handler to toggle single-clip endless loop for the clip under the slider with live Beginning/End quick trimming
  const handleToggleLoopClip = useCallback((specificClipIdx?: number) => {
    if (activeClips.length === 0) {
      showToast("Add video clips to the timeline first", "info");
      return;
    }

    // Determine target clip: either specified, currently selected, or whichever clip the playhead slider is over
    let targetIdx = specificClipIdx;
    if (targetIdx === undefined || targetIdx === null) {
      if (selectedTimelineClipIndex !== null && selectedTimelineClipIndex >= 0 && selectedTimelineClipIndex < activeClips.length) {
        targetIdx = selectedTimelineClipIndex;
      } else {
        const pTime = projectCurrentTimeRef.current;
        const found = timelineClipsMeta.findIndex(
          m => pTime >= m.projectStartTime && pTime < m.projectEndTime
        );
        targetIdx = found !== -1 ? found : Math.min(activeClips.length - 1, Math.max(0, currentClipIndexRef.current));
      }
    }

    if (targetIdx < 0 || targetIdx >= activeClips.length) return;

    // If currently looping this exact clip and user clicked to toggle it off:
    if (isLoopingClipRef.current && loopClipIndexRef.current === targetIdx) {
      setIsLoopingClip(false);
      isLoopingClipRef.current = false;
      setLoopClipIndex(null);
      loopClipIndexRef.current = null;
      if (activeInlineControl === 'loop') {
        setActiveInlineControl(null);
      }
      showToast("Loop mode stopped", "info");
      return;
    }

    // Activate loop for this specific clip!
    setIsLoopingClip(true);
    isLoopingClipRef.current = true;
    setLoopClipIndex(targetIdx);
    loopClipIndexRef.current = targetIdx;
    setSelectedTimelineClipIndex(targetIdx);
    currentClipIndexRef.current = targetIdx;
    setCurrentClipIndex(targetIdx);
    setPreviousClipIndex(null);
    setLoopTrimTarget('end'); // Default: selected to the end!
    setActiveInlineControl('loop');

    const meta = timelineClipsMeta[targetIdx];
    if (!meta) return;

    // Immediately pause all other video elements in the stage so no other clip frames are active
    videoElementsRef.current.forEach((el, id) => {
      if (id !== meta.clip.id) {
        try {
          if (!el.paused) el.pause();
        } catch (_) {}
      }
    });

    // Seek to clip start (or stay in clip if slider is already within it)
    const pTime = projectCurrentTimeRef.current;
    const isInsideClip = pTime >= meta.projectStartTime && pTime < meta.projectEndTime;

    if (!isInsideClip) {
      seekToProjectTime(meta.projectStartTime, true);
    } else {
      const targetVid = videoElementsRef.current.get(meta.clip.id);
      if (targetVid) {
        targetVid.playbackRate = meta.speed;
        applyVideoElementAudio(meta.clip.id, targetVid, meta.clip);
        if (!isPlayingRef.current) {
          isPlayingRef.current = true;
          setIsPlaying(true);
        }
        targetVid.play().catch(() => {
          targetVid.muted = true;
          targetVid.play().catch(() => {});
        });
      }
    }

    showToast(`Looping clip #${targetIdx + 1}`, "success");
  }, [activeClips.length, selectedTimelineClipIndex, timelineClipsMeta, activeInlineControl, seekToProjectTime, showToast]);

  // Seamless clip selection on the timeline strip:
  // When loop section is active, clicking ANY clip instantly switches loop to it and starts playing with ZERO freeze!
  const handleSelectTimelineClip = useCallback((idx: number) => {
    if (didScrubClipRef.current) return;
    if (idx < 0 || idx >= activeClips.length) return;
    setSelectedAudioClipIndex(null);
    setSelectedCaptionId(null);
    setSelectedTimelineClipIndex(idx);

    const isLoopActive = isLoopingClipRef.current || activeInlineControl === 'loop';
    const meta = timelineClipsMeta[idx];

    if (isLoopActive) {
      setIsLoopingClip(true);
      isLoopingClipRef.current = true;
      setLoopClipIndex(idx);
      loopClipIndexRef.current = idx;
      currentClipIndexRef.current = idx;
      setCurrentClipIndex(idx);
      setPreviousClipIndex(null);
      setActiveInlineControl('loop');
      lastClipSwitchTimeRef.current = performance.now();

      if (meta) {
        // Immediately pause all other video elements in stage
        videoElementsRef.current.forEach((el, id) => {
          if (id !== meta.clip.id) {
            try { if (!el.paused) el.pause(); } catch (_) {}
          }
        });

        // Set playhead position to this clip's beginning
        projectCurrentTimeRef.current = meta.projectStartTime;
        setProjectCurrentTime(meta.projectStartTime);
        setClipCurrentTime(meta.trimStart);

        if (timelineTrackRef.current) {
          try {
            timelineTrackRef.current.scrollLeft = getPixelForTime(meta.projectStartTime);
          } catch (_) {}
        }

        const startPlaybackOnVid = (el: HTMLVideoElement) => {
          try {
            el.playbackRate = meta.speed;
            applyVideoElementAudio(meta.clip.id, el, meta.clip);
            el.currentTime = meta.trimStart;
          } catch (_) {}
          isPlayingRef.current = true;
          setIsPlaying(true);
          const p = el.play();
          if (p !== undefined) {
            p.catch(() => {
              el.muted = true;
              el.play().catch(() => {});
            });
          }
          syncAudioTracksToTime(meta.projectStartTime, true, true);
        };

        const targetVid = videoElementsRef.current.get(meta.clip.id);
        if (targetVid) {
          startPlaybackOnVid(targetVid);
        } else {
          requestAnimationFrame(() => {
            const vidReady = videoElementsRef.current.get(meta.clip.id);
            if (vidReady) startPlaybackOnVid(vidReady);
          });
        }
      }
      return;
    }

    // Normal non-loop selection:
    // Selecting a clip ONLY highlights/selects the clip with its border.
    // It NEVER resets or jumps the playhead to the starting position!
    if (isPlayingRef.current) {
      pauseAllPlayback();
    }
    if (activeInlineControl !== 'trim' && activeInlineControl !== 'speed' && activeInlineControl !== 'scale') {
      setActiveInlineControl(null);
    }
  }, [activeClips.length, activeInlineControl, timelineClipsMeta, pauseAllPlayback, applyVideoElementAudio, syncAudioTracksToTime]);

  const togglePlayPause = () => {
    if (activeClips.length === 0) {
      showToast("Add video clips to the timeline first", "info");
      return;
    }
    const isLoopActive = isLoopingClipRef.current || activeInlineControl === 'loop';
    let curIdx = isLoopActive && loopClipIndexRef.current !== null ? loopClipIndexRef.current : currentClipIndexRef.current;
    if (totalDuration > 0 && projectCurrentTimeRef.current >= totalDuration - 0.05 && !isLoopActive) {
      projectCurrentTimeRef.current = 0;
      setProjectCurrentTime(0);
      curIdx = 0;
      currentClipIndexRef.current = 0;
      setCurrentClipIndex(0);
    }
    const curMeta = timelineClipsMeta[curIdx] || timelineClipsMeta[currentClipIndex];
    if (!curMeta) return;
    const curVid = videoElementsRef.current.get(curMeta.clip.id);

    if (isPlayingRef.current || isPlaying) {
      pauseAllPlayback();
    } else {
      if (!isLoopActive) {
        setSelectedTimelineClipIndex(null);
      }
      isPlayingRef.current = true;
      setIsPlaying(true);

      if (curVid && curMeta) {
        if (isLoopActive) {
          if (curVid.currentTime >= curMeta.trimEnd - 0.05 || curVid.ended || curVid.currentTime < curMeta.trimStart) {
            try { curVid.currentTime = curMeta.trimStart; } catch (_) {}
            projectCurrentTimeRef.current = curMeta.projectStartTime;
            setProjectCurrentTime(curMeta.projectStartTime);
          }
        } else {
          const expectedVidTime = curMeta.trimStart + Math.max(0, projectCurrentTimeRef.current - curMeta.projectStartTime) * curMeta.speed;
          if (Math.abs(curVid.currentTime - expectedVidTime) > 0.15 || curVid.currentTime >= curMeta.trimEnd - 0.05) {
            try {
              curVid.currentTime = Math.min(curMeta.trimEnd - 0.05, Math.max(curMeta.trimStart, expectedVidTime));
            } catch (_) {}
          }
        }
        curVid.playbackRate = curMeta.speed;
        applyVideoElementAudio(curMeta.clip.id, curVid, curMeta.clip);
      }

      // Synchronously unlock & start audio within user click gesture with explicit seek flag true
      const curProjTime = projectCurrentTimeRef.current;
      syncAudioTracksToTime(curProjTime, true, true);

      if (curVid) {
        const playPromise = curVid.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            if (!isPlayingRef.current) {
              try { curVid.pause(); } catch (_) {}
              return;
            }
            const cur = curVid.currentTime;
            const projTime = curMeta.projectStartTime + Math.max(0, cur - curMeta.trimStart) / curMeta.speed;
            projectCurrentTimeRef.current = projTime;
          }).catch((err) => {
            console.warn("curVid.play autoplay fallback:", err);
            // Universal browser/iframe autoplay fallback: mute and play
            curVid.muted = true;
            curVid.play().then(() => {
              if (!isPlayingRef.current) {
                try { curVid.pause(); } catch (_) {}
              }
            }).catch(() => {});
          });
        }
      }
    }
  };

  const handleVideoEnded = (clipIdx: number) => {
    if (!isPlayingRef.current || !isPlaying) return;
    if (clipIdx !== currentClipIndexRef.current) return;
    const meta = timelineClipsMeta[clipIdx];
    const vid = videoElementsRef.current.get(meta?.clip.id);
    const cur = vid?.currentTime || 0;
    const timeSinceSwitch = performance.now() - lastClipSwitchTimeRef.current;
    if (timeSinceSwitch > 250 && meta && cur > meta.trimStart + 0.15) {
      if (isLoopingClipRef.current && loopClipIndexRef.current === clipIdx) {
        try { vid.currentTime = meta.trimStart; } catch (_) {}
        if (vid.paused && isPlayingRef.current) {
          vid.play().catch(() => {});
        }
        projectCurrentTimeRef.current = meta.projectStartTime;
        setProjectCurrentTime(meta.projectStartTime);
        syncAudioTracksToTime(meta.projectStartTime, true, false);
        return;
      }
      advanceToNextClip(clipIdx);
    }
  };

  // Move clip from any index to target index (for drag-to-reorder, long-press, and arrow buttons)
  const handleMoveClip = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= activeClips.length ||
      toIndex >= activeClips.length
    ) {
      return;
    }

    const newClips = [...activeClips];
    const [moved] = newClips.splice(fromIndex, 1);
    newClips.splice(toIndex, 0, moved);

    updateProjectClips(newClips, true);
    setCurrentClipIndex(toIndex);
    setSelectedTimelineClipIndex(toIndex);
  };

  // Desktop Drag-and-Drop Reorder Handlers
  const handleDragStartClip = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    if (trimmingHandle) {
      e.preventDefault();
      return;
    }
    setDraggedClipIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
  };

  const handleDragOverClip = (e: React.DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTargetIndex !== idx) {
      setDragOverTargetIndex(idx);
    }
  };

  const handleDropClip = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    if (draggedClipIndex !== null && draggedClipIndex !== targetIdx) {
      handleMoveClip(draggedClipIndex, targetIdx);
      showToast(`Moved clip to position #${targetIdx + 1}`, "success");
    }
    setDraggedClipIndex(null);
    setDragOverTargetIndex(null);
  };

  const handleDragEndClip = () => {
    setDraggedClipIndex(null);
    setDragOverTargetIndex(null);
  };

  // Mobile Long-Press & Touch Drag Reorder Handlers + Live Touch Scrubbing
  const handleClipTouchStart = (idx: number, e: React.TouchEvent) => {
    if (!isLoopingClipRef.current && activeInlineControl !== 'loop') {
      pauseAllPlayback();
      isUserScrubbingTrackRef.current = true;
    }
    if (trimmingHandle) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-trim-handle="true"]')) {
      return;
    }
    const t = e.touches[0];
    touchStartPosRef.current = { x: t.clientX, y: t.clientY };
    didScrubClipRef.current = false;

    if (timelineTrackRef.current) {
      clipTouchStartRef.current = {
        clientX: t.clientX,
        scrollLeft: timelineTrackRef.current.scrollLeft,
        startX: t.clientX,
        startY: t.clientY
      };
    }

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      setDraggedClipIndex(idx);
      setDragOverTargetIndex(idx);
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      showToast("Drag left/right to reposition clip", "info");
    }, 280);
  };

  const handleClipTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;

    // In long-press reorder mode:
    if (isLongPressing && draggedClipIndex !== null) {
      if (e.cancelable) e.preventDefault();
      const elem = document.elementFromPoint(t.clientX, t.clientY);
      const clipElem = elem?.closest('[data-timeline-clip-idx]');
      if (clipElem) {
        const targetIdx = parseInt(clipElem.getAttribute('data-timeline-clip-idx') || '-1', 10);
        if (targetIdx >= 0 && targetIdx < activeClips.length && targetIdx !== dragOverTargetIndex) {
          setDragOverTargetIndex(targetIdx);
        }
      }
      return;
    }

    // Normal finger move: Continuous Live Scrubbing!
    if (clipTouchStartRef.current && timelineTrackRef.current) {
      const deltaX = clipTouchStartRef.current.clientX - t.clientX;
      const totalDist = Math.hypot(t.clientX - clipTouchStartRef.current.startX, t.clientY - clipTouchStartRef.current.startY);

      if (totalDist > 4) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        didScrubClipRef.current = true;
        isUserScrubbingTrackRef.current = true;

        const newScroll = Math.max(0, clipTouchStartRef.current.scrollLeft + deltaX);
        timelineTrackRef.current.scrollLeft = newScroll;

        const targetTime = getTimeForPixel(newScroll);
        seekToProjectTime(targetTime, false);
      }
    }
  };

  const handleClipTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (
      isLongPressing &&
      draggedClipIndex !== null &&
      dragOverTargetIndex !== null &&
      draggedClipIndex !== dragOverTargetIndex
    ) {
      handleMoveClip(draggedClipIndex, dragOverTargetIndex);
      showToast(`Moved clip to position #${dragOverTargetIndex + 1}`, "success");
    }
    setIsLongPressing(false);
    setDraggedClipIndex(null);
    setDragOverTargetIndex(null);
    clipTouchStartRef.current = null;

    if (didScrubClipRef.current) {
      setTimeout(() => {
        didScrubClipRef.current = false;
        isUserScrubbingTrackRef.current = false;
      }, 350);
    }
  };

  // Delete selected item from timeline (context-aware: caption if caption selected, audio if audio selected, or video clip)
  const handleDeleteSelectedClip = () => {
    if (isPlaying) setIsPlaying(false);
    if (selectedCaptionId !== null) {
      const capToDelete = activeCaptions.find(c => c.id === selectedCaptionId);
      handleDeleteCaption(selectedCaptionId);
      setSelectedCaptionId(null);
      showToast(capToDelete ? `Deleted caption "${capToDelete.text.slice(0, 15)}..."` : "Caption deleted", "info");
      return;
    }
    if (selectedAudioClipIndex !== null && activeAudioClips[selectedAudioClipIndex]) {
      handleDeleteAudioClip(selectedAudioClipIndex);
      return;
    }
    if (selectedTimelineClipIndex === null || !activeClips[selectedTimelineClipIndex]) return;
    const clipIdx = selectedTimelineClipIndex;
    const updated = activeClips.filter((_, idx) => idx !== clipIdx);
    updateProjectClips(updated, true);
    const newIdx = Math.min(clipIdx, Math.max(0, updated.length - 1));
    setSelectedTimelineClipIndex(updated.length > 0 ? newIdx : null);
    setCurrentClipIndex(updated.length > 0 ? newIdx : 0);
    showToast(`Deleted clip #${clipIdx + 1}`, "info");
  };

  // Duplicate selected item (context-aware: caption if caption selected, audio if audio selected, or video clip)
  const handleDuplicateClip = (clipIdx: number | null) => {
    if (isPlaying) setIsPlaying(false);
    if (selectedCaptionId !== null) {
      const cap = activeCaptions.find(c => c.id === selectedCaptionId);
      if (cap) {
        handleAddCaption(cap.text, {
          font_size: cap.font_size,
          font_family: cap.font_family,
          color: '#ffffff',
          stroke_color: '#000000',
          is_bold: cap.is_bold ?? false,
          box_width_pct: cap.box_width_pct,
          clip_rule: cap.clip_rule,
          clip_count: cap.clip_count,
          x_pct: cap.x_pct,
          y_pct: Math.min(85, (cap.y_pct || 35) + 6)
        });
        showToast("Duplicated caption", "success");
        return;
      }
    }
    if (selectedAudioClipIndex !== null && activeAudioClips[selectedAudioClipIndex]) {
      handleDuplicateAudioClip(selectedAudioClipIndex);
      return;
    }
    if (clipIdx === null) return;
    const clip = activeClips[clipIdx];
    if (!clip) return;
    const duplicated: VideoEditorClip = {
      ...clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    const updated = [...activeClips];
    updated.splice(clipIdx + 1, 0, duplicated);
    updateProjectClips(updated, true);
    setSelectedTimelineClipIndex(clipIdx + 1);
    setCurrentClipIndex(clipIdx + 1);
    showToast(`Duplicated clip #${clipIdx + 1}`, "success");
  };

  // Update clip playback speed live and dynamically
  const handleUpdateClipSpeed = (clipIdx: number, newSpeed: number) => {
    if (!activeProject || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const cleanSpeed = Math.min(3.0, Math.max(0.2, Math.round(newSpeed * 100) / 100));
    const targetClip = activeClips[clipIdx];
    if (targetClip.speed === cleanSpeed) return;
    pushHistorySnapshot();
    const updated = [...activeClips];
    updated[clipIdx] = {
      ...targetClip,
      speed: cleanSpeed
    };
    updateProjectClips(updated, false, true);

    // Apply live to playing video element immediately
    const vid = videoElementsRef.current.get(targetClip.id);
    if (vid) {
      vid.playbackRate = cleanSpeed;
    }
  };

  // Update clip visual zoom/scale factor live
  const handleUpdateClipScale = (clipIdx: number, newScale: number) => {
    if (!activeProject || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const cleanScale = Math.min(2.5, Math.max(0.5, Math.round(newScale * 100) / 100));
    const targetClip = activeClips[clipIdx];
    if (targetClip.scale === cleanScale) return;
    pushHistorySnapshot();
    const updated = [...activeClips];
    updated[clipIdx] = {
      ...targetClip,
      scale: cleanScale
    };
    updateProjectClips(updated, false, true);
  };

  // CHOP: Smart video scene cut detection using backend FFmpeg
  const [isChopping, setIsChopping] = useState(false);

  // Helper to resolve currently selected or active clip
  const getTargetClipForChop = useCallback(() => {
    let targetIdx = selectedTimelineClipIndex;
    if (targetIdx === null || targetIdx < 0 || targetIdx >= activeClips.length) {
      const clipAtPlayhead = timelineClipsMeta.findIndex(
        m => projectCurrentTime >= m.projectStartTime && projectCurrentTime <= m.projectEndTime
      );
      if (clipAtPlayhead !== -1) {
        targetIdx = clipAtPlayhead;
      } else {
        targetIdx = currentClipIndex;
      }
    }
    if (targetIdx !== null && targetIdx >= 0 && targetIdx < activeClips.length) {
      return { clip: activeClips[targetIdx], index: targetIdx };
    }
    return null;
  }, [selectedTimelineClipIndex, activeClips, timelineClipsMeta, projectCurrentTime, currentClipIndex]);

  // Execute Chop with custom options (Scene Cuts, Equal Parts, or Interval)
  const handleExecuteChopWithOptions = async (options: {
    mode: 'scene_cuts' | 'interval' | 'equal_parts';
    sensitivity?: number;
    min_shot_duration?: number;
    interval_seconds?: number;
    num_parts?: number;
  }): Promise<boolean> => {
    const target = getTargetClipForChop();
    if (!target || isChopping) {
      showToast('Please select a video clip to chop', 'info');
      return false;
    }
    const { clip, index: targetIdx } = target;

    const clipDuration = clip.duration && clip.duration > 0 ? clip.duration : 5.0;
    const trimStart = clip.trim_start || 0;
    const trimEnd = clip.trim_end && clip.trim_end > trimStart ? clip.trim_end : clipDuration;

    setIsChopping(true);
    showToast(
      options.mode === 'scene_cuts'
        ? '✂️ Analyzing exact scene cuts with FFmpeg...'
        : options.mode === 'equal_parts'
        ? `✂️ Dividing clip into ${options.num_parts || 2} equal parts...`
        : `✂️ Slicing clip every ${options.interval_seconds || 4}s...`,
      'info'
    );

    try {
      const resp = await fetch('/api/video/chop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vid: clip.vid,
          file_id: clip.file_id,
          url: clip.url,
          trim_start: trimStart,
          trim_end: trimEnd,
          mode: options.mode,
          sensitivity: options.sensitivity ?? 0.44,
          min_shot_duration: options.min_shot_duration ?? 1.0,
          interval_seconds: options.interval_seconds,
          num_parts: options.num_parts,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok || !Array.isArray(data.segments) || data.segments.length === 0) {
        throw new Error(data.error || 'Scene detection returned no cut points');
      }

      if (data.segments.length <= 1) {
        showToast('ℹ️ No scene cuts detected in this clip (single continuous shot).', 'info');
        setIsChopping(false);
        return false;
      }

      const fullOrigDur = clip.orig_duration || clip.duration || data.total_duration;
      const choppedClips: VideoEditorClip[] = data.segments.map((seg: any, idx: number) => {
        const segStart = typeof seg.trim_start === 'number' ? seg.trim_start : 0;
        const segEnd = typeof seg.trim_end === 'number' ? seg.trim_end : (seg.duration || clip.duration);
        const segDur = Math.max(0.1, typeof seg.duration === 'number' && seg.duration > 0 ? seg.duration : Number((segEnd - segStart).toFixed(2)));
        const isPhysicallySliced = Boolean(seg.file_id && String(seg.file_id).startsWith('chop_'));
        return {
          ...clip,
          id: `clip_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          vid: seg.vid || clip.vid,
          file_id: seg.file_id || clip.file_id,
          url: seg.url || clip.url,
          duration: segDur,
          orig_duration: isPhysicallySliced ? segDur : fullOrigDur,
          trim_start: isPhysicallySliced ? 0 : segStart,
          trim_end: isPhysicallySliced ? segDur : segEnd,
          is_cut: true,
          variants: undefined,
          variant_groups: undefined,
          active_variant_index: 0
        };
      });

      const updated = [...activeClips];
      updated.splice(targetIdx, 1, ...choppedClips);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(targetIdx);
      setCurrentClipIndex(targetIdx);
      showToast(
        options.mode === 'scene_cuts'
          ? `✂️ Cut cleanly at ${data.cut_points.length} exact scene transitions (${choppedClips.length} clips)!`
          : `✂️ Divided into ${choppedClips.length} precise clips!`,
        'success'
      );
      return true;
    } catch (err: any) {
      showToast(`Chop error: ${err.message}`, 'error');
      return false;
    } finally {
      setIsChopping(false);
    }
  };

  // Direct 1-click Chop button handler (runs smart adaptive scene cut detection with balanced threshold 0.25)
  const handleChopSelectedClip = async () => {
    const target = getTargetClipForChop();
    if (!target) {
      showToast('Please select a video clip to chop', 'info');
      return;
    }
    await handleExecuteChopWithOptions({
      mode: 'scene_cuts',
      sensitivity: 0.25,
      min_shot_duration: 0.8,
    });
  };

  const [isAnalyzingBoundary, setIsAnalyzingBoundary] = useState(false);

  // Boundary Frame Analysis & Auto-Chop (Instant corner check & cutting of flash/transition/corner frames)
  const handleAutoChopBoundary = useCallback(async (clipIdx: number, targetCorner?: 'beginning' | 'end' | 'both') => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    if (!clip) return;
    const meta = timelineClipsMeta[clipIdx];
    if (!meta) return;

    setIsAnalyzingBoundary(true);
    showToast('🔍 Analyzing boundary frames & corner cuts...', 'info');

    const curTrimStart = meta.trimStart;
    const curTrimEnd = meta.trimEnd;
    const targetMode = targetCorner === 'beginning' ? 'start' : targetCorner === 'end' ? 'end' : 'both';

    const prevClip = clipIdx > 0 ? activeClips[clipIdx - 1] : null;
    const nextClip = clipIdx < activeClips.length - 1 ? activeClips[clipIdx + 1] : null;

    try {
      const resp = await fetch('/api/video/analyze-boundary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vid: clip.vid,
          file_id: clip.file_id,
          url: clip.url,
          trim_start: curTrimStart,
          trim_end: curTrimEnd,
          target: targetMode,
          margin: 0.18,
          prev_clip: prevClip ? {
            vid: prevClip.vid,
            file_id: prevClip.file_id,
            url: prevClip.url,
            trim_start: prevClip.trim_start || 0,
            trim_end: prevClip.trim_end || prevClip.duration || 5.0,
            duration: prevClip.duration || 5.0,
          } : undefined,
          next_clip: nextClip ? {
            vid: nextClip.vid,
            file_id: nextClip.file_id,
            url: nextClip.url,
            trim_start: nextClip.trim_start || 0,
            trim_end: nextClip.trim_end || nextClip.duration || 5.0,
            duration: nextClip.duration || 5.0,
          } : undefined,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.ok) {
          if (data.trimmed && (data.new_trim_start !== undefined || data.new_trim_end !== undefined || data.prev_clip_adjustment || data.next_clip_adjustment)) {
            const newStart = Number((data.new_trim_start ?? curTrimStart).toFixed(3));
            const newEnd = Number((data.new_trim_end ?? curTrimEnd).toFixed(3));

            const updatedClips = [...activeClips];
            updatedClips[clipIdx] = {
              ...clip,
              trim_start: newStart,
              trim_end: newEnd,
            };

            // Bidirectional cross-boundary mapping: Apply calibrated trim boundaries to adjacent clips if bleed was detected
            if (data.prev_clip_adjustment && clipIdx > 0 && prevClip) {
              updatedClips[clipIdx - 1] = {
                ...prevClip,
                trim_end: Number(data.prev_clip_adjustment.trim_end.toFixed(3)),
              };
            }

            if (data.next_clip_adjustment && clipIdx < activeClips.length - 1 && nextClip) {
              updatedClips[clipIdx + 1] = {
                ...nextClip,
                trim_start: Number(data.next_clip_adjustment.trim_start.toFixed(3)),
              };
            }

            updateProjectClips(updatedClips, true);

            // Instantly sync looping playback to clean start
            const vid = videoElementsRef.current.get(clip.id);
            if (vid) {
              try { vid.currentTime = newStart; } catch (_) {}
              if (isPlayingRef.current) {
                vid.play().catch(() => {});
              }
            }

            const cutDesc = data.reasons?.length > 0
              ? data.reasons.join(' • ')
              : `Boundary mapped cleanly across cut points`;
            showToast(`✂️ Boundary mapped: ${cutDesc}`, 'success');
            return;
          } else {
            showToast('✨ Boundaries validated: Clean cut with zero missing or bleed frames', 'success');
            return;
          }
        }
      }
      throw new Error('Server analysis unavailable');
    } catch (err: any) {
      // Robust client-side fallback: Clean corner frames by trimming 1 frame from selected corner
      const updatedClips = [...activeClips];
      let newStart = curTrimStart;
      let newEnd = curTrimEnd;
      if (targetMode === 'start' || targetMode === 'both') {
        newStart = Math.min(curTrimEnd - 0.25, Number((curTrimStart + 0.05).toFixed(3)));
      }
      if (targetMode === 'end' || targetMode === 'both') {
        newEnd = Math.max(newStart + 0.25, Number((curTrimEnd - 0.05).toFixed(3)));
      }

      updatedClips[clipIdx] = {
        ...clip,
        trim_start: newStart,
        trim_end: newEnd,
      };
      updateProjectClips(updatedClips, true);

      const vid = videoElementsRef.current.get(clip.id);
      if (vid) {
        try { vid.currentTime = newStart; } catch (_) {}
        if (isPlayingRef.current) vid.play().catch(() => {});
      }
      showToast(`✂️ Boundary mapped: Shaved corner frames cleanly`, 'success');
    } finally {
      setIsAnalyzingBoundary(false);
    }
  }, [activeClips, timelineClipsMeta, updateProjectClips, showToast]);

  const handleOpenChopStudioModal = useCallback(() => {
    const target = getTargetClipForChop();
    if (!target) {
      showToast('Please select a video clip to chop', 'info');
      return;
    }
    setShowChopStudioModal(true);
  }, [getTargetClipForChop, showToast]);


  // Split selected clip at the exact center playhead position (CapCut style)
  const handleSplitSelectedClip = () => {
    let targetIdx = selectedTimelineClipIndex;
    const clipAtPlayhead = timelineClipsMeta.findIndex(
      m => projectCurrentTime >= m.projectStartTime && projectCurrentTime <= m.projectEndTime
    );
    if (clipAtPlayhead !== -1) {
      targetIdx = clipAtPlayhead;
    } else if (targetIdx === null || targetIdx < 0 || targetIdx >= activeClips.length) {
      targetIdx = currentClipIndex;
    }

    const clip = activeClips[targetIdx];
    if (!clip) {
      showToast("No clip found at playhead to split", "info");
      return;
    }
    const meta = timelineClipsMeta[targetIdx];
    if (!meta) return;

    // Calculate split point inside clip based on exact project playhead time
    const offsetInClip = Math.max(0, projectCurrentTime - meta.projectStartTime);
    const localSplitTime = meta.trimStart + (offsetInClip * meta.speed);
    const splitPoint = Math.max(meta.trimStart + 0.1, Math.min(meta.trimEnd - 0.1, localSplitTime));

    if (splitPoint <= meta.trimStart + 0.08 || splitPoint >= meta.trimEnd - 0.08) {
      showToast("Place playhead inside clip to cut", "warning");
      return;
    }

    const dur1 = Number(Math.max(0.1, splitPoint - meta.trimStart).toFixed(2));
    const dur2 = Number(Math.max(0.1, meta.trimEnd - splitPoint).toFixed(2));
    const fullSourceDur = clip.orig_duration || meta.originalDur || clip.duration || meta.trimEnd;

    const firstHalf: VideoEditorClip = {
      ...clip,
      id: `clip_${Date.now()}_a`,
      duration: dur1,
      orig_duration: fullSourceDur,
      trim_start: meta.trimStart,
      trim_end: Number(splitPoint.toFixed(2)),
      is_cut: true,
      variants: undefined,
      variant_groups: undefined,
      active_variant_index: 0
    };
    const secondHalf: VideoEditorClip = {
      ...clip,
      id: `clip_${Date.now()}_b`,
      duration: dur2,
      orig_duration: fullSourceDur,
      trim_start: Number(splitPoint.toFixed(2)),
      trim_end: meta.trimEnd,
      is_cut: true,
      variants: undefined,
      variant_groups: undefined,
      active_variant_index: 0
    };

    const updated = [...activeClips];
    updated.splice(targetIdx, 1, firstHalf, secondHalf);
    updateProjectClips(updated, true);
    setSelectedTimelineClipIndex(targetIdx + 1);
    setCurrentClipIndex(targetIdx + 1);
    showToast(`Cut clip at ${formatTimecode(projectCurrentTime)}`, "success");
  };

  // COMBINE CLIPS: Combine selected clip with previous clip or next clip
  const [isCombiningClips, setIsCombiningClips] = useState(false);

  const handleCombineClips = async (direction: 'prev' | 'next') => {
    if (selectedTimelineClipIndex === null || !activeClips[selectedTimelineClipIndex]) {
      showToast("Please select a video clip to combine", "info");
      return;
    }

    const currIdx = selectedTimelineClipIndex;
    const targetIdx = direction === 'prev' ? currIdx - 1 : currIdx + 1;

    if (targetIdx < 0) {
      showToast("No previous clip to combine with", "info");
      return;
    }
    if (targetIdx >= activeClips.length) {
      showToast("No next clip to combine with", "info");
      return;
    }

    const firstIdx = Math.min(currIdx, targetIdx);
    const secondIdx = Math.max(currIdx, targetIdx);
    const clip1 = activeClips[firstIdx];
    const clip2 = activeClips[secondIdx];
    if (!clip1 || !clip2) return;

    if (isPlaying) setIsPlaying(false);

    // Check if both clips are from the exact same source video
    const isSameSource = Boolean(
      (clip1.vid && clip2.vid && clip1.vid === clip2.vid) ||
      (clip1.file_id && clip2.file_id && clip1.file_id === clip2.file_id) ||
      (clip1.url && clip2.url && clip1.url === clip2.url)
    );

    const t1Start = typeof clip1.trim_start === 'number' ? clip1.trim_start : 0;
    const t1End = typeof clip1.trim_end === 'number' && clip1.trim_end > t1Start ? clip1.trim_end : (clip1.duration || 5);
    const t2Start = typeof clip2.trim_start === 'number' ? clip2.trim_start : 0;
    const t2End = typeof clip2.trim_end === 'number' && clip2.trim_end > t2Start ? clip2.trim_end : (clip2.duration || 5);

    // Contiguous or overlapping segment check for same video source (e.g. recombining split/chopped parts)
    const isContiguousOrOverlapping = isSameSource && (
      Math.abs(t1End - t2Start) <= 0.35 ||
      (t1End >= t2Start && t2End >= t1Start)
    );

    if (isContiguousOrOverlapping) {
      const combinedClip: VideoEditorClip = {
        ...clip1,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        trim_start: Math.min(t1Start, t2Start),
        trim_end: Math.max(t1End, t2End),
        duration: Math.max(clip1.duration || 0, clip2.duration || 0, Math.max(t1End, t2End)),
        speed: clip1.speed || 1,
        scale: clip1.scale || 1,
        volume: clip1.volume !== undefined ? clip1.volume : 1,
        is_muted: clip1.is_muted,
      };

      const updated = [...activeClips];
      updated.splice(firstIdx, 2, combinedClip);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(firstIdx);
      setCurrentClipIndex(firstIdx);
      if (isLoopingClipRef.current || activeInlineControl === 'loop') {
        setIsLoopingClip(true);
        isLoopingClipRef.current = true;
        setLoopClipIndex(firstIdx);
        loopClipIndexRef.current = firstIdx;
      }
      showToast(`Combined clips #${firstIdx + 1} and #${secondIdx + 1} into 1 clip`, "success");
      return;
    }

    // Different source videos or non-contiguous segments: render combined video using FFmpeg
    setIsCombiningClips(true);
    showToast(`Combining clips #${firstIdx + 1} & #${secondIdx + 1} with FFmpeg...`, "info");

    try {
      const resp = await fetch('/api/video/combine_two', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip1: {
            vid: clip1.vid,
            file_id: clip1.file_id,
            url: clip1.url,
            bucket_id: clip1.bucket_id,
            bucket_name: clip1.bucket_name,
            trim_start: t1Start,
            trim_end: t1End,
            speed: clip1.speed || 1,
            duration: clip1.duration,
          },
          clip2: {
            vid: clip2.vid,
            file_id: clip2.file_id,
            url: clip2.url,
            bucket_id: clip2.bucket_id,
            bucket_name: clip2.bucket_name,
            trim_start: t2Start,
            trim_end: t2End,
            speed: clip2.speed || 1,
            duration: clip2.duration,
          },
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.ok || !data.clip) {
        throw new Error(data.error || 'Failed to combine video clips');
      }

      const combinedClip: VideoEditorClip = {
        ...data.clip,
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        scale: clip1.scale || 1,
      };

      const updated = [...activeClips];
      updated.splice(firstIdx, 2, combinedClip);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(firstIdx);
      setCurrentClipIndex(firstIdx);
      if (isLoopingClipRef.current || activeInlineControl === 'loop') {
        setIsLoopingClip(true);
        isLoopingClipRef.current = true;
        setLoopClipIndex(firstIdx);
        loopClipIndexRef.current = firstIdx;
      }
      showToast(`Combined clips #${firstIdx + 1} and #${secondIdx + 1} successfully!`, "success");
    } catch (err: any) {
      console.error('[Combine Clips Error]:', err);
      showToast(`Combine error: ${err.message || 'Could not merge clips'}`, "error");
    } finally {
      setIsCombiningClips(false);
    }
  };

  // Interactive Micro-Trimming with Global Window Listeners (Smooth, Micro-precision)
  const handleTrimPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clipIdx: number,
    handleType: 'start' | 'end'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    pauseAllPlayback();
    isUserScrubbingTrackRef.current = true;
    const proj = activeProjectRef.current;
    const clip = proj?.clips[clipIdx];
    if (!clip || !proj) return;

    // Record snapshot of project before trim begins so undo accurately reverts trimming
    pushHistorySnapshot();

    const dur = clip.duration && clip.duration > 0 ? clip.duration : 4.0;
    const trimStart = clip.trim_start || 0;
    const trimEnd = clip.trim_end !== undefined ? clip.trim_end : dur;
    const pxPerSec = timelineZoom;

    setTrimmingHandle(handleType);
    setSelectedTimelineClipIndex(clipIdx);

    const startX = e.clientX;
    const initialTrimStart = trimStart;
    const initialTrimEnd = trimEnd;
    const clipId = clip.id;

    const targetElement = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      targetElement.setPointerCapture(pointerId);
    } catch (_) {}

    let latestClips = [...proj.clips];

    const onWindowPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const deltaX = ev.clientX - startX;
      const deltaSec = deltaX / pxPerSec;

      const currentProj = activeProjectRef.current;
      if (!currentProj) return;
      const targetClips = [...currentProj.clips];
      const targetClip = targetClips[clipIdx];
      if (!targetClip) return;

      const fullDur = targetClip.orig_duration || targetClip.duration || dur;
      if (handleType === 'start') {
        // Micro-precision down to 0.02s
        const curEnd = targetClip.trim_end !== undefined ? targetClip.trim_end : fullDur;
        const newStart = Math.max(0, Math.min(curEnd - 0.1, initialTrimStart + deltaSec));
        const rounded = Math.round(newStart * 50) / 50;
        targetClips[clipIdx] = { 
          ...targetClip, 
          trim_start: rounded,
          orig_duration: fullDur,
          duration: Math.max(0.1, Number((curEnd - rounded).toFixed(2))),
          is_cut: true
        };

        // Instant video preview seek to micro trim start
        const vid = videoElementsRef.current.get(clipId);
        if (vid) {
          vid.currentTime = rounded;
          setClipCurrentTime(rounded);
        }
      } else {
        const curStart = targetClip.trim_start || 0;
        const newEnd = Math.min(fullDur, Math.max(curStart + 0.1, initialTrimEnd + deltaSec));
        const rounded = Math.round(newEnd * 50) / 50;
        targetClips[clipIdx] = { 
          ...targetClip, 
          trim_end: rounded,
          orig_duration: fullDur,
          duration: Math.max(0.1, Number((rounded - curStart).toFixed(2))),
          is_cut: true
        };

        // Instant video preview seek to micro trim end
        const vid = videoElementsRef.current.get(clipId);
        if (vid) {
          vid.currentTime = Math.max(0, rounded - 0.05);
          setClipCurrentTime(Math.max(0, rounded - 0.05));
        }
      }

      latestClips = targetClips;
      // Local state update only while dragging (zero network requests, silky 60fps)
      updateProjectClips(targetClips, false, false);
    };

    const onWindowPointerUp = () => {
      try {
        targetElement.releasePointerCapture(pointerId);
      } catch (_) {}
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      setTrimmingHandle(null);
      isUserScrubbingTrackRef.current = false;

      // Final commit: persist cleanly to database (snapshot was already recorded on pointerdown)
      if (latestClips) {
        updateProjectClips(latestClips, false, true);
        const finalClip = latestClips[clipIdx];
        if (finalClip) {
          const finalDuration = Math.max(0.1, (finalClip.trim_end !== undefined ? finalClip.trim_end : dur) - (finalClip.trim_start || 0));
          showToast(`Trimmed clip to ${finalDuration.toFixed(2)}s`, 'info');
        }
      }
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
  };

  // Fine-tune trimming via +/- buttons
  const handleAdjustTrim = (clipIdx: number, type: 'start' | 'end', delta: number) => {
    const clip = activeClips[clipIdx];
    if (!clip) return;

    const dur = clip.orig_duration || (clip.duration && clip.duration > 0 ? clip.duration : 4.0);
    const curStart = clip.trim_start || 0;
    const curEnd = clip.trim_end !== undefined ? clip.trim_end : dur;

    let newStart = curStart;
    let newEnd = curEnd;

    if (type === 'start') {
      newStart = Math.max(0, Math.min(curEnd - 0.1, curStart + delta));
    } else {
      newEnd = Math.min(dur, Math.max(curStart + 0.1, curEnd + delta));
    }

    const roundedStart = Math.round(newStart * 50) / 50;
    const roundedEnd = Math.round(newEnd * 50) / 50;
    const updated = [...activeClips];
    updated[clipIdx] = {
      ...clip,
      trim_start: roundedStart,
      trim_end: roundedEnd,
      orig_duration: dur,
      duration: Math.max(0.1, Number((roundedEnd - roundedStart).toFixed(2))),
      is_cut: true
    };
    updateProjectClips(updated, true, true);

    const vid = videoElementsRef.current.get(clip.id);
    if (vid) {
      if (isLoopingClipRef.current && loopClipIndexRef.current === clipIdx) {
        if (vid.currentTime >= newEnd || vid.currentTime < newStart) {
          vid.currentTime = newStart;
          setClipCurrentTime(newStart);
        }
      } else {
        vid.currentTime = type === 'start' ? newStart : Math.max(newStart, newEnd - 0.05);
        setClipCurrentTime(vid.currentTime);
      }
    }
  };

  // Snap trim boundary directly to current playhead
  const handleSetTrimToPlayhead = (clipIdx: number, type: 'start' | 'end') => {
    const clip = activeClips[clipIdx];
    if (!clip) return;
    const meta = timelineClipsMeta[clipIdx];
    if (!meta) return;

    const dur = clip.duration && clip.duration > 0 ? clip.duration : 4.0;
    const curStart = clip.trim_start || 0;
    const curEnd = clip.trim_end !== undefined ? clip.trim_end : dur;

    const currentProjTime = projectCurrentTimeRef.current;
    let localTime: number;
    if (currentProjTime >= meta.projectStartTime && currentProjTime <= meta.projectEndTime) {
      const relTime = currentProjTime - meta.projectStartTime;
      localTime = Math.max(0, Math.min(dur, curStart + (relTime * meta.speed)));
    } else {
      localTime = Math.max(0, Math.min(dur, clipCurrentTime));
    }

    localTime = Math.round(localTime * 50) / 50;

    let newStart = curStart;
    let newEnd = curEnd;

    if (type === 'start') {
      if (localTime >= curEnd - 0.1) {
        showToast("Trim start must be before trim end", "warning");
        return;
      }
      newStart = localTime;
    } else {
      if (localTime <= curStart + 0.1) {
        showToast("Trim end must be after trim start", "warning");
        return;
      }
      newEnd = localTime;
    }

    const updated = [...activeClips];
    const fullDur = clip.orig_duration || clip.duration || dur;
    updated[clipIdx] = {
      ...clip,
      trim_start: newStart,
      trim_end: newEnd,
      orig_duration: fullDur,
      duration: Math.max(0.1, Number((newEnd - newStart).toFixed(2))),
      is_cut: true
    };
    updateProjectClips(updated, true, true);

    const vid = videoElementsRef.current.get(clip.id);
    if (vid) {
      vid.currentTime = type === 'start' ? newStart : Math.max(0, newEnd - 0.05);
      setClipCurrentTime(vid.currentTime);
    }
    showToast(`Set trim ${type} to ${localTime.toFixed(2)}s`, "success");
  };

  // Reset clip trim to full duration
  const handleResetClipTrim = (clipIdx: number) => {
    const clip = activeClips[clipIdx];
    if (!clip) return;
    const dur = clip.orig_duration || (clip.duration && clip.duration > 0 ? clip.duration : 4.0);
    const updated = [...activeClips];
    updated[clipIdx] = {
      ...clip,
      trim_start: 0,
      trim_end: dur,
      duration: dur,
      is_cut: false
    };
    updateProjectClips(updated, true, true);
    showToast("Reset clip trim to full duration", "info");
  };

  // AUTO SELECT PIPELINE (Sequential selection from each bucket, prioritizing Defaults)
  const handleAutoSelect = () => {
    if (orderedMasterBuckets.length === 0) {
      showToast("No buckets found in this Master Bucket", "warning");
      return;
    }

    const newClips: VideoEditorClip[] = [];
    let skippedEmptyBucketsCount = 0;

    orderedMasterBuckets.forEach(([bId, bFolder]) => {
      // 1. Skip entire bucket if frozen/skipped for this project
      if (activeProject?.frozen_bucket_ids?.includes(bId)) {
        return;
      }

      // 2. Filter out clips: exclude master-bucket hidden and project-frozen clips
      const sourceBktFid = bFolder?.source_folder_id || bId;
      const isSnapshotBucket = bFolder?.sync_with_source === false && Array.isArray(bFolder?.frozen_video_ids);
      const bucketVideos = Object.entries(db.videos || {}).filter(([vid, v]) => {
        if (db.deleted_videos?.[vid] || (!v.file_id && !v.id && !v.url)) return false;
        if (isSnapshotBucket) {
          if (v.folder_id !== bId && !bFolder.frozen_video_ids!.includes(vid)) return false;
        } else {
          if (v.folder_id !== bId && v.folder_id !== sourceBktFid) return false;
        }
        if (v.is_hidden) return false; // Master bucket hidden
        const isFrozen = activeProject?.project_frozen_vids?.includes(vid) ?? Boolean(v.is_frozen);
        if (isFrozen) return false; // Project frozen
        return true;
      });

      if (bucketVideos.length === 0) {
        // Instantly skip bucket with 0 available clips
        skippedEmptyBucketsCount++;
        return;
      }

      // Project default clip priority
      const projectDefaultVid = activeProject?.project_default_vids?.[bId];
      const defaultVideos = bucketVideos.filter(([vid, v]) => {
        if (projectDefaultVid) return vid === projectDefaultVid;
        return v.is_default;
      });

      let chosenVidEntry = bucketVideos[0];

      if (defaultVideos.length > 0) {
        const randIdx = Math.floor(Math.random() * defaultVideos.length);
        chosenVidEntry = defaultVideos[randIdx];
      } else {
        // Less selected / least used clips prioritized per user request
        const minUsage = Math.min(...bucketVideos.map(([, v]) => v.usage_count || 0));
        const leastUsedVideos = bucketVideos.filter(([, v]) => (v.usage_count || 0) === minUsage);
        const randIdx = Math.floor(Math.random() * leastUsedVideos.length);
        chosenVidEntry = leastUsedVideos[randIdx];
      }

      const [vid, v] = chosenVidEntry;
      const dur = (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 4.0;
      const isStarred = activeProject?.project_starred_vids?.includes(vid) ?? Boolean(v.is_starred);
      const isDefault = projectDefaultVid ? vid === projectDefaultVid : Boolean(v.is_default);

      newClips.push({
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vid: vid,
        url: v.url || '',
        file_id: v.file_id || null,
        bucket_id: bId,
        bucket_name: bFolder.name,
        duration: dur,
        speed: 1.0,
        trim_start: 0,
        trim_end: dur,
        is_starred: isStarred,
        is_default: isDefault
      });
    });

    if (newClips.length === 0) {
      showToast("No playable clips found in the buckets to auto-select", "warning");
      return;
    }

    // 2. AUDIO AUTO-SELECTION (STRICT: only tracks specifically starred or imported for THIS project)
    const hiddenAudioSet = new Set(activeProject?.hidden_audio_ids || []);
    // Strictly only project-starred audio: NO automatic fallback to bucket/global tracks
    const projectStarredCandidateIds = (activeProject?.starred_audio_ids || []).filter(id => !hiddenAudioSet.has(id));

    const candidatePool = projectStarredCandidateIds
      .map(id => db.audios?.[id] || Object.values(db.audios || {}).find(a => a.id === id))
      .filter(Boolean) as AudioItem[];

    // Classify candidates into 'all' (always on every video) vs 'change' (auto rotates across videos)
    const allAudios = candidatePool.filter(a => {
      const mode = activeProject?.audio_modes?.[a.id] || a.mode;
      return mode === 'all';
    });
    const changeAudios = candidatePool.filter(a => {
      const mode = activeProject?.audio_modes?.[a.id] || a.mode;
      return mode !== 'all'; // Default is 'change'
    });

    let selectedChangeAudio: AudioItem | null = null;
    if (changeAudios.length === 1) {
      selectedChangeAudio = changeAudios[0];
    } else if (changeAudios.length > 1) {
      const swapKey = `auto_audio_swap_index_${masterBucketFid || 'global'}_${activeProject?.id || 'def'}`;
      let lastIdx = -1;
      try {
        const stored = localStorage.getItem(swapKey);
        if (stored !== null) lastIdx = parseInt(stored, 10);
        if (isNaN(lastIdx)) lastIdx = -1;
      } catch (_) {
        lastIdx = -1;
      }
      const nextIdx = (lastIdx + 1) % changeAudios.length;
      try {
        localStorage.setItem(swapKey, String(nextIdx));
      } catch (_) {}
      selectedChangeAudio = changeAudios[nextIdx];
    }

    // Audio items to apply: all 'all' audios + current 'change' audio
    const audioItemsToApply: AudioItem[] = [
      ...allAudios,
      ...(selectedChangeAudio ? [selectedChangeAudio] : [])
    ];

    // 3. CAPTIONS: Must Captions Always Stay + Change Captions Swap On Auto (Strictly only if templates exist)
    let finalProjectCaptions: VideoEditorCaption[] = [];
    let chosenChangeCaptionText: string | null = null;
    let mustCaptionsCount = 0;

    const projectHiddenSet = new Set(activeProject?.hidden_caption_ids || []);
    const availableTemplates = captionTemplates.filter(t => !projectHiddenSet.has(t.id));

    if (availableTemplates.length > 0) {
      // 1. Deduplicate available templates by normalized text
      const cleanAvailableMap = new Map<string, VideoEditorCaptionTemplate>();
      availableTemplates.forEach(t => {
        if (!t || !t.text || !t.text.trim()) return;
        const k = t.text.trim().toLowerCase();
        const prev = cleanAvailableMap.get(k);
        const isAll = t.mode === 'all' || t.mode === 'must' || Boolean(t.is_must);
        if (!prev) {
          cleanAvailableMap.set(k, { ...t, mode: isAll ? 'all' : 'change', is_must: isAll, for_all_videos: isAll });
        } else {
          const shouldBeAll = prev.is_must || isAll;
          cleanAvailableMap.set(k, {
            ...prev,
            ...t,
            mode: shouldBeAll ? 'all' : 'change',
            is_must: shouldBeAll,
            for_all_videos: shouldBeAll
          });
        }
      });
      const uniqueAvailable = Array.from(cleanAvailableMap.values());

      const mustTemplates = uniqueAvailable.filter(t => t.mode === 'all' || t.mode === 'must' || t.is_must === true || t.for_all_videos === true);
      const mustTextSet = new Set(mustTemplates.map(t => t.text.trim().toLowerCase()));

      // STRICT LOGIC: Change captions MUST NEVER include any caption whose text is already in mustTemplates!
      const changeTemplates = uniqueAvailable.filter(t =>
        t.mode !== 'all' && t.mode !== 'must' && !t.is_must && !t.for_all_videos &&
        !mustTextSet.has(t.text.trim().toLowerCase())
      );
      mustCaptionsCount = mustTemplates.length;

      // A. MUST Captions: Guaranteed on every video clip
      const mustCaptions: VideoEditorCaption[] = mustTemplates.map((mTpl, mIdx) => {
        const existing = (activeProject?.captions || []).find(
          c => c.template_id === mTpl.id || (c.text.trim() === mTpl.text.trim() && c.font_family === mTpl.font_family)
        );
        return {
          id: existing?.id || `cap_must_${mTpl.id}_${Date.now()}_${mIdx}`,
          template_id: mTpl.id,
          text: mTpl.text,
          font_family: mTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          font_size: mTpl.font_size || captionDefaults.font_size || 24,
          is_bold: mTpl.is_bold ?? true,
          box_width_pct: mTpl.box_width_pct || 85,
          color: mTpl.color || '#ffffff',
          stroke_color: mTpl.stroke_color || '#000000',
          x_pct: mTpl.x_pct !== undefined ? mTpl.x_pct : (captionDefaults.x_pct ?? 50),
          y_pct: mTpl.y_pct !== undefined ? mTpl.y_pct : (captionDefaults.y_pct ?? 35),
          clip_rule: mTpl.clip_rule || 'all',
          clip_count: mTpl.clip_count || 1,
          clip_indices: mTpl.clip_indices ? [...mTpl.clip_indices] : []
        };
      });

      // B. CHANGE Captions: Swapping every time between all change captions
      let selectedChangeCaption: VideoEditorCaption | null = null;
      if (changeTemplates.length === 1) {
        const cTpl = changeTemplates[0];
        chosenChangeCaptionText = cTpl.text;
        selectedChangeCaption = {
          id: `cap_change_${cTpl.id}_${Date.now()}`,
          template_id: cTpl.id,
          text: cTpl.text,
          font_family: cTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          font_size: cTpl.font_size || captionDefaults.font_size || 24,
          is_bold: cTpl.is_bold ?? true,
          box_width_pct: cTpl.box_width_pct || 85,
          color: cTpl.color || '#ffffff',
          stroke_color: cTpl.stroke_color || '#000000',
          x_pct: cTpl.x_pct !== undefined ? cTpl.x_pct : (captionDefaults.x_pct ?? 50),
          y_pct: cTpl.y_pct !== undefined ? cTpl.y_pct : (captionDefaults.y_pct ?? 35),
          clip_rule: cTpl.clip_rule || 'all',
          clip_count: cTpl.clip_count || 1,
          clip_indices: cTpl.clip_indices ? [...cTpl.clip_indices] : []
        };
      } else if (changeTemplates.length > 1) {
        const swapStorageKey = `auto_caption_swap_idx_${masterBucketFid}`;
        let lastIdx = -1;
        try {
          const val = localStorage.getItem(swapStorageKey);
          if (val !== null) lastIdx = parseInt(val, 10);
        } catch (_) {}

        if (isNaN(lastIdx) || lastIdx < 0 || lastIdx >= changeTemplates.length) {
          const currentChangeCap = (activeProject?.captions || []).find(c =>
            changeTemplates.some(t => t.id === c.template_id || t.text.trim() === c.text.trim())
          );
          if (currentChangeCap) {
            lastIdx = changeTemplates.findIndex(t => t.id === currentChangeCap.template_id || t.text.trim() === currentChangeCap.text.trim());
          }
        }

        const nextIdx = (lastIdx + 1) % changeTemplates.length;
        try {
          localStorage.setItem(swapStorageKey, String(nextIdx));
        } catch (_) {}

        const cTpl = changeTemplates[nextIdx];
        chosenChangeCaptionText = cTpl.text;
        selectedChangeCaption = {
          id: `cap_change_${cTpl.id}_${Date.now()}`,
          template_id: cTpl.id,
          text: cTpl.text,
          font_family: cTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
          font_size: cTpl.font_size || captionDefaults.font_size || 24,
          is_bold: cTpl.is_bold ?? true,
          box_width_pct: cTpl.box_width_pct || 85,
          color: cTpl.color || '#ffffff',
          stroke_color: cTpl.stroke_color || '#000000',
          x_pct: cTpl.x_pct !== undefined ? cTpl.x_pct : (captionDefaults.x_pct ?? 50),
          y_pct: cTpl.y_pct !== undefined ? cTpl.y_pct : (captionDefaults.y_pct ?? 35),
          clip_rule: cTpl.clip_rule || 'all',
          clip_count: cTpl.clip_count || 1,
          clip_indices: cTpl.clip_indices ? [...cTpl.clip_indices] : []
        };
      }

      finalProjectCaptions = [
        ...mustCaptions,
        ...(selectedChangeCaption && !mustTextSet.has(selectedChangeCaption.text.trim().toLowerCase()) ? [selectedChangeCaption] : [])
      ];
    }

    // Commit changes to the active project
    if (activeProject) {
      pushHistorySnapshot();

      // Audio Assembly Logic:
      // Preserved 'For All' audio clips stay intact (never swapped or changed on Auto Assemble, identical to Must Captions!)
      const existingClips = activeProject?.audio_clips || [];
      const preservedAllClips = existingClips.filter(c => {
        const mode = activeProject?.audio_modes?.[c.audio_id || ''] || (db.audios?.[c.audio_id || '']?.mode);
        return mode === 'all';
      });

      let newAudioClips: VideoEditorAudioClip[] = [];

      if (preservedAllClips.length > 0 || allAudios.length > 0) {
        // Keep existing For All clips intact without modification
        newAudioClips = [...preservedAllClips];
        // If an allAudio is missing from clips, add it
        allAudios.forEach(allAudio => {
          if (!newAudioClips.some(c => c.audio_id === allAudio.id || c.url === allAudio.url)) {
            newAudioClips.push({
              id: `aud_forall_${allAudio.id}_${Date.now()}`,
              audio_id: allAudio.id,
              name: allAudio.name,
              url: allAudio.url,
              duration: allAudio.duration || 30,
              trim_start: 0,
              trim_end: allAudio.duration || 30,
              speed: 1,
              volume: 1,
              track_layer: newAudioClips.length
            });
          }
        });
      } else if (selectedChangeAudio) {
        // Only rotating change audio
        newAudioClips = [{
          id: `aud_change_${selectedChangeAudio.id}_${Date.now()}`,
          audio_id: selectedChangeAudio.id,
          name: selectedChangeAudio.name,
          url: selectedChangeAudio.url,
          duration: selectedChangeAudio.duration || 30,
          trim_start: 0,
          trim_end: selectedChangeAudio.duration || 30,
          speed: 1,
          volume: 1,
          track_layer: 0
        }];
      } else if (existingClips.length > 0) {
        newAudioClips = [...existingClips];
      }

      // Calculate total video duration to auto-fit audio clips
      const totalDur = newClips.reduce((sum, c) => sum + ((c.trim_end || c.duration || 4) - (c.trim_start || 0)) / (c.speed || 1.0), 0);
      newAudioClips = autoCorrectAudioClipsForVideoDuration(newAudioClips, totalDur);

      const primaryAudio = newAudioClips[0] ? (db.audios?.[newAudioClips[0].audio_id || ''] || audioItemsToApply[0]) : null;

      const updatedProj: VideoEditorProject = {
        ...activeProject,
        clips: newClips,
        captions: finalProjectCaptions,
        audio_clips: newAudioClips,
        audio_id: newAudioClips[0]?.audio_id || primaryAudio?.id,
        audio_url: newAudioClips[0]?.url || primaryAudio?.url,
        audio_name: newAudioClips[0]?.name || primaryAudio?.name,
        audio_duration: newAudioClips[0]?.duration || primaryAudio?.duration,
        audio_volume: newAudioClips[0]?.volume ?? 1,
        updated_at: Date.now()
      };
      setActiveProject(updatedProj);
      onSaveProject(updatedProj);
    } else {
      updateProjectClips(newClips);
    }

    setCurrentClipIndex(0);
    setSelectedTimelineClipIndex(null);
    setIsPlaying(false);

    const toastParts: string[] = [`${newClips.length} clips`];
    if (skippedEmptyBucketsCount > 0) {
      toastParts.push(`${skippedEmptyBucketsCount} empty bucket${skippedEmptyBucketsCount > 1 ? 's' : ''} skipped`);
    }
    if (audioItemsToApply.length > 0) {
      if (allAudios.length > 0 && selectedChangeAudio) {
        toastParts.push(`music "${selectedChangeAudio.name}" + ${allAudios.length} fixed`);
      } else if (selectedChangeAudio) {
        toastParts.push(`music "${selectedChangeAudio.name}"`);
      } else {
        toastParts.push(`music (${allAudios.length} tracks)`);
      }
    }
    if (mustCaptionsCount > 0) toastParts.push(`${mustCaptionsCount} Must caption${mustCaptionsCount > 1 ? 's' : ''}`);
    if (chosenChangeCaptionText) toastParts.push(`swapped caption "${chosenChangeCaptionText}"`);
    showToast(`Auto-Selected ${toastParts.join(' + ')}!`, "success");
  };

  // CLIP PICKER: Buckets & Clips state
  const activePickerBucket = orderedMasterBuckets[activePickerBucketIndex] || orderedMasterBuckets[0] || null;

  // UPLOADS SECTION CLIPS: Identical to the uploads section outside the video editor
  // Gathers all uploaded video clips for this master bucket separated by upload date
  const uploadClips = useMemo(() => {
    if (!db?.videos) return [];
    const uploadsFolderId = 'uploads_' + masterBucketFid;
    const directUploads = Object.entries(db.videos).filter(([id, v]) => {
      if (!v || db.deleted_videos?.[id] || (!v.file_id && !v.url && !id)) return false;
      if (v.folder_id === uploadsFolderId) return true;
      if (v.master_bucket_fid === masterBucketFid && v.is_upload) return true;
      if (v.is_upload && (v.folder_id === masterBucketFid || v.folder_id?.startsWith('uploads_'))) return true;
      const parentF = db.folders?.[v.folder_id];
      if (parentF && (parentF.is_uploads || parentF.name?.toLowerCase() === 'uploads') && (parentF.parent === masterBucketFid || !parentF.parent)) {
        return true;
      }
      return false;
    });

    if (directUploads.length > 0) {
      return directUploads.sort((a, b) => (b[1].created_at || b[1].last_modified || 0) - (a[1].created_at || a[1].last_modified || 0));
    }

    // Fallback if no explicit is_upload clips yet: all clips in this master bucket or its subfolders
    const allMasterClips = Object.entries(db.videos).filter(([id, v]) => {
      if (!v || db.deleted_videos?.[id] || (!v.file_id && !v.url && !id)) return false;
      if (v.folder_id === masterBucketFid || v.master_bucket_fid === masterBucketFid) return true;
      const parentF = db.folders?.[v.folder_id];
      if (parentF && parentF.parent === masterBucketFid) return true;
      return false;
    });

    if (allMasterClips.length > 0) {
      return allMasterClips.sort((a, b) => (b[1].created_at || b[1].last_modified || 0) - (a[1].created_at || a[1].last_modified || 0));
    }

    return Object.entries(db.videos)
      .filter(([id, v]) => v && !db.deleted_videos?.[id] && (v.file_id || v.url || id))
      .sort((a, b) => (b[1].created_at || b[1].last_modified || 0) - (a[1].created_at || a[1].last_modified || 0));
  }, [db.videos, db.deleted_videos, db.folders, masterBucketFid]);

  const activePickerClips = uploadClips;

  const uploadDateGroups = useMemo(() => {
    const today = new Date();
    const todayStr = today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const groupsMap = new Map<string, { label: string; clips: [string, any][] }>();

    activePickerClips.forEach(([vid, clip]) => {
      const rawTs = clip.created_at || clip.last_modified || clip.updated_at;
      let ts = Date.now();
      if (typeof rawTs === 'string') {
        const parsed = Date.parse(rawTs);
        ts = isNaN(parsed) ? Date.now() : parsed;
      } else if (typeof rawTs === 'number') {
        ts = rawTs < 10000000000 ? rawTs * 1000 : rawTs;
      }
      const d = new Date(ts);
      const dateKey = d.toDateString();

      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateKey === todayStr) {
        label = 'Today';
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, { label, clips: [] });
      }
      groupsMap.get(dateKey)!.clips.push([vid, clip]);
    });

    return Array.from(groupsMap.entries()).map(([dateKey, val]) => ({
      dateKey,
      dateLabel: val.label,
      clips: val.clips
    }));
  }, [activePickerClips]);

  // Open full clip picker directly with specific tab and target
  const openClipPickerDirectly = (insertIdx: number | null = null) => {
    pauseAllPlayback();
    setReplaceTargetClipIndex(null);
    setInsertTargetClipIndex(insertIdx !== null && insertIdx !== undefined ? insertIdx : null);
    setVariantTargetClipIndex(null);
    setSelectedClipIdsInPicker([]);
    setClipPickerInitialTab('uploads');
    setShowClipPicker(true);
  };

  // Open the 3-partition + variant choice modal when clicking '+' at the end of the strip
  const openClipPicker = () => {
    pauseAllPlayback();
    setAddClipChoiceTargetIndex(activeClips.length);
    setShowAddClipChoiceModal(true);
  };

  // Open the 3-partition + variant choice modal when clicking '+' between clips
  const openClipPickerAt = (insertIdx: number) => {
    pauseAllPlayback();
    setAddClipChoiceTargetIndex(insertIdx);
    setShowAddClipChoiceModal(true);
  };

  const openClipPickerForVariant = (clipIdx: number) => {
    pauseAllPlayback();
    setReplaceTargetClipIndex(null);
    setInsertTargetClipIndex(null);
    setVariantTargetClipIndex(clipIdx);
    setSelectedClipIdsInPicker([]);
    setClipPickerInitialTab('uploads');
    setShowClipPicker(true);
  };

  // Direct open clip picker specifically to replace the selected timeline clip
  const handleInitiateReplaceClipDirectly = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    if (!clip) return;
    setReplaceTargetClipIndex(clipIdx);
    setInsertTargetClipIndex(null);
    setVariantTargetClipIndex(null);
    setSelectedClipIdsInPicker([]);
    setClipPickerInitialTab('uploads');
    // Direct navigate to this clip's bucket if it matches
    const foundBIdx = orderedMasterBuckets.findIndex(([bId]) => bId === clip.bucket_id);
    if (foundBIdx !== -1) {
      setActivePickerBucketIndex(foundBIdx);
    }
    setShowClipPicker(true);
  };

  // Open replace choice popup ("do you want to import or variant section or cancel")
  const handleInitiateReplaceClip = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    pauseAllPlayback();
    setReplaceChoiceTargetIndex(clipIdx);
    setShowReplaceChoiceModal(true);
  };

  // Execute single-clip replacement on timeline
  const performReplaceWithClip = (targetIdx: number, chosenVideo: any, bucketId: string, bucketName: string) => {
    if (!activeProject || targetIdx < 0 || targetIdx >= activeClips.length) return;

    const dur = typeof chosenVideo.duration === 'number' ? chosenVideo.duration : 4.0;
    const oldClip = activeClips[targetIdx];

    const isMutedReplacement = oldClip.is_muted !== undefined 
      ? oldClip.is_muted 
      : Boolean(chosenVideo.audio_muted || (chosenVideo.vid && db.videos?.[chosenVideo.vid]?.audio_muted));

    const replacedClip: VideoEditorClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vid: chosenVideo.vid || chosenVideo.id,
      url: chosenVideo.url || (chosenVideo.file_id ? `/api/video/${chosenVideo.file_id}` : ''),
      file_id: chosenVideo.file_id || null,
      bucket_id: bucketId || oldClip.bucket_id,
      bucket_name: bucketName || oldClip.bucket_name,
      duration: dur,
      speed: oldClip.speed || 1.0,
      scale: oldClip.scale || 1.0,
      trim_start: 0,
      trim_end: dur,
      is_muted: isMutedReplacement,
      volume: isMutedReplacement ? 0 : (oldClip.volume ?? 1.0),
      is_starred: chosenVideo.is_starred,
      is_default: chosenVideo.is_default
    };

    const updatedClips = [...activeClips];
    updatedClips[targetIdx] = replacedClip;
    updateProjectClips(updatedClips, true);

    setReplaceTargetClipIndex(null);
    setShowClipPicker(false);
    showToast(`Replaced clip #${targetIdx + 1} with "${chosenVideo.name || 'clip'}" from ${bucketName}`, "success");
  };

  // Smart Auto-Replace button inside bucket folder view
  const handleAutoReplaceFromBucket = () => {
    if (replaceTargetClipIndex === null || !activePickerBucket) return;
    const [bucketId, bucketFolder] = activePickerBucket;
    const availableClips = activePickerClips.map(([vid, v]) => ({ vid, ...v })).filter(c => {
      if (c.is_hidden) return false;
      const isFrozen = activeProject?.project_frozen_vids?.includes(c.vid) ?? Boolean(c.is_frozen);
      return !isFrozen;
    });
    if (availableClips.length === 0) {
      showToast(`No available (unfrozen) clips in ${bucketFolder.name}`, "warning");
      return;
    }
    const currentClip = activeClips[replaceTargetClipIndex];
    // Smart selection logic:
    // 1. is_default clip if different from current
    // 2. is_starred clip if different from current
    // 3. Different clip with oldest last_used_at
    // 4. Any available clip
    let picked = availableClips.find(c => c.is_default && c.vid !== currentClip?.vid);
    if (!picked) {
      picked = availableClips.find(c => c.is_starred && c.vid !== currentClip?.vid);
    }
    if (!picked) {
      picked = availableClips.find(c => c.vid !== currentClip?.vid);
    }
    if (!picked) {
      picked = availableClips[0];
    }
    performReplaceWithClip(replaceTargetClipIndex, picked, bucketId, bucketFolder.name);
  };

  const togglePickerClipSelection = (vid: string) => {
    // If in replace mode, clicking any clip directly replaces the targeted clip!
    if (replaceTargetClipIndex !== null) {
      const v = db.videos?.[vid];
      if (v) {
        const [bucketId, bucketFolder] = activePickerBucket || ['', { name: 'Bucket' }];
        performReplaceWithClip(replaceTargetClipIndex, { vid, ...v }, bucketId, bucketFolder.name);
      }
      return;
    }

    setSelectedClipIdsInPicker(prev => {
      if (prev.includes(vid)) {
        return prev.filter(x => x !== vid);
      } else {
        return [...prev, vid];
      }
    });
  };

  const addClipsToTargetVariant = useCallback((clipIdx: number, clipsToAdd: VideoEditorClip[], asNewVariantGroup: boolean = false) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length || clipsToAdd.length === 0) return;
    const targetClip = activeClips[clipIdx];
    const groups = getClipVariantGroups(targetClip).map(g => ({
      ...g,
      clips: [...g.clips]
    }));

    const letterLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    let targetGroupIdx = Math.min(
      Math.max(0, targetClip.active_variant_group_index ?? 0),
      Math.max(0, groups.length - 1)
    );

    if (asNewVariantGroup) {
      const newGroupIdx = groups.length;
      const newLabel = letterLabels[newGroupIdx] || `${newGroupIdx + 1}`;
      groups.push({
        id: `var_group_${newLabel}_${Date.now()}`,
        label: newLabel,
        clips: clipsToAdd,
        active_clip_index: 0
      });
      targetGroupIdx = newGroupIdx;
    } else {
      const currentGroup = groups[targetGroupIdx];
      currentGroup.clips.push(...clipsToAdd);
      currentGroup.active_clip_index = currentGroup.clips.length - 1;
    }

    const activeGroup = groups[targetGroupIdx];
    const activeClipInGroupIdx = Math.min(
      Math.max(0, activeGroup.active_clip_index ?? 0),
      Math.max(0, activeGroup.clips.length - 1)
    );
    const activeTake = activeGroup.clips[activeClipInGroupIdx] || clipsToAdd[clipsToAdd.length - 1];

    const updatedClip: VideoEditorClip = {
      ...targetClip,
      variant_groups: groups,
      active_variant_group_index: targetGroupIdx,
      variants: activeGroup.clips,
      active_variant_index: activeClipInGroupIdx,
      url: activeTake.url,
      file_id: activeTake.file_id || targetClip.file_id,
      duration: activeTake.duration || targetClip.duration,
      trim_start: activeTake.trim_start ?? 0,
      trim_end: activeTake.trim_end ?? (activeTake.duration || targetClip.duration),
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);

    setClipBlobUrls(prev => {
      const next = { ...prev };
      delete next[targetClip.id];
      return next;
    });

    setSelectedTimelineClipIndex(clipIdx);
    setCurrentClipIndex(clipIdx);
    createNewVariantGroupOnAddRef.current = false;

    const grpLabel = activeGroup.label || letterLabels[targetGroupIdx] || `${targetGroupIdx + 1}`;
    if (asNewVariantGroup) {
      showToast(`Created Concept ${grpLabel} (${activeGroup.clips.length} ${activeGroup.clips.length === 1 ? 'clip' : 'clips'}) on Clip #${clipIdx + 1}!`, 'success');
    } else {
      showToast(`Added ${clipsToAdd.length} ${clipsToAdd.length === 1 ? 'clip' : 'clips'} to Concept ${grpLabel} (${activeGroup.clips.length} dots) on Clip #${clipIdx + 1}!`, 'success');
    }
  }, [activeClips, updateProjectClips, showToast]);

  // Add all selected clips from picker to the end of timeline (or into target variant)
  const handleAddSelectedClipsToTimeline = () => {
    if (selectedClipIdsInPicker.length === 0) {
      setShowClipPicker(false);
      return;
    }

    const toAppend: VideoEditorClip[] = [];
    selectedClipIdsInPicker.forEach(vid => {
      const v = db.videos?.[vid];
      if (!v) return;
      const bFolder = db.folders?.[v.folder_id];
      const dur = typeof v.duration === 'number' ? v.duration : 4.0;
      const isClipMuted = false;
      toAppend.push({
        id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vid: vid,
        url: v.url || '',
        file_id: v.file_id || null,
        bucket_id: v.folder_id,
        bucket_name: bFolder?.name || 'Bucket',
        duration: dur,
        speed: 1.0,
        trim_start: 0,
        trim_end: dur,
        is_muted: isClipMuted,
        volume: isClipMuted ? 0 : 1.0,
        is_starred: v.is_starred,
        is_default: v.is_default
      });
    });

    if (variantTargetClipIndex !== null && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      addClipsToTargetVariant(variantTargetClipIndex, toAppend, createNewVariantGroupOnAddRef.current);
      setVariantTargetClipIndex(null);
      setShowClipPicker(false);
      setSelectedClipIdsInPicker([]);
      return;
    }

    const newClips = [...activeClips];
    if (insertTargetClipIndex !== null && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      newClips.splice(insertTargetClipIndex, 0, ...toAppend);
      showToast(`Inserted ${toAppend.length} clip(s) at position #${insertTargetClipIndex + 1}!`, "success");
    } else {
      newClips.push(...toAppend);
      showToast(`Added ${toAppend.length} clips to timeline!`, "success");
    }
    updateProjectClips(newClips);
    setInsertTargetClipIndex(null);
    setShowClipPicker(false);
    setSelectedClipIdsInPicker([]);
  };

  // Take the entire clip with all of its variants intact
  const handleTakeFullClip = useCallback((sourceClip: VideoEditorClip) => {
    const clonedClip: VideoEditorClip = {
      ...sourceClip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variants: sourceClip.variants ? sourceClip.variants.map((v, vIdx) => ({
        ...v,
        id: `take_${vIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      })) : undefined
    };

    if (variantTargetClipIndex !== null && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const takesToAdd: VideoEditorClip[] = (sourceClip.variants && sourceClip.variants.length > 0)
        ? sourceClip.variants.map(v => ({ ...v, id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` }))
        : [{ ...sourceClip, id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` }];

      addClipsToTargetVariant(variantTargetClipIndex, takesToAdd, createNewVariantGroupOnAddRef.current);
      setVariantTargetClipIndex(null);
      setShowClipPicker(false);
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = clonedClip;
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(replaceTargetClipIndex);
      setCurrentClipIndex(replaceTargetClipIndex);
      setReplaceTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with full clip & variants!`, 'success');
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, clonedClip);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(insertTargetClipIndex);
      setCurrentClipIndex(insertTargetClipIndex);
      setInsertTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Inserted full clip with all variants at position #${insertTargetClipIndex + 1}!`, 'success');
      return;
    }

    const updated = [...activeClips, clonedClip];
    updateProjectClips(updated, true);
    setSelectedTimelineClipIndex(updated.length - 1);
    setCurrentClipIndex(updated.length - 1);
    setShowClipPicker(false);
    showToast(`Added full clip with all variants to timeline!`, 'success');
  }, [activeClips, variantTargetClipIndex, replaceTargetClipIndex, insertTargetClipIndex, addClipsToTargetVariant, updateProjectClips, showToast]);

  // Take ONLY a single specific take/clip (no other variants attached)
  const handleTakeSingleClip = useCallback((singleClip: VideoEditorClip) => {
    const cleanClip: VideoEditorClip = {
      ...singleClip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variants: undefined,
      active_variant_index: undefined,
      variant_groups: undefined,
      active_variant_group_index: undefined,
      trim_start: 0,
      trim_end: singleClip.duration || 5,
      speed: 1.0,
      scale: 1.0,
      is_muted: false,
      volume: 1.0
    };

    if (variantTargetClipIndex !== null && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const newVariant: VideoEditorClip = {
        ...cleanClip,
        id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      };
      addClipsToTargetVariant(variantTargetClipIndex, [newVariant], createNewVariantGroupOnAddRef.current);
      setVariantTargetClipIndex(null);
      setShowClipPicker(false);
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = cleanClip;
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(replaceTargetClipIndex);
      setCurrentClipIndex(replaceTargetClipIndex);
      setReplaceTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with single take!`, 'success');
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, cleanClip);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(insertTargetClipIndex);
      setCurrentClipIndex(insertTargetClipIndex);
      setInsertTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Inserted single clip at position #${insertTargetClipIndex + 1}!`, 'success');
      return;
    }

    const updated = [...activeClips, cleanClip];
    updateProjectClips(updated, true);
    setSelectedTimelineClipIndex(updated.length - 1);
    setCurrentClipIndex(updated.length - 1);
    setShowClipPicker(false);
    showToast(`Added single clip to timeline!`, 'success');
  }, [activeClips, variantTargetClipIndex, replaceTargetClipIndex, insertTargetClipIndex, addClipsToTargetVariant, updateProjectClips, showToast]);

  // Take ALL clips from a specific variant group / concept
  const handleTakeVariantGroup = useCallback((grp: { id?: string; label?: string; clips?: VideoEditorClip[] }) => {
    const grpClips = grp.clips && grp.clips.length > 0 ? grp.clips : [];
    if (grpClips.length === 0) return;

    const clonedClips: VideoEditorClip[] = grpClips.map((c, i) => ({
      ...c,
      id: `take_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      trim_start: 0,
      trim_end: c.duration || 5,
      speed: 1.0,
      scale: 1.0,
      is_muted: c.is_muted ?? false,
      volume: c.volume ?? 1.0,
      variants: undefined,
      variant_groups: undefined
    }));

    if (variantTargetClipIndex !== null && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      addClipsToTargetVariant(variantTargetClipIndex, clonedClips, true);
      setVariantTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Added Concept ${grp.label || 'A'} (${clonedClips.length} takes) to Clip #${variantTargetClipIndex + 1}!`, 'success');
      return;
    }

    const primaryTake = clonedClips[0];
    const newGroup = {
      id: `group_${Date.now()}`,
      label: grp.label || 'A',
      clips: clonedClips,
      active_clip_index: 0
    };
    const targetClipData: VideoEditorClip = {
      ...primaryTake,
      variants: clonedClips,
      active_variant_index: 0,
      variant_groups: [newGroup],
      active_variant_group_index: 0
    };

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = targetClipData;
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(replaceTargetClipIndex);
      setCurrentClipIndex(replaceTargetClipIndex);
      setReplaceTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with Concept ${newGroup.label}!`, 'success');
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, targetClipData);
      updateProjectClips(updated, true);
      setSelectedTimelineClipIndex(insertTargetClipIndex);
      setCurrentClipIndex(insertTargetClipIndex);
      setInsertTargetClipIndex(null);
      setShowClipPicker(false);
      showToast(`Inserted Concept ${newGroup.label} at position #${insertTargetClipIndex + 1}!`, 'success');
      return;
    }

    const updated = [...activeClips, targetClipData];
    updateProjectClips(updated, true);
    setSelectedTimelineClipIndex(updated.length - 1);
    setCurrentClipIndex(updated.length - 1);
    setShowClipPicker(false);
    showToast(`Added Concept ${newGroup.label} to timeline!`, 'success');
  }, [activeClips, variantTargetClipIndex, replaceTargetClipIndex, insertTargetClipIndex, addClipsToTargetVariant, updateProjectClips, showToast]);

  const handleUploadVideoAsVariant = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || variantTargetClipIndex === null || variantTargetClipIndex === undefined) return;
    if (variantTargetClipIndex < 0 || variantTargetClipIndex >= activeClips.length) return;

    setIsUploadingVariantClip(true);
    showToast(`Uploading ${files.length} video clip${files.length === 1 ? '' : 's'} for Clip #${variantTargetClipIndex + 1}...`, 'info');

    try {
      const targetFolderId = activeProject?.master_bucket_fid || 'uploads';
      const newVariants: VideoEditorClip[] = [];
      const newVideosMap: Record<string, any> = {};

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', targetFolderId);

        let resp = await fetch('/api/videos', {
          method: 'POST',
          body: formData
        });
        if (!resp.ok) {
          resp = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
        }
        const data = await resp.json();

        if (data && data.video) {
          const targetClip = activeClips[variantTargetClipIndex];
          const vDur = typeof data.video.duration === 'number' ? data.video.duration : (targetClip.duration || 4.0);

          newVariants.push({
            id: `clip_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
            vid: data.video.id || `v_${Date.now()}_${i}`,
            url: data.video.url || (data.video.file_id ? `/api/video/${data.video.file_id}` : ''),
            file_id: data.video.file_id || null,
            bucket_id: targetFolderId,
            bucket_name: masterBucketName,
            duration: vDur,
            speed: 1.0,
            scale: 1.0,
            trim_start: 0,
            trim_end: vDur,
            is_muted: false,
            volume: 1.0,
          });

          if (data.video.id) {
            newVideosMap[data.video.id] = data.video;
          }
        }
      }

      if (newVariants.length > 0) {
        addClipsToTargetVariant(variantTargetClipIndex, newVariants, createNewVariantGroupOnAddRef.current);

        if (setDb && Object.keys(newVideosMap).length > 0) {
          setDb((prev: any) => ({
            ...prev,
            videos: { ...prev.videos, ...newVideosMap }
          }));
        }
        showToast(`Uploaded & added ${newVariants.length} variant clip${newVariants.length === 1 ? '' : 's'} to Clip #${variantTargetClipIndex + 1}!`, 'success');
      } else {
        showToast('Failed to upload video variant', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error uploading video variant', 'error');
    } finally {
      setIsUploadingVariantClip(false);
      createNewVariantGroupOnAddRef.current = false;
      if (variantUploadInputRef.current) {
        variantUploadInputRef.current.value = '';
      }
    }
  };

  const handleCreateEmptyVariant = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    // Don't create an empty dummy variant until a clip is actually generated or added!
    handleOpenAiPromptMode(clipIdx);
    showToast("Enter your AI prompt below to generate this take", "info");
  };

  const handleCreateVariantGroup = (clipIdx: number, mode: 'empty_ai' | 'upload' | 'picker' = 'picker') => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    if (mode === 'empty_ai') {
      createNewVariantGroupOnAddRef.current = true;
      handleOpenAiPromptMode(clipIdx);
      showToast("Enter your AI prompt below to generate new Variant", "info");
      return;
    }

    if (mode === 'upload') {
      createNewVariantGroupOnAddRef.current = true;
      setVariantTargetClipIndex(clipIdx);
      variantUploadInputRef.current?.click();
      return;
    }

    createNewVariantGroupOnAddRef.current = true;
    openClipPickerForVariant(clipIdx);
  };

  const handleUploadClipForConcept = useCallback(async (clipIdx: number, files: FileList | File[], asNewConcept: boolean = true) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length || !files || files.length === 0) return;
    const fileList = Array.from(files);
    createNewVariantGroupOnAddRef.current = asNewConcept;
    setVariantTargetClipIndex(clipIdx);
    setIsUploadingVariantClip(true);
    showToast(`Uploading ${fileList.length} video clip${fileList.length === 1 ? '' : 's'} for ${asNewConcept ? 'New Concept' : 'Variant'}...`, 'info');

    try {
      const targetFolderId = activeProject?.master_bucket_fid || 'uploads';
      const newVariants: VideoEditorClip[] = [];
      const newVideosMap: Record<string, any> = {};

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', targetFolderId);

        let resp = await fetch('/api/videos', {
          method: 'POST',
          body: formData
        });
        if (!resp.ok) {
          resp = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
        }
        const data = await resp.json();

        if (data && data.video) {
          const targetClip = activeClips[clipIdx];
          const vDur = typeof data.video.duration === 'number' ? data.video.duration : (targetClip.duration || 4.0);

          newVariants.push({
            id: `clip_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
            vid: data.video.id || `v_${Date.now()}_${i}`,
            url: data.video.url || (data.video.file_id ? `/api/video/${data.video.file_id}` : ''),
            file_id: data.video.file_id || null,
            bucket_id: targetFolderId,
            bucket_name: masterBucketName,
            duration: vDur,
            speed: 1.0,
            scale: 1.0,
            trim_start: 0,
            trim_end: vDur,
            is_muted: false,
            volume: 1.0,
          });

          if (data.video.id) {
            newVideosMap[data.video.id] = data.video;
          }
        }
      }

      if (newVariants.length > 0) {
        addClipsToTargetVariant(clipIdx, newVariants, asNewConcept);
        if (setDb && Object.keys(newVideosMap).length > 0) {
          setDb((prev: any) => ({
            ...prev,
            videos: { ...prev.videos, ...newVideosMap }
          }));
        }
        showToast(`Added ${newVariants.length} clip${newVariants.length === 1 ? '' : 's'} as ${asNewConcept ? 'new Concept' : 'variant'} to Clip #${clipIdx + 1}!`, 'success');
      } else {
        showToast('Failed to upload video clip', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error uploading video', 'error');
    } finally {
      setIsUploadingVariantClip(false);
      createNewVariantGroupOnAddRef.current = false;
    }
  }, [activeClips, activeProject, masterBucketName, addClipsToTargetVariant, setDb, showToast]);

  // Render Engine Mode: In-Phone Mobile Render (100% Offline, Zero Internet) vs Cloud Engine
  const [renderEngine, setRenderEngine] = useState<'mobile_offline' | 'cloud_server'>(() => {
    try {
      const stored = localStorage.getItem('vd_render_engine');
      if (stored === 'cloud_server' || stored === 'mobile_offline') return stored;
    } catch (_) {}
    return 'mobile_offline';
  });

  // IN-PHONE MOBILE VIDEO RENDERER (100% Offline, Zero Internet Used)
  const handleExportOnDevice = useCallback(async () => {
    const pid = activeProject?.id;
    if (!pid) {
      showToast("Please save or select a project before exporting", "warning");
      return;
    }
    if (activeClips.length === 0) {
      showToast("No clips in timeline to export", "warning");
      return;
    }

    const abortCtrl = new AbortController();
    exportAbortControllerRef.current = abortCtrl;
    setIsExporting(true);
    setExportProgress(5);
    setExportStatusText("Initializing in-device offline mobile render engine...");
    setShowExportModal(true);

    try {
      const res = await renderVideoOnDevice({
        projectName: activeProject.name || 'Studio_Video',
        clips: activeClips,
        audioClips: activeAudioClips,
        backgroundAudioUrl: activeProject.audio_url,
        backgroundAudioVolume: activeProject.audio_volume,
        captions: activeCaptions,
        onProgress: (p) => {
          setExportProgress(p.progress);
          setExportStatusText(p.statusText);
        },
        signal: abortCtrl.signal,
      });

      setExportResult({
        downloadUrl: res.blobUrl,
        filename: res.filename,
        size: res.size,
        duration: res.duration,
        isLocalMobileRender: true,
      });
      setIsExporting(false);
      showToast("🎉 Studio video rendered on your phone! Zero internet data used.", "success");
    } catch (err: any) {
      setIsExporting(false);
      if (err?.message !== 'Render cancelled by user' && err?.message !== 'Render cancelled') {
        showToast(`Mobile render note: ${err?.message || 'Error'}. You can switch to Cloud render.`, "error");
      }
    }
  }, [activeProject, activeClips, activeAudioClips, activeCaptions, showToast]);

  // STUDIO-GRADE 1080p 30FPS HIGH-QUALITY TIMELINE EXPORT ENGINE (Universal Social Media H.264 + AAC MP4)
  const handleExportMergedVideo = async () => {
    const pid = activeProject?.id;
    if (!pid) {
      showToast("Please save or select a project before exporting", "warning");
      return;
    }
    if (activeClips.length === 0) {
      showToast("No clips in timeline to export", "warning");
      return;
    }

    // Check if Kaggle account is configured
    const hasKaggleAccount = Boolean(
      (db?.config?.kaggle_accounts && db.config.kaggle_accounts.some((a: any) => a && a.enabled !== false && a.username && a.key)) ||
      (db?.config?.kaggle_username && db?.config?.kaggle_key)
    );
    const isKaggleExport = Boolean(useKaggleGpu && hasKaggleAccount);
    const projectName = activeProject?.name || 'Studio Video Export';
    const realJobId = 'job_render_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const exportSessionId = realJobId;
    exportSessionIdRef.current = realJobId;
    exportSessionStartTimeRef.current = Date.now();
    setExportResult(null);

    // Instant non-blocking export: execute immediately to Kaggle/backend without blocking parallel runs
    setShowExportModal(false);
    showToast(
      isKaggleExport
        ? "⚡ Submitting to Kaggle Dual-T4 GPU worker..."
        : "⚡ Starting Studio CPU Video Rendering...",
      "info"
    );

    const abortCtrl = new AbortController();
    exportAbortControllerRef.current = abortCtrl;

    setExportingProjectIds(prev => ({
      ...prev,
      [pid]: {
        isExporting: true,
        progress: 10,
        statusText: isKaggleExport ? "Preparing Kaggle timeline package..." : "Preparing HD 30FPS timeline sequence...",
        sessionId: exportSessionId,
        projectName,
        startedAt: Date.now()
      }
    }));

    // Instantly surface the bottom render dock the exact millisecond export is initiated
    try {
      const initTask = {
        id: realJobId,
        jobId: realJobId,
        projectId: pid,
        projectName,
        status: 'running',
        progress: isKaggleExport ? 12 : 15,
        statusText: isKaggleExport 
          ? '⚡ Executing on Kaggle Dual-T4 GPU Container...'
          : '⚡ Standardizing clips to 1080x1920 30 FPS...',
        logLine: `[EXPORT] Task initiated for "${projectName}". Mode: ${isKaggleExport ? 'Kaggle Dual-T4 GPU' : 'Studio CPU Engine'}...`,
        startedAt: Date.now()
      };
      try {
        sessionStorage.setItem('active_export_task', JSON.stringify(initTask));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('render-status-update', {
        detail: initTask
      }));
    } catch (_) {}

    try {
      // 1. Ensure all custom typography fonts (TikTok Sans, Montserrat, etc.) are 100% loaded before rendering canvas
      try {
        await document.fonts.ready;
        await Promise.all(activeCaptions.map(async (c) => {
          const rawFamily = c.font_family || CAPTION_FONTS[0].family;
          const primaryName = rawFamily.split(',')[0].replace(/['"]/g, '').trim();
          const sz = Math.round((c.font_size || 24) * 3);
          try {
            await document.fonts.load(`${c.is_bold !== false ? 'bold 700' : 'normal 400'} ${sz}px "${primaryName}"`);
          } catch (_) {}
        }));
      } catch (_) {}

      const payload = {
        projectName: activeProject?.name || 'video_project',
        masterBucketFid,
        projectId: activeProject?.id,
        editorMode,
        currentUserEmail,
        active_title_template: activeTitleTemplate,
        clips: activeClips.map(c => {
          const activeVariant = (c.variants && typeof c.active_variant_index === 'number')
            ? c.variants[c.active_variant_index]
            : null;
          const effUrl = activeVariant?.url || c.url || '';
          const effFileId = activeVariant?.file_id || activeVariant?.vid || c.file_id || c.vid || '';
          const trimStart = typeof c.trim_start === 'number' ? c.trim_start : (typeof activeVariant?.trim_start === 'number' ? activeVariant.trim_start : 0);
          const fullDur = c.orig_duration || c.duration || activeVariant?.duration || 0;
          const trimEnd = (typeof c.trim_end === 'number' && c.trim_end > trimStart)
            ? c.trim_end
            : (typeof activeVariant?.trim_end === 'number' && activeVariant.trim_end > trimStart ? activeVariant.trim_end : (fullDur > trimStart ? fullDur : undefined));
          return {
            file_id: effFileId,
            vid: c.vid,
            url: effUrl,
            trim_start: trimStart,
            trim_end: trimEnd,
            speed: c.speed || 1.0,
            scale: c.scale || 1.0,
            duration: c.duration,
            volume: getIsClipMuted(c) ? 0 : (c.volume ?? 1.0),
            is_muted: getIsClipMuted(c)
          };
        }),
        audio_clips: activeAudioClips.map((ac) => {
          let clipStart = 0;
          const sameLayerClips = activeAudioClips.filter(c => (c.track_layer || 0) === (ac.track_layer || 0));
          const idxInLayer = sameLayerClips.findIndex(c => c.id === ac.id);
          for (let ci = 0; ci < idxInLayer; ci++) {
            clipStart += getAudioClipEffectiveDuration(sameLayerClips[ci]);
          }
          return {
            ...ac,
            start_time: ac.start_time !== undefined ? ac.start_time : clipStart,
            track_layer: ac.track_layer || 0
          };
        }),
        audio_url: activeProject?.audio_url,
        audio_volume: activeProject?.audio_volume !== undefined ? activeProject.audio_volume : 1.0,
        captions: (() => {
          const vpRect = videoViewportRef.current?.getBoundingClientRect();
          const previewW = vpRect && vpRect.width > 50 ? vpRect.width : 360;
          const previewH = vpRect && vpRect.height > 50 ? vpRect.height : 640;
          const scaleFactor = 1080 / previewW;

          // Ensure non-hidden MUST / ALL captions are guaranteed to be included in every exported video
          const exportHiddenSet = new Set(activeProject?.hidden_caption_ids || []);
          const nonHiddenMustTpls = captionTemplates.filter(t => !exportHiddenSet.has(t.id) && (t.mode === 'all' || t.mode === 'must' || t.is_must === true || t.for_all_videos === true));
          let allExportCaptions = [...activeCaptions];
          nonHiddenMustTpls.forEach(mTpl => {
            const exists = allExportCaptions.some(c => c.template_id === mTpl.id || (c.text.trim() === mTpl.text.trim() && c.font_family === mTpl.font_family));
            if (!exists) {
              allExportCaptions.push({
                id: `cap_must_exp_${mTpl.id}_${Date.now()}`,
                template_id: mTpl.id,
                text: mTpl.text,
                font_family: mTpl.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
                font_size: mTpl.font_size || captionDefaults.font_size || 24,
                is_bold: mTpl.is_bold ?? true,
                box_width_pct: mTpl.box_width_pct || 85,
                color: mTpl.color || '#ffffff',
                stroke_color: mTpl.stroke_color || '#000000',
                x_pct: mTpl.x_pct !== undefined ? mTpl.x_pct : (captionDefaults.x_pct ?? 50),
                y_pct: mTpl.y_pct !== undefined ? mTpl.y_pct : (captionDefaults.y_pct ?? 35),
                clip_rule: mTpl.clip_rule || 'all',
                clip_count: mTpl.clip_count || 1,
                clip_indices: mTpl.clip_indices ? [...mTpl.clip_indices] : []
              });
            }
          });

          return allExportCaptions.map(cap => {
            const segments: Array<{ start_time: number; end_time: number }> = [];
            timelineClipsMeta.forEach((meta, idx) => {
              if (isCaptionVisible(cap, idx, activeClips.length, allExportCaptions)) {
                const segStart = meta.projectStartTime;
                const segEnd = meta.projectStartTime + meta.effectiveDur;
                const lastSeg = segments[segments.length - 1];
                if (lastSeg && Math.abs(lastSeg.end_time - segStart) < 0.05) {
                  lastSeg.end_time = segEnd;
                } else {
                  segments.push({ start_time: segStart, end_time: segEnd });
                }
              }
            });

            const fontSize = cap.font_size || 24;
            const fontSize1080 = Math.round(fontSize * scaleFactor);
            // Outline border: increased 20% from previous size per user request
            const baseStroke = Math.max(1, Math.round(fontSize * 0.08));
            const strokeWidth = Math.max(0.78, Math.round(baseStroke * 0.78 * 10) / 10);
            const strokeWidth1080 = Math.max(1, Math.round(strokeWidth * scaleFactor));
            const posX1080 = ((cap.x_pct !== undefined ? cap.x_pct : 50) / 100) * 1080;
            const posY1080 = ((cap.y_pct !== undefined ? cap.y_pct : 35) / 100) * 1920;
            const boxWidthPct = cap.box_width_pct || 80;
            const maxBoxWidth1080 = Math.min(1080 - 40, (boxWidthPct / 100) * 1080);
            const fontFamily = cap.font_family || CAPTION_FONTS[0].family;
            const primaryFontName = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            const isBold = cap.is_bold !== false; // Bold by default matching TikTok headline
            const strokeColor = cap.stroke_color || '#000000';
            const hasStroke = strokeColor !== 'transparent' && strokeColor !== 'none';
            const fillColor = cap.color || '#ffffff';
            const rawText = String(cap.text || '').trim();

            let imageData: string | undefined = undefined;
            const renderedLines: string[] = [];

            // 1. Extract the EXACT multiline text wrapped by browser in the live DOM preview
            const domOverlay = document.getElementById(`caption-overlay-${cap.id}`);
            const domSpan = domOverlay?.querySelector('span');

            if (domSpan) {
              try {
                const words = rawText.split(/\s+/).filter(Boolean);
                if (words.length <= 1) {
                  renderedLines.push(rawText);
                } else {
                  const clone = domSpan.cloneNode(true) as HTMLElement;
                  clone.style.position = 'absolute';
                  clone.style.visibility = 'hidden';
                  clone.style.pointerEvents = 'none';
                  clone.style.width = `${domSpan.offsetWidth}px`;
                  clone.innerHTML = words.map(w => `<span class="__wrap_measure__">${w}</span>`).join(' ');
                  document.body.appendChild(clone);

                  const wordNodes = clone.querySelectorAll('.__wrap_measure__');
                  let curLineWords: string[] = [];
                  let lastTop = -9999;

                  wordNodes.forEach((node) => {
                    const rect = (node as HTMLElement).getBoundingClientRect();
                    if (lastTop === -9999 || Math.abs(rect.top - lastTop) < 6) {
                      curLineWords.push(node.textContent || '');
                      if (lastTop === -9999) lastTop = rect.top;
                    } else {
                      if (curLineWords.length > 0) {
                        renderedLines.push(curLineWords.join(' '));
                      }
                      curLineWords = [node.textContent || ''];
                      lastTop = rect.top;
                    }
                  });
                  if (curLineWords.length > 0) {
                    renderedLines.push(curLineWords.join(' '));
                  }
                  document.body.removeChild(clone);
                }
              } catch (e) {
                console.warn("DOM line extract note:", e);
              }
            } else {
              try {
                const rawText = String(cap.text || '').trim();
                const words = rawText.split(/\s+/).filter(Boolean);
                if (words.length <= 1) {
                  renderedLines.push(rawText);
                } else {
                  const tempMeas = document.createElement('div');
                  tempMeas.style.position = 'absolute';
                  tempMeas.style.visibility = 'hidden';
                  tempMeas.style.pointerEvents = 'none';
                  tempMeas.style.width = `${Math.max(60, previewW * (boxWidthPct / 100))}px`;
                  tempMeas.style.fontFamily = fontFamily;
                  tempMeas.style.fontSize = `${fontSize}px`;
                  tempMeas.style.fontWeight = isBold ? '700' : '400';
                  tempMeas.style.lineHeight = '1.25';
                  tempMeas.style.textAlign = 'center';
                  (tempMeas.style as any).textWrap = 'balance';
                  tempMeas.innerHTML = words.map(w => `<span class="__wrap_measure__">${w}</span>`).join(' ');
                  document.body.appendChild(tempMeas);

                  const wordNodes = tempMeas.querySelectorAll('.__wrap_measure__');
                  let curLineWords: string[] = [];
                  let lastTop = -9999;
                  wordNodes.forEach((node) => {
                    const rect = (node as HTMLElement).getBoundingClientRect();
                    if (lastTop === -9999 || Math.abs(rect.top - lastTop) < 6) {
                      curLineWords.push(node.textContent || '');
                      if (lastTop === -9999) lastTop = rect.top;
                    } else {
                      if (curLineWords.length > 0) renderedLines.push(curLineWords.join(' '));
                      curLineWords = [node.textContent || ''];
                      lastTop = rect.top;
                    }
                  });
                  if (curLineWords.length > 0) renderedLines.push(curLineWords.join(' '));
                  document.body.removeChild(tempMeas);
                }
              } catch (_) {}
            }

            try {
              const canvas = document.createElement('canvas');
              canvas.width = 1080;
              canvas.height = 1920;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // Valid standard canvas 2D font syntax (use 'bold' or 'normal', not 'bold 700')
                ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize1080}px "${primaryFontName}", ${fontFamily}, "Noto Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;

                if (renderedLines.length === 0) {
                  const rawText = String(cap.text || '');
                  const paragraphs = rawText.split(/\r?\n/);
                  paragraphs.forEach(para => {
                    const words = para.trim().split(/\s+/);
                    if (words.length === 0 || (words.length === 1 && !words[0])) {
                      renderedLines.push('');
                      return;
                    }
                    let curLine = '';
                    words.forEach(w => {
                      if (!w) return;
                      const testLine = curLine ? `${curLine} ${w}` : w;
                      const testWidth = ctx.measureText(testLine).width;
                      if (testWidth <= maxBoxWidth1080 || !curLine) {
                        curLine = testLine;
                      } else {
                        renderedLines.push(curLine);
                        curLine = w;
                      }
                    });
                    if (curLine) renderedLines.push(curLine);
                  });
                }

                if (renderedLines.length === 0 && rawText.trim()) {
                  renderedLines.push(rawText.trim());
                }

                const lineHeight1080 = fontSize1080 * 1.25;
                const totalTextHeight = renderedLines.length * lineHeight1080;
                const startY = posY1080 - (totalTextHeight / 2) + (lineHeight1080 / 2);

                // 1. First pass: Crisp ambient text shadow matching the preview text-shadow
                ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
                ctx.shadowBlur = Math.round(scaleFactor * 4);
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = Math.round(scaleFactor * 2);

                renderedLines.forEach((line, lIdx) => {
                  const lineY = startY + (lIdx * lineHeight1080);
                  if (hasStroke) {
                    ctx.lineWidth = strokeWidth1080 * 2;
                    ctx.strokeStyle = strokeColor;
                    ctx.strokeText(line, posX1080, lineY);
                  }
                });

                // 2. Second pass: Crisp foreground white text fill (no blur)
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                renderedLines.forEach((line, lIdx) => {
                  const lineY = startY + (lIdx * lineHeight1080);
                  ctx.fillStyle = fillColor;
                  ctx.fillText(line, posX1080, lineY);
                });

                imageData = canvas.toDataURL('image/png');
              }
            } catch (cvErr) {
              console.warn("Canvas caption render note:", cvErr);
            }

            return {
              id: cap.id,
              text: cap.text,
              is_bold: isBold,
              font_size: fontSize,
              font_size_1080: fontSize1080,
              stroke_width_1080: strokeWidth1080,
              preview_viewport_width: previewW,
              preview_viewport_height: previewH,
              box_width_pct: boxWidthPct,
              font_family: fontFamily,
              color: fillColor,
              stroke_color: strokeColor,
              x_pct: cap.x_pct !== undefined ? cap.x_pct : 50,
              y_pct: cap.y_pct !== undefined ? cap.y_pct : 35,
              lines: renderedLines,
              image_data: imageData,
              segments
            };
          });
        })(),
        jobId: realJobId,
        useKaggleGpu: isKaggleExport,
        enableGpu: isKaggleExport,
        enableProteusUpscale: isKaggleExport,
        exportMode: isKaggleExport ? 'kaggle_gpu' : 'local'
      };

      // Dynamic status updates & live progress tracking during server rendering
      const totalEstimatedSeconds = Math.max(15, Math.round(activeClips.length * 5 + (activeCaptions.length > 0 ? 12 : 2) + 6));
      let elapsedSeconds = 0;

      if (!isKaggleExport) {
        try {
          window.dispatchEvent(new CustomEvent('render-status-update', {
            detail: {
              id: exportSessionId,
              jobId: exportSessionId,
              projectName,
              status: 'running',
              progress: 10,
              statusText: `Standardizing ${activeClips.length} clips to 1080x1920 30 FPS...`,
              logLine: `[RENDER-START] Initializing studio export for "${projectName}" (${activeClips.length} clips)...`
            }
          }));
        } catch (_) {}

        exportProgressTimerRef.current = setInterval(() => {
          elapsedSeconds += 1;
          setExportProgress(prev => {
            if (prev >= 98) return 98;
            const targetProgress = Math.min(94, 10 + Math.round((elapsedSeconds / totalEstimatedSeconds) * 84));
            const nextVal = Math.max(prev, targetProgress);
            let currentStatus = '';

            if (nextVal < 35) {
              currentStatus = `Standardizing ${activeClips.length} clips to 1080x1920 30 FPS (${elapsedSeconds}s)...`;
            } else if (nextVal < 65) {
              currentStatus = `Encoding studio H.264 video streams (${elapsedSeconds}s)...`;
            } else if (nextVal < 82) {
              currentStatus = `Mixing audio tracks & background music (${elapsedSeconds}s)...`;
            } else if (nextVal < 94) {
              currentStatus = `Burning styled captions & faststart MP4 (${elapsedSeconds}s)...`;
            } else {
              currentStatus = `Finalizing studio MP4 render (${elapsedSeconds}s)... Almost ready!`;
            }
            setExportStatusText(currentStatus);

            try {
              window.dispatchEvent(new CustomEvent('render-status-update', {
                detail: {
                  id: exportSessionId,
                  jobId: exportSessionId,
                  projectName,
                  status: 'running',
                  progress: nextVal,
                  statusText: currentStatus,
                  logLine: `[STAGE] ${currentStatus}`
                }
              }));
            } catch (_) {}

            if (prev >= 94 && elapsedSeconds % 3 === 0 && prev < 98) {
              return prev + 1;
            }

            return nextVal;
          });
        }, 1000);
      } else {
        // Kaggle GPU Render: Single clean dispatch to notify bottom status dock immediately without competing local tickers
        try {
          window.dispatchEvent(new CustomEvent('render-status-update', {
            detail: {
              id: exportSessionId,
              jobId: exportSessionId,
              projectName,
              status: 'queued',
              progress: 5,
              statusText: '⚡ Dispatching to Kaggle Dual-T4 GPU...',
              logLine: `[KAGGLE-DISPATCH] Dispatching job for "${projectName}" to Kaggle Dual-T4 GPU...`
            }
          }));
        } catch (_) {}
      }

      const resp = await fetch('/api/editor/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortCtrl.signal
      });

      if (exportProgressTimerRef.current) {
        clearInterval(exportProgressTimerRef.current);
        exportProgressTimerRef.current = null;
      }

      const rawText = await resp.text();
      let result: any = null;
      try {
        result = JSON.parse(rawText);
      } catch (parseErr: any) {
        if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE') || rawText.includes('<!doctype') || rawText.includes('<html')) {
          // If server returned warmup page or gateway timeout, check if Kaggle job was actually registered!
          try {
            const checkRes = await fetch(`/api/kaggle/jobs?email=${encodeURIComponent(currentUserEmail || '')}`);
            if (checkRes.ok) {
              const kData = await checkRes.json();
              const recentJob = (kData.jobs || []).find((j: any) => 
                (j.projectName && j.projectName.toLowerCase().trim() === projectName.toLowerCase().trim()) &&
                (Date.now() - (j.createdAt || 0) < 60000)
              );
              if (recentJob) {
                setIsExporting(false);
                window.dispatchEvent(new CustomEvent('kaggle-render-dispatched', { detail: recentJob }));
                showToast("⚡ Dispatched to cloud render worker! Live tracking at bottom bar.", "success");
                return;
              }
            }
          } catch (_) {}
          throw new Error("Server gateway timeout or warming up. Please check GPU settings and retry.");
        }
        throw new Error(`Export response parse error: ${parseErr?.message || 'Invalid server JSON response'}`);
      }

      if (!resp.ok || !result || !result.ok) {
        throw new Error(result?.error || `Export failed with status ${resp.status}`);
      }

      // Check if this was dispatched to background execution (Kaggle or local server)
      if (result.ok && result.background) {
        const effectiveJobId = result.jobId || exportSessionId;
        exportSessionIdRef.current = effectiveJobId;
        const isKaggleBg = Boolean(result.useKaggle);
        setExportingProjectIds(prev => ({
          ...prev,
          [pid]: {
            ...prev[pid],
            isExporting: true,
            sessionId: effectiveJobId,
            projectName: result.projectName || projectName,
            progress: Math.max(prev[pid]?.progress || 10, result.progress || 10),
            statusText: result.statusText || result.message || (isKaggleBg ? '⚡ In Kaggle Queue...' : 'Standardizing clips...')
          }
        }));
        try {
          sessionStorage.setItem('active_export_task', JSON.stringify({
            id: effectiveJobId,
            jobId: effectiveJobId,
            projectId: pid,
            projectName: result.projectName || projectName,
            status: result.status || 'running',
            progress: result.progress || 10,
            statusText: result.statusText || result.message || (isKaggleBg ? '⏳ In Kaggle GPU Queue...' : '⚡ Rendering MP4...'),
            startedAt: Date.now()
          }));
          window.dispatchEvent(new CustomEvent('kaggle-render-dispatched', { detail: { ...result, jobId: effectiveJobId, projectId: pid } }));
        } catch (_) {}
        showToast(
          isKaggleBg
            ? "⚡ Dispatched to Kaggle Dual-T4 GPU! Live tracking at bottom bar."
            : "⚡ Studio Video Render started! Live tracking at bottom bar.",
          "success"
        );
        return;
      }

      if (!result.ok || !result.downloadUrl) {
        throw new Error(result.error || 'Server did not return a valid download URL');
      }

      // Export rendered successfully on server - jump to 100% and transition to ready state
      setExportingProjectIds(prev => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });

      if (result.db && setDb) {
        setDb(result.db);
      }

      const safeFilename = result.filename || `${(activeProject?.name || 'video_project').replace(/\s+/g, '_')}_hd.mp4`;

      try {
        window.dispatchEvent(new CustomEvent('render-status-update', {
          detail: {
            id: exportSessionId,
            projectName,
            status: 'completed',
            progress: 100,
            statusText: '🎉 Render Successful! MP4 Ready',
            downloadUrl: result.downloadUrl,
            filename: safeFilename,
            size: result.size,
            logLine: `⚡ Export completed successfully! Saved MP4 to ${safeFilename}`
          }
        }));
      } catch (_) {}

      setExportResult({
        downloadUrl: result.downloadUrl,
        filename: safeFilename,
        size: result.size,
        vid: result.vid,
        folder_id: result.folder_id,
        telegram_sent: Boolean(result.telegram_sent),
        generated_title: result.generated_title,
        generated_hashtags: result.generated_hashtags,
        share_caption: result.share_caption
      });

      // Automatically trigger robust download of complete file
      handleDownloadExportedVideo(result.downloadUrl, safeFilename);

      // Record last_used_at for all exported clips
      const usedVids = activeClips.map(c => c.vid).filter(Boolean);
      if (usedVids.length > 0 && onMarkClipsUsed) {
        onMarkClipsUsed(usedVids);
      }

      const mbSize = result.size ? ` (${(result.size / (1024 * 1024)).toFixed(1)} MB)` : '';
      const tgSuffix = result.telegram_sent ? ' & sent to Telegram' : '';
      showToast(`Export complete${tgSuffix}! HD MP4 ready${mbSize}`, "success");
    } catch (err: any) {
      if (err.name === 'AbortError' || abortCtrl.signal.aborted) {
        console.log("Export cancelled by user");
        return;
      }
      console.error("Export error:", err);
      setExportingProjectIds(prev => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      try {
        window.dispatchEvent(new CustomEvent('render-status-update', {
          detail: {
            id: exportSessionId,
            projectName,
            status: 'failed',
            progress: 0,
            statusText: `Export failed: ${err.message || 'Please check clips and retry'}`,
            error: err.message,
            logLine: `❌ Export error: ${err.message}`
          }
        }));
      } catch (_) {}
      showToast(`Export failed: ${err.message || 'Please check clips and retry'}`, "error");
    } finally {
      exportAbortControllerRef.current = null;
      if (exportProgressTimerRef.current) {
        clearInterval(exportProgressTimerRef.current);
        exportProgressTimerRef.current = null;
      }
    }
  };

  if (!isOpen) return null;

  // Dedicated "Create New Project" page when activeProject is null
  if (!activeProject) {
    if (initialProjectId) {
      return (
        <div className="fixed inset-0 z-[100] w-full h-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-150">
          <Loader2 size={36} className="animate-spin text-purple-400 mb-3" />
          <p className="text-sm font-bold text-gray-200">Opening project...</p>
        </div>
      );
    }

    return (
      <EditorEmptyProjectSetup
        masterBucketName={masterBucketName}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        handleCreateProject={handleCreateProject}
        handleSelectProject={handleSelectProject}
        projects={projects}
        pauseAllPlayback={pauseAllPlayback}
        onClose={onClose}
      />
    );
  }

  const selectedClip = activeClips[selectedTimelineClipIndex] || null;
  const selectedAudioClip = (selectedAudioClipIndex !== null && activeAudioClips[selectedAudioClipIndex]) ? activeAudioClips[selectedAudioClipIndex] : null;

  // Cloud Backup Handler for Active Project
  const [isSyncingActiveProjectCloud, setIsSyncingActiveProjectCloud] = useState(false);
  const handleCloudSyncActiveProject = useCallback(async () => {
    if (!activeProject) return;
    setIsSyncingActiveProjectCloud(true);
    showToast(`☁️ Backing up "${activeProject.name}" and clips to Cloud Storage...`, 'info');

    try {
      const clipItems = [...(activeClips || [])];
      for (const clip of clipItems) {
        const clipKey = normalizeClipKey(clip.file_id || clip.url || clip.vid || '');
        if (clipKey) {
          const localBlob = await getLocalClipBlob(clipKey);
          if (localBlob) {
            const formData = new FormData();
            formData.append('file', localBlob, `${clipKey}.mp4`);
            formData.append('folder_id', masterBucketFid || 'root');
            try {
              const res = await fetch('/api/upload', { method: 'POST', body: formData });
              if (res.ok) {
                const data = await res.json().catch(() => null);
                if (data?.file_id) {
                  clip.file_id = data.file_id;
                  clip.url = data.url || `/api/video/${data.file_id}`;
                }
              }
            } catch (_) {}
          }
        }
      }

      const now = Date.now();
      const updatedProj: VideoEditorProject = {
        ...activeProject,
        cloud_synced: true,
        cloud_synced_at: now,
        updated_at: now,
      };

      await fetch('/api/editor/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject.id, projectData: updatedProj })
      }).catch(() => {});

      if (setDb) {
        setDb(prev => prev ? ({
          ...prev,
          video_editor_projects: {
            ...(prev.video_editor_projects || {}),
            [activeProject.id]: updatedProj,
          }
        }) : prev);
      }

      showToast(`☁️ "${activeProject.name}" successfully backed up to Cloud Storage!`, 'success');
    } catch (err: any) {
      showToast(`Cloud backup note: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsSyncingActiveProjectCloud(false);
    }
  }, [activeProject, activeClips, masterBucketFid, setDb, showToast]);

  return (
    <div className="fixed inset-0 z-[100] w-full h-full bg-black text-white flex flex-col overflow-hidden select-none">
      {/* 1. TOP HEADER TOOLBAR */}
      <EditorHeader
        onClose={onClose}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        projectNameInput={projectNameInput}
        setProjectNameInput={setProjectNameInput}
        handleSaveRename={handleSaveRename}
        activeProject={activeProject}
        db={db}
        masterBucketFid={masterBucketFid}
        undoStack={undoStack}
        redoStack={redoStack}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        setHistoryFilterProjectId={setHistoryFilterProjectId}
        setShowInternalGenHistory={setShowInternalGenHistory}
        setExportResult={setExportResult}
        handleExportMergedVideo={handleExportMergedVideo}
        onOpenSettings={onOpenSettings}
        higgsfieldJobs={higgsfieldJobs}
        onOpenHiggsfieldTray={() => setIsHiggsfieldTrayOpen(prev => !prev)}
        isHiggsfieldTrayOpen={isHiggsfieldTrayOpen}
        higgsfieldCredits={higgsfieldCredits}
        onCloudSync={handleCloudSyncActiveProject}
        isSyncingCloud={isSyncingActiveProjectCloud}
      />


      {/* 2. BODY WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* MAIN VIDEO STAGE & SLIM CAPCUT TIMELINE STRIP */}
        <main className="flex-1 min-h-0 flex flex-col min-w-0 bg-black overflow-hidden relative">
          {/* 9:16 PREVIEW VIEWPORT & SWATCH COLUMNS */}
          <VideoPreviewStage
            videoViewportRef={videoViewportRef}
            activeProject={activeProject}
            activeClips={activeClips}
            currentPlayingClip={currentPlayingClip}
            currentClipIndex={currentClipIndex}
            previousClipIndex={previousClipIndex}
            isLoopingClip={isLoopingClip}
            loopClipIndex={loopClipIndex}
            loadedClipIds={loadedClipIds}
            videoElementsRef={videoElementsRef}
            clipBlobUrls={clipBlobUrls}
            getMemoryBlobUrl={getMemoryBlobUrl}
            config={config}
            getIsClipMuted={getIsClipMuted}
            applyVideoElementAudio={applyVideoElementAudio}
            handleSyncClipMetadataDuration={handleSyncClipMetadataDuration}
            timelineClipsMeta={timelineClipsMeta}
            syncAudioTracksToTime={syncAudioTracksToTime}
            handleActiveTimeUpdate={handleActiveTimeUpdate}
            handleVideoEnded={handleVideoEnded}
            togglePlayPause={togglePlayPause}
            isPlaying={isPlaying}
            showVerticalCenterGuide={showVerticalCenterGuide}
            showHorizontalCenterGuide={showHorizontalCenterGuide}
            activeCaptions={activeCaptions}
            isCaptionVisible={isCaptionVisible}
            selectedCaptionId={selectedCaptionId}
            setSelectedCaptionId={setSelectedCaptionId}
            handleOpenCaptionTemplateEditor={handleOpenCaptionTemplateEditor}
            handleCaptionPointerDown={handleCaptionPointerDown}
            handleCaptionContextMenu={handleCaptionContextMenu}
            handleCaptionCornerResizePointerDown={handleCaptionCornerResizePointerDown}
            handleCaptionWidthResizePointerDown={handleCaptionWidthResizePointerDown}
            lastCaptionTapRef={lastCaptionTapRef}
            captionContextMenu={captionContextMenu}
            setCaptionContextMenu={setCaptionContextMenu}
            handleSaveAsTemplate={handleSaveAsTemplate}
            handleUpdateCaption={handleUpdateCaption}
            setCaptionDefaults={setCaptionDefaults}
            captionDefaults={captionDefaults}
            masterBucketFid={masterBucketFid}
            captionTemplates={captionTemplates}
            handleUpdateTemplate={handleUpdateTemplate}
            handleDeleteCaption={handleDeleteCaption}
            showToast={showToast}
            starredAudios={starredAudios}
            activeAudioClips={activeAudioClips}
            getBucketAudioSettings={getBucketAudioSettings}
            updateProjectAudio={updateProjectAudio}
            handleReplaceAudioClip={handleReplaceAudioClip}
            availableCaptionTemplates={availableCaptionTemplates}
            selectedCaption={selectedCaption}
            handleToggleCaptionOnProject={handleToggleCaptionOnProject}
            openClipPicker={openClipPicker}
            setNewProjectName={setNewProjectName}
            setShowNewProjectModal={setShowNewProjectModal}
            projects={projects}
            clipAudioLongPressTimerRef={clipAudioLongPressTimerRef}
            clipAudioLongPressTriggeredRef={clipAudioLongPressTriggeredRef}
            setShowMuteAllClipsModal={setShowMuteAllClipsModal}
            handleToggleCurrentClipMute={handleToggleCurrentClipMute}
            setCaptionViewMode={setCaptionViewMode}
            setShowTextDrawer={setShowTextDrawer}
            onOpenAudioLibrary={() => setShowAudioLibrary(true)}
            higgsfieldJobs={higgsfieldJobs}
            onSelectHiggsfieldJobForReview={handleSelectHiggsfieldJobForReview}
            isHiggsfieldTrayOpen={isHiggsfieldTrayOpen}
            setIsHiggsfieldTrayOpen={setIsHiggsfieldTrayOpen}
            onOpenAiPromptMode={handleOpenAiPromptMode}
            onSwitchClipVariant={handleSwitchClipVariant}
            onSwitchVariantGroup={handleSwitchVariantGroup}
            onCreateVariantGroup={handleCreateVariantGroup}
            onUploadClipForConcept={handleUploadClipForConcept}
            onOpenVariantDrawer={(clipIdx) => {
              const target = typeof clipIdx === 'number' ? clipIdx : (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex);
              pauseAllPlayback();
              setVariantTargetClipIndex(target);
              setSelectedTimelineClipIndex(target);
              setCurrentClipIndex(target);
              setIsHiggsfieldTrayOpen(true);
            }}
            onSelectTimelineClip={handleSelectTimelineClip}
          />

          {/* 3. CAPCUT-STYLE PROFESSIONAL TIMELINE STRIP WITH FIXED CENTER PLAYHEAD */}
          {!isAiPromptMode && (
            <TimelineSection
                projectCurrentTime={projectCurrentTime}
                totalDuration={totalDuration}
                formatTimecode={formatTimecode}
                isPlaying={isPlaying}
                togglePlayPause={togglePlayPause}
                timelineZoom={timelineZoom}
                setTimelineZoom={setTimelineZoom}
                timelineTrackHeight={timelineTrackHeight}
                timelineTrackRef={timelineTrackRef}
                handleTimelineTrackScroll={handleTimelineTrackScroll}
                handleTimelineTouchStart={handleTimelineTouchStart}
                handleTimelineTouchMove={handleTimelineTouchMove}
                handleTimelineTouchEnd={handleTimelineTouchEnd}
                handleTimelineWheel={handleTimelineWheel}
                scrollDebounceTimerRef={scrollDebounceTimerRef}
                isUserScrubbingTrackRef={isUserScrubbingTrackRef}
                pauseAllPlayback={pauseAllPlayback}
                activeClips={activeClips}
                selectedTimelineClipIndex={selectedTimelineClipIndex}
                setSelectedTimelineClipIndex={setSelectedTimelineClipIndex}
                currentClipIndex={currentClipIndex}
                dragOverTargetIndex={dragOverTargetIndex}
                draggedClipIndex={draggedClipIndex}
                getClipEffectiveDuration={getClipEffectiveDuration}
                trimmingHandle={trimmingHandle}
                handleDragStartClip={handleDragStartClip}
                handleDragOverClip={handleDragOverClip}
                handleDropClip={handleDropClip}
                handleDragEndClip={handleDragEndClip}
                handleClipTouchStart={handleClipTouchStart}
                handleClipTouchMove={handleClipTouchMove}
                handleClipTouchEnd={handleClipTouchEnd}
                setSelectedAudioClipIndex={setSelectedAudioClipIndex}
                setSelectedCaptionId={setSelectedCaptionId}
                activeInlineControl={activeInlineControl}
                setActiveInlineControl={setActiveInlineControl}
                timelineClipsMeta={timelineClipsMeta}
                seekToProjectTime={seekToProjectTime}
                handleTrimPointerDown={handleTrimPointerDown}
                getIsClipMuted={getIsClipMuted}
                openClipPicker={openClipPicker}
                openClipPickerAt={openClipPickerAt}
                captionLayersSpans={captionLayersSpans}
                selectedCaptionId={selectedCaptionId}
                handleOpenCaptionTemplateEditor={handleOpenCaptionTemplateEditor}
                setCaptionViewMode={setCaptionViewMode}
                setShowTextDrawer={setShowTextDrawer}
                audioLayers={audioLayers}
                activeAudioClips={activeAudioClips}
                selectedAudioClipIndex={selectedAudioClipIndex}
                activeDraggingAudioId={activeDraggingAudioId}
                audioDragVisual={audioDragVisual}
                activeAudioOptionsIndex={activeAudioOptionsIndex}
                setActiveAudioOptionsIndex={setActiveAudioOptionsIndex}
                getAudioClipEffectiveDuration={getAudioClipEffectiveDuration}
                handleAudioClipPointerDown={handleAudioClipPointerDown}
                handleAudioTrimPointerDown={handleAudioTrimPointerDown}
                handleUpdateAudioVolume={handleUpdateAudioVolume}
                handleMoveAudioClipToLayer={handleMoveAudioClipToLayer}
                updateProjectAudioClips={updateProjectAudioClips}
                showToast={showToast}
                handleChopAudioClip={handleChopAudioClip}
                setAudioPickMode={setAudioPickMode}
                setShowAudioLibrary={setShowAudioLibrary}
                handleMoveAudioClip={handleMoveAudioClip}
                handleDuplicateAudioClip={handleDuplicateAudioClip}
                handleDeleteAudioClip={handleDeleteAudioClip}
                totalVideoClipsWidth={totalVideoClipsWidth}
                draggedAudioClipIndex={draggedAudioClipIndex}
                setDraggedAudioClipIndex={setDraggedAudioClipIndex}
                isLoopingClip={isLoopingClip}
                onToggleLoop={handleToggleLoopClip}
                onSelectTimelineClip={handleSelectTimelineClip}
                didScrubClipRef={didScrubClipRef}
                onSwitchClipVariant={handleSwitchClipVariant}
                onOpenVariantDrawer={(clipIdx) => {
                  const target = typeof clipIdx === 'number' ? clipIdx : (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex);
                  pauseAllPlayback();
                  setVariantTargetClipIndex(target);
                  setSelectedTimelineClipIndex(target);
                  setCurrentClipIndex(target);
                  setIsHiggsfieldTrayOpen(true);
                }}
                higgsfieldJobs={higgsfieldJobs}
              />
          )}

              {/* Conditional: When in AI Prompt Mode, render the prompt bar docked below the video editing strips */}
              {isAiPromptMode ? (
                <AiVideoPromptBar
                  selectedClip={activeClips[selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex] || selectedClip}
                  selectedClipIndex={selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex}
                  totalClipsCount={activeClips.length}
                  allClips={activeClips}
                  onSelectClipIndex={handleSelectClipInAiMode}
                  onSwitchVariant={handleSwitchClipVariant}
                  onClose={() => setIsAiPromptMode(false)}
                  onGenerate={handleTriggerAiGenerate}
                  isGenerating={isGeneratingAi}
                  higgsfieldCredits={higgsfieldCredits}
                  onOpenSettings={onOpenSettings}
                  showToast={showToast}
                />
              ) : (
                <>
                  {/* INLINE LIVE CONTROL STRIP (For Video Speed, Scale/Zoom, Trim, Audio Speed & Audio Volume) */}
                  <InlineLiveControlStrip
                activeInlineControl={activeInlineControl}
                setActiveInlineControl={setActiveInlineControl}
                selectedClip={selectedClip}
                selectedTimelineClipIndex={selectedTimelineClipIndex}
                selectedAudioClip={selectedAudioClip}
                selectedAudioClipIndex={selectedAudioClipIndex}
                handleResetClipTrim={handleResetClipTrim}
                handleAdjustTrim={handleAdjustTrim}
                handleSetTrimToPlayhead={handleSetTrimToPlayhead}
                handleUpdateClipSpeed={handleUpdateClipSpeed}
                handleUpdateClipScale={handleUpdateClipScale}
                handleUpdateAudioVolume={handleUpdateAudioVolume}
                handleUpdateAudioSpeed={handleUpdateAudioSpeed}
                isLoopingClip={isLoopingClip}
                loopClipIndex={loopClipIndex}
                onToggleLoop={handleToggleLoopClip}
                loopTrimTarget={loopTrimTarget}
                setLoopTrimTarget={setLoopTrimTarget}
                isPlaying={isPlaying}
                togglePlayPause={togglePlayPause}
                handleCombineClips={handleCombineClips}
                isCombiningClips={isCombiningClips}
                totalClipsCount={activeClips.length}
                handleAutoChopBoundary={handleAutoChopBoundary}
                isAnalyzingBoundary={isAnalyzingBoundary}
              />

              {/* 4. ANDROID-OPTIMIZED CAPCUT-STYLE BOTTOM TOOLBAR */}
              <EditorBottomToolbar
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                selectedAudioClip={selectedAudioClip}
                selectedAudioClipIndex={selectedAudioClipIndex}
                setSelectedAudioClipIndex={setSelectedAudioClipIndex}
                handleChopAudioClip={handleChopAudioClip}
                totalDuration={totalDuration}
                activeAudioClips={activeAudioClips}
                updateProjectAudioClips={updateProjectAudioClips}
                showToast={showToast}
                activeInlineControl={activeInlineControl}
                setActiveInlineControl={setActiveInlineControl}
                handleDuplicateAudioClip={handleDuplicateAudioClip}
                handleDeleteAudioClip={handleDeleteAudioClip}
                pauseAllPlayback={pauseAllPlayback}
                handleOpenCombineAudioModal={handleOpenCombineAudioModal}
                selectedCaptionId={selectedCaptionId}
                setSelectedCaptionId={setSelectedCaptionId}
                setCaptionViewMode={setCaptionViewMode}
                setShowTextDrawer={setShowTextDrawer}
                handleDuplicateClip={handleDuplicateClip}
                handleDeleteCaption={handleDeleteCaption}
                selectedTimelineClipIndex={selectedTimelineClipIndex}
                setSelectedTimelineClipIndex={setSelectedTimelineClipIndex}
                selectedClip={selectedClip}
                handleSplitSelectedClip={handleSplitSelectedClip}
                handleChopSelectedClip={handleChopSelectedClip}
                handleOpenChopStudio={handleOpenChopStudioModal}
                isChopping={isChopping}
                handleInitiateReplaceClip={handleInitiateReplaceClip}
                handleDeleteSelectedClip={handleDeleteSelectedClip}
                activeClips={activeClips}
                setShowClipPicker={setShowClipPicker}
                setShowAutoConfirmModal={setShowAutoConfirmModal}
                setAudioPickMode={setAudioPickMode}
                setShowAudioLibrary={setShowAudioLibrary}
                activeProject={activeProject}
                setTitleViewMode={setTitleViewMode}
                setShowTitleTemplateDrawer={setShowTitleTemplateDrawer}
                activeTitleTemplate={activeTitleTemplate}
                setShowGpuCpuConfirmModal={setShowGpuCpuConfirmModal}
                enableGpuEnhancement={enableGpuEnhancement}
                activeCaptions={activeCaptions}
                handleCombineClips={handleCombineClips}
                isCombiningClips={isCombiningClips}
                isLoopingClip={isLoopingClip}
                loopClipIndex={loopClipIndex}
                onToggleLoop={handleToggleLoopClip}
                onOpenAiPromptMode={handleOpenAiPromptMode}
                onSwitchClipVariant={handleSwitchClipVariant}
                onOpenVariantDrawer={(clipIdx) => {
                  const target = typeof clipIdx === 'number' ? clipIdx : (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex);
                  pauseAllPlayback();
                  setVariantTargetClipIndex(target);
                  setSelectedTimelineClipIndex(target);
                  setCurrentClipIndex(target);
                  setIsHiggsfieldTrayOpen(true);
                }}
                onDownloadActiveClips={handleDownloadAllActiveClips}
                isDownloadingClips={isDownloadingAllClips}
              />
            </>
          )}


          {/* Dedicated Separate Space for Bottom Render Status Bar (Zero overlap with toolbar buttons) */}
          {hasBottomRenderBar && (
            <div 
              className="w-full h-12 sm:h-14 pb-[env(safe-area-inset-bottom,0px)] shrink-0 bg-transparent pointer-events-none transition-all duration-200" 
              aria-hidden="true" 
            />
          )}
        </main>
      </div>

      {/* 4. FULLSCREEN IMMERSIVE BUCKET CLIP PICKER */}
      <ClipPickerModal
        isOpen={showClipPicker}
        initialTab={clipPickerInitialTab}
        onClose={() => {
          setShowClipPicker(false);
          createNewVariantGroupOnAddRef.current = false;
          setReplaceTargetClipIndex(null);
          setInsertTargetClipIndex(null);
          setVariantTargetClipIndex(null);
          setSelectedClipIdsInPicker([]);
          setClipPickerInitialTab('uploads');
        }}
        masterBucketName={masterBucketName}
        replaceTargetClipIndex={replaceTargetClipIndex}
        insertTargetClipIndex={insertTargetClipIndex}
        setInsertTargetClipIndex={setInsertTargetClipIndex}
        variantTargetClipIndex={variantTargetClipIndex}
        setVariantTargetClipIndex={setVariantTargetClipIndex}
        onTakeFullClip={handleTakeFullClip}
        onTakeSingleClip={handleTakeSingleClip}
        selectedClipIdsInPicker={selectedClipIdsInPicker}
        handleAddSelectedClipsToTimeline={handleAddSelectedClipsToTimeline}
        handleAutoReplaceFromBucket={handleAutoReplaceFromBucket}
        activePickerClips={activePickerClips}
        uploadDateGroups={uploadDateGroups}
        startPickerLongPress={startPickerLongPress}
        movePickerLongPress={movePickerLongPress}
        endPickerLongPress={endPickerLongPress}
        checkDidPickerLongPress={checkDidPickerLongPress}
        togglePickerClipSelection={togglePickerClipSelection}
        activeClips={activeClips}
        updateProjectClips={updateProjectClips}
        setSelectedTimelineClipIndex={setSelectedTimelineClipIndex}
        setCurrentClipIndex={setCurrentClipIndex}
        showToast={showToast}
        pickerUploadInputRef={pickerUploadInputRef}
        isUploadingClips={isUploadingClips}
        uploadClipsProgress={uploadClipsProgress}
        uploadClipsStats={uploadClipsStats}
        handleUploadVideosToMasterBucket={handleUploadVideosToMasterBucket}
        pickerActivePreview={pickerActivePreview}
        closePickerPreview={closePickerPreview}
        addedJobs={higgsfieldJobs}
        onAddAiJobToTimeline={handleAddToTimeline}
        onReplaceWithAiJob={handleDeleteAndReplace}
        db={db}
        activeProject={activeProject}
        onSwitchVariant={handleSwitchClipVariant}
        onDeleteClipVariant={handleDeleteClipVariant}
        onSwitchVariantGroup={handleSwitchVariantGroup}
        onCreateVariantGroup={handleCreateVariantGroup}
        onDeleteVariantGroup={handleDeleteVariantGroup}
        onDeleteSpecificClip={handleDeleteSpecificClip}
        onInitiateReplaceClip={handleInitiateReplaceClip}
        onOpenAiPromptMode={handleOpenAiPromptMode}
        onTrashJob={handleTrashGeneratedJob}
        onApplyTake={handleApplyTake}
        onReplaceKeepVariant={handleReplaceKeepVariant}
      />

      {/* 4B. CLIP VARIANT DRAWER (Alternate Takes Management) */}
      <ClipVariantDrawer
        isOpen={showVariantDrawer}
        onClose={() => {
          setShowVariantDrawer(false);
          setVariantTargetClipIndex(null);
        }}
        clip={activeClips[variantTargetClipIndex ?? (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex)] || null}
        clipIndex={variantTargetClipIndex ?? (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : currentClipIndex) ?? 0}
        jobs={higgsfieldJobs}
        onApplyTake={handleApplyTake}
        onOpenAiPromptMode={handleOpenAiPromptMode}
        onTrashJob={handleTrashGeneratedJob}
        onSwitchVariant={handleSwitchClipVariant}
        onDeleteVariant={handleDeleteClipVariant}
        onSwitchVariantGroup={handleSwitchVariantGroup}
        onCreateVariantGroup={handleCreateVariantGroup}
        onDeleteVariantGroup={handleDeleteVariantGroup}
        onCreateEmptyVariant={handleCreateEmptyVariant}
        onOpenVaultDrawer={() => setIsHiggsfieldTrayOpen(true)}
        onOpenUploadForVariant={(idx, asNewConcept = false) => {
          createNewVariantGroupOnAddRef.current = asNewConcept;
          setVariantTargetClipIndex(idx);
          variantUploadInputRef.current?.click();
        }}
        onOpenPickerForVariant={(idx, asNewConcept = false) => {
          createNewVariantGroupOnAddRef.current = asNewConcept;
          setShowVariantDrawer(false);
          openClipPickerForVariant(idx);
        }}
        isUploadingVariant={isUploadingVariantClip}
        showToast={showToast}
      />

      {/* IMPORT CLIPS FROM OTHER PROJECT MODAL */}
      <ImportProjectClipsModal
        isOpen={showProjectClipsImportModal}
        onClose={() => {
          setShowProjectClipsImportModal(false);
          setInsertTargetClipIndex(null);
          setReplaceTargetClipIndex(null);
        }}
        db={db}
        activeProject={activeProject}
        activeClips={activeClips}
        updateProjectClips={updateProjectClips}
        insertTargetClipIndex={insertTargetClipIndex}
        replaceTargetClipIndex={replaceTargetClipIndex}
        showToast={showToast}
        onTakeFullClip={handleTakeFullClip}
        onTakeVariantGroup={handleTakeVariantGroup}
        onTakeSingleClip={(singleClip) => {
          if (replaceTargetClipIndex !== null && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
            const updated = [...activeClips];
            updated[replaceTargetClipIndex] = singleClip;
            updateProjectClips(updated, true);
            showToast(`Replaced clip #${replaceTargetClipIndex + 1} with imported clip!`, 'success');
            setShowProjectClipsImportModal(false);
            setReplaceTargetClipIndex(null);
          } else if (insertTargetClipIndex !== null && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
            const updated = [...activeClips];
            updated.splice(insertTargetClipIndex, 0, singleClip);
            updateProjectClips(updated, true);
            showToast(`Inserted imported clip at position #${insertTargetClipIndex + 1}!`, 'success');
            setShowProjectClipsImportModal(false);
            setInsertTargetClipIndex(null);
          } else {
            const updated = [...activeClips, singleClip];
            updateProjectClips(updated, true);
            showToast('Added imported clip to timeline!', 'success');
            setShowProjectClipsImportModal(false);
          }
        }}
      />

      {/* 4C. REPLACE CLIP CHOICE MODAL */}
      {showReplaceChoiceModal && replaceChoiceTargetIndex !== null && (
        <div 
          className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowReplaceChoiceModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Replace Clip #{replaceChoiceTargetIndex + 1}</h3>
                  <p className="text-[11px] text-zinc-400">Choose source for replacement</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReplaceChoiceModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Option 1: Uploads Section */}
              <button
                type="button"
                onClick={() => {
                  const target = replaceChoiceTargetIndex;
                  setShowReplaceChoiceModal(false);
                  handleInitiateReplaceClipDirectly(target);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Film size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 transition">Uploads Section</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Choose from uploaded videos or gallery</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>

              {/* Option 2: Variant Section */}
              <button
                type="button"
                onClick={() => {
                  const target = replaceChoiceTargetIndex;
                  setShowReplaceChoiceModal(false);
                  pauseAllPlayback();
                  setVariantTargetClipIndex(target);
                  setSelectedTimelineClipIndex(target);
                  setCurrentClipIndex(target);
                  setIsHiggsfieldTrayOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Layers size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">Variant Section</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Switch to alternate take or concept</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>

              {/* Option 3: Import from Project */}
              <button
                type="button"
                onClick={() => {
                  const target = replaceChoiceTargetIndex;
                  setShowReplaceChoiceModal(false);
                  setReplaceTargetClipIndex(target);
                  setInsertTargetClipIndex(null);
                  setShowProjectClipsImportModal(true);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <FolderInput size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition">Import from Project</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Import clip from another project</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setShowReplaceChoiceModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 4D. ADD / INSERT CLIP OPTIONS MODAL (3 partitions: upload section, manual upload, other project + variant) */}
      {showAddClipChoiceModal && (
        <div 
          className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowAddClipChoiceModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                  <Plus size={18} className="stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {addClipChoiceTargetIndex !== null && addClipChoiceTargetIndex < activeClips.length
                      ? `Insert Clip at Position #${addClipChoiceTargetIndex + 1}`
                      : 'Add Video Clip'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">Choose how to add video to timeline</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClipChoiceModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-2 pt-1">
              {/* Option 1: Choose from Upload Section */}
              <button
                type="button"
                onClick={() => {
                  const target = addClipChoiceTargetIndex;
                  setShowAddClipChoiceModal(false);
                  openClipPickerDirectly(target);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Film size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-purple-300 transition">Upload Section</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Choose clips from library & uploads</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>

              {/* Option 2: Upload Clip Manually */}
              <button
                type="button"
                onClick={() => {
                  const target = addClipChoiceTargetIndex;
                  setShowAddClipChoiceModal(false);
                  setInsertTargetClipIndex(target);
                  setReplaceTargetClipIndex(null);
                  pickerUploadInputRef.current?.click();
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-indigo-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <UploadCloud size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition">Upload Clip Manually</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Select video file directly from device</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>

              {/* Option 3: Choose from Another Project */}
              <button
                type="button"
                onClick={() => {
                  const target = addClipChoiceTargetIndex;
                  setShowAddClipChoiceModal(false);
                  setInsertTargetClipIndex(target);
                  setReplaceTargetClipIndex(null);
                  setShowProjectClipsImportModal(true);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <FolderInput size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition">Choose from Other Project</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Import clip from another project</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>

              {/* Option 4: Variant Section */}
              <button
                type="button"
                onClick={() => {
                  const targetIdx = addClipChoiceTargetIndex !== null && addClipChoiceTargetIndex > 0
                    ? Math.min(addClipChoiceTargetIndex - 1, activeClips.length - 1)
                    : (selectedTimelineClipIndex !== null ? selectedTimelineClipIndex : 0);
                  setShowAddClipChoiceModal(false);
                  pauseAllPlayback();
                  setVariantTargetClipIndex(targetIdx);
                  setSelectedTimelineClipIndex(targetIdx);
                  setCurrentClipIndex(targetIdx);
                  setIsHiggsfieldTrayOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                  <Layers size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">Variant Section</div>
                  <div className="text-[10.5px] text-zinc-400 truncate">Alternate takes and concepts</div>
                </div>
                <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
              </button>
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => setShowAddClipChoiceModal(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input for uploading video directly as a variant */}
      <input
        ref={variantUploadInputRef}
        type="file"
        accept="video/*"
        multiple
        disabled={isUploadingVariantClip}
        onChange={handleUploadVideoAsVariant}
        className="hidden"
      />

      {/* 5. CREATE NEW PROJECT MODAL */}
      <EditorCreateProjectModal
        isOpen={showNewProjectModal}
        onClose={() => {
          setShowNewProjectModal(false);
          setNewProjectName('');
        }}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        handleCreateProject={handleCreateProject}
        activeProject={activeProject}
        projects={projects}
        pauseAllPlayback={pauseAllPlayback}
      />

      {/* 5B. COMBINE & MERGE AUDIO TRACKS MODAL */}
      <CombineAudioModal
        isOpen={showCombineAudioModal}
        onClose={() => setShowCombineAudioModal(false)}
        activeAudioClips={activeAudioClips}
        getAudioClipEffectiveDuration={getAudioClipEffectiveDuration}
        combineAudioName={combineAudioName}
        setCombineAudioName={setCombineAudioName}
        combineFolderId={combineFolderId}
        setCombineFolderId={setCombineFolderId}
        isCreatingNewCombineFolder={isCreatingNewCombineFolder}
        setIsCreatingNewCombineFolder={setIsCreatingNewCombineFolder}
        newCombineFolderName={newCombineFolderName}
        setNewCombineFolderName={setNewCombineFolderName}
        isCombiningAudios={isCombiningAudios}
        handleExecuteCombineAudios={handleExecuteCombineAudios}
        db={db}
      />

      {/* 5C. CHOP & SCENE CUT STUDIO MODAL */}
      <ChopStudioModal
        isOpen={showChopStudioModal}
        onClose={() => setShowChopStudioModal(false)}
        clip={getTargetClipForChop()?.clip || null}
        onExecuteChop={handleExecuteChopWithOptions}
        isChopping={isChopping}
      />

      {/* CONFIRMATION MODALS (Auto-Assemble, Mute All Clips, GPU/CPU Mode, Delete Template) */}
      <EditorConfirmDialogs
        showAutoConfirmModal={showAutoConfirmModal}
        setShowAutoConfirmModal={setShowAutoConfirmModal}
        handleAutoSelect={handleAutoSelect}
        showMuteAllClipsModal={showMuteAllClipsModal}
        setShowMuteAllClipsModal={setShowMuteAllClipsModal}
        activeClips={activeClips}
        handleMuteAllClips={handleMuteAllClips}
        showGpuCpuConfirmModal={showGpuCpuConfirmModal}
        setShowGpuCpuConfirmModal={setShowGpuCpuConfirmModal}
        enableGpuEnhancement={enableGpuEnhancement}
        setEnableGpuEnhancement={setEnableGpuEnhancement}
        setEnableProteusUpscale={setEnableProteusUpscale}
        showToast={showToast}
        deleteConfirmDialog={deleteConfirmDialog}
        setDeleteConfirmDialog={setDeleteConfirmDialog}
        handleExecuteDeleteTitleTemplate={handleExecuteDeleteTitleTemplate}
        handleDeleteTemplate={handleDeleteTemplate}
        captionViewMode={captionViewMode}
        setCaptionViewMode={setCaptionViewMode}
        setEditingTemplate={setEditingTemplate}
      />

      {/* 6. EXPORT MERGE MODAL */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        activeClips={activeClips}
        totalDuration={totalDuration}
        isExporting={isExporting}
        exportProgress={exportProgress}
        exportStatusText={exportStatusText}
        exportResult={exportResult}
        setExportResult={setExportResult}
        handleCancelExport={handleCancelExport}
        handleExportMergedVideo={handleExportMergedVideo}
        handleExportOnDevice={handleExportOnDevice}
        renderEngine={renderEngine}
        setRenderEngine={setRenderEngine}
        handleDownloadExportedVideo={handleDownloadExportedVideo}
        isDownloadingBlob={isDownloadingBlob}
        isSendingToTelegram={isSendingToTelegram}
        handleSendExportResultToTelegram={handleSendExportResultToTelegram}
        telegramFeedback={telegramFeedback}
        activeProject={activeProject}
        testTitleResult={testTitleResult}
        db={db}
        setSocialShareVideoTarget={setSocialShareVideoTarget}
        setShowInternalGenHistory={setShowInternalGenHistory}
        showToast={showToast}
        useKaggleGpu={useKaggleGpu}
        setUseKaggleGpu={setUseKaggleGpu}
        enableGpuEnhancement={enableGpuEnhancement}
        setEnableGpuEnhancement={setEnableGpuEnhancement}
        setEnableProteusUpscale={setEnableProteusUpscale}
      />

      {/* 8. ADVANCED CAPTION STUDIO PAGE */}
      <CaptionStudioModal
        isOpen={showTextDrawer}
        onClose={() => setShowTextDrawer(false)}
        captionViewMode={captionViewMode}
        setCaptionViewMode={setCaptionViewMode}
        editingTemplate={editingTemplate}
        setEditingTemplate={setEditingTemplate}
        masterBucketName={masterBucketName}
        setDeleteConfirmDialog={setDeleteConfirmDialog}
        setImportModalType={setImportModalType}
        availableCaptionTemplates={availableCaptionTemplates}
        activeCaptions={activeCaptions}
        captionTemplates={captionTemplates}
        handleOpenTemplateSettings={handleOpenTemplateSettings}
        handleToggleCaptionOnProject={handleToggleCaptionOnProject}
        handleToggleTemplateMode={handleToggleTemplateMode}
        formatTemplateRuleDisplay={formatTemplateRuleDisplay}
        hiddenCaptionTemplates={hiddenCaptionTemplates}
        handleToggleHideCaptionForProject={handleToggleHideCaptionForProject}
        captionDefaults={captionDefaults}
        activeProject={activeProject}
        projectHiddenCaptionIds={projectHiddenCaptionIds}
        templateProjectActive={templateProjectActive}
        setTemplateProjectActive={setTemplateProjectActive}
        handleSaveTemplateSettings={handleSaveTemplateSettings}
        showNewCaptionPrompt={showNewCaptionPrompt}
        setShowNewCaptionPrompt={setShowNewCaptionPrompt}
        newCaptionPromptText={newCaptionPromptText}
        setNewCaptionPromptText={setNewCaptionPromptText}
        newCaptionMode={newCaptionMode}
        setNewCaptionMode={setNewCaptionMode}
        showToast={showToast}
      />

      {/* AUDIO LIBRARY MODAL (Drawer / Modal for adding, managing, starring, and selecting audio tracks) */}
      <AudioLibraryModal
        isOpen={showAudioLibrary}
        onClose={() => setShowAudioLibrary(false)}
        db={db}
        setDb={setDb}
        showToast={showToast}
        masterBucketFid={masterBucketFid}
        masterBucketName={masterBucketName}
        currentUserEmail={currentUserEmail}
        isAdmin={isAdmin}
        usersList={usersList}
        selectedAudioId={activeProject?.audio_id}
        activeProject={activeProject}
        onSaveProject={(updatedProj) => {
          setActiveProject(updatedProj);
          onSaveProject(updatedProj);
        }}
        onSelectAudio={(audio) => {
          if (audioPickMode?.mode === 'replace' && audioPickMode.clipIndex !== undefined) {
            handleReplaceAudioClip(audioPickMode.clipIndex, audio);
          } else {
            handleAddAudioClip(audio, audioPickMode?.targetLayer);
          }
          setAudioPickMode(null);
          setShowAudioLibrary(false);
        }}
      />

      {/* 6. MASTER BUCKET AI TITLE & HASHTAG TEMPLATES PAGE */}
      <AiTitleStudioModal
        isOpen={showTitleTemplateDrawer}
        onClose={() => setShowTitleTemplateDrawer(false)}
        titleViewMode={titleViewMode}
        setTitleViewMode={setTitleViewMode}
        editingTitleName={editingTitleName}
        setEditingTitleName={setEditingTitleName}
        editingTitlePrompt={editingTitlePrompt}
        setEditingTitlePrompt={setEditingTitlePrompt}
        isPromptSaved={isPromptSaved}
        setIsPromptSaved={setIsPromptSaved}
        masterBucketName={masterBucketName}
        selectedTitleTemplateId={selectedTitleTemplateId}
        titleTemplates={titleTemplates}
        activeProject={activeProject}
        activeTitleTemplate={activeTitleTemplate}
        handleSaveCurrentPromptDetail={handleSaveCurrentPromptDetail}
        handleStarTitleTemplateForProject={handleStarTitleTemplateForProject}
        handleDeleteTitleTemplate={handleDeleteTitleTemplate}
        setImportModalType={setImportModalType}
        handleOpenTitleTemplateDetail={handleOpenTitleTemplateDetail}
        handleAddNewTitleTemplate={handleAddNewTitleTemplate}
        handleExecuteTemplateOnProject={handleExecuteTemplateOnProject}
        isTestingTitleGen={isTestingTitleGen}
        handleRetryCurrentPrompt={handleRetryCurrentPrompt}
        displayTitle={displayTitle}
        displayHashtags={displayHashtags}
        titleCopiedType={titleCopiedType}
        setTitleCopiedType={setTitleCopiedType}
        showToast={showToast}
        onUpdateGeneratedContent={handleUpdateGeneratedContent}
      />

      {/* 7. SOCIAL MEDIA SHARE MODAL */}
      {socialShareVideoTarget && (
        <SocialShareModal
          isOpen={Boolean(socialShareVideoTarget)}
          onClose={() => setSocialShareVideoTarget(null)}
          video={socialShareVideoTarget.video}
          videoUrl={socialShareVideoTarget.url}
          title={socialShareVideoTarget.title}
          hashtags={socialShareVideoTarget.hashtags}
          caption={socialShareVideoTarget.caption}
          onShared={async (v, plat) => {
            const vid = v.id || (v as any).vid || v.file_id;
            if (vid) {
              await fetch('/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'mark_video_shared',
                  payload: {
                    vid,
                    platform: plat,
                    share_text: socialShareVideoTarget.caption
                  }
                })
              });
              if (setDb) {
                setDb(prev => {
                  if (!prev || !prev.videos) return prev;
                  const vObj = prev.videos[vid] || Object.values(prev.videos).find((x: any) => x.file_id === vid || x.id === vid);
                  if (!vObj) return prev;
                  const existingPlats = (vObj as any).shared_platforms || [];
                  const newPlats = Array.from(new Set([...existingPlats, plat]));
                  return {
                    ...prev,
                    videos: {
                      ...prev.videos,
                      [vObj.id || vid]: {
                        ...vObj,
                        is_shared: true,
                        shared: true,
                        shared_platforms: newPlats,
                        last_shared_at: Date.now()
                      }
                    }
                  };
                });
              }
            }
          }}
          onToast={showToast}
        />
      )}
      {/* EXPORT GENERATION HISTORY MODAL */}
      {showInternalGenHistory && db && (
        <ExportGenerationHistoryModal
          isOpen={showInternalGenHistory}
          onClose={() => {
            setShowInternalGenHistory(false);
            setHistoryFilterProjectId(null);
          }}
          db={db}
          setDb={setDb}
          activeMasterFid={masterBucketFid}
          editorMode={editorMode}
          initialProjectId={historyFilterProjectId || activeProject?.id}
          onOpenProject={(projId) => {
            const p = (db?.video_editor_projects && db.video_editor_projects[projId]) ||
                      projects.find(item => item.id === projId);
            if (p) {
              handleSelectProject(p);
              setShowInternalGenHistory(false);
            }
          }}
        />
      )}

      {/* IMPORT / TRANSFER MODAL FOR CAPTION, AUDIO & TITLE TEMPLATES */}
      {importModalType && (
        <ImportProjectModal
          isOpen={Boolean(importModalType)}
          onClose={() => setImportModalType(null)}
          sectionType={importModalType}
          currentProjectId={activeProject?.id}
          currentMasterBucketFid={masterBucketFid}
          currentProjectName={activeProject?.name}
          db={db}
          onImport={handleImportFromProject}
          showToast={showToast}
        />
      )}

      {/* BUCKET SETTINGS MODAL (ORIENTATION & FREEZE BUCKET) */}
      {showBucketSettingsModal && (
        <BucketSettingsModal
          isOpen={showBucketSettingsModal}
          onClose={() => setShowBucketSettingsModal(false)}
          masterBucketFid={masterBucketFid}
          masterBucketName={masterBucketName || 'Master Bucket'}
          editorMode={editorMode}
          buckets={orderedMasterBuckets}
          currentOrder={activeProject?.bucket_order || db?.master_bucket_settings?.[masterBucketFid]?.bucket_order || []}
          frozenBucketIds={activeProject?.frozen_bucket_ids || []}
          onSave={(newOrder, newFrozenBucketIds) => {
            if (activeProject) {
              const updated: VideoEditorProject = {
                ...activeProject,
                bucket_order: newOrder,
                frozen_bucket_ids: newFrozenBucketIds,
                updated_at: Date.now()
              };
              setActiveProject(updated);
              onSaveProject(updated);
              showToast("Updated bucket orientation & freeze settings!", "success");
            }
          }}
          showToast={showToast}
        />
      )}

      {/* IMPORT BUCKET SETTINGS MODAL (ISOLATED TO SAME MASTER BUCKET) */}
      {showImportBucketSettingsModal && db && (
        <ImportBucketSettingsModal
          isOpen={showImportBucketSettingsModal}
          onClose={() => setShowImportBucketSettingsModal(false)}
          currentProjectId={activeProject?.id}
          currentProjectName={activeProject?.name}
          currentMasterBucketFid={masterBucketFid}
          currentMasterBucketName={masterBucketName || 'Master Bucket'}
          db={db}
          onImportSettings={(sourceProject, options) => {
            handleImportBucketSettings(sourceProject, options);
          }}
          showToast={showToast}
        />
      )}

      {/* HIGGSFIELD FLUX VIDEO EDIT 3.0 REVIEW MODAL */}
      <GeneratedClipReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingJob(null);
        }}
        job={reviewingJob}
        targetClip={reviewingJob ? activeClips[reviewingJob.clipIndex ?? selectedTimelineClipIndex ?? 0] || null : null}
        targetClipIndex={reviewingJob?.clipIndex ?? selectedTimelineClipIndex ?? 0}
        onTrash={handleTrashGeneratedJob}
        onDeleteAndReplace={handleDeleteAndReplace}
        onReplaceKeepVariant={handleReplaceKeepVariant}
        onDirectlySave={handleDirectlySave}
      />

      {/* DEDICATED OUTSIDE AI VIDEO DRAWER (APPEARS ON COMPLETE DIFFERENT LAYER/PAGE ONLY WHEN CLICKED) */}
      <OutsideAiVideoDrawer
        isOpen={isHiggsfieldTrayOpen}
        onClose={() => setIsHiggsfieldTrayOpen(false)}
        jobs={higgsfieldJobs}
        activeClips={activeClips}
        onSelectJobForReview={handleSelectHiggsfieldJobForReview}
        onOpenAiPromptMode={handleOpenAiPromptMode}
        onTrashJob={handleTrashGeneratedJob}
        onRestoreJob={handleRestoreGeneratedJob}
        onDeleteAndReplace={handleDeleteAndReplace}
        onReplaceKeepVariant={handleReplaceKeepVariant}
        onAddToTimeline={handleAddToTimeline}
        onDirectlySave={handleDirectlySave}
        onApplyTake={handleApplyTake}
        onSwitchVariant={handleSwitchClipVariant}
        onSwitchVariantGroup={handleSwitchVariantGroup}
        onCreateVariantGroup={handleCreateVariantGroup}
        onDeleteVariantGroup={handleDeleteVariantGroup}
        onDeleteClipVariant={handleDeleteClipVariant}
        onDeleteSpecificClip={handleDeleteSpecificClip}
        onInitiateReplaceClip={handleInitiateReplaceClip}
        onSelectClipIndex={handleSelectClipFromClipsDrawer}
        targetClipIndex={selectedTimelineClipIndex ?? currentClipIndex}
        totalClipsCount={activeClips.length}
        db={db}
        activeProject={activeProject}
        masterBucketName={masterBucketName}
        updateProjectClips={updateProjectClips}
        showToast={showToast}
        onOpenPickerForVariant={(idx) => {
          setIsHiggsfieldTrayOpen(false);
          openClipPickerForVariant(idx);
        }}
        onTakeFullClip={handleTakeFullClip}
        onTakeSingleClip={handleTakeSingleClip}
        onTakeVariantGroup={handleTakeVariantGroup}
      />
    </div>
  );
};
