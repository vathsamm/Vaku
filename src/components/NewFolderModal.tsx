import React from 'react';
import { FolderPlus, X } from 'lucide-react';

export interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  onCreateFolder: (name: string) => void;
  activeFolderId: string;
  currentFolderName?: string;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  onClose,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
  activeFolderId,
  currentFolderName
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <FolderPlus size={18} />
            </div>
            <h3 className="font-bold text-sm text-white">Create New Folder</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {activeFolderId === 'root'
            ? 'Create a new top-level folder at Home.'
            : `Create a subfolder inside "${currentFolderName || 'Folder'}".`}
        </p>
        <input
          type="text"
          autoFocus
          placeholder="e.g. Daily Vlog, Brand Content"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newFolderName.trim()) onCreateFolder(newFolderName);
          }}
          className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 focus:border-blue-500 rounded-xl text-sm text-white placeholder-gray-500 mb-4 focus:outline-none"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!newFolderName.trim()}
            onClick={() => onCreateFolder(newFolderName)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl cursor-pointer shadow-lg shadow-blue-900/30 transition active:scale-95"
          >
            Create Folder
          </button>
        </div>
      </div>
    </div>
  );
};
