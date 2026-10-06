import React from 'react';
import { FolderPlus, FolderInput, Copy, Trash2, Loader2, Edit2, X } from 'lucide-react';
import { AudioFolder } from '../../types';

export interface RenameItemState {
  id: string;
  name: string;
  type: 'audio' | 'folder';
}

export interface AudioTargetModalState {
  audioIds: string[];
}

export interface DeleteConfirmItemState {
  type: 'folder' | 'track' | 'multi_tracks';
  id?: string;
  name: string;
  trackIds?: string[];
}

export interface AudioFolderActionModalsProps {
  // New folder
  showNewFolderModal: boolean;
  setShowNewFolderModal: (v: boolean) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  handleCreateFolder: () => void;
  parentFolderName?: string;
  audioFolders?: Record<string, AudioFolder>;

  // Rename
  renameItem: RenameItemState | null;
  setRenameItem: (v: RenameItemState | null) => void;
  handleSaveRename: () => void;

  // Move
  moveAudioModal: AudioTargetModalState | null;
  setMoveAudioModal: (v: AudioTargetModalState | null) => void;
  targetMoveFolderId: string;
  setTargetMoveFolderId: (id: string) => void;
  eligibleMoveFolders: AudioFolder[];
  handleExecuteMove: () => void;

  // Copy
  copyAudioModal: AudioTargetModalState | null;
  setCopyAudioModal: (v: AudioTargetModalState | null) => void;
  targetCopyFolderId: string;
  setTargetCopyFolderId: (id: string) => void;
  eligibleCopyFolders: AudioFolder[];
  handleExecuteCopy: () => void;
  isCopying: boolean;

  // Delete
  deleteConfirmItem: DeleteConfirmItemState | null;
  setDeleteConfirmItem: (v: DeleteConfirmItemState | null) => void;
  handleExecuteDelete: () => void;
  isDeleting: boolean;
}

export const AudioFolderActionModals: React.FC<AudioFolderActionModalsProps> = ({
  showNewFolderModal,
  setShowNewFolderModal,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  parentFolderName,
  audioFolders = {},

  renameItem,
  setRenameItem,
  handleSaveRename,

  moveAudioModal,
  setMoveAudioModal,
  targetMoveFolderId,
  setTargetMoveFolderId,
  eligibleMoveFolders,
  handleExecuteMove,

  copyAudioModal,
  setCopyAudioModal,
  targetCopyFolderId,
  setTargetCopyFolderId,
  eligibleCopyFolders,
  handleExecuteCopy,
  isCopying,

  deleteConfirmItem,
  setDeleteConfirmItem,
  handleExecuteDelete,
  isDeleting
}) => {
  const getFolderDisplayPath = (f: AudioFolder) => {
    const parts = [f.name];
    let curr = f;
    let depth = 0;
    while (curr.parent && audioFolders[curr.parent] && depth < 5) {
      curr = audioFolders[curr.parent];
      parts.unshift(curr.name);
      depth++;
    }
    return parts.join(' / ');
  };

  return (
    <>
      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div 
          onClick={() => setShowNewFolderModal(false)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <FolderPlus size={16} />
                </div>
                <h3 className="text-sm font-bold text-white truncate">
                  {parentFolderName ? `New Subfolder in "${parentFolderName}"` : 'Create Music Folder'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowNewFolderModal(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Folder Name</label>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="e.g. Energetic Beats, Lo-Fi Chill"
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-pink-500 rounded-xl text-xs text-white outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newFolderName.trim()}
                onClick={handleCreateFolder}
                className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameItem && (
        <div 
          onClick={() => setRenameItem(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Edit2 size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Rename {renameItem.type === 'folder' ? 'Folder' : 'Track'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setRenameItem(null)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">New Name</label>
              <input
                type="text"
                autoFocus
                value={renameItem.name}
                onChange={(e) => setRenameItem({ ...renameItem, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl text-xs text-white outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenameItem(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!renameItem.name.trim()}
                onClick={handleSaveRename}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE TO FOLDER MODAL */}
      {moveAudioModal && (
        <div 
          onClick={() => setMoveAudioModal(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <FolderInput size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Move {moveAudioModal.audioIds.length} Track{moveAudioModal.audioIds.length === 1 ? '' : 's'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setMoveAudioModal(null)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Select Target Music Folder</label>
              {eligibleMoveFolders.length === 0 ? (
                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs text-amber-300">
                  No eligible music folders found. Create a music folder first.
                </div>
              ) : (
                <select
                  value={targetMoveFolderId}
                  onChange={(e) => setTargetMoveFolderId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-pink-500 rounded-xl text-xs text-white outline-hidden cursor-pointer"
                >
                  {eligibleMoveFolders.map(f => (
                    <option key={f.id} value={f.id}>{getFolderDisplayPath(f)}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMoveAudioModal(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={eligibleMoveFolders.length === 0}
                onClick={handleExecuteMove}
                className="px-4 py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Move Here
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COPY TO FOLDER MODAL */}
      {copyAudioModal && (
        <div 
          onClick={() => !isCopying && setCopyAudioModal(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-purple-500/40 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Copy size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Copy {copyAudioModal.audioIds.length} Track{copyAudioModal.audioIds.length === 1 ? '' : 's'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => !isCopying && setCopyAudioModal(null)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Select Target Music Folder</label>
              {eligibleCopyFolders.length === 0 ? (
                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs text-amber-300">
                  No eligible music folders found. Create a music folder first.
                </div>
              ) : (
                <select
                  value={targetCopyFolderId}
                  onChange={(e) => setTargetCopyFolderId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-950 border border-gray-800 focus:border-purple-500 rounded-xl text-xs text-white outline-hidden cursor-pointer"
                >
                  {eligibleCopyFolders.map(f => (
                    <option key={f.id} value={f.id}>{getFolderDisplayPath(f)}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isCopying}
                onClick={() => setCopyAudioModal(null)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCopying || eligibleCopyFolders.length === 0}
                onClick={handleExecuteCopy}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isCopying ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                <span>Copy Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmItem && (
        <div 
          onClick={() => !isDeleting && setDeleteConfirmItem(null)}
          className="fixed inset-0 z-70 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-2xl shadow-2xl p-5 space-y-4 text-white animate-in zoom-in-95"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">
                  {deleteConfirmItem.type === 'folder' 
                    ? 'Delete Audio Folder' 
                    : deleteConfirmItem.type === 'multi_tracks'
                      ? 'Delete Selected Tracks'
                      : 'Delete Audio Track'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {deleteConfirmItem.type === 'folder' ? (
                    <>Are you sure you want to delete folder <span className="font-bold text-pink-300">"{deleteConfirmItem.name}"</span> and its contents? This action cannot be undone.</>
                  ) : deleteConfirmItem.type === 'multi_tracks' ? (
                    <>Are you sure you want to delete <span className="font-bold text-pink-300">{deleteConfirmItem.trackIds?.length} selected audio tracks</span>? This action cannot be undone.</>
                  ) : (
                    <>Are you sure you want to delete audio track <span className="font-bold text-pink-300">"{deleteConfirmItem.name}"</span>? This action cannot be undone.</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-950/50 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
