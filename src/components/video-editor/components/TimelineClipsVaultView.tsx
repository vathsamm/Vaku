import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Film, Sparkles, Check, Trash2, Plus, 
  FolderInput, ChevronLeft, ChevronRight, X, Layers,
  UploadCloud, Loader2, Star, Boxes
} from 'lucide-react';
import { VideoEditorClip, HiggsfieldJob, DB, VideoEditorProject, getClipVariantGroups } from '../../../types';
import { useLongPressPreview } from '../../../utils/useLongPressPreview';
import { LongPressVideoPreviewOverlay } from '../../LongPressVideoPreview';
import { ImportProjectClipsModal } from '../modals/ImportProjectClipsModal';

export interface TimelineClipsVaultViewProps {
  activeClips: VideoEditorClip[];
  targetClipIndex?: number;
  jobs?: HiggsfieldJob[];
  db?: DB;
  activeProject?: VideoEditorProject | null;
  masterBucketName?: string;
  updateProjectClips?: (clips: VideoEditorClip[], history?: boolean) => void;
  onSelectClipIndex?: (clipIdx: number) => void;
  onSwitchVariant?: (clipIdx: number, variantIdx: number, groupIdx?: number) => void;
  onDeleteClipVariant?: (clipIdx: number, variantIdx: number, groupIdx?: number) => void;
  onDeleteSpecificClip?: (clipIdx: number) => void;
  onInitiateReplaceClip?: (clipIdx: number) => void;
  onOpenAiPromptMode?: (clipIdx?: number) => void;
  onTrashJob?: (job: HiggsfieldJob) => Promise<void>;
  onApplyTake?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  onReplaceKeepVariant?: (job: HiggsfieldJob, targetClipIndex?: number) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onCloseParent?: () => void;
  isAudioMuted?: boolean;
  onToggleMute?: () => void;
  showImportModal?: boolean;
  setShowImportModal?: (show: boolean) => void;
  insertTargetClipIndex?: number | null;
  replaceTargetClipIndex?: number | null;
  variantTargetClipIndex?: number | null;
  targetGroupIdx?: number | null;
  isImportBrowserMode?: boolean;
  onTakeFullClip?: (sourceClip: VideoEditorClip) => void;
  onTakeSingleClip?: (singleClip: VideoEditorClip) => void;
  onTakeVariantGroup?: (grp: { id?: string; label?: string; clips: VideoEditorClip[] }) => void;
  onOpenPickerForVariant?: (clipIdx: number) => void;
  onSwitchVariantGroup?: (clipIdx: number, groupIdx: number) => void;
  onCreateVariantGroup?: (clipIdx: number, mode?: 'empty_ai' | 'upload' | 'picker') => void;
  onDeleteVariantGroup?: (clipIdx: number, groupIdx: number) => void;
}

export const TimelineClipsVaultView: React.FC<TimelineClipsVaultViewProps> = ({
  activeClips = [],
  targetClipIndex = 0,
  jobs = [],
  db,
  activeProject,
  masterBucketName = 'Uploads',
  updateProjectClips,
  onSelectClipIndex,
  onSwitchVariant,
  onDeleteClipVariant,
  onSwitchVariantGroup,
  onCreateVariantGroup,
  onDeleteVariantGroup,
  onDeleteSpecificClip,
  onInitiateReplaceClip,
  onOpenAiPromptMode,
  onTrashJob,
  onApplyTake,
  onReplaceKeepVariant,
  showToast = () => {},
  onCloseParent,
  isAudioMuted = true,
  onToggleMute,
  showImportModal: controlledShowImportModal,
  setShowImportModal: controlledSetShowImportModal,
  insertTargetClipIndex,
  replaceTargetClipIndex,
  variantTargetClipIndex,
  targetGroupIdx,
  isImportBrowserMode = false,
  onTakeFullClip,
  onTakeSingleClip,
  onTakeVariantGroup,
  onOpenPickerForVariant,
}) => {
  const [selectedNavClipIdx, setSelectedNavClipIdx] = useState<number>(targetClipIndex ?? 0);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [confirmDeleteAllConceptsIdx, setConfirmDeleteAllConceptsIdx] = useState<number | null>(null);
  const [confirmDeleteVariantGrp, setConfirmDeleteVariantGrp] = useState<{ clipIdx: number; grpIdx: number; grpLabel: string } | null>(null);
  const [addTakePrompt, setAddTakePrompt] = useState<{ clipIdx: number; grpIdx: number; grpLabel: string } | null>(null);
  const [importTargetInfo, setImportTargetInfo] = useState<{ clipIdx: number; grpIdx?: number } | null>(null);
  const [internalShowImportModal, setInternalShowImportModal] = useState<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const showImportModal = controlledShowImportModal !== undefined ? controlledShowImportModal : internalShowImportModal;
  const setShowImportModal = controlledSetShowImportModal || setInternalShowImportModal;

  // Video element refs for inline playback
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Long press preview hook for 9/16 popout preview
  const {
    activePreview,
    startLongPress,
    moveLongPress,
    endLongPress,
    checkDidLongPress,
    closePreview,
  } = useLongPressPreview();

  // Sync mute state to all inline video elements
  useEffect(() => {
    Object.values(videoRefs.current).forEach(v => {
      if (v) v.muted = isAudioMuted;
    });
  }, [isAudioMuted]);

  // Sync selectedNavClipIdx with targetClipIndex changes
  useEffect(() => {
    if (typeof targetClipIndex === 'number' && targetClipIndex >= 0) {
      setSelectedNavClipIdx(targetClipIndex);
      setTimeout(() => {
        const el = document.getElementById(`timeline-clip-node-${targetClipIndex}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [targetClipIndex]);

  // Inline tap to play / pause toggle (loops automatically, no play button)
  const handleTogglePlayInline = (id: string) => {
    if (checkDidLongPress()) return;
    const el = videoRefs.current[id];
    if (!el) return;

    if (playingVideoId === id) {
      el.pause();
      setPlayingVideoId(null);
    } else {
      if (playingVideoId && videoRefs.current[playingVideoId]) {
        videoRefs.current[playingVideoId]?.pause();
      }
      el.muted = isAudioMuted;
      el.play().catch(() => {});
      setPlayingVideoId(id);
    }
  };

  // Reorder clips
  const handleReorderClips = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= activeClips.length || toIdx >= activeClips.length) return;
    if (!updateProjectClips) return;

    const reordered = [...activeClips];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    updateProjectClips(reordered, true);
    setSelectedNavClipIdx(toIdx);
    onSelectClipIndex?.(toIdx);
    showToast(`Moved Clip #${fromIdx + 1} to position #${toIdx + 1}`, 'info');

    setTimeout(() => {
      const el = document.getElementById(`timeline-clip-node-${toIdx}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // Take the entire clip with all of its concepts and variants
  const handleTakeFullClipInternal = (sourceClip: VideoEditorClip) => {
    if (onTakeFullClip) {
      onTakeFullClip(sourceClip);
      onCloseParent?.();
      return;
    }
    if (!updateProjectClips) return;

    const clonedGroups = sourceClip.variant_groups
      ? sourceClip.variant_groups.map((g, gIdx) => ({
          ...g,
          id: `group_${Date.now()}_${gIdx}`,
          clips: g.clips ? g.clips.map((v, vIdx) => ({
            ...v,
            id: `take_${gIdx}_${vIdx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          })) : []
        }))
      : undefined;

    const clonedClip: VideoEditorClip = {
      ...sourceClip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variant_groups: clonedGroups,
      variants: sourceClip.variants ? sourceClip.variants.map((v, vIdx) => ({
        ...v,
        id: `take_${vIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      })) : undefined
    };

    if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const targetClip = activeClips[variantTargetClipIndex];
      const currentGroups = getClipVariantGroups(targetClip).map(g => ({ ...g, clips: [...g.clips] }));
      const newGroups = getClipVariantGroups(sourceClip);

      newGroups.forEach(srcGrp => {
        const existingGrp = currentGroups.find(g => g.label === srcGrp.label);
        if (existingGrp) {
          const freshClips = srcGrp.clips.map(c => ({
            ...c,
            id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          }));
          existingGrp.clips.push(...freshClips);
        } else {
          currentGroups.push({
            ...srcGrp,
            id: `group_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            clips: srcGrp.clips.map(c => ({
              ...c,
              id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
            }))
          });
        }
      });

      const activeGrp = currentGroups[targetClip.active_variant_group_index ?? 0] || currentGroups[0];
      const activeTake = activeGrp.clips[activeGrp.active_clip_index || 0] || activeGrp.clips[0];

      const updatedClip: VideoEditorClip = {
        ...targetClip,
        variant_groups: currentGroups,
        variants: activeGrp.clips,
        url: activeTake.url,
        file_id: activeTake.file_id || targetClip.file_id,
        duration: activeTake.duration || targetClip.duration,
      };
      const updated = [...activeClips];
      updated[variantTargetClipIndex] = updatedClip;
      updateProjectClips(updated, true);
      showToast(`Imported all concepts & takes to Position #${variantTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      // Save old clip to unused vault so it's never lost!
      const oldClip = activeClips[replaceTargetClipIndex];
      saveClipToUnusedVault(oldClip);

      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = clonedClip;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with all concepts & takes!`, 'success');
      onCloseParent?.();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, clonedClip);
      updateProjectClips(updated, true);
      showToast(`Inserted clip with all concepts at position #${insertTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    const updated = [...activeClips, clonedClip];
    updateProjectClips(updated, true);
    showToast(`Added clip with all concepts & takes to timeline!`, 'success');
    onCloseParent?.();
  };

  // Take ALL clips from a specific variant group / concept
  const handleTakeVariantGroupInternal = (grp: { id?: string; label?: string; clips?: VideoEditorClip[] }) => {
    const grpClips = grp.clips && grp.clips.length > 0 ? grp.clips : [];
    if (grpClips.length === 0) return;

    if (onTakeVariantGroup) {
      onTakeVariantGroup({ ...grp, clips: grpClips });
      onCloseParent?.();
      return;
    }
    if (!updateProjectClips) return;

    const clonedClips: VideoEditorClip[] = grpClips.map((c, i) => ({
      ...c,
      id: `take_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
      trim_start: 0,
      trim_end: c.duration || 5,
      speed: c.speed || 1.0,
      scale: c.scale || 1.0,
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

    const targetClipData: VideoEditorClip = {
      ...primaryTake,
      variants: clonedClips,
      active_variant_index: 0,
      variant_groups: [newGroup],
      active_variant_group_index: 0
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
      showToast(`Added Concept ${newGroup.label} (${clonedClips.length} takes) to Clip #${variantTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      const oldClip = activeClips[replaceTargetClipIndex];
      saveClipToUnusedVault(oldClip);
      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = targetClipData;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with Concept ${newGroup.label} (${clonedClips.length} takes)!`, 'success');
      onCloseParent?.();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, targetClipData);
      updateProjectClips(updated, true);
      showToast(`Inserted Concept ${newGroup.label} (${clonedClips.length} takes) at #${insertTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    const updated = [...activeClips, targetClipData];
    updateProjectClips(updated, true);
    showToast(`Added Concept ${newGroup.label} (${clonedClips.length} takes) to timeline!`, 'success');
    onCloseParent?.();
  };

  // Scroll sync: update active number at top bar as user scrolls
  const handleScrollSync = useCallback(() => {
    if (isProgrammaticScrollRef.current) return;
    const container = scrollContainerRef.current;
    if (!container || activeClips.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    const threshold = containerRect.top + 80;

    let foundIdx = 0;
    for (let i = 0; i < activeClips.length; i++) {
      const el = document.getElementById(`timeline-clip-node-${i}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          foundIdx = i;
        }
      }
    }

    setSelectedNavClipIdx(prev => {
      if (prev !== foundIdx) {
        const topBtn = document.getElementById(`top-nav-clip-btn-${foundIdx}`);
        if (topBtn) {
          topBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        return foundIdx;
      }
      return prev;
    });
  }, [activeClips.length]);

  // Add a new concept group to a clip position directly in place without popups
  const handleCreateConceptGroupInternal = (clipIdx: number) => {
    if (!updateProjectClips || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    const letterLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const newLetter = letterLabels[groups.length] || `${groups.length + 1}`;
    const newTake: VideoEditorClip = {
      ...clip,
      id: `variant_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      variants: undefined,
      variant_groups: undefined
    };
    const newGroup = {
      id: `group_${Date.now()}`,
      label: newLetter,
      clips: [newTake],
      active_clip_index: 0
    };
    groups.push(newGroup);
    const updatedClip: VideoEditorClip = {
      ...clip,
      variant_groups: groups,
      active_variant_group_index: groups.length - 1,
      variants: newGroup.clips,
      active_variant_index: 0
    };
    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);
    showToast(`Added Concept ${newLetter}!`, 'success');
  };

  // Helper to preserve replaced/unselected clips in unused vault
  const saveClipToUnusedVault = (clip: VideoEditorClip) => {
    if (!clip || !activeProject) return;
    const existingVault: VideoEditorClip[] = activeProject.vault_unused_clips || [];
    if (!existingVault.some(c => c.id === clip.id || (c.file_id && c.file_id === clip.file_id))) {
      activeProject.vault_unused_clips = [...existingVault, { ...clip }];
    }
  };

  // Take ONLY a single specific clip/take (no other variants attached)
  const handleTakeSingleClipInternal = (singleClip: VideoEditorClip) => {
    if (onTakeSingleClip) {
      onTakeSingleClip(singleClip);
      onCloseParent?.();
      return;
    }
    if (!updateProjectClips) return;

    const cleanClip: VideoEditorClip = {
      ...singleClip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variants: undefined,
      active_variant_index: undefined,
      trim_start: 0,
      trim_end: singleClip.duration || 5,
      speed: 1.0,
      scale: 1.0,
      is_muted: false,
      volume: 1.0
    };

    if (variantTargetClipIndex !== null && variantTargetClipIndex !== undefined && variantTargetClipIndex >= 0 && variantTargetClipIndex < activeClips.length) {
      const targetClip = activeClips[variantTargetClipIndex];
      const existingVariants: VideoEditorClip[] = (targetClip.variants && targetClip.variants.length > 0)
        ? [...targetClip.variants]
        : [{ ...targetClip, id: `take_orig_${Date.now()}` }];

      const newVariant: VideoEditorClip = {
        ...cleanClip,
        id: `take_${existingVariants.length + 1}_${Date.now()}`
      };
      existingVariants.push(newVariant);

      const updatedClip: VideoEditorClip = {
        ...targetClip,
        variants: existingVariants,
        active_variant_index: existingVariants.length - 1,
        url: newVariant.url,
        file_id: newVariant.file_id || targetClip.file_id,
        duration: newVariant.duration || targetClip.duration,
        trim_start: 0,
        trim_end: newVariant.duration || targetClip.duration,
      };
      const updated = [...activeClips];
      updated[variantTargetClipIndex] = updatedClip;
      updateProjectClips(updated, true);
      showToast(`Added single take as Take #${existingVariants.length} to Clip #${variantTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    if (replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined && replaceTargetClipIndex >= 0 && replaceTargetClipIndex < activeClips.length) {
      // Save old clip to unused vault
      const oldClip = activeClips[replaceTargetClipIndex];
      saveClipToUnusedVault(oldClip);

      const updated = [...activeClips];
      updated[replaceTargetClipIndex] = cleanClip;
      updateProjectClips(updated, true);
      showToast(`Replaced Clip #${replaceTargetClipIndex + 1} with single take!`, 'success');
      onCloseParent?.();
      return;
    }

    if (insertTargetClipIndex !== null && insertTargetClipIndex !== undefined && insertTargetClipIndex >= 0 && insertTargetClipIndex <= activeClips.length) {
      const updated = [...activeClips];
      updated.splice(insertTargetClipIndex, 0, cleanClip);
      updateProjectClips(updated, true);
      showToast(`Inserted clip at position #${insertTargetClipIndex + 1}!`, 'success');
      onCloseParent?.();
      return;
    }

    const updated = [...activeClips, cleanClip];
    updateProjectClips(updated, true);
    showToast(`Added single clip to timeline!`, 'success');
    onCloseParent?.();
  };

  // Clone a take from another concept on the same strip into this concept
  const handleCloneTakeIntoConcept = (clipIdx: number, grpIdx: number, sourceClip: VideoEditorClip, sourceLabel: string) => {
    if (!updateProjectClips || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const targetClip = activeClips[clipIdx];
    const groups = getClipVariantGroups(targetClip).map(g => ({ ...g, clips: [...g.clips] }));
    if (grpIdx < 0 || grpIdx >= groups.length) return;

    const clonedTake: VideoEditorClip = {
      ...sourceClip,
      id: `take_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      variants: undefined,
      variant_groups: undefined
    };

    groups[grpIdx].clips.push(clonedTake);
    groups[grpIdx].active_clip_index = groups[grpIdx].clips.length - 1;

    const existingVariants = (targetClip.variants && targetClip.variants.length > 0)
      ? [...targetClip.variants, clonedTake]
      : [{ ...targetClip, id: `take_orig_${Date.now()}` }, clonedTake];

    const grpLetter = groups[grpIdx].label || String.fromCharCode(65 + grpIdx);
    const updatedClip: VideoEditorClip = {
      ...targetClip,
      variants: existingVariants,
      variant_groups: groups,
      url: clonedTake.url,
      file_id: clonedTake.file_id || targetClip.file_id,
      duration: clonedTake.duration || targetClip.duration
    };

    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);
    showToast(`Imported Take ${sourceLabel} to Concept ${grpLetter}!`, 'success');
  };

  // Helper to format variant takes with letters (A, B, C...)
  const getVariantLetter = (idxNum: number): string => {
    return String.fromCharCode(65 + Math.max(0, idxNum));
  };

  // Delete active primary take (if variants exist, promotes the first variant)
  const handleDeleteActiveTake = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    const activeGrpIdx = Math.min(Math.max(0, clip.active_variant_group_index ?? 0), groups.length - 1);
    const activeGrp = groups[activeGrpIdx];
    const variants = activeGrp.clips || [];

    if (variants.length > 1) {
      const [promoted, ...remainingVariants] = variants;
      activeGrp.clips = [promoted, ...remainingVariants];
      activeGrp.active_clip_index = 0;
      const updatedClip: VideoEditorClip = {
        ...clip,
        ...promoted,
        id: clip.id,
        variants: activeGrp.clips,
        active_variant_index: 0,
        variant_groups: groups,
        active_variant_group_index: activeGrpIdx,
      };
      const updated = [...activeClips];
      updated[clipIdx] = updatedClip;
      updateProjectClips?.(updated, true);
      showToast(`Deleted primary take in Concept ${activeGrp.label}. Promoted next take to active.`, 'info');
    } else if (groups.length > 1) {
      const remainingGroups = groups.filter((_, idx) => idx !== activeGrpIdx);
      const nextGrp = remainingGroups[0];
      const updatedClip: VideoEditorClip = {
        ...clip,
        ...nextGrp.clips[0],
        id: clip.id,
        variant_groups: remainingGroups,
        active_variant_group_index: 0,
        variants: nextGrp.clips,
        active_variant_index: 0
      };
      const updated = [...activeClips];
      updated[clipIdx] = updatedClip;
      updateProjectClips?.(updated, true);
      showToast(`Deleted Concept ${activeGrp.label}.`, 'info');
    } else {
      handleDeleteEntireSlot(clipIdx);
    }
  };

  // Delete a specific alternate variant take (e.g. in Concept A or Concept B)
  const handleDeleteVariantInternal = (clipIdx: number, variantIdx: number, groupIdx?: number) => {
    if (onDeleteClipVariant) {
      onDeleteClipVariant(clipIdx, variantIdx, groupIdx);
      return;
    }
    if (!updateProjectClips || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    const targetGrpIdx = typeof groupIdx === 'number'
      ? Math.min(Math.max(0, groupIdx), groups.length - 1)
      : Math.min(Math.max(0, clip.active_variant_group_index ?? 0), groups.length - 1);
    const targetGrp = groups[targetGrpIdx];
    if (!targetGrp || !targetGrp.clips) return;

    if (targetGrp.clips.length <= 1) {
      if (groups.length > 1) {
        handleDeleteConceptGroupInternal(clipIdx, targetGrpIdx);
      } else {
        handleDeleteEntireSlot(clipIdx);
      }
      return;
    }

    const remainingVariants = targetGrp.clips.filter((_, idx) => idx !== variantIdx);
    targetGrp.clips = remainingVariants;
    targetGrp.active_clip_index = Math.min(targetGrp.active_clip_index ?? 0, remainingVariants.length - 1);

    const activeGrp = groups[clip.active_variant_group_index ?? 0] || groups[0];
    const activeTake = activeGrp.clips[activeGrp.active_clip_index || 0] || activeGrp.clips[0];

    const updatedClip: VideoEditorClip = {
      ...clip,
      url: activeTake.url,
      file_id: activeTake.file_id || clip.file_id,
      duration: activeTake.duration || clip.duration,
      variants: activeGrp.clips,
      active_variant_index: activeGrp.active_clip_index,
      variant_groups: groups,
    };
    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);
    showToast(`Deleted take from Concept ${targetGrp.label}`, 'info');
  };

  const handleDeleteConceptGroupInternal = (clipIdx: number, groupIdx: number) => {
    if (onDeleteVariantGroup) {
      onDeleteVariantGroup(clipIdx, groupIdx);
      return;
    }
    if (!updateProjectClips || clipIdx < 0 || clipIdx >= activeClips.length) return;
    const clip = activeClips[clipIdx];
    const groups = getClipVariantGroups(clip).map(g => ({ ...g, clips: [...g.clips] }));
    if (groups.length <= 1) {
      handleDeleteEntireSlot(clipIdx);
      return;
    }
    const targetLabel = groups[groupIdx]?.label || String.fromCharCode(65 + groupIdx);
    const remainingGroups = groups.filter((_, idx) => idx !== groupIdx);
    const newActiveGrpIdx = Math.min(
      clip.active_variant_group_index === groupIdx ? 0 : (clip.active_variant_group_index ?? 0) > groupIdx ? (clip.active_variant_group_index ?? 0) - 1 : (clip.active_variant_group_index ?? 0),
      remainingGroups.length - 1
    );
    const nextGrp = remainingGroups[newActiveGrpIdx];
    const activeTake = nextGrp.clips[nextGrp.active_clip_index || 0] || nextGrp.clips[0];
    const updatedClip: VideoEditorClip = {
      ...clip,
      ...activeTake,
      id: clip.id,
      variant_groups: remainingGroups,
      active_variant_group_index: newActiveGrpIdx,
      variants: nextGrp.clips,
      active_variant_index: nextGrp.active_clip_index || 0
    };
    const updated = [...activeClips];
    updated[clipIdx] = updatedClip;
    updateProjectClips(updated, true);
    showToast(`Deleted Concept ${targetLabel}.`, 'info');
  };

  // Delete entire clip slot and all its takes at that sequence position
  const handleDeleteEntireSlot = (clipIdx: number) => {
    if (clipIdx < 0 || clipIdx >= activeClips.length) return;
    if (onDeleteSpecificClip) {
      onDeleteSpecificClip(clipIdx);
      return;
    }
    if (!updateProjectClips) return;
    const updated = [...activeClips];
    updated.splice(clipIdx, 1);
    updateProjectClips(updated, true);
    showToast(`Deleted Clip #${clipIdx + 1} and all takes`, 'info');
  };

  // Delete an AI generation take job
  const handleDeleteAiJobInternal = async (job: HiggsfieldJob) => {
    if (onTrashJob) {
      await onTrashJob(job);
      return;
    }
    try {
      await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
    } catch (_) {}
    showToast('AI Take removed', 'info');
  };

  const [uploadingVariantIdx, setUploadingVariantIdx] = useState<number | null>(null);
  const [uploadingVariantProgress, setUploadingVariantProgress] = useState<{ current: number; total: number } | null>(null);

  const handleUploadClipAsVariant = async (clipIdx: number, e: React.ChangeEvent<HTMLInputElement>, targetGroupIdx?: number) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    e.target.value = '';

    setUploadingVariantIdx(clipIdx);
    setUploadingVariantProgress({ current: 1, total: files.length });
    showToast(`Uploading ${files.length} video clip${files.length === 1 ? '' : 's'}...`, 'info');

    const targetClip = activeClips[clipIdx];
    if (!targetClip) {
      setUploadingVariantIdx(null);
      setUploadingVariantProgress(null);
      return;
    }

    try {
      const targetFolderId = activeProject?.master_bucket_fid || 'uploads';
      const newlyAddedVariants: VideoEditorClip[] = [];

      for (let i = 0; i < files.length; i++) {
        setUploadingVariantProgress({ current: i + 1, total: files.length });
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', targetFolderId);

        // Try /api/videos first, fall back to /api/upload
        let res = await fetch('/api/videos', {
          method: 'POST',
          body: formData
        });
        if (!res.ok) {
          res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
        }

        if (res.ok) {
          const data = await res.json();
          const uploadedVideo = data.video || data;
          const videoUrl = uploadedVideo.url || (uploadedVideo.file_id ? `/api/video/${uploadedVideo.file_id}` : '');
          const fileId = uploadedVideo.file_id || uploadedVideo.id || `file_${Date.now()}_${i}`;
          const duration = typeof uploadedVideo.duration === 'number' && uploadedVideo.duration > 0 ? uploadedVideo.duration : 5;
          const newVidId = uploadedVideo.id || `vid_${Date.now()}_${i}`;

          if (videoUrl) {
            newlyAddedVariants.push({
              ...targetClip,
              id: `variant_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
              vid: newVidId,
              file_id: fileId,
              url: videoUrl,
              duration: duration,
              trim_start: 0,
              trim_end: duration,
              speed: 1.0,
              scale: 1.0,
              is_muted: false,
              volume: 1.0,
              created_at: Date.now() + i,
              variants: undefined,
              variant_groups: undefined,
            });
          }
        }
      }

      if (newlyAddedVariants.length === 0) {
        showToast('Failed to upload video variants', 'error');
        return;
      }

      const groups = getClipVariantGroups(targetClip).map(g => ({ ...g, clips: [...g.clips] }));
      const activeGrpIdx = typeof targetGroupIdx === 'number'
        ? Math.min(Math.max(0, targetGroupIdx), groups.length - 1)
        : Math.min(Math.max(0, targetClip.active_variant_group_index ?? 0), groups.length - 1);
      const activeGrp = groups[activeGrpIdx];
      activeGrp.clips.push(...newlyAddedVariants);
      const newActiveIdx = activeGrp.clips.length - 1;
      activeGrp.active_clip_index = newActiveIdx;
      const lastAdded = newlyAddedVariants[newlyAddedVariants.length - 1];

      const updatedClip: VideoEditorClip = {
        ...targetClip,
        variants: activeGrp.clips,
        active_variant_index: newActiveIdx,
        variant_groups: groups,
        active_variant_group_index: activeGrpIdx,
        url: lastAdded.url,
        file_id: lastAdded.file_id,
        duration: lastAdded.duration,
        trim_start: 0,
        trim_end: lastAdded.duration,
      };

      const updated = [...activeClips];
      updated[clipIdx] = updatedClip;
      updateProjectClips?.(updated, true);
      showToast(`Added ${newlyAddedVariants.length} take${newlyAddedVariants.length === 1 ? '' : 's'} to Concept ${activeGrp.label || String.fromCharCode(65 + activeGrpIdx)}!`, 'success');
    } catch (err) {
      console.error('Error uploading variant clip:', err);
      showToast('Failed to upload variant clip', 'error');
    } finally {
      setUploadingVariantIdx(null);
      setUploadingVariantProgress(null);
    }
  };

  // Unused vault clips from project
  const vaultUnusedClips: VideoEditorClip[] = activeProject?.vault_unused_clips || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-950 overflow-hidden select-none">
      {/* 1. SECOND STRIP: IN-BETWEEN INSERTION OR SERIES STRIP */}
      <div className="px-3 py-2 bg-gray-950 border-b border-gray-800 flex items-center justify-between gap-2 shrink-0 z-20">
        {insertTargetClipIndex !== null && insertTargetClipIndex !== undefined ? (
          /* CONTEXTUAL 3-BOX INSERTION STRIP: [Clip A] -> [+] -> [Clip B] */
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
            {/* Box 1: Left clip (if insertTargetClipIndex > 0) */}
            {insertTargetClipIndex > 0 && activeClips[insertTargetClipIndex - 1] && (
              <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-mono font-bold">
                <span className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                  {insertTargetClipIndex}
                </span>
                <span className="text-[11px]">Clip #{insertTargetClipIndex}</span>
              </div>
            )}

            {/* Box 2: The PLUS Box (Center/Signifying the addition point) */}
            <div className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-mono font-black text-xs shadow-lg shadow-purple-950/80 ring-2 ring-purple-400 animate-pulse">
              <Plus size={14} className="stroke-[3]" />
              <span className="text-[11px] uppercase tracking-wide">Adding Here (#{insertTargetClipIndex + 1})</span>
            </div>

            {/* Box 3: Right clip (if insertTargetClipIndex < activeClips.length) */}
            {insertTargetClipIndex < activeClips.length && activeClips[insertTargetClipIndex] && (
              <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 text-xs font-mono font-bold">
                <span className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                  {insertTargetClipIndex + 1}
                </span>
                <span className="text-[11px]">Clip #{insertTargetClipIndex + 1}</span>
              </div>
            )}
          </div>
        ) : replaceTargetClipIndex !== null && replaceTargetClipIndex !== undefined ? (
          /* REPLACE STRIP: Showing target replacement slot */
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
            {replaceTargetClipIndex > 0 && activeClips[replaceTargetClipIndex - 1] && (
              <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 text-xs font-mono">
                <span>#{replaceTargetClipIndex}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 font-mono font-bold text-xs ring-1 ring-amber-400">
              <span>Replacing Clip #{replaceTargetClipIndex + 1}</span>
            </div>
            {replaceTargetClipIndex < activeClips.length - 1 && activeClips[replaceTargetClipIndex + 1] && (
              <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 text-xs font-mono">
                <span>#{replaceTargetClipIndex + 2}</span>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD FULL SERIES REORDER STRIP */
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
            {activeClips.map((clip, idx) => {
              const isSelected = selectedNavClipIdx === idx;

              return (
                <button
                  key={clip.id || idx}
                  id={`top-nav-clip-btn-${idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedNavClipIdx(idx);
                    onSelectClipIndex?.(idx);
                    isProgrammaticScrollRef.current = true;
                    const el = document.getElementById(`timeline-clip-node-${idx}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 500);
                  }}
                  className={`min-w-[34px] h-[34px] px-2 rounded-xl flex items-center justify-center font-mono font-black text-xs transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg ring-2 ring-purple-400 scale-105'
                      : 'bg-gray-900 hover:bg-gray-850 text-gray-300 border border-gray-800'
                  }`}
                  title={`Focus Clip #${idx + 1}`}
                >
                  <span>{idx + 1}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Top Right: Import Button & Counter Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isImportBrowserMode ? (
            <button
              type="button"
              onClick={() => {
                setImportTargetInfo(null);
                setShowImportModal?.(true);
              }}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 shrink-0"
              title="Import clips from other projects or master buckets"
            >
              <FolderInput size={12} className="stroke-[2.5]" />
              <span className="hidden sm:inline">Import</span>
            </button>
          ) : (
            <div className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9.5px] font-bold shrink-0">
              1:1 Source
            </div>
          )}

          <div className="px-2 py-1 rounded-lg bg-gray-900/90 border border-gray-800 text-[10.5px] font-mono text-purple-300 font-bold shrink-0">
            {activeClips.length} {activeClips.length === 1 ? 'Clip' : 'Clips'}
          </div>
        </div>
      </div>

      {/* 2. VERTICAL LIST OF CLIPS WITH 9:16 CARDS */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScrollSync}
        className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 space-y-5 no-scrollbar"
      >
        {activeClips.length === 0 ? (
          <div className="py-20 text-center text-gray-400 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
              <Film size={26} />
            </div>
            <p className="text-sm font-bold text-gray-200">No Video Clips on Timeline</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeClips.map((clip, idx) => {
              const isTarget = selectedNavClipIdx === idx;
              const clipGroups = getClipVariantGroups(clip);
              const activeGrpIdx = Math.min(
                Math.max(0, clip.active_variant_group_index ?? 0),
                Math.max(0, clipGroups.length - 1)
              );
              const totalTakesCount = clipGroups.reduce((acc, g) => acc + (g.clips?.length || 1), 0);
              const dur = clip.duration || 5;

              // Approved & reviewed AI takes for this clip position
              const relatedJobs = jobs.filter(j => 
                j.status === 'added' && 
                ((j.clipIndex ?? -1) === idx || (clip.id && j.clipId === clip.id))
              );

              return (
                <div
                  key={clip.id || idx}
                  id={`timeline-clip-node-${idx}`}
                  className="flex items-start gap-2 sm:gap-3 group/cliprow"
                >
                  {/* Left Rail Column: Step number & vertical connecting line */}
                  <div className="flex flex-col items-center shrink-0 w-6 sm:w-7 pt-2 select-none">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNavClipIdx(idx);
                        onSelectClipIndex?.(idx);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-[10.5px] transition-all cursor-pointer shadow-md ${
                        isTarget
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : 'bg-gray-900 border border-gray-700 text-gray-300'
                      }`}
                    >
                      {idx + 1}
                    </button>
                    {idx < activeClips.length - 1 && (
                      <div className="w-0.5 min-h-[140px] flex-1 my-1.5 bg-gradient-to-b from-purple-500/60 via-purple-500/20 to-gray-800/30 rounded-full" />
                    )}
                  </div>

                  {/* Main Clip Slot Container */}
                  <div className={`flex-1 min-w-0 p-2.5 sm:p-3 rounded-2xl border transition-all ${
                    isTarget
                      ? 'bg-gray-900/90 border-purple-500/60 shadow-xl'
                      : 'bg-gray-950/80 border-gray-800/80 hover:border-gray-700'
                  }`}>
                    {/* Position Level Header: Position #, Concept count, + Concepts, Delete Slot */}
                    <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-zinc-800/80 min-w-0">
                      {/* Left: Position & Concept logos */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-800/90 border border-zinc-700 text-white font-mono font-black text-xs shrink-0" title={`Position #${idx + 1}`}>
                          <Layers size={13} className="text-white" />
                          <span>#{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[10px] shrink-0" title={`${clipGroups.length} Concepts`}>
                          <Boxes size={12} className="text-zinc-400" />
                          <span>{clipGroups.length}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                          ({totalTakesCount})
                        </span>
                      </div>

                      {/* Right: + Concepts (import all concepts for row) & Delete All Concepts */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (isImportBrowserMode) {
                              handleTakeFullClipInternal(clip);
                            } else {
                              setImportTargetInfo({ clipIdx: idx });
                              setShowImportModal(true);
                            }
                          }}
                          className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white rounded-lg transition active:scale-95 flex items-center gap-1 text-[10.5px] font-bold cursor-pointer shrink-0"
                          title={isImportBrowserMode ? "Import all concepts for this position into active project" : "Import / Add concepts (A & B...) for this position"}
                        >
                          <Plus size={12} className="text-white stroke-[2.5]" />
                          <span>Concepts</span>
                        </button>

                        {!isImportBrowserMode && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAllConceptsIdx(idx)}
                            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-rose-600/60 text-zinc-300 hover:text-rose-400 rounded-lg transition active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
                            title={`Delete all concepts for position #${idx + 1}`}
                          >
                            <Trash2 size={13} className="text-zinc-300 hover:text-rose-400" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CONCEPTS - SINGLE CLEAN LAYER PER CONCEPT */}
                    <div className="space-y-3 mt-1.5">
                      {clipGroups.map((grp, gIdx) => {
                        const isGrpActive = gIdx === activeGrpIdx;
                        const grpLetter = grp.label || String.fromCharCode(65 + gIdx);
                        const grpClips: VideoEditorClip[] = grp.clips && grp.clips.length > 0 ? grp.clips : [clip];
                        const activeTakeInGroup = Math.min(
                          Math.max(0, grp.active_clip_index ?? (isGrpActive ? clip.active_variant_index ?? 0 : 0)),
                          Math.max(0, grpClips.length - 1)
                        );

                        return (
                          <div 
                            key={grp.id || `grp-${idx}-${gIdx}`}
                            className="space-y-1.5"
                          >
                            {/* Concept Header Bar - Star, Name, + Variant, Delete */}
                            <div className="flex items-center justify-between px-1.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                              {/* Left: Star button + Concept logo and name */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onSwitchVariantGroup) {
                                      onSwitchVariantGroup(idx, gIdx);
                                    } else if (onSwitchVariant) {
                                      onSwitchVariant(idx, activeTakeInGroup, gIdx);
                                    }
                                    showToast?.(`Concept ${grpLetter} is now active`, 'info');
                                  }}
                                  className="p-1 rounded-md hover:bg-zinc-800 transition cursor-pointer active:scale-90"
                                  title={isGrpActive ? `Concept ${grpLetter} is Active` : `Click star to make Concept ${grpLetter} Active`}
                                  aria-label={isGrpActive ? `Concept ${grpLetter} Active` : `Make Concept ${grpLetter} Active`}
                                >
                                  <Star 
                                    size={15} 
                                    className={isGrpActive ? "fill-amber-400 text-amber-400" : "text-zinc-500 hover:text-amber-400"} 
                                  />
                                </button>

                                <div className="flex items-center gap-1 font-mono font-bold text-xs text-white">
                                  <Boxes size={12} className="text-zinc-400" />
                                  <span>Concept {grpLetter}</span>
                                  <span className="text-[10px] text-zinc-400 font-normal">({grpClips.length})</span>
                                </div>
                              </div>

                              {/* Right: + Variant (take all clips from this variant) & Delete button */}
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTakeVariantGroupInternal(grp)}
                                  className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                                  title={`Take all clips from Concept ${grpLetter}`}
                                >
                                  <Plus size={11} className="stroke-[2.5]" />
                                  <span>Variant</span>
                                </button>

                                {!isImportBrowserMode && clipGroups.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteVariantGrp({ clipIdx: idx, grpIdx: gIdx, grpLabel: grpLetter })}
                                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                                    title={`Delete Concept ${grpLetter}`}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Hidden file input for this concept */}
                            <input
                              type="file"
                              accept="video/*"
                              multiple
                              id={`variant-upload-input-${idx}-${gIdx}`}
                              onChange={(e) => handleUploadClipAsVariant(idx, e, gIdx)}
                              className="hidden"
                            />

                            {/* Video Clips horizontal strip (compact preview: w-32 sm:w-36 aspect-[9/16]) */}
                            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                              {grpClips.map((v, cIdx) => {
                                const isThisActive = isGrpActive && activeTakeInGroup === cIdx;
                                const cDur = typeof v.duration === 'number' ? v.duration : dur;
                                const effFileId = v.file_id || v.id || clip.file_id || clip.id;
                                const vSrc = v.url || (effFileId ? `/api/video/${effFileId}` : '');
                                const cardId = `grp-${idx}-${gIdx}-${cIdx}`;
                                const takeLetter = getVariantLetter(cIdx);
                                const takeLabel = `Concept ${grpLetter} · Take #${idx + 1}${takeLetter}`;

                                return (
                                  <div
                                    key={v.id || cIdx}
                                    onClick={() => handleTogglePlayInline(cardId)}
                                    onTouchStart={(e) => startLongPress({ videoSrc: vSrc, duration: cDur, title: takeLabel }, e)}
                                    onTouchMove={moveLongPress}
                                    onTouchEnd={endLongPress}
                                    onTouchCancel={endLongPress}
                                    onMouseDown={(e) => startLongPress({ videoSrc: vSrc, duration: cDur, title: takeLabel }, e)}
                                    onMouseMove={moveLongPress}
                                    onMouseUp={endLongPress}
                                    className={`relative w-32 sm:w-36 shrink-0 aspect-[9/16] rounded-xl overflow-hidden bg-black transition-all shadow-md flex flex-col justify-between group/card select-none cursor-pointer border ${
                                      isThisActive
                                        ? 'border-amber-400 ring-1 ring-amber-400/50 scale-[1.01]'
                                        : 'border-zinc-800 hover:border-zinc-700 opacity-90 hover:opacity-100'
                                    }`}
                                  >
                                    <video
                                      ref={(el) => { videoRefs.current[cardId] = el; }}
                                      src={vSrc}
                                      playsInline
                                      preload="metadata"
                                      loop
                                      className="absolute inset-0 w-full h-full object-cover"
                                    />

                                    {/* Top: Star Button (to make active) + Badge + Delete Take */}
                                    <div className="relative z-10 p-1.5 flex items-center justify-between gap-1 bg-gradient-to-b from-black/85 via-black/35 to-transparent">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onSwitchVariant) {
                                            onSwitchVariant(idx, cIdx, gIdx);
                                            showToast(`Take #${idx + 1}${takeLetter} Active`, 'success');
                                          }
                                        }}
                                        className="p-1 rounded-md bg-black/60 hover:bg-black/90 transition cursor-pointer active:scale-90"
                                        title={isThisActive ? "Active Take" : "Click star to make Active"}
                                      >
                                        <Star 
                                          size={12} 
                                          className={isThisActive ? "fill-amber-400 text-amber-400" : "text-white/70 hover:text-amber-400"} 
                                        />
                                      </button>

                                      <span className="px-1.5 py-0.5 rounded bg-black/60 text-[8.5px] font-mono font-bold text-white pointer-events-none">
                                        {grpLetter}{takeLetter}
                                      </span>

                                      {!isImportBrowserMode && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteVariantInternal(idx, cIdx, gIdx);
                                          }}
                                          className="p-1 rounded-md bg-black/60 hover:bg-rose-900/80 text-zinc-300 hover:text-white transition active:scale-95 shadow cursor-pointer shrink-0"
                                          title={`Delete ${takeLabel}`}
                                        >
                                          <Trash2 size={11} className="text-zinc-300 hover:text-rose-400" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex-1" />

                                    {/* Bottom: Duration badge + "+ Take" button directly over the clip */}
                                    <div className="relative z-10 p-1.5 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between gap-1 pointer-events-auto">
                                      <span className="px-1.5 py-0.5 rounded bg-black/85 text-[8.5px] font-mono text-zinc-300 font-bold border border-zinc-700/40 pointer-events-none">
                                        {cDur.toFixed(1)}s
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTakeSingleClipInternal(v);
                                        }}
                                        className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-mono font-bold text-[9px] flex items-center gap-0.5 shadow-md transition active:scale-95 cursor-pointer"
                                        title="Take this single clip only"
                                      >
                                        <Plus size={9} className="stroke-[3]" />
                                        <span>Take</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Compact Add Take Card from gallery / file upload at the end of the strip */}
                              <div
                                onClick={() => setAddTakePrompt({ clipIdx: idx, grpIdx: gIdx, grpLabel: grpLetter })}
                                className="w-18 sm:w-20 aspect-[9/16] shrink-0 rounded-xl border border-dashed border-zinc-800 hover:border-zinc-600 bg-zinc-900/30 hover:bg-zinc-800/40 flex flex-col items-center justify-center gap-1 cursor-pointer text-zinc-400 hover:text-white transition active:scale-95 select-none"
                                title={`Add / Upload Take to Concept ${grpLetter}`}
                              >
                                <Plus size={16} className="text-zinc-400" />
                                <span className="text-[9.5px] font-bold">Add</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. UNUSED VARIANTS & SAVED TAKES VAULT AT BOTTOM (Persisted, never lost!) */}
        {vaultUnusedClips.length > 0 && (
          <div className="mt-8 pt-4 border-t border-gray-800/80 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                  Unused Variants & Saved Takes
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-400 text-[10px] font-mono font-bold border border-amber-500/30">
                  {vaultUnusedClips.length}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">Preserved here for future selection</p>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto pb-2 no-scrollbar">
              {vaultUnusedClips.map((uClip, uIdx) => {
                const uSrc = uClip.url || (uClip.file_id ? `/api/video/${uClip.file_id}` : '');
                const uDur = uClip.duration || 5;

                return (
                  <div
                    key={uClip.id || uIdx}
                    className="relative w-32 sm:w-36 shrink-0 aspect-[9/16] rounded-xl overflow-hidden bg-black border border-gray-800 flex flex-col justify-between select-none"
                  >
                    <video
                      src={uSrc}
                      playsInline
                      loop
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Top: Saved label & Delete */}
                    <div className="relative z-10 p-1.5 flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 text-[7px] font-mono text-amber-300">
                        Saved
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeProject) return;
                          activeProject.vault_unused_clips = vaultUnusedClips.filter((_, i) => i !== uIdx);
                          if (updateProjectClips) updateProjectClips([...activeClips], true);
                          showToast('Removed from saved vault.', 'info');
                        }}
                        className="w-5 h-5 rounded bg-black/80 hover:bg-rose-600 text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    <div className="flex-1" />

                    {/* Bottom: Duration & Use Button */}
                    <div className="relative z-10 p-1.5 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-1">
                      <span className="px-1.5 py-0.2 rounded bg-black/85 text-[8.5px] font-mono text-white font-bold self-start">
                        {uDur.toFixed(1)}s
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTakeSingleClipInternal(uClip)}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9px] flex items-center justify-center gap-1 active:scale-95 shadow cursor-pointer"
                      >
                        <Check size={9} className="stroke-[3]" />
                        <span>Use</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. LONG PRESS 9/16 POP-OUT PREVIEW OVERLAY */}
      <LongPressVideoPreviewOverlay
        preview={activePreview}
        onClose={closePreview}
      />

      {/* 5. ADD TAKE 3-SECTION CHOICE MODAL */}
      {addTakePrompt !== null && (() => {
        const promptClip = activeClips[addTakePrompt.clipIdx];
        const promptGroups = promptClip ? getClipVariantGroups(promptClip) : [];
        const otherTakesOnThisPosition: { label: string; clip: VideoEditorClip }[] = [];
        promptGroups.forEach((g, gI) => {
          const gLetter = g.label || String.fromCharCode(65 + gI);
          (g.clips || []).forEach((c, cI) => {
            if (gI !== addTakePrompt.grpIdx) {
              otherTakesOnThisPosition.push({
                label: `${gLetter}${getVariantLetter(cI)}`,
                clip: c
              });
            }
          });
        });

        return (
          <div 
            className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setAddTakePrompt(null)}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                    <Plus size={18} className="stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Add Take to Concept {addTakePrompt.grpLabel}</h3>
                    <p className="text-[11px] text-zinc-400">Position #{addTakePrompt.clipIdx + 1}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAddTakePrompt(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 3 Sections */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Section 1: Import from Other Variant / Project */}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const { clipIdx, grpIdx } = addTakePrompt;
                      setAddTakePrompt(null);
                      setImportTargetInfo({ clipIdx, grpIdx });
                      setShowImportModal(true);
                    }}
                    className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                      <FolderInput size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">Import from Other Variant / Project</div>
                      <div className="text-[10.5px] text-zinc-400 truncate">Choose clips from another project's 1:1 variant page</div>
                    </div>
                    <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
                  </button>

                  {/* Direct 1-Tap Chips for takes from other concepts on this same position strip */}
                  {otherTakesOnThisPosition.length > 0 && (
                    <div className="px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80 flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-zinc-400">Takes from other concepts on this strip:</span>
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {otherTakesOnThisPosition.map((ot, otIdx) => (
                          <button
                            key={otIdx}
                            type="button"
                            onClick={() => {
                              handleCloneTakeIntoConcept(addTakePrompt.clipIdx, addTakePrompt.grpIdx, ot.clip, ot.label);
                              setAddTakePrompt(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                            title={`Copy Take ${ot.label} into Concept ${addTakePrompt.grpLabel}`}
                          >
                            <Plus size={10} className="stroke-[3]" />
                            <span>Take {ot.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 2: Upload from Gallery / Device */}
                <button
                  type="button"
                  onClick={() => {
                    const { clipIdx, grpIdx } = addTakePrompt;
                    setAddTakePrompt(null);
                    document.getElementById(`variant-upload-input-${clipIdx}-${grpIdx}`)?.click();
                  }}
                  className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-indigo-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <UploadCloud size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition">Upload from Gallery</div>
                    <div className="text-[10.5px] text-zinc-400 truncate">Upload video files directly from device</div>
                  </div>
                  <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
                </button>

                {/* Section 3: Import from Upload Section */}
                <button
                  type="button"
                  onClick={() => {
                    const targetIdx = addTakePrompt.clipIdx;
                    setAddTakePrompt(null);
                    if (onOpenPickerForVariant) {
                      onOpenPickerForVariant(targetIdx);
                    }
                  }}
                  className="w-full p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/50 flex items-center gap-3 transition text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <Film size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white group-hover:text-purple-300 transition">Import from Upload Section</div>
                    <div className="text-[10.5px] text-zinc-400 truncate">Pick videos from upload folders and library</div>
                  </div>
                  <ChevronRight size={15} className="text-zinc-600 group-hover:text-zinc-300 transition shrink-0" />
                </button>
              </div>

              {/* Cancel */}
              <button
                type="button"
                onClick={() => setAddTakePrompt(null)}
                className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      })()}

      {/* 6. CONFIRMATION DIALOG: DELETE ALL CONCEPTS FOR POSITION */}
      {confirmDeleteAllConceptsIdx !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">Delete All Concepts?</h3>
                <p className="text-[11px] text-zinc-400">Position #{confirmDeleteAllConceptsIdx + 1}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 p-3 rounded-xl border border-zinc-850">
              Are you sure you want to delete all concepts at Position #{confirmDeleteAllConceptsIdx + 1}? This will remove this sequence slot from the timeline.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteAllConceptsIdx(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetIdx = confirmDeleteAllConceptsIdx;
                  setConfirmDeleteAllConceptsIdx(null);
                  handleDeleteEntireSlot(targetIdx);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition cursor-pointer shadow-md"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CONFIRMATION DIALOG: DELETE VARIANT GROUP / CONCEPT */}
      {confirmDeleteVariantGrp !== null && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white">Delete Concept {confirmDeleteVariantGrp.grpLabel}?</h3>
                <p className="text-[11px] text-zinc-400">Position #{confirmDeleteVariantGrp.clipIdx + 1}</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/80 p-3 rounded-xl border border-zinc-850">
              Are you sure you want to delete Concept {confirmDeleteVariantGrp.grpLabel} and all takes inside it?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteVariantGrp(null)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { clipIdx, grpIdx } = confirmDeleteVariantGrp;
                  setConfirmDeleteVariantGrp(null);
                  handleDeleteConceptGroupInternal(clipIdx, grpIdx);
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition cursor-pointer shadow-md"
              >
                Delete Concept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. IMPORT FROM OTHER PROJECT MODAL (1-ON-1 IDENTICAL VARIANT BROWSER) */}
      {!isImportBrowserMode && (
        <ImportProjectClipsModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportTargetInfo(null);
          }}
          db={db}
          activeProject={activeProject}
          activeClips={activeClips}
          updateProjectClips={updateProjectClips}
          insertTargetClipIndex={importTargetInfo ? importTargetInfo.clipIdx : insertTargetClipIndex}
          replaceTargetClipIndex={replaceTargetClipIndex}
          variantTargetClipIndex={importTargetInfo ? importTargetInfo.clipIdx : variantTargetClipIndex}
          targetGroupIdx={importTargetInfo?.grpIdx ?? targetGroupIdx}
          showToast={showToast}
          onTakeFullClip={handleTakeFullClipInternal}
          onTakeSingleClip={handleTakeSingleClipInternal}
          onTakeVariantGroup={handleTakeVariantGroupInternal}
        />
      )}
    </div>
  );
};
