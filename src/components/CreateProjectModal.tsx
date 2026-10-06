import React, { useState, useEffect, useRef } from 'react';
import { Film, X, Plus, Layers, Loader2 } from 'lucide-react';
import { computeNextProjectVersionName } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketFid: string;
  masterBucketName: string;
  existingProjects?: { name?: string }[];
  existingProjectsCount?: number;
  suggestedName?: string;
  onCreateProject: (name: string, mode: 'general' | 'ai') => void | Promise<void>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  masterBucketFid,
  masterBucketName,
  existingProjects = [],
  existingProjectsCount = 0,
  suggestedName: propSuggestedName,
  onCreateProject
}) => {
  const generateSuggestedName = () => {
    if (propSuggestedName) return propSuggestedName;
    const cleanFolder = masterBucketName?.trim() || 'Master Project';
    if (existingProjects && existingProjects.length > 0) {
      return computeNextProjectVersionName(cleanFolder, existingProjects).defaultName;
    }
    const num = (existingProjectsCount || 0) + 1;
    return `${cleanFolder} V${num}`;
  };

  const [projectName, setProjectName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProjectName(generateSuggestedName());
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 80);
    }
  }, [isOpen, masterBucketFid, propSuggestedName, existingProjectsCount, masterBucketName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const trimmed = projectName.trim() || generateSuggestedName();
    setIsSubmitting(true);
    try {
      await onCreateProject(trimmed, 'general');
      onClose();
    } catch (_) {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 sm:p-6 z-10 flex flex-col gap-5 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
              <Film size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Create New Project
              </h3>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <Layers size={12} className="text-purple-400 shrink-0" />
                <span className="font-semibold text-gray-300 truncate max-w-[220px]">
                  {masterBucketName || 'Master Project Folder'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition cursor-pointer"
            title="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 block">
              Project Name (Version)
            </label>
            <input
              ref={inputRef}
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Master Project V1"
              className="w-full bg-gray-950 border border-gray-750 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition font-medium"
            />
            <p className="text-[11px] text-gray-500">
              Defaulted to folder name with versioning (<span className="text-purple-400 font-mono">V1, V2...</span>)
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!projectName.trim() || isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
