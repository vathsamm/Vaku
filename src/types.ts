export const PRIMARY_MAIN_ADMIN = 'distinct4exist@gmail.com';
export const DEFAULT_ADMINS = ['distinct4exist@gmail.com'];

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  status?: 'active' | 'blocked' | string;
  isDefaultAdmin?: boolean;
  blocked?: boolean;
  profile_completed?: boolean;
  createdAt: number;
  lastLogin: number;
  telegramChatId?: string;
  cookies?: { name: string; content: string }[];
  nav_fid?: string;
  allowedKaggle?: boolean;
  kaggle_accounts?: KaggleAccountCredential[];
}

export interface KaggleAccountCredential {
  id: string;
  username: string;
  key: string;
  keyMasked?: string;
  enabled?: boolean;
  author?: string;
  addedAt?: number;
  lastTested?: number;
  status?: 'ready' | 'invalid' | 'untested';
  message?: string;
}

export interface FolderAccess {
  enabled: boolean;
  sharedWith?: string[];
}

export interface FolderData {
  name: string;
  parent: string | null;
  ownerId?: string;
  createdBy?: string;
  sharedSourceFid?: string;
  accessToggle?: boolean;
  sharedWith?: string[];
  sharedWithEdit?: string[];
  shareMode?: 'view_only' | 'collaborative' | 'duplicate_copy';
  isCollaborative?: boolean;
  isSystemShared?: boolean;
  isPinned?: boolean;
  isSharedContent?: boolean;
  sharedFrom?: string;
  readOnly?: boolean;
  created_at?: number;
  updated_at?: number;
  last_modified?: number;
  is_virtual_duplicate?: boolean;
  sync_with_source?: boolean;
  frozen_video_ids?: string[];
  creation_note?: string;
  created_date_str?: string;
  source_master_fid?: string;
  source_folder_id?: string;
  is_ai_bucket?: boolean;
  is_master_bucket?: boolean;
  is_master_project_folder?: boolean;
  is_container_folder?: boolean;
  is_uploads?: boolean;
  is_exported_folder?: boolean;
  is_export_bucket?: boolean;
  exported_mode?: 'general' | 'ai';
  brand_name?: string;
  brand_injection_enabled?: boolean;
}

export function computeNextProjectVersionName(
  folderName: string,
  existingProjects: { name?: string; master_bucket_fid?: string }[] = []
): { defaultName: string; nextVersion: number } {
  const cleanName = (folderName || 'Project').trim();
  let maxV = 0;

  const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRegex = new RegExp(`^${escaped}\\s*V(\\d+)$`, 'i');
  const genericVRegex = /\bV(\d+)\b/i;

  existingProjects.forEach(p => {
    const pName = (p.name || '').trim();
    const exactMatch = pName.match(exactRegex);
    if (exactMatch && exactMatch[1]) {
      const num = parseInt(exactMatch[1], 10);
      if (!isNaN(num) && num > maxV) maxV = num;
    } else {
      const genMatch = pName.match(genericVRegex);
      if (genMatch && genMatch[1]) {
        const num = parseInt(genMatch[1], 10);
        if (!isNaN(num) && num > maxV) maxV = num;
      }
    }
  });

  const nextVersion = maxV > 0 ? maxV + 1 : Math.max(1, existingProjects.length + 1);
  return {
    defaultName: `${cleanName} V${nextVersion}`,
    nextVersion
  };
}

export const isNormalBucket = (name?: string, f?: FolderData | null): boolean => {
  if (!name) return false;
  const n = name.trim();
  if (f?.is_ai_bucket) return false;
  return /^(B|Bucket)[-_\s]*\d+$/i.test(n);
};

export const isAiBucket = (name?: string, f?: FolderData | null): boolean => {
  if (!name) return false;
  const n = name.trim();
  if (Boolean(f?.is_ai_bucket)) return true;
  return /^(AI|AI[-_\s]*Bucket)[-_\s]*\d+$/i.test(n);
};

export const isAnyBucket = (name?: string, f?: FolderData | null): boolean => {
  return isNormalBucket(name, f) || isAiBucket(name, f);
};

export interface VideoData {
  id?: string;
  name?: string;
  folder_id: string;
  master_bucket_fid?: string;
  is_upload?: boolean;
  url: string;
  status: string;
  file_id: string | null;
  duration: number;
  error?: string;
  order?: number;
  size?: number;
  is_exported?: boolean;
  project_id?: string | null;
  project_name?: string;
  exported_at?: number;
  telegram_sent?: boolean;
  telegram_bot_sent?: boolean;
  telegram_file_id?: string;
  editor_mode?: 'general' | 'ai';
  source_video_id?: string;
  source_name?: string;
  is_new?: boolean;
  is_expanded?: boolean;
  expanded_duration?: number;
  audio_muted?: boolean;
  muted_file_id?: string;
  unmuted_file_id?: string;
  created_at?: number;
  generated_title?: string;
  generated_hashtags?: string;
  share_caption?: string;
  is_shared?: boolean;
  shared_platforms?: string[];
  last_shared_at?: number;
  updated_at?: number;
  last_modified?: number;
  ownerId?: string;
  createdBy?: string;
  isSharedContent?: boolean;
  isCollaborative?: boolean;
  sharedFrom?: string;
  readOnly?: boolean;
  is_ai_generated?: boolean;
  variation?: string;
  variation_label?: string;
  ai_prompt?: string;
  ai_model?: string;
  ai_duration?: number;
  ai_has_audio?: boolean;
  ai_source_vid?: string;
  recreate_source_vid?: string;
  is_original_duplicate?: boolean;
  ai_first_frame?: string;
  ai_last_frame?: string;
  ai_generated_images?: AiGeneratedImageRef[];
  ai_active_image_id?: string;
  ai_active_image_url?: string;
  is_nsfw?: boolean;
  failure_reason?: string;
  is_starred?: boolean;
  is_default?: boolean;
  is_frozen?: boolean;
  is_hidden?: boolean;
  hidden_at?: number;
  hidden_by?: string;
  last_used_at?: number;
  usage_count?: number;
  is_export_video?: boolean;
}

export interface ClipVariantGroup {
  id: string;
  label: string;
  clips: VideoEditorClip[];
  active_clip_index: number;
}

export interface VideoEditorClip {
  id: string;
  vid: string;
  url: string;
  file_id: string | null;
  bucket_id: string;
  bucket_name: string;
  duration: number;
  speed: number;
  scale?: number;
  trim_start?: number;
  trim_end?: number;
  orig_duration?: number;
  is_cut?: boolean;
  is_muted?: boolean;
  volume?: number;
  is_starred?: boolean;
  is_default?: boolean;
  is_frozen?: boolean;
  last_used_at?: number;
  variants?: VideoEditorClip[];
  active_variant_index?: number;
  variant_groups?: ClipVariantGroup[];
  active_variant_group_index?: number;
  created_at?: number;
  source_job_id?: string;
  source_prompt?: string;
}

export function getClipVariantGroups(clip?: VideoEditorClip | null): ClipVariantGroup[] {
  if (!clip) return [];
  if (clip.variant_groups && clip.variant_groups.length > 0) {
    return clip.variant_groups.map((g, idx) => {
      const clipsList = (g.clips && g.clips.length > 0)
        ? g.clips
        : [{ ...clip, variants: undefined, variant_groups: undefined }];
      return {
        ...g,
        label: g.label || String.fromCharCode(65 + idx),
        clips: clipsList,
        active_clip_index: Math.min(Math.max(0, g.active_clip_index ?? 0), Math.max(0, clipsList.length - 1))
      };
    });
  }
  const baseClips: VideoEditorClip[] = (clip.variants && clip.variants.length > 0)
    ? clip.variants
    : [{ ...clip, id: clip.id || `take_orig_${Date.now()}`, variants: undefined, variant_groups: undefined }];
  const activeClipIdx = Math.min(Math.max(0, clip.active_variant_index ?? 0), baseClips.length - 1);
  return [
    {
      id: `vg_A_${clip.id || '0'}`,
      label: 'A',
      clips: baseClips,
      active_clip_index: activeClipIdx
    }
  ];
}

export interface HiggsfieldConfig {
  connected: boolean;
  account_name?: string;
  account_email?: string;
  credits: number;
  tier?: string;
  api_token?: string;
  connected_at?: number;
  model_default?: string;
  tokenExpired?: boolean;
  lastAuthError?: string;
}

export interface HiggsfieldJob {
  id: string;
  projectId: string;
  clipId: string;
  clipIndex?: number;
  originalClipUrl: string;
  prompt: string;
  model: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'trashed' | 'added';
  progress: number;
  statusText?: string;
  video_url?: string;
  file_id?: string;
  duration?: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface VideoEditorTitleTemplate {
  id: string;
  name: string;
  prompt: string;
  is_active?: boolean;
  last_generated_title?: string;
  last_generated_hashtags?: string;
  created_at?: number;
  updated_at?: number;
}

export interface VideoEditorAudioClip {
  id: string;
  audio_id?: string;
  name: string;
  url: string;
  file_id?: string;
  duration: number;
  start_time?: number;
  trim_start?: number;
  trim_end?: number;
  volume?: number;
  speed?: number;
  is_muted?: boolean;
  track_layer?: number;
}

export interface VideoEditorProject {
  id: string;
  name: string;
  master_bucket_fid: string;
  mode: 'general' | 'ai';
  created_by?: string;
  createdBy?: string;
  ownerId?: string;
  clips: VideoEditorClip[];
  created_at: number;
  updated_at: number;
  last_modified?: number;
  is_pinned?: boolean;
  sharedWith?: string[];
  sharedWithEdit?: string[];
  captions?: VideoEditorCaption[];
  caption_templates?: VideoEditorCaptionTemplate[];
  hidden_caption_ids?: string[];
  title_templates?: VideoEditorTitleTemplate[];
  active_title_template_id?: string;
  starred_audio_ids?: string[];
  hidden_audio_ids?: string[];
  audio_modes?: Record<string, 'all' | 'change'>;
  audio_id?: string;
  audio_url?: string;
  audio_name?: string;
  audio_volume?: number;
  audio_duration?: number;
  audio_clips?: VideoEditorAudioClip[];
  favorite_audio_folder_id?: string | null;
  generated_title?: string;
  generated_hashtags?: string;
  share_caption?: string;
  project_frozen_vids?: string[];
  project_starred_vids?: string[];
  project_default_vids?: Record<string, string>;
  bucket_order?: string[];
  frozen_bucket_ids?: string[];
  vault_unused_clips?: VideoEditorClip[];
  cloud_synced?: boolean;
  cloud_synced_at?: number;
}

export interface AudioItem {
  id: string;
  name: string;
  url: string;
  file_id: string;
  duration?: number;
  folder_id?: string;
  created_at: number;
  is_starred?: boolean;
  is_default?: boolean;
  mode?: 'all' | 'change';
  ownerId?: string;
  sharedWith?: string[];
}

export interface AudioFolder {
  id: string;
  name: string;
  parent?: string | null;
  created_at: number;
  ownerId?: string;
  sharedWith?: string[];
  is_bucket_starred_folder?: boolean;
  master_bucket_fid?: string;
}

export interface VideoEditorCaption {
  id: string;
  text: string;
  is_bold?: boolean;
  font_size: number;
  box_width_pct?: number;
  font_family?: string;
  color?: string;
  stroke_color?: string;
  x_pct: number;
  y_pct: number;
  clip_rule: 'all' | 'start' | 'end' | 'until_next' | 'custom' | 'until_last_2';
  clip_count?: number;
  clip_indices?: number[];
  template_id?: string;
  track_layer?: number;
  start_time?: number;
  end_time?: number;
}

export interface VideoEditorCaptionTemplate {
  id: string;
  name: string;
  text: string;
  mode?: 'all' | 'change' | 'must';
  is_must?: boolean;
  is_bold?: boolean;
  font_size: number;
  box_width_pct?: number;
  font_family?: string;
  color?: string;
  stroke_color?: string;
  x_pct: number;
  y_pct: number;
  clip_rule: 'all' | 'start' | 'end' | 'until_next' | 'custom' | 'until_last_2';
  clip_count?: number;
  clip_indices?: number[];
  created_at: number;
  updated_at?: number;
  for_all_videos?: boolean;
  is_starred?: boolean;
  is_default?: boolean;
}

export interface VideoEditorCaptionDefault {
  x_pct: number;
  y_pct: number;
  font_size: number;
  box_width_pct?: number;
  font_family?: string;
  color?: string;
  stroke_color?: string;
  is_bold?: boolean;
  clip_rule?: 'all' | 'start' | 'end' | 'until_next' | 'custom' | 'until_last_2';
  clip_count?: number;
}

export interface AiGeneratedImageRef {
  id: string;
  imageUrl: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  mergedDualUrl?: string;
  prompt?: string;
  isDual?: boolean;
  aspectRatio?: string;
  model?: string;
  keepProductExact?: boolean;
  changeBackground?: boolean;
  changeCharacter?: boolean;
  createdAt: number;
}

export interface MasterPromptItem {
  id: string;
  name?: string;
  text: string;
  created_at?: number;
}

export interface MasterVideoAnalysis {
  masterKey: string;
  theme: string;
  characterDna: string;
  productDna: string;
  nicheAesthetic: string;
  cameraTechnical: string;
  summary: string;
  analyzedAt: number;
}

export interface DB {
  users: Record<string, UserAccount>;
  admins?: string[];
  blocked_users?: Record<string, { email: string; name?: string; blockedAt: number }>;
  folders: Record<string, FolderData>;
  videos: Record<string, VideoData>;
  deleted_folders?: Record<string, number>;
  deleted_videos?: Record<string, number>;
  deleted_users?: Record<string, number>;
  history_undo?: any[];
  history_redo?: any[];
  config?: any;
  ai_mode?: boolean;
  ai_clip_analyses?: Record<string, any>;
  ai_master_video_analyses?: Record<string, MasterVideoAnalysis>;
  ai_slot_generated_images?: Record<string, AiGeneratedImageRef[]>;
  ai_prompt_injections?: Record<string, any>;
  master_prompts?: MasterPromptItem[];
  folder_master_prompts?: Record<string, MasterPromptItem[]>;
  bucket_master_prompts?: Record<string, MasterPromptItem[]>;
  folder_caption_templates?: Record<string, VideoEditorCaptionTemplate[]>;
  folder_caption_defaults?: Record<string, VideoEditorCaptionDefault>;
  folder_title_templates?: Record<string, VideoEditorTitleTemplate[]>;
  audios?: Record<string, AudioItem>;
  audio_folders?: Record<string, AudioFolder>;
  folder_audio_settings?: Record<string, {
    default_audio_id?: string;
    starred_audio_ids?: string[];
    audio_modes?: Record<string, 'all' | 'change'>;
    hidden_audio_ids?: string[];
  }>;
  master_bucket_settings?: Record<string, {
    bucket_order?: string[];
    frozen_bucket_ids?: string[];
    updated_at?: number;
  }>;
  pinned_msg_id?: number | null;
  worker_heartbeat?: number | null;
  video_editor_projects?: Record<string, VideoEditorProject>;
  kaggle_jobs?: Record<string, any>;
  kaggle_user_accounts?: Record<string, KaggleAccountCredential[]>;
  allowed_kaggle_users?: string[];
  higgsfield_jobs?: Record<string, HiggsfieldJob>;
  trash?: Record<string, any>;
  version?: number;
  last_modified?: number;
  last_backup?: number;
}

export interface JobFailedUrl {
  url: string;
  reason?: string;
  error?: string;
}

export interface JobLogItem {
  timestamp: number;
  timeStr?: string;
  text: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export interface Job {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | string;
  progress: string;
  percent?: number;
  currentClip?: number;
  totalClips?: number;
  currentClipName?: string;
  stage?: string;
  stepName?: string;
  phase?: 'downloading' | 'splitting' | 'uploading' | 'completed' | 'failed';
  phaseStep?: number;
  phaseTotal?: number;
  downloadSpeed?: string;
  downloadEta?: string;
  uploadedCount?: number;
  totalToUpload?: number;
  uploadPercent?: number;
  logs?: JobLogItem[];
  createdAt?: number;
  updatedAt?: number;
  user_email?: string;
  userId?: string;
  error?: string;
  isTimedOut?: boolean;
  currentUrl?: string;
  completedUrls?: Array<any>;
  failedUrls?: JobFailedUrl[];
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'admin' | 'user';
    isDefaultAdmin: boolean;
    telegramChatId?: string;
  } | null;
  allAdmins?: string[];
}
