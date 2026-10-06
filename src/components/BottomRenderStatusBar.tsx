import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Play, 
  Download, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Copy, 
  Check
} from 'lucide-react';
import { Job } from '../types';
import { ActiveUploadInfo } from './JobProgressNotification';
import { useUltraDataSaver } from '../utils/dataSaver';

export interface KaggleJobSummary {
  jobId: string;
  projectId?: string;
  projectName: string;
  currentUserEmail?: string;
  status: 'queued' | 'dispatching' | 'running' | 'completed' | 'failed';
  progress: number;
  statusText: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  downloadUrl?: string;
  cloudUrl?: string;
  filename?: string;
  size?: number;
  duration?: number;
  vid?: string;
  kernelSlug?: string;
  logs?: string[];
}

export interface BottomRenderStatusBarProps {
  jobs?: Job[];
  activeUpload?: ActiveUploadInfo | null;
  onOpenVideoPreview?: (videoUrl: string, title: string) => void;
  onToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onRefreshDB?: () => void;
  currentUserEmail?: string;
  isAdmin?: boolean;
  onDockVisibilityChange?: (visible: boolean) => void;
}

function formatShortStatus(text?: string): string {
  if (!text) return 'Rendering';
  const clean = text.replace(/^[⚡✅❌🎬🚀⚙️⬇️\s]+/, '').trim();
  if (/queue/i.test(clean)) return 'In Queue';
  if (/dispatch/i.test(clean)) return 'Dispatching';

  // 1. Frame-level upscale match: "Up: 40/77" or "Clip #1: 40/77" (clean without duplicate percentage)
  const upMatch = clean.match(/(?:Clip\s*#?(\d+)[^:]*:\s*)?(?:Up(?:scaling)?|AI Upscaling|AI)?:\s*(\d+)\/(\d+)/i);
  if (upMatch && upMatch[2] && upMatch[3]) {
    const clipNum = upMatch[1];
    const cur = upMatch[2];
    const tot = upMatch[3];
    return clipNum ? `Clip ${clipNum}: ${cur}/${tot}` : `Up: ${cur}/${tot}`;
  }

  // 2. Simple clip match: "Clip #1/5" -> "Clip 1/5"
  const clipMatch = clean.match(/Clip\s*#?\s*(\d+)(?:\/(\d+))?/i);
  if (clipMatch) {
    const c1 = clipMatch[1];
    const cTot = clipMatch[2] ? `/${clipMatch[2]}` : '';
    return `Clip ${c1}${cTot}`;
  }

  if (/downloading.*model/i.test(clean)) return 'Loading AI Model';
  if (/setting up|initializing|starting gpu|gpu init/i.test(clean)) return 'Starting GPU';
  if (/audio/i.test(clean)) return 'Audio Mix';
  if (/caption/i.test(clean)) return 'Captions';
  if (/packag/i.test(clean)) return 'Packaging';
  if (/saving|upload/i.test(clean)) return 'Saving';
  if (/proteus/i.test(clean)) return 'Proteus AI';
  if (/executing.*kaggle|dual-t4/i.test(clean)) return 'Kaggle GPU Running';
  if (/fail|error/i.test(clean)) return 'Failed ✕';
  if (/ready|complete/i.test(clean)) return 'Ready ✓';
  return clean.length > 22 ? clean.substring(0, 20) + '..' : clean;
}

export const BottomRenderStatusBar: React.FC<BottomRenderStatusBarProps> = ({
  jobs = [],
  activeUpload,
  onOpenVideoPreview,
  onToast,
  onRefreshDB,
  currentUserEmail,
  isAdmin = false,
  onDockVisibilityChange
}) => {
  // If user is not authenticated, NEVER show render status dock or expose any export operations
  if (!currentUserEmail) {
    return null;
  }

  const userKey = (currentUserEmail || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  const activeTaskKey = `active_render_status_task_${userKey}`;
  const historyKey = `render_history_log_${userKey}`;

  // Active Kaggle GPU jobs
  const [kaggleJobs, setKaggleJobs] = useState<KaggleJobSummary[]>([]);
  const completedJobIdsRef = useRef<Set<string>>(new Set());
  const isInitialPollRef = useRef<boolean>(true);
  const [dismissedJobIds, setDismissedJobIds] = useState<{ [id: string]: boolean }>(() => {
    try {
      const stored = sessionStorage.getItem(`dismissed_render_jobs_${userKey}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Local editor export state (isolated strictly per user)
  const [localExportJob, setLocalExportJob] = useState<{
    id: string;
    projectName: string;
    status: 'queued' | 'dispatching' | 'running' | 'completed' | 'failed';
    progress: number;
    statusText: string;
    downloadUrl?: string;
    filename?: string;
    size?: number;
    startedAt: number;
    logs: string[];
    error?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(activeTaskKey) || sessionStorage.getItem(`active_export_task_${userKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          // Immediately purge old legacy mismatched session IDs from previous versions
          if (parsed.id.startsWith('export_') || parsed.id.startsWith('local_export_') || (parsed.progress === 12 && Date.now() - (parsed.startedAt || 0) > 90000)) {
            try {
              localStorage.removeItem(activeTaskKey);
              sessionStorage.removeItem(`active_export_task_${userKey}`);
              sessionStorage.removeItem('active_export_task');
            } catch (_) {}
            return null;
          }
          if (parsed.status === 'running' && parsed.startedAt && (Date.now() - parsed.startedAt > 4 * 60 * 1000)) {
            parsed.status = 'failed';
            parsed.statusText = 'Export stalled. Tap Cancel to clear.';
          }
          return parsed;
        }
      }
    } catch (_) {}
    return null;
  });

  // Persistent Render History (isolated strictly per user)
  const [renderHistory, setRenderHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(historyKey);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const localExportJobRef = useRef(localExportJob);
  localExportJobRef.current = localExportJob;

  // Persist local export job to localStorage whenever it changes
  useEffect(() => {
    try {
      if (localExportJob && userKey) {
        localStorage.setItem(activeTaskKey, JSON.stringify(localExportJob));
        setRenderHistory(prev => {
          const idx = prev.findIndex(p => p.id === localExportJob.id);
          let next;
          if (idx >= 0) {
            next = [...prev];
            next[idx] = { ...next[idx], ...localExportJob, updatedAt: Date.now() };
          } else {
            next = [{ ...localExportJob, updatedAt: Date.now() }, ...prev];
          }
          const sliced = next.slice(0, 50);
          try { localStorage.setItem(historyKey, JSON.stringify(sliced)); } catch (_) {}
          return sliced;
        });
      }
    } catch (_) {}
  }, [localExportJob, activeTaskKey, historyKey, userKey]);

  // Dedicated clean video player modal (NO developer logs, NO raw bash terminal)
  const [cleanPlayerModal, setCleanPlayerModal] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    filename?: string;
    size?: number;
  } | null>(null);

  // Dedicated error logs modal (Shows live real-time execution logs or error trace)
  const [errorLogsModal, setErrorLogsModal] = useState<{
    isOpen: boolean;
    jobId?: string;
    title: string;
    error?: string;
    logs: string[];
  } | null>(null);

  const logsContainerRef = useRef<HTMLDivElement | null>(null);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const progressMapRef = useRef<{ [jobId: string]: number }>({});
  const kaggleEtagRef = useRef<string | null>(null);

  // Auto-scroll logs container to bottom when new logs arrive in real-time
  useEffect(() => {
    if (errorLogsModal?.isOpen && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [errorLogsModal, kaggleJobs]);

  // Persist dismissed job IDs to sessionStorage and clean renderHistory
  const handleDismissJob = useCallback((jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDismissedJobIds(prev => {
      const next = { ...prev, [jobId]: true };
      try {
        sessionStorage.setItem(`dismissed_render_jobs_${userKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Completely purge from renderHistory and localStorage so dismissed jobs never resurrect
    setRenderHistory(prev => {
      const next = prev.filter(p => p.id !== jobId && !p.id.includes(jobId) && !jobId.includes(p.id));
      try {
        localStorage.setItem(historyKey, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    try {
      localStorage.removeItem(activeTaskKey);
      sessionStorage.removeItem(`active_export_task_${userKey}`);
      sessionStorage.removeItem('active_export_task');
      window.dispatchEvent(new CustomEvent('render-status-update', {
        detail: { id: jobId, status: 'cleared' }
      }));
    } catch (_) {}

    // Notify backend if it's a Kaggle job
    fetch('/api/kaggle/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    }).catch(() => {});

    // If local job, clear it completely
    if (localExportJob && (localExportJob.id === jobId || localExportJob.id.includes(jobId) || jobId.includes(localExportJob.id))) {
      setLocalExportJob(null);
    }
  }, [localExportJob, activeTaskKey, historyKey, userKey]);

  // Fetch Kaggle GPU jobs (isolated strictly per user & ETag 304 low-data support)
  const fetchKaggleJobs = useCallback(async () => {
    if (!currentUserEmail) return;
    try {
      const headers: Record<string, string> = { 'x-user-email': currentUserEmail };
      if (kaggleEtagRef.current) {
        headers['If-None-Match'] = kaggleEtagRef.current;
      }
      const res = await fetch(`/api/kaggle/jobs?email=${encodeURIComponent(currentUserEmail)}`, {
        headers
      });
      if (res.status === 304) {
        // 304 Not Modified: 0 bytes transferred
        return;
      }
      if (!res.ok) return;
      const kEtag = res.headers.get('ETag');
      if (kEtag) kaggleEtagRef.current = kEtag;
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (_) {
        return;
      }
      if (data.jobs && Array.isArray(data.jobs)) {
        setKaggleJobs(data.jobs);

        // Prevent surfacing old completed jobs on page load but refresh DB so new videos appear
        if (isInitialPollRef.current) {
          isInitialPollRef.current = false;
          let hasAnyCompleted = false;
          data.jobs.forEach((j: any) => {
            if (j.status === 'completed') {
              completedJobIdsRef.current.add(j.jobId);
              hasAnyCompleted = true;
            }
          });
          if (hasAnyCompleted && onRefreshDB) {
            try { onRefreshDB(); } catch (_) {}
          }
        } else {
          // Notify parent and trigger database refresh when any Kaggle job completes in real-time
          data.jobs.forEach((j: any) => {
            if (j.status === 'completed' && !completedJobIdsRef.current.has(j.jobId)) {
              completedJobIdsRef.current.add(j.jobId);
              try {
                if (onRefreshDB) onRefreshDB();
                window.dispatchEvent(new CustomEvent('db-updated'));
                window.dispatchEvent(new CustomEvent('kaggle-job-completed', { detail: j }));
              } catch (_) {}
            }
          });
        }

        // Clear localExportJob when matching Kaggle job is found in data.jobs (by ID or project name)
        if (localExportJobRef.current) {
          const curLocal = localExportJobRef.current;
          const match = data.jobs.find((j: any) => 
            j.jobId === curLocal.id || 
            (curLocal.id && j.jobId && (curLocal.id.includes(j.jobId) || j.jobId.includes(curLocal.id))) ||
            (j.projectName && curLocal.projectName && 
             j.projectName.toLowerCase().trim() === curLocal.projectName.toLowerCase().trim())
          );
          if (match) {
            setLocalExportJob(null);
            try {
              localStorage.removeItem(activeTaskKey);
              sessionStorage.removeItem(`active_export_task_${userKey}`);
              sessionStorage.removeItem('active_export_task');
            } catch (_) {}
            if (match.status === 'completed') {
              try {
                window.dispatchEvent(new CustomEvent('kaggle-job-completed', { detail: match }));
              } catch (_) {}
            }
          } else if (Date.now() - (curLocal.startedAt || 0) > 15 * 60 * 1000) {
            // Clean up only after 15 minutes of inactivity
            setLocalExportJob(null);
            try {
              localStorage.removeItem(activeTaskKey);
              sessionStorage.removeItem(`active_export_task_${userKey}`);
              sessionStorage.removeItem('active_export_task');
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }, [activeTaskKey, userKey, currentUserEmail, onRefreshDB]);

  // Re-hydrate localExportJob and renderHistory whenever userKey changes
  useEffect(() => {
    if (!userKey) return;
    try {
      const saved = localStorage.getItem(activeTaskKey) || sessionStorage.getItem(`active_export_task_${userKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setLocalExportJob(parsed);
        }
      }
      const savedHist = localStorage.getItem(historyKey);
      if (savedHist) {
        const parsedHist = JSON.parse(savedHist);
        if (Array.isArray(parsedHist)) setRenderHistory(parsedHist);
      }
    } catch (_) {}
    fetchKaggleJobs();
  }, [userKey, activeTaskKey, historyKey, fetchKaggleJobs]);

  const { config: ultraConfig } = useUltraDataSaver();
  const isUltraDataSaver = ultraConfig.enabled;

  // Adaptive ultra low-data polling: 4s during active execution, 90s when idle in Ultra mode (completely paused when backgrounded)
  useEffect(() => {
    fetchKaggleJobs();
    const hasActive = kaggleJobs.some(j => j.status === 'running' || j.status === 'dispatching' || j.status === 'queued');
    const intervalTime = hasActive ? 4000 : (isUltraDataSaver ? 90000 : 25000);
    
    let interval: any = null;
    const startTimer = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (!document.hidden) {
          fetchKaggleJobs();
        }
      }, intervalTime);
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchKaggleJobs();
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
  }, [fetchKaggleJobs, kaggleJobs, isUltraDataSaver]);

  // Watchdog: detect and unstick stalled export jobs after 4 minutes of non-completion
  useEffect(() => {
    if (!localExportJob || localExportJob.status !== 'running') return;
    const started = localExportJob.startedAt || 0;
    if (started > 0 && Date.now() - started > 4 * 60 * 1000) {
      const match = kaggleJobs.find(k => k.jobId === localExportJob.id || (k as any).id === localExportJob.id);
      if (!match || match.status === 'failed') {
        setLocalExportJob(prev => prev ? ({
          ...prev,
          status: 'failed',
          statusText: 'Export stalled. Tap Cancel to clear.',
          error: 'Render timed out or was interrupted.'
        }) : null);
      }
    }
  }, [localExportJob, kaggleJobs]);

  // Listen to custom window events from MobileVideoEditorModal or export dispatches
  useEffect(() => {
    const handleDispatched = (e: any) => {
      fetchKaggleJobs();
      setActiveItemIndex(0);
      const detail = e.detail || {};
      const newJobId = detail.jobId || `kaggle_dispatch_${Date.now()}`;
      setDismissedJobIds(prev => {
        if (!prev[newJobId]) return prev;
        const next = { ...prev };
        delete next[newJobId];
        return next;
      });
      setLocalExportJob({
        id: newJobId,
        projectName: detail.projectName || 'Video Project',
        status: detail.status || 'queued',
        progress: detail.progress || 5,
        statusText: detail.statusText || detail.message || '⏳ In Kaggle Queue...',
        startedAt: Date.now(),
        logs: ['⚡ Render dispatched to Kaggle GPU', '⏳ In Kaggle Queue...']
      });
    };

    const handleLocalProgress = (e: any) => {
      const detail = e.detail;
      if (!detail) return;

      const logMsg = detail.logLine || detail.statusText || '';

      if (detail.status === 'running') {
        setActiveItemIndex(0);
        setLocalExportJob(prev => ({
          id: detail.id || prev?.id || `local_export_${Date.now()}`,
          projectName: detail.projectName || prev?.projectName || 'Video Project',
          status: 'running',
          progress: typeof detail.progress === 'number' ? detail.progress : (prev?.progress || 12),
          statusText: detail.statusText || '⚡ Executing on Kaggle...',
          startedAt: prev?.startedAt || Date.now(),
          logs: [...(prev?.logs || []), logMsg].filter(Boolean).slice(-300)
        }));
      } else if (detail.status === 'completed') {
        setLocalExportJob(prev => ({
          id: detail.id || prev?.id || 'local_export',
          projectName: detail.projectName || prev?.projectName || 'Video Project',
          status: 'completed',
          progress: 100,
          statusText: 'Completed',
          downloadUrl: detail.downloadUrl,
          filename: detail.filename,
          size: detail.size,
          startedAt: prev?.startedAt || Date.now(),
          logs: [...(prev?.logs || []), 'Render completed successfully'].slice(-300)
        }));
      } else if (detail.status === 'failed') {
        setLocalExportJob(prev => ({
          id: detail.id || prev?.id || 'local_export',
          projectName: detail.projectName || prev?.projectName || 'Video Project',
          status: 'failed',
          progress: prev?.progress || 0,
          statusText: detail.error || 'Export failed',
          error: detail.error,
          startedAt: prev?.startedAt || Date.now(),
          logs: [...(prev?.logs || []), `Error: ${detail.error || 'Unknown failure'}`].slice(-300)
        }));
      } else if (detail.status === 'cleared') {
        setLocalExportJob(null);
      }
    };

    window.addEventListener('kaggle-render-dispatched', handleDispatched);
    window.addEventListener('render-status-update', handleLocalProgress);

    return () => {
      window.removeEventListener('kaggle-render-dispatched', handleDispatched);
      window.removeEventListener('render-status-update', handleLocalProgress);
    };
  }, [fetchKaggleJobs]);

  // Construct the full list of all active or recent jobs so multiple videos can swap/rotate
  const allActiveItems = useMemo(() => {
    const items: Array<{
      source: 'kaggle' | 'local_export' | 'ai_job' | 'upload';
      id: string;
      title: string;
      status: 'queued' | 'dispatching' | 'running' | 'completed' | 'failed';
      progress: number;
      statusText: string;
      downloadUrl?: string;
      filename?: string;
      size?: number;
      duration?: number;
      logs: string[];
      error?: string;
      createdAt: number;
      startedAt?: number;
      completedAt?: number;
    }> = [];

    // Collect project names of actively running/queued/dispatching items
    const userEmail = (currentUserEmail || '').toLowerCase().trim();
    const adminEmails = ['distinct4exist@gmail.com'];
    const isAdmin = adminEmails.includes(userEmail);
    const undisplayedKaggle = kaggleJobs.filter(j => {
      if (dismissedJobIds[j.jobId]) return false;
      const jEmail = (j.currentUserEmail || (j as any).ownerId || (j as any).userEmail || '').toLowerCase().trim();
      // Strictly isolate to current user or mutual admin accounts
      if (jEmail && userEmail && jEmail !== userEmail) {
        if (isAdmin && adminEmails.includes(jEmail)) return true;
        return false;
      }
      return true;
    });

    const activeProjectNames = new Set<string>();
    undisplayedKaggle.forEach(j => {
      if (j.status === 'running' || j.status === 'dispatching' || j.status === 'queued') {
        if (j.projectName) activeProjectNames.add(j.projectName.toLowerCase().trim());
      }
    });

    const hasAnyActiveKaggle = undisplayedKaggle.some(j => j.status === 'running' || j.status === 'dispatching' || j.status === 'queued');

    // 1. Kaggle GPU Jobs
    undisplayedKaggle.forEach(j => {
      const isAct = j.status === 'running' || j.status === 'dispatching' || j.status === 'queued';
      const now = Date.now();
      const age = now - (j.completedAt || j.createdAt || 0);
      const pName = (j.projectName || '').toLowerCase().trim();

      // If this job is completed/failed, but there is an ACTIVE running/queued job for this same project, NEVER show the old finished one!
      if (!isAct && pName && activeProjectNames.has(pName)) {
        return;
      }

      // Active jobs always shown; completed jobs kept visible for up to 3 hours or until dismissed with [X]
      const maxAge = isAct ? Infinity : 3 * 60 * 60 * 1000;
      if (isAct || age < maxAge) {
        items.push({
          source: 'kaggle',
          id: j.jobId,
          title: j.projectName || 'Video Project',
          status: j.status,
          progress: j.progress || (j.status === 'completed' ? 100 : 20),
          statusText: j.statusText || 'GPU Rendering...',
          downloadUrl: j.downloadUrl || j.cloudUrl,
          filename: j.filename,
          size: j.size,
          duration: j.duration,
          logs: j.logs || [],
          error: j.error,
          createdAt: j.createdAt,
          startedAt: j.startedAt,
          completedAt: j.completedAt
        });
      }
    });

    // 2. Local Export Job - ONLY show if NO active Kaggle job exists (prevents splitting into 2 parts when Kaggle starts!)
    if (!hasAnyActiveKaggle && localExportJob && !dismissedJobIds[localExportJob.id] && !localExportJob.id.startsWith('export_') && !localExportJob.id.startsWith('local_export_')) {
      const localPName = (localExportJob.projectName || '').toLowerCase().trim();
      const alreadyPresent = items.some(it => 
        it.id === localExportJob.id || 
        (localPName && it.title && (it.title.toLowerCase().trim() === localPName || it.title.toLowerCase().includes(localPName) || localPName.includes(it.title.toLowerCase()))) ||
        (it.id && localExportJob.id && (it.id.includes(localExportJob.id) || localExportJob.id.includes(it.id)))
      );
      if (!alreadyPresent && !activeProjectNames.has(localPName)) {
        items.push({
          source: 'local_export',
          id: localExportJob.id,
          title: localExportJob.projectName,
          status: localExportJob.status,
          progress: localExportJob.progress,
          statusText: localExportJob.statusText,
          downloadUrl: localExportJob.downloadUrl,
          filename: localExportJob.filename,
          size: localExportJob.size,
          logs: localExportJob.logs,
          error: localExportJob.error,
          createdAt: localExportJob.startedAt
        });
      }
    }

    // 2b. Restored History Jobs (persisted smoothly per user)
    if (renderHistory && renderHistory.length > 0) {
      renderHistory.forEach(h => {
        if (!h || !h.id || dismissedJobIds[h.id]) return;
        const hTitle = (h.projectName || h.title || '').toLowerCase().trim();
        // If an active render is running for this project, skip old history
        if (hTitle && activeProjectNames.has(hTitle)) return;

        const isDup = items.some(it => 
          it.id === h.id || 
          (it.title && it.title.toLowerCase().trim() === hTitle) ||
          (it.id && h.id && (it.id.includes(h.id) || h.id.includes(it.id)))
        );
        if (isDup) return;
        const startTimestamp = h.updatedAt || h.startedAt || h.createdAt || 0;
        const isRecent = (Date.now() - startTimestamp) < 5 * 60 * 1000;
        if (isRecent) {
          items.push({
            source: h.source || 'local_export',
            id: h.id,
            title: h.projectName || h.title || 'Video Export',
            status: h.status || 'completed',
            progress: h.progress || 100,
            statusText: h.statusText || 'Completed',
            downloadUrl: h.downloadUrl,
            filename: h.filename,
            size: h.size,
            logs: h.logs || [],
            error: h.error,
            createdAt: startTimestamp || Date.now()
          });
        }
      });
    }

    // 3. AI Generation Jobs (strictly per user)
    if (jobs && jobs.length > 0) {
      jobs.filter(j => {
        if (!isAdmin && currentUserEmail) {
          const u = currentUserEmail.toLowerCase().trim();
          const jOwner = (j.userId || (j as any).ownerId || (j as any).currentUserEmail || '').toLowerCase().trim();
          if (jOwner && jOwner !== u) return false;
        }
        return (j.status === 'processing' || j.status === 'pending') && !dismissedJobIds[j.id];
      }).forEach(j => {
        const payloadUrls = (j.payload?.urls && Array.isArray(j.payload.urls)) ? j.payload.urls : [];
        const totalClips = j.totalClips || payloadUrls.length || 1;
        const doneUrls = (j.completedUrls?.length || 0);
        const pct = typeof j.percent === 'number' ? j.percent : Math.round((doneUrls / Math.max(1, totalClips)) * 100);
        const jobLogs = (j.logs || []).map(l => typeof l === 'string' ? l : (l as any).message || String(l));
        const jobTitle = j.currentClipName || j.payload?.prompt || j.type || 'AI Generation';
        items.push({
          source: 'ai_job',
          id: j.id,
          title: jobTitle,
          status: j.status === 'processing' ? 'running' : 'queued',
          progress: Math.max(15, pct),
          statusText: j.stage || `Generating AI Clip (${doneUrls}/${totalClips})...`,
          logs: jobLogs,
          createdAt: j.createdAt || Date.now()
        });
      });
    }

    // 4. Video Upload
    if (activeUpload && activeUpload.isUploading && !dismissedJobIds['active_upload']) {
      items.push({
        source: 'upload',
        id: 'active_upload',
        title: activeUpload.currentFileName || 'Video Upload',
        status: 'running',
        progress: activeUpload.uploadProgressPercent || 0,
        statusText: `Uploading (${activeUpload.currentUploadIndex + 1}/${activeUpload.totalFiles})...`,
        logs: [],
        createdAt: Date.now()
      });
    }

    // Deduplicate items: Keep 1 item per unique job ID or project, prioritizing running over completed
    const uniqueItems: typeof items = [];
    items.forEach(it => {
      const projKey = (it.title || it.id).toLowerCase().trim();
      const existingIdx = uniqueItems.findIndex(u => (u.title || u.id).toLowerCase().trim() === projKey);
      if (existingIdx >= 0) {
        const existing = uniqueItems[existingIdx];
        // If current item is actively running/queued and existing was completed, replace it with the new active execution!
        if ((it.status === 'running' || it.status === 'dispatching' || it.status === 'queued') && existing.status === 'completed') {
          uniqueItems[existingIdx] = it;
        } else if (it.createdAt > existing.createdAt) {
          uniqueItems[existingIdx] = it;
        }
      } else {
        uniqueItems.push(it);
      }
    });

    // Sort order: failed first (for immediate user notification), then active running/dispatching, then queued, then completed
    return uniqueItems.sort((a, b) => {
      const score = (st: string) => {
        if (st === 'failed') return 0;
        if (st === 'running' || st === 'dispatching') return 1;
        if (st === 'queued') return 2;
        return 3;
      };
      if (score(a.status) !== score(b.status)) return score(a.status) - score(b.status);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [kaggleJobs, localExportJob, jobs, activeUpload, dismissedJobIds, currentUserEmail, isAdmin]);

  // Active item index state (no auto-swapping carousel to prevent jumping)
  const [activeItemIndex, setActiveItemIndex] = useState(0);

  // Keep active index within bounds, prioritizing running items
  useEffect(() => {
    const runningIdx = allActiveItems.findIndex(it => it.status === 'running' || it.status === 'dispatching' || it.status === 'queued');
    if (runningIdx >= 0) {
      setActiveItemIndex(runningIdx);
    } else if (activeItemIndex >= allActiveItems.length) {
      setActiveItemIndex(0);
    }
  }, [allActiveItems.length]);

  const currentItem = allActiveItems[activeItemIndex] || allActiveItems[0] || null;

  // Broadcast dock visibility so floating action bubbles (FABs) smoothly float up and never overlap
  useEffect(() => {
    const isVisible = Boolean(currentItem);
    if (onDockVisibilityChange) {
      onDockVisibilityChange(isVisible);
    }
    try {
      window.dispatchEvent(new CustomEvent('bottom-dock-visibility', { detail: { visible: isVisible } }));
    } catch (_) {}
  }, [Boolean(currentItem), onDockVisibilityChange]);

  // Dynamic vibrant color themes per video number
  const COLOR_THEMES = [
    {
      name: 'cyan',
      barBg: 'bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500',
      badgeBorder: 'border-cyan-500/50',
      badgeBg: 'bg-cyan-950/90',
      badgeText: 'text-cyan-300',
      dotBg: 'bg-cyan-400',
      glow: 'shadow-[0_-4px_20px_rgba(6,182,212,0.3)]',
      borderTop: 'border-cyan-500/50',
      statusText: 'text-cyan-200'
    },
    {
      name: 'purple',
      barBg: 'bg-gradient-to-r from-purple-500 via-fuchsia-400 to-pink-500',
      badgeBorder: 'border-purple-500/50',
      badgeBg: 'bg-purple-950/90',
      badgeText: 'text-purple-300',
      dotBg: 'bg-purple-400',
      glow: 'shadow-[0_-4px_20px_rgba(168,85,247,0.3)]',
      borderTop: 'border-purple-500/50',
      statusText: 'text-purple-200'
    },
    {
      name: 'emerald',
      barBg: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-400',
      badgeBorder: 'border-emerald-500/50',
      badgeBg: 'bg-emerald-950/90',
      badgeText: 'text-emerald-300',
      dotBg: 'bg-emerald-400',
      glow: 'shadow-[0_-4px_20px_rgba(16,185,129,0.3)]',
      borderTop: 'border-emerald-500/50',
      statusText: 'text-emerald-200'
    },
    {
      name: 'amber',
      barBg: 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400',
      badgeBorder: 'border-amber-500/50',
      badgeBg: 'bg-amber-950/90',
      badgeText: 'text-amber-300',
      dotBg: 'bg-amber-400',
      glow: 'shadow-[0_-4px_20px_rgba(245,158,11,0.3)]',
      borderTop: 'border-amber-500/50',
      statusText: 'text-amber-200'
    }
  ];

  const currentTheme = COLOR_THEMES[activeItemIndex % COLOR_THEMES.length];

  // Elapsed ticker
  useEffect(() => {
    if (!currentItem || currentItem.status === 'completed' || currentItem.status === 'failed') {
      return;
    }

    const start = currentItem.createdAt || Date.now();
    const updateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [currentItem?.id, currentItem?.status, currentItem?.createdAt]);

  // Copy logs handler for error modal
  const handleCopyLogs = (logs: string[]) => {
    if (!logs || logs.length === 0) return;
    navigator.clipboard.writeText(logs.join('\n'));
    setCopiedLogs(true);
    if (onToast) onToast("Error logs copied", "info");
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Direct MP4 downloader that safely downloads blob without navigation or 1KB error files
  const handleDownload = async (e: React.MouseEvent, url?: string, filename?: string) => {
    e.stopPropagation();
    if (!url) return;
    const safeName = filename || 'rendered_video.mp4';
    if (onToast) onToast("Downloading master video...", "info");

    const candidateUrls: string[] = [url];
    if (currentItem) {
      if ((currentItem as any).telegram_file_id) candidateUrls.push(`/api/video/${(currentItem as any).telegram_file_id}`);
      if ((currentItem as any).file_id) candidateUrls.push(`/api/video/${(currentItem as any).file_id}`);
      if (currentItem.id) candidateUrls.push(`/api/video/${currentItem.id}`);
      if ((currentItem as any).vid) candidateUrls.push(`/api/video/${(currentItem as any).vid}`);
    }

    try {
      let downloadBlob: Blob | null = null;
      let lastErr = '';

      for (const candidate of candidateUrls) {
        try {
          const resp = await fetch(candidate);
          if (!resp.ok) {
            lastErr = `HTTP ${resp.status}`;
            continue;
          }
          const cType = (resp.headers.get('content-type') || '').toLowerCase();
          if (cType.includes('application/json') || cType.includes('text/html')) {
            lastErr = "Stream not ready";
            continue;
          }
          const blob = await resp.blob();
          if (blob.size < 2000) {
            lastErr = "File too small";
            continue;
          }
          downloadBlob = blob;
          break;
        } catch (fetchErr: any) {
          lastErr = fetchErr.message || 'Fetch failed';
        }
      }

      if (!downloadBlob) {
        throw new Error(lastErr || "Failed to download master video stream");
      }

      const blobUrl = window.URL.createObjectURL(downloadBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = safeName.endsWith('.mp4') ? safeName : `${safeName}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
      if (onToast) onToast("Download completed!", "success");
    } catch (err: any) {
      if (onToast) onToast(`Download failed: ${err.message || 'Error'}`, "error");
    }
  };

  // Open Clean Video Player
  const handleOpenPlay = (
    e: React.MouseEvent,
    url?: string,
    title?: string,
    filename?: string,
    size?: number
  ) => {
    e.stopPropagation();
    if (!url) return;
    if (onOpenVideoPreview) {
      onOpenVideoPreview(url, title || filename || 'Rendered Video');
    }
    setCleanPlayerModal({
      isOpen: true,
      url,
      title: title || filename || 'Rendered Video',
      filename,
      size
    });
  };

  const handleCancelExecution = async (jobId: string) => {
    try {
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_job', payload: { jobId } })
      });
      handleDismissJob(jobId);
      if (onToast) onToast("Render cancelled", "info");
      fetchKaggleJobs();
    } catch (_) {}
  };

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isCompleted = currentItem?.status === 'completed';
  const isFailed = currentItem?.status === 'failed';
  const isRunning = currentItem?.status === 'running' || currentItem?.status === 'dispatching' || currentItem?.status === 'queued';
  
  // Accurate progress calculation: monotonic progress without jitter or backwards jumping
  const rawProgress = currentItem?.progress || 0;
  const previousProgress = currentItem?.id ? (progressMapRef.current[currentItem.id] || 0) : 0;
  const effectiveProgress = isCompleted ? 100 : Math.max(previousProgress, Math.min(99, rawProgress));
  if (currentItem?.id) {
    progressMapRef.current[currentItem.id] = effectiveProgress;
  }
  const clampedProgress = Math.min(100, Math.max(0, effectiveProgress));

  // Sync dock presence with document and active modals so dedicated separate space is created
  useEffect(() => {
    const isVisible = Boolean(currentItem);
    try {
      if (typeof document !== 'undefined') {
        document.documentElement.dataset.hasBottomRenderBar = isVisible ? 'true' : 'false';
      }
      window.dispatchEvent(new CustomEvent('bottom-bar-visible', { detail: { visible: isVisible } }));
    } catch (_) {}
  }, [Boolean(currentItem)]);

  useEffect(() => {
    return () => {
      try {
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.hasBottomRenderBar = 'false';
        }
        window.dispatchEvent(new CustomEvent('bottom-bar-visible', { detail: { visible: false } }));
      } catch (_) {}
    };
  }, []);

  return (
    <>
      {/* 
        ========================================================================
        CLEAN, COMPLETE VIDEO PLAYER MODAL (Pure Video Player with Standard Buttons)
        No debug logs, no terminal text, no confusing developer pipeline boxes!
        ========================================================================
      */}
      {cleanPlayerModal?.isOpen && (
        <div 
          className="fixed inset-0 z-[220] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setCleanPlayerModal(null)}
        >
          <div 
            className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Video Title & Close Button */}
            <div className="px-4 py-3 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {cleanPlayerModal.title}
                  </h3>
                  <p className="text-[11px] text-emerald-400 font-medium">
                    Master Video Ready
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCleanPlayerModal(null)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Complete, High-Quality Video Player */}
            <div className="relative w-full aspect-[9/16] max-h-[62vh] bg-black flex items-center justify-center overflow-hidden">
              <video
                src={cleanPlayerModal.url}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Footer with Normal, Clean Buttons */}
            <div className="p-3 bg-gray-900/90 border-t border-gray-800 flex items-center justify-between gap-2">
              <div className="text-xs text-gray-400 font-mono">
                {cleanPlayerModal.size ? `${(cleanPlayerModal.size / (1024 * 1024)).toFixed(1)} MB` : ''}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, cleanPlayerModal.url, cleanPlayerModal.filename)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition active:scale-95 cursor-pointer"
                >
                  <Download size={15} />
                  Download MP4
                </button>
                <button
                  type="button"
                  onClick={() => setCleanPlayerModal(null)}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-gray-700 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 
        ========================================================================
        LOGS MODAL (Shows live step-by-step logs or error trace)
        ========================================================================
      */}
      {errorLogsModal?.isOpen && (() => {
        const liveMatch = errorLogsModal.jobId 
          ? (kaggleJobs.find(j => j.jobId === errorLogsModal.jobId) || (localExportJob?.id === errorLogsModal.jobId ? localExportJob : null))
          : (kaggleJobs.find(j => j.projectName === errorLogsModal.title) || (localExportJob?.projectName === errorLogsModal.title ? localExportJob : null));
        const effectiveLogs = (liveMatch?.logs && liveMatch.logs.length > 0)
          ? liveMatch.logs
          : (errorLogsModal.logs || []);
        const isLiveRunning = liveMatch ? (liveMatch.status === 'running' || liveMatch.status === 'dispatching' || liveMatch.status === 'queued') : false;

        return (
          <div 
            className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-150"
            onClick={() => setErrorLogsModal(null)}
          >
            <div 
              className={`w-full max-w-xl bg-gray-950 border ${errorLogsModal.error ? 'border-rose-500/40' : 'border-cyan-500/40'} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-4 py-3 ${errorLogsModal.error ? 'bg-rose-950/40 border-rose-900/50' : 'bg-gray-900/90 border-gray-800'} border-b flex items-center justify-between gap-2`}>
                <div className="flex items-center gap-2 min-w-0">
                  {errorLogsModal.error ? (
                    <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                  ) : (
                    <Terminal size={18} className="text-cyan-400 shrink-0" />
                  )}
                  <h3 className="text-sm font-bold text-white truncate">
                    {errorLogsModal.error ? 'Execution Error • ' : 'Terminal Logs • '} {errorLogsModal.title}
                  </h3>
                  {isLiveRunning && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Live Stream
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {effectiveLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyLogs(effectiveLogs)}
                      className="px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 border border-gray-700 transition cursor-pointer"
                    >
                      {copiedLogs ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setErrorLogsModal(null)}
                    className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {errorLogsModal.error && (
                <div className="p-3 bg-rose-950/20 border-b border-rose-900/30 text-xs text-rose-300 font-mono">
                  {errorLogsModal.error.includes('<!doctype') || errorLogsModal.error.includes('<') || errorLogsModal.error.includes('Unexpected token')
                    ? 'Server connection timed out or warming up. Please check GPU settings and retry.'
                    : errorLogsModal.error}
                </div>
              )}

              <div 
                ref={logsContainerRef}
                className="p-3 font-mono text-[11px] bg-black text-gray-300 overflow-y-auto max-h-[50vh] leading-relaxed select-text space-y-0.5"
              >
                {effectiveLogs.length === 0 ? (
                  <div className="text-gray-500 py-6 text-center">No log messages recorded.</div>
                ) : (
                  effectiveLogs.map((rawLine, idx) => {
                    const line = (rawLine.includes('<!doctype') || rawLine.includes('<!DOCTYPE') || (rawLine.includes('Unexpected token') && rawLine.includes('<')))
                      ? 'Server connection timed out or warming up. Please check GPU settings and retry.'
                      : rawLine;
                    return (
                      <div key={idx} className={`py-0.5 ${errorLogsModal.error ? 'text-rose-300' : 'text-gray-300'}`}>
                        <span className="text-gray-600 mr-2 select-none">{idx + 1}</span>
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 
        ========================================================================
        SLEEK THIN DOCKED BOTTOM STRIP (MULTI-VIDEO CONTINUOUS SWAPPING CAROUSEL)
        Auto-swaps between Video 1, Video 2, etc. with distinct changing bar colors
        and clear clickable numbers for instant monitoring!
        ========================================================================
      */}
      {currentItem && (
        <div 
          id="bottom-render-status-dock"
          className="fixed bottom-0 left-0 right-0 z-[145] select-none pointer-events-auto"
        >
          <div 
            className="w-full border-t border-white/20 bg-gray-950/98 backdrop-blur-md transition-all duration-500 flex flex-col overflow-hidden shadow-2xl pb-[max(env(safe-area-inset-bottom,0px),4px)]"
          >
            {/* Illuminated Progress Strip at TOP of dock - Always 100% visible, never cut off by phone navigation */}
            <div className="w-full h-1.5 bg-gray-900 overflow-hidden relative shrink-0 shadow-inner">
              <div 
                className={`h-full transition-all duration-500 ${
                  isCompleted 
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' 
                    : isFailed
                    ? 'bg-rose-500'
                    : `${currentTheme.barBg} shadow-[0_0_8px_rgba(56,189,248,0.8)]`
                }`}
                style={{ width: `${clampedProgress}%` }}
              />
            </div>

            {/* Ultra-sleek compact single-line bar (h-9 sm:h-10) */}
            <div className="h-9 sm:h-10 px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2">
              {/* Left: Indicator, Multi-video numbers, Project Name, Status */}
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 overflow-hidden">
                {/* State Indicator */}
                {isCompleted ? (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                ) : isFailed ? (
                  <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                ) : (
                  <span className={`w-2 h-2 rounded-full ${currentTheme.dotBg} shrink-0 animate-pulse`} />
                )}

                {/* Multiple Videos Number Pills: Clickable tabs to swap between Video 1, Video 2, etc. */}
                {allActiveItems.length > 1 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {allActiveItems.map((item, idx) => {
                      const theme = COLOR_THEMES[idx % COLOR_THEMES.length];
                      const isSelected = idx === activeItemIndex;
                      const isItemDone = item.status === 'completed';
                      const isItemFail = item.status === 'failed';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveItemIndex(idx);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? `${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder} shadow-xs scale-105 ring-1 ring-white/25`
                              : 'bg-gray-900/80 text-gray-400 hover:text-gray-200 border border-gray-800'
                          }`}
                          title={`Switch to Video ${idx + 1}: ${item.title} (${item.progress}%)`}
                        >
                          {isItemDone ? (
                            <CheckCircle2 size={10} className="text-emerald-400" />
                          ) : isItemFail ? (
                            <AlertTriangle size={10} className="text-rose-400" />
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? theme.dotBg : 'bg-gray-500'} ${isSelected ? 'animate-pulse' : ''}`} />
                          )}
                          <span>#{idx + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Title: Only show on sm+ when running, or when completed, so status has full space on mobile */}
                <span 
                  key={currentItem.id}
                  className={`${isRunning ? 'hidden sm:inline' : 'inline'} text-[11px] font-bold text-white truncate shrink-0 max-w-[80px] sm:max-w-[140px] animate-in fade-in duration-300`}
                >
                  {currentItem.title}
                </span>

                {/* Percentage with distinct color badge */}
                {isRunning && (
                  <span className={`text-[10px] font-mono font-bold ${currentTheme.badgeText} ${currentTheme.badgeBg} border ${currentTheme.badgeBorder} px-1.5 py-0.5 rounded shrink-0 transition-colors duration-300`}>
                    {clampedProgress}%
                  </span>
                )}

                {/* Status snippet / Frame Count: Ultra-compact, styled with dynamic theme color */}
                <span 
                  key={`${currentItem.id}_status`}
                  className={`text-[10px] sm:text-[11px] truncate font-semibold min-w-0 flex-1 animate-in fade-in duration-300 ${
                    isCompleted ? 'text-emerald-400 font-bold' : isFailed ? 'text-rose-400' : `${currentTheme.statusText} font-mono tracking-tight`
                  }`}
                >
                  {isCompleted 
                    ? 'Ready ✓'
                    : isFailed
                    ? 'Failed ✕'
                    : formatShortStatus(currentItem.statusText)
                  }
                </span>

                {/* Elapsed Time */}
                {isRunning && (
                  <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 shrink-0">
                    ({formatTime(elapsedSeconds)})
                  </span>
                )}
              </div>

              {/* Right: Normal Clean Buttons (No logs unless error!) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* When COMPLETED: Normal Play, Download, Dismiss buttons */}
                {isCompleted && (currentItem.downloadUrl || currentItem.filename) && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleOpenPlay(e, currentItem.downloadUrl, currentItem.title, currentItem.filename, currentItem.size)}
                      className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                      title="Play rendered video"
                    >
                      <Play size={11} fill="currentColor" />
                      <span>Play</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, currentItem.downloadUrl, currentItem.filename)}
                      className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-md text-xs font-medium flex items-center gap-1 border border-gray-700 transition cursor-pointer"
                      title="Download MP4"
                    >
                      <Download size={11} />
                      <span className="hidden xs:inline">Download</span>
                    </button>
                  </>
                )}

                {/* When RUNNING / QUEUED: Show live logs button and cancel button */}
                {isRunning && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setErrorLogsModal({
                          isOpen: true,
                          jobId: currentItem.id,
                          title: currentItem.title,
                          error: undefined,
                          logs: currentItem.logs && currentItem.logs.length > 0 ? currentItem.logs : [currentItem.statusText]
                        });
                      }}
                      className="px-2 py-0.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-md text-xs font-medium flex items-center gap-1 border border-gray-700 transition cursor-pointer"
                      title="View Live Execution Logs"
                    >
                      <Terminal size={11} className="text-cyan-400" />
                      <span className="hidden xs:inline">Logs</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelExecution(currentItem.id);
                      }}
                      className="px-2 py-0.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-rose-100 rounded-md text-[11px] font-semibold flex items-center gap-1 border border-rose-800/50 transition active:scale-95 cursor-pointer shadow-xs"
                      title="Cancel render execution"
                    >
                      <X size={12} />
                      <span>Cancel</span>
                    </button>
                  </>
                )}

                {/* When FAILED: Only then show Error Logs button */}
                {isFailed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setErrorLogsModal({
                        isOpen: true,
                        jobId: currentItem.id,
                        title: currentItem.title,
                        error: currentItem.error,
                        logs: currentItem.logs
                      });
                    }}
                    className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-md text-xs font-medium flex items-center gap-1 border border-rose-700/60 transition cursor-pointer"
                    title="View Error Logs"
                  >
                    <Terminal size={11} className="text-rose-400" />
                    <span>Error Logs</span>
                  </button>
                )}

                {/* Dismiss Button - only show when not running to prevent duplicate close icons */}
                {!isRunning && (
                  <button
                    type="button"
                    onClick={(e) => handleDismissJob(currentItem.id, e)}
                    className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition cursor-pointer"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
