import React from 'react';
import { X } from 'lucide-react';
import { VideoEditorProject } from '../../../types';

export interface EditorCreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  newProjectName: string;
  setNewProjectName: (name: string) => void;
  handleCreateProject: (e: React.FormEvent) => void;
  activeProject: VideoEditorProject | null;
  projects: VideoEditorProject[];
  pauseAllPlayback: () => void;
}

export const EditorCreateProjectModal: React.FC<EditorCreateProjectModalProps> = ({
  isOpen,
  onClose,
  newProjectName,
  setNewProjectName,
  handleCreateProject,
  activeProject,
  projects,
  pauseAllPlayback,
}) => {
  if (!isOpen) return null;

  const handleCancel = () => {
    if (!activeProject || projects.length === 0) {
      pauseAllPlayback();
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <form 
        onSubmit={handleCreateProject}
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-4 sm:p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white">Create New Project</h3>
          <button 
            type="button" 
            onClick={handleCancel}
            className="text-gray-400 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="e.g. Project 1, Reel..."
            autoFocus
            className="w-full bg-gray-950 border border-gray-700 text-white rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition active:scale-95"
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
};
