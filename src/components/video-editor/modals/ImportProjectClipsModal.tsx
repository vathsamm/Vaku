import React, { useState, useMemo } from 'react';
import { 
  FolderInput, X, ChevronLeft, ChevronRight, Folder, Film, 
  Layers, Plus, Check, Play, Pause
} from 'lucide-react';
import { VideoEditorClip, VideoEditorProject, DB, FolderData, getClipVariantGroups } from '../../../types';
import { TimelineClipsVaultView } from '../components/TimelineClipsVaultView';

export interface ImportProjectClipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  db?: DB;
  activeProject?: VideoEditorProject | null;
  activeClips: VideoEditorClip[];
  updateProjectClips?: (clips: VideoEditorClip[], history?: boolean) => void;
  insertTargetClipIndex?: number | null;
  replaceTargetClipIndex?: number | null;
  variantTargetClipIndex?: number | null;
  targetGroupIdx?: number | null;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onTakeFullClip?: (clip: VideoEditorClip) => void;
  onTakeSingleClip?: (clip: VideoEditorClip) => void;
  onTakeVariantGroup?: (grp: { id?: string; label?: string; clips: VideoEditorClip[] }) => void;
}

export const ImportProjectClipsModal: React.FC<ImportProjectClipsModalProps> = ({
  isOpen,
  onClose,
  db,
  activeProject,
  activeClips,
  updateProjectClips,
  insertTargetClipIndex,
  replaceTargetClipIndex,
  variantTargetClipIndex,
  targetGroupIdx,
  showToast = () => {},
  onTakeFullClip,
  onTakeSingleClip,
  onTakeVariantGroup,
}) => {
  // Step navigation: 1 = choose master project, 2 = choose project, 3 = browse clips variant sheet
  const [selectedMasterFid, setSelectedMasterFid] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<VideoEditorProject | null>(null);
  const [previewingVideoId, setPreviewingVideoId] = useState<string | null>(null);

  // All valid projects in the system
  const allProjects = useMemo(() => {
    if (!db || !db.video_editor_projects) return [];
    return Object.values(db.video_editor_projects).filter(
      p => Boolean(p && p.id && Array.isArray(p.clips) && p.clips.length > 0)
    );
  }, [db]);

  // Master buckets / folders that have projects
  const masterBuckets = useMemo(() => {
    if (!db || !db.folders) return [];
    const foldersMap = db.folders;
    const entries: { id: string; name: string; projectCount: number; isAi?: boolean }[] = [];

    // Include all active non-deleted folders
    Object.entries(foldersMap).forEach(([fid, f]) => {
      if (db.deleted_folders?.[fid]) return;
      const count = allProjects.filter(p => p.master_bucket_fid === fid).length;
      entries.push({
        id: fid,
        name: f.name || (fid === 'root' ? 'Main Storage' : fid),
        projectCount: count,
        isAi: Boolean(f.is_ai_bucket),
      });
    });

    // Also include a pseudo entry for any orphan projects with unknown folder
    const orphanCount = allProjects.filter(p => !p.master_bucket_fid || !foldersMap[p.master_bucket_fid]).length;
    if (orphanCount > 0) {
      entries.push({
        id: '_other',
        name: 'Other Projects',
        projectCount: orphanCount,
      });
    }

    return entries;
  }, [db, allProjects]);

  // Projects inside the currently selected master bucket
  const projectsInSelectedMaster = useMemo(() => {
    if (!selectedMasterFid) return [];
    if (selectedMasterFid === '_other') {
      return allProjects.filter(p => !p.master_bucket_fid || !db?.folders?.[p.master_bucket_fid]);
    }
    return allProjects.filter(p => p.master_bucket_fid === selectedMasterFid);
  }, [allProjects, selectedMasterFid, db]);

  // Deep clone a clip to ensure complete independence between projects
  const deepCloneClip = (clip: VideoEditorClip): VideoEditorClip => {
    const newId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clonedVariants = clip.variants?.map((v, vIdx) => ({
      ...v,
      id: `take_${vIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    }));

    return {
      ...clip,
      id: newId,
      variants: clonedVariants,
    };
  };

  // Transfer all clips from project
  const handleImportEntireProject = (proj: VideoEditorProject) => {
    if (!updateProjectClips || !proj.clips || proj.clips.length === 0) return;
    const clonedClips = proj.clips.map(c => deepCloneClip(c));

    const updated = [...activeClips, ...clonedClips];
    updateProjectClips(updated, true);
    showToast(`Imported all ${clonedClips.length} clips series from "${proj.name}"!`, 'success');
    onClose();
  };

  // Import single clip
  const handleImportSingleClip = (clip: VideoEditorClip) => {
    const cleanSingleClip: VideoEditorClip = {
      ...clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variants: undefined,
      active_variant_index: undefined,
      variant_groups: undefined,
      active_variant_group_index: undefined,
      trim_start: 0,
      trim_end: clip.duration || 5,
      speed: 1.0,
      scale: 1.0,
      is_muted: false,
      volume: 1.0,
    };

    if (onTakeSingleClip) {
      onTakeSingleClip(cleanSingleClip);
      onClose();
      return;
    }

    if (!updateProjectClips) return;

    if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const targetClip = activeClips[variantTargetClipIndex];
      const groups = getClipVariantGroups(targetClip).map(g => ({ ...g, clips: [...g.clips] }));
      const existingVariants: VideoEditorClip[] = (targetClip.variants && targetClip.variants.length > 0)
        ? [...targetClip.variants]
        : [{ ...targetClip, id: `take_orig_${Date.now()}` }];
      const newTake = { ...cleanSingleClip, id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` };

      if (targetGroupIdx !== null && targetGroupIdx !== undefined && targetGroupIdx >= 0 && targetGroupIdx < groups.length) {
        groups[targetGroupIdx].clips.push(newTake);
        groups[targetGroupIdx].active_clip_index = groups[targetGroupIdx].clips.length - 1;
      }
      existingVariants.push(newTake);

      const updated = [...activeClips];
      updated[variantTargetClipIndex] = {
        ...targetClip,
        variants: existingVariants,
        variant_groups: groups.length > 0 ? groups : undefined,
        active_variant_group_index: targetGroupIdx !== null && targetGroupIdx !== undefined ? targetGroupIdx : targetClip.active_variant_group_index,
        url: newTake.url,
        file_id: newTake.file_id || targetClip.file_id
      };
      updateProjectClips(updated, true);
      showToast(`Added Take to Position #${variantTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = cleanSingleClip;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, cleanSingleClip);
      updateProjectClips(updated, true);
      showToast(`Inserted clip at position #${insertTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    const updated = [...activeClips, cleanSingleClip];
    updateProjectClips(updated, true);
    showToast(`Added clip to timeline!`, 'success');
    onClose();
  };

  // Import clip with all its variants & concepts
  const handleImportClipWithVariants = (clip: VideoEditorClip) => {
    const cloned = deepCloneClip(clip);

    if (onTakeFullClip) {
      onTakeFullClip(cloned);
      onClose();
      return;
    }

    if (!updateProjectClips) return;

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = cloned;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with all variants!`, 'success');
      onClose();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, cloned);
      updateProjectClips(updated, true);
      showToast(`Inserted clip with all variants at position #${insertTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    const updated = [...activeClips, cloned];
    updateProjectClips(updated, true);
    showToast(`Added clip with all variants to timeline!`, 'success');
    onClose();
  };

  // Import entire variant group / concept
  const handleImportVariantGroup = (grp: { id?: string; label?: string; clips?: VideoEditorClip[] }) => {
    const grpClips = grp.clips && grp.clips.length > 0 ? grp.clips : [];
    if (grpClips.length === 0) return;

    if (onTakeVariantGroup) {
      onTakeVariantGroup({ ...grp, clips: grpClips });
      onClose();
      return;
    }

    if (!updateProjectClips) return;

    const clonedClips: VideoEditorClip[] = grpClips.map((c, i) => ({
      ...c,
      id: `take_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      trim_start: 0,
      trim_end: c.duration || 5,
      speed: 1.0,
      scale: 1.0,
      is_muted: c.is_muted ?? false,
      volume: c.volume ?? 1.0,
      variants: undefined,
      variant_groups: undefined
    }));

    const primaryTake = clonedClips[0];
    const newGroup = {
      id: `group_${Date.now()}`,
      label: grp.label || 'A',
      clips: clonedClips,
      active_clip_index: 0
    };

    if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const targetClip = activeClips[variantTargetClipIndex];
      const existingGroups = getClipVariantGroups(targetClip).map(g => ({ ...g, clips: [...g.clips] }));
      existingGroups.push(newGroup);
      const updatedClip: VideoEditorClip = {
        ...targetClip,
        variant_groups: existingGroups,
        active_variant_group_index: existingGroups.length - 1,
        variants: newGroup.clips,
        active_variant_index: 0,
        url: primaryTake.url,
        file_id: primaryTake.file_id || targetClip.file_id,
        duration: primaryTake.duration || targetClip.duration
      };
      const updated = [...activeClips];
      updated[variantTargetClipIndex] = updatedClip;
      updateProjectClips(updated, true);
      showToast(`Added Concept ${newGroup.label} (${clonedClips.length} takes) to Position #${variantTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    const targetClipData: VideoEditorClip = {
      ...primaryTake,
      variants: clonedClips,
      active_variant_index: 0,
      variant_groups: [newGroup],
      active_variant_group_index: 0
    };

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = targetClipData;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with Concept ${newGroup.label}!`, 'success');
      onClose();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, targetClipData);
      updateProjectClips(updated, true);
      showToast(`Inserted Concept ${newGroup.label} at position #${insertTargetClipIndex + 1}!`, 'success');
      onClose();
      return;
    }

    const updated = [...activeClips, targetClipData];
    updateProjectClips(updated, true);
    showToast(`Added Concept ${newGroup.label} to timeline!`, 'success');
    onClose();
  };

  if (!isOpen) return null;

  const selectedMasterName = masterBuckets.find(b => b.id === selectedMasterFid)?.name || 'Master Project';

  return (
    <div className="fixed inset-0 z-[250] bg-gray-950 flex flex-col w-full h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] text-white animate-in fade-in duration-150 overflow-hidden">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="px-3.5 py-3 border-b border-gray-800 flex items-center justify-between gap-2 bg-gray-900 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
              <FolderInput size={16} />
            </div>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                {selectedProject
                  ? `Browse: ${selectedProject.name}`
                  : selectedMasterFid
                  ? `Projects in ${selectedMasterName}`
                  : 'Import from Master Project'}
              </h3>
              <p className="text-[10px] text-gray-400 truncate">
                {selectedProject
                  ? 'Select any clip or variant to import into current project'
                  : selectedMasterFid
                  ? 'Step 2: Choose a project from this master'
                  : 'Step 1: Choose master project/bucket'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-gray-400 hover:text-white flex items-center justify-center hover:bg-gray-800 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* STEP BREADCRUMB BAR */}
        <div className="px-3 py-1.5 bg-gray-900/60 border-b border-gray-850 flex items-center justify-between text-[11px] shrink-0">
          {selectedProject ? (
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Back to Projects</span>
            </button>
          ) : selectedMasterFid ? (
            <button
              type="button"
              onClick={() => setSelectedMasterFid(null)}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Back to Master Projects</span>
            </button>
          ) : (
            <span className="text-gray-400 font-medium">Select a Master Project below</span>
          )}
        </div>

        {/* MAIN BODY CONTENT */}
        {selectedProject ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black">
            {/* Top Info Bar for Selected Project */}
            <div className="px-3.5 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-750 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
                >
                  <ChevronLeft size={14} />
                  <span>Projects</span>
                </button>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white truncate">{selectedProject.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                      1:1 Variant Page
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">
                    {variantTargetClipIndex !== null && variantTargetClipIndex !== undefined
                      ? `Importing into Position #${variantTargetClipIndex + 1}`
                      : insertTargetClipIndex !== null && insertTargetClipIndex !== undefined
                      ? `Inserting at Position #${insertTargetClipIndex + 1}`
                      : 'Tap "+ Take", "+ Variant", or "+ Concepts" to import'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleImportEntireProject(selectedProject)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10.5px] rounded-lg shadow transition active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Import all clips from this project to timeline"
                >
                  <Layers size={12} className="stroke-[2.5]" />
                  <span className="hidden xs:inline">Import All</span>
                  <span>({selectedProject.clips.length})</span>
                </button>
              </div>
            </div>

            {/* 1-on-1 IDENTICAL VARIANT PAGE */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-black">
              <TimelineClipsVaultView
                activeClips={selectedProject.clips}
                targetClipIndex={0}
                activeProject={selectedProject}
                masterBucketName={selectedMasterName}
                db={db}
                isAudioMuted={true}
                isImportBrowserMode={true}
                onTakeSingleClip={(clip) => handleImportSingleClip(clip)}
                onTakeFullClip={(clip) => handleImportClipWithVariants(clip)}
                onTakeVariantGroup={(grp) => handleImportVariantGroup(grp)}
                showToast={showToast}
                showImportModal={false}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
            {/* STEP 1: CHOOSE MASTER PROJECT */}
            {!selectedMasterFid && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  Master Projects & Buckets
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {masterBuckets.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedMasterFid(b.id)}
                      className="p-3 rounded-xl bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-amber-500/50 flex items-center justify-between text-left transition group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-105 transition-transform shrink-0">
                          <Folder size={15} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-amber-300 truncate">
                            {b.name}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {b.projectCount} {b.projectCount === 1 ? 'project' : 'projects'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: CHOOSE PROJECT INSIDE SELECTED MASTER */}
            {selectedMasterFid && (
              <div className="space-y-2.5">
                {projectsInSelectedMaster.length === 0 ? (
                  <div className="py-14 text-center text-gray-500 space-y-2">
                    <Film size={26} className="mx-auto text-gray-600" />
                    <p className="text-xs font-bold text-gray-300">No projects found in this master</p>
                    <button
                      type="button"
                      onClick={() => setSelectedMasterFid(null)}
                      className="text-xs text-amber-400 hover:underline cursor-pointer"
                    >
                      ← Choose another Master Project
                    </button>
                  </div>
                ) : (
                  projectsInSelectedMaster.map((proj) => {
                    const totalDur = proj.clips.reduce((acc, c) => acc + (c.duration || 5), 0);
                    const isCurrent = activeProject?.id === proj.id;

                    return (
                      <div
                        key={proj.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-purple-950/20 border-purple-500/40'
                            : 'bg-gray-900/80 hover:bg-gray-850 border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-black text-white truncate">{proj.name}</h4>
                              {isCurrent && (
                                <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-purple-900 text-purple-300 font-bold">
                                  Current
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                              {proj.clips.length} {proj.clips.length === 1 ? 'clip' : 'clips'} • {totalDur.toFixed(1)}s
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedProject(proj)}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-lg transition cursor-pointer flex items-center gap-1 shadow active:scale-95"
                            >
                              <span>Browse Variant Page</span>
                              <ChevronRight size={13} className="stroke-[2.5]" />
                            </button>
                          </div>
                        </div>

                        {/* Mini filmstrip preview of project's clips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                          {proj.clips.slice(0, 7).map((c, i) => {
                            const src = c.url || (c.file_id ? `/api/video/${c.file_id}` : '');
                            return (
                              <div
                                key={c.id || i}
                                className="relative w-10 h-14 rounded-lg overflow-hidden bg-black shrink-0 border border-gray-800"
                              >
                                <video
                                  src={src}
                                  className="w-full h-full object-cover pointer-events-none"
                                  muted
                                  playsInline
                                />
                                <span className="absolute bottom-0.5 right-0.5 text-[6.5px] font-mono text-white bg-black/80 px-0.5 rounded">
                                  #{i + 1}
                                </span>
                              </div>
                            );
                          })}
                          {proj.clips.length > 7 && (
                            <span className="text-[9px] text-gray-500 font-mono shrink-0">
                              +{proj.clips.length - 7}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
