import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  UploadCloud, X, Play, Trash2, Film, RefreshCw, Plus, Calendar, Volume2, VolumeX,
  Folder, ChevronDown, Check, Layers
} from 'lucide-react';
import { VideoData, VideoEditorClip, HiggsfieldJob, DB, VideoEditorProject } from '../types';
import { LongPressVideoPreviewOverlay } from './LongPressVideoPreview';
import { useLongPressPreview } from '../utils/useLongPressPreview';
import { TimelineClipsVaultView } from './video-editor/components/TimelineClipsVaultView';

interface MasterBucketUploadsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  masterBucketFid: string;
  masterBucketName: string;
  uploads: VideoData[];
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  uploadStats?: { current: number; total: number } | null;
  onPlayVideo: (fileId: string) => void;
  onDeleteUpload: (vid: string) => Promise<void>;
  onUseClipInEditor?: (video: VideoData) => void;
  db?: DB;
  activeProject?: VideoEditorProject | null;
  activeClips?: VideoEditorClip[];
  updateProjectClips?: (clips: VideoEditorClip[], history?: boolean) => void;
  jobs?: HiggsfieldJob[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  availableProjects?: VideoEditorProject[];
}

interface UploadDateGroup {
  dateKey: string;
  dateLabel: string;
  clips: VideoData[];
}

export const MasterBucketUploadsDrawer: React.FC<MasterBucketUploadsDrawerProps> = ({
  isOpen,
  onClose,
  masterBucketFid,
  masterBucketName,
  uploads,
  onUploadFiles,
  isUploading,
  uploadProgress,
  uploadStats,
  onPlayVideo,
  onDeleteUpload,
  onUseClipInEditor,
  db,
  activeProject,
  activeClips = [],
  updateProjectClips,
  jobs = [],
  showToast = () => {},
  availableProjects
}) => {
  const [activeTab, setActiveTab] = useState<'uploads' | 'clips'>('uploads');
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Available projects to pick from in the clips tab
  const projectsList = useMemo(() => {
    if (availableProjects && availableProjects.length > 0) return availableProjects;
    if (!db?.video_editor_projects) return [];
    const projs = Object.values(db.video_editor_projects);
    const forBucket = projs.filter(p => p.master_bucket_fid === masterBucketFid || (p as any).folder_id === masterBucketFid);
    return forBucket.length > 0 ? forBucket : projs;
  }, [availableProjects, db, masterBucketFid]);

  const [selectedProjId, setSelectedProjId] = useState<string | null>(null);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);

  // Initialize selected project
  useEffect(() => {
    if (!selectedProjId && (activeProject?.id || projectsList[0]?.id)) {
      setSelectedProjId(activeProject?.id || projectsList[0]?.id || null);
    }
  }, [activeProject, projectsList, selectedProjId]);

  const currentSelectedProject = useMemo(() => {
    const targetId = selectedProjId || activeProject?.id;
    if (targetId && db?.video_editor_projects?.[targetId]) {
      return db.video_editor_projects[targetId];
    }
    const found = projectsList.find(p => p.id === targetId);
    if (found) return found;
    return activeProject || projectsList[0] || null;
  }, [selectedProjId, activeProject, db, projectsList]);

  const currentProjectClips = useMemo(() => {
    return currentSelectedProject?.clips || activeClips || [];
  }, [currentSelectedProject, activeClips]);

  const handleUpdateCurrentProjectClips = (newClips: VideoEditorClip[], history?: boolean) => {
    if (currentSelectedProject) {
      if (updateProjectClips && currentSelectedProject.id === activeProject?.id) {
        updateProjectClips(newClips, history);
      } else {
        if (db) {
          db.video_editor_projects = {
            ...db.video_editor_projects,
            [currentSelectedProject.id]: {
              ...currentSelectedProject,
              clips: newClips,
              updated_at: Date.now()
            }
          };
        }
        fetch(`/api/projects/${currentSelectedProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clips: newClips })
        }).catch(err => console.error('Failed to update project clips', err));
      }
    } else if (updateProjectClips) {
      updateProjectClips(newClips, history);
    }
  };

  const handleDeleteSpecificClip = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= currentProjectClips.length) return;
    const updated = [...currentProjectClips];
    updated.splice(clipIdx, 1);
    handleUpdateCurrentProjectClips(updated, true);
    showToast(`Deleted Clip #${clipIdx + 1} position and all its takes`, 'info');
  };

  const handleDeleteClipVariant = (clipIdx: number, variantIdx: number) => {
    if (clipIdx < 0 || clipIdx >= currentProjectClips.length) return;
    const clip = currentProjectClips[clipIdx];
    if (!clip || !clip.variants) return;
    const remaining = clip.variants.filter((_, idx) => idx !== variantIdx);
    const updatedClip: VideoEditorClip = {
      ...clip,
      variants: remaining.length > 0 ? remaining : undefined,
      active_variant_index: 0
    };
    const updated = [...currentProjectClips];
    updated[clipIdx] = updatedClip;
    handleUpdateCurrentProjectClips(updated, true);
    showToast(`Deleted variant take from Clip #${clipIdx + 1}`, 'info');
  };

  const handleTrashJob = async (job: HiggsfieldJob) => {
    try {
      await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    } catch (_) {}
    showToast('AI Take removed', 'info');
  };

  const handleSwitchVariant = (clipIdx: number, variantIdx: number) => {
    if (clipIdx < 0 || clipIdx >= currentProjectClips.length) return;
    const clip = currentProjectClips[clipIdx];
    if (!clip || !clip.variants || !clip.variants[variantIdx]) return;
    const targetVar = clip.variants[variantIdx];
    const updatedClip: VideoEditorClip = {
      ...clip,
      url: targetVar.url,
      file_id: targetVar.file_id || clip.file_id,
      duration: targetVar.duration || clip.duration,
      active_variant_index: variantIdx
    };
    const updated = [...currentProjectClips];
    updated[clipIdx] = updatedClip;
    handleUpdateCurrentProjectClips(updated, true);
    showToast(`Switched to Take #${clipIdx + 1}${String.fromCharCode(65 + variantIdx)}`, 'success');
  };

  // Long-press to preview video (zooms to 50% with shadowed background, plays while held, stops on release)
  const { 
    activePreview, 
    startLongPress, 
    moveLongPress, 
    endLongPress, 
    checkDidLongPress, 
    closePreview 
  } = useLongPressPreview();

  // Helper to reliably parse timestamp from any format (seconds, ms, string date)
  const getSafeTimestamp = (item: VideoData): number => {
    const raw = item.created_at || item.last_modified || item.updated_at;
    if (typeof raw === 'string') {
      const parsed = Date.parse(raw);
      return isNaN(parsed) ? Date.now() : parsed;
    }
    if (typeof raw === 'number') {
      return raw < 10000000000 ? raw * 1000 : raw;
    }
    return Date.now();
  };

  // Group uploads separated by upload date (newest dates first, Calendar-accurate Today & Yesterday)
  const dateGroups = useMemo<UploadDateGroup[]>(() => {
    if (!uploads || uploads.length === 0) return [];
    
    // Sort all uploads newest first
    const sorted = [...uploads].sort((a, b) => getSafeTimestamp(b) - getSafeTimestamp(a));

    const groupsMap = new Map<string, { label: string; clips: VideoData[] }>();
    const now = new Date();
    const todayStr = now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    sorted.forEach((clip) => {
      const ts = getSafeTimestamp(clip);
      const d = new Date(ts);
      const dateKey = d.toDateString();
      
      let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (dateKey === todayStr) {
        label = 'Today';
      } else if (dateKey === yesterdayStr) {
        label = 'Yesterday';
      }

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, { label, clips: [] });
      }
      groupsMap.get(dateKey)!.clips.push(clip);
    });

    return Array.from(groupsMap.entries()).map(([dateKey, val]) => ({
      dateKey,
      dateLabel: val.label,
      clips: val.clips
    }));
  }, [uploads]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container: Spacious, responsive drawer with room for both Uploads & Timeline Clips */}
      <div 
        className={`relative w-full max-w-md sm:max-w-xl h-full bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col z-20 animate-in slide-in-from-right duration-200 ${isDragOver ? 'ring-2 ring-purple-500 bg-purple-950/20' : ''}`}
        onClick={e => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Hidden file input */}
        <input 
          ref={fileInputRef} 
          type="file" 
          accept="video/*" 
          multiple 
          onChange={handleFileChange} 
          className="hidden" 
        />

        {/* Drawer Header - Slim, Clean, Zero Wasted Space with Tab Switcher */}
        <div className="h-11 px-2.5 sm:px-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-purple-600/30 border border-purple-500/40 text-purple-300 shrink-0">
              <UploadCloud size={14} />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
              <span>Uploads</span>
              <span className="text-gray-400 font-normal text-xs">({masterBucketName})</span>
            </h3>
          </div>

          {/* Action: Variant & Close Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'uploads' ? (
              <button
                type="button"
                onClick={() => setActiveTab('clips')}
                className="h-8 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:bg-amber-500/40 border border-amber-500/50 text-amber-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Switch to Variant Takes view"
              >
                <Layers size={13} className="text-amber-400 stroke-[2.5]" />
                <span>Variant</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('uploads')}
                className="h-8 px-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 active:bg-purple-600/50 border border-purple-500/50 text-purple-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                title="Switch to Uploads view"
              >
                <UploadCloud size={13} className="text-purple-400 stroke-[2.5]" />
                <span>Uploads</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-gray-400 hover:text-white flex items-center justify-center hover:bg-gray-800 transition cursor-pointer shrink-0"
              title="Close"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* MAIN BODY: SWITCHES BETWEEN TIMELINE CLIPS AND UPLOADS GALLERY */}
        {activeTab === 'clips' ? (
          <div className="flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden">
            {/* Project Selector Bar for Clips Tab */}
            {projectsList.length > 0 && (
              <div className="px-3 py-1.5 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 relative z-30">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Folder size={13} className="text-purple-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">
                    Project:
                  </span>
                  <div className="relative min-w-0" ref={fileInputRef as any}>
                    <button
                      type="button"
                      onClick={() => setIsProjectDropdownOpen(prev => !prev)}
                      className="px-2.5 py-1 rounded-lg bg-gray-850 hover:bg-gray-800 text-white font-bold text-xs flex items-center gap-1.5 border border-gray-700 hover:border-purple-500/60 transition cursor-pointer max-w-[200px] sm:max-w-xs truncate"
                      title="Select project to view clips"
                    >
                      <span className="truncate">{currentSelectedProject?.name || 'Select Project'}</span>
                      <ChevronDown size={12} className={`text-gray-400 shrink-0 transition-transform duration-150 ${isProjectDropdownOpen ? 'rotate-180 text-purple-400' : ''}`} />
                    </button>

                    {isProjectDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 bg-black/50" 
                          onClick={() => setIsProjectDropdownOpen(false)} 
                        />
                        <div className="absolute top-full left-0 mt-1.5 z-50 w-64 max-h-56 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 divide-y divide-gray-800/60">
                          {projectsList.map((p) => {
                            const isSelected = p.id === currentSelectedProject?.id;
                            const clipCount = p.clips?.length || 0;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProjId(p.id);
                                  setIsProjectDropdownOpen(false);
                                }}
                                className={`w-full px-3 py-2 flex items-center justify-between text-left text-xs transition cursor-pointer ${
                                  isSelected ? 'bg-purple-600/25 text-purple-200 font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                              >
                                <span className="truncate flex-1">{p.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <span className="text-[10px] font-mono text-purple-300">
                                    {clipCount} {clipCount === 1 ? 'clip' : 'clips'}
                                  </span>
                                  {isSelected && <Check size={12} className="text-purple-400 stroke-[2.5]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10.5px] font-mono text-purple-300 font-bold px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/50">
                    {currentProjectClips.length} {currentProjectClips.length === 1 ? 'clip' : 'clips'}
                  </span>
                </div>
              </div>
            )}

            <TimelineClipsVaultView
              activeClips={currentProjectClips}
              targetClipIndex={0}
              jobs={jobs}
              db={db}
              activeProject={currentSelectedProject}
              masterBucketName={masterBucketName}
              updateProjectClips={handleUpdateCurrentProjectClips}
              onDeleteSpecificClip={handleDeleteSpecificClip}
              onDeleteClipVariant={handleDeleteClipVariant}
              onTrashJob={handleTrashJob}
              onSwitchVariant={handleSwitchVariant}
              onSelectClipIndex={(idx) => {
                if (onUseClipInEditor && currentProjectClips[idx]) {
                  const clip = currentProjectClips[idx];
                  const vid = clip.vid;
                  const v = (db?.videos && vid) ? db.videos[vid] : undefined;
                  onUseClipInEditor(v || ({ id: vid, ...clip } as any));
                }
              }}
              onOpenAiPromptMode={() => {
                if (onUseClipInEditor && currentProjectClips[0]) {
                  const clip = currentProjectClips[0];
                  const vid = clip.vid;
                  const v = (db?.videos && vid) ? db.videos[vid] : undefined;
                  onUseClipInEditor(v || ({ id: vid, ...clip } as any));
                }
              }}
              showToast={showToast}
              onCloseParent={onClose}
              isAudioMuted={isAudioMuted}
              onToggleMute={() => setIsAudioMuted(prev => !prev)}
              showImportModal={showImportModal}
              setShowImportModal={setShowImportModal}
            />
          </div>
        ) : (
          /* UPLOADS SECTION: GATHERED WITH PROPER FIXED / STICKY TODAY & YESTERDAY SEPARATORS */
          <div className="flex-1 overflow-y-auto pb-24 relative bg-gray-950">
            {uploads.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-gray-500">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 hover:border-purple-500/50 hover:bg-gray-850 flex items-center justify-center text-gray-400 hover:text-purple-300 mb-3 shadow-inner cursor-pointer transition active:scale-95 group"
                  title="Click to upload video clips"
                >
                  <UploadCloud size={26} className="text-purple-400/80 group-hover:scale-110 transition-transform" />
                </button>
                <p className="text-sm font-bold text-gray-200">No Uploads Yet</p>
                <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                  Raw video clips uploaded to <span className="text-purple-300 font-semibold">{masterBucketName}</span> will be gathered here, separated by upload date.
                </p>
                <p className="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1.5">
                  <span>Tap the</span>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600/30 border border-purple-400/40 text-purple-300 font-bold text-xs">+</span>
                  <span>bubble at the right corner to upload</span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {dateGroups.map((group) => (
                  <div key={group.dateKey} className="relative">
                    {/* Fixed / Sticky Date Separator Header - Stays pinned at top of scrolling view */}
                    <div className="sticky top-0 z-20 px-3 py-1.5 bg-gray-950/95 backdrop-blur-md border-b border-gray-800/80 flex items-center justify-between mb-2 shadow-xs">
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <Calendar size={12} className="text-purple-400" />
                        <span>{group.dateLabel}</span>
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 font-bold px-1.5 py-0.2 bg-gray-900 rounded border border-gray-800">
                        {group.clips.length} {group.clips.length === 1 ? 'clip' : 'clips'}
                      </span>
                    </div>

                    {/* 3 Clips in a Row on Mobile View */}
                    <div className="px-3">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 auto-rows-max items-start">
                        {group.clips.map((clip) => {
                          const effectiveFileId = clip.file_id || clip.id;
                          const thumbUrl = `/api/thumb/${effectiveFileId}`;
                          const videoSrc = clip.url?.startsWith('/api/') ? clip.url : (clip.file_id ? `/api/video/${clip.file_id}` : (clip.id ? `/api/video/${clip.id}` : `/api/video/${effectiveFileId}`));
                          const isDeleting = deletingId === clip.id;
                          const clipPreviewData = {
                            videoSrc,
                            posterUrl: thumbUrl,
                            title: clip.name || clip.source_name || 'Uploaded Video',
                            duration: clip.duration
                          };

                          return (
                            <div
                              key={clip.id}
                              className="relative aspect-[9/16] w-full bg-gray-900 rounded-xl overflow-hidden cursor-pointer border border-gray-800 hover:border-purple-500/50 group select-none shadow-xs"
                              onTouchStart={(e) => startLongPress(clipPreviewData, e)}
                              onTouchMove={moveLongPress}
                              onTouchEnd={endLongPress}
                              onTouchCancel={endLongPress}
                              onMouseDown={(e) => startLongPress(clipPreviewData, e)}
                              onMouseMove={moveLongPress}
                              onMouseUp={endLongPress}
                              onClick={() => {
                                if (checkDidLongPress()) return;
                                onPlayVideo(effectiveFileId);
                              }}
                            >
                              {/* Thumbnail */}
                              <img 
                                src={thumbUrl} 
                                alt={clip.name || 'Upload'}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />

                              {/* Hover/Tap Play Overlay */}
                              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition pointer-events-none">
                                <div className="w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center shadow">
                                  <Play size={10} className="fill-black ml-0.5" />
                                </div>
                              </div>

                              {/* Top Action Controls: Open in Editor & Delete */}
                              <div className="absolute top-1 right-1 z-20 flex items-center gap-1">
                                {onUseClipInEditor && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUseClipInEditor(clip);
                                    }}
                                    className="p-1 rounded-md bg-black/60 hover:bg-purple-600 text-white/90 hover:text-white transition cursor-pointer"
                                    title="Open in Video Editor"
                                  >
                                    <Film size={10} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(clip.id || null);
                                  }}
                                  className="p-1 rounded-md bg-black/60 hover:bg-rose-600 text-white/90 hover:text-white transition cursor-pointer"
                                  title="Delete clip"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>

                              {/* Duration Badge at Bottom-Right */}
                              {clip.duration && clip.duration > 0 && (
                                <span className="absolute bottom-1 right-1 px-1 py-0.2 bg-black/85 text-[8px] font-mono font-bold text-white rounded pointer-events-none">
                                  {clip.duration.toFixed(1)}s
                                </span>
                              )}

                              {/* Clip Title at Bottom-Left */}
                              <div className="absolute bottom-1 left-1 max-w-[65%] truncate pointer-events-none">
                                <span className="text-[8px] font-semibold text-gray-200 drop-shadow-sm truncate block">
                                  {clip.name || 'Clip'}
                                </span>
                              </div>

                              {/* Delete Confirmation Overlay */}
                              {isDeleting && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute inset-0 bg-black/90 z-30 p-2 flex flex-col items-center justify-center text-center animate-in fade-in"
                                >
                                  <span className="text-[9px] text-rose-300 font-bold mb-1.5">Delete?</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (clip.id) {
                                          await onDeleteUpload(clip.id);
                                        }
                                        setDeletingId(null);
                                      }}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[9px] font-bold cursor-pointer"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingId(null);
                                      }}
                                      className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded text-[9px] cursor-pointer"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ONLY ONE REQUIRED FLOATING CIRCULAR BUBBLE AT BOTTOM RIGHT WITH IN-BUTTON PROGRESS (When in Uploads mode) */}
        {activeTab === 'uploads' && (
          <div className="absolute bottom-6 right-5 sm:bottom-8 sm:right-6 z-40">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white shadow-xl shadow-purple-950/80 border-2 border-purple-400/60 hover:border-purple-300 flex items-center justify-center transition-all cursor-pointer ring-2 ring-purple-500/30 disabled:opacity-90"
              title="Upload Video Clips (+)"
              aria-label="Upload Video"
            >
              {isUploading ? (
                <div className="flex flex-col items-center justify-center leading-none select-none pointer-events-none">
                  <RefreshCw size={12} className="animate-spin text-white mb-0.5" />
                  <span className="text-[10px] font-black font-mono tracking-tight text-white drop-shadow-sm">
                    {uploadStats ? `${uploadStats.current}/${uploadStats.total}` : (uploadProgress > 0 ? `${uploadProgress}%` : '...')}
                  </span>
                </div>
              ) : (
                <Plus size={22} className="text-white stroke-[2.5]" />
              )}
            </button>
          </div>
        )}
      </div>

      <LongPressVideoPreviewOverlay
        preview={activePreview}
        onClose={closePreview}
      />
    </div>
  );
};
