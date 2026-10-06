import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ExportHistoryVideoCard } from './export-history';
import { 
  Film, Check, 
  X, Volume2, VolumeX, AlertCircle,
  ChevronLeft, ChevronRight, Calendar, CheckCircle2,
  ChevronDown, Folder, Layers, Search
} from 'lucide-react';
import { DB, VideoData, isAnyBucket, DEFAULT_ADMINS } from '../types';

// Authentic Social Media Brand Icons
export const InstagramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="ig-grad" x1="2" y1="21" x2="22" y2="3" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f09433" />
        <stop offset="25%" stopColor="#e6683c" />
        <stop offset="50%" stopColor="#dc2743" />
        <stop offset="75%" stopColor="#cc2366" />
        <stop offset="100%" stopColor="#bc1888" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
  </svg>
);

export const FacebookIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#1877F2" />
    <path d="M14.5 12.5H12V20H9V12.5H7.5V9.5H9V7.8C9 6.2 9.9 5 12.2 5H14.5V8H13C12.4 8 12 8.4 12 9V9.5H14.8L14.5 12.5Z" fill="white" />
  </svg>
);

export const WhatsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#25D366" />
    <path d="M18 11.9c0 3.3-2.7 6-6 6-1 0-2-.3-2.9-.8L6 18l.9-3c-.6-.9-.9-2-.9-3.1 0-3.3 2.7-6 6-6s6 2.7 6 6z" fill="white" />
    <path d="M15.2 13.7c-.2-.1-1.1-.5-1.3-.6-.2-.1-.3-.1-.4.1-.1.2-.5.6-.6.8-.1.1-.2.2-.4.1-.2-.1-.8-.3-1.6-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3 0-.1 0-.2-.1-.3-.1-.1-.4-1-.6-1.4-.2-.4-.3-.3-.4-.3h-.4c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 3.9 3.5.5.2 1 .4 1.3.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z" fill="#25D366" />
  </svg>
);

export const TelegramIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="24" height="24" rx="5" fill="#229ED9" />
    <path d="M18.5 6.5L4.8 11.8C3.9 12.2 3.9 12.7 4.6 12.9L8.1 14L16.2 8.9C16.6 8.6 17 8.8 16.7 9.1L10.1 15.1H10.1L9.9 18.2C10.2 18.2 10.4 18.1 10.6 17.9L12.5 16.1L16.4 19C17.1 19.4 17.6 19.2 17.8 18.3L20.3 7.5C20.6 6.3 19.8 5.7 18.5 6.5Z" fill="white" />
  </svg>
);

interface DayGroup {
  dateKey: string;
  displayTitle: string;
  subTitle: string;
  dayStartMs: number;
  videos: VideoData[];
}

interface ExportGenerationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DB;
  setDb?: React.Dispatch<React.SetStateAction<DB | null>>;
  activeMasterFid?: string | null;
  editorMode?: 'general' | 'ai';
  initialProjectId?: string | null;
  onNavigateToFolder?: (folderId: string) => void;
  onPlayVideo?: (fileId: string) => void;
  onOpenProject?: (projectId: string, masterBucketFid?: string, mode?: 'general' | 'ai') => void;
  currentUserEmail?: string;
  isAdmin?: boolean;
}

export const ExportGenerationHistoryModal: React.FC<ExportGenerationHistoryModalProps> = ({
  isOpen,
  onClose,
  db,
  setDb,
  activeMasterFid,
  editorMode = 'general',
  initialProjectId,
  currentUserEmail,
  isAdmin = false
}) => {
  // Local reactive copy of DB
  const [localDb, setLocalDb] = useState<DB>(db);
  useEffect(() => {
    if (db) setLocalDb(db);
  }, [db]);

  // Project selector state & dropdown
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  // Master bucket filters
  const [selectedMasterFid, setSelectedMasterFid] = useState<string>('all');
  const prevIsOpenRef = useRef(false);

  // Playback & Sound
  const [playingVidId, setPlayingVidId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dayRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Active clip index tracked per day group: dateKey -> activeIndex
  const [activeClipIndexByDay, setActiveClipIndexByDay] = useState<Record<string, number>>({});

  // Prefetched files for instant native mobile OS share driver
  const prefetchedFiles = useRef<Map<string, File>>(new Map());

  // Deleted clips tracking
  const [deletedClipIds, setDeletedClipIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('deleted_export_history_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track videos explicitly sent to Telegram Bot
  const [telegramBotSentIds, setTelegramBotSentIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('studio_telegram_bot_sent_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Track platform shares per video (Instagram, Facebook, WhatsApp, Telegram)
  const [sharedPlatformsMap, setSharedPlatformsMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('studio_video_platform_shares');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [sendingTgVid, setSendingTgVid] = useState<string | null>(null);
  const [downloadingVid, setDownloadingVid] = useState<string | null>(null);
  const [deletingVid, setDeletingVid] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 2500);
  }, []);

  // Helper to determine if folder is a Master Bucket
  const isMasterBucket = useCallback((folderId: string): boolean => {
    if (!localDb?.folders || folderId === 'root') return false;
    const subfolders = Object.entries(localDb.folders).filter(
      ([id, f]) => f.parent === folderId && !localDb.deleted_folders?.[id]
    );
    return subfolders.length > 0 && subfolders.some(([_, f]) => isAnyBucket(f.name, f));
  }, [localDb]);

  // Collect and deduplicate all videos, clips, and exported renders
  const allVideos = useMemo(() => {
    if (!localDb) return [];

    const list: VideoData[] = [];
    const seen = new Set<string>();

    // Helper to resolve project and bucket for a video if missing
    const resolveProjectForVideo = (rawV: any, vid: string) => {
      const vId = rawV.id || vid;
      const fileId = rawV.file_id || '';
      const url = rawV.url || rawV.download_url || '';
      const name = (rawV.name || '').toLowerCase();

      for (const [pId, p] of Object.entries(localDb?.video_editor_projects || {})) {
        if (!p) continue;
        const pObj = p as any;
        if (Array.isArray(pObj.generation_history)) {
          const match = pObj.generation_history.some((h: any) => 
            h.id === vId || h.job_id === vId || h.id === fileId || h.job_id === fileId ||
            (h.video_url && url && h.video_url === url) ||
            (h.filename && name && h.filename.toLowerCase() === name)
          );
          if (match) return { projectId: pId, projectName: pObj.name, masterBucketFid: pObj.master_bucket_fid, ownerId: pObj.ownerId || pObj.createdBy };
        }
        if (Array.isArray(pObj.clips)) {
          if (pObj.clips.some((c: any) => c.vid === vId || c.file_id === fileId || c.id === vId)) {
            return { projectId: pId, projectName: pObj.name, masterBucketFid: pObj.master_bucket_fid, ownerId: pObj.ownerId || pObj.createdBy };
          }
        }
        const pName = (pObj.name || '').trim().toLowerCase();
        if (pName && name && (name.includes(pName) || name.startsWith(pName))) {
          return { projectId: pId, projectName: pObj.name, masterBucketFid: pObj.master_bucket_fid, ownerId: pObj.ownerId || pObj.createdBy };
        }
      }
      return { projectId: null, projectName: null, masterBucketFid: null, ownerId: null };
    };

    // 1. Genuine exported/rendered videos from localDb.videos
    Object.entries(localDb.videos || {}).forEach(([vid, rawV]: [string, any]) => {
      if (!rawV) return;
      if (localDb.deleted_videos?.[vid] || (rawV.id && localDb.deleted_videos?.[rawV.id])) return;
      if (deletedClipIds.has(vid) || (rawV.id && deletedClipIds.has(rawV.id))) return;

      const urlStr = String(rawV.url || rawV.download_url || rawV.downloadUrl || '');
      const fileIdStr = String(rawV.file_id || rawV.id || vid || '');
      const nameStr = String(rawV.name || '');

      const isExport = Boolean(
        rawV.is_exported || 
        rawV.is_export_video || 
        rawV.folder_id === 'export_history' || 
        rawV.folder_id === 'exports' || 
        vid.startsWith('vid_exp_') || 
        fileIdStr.startsWith('vid_exp_') ||
        fileIdStr.startsWith('job_render_') ||
        fileIdStr.includes('job_render_') ||
        urlStr.includes('/api/merged_video/') ||
        urlStr.includes('/renders/') ||
        urlStr.includes('job_render_') ||
        nameStr.toLowerCase().endsWith('_master.mp4') ||
        rawV.rendered_by || 
        rawV.kaggle_gpu
      );

      if (!isExport) return;

      const resolvedMeta = resolveProjectForVideo(rawV, vid);
      const effectivePid = rawV.project_id || rawV.projectId || resolvedMeta.projectId;
      const effectivePName = rawV.project_name || rawV.source_name || resolvedMeta.projectName;
      const effectiveMbFid = rawV.master_bucket_fid || resolvedMeta.masterBucketFid || (rawV.folder_id !== 'root' && rawV.folder_id !== 'exports' ? rawV.folder_id : null);
      const effectiveOwner = (rawV.currentUserEmail || rawV.ownerId || rawV.createdBy || rawV.userEmail || resolvedMeta.ownerId || '').toLowerCase().trim();

      // User isolation: Users see their exported videos, admins see all
      if (currentUserEmail) {
        const u = currentUserEmail.toLowerCase().trim();
        const isAdminUser = isAdmin || DEFAULT_ADMINS.includes(u);
        const isOwnerAdmin = effectiveOwner && DEFAULT_ADMINS.includes(effectiveOwner);

        if (isAdminUser) {
          // Allow admin access
        } else if (effectiveOwner) {
          if (effectiveOwner !== u && !isOwnerAdmin) return;
        }
      }

      const vId = rawV.id || vid;
      const fileId = rawV.file_id || rawV.telegram_file_id || vId;
      const streamUrl = rawV.download_url || rawV.downloadUrl || rawV.url || (fileIdStr ? `/api/merged_video/${fileIdStr}.mp4` : '');
      const dedupeKey = rawV.telegram_file_id || rawV.file_id || rawV.name || vId;

      if (!seen.has(dedupeKey) && !seen.has(vId) && !seen.has(fileId)) {
        seen.add(dedupeKey);
        if (rawV.name) {
          seen.add(rawV.name);
          seen.add(String(rawV.name).trim().toLowerCase());
        }
        if (vId) seen.add(vId);
        if (vid) seen.add(vid);
        if (fileId) seen.add(fileId);
        if (fileIdStr) seen.add(fileIdStr);
        if (streamUrl) seen.add(streamUrl);

        const isAi = Boolean(
          rawV.editor_mode === 'ai' || 
          rawV.is_ai_generated || 
          (rawV.folder_id && localDb.folders?.[rawV.folder_id]?.name?.startsWith('AI'))
        );

        list.push({
          ...rawV,
          id: vId,
          vid: vId,
          file_id: fileId,
          name: rawV.source_name || rawV.name || rawV.title || 'Untitled Video',
          folder_id: rawV.folder_id || 'exports',
          master_bucket_fid: effectiveMbFid,
          project_id: effectivePid,
          project_name: effectivePName,
          url: streamUrl,
          download_url: streamUrl,
          editor_mode: isAi ? 'ai' : 'general',
          created_at: rawV.created_at || rawV.last_modified || rawV.updated_at || Date.now(),
          is_exported: true,
          is_export_video: true,
          telegram_bot_sent: Boolean(rawV.telegram_bot_sent),
          telegram_sent: Boolean(rawV.telegram_bot_sent)
        } as any);
      }
    });

    // 2. Synthesize completed jobs from project.generation_history and kaggle_jobs
    const allPendingJobs: any[] = [];
    
    // 2a. From project generation_history
    Object.entries(localDb.video_editor_projects || {}).forEach(([pId, proj]: [string, any]) => {
      if (!proj || !Array.isArray(proj.generation_history)) return;
      proj.generation_history.forEach((h: any) => {
        if (!h || h.status === 'failed') return;
        allPendingJobs.push({
          ...h,
          projectId: pId,
          projectName: proj.name,
          masterBucketFid: proj.master_bucket_fid,
          ownerId: proj.ownerId || proj.createdBy
        });
      });
    });

    // 2b. From kaggle_jobs and jobs
    Object.values(localDb.kaggle_jobs || {}).forEach((j: any) => {
      if (j && j.status === 'completed') allPendingJobs.push(j);
    });
    if ((localDb as any).jobs) {
      Object.values((localDb as any).jobs).forEach((j: any) => {
        if (j && j.status === 'completed') allPendingJobs.push(j);
      });
    }

    allPendingJobs.forEach((job: any) => {
      const jId = job.job_id || job.id || job.jobId;
      if (!jId) return;
      const jobVid = job.vid || `vid_exp_${jId}`;
      const normJobName = (job.filename || '').trim().toLowerCase();

      if (
        seen.has(jId) ||
        seen.has(jobVid) ||
        (job.filename && seen.has(job.filename)) ||
        (normJobName && seen.has(normJobName)) ||
        (job.video_url && seen.has(job.video_url)) ||
        (job.downloadUrl && seen.has(job.downloadUrl)) ||
        (job.telegramFileId && seen.has(job.telegramFileId))
      ) {
        return;
      }

      if (
        deletedClipIds.has(jId) ||
        deletedClipIds.has(jobVid) ||
        (job.filename && deletedClipIds.has(job.filename)) ||
        (job.telegramFileId && deletedClipIds.has(job.telegramFileId))
      ) {
        return;
      }

      const effectiveStreamUrl = job.video_url || job.downloadUrl || (job.telegramFileId ? `/api/video/${job.telegramFileId}` : `/api/merged_video/${job.filename || `${jId}.mp4`}`);
      if (!effectiveStreamUrl) return;

      seen.add(jId);
      seen.add(jobVid);
      if (job.filename) seen.add(job.filename);
      if (normJobName) seen.add(normJobName);
      if (effectiveStreamUrl) seen.add(effectiveStreamUrl);

      list.push({
        id: jobVid,
        vid: jobVid,
        file_id: job.telegramFileId || jId,
        telegram_file_id: job.telegramFileId || job.telegram_file_id,
        name: job.filename || `${job.projectName || job.project_name || 'Untitled Video'}.mp4`,
        source_name: job.projectName || job.project_name,
        folder_id: 'exports',
        master_bucket_fid: job.masterBucketFid || job.master_bucket_fid,
        url: effectiveStreamUrl,
        download_url: effectiveStreamUrl,
        size: job.size || 0,
        duration: job.duration || 10,
        created_at: job.completed_at || job.completedAt || job.createdAt || job.created_at || Date.now(),
        is_exported: true,
        is_export_video: true,
        project_id: job.projectId || job.project_id || null,
        project_name: job.projectName || job.project_name || null,
        editor_mode: job.editorMode || job.mode || 'general',
        telegram_bot_sent: Boolean(job.telegram_bot_sent),
        telegram_sent: Boolean(job.telegram_bot_sent)
      } as any);
    });

    // Sort newest first
    return list.sort((a: any, b: any) => {
      const timeA = a.created_at || a.last_modified || a.exported_at || a.timestamp || 0;
      const timeB = b.created_at || b.last_modified || b.exported_at || b.timestamp || 0;
      return timeB - timeA;
    });
  }, [localDb, deletedClipIds, isAdmin, currentUserEmail]);

  // Collect all projects sorted by most recent first
  const allProjectsList = useMemo(() => {
    if (!localDb?.video_editor_projects) return [];
    const list = Object.values(localDb.video_editor_projects).filter(Boolean);
    return list.sort((a, b) => {
      const timeA = a.updated_at || a.created_at || 0;
      const timeB = b.updated_at || b.created_at || 0;
      return timeB - timeA;
    });
  }, [localDb]);

  // Check if a video belongs to a project
  const doesVideoMatchProject = useCallback((v: any, targetProjId: string) => {
    if (targetProjId === 'all') return true;
    const project = localDb?.video_editor_projects?.[targetProjId] || allProjectsList.find(p => p.id === targetProjId);

    // 1. Match by project_id / projectId / video_editor_project_id
    const vProjId = v.project_id || v.projectId || v.video_editor_project_id;
    if (vProjId && (vProjId === targetProjId || (project && vProjId === project.id))) return true;

    // 2. Match by generation_history of the project
    if (project && Array.isArray((project as any).generation_history)) {
      const vidId = v.id || v.vid || v.file_id;
      const vUrl = v.url || v.download_url;
      const vName = (v.name || '').toLowerCase();
      const inHist = (project as any).generation_history.some((h: any) => 
        h.id === vidId || h.job_id === vidId || h.jobId === vidId ||
        h.id === v.file_id || h.job_id === v.file_id ||
        (h.video_url && vUrl && h.video_url === vUrl) ||
        (h.filename && vName && h.filename.toLowerCase() === vName)
      );
      if (inHist) return true;
    }

    // 3. Match by project name
    const pName = project?.name?.trim().toLowerCase();
    if (pName) {
      const vProjName = (v.project_name || v.source_name || (v as any).projectName || v.name || '').trim().toLowerCase();
      if (vProjName && (vProjName === pName || vProjName.includes(pName) || pName.includes(vProjName))) return true;
    }

    // 4. Match if video file_id/id matches any clip in project
    if (project && Array.isArray(project.clips)) {
      const vidId = v.id || v.vid || v.file_id;
      if (vidId && project.clips.some((c: any) => c.id === vidId || c.file_id === vidId || c.vid === vidId)) {
        return true;
      }
    }

    return false;
  }, [localDb, allProjectsList]);

  // Count of videos for each project
  const projectVideoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allProjectsList.forEach(p => {
      counts[p.id] = allVideos.filter(v => doesVideoMatchProject(v, p.id)).length;
    });
    return counts;
  }, [allProjectsList, allVideos, doesVideoMatchProject]);

  const selectedProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return allProjectsList.find(p => p.id === selectedProjectId) || null;
  }, [allProjectsList, selectedProjectId]);

  // Sync filters on modal open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // 1. Project selection:
      // If user was in a specific project (initialProjectId provided):
      if (initialProjectId) {
        const found = allProjectsList.find(p => p.id === initialProjectId || p.name?.trim().toLowerCase() === initialProjectId.trim().toLowerCase());
        if (found) {
          setSelectedProjectId(found.id);
        } else {
          setSelectedProjectId(initialProjectId);
        }
      } else {
        // When opened from home page without specific project, show 'all' by default so all renders are visible!
        setSelectedProjectId('all');
      }

      if (activeMasterFid && activeMasterFid !== 'root' && isMasterBucket(activeMasterFid)) {
        setSelectedMasterFid(activeMasterFid);
      } else {
        setSelectedMasterFid('all');
      }
      setIsDropdownOpen(false);
      setProjectSearchQuery('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialProjectId, allProjectsList, activeMasterFid, editorMode, isMasterBucket]);

  // Filter videos based on selected Project, Master Bucket, and Mode
  const filteredVideos = useMemo(() => {
    return allVideos.filter(v => {
      const vid = v.id || (v as any).vid || v.file_id;
      if (
        deletedClipIds.has(vid) || 
        (v.id && deletedClipIds.has(v.id)) || 
        (v.file_id && deletedClipIds.has(v.file_id)) ||
        (v.name && deletedClipIds.has(v.name))
      ) {
        return false;
      }

      // Project filter
      if (selectedProjectId !== 'all') {
        if (!doesVideoMatchProject(v, selectedProjectId)) {
          return false;
        }
      }

      // Master bucket filter
      if (selectedMasterFid !== 'all') {
        const bFid = (v as any).master_bucket_fid || (v as any).root_bucket_fid || (v.project_id && localDb?.video_editor_projects?.[v.project_id]?.master_bucket_fid);
        if (bFid) {
          if (bFid !== selectedMasterFid) return false;
        } else if (v.folder_id && v.folder_id !== 'root' && v.folder_id !== 'exports') {
          const parentFolder = localDb?.folders?.[v.folder_id]?.parent;
          if (v.folder_id !== selectedMasterFid && parentFolder !== selectedMasterFid) {
            return false;
          }
        }
      }

      return true;
    });
  }, [allVideos, selectedProjectId, selectedMasterFid, localDb, deletedClipIds, doesVideoMatchProject]);

  // Group filtered videos into Day Groups: Today, Yesterday, and specific previous dates
  const dayGroups = useMemo<DayGroup[]>(() => {
    if (filteredVideos.length === 0) return [];

    const groupsMap = new Map<string, DayGroup>();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayStart = todayStart - oneDayMs;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    filteredVideos.forEach((v: any) => {
      const rawTs = v.created_at || v.exported_at || v.completed_at || v.last_modified || v.updated_at || v.timestamp || 0;
      let ts = typeof rawTs === 'number' ? rawTs : Number(rawTs);
      if (isNaN(ts) || ts <= 0) {
        const parsed = new Date(rawTs).getTime();
        if (!isNaN(parsed) && parsed > 0) ts = parsed;
        else ts = Date.now();
      }
      if (ts < 10000000000) ts = ts * 1000;

      const date = new Date(ts);
      const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dateFormatted = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

      let dateKey: string;
      let displayTitle: string;
      let subTitle: string;

      if (dStart === todayStart) {
        dateKey = 'today';
        displayTitle = 'Today';
        subTitle = dateFormatted;
      } else if (dStart === yesterdayStart) {
        dateKey = 'yesterday';
        displayTitle = 'Yesterday';
        subTitle = dateFormatted;
      } else {
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const weekday = dayNames[date.getDay()];
        displayTitle = `${weekday}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
        subTitle = `${date.getFullYear()}`;
      }

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, {
          dateKey,
          displayTitle,
          subTitle,
          dayStartMs: dStart,
          videos: []
        });
      }

      groupsMap.get(dateKey)!.videos.push(v);
    });

    // Sort day groups descending (Today first, then Yesterday, then older days)
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.dayStartMs - a.dayStartMs);

    // Sort videos inside each day group newest first
    sortedGroups.forEach(g => {
      g.videos.sort((a: any, b: any) => {
        const tA = a.created_at || a.last_modified || 0;
        const tB = b.created_at || b.last_modified || 0;
        return tB - tA;
      });
    });

    return sortedGroups;
  }, [filteredVideos]);

  const handleCloseModal = useCallback(() => {
    setPlayingVidId(null);
    videoRefs.current.forEach(videoEl => {
      if (videoEl) {
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch (_) {}
      }
    });
    onClose();
  }, [onClose]);

  // Videos only play when the user explicitly clicks the play button.
  // When modal is closed or unmounted or browser back occurs, ensure all video playback is stopped and paused.
  useEffect(() => {
    const stopAllVideos = () => {
      setPlayingVidId(null);
      videoRefs.current.forEach(videoEl => {
        if (videoEl) {
          try {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
          } catch (_) {}
        }
      });
    };

    if (!isOpen) {
      stopAllVideos();
    }

    const handlePopState = () => {
      stopAllVideos();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePopState);
      stopAllVideos();
    };
  }, [isOpen]);

  // Synchronize actual video playback with playingVidId
  useEffect(() => {
    videoRefs.current.forEach((videoEl, vidId) => {
      if (!videoEl) return;
      if (vidId === playingVidId) {
        videoEl.muted = isMuted;
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
          });
        }
      } else {
        videoEl.pause();
      }
    });
  }, [playingVidId, isMuted]);

  // Format time of clip
  const getFormattedTime = useCallback((v: any): string => {
    const rawTs = v.created_at || v.exported_at || v.completed_at || v.last_modified || v.updated_at || v.timestamp || 0;
    if (!rawTs) return '';
    let ts = typeof rawTs === 'number' ? rawTs : Number(rawTs);
    if (isNaN(ts) || ts === 0) {
      const parsed = new Date(rawTs).getTime();
      if (!isNaN(parsed) && parsed > 0) ts = parsed;
    }
    if (ts && ts < 10000000000) ts = ts * 1000;
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) return `Today • ${timeStr}`;
    if (isYesterday) return `Yesterday • ${timeStr}`;
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateStr} • ${timeStr}`;
  }, []);

  // Helper to extract clean title and hashtags
  const getTitleAndHashtags = (v: any) => {
    const rawTitle = v.generated_title || v.project_name || v.source_name || (v.name || 'Untitled Video').replace(/\.mp4$/i, '').replace(/[_-]/g, ' ');
    const title = rawTitle.trim() || 'Untitled Video';
    let hashtags = (v.generated_hashtags || '').trim();
    if (!hashtags) {
      const safeWord = title.replace(/[^\w]/g, '');
      hashtags = `#${safeWord || 'Studio'} #Reels #Trending #Viral`;
    }
    return { title, hashtags };
  };

  // Helper to resolve safe playable stream URL
  const getVideoUrl = (v: any): string => {
    // 0. If item is a trimmed/cut segment, return precise sliced segment stream
    const tStart = typeof v.trim_start === 'number' ? v.trim_start : 0;
    const tEnd = typeof v.trim_end === 'number' ? v.trim_end : 0;
    const vDur = typeof v.duration === 'number' ? v.duration : 0;
    const origDur = typeof v.orig_duration === 'number' ? v.orig_duration : (typeof (v as any).source_duration === 'number' ? (v as any).source_duration : 0);
    const isSegment = Boolean(
      v.is_cut ||
      v.is_segment ||
      tStart > 0.05 ||
      (tEnd > 0 && origDur > 0 && tEnd < origDur - 0.08) ||
      (tEnd > 0 && vDur > 0 && tEnd < vDur - 0.08) ||
      (tEnd > 0 && tStart >= 0 && (tEnd - tStart) < (origDur || vDur || 999999) - 0.08)
    );

    if (isSegment) {
      const fId = v.file_id || v.id || v.vid || '';
      const safeName = (v.name || 'segment').replace(/[^\w.-]/g, '_').replace(/\.mp4$/i, '') + '.mp4';
      return `/api/video/segment?fileId=${encodeURIComponent(fId)}&url=${encodeURIComponent(v.url || '')}&trim_start=${tStart}&trim_end=${tEnd}&duration=${vDur}&is_cut=true&filename=${encodeURIComponent(safeName)}`;
    }

    // 1. Direct merged video / renders stream URL
    if (v.url && typeof v.url === 'string' && (v.url.includes('/api/merged_video/') || v.url.includes('/renders/'))) {
      return v.url;
    }
    if (v.download_url && typeof v.download_url === 'string' && (v.download_url.includes('/api/merged_video/') || v.download_url.includes('/renders/'))) {
      return v.download_url;
    }
    if (v.downloadUrl && typeof v.downloadUrl === 'string' && (v.downloadUrl.includes('/api/merged_video/') || v.downloadUrl.includes('/renders/'))) {
      return v.downloadUrl;
    }

    // 2. Telegram File ID (only genuine Telegram file IDs, not local job_render_ IDs)
    const tgId = v.telegram_file_id || (v.file_id && typeof v.file_id === 'string' && !v.file_id.startsWith('job_render_') && v.file_id.length > 25 ? v.file_id : null);
    if (tgId) {
      return `/api/video/${encodeURIComponent(tgId)}`;
    }

    // 3. If file_id or id is a job_render_...
    const fId = String(v.file_id || v.id || '');
    if (fId.startsWith('job_render_')) {
      return `/api/merged_video/${encodeURIComponent(fId)}.mp4`;
    }

    if (v.downloadUrl || v.download_url) {
      return v.downloadUrl || v.download_url;
    }
    if (v.url && (v.url.startsWith('http') || v.url.startsWith('/'))) {
      return v.url;
    }
    if (v.name && v.name.endsWith('.mp4')) {
      return `/api/merged_video/${encodeURIComponent(v.name)}`;
    }
    return `/api/video/${encodeURIComponent(v.id || v.file_id || '')}`;
  };

  // Pre-fetch active video file blob in the background so mobile OS gets real MP4 file instantly
  useEffect(() => {
    if (!playingVidId) return;
    if (prefetchedFiles.current.has(playingVidId)) return;

    const currentVid = filteredVideos.find((v: any) => (v.id || v.vid || v.file_id) === playingVidId);
    if (!currentVid) return;

    const streamUrl = getVideoUrl(currentVid);
    const fullUrl = streamUrl.startsWith('http') ? streamUrl : `${window.location.origin}${streamUrl}`;
    const { title } = getTitleAndHashtags(currentVid);

    const ctrl = new AbortController();
    fetch(fullUrl, { signal: ctrl.signal })
      .then(res => res.ok ? res.blob() : null)
      .then(blob => {
        if (blob) {
          const cleanName = `${(title || 'video').replace(/[^a-zA-Z0-9_\-]/g, '_')}.mp4`;
          prefetchedFiles.current.set(playingVidId, new File([blob], cleanName, { type: 'video/mp4' }));
        }
      })
      .catch(() => {});

    return () => {
      ctrl.abort();
    };
  }, [playingVidId, filteredVideos]);

  // Track which video has an active "Select platform to tick" prompt after mobile share
  const [activeSharePromptVid, setActiveSharePromptVid] = useState<string | null>(null);

  // Helper to check if a specific platform has been shared for a clip
  const isPlatformShared = useCallback((vid: string, platform: 'instagram' | 'facebook' | 'whatsapp' | 'telegram', v?: any): boolean => {
    const allKeys = [
      vid,
      v?.id,
      v?.vid,
      v?.file_id,
      v?.telegram_file_id,
      v?.jobId
    ].filter(Boolean) as string[];

    const set = new Set<string>();
    allKeys.forEach(k => {
      (sharedPlatformsMap[k] || []).forEach(p => set.add(p));
    });
    ((v?.shared_platforms as string[]) || []).forEach(p => set.add(p));

    if (platform === 'instagram') {
      return set.has('instagram') || set.has('instagram_reels') || set.has('instagram_feed');
    }
    if (platform === 'facebook') {
      return set.has('facebook') || set.has('facebook_reels');
    }
    if (platform === 'whatsapp') {
      return set.has('whatsapp') || set.has('whatsapp_status');
    }
    if (platform === 'telegram') {
      return set.has('telegram') || set.has('telegram_bot') || 
        allKeys.some(k => telegramBotSentIds.has(k)) || 
        Boolean(v?.telegram_bot_sent);
    }
    return false;
  }, [sharedPlatformsMap, telegramBotSentIds]);

  // Register or toggle successful share for a specific platform & update DB
  const handleRegisterPlatformShare = useCallback((v: any, rawPlatform: string, action: 'add' | 'remove' | 'toggle' = 'add') => {
    let canonical = rawPlatform;
    if (rawPlatform.includes('instagram')) canonical = 'instagram';
    else if (rawPlatform.includes('facebook')) canonical = 'facebook';
    else if (rawPlatform.includes('whatsapp')) canonical = 'whatsapp';
    else if (rawPlatform.includes('telegram')) canonical = 'telegram';

    const vid = v.id || v.vid || v.file_id;
    const allKeys = [
      vid,
      v.id,
      v.vid,
      v.file_id,
      v.telegram_file_id,
      v.jobId
    ].filter(Boolean) as string[];

    setSharedPlatformsMap(prev => {
      const currentSet = new Set<string>();
      allKeys.forEach(k => {
        (prev[k] || []).forEach(p => currentSet.add(p));
      });
      ((v.shared_platforms as string[]) || []).forEach(p => currentSet.add(p));

      if (action === 'toggle') {
        if (currentSet.has(canonical)) currentSet.delete(canonical);
        else currentSet.add(canonical);
      } else if (action === 'remove') {
        currentSet.delete(canonical);
      } else {
        currentSet.add(canonical);
      }

      const updatedList = Array.from(currentSet);
      const updated = { ...prev };
      allKeys.forEach(k => {
        updated[k] = updatedList;
      });

      try {
        localStorage.setItem('studio_video_platform_shares', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    // In-memory update directly on video object for instant reaction
    if (!Array.isArray(v.shared_platforms)) v.shared_platforms = [];
    if (action === 'remove') {
      v.shared_platforms = v.shared_platforms.filter((p: string) => p !== canonical);
    } else if (!v.shared_platforms.includes(canonical)) {
      v.shared_platforms.push(canonical);
    }

    // Update local DB
    setLocalDb(prev => {
      if (!prev?.videos) return prev;
      const updated = { ...prev.videos };
      let modified = false;
      allKeys.forEach(k => {
        if (updated[k]) {
          const cur = new Set(updated[k].shared_platforms || []);
          if (action === 'remove') {
            cur.delete(canonical);
          } else {
            cur.add(canonical);
          }
          updated[k] = { ...updated[k], is_shared: cur.size > 0, shared_platforms: Array.from(cur) };
          modified = true;
        }
      });
      return modified ? { ...prev, videos: updated } : prev;
    });

    // Persist to server
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark_video_shared',
        payload: { vid, platform: canonical, platform_action: action, id: v.id, video_id: v.file_id }
      })
    }).catch(() => {});
  }, []);

  // Instantly copy title and hashtags to clipboard
  const handleCopyTitleAndHashtags = async (v: any) => {
    const vid = v.id || (v as any).vid || v.file_id;
    const { title, hashtags } = getTitleAndHashtags(v);
    const textToCopy = `${title}\n\n${hashtags}`.trim();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(vid);
      showToast("Title & Hashtags copied!", "success");
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {
      showToast("Unable to copy to clipboard", "error");
    }
  };

  // INSTANT MOBILE INBUILT DRIVER SHARE:
  // NO POPUP! Instantly copies title & hashtags, and immediately triggers native mobile OS driver (navigator.share)
  const handleInstantMobileShare = async (v: any) => {
    const vid = v.id || (v as any).vid || v.file_id;
    const { title, hashtags } = getTitleAndHashtags(v);
    const shareText = `${title}\n\n${hashtags}`.trim();
    const streamUrl = getVideoUrl(v);
    const fullUrl = streamUrl.startsWith('http') ? streamUrl : `${window.location.origin}${streamUrl}`;

    // 1. Instantly copy title and hashtags to clipboard with 0ms delay
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(vid);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {}

    // 2. Directly open mobile device's inbuilt social media driver
    if (navigator.share) {
      try {
        const prefetched = prefetchedFiles.current.get(vid);

        if (prefetched && navigator.canShare && navigator.canShare({ files: [prefetched] })) {
          await navigator.share({
            title,
            text: shareText,
            files: [prefetched]
          });
        } else {
          await navigator.share({
            title,
            text: shareText,
            url: fullUrl
          });
        }

        // On successful completion of native mobile share driver:
        showToast("Shared! Select app below to set tick mark ✓", "success");
        // Open quick 1-tap platform selector for this clip so user sets the exact platform they chose
        setActiveSharePromptVid(vid);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showToast("Title & hashtags copied to clipboard!", "info");
        }
      }
    } else {
      // Desktop browser fallback: title & hashtags copied
      showToast("Title & hashtags copied! (Click platform below to share)", "success");
      setActiveSharePromptVid(vid);
    }
  };

  // DIRECT PLATFORM SHARE:
  // If already marked: toggles off so user can fix accidental marks.
  // If not marked: marks with verified tick mark, copies title/hashtags, and launches that app!
  const handleDirectPlatformShare = async (v: any, platform: 'instagram' | 'facebook' | 'whatsapp' | 'telegram') => {
    const vid = v.id || (v as any).vid || v.file_id;
    const isCurrentlyShared = isPlatformShared(vid, platform, v);

    // If already marked, allow user to unmark in 1 tap!
    if (isCurrentlyShared) {
      handleRegisterPlatformShare(v, platform, 'remove');
      const name = platform.charAt(0).toUpperCase() + platform.slice(1);
      showToast(`Unmarked ${name}`, "info");
      return;
    }

    const { title, hashtags } = getTitleAndHashtags(v);
    const shareText = `${title}\n\n${hashtags}`.trim();
    const streamUrl = getVideoUrl(v);
    const fullUrl = streamUrl.startsWith('http') ? streamUrl : `${window.location.origin}${streamUrl}`;

    // 1. Instantly copy title & hashtags
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(vid);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {}

    // 2. Automatically detect and create the tick mark for THIS EXACT platform!
    handleRegisterPlatformShare(v, platform, 'add');

    // 3. Open platform directly
    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n\n' + fullUrl)}`, '_blank');
      showToast("WhatsApp marked ✓ Title copied!", "success");
    } else if (platform === 'instagram') {
      window.open('https://www.instagram.com/', '_blank');
      showToast("Instagram marked ✓ Title copied!", "success");
    } else if (platform === 'facebook') {
      window.open('https://www.facebook.com/reels/create', '_blank');
      showToast("Facebook marked ✓ Title copied!", "success");
    } else if (platform === 'telegram') {
      handleSendToTelegram(v);
    }
  };

  // 1-Tap Instant Send to Telegram Bot Chat
  const handleSendToTelegram = async (v: any) => {
    const vid = v.id || (v as any).vid || v.file_id;
    if (!vid) return;
    setSendingTgVid(vid);

    const { title, hashtags } = getTitleAndHashtags(v);
    const cleanText = `${title}\n\n${hashtags}`.trim();
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const telegramCaption = `<pre>${escapeHtml(cleanText)}</pre>`;

    try {
      const res = await fetch('/api/editor/send_export_to_telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: vid,
          telegram_file_id: v.telegram_file_id || v.file_id,
          file_id: v.file_id,
          url: v.url || v.download_url,
          filename: v.name,
          caption: telegramCaption
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Sent to Telegram Bot! ✓", "success");
        setTelegramBotSentIds(prev => {
          const next = new Set([...prev, vid]);
          if (v.file_id) next.add(v.file_id);
          try { localStorage.setItem('studio_telegram_bot_sent_ids', JSON.stringify([...next])); } catch (_) {}
          return next;
        });
        handleRegisterPlatformShare(vid, 'telegram');
      } else {
        showToast(data.error || "Failed to send to Telegram Bot", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Network error sending to Telegram Bot", "error");
    } finally {
      setSendingTgVid(null);
    }
  };

  // Direct Video Download
  const handleDownloadVideo = async (v: any) => {
    const vid = v.id || (v as any).vid || v.file_id;
    setDownloadingVid(vid);
    try {
      const streamUrl = getVideoUrl(v);
      const safeName = (v.name || 'studio_video.mp4').replace(/[^\w.-]/g, '_');

      const resp = await fetch(streamUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safeName.endsWith('.mp4') ? safeName : `${safeName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast("Download started", "success");
    } catch (err: any) {
      const streamUrl = getVideoUrl(v);
      const a = document.createElement('a');
      a.href = streamUrl;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.download = (v.name || 'studio_video.mp4');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Opening download stream", "info");
    } finally {
      setDownloadingVid(null);
    }
  };

  // Instant 0ms Optimistic Deletion
  const handleDeleteVideo = async (vid: string) => {
    if (!vid) return;

    setDeletedClipIds(prev => {
      const next = new Set([...prev, vid]);
      try {
        localStorage.setItem('deleted_export_history_ids', JSON.stringify([...next]));
      } catch (_) {}
      return next;
    });
    setConfirmDeleteId(null);
    setDeletingVid(vid);
    showToast("Video deleted instantly", "info");

    setLocalDb(prev => {
      if (!prev) return prev;
      const newDeleted = { ...(prev.deleted_videos || {}), [vid]: Date.now() };
      const newVideos = { ...(prev.videos || {}) };
      delete newVideos[vid];

      const newKaggleJobs = { ...(prev.kaggle_jobs || {}) };
      Object.keys(newKaggleJobs).forEach(k => {
        if (k === vid || newKaggleJobs[k]?.vid === vid || newKaggleJobs[k]?.jobId === vid || newKaggleJobs[k]?.filename === vid) {
          delete newKaggleJobs[k];
        }
      });

      const updated = {
        ...prev,
        deleted_videos: newDeleted,
        videos: newVideos,
        kaggle_jobs: newKaggleJobs
      };
      if (setDb) setDb(updated);
      return updated;
    });

    try {
      await Promise.allSettled([
        fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_video',
            vid: vid,
            video_id: vid,
            videoId: vid,
            id: vid
          })
        }),
        fetch('/api/kaggle/dismiss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: vid })
        })
      ]);
    } catch (e) {
      console.warn("Background delete sync note:", e);
    } finally {
      setDeletingVid(null);
    }
  };

  // Scroll to a specific clip index in a day's horizontal progress carousel
  const scrollToClip = (dateKey: string, targetIdx: number, dayVideos: VideoData[]) => {
    const targetVideo = dayVideos[targetIdx];
    if (!targetVideo) return;
    const vid = targetVideo.id || (targetVideo as any).vid || targetVideo.file_id;
    const cardEl = cardRefs.current.get(vid);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setActiveClipIndexByDay(prev => ({ ...prev, [dateKey]: targetIdx }));
    }
  };

  // Handle horizontal scroll in a day's row: updates active clip indicator (does NOT auto-play; pauses if scrolled away)
  const handleDayScroll = (dateKey: string, e: React.UIEvent<HTMLDivElement>, dayVideos: VideoData[]) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const centerX = scrollLeft + containerWidth / 2;

    let closestIdx = 0;
    let minDiff = Infinity;

    dayVideos.forEach((v, idx) => {
      const vid = v.id || (v as any).vid || v.file_id;
      const el = cardRefs.current.get(vid);
      if (el) {
        const cardCenter = el.offsetLeft + el.offsetWidth / 2;
        const diff = Math.abs(centerX - cardCenter);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
    });

    setActiveClipIndexByDay(prev => {
      if (prev[dateKey] === closestIdx) return prev;
      return { ...prev, [dateKey]: closestIdx };
    });

    // If user scrolled away from the currently playing video in this row, pause it
    const activeVid = dayVideos[closestIdx];
    const activeVidId = activeVid ? (activeVid.id || (activeVid as any).vid || activeVid.file_id) : null;
    if (playingVidId && activeVidId && playingVidId !== activeVidId) {
      const currentDayVidIds = new Set(dayVideos.map(v => v.id || (v as any).vid || v.file_id));
      if (currentDayVidIds.has(playingVidId)) {
        setPlayingVidId(null);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-md flex flex-col text-white animate-in fade-in duration-200">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[160] px-4 py-2 bg-gray-900/95 border border-purple-500/60 text-white text-xs font-semibold rounded-2xl shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in slide-in-from-top-2 duration-150">
          {toastMessage.type === 'success' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertCircle size={14} className="text-rose-400 shrink-0" />}
          {toastMessage.type === 'info' && <Check size={14} className="text-cyan-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="px-3 sm:px-5 py-2 bg-gray-950 border-b border-gray-800/90 flex flex-col gap-2 shrink-0 relative z-[100]">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            <div className="p-1 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
              <Film size={15} />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate whitespace-nowrap">
              History
            </h2>
            <span className="text-[10px] font-mono font-bold text-purple-300 px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/40 whitespace-nowrap shrink-0">
              {filteredVideos.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMuted(prev => !prev)}
              className="p-1.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl border border-gray-800 transition cursor-pointer shrink-0"
              title={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-purple-400" />}
            </button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-gray-800 transition cursor-pointer shrink-0"
              title="Close history"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modern Project Selector Dropdown Menu */}
        <div className="relative min-w-0" ref={dropdownRef}>
          {/* Custom Trigger Button */}
          <button
            type="button"
            onClick={() => setIsDropdownOpen(prev => !prev)}
            className="w-full bg-gray-900/90 hover:bg-gray-850 active:scale-[0.99] border border-gray-750 hover:border-purple-500/60 text-white rounded-xl px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 transition shadow-sm cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30 shrink-0">
                {selectedProjectId === 'all' ? <Layers size={13} /> : <Folder size={13} />}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider leading-none">
                  Project
                </span>
                <span className="text-xs font-bold text-gray-100 truncate mt-0.5 max-w-[190px] xs:max-w-[260px] sm:max-w-md">
                  {selectedProjectId === 'all' 
                    ? `All Projects (${allVideos.length})` 
                    : (selectedProject?.name || 'Selected Project')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40">
                {filteredVideos.length} {filteredVideos.length === 1 ? 'clip' : 'clips'}
              </span>
              <ChevronDown 
                size={14} 
                className={`text-gray-400 group-hover:text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} 
              />
            </div>
          </button>

          {/* Floating Dropdown Popover with click backdrop */}
          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute top-full left-0 right-0 mt-1.5 z-[120] bg-gray-950 border border-gray-700 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98)] overflow-hidden py-1.5 flex flex-col max-h-72 animate-in fade-in zoom-in-95 duration-150">
                {/* Search projects if multiple */}
                {allProjectsList.length > 3 && (
                  <div className="px-2 pb-1.5 border-b border-gray-800/80">
                    <div className="relative flex items-center">
                      <Search size={12} className="absolute left-2.5 text-gray-500 pointer-events-none" />
                      <input
                        type="text"
                        value={projectSearchQuery}
                        onChange={(e) => setProjectSearchQuery(e.target.value)}
                        placeholder="Search projects..."
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}

              <div className="overflow-y-auto no-scrollbar py-1">
                {/* Option 1: ALL PROJECTS */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProjectId('all');
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 flex items-center justify-between text-left transition cursor-pointer text-xs ${
                    selectedProjectId === 'all'
                      ? 'bg-purple-600/20 text-purple-200 font-bold'
                      : 'text-gray-300 hover:bg-gray-900 hover:text-white font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers size={13} className={selectedProjectId === 'all' ? 'text-purple-400' : 'text-gray-500'} />
                    <span className="truncate">All Projects</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-gray-400">
                      {allVideos.length}
                    </span>
                    {selectedProjectId === 'all' && (
                      <Check size={13} className="text-purple-400 stroke-[2.5]" />
                    )}
                  </div>
                </button>

                <div className="my-1 border-t border-gray-800/80" />

                {/* List of projects */}
                {allProjectsList
                  .filter(p => !projectSearchQuery || p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                  .map((project, idx) => {
                    const isSelected = selectedProjectId === project.id;
                    const isRecent = idx === 0;
                    const count = projectVideoCounts[project.id] || 0;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 flex items-center justify-between text-left transition cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-purple-600/20 text-purple-200 font-bold'
                            : 'text-gray-300 hover:bg-gray-900 hover:text-white font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder size={13} className={isSelected ? 'text-purple-400' : 'text-gray-500'} />
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{project.name}</span>
                            {isRecent && (
                              <span className="px-1 py-0.2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-mono font-bold rounded shrink-0">
                                Recent
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${count > 0 ? 'bg-purple-950/80 text-purple-300' : 'bg-black/30 text-gray-500'}`}>
                            {count}
                          </span>
                          {isSelected && (
                            <Check size={13} className="text-purple-400 stroke-[2.5]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
            </>
          )}
        </div>
      </header>

      {/* MAIN BODY: VERTICALLY SCROLLABLE ACROSS DAYS, HORIZONTALLY SCROLLABLE CLIPS FOR EACH DAY */}
      {filteredVideos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-3">
          <Film size={40} className="text-gray-600 animate-pulse" />
          <p className="text-sm font-semibold text-gray-300">No video clips in this view</p>
          <p className="text-xs text-gray-500 max-w-xs">
            {selectedProjectId !== 'all' 
              ? `No export history found for "${selectedProject?.name || 'this project'}". Render or export this project, or click below to view all projects.` 
              : "Render or export clips in any project to see them here."}
          </p>
          {selectedProjectId !== 'all' && (
            <button
              onClick={() => setSelectedProjectId('all')}
              className="mt-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl cursor-pointer transition shadow-lg shadow-purple-900/40"
            >
              View All Projects ({allVideos.length})
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 sm:px-6 py-4 space-y-8 scrollbar-thin scrollbar-thumb-gray-800">
          {dayGroups.map((group) => {
            const currentIdx = activeClipIndexByDay[group.dateKey] || 0;
            const totalCount = group.videos.length;

            return (
              <section 
                key={group.dateKey}
                className="w-full max-w-6xl mx-auto flex flex-col gap-2.5 pb-4 border-b border-gray-900/80 last:border-b-0"
              >
                {/* DAY HEADER */}
                <div className="flex items-center justify-between px-2 sm:px-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      <Calendar size={14} />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                        {group.displayTitle}
                      </h3>
                      <span className="text-[11px] text-gray-400 font-medium hidden xs:inline">
                        • {group.subTitle}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gray-900 text-purple-300 border border-purple-800/40">
                      {totalCount} {totalCount === 1 ? 'clip' : 'clips'}
                    </span>
                  </div>

                  {/* Horizontal navigation controls for this day */}
                  {totalCount > 1 && (
                    <div className="flex items-center gap-1.5 bg-gray-900/90 p-1 rounded-xl border border-gray-800 text-xs font-semibold text-gray-300">
                      <button
                        type="button"
                        onClick={() => scrollToClip(group.dateKey, Math.max(0, currentIdx - 1), group.videos)}
                        disabled={currentIdx === 0}
                        className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Previous clip"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <span className="font-mono text-[11px] px-1 text-purple-300">
                        {currentIdx + 1} / {totalCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => scrollToClip(group.dateKey, Math.min(totalCount - 1, currentIdx + 1), group.videos)}
                        disabled={currentIdx === totalCount - 1}
                        className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Next clip"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* HORIZONTAL PROGRESS TRACK (CAROUSEL) */}
                <div
                  ref={(el) => {
                    if (el) dayRowRefs.current.set(group.dateKey, el);
                    else dayRowRefs.current.delete(group.dateKey);
                  }}
                  onScroll={(e) => handleDayScroll(group.dateKey, e, group.videos)}
                  className="w-full flex items-center gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth py-1 px-2 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  {group.videos.map((v: any) => {
                    const vid = v.id || v.vid || v.file_id;
                    const isPlaying = playingVidId === vid;
                    const { title, hashtags } = getTitleAndHashtags(v);
                    const streamUrl = getVideoUrl(v);

                    // Check individual platform shares
                    const isIgShared = isPlatformShared(vid, 'instagram', v);
                    const isFbShared = isPlatformShared(vid, 'facebook', v);
                    const isWaShared = isPlatformShared(vid, 'whatsapp', v);
                    const isTgShared = isPlatformShared(vid, 'telegram', v);

                    const isSentTelegramBot = Boolean(
                      telegramBotSentIds.has(vid) || 
                      (v.file_id && telegramBotSentIds.has(v.file_id)) ||
                      v.telegram_bot_sent === true
                    );

                    return (
                      <ExportHistoryVideoCard
                        key={vid}
                        v={v}
                        vid={vid}
                        streamUrl={streamUrl}
                        isMuted={isMuted}
                        cardRef={(el) => {
                          if (el) cardRefs.current.set(vid, el);
                          else cardRefs.current.delete(vid);
                        }}
                        videoRef={(el) => {
                          if (el) videoRefs.current.set(vid, el);
                          else videoRefs.current.delete(vid);
                        }}
                        confirmDeleteId={confirmDeleteId}
                        setConfirmDeleteId={setConfirmDeleteId}
                        handleDeleteVideo={handleDeleteVideo}
                        deletingVid={deletingVid}
                        isPlaying={isPlaying}
                        onVideoClick={() => {
                          const videoEl = videoRefs.current.get(vid);
                          if (videoEl) {
                            if (videoEl.paused) {
                              videoRefs.current.forEach((el, id) => {
                                if (id !== vid) el?.pause();
                              });
                              setPlayingVidId(vid);
                              videoEl.play().catch(() => {});
                            } else {
                              videoEl.pause();
                              setPlayingVidId(null);
                            }
                          } else {
                            setPlayingVidId(prev => prev === vid ? null : vid);
                          }
                        }}
                        isIgShared={isIgShared}
                        isFbShared={isFbShared}
                        isWaShared={isWaShared}
                        isTgShared={isTgShared}
                        handleDirectPlatformShare={handleDirectPlatformShare}
                        handleInstantMobileShare={handleInstantMobileShare}
                        handleDownloadVideo={handleDownloadVideo}
                        downloadingVid={downloadingVid}
                        handleSendToTelegram={handleSendToTelegram}
                        sendingTgVid={sendingTgVid}
                        isSentTelegramBot={isSentTelegramBot}
                        activeSharePromptVid={activeSharePromptVid}
                        setActiveSharePromptVid={setActiveSharePromptVid}
                        handleRegisterPlatformShare={handleRegisterPlatformShare}
                        showToast={showToast}
                        getFormattedTime={getFormattedTime}
                        title={title}
                        hashtags={hashtags}
                        copiedId={copiedId}
                        copyTitleAndHashtags={handleCopyTitleAndHashtags}
                      />
                    );
                  })}
                </div>

                {/* BOTTOM PROGRESS DOTS: SHOWS HOW MANY CLIPS IN THE HORIZONTAL PROGRESS AND ACTIVE TRACK */}
                {totalCount > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-1 pb-0.5">
                    {group.videos.map((v: any, dIdx: number) => {
                      const isActive = dIdx === currentIdx;
                      return (
                        <button
                          key={v.id || v.vid || dIdx}
                          type="button"
                          onClick={() => scrollToClip(group.dateKey, dIdx, group.videos)}
                          className={`transition-all duration-300 rounded-full cursor-pointer ${
                            isActive 
                              ? 'w-6 h-2 bg-gradient-to-r from-purple-500 to-cyan-400 shadow-md shadow-purple-500/40' 
                              : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                          }`}
                          title={`Clip ${dIdx + 1} of ${totalCount}`}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
