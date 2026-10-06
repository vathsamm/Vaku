import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Music, FolderPlus, Folder, Upload, Play, Star, 
  Check, Trash2, Volume2, ArrowLeft, MoreVertical, Edit2, FolderInput,
  RefreshCw, X, CheckSquare, Copy, Plus, Scissors
} from 'lucide-react';
import { DB, AudioItem, AudioFolder, VideoEditorProject } from '../types';
import { safeFetchJson } from '../utils/api';
import {
  AudioPlayerBar,
  AudioFolderActionModals,
  CompactMusicFolderCard,
  MusicFolderActionBottomSheet
} from './audio-dashboard';

export interface AudioDashboardProps {
  isOpen: boolean;
  onClose?: () => void;
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB | null>>;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  masterBucketFid?: string;
  masterBucketName?: string;
  selectedAudioId?: string;
  onSelectAudio?: (audio: AudioItem) => void;
  isModal?: boolean;
  currentUserEmail?: string;
  isAdmin?: boolean;
  usersList?: any[];
  activeProject?: VideoEditorProject | null;
  onSaveProject?: (project: VideoEditorProject) => void;
}

export const AudioDashboard: React.FC<AudioDashboardProps> = ({
  isOpen,
  onClose,
  db,
  setDb,
  showToast,
  masterBucketFid,
  masterBucketName,
  selectedAudioId,
  onSelectAudio,
  isModal = true,
  currentUserEmail = '',
  activeProject,
  onSaveProject
}) => {
  // Navigation: 'root' for home universal folders, or specific folderId
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');

  // Track menu & selection state
  const [activeTrackMenuId, setActiveTrackMenuId] = useState<string | null>(null);
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>([]);

  // Action Modals state
  const [showEmptyFolderChoiceModal, setShowEmptyFolderChoiceModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [longPressMusicFolder, setLongPressMusicFolder] = useState<any | null>(null);
  const [renameItem, setRenameItem] = useState<{ id: string; name: string; type: 'audio' | 'folder' } | null>(null);

  // Move & Copy modals
  const [moveAudioModal, setMoveAudioModal] = useState<{ audioIds: string[] } | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string>('');
  const [copyAudioModal, setCopyAudioModal] = useState<{ audioIds: string[] } | null>(null);
  const [targetCopyFolderId, setTargetCopyFolderId] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);

  // Delete Confirm modal
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ 
    type: 'folder' | 'track' | 'multi_tracks'; 
    id?: string; 
    name: string; 
    trackIds?: string[] 
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local audio mode override state for instantaneous UI responsiveness
  const [localAudioModes, setLocalAudioModes] = useState<Record<string, 'all' | 'change'>>({});

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Audio preview playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [previewVolume, setPreviewVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup playback on unmount or close
  useEffect(() => {
    if (!isOpen) {
      if (audioPlayerRef.current) {
        try {
          if (!audioPlayerRef.current.paused) audioPlayerRef.current.pause();
          audioPlayerRef.current.src = '';
        } catch (_) {}
        audioPlayerRef.current = null;
      }
      setPlayingAudioId(null);
    }
    return () => {
      if (audioPlayerRef.current) {
        try {
          if (!audioPlayerRef.current.paused) audioPlayerRef.current.pause();
          audioPlayerRef.current.src = '';
        } catch (_) {}
        audioPlayerRef.current = null;
      }
    };
  }, [isOpen]);

  const audios: Record<string, AudioItem> = useMemo(() => db?.audios || {}, [db?.audios]);
  const audioFolders: Record<string, AudioFolder> = useMemo(() => db?.audio_folders || {}, [db?.audio_folders]);

  // Clean filter to ignore legacy/virtual system folders and public shared placeholder
  const isSystemOrPublicFolder = (folder: AudioFolder) => {
    if (!folder || !folder.name) return true;
    if (folder.is_bucket_starred_folder || folder.id.startsWith('starred_folder_')) return true;
    if (folder.name === 'Public / Shared' || folder.name === 'Public' || folder.name === 'Favorites') return true;
    if ((folder as any).is_root || (folder as any).is_starred) return true;
    return false;
  };

  // All valid universal folders
  const allUniversalFolders = useMemo(() => {
    return Object.values(audioFolders).filter(f => !isSystemOrPublicFolder(f));
  }, [audioFolders]);

  // Root folders (no parent or parent === 'root')
  // ORDERING LOGIC: If opened from a project with a favorite folder, that favorite folder is placed at index 0!
  const rootFoldersList = useMemo(() => {
    const rootList = allUniversalFolders.filter(f => !f.parent || f.parent === 'root');
    const favoriteFolderId = activeProject?.favorite_audio_folder_id;

    return [...rootList].sort((a, b) => {
      // Pinned to first position if favorite for the active project
      if (favoriteFolderId) {
        if (a.id === favoriteFolderId) return -1;
        if (b.id === favoriteFolderId) return 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [allUniversalFolders, activeProject?.favorite_audio_folder_id]);

  // Subfolders of the currently active folder
  const currentSubfolders = useMemo(() => {
    if (currentFolderId === 'root') return [];
    return allUniversalFolders
      .filter(f => f.parent === currentFolderId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [allUniversalFolders, currentFolderId]);

  // Tracks inside the currently active folder
  const currentFolderTracks = useMemo(() => {
    if (currentFolderId === 'root') return [];
    return Object.values(audios)
      .filter(a => a.folder_id === currentFolderId)
      .sort((a, b) => {
        // If active project, starred tracks for this project appear first
        if (activeProject && Array.isArray(activeProject.starred_audio_ids)) {
          const isStarA = activeProject.starred_audio_ids.includes(a.id);
          const isStarB = activeProject.starred_audio_ids.includes(b.id);
          if (isStarA && !isStarB) return -1;
          if (!isStarA && isStarB) return 1;
        }
        return (b.created_at || 0) - (a.created_at || 0);
      });
  }, [audios, currentFolderId, activeProject]);

  // Folder content type: 'empty' | 'folders' | 'music'
  const currentFolderType = useMemo<'empty' | 'folders' | 'music'>(() => {
    if (currentFolderId === 'root') return 'folders';
    if (currentSubfolders.length > 0) return 'folders';
    if (currentFolderTracks.length > 0) return 'music';
    return 'empty';
  }, [currentFolderId, currentSubfolders.length, currentFolderTracks.length]);

  // Active folder object
  const activeFolder = currentFolderId !== 'root' ? audioFolders[currentFolderId] : null;

  // Count tracks and subfolders helper
  const getFolderTrackCount = useCallback((fId: string) => {
    return Object.values(audios).filter(a => a.folder_id === fId).length;
  }, [audios]);

  const getFolderSubfolderCount = useCallback((fId: string) => {
    return allUniversalFolders.filter(f => f.parent === fId).length;
  }, [allUniversalFolders]);

  // Eligible folders for Move & Copy:
  // ONLY folders that are NOT folder-containers (i.e. have 0 subfolders)
  const eligibleMusicDestinationFolders = useMemo(() => {
    return allUniversalFolders.filter(f => {
      // Must not have subfolders
      const hasSubfolders = allUniversalFolders.some(sub => sub.parent === f.id);
      return !hasSubfolders;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUniversalFolders]);

  // Toggle favorite / starred folder for active project
  const handleToggleFavoriteFolderForProject = async (folderId: string) => {
    if (!activeProject) {
      showToast("Open a video project to star a favorite music folder for it", "info");
      return;
    }
    const currentFav = activeProject.favorite_audio_folder_id;
    const nextFav = currentFav === folderId ? null : folderId;

    const updatedProj: VideoEditorProject = {
      ...activeProject,
      favorite_audio_folder_id: nextFav,
      updated_at: Date.now()
    };

    setDb(prev => {
      if (!prev || !prev.video_editor_projects?.[activeProject.id]) return prev;
      return {
        ...prev,
        video_editor_projects: {
          ...prev.video_editor_projects,
          [activeProject.id]: updatedProj
        }
      };
    });

    if (onSaveProject) {
      onSaveProject(updatedProj);
    }

    try {
      await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_project_favorite_audio_folder',
          payload: {
            projectId: activeProject.id,
            folderId: nextFav
          }
        })
      });
    } catch (_) {}

    showToast(
      nextFav
        ? `⭐ Starred "${audioFolders[folderId]?.name || 'Folder'}" for "${activeProject.name}" (Pinned to first position)`
        : `Unstarred folder for "${activeProject.name}"`,
      "success"
    );
  };

  // Toggle audio star for project (M1, M2... audio switcher in video editor)
  const isAudioStarredForProject = useCallback((audio: AudioItem) => {
    if (activeProject && Array.isArray(activeProject.starred_audio_ids)) {
      return activeProject.starred_audio_ids.includes(audio.id);
    }
    return false;
  }, [activeProject]);

  const handleToggleStarForProject = async (audio: AudioItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeProject) {
      showToast("Starring tracks is available when editing a video project", "info");
      return;
    }

    const currentStars = new Set<string>(activeProject.starred_audio_ids || []);
    const nextStarred = !currentStars.has(audio.id);
    if (nextStarred) {
      currentStars.add(audio.id);
    } else {
      currentStars.delete(audio.id);
    }

    const updatedProject: VideoEditorProject = {
      ...activeProject,
      starred_audio_ids: Array.from(currentStars),
      updated_at: Date.now()
    };

    if (onSaveProject) {
      onSaveProject(updatedProject);
    }

    try {
      const res = await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_project_audio_star',
          payload: {
            projectId: activeProject.id,
            audioId: audio.id,
            is_starred: nextStarred
          }
        })
      });
      if (res?.success && res.db) {
        setDb(res.db);
      }
    } catch (_) {}

    showToast(
      nextStarred
        ? `⭐ Starred "${audio.name}" for "${activeProject.name}"`
        : `Removed "${audio.name}" from "${activeProject.name}"`,
      "success"
    );
  };

  // Fallback star for non-project view
  const handleToggleStar = (audio: AudioItem, e?: React.MouseEvent) => {
    if (activeProject) {
      handleToggleStarForProject(audio, e);
    }
  };

  // Resolve audio mode: 'all' or 'change'
  const getAudioMode = (audio: AudioItem): 'all' | 'change' => {
    if (localAudioModes[audio.id]) return localAudioModes[audio.id];
    if (activeProject?.audio_modes && activeProject.audio_modes[audio.id]) {
      return activeProject.audio_modes[audio.id];
    }
    return audio.mode || 'change';
  };

  const handleToggleAudioMode = async (audio: AudioItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentMode = getAudioMode(audio);
    const nextMode: 'all' | 'change' = currentMode === 'all' ? 'change' : 'all';

    setLocalAudioModes(prev => ({ ...prev, [audio.id]: nextMode }));

    if (activeProject) {
      const nextModes = { ...(activeProject.audio_modes || {}), [audio.id]: nextMode };
      const currentStars = new Set(activeProject.starred_audio_ids || []);
      let nextClips = activeProject.audio_clips ? [...activeProject.audio_clips] : [];

      if (nextMode === 'all') {
        currentStars.add(audio.id);
        const alreadyInTimeline = nextClips.some(c => c.audio_id === audio.id || c.url === audio.url);
        if (!alreadyInTimeline) {
          nextClips.push({
            id: `aud_${Date.now()}_${audio.id}`,
            audio_id: audio.id,
            name: audio.name,
            url: audio.url,
            duration: audio.duration || 30,
            trim_start: 0,
            trim_end: audio.duration || 30,
            speed: 1,
            volume: 1,
            track_layer: nextClips.length
          });
        }
      }

      const updatedProj: VideoEditorProject = {
        ...activeProject,
        starred_audio_ids: Array.from(currentStars),
        audio_modes: nextModes,
        audio_clips: nextClips,
        updated_at: Date.now()
      };
      if (onSaveProject) onSaveProject(updatedProj);
    }

    try {
      const res = await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_audio_mode',
          payload: {
            projectId: activeProject?.id,
            audioId: audio.id,
            mode: nextMode
          }
        })
      });
      if (res?.success && res.db) {
        setDb(res.db);
      }
    } catch (_) {}

    showToast(
      nextMode === 'all'
        ? `⭐ Set For All: "${audio.name}"`
        : `🔄 Set to Change: "${audio.name}"`,
      "info"
    );
  };

  // Insert track into video project timeline
  const handleInsertTrackAction = (audio: AudioItem) => {
    if (onSelectAudio) {
      onSelectAudio(audio);
      showToast(`Selected "${audio.name}" for video timeline`, "success");
      return;
    }
    if (activeProject && onSaveProject) {
      const nextClips = activeProject.audio_clips ? [...activeProject.audio_clips] : [];
      const newClip = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        audio_id: audio.id,
        name: audio.name,
        url: audio.url,
        duration: audio.duration || 30,
        trim_start: 0,
        trim_end: audio.duration || 30,
        speed: 1,
        volume: 1,
        track_layer: nextClips.length
      };
      nextClips.push(newClip);

      const currentStars = new Set(activeProject.starred_audio_ids || []);
      currentStars.add(audio.id);

      const updatedProj: VideoEditorProject = {
        ...activeProject,
        starred_audio_ids: Array.from(currentStars),
        audio_id: audio.id,
        audio_url: audio.url,
        audio_name: audio.name,
        audio_duration: audio.duration || 30,
        audio_clips: nextClips,
        updated_at: Date.now()
      };
      onSaveProject(updatedProj);
      showToast(`Added "${audio.name}" to video timeline`, "success");
    }
  };

  // Playback handlers
  const handleTogglePlay = (audio: AudioItem) => {
    if (playingAudioId === audio.id) {
      if (audioPlayerRef.current) {
        if (audioPlayerRef.current.paused) {
          audioPlayerRef.current.play().catch(() => {});
        } else {
          audioPlayerRef.current.pause();
        }
      }
      return;
    }

    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = '';
      } catch (_) {}
    }

    const player = new Audio(audio.url);
    player.volume = isMuted ? 0 : previewVolume;
    player.ontimeupdate = () => setCurrentTime(player.currentTime);
    player.onloadedmetadata = () => setAudioDuration(player.duration || audio.duration || 0);
    player.onended = () => {
      setPlayingAudioId(null);
      setCurrentTime(0);
    };

    audioPlayerRef.current = player;
    setPlayingAudioId(audio.id);
    setCurrentTime(0);
    setAudioDuration(audio.duration || 0);

    player.play().catch(err => {
      console.warn("Playback error:", err);
      showToast("Cannot preview audio format", "error");
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = val;
    }
  };

  const handleToggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioPlayerRef.current) {
        audioPlayerRef.current.volume = next ? 0 : previewVolume;
      }
      return next;
    });
  };

  const handleVolumeChange = (vol: number) => {
    setPreviewVolume(vol);
    setIsMuted(false);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.volume = vol;
    }
  };

  const playPrevTrack = () => {
    if (currentFolderTracks.length === 0) return;
    const curIdx = currentFolderTracks.findIndex(a => a.id === playingAudioId);
    const prevIdx = curIdx > 0 ? curIdx - 1 : currentFolderTracks.length - 1;
    handleTogglePlay(currentFolderTracks[prevIdx]);
  };

  const playNextTrack = () => {
    if (currentFolderTracks.length === 0) return;
    const curIdx = currentFolderTracks.findIndex(a => a.id === playingAudioId);
    const nextIdx = (curIdx >= 0 && curIdx < currentFolderTracks.length - 1) ? curIdx + 1 : 0;
    handleTogglePlay(currentFolderTracks[nextIdx]);
  };

  const currentPlayingAudio = playingAudioId ? audios[playingAudioId] || null : null;

  // Multi-select toggle
  const handleToggleSelectAudio = (id: string) => {
    setSelectedAudioIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllTracks = () => {
    if (selectedAudioIds.length === currentFolderTracks.length) {
      setSelectedAudioIds([]);
    } else {
      setSelectedAudioIds(currentFolderTracks.map(a => a.id));
    }
  };

  // Execute Move
  const handleExecuteMove = async () => {
    if (!moveAudioModal || moveAudioModal.audioIds.length === 0) return;
    const targetFid = targetMoveFolderId || eligibleMusicDestinationFolders[0]?.id;
    if (!targetFid) {
      showToast("Please choose a valid destination folder", "warning");
      return;
    }

    try {
      const res = await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move_audio',
          payload: {
            audioIds: moveAudioModal.audioIds,
            targetFolderId: targetFid
          }
        })
      });
      if (res?.success) {
        if (res.db) setDb(res.db);
        const folderLabel = audioFolders[targetFid]?.name || 'Folder';
        showToast(`Moved ${moveAudioModal.audioIds.length} track(s) to "${folderLabel}"`, "success");
        setMoveAudioModal(null);
        setSelectedAudioIds([]);
      } else {
        showToast(res?.error || "Failed to move audio", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to move audio", "error");
    }
  };

  // Execute Copy
  const handleExecuteCopy = async () => {
    if (!copyAudioModal || copyAudioModal.audioIds.length === 0) return;
    const targetFid = targetCopyFolderId || eligibleMusicDestinationFolders[0]?.id;
    if (!targetFid) {
      showToast("Please choose a valid destination folder", "warning");
      return;
    }
    setIsCopying(true);
    try {
      const res = await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy_audio',
          payload: {
            audioIds: copyAudioModal.audioIds,
            targetFolderId: targetFid
          }
        })
      });
      if (res?.success) {
        if (res.db) setDb(res.db);
        const folderLabel = audioFolders[targetFid]?.name || 'Folder';
        showToast(`Copied ${copyAudioModal.audioIds.length} track(s) to "${folderLabel}"`, "success");
        setCopyAudioModal(null);
        setSelectedAudioIds([]);
      } else {
        showToast(res?.error || "Failed to copy audio", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to copy audio", "error");
    } finally {
      setIsCopying(false);
    }
  };

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirmItem) return;
    setIsDeleting(true);
    try {
      if (deleteConfirmItem.type === 'folder' && deleteConfirmItem.id) {
        const res = await safeFetchJson('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_audio_folder',
            payload: { id: deleteConfirmItem.id }
          })
        });
        if (res?.success) {
          if (res.db) setDb(res.db);
          showToast(`Deleted folder "${deleteConfirmItem.name}"`, "success");
          if (currentFolderId === deleteConfirmItem.id) {
            setCurrentFolderId('root');
          }
        }
      } else if (deleteConfirmItem.type === 'multi_tracks' && deleteConfirmItem.trackIds) {
        for (const tId of deleteConfirmItem.trackIds) {
          await safeFetchJson('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_audio', payload: { id: tId } })
          });
        }
        setDb(prev => {
          if (!prev) return prev;
          const nextAudios = { ...(prev.audios || {}) };
          deleteConfirmItem.trackIds?.forEach(id => delete nextAudios[id]);
          return { ...prev, audios: nextAudios };
        });
        setSelectedAudioIds([]);
        showToast(`Deleted ${deleteConfirmItem.trackIds.length} audio track(s)`, "success");
      } else if (deleteConfirmItem.id) {
        const res = await safeFetchJson('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_audio',
            payload: { id: deleteConfirmItem.id }
          })
        });
        if (res?.success) {
          if (res.db) setDb(res.db);
          showToast(`Deleted track "${deleteConfirmItem.name}"`, "success");
        }
      }
      setDeleteConfirmItem(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to delete item", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Execute Rename
  const handleSaveRename = async () => {
    if (!renameItem || !renameItem.name.trim()) return;
    try {
      if (renameItem.type === 'folder') {
        const res = await safeFetchJson('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_audio_folder',
            payload: { id: renameItem.id, folderId: renameItem.id, name: renameItem.name.trim() }
          })
        });
        if (res?.success && res.db) setDb(res.db);
        showToast(`Renamed folder to "${renameItem.name.trim()}"`, "success");
      } else {
        const res = await safeFetchJson('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rename_audio',
            payload: { audioId: renameItem.id, name: renameItem.name.trim() }
          })
        });
        if (res?.success && res.db) setDb(res.db);
        showToast(`Renamed track to "${renameItem.name.trim()}"`, "success");
      }
      setRenameItem(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to rename", "error");
    }
  };

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const parentId = newFolderParentId;
    const folderId = 'af_' + Date.now();
    try {
      const res = await safeFetchJson('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_audio_folder',
          payload: {
            id: folderId,
            folderId,
            name: newFolderName.trim(),
            parent: parentId || null,
            created_at: Date.now()
          }
        })
      });
      if (res?.success) {
        if (res.db) setDb(res.db);
        showToast(`Created folder "${newFolderName.trim()}"`, "success");
        setShowNewFolderModal(false);
        setNewFolderName('');
        setNewFolderParentId(null);
      } else {
        showToast(res?.error || "Failed to create folder", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to create folder", "error");
    }
  };

  // File Upload handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const destFid = currentFolderId;
      const formData = new FormData();
      formData.append('folder_id', destFid);
      
      for (let i = 0; i < files.length; i++) {
        formData.append('audios', files[i]);
      }

      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: {
          'x-user-email': currentUserEmail || ''
        },
        body: formData
      });
      const data = await res.json();
      if (data.success || data.ok) {
        if (data.db) setDb(data.db);
        showToast(`Uploaded ${data.count || files.length} track(s)!`, "success");
      } else {
        showToast(data.error || "Upload failed", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to upload audio files", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Plus button click router based on current location and folder type
  const handleFloatingPlusClick = () => {
    if (currentFolderId === 'root') {
      // Root level: create a root folder
      setNewFolderParentId(null);
      setShowNewFolderModal(true);
      return;
    }

    if (currentFolderType === 'empty') {
      // Prompt user whether they want to create a subfolder or upload music
      setShowEmptyFolderChoiceModal(true);
      return;
    }

    if (currentFolderType === 'folders') {
      // Only folders allowed
      setNewFolderParentId(currentFolderId);
      setShowNewFolderModal(true);
      return;
    }

    if (currentFolderType === 'music') {
      // Only music allowed
      fileInputRef.current?.click();
      return;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  const isFavoriteFolder = Boolean(activeProject && activeProject.favorite_audio_folder_id === currentFolderId);

  const content = (
    <div className="flex flex-col h-full w-full bg-gray-950 text-gray-100 overflow-hidden font-sans select-none relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Top Header */}
      <header className="px-3 sm:px-6 py-2.5 sm:py-3.5 bg-gray-900/98 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {currentFolderId !== 'root' ? (
            <button
              type="button"
              onClick={() => {
                if (activeFolder?.parent && activeFolder.parent !== 'root') {
                  setCurrentFolderId(activeFolder.parent);
                } else {
                  setCurrentFolderId('root');
                }
              }}
              className="p-1 sm:p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0"
              title="Back"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">
                {activeFolder?.parent && audioFolders[activeFolder.parent]?.name
                  ? audioFolders[activeFolder.parent].name
                  : 'Library'}
              </span>
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400 shrink-0 shadow-xs">
              <Music size={16} />
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {currentFolderId === 'root' 
                ? 'Music Library' 
                : (activeFolder?.name || 'Folder')}
            </h2>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-pink-950/70 border border-pink-500/40 text-pink-300 font-bold shrink-0">
              {currentFolderId === 'root' 
                ? `${rootFoldersList.length} folders` 
                : currentFolderType === 'folders'
                  ? `${currentSubfolders.length} subfolders`
                  : `${currentFolderTracks.length} tracks`}
            </span>

            {/* In folder actions: Star for project, rename, delete */}
            {activeFolder && (
              <div className="flex items-center gap-1 ml-1 shrink-0">
                {activeProject && (
                  <button
                    type="button"
                    onClick={() => handleToggleFavoriteFolderForProject(activeFolder.id)}
                    className={`p-1.5 rounded-lg border transition cursor-pointer ${
                      isFavoriteFolder
                        ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-amber-300'
                    }`}
                    title={isFavoriteFolder ? `Unstar for "${activeProject.name}"` : `Star as Favorite for "${activeProject.name}"`}
                  >
                    <Star size={13} className={isFavoriteFolder ? "fill-amber-400 text-amber-400" : ""} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRenameItem({ id: activeFolder.id, name: activeFolder.name, type: 'folder' })}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
                  title="Rename folder"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem({ type: 'folder', id: activeFolder.id, name: activeFolder.name })}
                  className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition cursor-pointer"
                  title="Delete folder"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons: Close at the corner */}
        <div className="flex items-center gap-1 shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer shrink-0"
              title="Close Music Library"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Multi-selection Bar if items selected */}
      {selectedAudioIds.length > 0 && (
        <div className="sticky top-0 z-30 px-3 sm:px-6 py-2 bg-gradient-to-r from-gray-900 via-pink-950/80 to-purple-950/80 border-b border-pink-500/40 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 text-pink-200 font-extrabold">
            <CheckSquare size={15} className="text-pink-400" />
            <span>{selectedAudioIds.length} track(s) selected</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Copy to Folder */}
            <button
              type="button"
              onClick={() => {
                setTargetCopyFolderId(eligibleMusicDestinationFolders[0]?.id || '');
                setCopyAudioModal({ audioIds: selectedAudioIds });
              }}
              className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 border border-purple-500/50 text-purple-300 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 text-xs shadow-xs"
              title="Copy selected tracks to another music folder"
            >
              <Copy size={12} />
              <span>Copy</span>
            </button>
            {/* Move to Folder */}
            <button
              type="button"
              onClick={() => {
                setTargetMoveFolderId(eligibleMusicDestinationFolders[0]?.id || '');
                setMoveAudioModal({ audioIds: selectedAudioIds });
              }}
              className="px-2.5 py-1 bg-gray-900 hover:bg-gray-800 border border-pink-500/50 text-pink-300 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 text-xs shadow-xs"
              title="Move selected tracks to another music folder"
            >
              <Scissors size={12} />
              <span>Move</span>
            </button>
            {/* Delete Selected */}
            <button
              type="button"
              onClick={() => setDeleteConfirmItem({
                type: 'multi_tracks',
                name: `${selectedAudioIds.length} tracks`,
                trackIds: selectedAudioIds
              })}
              className="px-2.5 py-1 bg-red-950/70 hover:bg-red-900 border border-red-500/50 text-red-300 hover:text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition active:scale-95 text-xs shadow-xs"
              title="Delete selected tracks"
            >
              <Trash2 size={12} />
              <span>Delete ({selectedAudioIds.length})</span>
            </button>
            {/* Clear Selection */}
            <button
              type="button"
              onClick={() => setSelectedAudioIds([])}
              className="px-2.5 py-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer text-xs font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${playingAudioId ? 'pb-28' : 'pb-20'}`}>
        {/* ROOT VIEW: UNIVERSAL FOLDERS GRID (NO dashed inline New Folder button) */}
        {currentFolderId === 'root' && (
          <section className="space-y-3">
            {rootFoldersList.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3">
                  <FolderPlus size={24} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No Music Folders Yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mb-4">
                  Tap the <strong className="text-pink-400">+</strong> button below to create your first music folder.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderParentId(null);
                    setShowNewFolderModal(true);
                  }}
                  className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-pink-950/60"
                >
                  <Plus size={14} />
                  <span>Create Music Folder</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                {rootFoldersList.map((folder, idx) => {
                  const trackCount = getFolderTrackCount(folder.id);
                  const subfolderCount = getFolderSubfolderCount(folder.id);
                  const isFav = Boolean(activeProject && activeProject.favorite_audio_folder_id === folder.id);

                  return (
                    <CompactMusicFolderCard
                      key={folder.id}
                      folderId={folder.id}
                      folder={folder}
                      itemCount={subfolderCount > 0 ? subfolderCount : trackCount}
                      isFavoriteForProject={isFav}
                      onClick={() => setCurrentFolderId(folder.id)}
                      onLongPress={() => setLongPressMusicFolder({
                        ...folder,
                        trackCount,
                        subfolderCount,
                        isFavoriteForProject: isFav
                      })}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* INSIDE A FOLDER */}
        {currentFolderId !== 'root' && (
          <div className="space-y-4">
            {/* 1. If Folder is Empty: prompt clear banner */}
            {currentFolderType === 'empty' && (
              <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3">
                  <Music size={24} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Folder is Empty</h3>
                <p className="text-xs text-gray-400 max-w-sm mb-4">
                  Add subfolders to organize music, or upload audio tracks directly into this folder.
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewFolderParentId(currentFolderId);
                      setShowNewFolderModal(true);
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-gray-700"
                  >
                    <FolderPlus size={14} className="text-pink-400" />
                    <span>Create Subfolder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-950/60"
                  >
                    <Upload size={14} />
                    <span>Upload Music</span>
                  </button>
                </div>
              </div>
            )}

            {/* 2. If Folder has Subfolders: render subfolders grid */}
            {currentFolderType === 'folders' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Folder size={13} className="text-pink-400" />
                    <span>Subfolders ({currentSubfolders.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                  {currentSubfolders.map(subfolder => {
                    const trackCount = getFolderTrackCount(subfolder.id);
                    const subfolderCount = getFolderSubfolderCount(subfolder.id);
                    const isFav = Boolean(activeProject && activeProject.favorite_audio_folder_id === subfolder.id);

                    return (
                      <CompactMusicFolderCard
                        key={subfolder.id}
                        folderId={subfolder.id}
                        folder={subfolder}
                        itemCount={subfolderCount > 0 ? subfolderCount : trackCount}
                        isFavoriteForProject={isFav}
                        onClick={() => setCurrentFolderId(subfolder.id)}
                        onLongPress={() => setLongPressMusicFolder({
                          ...subfolder,
                          trackCount,
                          subfolderCount,
                          isFavoriteForProject: isFav
                        })}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. If Folder has Music Tracks: render tracks list */}
            {currentFolderType === 'music' && (
              <section className="space-y-3">
                {/* Quick sub-bar */}
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllTracks}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <CheckSquare size={13} className={selectedAudioIds.length === currentFolderTracks.length && currentFolderTracks.length > 0 ? "text-pink-400" : "text-gray-500"} />
                      <span>{selectedAudioIds.length === currentFolderTracks.length && currentFolderTracks.length > 0 ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    <span className="text-[11px] text-gray-500">
                      ({currentFolderTracks.length} tracks)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                  >
                    <Upload size={12} />
                    <span>Upload More</span>
                  </button>
                </div>

                {/* Tracks List */}
                <div className="space-y-2">
                  {currentFolderTracks.map((audio, idx) => {
                    const isPlaying = playingAudioId === audio.id;
                    const isPaused = Boolean(isPlaying && audioPlayerRef.current?.paused);
                    const isSelected = selectedAudioIds.includes(audio.id);
                    const isStarredProj = isAudioStarredForProject(audio);
                    const mode = getAudioMode(audio);

                    // Determine M number in project
                    let projIndex = -1;
                    if (activeProject?.starred_audio_ids) {
                      projIndex = activeProject.starred_audio_ids.indexOf(audio.id);
                    }

                    return (
                      <div
                        key={audio.id}
                        className={`p-2.5 sm:p-3 rounded-2xl border transition-all duration-150 flex flex-col gap-2 relative ${
                          isSelected
                            ? 'bg-pink-950/40 border-pink-500/60 shadow-lg shadow-pink-950/30'
                            : isPlaying
                              ? 'bg-gray-900 border-pink-500/50 shadow-md ring-1 ring-pink-500/30'
                              : 'bg-gray-900/60 hover:bg-gray-900/90 border-gray-800/80 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => handleToggleSelectAudio(audio.id)}
                            className="p-1 text-gray-500 hover:text-pink-400 transition cursor-pointer shrink-0"
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-pink-600 border-pink-500 text-white' : 'border-gray-700 bg-gray-950'
                            }`}>
                              {isSelected && <Check size={11} className="stroke-[3]" />}
                            </div>
                          </button>

                          {/* Play / Pause Button */}
                          <button
                            type="button"
                            onClick={() => handleTogglePlay(audio)}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition active:scale-95 cursor-pointer shadow-md ${
                              isPlaying && !isPaused
                                ? 'bg-gradient-to-tr from-pink-600 to-rose-500 text-white ring-2 ring-pink-400 shadow-pink-600/40'
                                : 'bg-gray-800 hover:bg-pink-600 text-gray-200 hover:text-white border border-gray-700'
                            }`}
                            title={isPlaying && !isPaused ? "Pause" : "Play"}
                          >
                            {isPlaying && !isPaused ? (
                              <div className="flex items-end gap-0.5 h-3">
                                <span className="w-0.5 bg-white h-2 animate-bounce rounded-full" style={{ animationDelay: '0ms' }} />
                                <span className="w-0.5 bg-white h-3 animate-bounce rounded-full" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 bg-white h-1.5 animate-bounce rounded-full" style={{ animationDelay: '300ms' }} />
                              </div>
                            ) : (
                              <Play size={14} className="ml-0.5 fill-current" />
                            )}
                          </button>

                          {/* Metadata */}
                          <div 
                            className="flex-1 min-w-0 cursor-pointer pr-1"
                            onClick={() => handleTogglePlay(audio)}
                          >
                            <h4 className={`text-xs sm:text-sm font-bold truncate transition ${
                              isPlaying ? 'text-pink-300 font-black' : 'text-white hover:text-pink-200'
                            }`}>
                              {audio.name}
                            </h4>

                            <div className="flex items-center flex-wrap gap-1.5 text-[10px] text-gray-400 mt-0.5 font-mono">
                              <span>{formatTime(audio.duration || 0)}</span>
                              <span>•</span>

                              {/* Mode: For All vs Change */}
                              <button
                                type="button"
                                onClick={(e) => handleToggleAudioMode(audio, e)}
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition cursor-pointer active:scale-95 flex items-center gap-1 shrink-0 ${
                                  mode === 'all'
                                    ? 'bg-amber-400 text-black border-amber-300 font-black'
                                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'
                                }`}
                                title={mode === 'all' ? 'Permanent for all clips. Click to set Change.' : 'Rotates on assemble. Click to set For All.'}
                              >
                                {mode === 'all' ? (
                                  <>
                                    <Check size={8} className="stroke-[3]" />
                                    <span>For All</span>
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw size={8} />
                                    <span>Change</span>
                                  </>
                                )}
                              </button>

                              {/* M1, M2 badge if starred in project */}
                              {isStarredProj && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 font-mono">
                                  M{projIndex >= 0 ? projIndex + 1 : 1}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions: Star, Use, 3-dots */}
                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            {/* Star Toggle */}
                            {activeProject && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleStarForProject(audio, e)}
                                className={`p-1.5 sm:p-2 rounded-xl transition cursor-pointer active:scale-90 ${
                                  isStarredProj
                                    ? 'text-amber-300 bg-amber-400/25 border border-amber-400 ring-1 ring-amber-300/40 shadow-xs'
                                    : 'text-gray-500 hover:text-amber-400 hover:bg-gray-800 border border-transparent'
                                }`}
                                title={isStarredProj ? `Starred for "${activeProject.name}". Tap to unstar` : `Star for "${activeProject.name}"`}
                              >
                                <Star size={15} className={isStarredProj ? "fill-amber-400 text-amber-400" : ""} />
                              </button>
                            )}

                            {/* Use / Insert button */}
                            <button
                              type="button"
                              onClick={() => handleInsertTrackAction(audio)}
                              className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/25 shadow-md shrink-0 active:scale-95 transition cursor-pointer flex items-center gap-1"
                              title="Insert into video timeline"
                            >
                              <Plus size={12} className="stroke-[3]" />
                              <span>Use</span>
                            </button>

                            {/* 3-dots Menu */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveTrackMenuId(activeTrackMenuId === audio.id ? null : audio.id)}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition cursor-pointer"
                                title="Options"
                              >
                                <MoreVertical size={15} />
                              </button>

                              {activeTrackMenuId === audio.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveTrackMenuId(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl py-1.5 z-50 text-xs font-medium animate-in fade-in zoom-in-95 duration-100">
                                    {activeProject && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          setActiveTrackMenuId(null);
                                          handleToggleStarForProject(audio, e);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-800 text-amber-300 flex items-center gap-2 cursor-pointer transition font-semibold"
                                      >
                                        <Star size={13} className={isStarredProj ? "fill-amber-400 text-amber-400" : ""} />
                                        <span>{isStarredProj ? 'Unstar Track' : 'Star Track'}</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTrackMenuId(null);
                                        setTargetCopyFolderId(eligibleMusicDestinationFolders[0]?.id || '');
                                        setCopyAudioModal({ audioIds: [audio.id] });
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-800 text-gray-200 flex items-center gap-2 cursor-pointer transition"
                                    >
                                      <Copy size={13} className="text-purple-400" />
                                      <span>Copy to Folder</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTrackMenuId(null);
                                        setTargetMoveFolderId(eligibleMusicDestinationFolders[0]?.id || '');
                                        setMoveAudioModal({ audioIds: [audio.id] });
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-800 text-gray-200 flex items-center gap-2 cursor-pointer transition"
                                    >
                                      <FolderInput size={13} className="text-pink-400" />
                                      <span>Move to Folder</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTrackMenuId(null);
                                        setRenameItem({ id: audio.id, name: audio.name, type: 'audio' });
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-gray-800 text-gray-200 flex items-center gap-2 cursor-pointer transition"
                                    >
                                      <Edit2 size={13} className="text-amber-400" />
                                      <span>Rename Track</span>
                                    </button>

                                    <div className="my-1 border-t border-gray-800" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTrackMenuId(null);
                                        setDeleteConfirmItem({ type: 'track', id: audio.id, name: audio.name });
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-red-950/60 text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer transition"
                                    >
                                      <Trash2 size={13} />
                                      <span>Delete Track</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Inline Scrubber when playing */}
                        {isPlaying && (
                          <div className="mt-1 pt-1.5 border-t border-gray-800/80 flex flex-col gap-1 text-[10px]">
                            <div className="flex items-center justify-between text-[11px] text-pink-300 font-sans font-bold">
                              <span className="flex items-center gap-1.5 truncate pr-2">
                                <Volume2 size={12} className="text-pink-400 shrink-0 animate-pulse" />
                                <span className="text-white truncate font-semibold">{audio.name}</span>
                              </span>
                              <span className="text-pink-400 font-mono text-[10px] shrink-0">
                                {formatTime(currentTime)} / {formatTime(audioDuration || audio.duration || 0)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max={audioDuration || audio.duration || 100}
                              step="0.1"
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full accent-pink-500 h-1 bg-gray-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* FLOATING PLUS ACTION BUTTON (At bottom right corner) */}
      <div 
        className={`fixed sm:absolute z-40 transition-all duration-200 animate-in zoom-in-75 ${
          playingAudioId ? 'bottom-24 right-4 sm:right-6' : 'bottom-6 right-4 sm:right-6'
        }`}
      >
        <button
          type="button"
          onClick={handleFloatingPlusClick}
          className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white flex items-center justify-center shadow-2xl shadow-pink-950/90 border-2 border-white/40 cursor-pointer active:scale-90 transition-transform"
          title={
            currentFolderId === 'root'
              ? 'Create New Music Folder'
              : currentFolderType === 'folders'
                ? 'Create New Subfolder'
                : currentFolderType === 'music'
                  ? 'Upload Audio Tracks'
                  : 'Add to this Folder'
          }
        >
          <Plus size={24} className="stroke-[2.5]" />
        </button>
      </div>

      {/* PERSISTENT BOTTOM AUDIO PLAYER DOCK */}
      <AudioPlayerBar
        playingAudioId={playingAudioId}
        currentPlayingAudio={currentPlayingAudio}
        audioDuration={audioDuration}
        currentTime={currentTime}
        handleSeek={handleSeek}
        handleTogglePlay={handleTogglePlay}
        audioPlayerRef={audioPlayerRef}
        formatTime={formatTime}
        activeBucketName={activeFolder?.name || null}
        playPrevTrack={playPrevTrack}
        playNextTrack={playNextTrack}
        isMuted={isMuted}
        previewVolume={previewVolume}
        handleToggleMute={handleToggleMute}
        handleVolumeChange={handleVolumeChange}
        currentFolderId={currentFolderId}
        activeProject={activeProject}
        handleToggleStarForProject={handleToggleStarForProject}
        handleToggleStar={handleToggleStar}
        isAudioStarredForProject={isAudioStarredForProject}
        isAudioStarred={isAudioStarredForProject}
        handleInsertTrackAction={handleInsertTrackAction}
        setPlayingAudioId={setPlayingAudioId}
      />

      {/* CHOICE MODAL FOR EMPTY FOLDER */}
      {showEmptyFolderChoiceModal && (
        <div 
          onClick={() => setShowEmptyFolderChoiceModal(false)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                  <FolderPlus size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Choose Action</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowEmptyFolderChoiceModal(false)} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              What would you like to add inside <strong className="text-white">"{activeFolder?.name}"</strong>?
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowEmptyFolderChoiceModal(false);
                  fileInputRef.current?.click();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-950/50 cursor-pointer active:scale-95 transition"
              >
                <Upload size={16} />
                <span>Upload Music Tracks</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowEmptyFolderChoiceModal(false);
                  setNewFolderParentId(currentFolderId);
                  setShowNewFolderModal(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-750 text-white border border-gray-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
              >
                <FolderPlus size={16} className="text-pink-400" />
                <span>Create Subfolder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LONG-PRESS MUSIC FOLDER ACTION BOTTOM SHEET */}
      <MusicFolderActionBottomSheet
        isOpen={Boolean(longPressMusicFolder)}
        onClose={() => setLongPressMusicFolder(null)}
        folder={longPressMusicFolder}
        trackCount={longPressMusicFolder?.trackCount || 0}
        subfolderCount={longPressMusicFolder?.subfolderCount || 0}
        isFavoriteForProject={longPressMusicFolder?.isFavoriteForProject}
        activeProjectName={activeProject?.name}
        onOpenFolder={(fId) => setCurrentFolderId(fId)}
        onToggleFavoriteForProject={(fId) => handleToggleFavoriteFolderForProject(fId)}
        onRename={(fId, fName) => setRenameItem({ id: fId, name: fName, type: 'folder' })}
        onDelete={(fId, fName) => setDeleteConfirmItem({ type: 'folder', id: fId, name: fName })}
      />

      {/* FOLDER ACTION MODALS (New Folder, Rename, Move, Copy, Delete) */}
      <AudioFolderActionModals
        showNewFolderModal={showNewFolderModal}
        setShowNewFolderModal={setShowNewFolderModal}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleCreateFolder={handleCreateFolder}
        parentFolderName={newFolderParentId ? (audioFolders[newFolderParentId]?.name || activeFolder?.name) : undefined}
        audioFolders={audioFolders}

        renameItem={renameItem}
        setRenameItem={setRenameItem}
        handleSaveRename={handleSaveRename}

        moveAudioModal={moveAudioModal}
        setMoveAudioModal={setMoveAudioModal}
        targetMoveFolderId={targetMoveFolderId}
        setTargetMoveFolderId={setTargetMoveFolderId}
        eligibleMoveFolders={eligibleMusicDestinationFolders}
        handleExecuteMove={handleExecuteMove}

        copyAudioModal={copyAudioModal}
        setCopyAudioModal={setCopyAudioModal}
        targetCopyFolderId={targetCopyFolderId}
        setTargetCopyFolderId={setTargetCopyFolderId}
        eligibleCopyFolders={eligibleMusicDestinationFolders}
        handleExecuteCopy={handleExecuteCopy}
        isCopying={isCopying}

        deleteConfirmItem={deleteConfirmItem}
        setDeleteConfirmItem={setDeleteConfirmItem}
        handleExecuteDelete={handleExecuteDelete}
        isDeleting={isDeleting}
      />
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-gray-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in"
    >
      {content}
    </div>
  );
};

export default AudioDashboard;
