import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Minimize2, 
  Maximize2, 
  Copy, 
  RefreshCw, 
  Play, 
  FolderPlus, 
  Key, 
  Trash2, 
  Terminal, 
  UploadCloud,
  XCircle
} from 'lucide-react';
import { Job, JobFailedUrl } from '../types';

export interface ActiveUploadInfo {
  isUploading: boolean;
  currentUploadIndex: number;
  totalFiles: number;
  uploadProgressPercent: number;
  currentFileName: string;
  currentFileSize?: number;
  currentLoadedBytes?: number;
  targetFolderName?: string;
  isSyncing?: boolean;
  onExpand: () => void;
  onCancel: () => void;
}

interface JobProgressNotificationProps {
  jobs: Job[];
  activeUpload?: ActiveUploadInfo | null;
  onDismiss: (jobId: string) => void;
  onCancelJob?: (jobId: string) => void;
  onRetryFailed: (jobId: string, urls: string[], targetFid?: string, mode?: string) => void;
  onResumeJob?: (jobId: string) => void;
  onOpenFailedModal: (data: { jobId: string; targetFid: string; mode: string; failedUrls: JobFailedUrl[]; title?: string }) => void;
  onOpenSettings?: (tab?: string) => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  retryingJobId?: string | null;
  resumingJobId?: string | null;
  activeFolderId?: string;
}

export const JobProgressNotification: React.FC<JobProgressNotificationProps> = ({
  jobs,
  activeUpload,
  onDismiss,
  onCancelJob,
  onRetryFailed,
  onResumeJob,
  onOpenFailedModal,
  onOpenSettings,
  onToast,
  retryingJobId,
  resumingJobId,
  activeFolderId = 'root'
}) => {
  // Global minimize state persisted in localStorage - defaults to true on mobile/Android
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('job_panel_minimized');
      if (saved !== null) return saved === 'true';
      if (typeof window !== 'undefined' && window.innerWidth < 640) return true;
      return false;
    } catch {
      return typeof window !== 'undefined' ? window.innerWidth < 640 : false;
    }
  });

  const [cancellingJobIds, setCancellingJobIds] = useState<{ [key: string]: boolean }>({});
  const [hasBottomBar, setHasBottomBar] = useState<boolean>(() => {
    return typeof document !== 'undefined' && document.documentElement.dataset.hasBottomRenderBar === 'true';
  });

  useEffect(() => {
    const handleBar = (e: any) => {
      setHasBottomBar(Boolean(e.detail?.visible));
    };
    window.addEventListener('bottom-bar-visible', handleBar);
    return () => window.removeEventListener('bottom-bar-visible', handleBar);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('job_panel_minimized', isMinimized.toString());
    } catch {}
  }, [isMinimized]);

  // Track jobs that were already completed before this component mounted.
  // Stale completed jobs from previous sessions must NEVER appear as floating notification banners!
  const initialCompletedJobIdsRef = React.useRef<Set<string>>(new Set());
  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current && jobs && jobs.length > 0) {
      jobs.forEach(j => {
        if (j.status === 'completed' || j.status === 'failed' || j.status === 'partial') {
          initialCompletedJobIdsRef.current.add(j.id);
        }
      });
      hasInitializedRef.current = true;
    }
  }, [jobs]);

  const handleDismiss = (jobId: string) => {
    initialCompletedJobIdsRef.current.add(jobId);
    onDismiss(jobId);
    fetch(`/api/jobs/${jobId}`, { method: 'DELETE' }).catch(() => {});
  };

  const safeJobs = React.useMemo(() => {
    return (jobs || []).filter(j => {
      // Stale jobs that were completed before page was opened: NEVER show
      if (initialCompletedJobIdsRef.current.has(j.id)) {
        return false;
      }
      return true;
    }).slice(0, 2); // Cap at maximum 2 visible notification cards so they NEVER stack up and cover the screen!
  }, [jobs]);

  useEffect(() => {
    // Auto-dismiss completed jobs after 5 seconds so they never linger or clutter the screen
    safeJobs.forEach(j => {
      if (j.status === 'completed' || j.status === 'failed') {
        const timer = setTimeout(() => {
          handleDismiss(j.id);
        }, 5000);
        return () => clearTimeout(timer);
      }
    });
  }, [safeJobs]);

  const hasJobs = safeJobs.length > 0;
  const hasUpload = Boolean(activeUpload && activeUpload.isUploading);

  if (!hasJobs && !hasUpload) return null;

  const handleCancel = async (jobId: string) => {
    setCancellingJobIds(prev => ({ ...prev, [jobId]: true }));
    try {
      if (onCancelJob) {
        onCancelJob(jobId);
      } else {
        await fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
        handleDismiss(jobId);
        onToast("Generation canceled instantly", "info");
      }
    } catch (_) {
      handleDismiss(jobId);
      onToast("Generation canceled", "info");
    } finally {
      setTimeout(() => {
        setCancellingJobIds(prev => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }, 1000);
    }
  };

  return (
    <div 
      id="job-progress-panel-container"
      className={`fixed ${hasBottomBar ? 'bottom-12 sm:bottom-14' : 'bottom-4'} right-4 sm:right-6 left-4 sm:left-auto sm:w-[500px] max-w-[calc(100vw-2rem)] z-[95] flex flex-col gap-3 pointer-events-none transition-all duration-300`}
    >
      {/* Real-time Video Upload Card in the Corner */}
      {hasUpload && activeUpload && (
        <div
          id="active-upload-progress-card"
          className="pointer-events-auto w-full rounded-2xl shadow-2xl backdrop-blur-xl border border-emerald-500/70 bg-gray-950/95 text-emerald-100 shadow-emerald-950/40 transition-all duration-300 overflow-hidden"
        >
          {isMinimized ? (
            /* COMPACT MINIMIZED UPLOAD ROW */
            <div className="p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shrink-0">
                  {activeUpload.isSyncing ? (
                    <RefreshCw className="animate-spin text-sky-400" size={13} />
                  ) : (
                    <UploadCloud className="animate-pulse text-emerald-400" size={13} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="truncate pr-1.5 text-white text-[11px] sm:text-xs">
                      {activeUpload.currentFileName || `Uploading (${activeUpload.currentUploadIndex + 1}/${activeUpload.totalFiles})`}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-mono text-emerald-400 shrink-0 font-bold">
                      {activeUpload.uploadProgressPercent}%
                    </span>
                  </div>
                  {/* Mini Progress bar */}
                  <div className="w-full bg-gray-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-200 rounded-full ${
                        activeUpload.isSyncing ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${activeUpload.uploadProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={activeUpload.onExpand}
                  className="p-1 sm:px-2 sm:py-1 text-gray-300 hover:text-white rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                  title="Expand Full Upload Details"
                >
                  <Maximize2 size={13} />
                  <span className="hidden sm:inline">Expand</span>
                </button>

                <button
                  type="button"
                  onClick={activeUpload.onCancel}
                  className="p-1 sm:px-2 sm:py-1 text-rose-300 hover:text-white rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Cancel Upload"
                >
                  <XCircle size={13} className="text-rose-400" />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
            </div>
          ) : (
            /* EXPANDED UPLOAD CARD */
            <div className="p-4 flex flex-col gap-3">
              {/* Header with Title & Controls */}
              <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-gray-800/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shrink-0">
                    {activeUpload.isSyncing ? (
                      <RefreshCw className="animate-spin text-sky-400" size={17} />
                    ) : (
                      <UploadCloud className="animate-pulse text-emerald-400" size={17} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm leading-tight flex items-center gap-2 truncate text-white">
                      <span>Uploading Video ({activeUpload.currentUploadIndex + 1}/{activeUpload.totalFiles})</span>
                      {activeUpload.targetFolderName && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-mono font-normal truncate max-w-[120px]">
                          &rarr; {activeUpload.targetFolderName}
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate font-mono">
                      {activeUpload.currentFileName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="px-2.5 py-1 text-gray-300 hover:text-white rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Minimize to slim bar"
                  >
                    <Minimize2 size={13} />
                    <span>Minimize</span>
                  </button>
                  <button
                    type="button"
                    onClick={activeUpload.onExpand}
                    className="px-2.5 py-1 text-gray-300 hover:text-white rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Open full upload window"
                  >
                    <Maximize2 size={13} />
                    <span>Expand</span>
                  </button>
                  <button
                    type="button"
                    onClick={activeUpload.onCancel}
                    className="px-2.5 py-1 text-rose-300 hover:text-white rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Cancel Upload"
                  >
                    <XCircle size={13} className="text-rose-400" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar & Byte Details */}
              <div className="bg-gray-900/90 rounded-xl p-3 border border-gray-800/90 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-emerald-300 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>{activeUpload.isSyncing ? 'Syncing to Cloud Storage...' : 'Uploading video file...'}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {activeUpload.uploadProgressPercent}%
                  </span>
                </div>

                <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-emerald-900/40">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      activeUpload.isSyncing ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${activeUpload.uploadProgressPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span>
                    {activeUpload.currentLoadedBytes !== undefined && activeUpload.currentFileSize
                      ? `${(activeUpload.currentLoadedBytes / (1024 * 1024)).toFixed(1)} / ${(activeUpload.currentFileSize / (1024 * 1024)).toFixed(1)} MB`
                      : 'Transferring data...'}
                  </span>
                  <span>File {activeUpload.currentUploadIndex + 1} of {activeUpload.totalFiles}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {safeJobs.map((job) => {
        const isProcessing = job.status === 'pending' || job.status === 'processing';
        const isFailed = !isProcessing && (job.status === 'failed' || job.isTimedOut);
        const isPartial = !isProcessing && (job.status === 'partial' || (job.status === 'completed' && Array.isArray(job.failedUrls) && job.failedUrls.length > 0));
        const isSuccess = !isProcessing && job.status === 'completed' && (!job.failedUrls || job.failedUrls.length === 0);

        const isCookieIssue = (job.error && /cookie|login|sign in|auth|audience|certain audiences|not available to everyone|restricted|JSONDecodeError|Failed to parse JSON/i.test(job.error)) ||
          (job.failedUrls && job.failedUrls.some(f => /cookie|login|sign in|auth|audience|certain audiences|not available to everyone|restricted|JSONDecodeError|Failed to parse JSON/i.test(f.reason || f.error || '')));
        const isTimeout = job.isTimedOut || (job.error && /timeout|disconnected/i.test(job.error));

        const allUrls: string[] = job.payload?.urls || (job.payload?.url ? [job.payload.url] : []);
        const totalItems = allUrls.length > 0 ? allUrls.length : (job.totalClips || 1);
        
        const completedUrlsList = job.completedUrls || [];
        const failedList: JobFailedUrl[] = job.failedUrls && job.failedUrls.length > 0
          ? job.failedUrls
          : (job.status === 'failed' && allUrls.length > 0
              ? allUrls.map(u => ({ url: u, reason: job.error || "Download failed" }))
              : []);

        const doneCount = completedUrlsList.length;
        const failedCount = failedList.length;
        const remainingCount = Math.max(0, totalItems - doneCount - failedCount);

        // Overall progress percentage
        const progressPercent = typeof job.percent === 'number'
          ? Math.min(100, Math.max(0, job.percent))
          : (isSuccess ? 100 : Math.round(((doneCount + failedCount) / (totalItems || 1)) * 100));

        return (
          <div
            key={job.id}
            id={`job-notification-${job.id}`}
            className={`pointer-events-auto w-full rounded-2xl shadow-2xl backdrop-blur-xl border transition-all duration-300 overflow-hidden ${
              isProcessing
                ? 'bg-gray-950/95 border-blue-600/70 text-blue-100 shadow-blue-950/40'
                : isFailed
                ? 'bg-gray-950/95 border-rose-600/70 text-rose-100 shadow-rose-950/40'
                : isPartial
                ? 'bg-gray-950/95 border-amber-500/70 text-amber-100 shadow-amber-950/40'
                : 'bg-gray-950/95 border-emerald-600/70 text-emerald-100 shadow-emerald-950/40'
            }`}
          >
            {/* COMPACT MINIMIZED VIEW */}
            {isMinimized ? (
              <div className="p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                  {isProcessing && (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-900/60 border border-blue-500/50 flex items-center justify-center shrink-0">
                      <Loader2 className="animate-spin text-blue-400" size={13} />
                    </div>
                  )}
                  {isPartial && (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-900/60 border border-amber-500/50 flex items-center justify-center shrink-0">
                      <AlertTriangle className="text-amber-400" size={13} />
                    </div>
                  )}
                  {isFailed && (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-900/60 border border-rose-500/50 flex items-center justify-center shrink-0">
                      <AlertCircle className="text-rose-400" size={13} />
                    </div>
                  )}
                  {isSuccess && (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shrink-0">
                      <CheckCircle className="text-emerald-400" size={13} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="truncate pr-1.5 text-white text-[11px] sm:text-xs">
                        {isProcessing ? (job.stepName || job.progress || "Processing...") : 
                         isPartial ? `Partial: ${doneCount}✓ ${failedCount}✗` :
                         isFailed ? "Task Failed" : "Done"}
                      </span>
                      <span className="text-[10px] sm:text-[11px] font-mono text-gray-300 shrink-0">
                        {progressPercent}%
                      </span>
                    </div>
                    {/* Mini Progress bar */}
                    <div className="w-full bg-gray-800 h-1 sm:h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isFailed ? 'bg-rose-500' : isPartial ? 'bg-amber-500' : isSuccess ? 'bg-emerald-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Badges in mini bar */}
                  {doneCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/60 text-[10px] font-bold">
                      {doneCount}✓
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-700/60 text-[10px] font-bold">
                      {failedCount}✗
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsMinimized(false)}
                    className="p-1 sm:px-2 sm:py-1 text-gray-300 hover:text-white rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                    title="Expand Job Details"
                  >
                    <Maximize2 size={13} />
                    <span className="hidden sm:inline">Expand</span>
                  </button>

                  {isProcessing ? (
                    <button
                      type="button"
                      onClick={() => handleCancel(job.id)}
                      disabled={cancellingJobIds[job.id]}
                      className="p-1 sm:px-2 sm:py-1 text-rose-300 hover:text-white rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      title="Force Cancel Job"
                    >
                      {cancellingJobIds[job.id] ? <Loader2 size={13} className="animate-spin text-rose-300" /> : <XCircle size={13} className="text-rose-400" />}
                      <span className="hidden sm:inline">Cancel</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDismiss(job.id)}
                      className="p-1 text-gray-400 hover:text-rose-300 rounded-lg hover:bg-gray-800 transition cursor-pointer"
                      title="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* FULL CLEAN & DIRECT VIEW */
              <div className="p-4 flex flex-col gap-3">
                {/* Header with Title & Minimizer Controls */}
                <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-gray-800/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isProcessing && (
                      <div className="w-8 h-8 rounded-xl bg-blue-900/60 border border-blue-500/50 flex items-center justify-center shrink-0">
                        <Loader2 className="animate-spin text-blue-400" size={17} />
                      </div>
                    )}
                    {isPartial && (
                      <div className="w-8 h-8 rounded-xl bg-amber-900/60 border border-amber-500/50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="text-amber-400" size={17} />
                      </div>
                    )}
                    {isFailed && (
                      <div className="w-8 h-8 rounded-xl bg-rose-900/60 border border-rose-500/50 flex items-center justify-center shrink-0">
                        <AlertCircle className="text-rose-400" size={17} />
                      </div>
                    )}
                    {isSuccess && (
                      <div className="w-8 h-8 rounded-xl bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shrink-0">
                        <CheckCircle className="text-emerald-400" size={17} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm leading-tight flex items-center gap-2 truncate">
                        {isProcessing && (job.stepName || (job.type === 'reupload' ? `Re-uploading (${doneCount + failedCount + 1}/${totalItems})...` : `Processing (${doneCount + failedCount + 1}/${totalItems})...`))}
                        {isPartial && `Finished with ${failedCount} Failed (${doneCount} Done)`}
                        {isFailed && (job.type === 'reupload' ? "Re-upload to Telegram Failed" : isTimeout ? "Download Timed Out" : "Download Stopped")}
                        {isSuccess && (job.type === 'reupload' ? `All ${doneCount} Clips Re-uploaded to Telegram!` : `All ${doneCount} Clips Downloaded & Saved!`)}
                      </h4>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {job.progress || (isProcessing ? `Working on item ${doneCount + failedCount + 1} of ${totalItems}` : "Ready")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsMinimized(true)}
                      className="px-2.5 py-1 text-gray-300 hover:text-white rounded-lg bg-gray-900/80 hover:bg-gray-800 border border-gray-700/80 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Minimize panel to bottom"
                    >
                      <Minimize2 size={13} />
                      <span>Minimize</span>
                    </button>
                    {isProcessing ? (
                      <button
                        type="button"
                        onClick={() => handleCancel(job.id)}
                        disabled={cancellingJobIds[job.id]}
                        className="px-2.5 py-1 text-rose-300 hover:text-white rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/80 text-xs font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                        title="Force Cancel Job"
                      >
                        {cancellingJobIds[job.id] ? <Loader2 size={13} className="animate-spin text-rose-300" /> : <XCircle size={13} className="text-rose-400" />}
                        <span>Cancel</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDismiss(job.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-300 rounded-lg hover:bg-gray-800 transition cursor-pointer"
                        title="Close"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* DIRECT CLEAN PROGRESS BAR */}
                <div className="bg-gray-900/90 rounded-xl p-3 border border-gray-800/90 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-300">
                      {isProcessing ? (
                        <span className="flex items-center gap-1.5 text-blue-300">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                          </span>
                          Active: {doneCount + failedCount + 1} of {totalItems} ({doneCount} saved, {failedCount} failed)
                        </span>
                      ) : (
                        <span>Completed: {doneCount} of {totalItems} saved ({failedCount} failed)</span>
                      )}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Main Clean Progress Bar */}
                  <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden shadow-inner relative">
                    <div
                      className={`h-full transition-all duration-300 ease-out rounded-full relative overflow-hidden ${
                        isFailed ? 'bg-rose-500' : isPartial ? 'bg-amber-500' : isSuccess ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400'
                      }`}
                      style={{ width: `${Math.max(5, progressPercent)}%` }}
                    >
                      {isProcessing && (
                        <div className="absolute inset-0 bg-white/20 animate-pulse w-full h-full" />
                      )}
                    </div>
                  </div>

                  {/* Clean Visual Indicator Dots/Segments */}
                  {allUrls.length > 0 && (
                    <div className="grid grid-flow-col auto-cols-fr gap-1 h-2 w-full bg-gray-800/40 p-0.5 rounded-md">
                      {allUrls.map((url, idx) => {
                        const isDone = completedUrlsList.includes(url);
                        const isFail = failedList.some(f => f.url === url);
                        const isCur = isProcessing && (job.currentUrl === url || (!job.currentUrl && idx === doneCount + failedCount));

                        let bgClass = 'bg-gray-700/50';
                        if (isDone) bgClass = 'bg-emerald-500';
                        else if (isFail) bgClass = 'bg-rose-500';
                        else if (isCur) bgClass = 'bg-blue-400 animate-pulse';

                        return (
                          <div
                            key={idx}
                            className={`h-full rounded-xs transition-all ${bgClass}`}
                            title={`Item ${idx + 1}: ${isDone ? 'Done' : isFail ? 'Failed' : isCur ? 'Processing' : 'Waiting'}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SIMPLE RECENT LOG BOX */}
                {job.logs && job.logs.length > 0 && (
                  <div className="rounded-xl border border-gray-800/90 bg-gray-900/70 p-2.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold px-0.5">
                      <span className="flex items-center gap-1.5">
                        <Terminal size={12} className="text-cyan-400" />
                        Live Status Log
                      </span>
                      <span className="text-[10px] text-gray-500">{job.logs.length} messages</span>
                    </div>

                    <div className="max-h-24 overflow-y-auto font-mono text-[11px] space-y-1 bg-black/40 p-2 rounded-lg border border-gray-800/80">
                      {job.logs.slice(-6).map((log, lIdx) => (
                        <div
                          key={lIdx}
                          className={`flex items-start gap-1.5 ${
                            log.level === 'error' ? 'text-rose-400' :
                            log.level === 'warn' ? 'text-amber-400' :
                            log.level === 'success' ? 'text-emerald-400' : 'text-gray-300'
                          }`}
                        >
                          <span className="text-gray-500 shrink-0 text-[10px]">
                            {log.timeStr || new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                          </span>
                          <span className="break-all">{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOTTOM STATS & ACTION BUTTONS */}
                <div className="pt-2 border-t border-gray-800/80 flex flex-col gap-2.5">
                  {/* Stats Counters: Done vs Failed vs Remaining */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-600/50 flex items-center gap-1 shadow-sm">
                        <CheckCircle size={12} className="text-emerald-400" />
                        {doneCount} Done
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 shadow-sm ${
                        failedCount > 0 
                          ? 'bg-rose-950/90 text-rose-300 border-rose-600/50' 
                          : 'bg-gray-900 text-gray-400 border-gray-800'
                      }`}>
                        <AlertCircle size={12} className={failedCount > 0 ? "text-rose-400" : "text-gray-500"} />
                        {failedCount} Failed
                      </span>
                      {remainingCount > 0 && isProcessing && (
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-blue-950/80 text-blue-300 border border-blue-700/40 flex items-center gap-1">
                          {remainingCount} In-Queue
                        </span>
                      )}
                    </div>

                    {/* Resumption notice if job was stopped/interrupted */}
                    {(job.status === 'failed' || isTimeout) && doneCount > 0 && (
                      <span className="text-[11px] text-amber-300 font-medium">
                        Previous work saved ({doneCount} clips)!
                      </span>
                    )}
                  </div>

                  {/* Actions buttons row */}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {/* Resume / Continue Button if interrupted */}
                    {(isFailed || isPartial) && onResumeJob && (
                      <button
                        type="button"
                        disabled={resumingJobId === job.id}
                        onClick={() => onResumeJob(job.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                        title="Continue / Resume from where it stopped"
                      >
                        {resumingJobId === job.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Play size={13} />
                        )}
                        <span>Continue Work</span>
                      </button>
                    )}

                    {/* Add Clipped to Folder (for partial downloads) */}
                    {isPartial && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDismiss(job.id);
                          onToast(`Added and kept ${doneCount} clipped video(s) in folder!`, "success");
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                        title="Keep the clipped videos and dismiss this notification"
                      >
                        <FolderPlus size={13} />
                        <span>Keep Done ({doneCount})</span>
                      </button>
                    )}

                    {/* Retry Failed URLs button */}
                    {(isPartial || isFailed) && failedList.length > 0 && (
                      <button
                        type="button"
                        disabled={retryingJobId === job.id}
                        onClick={() => onRetryFailed(job.id, failedList.map(f => f.url), job.payload?.target_fid, job.payload?.mode)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {retryingJobId === job.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <RefreshCw size={13} />
                        )}
                        <span>Retry Failed ({failedList.length})</span>
                      </button>
                    )}

                    {/* Copy Link / Get Links Modal button */}
                    {(isPartial || isFailed) && failedList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenFailedModal({
                            jobId: job.id,
                            targetFid: job.payload?.target_fid || activeFolderId,
                            mode: job.payload?.mode || 'direct',
                            failedUrls: failedList,
                            title: isPartial ? "Remaining / Failed Links" : "Failed Download Links"
                          });
                        }}
                        className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        <Copy size={13} />
                        <span>Copy Links ({failedList.length})</span>
                      </button>
                    )}

                    {/* Open Cookies Settings if cookie issue */}
                    {isCookieIssue && onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings('cookies')}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-gray-700"
                      >
                        <Key size={13} />
                        <span>Update Cookies</span>
                      </button>
                    )}

                    {/* Dismiss / Remove button */}
                    {(isPartial || isFailed || isSuccess) && (
                      <button
                        type="button"
                        onClick={() => handleDismiss(job.id)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-rose-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-gray-700/80"
                        title="Dismiss notification"
                      >
                        <Trash2 size={13} />
                        <span>{isPartial ? "Remove" : "Dismiss"}</span>
                      </button>
                    )}

                    {/* Minimize and Cancel side-by-side for actively running jobs */}
                    {isProcessing && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsMinimized(true)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-gray-700 shadow-sm"
                          title="Minimize and keep at bottom"
                        >
                          <Minimize2 size={13} />
                          <span>Minimize</span>
                        </button>

                        <button
                          type="button"
                          disabled={cancellingJobIds[job.id]}
                          onClick={() => handleCancel(job.id)}
                          className="px-3.5 py-1.5 bg-rose-950/90 hover:bg-rose-900 border border-rose-600/70 text-rose-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                          title="Force Cancel and stop generation instantly"
                        >
                          {cancellingJobIds[job.id] ? (
                            <Loader2 size={13} className="animate-spin text-rose-300" />
                          ) : (
                            <XCircle size={13} className="text-rose-400" />
                          )}
                          <span>{cancellingJobIds[job.id] ? "Canceling..." : "Cancel"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
