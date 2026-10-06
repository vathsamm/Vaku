import React, { useState, useMemo } from 'react';
import { 
  X, FolderInput, Snowflake, Target, Star, Check, 
  Clock, AlertCircle, ArrowRight, ShieldCheck, SlidersHorizontal
} from 'lucide-react';
import { DB, VideoEditorProject } from '../types';

export interface ImportBucketSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string;
  currentProjectName?: string;
  currentMasterBucketFid: string;
  currentMasterBucketName: string;
  db: DB;
  onImportSettings: (sourceProject: VideoEditorProject, importOptions: {
    importFrozenClips: boolean;
    importDefaultClips: boolean;
    importStarredClips: boolean;
    importBucketOrder: boolean;
    importFrozenBuckets: boolean;
  }) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ImportBucketSettingsModal: React.FC<ImportBucketSettingsModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  currentProjectName = 'Current Project',
  currentMasterBucketFid,
  currentMasterBucketName,
  db,
  onImportSettings,
  showToast
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [importFrozenClips, setImportFrozenClips] = useState(true);
  const [importDefaultClips, setImportDefaultClips] = useState(true);
  const [importStarredClips, setImportStarredClips] = useState(true);
  const [importBucketOrder, setImportBucketOrder] = useState(true);
  const [importFrozenBuckets, setImportFrozenBuckets] = useState(true);

  // Strictly filter projects belonging to the SAME master bucket, excluding the current active project
  const candidateProjects = useMemo(() => {
    if (!db || !db.video_editor_projects) return [];
    return Object.values(db.video_editor_projects)
      .filter(p => {
        if (!p || p.id === currentProjectId) return false;
        return p.master_bucket_fid === currentMasterBucketFid;
      })
      .sort((a, b) => {
        const timeA = a.updated_at || a.last_modified || a.created_at || 0;
        const timeB = b.updated_at || b.last_modified || b.created_at || 0;
        return timeB - timeA;
      });
  }, [db, currentMasterBucketFid, currentProjectId]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return candidateProjects.find(p => p.id === selectedProjectId) || null;
  }, [candidateProjects, selectedProjectId]);

  if (!isOpen) return null;

  const handleApplyImport = () => {
    if (!selectedProject) {
      showToast("Please select a project to import settings from", "warning");
      return;
    }

    onImportSettings(selectedProject, {
      importFrozenClips,
      importDefaultClips,
      importStarredClips,
      importBucketOrder,
      importFrozenBuckets
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-gray-800 bg-gray-950 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 shrink-0">
              <FolderInput size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Import Bucket Settings
              </h3>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                <span>Master Bucket:</span>
                <span className="text-purple-300 font-semibold">{currentMasterBucketName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-4 flex-1">
          {/* Isolation Notice Banner */}
          <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-200 flex items-start gap-2">
            <ShieldCheck size={16} className="text-blue-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Transfer clip freeze status, defaults, starred items, and bucket orientations from another project in <strong>{currentMasterBucketName}</strong> into <strong>{currentProjectName}</strong>. Other projects remain safely isolated.
            </p>
          </div>

          {/* Source Project Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
              1. Select Project from same Master Bucket ({candidateProjects.length})
            </label>

            {candidateProjects.length === 0 ? (
              <div className="p-6 text-center bg-gray-950/70 border border-gray-800/80 rounded-2xl">
                <AlertCircle size={24} className="mx-auto text-amber-400 mb-2" />
                <p className="text-xs font-bold text-gray-300">No other projects found</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  There are no other projects in "{currentMasterBucketName}" to import from. Create another project first.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto pr-1">
                {candidateProjects.map(proj => {
                  const isSelected = selectedProjectId === proj.id;
                  const frozenCount = proj.project_frozen_vids?.length || 0;
                  const defaultCount = proj.project_default_vids ? Object.keys(proj.project_default_vids).length : 0;
                  const starredCount = proj.project_starred_vids?.length || 0;
                  const frozenBucketCount = proj.frozen_bucket_ids?.length || 0;
                  const hasCustomOrder = Boolean(proj.bucket_order && proj.bucket_order.length > 0);

                  const dateStr = proj.updated_at 
                    ? new Date(proj.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Recent';

                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => setSelectedProjectId(proj.id)}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-purple-950/60 border-purple-500 shadow-md ring-1 ring-purple-400'
                          : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 hover:bg-gray-850/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-purple-600 border-purple-400 text-white' : 'border-gray-600'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          <span className="font-bold text-xs text-white truncate">{proj.name}</span>
                        </div>

                        {/* Badges summary */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {frozenCount > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 flex items-center gap-1">
                              <Snowflake size={8} /> {frozenCount} frozen
                            </span>
                          )}
                          {defaultCount > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                              <Target size={8} /> {defaultCount} default
                            </span>
                          )}
                          {starredCount > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 flex items-center gap-1">
                              <Star size={8} /> {starredCount} starred
                            </span>
                          )}
                          {frozenBucketCount > 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-700/60 text-cyan-200">
                              {frozenBucketCount} skipped bucket{frozenBucketCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {hasCustomOrder && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 flex items-center gap-1">
                              <SlidersHorizontal size={8} /> orientation
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-400 shrink-0 font-mono flex items-center gap-1">
                        <Clock size={10} />
                        <span>{dateStr}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Options to Transfer */}
          {selectedProject && (
            <div className="p-3 bg-gray-950/80 border border-gray-800 rounded-2xl space-y-2.5 animate-in fade-in duration-100">
              <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">
                2. Choose Settings to Import into "{currentProjectName}"
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-gray-900 border border-gray-800/80 cursor-pointer hover:border-gray-700">
                <div className="flex items-center gap-2">
                  <Snowflake size={14} className="text-cyan-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Frozen Clips</div>
                    <div className="text-[10px] text-gray-400">
                      Copy frozen clip list ({selectedProject.project_frozen_vids?.length || 0} clips)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={importFrozenClips}
                  onChange={(e) => setImportFrozenClips(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-gray-900 border border-gray-800/80 cursor-pointer hover:border-gray-700">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Default Clips</div>
                    <div className="text-[10px] text-gray-400">
                      Copy default clip per bucket ({selectedProject.project_default_vids ? Object.keys(selectedProject.project_default_vids).length : 0} buckets)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={importDefaultClips}
                  onChange={(e) => setImportDefaultClips(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-gray-900 border border-gray-800/80 cursor-pointer hover:border-gray-700">
                <div className="flex items-center gap-2">
                  <Star size={14} className="text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Starred Clips (*)</div>
                    <div className="text-[10px] text-gray-400">
                      Copy starred priorities ({selectedProject.project_starred_vids?.length || 0} clips)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={importStarredClips}
                  onChange={(e) => setImportStarredClips(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl bg-gray-900 border border-gray-800/80 cursor-pointer hover:border-gray-700">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-indigo-400" />
                  <div>
                    <div className="text-xs font-bold text-white">Bucket Orientation & Frozen Buckets</div>
                    <div className="text-[10px] text-gray-400">
                      Copy bucket sequence & skipped buckets ({selectedProject.frozen_bucket_ids?.length || 0} frozen)
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={importBucketOrder}
                  onChange={(e) => {
                    setImportBucketOrder(e.target.checked);
                    setImportFrozenBuckets(e.target.checked);
                  }}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-gray-950 border-t border-gray-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleApplyImport}
            disabled={!selectedProject}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <span>Import to Current Project</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
