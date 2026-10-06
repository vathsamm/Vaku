import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SyncStatusInfo {
  overall: 'synced' | 'syncing' | 'error';
  telegram: {
    status: 'synced' | 'syncing' | 'error';
    lastSyncedAt: number | null;
    retries: number;
    error: string | null;
    pinnedMsgId: number | null;
    channelTitle?: string;
  };
  firebase: {
    status: 'synced' | 'syncing' | 'error';
    lastSyncedAt: number | null;
    retries: number;
    error: string | null;
    docId?: string;
  };
  lastModified?: number;
  lastBackup?: number;
}

interface SyncStatusBadgeProps {
  currentUserEmail?: string | null;
  onForceSync?: () => Promise<void>;
  isSyncingExternal?: boolean;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  onForceSync,
  isSyncingExternal = false,
  onToast
}) => {
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    overall: 'synced',
    telegram: {
      status: 'synced',
      lastSyncedAt: Date.now(),
      retries: 0,
      error: null,
      pinnedMsgId: null,
      channelTitle: 'Editor web'
    },
    firebase: {
      status: 'synced',
      lastSyncedAt: Date.now(),
      retries: 0,
      error: null,
      docId: 'main_state'
    }
  });

  const [activeTooltip, setActiveTooltip] = useState<'info' | 'error' | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setSyncInfo(data);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStatus();
      }
    }, 45000);

    const handleVisibility = () => {
      if (!document.hidden) fetchStatus();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    if (activeTooltip) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [activeTooltip]);

  const isSyncing = isSyncingExternal || isManualSyncing || syncInfo.overall === 'syncing';
  const hasError = syncInfo.overall === 'error' || syncInfo.telegram.status === 'error';

  const dotColorClass = hasError
    ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.95)] ring-2 ring-rose-500/40 animate-pulse'
    : isSyncing
      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.85)] ring-2 ring-amber-500/40 animate-pulse'
      : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] ring-2 ring-emerald-500/35';

  const formatRecentTime = (ts?: number | null) => {
    if (!ts) return 'Just now';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleClickDot = async () => {
    const lastTime = formatRecentTime(syncInfo.telegram.lastSyncedAt || syncInfo.lastBackup || syncInfo.lastModified);

    if (hasError) {
      setActiveTooltip(prev => prev === 'error' ? null : 'error');
      const errReason = syncInfo.telegram.error || 'Failed to sync with cloud';
      if (onToast) onToast(`Sync Error: ${errReason}`, 'error');
    } else if (isSyncing) {
      setActiveTooltip('info');
      if (onToast) onToast('Saving updates...', 'info');
    } else {
      setActiveTooltip(prev => prev === 'info' ? null : 'info');
      if (onToast) onToast(`All changes saved • Updated at ${lastTime}`, 'success');
      
      setTimeout(() => {
        setActiveTooltip(prev => prev === 'info' ? null : prev);
      }, 3500);
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsManualSyncing(true);
    try {
      if (onForceSync) {
        await onForceSync();
      } else {
        await fetch('/api/sync/trigger', { method: 'POST' });
      }
      await fetchStatus();
      setActiveTooltip(null);
    } catch (_) {}
    setIsManualSyncing(false);
  };

  const lastUpdatedTime = formatRecentTime(syncInfo.telegram.lastSyncedAt || syncInfo.lastBackup || syncInfo.lastModified);
  const errorMessage = syncInfo.telegram.error || 'Cloud sync timed out after 3 retries';

  return (
    <div className="relative shrink-0 flex items-center" ref={containerRef}>
      <button
        type="button"
        onClick={handleClickDot}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-800/90 hover:bg-gray-750 active:bg-gray-700 border border-gray-700/60 flex items-center justify-center transition cursor-pointer shrink-0 active:scale-95 shadow-sm"
        title={hasError ? `Error: ${errorMessage} (Click for details)` : `Synced • Last updated ${lastUpdatedTime}`}
        aria-label="Save and Sync Status"
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColorClass}`} />
      </button>

      {activeTooltip === 'info' && (
        <div className="absolute right-0 top-full mt-2 w-max max-w-[260px] bg-gray-900/95 backdrop-blur-md border border-gray-800 rounded-xl px-3 py-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <div className="text-[11px] leading-tight">
            <span className="text-gray-200 font-medium">All changes saved</span>
            <span className="text-gray-500 block text-[10px]">Updated at {lastUpdatedTime}</span>
          </div>
        </div>
      )}

      {activeTooltip === 'error' && (
        <div className="absolute right-0 top-full mt-2 w-64 sm:w-72 bg-gray-900 border border-red-500/30 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-red-400">
            <AlertCircle size={15} className="shrink-0" />
            <span>Save Issue Detected</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-snug bg-red-950/40 p-2 rounded-lg border border-red-900/40">
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isManualSyncing}
            className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
          >
            <RefreshCw size={12} className={isManualSyncing ? 'animate-spin' : ''} />
            <span>{isManualSyncing ? 'Retrying...' : 'Retry Save Now'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
