import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { 
  Folder, Film, ArrowLeft, Settings, ChevronRight, Minimize2, Maximize2, 
  Layers, Clock, Music, Plus, Trash2, UploadCloud
} from 'lucide-react';
import { 
  DB, FolderData, VideoData, Job, AuthSession, VideoEditorProject, 
  computeNextProjectVersionName, isNormalBucket, isAiBucket, isAnyBucket 
} from './types';
export { isNormalBucket, isAiBucket, isAnyBucket };
import { auth, saveDbToFirestore } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { JobProgressNotification } from './components/JobProgressNotification';
import { FolderVideoCard } from './components/FolderVideoCard';
import { ProjectCard } from './components/ProjectCard';
import { MobileVideoEditorModal } from './components/MobileVideoEditorModal';
import { AudioLibraryModal } from './components/AudioLibraryModal';
import { ProjectHistorySidePanel } from './components/ProjectHistorySidePanel';
import { ExportGenerationHistoryModal } from './components/ExportGenerationHistoryModal';
import { BottomRenderStatusBar } from './components/BottomRenderStatusBar';
import { CreateProjectModal } from './components/CreateProjectModal';
import { DuplicateMasterBucketModal } from './components/DuplicateMasterBucketModal';
import { FullScreenSettingsModal } from './components/FullScreenSettingsModal';
import { MasterBucketUploadsDrawer } from './components/MasterBucketUploadsDrawer';
import { CompactFolderCard } from './components/CompactFolderCard';
import { FolderActionBottomSheet } from './components/FolderActionBottomSheet';
import { ChooseFolderTypeModal } from './components/ChooseFolderTypeModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { NewFolderModal } from './components/NewFolderModal';
import { ProjectCloudSyncModal } from './components/ProjectCloudSyncModal';
import { useUltraDataSaver, recordDataSaved } from './utils/dataSaver';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Clean date and time formatting for folder updates
export function formatFolderDateTime(ts?: number): { relative: string; full: string } {
  if (!ts) return { relative: '', full: 'No updates recorded' };
  const d = new Date(ts);
  const full = d.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
  const diff = Date.now() - ts;
  if (diff < 0) return { relative: 'Now', full };
  if (diff < 60000) return { relative: 'Just now', full };
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { relative: `${mins}m ago`, full };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { relative: `${hours}h ago`, full };
  const days = Math.floor(hours / 24);
  if (days === 1) return { relative: '1d ago', full };
  if (days < 7) return { relative: `${days}d ago`, full };
  return { relative: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), full };
}

export default function App() {
  const [db, setDb] = useState<DB | null>(() => {
    try {
      const cached = localStorage.getItem('remixx_cached_db');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.folders && Object.keys(parsed.folders).length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [authChecking, setAuthChecking] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession>(() => {
    try {
      const cached = localStorage.getItem('remixx_auth_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (u && u.email) return { user: u };
      }
    } catch (_) {}
    return {
      user: {
        id: 'vathsss001@gmail.com',
        email: 'vathsss001@gmail.com',
        name: 'Admin',
        role: 'admin',
        isDefaultAdmin: true,
        createdAt: Date.now(),
        lastLogin: Date.now()
      }
    };
  });
  const [currentFolderId, setCurrentFolderId] = useState<string>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlFolder = p.get('folder') || p.get('fid');
      if (urlFolder) return urlFolder;
      const stored = localStorage.getItem('ai_studio_last_folder_id');
      if (stored) return stored;
      return 'root';
    } catch {
      return 'root';
    }
  });

  // Editor mode: 'general' (Normal Buckets B1..B8) vs 'ai' (AI Buckets AI1..AI8)
  const [editorMode, setEditorMode] = useState<'general' | 'ai'>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlMode = p.get('mode');
      if (urlMode === 'ai' || urlMode === 'general') return urlMode;
      const stored = localStorage.getItem('ai_studio_editor_mode');
      if (stored === 'ai' || stored === 'general') return stored;
      return 'general';
    } catch {
      return 'general';
    }
  });

  // UI state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasBottomDock, setHasBottomDock] = useState<boolean>(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleDockVisibility = (e: any) => {
      if (typeof e?.detail?.visible === 'boolean') {
        setHasBottomDock(e.detail.visible);
      }
    };
    window.addEventListener('bottom-dock-visibility', handleDockVisibility);
    return () => window.removeEventListener('bottom-dock-visibility', handleDockVisibility);
  }, []);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSyncingMainBot, setIsSyncingMainBot] = useState(false);

  // Modals
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAudioLibrary, setShowAudioLibrary] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai_studio_audio_lib_open') === 'true';
    } catch {
      return false;
    }
  });
  const [showExportGenerationHistory, setShowExportGenerationHistory] = useState(false);
  const [exportHistoryInitialProjectId, setExportHistoryInitialProjectId] = useState<string | null>(null);
  const [isProjectSidePanelOpen, setIsProjectSidePanelOpen] = useState(false);
  const [isVideoEditorOpen, setIsVideoEditorOpen] = useState<boolean>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('editor') === '1' || p.get('editor') === 'true') return true;
      const stored = localStorage.getItem('ai_studio_editor_open');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [videoEditorMasterFid, setVideoEditorMasterFid] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlFid = p.get('editor_fid') || p.get('masterFid');
      if (urlFid) return urlFid;
      return localStorage.getItem('ai_studio_editor_master_fid') || null;
    } catch {
      return null;
    }
  });
  const [currentEditingProjectId, setCurrentEditingProjectId] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlPid = p.get('project') || p.get('pid');
      if (urlPid) return urlPid;
      return localStorage.getItem('ai_studio_editor_project_id') || null;
    } catch {
      return null;
    }
  });
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string; fileId?: string; duration?: number; isMuted?: boolean } | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showChooseFolderTypeModal, setShowChooseFolderTypeModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showUploadsDrawer, setShowUploadsDrawer] = useState(false);
  const [selectedUploadsMasterFid, setSelectedUploadsMasterFid] = useState<string | null>(null);
  const [isUploadingMasterClips, setIsUploadingMasterClips] = useState(false);
  const [uploadMasterClipsProgress, setUploadMasterClipsProgress] = useState(0);
  const [uploadMasterClipsStats, setUploadMasterClipsStats] = useState<{ current: number; total: number } | null>(null);
  const [sheetFolder, setSheetFolder] = useState<{
    fId: string;
    folder: FolderData;
    isMaster: boolean;
    isBucket: boolean;
    latestTime: number;
    clipCount: number;
  } | null>(null);

  // Low-Data Automatic App Update Checker on App Launch / Re-open
  useEffect(() => {
    const checkAppUpdates = async () => {
      // If offline, do nothing - zero internet used
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      try {
        const res = await fetch('/api/app-version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.buildTime) {
          const lastKnownBuild = localStorage.getItem('vd_last_app_build_time');
          if (lastKnownBuild && Number(lastKnownBuild) !== Number(data.buildTime)) {
            console.log('[Auto-Update] Detected updated AI Studio build. Syncing latest app...');
            localStorage.setItem('vd_last_app_build_time', String(data.buildTime));
            showToast('App updated with latest AI Studio build!', 'info');
            // Gracefully refresh the app to load new components immediately
            setTimeout(() => {
              window.location.reload();
            }, 800);
          } else if (!lastKnownBuild) {
            localStorage.setItem('vd_last_app_build_time', String(data.buildTime));
          }
        }
      } catch (_) {
        // Silently ignore network failures when offline
      }
    };

    // Run once on launch
    checkAppUpdates();

    // Check when user returns to the app / window becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAppUpdates();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkAppUpdates);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkAppUpdates);
    };
  }, []);

  // Project Manual Cloud Backup state
  const [cloudSyncProject, setCloudSyncProject] = useState<VideoEditorProject | null>(null);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  const handleOpenCloudSyncModal = useCallback((proj: VideoEditorProject) => {
    setCloudSyncProject(proj);
    setShowCloudSyncModal(true);
  }, []);

  const handleCreateNewFolder = async (name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    const fid = 'f_' + Date.now();
    const newFolder: FolderData = {
      name: cleanName,
      parent: activeFolderId === 'root' ? 'root' : activeFolderId,
      created_at: Date.now(),
      updated_at: Date.now(),
      ownerId: authSession.user?.email || 'user',
    };

    setDb(prev => {
      if (!prev) return null;
      const updatedFolders = { ...prev.folders, [fid]: newFolder };
      if (activeFolderId !== 'root' && updatedFolders[activeFolderId]) {
        const parentF = { ...updatedFolders[activeFolderId] };
        parentF.is_container_folder = true;
        delete parentF.is_master_project_folder;
        delete parentF.is_master_bucket;
        parentF.updated_at = Date.now();
        updatedFolders[activeFolderId] = parentF;
      }
      return {
        ...prev,
        folders: updatedFolders
      };
    });

    setShowNewFolderModal(false);
    setNewFolderName('');
    showToast(`Folder "${cleanName}" created!`, 'success');

    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_folder',
          payload: { id: fid, ...newFolder }
        })
      });
      if (activeFolderId !== 'root') {
        fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_folder_type',
            payload: { fid: activeFolderId, type: 'container' }
          })
        }).catch(() => {});
      }
    } catch (_) {}
  };
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    sourceFid: string;
    sourceName: string;
  }>({
    isOpen: false,
    sourceFid: '',
    sourceName: ''
  });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    fid: string;
    name: string;
    itemType: 'master_bucket' | 'bucket' | 'folder';
  }>({
    isOpen: false,
    fid: '',
    name: '',
    itemType: 'folder'
  });
  // Ultra Internet Saving Mode (cuts mobile/Wi-Fi data usage by 85-92%)
  const { config: ultraConfig } = useUltraDataSaver();

  const dbEtagRef = useRef<string | null>(null);
  const jobsEtagRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (showAudioLibrary) {
        localStorage.setItem('ai_studio_audio_lib_open', 'true');
      } else {
        localStorage.removeItem('ai_studio_audio_lib_open');
      }
    } catch (_) {}
  }, [showAudioLibrary]);

  // Seamlessly persist currentFolderId to localStorage & URL so user always returns to where they left off
  useEffect(() => {
    try {
      if (currentFolderId) {
        localStorage.setItem('ai_studio_last_folder_id', currentFolderId);
        const url = new URL(window.location.href);
        if (currentFolderId === 'root') {
          url.searchParams.delete('folder');
          url.searchParams.delete('fid');
        } else {
          url.searchParams.set('folder', currentFolderId);
        }
        window.history.replaceState({}, '', url.toString());
      }
    } catch (_) {}
  }, [currentFolderId]);

  // Seamlessly persist Video Editor state to localStorage & URL so user always returns to where they left off
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (isVideoEditorOpen) {
        localStorage.setItem('ai_studio_editor_open', 'true');
        url.searchParams.set('editor', '1');
        if (videoEditorMasterFid) {
          localStorage.setItem('ai_studio_editor_master_fid', videoEditorMasterFid);
          url.searchParams.set('editor_fid', videoEditorMasterFid);
        }
        if (currentEditingProjectId) {
          localStorage.setItem('ai_studio_editor_project_id', currentEditingProjectId);
          url.searchParams.set('project', currentEditingProjectId);
        } else {
          url.searchParams.delete('project');
        }
        localStorage.setItem('ai_studio_editor_mode', editorMode);
        url.searchParams.set('mode', editorMode);
      } else {
        localStorage.removeItem('ai_studio_editor_open');
        url.searchParams.delete('editor');
        url.searchParams.delete('editor_fid');
        url.searchParams.delete('project');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (_) {}
  }, [isVideoEditorOpen, videoEditorMasterFid, currentEditingProjectId, editorMode]);

  const currentUserEmail = (authSession.user?.email || '').toLowerCase().trim();
  const isAdmin = authSession.user?.role === 'admin' || authSession.user?.isDefaultAdmin === true;

  const lastToastRef = useRef<{ msg: string; time: number }>({ msg: '', time: 0 });
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const now = Date.now();
    // Debounce rapid duplicate messages within 800ms to prevent visual flickering
    if (lastToastRef.current.msg === message && now - lastToastRef.current.time < 800) {
      return;
    }
    lastToastRef.current = { msg: message, time: now };
    const id = now.toString() + Math.random().toString(36).slice(2, 6);
    setToasts([ { id, type, message } ]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 950);
  }, []);

  // Fullscreen controller
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen(prev => !prev);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Check auth session on startup and maintain seamless persistence across restarts
  useEffect(() => {
    let isMounted = true;
    let initialEmail = '';

    try {
      const cached = localStorage.getItem('remixx_auth_user');
      if (cached) {
        const u = JSON.parse(cached);
        if (u && u.email) {
          initialEmail = u.email;
          setAuthSession({ user: u });
          setAuthChecking(false);
        }
      }
    } catch (_) {}

    // 1. Verify with server backend using cached identity header
    fetch('/api/auth/session', {
      headers: initialEmail ? { 'x-user-email': initialEmail } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data && data.authenticated && data.user) {
          setAuthSession({ user: data.user });
          try {
            localStorage.setItem('remixx_auth_user', JSON.stringify(data.user));
          } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setAuthChecking(false);
      });

    // 2. Bind to Firebase Auth persistent listener (restored automatically by Firebase SDK)
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;
      if (fbUser && fbUser.email) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/google/verify_token', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-user-email': fbUser.email
            },
            body: JSON.stringify({
              credential: idToken,
              email: fbUser.email,
              name: fbUser.displayName || fbUser.email.split('@')[0],
              avatar: fbUser.photoURL || ''
            })
          });
          const data = await res.json();
          if (data && data.success && data.user && isMounted) {
            setAuthSession({ user: data.user });
            try {
              localStorage.setItem('remixx_auth_user', JSON.stringify(data.user));
            } catch (_) {}
          }
        } catch (err) {
          console.warn("Persistent Firebase Auth check note:", err);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Fetch DB and Jobs with user context & ETag / 304 Not Modified support
  const fetchDB = useCallback(async () => {
    try {
      const uEmail = (authSession.user?.email || '').toLowerCase().trim();
      const headers: Record<string, string> = {};
      if (uEmail) headers['x-user-email'] = uEmail;
      if (dbEtagRef.current) {
        headers['If-None-Match'] = dbEtagRef.current;
      }

      const jobsHeaders: Record<string, string> = {};
      if (uEmail) jobsHeaders['x-user-email'] = uEmail;
      if (jobsEtagRef.current) {
        jobsHeaders['If-None-Match'] = jobsEtagRef.current;
      }

      const [dbRes, jobsRes] = await Promise.all([
        fetch('/api/db', { headers }),
        fetch('/api/jobs', { headers: jobsHeaders })
      ]);

      if (dbRes.status === 200) {
        const etag = dbRes.headers.get('ETag');
        if (etag) dbEtagRef.current = etag;
        const dbData = await dbRes.json();
        try {
          localStorage.setItem('remixx_cached_db', JSON.stringify(dbData));
        } catch (_) {}
        setDb(prev => {
          if (!prev) return dbData;
          // Protect newly created or updated projects from being overwritten by an in-flight poll response
          const mergedProjects = { ...(dbData.video_editor_projects || {}) };
          if (prev.video_editor_projects) {
            Object.entries(prev.video_editor_projects).forEach(([pid, p]) => {
              if (!mergedProjects[pid] || (p.updated_at || 0) > (mergedProjects[pid]?.updated_at || 0)) {
                mergedProjects[pid] = p;
              }
            });
          }

          // Protect folder_caption_templates from being wiped out or reverted by an in-flight poll response
          const mergedCaptionTemplates = { ...(dbData.folder_caption_templates || {}) };
          if (prev.folder_caption_templates) {
            Object.entries(prev.folder_caption_templates).forEach(([fid, tpls]) => {
              if (Array.isArray(tpls) && tpls.length > 0) {
                if (!mergedCaptionTemplates[fid] || mergedCaptionTemplates[fid].length === 0) {
                  mergedCaptionTemplates[fid] = tpls;
                } else {
                  const tMap = new Map<string, any>();
                  (mergedCaptionTemplates[fid] || []).forEach((t: any) => tMap.set(t.id, t));
                  tpls.forEach((t: any) => {
                    const serverT = tMap.get(t.id);
                    if (!serverT || (t.updated_at || 0) >= (serverT.updated_at || 0)) {
                      tMap.set(t.id, t);
                    }
                  });
                  mergedCaptionTemplates[fid] = Array.from(tMap.values());
                }
              }
            });
          }

          return {
            ...dbData,
            video_editor_projects: mergedProjects,
            folder_caption_templates: mergedCaptionTemplates
          };
        });
      } else if (dbRes.status === 304) {
        // 304 Not Modified: zero bytes transferred, keep current db state
      }

      if (jobsRes.status === 200) {
        const jEtag = jobsRes.headers.get('ETag');
        if (jEtag) jobsEtagRef.current = jEtag;
        const jobsData = await jobsRes.json();
        setJobs(Array.isArray(jobsData) ? jobsData : Object.values(jobsData || {}));
      } else if (jobsRes.status === 304) {
        // 304 Not Modified: zero bytes transferred, jobs unchanged
      }
    } catch (e) {
      console.warn("DB poll note:", e);
    }
  }, [authSession.user?.email]);

  // Adaptive ultra low-data polling:
  // - Polls every 12-15 seconds ONLY when render jobs are running
  // - In Ultra Data Saver mode, stretches idle poll to 75s (0 bytes on 304 Not Modified)
  // - COMPLETELY STOPS polling when tab is hidden or phone screen is locked (0 bytes consumed)
  useEffect(() => {
    fetchDB();

    let interval: any = null;
    const hasActiveJobs = jobs.some(j => j.status === 'processing' || j.status === 'rendering' || j.status === 'running' || j.status === 'queued' || j.status === 'dispatching');
    const intervalTime = hasActiveJobs ? 12000 : (ultraConfig.enabled ? 75000 : 20000);

    const startTimer = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchDB();
          if (ultraConfig.enabled) {
            recordDataSaved('polling_skip');
          }
        }
      }, intervalTime);
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchDB(); // Immediate refresh when user opens app
        startTimer();
      } else {
        if (interval) clearInterval(interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startTimer();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (interval) clearInterval(interval);
    };
  }, [fetchDB, ultraConfig.enabled, jobs]);

  const handleForceSyncBoth = async () => {
    if (isSyncingMainBot) return;
    setIsSyncingMainBot(true);
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.db) {
        setDb(data.db);
        try { localStorage.setItem('remixx_cached_db', JSON.stringify(data.db)); } catch (_) {}
      }
      if (db) {
        await saveDbToFirestore(db, authSession.user?.email || undefined);
      }
      showToast("Synced to Cloud", "success");
    } catch (err: any) {
      showToast(err?.message || "Sync error", "warning");
    } finally {
      setIsSyncingMainBot(false);
    }
  };


  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    try {
      localStorage.removeItem('remixx_auth_user');
      await auth.signOut();
    } catch (_) {}
    setAuthSession({ user: null });
    showToast("Signed out successfully", "info");
  };

  // Login is completely based on the email; all database folders and projects remain intact
  // and accessible across account logins as data is stored in the persistent database
  const canUserAccessFolder = useCallback((fid: string): boolean => {
    if (!db || !db.folders || !fid) return false;
    return true;
  }, [db]);

  const canUserAccessProject = useCallback((p: VideoEditorProject): boolean => {
    if (!p) return false;
    return true;
  }, []);

  const activeFolderId = currentFolderId || 'root';
  const currentFolder = db?.folders?.[activeFolderId] || null;

  // Determine if a folder is a Master Project Folder
  const isMasterProjectFolder = useCallback((folderId: string): boolean => {
    if (!db || !db.folders || folderId === 'root') return false;
    const f = db.folders[folderId];
    if (!f) return false;
    if (f.is_container_folder) return false;
    if (f.is_master_project_folder || f.is_master_bucket) return true;
    if (f.is_virtual_duplicate && (f.source_master_fid || f.sync_with_source !== undefined)) return true;
    const hasProjects = Object.values(db.video_editor_projects || {}).some(p => p.master_bucket_fid === folderId);
    if (hasProjects) return true;
    return false;
  }, [db]);
  const isBucketRootFolder = isMasterProjectFolder;

  // Helper to count projects inside a folder
  const getFolderProjectCount = useCallback((fid: string): number => {
    if (!db?.video_editor_projects) return 0;
    return Object.values(db.video_editor_projects).filter(p => {
      if (p.master_bucket_fid === fid) return true;
      const f = db.folders?.[fid];
      if (f?.source_folder_id && p.master_bucket_fid === f.source_folder_id) return true;
      if (f?.source_master_fid && p.master_bucket_fid === f.source_master_fid) return true;
      return false;
    }).length;
  }, [db]);

  // Recursively calculate the latest update timestamp for any folder
  const getFolderLatestTime = useCallback((fid: string): number => {
    if (!db || !db.folders) return 0;
    const f = db.folders[fid];
    let maxTime = f?.updated_at || f?.last_modified || f?.created_at || 0;

    // Check direct clips
    Object.values(db.videos || {}).forEach(v => {
      if (v.folder_id === fid && !db?.deleted_videos?.[v.id || '']) {
        const vt = v.created_at || (v as any).updated_at || 0;
        if (vt > maxTime) maxTime = vt;
      }
    });

    // Check projects
    Object.values(db.video_editor_projects || {}).forEach(p => {
      if (p.master_bucket_fid === fid) {
        const pt = p.updated_at || p.created_at || 0;
        if (pt > maxTime) maxTime = pt;
      }
    });

    // Check children recursively
    Object.entries(db.folders).forEach(([chId, chF]) => {
      if (chF.parent === fid && !db?.deleted_folders?.[chId]) {
        const ct = getFolderLatestTime(chId);
        if (ct > maxTime) maxTime = ct;
      }
    });

    return maxTime;
  }, [db]);

  // Helper to accurately resolve stats for any folder
  const getFolderStats = useCallback((fid: string) => {
    if (!db || !db.folders) return { type: 'leaf', label: 'Empty Folder', totalClips: 0, totalProjects: 0, latestTime: 0 };
    const directChildren = Object.entries(db.folders).filter(([id, f]) => f.parent === fid && !db.deleted_folders?.[id] && !f.is_uploads && !id.startsWith('uploads_'));
    const latestTime = getFolderLatestTime(fid);
    const totalProjects = getFolderProjectCount(fid);

    let totalClips = 0;
    Object.values(db.videos || {}).forEach(v => {
      if (!v || db.deleted_videos?.[v.id || '']) return;
      if (v.folder_id === fid || v.folder_id === `uploads_${fid}` || v.master_bucket_fid === fid) {
        totalClips++;
      }
    });

    return {
      type: 'master_project_folder',
      label: `${totalProjects} Projects • ${totalClips} Clips`,
      totalClips,
      totalProjects,
      subWorkspacesCount: directChildren.length,
      latestTime
    };
  }, [db, getFolderLatestTime, getFolderProjectCount]);

  // Count label for folders and master project folders:
  // Shows (3 folders) if subfolders exist, no P1/P2 badges per user specification
  const getFolderBadgeLabel = useCallback((fid: string, f?: FolderData | null): string => {
    if (!db || !db.folders) return '';
    const currentF = f || db.folders[fid];
    if (!currentF) return '';

    if (currentF.is_uploads || currentF.name.toLowerCase() === 'uploads' || fid.startsWith('uploads_')) {
      return '';
    }

    const directChildren = Object.entries(db.folders).filter(([id, ch]) => {
      if (id === 'root' || db.deleted_folders?.[id]) return false;
      if (ch.is_uploads || ch.name.toLowerCase() === 'uploads' || id.startsWith('uploads_')) return false;
      return ch.parent === fid;
    });

    if (directChildren.length > 0) {
      return `(${directChildren.length} folders)`;
    }

    return '';
  }, [db]);

  // Resolve subfolders inside activeFolderId sorted by latest update timestamp (most recent at top!)
  const workspaceFolders = useMemo(() => {
    if (!db || !db.folders) return [];

    const directChildren = Object.entries(db.folders).filter(([id, f]) => {
      if (id === 'root' || db.deleted_folders?.[id]) return false;
      if (f.is_uploads || f.name.toLowerCase() === 'uploads' || id.startsWith('uploads_')) return false;
      if (!canUserAccessFolder(id)) return false;
      if (activeFolderId === 'root') {
        return !f.parent || f.parent === 'root';
      }
      return f.parent === activeFolderId;
    });

    return directChildren.sort((a, b) => getFolderLatestTime(b[0]) - getFolderLatestTime(a[0]));
  }, [db, activeFolderId, canUserAccessFolder, getFolderLatestTime]);

  // Projects strictly belonging to this Master Project Folder (sorted: pinned first, then newest)
  const folderProjects = useMemo(() => {
    if (!db?.video_editor_projects || activeFolderId === 'root') return [];
    return Object.values(db.video_editor_projects)
      .filter(p => canUserAccessProject(p))
      .filter(p => {
        if (p.master_bucket_fid === activeFolderId) return true;
        const currentF = db.folders?.[activeFolderId];
        if (currentF?.source_folder_id && p.master_bucket_fid === currentF.source_folder_id) return true;
        if (currentF?.source_master_fid && p.master_bucket_fid === currentF.source_master_fid) return true;
        return false;
      })
      .sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const timeA = Math.max(a.updated_at || 0, a.last_modified || 0, a.created_at || 0);
        const timeB = Math.max(b.updated_at || 0, b.last_modified || 0, b.created_at || 0);
        return timeB - timeA;
      });
  }, [db, activeFolderId, canUserAccessProject]);

  // Suggested next version name: e.g. "Action Film V1", "Action Film V2"
  const suggestedNextProjectInfo = useMemo(() => {
    const fName = currentFolder?.name || 'Master Project';
    return computeNextProjectVersionName(fName, folderProjects);
  }, [currentFolder?.name, folderProjects]);

  const activeMasterBucketInfo = useMemo(() => {
    if (activeFolderId === 'root') return null;
    return {
      masterFid: activeFolderId,
      masterName: currentFolder?.name || 'Master Project Folder',
      hasGeneralPartition: true,
      hasAiPartition: false,
      generalBucketsCount: 0,
      generalClipsCount: 0,
      aiBucketsCount: 0,
      aiClipsCount: 0
    };
  }, [activeFolderId, currentFolder]);

  // Folder classification: Master Project Folder vs Container Folder vs Uncommitted
  const isFolderContainer = useMemo(() => {
    if (activeFolderId === 'root') return false;
    if (workspaceFolders.length > 0) return true;
    if (currentFolder?.is_container_folder) return true;
    return false;
  }, [activeFolderId, workspaceFolders.length, currentFolder]);

  const isFolderMaster = useMemo(() => {
    if (activeFolderId === 'root') return false;
    // Once a folder has subfolders or is container, it cannot be converted to master project folder
    if (isFolderContainer) return false;
    if (folderProjects.length > 0) return true;
    if (currentFolder?.is_master_project_folder || currentFolder?.is_master_bucket || currentFolder?.is_virtual_duplicate) return true;
    return false;
  }, [activeFolderId, isFolderContainer, folderProjects.length, currentFolder]);

  const isFolderUncommitted = activeFolderId !== 'root' && !isFolderMaster && !isFolderContainer;

  // Video clips inside activeFolderId (ON ROOT: Never show loose videos; Uploads are accessed exclusively via corner bubble drawer)
  const currentVideos = useMemo(() => {
    if (!db || !db.videos || activeFolderId === 'root') return [];
    const fObj = db.folders?.[activeFolderId];
    const sourceFid = fObj?.source_folder_id;
    const isFrozenSnapshot = fObj?.sync_with_source === false && Array.isArray(fObj?.frozen_video_ids);

    return Object.entries(db.videos)
      .filter(([id, v]) => {
        if (db.deleted_videos?.[id]) return false;
        // Uploads are accessed exclusively via the corner bubble button drawer, not loose in the folder
        if (v.is_upload || v.folder_id?.startsWith('uploads_')) return false;
        if (v.folder_id === activeFolderId) return true;
        if (isFrozenSnapshot) {
          return fObj.frozen_video_ids!.includes(id);
        }
        if (sourceFid && v.folder_id === sourceFid) return true;
        return false;
      })
      .sort((a, b) => {
        const vA = a[1];
        const vB = b[1];
        // Hidden clips go to the absolute end of the bucket
        if (vA.is_hidden && !vB.is_hidden) return 1;
        if (!vA.is_hidden && vB.is_hidden) return -1;
        return (b[1].created_at || 0) - (a[1].created_at || 0);
      });
  }, [db, activeFolderId]);

  // Breadcrumbs trail
  const breadcrumbs = useMemo(() => {
    const trail: { id: string; name: string }[] = [];
    if (!db || !db.folders) return [{ id: 'root', name: 'Home' }];
    let curr: string | null = activeFolderId;
    const visited = new Set<string>();
    while (curr && curr !== 'root' && !visited.has(curr)) {
      visited.add(curr);
      const f = db.folders[curr];
      if (f) {
        trail.unshift({ id: curr, name: f.name || 'Folder' });
        curr = f.parent || null;
      } else {
        break;
      }
    }
    trail.unshift({ id: 'root', name: 'Home' });
    return trail;
  }, [db, activeFolderId]);

  // Active Master Bucket resolution for uploads bubble drawer & project scoping
  const activeMasterFid = activeMasterBucketInfo?.masterFid || (
    isBucketRootFolder(activeFolderId) || currentFolder?.is_master_bucket
      ? activeFolderId
      : (currentFolder && isAnyBucket(currentFolder.name, currentFolder) ? (currentFolder.parent || activeFolderId) : null)
  );

  const activeMasterName = activeMasterBucketInfo?.masterName || (activeMasterFid ? db?.folders?.[activeMasterFid]?.name : '') || 'Master Bucket';

  // Helper to recursively collect all descendant Master Bucket IDs under a given folder ID
  const getDescendantMasterBucketIds = useCallback((folderId: string): Set<string> => {
    const result = new Set<string>();
    if (!db?.folders || !folderId || folderId === 'root') return result;

    const traverse = (fid: string) => {
      Object.entries(db.folders).forEach(([id, f]) => {
        if (id === 'root' || db.deleted_folders?.[id]) return;
        if (f.parent !== fid) return;
        if (isBucketRootFolder(id) || f.is_master_bucket || f.is_virtual_duplicate) {
          result.add(id);
          if (f.source_folder_id) result.add(f.source_folder_id);
        }
        traverse(id);
      });
    };

    traverse(folderId);
    return result;
  }, [db, isBucketRootFolder]);

  // Contextual projects pool based on exact location:
  // 1. Inside a Master Bucket -> only projects of this master bucket (sorted recent first)
  // 2. Inside a Folder -> projects of all master buckets inside this folder (sorted recent first)
  // 3. Completely out (Root) -> all projects across all master buckets (sorted recent first)
  const contextualProjects = useMemo(() => {
    if (!db?.video_editor_projects) return [];
    const all = Object.values(db.video_editor_projects).filter(p => canUserAccessProject(p));

    let filtered: VideoEditorProject[] = [];

    if (activeMasterFid) {
      // Case 1: Inside a Master Bucket
      const targetFid = activeMasterFid;
      const targetFolder = db.folders?.[targetFid];
      const sourceFid = targetFolder?.source_folder_id;

      filtered = all.filter(p => 
        p.master_bucket_fid === targetFid || (sourceFid && p.master_bucket_fid === sourceFid)
      );
    } else if (activeFolderId !== 'root') {
      // Case 2: Outside master bucket, inside a folder
      const descendantMasterIds = getDescendantMasterBucketIds(activeFolderId);
      filtered = all.filter(p => p.master_bucket_fid && (
        descendantMasterIds.has(p.master_bucket_fid) || p.master_bucket_fid === activeFolderId
      ));
    } else {
      // Case 3: Completely out (Home / Root)
      filtered = all;
    }

    // Sort recent one by recent (most recent on top)
    return filtered.sort((a, b) => {
      const timeA = a.updated_at || a.last_modified || a.created_at || 0;
      const timeB = b.updated_at || b.last_modified || b.created_at || 0;
      return timeB - timeA;
    });
  }, [db, activeMasterFid, activeFolderId, canUserAccessProject, getDescendantMasterBucketIds]);

  // Resolved Master Bucket for uploads (either explicitly selected from an upload folder or current master)
  const effectiveUploadsMasterFid = selectedUploadsMasterFid || activeMasterFid;
  const effectiveUploadsMasterName = effectiveUploadsMasterFid ? (db?.folders?.[effectiveUploadsMasterFid]?.name || activeMasterName) : activeMasterName;

  // Master Bucket uploads collection (Uploads are saved in a bubble button at the corner, not as folders/buckets)
  const masterBucketUploads = useMemo(() => {
    if (!effectiveUploadsMasterFid || !db?.videos) return [];
    const uploadsFolderId = 'uploads_' + effectiveUploadsMasterFid;
    return Object.entries(db.videos)
      .filter(([id, v]) => {
        if (!v || db.deleted_videos?.[id]) return false;
        if (v.folder_id === uploadsFolderId) return true;
        if (v.master_bucket_fid === effectiveUploadsMasterFid && v.is_upload) return true;
        if (v.is_upload && (v.folder_id === effectiveUploadsMasterFid || v.folder_id?.startsWith('uploads_'))) return true;
        const parentF = db.folders?.[v.folder_id];
        if (parentF && (parentF.is_uploads || parentF.name.toLowerCase() === 'uploads') && parentF.parent === effectiveUploadsMasterFid) {
          return true;
        }
        return false;
      })
      .map(([id, v]) => ({ ...v, id }))
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [db, effectiveUploadsMasterFid]);

  const handleUploadMasterBucketFiles = async (files: FileList | File[]) => {
    if (!effectiveUploadsMasterFid) return;
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    if (totalFiles === 0) return;

    setIsUploadingMasterClips(true);
    setUploadMasterClipsProgress(10);
    setUploadMasterClipsStats({ current: 1, total: totalFiles });
    try {
      const targetFolderId = 'uploads_' + effectiveUploadsMasterFid;
      for (let i = 0; i < totalFiles; i++) {
        setUploadMasterClipsStats({ current: i + 1, total: totalFiles });
        const file = fileArray[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', targetFolderId);
        formData.append('master_bucket_fid', effectiveUploadsMasterFid);
        formData.append('is_upload', 'true');

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.ok && data.video) {
          setDb(prev => prev ? {
            ...prev,
            videos: { ...prev.videos, [data.video.id]: data.video }
          } : null);
        }
        setUploadMasterClipsProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
      showToast(`Uploaded ${totalFiles} clip(s) to Master Bucket!`, 'success');
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsUploadingMasterClips(false);
      setUploadMasterClipsProgress(0);
      setUploadMasterClipsStats(null);
    }
  };

  const handleDeleteUploadClip = async (vid: string) => {
    setDb(prev => {
      if (!prev || !prev.videos?.[vid]) return prev;
      const nextVideos = { ...prev.videos };
      const nextDeleted = { ...(prev.deleted_videos || {}) };
      nextDeleted[vid] = Date.now();
      delete nextVideos[vid];
      return { ...prev, videos: nextVideos, deleted_videos: nextDeleted };
    });
    showToast("Uploaded clip deleted", "info");
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_video', payload: { vid } })
      });
    } catch (_) {}
  };

  // Resolved project, clips, and jobs for effective master bucket (used in Uploads / Clips drawer)
  const uploadsMasterProject = useMemo(() => {
    if (!effectiveUploadsMasterFid || !db?.video_editor_projects) return null;
    const projs = Object.values(db.video_editor_projects).filter(p => 
      p.master_bucket_fid === effectiveUploadsMasterFid || (p as any).folder_id === effectiveUploadsMasterFid
    );
    if (projs.length > 0) {
      return projs.sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0))[0];
    }
    return contextualProjects[0] || null;
  }, [effectiveUploadsMasterFid, db, contextualProjects]);

  const uploadsMasterClips = useMemo(() => {
    return uploadsMasterProject?.clips || [];
  }, [uploadsMasterProject]);

  const uploadsMasterJobs = useMemo(() => {
    if (!db?.higgsfield_jobs) return [];
    return Object.values(db.higgsfield_jobs);
  }, [db]);

  const handleUpdateUploadsProjectClips = (newClips: any[]) => {
    if (!uploadsMasterProject) return;
    setDb(prev => {
      if (!prev || !prev.video_editor_projects?.[uploadsMasterProject.id]) return prev;
      return {
        ...prev,
        video_editor_projects: {
          ...prev.video_editor_projects,
          [uploadsMasterProject.id]: {
            ...prev.video_editor_projects[uploadsMasterProject.id],
            clips: newClips,
            updated_at: Date.now()
          }
        }
      };
    });
    fetch(`/api/projects/${uploadsMasterProject.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: newClips })
    }).catch(err => console.error('Failed to update project clips', err));
  };

  // Video Editor Launchers
  const handleInitiateVideoEditor = (masterFid: string, modeOverride?: 'general' | 'ai') => {
    setVideoEditorMasterFid(masterFid);
    setCurrentEditingProjectId(null);
    if (modeOverride) setEditorMode(modeOverride);
    setIsVideoEditorOpen(true);
  };

  const handleOpenProjectDirectly = (masterFid: string, projectId: string, modeOverride?: 'general' | 'ai') => {
    setVideoEditorMasterFid(masterFid);
    setCurrentEditingProjectId(projectId);
    if (modeOverride) setEditorMode(modeOverride);
    setIsVideoEditorOpen(true);
    setIsProjectSidePanelOpen(false);
  };

  // INSTANT PROJECT CREATION: Directly generates and opens project with zero dialog bouncing!
  const handleCreateNewProjectAndOpen = async (targetFid: string, modeOverride?: 'general' | 'ai', customName?: string) => {
    // Resolve the real master bucket fid and mode:
    let resolvedMasterFid = targetFid;
    let resolvedMode = modeOverride || editorMode;
    const targetFolder = db?.folders?.[targetFid];
    if (targetFolder) {
      if (isAiBucket(targetFolder.name, targetFolder)) {
        resolvedMode = 'ai';
        if (targetFolder.parent && targetFolder.parent !== 'root') resolvedMasterFid = targetFolder.parent;
      } else if (isNormalBucket(targetFolder.name, targetFolder)) {
        resolvedMode = 'general';
        if (targetFolder.parent && targetFolder.parent !== 'root') resolvedMasterFid = targetFolder.parent;
      }
    }

    // Ensure folder is converted into a Master Bucket and has dedicated Uploads folder
    const targetFolderObj = db?.folders?.[resolvedMasterFid];
    if (targetFolderObj && !targetFolderObj.is_master_bucket) {
      targetFolderObj.is_master_bucket = true;
      targetFolderObj.updated_at = Date.now();
      const uploadsFid = `uploads_${resolvedMasterFid}`;
      if (!db.folders[uploadsFid]) {
        db.folders[uploadsFid] = {
          name: 'Uploads',
          parent: resolvedMasterFid,
          is_uploads: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert_to_master_bucket',
          payload: { fid: resolvedMasterFid }
        })
      }).catch(() => {});
    }

    const mode = resolvedMode;
    const masterFolder = db?.folders?.[resolvedMasterFid];
    const folderName = masterFolder?.name || 'Master Project';
    const existingInFolder = Object.values(db?.video_editor_projects || {}).filter(p => 
      p.master_bucket_fid === resolvedMasterFid
    );
    const { defaultName } = computeNextProjectVersionName(folderName, existingInFolder);
    const finalName = customName?.trim() || defaultName;

    // Check if any sibling project in this Master Project Folder already has title templates configured
    const siblingProject = existingInFolder.find(p => p.title_templates && p.title_templates.length > 0);
    const inheritedTitleTemplates = siblingProject?.title_templates 
      ? JSON.parse(JSON.stringify(siblingProject.title_templates)) 
      : [];
    const inheritedActiveTplId = siblingProject?.active_title_template_id;

    // Clean slate for new project with Master Project Folder inherited title templates
    const newProj: VideoEditorProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: finalName,
      master_bucket_fid: resolvedMasterFid,
      mode: mode,
      clips: [],
      captions: [],
      caption_templates: [],
      title_templates: inheritedTitleTemplates,
      active_title_template_id: inheritedActiveTplId,
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

    // Optimistically update local database
    setDb(prev => {
      if (!prev) return prev;
      const projs = { ...(prev.video_editor_projects || {}) };
      projs[newProj.id] = newProj;
      return { ...prev, video_editor_projects: projs };
    });

    // Save to localStorage immediately so no fallback to old candidate occurs!
    try {
      localStorage.setItem(`ai_studio_last_active_project_${resolvedMasterFid}`, newProj.id);
    } catch (_) {}

    // Open Video Editor INSTANTLY on this new project (0ms delay, no waiting!)
    setVideoEditorMasterFid(resolvedMasterFid);
    setCurrentEditingProjectId(newProj.id);
    setEditorMode(mode);
    setIsVideoEditorOpen(true);
    setIsProjectSidePanelOpen(false);
    showToast(`Created project "${defaultName}"`, "success");

    // Persist to server reliably
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_video_editor_project', payload: { project: newProj } })
      });
    } catch (err) {
      console.warn("Background project save note:", err);
    }
  };

  // Video Editor Project Actions
  const handleSaveVideoEditorProject = async (project: VideoEditorProject) => {
    try {
      const cleanProject: VideoEditorProject = {
        ...project,
        clips: (project.clips || []).map(c => ({
          ...c,
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
          active_variant_index: c.active_variant_index,
          active_variant_group_index: c.active_variant_group_index,
          variants: c.variants ? c.variants.map(v => ({ ...v })) : undefined,
          variant_groups: c.variant_groups ? c.variant_groups.map(g => ({
            ...g,
            clips: (g.clips || []).map(gc => ({ ...gc }))
          })) : undefined,
        })),
        captions: (project.captions || []).map(cap => ({ ...cap })),
        audio_clips: (project.audio_clips || []).map(ac => ({ ...ac })),
        vault_unused_clips: (project.vault_unused_clips || []).map(vc => ({ ...vc })),
      };

      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_video_editor_project', payload: { project: cleanProject } })
      });
      if (res.ok) {
        setDb(prev => {
          if (!prev) return prev;
          const projs = { ...(prev.video_editor_projects || {}) };
          projs[cleanProject.id] = cleanProject;
          const updated = { ...prev, video_editor_projects: projs };
          try {
            localStorage.setItem('remixx_cached_db', JSON.stringify(updated));
          } catch (_) {}
          // Dual save to Firebase Firestore in parallel with Telegram channel auto-sync
          saveDbToFirestore(updated, authSession.user?.email || undefined).catch(() => {});
          return updated;
        });
        showToast("Project saved successfully", "success");
      }
    } catch {
      showToast("Error saving project", "error");
    }
  };

  const handleDeleteVideoEditorProject = async (projectId: string) => {
    // 1. INSTANT optimistic removal from state (0ms delay)
    setDb(prev => {
      if (!prev || !prev.video_editor_projects) return prev;
      const projs = { ...prev.video_editor_projects };
      delete projs[projectId];
      return { ...prev, video_editor_projects: projs };
    });
    showToast("Project deleted", "info");

    // 2. Persist to server in background
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_video_editor_project', payload: { projectId } })
      });
    } catch (_) {}
  };

  const handleDuplicateProject = async (sourceProj: VideoEditorProject) => {
    const duplicatedProj: VideoEditorProject = {
      ...JSON.parse(JSON.stringify(sourceProj)),
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: `${sourceProj.name} (Copy)`,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    setDb(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        video_editor_projects: {
          ...(prev.video_editor_projects || {}),
          [duplicatedProj.id]: duplicatedProj
        }
      };
    });
    showToast(`Duplicated project "${duplicatedProj.name}"`, "success");
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_video_editor_project', payload: { project: duplicatedProj } })
      });
    } catch (_) {}
  };

  // Circular Plus Bubble Action Dispatcher
  const handlePlusBubbleClick = () => {
    if (activeFolderId === 'root') {
      setNewFolderName('');
      setShowNewFolderModal(true);
      return;
    }

    if (isFolderMaster) {
      setShowCreateProjectModal(true);
      return;
    }

    if (isFolderContainer) {
      setNewFolderName('');
      setShowNewFolderModal(true);
      return;
    }

    // Empty uncommitted folder: ask user whether to add a Project or a Subfolder
    setShowChooseFolderTypeModal(true);
  };

  const handleChooseProjectForFolder = () => {
    setShowChooseFolderTypeModal(false);
    setDb(prev => {
      if (!prev || !prev.folders?.[activeFolderId]) return prev;
      const f = { 
        ...prev.folders[activeFolderId], 
        is_master_project_folder: true,
        is_master_bucket: true,
        updated_at: Date.now() 
      };
      delete f.is_container_folder;
      return { ...prev, folders: { ...prev.folders, [activeFolderId]: f } };
    });
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert_to_master_bucket', payload: { fid: activeFolderId } })
    }).catch(() => {});
    setShowCreateProjectModal(true);
  };

  const handleChooseSubfolderForFolder = () => {
    setShowChooseFolderTypeModal(false);
    setDb(prev => {
      if (!prev || !prev.folders?.[activeFolderId]) return prev;
      const f = { 
        ...prev.folders[activeFolderId], 
        is_container_folder: true,
        updated_at: Date.now() 
      };
      delete f.is_master_project_folder;
      delete f.is_master_bucket;
      return { ...prev, folders: { ...prev.folders, [activeFolderId]: f } };
    });
    fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_folder_type', payload: { fid: activeFolderId, type: 'container' } })
    }).catch(() => {});
    setNewFolderName('');
    setShowNewFolderModal(true);
  };

  const handleDeleteVideo = async (vid: string) => {
    // 1. INSTANT optimistic removal from state (0ms delay)
    setDb(prev => {
      if (!prev || !prev.videos) return prev;
      const vids = { ...prev.videos };
      delete vids[vid];
      const del = { ...(prev.deleted_videos || {}), [vid]: Date.now() };
      return { ...prev, videos: vids, deleted_videos: del };
    });
    showToast("Clip deleted", "info");

    // 2. Persist to server in background
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_video', payload: { video_id: vid } })
      });
    } catch (_) {}
  };

  const handleRenameVideoEditorProject = async (projectId: string, newName: string) => {
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename_video_editor_project', payload: { projectId, newName } })
      });
      if (res.ok) {
        setDb(prev => {
          if (!prev || !prev.video_editor_projects?.[projectId]) return prev;
          const p = { ...prev.video_editor_projects[projectId], name: newName, updated_at: Date.now() };
          return { ...prev, video_editor_projects: { ...prev.video_editor_projects, [projectId]: p } };
        });
        showToast("Project renamed", "success");
      }
    } catch {
      showToast("Failed to rename project", "error");
    }
  };

  const handleTogglePinEditorProject = async (projectId: string) => {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_pin_editor_project', payload: { projectId } })
      });
      setDb(prev => {
        if (!prev || !prev.video_editor_projects?.[projectId]) return prev;
        const p = { ...prev.video_editor_projects[projectId], is_pinned: !prev.video_editor_projects[projectId].is_pinned };
        return { ...prev, video_editor_projects: { ...prev.video_editor_projects, [projectId]: p } };
      });
    } catch {}
  };

  const handleMarkClipsUsed = async (vids: string[]) => {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_clips_used', payload: { video_ids: vids } })
      });
    } catch {}
  };

  // Persistent Clip Priority Handlers (Star, Default, Freeze)
  const handleToggleVideoStar = async (vid: string) => {
    setDb(prev => {
      if (!prev || !prev.videos?.[vid]) return prev;
      const v = { ...prev.videos[vid], is_starred: !prev.videos[vid].is_starred };
      return { ...prev, videos: { ...prev.videos, [vid]: v } };
    });
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_video_star', payload: { vid } })
      });
      showToast("Clip priority updated", "success");
    } catch {}
  };

  const handleToggleVideoDefault = async (vid: string) => {
    setDb(prev => {
      if (!prev || !prev.videos?.[vid]) return prev;
      const v = { ...prev.videos[vid], is_default: !prev.videos[vid].is_default };
      return { ...prev, videos: { ...prev.videos, [vid]: v } };
    });
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_video_default', payload: { vid } })
      });
      showToast("Default clip updated", "success");
    } catch {}
  };

  const handleToggleVideoFreeze = async (vid: string) => {
    setDb(prev => {
      if (!prev || !prev.videos?.[vid]) return prev;
      const v = { ...prev.videos[vid], is_frozen: !prev.videos[vid].is_frozen };
      return { ...prev, videos: { ...prev.videos, [vid]: v } };
    });
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_video_freeze', payload: { vid } })
      });
      showToast("Freeze status updated", "info");
    } catch {}
  };

  const handleToggleVideoHide = async (vid: string) => {
    const nextVal = !Boolean(db?.videos?.[vid]?.is_hidden);
    setDb(prev => {
      if (!prev || !prev.videos?.[vid]) return prev;
      const v = { ...prev.videos[vid], is_hidden: nextVal };
      return { ...prev, videos: { ...prev.videos, [vid]: v } };
    });
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_video_hidden', payload: { vid, is_hidden: nextVal } })
      });
      showToast(nextVal ? "Clip hidden across Master Bucket 🚫" : "Clip unhidden in Master Bucket", "info");
    } catch {}
  };

  const handleOpenDuplicateMasterBucketModal = (sourceFid: string) => {
    const sourceFolder = db?.folders?.[sourceFid];
    if (!sourceFolder) return;
    setDuplicateModal({
      isOpen: true,
      sourceFid,
      sourceName: sourceFolder.name
    });
  };

  const handleConfirmDuplicateMasterBucket = async (newName: string, syncWithSource: boolean) => {
    const sourceFid = duplicateModal.sourceFid;
    if (!sourceFid) return;

    try {
      showToast(syncWithSource ? "Duplicating Master Bucket (Live Sync)..." : "Duplicating Master Bucket (Local Snapshot)...", "info");
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'duplicate_master_bucket',
          payload: { 
            sourceMasterFid: sourceFid, 
            newName: newName.trim(),
            syncWithSource
          }
        })
      });
      const data = await res.json();
      if (data.success && data.db) {
        setDb(data.db);
        showToast(
          syncWithSource 
            ? `Master Bucket duplicated (Live Synced)! Created "${newName.trim()}"` 
            : `Master Bucket duplicated (Local Snapshot)! Created "${newName.trim()}"`, 
          "success"
        );
        if (data.newMasterFid) {
          setCurrentFolderId(data.newMasterFid);
        }
      } else {
        showToast(data.error || "Failed to duplicate Master Bucket", "error");
      }
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to duplicate'}`, "error");
    }
  };

  const handleRequestDelete = (fid: string, name?: string, itemType?: 'master_bucket' | 'bucket' | 'folder') => {
    if (!fid || fid === 'root') return;
    const f = db?.folders?.[fid];
    const resolvedName = name || f?.name || 'Folder';
    let resolvedType: 'master_bucket' | 'bucket' | 'folder' = itemType || 'folder';
    if (!itemType) {
      if (isAnyBucket(f?.name, f)) {
        resolvedType = 'bucket';
      } else if (isBucketRootFolder(fid) || f?.is_master_bucket || f?.is_virtual_duplicate) {
        resolvedType = 'master_bucket';
      } else {
        resolvedType = 'folder';
      }
    }
    setDeleteConfirmModal({
      isOpen: true,
      fid,
      name: resolvedName,
      itemType: resolvedType
    });
  };

  const handleConfirmDelete = async () => {
    const { fid, name, itemType } = deleteConfirmModal;
    if (!fid || fid === 'root') return;
    const targetFolder = db?.folders?.[fid];
    const targetParent = targetFolder?.parent || 'root';

    // Collect all descendant folder IDs recursively
    const fidsToDelete = new Set<string>([fid]);
    const collectDescendants = (parentId: string) => {
      Object.entries(db?.folders || {}).forEach(([childId, childF]) => {
        if (childF.parent === parentId && !fidsToDelete.has(childId)) {
          fidsToDelete.add(childId);
          collectDescendants(childId);
        }
      });
    };
    collectDescendants(fid);

    // 1. INSTANT optimistic removal from local UI state (0ms delay)
    setDb(prev => {
      if (!prev?.folders) return prev;
      const nextFolders = { ...prev.folders };
      const nextDeletedFolders = { ...(prev.deleted_folders || {}) };
      const nextProjects = { ...(prev.video_editor_projects || {}) };

      fidsToDelete.forEach(id => {
        if (nextFolders[id]) {
          nextDeletedFolders[id] = Date.now();
          delete nextFolders[id];
        }
      });

      if (itemType === 'master_bucket') {
        Object.entries(nextProjects).forEach(([pid, p]) => {
          if (fidsToDelete.has(p.master_bucket_fid || '')) {
            delete nextProjects[pid];
          }
        });
      }

      return {
        ...prev,
        folders: nextFolders,
        deleted_folders: nextDeletedFolders,
        video_editor_projects: nextProjects
      };
    });

    if (activeFolderId === fid || fidsToDelete.has(activeFolderId)) {
      setCurrentFolderId(targetParent);
    }

    setDeleteConfirmModal({ isOpen: false, fid: '', name: '', itemType: 'folder' });
    const label = itemType === 'master_bucket' ? 'Master Bucket' : itemType === 'bucket' ? 'Bucket' : 'Folder';
    showToast(`${label} "${name}" deleted`, "info");

    // 2. Persist to server in background
    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_folder',
          payload: { fid }
        })
      });
      const data = await res.json();
      if (data.success && data.db) {
        setDb(data.db);
      }
    } catch (_) {}
  };

  const handleSelectToggle = (vid: string) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(vid)) next.delete(vid);
      else next.add(vid);
      return next;
    });
  };

  const handlePlayClip = (fileId: string) => {
    const videoEntry = Object.values(db?.videos || {}).find(v => v.file_id === fileId || v.id === fileId);
    const videoUrl = `/api/video/${fileId}`;
    setPreviewVideo({
      url: videoUrl,
      title: videoEntry?.name || videoEntry?.source_name || `Clip ${fileId.slice(-6)}`,
      fileId,
      duration: videoEntry?.duration,
      isMuted: Boolean(videoEntry?.audio_muted)
    });
  };

  const handleDownloadClip = (id: string, v: VideoData) => {
    const url = v.url?.startsWith('/api/') ? v.url : (v.file_id ? `/api/video/${v.file_id}` : (v.id ? `/api/video/${v.id}` : `/api/video/${id}`));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${v.name || 'clip'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Download started", "info");
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col font-sans select-none">
      {/* Toast Notifications - Ultra-compact, non-disturbing micro hairline indicator flush at top screen edge */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center max-w-[95vw]">
        {toasts.slice(-1).map(t => (
          <div 
            key={t.id} 
            className="pointer-events-none h-4 sm:h-4.5 px-2.5 rounded-b-md shadow-xs bg-gray-950/90 backdrop-blur-md border-b border-x border-gray-800/90 text-[8px] sm:text-[8.5px] font-medium text-gray-300 flex items-center gap-1.5 transition-all transform animate-in fade-in slide-in-from-top-0.5 duration-100 whitespace-nowrap select-none"
          >
            <span className={`w-1 h-1 rounded-full shrink-0 ${
              t.type === 'success' ? 'bg-emerald-400' :
              t.type === 'error' ? 'bg-rose-400' :
              t.type === 'warning' ? 'bg-amber-400' :
              'bg-purple-400'
            }`} />
            <span className="truncate max-w-[75vw] sm:max-w-[320px] tracking-tight">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 h-11 sm:h-12 border-b border-gray-800/80 bg-gray-900/95 backdrop-blur-md flex items-center justify-between px-2 sm:px-4 gap-2 shrink-0">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
          <button 
            onClick={() => setCurrentFolderId('root')} 
            className="flex items-center gap-1.5 group shrink-0 cursor-pointer"
            title="Go to Home"
          >
            <div className="p-1.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 rounded-lg shadow-sm shadow-purple-500/20 group-hover:scale-105 transition shrink-0">
              <Film size={15} className="text-white" />
            </div>
            <span className="font-black text-xs sm:text-sm tracking-tight text-white group-hover:text-purple-400 transition hidden xs:inline truncate">
              Vd Studio
            </span>
          </button>

          <div className="h-3.5 w-px bg-gray-800 shrink-0 hidden sm:block"></div>

          {/* Breadcrumb Trail */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id + idx}>
                {idx > 0 && <ChevronRight size={10} className="text-gray-600 shrink-0" />}
                <button
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition shrink-0 cursor-pointer truncate max-w-[100px] sm:max-w-[140px] ${
                    idx === breadcrumbs.length - 1
                      ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Essential Top Bar Controls: Status Dot, Audio Library, Fullscreen & Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Status Dot: Green (Saved) / Red (Issue) with Instant Time / Issue Feedback */}
          <SyncStatusBadge 
            currentUserEmail={authSession.user?.email} 
            onForceSync={handleForceSyncBoth}
            isSyncingExternal={isSyncingMainBot}
            onToast={showToast}
          />

          {/* Audio Library Button */}
          <button
            onClick={() => setShowAudioLibrary(true)}
            className="p-1.5 rounded-lg border border-pink-500/40 bg-pink-950/40 hover:bg-pink-900/60 text-pink-300 hover:text-pink-200 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
            title={`Audio Library (${Object.keys(db?.audios || {}).length} tracks)`}
          >
            <Music size={14} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg border border-gray-700/60 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Settings & Tools Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded-lg border border-gray-700/60 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95 shadow-sm"
            title="Settings & GPU Pipeline"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 sm:py-6 pb-40">
        {/* Current Folder Header Bar - Sleek, Compact & Responsive */}
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-800/80">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {activeFolderId !== 'root' && (
              <button 
                onClick={() => setCurrentFolderId(currentFolder?.parent || 'root')}
                className="p-1.5 bg-gray-850 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition border border-gray-700/60 shrink-0 cursor-pointer"
                title="Back to parent directory"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 truncate">
                <h2 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-1.5">
                  {activeFolderId === 'root' ? (
                    <Folder className="text-blue-400 shrink-0" size={16} />
                  ) : (
                    <Layers className="text-purple-400 shrink-0" size={16} />
                  )}
                  <span className="truncate">{activeFolderId === 'root' ? 'Home' : (currentFolder?.name || 'Folder')}</span>
                  {currentFolder?.is_virtual_duplicate && (
                    <span className="text-[9px] font-mono text-pink-300 font-bold px-1.5 py-0.5 rounded-md bg-pink-950/70 border border-pink-700/60 shrink-0">
                      {currentFolder.sync_with_source ? 'Live Synced' : 'Snapshot'}
                    </span>
                  )}
                </h2>
                {activeFolderId === 'root' && (
                  <span className="text-[10px] text-cyan-300 font-mono font-bold shrink-0 truncate">
                    {workspaceFolders.length} folders
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Folder Action Buttons - Ultra-compact, Icon-Only for Android & Mobile */}
          <div className="flex items-center gap-1.5 shrink-0 justify-end">
            {/* UPLOADS BUTTON - Clean without number badge */}
            {activeFolderId !== 'root' && (
              <button
                type="button"
                onClick={() => setShowUploadsDrawer(true)}
                className="px-2.5 py-1.5 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800 hover:to-indigo-800 text-purple-200 border border-purple-500/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Folder Uploads"
              >
                <UploadCloud size={14} className="text-purple-300" />
                <span className="hidden sm:inline">Uploads</span>
              </button>
            )}

            {/* History Button - Icon Only */}
            <button 
              type="button"
              onClick={() => {
                setExportHistoryInitialProjectId(null);
                setShowExportGenerationHistory(true);
              }}
              className="p-1.5 bg-gray-850 hover:bg-gray-800 text-cyan-300 rounded-lg border border-cyan-800/40 transition active:scale-95 cursor-pointer shrink-0"
              title="Generation History"
            >
              <Clock size={14} />
            </button>
          </div>
        </div>

        {/* Selected Clips Floating Action Toolbar */}
        {selectedVideoIds.size > 0 && (
          <div className="mb-4 p-2 bg-purple-950/90 border border-purple-500/50 rounded-xl flex items-center justify-between gap-2 shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.2 bg-purple-600 text-white text-[11px] font-bold font-mono rounded-md">
                {selectedVideoIds.size} Selected
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const masterFid = isBucketRootFolder(activeFolderId) ? activeFolderId : (currentFolder?.parent || activeFolderId);
                  handleInitiateVideoEditor(masterFid, editorMode);
                }}
                className="py-1 px-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
              >
                <Film size={12} />
                <span>Open Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVideoIds(new Set())}
                className="py-1 px-2 text-xs text-gray-400 hover:text-white transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* HOME VIEW: Directly Display Workspaces (No master buckets tab, no loose clip/MB counts) */}
        {activeFolderId === 'root' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Folder size={14} className="text-blue-400" />
                <span>Workspaces & Folders</span>
              </h3>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3">
              {workspaceFolders.map(([fId, f]) => {
                const latestTime = getFolderLatestTime(fId);
                const isMaster = isBucketRootFolder(fId) || Boolean(f.is_master_bucket) || Boolean(f.is_virtual_duplicate);
                const isBkt = isAnyBucket(f.name, f);
                const isUploads = Boolean(f?.is_uploads || f?.name.toLowerCase() === 'uploads' || fId.startsWith('uploads_'));
                const stats = getFolderStats(fId);
                const count = isUploads ? 0 : (isMaster 
                  ? (stats.totalProjects > 0 ? stats.totalProjects : (stats.subWorkspacesCount > 0 ? stats.subWorkspacesCount : stats.totalClips))
                  : (stats.subWorkspacesCount > 0 ? stats.subWorkspacesCount : stats.totalClips));

                return (
                  <CompactFolderCard
                    key={fId}
                    folderId={fId}
                    folder={f}
                    isMaster={isMaster}
                    itemCount={count}
                    countLabel={isUploads ? '' : getFolderBadgeLabel(fId, f)}
                    onClick={() => {
                      if (isUploads) {
                        setSelectedUploadsMasterFid(f.parent || activeFolderId);
                        setShowUploadsDrawer(true);
                      } else {
                        setCurrentFolderId(fId);
                      }
                    }}
                    onLongPress={() => {
                      setSheetFolder({
                        fId,
                        folder: f,
                        isMaster,
                        isBucket: isBkt,
                        latestTime,
                        clipCount: stats.totalClips
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* CASE 1: Master Project Folder -> Shows Projects Section */}
        {activeFolderId !== 'root' && isFolderMaster && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Film size={14} className="text-purple-400" />
                <span>Projects ({folderProjects.length})</span>
              </h3>
            </div>

            {folderProjects.length > 0 ? (
              <div className="flex flex-col gap-1.5 sm:gap-2 w-full">
                {folderProjects.map(proj => (
                  <ProjectCard
                    key={proj.id}
                    project={proj}
                    onOpen={(pid) => {
                      const p = db?.video_editor_projects?.[pid] || proj;
                      setEditorMode(p.mode || 'general');
                      handleOpenProjectDirectly(activeFolderId, pid, p.mode || 'general');
                    }}
                    onRename={(pid, newName) => handleRenameVideoEditorProject(pid, newName)}
                    onTogglePin={(pid) => handleTogglePinEditorProject(pid)}
                    onDuplicate={(p) => handleDuplicateProject(p)}
                    onDelete={(pid) => handleDeleteVideoEditorProject(pid)}
                    onCloudSync={(p) => handleOpenCloudSyncModal(p)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 bg-gray-900/40 border border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center my-4">
                <div className="p-3 bg-purple-950/50 rounded-xl text-purple-400 mb-2">
                  <Film size={26} />
                </div>
                <p className="text-xs font-semibold text-gray-200 mb-1">No Projects in this master folder yet</p>
                <p className="text-[11px] text-gray-400 max-w-xs">
                  Tap the <span className="text-purple-300 font-bold text-sm">+</span> bubble below to create <span className="text-purple-300 font-mono font-bold">{suggestedNextProjectInfo.defaultName}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* CASE 2: Container Folder -> Shows Subfolders Section */}
        {activeFolderId !== 'root' && isFolderContainer && (
          <div className="space-y-6 mb-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Folder size={13} className="text-blue-400" />
                  <span>Subfolders ({workspaceFolders.length})</span>
                </h3>
              </div>
              {workspaceFolders.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3">
                  {workspaceFolders.map(([fId, f]) => {
                    const stats = getFolderStats(fId);
                    const latestTime = getFolderLatestTime(fId);
                    const isMaster = isBucketRootFolder(fId) || Boolean(f.is_master_bucket) || Boolean(f.is_virtual_duplicate);
                    const isUploads = Boolean(f?.is_uploads || f?.name.toLowerCase() === 'uploads' || fId.startsWith('uploads_'));
                    const count = isUploads ? 0 : (isMaster 
                      ? (stats.totalProjects > 0 ? stats.totalProjects : (stats.subWorkspacesCount > 0 ? stats.subWorkspacesCount : stats.totalClips))
                      : (stats.subWorkspacesCount > 0 ? stats.subWorkspacesCount : stats.totalClips));

                    return (
                      <CompactFolderCard
                        key={fId}
                        folderId={fId}
                        folder={f}
                        isMaster={isMaster}
                        itemCount={count}
                        countLabel={isUploads ? '' : getFolderBadgeLabel(fId, f)}
                        onClick={() => {
                          if (isUploads) {
                            setSelectedUploadsMasterFid(f.parent || activeFolderId);
                            setShowUploadsDrawer(true);
                          } else {
                            setCurrentFolderId(fId);
                          }
                        }}
                        onLongPress={() => {
                          setSheetFolder({
                            fId,
                            folder: f,
                            isMaster,
                            isBucket: false,
                            latestTime,
                            clipCount: stats.totalClips
                          });
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-gray-900/40 border border-dashed border-gray-800 rounded-2xl flex flex-col items-center justify-center text-center my-4">
                  <div className="p-3 bg-blue-950/50 rounded-xl text-blue-400 mb-2">
                    <Folder size={26} />
                  </div>
                  <p className="text-xs font-semibold text-gray-200 mb-1">No Subfolders in this folder yet</p>
                  <p className="text-[11px] text-gray-400 max-w-xs">
                    Tap the <span className="text-purple-300 font-bold text-sm">+</span> bubble below to add a subfolder
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASE 3: Uncommitted Empty Folder (neither projects nor subfolders yet) */}
        {activeFolderId !== 'root' && isFolderUncommitted && currentVideos.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-gray-900/40 rounded-3xl border border-gray-800/80 my-8 max-w-sm mx-auto">
            <div className="p-4 bg-gray-800/80 rounded-2xl text-purple-400 mb-3">
              <Folder size={36} />
            </div>
            <h4 className="text-sm font-bold text-gray-100 mb-1">
              This Folder is Empty
            </h4>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Tap the <span className="text-purple-300 font-bold text-sm">+</span> bubble below to add a Project or a Subfolder.
            </p>
          </div>
        )}

        {/* Video Clips Gallery Section (Inside actual folders) */}
        {activeFolderId !== 'root' && currentVideos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Film size={13} className="text-purple-400" />
                <span>Video Clips ({currentVideos.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedVideoIds.size === currentVideos.length) {
                      setSelectedVideoIds(new Set());
                    } else {
                      setSelectedVideoIds(new Set(currentVideos.map(([id]) => id)));
                    }
                  }}
                  className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 transition cursor-pointer"
                >
                  {selectedVideoIds.size === currentVideos.length ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>

            {/* Video Cards Grid (9:16 vertical cards: 3 clips in a row on mobile view) */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
              {currentVideos.map(([id, v]) => (
                <FolderVideoCard
                  key={id}
                  id={id}
                  v={v}
                  isSelected={selectedVideoIds.has(id)}
                  canEdit={false} // Read-only mode: mutations disabled
                  ultraDataSaver={ultraConfig.enabled}
                  onSelectToggle={handleSelectToggle}
                  onPlay={handlePlayClip}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handlePlayClip(v.file_id || id);
                  }}
                  onDelete={(delId) => handleDeleteVideo(delId)}
                  onCompress={() => {}}
                  onTrim={() => {}}
                  onDownload={handleDownloadClip}
                  onToggleHide={handleToggleVideoHide}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Floating Circular Plus Button (Dynamic position above bottom status dock with sleek bubble sizing) */}
      <div className={`fixed ${hasBottomDock ? 'bottom-16 sm:bottom-20' : 'bottom-6 sm:bottom-8'} right-5 sm:right-6 z-40 flex items-center transition-all duration-300 ease-out`}>
        <button
          type="button"
          onClick={handlePlusBubbleClick}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-950/80 border-2 border-purple-400/60 hover:border-purple-300 flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md ring-2 ring-purple-500/30"
          title="Add"
          aria-label="Add"
        >
          <Plus size={22} className="text-white transition-transform duration-200" strokeWidth={2.5} />
        </button>
      </div>

      {/* Master Bucket Uploads Drawer */}
      {showUploadsDrawer && effectiveUploadsMasterFid && (
        <MasterBucketUploadsDrawer
          isOpen={showUploadsDrawer}
          onClose={() => {
            setShowUploadsDrawer(false);
            setSelectedUploadsMasterFid(null);
          }}
          masterBucketFid={effectiveUploadsMasterFid}
          masterBucketName={effectiveUploadsMasterName}
          uploads={masterBucketUploads}
          onUploadFiles={handleUploadMasterBucketFiles}
          isUploading={isUploadingMasterClips}
          uploadProgress={uploadMasterClipsProgress}
          uploadStats={uploadMasterClipsStats}
          onPlayVideo={handlePlayClip}
          onDeleteUpload={handleDeleteUploadClip}
          onUseClipInEditor={() => {
            handleInitiateVideoEditor(effectiveUploadsMasterFid, editorMode);
            setShowUploadsDrawer(false);
            setSelectedUploadsMasterFid(null);
          }}
          db={db}
          activeProject={uploadsMasterProject}
          activeClips={uploadsMasterClips}
          jobs={uploadsMasterJobs}
          updateProjectClips={handleUpdateUploadsProjectClips}
          availableProjects={Object.values(db?.video_editor_projects || {})}
          showToast={showToast}
        />
      )}

      {/* Video Preview Modal */}
      <VideoPreviewModal
        video={previewVideo}
        onClose={() => setPreviewVideo(null)}
        onOpenInEditor={() => {
          const masterFid = isBucketRootFolder(activeFolderId) ? activeFolderId : (currentFolder?.parent || activeFolderId);
          handleInitiateVideoEditor(masterFid, editorMode);
        }}
      />

      {/* Full Screen Tabbed Settings Modal */}
      <FullScreenSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUserEmail={authSession.user?.email}
        isAdmin={Boolean(isAdmin)}
        onLogout={handleLogout}
        onToast={showToast}
      />

      {/* Full 9:16 Video Editor Modal */}
      {isVideoEditorOpen && db && (
        <MobileVideoEditorModal
          isOpen={isVideoEditorOpen}
          onClose={() => setIsVideoEditorOpen(false)}
          masterBucketFid={videoEditorMasterFid || activeFolderId}
          masterBucketName={db?.folders?.[videoEditorMasterFid || activeFolderId]?.name || 'Video Studio'}
          editorMode={editorMode}
          db={db}
          setDb={setDb}
          onSaveProject={handleSaveVideoEditorProject}
          onDeleteProject={handleDeleteVideoEditorProject}
          onRenameProject={handleRenameVideoEditorProject}
          onTogglePinProject={handleTogglePinEditorProject}
          onMarkClipsUsed={handleMarkClipsUsed}
          onToggleStar={handleToggleVideoStar}
          onToggleDefault={handleToggleVideoDefault}
          onToggleFreeze={handleToggleVideoFreeze}
          showToast={showToast}
          initialProjectId={currentEditingProjectId}
          currentUserEmail={authSession.user?.email}
          isAdmin={isAdmin}
          onOpenSettings={() => setShowSettingsModal(true)}
        />
      )}

      {/* Project Drafts Side Panel */}
      {isProjectSidePanelOpen && db && (
        <ProjectHistorySidePanel
          isOpen={isProjectSidePanelOpen}
          onClose={() => setIsProjectSidePanelOpen(false)}
          masterBucketFid={activeMasterFid || ''}
          masterBucketName={activeMasterName}
          contextTitle={
            activeMasterFid
              ? activeMasterName
              : activeFolderId !== 'root'
                ? (currentFolder?.name || 'Folder')
                : 'All Projects'
          }
          editorMode={editorMode}
          onEditorModeChange={(mode) => setEditorMode(mode)}
          projects={contextualProjects}
          allProjects={Object.values(db?.video_editor_projects || {}).filter(p => canUserAccessProject(p))}
          folders={db.folders}
          activeProjectId={currentEditingProjectId}
          onSelectProject={(projectId) => {
            const p = db.video_editor_projects?.[projectId];
            const targetFid = p?.master_bucket_fid || activeMasterFid || activeFolderId;
            const targetMode = p?.mode || editorMode;
            setEditorMode(targetMode);
            handleOpenProjectDirectly(targetFid, projectId, targetMode);
          }}
          onTogglePinProject={handleTogglePinEditorProject}
          onRenameProject={handleRenameVideoEditorProject}
          onDeleteProject={handleDeleteVideoEditorProject}
          currentUserEmail={authSession.user?.email}
          isAdmin={isAdmin}
        />
      )}



      {/* Bottom Sheet for Folder Actions on Long Press */}
      {sheetFolder && (
        <FolderActionBottomSheet
          isOpen={Boolean(sheetFolder)}
          onClose={() => setSheetFolder(null)}
          folderId={sheetFolder.fId}
          folder={sheetFolder.folder}
          isMaster={sheetFolder.isMaster}
          isBucket={sheetFolder.isBucket}
          latestTime={sheetFolder.latestTime}
          clipCount={sheetFolder.clipCount}
          countLabel={getFolderBadgeLabel(sheetFolder.fId, sheetFolder.folder)}
          onOpenFolder={(fId) => setCurrentFolderId(fId)}
          onDuplicateMasterBucket={(fId) => handleOpenDuplicateMasterBucketModal(fId)}
          onCreateProject={() => setShowCreateProjectModal(true)}
          onOpenEditor={(fId) => handleInitiateVideoEditor(fId, editorMode)}
          onDelete={(fId, name, type) => handleRequestDelete(fId, name, type)}
          onToast={showToast}
        />
      )}

      {/* Create Project Modal */}
      {showCreateProjectModal && activeFolderId !== 'root' && currentFolder && (() => {
        const targetFid = activeFolderId;
        const targetName = currentFolder?.name || 'Master Project';
        const existingInThisFolder = folderProjects;

        return (
          <CreateProjectModal
            isOpen={showCreateProjectModal}
            onClose={() => setShowCreateProjectModal(false)}
            masterBucketFid={targetFid}
            masterBucketName={targetName}
            existingProjects={existingInThisFolder}
            existingProjectsCount={existingInThisFolder.length}
            suggestedName={suggestedNextProjectInfo.defaultName}
            onCreateProject={(name, mode) => {
              handleCreateNewProjectAndOpen(targetFid, mode, name);
            }}
          />
        );
      })()}

      {/* Choose Folder Type Modal (When an empty folder first has + tapped) */}
      {showChooseFolderTypeModal && currentFolder && (
        <ChooseFolderTypeModal
          isOpen={showChooseFolderTypeModal}
          folderName={currentFolder.name}
          onChooseProject={handleChooseProjectForFolder}
          onChooseSubfolder={handleChooseSubfolderForFolder}
          onClose={() => setShowChooseFolderTypeModal(false)}
        />
      )}

      {/* Project Cloud Storage Backup Modal */}
      {showCloudSyncModal && (
        <ProjectCloudSyncModal
          isOpen={showCloudSyncModal}
          onClose={() => {
            setShowCloudSyncModal(false);
            setCloudSyncProject(null);
          }}
          project={cloudSyncProject}
          db={db}
          setDb={setDb}
          showToast={showToast}
        />
      )}

      {/* Export / Generation History Modal */}
      {showExportGenerationHistory && db && (
        <ExportGenerationHistoryModal
          isOpen={showExportGenerationHistory}
          onClose={() => setShowExportGenerationHistory(false)}
          db={db}
          setDb={setDb}
          activeMasterFid={activeMasterBucketInfo?.masterFid || activeFolderId}
          initialProjectId={exportHistoryInitialProjectId}
          onPlayVideo={handlePlayClip}
          onOpenProject={(projId, masterFid) => {
            const p = db.video_editor_projects?.[projId];
            const targetFid = masterFid || p?.master_bucket_fid || activeMasterBucketInfo?.masterFid || activeFolderId;
            handleOpenProjectDirectly(targetFid, projId, p?.mode || editorMode);
          }}
          currentUserEmail={authSession.user?.email}
          isAdmin={isAdmin}
        />
      )}

      {/* Audio / Music Library Modal */}
      {showAudioLibrary && db && (
        <AudioLibraryModal
          isOpen={showAudioLibrary}
          onClose={() => setShowAudioLibrary(false)}
          db={db}
          setDb={setDb}
          showToast={showToast}
          masterBucketFid={activeFolderId}
          masterBucketName={currentFolder?.name}
          currentUserEmail={authSession.user?.email}
          isAdmin={isAdmin}
        />
      )}

      {/* Real-time Job Progress Notification */}
      {authSession.user && (
        <JobProgressNotification 
          jobs={jobs} 
          onDismiss={(jobId) => {
            setJobs(prev => prev.filter(j => j.id !== jobId));
            fetch(`/api/jobs/${jobId}`, { method: 'DELETE' }).catch(() => {});
          }}
          onRetryFailed={() => {}}
          onOpenFailedModal={() => {}}
          onToast={showToast}
        />
      )}

      {/* Duplicate Master Bucket Modal (Sync vs Local Snapshot prompt) */}
      {duplicateModal.isOpen && (
        <DuplicateMasterBucketModal
          isOpen={duplicateModal.isOpen}
          onClose={() => setDuplicateModal(prev => ({ ...prev, isOpen: false }))}
          sourceMasterFid={duplicateModal.sourceFid}
          sourceMasterName={duplicateModal.sourceName}
          onConfirm={handleConfirmDuplicateMasterBucket}
        />
      )}

      {/* Delete Confirmation Modal - Works for Master Project Folders and Subfolders */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            className="bg-gray-900 border border-rose-500/40 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-white text-base truncate">
                  Delete {deleteConfirmModal.itemType === 'master_bucket' ? 'Master Project Folder' : 'Folder'}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  "{deleteConfirmModal.name}"
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/80 p-3 rounded-xl border border-gray-800">
              Are you sure you want to delete {deleteConfirmModal.itemType === 'master_bucket' ? 'Master Project Folder' : 'Folder'} <strong className="text-white">"{deleteConfirmModal.name}"</strong>? 
              <br /><br />
              <span className="text-rose-400 font-medium">
                {deleteConfirmModal.itemType === 'master_bucket' 
                  ? '⚠️ This will permanently remove this Master Project Folder, all subfolders, and associated projects.'
                  : '⚠️ This will permanently remove this folder and any subfolders inside it.'}
              </span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, fid: '', name: '', itemType: 'folder' })}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-rose-950/40 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>
                  Delete {deleteConfirmModal.itemType === 'master_bucket' ? 'Master Project Folder' : 'Folder'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Render Status Bar Dock - strictly isolated for authenticated user */}
      {authSession.user?.email && (
        <BottomRenderStatusBar 
          jobs={jobs}
          currentUserEmail={authSession.user.email}
          isAdmin={isAdmin}
          onOpenVideoPreview={(url, title) => setPreviewVideo({ url, title })}
          onToast={showToast}
          onRefreshDB={fetchDB}
          onDockVisibilityChange={setHasBottomDock}
        />
      )}

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        onCreateFolder={handleCreateNewFolder}
        activeFolderId={activeFolderId}
        currentFolderName={currentFolder?.name}
      />
    </div>
  );
}
