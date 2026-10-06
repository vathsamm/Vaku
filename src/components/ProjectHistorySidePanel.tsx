import React, { useState } from 'react';
import { 
  Film, Pin, Trash2, Edit2, Check, X, Copy, 
  Folder, Layers, Search 
} from 'lucide-react';
import { VideoEditorProject } from '../types';

interface ProjectHistorySidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketFid: string;
  masterBucketName: string;
  contextTitle?: string;
  editorMode?: 'general' | 'ai';
  onEditorModeChange?: (mode: 'general' | 'ai') => void;
  projects: VideoEditorProject[];
  allProjects?: VideoEditorProject[];
  folders?: Record<string, any>;
  activeProjectId?: string | null;
  onSelectProject: (projectId: string) => void;
  onTogglePinProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDuplicateProject?: (project: VideoEditorProject) => void;
  onDeleteProject: (projectId: string) => void;
  currentUserEmail?: string;
  isAdmin?: boolean;
  isOverlay?: boolean;
}

export const ProjectHistorySidePanel: React.FC<ProjectHistorySidePanelProps> = ({
  isOpen,
  onClose,
  masterBucketFid,
  masterBucketName,
  contextTitle,
  projects,
  allProjects,
  folders,
  activeProjectId,
  onSelectProject,
  onTogglePinProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  currentUserEmail,
  isAdmin = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Robust User-to-User project access check (supports folder sharing, collaborative access, and mirrored folders)
  const canUserAccessProject = (p: VideoEditorProject): boolean => {
    if (isAdmin || !currentUserEmail) return true;
    const userEmailLower = (currentUserEmail || '').toLowerCase().trim();
    if (p.createdBy && p.createdBy.toLowerCase().trim() === userEmailLower) return true;
    if (p.ownerId && p.ownerId.toLowerCase().trim() === userEmailLower) return true;
    if (Array.isArray(p.sharedWith) && p.sharedWith.some((u: string) => (u || '').toLowerCase().trim() === userEmailLower)) return true;
    if (Array.isArray(p.sharedWithEdit) && p.sharedWithEdit.some((u: string) => (u || '').toLowerCase().trim() === userEmailLower)) return true;

    // Recursive check for master bucket folder permissions & shared folder mirrors
    const checkFolderAccess = (fId?: string, depth = 0): boolean => {
      if (!fId || depth > 5 || !folders?.[fId]) return false;
      const f = folders[fId];
      if ((f.ownerId || '').toLowerCase().trim() === userEmailLower || (f.createdBy || '').toLowerCase().trim() === userEmailLower) return true;
      if (Array.isArray(f.sharedWith) && f.sharedWith.some((u: string) => (u || '').toLowerCase().trim() === userEmailLower)) return true;
      if (Array.isArray(f.sharedWithEdit) && f.sharedWithEdit.some((u: string) => (u || '').toLowerCase().trim() === userEmailLower)) return true;
      if (f.isCollaborative) return true;
      if (f.sharedSourceFid && checkFolderAccess(f.sharedSourceFid, depth + 1)) return true;
      if (f.parent && f.parent !== 'root') return checkFolderAccess(f.parent, depth + 1);
      return false;
    };

    if (p.master_bucket_fid) {
      return checkFolderAccess(p.master_bucket_fid);
    }
    return false;
  };

  const isInsideMasterBucket = Boolean(masterBucketFid && masterBucketFid !== 'root');
  
  // Base pool of projects provided by context (already filtered by location: inside master bucket, inside folder, or root)
  const poolSource = (projects && projects.length > 0) ? projects : (allProjects || []);
  const accessiblePool = poolSource.filter(canUserAccessProject);

  // Filter projects by search query
  const filteredProjects = accessiblePool.filter(p => {
    if (!p) return false;
    const projName = p.name || 'Untitled Project';
    return projName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  // Sort by recent: most recently updated / modified / created at the top (pinned projects prioritized)
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    const timeA = Math.max(a.updated_at || 0, a.last_modified || 0, a.created_at || 0);
    const timeB = Math.max(b.updated_at || 0, b.last_modified || 0, b.created_at || 0);
    return timeB - timeA;
  });

  const handleStartRename = (project: VideoEditorProject) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setConfirmDeleteId(null);
  };

  const handleSaveRename = (projectId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      onRenameProject(projectId, trimmed);
    }
    setEditingId(null);
  };

  const calculateDuration = (p: VideoEditorProject): number => {
    return (p.clips || []).reduce((acc, c) => {
      const dur = c.duration || 4.0;
      const start = c.trim_start || 0;
      const end = c.trim_end !== undefined ? c.trim_end : dur;
      const span = Math.max(0.1, end - start);
      const speed = c.speed && c.speed > 0 ? c.speed : 1.0;
      return acc + (span / speed);
    }, 0);
  };

  const formatRelativeTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1d ago';
    if (diffDays < 7) return `${diffDays}d ago`;
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderProjectItem = (project: VideoEditorProject) => {
    const isActive = activeProjectId === project.id;
    const isEditing = editingId === project.id;
    const isDeleting = confirmDeleteId === project.id;
    const dur = calculateDuration(project);
    const clipCount = project.clips?.length || 0;

    return (
      <div
        key={project.id}
        onClick={() => {
          if (!isEditing && !isDeleting) {
            onSelectProject(project.id);
            onClose();
          }
        }}
        className={`group relative rounded-lg transition-all border px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer select-none ${
          isActive
            ? 'bg-purple-950/50 border-purple-500 shadow-md shadow-purple-950/40 ring-1 ring-purple-500/40'
            : project.is_pinned
              ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/80 hover:bg-gray-900/90'
              : 'bg-gray-900/70 border-gray-800 hover:border-purple-500/50 hover:bg-gray-900'
        }`}
        title={`Click to open "${project.name}"`}
      >
        {isEditing ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveRename(project.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="w-full bg-gray-950 border border-purple-500 rounded px-2 py-1 text-xs text-white font-bold focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSaveRename(project.id)}
              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer shrink-0"
              title="Save Name"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="p-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded cursor-pointer shrink-0"
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`p-1.5 rounded-md shrink-0 ${
              project.is_pinned 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                : isActive 
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' 
                  : 'bg-gray-800/80 text-gray-400 border border-gray-700/50'
            }`}>
              <Film size={13} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition" title={project.name}>
                  {project.name}
                </h4>

                {project.is_pinned && (
                  <span className="shrink-0 flex items-center text-[8px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-black">
                    <Pin size={7} className="fill-amber-400 rotate-45 mr-0.5" /> PIN
                  </span>
                )}
                {isActive && (
                  <span className="shrink-0 text-[8px] bg-purple-500/30 text-purple-300 border border-purple-500/40 px-1 py-0.2 rounded font-semibold">
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                <span className="text-gray-300 font-medium">{clipCount} clip{clipCount !== 1 ? 's' : ''}</span>
                <span className="text-gray-600">•</span>
                <span className="font-mono text-gray-300">{dur.toFixed(1)}s</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">{formatRelativeTime(project.updated_at || project.created_at)}</span>
                {folders && project.master_bucket_fid && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className="text-purple-300 font-semibold truncate max-w-[85px]" title={folders[project.master_bucket_fid]?.name || 'Bucket'}>
                      {folders[project.master_bucket_fid]?.name || 'Bucket'}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
            {/* PIN BUTTON */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePinProject(project.id);
              }}
              className={`p-1 rounded-md transition cursor-pointer ${
                project.is_pinned
                  ? 'bg-amber-400 text-black shadow-xs'
                  : 'text-gray-400 hover:text-amber-400 hover:bg-gray-800'
              }`}
              title={project.is_pinned ? "Unpin project" : "Pin project to top"}
            >
              <Pin size={11} className={project.is_pinned ? 'fill-black rotate-45' : ''} />
            </button>

            {/* RENAME BUTTON */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartRename(project);
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition cursor-pointer"
              title="Rename Project"
            >
              <Edit2 size={11} />
            </button>

            {/* DUPLICATE BUTTON (Admin only) */}
            {isAdmin && onDuplicateProject && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateProject(project);
                }}
                className="p-1 text-gray-400 hover:text-purple-300 hover:bg-gray-800 rounded-md transition cursor-pointer hidden sm:block"
                title="Duplicate Project"
              >
                <Copy size={11} />
              </button>
            )}

            {/* DELETE BUTTON WITH INSTANT INLINE CONFIRMATION */}
            {isDeleting ? (
              <div 
                className="flex items-center gap-1 bg-rose-950/95 border border-rose-600 rounded-md p-0.5 animate-in fade-in"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[9px] text-rose-300 font-bold px-0.5">Delete?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProject(project.id);
                    setConfirmDeleteId(null);
                  }}
                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold cursor-pointer"
                  title="Confirm Delete"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-1 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[9px] cursor-pointer"
                  title="Cancel"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(project.id);
                  setEditingId(null);
                }}
                className="p-1 text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                title="Delete Project"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-[110] flex justify-start bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in`}>
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div 
        className="relative w-full max-w-sm sm:max-w-md h-full bg-gray-950 border-r border-gray-800 shadow-2xl flex flex-col z-20 animate-in slide-in-from-left duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Film size={16} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                <span>Video Projects</span>
                <span className="px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded text-[10px] font-mono">
                  {accessiblePool.length}
                </span>
              </h3>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                {isInsideMasterBucket ? (
                  <Layers size={11} className="text-purple-400" />
                ) : (
                  <Folder size={11} className="text-blue-400" />
                )}
                <span className="truncate font-semibold text-gray-200">{isInsideMasterBucket ? masterBucketName : (contextTitle || 'All Projects')}</span>
                <span>•</span>
                <span className="font-semibold text-gray-400">
                  Recent First
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition cursor-pointer"
              title="Close Projects Panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search / Filter Bar */}
        {projects.length > 2 && (
          <div className="p-3 border-b border-gray-800 bg-gray-950/60 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-gray-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Context Location Bar */}
        <div className="px-3 py-2 border-b border-gray-800 bg-gray-900/90 flex items-center justify-between text-xs shrink-0">
          <span className="text-gray-200 font-bold truncate max-w-[240px] flex items-center gap-1.5" title={isInsideMasterBucket ? masterBucketName : (contextTitle || 'All Projects')}>
            {isInsideMasterBucket ? (
              <Layers size={13} className="text-purple-400 shrink-0" />
            ) : (
              <Folder size={13} className="text-blue-400 shrink-0" />
            )}
            <span className="truncate">{isInsideMasterBucket ? masterBucketName : (contextTitle || 'All Projects')}</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-gray-400 shrink-0">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>

        {/* Unified Project List (Recent first) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {accessiblePool.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-800 rounded-2xl text-gray-500">
              <Film size={32} className="text-gray-600 mb-2" />
              <p className="text-sm font-bold text-gray-400">No Projects Yet</p>
              <p className="text-xs text-gray-600 mt-1 max-w-xs">
                Create a project to start assembling 9:16 video clips with timeline trimming.
              </p>
              <p className="text-[11px] text-gray-500 mt-3 bg-gray-900/80 px-3 py-1.5 rounded-lg border border-gray-800">
                Use the "+" button on the top toolbar to create new projects directly.
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-xs">
              No projects matching "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedProjects.map(renderProjectItem)}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-gray-900/60 border-t border-gray-800 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
          <span className="font-mono text-gray-400">
            {projects.length} project{projects.length !== 1 ? 's' : ''} saved
          </span>
          <span className="text-[10px] text-gray-400">
            Auto-saves continuously
          </span>
        </div>
      </div>
    </div>
  );
};
