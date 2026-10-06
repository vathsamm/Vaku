import React from 'react';
import { Sparkles, Volume2, VolumeX, Cpu, Trash2 } from 'lucide-react';
import { VideoEditorClip } from '../../../types';

export interface DeleteConfirmTarget {
  type: 'title_template' | 'caption_template';
  id: string;
  name: string;
}

export interface EditorConfirmDialogsProps {
  // Auto-Assemble Modal
  showAutoConfirmModal: boolean;
  setShowAutoConfirmModal: (v: boolean) => void;
  handleAutoSelect: () => void;

  // Mute All Clips Modal
  showMuteAllClipsModal: boolean;
  setShowMuteAllClipsModal: (v: boolean) => void;
  activeClips: VideoEditorClip[];
  handleMuteAllClips: (muted: boolean) => void;

  // GPU/CPU Mode Switch Modal
  showGpuCpuConfirmModal: boolean;
  setShowGpuCpuConfirmModal: (v: boolean) => void;
  enableGpuEnhancement: boolean;
  setEnableGpuEnhancement: (v: boolean) => void;
  setEnableProteusUpscale: (v: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

  // Delete Confirm Dialog (Title & Caption templates)
  deleteConfirmDialog: DeleteConfirmTarget | null;
  setDeleteConfirmDialog: (v: DeleteConfirmTarget | null) => void;
  handleExecuteDeleteTitleTemplate: (id: string, name: string) => Promise<void>;
  handleDeleteTemplate: (id: string, name: string) => Promise<void>;
  captionViewMode: 'list' | 'settings';
  setCaptionViewMode: (v: 'list' | 'settings') => void;
  setEditingTemplate: (v: any) => void;
}

export const EditorConfirmDialogs: React.FC<EditorConfirmDialogsProps> = ({
  showAutoConfirmModal,
  setShowAutoConfirmModal,
  handleAutoSelect,

  showMuteAllClipsModal,
  setShowMuteAllClipsModal,
  activeClips,
  handleMuteAllClips,

  showGpuCpuConfirmModal,
  setShowGpuCpuConfirmModal,
  enableGpuEnhancement,
  setEnableGpuEnhancement,
  setEnableProteusUpscale,
  showToast,

  deleteConfirmDialog,
  setDeleteConfirmDialog,
  handleExecuteDeleteTitleTemplate,
  handleDeleteTemplate,
  captionViewMode,
  setCaptionViewMode,
  setEditingTemplate,
}) => {
  return (
    <>
      {/* AUTO-ASSEMBLE CONFIRMATION MODAL */}
      {showAutoConfirmModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-amber-500/50 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">Auto-Assemble Clips?</h3>
                <p className="text-[11px] text-gray-400">Replace current timeline clips</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/80 p-3 rounded-xl border border-gray-800">
              This will automatically select 1 clip from each bucket folder in order (B1 → B8). Existing clips and timing on the timeline will be replaced with the newly assembled sequence.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAutoConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAutoConfirmModal(false);
                  handleAutoSelect();
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-black rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={13} className="fill-black" />
                <span>Confirm & Replace</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MUTE ALL CLIPS CONFIRMATION MODAL */}
      {showMuteAllClipsModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-rose-500/50 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <VolumeX size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">Mute All Video Clips?</h3>
                <p className="text-[11px] text-gray-400">Apply to all {activeClips.length} clips in project</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/80 p-3 rounded-xl border border-gray-800">
              Do you want to mute original audio from every video clip? Their sound will be stopped in preview and completely removed during video export.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowMuteAllClipsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              {activeClips.every(c => c.is_muted) ? (
                <button
                  type="button"
                  onClick={() => handleMuteAllClips(false)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Volume2 size={13} />
                  <span>Unmute All Clips</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMuteAllClips(true)}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <VolumeX size={13} />
                  <span>Yes, Mute All Clips</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GPU / CPU MODE SWITCH CONFIRMATION MODAL */}
      {showGpuCpuConfirmModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`bg-gray-900 border ${enableGpuEnhancement ? 'border-blue-500/50' : 'border-amber-500/50'} rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${enableGpuEnhancement ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-amber-500/20 border-amber-500/40 text-amber-400'} border flex items-center justify-center shrink-0`}>
                <Cpu size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">
                  {enableGpuEnhancement ? "Switch to Fast Studio Engine?" : "Switch to Kaggle Dual-T4 GPU?"}
                </h3>
                <p className="text-[11px] text-gray-400">
                  {enableGpuEnhancement ? "Local Studio Engine (Instant CPU Render)" : "Kaggle Dual-T4 GPU Hardware Acceleration"}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-gray-950/80 p-3 rounded-xl border border-gray-800">
              {enableGpuEnhancement ? (
                <>
                  Switching to <strong className="text-white">Studio Engine</strong> renders your video locally on the server in ~15 seconds using studio mastering quality.
                </>
              ) : (
                <>
                  Switching to <strong className="text-amber-300">GPU Mode</strong> dispatches to Kaggle Dual-T4 GPUs with Proteus V3 AI super-resolution enhancement.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGpuCpuConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !enableGpuEnhancement;
                  setEnableGpuEnhancement(nextVal);
                  setEnableProteusUpscale(nextVal);
                  try {
                    localStorage.setItem('remixx_enable_gpu_enhancement', String(nextVal));
                  } catch (_) {}
                  setShowGpuCpuConfirmModal(false);
                  showToast(
                    nextVal
                      ? "⚡ Switched to GPU Mode (Dual-T4 Acceleration)"
                      : "💻 Switched to CPU Mode (Standard Render)",
                    "info"
                  );
                }}
                className={`px-4 py-2 text-xs font-black rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                  enableGpuEnhancement
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
                    : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black'
                }`}
              >
                <Cpu size={13} className={enableGpuEnhancement ? "text-white" : "fill-black"} />
                <span>{enableGpuEnhancement ? "Switch to CPU" : "Switch to GPU"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6.5 DELETE CONFIRMATION DIALOG (FOR TITLE & CAPTION TEMPLATES) */}
      {deleteConfirmDialog && (
        <div 
          className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmDialog(null)}
        >
          <div 
            className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-white leading-tight">
                  {deleteConfirmDialog.type === 'title_template' ? 'Delete Title Template?' : 'Delete Caption?'}
                </h4>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  Are you sure you want to delete <span className="font-semibold text-rose-300">{deleteConfirmDialog.name}</span>?
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 bg-gray-950/60 p-3 rounded-xl border border-gray-850 leading-relaxed">
              {deleteConfirmDialog.type === 'title_template'
                ? 'This will permanently remove the prompt template from the master bucket.'
                : 'This will permanently remove the caption template from this master bucket and from any video canvases using it.'}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmDialog(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-650 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirmDialog;
                  setDeleteConfirmDialog(null);
                  if (target.type === 'title_template') {
                    await handleExecuteDeleteTitleTemplate(target.id, target.name);
                  } else if (target.type === 'caption_template') {
                    await handleDeleteTemplate(target.id, target.name);
                    if (captionViewMode === 'settings') {
                      setCaptionViewMode('list');
                      setEditingTemplate(null);
                    }
                    showToast(`Deleted caption "${target.name}"`, "info");
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-lg shadow-rose-900/40 flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
