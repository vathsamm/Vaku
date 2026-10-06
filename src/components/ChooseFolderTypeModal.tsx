import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import { WindowsMasterFolderIcon, WindowsFolderIcon } from './CompactFolderCard';

interface ChooseFolderTypeModalProps {
  isOpen: boolean;
  folderName: string;
  onChooseProject: () => void;
  onChooseSubfolder: () => void;
  onClose: () => void;
}

export const ChooseFolderTypeModal: React.FC<ChooseFolderTypeModalProps> = ({
  isOpen,
  folderName,
  onChooseProject,
  onChooseSubfolder,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white truncate">
              What do you want to add?
            </h3>
            <p className="text-xs text-gray-400 truncate">
              Inside <strong className="text-purple-300">"{folderName}"</strong>
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Choice Cards */}
        <div className="flex flex-col gap-2.5">
          {/* Option 1: Master Project */}
          <button
            type="button"
            onClick={onChooseProject}
            className="group p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-gray-850 to-indigo-950/30 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-900/20 flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer text-left shadow-sm"
          >
            <div className="shrink-0 flex items-center justify-center">
              <WindowsMasterFolderIcon size={46} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white group-hover:text-purple-200 transition">
                  Project
                </span>
                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-mono font-bold rounded">
                  Master
                </span>
              </div>
              <p className="text-[11px] text-gray-400 group-hover:text-gray-300 leading-snug mt-0.5">
                Make this a Master Project Folder and create version V1.
              </p>
            </div>
            <ChevronRight size={16} className="text-purple-400/60 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          {/* Option 2: Subfolder */}
          <button
            type="button"
            onClick={onChooseSubfolder}
            className="group p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/20 via-gray-850 to-gray-850 border border-amber-500/25 hover:border-amber-400/60 hover:bg-amber-900/15 flex items-center gap-3.5 transition-all active:scale-98 cursor-pointer text-left shadow-sm"
          >
            <div className="shrink-0 flex items-center justify-center">
              <WindowsFolderIcon size={46} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white group-hover:text-amber-200 transition">
                  Subfolder
                </span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold rounded">
                  Folder
                </span>
              </div>
              <p className="text-[11px] text-gray-400 group-hover:text-gray-300 leading-snug mt-0.5">
                Keep as a container folder and organize with subfolders.
              </p>
            </div>
            <ChevronRight size={16} className="text-amber-400/60 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
