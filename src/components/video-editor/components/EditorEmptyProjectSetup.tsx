import React from 'react';
import { ArrowLeft, Film, Plus } from 'lucide-react';
import { VideoEditorProject } from '../../../types';

export interface EditorEmptyProjectSetupProps {
  masterBucketName: string;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  handleCreateProject: (name: string) => void;
  handleSelectProject: (proj: VideoEditorProject) => void;
  projects: VideoEditorProject[];
  pauseAllPlayback: () => void;
  onClose: () => void;
}

export const EditorEmptyProjectSetup: React.FC<EditorEmptyProjectSetupProps> = ({
  masterBucketName,
  newProjectName,
  setNewProjectName,
  handleCreateProject,
  handleSelectProject,
  projects,
  pauseAllPlayback,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[100] w-full h-full bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 overflow-y-auto select-none">
      <header className="flex items-center justify-between pb-4 border-b border-slate-800">
        <button
          type="button"
          onClick={() => {
            pauseAllPlayback();
            onClose();
          }}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-700/60 transition flex items-center gap-1.5 cursor-pointer text-xs font-bold"
          title="Back to Master Bucket"
        >
          <ArrowLeft size={16} />
          <span>Back to {masterBucketName || 'Bucket'}</span>
        </button>
        <span className="text-xs text-slate-400 font-mono">New Project Setup</span>
      </header>

      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 border border-purple-500/40 flex items-center justify-center mx-auto mb-3">
              <Film size={24} />
            </div>
            <h2 className="text-lg font-black text-white">Create New Project</h2>
            <p className="text-xs text-slate-400">
              Enter a project name to start editing for <strong className="text-purple-300">{masterBucketName || 'Master Bucket'}</strong>
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newProjectName.trim()) {
                handleCreateProject(newProjectName.trim());
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                Project Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Project 1, Reel 9:16..."
                autoFocus
                required
                className="w-full bg-slate-950 border border-purple-500/60 focus:border-purple-400 text-white rounded-xl px-4 py-2.5 text-sm outline-none transition shadow-inner font-semibold"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  pauseAllPlayback();
                  onClose();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel / Back
              </button>
              <button
                type="submit"
                disabled={!newProjectName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={15} />
                <span>Create & Open Editor</span>
              </button>
            </div>
          </form>

          {/* List existing projects in this master bucket if any */}
          {projects.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-2">Or Open Existing Project:</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {projects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProject(p)}
                    className="w-full text-left p-2 rounded-xl bg-slate-950/70 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-xs font-medium text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="truncate font-bold">{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">{p.clips?.length || 0} clips</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-600 py-2">
        Until a project is named and created, you remain in setup mode.
      </div>
    </div>
  );
};
