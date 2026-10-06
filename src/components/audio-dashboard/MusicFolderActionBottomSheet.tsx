import React from 'react';
import { 
  Folder, Music, Trash2, Edit2, Star, X
} from 'lucide-react';

interface MusicFolderActionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folder: { id: string; name: string; is_root?: boolean; is_starred?: boolean; ownerId?: string } | null;
  trackCount: number;
  subfolderCount?: number;
  isFavoriteForProject?: boolean;
  activeProjectName?: string;
  onOpenFolder: (id: string) => void;
  onToggleFavoriteForProject?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string, name: string) => void;
}

export const MusicFolderActionBottomSheet: React.FC<MusicFolderActionBottomSheetProps> = ({
  isOpen,
  onClose,
  folder,
  trackCount,
  subfolderCount = 0,
  isFavoriteForProject = false,
  activeProjectName,
  onOpenFolder,
  onToggleFavoriteForProject,
  onRename,
  onDelete
}) => {
  if (!isOpen || !folder) return null;

  const isCustomFolder = folder.id !== 'root' && folder.id !== '__root_folder__' && folder.id !== '__starred__';
  const hasSubfolders = subfolderCount > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl z-20 flex flex-col gap-3 animate-in slide-in-from-bottom-6 duration-200 text-left"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-700/70 rounded-full mx-auto -mt-1 mb-1 sm:hidden" />

        {/* Header Info */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`p-2 rounded-xl shrink-0 ${
              isFavoriteForProject
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                : 'bg-pink-500/15 text-pink-400 border border-pink-500/25'
            }`}>
              <Music size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-white text-sm truncate" title={folder.name}>
                  {folder.name}
                </h3>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700/60 shrink-0">
                  {hasSubfolders ? `${subfolderCount} subfolder${subfolderCount === 1 ? '' : 's'}` : `${trackCount} track${trackCount === 1 ? '' : 's'}`}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {isFavoriteForProject ? `⭐ Starred for ${activeProjectName || 'Project'}` : 'Universal Music Folder'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1.5 pt-1">
          {/* 1. Open Folder */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFolder(folder.id);
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-750 text-white font-semibold text-xs flex items-center gap-2.5 transition active:scale-98 cursor-pointer"
          >
            <Folder size={15} className="text-pink-400" />
            <span>Open Folder</span>
          </button>

          {/* 2. Star / Favorite Folder for Active Project */}
          {onToggleFavoriteForProject && isCustomFolder && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onToggleFavoriteForProject(folder.id);
              }}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition active:scale-98 cursor-pointer ${
                isFavoriteForProject
                  ? 'bg-amber-950/70 border-amber-500/50 text-amber-200 hover:bg-amber-900/60 shadow-xs'
                  : 'bg-gray-850 border-gray-750 text-gray-200 hover:bg-gray-800'
              }`}
            >
              <Star size={15} className={isFavoriteForProject ? "fill-amber-400 text-amber-400" : "text-amber-400"} />
              <span>
                {isFavoriteForProject
                  ? `Unstar Folder${activeProjectName ? ` (${activeProjectName})` : ''}`
                  : `Star as Favorite Folder${activeProjectName ? ` (${activeProjectName})` : ''}`}
              </span>
            </button>
          )}

          {/* 3. Rename */}
          {isCustomFolder && onRename && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRename(folder.id, folder.name);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-gray-800/80 hover:bg-gray-750 text-white font-semibold text-xs flex items-center gap-2.5 transition active:scale-98 cursor-pointer"
            >
              <Edit2 size={15} className="text-purple-400" />
              <span>Rename Folder</span>
            </button>
          )}

          {/* 4. Delete */}
          {isCustomFolder && onDelete && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(folder.id, folder.name);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 font-semibold text-xs flex items-center gap-2.5 transition active:scale-98 border border-red-500/30 cursor-pointer"
            >
              <Trash2 size={15} className="text-red-400" />
              <span>Delete Folder</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
