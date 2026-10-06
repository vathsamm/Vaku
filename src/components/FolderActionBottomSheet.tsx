import React, { useState, useEffect } from 'react';
import { 
  Folder, Layers, Trash2, Copy, Plus, X, Clock, ExternalLink, Send, Loader2 
} from 'lucide-react';
import { FolderData } from '../types';

interface FolderActionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  folder: FolderData | null;
  isMaster: boolean;
  isBucket?: boolean;
  latestTime: number;
  clipCount?: number;
  projectCount?: number;
  countLabel?: string;
  onOpenFolder: (fId: string) => void;
  onDuplicateMasterBucket?: (fId: string) => void;
  onCreateProject?: (fId: string) => void;
  onOpenEditor?: (fId: string) => void;
  onDelete: (fId: string, name: string, type: 'master_bucket' | 'bucket' | 'folder') => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const FolderActionBottomSheet: React.FC<FolderActionBottomSheetProps> = ({
  isOpen,
  onClose,
  folderId,
  folder,
  isMaster,
  latestTime,
  projectCount = 0,
  countLabel,
  onOpenFolder,
  onDuplicateMasterBucket,
  onCreateProject,
  onDelete,
  onToast
}) => {
  const [folderStats, setFolderStats] = useState<{
    projectCount: number;
    clipCount: number;
    formattedSize: string;
    totalBytes: number;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    if (isOpen && folderId) {
      setLoadingStats(true);
      fetch(`/api/folder/${folderId}/stats`)
        .then(r => r.json())
        .then(d => {
          if (d && d.ok) {
            setFolderStats({
              projectCount: d.projectCount,
              clipCount: d.clipCount,
              formattedSize: d.formattedSize,
              totalBytes: d.totalBytes
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoadingStats(false));
    }
  }, [isOpen, folderId]);

  const handleBackupToTelegram = async () => {
    if (isBackingUp) return;
    setIsBackingUp(true);
    const fName = folder?.name || 'Folder';
    onToast?.(`Saving folder "${fName}" and interlinked clips to Telegram...`, 'info');
    try {
      const res = await fetch(`/api/folder/${folderId}/backup_to_telegram`, {
        method: 'POST'
      }).then(r => r.json());

      if (res && res.ok) {
        onToast?.(`✓ Folder "${fName}" (${res.formattedSize}) saved to Telegram!`, 'success');
        onClose();
      } else {
        onToast?.(res?.error || 'Failed to save folder to Telegram', 'error');
      }
    } catch (err: any) {
      onToast?.(err?.message || 'Network error saving folder to Telegram', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen || !folder) return null;

  const itemType: 'master_bucket' | 'bucket' | 'folder' = isMaster ? 'master_bucket' : 'folder';

  const formatFolderDateTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return { full: 'Not yet updated', relative: '' };
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const full = `${dateStr} • ${timeStr}`;

    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    let relative = 'Just now';
    if (mins >= 1 && mins < 60) relative = `${mins}m ago`;
    else if (mins >= 60 && mins < 1440) relative = `${Math.floor(mins / 60)}h ago`;
    else if (mins >= 1440) relative = `${Math.floor(mins / 1440)}d ago`;

    return { full, relative };
  };

  const { full: fullTime, relative: relTime } = formatFolderDateTime(latestTime);

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl z-20 flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-200 text-left"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-700/70 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`p-2 rounded-xl shrink-0 ${
              isMaster
                ? folder.is_virtual_duplicate
                  ? 'bg-pink-500/15 text-pink-400 border border-pink-500/25'
                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
            }`}>
              {isMaster ? <Layers size={18} /> : <Folder size={18} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-sm truncate" title={folder.name}>
                  {folder.name}
                </h3>
                {countLabel && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700/60 shrink-0">
                    {countLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 mt-0.5">
                <span className="text-gray-300">
                  {isMaster ? (folder.is_virtual_duplicate ? 'Virtual Copy' : 'Master Project') : 'Folder'}
                </span>
                {projectCount > 0 && (
                  <span>• {projectCount} project{projectCount !== 1 ? 's' : ''}</span>
                )}
              </div>
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

        <div className="px-2.5 py-1.5 bg-gray-950/80 border border-gray-800/80 rounded-xl flex items-center justify-between text-[11px] font-mono text-gray-400">
          <div className="flex items-center gap-1.5 truncate">
            <Clock size={12} className="text-gray-500 shrink-0" />
            <span className="text-gray-300 truncate">{fullTime}</span>
          </div>
          {relTime && (
            <span className="text-cyan-400 font-medium shrink-0 ml-1.5">
              {relTime}
            </span>
          )}
        </div>

        <div className="space-y-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFolder(folderId);
            }}
            className="w-full py-2 px-3 bg-gray-800 hover:bg-gray-750 text-white rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer active:scale-98"
          >
            <span className="flex items-center gap-2">
              <ExternalLink size={13} className="text-blue-400" />
              <span>Open {isMaster ? 'Master Project' : 'Folder'}</span>
            </span>
            <span className="text-gray-500 text-[10px] font-mono">Select</span>
          </button>

          {isMaster && (
            <>
              {onCreateProject && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateProject(folderId);
                  }}
                  className="w-full py-2 px-3 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/40 text-purple-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <Plus size={13} className="text-purple-400" />
                  <span>Create New Project</span>
                </button>
              )}

              {onDuplicateMasterBucket && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDuplicateMasterBucket(folderId);
                  }}
                  className="w-full py-2 px-3 bg-gray-800/80 hover:bg-gray-750 text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <Copy size={13} className="text-pink-400" />
                  <span>Duplicate Master Project</span>
                </button>
              )}
            </>
          )}

          {/* Save Folder to Telegram with File Size on the button */}
          <button
            type="button"
            onClick={handleBackupToTelegram}
            disabled={isBackingUp}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-950/80 via-blue-900/60 to-indigo-950/80 hover:from-sky-900/90 hover:to-indigo-900/90 border border-sky-500/40 text-white rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer active:scale-98 shadow-md"
          >
            <span className="flex items-center gap-2 min-w-0">
              {isBackingUp ? (
                <Loader2 size={15} className="animate-spin text-sky-400 shrink-0" />
              ) : (
                <Send size={15} className="text-sky-400 shrink-0" />
              )}
              <span className="flex flex-col text-left min-w-0">
                <span className="font-bold text-gray-100 truncate">
                  {isBackingUp ? 'Saving Folder to Telegram...' : 'Save Folder to Telegram'}
                </span>
                <span className="text-[10px] text-sky-300/80 font-normal truncate">
                  {folderStats ? `${folderStats.projectCount} project${folderStats.projectCount !== 1 ? 's' : ''} • ${folderStats.clipCount} clips` : 'All projects & interlinked clips'}
                </span>
              </span>
            </span>

            {/* File size indicator badge displayed over the button */}
            <span className="flex items-center gap-1 shrink-0 ml-2">
              {loadingStats ? (
                <span className="px-2 py-0.5 rounded-lg bg-sky-950 text-sky-300/70 border border-sky-700/40 text-[10px] font-mono animate-pulse">
                  Calculating...
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-sky-500/25 text-sky-300 border border-sky-400/40 text-[11px] font-mono font-bold shadow-xs">
                  {folderStats?.formattedSize || '0.0 MB'}
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(folderId, folder.name, itemType);
            }}
            className="w-full py-2 px-3 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-900/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer active:scale-98"
          >
            <Trash2 size={13} className="text-rose-400" />
            <span>Delete {isMaster ? 'Master Project' : 'Folder'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-1.5 text-gray-400 hover:text-gray-200 text-xs font-medium transition cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
