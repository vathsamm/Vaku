import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, Folder, Type, Music, Sparkles, Check, CheckSquare, 
  Square, Play, Pause, FolderInput, ChevronLeft, ChevronRight,
  ArrowRight, Plus
} from 'lucide-react';
import { 
  DB, VideoEditorProject, VideoEditorCaptionTemplate,
  VideoEditorTitleTemplate 
} from '../types';

export interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionType: 'caption' | 'audio' | 'title';
  currentProjectId?: string;
  currentMasterBucketFid?: string;
  currentProjectName?: string;
  db: DB;
  onImport: (items: any[], sourceProject: VideoEditorProject, sectionType: 'caption' | 'audio' | 'title') => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

// Helper to extract importable items from a project strictly according to sectionType
export function extractProjectImportableItems(
  project: VideoEditorProject,
  sectionType: 'caption' | 'audio' | 'title',
  db: DB
): any[] {
  if (!project) return [];

  if (sectionType === 'caption') {
    const itemsMap = new Map<string, VideoEditorCaptionTemplate>();

    // 1. Collect master bucket folder caption templates for this project
    if (project.master_bucket_fid && db?.folder_caption_templates?.[project.master_bucket_fid]) {
      const folderTpls = db.folder_caption_templates[project.master_bucket_fid];
      if (Array.isArray(folderTpls)) {
        folderTpls.forEach((t, i) => {
          if (t && t.text && t.text.trim()) {
            const key = t.text.trim().toLowerCase();
            itemsMap.set(key, {
              ...t,
              id: t.id || `tpl_f_${i}`,
              name: t.name || `C${itemsMap.size + 1}`
            });
          }
        });
      }
    }

    // 2. Collect templates saved directly in project
    if (Array.isArray(project.caption_templates) && project.caption_templates.length > 0) {
      project.caption_templates.forEach((t, i) => {
        if (t && t.text && t.text.trim()) {
          const key = t.text.trim().toLowerCase();
          itemsMap.set(key, {
            ...t,
            id: t.id || `tpl_p_${i}`,
            name: t.name || `C${itemsMap.size + 1}`
          });
        }
      });
    }

    // 3. Collect timeline captions
    if (Array.isArray(project.captions) && project.captions.length > 0) {
      project.captions.forEach((c, i) => {
        if (c && c.text && c.text.trim()) {
          const key = c.text.trim().toLowerCase();
          if (!itemsMap.has(key)) {
            itemsMap.set(key, {
              id: c.template_id || c.id || `cap_${i}`,
              name: `C${itemsMap.size + 1}`,
              text: c.text,
              mode: 'change' as const,
              font_size: c.font_size,
              font_family: c.font_family,
              box_width_pct: c.box_width_pct,
              is_bold: c.is_bold,
              x_pct: c.x_pct,
              y_pct: c.y_pct,
              color: c.color || '#ffffff',
              stroke_color: c.stroke_color || '#000000',
              clip_rule: c.clip_rule || 'all',
              created_at: Date.now()
            });
          }
        }
      });
    }

    return Array.from(itemsMap.values());
  }

  if (sectionType === 'audio') {
    const trackIds = new Set<string>();
    if (Array.isArray(project.starred_audio_ids)) {
      project.starred_audio_ids.forEach(id => trackIds.add(id));
    }
    if (project.audio_id) {
      trackIds.add(project.audio_id);
    }
    if (Array.isArray(project.audio_clips)) {
      project.audio_clips.forEach(c => {
        if (c.audio_id) trackIds.add(c.audio_id);
      });
    }
    if (project.master_bucket_fid && db?.folder_audio_settings?.[project.master_bucket_fid]?.starred_audio_ids) {
      db.folder_audio_settings[project.master_bucket_fid].starred_audio_ids.forEach(id => trackIds.add(id));
    }

    const items: Array<{ id: string; name: string; url: string; duration?: number; mode?: 'all' | 'change' }> = [];
    trackIds.forEach(id => {
      const audio = db?.audios?.[id];
      if (audio) {
        items.push({
          id: audio.id,
          name: audio.name || 'Audio Track',
          url: audio.url,
          duration: audio.duration,
          mode: project.audio_modes?.[id] || audio.mode || 'change'
        });
      }
    });

    if (items.length === 0 && project.audio_url) {
      items.push({
        id: project.audio_id || `aud_proj_${project.id}`,
        name: project.audio_name || 'Project Audio Track',
        url: project.audio_url,
        duration: project.audio_duration,
        mode: 'change'
      });
    }

    return items;
  }

  if (sectionType === 'title') {
    const tplsMap = new Map<string, VideoEditorTitleTemplate>();

    // 1. Fallback in db.folder_title_templates
    if (project.master_bucket_fid && db?.folder_title_templates?.[project.master_bucket_fid]) {
      const templates = db.folder_title_templates[project.master_bucket_fid];
      if (Array.isArray(templates)) {
        templates.forEach((t, i) => {
          if (t && t.prompt && t.prompt.trim()) {
            tplsMap.set(t.prompt.trim().toLowerCase(), {
              ...t,
              id: t.id || `tpl_title_f_${i}`,
              name: t.name || `Template ${tplsMap.size + 1}`
            });
          }
        });
      }
    }

    // 2. Project title templates
    if (Array.isArray(project.title_templates) && project.title_templates.length > 0) {
      project.title_templates.forEach((t, i) => {
        if (t && t.prompt && t.prompt.trim()) {
          tplsMap.set(t.prompt.trim().toLowerCase(), {
            ...t,
            id: t.id || `tpl_title_p_${i}`,
            name: t.name || `Template ${tplsMap.size + 1}`
          });
        }
      });
    }

    // 3. Fallback if project had generated title or share_caption
    const projPrompt = (project as any).title_prompt || (project as any).share_caption;
    if (tplsMap.size === 0 && projPrompt && typeof projPrompt === 'string') {
      tplsMap.set(projPrompt.trim().toLowerCase(), {
        id: `title_${project.id}`,
        name: 'Template 1',
        prompt: projPrompt,
        is_active: true,
        created_at: Date.now()
      });
    }

    return Array.from(tplsMap.values());
  }

  return [];
}

export const ImportProjectModal: React.FC<ImportProjectModalProps> = ({
  isOpen,
  onClose,
  sectionType,
  currentProjectId,
  currentMasterBucketFid,
  db,
  onImport,
  showToast
}) => {
  const sectionConfig = useMemo(() => {
    switch (sectionType) {
      case 'caption':
        return {
          title: "Import Captions",
          icon: <Type size={16} className="text-white" />,
          accentColor: "white",
          badgeClass: "bg-gray-800 text-white border-gray-700",
          buttonClass: "bg-white hover:bg-gray-100 text-gray-950 shadow-sm font-black",
          itemNoun: "Captions",
          singularNoun: "Caption",
        };
      case 'audio':
        return {
          title: "Import Music",
          icon: <Music size={16} className="text-white" />,
          accentColor: "white",
          badgeClass: "bg-gray-800 text-white border-gray-700",
          buttonClass: "bg-white hover:bg-gray-100 text-gray-950 shadow-sm font-black",
          itemNoun: "Music Tracks",
          singularNoun: "Track",
        };
      case 'title':
        return {
          title: "Import Title & Hashtags",
          icon: <Sparkles size={16} className="text-white" />,
          accentColor: "white",
          badgeClass: "bg-gray-800 text-white border-gray-700",
          buttonClass: "bg-white hover:bg-gray-100 text-gray-950 shadow-sm font-black",
          itemNoun: "Prompt Templates",
          singularNoun: "Template",
        };
    }
  }, [sectionType]);

  // Step 1: Selected Master Bucket FID (null = show all master buckets)
  const [selectedMasterFid, setSelectedMasterFid] = useState<string | null>(null);

  // Step 2: Selected Project (null = show projects inside selected master bucket)
  const [selectedProject, setSelectedProject] = useState<VideoEditorProject | null>(null);

  // Selected item IDs in Step 3
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Audio preview playback
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Reset steps when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedMasterFid(null);
      setSelectedProject(null);
      setSelectedItemIds(new Set());
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
      setPlayingAudioId(null);
    }
  }, [isOpen]);

  // Group projects strictly by real, non-deleted Master Buckets
  const { masterBucketsList, projectsByBucket } = useMemo(() => {
    const allProjects = Object.values(db?.video_editor_projects || {});
    const pByBucket = new Map<string, Array<{ project: VideoEditorProject; items: any[]; bucketName: string }>>();

    allProjects.forEach(proj => {
      let bucketId = proj.master_bucket_fid;
      let bucketName = 'Master Project';

      if (bucketId && db?.folders?.[bucketId] && !db?.deleted_folders?.[bucketId]) {
        bucketName = db.folders[bucketId].name || 'Master Project';
      } else if (bucketId && db?.deleted_folders?.[bucketId]) {
        return; // Folder is explicitly deleted
      } else {
        // Fallback for projects with unspecified bucket
        bucketId = '_general';
        bucketName = 'General Projects';
      }

      const items = extractProjectImportableItems(proj, sectionType, db);

      if (items.length > 0) {
        if (!pByBucket.has(bucketId)) {
          pByBucket.set(bucketId, []);
        }
        pByBucket.get(bucketId)!.push({ project: proj, items, bucketName });
      }
    });

    const bucketsList: Array<{
      id: string;
      name: string;
      eligibleProjectsCount: number;
      totalItemsInBucket: number;
      isAi?: boolean;
    }> = [];

    pByBucket.forEach((projEntries, bucketId) => {
      projEntries.sort((a, b) => (b.project.updated_at || b.project.created_at || 0) - (a.project.updated_at || a.project.created_at || 0));
      const bucketName = projEntries[0]?.bucketName || 'Master Bucket';
      const totalItems = projEntries.reduce((acc, curr) => acc + curr.items.length, 0);

      bucketsList.push({
        id: bucketId,
        name: bucketName,
        eligibleProjectsCount: projEntries.length,
        totalItemsInBucket: totalItems,
        isAi: Boolean(db?.folders?.[bucketId]?.is_ai_bucket),
      });
    });

    bucketsList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return {
      masterBucketsList: bucketsList,
      projectsByBucket: pByBucket
    };
  }, [db, sectionType]);

  // Projects in selected master
  const projectsInSelectedMaster = useMemo(() => {
    if (!selectedMasterFid || !projectsByBucket.has(selectedMasterFid)) return [];
    return projectsByBucket.get(selectedMasterFid)!;
  }, [selectedMasterFid, projectsByBucket]);

  // Items in selected project
  const availableItemsInSelectedProject = useMemo(() => {
    if (!selectedProject) return [];
    return extractProjectImportableItems(selectedProject, sectionType, db);
  }, [selectedProject, sectionType, db]);

  // Auto-select all items when entering Step 3
  useEffect(() => {
    if (selectedProject && availableItemsInSelectedProject.length > 0) {
      setSelectedItemIds(new Set(availableItemsInSelectedProject.map((item: any) => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  }, [selectedProject, availableItemsInSelectedProject]);

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === availableItemsInSelectedProject.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(availableItemsInSelectedProject.map((item: any) => item.id)));
    }
  };

  const toggleAudioPreview = (audioId: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingAudioId === audioId) {
      if (audioPreviewRef.current) audioPreviewRef.current.pause();
      setPlayingAudioId(null);
    } else {
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio();
        audioPreviewRef.current.onended = () => setPlayingAudioId(null);
        audioPreviewRef.current.onerror = () => setPlayingAudioId(null);
      }
      audioPreviewRef.current.src = url;
      audioPreviewRef.current.play().catch(() => {});
      setPlayingAudioId(audioId);
    }
  };

  // 1-Tap Direct Import of all items from project card
  const handleDirectImportProject = (proj: VideoEditorProject, items: any[]) => {
    if (!items || items.length === 0) return;
    onImport(items, proj, sectionType);
    showToast(`Imported ${items.length} ${sectionConfig.itemNoun.toLowerCase()} from "${proj.name}"!`, "success");
    onClose();
  };

  // Import specific selected items in Step 3
  const handleImportSelectedItems = () => {
    if (!selectedProject) return;
    const itemsToImport = availableItemsInSelectedProject.filter((item: any) => selectedItemIds.has(item.id));
    if (itemsToImport.length === 0) {
      showToast(`Please select at least one ${sectionConfig.singularNoun.toLowerCase()} to import`, "warning");
      return;
    }
    onImport(itemsToImport, selectedProject, sectionType);
    showToast(`Imported ${itemsToImport.length} selected ${sectionConfig.itemNoun.toLowerCase()} from "${selectedProject.name}"!`, "success");
    onClose();
  };

  if (!isOpen) return null;

  const selectedMasterName = masterBucketsList.find(b => b.id === selectedMasterFid)?.name || 'Master Project';

  return (
    <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden text-white"
      >
        {/* Top Header */}
        <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${sectionConfig.badgeClass}`}>
              {sectionConfig.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-white tracking-tight truncate">
                {selectedProject
                  ? `Browse: ${selectedProject.name}`
                  : selectedMasterFid
                  ? `Projects in ${selectedMasterName}`
                  : sectionConfig.title}
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                {selectedProject
                  ? `Select specific ${sectionConfig.itemNoun.toLowerCase()} to import`
                  : selectedMasterFid
                  ? `Choose project or import all directly`
                  : `Step 1: Choose Master Project`}
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

        {/* Step Navigation Bar */}
        <div className="px-3 py-1.5 bg-gray-900/60 border-b border-gray-850 flex items-center justify-between text-[11px] shrink-0">
          {selectedProject ? (
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="flex items-center gap-1 text-gray-300 hover:text-white font-bold transition cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Back to Projects</span>
            </button>
          ) : selectedMasterFid ? (
            <button
              type="button"
              onClick={() => setSelectedMasterFid(null)}
              className="flex items-center gap-1 text-gray-300 hover:text-white font-bold transition cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Back to Master Projects</span>
            </button>
          ) : (
            <span className="text-gray-400 font-medium">Select Master Project below</span>
          )}

          {/* If inside Step 3: Select All toggle */}
          {selectedProject && availableItemsInSelectedProject.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[11px] font-bold text-gray-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {selectedItemIds.size === availableItemsInSelectedProject.length ? (
                <>
                  <CheckSquare size={13} className="text-amber-400" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={13} className="text-gray-400" />
                  <span>Select All ({availableItemsInSelectedProject.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Modal Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 no-scrollbar">
          {/* STEP 1: CHOOSE MASTER PROJECT */}
          {!selectedMasterFid && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                Choose Master Project
              </p>
              {masterBucketsList.length === 0 ? (
                <div className="py-16 text-center text-gray-500 space-y-2">
                  <Folder size={28} className="mx-auto text-gray-600" />
                  <p className="text-xs font-bold text-gray-300">No master projects with {sectionConfig.itemNoun.toLowerCase()} found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {masterBucketsList.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedMasterFid(b.id)}
                      className="p-3 rounded-xl bg-gray-900/90 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 flex items-center justify-between text-left transition group cursor-pointer shadow-xs active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 group-hover:text-white shrink-0">
                          <Folder size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-white truncate">
                            {b.name}
                          </h4>
                          <p className="text-[10.5px] text-gray-400 font-mono mt-0.5">
                            {b.eligibleProjectsCount} {b.eligibleProjectsCount === 1 ? 'project' : 'projects'} • {b.totalItemsInBucket} {sectionConfig.itemNoun.toLowerCase()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={15} className="text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CHOOSE PROJECT INSIDE SELECTED MASTER */}
          {selectedMasterFid && !selectedProject && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Projects in {selectedMasterName} ({projectsInSelectedMaster.length})
                </span>
                <span className="text-[10.5px] text-gray-500">
                  Import directly or browse items
                </span>
              </div>

              {projectsInSelectedMaster.length === 0 ? (
                <div className="py-14 text-center text-gray-500 space-y-2">
                  <p className="text-xs font-bold text-gray-300">No projects found with {sectionConfig.itemNoun.toLowerCase()}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedMasterFid(null)}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    ← Choose another Master Project
                  </button>
                </div>
              ) : (
                projectsInSelectedMaster.map(({ project, items }) => {
                  const isCurrent = currentProjectId === project.id;

                  return (
                    <div
                      key={project.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrent 
                          ? 'bg-purple-950/20 border-purple-500/40' 
                          : 'bg-gray-900/80 hover:bg-gray-850 border-gray-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-white truncate">{project.name}</h4>
                            {isCurrent && (
                              <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-purple-900 text-purple-300 font-bold">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {items.length} {items.length === 1 ? sectionConfig.singularNoun.toLowerCase() : sectionConfig.itemNoun.toLowerCase()} available
                          </p>
                        </div>

                        {/* Action Buttons: Import directly or Browse */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* DIRECT 1-TAP IMPORT BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleDirectImportProject(project, items)}
                            className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-950 font-black text-[11px] rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
                            title="Import all templates directly from this project"
                          >
                            <Plus size={11} className="stroke-[3]" />
                            <span>Import All ({items.length})</span>
                          </button>

                          {/* BROWSE TO SELECT SPECIFIC */}
                          <button
                            type="button"
                            onClick={() => setSelectedProject(project)}
                            className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <span>Browse</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* STEP 3: BROWSE & IMPORT SPECIFIC ITEMS OF SELECTED PROJECT */}
          {selectedProject && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Select {sectionConfig.itemNoun} ({selectedItemIds.size}/{availableItemsInSelectedProject.length})
                </span>
              </div>

              <div className="space-y-1.5">
                {availableItemsInSelectedProject.map((item: any) => {
                  const isChecked = selectedItemIds.has(item.id);
                  const isPlayingAudio = playingAudioId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItemSelection(item.id)}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                        isChecked
                          ? 'bg-gray-900 border-white/40 ring-1 ring-white/20'
                          : 'bg-gray-950 border-gray-800/80 hover:border-gray-700 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleItemSelection(item.id);
                          }}
                          className="text-white shrink-0 cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-white" />
                          ) : (
                            <Square size={16} className="text-gray-500" />
                          )}
                        </button>

                        {/* Audio Play Preview Button */}
                        {sectionType === 'audio' && item.url && (
                          <button
                            type="button"
                            onClick={(e) => toggleAudioPreview(item.id, item.url, e)}
                            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-750 text-white flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            {isPlayingAudio ? <Pause size={12} /> : <Play size={12} className="translate-x-0.5" />}
                          </button>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate">
                            {sectionType === 'title' ? item.name || 'Prompt Template' : item.text || item.name}
                          </p>
                          {sectionType === 'title' && (
                            <p className="text-[10px] text-gray-400 line-clamp-1 font-mono mt-0.5">
                              {item.prompt}
                            </p>
                          )}
                          {sectionType === 'caption' && (
                            <p className="text-[9.5px] text-gray-400 font-mono mt-0.5">
                              Font: {item.font_family || 'Default'} • {item.font_size || 24}px
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right Tag */}
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 shrink-0">
                        {item.mode || 'Item'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar: Only shown in Step 3 when specific items are chosen */}
        {selectedProject && (
          <div className="p-3 bg-gray-900 border-t border-gray-800 flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs text-gray-400 font-mono">
              {selectedItemIds.size} of {availableItemsInSelectedProject.length} selected
            </span>
            <button
              type="button"
              onClick={handleImportSelectedItems}
              disabled={selectedItemIds.size === 0}
              className="px-4 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-950 font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={13} className="stroke-[3] text-gray-950" />
              <span>Import Selected ({selectedItemIds.size})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
