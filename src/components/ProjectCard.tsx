import React, { useState } from 'react';
import { Film, Pin, Trash2, Edit2, Check, X, Copy, CloudUpload, Loader2 } from 'lucide-react';
import { VideoEditorProject } from '../types';

interface ProjectCardProps {
  project: VideoEditorProject;
  onOpen: (projectId: string) => void;
  onTogglePin: (projectId: string) => void;
  onRename: (projectId: string, newName: string) => void;
  onDuplicate?: (project: VideoEditorProject) => void;
  onDelete: (projectId: string, name: string) => void;
  onCloudSync?: (project: VideoEditorProject) => void;
  isSyncingCloud?: boolean;
}

export function formatProjectRelativeTime(ts?: number): string {
  if (!ts) return 'Recently';
  const diff = Date.now() - ts;
  if (diff < 0) return 'Just now';
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onTogglePin,
  onRename,
  onDuplicate,
  onDelete,
  onCloudSync,
  isSyncingCloud,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name || '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = editName.trim();
    if (trimmed && trimmed !== project.name) {
      onRename(project.id, trimmed);
    }
    setIsEditing(false);
  };

  const timeLabel = formatProjectRelativeTime(project.updated_at || project.last_modified || project.created_at);
  const clipCount = project.clips?.length || 0;
  const vMatch = (project.name || '').match(/\bV(\d+)\b/i);
  const versionBadge = vMatch ? `V${vMatch[1]}` : null;

  return (
    <div
      onClick={() => {
        if (!isEditing && !isConfirmingDelete) {
          onOpen(project.id);
        }
      }}
      className={`group relative w-full h-11 sm:h-12 px-2.5 sm:px-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-2.5 cursor-pointer select-none active:scale-[0.99] ${
        project.is_pinned
          ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-500/50 border-l-4 border-l-amber-400 shadow-xs'
          : 'bg-gray-900/90 hover:bg-gray-850 border-gray-800/80 hover:border-purple-500/50 shadow-xs'
      }`}
      title={`Open ${project.name} • ${timeLabel}`}
    >
      {isEditing ? (
        <form
          onSubmit={handleSaveRename}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 w-full"
        >
          <Film size={15} className="text-purple-400 shrink-0" />
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            autoFocus
            className="flex-1 min-w-0 bg-gray-950 border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none font-bold"
          />
          <button
            type="submit"
            className="p-1 text-emerald-400 hover:bg-gray-800 rounded-lg cursor-pointer"
            title="Save"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditName(project.name || '');
              setIsEditing(false);
            }}
            className="p-1 text-gray-400 hover:bg-gray-800 rounded-lg cursor-pointer"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Film size={13} />
              </div>
              {versionBadge && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold shrink-0">
                  {versionBadge}
                </span>
              )}
            </div>

            <span 
              className="text-xs sm:text-sm font-semibold text-gray-100 group-hover:text-purple-200 transition truncate leading-none"
              title={project.name}
            >
              {project.name}
            </span>

            {clipCount > 0 && (
              <span className="text-[10px] text-gray-500 font-mono shrink-0 hidden sm:inline">
                ({clipCount}c)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono shrink-0">
              {timeLabel}
            </span>

            {isConfirmingDelete ? (
              <div className="flex items-center gap-1 pl-1">
                <span className="text-[10px] text-rose-300 font-bold shrink-0 hidden xs:inline">Delete?</span>
                <button
                  type="button"
                  onClick={() => onDelete(project.id, project.name || 'Project')}
                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition active:scale-95"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-1.5 py-0.5 text-gray-400 hover:text-white text-[10px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                {/* Pin button */}
                <button
                  type="button"
                  onClick={() => onTogglePin(project.id)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    project.is_pinned
                      ? 'text-amber-400 hover:text-amber-300 bg-amber-400/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                  title={project.is_pinned ? 'Unpin' : 'Pin to top'}
                >
                  <Pin size={13} className={project.is_pinned ? 'fill-amber-400' : ''} />
                </button>

                {/* Cloud Upload Button - exactly in between Pin and Rename, matching identical button styling */}
                {onCloudSync && (
                  <button
                    type="button"
                    onClick={() => onCloudSync(project)}
                    disabled={isSyncingCloud}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      isSyncingCloud
                        ? 'text-sky-400 bg-gray-800'
                        : project.cloud_synced
                          ? 'text-sky-400 hover:text-sky-300 hover:bg-gray-800'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                    title={
                      isSyncingCloud
                        ? 'Uploading to cloud...'
                        : project.cloud_synced
                          ? 'Cloud synced (Click to re-backup)'
                          : 'Upload to Cloud'
                    }
                  >
                    {isSyncingCloud ? (
                      <Loader2 size={13} className="animate-spin text-sky-400" />
                    ) : (
                      <CloudUpload size={13} />
                    )}
                  </button>
                )}

                {/* Rename button */}
                <button
                  type="button"
                  onClick={() => {
                    setEditName(project.name || '');
                    setIsEditing(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition cursor-pointer"
                  title="Rename"
                >
                  <Edit2 size={13} />
                </button>

                {onDuplicate && (
                  <button
                    type="button"
                    onClick={() => onDuplicate(project)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition cursor-pointer"
                    title="Duplicate"
                  >
                    <Copy size={13} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition cursor-pointer"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
