import React from 'react';
import { X, Layers, Music, Star, Loader2, Check } from 'lucide-react';
import { DB, VideoEditorAudioClip } from '../../../types';

export interface CombineAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAudioClips: VideoEditorAudioClip[];
  getAudioClipEffectiveDuration: (clip: VideoEditorAudioClip) => number;
  combineAudioName: string;
  setCombineAudioName: (name: string) => void;
  combineFolderId: string;
  setCombineFolderId: (id: string) => void;
  isCreatingNewCombineFolder: boolean;
  setIsCreatingNewCombineFolder: (v: boolean) => void;
  newCombineFolderName: string;
  setNewCombineFolderName: (name: string) => void;
  isCombiningAudios: boolean;
  handleExecuteCombineAudios: () => void;
  db: DB;
}

export const CombineAudioModal: React.FC<CombineAudioModalProps> = ({
  isOpen,
  onClose,
  activeAudioClips,
  getAudioClipEffectiveDuration,
  combineAudioName,
  setCombineAudioName,
  combineFolderId,
  setCombineFolderId,
  isCreatingNewCombineFolder,
  setIsCreatingNewCombineFolder,
  newCombineFolderName,
  setNewCombineFolderName,
  isCombiningAudios,
  handleExecuteCombineAudios,
  db,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[135] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 border border-pink-500/50 rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-pink-600/30 border border-pink-500/40 rounded-xl text-pink-300">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">Combine Audio Tracks</h3>
              <p className="text-[11px] text-gray-400">Merge & sync all timeline tracks into a single audio file</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isCombiningAudios) onClose();
            }}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timeline Audio Tracks Preview */}
        <div className="flex flex-col gap-1.5 bg-gray-950/80 p-3 rounded-xl border border-gray-800">
          <div className="flex items-center justify-between text-[11px] font-bold text-gray-300">
            <span className="flex items-center gap-1">
              <Music size={12} className="text-pink-400" />
              Tracks to Merge ({activeAudioClips.length})
            </span>
            <span className="text-[10px] text-pink-300 font-mono">
              Synced at Timeline Positions
            </span>
          </div>
          <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1">
            {activeAudioClips.map((clip, idx) => {
              const startSec = clip.start_time !== undefined ? clip.start_time : 0;
              const dur = getAudioClipEffectiveDuration(clip);
              return (
                <div 
                  key={clip.id || idx}
                  className="flex items-center justify-between text-[10px] bg-gray-900/90 px-2 py-1.5 rounded-lg border border-gray-800 text-gray-300"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                    <span className="font-mono text-pink-400 font-bold">A{(clip.track_layer || 0) + 1}</span>
                    <span className="truncate text-white font-medium">{clip.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] text-gray-400 shrink-0">
                    <span className="bg-black/60 px-1 py-0.5 rounded text-amber-300">
                      Starts: {startSec.toFixed(1)}s
                    </span>
                    <span className="bg-black/60 px-1 py-0.5 rounded text-cyan-300">
                      {dur.toFixed(1)}s
                    </span>
                    <span className="bg-black/60 px-1 py-0.5 rounded text-pink-300">
                      {Math.round((clip.volume ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audio Name Input */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-300 flex items-center justify-between">
            <span>Audio Track Name</span>
            <span className="text-[10px] text-gray-500 font-normal">Custom title</span>
          </label>
          <input
            type="text"
            value={combineAudioName}
            onChange={(e) => setCombineAudioName(e.target.value)}
            placeholder="e.g. Master Synced Audio, Viral BGM..."
            className="w-full bg-gray-950 border border-gray-800 focus:border-pink-500 text-white rounded-xl px-3 py-2 text-xs outline-none transition"
          />
        </div>

        {/* Folder Selection (Other than Starred) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-gray-300 flex items-center justify-between">
            <span>Save to Audio Folder</span>
            <span className="text-[10px] text-gray-500 font-normal">Choose target directory</span>
          </label>

          {!isCreatingNewCombineFolder ? (
            <div className="flex items-center gap-2">
              <select
                value={combineFolderId}
                onChange={(e) => {
                  if (e.target.value === '__new_folder__') {
                    setIsCreatingNewCombineFolder(true);
                  } else {
                    setCombineFolderId(e.target.value);
                  }
                }}
                className="flex-1 bg-gray-950 border border-gray-800 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-pink-500"
              >
                <option value="root">📁 Library Root</option>
                {Object.values(db.audio_folders || {}).map(f => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
                <option value="__new_folder__">+ Create New Folder...</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCombineFolderName}
                onChange={(e) => setNewCombineFolderName(e.target.value)}
                placeholder="Enter new folder name..."
                autoFocus
                className="flex-1 bg-gray-950 border border-pink-500/70 text-white text-xs rounded-xl px-3 py-2 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewCombineFolder(false);
                  setNewCombineFolderName('');
                }}
                className="px-2.5 py-2 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded-xl transition cursor-pointer"
              >
                Back
              </button>
            </div>
          )}
        </div>

        {/* Auto Star & Sync Guarantee Badge */}
        <div className="p-2.5 rounded-xl bg-pink-950/40 border border-pink-500/30 flex items-start gap-2 text-[10.5px] text-pink-200 leading-snug">
          <Star size={13} className="text-amber-400 fill-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Automatically Starred & Replaced:</strong> The merged track will be auto-starred in this Master Bucket & project, saved in your folder, and will replace separate tracks on the timeline into one single synced strip!
          </span>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            type="button"
            disabled={isCombiningAudios}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isCombiningAudios || !combineAudioName.trim()}
            onClick={handleExecuteCombineAudios}
            className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isCombiningAudios ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Merging Audios...</span>
              </>
            ) : (
              <>
                <Check size={13} className="stroke-[2.5]" />
                <span>Combine & Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
