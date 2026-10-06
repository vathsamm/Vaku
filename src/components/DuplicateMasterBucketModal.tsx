import React, { useState, useEffect } from 'react';
import { X, HardDrive, RefreshCw, Check, Layers } from 'lucide-react';

interface DuplicateMasterBucketModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceMasterFid: string;
  sourceMasterName: string;
  onConfirm: (newName: string, syncWithSource: boolean) => Promise<void>;
}

export const DuplicateMasterBucketModal: React.FC<DuplicateMasterBucketModalProps> = ({
  isOpen,
  onClose,
  sourceMasterName,
  onConfirm
}) => {
  const [folderName, setFolderName] = useState(() => `${sourceMasterName || 'Master Project'} (Copy)`);
  const [syncWithSource, setSyncWithSource] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName(`${sourceMasterName || 'Master Project'} (Copy)`);
      setSyncWithSource(false);
      setIsSubmitting(false);
    }
  }, [isOpen, sourceMasterName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onConfirm(folderName.trim(), syncWithSource);
      onClose();
    } catch (_) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-gray-900 border border-purple-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 bg-gray-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">Duplicate Master Project Folder</h3>
              <p className="text-xs text-gray-400 truncate max-w-[260px] sm:max-w-xs">
                Source: <span className="text-purple-300 font-semibold">{sourceMasterName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">
              Duplicated Folder Name
            </label>
            <input
              type="text"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder="e.g. Master Project (Copy)"
              autoFocus
              className="w-full bg-gray-950 border border-gray-750 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-200 flex items-center justify-between">
              <span>Do you require future updates inside this folder?</span>
              <span className="text-[10px] text-purple-300 font-mono">Select Option</span>
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={() => setSyncWithSource(false)}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  !syncWithSource
                    ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50 shadow-md shadow-purple-950/40'
                    : 'bg-gray-855/60 border-gray-800 hover:border-gray-700 text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${!syncWithSource ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  <HardDrive size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${!syncWithSource ? 'text-white' : 'text-gray-300'}`}>
                      No — Local Snapshot (Static / Frozen)
                    </span>
                    {!syncWithSource && (
                      <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Creates an independent static freeze of current clips and project setup.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSyncWithSource(true)}
                className={`p-3 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                  syncWithSource
                    ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/50 shadow-md shadow-purple-950/40'
                    : 'bg-gray-855/60 border-gray-800 hover:border-gray-700 text-gray-400'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${syncWithSource ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  <RefreshCw size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${syncWithSource ? 'text-white' : 'text-gray-300'}`}>
                      Yes — Live Synced with Source Folder
                    </span>
                    {syncWithSource && (
                      <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                        <Check size={10} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Automatically reflects any future media updates added to "{sourceMasterName}".
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Duplicating...' : 'Duplicate Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
