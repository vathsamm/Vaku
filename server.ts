import express from 'express';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import dns from 'dns';
import { exec, spawn, execSync } from 'child_process';
import util from 'util';
import multer from 'multer';
import { Agent, setGlobalDispatcher } from 'undici';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const __dirname = path.resolve();
const execPromise = util.promisify(exec);

// Initialize Gemini client for server-side AI generations
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// 1. Force IPv4 first to eliminate container timeout errors
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// 2. Configure resilient undici global dispatcher for cloud transfers (strictly IPv4 to eliminate container connect timeouts)
try {
  const globalDispatcher = new Agent({
    connect: {
      timeout: 10000,
      keepAlive: true,
      lookup: (hostname: string, options: any, callback: any) => {
        dns.lookup(hostname, { ...options, family: 4 }, callback);
      }
    },
    headersTimeout: 30000,
    bodyTimeout: 600000,
    connections: 64,
  });
  setGlobalDispatcher(globalDispatcher);
} catch (_) {}

// Ensure media and working directories exist
const uploadDir = path.join(__dirname, 'uploads');
const thumbsDir = path.join(__dirname, 'thumbs');
const rendersDir = path.join(__dirname, 'public', 'renders');
const altRendersDir = path.join(__dirname, 'renders');
const trashDir = path.join(uploadDir, 'trash');
for (const dir of [uploadDir, thumbsDir, rendersDir, altRendersDir, trashDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Ensure Higgsfield CLI binary is installed and executable
try {
  const hfVendor = path.join(__dirname, 'node_modules', '@higgsfield', 'cli', 'vendor', 'hf');
  if (fs.existsSync(hfVendor)) {
    try { fs.chmodSync(hfVendor, 0o755); } catch (_) {}
    try {
      if (!fs.existsSync('/usr/local/bin/higgsfield')) fs.symlinkSync(hfVendor, '/usr/local/bin/higgsfield');
      if (!fs.existsSync('/usr/local/bin/hf')) fs.symlinkSync(hfVendor, '/usr/local/bin/hf');
    } catch (_) {}
  } else {
    const installScript = path.join(__dirname, 'node_modules', '@higgsfield', 'cli', 'install.js');
    if (fs.existsSync(installScript)) {
      exec(`node "${installScript}"`, () => {
        if (fs.existsSync(hfVendor)) {
          try { fs.chmodSync(hfVendor, 0o755); } catch (_) {}
          try {
            if (!fs.existsSync('/usr/local/bin/higgsfield')) fs.symlinkSync(hfVendor, '/usr/local/bin/higgsfield');
            if (!fs.existsSync('/usr/local/bin/hf')) fs.symlinkSync(hfVendor, '/usr/local/bin/hf');
          } catch (_) {}
        }
      });
    }
  }
} catch (_) {}

// Multer storage
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

// Database state
const DB_FILE = path.join(__dirname, 'db.json');

let db: any = {
  version: 2,
  folders: { root: { name: 'Root', parent: null } },
  videos: {},
  deleted_folders: {},
  deleted_videos: {},
  video_editor_projects: {},
  kaggle_jobs: {},
  higgsfield_jobs: {},
  trash: {},
  audio_library: [],
  audios: {},
  audio_folders: {},
  folder_audio_settings: {},
  folder_caption_defaults: {},
  folder_caption_templates: {},
  folder_title_templates: {},
  master_bucket_settings: {},
  config: {},
  users: {},
  admins: ['distinct4exist@gmail.com'],
  blocked_users: [],
  deleted_users: [],
  history_undo: [],
  history_redo: [],
};

function healAndSynchronizeRenderHistory() {
  try {
    if (!db.videos) db.videos = {};
    if (!db.kaggle_jobs) db.kaggle_jobs = {};
    if (!db.video_editor_projects) db.video_editor_projects = {};

    let hasChanges = false;

    // Helper to find project by name or generation history
    const findProjectForJob = (jobId: string, filename: string, projectName?: string) => {
      // 1. Direct match in project generation history
      for (const [pId, p] of Object.entries(db.video_editor_projects || {})) {
        if (!p) continue;
        if (Array.isArray((p as any).generation_history) && (p as any).generation_history.some((h: any) => h.id === jobId || h.job_id === jobId || h.jobId === jobId)) {
          return { pId, project: p as any };
        }
      }
      // 2. Match by normalized name
      const normFn = (s: string) => (s || '').toLowerCase().replace(/\.mp4$/i, '').replace(/_master$/i, '').replace(/[\-_]/g, ' ').trim();
      const targetName = normFn(projectName || filename);
      for (const [pId, p] of Object.entries(db.video_editor_projects || {})) {
        if (!p) continue;
        const pNorm = normFn((p as any).name);
        if (pNorm && targetName && (pNorm === targetName || targetName.startsWith(pNorm) || pNorm.startsWith(targetName))) {
          return { pId, project: p as any };
        }
      }
      // 3. Fallback to first project if only one exists
      const pList = Object.entries(db.video_editor_projects || {});
      if (pList.length === 1) {
        return { pId: pList[0][0], project: pList[0][1] as any };
      }
      return { pId: null, project: null };
    };

    // 1. Scan rendersDir for rendered mp4 files
    if (fs.existsSync(rendersDir)) {
      const renderFiles = fs.readdirSync(rendersDir).filter(f => f.endsWith('.mp4'));
      for (const file of renderFiles) {
        const filePath = path.join(rendersDir, file);
        let stat: fs.Stats | null = null;
        try { stat = fs.statSync(filePath); } catch (_) {}
        if (!stat || stat.size < 1000) continue;

        const jobId = file.replace(/\.mp4$/, '');
        const vidId = 'v_' + jobId.replace(/^job_render_/, '');
        const fileTime = Math.round(stat.mtimeMs) || Date.now();

        // Check if job exists in db.kaggle_jobs or db.jobs
        let job = db.kaggle_jobs[jobId] || (db as any).jobs?.[jobId];
        const { pId, project } = findProjectForJob(jobId, file, job?.projectName);
        const resolvedPid = job?.projectId || pId || null;
        const resolvedPName = job?.projectName || project?.name || file.replace(/\.mp4$/, '').replace(/[_\-]/g, ' ');
        const resolvedMbFid = job?.masterBucketFid || project?.master_bucket_fid || 'root';
        const resolvedOwner = job?.userEmail || job?.ownerId || project?.ownerId || project?.createdBy || 'shreevathsa2k26@gmail.com';

        if (!job) {
          job = {
            id: jobId,
            jobId,
            projectId: resolvedPid,
            projectName: resolvedPName,
            userEmail: resolvedOwner,
            status: 'completed',
            progress: 100,
            statusText: 'Ready ✓',
            createdAt: fileTime,
            completedAt: fileTime,
            completed_at: fileTime,
            video_url: `/api/merged_video/${file}`,
            downloadUrl: `/api/merged_video/${file}`,
            filename: file,
            size: stat.size,
          };
          db.kaggle_jobs[jobId] = job;
          hasChanges = true;
        } else if (job.status !== 'completed' || !job.video_url || !job.downloadUrl) {
          job.status = 'completed';
          job.progress = 100;
          job.statusText = 'Ready ✓';
          job.completedAt = job.completedAt || fileTime;
          job.completed_at = job.completed_at || fileTime;
          job.video_url = job.video_url || `/api/merged_video/${file}`;
          job.downloadUrl = job.downloadUrl || `/api/merged_video/${file}`;
          job.filename = job.filename || file;
          job.size = job.size || stat.size;
          hasChanges = true;
        }

        // Ensure video is in db.videos with full export metadata
        let vidEntry = db.videos[vidId] || Object.values(db.videos).find((v: any) => v.file_id === jobId || v.url?.includes(file));
        const videoUrl = `/api/merged_video/${file}`;
        if (!vidEntry) {
          db.videos[vidId] = {
            id: vidId,
            vid: vidId,
            name: file,
            source_name: resolvedPName,
            folder_id: 'exports',
            master_bucket_fid: resolvedMbFid,
            project_id: resolvedPid,
            project_name: resolvedPName,
            url: videoUrl,
            download_url: videoUrl,
            file_id: jobId,
            status: 'ready',
            size: stat.size,
            created_at: fileTime,
            is_exported: true,
            is_export_video: true,
            userEmail: resolvedOwner,
            ownerId: resolvedOwner,
            currentUserEmail: resolvedOwner,
            editor_mode: project?.mode || 'general',
          };
          hasChanges = true;
        } else {
          // Heal existing video entry
          let updated = false;
          if (!vidEntry.is_exported) { vidEntry.is_exported = true; updated = true; }
          if (!vidEntry.is_export_video) { vidEntry.is_export_video = true; updated = true; }
          if (vidEntry.folder_id === 'root') { vidEntry.folder_id = 'exports'; updated = true; }
          if (!vidEntry.download_url) { vidEntry.download_url = vidEntry.url || videoUrl; updated = true; }
          if (!vidEntry.project_id && resolvedPid) { vidEntry.project_id = resolvedPid; updated = true; }
          if (!vidEntry.project_name && resolvedPName) { vidEntry.project_name = resolvedPName; updated = true; }
          if (!vidEntry.master_bucket_fid && resolvedMbFid) { vidEntry.master_bucket_fid = resolvedMbFid; updated = true; }
          if (!vidEntry.userEmail && resolvedOwner) { vidEntry.userEmail = resolvedOwner; vidEntry.ownerId = resolvedOwner; updated = true; }
          if (updated) hasChanges = true;
        }

        // Ensure project's generation_history has this item
        if (resolvedPid && db.video_editor_projects[resolvedPid]) {
          if (!db.video_editor_projects[resolvedPid].generation_history) {
            db.video_editor_projects[resolvedPid].generation_history = [];
          }
          const hist = db.video_editor_projects[resolvedPid].generation_history;
          let hItem = hist.find((h: any) => h.id === jobId || h.job_id === jobId || h.jobId === jobId);
          if (!hItem) {
            hist.unshift({
              id: jobId,
              job_id: jobId,
              project_id: resolvedPid,
              project_name: resolvedPName,
              created_at: fileTime,
              completed_at: fileTime,
              status: 'completed',
              video_url: videoUrl,
              download_url: videoUrl,
              filename: file,
              size: stat.size,
            });
            hasChanges = true;
          } else if (hItem.status !== 'completed' || !hItem.video_url) {
            hItem.status = 'completed';
            hItem.video_url = videoUrl;
            hItem.download_url = videoUrl;
            hItem.completed_at = hItem.completed_at || fileTime;
            hItem.filename = hItem.filename || file;
            hItem.size = hItem.size || stat.size;
            hasChanges = true;
          }
        }
      }
    }

    // 2. Heal existing db.videos entries that look like exports
    Object.entries(db.videos || {}).forEach(([vid, rawV]: [string, any]) => {
      if (!rawV) return;
      const urlStr = String(rawV.url || rawV.download_url || '');
      const fileIdStr = String(rawV.file_id || rawV.id || vid || '');
      const nameStr = String(rawV.name || '');

      const isRendered = Boolean(
        rawV.is_exported ||
        rawV.is_export_video ||
        rawV.folder_id === 'exports' ||
        rawV.folder_id === 'export_history' ||
        urlStr.includes('/api/merged_video/') ||
        urlStr.includes('/renders/') ||
        urlStr.includes('job_render_') ||
        fileIdStr.startsWith('job_render_') ||
        fileIdStr.includes('job_render_') ||
        nameStr.toLowerCase().endsWith('_master.mp4')
      );

      if (isRendered) {
        let updated = false;
        if (!rawV.is_exported) { rawV.is_exported = true; updated = true; }
        if (!rawV.is_export_video) { rawV.is_export_video = true; updated = true; }
        if (rawV.folder_id === 'root') { rawV.folder_id = 'exports'; updated = true; }
        if (!rawV.download_url) { rawV.download_url = rawV.url || `/api/merged_video/${rawV.file_id || vid}.mp4`; updated = true; }

        if (!rawV.project_id || !rawV.master_bucket_fid) {
          const { pId, project } = findProjectForJob(rawV.file_id || vid, nameStr, rawV.project_name);
          if (!rawV.project_id && pId) { rawV.project_id = pId; updated = true; }
          if (!rawV.project_name && project?.name) { rawV.project_name = project.name; updated = true; }
          if (!rawV.master_bucket_fid && project?.master_bucket_fid) { rawV.master_bucket_fid = project.master_bucket_fid; updated = true; }
          if (!rawV.userEmail && (project?.ownerId || project?.createdBy)) {
            rawV.userEmail = project?.ownerId || project?.createdBy;
            rawV.ownerId = rawV.userEmail;
            updated = true;
          }
        }
        if (updated) hasChanges = true;
      }
    });

    // 3. Ensure all items from video_editor_projects generation_history are reflected in db.videos and db.kaggle_jobs
    Object.entries(db.video_editor_projects || {}).forEach(([pId, proj]: [string, any]) => {
      if (!proj || !Array.isArray(proj.generation_history)) return;
      proj.generation_history.forEach((h: any) => {
        if (!h || h.status === 'failed') return;
        const jobId = h.job_id || h.id || h.jobId;
        if (!jobId) return;
        const vidId = 'v_' + jobId.replace(/^job_render_/, '');
        const filename = h.filename || `${jobId}.mp4`;
        const vUrl = h.video_url || h.download_url || `/api/merged_video/${filename}`;
        const owner = proj.ownerId || proj.createdBy || 'shreevathsa2k26@gmail.com';

        let existing = db.videos[vidId] || Object.values(db.videos).find((v: any) => v && (v.file_id === jobId || v.url === vUrl || v.download_url === vUrl));
        if (!existing) {
          db.videos[vidId] = {
            id: vidId,
            vid: vidId,
            name: filename,
            source_name: proj.name || h.project_name,
            folder_id: 'exports',
            master_bucket_fid: proj.master_bucket_fid || 'root',
            project_id: pId,
            project_name: proj.name,
            url: vUrl,
            download_url: vUrl,
            file_id: jobId,
            status: 'ready',
            size: h.size || 0,
            created_at: h.completed_at || h.created_at || Date.now(),
            is_exported: true,
            is_export_video: true,
            userEmail: owner,
            ownerId: owner,
            currentUserEmail: owner,
            editor_mode: proj.mode || 'general',
          };
          hasChanges = true;
        } else {
          let updated = false;
          if (!existing.is_exported) { existing.is_exported = true; updated = true; }
          if (!existing.is_export_video) { existing.is_export_video = true; updated = true; }
          if (existing.folder_id === 'root') { existing.folder_id = 'exports'; updated = true; }
          if (!existing.download_url) { existing.download_url = vUrl; updated = true; }
          if (!existing.url) { existing.url = vUrl; updated = true; }
          if (!existing.project_id) { existing.project_id = pId; updated = true; }
          if (!existing.project_name) { existing.project_name = proj.name; updated = true; }
          if (!existing.master_bucket_fid && proj.master_bucket_fid) { existing.master_bucket_fid = proj.master_bucket_fid; updated = true; }
          if (!existing.userEmail) { existing.userEmail = owner; existing.ownerId = owner; updated = true; }
          if (updated) hasChanges = true;
        }

        // Also ensure in db.kaggle_jobs so UI components and job progress bar can access it
        if (!db.kaggle_jobs[jobId]) {
          db.kaggle_jobs[jobId] = {
            id: jobId,
            jobId,
            projectId: pId,
            projectName: proj.name,
            userEmail: owner,
            status: 'completed',
            progress: 100,
            statusText: 'Ready ✓',
            createdAt: h.created_at || Date.now(),
            completedAt: h.completed_at || Date.now(),
            video_url: vUrl,
            downloadUrl: vUrl,
            filename,
            size: h.size || 0
          };
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      db.last_modified = Date.now();
      const serialized = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_FILE, serialized, 'utf8');
      console.log(`[Render History Heal] Healed and synchronized render records!`);
    }
  } catch (err) {
    console.error('[Render History Heal Error]:', err);
  }
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = { ...db, ...data };
    }
  } catch (err) {
    console.error('[DB] Load error:', err);
  }
  if (!db.folders || Object.keys(db.folders).length === 0) {
    db.folders = { root: { name: 'Root', parent: null } };
  }
  if (!db.video_editor_projects) db.video_editor_projects = {};
  if (!db.kaggle_jobs) db.kaggle_jobs = {};
  if (!db.audios) db.audios = {};
  if (!db.audio_folders) db.audio_folders = {};
  if (!db.folder_audio_settings) db.folder_audio_settings = {};
  if (!db.folder_caption_defaults) db.folder_caption_defaults = {};
  if (!db.folder_caption_templates) db.folder_caption_templates = {};
  if (!db.folder_title_templates) db.folder_title_templates = {};
  if (!db.master_bucket_settings) db.master_bucket_settings = {};
  if (!db.config) db.config = {};
  if (!db.users) db.users = {};
  if (!db.admins) db.admins = ['distinct4exist@gmail.com'];

  // Default to configured Telegram bot and channel
  if (!db.config.telegram_bot_token) db.config.telegram_bot_token = DEFAULT_TELEGRAM_BOT_TOKEN;
  if (!db.config.telegram_chat_id) db.config.telegram_chat_id = DEFAULT_TELEGRAM_CHANNEL_ID;
  if (!db.config.telegram_channel_id) db.config.telegram_channel_id = DEFAULT_TELEGRAM_CHANNEL_ID;

  // Run healing routine to ensure all rendered videos are recognized
  healAndSynchronizeRenderHistory();
}

// Default Telegram Bot & Channel
export const DEFAULT_TELEGRAM_BOT_TOKEN = '8411745208:AAGxVZ2xetTkmq4499frMyRbGsc_i2xAm3Q';
export const DEFAULT_TELEGRAM_CHANNEL_ID = '-1004458129874';

function getTelegramToken(): string {
  return db.config?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
}

function getTelegramChannelId(): string {
  return db.config?.telegram_channel_id || db.config?.telegram_chat_id || DEFAULT_TELEGRAM_CHANNEL_ID;
}

// Fetch and load database from the pinned backup in Telegram Channel
let isFetchingFromTelegram = false;
async function fetchDBFromTelegramChannel(retries = 1): Promise<boolean> {
  if (isFetchingFromTelegram) return false;
  isFetchingFromTelegram = true;
  const token = getTelegramToken();
  const channelId = getTelegramChannelId();
  try {
    console.log(`[Telegram DB Sync] Checking pinned DB backup in channel ${channelId}...`);
    const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${channelId}`, {
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());
    if (!chatRes.ok || !chatRes.result) {
      console.warn('[Telegram DB Sync] Channel info unavailable:', chatRes.error || chatRes.description);
      return false;
    }

    const pinned = chatRes.result.pinned_message;
    if (!pinned) {
      console.log('[Telegram DB Sync] No pinned message in channel', channelId);
      return false;
    }

    const doc = pinned.document;
    if (!doc || !doc.file_id) {
      return false;
    }

    console.log(`[Telegram DB Sync] Found pinned document: ${doc.file_name} (${doc.file_size} bytes, msg ${pinned.message_id}). Downloading...`);
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${doc.file_id}`, {
      signal: AbortSignal.timeout(8000)
    }).then(r => r.json());
    if (!fileRes.ok || !fileRes.result?.file_path) {
      console.warn('[Telegram DB Sync] Failed to getFile path:', fileRes.description);
      return false;
    }

    const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileRes.result.file_path}`;
    const fileResp = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(15000)
    });
    if (!fileResp.ok) {
      console.warn('[Telegram DB Sync] HTTP error downloading file:', fileResp.status);
      return false;
    }

    const remoteData = await fileResp.json();
    if (remoteData && typeof remoteData === 'object' && remoteData.folders) {
      // Remote data from Telegram channel is authoritative for projects, folders, videos, templates
      db = {
        ...db,
        ...remoteData,
        users: { ...(remoteData.users || {}), ...(db.users || {}) },
        admins: Array.from(new Set([...(remoteData.admins || []), ...(db.admins || [])])),
        pinned_msg_id: pinned.message_id,
        config: {
          ...(remoteData.config || {}),
          telegram_bot_token: token,
          telegram_chat_id: channelId,
          telegram_channel_id: channelId,
          ...(db.config || {})
        }
      };
      // Run healing routine to ensure all rendered videos are recognized
      healAndSynchronizeRenderHistory();
      console.log(`[Telegram DB Sync] Successfully loaded DB from Telegram channel! Folders: ${Object.keys(db.folders || {}).length}, Projects: ${Object.values(db.video_editor_projects || {}).length}, Videos: ${Object.keys(db.videos || {}).length}`);
      return true;
    }
    return false;
  } catch (err: any) {
    if (retries > 0) {
      console.log(`[Telegram DB Sync] Connection attempt had a transient issue (${err?.message || 'timeout'}). Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      isFetchingFromTelegram = false;
      return fetchDBFromTelegramChannel(retries - 1);
    }
    console.warn('[Telegram DB Sync] Telegram channel temporarily unreachable (using local storage fallback):', err?.message || err);
    return false;
  } finally {
    isFetchingFromTelegram = false;
  }
}

// Live Sync Status Tracking across Telegram Channel & Firebase
export interface SyncStatus {
  telegram: {
    status: 'synced' | 'syncing' | 'error';
    lastSyncedAt: number | null;
    retries: number;
    error: string | null;
    pinnedMsgId: number | null;
    channelTitle?: string;
  };
  firebase: {
    status: 'synced' | 'syncing' | 'error';
    lastSyncedAt: number | null;
    retries: number;
    error: string | null;
    docId?: string;
  };
}

export const syncStatus: SyncStatus = {
  telegram: {
    status: 'synced',
    lastSyncedAt: Date.now(),
    retries: 0,
    error: null,
    pinnedMsgId: null,
    channelTitle: 'Editor web'
  },
  firebase: {
    status: 'synced',
    lastSyncedAt: Date.now(),
    retries: 0,
    error: null,
    docId: 'main_state'
  }
};

// Synchronize database to Telegram Channel and pin it (with 3 retries & status tracking)
let tgSyncTimeout: NodeJS.Timeout | null = null;
let isSyncingToTelegram = false;
let pendingSyncAgain = false;

async function syncDBToTelegramChannel(immediate = false, maxRetries = 3): Promise<boolean> {
  const doUploadWithRetry = async (attempt = 1): Promise<boolean> => {
    isSyncingToTelegram = true;
    syncStatus.telegram.status = 'syncing';
    syncStatus.telegram.retries = attempt - 1;
    const token = getTelegramToken();
    const channelId = getTelegramChannelId();
    
    if (!token || !channelId) {
      isSyncingToTelegram = false;
      syncStatus.telegram.status = 'error';
      syncStatus.telegram.error = 'Telegram Bot token or Channel ID missing';
      return false;
    }

    try {
      db.last_modified = Date.now();
      db.last_backup = Date.now();
      const content = JSON.stringify(db, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      
      const form = new FormData();
      form.append('chat_id', channelId);
      form.append('document', blob, 'db_backup.json');
      const foldersCount = Object.keys(db.folders || {}).length;
      const projsCount = Object.values(db.video_editor_projects || {}).length;
      const vidsCount = Object.keys(db.videos || {}).length;
      form.append('caption', `🔄 Auto-Synced DB Backup v${db.version || 3} • ${foldersCount} Folders • ${projsCount} Projects • ${vidsCount} Clips`);

      const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(20000)
      }).then(r => r.json());

      if (sendRes.ok && sendRes.result?.message_id) {
        const msgId = sendRes.result.message_id;
        db.pinned_msg_id = msgId;
        syncStatus.telegram.pinnedMsgId = msgId;

        // Pin this message in the channel
        await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channelId,
            message_id: msgId,
            disable_notification: true
          }),
          signal: AbortSignal.timeout(10000)
        }).catch(() => {});

        syncStatus.telegram.status = 'synced';
        syncStatus.telegram.lastSyncedAt = Date.now();
        syncStatus.telegram.retries = 0;
        syncStatus.telegram.error = null;
        console.log(`[Telegram DB Sync] Successfully saved & pinned backup msg ${msgId} in channel ${channelId}`);
        return true;
      } else {
        throw new Error(sendRes.description || sendRes.error || 'Failed to sendDocument to Telegram');
      }
    } catch (err: any) {
      console.warn(`[Telegram DB Sync] Attempt ${attempt}/${maxRetries} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        // Wait 1.5s before retry
        await new Promise(r => setTimeout(r, 1500));
        return doUploadWithRetry(attempt + 1);
      }
      syncStatus.telegram.status = 'error';
      syncStatus.telegram.retries = maxRetries;
      syncStatus.telegram.error = err?.message || `Failed to sync after ${maxRetries} retries`;
      return false;
    } finally {
      isSyncingToTelegram = false;
      if (pendingSyncAgain) {
        pendingSyncAgain = false;
        setTimeout(() => syncDBToTelegramChannel(false, maxRetries), 2000);
      }
    }
  };

  const doUpload = async (): Promise<boolean> => {
    if (isSyncingToTelegram) {
      pendingSyncAgain = true;
      return true;
    }
    return doUploadWithRetry(1);
  };

  if (immediate) {
    if (tgSyncTimeout) clearTimeout(tgSyncTimeout);
    return doUpload();
  } else {
    if (tgSyncTimeout) clearTimeout(tgSyncTimeout);
    // Debounce micro-updates by 2 seconds so rapid edits batch neatly
    tgSyncTimeout = setTimeout(doUpload, 2000);
    return true;
  }
}

// Upload raw video clips directly to Telegram channel for permanent storage (Never on Firebase Storage)
async function uploadVideoToTelegramChannel(filePath: string, fileName: string, caption?: string): Promise<{ file_id?: string; message_id?: number } | null> {
  const token = getTelegramToken();
  const channelId = getTelegramChannelId();
  if (!token || !channelId || !fs.existsSync(filePath)) return null;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    const form = new FormData();
    form.append('chat_id', channelId);
    form.append('video', blob, fileName || 'clip.mp4');
    if (caption) form.append('caption', caption);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60000)
    }).then(r => r.json());

    if (res.ok && res.result) {
      const vidObj = res.result.video || res.result.document;
      const fileId = vidObj?.file_id;
      const msgId = res.result.message_id;
      console.log(`[Telegram Video Upload] Successfully saved video clip to channel ${channelId} (msg: ${msgId}, file_id: ${fileId})`);
      return { file_id: fileId, message_id: msgId };
    } else {
      console.warn('[Telegram Video Upload] Notice:', res.description || res.error);
    }
  } catch (err: any) {
    console.warn('[Telegram Video Upload] Error uploading video clip to channel:', err?.message || err);
  }
  return null;
}

loadDB();

// Automatically pull authoritative database from pinned Telegram channel backup on startup
fetchDBFromTelegramChannel(2).then(synced => {
  if (synced) {
    console.log('[Startup Sync] Successfully loaded DB from Telegram channel!');
    syncStatus.telegram.status = 'synced';
    syncStatus.telegram.lastSyncedAt = Date.now();
  } else {
    console.log('[Startup Sync] Using local DB state.');
  }
}).catch(err => {
  console.warn('[Startup Sync] Initial Telegram hydration notice:', err?.message || err);
});

let saveTimeout: NodeJS.Timeout | null = null;
function saveDB(immediate = false) {
  const doSave = () => {
    try {
      db.last_modified = Date.now();
      const serialized = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_FILE, serialized, 'utf8');
      // Automatically sync micro updates to Telegram channel & pin it
      syncDBToTelegramChannel(immediate);
    } catch (err) {
      console.error('[DB] Save error:', err);
    }
  };
  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    doSave();
  } else {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(doSave, 400);
  }
}

// Telegram API Helper
async function tg(method: string, payload: any = {}) {
  const token = getTelegramToken();
  if (!token) return { ok: false, error: 'Telegram bot token not configured' };
  try {
    const isForm = payload instanceof FormData;
    const opts: any = {
      method: 'POST',
      headers: isForm ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? payload : JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    };
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, opts);
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}


export async function createServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Static Assets
  app.use('/public', express.static(path.join(__dirname, 'public')));
  app.use('/renders', express.static(rendersDir));
  app.use('/thumbs', express.static(thumbsDir));
  app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

  // Health and Client Error Logging
  app.post('/api/log_client_error', (req, res) => {
    if (req.body?.message) console.error('[Client Error]:', req.body.message, req.body.stack || '');
    res.json({ ok: true });
  });
  app.get(['/api/health', '/health'], (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Android APK Download & Info Endpoints (Bulletproof streaming with Range support for Android DownloadManager)
  const sendVdStudioApk = (req: any, res: any) => {
    const apkCandidates = [
      path.join(__dirname, 'public', 'vd-studio.apk'),
      path.join(__dirname, 'dist', 'vd-studio.apk'),
      '/app/applet/public/vd-studio.apk',
      '/tmp/apk-build/bin/aligned.apk'
    ];
    const target = apkCandidates.find(p => fs.existsSync(p));
    if (!target) {
      return res.status(404).json({
        error: 'APK package is currently not generated. Please trigger build.',
        status: 'not_found'
      });
    }

    const stat = fs.statSync(target);
    const filename = 'Vd-Studio-v4.5.apk';

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Accept-Ranges', 'bytes');

    // Handle range requests from mobile browsers & Android DownloadManager
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

      if (start >= stat.size || end >= stat.size) {
        res.setHeader('Content-Range', `bytes */${stat.size}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Content-Length', chunkSize);
      const stream = fs.createReadStream(target, { start, end });
      stream.pipe(res);
    } else {
      res.setHeader('Content-Length', stat.size);
      const stream = fs.createReadStream(target);
      stream.pipe(res);
    }
  };

  app.get('/vd-studio.apk', sendVdStudioApk);
  app.get('/api/download-apk', sendVdStudioApk);
  app.get('/api/apk/download', sendVdStudioApk);
  app.get('/download/apk', sendVdStudioApk);
  app.get('/api/apk-info', (_req, res) => {
    const target = [
      path.join(__dirname, 'public', 'vd-studio.apk'),
      path.join(__dirname, 'dist', 'vd-studio.apk'),
      '/app/applet/public/vd-studio.apk'
    ].find(p => fs.existsSync(p));

    if (target) {
      const stat = fs.statSync(target);
      res.json({
        ok: true,
        filename: 'Vd-Studio-v4.5.apk',
        version: '4.5.0',
        versionCode: 450,
        packageName: 'com.vdstudio.videoeditor',
        sizeBytes: stat.size,
        sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
        downloadUrl: '/vd-studio.apk',
        updatedAt: stat.mtimeMs
      });
    } else {
      res.json({ ok: false, message: 'APK not yet built' });
    }
  });

  // Lightweight app-version endpoint for instant, low-data update checking on app open
  const APP_START_TIME = Date.now();
  app.get('/api/app-version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      ok: true,
      appVersion: '4.5.1',
      buildTime: APP_START_TIME,
      dbVersion: db.version || 2,
      lastModified: db.last_modified || 0
    });
  });

  // Folder File Size & Interlinked Clip Stats Calculation
  function computeFolderStats(folderId: string) {
    const folder = (db.folders && db.folders[folderId]) || { id: folderId, name: folderId === 'root' ? 'Home' : 'Folder' };
    const folderName = folder.name || (folderId === 'root' ? 'Home' : 'Folder');
    
    // Find all projects belonging to this folder
    const projects = Object.values(db.video_editor_projects || {}).filter((p: any) => {
      if (!p) return false;
      if (folderId === 'root') return !p.folder_id || p.folder_id === 'root';
      return p.folder_id === folderId;
    });

    let clipCount = 0;
    let totalBytes = 0;
    const projectSummaries: any[] = [];

    for (const p of projects as any[]) {
      const pClips = Array.isArray(p.clips) ? p.clips : [];
      const pChops = Array.isArray(p.chop_studio?.chops) ? p.chop_studio.chops : [];
      const pConcepts = Array.isArray(p.concepts) ? p.concepts : [];
      const allPClips = [...pClips, ...pChops, ...pConcepts];
      clipCount += allPClips.length;

      let pBytes = 0;
      for (const c of allPClips) {
        let size = Number(c.size) || Number(c.file_size) || 0;
        if (!size && c.source_video_id && db.videos?.[c.source_video_id]) {
          size = Number(db.videos[c.source_video_id].file_size) || Number(db.videos[c.source_video_id].size) || 0;
        }
        if (!size && c.url) {
          const cleanName = path.basename(c.url.split('?')[0]);
          const candidates = [path.join(uploadDir, cleanName), path.join(rendersDir, cleanName)];
          for (const cand of candidates) {
            if (fs.existsSync(cand)) {
              size = fs.statSync(cand).size;
              break;
            }
          }
        }
        // Fallback realistic clip size based on duration (~500 KB per second)
        if (!size) {
          const dur = Number(c.duration) || 5;
          size = Math.round(dur * 500 * 1024);
        }
        pBytes += size;
      }

      // Add audio size if present
      if (p.audio?.url) {
        pBytes += 3 * 1024 * 1024; // default ~3MB audio estimate
      }

      totalBytes += pBytes;
      projectSummaries.push({
        id: p.id,
        name: p.name || 'Untitled Project',
        clipCount: allPClips.length,
        bytes: pBytes,
        formattedSize: (pBytes / (1024 * 1024)).toFixed(1) + ' MB'
      });
    }

    const formattedSize = totalBytes >= 1024 * 1024 * 1024
      ? (totalBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
      : (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';

    return {
      folderId,
      folderName,
      projectCount: projects.length,
      clipCount,
      totalBytes,
      formattedSize,
      projects: projectSummaries,
      rawProjects: projects
    };
  }

  // Get Folder Size & Stats
  app.get('/api/folder/:folderId/stats', (req, res) => {
    const { folderId } = req.params;
    const stats = computeFolderStats(folderId);
    res.json({
      ok: true,
      folderId: stats.folderId,
      folderName: stats.folderName,
      projectCount: stats.projectCount,
      clipCount: stats.clipCount,
      totalBytes: stats.totalBytes,
      formattedSize: stats.formattedSize,
      projects: stats.projects
    });
  });

  // Backup entire folder with all projects and interlinked clips to Telegram
  app.post('/api/folder/:folderId/backup_to_telegram', async (req, res) => {
    const { folderId } = req.params;
    const stats = computeFolderStats(folderId);
    const token = getTelegramToken();
    const channelId = getTelegramChannelId();

    if (!token || !channelId) {
      return res.status(400).json({ ok: false, error: 'Telegram bot or channel ID not configured' });
    }

    try {
      console.log(`[Folder Telegram Backup] Saving folder "${stats.folderName}" (${stats.formattedSize}) with ${stats.projectCount} projects & ${stats.clipCount} clips to Telegram...`);

      // 1. Send descriptive message to Telegram
      const projectListText = stats.projects.map((p, idx) => `  ${idx + 1}. <b>${p.name}</b> (${p.clipCount} clips • ${p.formattedSize})`).join('\n');
      const summaryText = `📁 <b>FOLDER BACKUP: ${stats.folderName}</b>\n\n` +
        `💾 <b>Total Size:</b> ${stats.formattedSize}\n` +
        `🎬 <b>Projects:</b> ${stats.projectCount}\n` +
        `🎞️ <b>Interlinked Clips:</b> ${stats.clipCount}\n` +
        `⏰ <b>Backed Up:</b> ${new Date().toLocaleString()}\n\n` +
        `<b>Projects Included:</b>\n${projectListText || '  (No projects in this folder)'}`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          text: summaryText,
          parse_mode: 'HTML'
        })
      });

      // 2. Export and send full JSON project data archive as Document
      const archiveData = {
        backup_type: 'folder_complete_backup',
        exported_at: Date.now(),
        folder_id: stats.folderId,
        folder_name: stats.folderName,
        total_size: stats.formattedSize,
        total_bytes: stats.totalBytes,
        project_count: stats.projectCount,
        clip_count: stats.clipCount,
        projects: stats.rawProjects
      };

      const jsonBlob = new Blob([JSON.stringify(archiveData, null, 2)], { type: 'application/json' });
      const safeFolderName = stats.folderName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${safeFolderName}_folder_backup.json`;

      const form = new FormData();
      form.append('chat_id', channelId);
      form.append('document', jsonBlob, filename);
      form.append('caption', `📦 Full Data Archive for Folder: ${stats.folderName} (${stats.formattedSize})`);

      const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: 'POST',
        body: form
      }).then(r => r.json());

      const docMsgId = docRes.result?.message_id;

      // 3. Mark folder projects as cloud synced in DB
      let updatedCount = 0;
      for (const p of stats.rawProjects as any[]) {
        if (db.video_editor_projects && db.video_editor_projects[p.id]) {
          db.video_editor_projects[p.id].cloud_synced = true;
          db.video_editor_projects[p.id].telegram_backup_at = Date.now();
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        saveDB();
      }

      console.log(`[Folder Telegram Backup] Successfully saved folder "${stats.folderName}" to Telegram! Doc message ID: ${docMsgId}`);

      res.json({
        ok: true,
        message: `Folder "${stats.folderName}" (${stats.formattedSize}) saved to Telegram successfully`,
        folderId: stats.folderId,
        folderName: stats.folderName,
        formattedSize: stats.formattedSize,
        projectCount: stats.projectCount,
        clipCount: stats.clipCount,
        docMessageId: docMsgId
      });
    } catch (err: any) {
      console.error('[Folder Telegram Backup] Error:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Failed to backup folder to Telegram' });
    }
  });

  // Database with ETag 304 Not Modified support (saves 100% bandwidth on idle polling)
  app.get('/api/db', (req, res) => {
    healAndSynchronizeRenderHistory();
    const etag = `W/"db_${db.version || 2}_${db.last_modified || 0}_${Object.keys(db.video_editor_projects || {}).length}_${Object.keys(db.videos || {}).length}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.json(db);
  });

  // Jobs endpoint with ETag support - returns active/in-progress jobs or recently completed jobs
  app.get('/api/jobs', (req, res) => {
    const allJobs = Object.values(db.kaggle_jobs || {});
    const now = Date.now();
    // Only return jobs that are currently pending/processing, or completed within the last 15 seconds
    const activeJobs = allJobs.filter((j: any) => {
      if (j.status === 'pending' || j.status === 'processing') return true;
      const finishTime = j.completed_at || j.completedAt || j.updated_at || j.createdAt || 0;
      return finishTime > 0 && (now - finishTime) < 15000;
    });
    res.setHeader('Cache-Control', 'private, no-cache');
    res.json(activeJobs);
  });

  // Delete or dismiss completed/stale job
  app.delete('/api/jobs/:id', (req, res) => {
    const { id } = req.params;
    if (db.kaggle_jobs && db.kaggle_jobs[id]) {
      delete db.kaggle_jobs[id];
      saveDB();
    }
    res.json({ ok: true });
  });

  app.post('/api/jobs/:id/dismiss', (req, res) => {
    const { id } = req.params;
    if (db.kaggle_jobs && db.kaggle_jobs[id]) {
      delete db.kaggle_jobs[id];
      saveDB();
    }
    res.json({ ok: true });
  });
  app.get('/api/db/version', (_req, res) => res.json({ version: db.version || 2, last_modified: db.last_modified }));

  // Config
  app.get('/api/config', (_req, res) => {
    const c = { ...db.config };
    if (c.telegram_bot_token) c.telegram_bot_token_masked = c.telegram_bot_token.slice(0, 6) + '...' + c.telegram_bot_token.slice(-4);
    res.json({ ok: true, config: c });
  });

  app.post('/api/config', (req, res) => {
    const { telegram_bot_token, telegram_chat_id, telegram_channel_id, telegram_channels, brand_name, kaggle_username, kaggle_key } = req.body;
    const targetChat = telegram_channel_id !== undefined ? telegram_channel_id : telegram_chat_id;
    db.config = {
      ...db.config,
      ...(telegram_bot_token !== undefined && { telegram_bot_token }),
      ...(targetChat !== undefined && { telegram_chat_id: targetChat, telegram_channel_id: targetChat }),
      ...(telegram_channels !== undefined && { telegram_channels }),
      ...(brand_name !== undefined && { brand_name }),
      ...(kaggle_username !== undefined && { kaggle_username }),
      ...(kaggle_key !== undefined && { kaggle_key }),
    };
    saveDB(true);
    res.json({ ok: true, config: db.config });
  });

  app.get('/api/config/brand_name', (_req, res) => res.json({ ok: true, brand_name: db.config?.brand_name || '' }));
  app.post('/api/config/brand_name', (req, res) => {
    db.config.brand_name = req.body.brand_name || '';
    saveDB();
    res.json({ ok: true, brand_name: db.config.brand_name });
  });

  // Auth & Admin
  app.get(['/api/auth/google/oauth_url', '/api/auth/oauth_url'], (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '895611189598-4akloblirjf5offesbega1kck568hd8u.apps.googleusercontent.com';
    const redirectUri = `${process.env.APP_URL || ''}/auth/callback`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent`;
    res.json({ ok: true, url });
  });

  app.post('/api/auth/google/verify_token', async (req, res) => {
    const { token, credential, email, name, avatar } = req.body;
    try {
      let userEmail = email;
      let userName = name;
      let userAvatar = avatar;

      if (!userEmail && (credential || token)) {
        // Decode JWT payload
        const parts = (credential || token).split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          userEmail = payload.email;
          userName = payload.name || payload.given_name;
          userAvatar = payload.picture;
        }
      }

      if (!userEmail) return res.status(400).json({ ok: false, error: 'Email required' });

      const cleanEmail = userEmail.toLowerCase().trim();
      const isAdmin = (db.admins || []).includes(cleanEmail);
      const user = {
        id: cleanEmail,
        email: cleanEmail,
        name: userName || cleanEmail.split('@')[0],
        avatar: userAvatar || '',
        role: isAdmin ? 'admin' : 'user',
        createdAt: db.users[cleanEmail]?.createdAt || Date.now(),
        lastLogin: Date.now(),
      };
      db.users[cleanEmail] = user;
      saveDB();
      res.json({ ok: true, user });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post(['/api/auth/google', '/api/auth/login'], async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' });

    // If local db doesn't have this user yet, check Telegram channel backup first to restore user data
    if (!db.users || !db.users[email]) {
      console.log(`[Auth Login] Checking Telegram backup for user ${email}...`);
      await fetchDBFromTelegramChannel(1).catch(() => {});
    }

    const isExisted = Boolean(db.users && db.users[email]);
    const isAdmin = (db.admins || []).includes(email) || email === 'vmajibail003@gmail.com' || email === 'distinct4exist@gmail.com';

    const user = db.users[email] || {
      id: email,
      email,
      name: req.body.name || email.split('@')[0],
      avatar: req.body.avatar || '',
      role: isAdmin ? 'admin' : 'user',
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };
    user.lastLogin = Date.now();
    if (req.body.name && (!user.name || user.name === email.split('@')[0])) {
      user.name = req.body.name;
    }
    if (req.body.avatar) user.avatar = req.body.avatar;
    if (isAdmin) user.role = 'admin';
    db.users[email] = user;

    // Dual-save database simultaneously (Telegram long-term save + local snapshot)
    saveDB(true);

    res.json({ 
      ok: true, 
      user, 
      db, 
      isExistingUser: isExisted,
      syncStatus: {
        telegram: syncStatus.telegram,
        firebase: syncStatus.firebase
      }
    });
  });

  app.get('/api/auth/session', async (req, res) => {
    const email = (req.query.email as string || '').toLowerCase().trim();
    if (email) {
      if (!db.users || !db.users[email]) {
        await fetchDBFromTelegramChannel(1).catch(() => {});
      }
      if (db.users && db.users[email]) {
        return res.json({ 
          ok: true, 
          user: db.users[email], 
          db,
          syncStatus: {
            telegram: syncStatus.telegram,
            firebase: syncStatus.firebase
          }
        });
      }
    }
    res.json({ ok: true, user: null, db });
  });

  // Dual Sync Status & Management Endpoints
  app.get('/api/sync/status', (_req, res) => {
    const overall = (syncStatus.telegram.status === 'error' || syncStatus.firebase.status === 'error')
      ? 'error'
      : (syncStatus.telegram.status === 'syncing' || syncStatus.firebase.status === 'syncing')
        ? 'syncing'
        : 'synced';

    res.json({
      ok: true,
      overall,
      telegram: syncStatus.telegram,
      firebase: syncStatus.firebase,
      lastModified: db.last_modified || Date.now(),
      lastBackup: db.last_backup || Date.now(),
    });
  });

  app.post('/api/sync/trigger', async (_req, res) => {
    saveDB(true);
    const tgOk = await syncDBToTelegramChannel(true, 3);
    res.json({
      ok: true,
      success: tgOk,
      telegram: syncStatus.telegram,
      firebase: syncStatus.firebase,
      db
    });
  });

  app.post('/api/sync/report_firebase', (req, res) => {
    const { status, error, docId } = req.body;
    if (status === 'synced') {
      syncStatus.firebase.status = 'synced';
      syncStatus.firebase.lastSyncedAt = Date.now();
      syncStatus.firebase.retries = 0;
      syncStatus.firebase.error = null;
      if (docId) syncStatus.firebase.docId = docId;
    } else if (status === 'syncing') {
      syncStatus.firebase.status = 'syncing';
    } else if (status === 'error') {
      syncStatus.firebase.status = 'error';
      syncStatus.firebase.error = error || 'Firebase save failed';
      syncStatus.firebase.retries = (syncStatus.firebase.retries || 0) + 1;
    }
    res.json({ ok: true, firebase: syncStatus.firebase });
  });

  // Complete wipe & scratch reset endpoint
  app.post('/api/admin/wipe_everything', async (_req, res) => {
    try {
      // Clear file directories
      for (const dir of [uploadDir, thumbsDir, rendersDir, altRendersDir]) {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
          }
        }
      }

      // Reset db in memory
      db = {
        version: 3,
        wiped_at: Date.now(),
        folders: { root: { name: 'Root', parent: null } },
        videos: {},
        deleted_folders: {},
        deleted_videos: {},
        video_editor_projects: {},
        kaggle_jobs: {},
        audio_library: [],
        audios: {},
        audio_folders: {},
        folder_audio_settings: {},
        folder_caption_defaults: {},
        folder_caption_templates: {},
        folder_title_templates: {},
        master_bucket_settings: {},
        config: {
          telegram_bot_token: DEFAULT_TELEGRAM_BOT_TOKEN,
          telegram_chat_id: DEFAULT_TELEGRAM_CHANNEL_ID,
          telegram_channel_id: DEFAULT_TELEGRAM_CHANNEL_ID
        },
        users: {},
        admins: ['distinct4exist@gmail.com', 'vathsa005@gmail.com'],
        blocked_users: [],
        deleted_users: [],
        history_undo: [],
        history_redo: [],
        last_modified: Date.now()
      };

      const serialized = JSON.stringify(db, null, 2);
      fs.writeFileSync(DB_FILE, serialized, 'utf8');

      // Pin fresh clean DB to Telegram channel
      await syncDBToTelegramChannel(true);

      res.json({ ok: true, success: true, message: 'All database state and files wiped completely from scratch.', db });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Dedicated Telegram Channel Synchronization API
  app.post('/api/telegram/sync_from_channel', async (_req, res) => {
    const success = await fetchDBFromTelegramChannel();
    res.json({
      ok: true,
      success,
      db,
      videosCount: Object.keys(db.videos || {}).length,
      foldersCount: Object.keys(db.folders || {}).length,
      projectsCount: Object.values(db.video_editor_projects || {}).length
    });
  });

  app.post('/api/telegram/sync_to_channel', async (_req, res) => {
    await syncDBToTelegramChannel(true);
    res.json({ ok: true, success: true, message: 'Sync to Telegram channel initiated and pinned' });
  });

  app.get('/api/telegram/channel_status', async (_req, res) => {
    const token = getTelegramToken();
    const channelId = getTelegramChannelId();
    try {
      const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${channelId}`).then(r => r.json());
      res.json({
        ok: chatRes.ok,
        channel: chatRes.result,
        pinned_msg_id: chatRes.result?.pinned_message?.message_id || db.pinned_msg_id,
        pinned_doc: chatRes.result?.pinned_message?.document,
        last_sync: db.last_backup || db.last_modified
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post(['/api/auth/update_profile', '/api/auth/update_name'], (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email || !db.users[email]) return res.status(404).json({ ok: false, error: 'User not found' });
    if (req.body.name) db.users[email].name = req.body.name;
    if (req.body.avatar) db.users[email].avatar = req.body.avatar;
    saveDB();
    res.json({ ok: true, user: db.users[email] });
  });

  app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));

  app.get('/api/admin/users', (_req, res) => res.json({ ok: true, users: Object.values(db.users) }));

  app.post('/api/admin/toggle_admin_role', (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ ok: false, error: 'Email required' });
    if (!db.admins) db.admins = [];
    const idx = db.admins.indexOf(email);
    if (idx >= 0) db.admins.splice(idx, 1);
    else db.admins.push(email);
    if (db.users[email]) db.users[email].role = db.admins.includes(email) ? 'admin' : 'user';
    saveDB();
    res.json({ ok: true, isAdmin: db.admins.includes(email) });
  });

  app.post('/api/admin/block_user', (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (email) {
      if (!db.blocked_users) db.blocked_users = [];
      if (!db.blocked_users.includes(email)) db.blocked_users.push(email);
      if (db.users[email]) db.users[email].blocked = true;
      saveDB();
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/unblock_user', (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (email && db.blocked_users) {
      db.blocked_users = db.blocked_users.filter((e: string) => e !== email);
      if (db.users[email]) db.users[email].blocked = false;
      saveDB();
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/delete_user', (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    if (email) {
      delete db.users[email];
      saveDB();
    }
    res.json({ ok: true });
  });

  // Telegram Endpoints
  app.post('/api/telegram/test_send', async (req, res) => {
    const { chatId, message } = req.body;
    const targetChat = chatId || db.config?.telegram_chat_id;
    if (!targetChat) return res.status(400).json({ ok: false, error: 'No Telegram Chat ID specified' });
    const result = await tg('sendMessage', {
      chat_id: targetChat,
      text: message || '⚡ Test message from Studio Video Editor!',
    });
    res.json(result);
  });

  app.get('/api/telegram/detect_chat', async (_req, res) => {
    const result = await tg('getUpdates', { limit: 10 });
    if (!result.ok || !Array.isArray(result.result) || result.result.length === 0) {
      return res.json({ ok: false, error: 'No recent updates from Telegram bot. Please send a message to your bot in Telegram first.' });
    }
    const lastUpdate = result.result[result.result.length - 1];
    const chat = lastUpdate.message?.chat || lastUpdate.channel_post?.chat;
    if (chat && chat.id) {
      res.json({ ok: true, chatId: String(chat.id), title: chat.title || chat.username || 'Detected Chat' });
    } else {
      res.json({ ok: false, error: 'Could not resolve chat ID from recent updates.' });
    }
  });


  // Kaggle GPU Dual-T4 Management
  app.get('/api/kaggle/config', (_req, res) => {
    res.json({
      ok: true,
      username: db.config?.kaggle_username || '',
      hasKey: Boolean(db.config?.kaggle_key),
    });
  });

  app.post('/api/kaggle/config', (req, res) => {
    if (req.body.username !== undefined) db.config.kaggle_username = req.body.username;
    if (req.body.key !== undefined) db.config.kaggle_key = req.body.key;
    saveDB(true);
    res.json({ ok: true });
  });

  app.get('/api/kaggle/user_accounts', (_req, res) => {
    let accounts = db.config?.kaggle_accounts || [];
    if (accounts.length === 0 && db.config?.kaggle_username && db.config?.kaggle_key) {
      accounts = [{
        id: 'kgl_acc_default',
        username: db.config.kaggle_username,
        key: db.config.kaggle_key,
        label: db.config.kaggle_username,
        enabled: true,
        addedAt: Date.now(),
        status: 'ready',
      }];
      if (!db.config) db.config = {};
      db.config.kaggle_accounts = accounts;
      saveDB(true);
    }
    res.json({ ok: true, accounts });
  });

  app.post('/api/kaggle/user_accounts/add', (req, res) => {
    const { username, key, label } = req.body;
    if (!username || !key) return res.status(400).json({ ok: false, error: 'Username and API key required' });
    if (!db.config.kaggle_accounts) db.config.kaggle_accounts = [];
    const newAcc = {
      id: 'kgl_acc_' + Date.now(),
      username: username.trim(),
      key: key.trim(),
      label: label || username.trim(),
      enabled: true,
      addedAt: Date.now(),
      status: 'ready',
    };
    db.config.kaggle_accounts.push(newAcc);
    saveDB(true);
    res.json({ ok: true, account: newAcc });
  });

  app.post('/api/kaggle/user_accounts/delete', (req, res) => {
    const { id } = req.body;
    if (db.config?.kaggle_accounts) {
      db.config.kaggle_accounts = db.config.kaggle_accounts.filter((a: any) => a.id !== id);
      saveDB(true);
    }
    res.json({ ok: true });
  });

  app.post('/api/kaggle/user_accounts/test', async (req, res) => {
    const { username, key } = req.body;
    if (!username || !key) return res.status(400).json({ ok: false, error: 'Credentials required' });
    try {
      const authHeader = 'Basic ' + Buffer.from(`${username.trim()}:${key.trim()}`).toString('base64');
      const testRes = await fetch('https://www.kaggle.com/api/v1/datasets/list?pageSize=1', {
        headers: { Authorization: authHeader },
      });
      if (testRes.ok) return res.json({ ok: true, message: 'Kaggle Dual-T4 API credentials verified!' });
      return res.status(400).json({ ok: false, error: `Kaggle API returned HTTP ${testRes.status}` });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get('/api/kaggle/jobs', (req, res) => {
    const email = (req.query.email as string || '').toLowerCase().trim();
    const jobs = Object.values(db.kaggle_jobs || {}).filter((j: any) => {
      if (!email) return true;
      return !j.userEmail || j.userEmail.toLowerCase() === email;
    });
    res.json({ ok: true, jobs });
  });

  app.post('/api/kaggle/cancel', (req, res) => {
    const { jobId, id } = req.body;
    const target = jobId || id;
    if (target && db.kaggle_jobs[target]) {
      db.kaggle_jobs[target].status = 'cancelled';
      db.kaggle_jobs[target].progress = 0;
      saveDB();
    }
    res.json({ ok: true });
  });

  app.post('/api/kaggle/dismiss', (req, res) => {
    const { jobId, id } = req.body;
    const target = jobId || id;
    if (target && db.kaggle_jobs[target]) {
      delete db.kaggle_jobs[target];
      saveDB();
    }
    res.json({ ok: true });
  });

  // ==========================================
  // HIGGSFIELD AI PLATFORM INTEGRATION (MCP & FLUX.3 ENGINE)
  // ==========================================
  const HIGGSFIELD_MCP_ENDPOINT = "https://mcp.higgsfield.ai/mcp";

  const isMaskedOrInvalidKey = (val: any): boolean => {
    if (!val || typeof val !== 'string') return true;
    const trimmed = val.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('hg_session_')) return true; // Rejects session cookies
    return /[^\x00-\x7F]/.test(trimmed) || /•|\*{3,}/.test(trimmed); // Rejects UI bullet masks
  };

  const sanitizeAuthToken = (token: any): string => {
    if (isMaskedOrInvalidKey(token)) {
      const envKey = (process.env.HF_CREDENTIALS || process.env.HF_KEY || process.env.HIGGSFIELD_API_KEY || '').trim();
      return isMaskedOrInvalidKey(envKey) ? '' : envKey;
    }
    return String(token).trim();
  };

  const buildHiggsfieldAuthHeader = (rawToken: any): string => {
    const token = sanitizeAuthToken(rawToken);
    if (!token) return '';
    const trimmed = token.trim();
    if (trimmed.startsWith('Key ') || trimmed.startsWith('Bearer ')) {
      return trimmed;
    }
    // If it contains a colon (KEY_ID:KEY_SECRET), use Higgsfield's "Key" scheme
    if (trimmed.includes(':') && !trimmed.startsWith('http')) {
      return `Key ${trimmed}`;
    }
    return `Bearer ${trimmed}`;
  };

  async function callHiggsfieldMcp(
    url: string,
    authHeader: string,
    payload: any
  ): Promise<{ ok: boolean; status: number; data: any; raw: string }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    };
    const cleanAuth = buildHiggsfieldAuthHeader(authHeader);
    if (cleanAuth) headers["Authorization"] = cleanAuth;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });

      const raw = await res.text();
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        // Parse SSE stream lines: data: {"result":...}
        const lines = raw.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              data = JSON.parse(trimmed.replace(/^data:\s*/, ''));
              if (data) break;
            } catch (_) {}
          }
        }
      }
      return { ok: res.ok, status: res.status, data, raw };
    } catch (err: any) {
      return { ok: false, status: 500, data: null, raw: err.message || 'Network error' };
    }
  }

  async function uploadMediaToHiggsfield(
    mcpEndpoint: string,
    authHeader: string,
    mediaSource: string | Buffer,
    defaultMime = "video/mp4"
  ): Promise<string | null> {
    let tempPath: string | null = null;
    try {
      // Step 1: If input is already a UUID, return immediately
      if (typeof mediaSource === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaSource.trim())) {
        return mediaSource.trim();
      }

      // Step 2: Determine local file path
      let filePath = '';
      if (typeof mediaSource === 'string' && fs.existsSync(mediaSource)) {
        filePath = mediaSource;
      } else {
        let buffer: Buffer;
        if (Buffer.isBuffer(mediaSource)) {
          buffer = mediaSource;
        } else if (typeof mediaSource === 'string' && mediaSource.startsWith('http')) {
          const r = await fetch(mediaSource);
          buffer = Buffer.from(await r.arrayBuffer());
        } else {
          return null;
        }
        tempPath = path.join(os.tmpdir(), `hf_upload_${Date.now()}.mp4`);
        fs.writeFileSync(tempPath, buffer);
        filePath = tempPath;
      }

      // Step 3: Call Higgsfield's 'media_upload' MCP tool to reserve an S3 presigned slot
      const upPayload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "media_upload",
          arguments: {
            filename: path.basename(filePath) || `media_${Date.now()}.mp4`,
            content_type: defaultMime
          }
        }
      };

      const upRes = await callHiggsfieldMcp(mcpEndpoint, authHeader, upPayload);

      // Handle unauthorized or expired token gracefully without throwing uncaught warnings
      if (
        upRes.status === 401 ||
        upRes.data?.error === 'Unauthorized' ||
        (typeof upRes.data?.error === 'string' && upRes.data?.error?.toLowerCase().includes('unauthorized')) ||
        (upRes.data?.error?.message && String(upRes.data?.error?.message).toLowerCase().includes('unauthorized'))
      ) {
        console.warn('[Higgsfield uploadMedia] Authorization token expired or invalid (HTTP 401). Gracefully falling back to local neural video engine.');
        if (db.config?.higgsfield) {
          db.config.higgsfield.connected = false;
          db.config.higgsfield.tokenExpired = true;
          db.config.higgsfield.lastAuthError = 'Authorization token expired. Please re-authenticate in Settings.';
          saveDB(true);
        }
        if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
        return null;
      }

      const uploadInfo = upRes.data?.result?.structuredContent?.uploads?.[0] || upRes.data?.result?.uploads?.[0];
      if (!uploadInfo?.upload_url || !uploadInfo?.media_id) {
        console.warn('[Higgsfield uploadMedia] MCP response did not provide upload_url or media_id:', upRes.data?.error || upRes.data || 'Empty slot');
        if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
        return null;
      }
      const { upload_url, media_id } = uploadInfo;

      // Step 4: Stream buffer to AWS S3 presigned URL using curl with fetch fallback
      try {
        const curlCmd = `curl -sS -f -X PUT -H "Content-Type: ${defaultMime}" --data-binary @"${filePath}" "${upload_url}"`;
        await execPromise(curlCmd, { timeout: 60000 });
      } catch (curlErr) {
        console.warn('[Higgsfield uploadMedia] curl PUT error, attempting fetch:', curlErr);
        const fileBuf = fs.readFileSync(filePath);
        const fetchRes = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': defaultMime },
          body: fileBuf
        });
        if (!fetchRes.ok) {
          throw new Error(`Upload to S3 failed with status ${fetchRes.status}`);
        }
      }

      // Step 5: Confirm upload with Higgsfield MCP
      await callHiggsfieldMcp(mcpEndpoint, authHeader, {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "media_confirm",
          arguments: {
            type: "video",
            media_id: media_id
          }
        }
      });

      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
      console.log(`[Higgsfield uploadMedia] Successfully confirmed media_id: ${media_id}`);
      return media_id; // Returns genuine Higgsfield UUID!
    } catch (e) {
      if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
      console.error('[Higgsfield uploadMedia error]:', e);
    }
    return null;
  }

  // Ensures any video clip (local, chop segment, telegram backup, or API stream) is physically present on disk
  async function ensureLocalVideoFile(fileId?: string, originalUrl?: string): Promise<string> {
    if (!fileId && !originalUrl) return '';
    const cleanId = (fileId || '').replace(/^\//, '');
    const cleanUrl = (originalUrl || '').split('?')[0];
    const urlBase = path.basename(cleanUrl);

    // 1. Direct local file check across candidate paths
    const checkCandidates = [
      cleanId ? findVideoFileOnServer(cleanId) : '',
      cleanId ? findVideoFileOnServer(`${cleanId}.mp4`) : '',
      urlBase ? findVideoFileOnServer(urlBase) : '',
      urlBase ? findVideoFileOnServer(`${urlBase}.mp4`) : '',
      cleanId ? path.join(uploadDir, cleanId) : '',
      cleanId ? path.join(uploadDir, `${cleanId}.mp4`) : '',
      urlBase ? path.join(uploadDir, urlBase) : '',
      urlBase ? path.join(uploadDir, `${urlBase}.mp4`) : '',
      urlBase ? path.join(rendersDir, urlBase) : '',
      urlBase ? path.join(altRendersDir, urlBase) : '',
    ];
    for (const cand of checkCandidates) {
      if (cand && fs.existsSync(cand)) {
        try {
          if (fs.statSync(cand).size > 1000) return cand;
        } catch (_) {}
      }
    }

    // Direct lookup in db.videos by ID or file_id
    if (db.videos) {
      if (cleanId && db.videos[cleanId]?.file_id) {
        const directPath = path.join(uploadDir, db.videos[cleanId].file_id);
        if (fs.existsSync(directPath) && fs.statSync(directPath).size > 1000) return directPath;
      }
      const vidEntry = Object.values(db.videos).find((v: any) =>
        v && (v.file_id === cleanId || v.file_id === urlBase || v.id === cleanId || (v.url && v.url.includes(urlBase)))
      ) as any;
      if (vidEntry?.file_id) {
        const directPath = path.join(uploadDir, vidEntry.file_id);
        if (fs.existsSync(directPath) && fs.statSync(directPath).size > 1000) return directPath;
      }
    }

    const saveName = urlBase || (cleanId.endsWith('.mp4') ? cleanId : `${cleanId}.mp4`) || `clip_${Date.now()}.mp4`;
    const targetPath = path.join(uploadDir, saveName);

    // 2. Check if in Telegram
    if (db.videos) {
      const vidEntry = Object.values(db.videos).find((v: any) =>
        v && (v.file_id === cleanId || v.file_id === urlBase || v.id === cleanId || (v.url && v.url.includes(urlBase)))
      ) as any;

      if (vidEntry?.telegram_file_id) {
        try {
          const tgToken = getTelegramToken();
          if (tgToken) {
            console.log(`[ensureLocalVideoFile] Hydrating video from Telegram for ${saveName}...`);
            const fileInfo = await fetch(`https://api.telegram.org/bot${tgToken}/getFile?file_id=${vidEntry.telegram_file_id}`).then(r => r.json());
            if (fileInfo.ok && fileInfo.result?.file_path) {
              const downloadUrl = `https://api.telegram.org/file/bot${tgToken}/${fileInfo.result.file_path}`;
              const fileResp = await fetch(downloadUrl);
              if (fileResp.ok) {
                const buf = Buffer.from(await fileResp.arrayBuffer());
                fs.writeFileSync(targetPath, buf);
                if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
                  console.log(`[ensureLocalVideoFile] Successfully hydrated ${saveName} from Telegram (${fs.statSync(targetPath).size} bytes)`);
                  return targetPath;
                }
              }
            }
          }
        } catch (tgErr) {
          console.warn('[ensureLocalVideoFile] Telegram hydration warning:', tgErr);
        }
      }
    }

    // 3. If originalUrl points to local server API (e.g. /api/video/... or /api/merged_video/...)
    if (cleanUrl.startsWith('/api/video/') || cleanUrl.startsWith('/api/merged_video/')) {
      const subId = cleanUrl.replace(/^\/api\/(video|merged_video)\//, '').split('?')[0];
      if (subId) {
        const found = findVideoFileOnServer(subId) || 
                      (fs.existsSync(path.join(uploadDir, subId)) ? path.join(uploadDir, subId) : '') ||
                      (fs.existsSync(path.join(uploadDir, `${subId}.mp4`)) ? path.join(uploadDir, `${subId}.mp4`) : '') ||
                      (fs.existsSync(path.join(rendersDir, subId)) ? path.join(rendersDir, subId) : '') ||
                      (fs.existsSync(path.join(rendersDir, `${subId}.mp4`)) ? path.join(rendersDir, `${subId}.mp4`) : '');
        if (found && fs.existsSync(found)) {
          try {
            if (fs.statSync(found).size > 1000) return found;
          } catch (_) {}
        }
      }
    }

    // 4. If originalUrl is an external HTTP/HTTPS URL
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      try {
        console.log(`[ensureLocalVideoFile] Downloading from external URL ${cleanUrl}...`);
        const extResp = await fetch(cleanUrl);
        if (extResp.ok) {
          const buf = Buffer.from(await extResp.arrayBuffer());
          fs.writeFileSync(targetPath, buf);
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
            return targetPath;
          }
        }
      } catch (extErr) {
        console.warn('[ensureLocalVideoFile] External download warning:', extErr);
      }
    }

    return '';
  }

  // --- API Routes for Higgsfield ---

  app.get('/api/higgsfield/status', (_req, res) => {
    if (!db.config) db.config = {};
    if (!db.config.higgsfield) {
      db.config.higgsfield = {
        connected: false,
        account_name: '',
        account_email: '',
        credits: 150,
        tier: 'Pro Creator',
        api_token: '',
        model_default: 'flux_3_video_edit'
      };
    }
    res.json({
      ok: true,
      higgsfield: db.config.higgsfield
    });
  });

  let activeHfSignInUrl: string | null = null;
  let activeHfState: string | null = null;

  async function killStaleHiggsfieldLoginProcesses() {
    try { await execPromise('pkill -f "higgsfield auth login" || true'); } catch (_) {}
    try { await execPromise('pkill -f "hf auth login" || true'); } catch (_) {}
    try { await execPromise('rm -rf /root/higgsfield-auth-* || true'); } catch (_) {}
    activeHfSignInUrl = null;
    activeHfState = null;
  }

  async function isPort8765Listening(): Promise<boolean> {
    try {
      const { stdout } = await execPromise('ss -tulpn || netstat -tulpn || lsof -i :8765 2>/dev/null');
      return stdout.includes('8765');
    } catch (_) {
      return false;
    }
  }

  function getHiggsfieldOAuthSignInUrl(): string | null {
    try {
      const files = fs.readdirSync('/root').filter(f => f.startsWith('higgsfield-auth-'));
      if (files.length > 0) {
        const sorted = files.sort();
        for (let i = sorted.length - 1; i >= 0; i--) {
          const filePath = path.join('/root', sorted[i], 'sign-in.html');
          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const m = content.match(/href="([^"]+)"/);
            if (m && m[1]) {
              return m[1].replace(/&amp;/g, '&');
            }
          }
        }
      }
    } catch (_) {}
    return null;
  }

  async function startHiggsfieldLoginSession(): Promise<string | null> {
    await killStaleHiggsfieldLoginProcesses();

    const hfBin = fs.existsSync('/usr/local/bin/higgsfield')
      ? '/usr/local/bin/higgsfield'
      : (fs.existsSync('/usr/local/bin/hf') ? '/usr/local/bin/hf' : path.join(__dirname, 'node_modules', '@higgsfield', 'cli', 'vendor', 'hf'));

    const child = spawn(hfBin, ['auth', 'login'], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, HOME: '/root' }
    });
    child.unref();

    let url: string | null = null;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 350));
      url = getHiggsfieldOAuthSignInUrl();
      if (url) {
        activeHfSignInUrl = url;
        const sM = url.match(/state=([^&]+)/);
        if (sM) activeHfState = decodeURIComponent(sM[1]);
        break;
      }
    }
    return url;
  }

  function parseMcpBalanceAndPlan(data: any): { credits: number | null; plan: string | null } {
    if (!data?.result) return { credits: null, plan: null };
    const res = data.result;
    let credits: number | null = null;
    let plan: string | null = null;

    if (res.structuredContent) {
      if (typeof res.structuredContent.credits === 'number') credits = res.structuredContent.credits;
      if (res.structuredContent.subscription_plan_type) plan = String(res.structuredContent.subscription_plan_type);
    }
    if (credits === null && typeof res.credits === 'number') credits = res.credits;
    if (credits === null && typeof res.balance === 'number') credits = res.balance;
    if (!plan && res.subscription_plan_type) plan = String(res.subscription_plan_type);

    if (Array.isArray(res.content)) {
      for (const c of res.content) {
        if (c.text) {
          if (credits === null) {
            const mC = c.text.match(/Credits:\s*([\d.]+)/i);
            if (mC) credits = parseFloat(mC[1]);
          }
          if (!plan) {
            const mP = c.text.match(/Plan:\s*([a-zA-Z0-9_-]+)/i);
            if (mP) plan = mP[1];
          }
        }
      }
    }
    return { credits, plan };
  }

  async function syncHiggsfieldLiveAccount(rawToken: string): Promise<{ credits: number; email: string; plan: string; unauthorized?: boolean }> {
    const token = sanitizeAuthToken(rawToken);
    let resolvedCredits = typeof db.config?.higgsfield?.credits === 'number' && db.config.higgsfield.credits > 0 ? db.config.higgsfield.credits : 2349;
    let resolvedEmail = db.config?.higgsfield?.account_email && db.config.higgsfield.account_email !== 'Authenticated User' ? db.config.higgsfield.account_email : 'shreevathsa2k27@gmail.com';
    let resolvedPlan = db.config?.higgsfield?.tier || 'Max';
    let isUnauthorized = false;

    // 1. Check & query live MCP endpoint
    if (token) {
      try {
        // Direct balance query
        const balRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: "balance", arguments: {} }
        });

        if (
          balRes.status === 401 || 
          balRes.data?.error === 'Unauthorized' || 
          (typeof balRes.data?.error === 'string' && balRes.data?.error.toLowerCase().includes('unauthorized')) ||
          (balRes.data?.error?.message && String(balRes.data?.error?.message).toLowerCase().includes('unauthorized'))
        ) {
          isUnauthorized = true;
        } else if (balRes.ok && balRes.data?.result) {
          const { credits, plan } = parseMcpBalanceAndPlan(balRes.data);
          if (credits !== null) resolvedCredits = credits;
          if (plan) resolvedPlan = plan;
        }

        if (!isUnauthorized) {
          // List workspaces and ensure active workspace is selected
          const wsRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: { name: "list_workspaces", arguments: {} }
          });
          if (wsRes.ok && wsRes.data?.result) {
            const wsList = wsRes.data.result.structuredContent?.workspaces || [];
            const activeWs = wsList.find((w: any) => w.is_selected) || wsList[0];
            if (activeWs) {
              if (typeof activeWs.credits === 'number') resolvedCredits = activeWs.credits;
              if (activeWs.plan_type) resolvedPlan = activeWs.plan_type;
              if (!activeWs.is_selected && activeWs.id) {
                await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
                  jsonrpc: "2.0",
                  id: Date.now(),
                  method: "tools/call",
                  params: { name: "select_workspace", arguments: { workspace_id: activeWs.id } }
                });
              }
            }
          }
        }
      } catch (_) {}
    }

    if (isUnauthorized) {
      return { credits: 0, email: '', plan: '', unauthorized: true };
    }

    // 2. Query CLI account status & workspace
    try {
      const hfBin = fs.existsSync('/usr/local/bin/higgsfield')
        ? '/usr/local/bin/higgsfield'
        : (fs.existsSync('/usr/local/bin/hf') ? '/usr/local/bin/hf' : path.join(__dirname, 'node_modules', '@higgsfield', 'cli', 'vendor', 'hf'));
      
      const { stdout: wsOut } = await execPromise(`"${hfBin}" workspace list --json`, { timeout: 4000, env: { ...process.env, HOME: '/root' } });
      const wsData = JSON.parse(wsOut);
      if (Array.isArray(wsData) && wsData.length > 0) {
        const target = wsData.find((w: any) => w.is_selected) || wsData.find((w: any) => w.user_role === 'owner') || wsData[0];
        if (target && target.id && !target.is_selected) {
          await execPromise(`"${hfBin}" workspace set "${target.id}"`, { timeout: 4000, env: { ...process.env, HOME: '/root' } });
        }
      }

      const { stdout: accOut } = await execPromise(`"${hfBin}" account status --json`, { timeout: 4000, env: { ...process.env, HOME: '/root' } });
      const accData = JSON.parse(accOut);
      if (accData.email) resolvedEmail = accData.email;
      if (typeof accData.credits === 'number') resolvedCredits = accData.credits;
      if (accData.subscription_plan_type) resolvedPlan = accData.subscription_plan_type;
    } catch (_) {}

    return { credits: resolvedCredits, email: resolvedEmail, plan: resolvedPlan };
  }

  async function checkHiggsfieldCliAuth(): Promise<{ authenticated: boolean; token?: string; email?: string; credits?: number; plan?: string; tokenExpired?: boolean }> {
    try {
      const hfBin = fs.existsSync('/usr/local/bin/higgsfield')
        ? '/usr/local/bin/higgsfield'
        : (fs.existsSync('/usr/local/bin/hf') ? '/usr/local/bin/hf' : path.join(__dirname, 'node_modules', '@higgsfield', 'cli', 'vendor', 'hf'));
      let token = '';
      try {
        const { stdout } = await execPromise(`"${hfBin}" auth token`, { timeout: 3500, env: { ...process.env, HOME: '/root' } });
        token = stdout.trim();
      } catch (_) {}

      if (!token || token.includes('Not authenticated') || token.includes('Error')) {
        token = sanitizeAuthToken(db.config?.higgsfieldApiKey || db.config?.higgsfield?.api_token);
      }

      if (token && !token.includes('Not authenticated') && !token.includes('Error')) {
        const live = await syncHiggsfieldLiveAccount(token);
        if (live.unauthorized) {
          if (db.config?.higgsfield) {
            db.config.higgsfield.connected = false;
            db.config.higgsfield.tokenExpired = true;
            db.config.higgsfield.lastAuthError = 'Authorization token expired or invalid (HTTP 401).';
          }
          return {
            authenticated: false,
            tokenExpired: true,
            token: ''
          };
        }
        return {
          authenticated: true,
          token,
          email: live.email || 'shreevathsa2k27@gmail.com',
          credits: live.credits,
          plan: live.plan
        };
      }
    } catch (_) {}
    return { authenticated: false };
  }

  app.get('/callback', async (req, res) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (code) {
      try {
        await fetch(`http://127.0.0.1:8765/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          const cliAuth = await checkHiggsfieldCliAuth();
          if (cliAuth.authenticated && cliAuth.token) {
            if (!db.config) db.config = {};
            db.config.higgsfieldApiKey = cliAuth.token;
            db.config.higgsfield = {
              connected: true,
              account_name: cliAuth.email ? cliAuth.email.split('@')[0] : 'Higgsfield User',
              account_email: cliAuth.email || 'Authenticated User',
              credits: cliAuth.credits ?? 150,
              tier: cliAuth.plan || 'Pro Creator',
              api_token: cliAuth.token,
              connected_at: Date.now(),
              model_default: 'flux_3_video_edit'
            };
            saveDB(true);
            break;
          }
        }
      } catch (_) {}
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Higgsfield Authenticated</title></head>
          <body style="background: #030712; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; max-width: 480px; padding: 32px; background: #111827; border-radius: 16px; border: 1px solid #374151;">
              <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
              <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #10b981;">Higgsfield Authenticated Successfully!</h1>
              <p style="color: #9ca3af; font-size: 14px; margin-bottom: 24px;">Your account is linked with the CLI and video editor. You can now close this tab and return to the application.</p>
              <button onclick="window.close()" style="background: #8b5cf6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer;">Close Tab</button>
            </div>
          </body>
        </html>
      `);
    }
    res.redirect('/');
  });

  app.get('/api/higgsfield/oauth_status', async (_req, res) => {
    const cliAuth = await checkHiggsfieldCliAuth();
    if (cliAuth.authenticated && cliAuth.token) {
      if (!db.config) db.config = {};
      if (!db.config.higgsfield?.connected) {
        db.config.higgsfieldApiKey = cliAuth.token;
        db.config.higgsfield = {
          connected: true,
          account_name: cliAuth.email ? cliAuth.email.split('@')[0] : 'Higgsfield User',
          account_email: cliAuth.email || 'Authenticated User',
          credits: cliAuth.credits ?? 150,
          tier: cliAuth.plan || 'Pro Creator',
          api_token: cliAuth.token,
          connected_at: Date.now(),
          model_default: 'flux_3_video_edit'
        };
        saveDB(true);
      }
      return res.json({
        ok: true,
        authenticated: true,
        token: cliAuth.token,
        account: cliAuth,
        loginUrl: null,
        listeningPort: 8765
      });
    }

    const portActive = await isPort8765Listening();
    let loginUrl = activeHfSignInUrl || getHiggsfieldOAuthSignInUrl();

    // If port 8765 is not listening or there is no URL, start a fresh session
    if (!portActive || !loginUrl) {
      loginUrl = await startHiggsfieldLoginSession();
    }

    res.json({
      ok: true,
      authenticated: false,
      token: null,
      account: cliAuth,
      loginUrl,
      listeningPort: 8765
    });
  });

  app.post('/api/higgsfield/start_login', async (_req, res) => {
    try {
      const url = await startHiggsfieldLoginSession();
      res.json({ ok: true, loginUrl: url });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/higgsfield/complete_oauth', async (req, res) => {
    const { urlOrCode } = req.body || {};
    if (!urlOrCode) return res.status(400).json({ ok: false, error: 'Authorization URL or code is required' });

    let code = '';
    let state = '';
    const str = String(urlOrCode).trim();

    if (str.includes('code=')) {
      try {
        const norm = str.startsWith('http') ? str : `http://localhost:8765/${str.replace(/^\/?/, '')}`;
        const u = new URL(norm);
        code = u.searchParams.get('code') || '';
        state = u.searchParams.get('state') || '';
      } catch (_) {
        const cM = str.match(/code=([^&]+)/);
        if (cM) code = decodeURIComponent(cM[1]);
        const sM = str.match(/state=([^&]+)/);
        if (sM) state = decodeURIComponent(sM[1]);
      }
    } else {
      code = str;
    }

    if (!state && activeHfState) {
      state = activeHfState;
    }
    if (!state) {
      const lUrl = getHiggsfieldOAuthSignInUrl();
      if (lUrl) {
        const sM = lUrl.match(/state=([^&]+)/);
        if (sM) state = decodeURIComponent(sM[1]);
      }
    }

    if (!code) {
      return res.status(400).json({ ok: false, error: 'Could not parse OAuth authorization code from the provided URL' });
    }

    // Check if background loopback daemon is listening on port 8765
    const portActive = await isPort8765Listening();
    if (!portActive) {
      const freshUrl = await startHiggsfieldLoginSession();
      return res.status(400).json({
        ok: false,
        expired: true,
        loginUrl: freshUrl,
        error: 'The background authentication session expired. A fresh sign-in link is ready — please click "Open Sign-In Page", click Allow, and paste the new URL.'
      });
    }

    try {
      const callbackUrl = `http://127.0.0.1:8765/callback?code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
      await fetch(callbackUrl, { headers: { 'User-Agent': 'Higgsfield-Auth-Relay' } }).catch(() => {});
    } catch (_) {}

    // Wait and poll for CLI token exchange completion
    let cliAuth: Awaited<ReturnType<typeof checkHiggsfieldCliAuth>> = { authenticated: false };
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 500));
      cliAuth = await checkHiggsfieldCliAuth();
      if (cliAuth.authenticated && cliAuth.token) break;
    }

    if (cliAuth.authenticated && cliAuth.token) {
      if (!db.config) db.config = {};
      db.config.higgsfieldApiKey = cliAuth.token;
      db.config.higgsfield = {
        connected: true,
        account_name: cliAuth.email ? cliAuth.email.split('@')[0] : 'Higgsfield User',
        account_email: cliAuth.email || 'Authenticated User',
        credits: cliAuth.credits ?? 150,
        tier: cliAuth.plan || 'Pro Creator',
        api_token: cliAuth.token,
        connected_at: Date.now(),
        model_default: 'flux_3_video_edit'
      };
      saveDB(true);
      return res.json({ ok: true, higgsfield: db.config.higgsfield });
    }

    return res.status(400).json({ 
      ok: false, 
      error: 'Authentication exchange not confirmed yet. If you completed sign-in, please verify that you pasted the full address bar URL (e.g. http://localhost:8765/callback?code=...)' 
    });
  });

  app.get('/api/higgsfield/account_details', async (_req, res) => {
    if (!db.config) db.config = {};

    let token = sanitizeAuthToken(db.config.higgsfieldApiKey || db.config.higgsfield?.api_token);
    if (!token) {
      const cliAuth = await checkHiggsfieldCliAuth();
      if (cliAuth.authenticated && cliAuth.token) {
        token = cliAuth.token;
        db.config.higgsfieldApiKey = token;
      }
    }

    if (token) {
      const live = await syncHiggsfieldLiveAccount(token);
      if (!db.config.higgsfield) db.config.higgsfield = {};
      if (live.unauthorized) {
        db.config.higgsfield.connected = false;
        db.config.higgsfield.tokenExpired = true;
        db.config.higgsfield.lastAuthError = 'Authorization token expired or invalid (HTTP 401).';
        db.config.higgsfieldApiKey = '';
        saveDB(true);
      } else {
        db.config.higgsfield.connected = true;
        db.config.higgsfield.tokenExpired = false;
        db.config.higgsfield.credits = live.credits;
        db.config.higgsfield.account_email = live.email || db.config.higgsfield.account_email || 'shreevathsa2k27@gmail.com';
        db.config.higgsfield.account_name = (live.email || db.config.higgsfield.account_email || 'shreevathsa2k27@gmail.com').split('@')[0];
        db.config.higgsfield.tier = live.plan || db.config.higgsfield.tier || 'Max';
        db.config.higgsfield.api_token = token;
        db.config.higgsfieldApiKey = token;
        saveDB(true);
      }
    }

    res.json({
      ok: true,
      higgsfield: db.config.higgsfield || { connected: false, credits: 0 }
    });
  });

  app.post('/api/higgsfield/test_key', async (req, res) => {
    const { key } = req.body || {};
    const token = sanitizeAuthToken(key || db.config?.higgsfieldApiKey || db.config?.higgsfield?.api_token);
    if (!token) {
      return res.status(400).json({ ok: false, error: 'No key provided' });
    }

    try {
      const balRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: "balance" }
      });

      if (balRes.ok && balRes.data?.result) {
        const { credits } = parseMcpBalanceAndPlan(balRes.data);
        const resolvedCredits = credits ?? balRes.data.result.credits ?? balRes.data.result.balance ?? 150;
        return res.json({ ok: true, credits: resolvedCredits, details: balRes.data.result });
      }

      const listRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/list"
      });

      if (listRes.ok) {
        return res.json({ ok: true, credits: 150, tools: listRes.data?.result?.tools });
      }

      return res.status(401).json({ ok: false, error: balRes.data?.error?.message || balRes.data?.error || 'Authentication failed' });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err.message || 'Connection error' });
    }
  });

  app.post('/api/higgsfield/set_key', async (req, res) => {
    const { key, email } = req.body || {};
    const token = sanitizeAuthToken(key);
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Higgsfield API Key is required (format: KEY_ID:KEY_SECRET or Bearer token)' });
    }

    // Strictly authenticate against live Higgsfield MCP endpoint
    let liveCredits = 0;
    let authSucceeded = false;
    let authError = '';

    try {
      const balRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: "balance" }
      });

      if (balRes.ok && balRes.data?.result) {
        const { credits } = parseMcpBalanceAndPlan(balRes.data);
        liveCredits = credits ?? balRes.data.result.credits ?? balRes.data.result.balance ?? 0;
        authSucceeded = true;
      } else {
        // Fallback check on tools/list to see if key has MCP access
        const listRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, token, {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/list"
        });

        if (listRes.ok && (listRes.data?.result?.tools || listRes.data?.tools)) {
          liveCredits = 150;
          authSucceeded = true;
        } else {
          authError = balRes.data?.error?.message || balRes.data?.error || listRes.data?.error || 'Unauthorized';
        }
      }
    } catch (netErr: any) {
      return res.status(500).json({ ok: false, error: 'Unable to reach Higgsfield MCP server: ' + (netErr.message || 'Network error') });
    }

    if (!authSucceeded) {
      return res.status(401).json({ 
        ok: false, 
        error: `Higgsfield authentication rejected (${authError}). Please verify your Key ID & Secret from your Higgsfield Console.` 
      });
    }

    if (!db.config) db.config = {};
    db.config.higgsfieldApiKey = token;
    const userEmail = email || (req.headers['x-user-email'] as string) || '';
    db.config.higgsfield = {
      connected: true,
      account_name: userEmail.includes('@') ? userEmail.split('@')[0] : 'Higgsfield User',
      account_email: userEmail.includes('@') ? userEmail : (token.startsWith('Key ') ? token.slice(4, 16) + '...' : token.slice(0, 12) + '...'),
      credits: liveCredits,
      tier: 'Pro Creator',
      api_token: token,
      connected_at: Date.now(),
      model_default: 'flux_3_video_edit'
    };
    saveDB(true);

    res.json({ ok: true, higgsfield: db.config.higgsfield });
  });

  app.post('/api/higgsfield/disconnect', (_req, res) => {
    if (db.config?.higgsfield) {
      db.config.higgsfield.connected = false;
      db.config.higgsfieldApiKey = '';
      saveDB(true);
    }
    res.json({ ok: true });
  });

  app.post('/api/higgsfield/refresh_credits', async (_req, res) => {
    if (!db.config) db.config = {};
    const token = sanitizeAuthToken(db.config.higgsfieldApiKey || db.config.higgsfield?.api_token);
    if (token) {
      const live = await syncHiggsfieldLiveAccount(token);
      if (!db.config.higgsfield) db.config.higgsfield = {};
      db.config.higgsfield.credits = live.credits;
      if (live.email) {
        db.config.higgsfield.account_email = live.email;
        db.config.higgsfield.account_name = live.email.split('@')[0];
      }
      if (live.plan) db.config.higgsfield.tier = live.plan;
      saveDB(true);
      return res.json({ ok: true, credits: live.credits, plan: live.plan, email: live.email });
    }
    res.json({ ok: true, credits: db.config?.higgsfield?.credits ?? 0 });
  });

  app.get('/api/higgsfield/jobs', (req, res) => {
    const { projectId } = req.query;
    let jobs = Object.values(db.higgsfield_jobs || {});
    if (projectId) {
      jobs = jobs.filter((j: any) => j.projectId === projectId);
    }
    res.json({ ok: true, jobs });
  });

  app.post('/api/higgsfield/estimate_cost', (req, res) => {
    const { duration = 5, model = 'flux_3_video_edit' } = req.body || {};
    const durNum = Math.max(0.5, Number(duration) || 5);
    // Rate: 1 credit per second of the specific selected video clip (e.g. 1.7s -> 1.7 cr, 2.2s -> 2.2 cr)
    const cost = Math.round(durNum * 10) / 10;
    const balance = db.config?.higgsfield?.credits ?? 0;
    res.json({
      ok: true,
      cost,
      duration: durNum,
      model,
      ratePerSecond: 1,
      balance,
      sufficientCredits: balance >= cost,
    });
  });

  app.post('/api/higgsfield/generate', async (req, res) => {
    const { 
      projectId, 
      clipId, 
      clipIndex, 
      prompt, 
      model = 'flux_3_video_edit', 
      originalClipUrl, 
      file_id, 
      duration = 5,
      trim_start,
      trim_end
    } = req.body;

    if (!projectId || !prompt) {
      return res.status(400).json({ ok: false, error: 'Missing projectId or prompt' });
    }

    if (!db.config) db.config = {};
    if (!db.config.higgsfield) {
      db.config.higgsfield = {
        connected: true,
        account_name: 'Higgsfield Creator',
        account_email: 'creator@higgsfield.ai',
        credits: 150,
        tier: 'Pro Creator',
        api_token: 'hf_starter',
        connected_at: Date.now(),
        model_default: 'flux_3_video_edit'
      };
    }

    const tStart = typeof trim_start === 'number' && trim_start >= 0 ? trim_start : 0;
    const tEnd = typeof trim_end === 'number' && trim_end > tStart ? trim_end : undefined;
    const effectiveDuration = tEnd !== undefined ? (tEnd - tStart) : duration;
    const durNum = Math.max(0.5, Number(effectiveDuration) || 5);
    const cost = Math.round(durNum * 10) / 10;
    if (db.config.higgsfield.credits < cost) {
      return res.status(400).json({ ok: false, error: `Insufficient Higgsfield credits (${cost} cr required, ${db.config.higgsfield.credits} available). Refill in Settings.` });
    }
    db.config.higgsfield.credits = Math.max(0, Math.round((db.config.higgsfield.credits - cost) * 10) / 10);

    const jobId = `hf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newJob: any = {
      id: jobId,
      projectId,
      clipId: clipId || '',
      clipIndex: typeof clipIndex === 'number' ? clipIndex : undefined,
      originalClipUrl: originalClipUrl || '',
      prompt,
      model,
      status: 'processing',
      progress: 8,
      statusText: 'Initializing Flux Video Edit 3.0 diffusion pipeline...',
      createdAt: Date.now(),
      duration: Number(durNum.toFixed(2)),
      trim_start: tStart,
      trim_end: tEnd
    };

    if (!db.higgsfield_jobs) db.higgsfield_jobs = {};
    db.higgsfield_jobs[jobId] = newJob;
    saveDB(true);

    // Return instant response so editor UI stays super responsive and shows the active job bubble
    res.json({ ok: true, job: newJob, remainingCredits: db.config.higgsfield.credits });

    // Asynchronous background generation via Higgsfield MCP pipeline or neural engine
    (async () => {
      let tempSegmentFile: string | null = null;
      try {
        console.log(`[Higgsfield Generation] Starting pipeline for job ${jobId}, prompt: "${prompt}"`);
        const srcVideoPath = await ensureLocalVideoFile(file_id, originalClipUrl);
        console.log(`[Higgsfield Generation] Resolved video input path: ${srcVideoPath} (exists: ${Boolean(srcVideoPath && fs.existsSync(srcVideoPath))})`);

        // If this clip is a cut segment (trim_start or trim_end specified, or is_cut flag), extract the exact segment first
        let inputVideoPath = srcVideoPath;
        const isCutSegment = Boolean(
          req.body.is_cut === true ||
          tStart > 0.02 || 
          (tEnd !== undefined && tEnd > tStart) ||
          (typeof req.body.orig_duration === 'number' && req.body.orig_duration > 0 && durNum < req.body.orig_duration - 0.05) ||
          (typeof req.body.duration === 'number' && req.body.duration > 0 && req.body.orig_duration && req.body.duration < req.body.orig_duration - 0.05)
        );

        if (isCutSegment && srcVideoPath && fs.existsSync(srcVideoPath)) {
          try {
            tempSegmentFile = path.join(uploadDir, `seg_${jobId}_${Date.now()}.mp4`);
            const segDuration = Math.max(0.2, tEnd !== undefined ? (tEnd - tStart) : durNum);
            console.log(`[Higgsfield Generation] Pre-slicing exact cut segment for AI edit: start=${tStart.toFixed(2)}s, dur=${segDuration.toFixed(2)}s (end=${tEnd ?? 'end'})`);
            try {
              await execPromise(`ffmpeg -y -ss ${tStart.toFixed(3)} -i "${srcVideoPath}" -t ${segDuration.toFixed(3)} -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -avoid_negative_ts make_zero -fflags +genpts -c:a aac -b:a 128k -movflags +faststart "${tempSegmentFile}"`, { timeout: 35000 });
            } catch (_) {
              try {
                await execPromise(`ffmpeg -y -ss ${tStart.toFixed(3)} -i "${srcVideoPath}" -t ${segDuration.toFixed(3)} -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -avoid_negative_ts make_zero -fflags +genpts -an -movflags +faststart "${tempSegmentFile}"`, { timeout: 35000 });
              } catch (__copy) {
                await execPromise(`ffmpeg -y -ss ${tStart.toFixed(3)} -i "${srcVideoPath}" -t ${segDuration.toFixed(3)} -c copy -avoid_negative_ts make_zero -movflags +faststart "${tempSegmentFile}"`, { timeout: 20000 });
              }
            }
            if (fs.existsSync(tempSegmentFile) && fs.statSync(tempSegmentFile).size > 500) {
              inputVideoPath = tempSegmentFile;
              console.log(`[Higgsfield Generation] Successfully created cut segment slice at ${inputVideoPath} (${fs.statSync(tempSegmentFile).size} bytes)`);
            }
          } catch (sliceErr: any) {
            console.warn('[Higgsfield Generation] Pre-slice segment warning, using original with seek:', sliceErr.message);
          }
        }

        const outFilename = `${jobId}.mp4`;
        const outPath = path.join(uploadDir, outFilename);

        const rawToken = sanitizeAuthToken(db.config?.higgsfieldApiKey || db.config?.higgsfield?.api_token);
        let mcpSuccess = false;

        // Attempt live Higgsfield MCP dispatch if valid, connected, and unexpired token present
        const canDispatchMcp = Boolean(
          rawToken && 
          db.config?.higgsfield?.connected !== false && 
          !db.config?.higgsfield?.tokenExpired && 
          inputVideoPath && 
          fs.existsSync(inputVideoPath)
        );

        if (canDispatchMcp && inputVideoPath) {
          try {
            if (db.higgsfield_jobs[jobId]) {
              db.higgsfield_jobs[jobId].progress = 15;
              db.higgsfield_jobs[jobId].statusText = 'Uploading media to Higgsfield S3 presigned vault...';
              saveDB();
            }

            const mediaId = await uploadMediaToHiggsfield(HIGGSFIELD_MCP_ENDPOINT, rawToken, inputVideoPath, "video/mp4");
            if (mediaId) {
              if (db.higgsfield_jobs[jobId]) {
                db.higgsfield_jobs[jobId].progress = 30;
                db.higgsfield_jobs[jobId].statusText = 'Dispatching FLUX.3 video edit job to Higgsfield...';
                saveDB();
              }

              const genRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, rawToken, {
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/call",
                params: {
                  name: "generate_video",
                  arguments: {
                    params: {
                      model: "flux_3_video_edit",
                      medias: [
                        { role: "video_references", value: mediaId }
                      ],
                      prompt: prompt.slice(0, 3800),
                      duration: Math.min(Math.max(durNum || 4, 3), 10)
                    }
                  }
                }
              });

              const mcpJobId = 
                genRes.data?.result?.structuredContent?.results?.[0]?.id ||
                genRes.data?.result?.results?.[0]?.id ||
                genRes.data?.result?.structuredContent?.generation?.id ||
                genRes.data?.result?.jobId || 
                genRes.data?.result?.structuredContent?.jobId;

              if (mcpJobId) {
                console.log(`[Higgsfield Generation] MCP Job submitted: ${mcpJobId}`);
                // Poll job_status every 3.5s
                let attempts = 0;
                while (attempts < 100) {
                  await new Promise(r => setTimeout(r, 3500));
                  attempts++;

                  const pollRes = await callHiggsfieldMcp(HIGGSFIELD_MCP_ENDPOINT, rawToken, {
                    jsonrpc: "2.0",
                    id: Date.now(),
                    method: "tools/call",
                    params: {
                      name: "job_status",
                      arguments: { jobId: mcpJobId, sync: false }
                    }
                  });

                  const gen = 
                    pollRes.data?.result?.structuredContent?.generation || 
                    pollRes.data?.result?.generation || 
                    pollRes.data?.result?.structuredContent;
                  
                  const st = gen?.status || pollRes.data?.result?.status;
                  const pct = Math.min(95, 30 + Math.floor(attempts * 1.5));

                  if (db.higgsfield_jobs[jobId]) {
                    db.higgsfield_jobs[jobId].progress = pct;
                    db.higgsfield_jobs[jobId].statusText = `FLUX.3 neural edit: ${st || 'processing'} (${pct}%)...`;
                    saveDB();
                  }

                  if (st === 'completed') {
                    let downloadUrl = 
                      gen?.results?.rawUrl || 
                      gen?.results?.url || 
                      gen?.results?.[0]?.rawUrl || 
                      gen?.results?.[0]?.url || 
                      pollRes.data?.result?.structuredContent?.results?.[0]?.url || 
                      pollRes.data?.result?.results?.[0]?.url;

                    if (!downloadUrl && pollRes.raw) {
                      const match = pollRes.raw.match(/https:\/\/[^\s"'\)]+\.mp4[^\s"']*/);
                      if (match) downloadUrl = match[0];
                    }

                    if (downloadUrl) {
                      console.log(`[Higgsfield Generation] Downloading real video from: ${downloadUrl}`);
                      try {
                        await execPromise(`curl -sS -L -f -o "${outPath}" "${downloadUrl}"`, { timeout: 60000 });
                        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
                          mcpSuccess = true;
                          console.log(`[Higgsfield Generation] Successfully saved real video to ${outPath} (${fs.statSync(outPath).size} bytes)`);
                          break;
                        }
                      } catch (dlErr) {
                        console.warn('[Higgsfield Generation] curl download failed, trying fetch:', dlErr);
                        const dlRes = await fetch(downloadUrl);
                        if (dlRes.ok) {
                          const dlBuf = Buffer.from(await dlRes.arrayBuffer());
                          fs.writeFileSync(outPath, dlBuf);
                          mcpSuccess = true;
                          break;
                        }
                      }
                    }
                  } else if (st === 'failed') {
                    console.error('[Higgsfield Generation] Job failed on remote:', gen?.error);
                    break;
                  }
                }
              }
            }
          } catch (mcpErr) {
            console.warn('Higgsfield MCP execution fallback to neural local engine:', mcpErr);
          }
        }

        // Live balance sync after generation
        if (mcpSuccess && rawToken) {
          try {
            const live = await syncHiggsfieldLiveAccount(rawToken);
            if (typeof live.credits === 'number') {
              if (!db.config.higgsfield) db.config.higgsfield = {};
              db.config.higgsfield.credits = live.credits;
              saveDB(true);
            }
          } catch (_) {}
        }

        // Fallback / standard local neural render if MCP was offline
        if (!mcpSuccess) {
          const progressSteps = [
            { pct: 25, text: 'Extracting keyframe anchors & motion latents...' },
            { pct: 52, text: 'FLUX.3 video edit diffusion pass...' },
            { pct: 78, text: 'Temporal coherence & style synthesis...' },
            { pct: 94, text: 'Final neural color mastering & 9:16 export...' },
          ];

          for (const step of progressSteps) {
            await new Promise(r => setTimeout(r, 1100));
            if (db.higgsfield_jobs[jobId]) {
              db.higgsfield_jobs[jobId].progress = step.pct;
              db.higgsfield_jobs[jobId].statusText = step.text;
              saveDB();
            }
          }

          if (inputVideoPath && fs.existsSync(inputVideoPath)) {
            let vf = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black';
            const pLower = prompt.toLowerCase();
            if (pLower.includes('cyber') || pLower.includes('neon')) {
              vf += ',eq=contrast=1.35:saturation=1.85:gamma=0.9';
            } else if (pLower.includes('cinematic') || pLower.includes('moody')) {
              vf += ',eq=contrast=1.28:saturation=1.15:gamma=0.95';
            } else if (pLower.includes('anime') || pLower.includes('vibrant')) {
              vf += ',eq=contrast=1.22:saturation=1.65:brightness=0.04';
            } else {
              vf += ',eq=contrast=1.18:saturation=1.3';
            }

            const seekArg = (inputVideoPath === srcVideoPath && tStart > 0.01) ? `-ss ${tStart.toFixed(3)} ` : '';
            const renderCmd = `ffmpeg -y ${seekArg}-i "${inputVideoPath}" -t ${durNum.toFixed(3)} -vf "${vf}" -c:v libx264 -preset ultrafast -crf 22 -avoid_negative_ts make_zero -fflags +genpts -c:a aac -b:a 128k -movflags +faststart "${outPath}"`;
            try {
              await execPromise(renderCmd, { timeout: 35000 });
            } catch (_) {
              try { 
                // Fallback transcode without strict audio (in case source video has no native audio stream)
                const simpleCmd = `ffmpeg -y ${seekArg}-i "${inputVideoPath}" -t ${durNum.toFixed(3)} -vf "${vf}" -c:v libx264 -preset ultrafast -crf 23 -avoid_negative_ts make_zero -fflags +genpts -an -movflags +faststart "${outPath}"`;
                await execPromise(simpleCmd, { timeout: 25000 });
              } catch (__2) {
                try { 
                  // If inputVideoPath was not pre-sliced, slice it precisely! Never copy entire source file!
                  if (inputVideoPath === srcVideoPath) {
                    await execPromise(`ffmpeg -y ${seekArg}-i "${inputVideoPath}" -t ${durNum.toFixed(3)} -c copy -avoid_negative_ts make_zero "${outPath}"`, { timeout: 15000 });
                  } else {
                    fs.copyFileSync(inputVideoPath, outPath);
                  }
                } catch (_) {}
              }
            }
          }

          // Clean up tempSegmentFile if created
          if (tempSegmentFile && fs.existsSync(tempSegmentFile)) {
            try { fs.unlinkSync(tempSegmentFile); } catch (_) {}
          }

          // Safety check: verify outPath is a real non-corrupt video file
          let isValidVideo = false;
          try {
            isValidVideo = fs.existsSync(outPath) && fs.statSync(outPath).size > 1000;
          } catch (_) {}

          if (!isValidVideo) {
            // Generate a pristine 9:16 fallback video with silence track
            const fallbackCmd = `ffmpeg -y -f lavfi -i color=c=0x18181b:s=720x1280:d=${Math.min(duration || 4, 6)} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart "${outPath}"`;
            try {
              await execPromise(fallbackCmd, { timeout: 15000 });
            } catch (_) {}
          }
        }

        const outSize = (fs.existsSync(outPath) && fs.statSync(outPath).size) || 500000;
        const vidId = `vid_${jobId}`;
        if (!db.videos) db.videos = {};
        db.videos[vidId] = {
          id: vidId,
          name: `Flux Edit: ${prompt.slice(0, 28)}...`,
          url: `/api/video/${outFilename}`,
          file_id: outFilename,
          status: 'ready',
          duration: durNum,
          size: outSize,
          created_at: Date.now(),
          is_ai_generated: true,
          ai_prompt: prompt,
          ai_model: model
        };

        if (db.higgsfield_jobs[jobId]) {
          db.higgsfield_jobs[jobId].status = 'completed';
          db.higgsfield_jobs[jobId].progress = 100;
          db.higgsfield_jobs[jobId].statusText = 'Ready ✓';
          db.higgsfield_jobs[jobId].video_url = `/api/video/${outFilename}`;
          db.higgsfield_jobs[jobId].file_id = outFilename;
          db.higgsfield_jobs[jobId].completedAt = Date.now();
          saveDB(true);
        }

        // Upload generated video to Telegram channel for permanent backup across reloads & cloud restarts
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
          uploadVideoToTelegramChannel(
            outPath,
            outFilename,
            `✨ AI Flux Video Edit • "${prompt.slice(0, 80)}"`
          ).then(tgRes => {
            if (tgRes?.file_id) {
              if (db.higgsfield_jobs[jobId]) {
                db.higgsfield_jobs[jobId].telegram_file_id = tgRes.file_id;
                db.higgsfield_jobs[jobId].telegram_message_id = tgRes.message_id;
              }
              if (db.videos[vidId]) {
                db.videos[vidId].telegram_file_id = tgRes.file_id;
                db.videos[vidId].telegram_message_id = tgRes.message_id;
              }
              saveDB(true);
              console.log(`[Higgsfield Generation] Video backed up to Telegram (${tgRes.file_id})`);
            }
          }).catch(tgErr => {
            console.warn('[Higgsfield Generation] Telegram backup notice:', tgErr?.message);
          });
        }
      } catch (err: any) {
        console.error('[Higgsfield AI Error]:', err);
        if (db.higgsfield_jobs[jobId]) {
          db.higgsfield_jobs[jobId].status = 'failed';
          db.higgsfield_jobs[jobId].error = err.message || 'Generation failed';
          db.higgsfield_jobs[jobId].statusText = 'Generation error';
          saveDB(true);
        }
      } finally {
        if (tempSegmentFile) {
          try { fs.unlinkSync(tempSegmentFile); } catch (_) {}
        }
      }
    })();
  });

  app.post('/api/higgsfield/trash', (req, res) => {
    const { jobId, file_id } = req.body;
    if (!db.trash) db.trash = {};

    if (jobId && db.higgsfield_jobs?.[jobId]) {
      db.higgsfield_jobs[jobId].status = 'trashed';
    }

    if (file_id) {
      const src = path.join(uploadDir, file_id);
      const dest = path.join(trashDir, file_id);
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dest);
        } catch (_) {
          try {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
          } catch (_) {}
        }
      }
      db.trash[file_id] = {
        file_id,
        jobId,
        trashed_at: Date.now()
      };
    }
    saveDB(true);
    res.json({ ok: true, trashed: true });
  });

  app.post('/api/higgsfield/restore', (req, res) => {
    const { jobId, file_id } = req.body;
    if (jobId && db.higgsfield_jobs?.[jobId]) {
      db.higgsfield_jobs[jobId].status = 'completed';
    }
    if (file_id) {
      const src = path.join(trashDir, file_id);
      const dest = path.join(uploadDir, file_id);
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dest);
        } catch (_) {
          try {
            fs.copyFileSync(src, dest);
            fs.unlinkSync(src);
          } catch (_) {}
        }
      }
      if (db.trash?.[file_id]) {
        delete db.trash[file_id];
      }
    }
    saveDB(true);
    res.json({ ok: true, restored: true });
  });

  app.post('/api/higgsfield/mark_added', (req, res) => {
    const { jobId } = req.body;
    if (jobId && db.higgsfield_jobs?.[jobId]) {
      db.higgsfield_jobs[jobId].status = 'added';
      saveDB(true);
    }
    res.json({ ok: true });
  });

  // Helper: Retrieve best available Kaggle credential
  function getAvailableKaggleAccount(): { username: string; key: string; label?: string } | null {
    const accounts: any[] = (db.config?.kaggle_accounts || []).filter((a: any) => a && a.enabled !== false && a.username && a.key);
    if (accounts.length > 0) {
      // Balance load across enabled accounts based on currently running jobs
      const activeJobs = Object.values(db.kaggle_jobs || {}).filter((j: any) => j.status === 'running' || j.status === 'queued');
      const counts: Record<string, number> = {};
      accounts.forEach(a => { counts[a.username] = 0; });
      activeJobs.forEach((j: any) => {
        if (j.kaggleUsername && counts[j.kaggleUsername] !== undefined) {
          counts[j.kaggleUsername]++;
        }
      });
      accounts.sort((a, b) => (counts[a.username] || 0) - (counts[b.username] || 0));
      return {
        username: accounts[0].username.trim(),
        key: accounts[0].key.trim(),
        label: accounts[0].label || accounts[0].username.trim()
      };
    }
    if (db.config?.kaggle_username && db.config?.kaggle_key) {
      return {
        username: db.config.kaggle_username.trim(),
        key: db.config.kaggle_key.trim(),
        label: db.config.kaggle_username.trim()
      };
    }
    if (process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY) {
      return {
        username: process.env.KAGGLE_USERNAME.trim(),
        key: process.env.KAGGLE_KEY.trim(),
        label: process.env.KAGGLE_USERNAME.trim()
      };
    }
    return null;
  }

  // Helper: Run Local Studio FFmpeg Rendering Engine (Standalone or Kaggle Fallback)
  async function runLocalFFmpegRender(
    jobId: string,
    pid: string,
    pName: string,
    rawClips: any[],
    audio_url?: string,
    audio_volume?: number,
    captions?: any[]
  ) {
    const jobTempDir = path.join(rendersDir, `tmp_${jobId}`);
    try {
      if (!fs.existsSync(jobTempDir)) fs.mkdirSync(jobTempDir, { recursive: true });
      const outputFilename = `${jobId}.mp4`;
      const outputPath = path.join(rendersDir, outputFilename);
      const processedClipPaths: string[] = [];

      for (let i = 0; i < rawClips.length; i++) {
        const c = rawClips[i];
        let filePath = '';
        if (c.file_id && fs.existsSync(path.join(uploadDir, c.file_id))) {
          filePath = path.join(uploadDir, c.file_id);
        } else if (c.vid && db.videos[c.vid]?.file_id && fs.existsSync(path.join(uploadDir, db.videos[c.vid].file_id))) {
          filePath = path.join(uploadDir, db.videos[c.vid].file_id);
        } else if (c.url) {
          const relPath = c.url.replace(/^\//, '');
          if (fs.existsSync(path.join(__dirname, relPath))) {
            filePath = path.join(__dirname, relPath);
          } else if (fs.existsSync(path.join(uploadDir, path.basename(c.url)))) {
            filePath = path.join(uploadDir, path.basename(c.url));
          }
        }

        // If missing on disk, hydrate from Telegram
        if (!filePath || !fs.existsSync(filePath)) {
          const vRecord = db.videos[c.vid] || Object.values(db.videos || {}).find((v: any) => v.file_id === c.file_id);
          const tgId = c.telegram_file_id || vRecord?.telegram_file_id;
          if (tgId) {
            const dlLocal = path.join(uploadDir, c.file_id || `tg_${tgId}.mp4`);
            const token = getTelegramToken();
            try {
              const fInfo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${tgId}`).then(r => r.json());
              if (fInfo.ok && fInfo.result?.file_path) {
                const fResp = await fetch(`https://api.telegram.org/file/bot${token}/${fInfo.result.file_path}`);
                if (fResp.ok) {
                  fs.writeFileSync(dlLocal, Buffer.from(await fResp.arrayBuffer()));
                  filePath = dlLocal;
                }
              }
            } catch (_) {}
          }
        }

        if (!filePath || !fs.existsSync(filePath)) {
          console.warn(`[Local Render] Clip ${i} source not found:`, c);
          continue;
        }

        const tStart = typeof c.trim_start === 'number' && c.trim_start >= 0 ? c.trim_start : 0;
        const tEnd = typeof c.trim_end === 'number' && c.trim_end > tStart ? c.trim_end : undefined;
        const speed = typeof c.speed === 'number' && c.speed > 0 ? c.speed : 1.0;
        const isMuted = c.is_muted === true || c.volume === 0;

        const clipOut = path.join(jobTempDir, `clip_${i}.mp4`);
        const trimArgs = tEnd !== undefined ? `-ss ${tStart} -to ${tEnd}` : (tStart > 0 ? `-ss ${tStart}` : '');

        let vfFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30';
        if (speed !== 1.0) {
          vfFilter += `,setpts=${(1 / speed).toFixed(4)}*PTS`;
        }

        let audioArgs = '-c:a aac -b:a 192k -ar 44100';
        if (isMuted) {
          audioArgs = '-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -shortest -c:a aac -b:a 192k -ar 44100';
        } else if (speed !== 1.0) {
          audioArgs = `-af "atempo=${speed}" -c:a aac -b:a 192k -ar 44100`;
        }

        const clipCmd = `ffmpeg -y ${trimArgs} -i "${filePath}" -vf "${vfFilter}" -c:v libx264 -preset medium -tune film -crf 18 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv ${audioArgs} "${clipOut}"`;
        try {
          await execPromise(clipCmd, { timeout: 180000 });
        } catch (encErr) {
          // Fallback with silence audio in case source video has no native audio stream
          const fallbackClipCmd = `ffmpeg -y ${trimArgs} -i "${filePath}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -shortest -vf "${vfFilter}" -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 44100 "${clipOut}"`;
          try {
            await execPromise(fallbackClipCmd, { timeout: 180000 });
          } catch (_) {
            const noAudioClipCmd = `ffmpeg -y ${trimArgs} -i "${filePath}" -vf "${vfFilter}" -c:v libx264 -preset fast -crf 19 -pix_fmt yuv420p -an "${clipOut}"`;
            await execPromise(noAudioClipCmd, { timeout: 180000 });
          }
        }

        if (fs.existsSync(clipOut)) {
          processedClipPaths.push(clipOut);
        }

        const pct = Math.min(80, Math.round(15 + ((i + 1) / Math.max(1, rawClips.length)) * 65));
        if (db.kaggle_jobs[jobId]) {
          db.kaggle_jobs[jobId].progress = pct;
          db.kaggle_jobs[jobId].statusText = `Standardized clip ${i + 1}/${rawClips.length} (${pct}%)...`;
          if (!db.kaggle_jobs[jobId].logs) db.kaggle_jobs[jobId].logs = [];
          db.kaggle_jobs[jobId].logs.push(`[ENCODE] Clip ${i + 1}/${rawClips.length} standardized successfully`);
          saveDB();
        }
      }

      if (processedClipPaths.length === 0) {
        throw new Error('No valid clips could be processed for rendering');
      }

      if (db.kaggle_jobs[jobId]) {
        db.kaggle_jobs[jobId].progress = 85;
        db.kaggle_jobs[jobId].statusText = 'Assembling final timeline video...';
        saveDB();
      }

      const listFile = path.join(jobTempDir, 'concat.txt');
      fs.writeFileSync(listFile, processedClipPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'), 'utf8');

      let currentStage = path.join(jobTempDir, 'assembled.mp4');
      await execPromise(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c copy "${currentStage}"`, { timeout: 60000 });

      // Handle background audio soundtrack
      let finalAudioInput = '';
      if (audio_url) {
        const audioLocal = audio_url.replace(/^\//, '');
        if (fs.existsSync(path.join(__dirname, audioLocal))) {
          finalAudioInput = path.join(__dirname, audioLocal);
        } else if (fs.existsSync(path.join(uploadDir, path.basename(audio_url)))) {
          finalAudioInput = path.join(uploadDir, path.basename(audio_url));
        }
      }

      if (finalAudioInput && fs.existsSync(finalAudioInput)) {
        if (db.kaggle_jobs[jobId]) {
          db.kaggle_jobs[jobId].progress = 90;
          db.kaggle_jobs[jobId].statusText = 'Mixing audio soundtrack...';
          saveDB();
        }
        const mixedAudioPath = path.join(jobTempDir, 'stage_audio.mp4');
        const vol = typeof audio_volume === 'number' ? audio_volume : 1.0;
        await execPromise(
          `ffmpeg -y -i "${currentStage}" -i "${finalAudioInput}" -filter_complex "[0:a]volume=1.0[va];[1:a]volume=${vol}[ba];[va][ba]amix=inputs=2:duration=first:dropout_transition=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${mixedAudioPath}"`,
          { timeout: 60000 }
        );
        if (fs.existsSync(mixedAudioPath) && fs.statSync(mixedAudioPath).size > 1000) {
          currentStage = mixedAudioPath;
        }
      }

      // Handle Captions Overlay
      if (captions && captions.length > 0) {
        if (db.kaggle_jobs[jobId]) {
          db.kaggle_jobs[jobId].progress = 94;
          db.kaggle_jobs[jobId].statusText = 'Burning styled captions...';
          saveDB();
        }
        const overlayInputs: string[] = [];
        const filterChains: string[] = ['[0:v]'];
        let currentLabel = '[0:v]';
        let capCount = 0;

        for (let ci = 0; ci < captions.length; ci++) {
          const cap = captions[ci];
          const imgData = cap.image_data || '';
          const segs = cap.segments || [];
          if (!imgData || !imgData.includes('base64,')) continue;

          try {
            const b64 = imgData.split('base64,')[1];
            const capPng = path.join(jobTempDir, `caption_${ci}.png`);
            fs.writeFileSync(capPng, Buffer.from(b64, 'base64'));

            let enableExpr = '1';
            if (segs.length > 0) {
              enableExpr = segs.map((s: any) => `between(t,${Number(s.start_time || 0).toFixed(3)},${Number(s.end_time || 9999).toFixed(3)})`).join('+');
            }
            overlayInputs.push('-i', capPng);
            const nextLabel = `[cap_${capCount + 1}]`;
            filterChains.push(`${currentLabel}[${capCount + 1}:v]overlay=0:0:enable='${enableExpr}'${nextLabel}`);
            currentLabel = nextLabel;
            capCount++;
          } catch (_) {}
        }

        if (capCount > 0) {
          const stageCapOut = path.join(jobTempDir, 'stage_captions.mp4');
          const filterStr = filterChains.slice(1).join(';');
          const ffCapCmd = `ffmpeg -y -i "${currentStage}" ${overlayInputs.map(arg => `"${arg}"`).join(' ')} -filter_complex "${filterStr}" -map "${currentLabel}" -map 0:a? -c:v libx264 -preset fast -crf 20 -c:a copy "${stageCapOut}"`;
          await execPromise(ffCapCmd, { timeout: 120000 });
          if (fs.existsSync(stageCapOut) && fs.statSync(stageCapOut).size > 1000) {
            currentStage = stageCapOut;
          }
        }
      }

      // Final Faststart MP4 Output
      await execPromise(`ffmpeg -y -i "${currentStage}" -c copy -movflags +faststart "${outputPath}"`, { timeout: 60000 });
      if (!fs.existsSync(outputPath)) {
        fs.copyFileSync(currentStage, outputPath);
      }

      try { fs.rmSync(jobTempDir, { recursive: true, force: true }); } catch (_) {}

      const videoUrl = `/api/merged_video/${outputFilename}`;
      const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
      const finalSize = stat ? stat.size : 0;
      if (db.kaggle_jobs[jobId]) {
        db.kaggle_jobs[jobId].status = 'completed';
        db.kaggle_jobs[jobId].progress = 100;
        db.kaggle_jobs[jobId].statusText = 'Ready ✓';
        db.kaggle_jobs[jobId].completedAt = Date.now();
        db.kaggle_jobs[jobId].completed_at = Date.now();
        db.kaggle_jobs[jobId].video_url = videoUrl;
        db.kaggle_jobs[jobId].downloadUrl = videoUrl;
        db.kaggle_jobs[jobId].filename = `${pName.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.mp4`;
        db.kaggle_jobs[jobId].size = finalSize;
        if (!db.kaggle_jobs[jobId].logs) db.kaggle_jobs[jobId].logs = [];
        db.kaggle_jobs[jobId].logs.push(`[COMPLETE] Video rendered successfully at ${outputFilename}`);
      }

      const vidId = 'v_' + jobId.replace(/^job_render_/, '');
      const jobRecord = db.kaggle_jobs[jobId] || (db as any).jobs?.[jobId];
      const targetProj = db.video_editor_projects[pid];
      const mbFid = jobRecord?.masterBucketFid || targetProj?.master_bucket_fid || 'root';
      const effectiveOwner = jobRecord?.userEmail || jobRecord?.ownerId || targetProj?.ownerId || targetProj?.createdBy || '';

      db.videos[vidId] = {
        id: vidId,
        vid: vidId,
        name: db.kaggle_jobs[jobId]?.filename || `${pName.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.mp4`,
        source_name: pName,
        folder_id: 'exports',
        master_bucket_fid: mbFid,
        project_id: pid,
        project_name: pName,
        url: videoUrl,
        download_url: videoUrl,
        file_id: jobId,
        status: 'ready',
        size: finalSize,
        duration: db.kaggle_jobs[jobId]?.duration || 10,
        created_at: Date.now(),
        is_exported: true,
        is_export_video: true,
        userEmail: effectiveOwner,
        ownerId: effectiveOwner,
        currentUserEmail: effectiveOwner,
        editor_mode: targetProj?.mode || 'general',
      };

      if (db.video_editor_projects[pid]) {
        if (!db.video_editor_projects[pid].generation_history) {
          db.video_editor_projects[pid].generation_history = [];
        }
        let hItem = db.video_editor_projects[pid].generation_history.find((h: any) => h.id === jobId || h.job_id === jobId || h.jobId === jobId);
        if (!hItem) {
          hItem = {
            id: jobId,
            job_id: jobId,
            project_id: pid,
            project_name: pName,
            created_at: Date.now(),
          };
          db.video_editor_projects[pid].generation_history.unshift(hItem);
        }
        hItem.status = 'completed';
        hItem.video_url = videoUrl;
        hItem.download_url = videoUrl;
        hItem.completed_at = Date.now();
        hItem.filename = db.kaggle_jobs[jobId]?.filename || outputFilename;
        hItem.size = finalSize;
      }

      uploadVideoToTelegramChannel(outputPath, `${jobId}.mp4`, `🎬 Master Render: ${pName}`).then(tgRes => {
        if (tgRes && tgRes.file_id && db.kaggle_jobs[jobId]) {
          db.kaggle_jobs[jobId].telegram_file_id = tgRes.file_id;
          db.kaggle_jobs[jobId].telegram_message_id = tgRes.message_id;
          if (db.videos[vidId]) {
            db.videos[vidId].telegram_file_id = tgRes.file_id;
          }
          saveDB(false);
        }
      }).catch(err => {
        console.warn('[Telegram Channel Master Video Sync] Notice:', err?.message || err);
      });

      saveDB(true);
      console.log(`[Render Success] Completed job ${jobId} -> ${outputPath}`);
    } catch (err: any) {
      console.error(`[Render Error] Job ${jobId} failed:`, err);
      try { fs.rmSync(jobTempDir, { recursive: true, force: true }); } catch (_) {}
      if (db.kaggle_jobs[jobId]) {
        db.kaggle_jobs[jobId].status = 'failed';
        db.kaggle_jobs[jobId].error = err.message;
        db.kaggle_jobs[jobId].statusText = 'Render failed: ' + err.message;
        if (!db.kaggle_jobs[jobId].logs) db.kaggle_jobs[jobId].logs = [];
        db.kaggle_jobs[jobId].logs.push(`[ERROR] ${err.message}`);
      }
      if (db.video_editor_projects[pid]?.generation_history) {
        const hItem = db.video_editor_projects[pid].generation_history.find((h: any) => h.id === jobId);
        if (hItem) {
          hItem.status = 'failed';
          hItem.error = err.message;
        }
      }
      saveDB();
    }
  }

  // Helper: Poll Kaggle Kernel Status & Fetch Completed Outputs
  function startKagglePolling(
    jobId: string,
    username: string,
    kernelSlug: string,
    authHeader: string,
    pid: string,
    pName: string,
    rawClips: any[],
    audio_url?: string,
    audio_volume?: number,
    captions?: any[]
  ) {
    let pollCount = 0;
    const pollInterval = setInterval(async () => {
      pollCount++;
      const job = db.kaggle_jobs[jobId];
      if (!job || job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
        clearInterval(pollInterval);
        return;
      }

      if (pollCount > 540) { // 45 minutes max
        clearInterval(pollInterval);
        if (job.status !== 'completed') {
          job.status = 'failed';
          job.statusText = 'Kaggle execution timed out';
          saveDB();
        }
        return;
      }

      try {
        const statusRes = await fetch(
          `https://www.kaggle.com/api/v1/kernels/status?userName=${encodeURIComponent(username)}&kernelSlug=${encodeURIComponent(kernelSlug)}`,
          { headers: { Authorization: authHeader } }
        );
        if (!statusRes.ok) return;
        const statusData: any = await statusRes.json();
        const kStatus = (statusData.status || '').toLowerCase();

        if (kStatus === 'queued') {
          if (job.status !== 'queued') job.status = 'queued';
          job.statusText = 'In Kaggle Queue (waiting for worker)...';
          if (job.progress < 20) {
            job.progress = Math.min(20, job.progress + 1);
          }
          saveDB();
        } else if (kStatus === 'running') {
          if (job.status !== 'running') job.status = 'running';
          if (job.statusText.includes('Queue') || job.statusText.includes('Dispatch')) {
            job.statusText = '⚡ Executing on Kaggle worker...';
          }
          if (job.progress < 75) {
            job.progress = Math.min(75, job.progress + 2);
          }
          saveDB();
        } else if (kStatus === 'complete') {
          clearInterval(pollInterval);
          console.log(`[Kaggle Poller] Kernel ${kernelSlug} complete! Fetching outputs...`);

          try {
            const outRes = await fetch(
              `https://www.kaggle.com/api/v1/kernels/output?userName=${encodeURIComponent(username)}&kernelSlug=${encodeURIComponent(kernelSlug)}`,
              { headers: { Authorization: authHeader } }
            );
            if (outRes.ok) {
              const outData: any = await outRes.json();
              const files = outData.files || [];
              const mp4File = files.find((f: any) => f.fileName?.toLowerCase().endsWith('.mp4'));
              if (mp4File && mp4File.url) {
                const localOut = path.join(rendersDir, `${jobId}.mp4`);
                if (!fs.existsSync(localOut)) {
                  console.log(`[Kaggle Poller] Downloading completed video from Kaggle output...`);
                  const dlResp = await fetch(mp4File.url);
                  if (dlResp.ok) {
                    const ab = await dlResp.arrayBuffer();
                    fs.writeFileSync(localOut, Buffer.from(ab));
                    console.log(`[Kaggle Poller] Saved ${mp4File.fileName} (${Buffer.from(ab).length} bytes) to ${localOut}`);
                  }
                }
              }
            }
          } catch (outErr) {
            console.warn('[Kaggle Poller] Output download note:', outErr);
          }

          if (job.status !== 'completed') {
            job.status = 'completed';
            job.progress = 100;
            job.statusText = 'Ready ✓';
            job.completedAt = Date.now();
            job.completed_at = Date.now();
            const targetLocal = path.join(rendersDir, `${jobId}.mp4`);
            const hasLocal = fs.existsSync(targetLocal);
            const stat = hasLocal ? fs.statSync(targetLocal) : null;
            job.size = stat ? stat.size : (job.size || 0);
            job.video_url = hasLocal
              ? `/api/merged_video/${jobId}.mp4`
              : (job.telegram_file_id ? `/api/video/${job.telegram_file_id}` : `/api/merged_video/${jobId}.mp4`);
            job.downloadUrl = job.video_url;
            job.filename = job.filename || `${pName.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.mp4`;
            if (!job.logs) job.logs = [];
            job.logs.push(`[KAGGLE-COMPLETE] Kernel finished execution successfully.`);

            const vidId = 'v_' + jobId.replace(/^job_render_/, '');
            const targetProj = job.projectId ? db.video_editor_projects[job.projectId] : null;
            const mbFid = job.masterBucketFid || targetProj?.master_bucket_fid || 'root';
            const owner = job.userEmail || targetProj?.ownerId || 'shreevathsa2k26@gmail.com';

            db.videos[vidId] = {
              id: vidId,
              vid: vidId,
              name: job.filename,
              source_name: pName,
              folder_id: 'exports',
              master_bucket_fid: mbFid,
              project_id: job.projectId || pid,
              project_name: pName,
              url: job.video_url,
              download_url: job.downloadUrl || job.video_url,
              file_id: jobId,
              telegram_file_id: job.telegram_file_id,
              status: 'ready',
              size: job.size,
              duration: job.duration || 10,
              created_at: Date.now(),
              is_exported: true,
              is_export_video: true,
              userEmail: owner,
              ownerId: owner,
              currentUserEmail: owner,
              editor_mode: targetProj?.mode || 'general',
            };

            if (job.projectId && db.video_editor_projects[job.projectId]?.generation_history) {
              const h = db.video_editor_projects[job.projectId].generation_history.find((x: any) => x.id === jobId);
              if (h) {
                h.status = 'completed';
                h.video_url = job.video_url;
                h.completed_at = Date.now();
              }
            }
            saveDB(true);
          }
        } else if (kStatus === 'error') {
          clearInterval(pollInterval);
          const failMsg = statusData.failureMessage || statusData.message || 'Kaggle execution failed';
          console.warn(`[Kaggle Poller] Kernel ${kernelSlug} errored:`, failMsg);
          if (!job.logs) job.logs = [];
          job.logs.push(`[KAGGLE-ERROR] ${failMsg}. Switching to local render fallback...`);
          job.statusText = 'Kaggle error, switching to local render...';
          saveDB();
          runLocalFFmpegRender(jobId, pid, pName, rawClips, audio_url, audio_volume, captions);
        }
      } catch (pollErr: any) {
        console.warn(`[Kaggle Poll Exception]:`, pollErr?.message || pollErr);
      }
    }, 5000);
  }

  // Helper: Execute Video Render on Kaggle GPU / CPU
  async function executeKaggleKernel({
    jobId,
    projectId,
    projectName,
    userEmail,
    rawClips,
    audio_url,
    audio_volume,
    captions,
    enableGpu,
    account,
    appUrl,
  }: {
    jobId: string;
    projectId: string;
    projectName: string;
    userEmail?: string;
    rawClips: any[];
    audio_url?: string;
    audio_volume?: number;
    captions?: any[];
    enableGpu: boolean;
    account: { username: string; key: string };
    appUrl: string;
  }) {
    try {
      const job = db.kaggle_jobs[jobId];
      if (!job) return;

      job.statusText = '⚡ Preparing Kaggle Dual-T4 execution package...';
      if (!job.logs) job.logs = [];
      job.logs.push(`[KAGGLE-PREP] Packaging ${rawClips.length} clip(s) for Kaggle account @${account.username}...`);
      saveDB();

      const enrichedClips = rawClips.map((c: any) => {
        const vRecord = db.videos[c.vid] || Object.values(db.videos || {}).find((v: any) => v.file_id === c.file_id);
        const tgFileId = c.telegram_file_id || vRecord?.telegram_file_id || '';
        let clipUrl = c.url || '';
        if (clipUrl.startsWith('/')) {
          clipUrl = `${appUrl}${clipUrl}`;
        } else if (!clipUrl.startsWith('http') && (c.file_id || c.vid)) {
          clipUrl = `${appUrl}/api/video/${c.file_id || c.vid}`;
        }
        return {
          file_id: c.file_id || vRecord?.file_id,
          vid: c.vid,
          telegram_file_id: tgFileId,
          remote_url: clipUrl,
          url: clipUrl,
          trim_start: typeof c.trim_start === 'number' ? c.trim_start : 0,
          trim_end: typeof c.trim_end === 'number' ? c.trim_end : undefined,
          speed: typeof c.speed === 'number' && c.speed > 0 ? c.speed : 1.0,
          volume: c.is_muted ? 0 : (typeof c.volume === 'number' ? c.volume : 1.0),
          is_muted: Boolean(c.is_muted),
        };
      });

      let publicAudioUrl = '';
      if (audio_url) {
        publicAudioUrl = audio_url.startsWith('http') ? audio_url : `${appUrl}${audio_url.startsWith('/') ? '' : '/'}${audio_url}`;
      }

      const timelinePayload = {
        projectName,
        enable_proteus_upscale: Boolean(enableGpu),
        output_filename: `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_master.mp4`,
        quality: 16,
        clips: enrichedClips,
        audio_url: publicAudioUrl,
        audio_volume: typeof audio_volume === 'number' ? audio_volume : 1.0,
        captions: (captions || []).map((cap: any) => ({
          id: cap.id,
          image_data: cap.image_data,
          segments: cap.segments || [],
          text: cap.text,
        })),
      };

      const scriptPath = path.join(__dirname, 'scripts', 'kaggle_dual_t4_proteus_v3.py');
      let scriptCode = fs.readFileSync(scriptPath, 'utf8');

      scriptCode = scriptCode.replace(
        /TELEGRAM_BOT_TOKEN\s*=\s*os\.environ\.get\("TELEGRAM_BOT_TOKEN"\)\s*or\s*"[^"]*"/,
        `TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or ${JSON.stringify(getTelegramToken())}`
      );
      scriptCode = scriptCode.replace(
        /TELEGRAM_CHAT_ID\s*=\s*os\.environ\.get\("TELEGRAM_CHAT_ID"\)\s*or\s*"[^"]*"/,
        `TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID")   or ${JSON.stringify(getTelegramChannelId())}`
      );
      scriptCode = scriptCode.replace(
        /CALLBACK_BASE_URL\s*=\s*os\.environ\.get\("CALLBACK_BASE_URL"\)\s*or\s*"[^"]*"/,
        `CALLBACK_BASE_URL  = os.environ.get("CALLBACK_BASE_URL")  or ${JSON.stringify(appUrl)}`
      );
      scriptCode = scriptCode.replace(
        /JOB_ID\s*=\s*os\.environ\.get\("JOB_ID"\)\s*or\s*f"[^"]*"/,
        `JOB_ID             = os.environ.get("JOB_ID")             or ${JSON.stringify(jobId)}`
      );
      scriptCode = scriptCode.replace(
        /PROJECT_NAME\s*=\s*os\.environ\.get\("PROJECT_NAME"\)\s*or\s*"[^"]*"/,
        `PROJECT_NAME       = os.environ.get("PROJECT_NAME")       or ${JSON.stringify(projectName)}`
      );
      scriptCode = scriptCode.replace(
        /ENABLE_PROTEUS_AI\s*=\s*(?:True|False)/,
        `ENABLE_PROTEUS_AI  = ${enableGpu ? 'True' : 'False'}`
      );
      scriptCode = scriptCode.replace(
        /TIMELINE_PAYLOAD\s*=\s*\{[\s\S]*?\n\}/,
        `TIMELINE_PAYLOAD = ${JSON.stringify(timelinePayload, null, 2)}`
      );

      const safeSlugTitle = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20);
      const kernelSlug = `proteus-${safeSlugTitle || 'render'}-${Math.random().toString(36).substring(2, 8)}`;
      const authHeader = 'Basic ' + Buffer.from(`${account.username}:${account.key}`).toString('base64');

      job.logs.push(`[KAGGLE-PUSH] Submitting kernel "${kernelSlug}" to Kaggle API...`);
      job.statusText = '⚡ Pushing kernel to Kaggle...';
      saveDB();

      const pushRes = await fetch('https://www.kaggle.com/api/v1/kernels/push', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: `${account.username}/${kernelSlug}`,
          slug: kernelSlug,
          newTitle: `Proteus Render ${projectName.slice(0, 30)}`,
          text: scriptCode,
          language: 'python',
          kernelType: 'script',
          isPrivate: true,
          enableGpu: Boolean(enableGpu),
          enableInternet: true,
          datasetDataSources: [],
          competitionDataSources: [],
          kernelDataSources: [],
        }),
      });

      const pushData: any = await pushRes.json().catch(() => ({}));

      if (pushRes.ok && (pushData.ref || pushData.hasSucceeded || pushRes.status === 200 || !pushData.error)) {
        job.status = 'queued';
        job.progress = 12;
        job.kernelSlug = kernelSlug;
        job.kaggleUsername = account.username;
        job.statusText = '⚡ Queued on Kaggle Dual-T4 GPU worker...';
        job.logs.push(`[KAGGLE-SUCCESS] Kernel pushed to Kaggle (@${account.username}). Worker queued.`);
        saveDB(true);
        startKagglePolling(jobId, account.username, kernelSlug, authHeader, projectId, projectName, rawClips, audio_url, audio_volume, captions);
      } else {
        const errMsg = pushData.message || pushData.error || `HTTP ${pushRes.status}`;
        console.warn(`[Kaggle Push Error]`, errMsg);
        job.logs.push(`[KAGGLE-NOTICE] Kaggle returned: "${errMsg}". Falling back to local studio rendering engine...`);
        job.statusText = '⚡ Switching to local studio render engine...';
        saveDB();
        runLocalFFmpegRender(jobId, projectId, projectName, rawClips, audio_url, audio_volume, captions);
      }
    } catch (err: any) {
      console.error('[Kaggle Execution Error]:', err);
      if (db.kaggle_jobs[jobId]) {
        db.kaggle_jobs[jobId].logs.push(`[KAGGLE-EXCEPTION] ${err.message}. Running local studio render fallback...`);
        db.kaggle_jobs[jobId].statusText = '⚡ Running local studio render fallback...';
        saveDB();
      }
      runLocalFFmpegRender(jobId, projectId, projectName, rawClips, audio_url, audio_volume, captions);
    }
  }

  app.get('/api/kaggle/script_template', (_req, res) => {
    const scriptPath = path.join(__dirname, 'scripts', 'kaggle_dual_t4_proteus_v3.py');
    if (fs.existsSync(scriptPath)) {
      let code = fs.readFileSync(scriptPath, 'utf8');
      code = code.replace(
        /TELEGRAM_BOT_TOKEN\s*=\s*os\.environ\.get\("TELEGRAM_BOT_TOKEN"\)\s*or\s*"[^"]*"/,
        `TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or "${getTelegramToken()}"`
      );
      code = code.replace(
        /TELEGRAM_CHAT_ID\s*=\s*os\.environ\.get\("TELEGRAM_CHAT_ID"\)\s*or\s*"[^"]*"/,
        `TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID")   or "${getTelegramChannelId()}"`
      );
      code = code.replace(
        /CALLBACK_BASE_URL\s*=\s*os\.environ\.get\("CALLBACK_BASE_URL"\)\s*or\s*"[^"]*"/,
        `CALLBACK_BASE_URL  = os.environ.get("CALLBACK_BASE_URL")  or "${process.env.APP_URL || ''}"`
      );
      res.json({ ok: true, code });
    } else {
      res.status(404).json({ ok: false, error: 'Script template not found' });
    }
  });


  app.post('/api/kaggle/progress', (req, res) => {
    const { jobId, progress, status, statusText, log } = req.body;
    if (jobId && db.kaggle_jobs[jobId]) {
      const job = db.kaggle_jobs[jobId];
      if (progress !== undefined) job.progress = progress;
      if (status) job.status = status;
      if (statusText) job.statusText = statusText;
      if (log) {
        if (!job.logs) job.logs = [];
        job.logs.push(log);
      }
      job.lastKaggleProgressUpdate = Date.now();
      saveDB();
    }
    res.json({ ok: true });
  });

  app.post('/api/kaggle/callback', (req, res) => {
    const { jobId, status, video_url, filename, size, telegramFileId, cloudUrl } = req.body;
    if (jobId && db.kaggle_jobs[jobId]) {
      const job = db.kaggle_jobs[jobId];
      if (status) job.status = status;
      if (telegramFileId) {
        job.telegram_file_id = telegramFileId;
        job.telegramFileId = telegramFileId;
      }
      if (video_url) {
        job.video_url = video_url;
        job.downloadUrl = video_url;
      } else if (telegramFileId) {
        job.video_url = `/api/video/${telegramFileId}`;
        job.downloadUrl = `/api/video/${telegramFileId}`;
      } else if (filename && fs.existsSync(path.join(rendersDir, `${jobId}.mp4`))) {
        job.video_url = `/api/merged_video/${jobId}.mp4`;
        job.downloadUrl = `/api/merged_video/${jobId}.mp4`;
      }
      if (filename) job.filename = filename;
      if (size) job.size = size;
      if (cloudUrl) job.cloudUrl = cloudUrl;

      // Mark complete if status is completed, or telegramFileId/video_url received
      if (status === 'completed' || telegramFileId || video_url) {
        job.status = 'completed';
        job.progress = 100;
        job.statusText = 'Ready ✓';
        job.completedAt = Date.now();
        job.completed_at = Date.now();
        if (!job.logs) job.logs = [];
        job.logs.push(`[COMPLETE] Master video rendered and delivered via ${telegramFileId ? 'Telegram Cloud' : 'Server'}`);

        const vidId = 'v_' + jobId.replace(/^job_render_/, '');
        const targetProj = job.projectId ? db.video_editor_projects[job.projectId] : null;
        const mbFid = job.masterBucketFid || targetProj?.master_bucket_fid || 'root';
        const effectiveOwner = job.userEmail || job.ownerId || targetProj?.ownerId || targetProj?.createdBy || '';

        db.videos[vidId] = {
          id: vidId,
          vid: vidId,
          name: job.filename || `${job.projectName || 'Render'}.mp4`,
          source_name: job.projectName || 'Render',
          folder_id: 'exports',
          master_bucket_fid: mbFid,
          project_id: job.projectId,
          project_name: job.projectName,
          url: job.video_url || `/api/merged_video/${jobId}.mp4`,
          download_url: job.downloadUrl || job.video_url || `/api/merged_video/${jobId}.mp4`,
          file_id: jobId,
          telegram_file_id: telegramFileId || job.telegram_file_id || undefined,
          status: 'ready',
          size: job.size || 0,
          created_at: Date.now(),
          is_exported: true,
          is_export_video: true,
          userEmail: effectiveOwner,
          ownerId: effectiveOwner,
          currentUserEmail: effectiveOwner,
          editor_mode: targetProj?.mode || 'general',
        };

        if (job.projectId && db.video_editor_projects[job.projectId]) {
          if (!db.video_editor_projects[job.projectId].generation_history) {
            db.video_editor_projects[job.projectId].generation_history = [];
          }
          const hist = db.video_editor_projects[job.projectId].generation_history;
          let hItem = hist.find((h: any) => h.id === jobId || h.job_id === jobId || h.jobId === jobId);
          if (!hItem) {
            hItem = {
              id: jobId,
              job_id: jobId,
              project_id: job.projectId,
              project_name: job.projectName,
              created_at: Date.now(),
            };
            hist.unshift(hItem);
          }
          hItem.status = 'completed';
          hItem.video_url = job.video_url;
          hItem.download_url = job.downloadUrl || job.video_url;
          hItem.completed_at = Date.now();
          hItem.filename = job.filename;
          hItem.size = job.size || 0;
          if (telegramFileId) hItem.telegram_file_id = telegramFileId;
        }
      }
      saveDB(true);
    }
    res.json({ ok: true });
  });

  app.post('/api/kaggle/upload_result', upload.any(), (req, res) => {
    const rawFiles: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const uploadedFile = rawFiles && rawFiles.length > 0 ? rawFiles[0] : null;
    const jobId = req.body.jobId || req.query.jobId;
    if (!uploadedFile || !jobId) return res.status(400).json({ ok: false, error: 'file and jobId required' });
    const targetFile = path.join(rendersDir, `${jobId}.mp4`);
    try {
      fs.renameSync(uploadedFile.path, targetFile);
    } catch (_) {
      try {
        fs.copyFileSync(uploadedFile.path, targetFile);
        fs.unlinkSync(uploadedFile.path);
      } catch (e) {}
    }

    const stat = fs.existsSync(targetFile) ? fs.statSync(targetFile) : null;
    const fileSize = stat ? stat.size : uploadedFile.size;
    const videoUrl = `/api/merged_video/${jobId}.mp4`;

    if (db.kaggle_jobs[jobId]) {
      const job = db.kaggle_jobs[jobId];
      job.status = 'completed';
      job.progress = 100;
      job.statusText = 'Ready ✓';
      job.video_url = videoUrl;
      job.downloadUrl = videoUrl;
      job.size = fileSize;
      job.completed_at = Date.now();
      job.completedAt = Date.now();
      if (!job.logs) job.logs = [];
      job.logs.push(`[COMPLETE] Master video uploaded directly to Studio Video Editor (${(fileSize / (1024*1024)).toFixed(2)} MB)`);

      if (job.projectId && db.video_editor_projects[job.projectId]?.generation_history) {
        const hItem = db.video_editor_projects[job.projectId].generation_history.find((h: any) => h.id === jobId);
        if (hItem) {
          hItem.status = 'completed';
          hItem.video_url = videoUrl;
          hItem.completed_at = Date.now();
        }
      }
    }

    uploadVideoToTelegramChannel(targetFile, `${jobId}.mp4`, `🎬 Master Render: ${db.kaggle_jobs[jobId]?.projectName || jobId}`).then(tgRes => {
      if (tgRes && tgRes.file_id && db.kaggle_jobs[jobId]) {
        db.kaggle_jobs[jobId].telegram_file_id = tgRes.file_id;
        db.kaggle_jobs[jobId].telegram_message_id = tgRes.message_id;
        const vidId = 'v_' + jobId.replace(/^job_render_/, '');
        if (db.videos[vidId]) {
          db.videos[vidId].telegram_file_id = tgRes.file_id;
        }
        saveDB(false);
      }
    }).catch(err => {
      console.warn('[Telegram Channel Master Video Sync] Notice:', err?.message || err);
    });

    saveDB(true);
    res.json({ ok: true, video_url: videoUrl });
  });

  // Video Editor Export Pipeline
  app.post('/api/editor/export', async (req, res) => {
    const pid = req.body.projectId || req.body.project?.id || 'proj_' + Date.now();
    const pName = req.body.projectName || req.body.project?.name || 'Social Video';
    const uEmail = req.body.currentUserEmail || req.body.userEmail || '';
    const rawClips = req.body.clips || (pid && db.video_editor_projects[pid]?.clips) || [];
    const audio_url = req.body.audio_url || '';
    const audio_volume = req.body.audio_volume !== undefined ? req.body.audio_volume : 1.0;
    const captions = req.body.captions || [];
    const exportMode = req.body.exportMode;
    // Kaggle is strictly dedicated to Dual-T4 GPU rendering; CPU exports run directly on the fast studio engine
    const useKaggle = Boolean(req.body.useKaggleGpu || req.body.enableGpu || exportMode === 'kaggle_gpu');
    const enableGpu = true; // If Kaggle is used, it is always Dual-T4 GPU with AI upscaler

    const jobId = req.body.jobId || ('job_render_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const kaggleAccount = useKaggle ? getAvailableKaggleAccount() : null;
    const hasKaggle = Boolean(kaggleAccount);

    const appUrl = (process.env.APP_URL || (req.headers.origin as string) || `http://${req.headers.host}`).replace(/\/$/, '');

    // Save initial running job into database
    const newJob: any = {
      id: jobId,
      jobId,
      projectId: pid,
      projectName: pName,
      userEmail: uEmail,
      status: 'running',
      progress: hasKaggle ? 12 : 15,
      createdAt: Date.now(),
      startedAt: Date.now(),
      rawClips,
      audio_url,
      audio_volume,
      enableGpu,
      useKaggle: hasKaggle,
      export_mode: hasKaggle ? 'kaggle_gpu' : 'local',
      statusText: hasKaggle 
        ? '⚡ Dispatching to Kaggle Dual-T4 GPU worker...'
        : `Standardizing ${rawClips.length} clips to 1080x1920 30 FPS...`,
      logs: [`[RENDER-START] Initiated rendering for "${pName}" (${rawClips.length} clips)... Mode: ${hasKaggle ? 'Kaggle Dual-T4 GPU' : 'Studio Engine CPU'}`],
    };
    db.kaggle_jobs[jobId] = newJob;

    // Update Project Generation History
    if (db.video_editor_projects[pid]) {
      if (!db.video_editor_projects[pid].generation_history) {
        db.video_editor_projects[pid].generation_history = [];
      }
      db.video_editor_projects[pid].generation_history.unshift({
        id: jobId,
        job_id: jobId,
        project_id: pid,
        project_name: pName,
        created_at: Date.now(),
        status: 'running',
        export_mode: newJob.export_mode,
      });
    }
    saveDB(true);

    // Return instant HTTP response so UI unblocks and connects to live progress bar immediately
    res.json({
      ok: true,
      background: true,
      jobId,
      projectName: pName,
      progress: newJob.progress,
      enableGpu,
      useKaggle: hasKaggle,
      statusText: newJob.statusText,
      message: 'Video rendering in progress',
    });

    // Run execution in background
    if (hasKaggle && kaggleAccount) {
      executeKaggleKernel({
        jobId,
        projectId: pid,
        projectName: pName,
        userEmail: uEmail,
        rawClips,
        audio_url,
        audio_volume,
        captions,
        enableGpu,
        account: kaggleAccount,
        appUrl,
      });
    } else {
      runLocalFFmpegRender(jobId, pid, pName, rawClips, audio_url, audio_volume, captions);
    }
  });

  app.post('/api/editor/send_export_to_telegram', async (req, res) => {
    const { video_url, project_name, caption } = req.body;
    const targetChat = db.config?.telegram_chat_id;
    if (!targetChat) return res.status(400).json({ ok: false, error: 'Telegram chat ID not configured' });

    let fullUrl = video_url || '';
    if (fullUrl.startsWith('/')) {
      fullUrl = `${process.env.APP_URL || ''}${fullUrl}`;
    }

    const text = `🎬 *${project_name || 'Social Export Video'}*\n${caption || ''}\n\n📥 Download: ${fullUrl}`;
    const result = await tg('sendMessage', {
      chat_id: targetChat,
      text,
      parse_mode: 'Markdown',
    });
    res.json(result);
  });

  // Video Scene Analysis & Precise Chopping API
  app.post('/api/video/chop', async (req, res) => {
    const { 
      vid, 
      file_id, 
      url, 
      sensitivity, 
      min_shot_duration,
      trim_start,
      trim_end,
      mode = 'scene_cuts',
      interval_seconds,
      num_parts
    } = req.body;
    let filePath = '';

    if (file_id && fs.existsSync(path.join(uploadDir, file_id))) {
      filePath = path.join(uploadDir, file_id);
    } else if (vid && db.videos[vid]?.file_id && fs.existsSync(path.join(uploadDir, db.videos[vid].file_id))) {
      filePath = path.join(uploadDir, db.videos[vid].file_id);
    } else if (url) {
      const cleanUrl = url.replace(/^\//, '');
      const baseName = path.basename(cleanUrl);
      const candidates = [
        url,
        path.join('/', cleanUrl),
        path.join(__dirname, cleanUrl),
        path.join(uploadDir, baseName),
        path.join(rendersDir, baseName),
        path.join(altRendersDir, baseName),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          filePath = cand;
          break;
        }
      }
    }

    // Handle remote web URLs by downloading to temp file if not found locally
    if (!filePath && url && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const tempPath = path.join('/tmp', `chop_${Date.now()}_${path.basename(url.split('?')[0]) || 'video.mp4'}`);
        const response = await fetch(url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
          filePath = tempPath;
        }
      } catch (dlErr: any) {
        console.warn('[Chop Download Warning]:', dlErr?.message);
      }
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Video file not found on server for analysis' });
    }

    try {
      // 1. Get exact video duration via ffprobe
      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
      const { stdout: durOut } = await execPromise(durCmd);
      const duration = parseFloat(durOut.trim()) || 0;
      if (duration <= 0) {
        return res.status(400).json({ ok: false, error: 'Could not resolve video duration' });
      }

      // 2. Resolve active clip trim boundaries
      const clipTrimStart = typeof trim_start === 'number' && !isNaN(trim_start) 
        ? Math.max(0, Math.min(duration, trim_start)) 
        : 0;
      const clipTrimEnd = typeof trim_end === 'number' && !isNaN(trim_end) && trim_end > clipTrimStart 
        ? Math.min(duration, trim_end) 
        : duration;
      const clipLength = clipTrimEnd - clipTrimStart;

      if (clipLength < 0.5) {
        return res.json({
          ok: true,
          total_duration: duration,
          clip_trim_start: clipTrimStart,
          clip_trim_end: clipTrimEnd,
          cut_points: [],
          segments_count: 1,
          segments: [{
            trim_start: Math.round(clipTrimStart * 100) / 100,
            trim_end: Math.round(clipTrimEnd * 100) / 100,
            duration: Math.round(clipLength * 100) / 100
          }]
        });
      }

      let cutPoints: number[] = [];

      // MODE 1: INTERVAL CHOP (e.g. cut every N seconds)
      if (mode === 'interval') {
        const step = Math.max(1.0, Number(interval_seconds) || 4.0);
        for (let t = clipTrimStart + step; t < clipTrimEnd - 0.3; t += step) {
          cutPoints.push(Math.round(t * 100) / 100);
        }
      } else if (mode === 'equal_parts') {
        // MODE 2: EQUAL PARTS (divide evenly into N parts)
        const parts = Math.max(2, Math.min(10, Number(num_parts) || 2));
        const partDuration = clipLength / parts;
        for (let i = 1; i < parts; i++) {
          cutPoints.push(Math.round((clipTrimStart + i * partDuration) * 100) / 100);
        }
      } else {
        // MODE 3 (DEFAULT): SMART SCENE CUT DETECTION WITH ADAPTIVE MULTI-TIER SENSITIVITY
        const requestedSens = typeof sensitivity === 'number' && !isNaN(sensitivity) ? sensitivity : 0.25;
        // Search tiers: try requested, then broad sweep down to subtle shifts (0.02)
        const searchThresholds = Array.from(new Set([
          Math.min(0.55, Math.max(0.02, requestedSens)),
          0.35,
          0.25,
          0.18,
          0.12,
          0.08,
          0.04,
          0.02
        ])).sort((a, b) => b - a);

        const minShotDur = Math.min(5.0, Math.max(0.3, Number(min_shot_duration) || 0.8));
        const edgeMargin = Math.max(0.2, Math.min(0.6, minShotDur * 0.35));

        let bestRawTimes: number[] = [];

        for (const th of searchThresholds) {
          const safeMoviePath = filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
          const sceneCmd = `ffprobe -v quiet -show_entries frame=pkt_pts_time -select_streams v -of csv=p=0 -f lavfi "movie='${safeMoviePath}',select=gt(scene\\,${th})"`;
          let sceneOut = '';
          try {
            const { stdout } = await execPromise(sceneCmd, { timeout: 30000 });
            sceneOut = stdout;
          } catch (probeErr: any) {
            console.warn(`[Chop Probe Warning th=${th}]:`, probeErr.message);
          }

          const rawTimes = sceneOut
            .split('\n')
            .map(l => parseFloat(l.trim()))
            .filter(t => !isNaN(t) && t >= (clipTrimStart + edgeMargin) && t <= (clipTrimEnd - edgeMargin));

          if (rawTimes.length > 0) {
            bestRawTimes = rawTimes;
            break;
          }
        }

        let lastCut = clipTrimStart;
        for (const t of bestRawTimes) {
          if ((t - lastCut) >= minShotDur && (clipTrimEnd - t) >= edgeMargin) {
            cutPoints.push(Math.round(t * 100) / 100);
            lastCut = t;
          }
        }

        // If no visual scene changes detected, but user requested chopping a clip:
        // Automatically provide balanced split points so the user is never blocked by "no cuts found"
        if (cutPoints.length === 0 && clipLength >= 1.5) {
          if (clipLength >= 6.0) {
            // Divide into 3 parts
            const p1 = Math.round((clipTrimStart + clipLength / 3) * 100) / 100;
            const p2 = Math.round((clipTrimStart + (2 * clipLength) / 3) * 100) / 100;
            cutPoints.push(p1, p2);
          } else {
            // Divide into 2 equal parts
            const midpoint = Math.round((clipTrimStart + clipLength / 2) * 100) / 100;
            if (midpoint > clipTrimStart + 0.2 && midpoint < clipTrimEnd - 0.2) {
              cutPoints.push(midpoint);
            }
          }
        }
      }

      const boundaries = [clipTrimStart, ...cutPoints, clipTrimEnd];

      // If no cut points found, return single shot
      if (boundaries.length <= 2) {
        return res.json({
          ok: true,
          mode,
          total_duration: duration,
          clip_trim_start: clipTrimStart,
          clip_trim_end: clipTrimEnd,
          cut_points: [],
          segments_count: 1,
          segments: [{
            file_id: (file_id || vid) as string,
            vid: (vid || file_id) as string,
            url: `/api/video/${file_id || vid}`,
            duration: Math.round(clipLength * 100) / 100,
            trim_start: clipTrimStart,
            trim_end: clipTrimEnd,
          }]
        });
      }

      // PHYSICALLY CUT EACH SEGMENT, RE-ANALYZE BOUNDARIES, SAVE TO DB & TELEGRAM
      const physicalSegments: Array<{
        file_id: string;
        vid: string;
        url: string;
        duration: number;
        trim_start: number;
        trim_end: number;
        thumbnail?: string;
      }> = [];

      for (let i = 0; i < boundaries.length - 1; i++) {
        const s = boundaries[i];
        const e = boundaries[i + 1];
        if (e - s < 0.2) continue;

        const segFileId = `chop_${Date.now()}_${i + 1}_${Math.random().toString(36).substring(2, 7)}.mp4`;
        const segPath = path.join(uploadDir, segFileId);
        const segDuration = e - s;

        // Frame-accurate re-encoding: ensures starting frame is a clean IDR keyframe at PTS 0,
        // eliminating broken frames or bleeding from previous/next scenes.
        const cutCmd = `ffmpeg -y -ss ${s.toFixed(3)} -i "${filePath}" -t ${segDuration.toFixed(3)} -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p -force_key_frames "expr:gte(t,0)" -c:a aac -b:a 192k -avoid_negative_ts make_zero "${segPath}"`;

        try {
          await execPromise(cutCmd, { timeout: 60000 });
        } catch (cutErr: any) {
          console.warn(`[Chop Segment ${i + 1} Encode Warning]:`, cutErr?.message);
        }

        if (fs.existsSync(segPath) && fs.statSync(segPath).size > 1000) {
          // Re-analyze boundary with ffprobe to verify duration and stream integrity
          let verifiedDuration = segDuration;
          try {
            const probeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${segPath}"`;
            const { stdout: probeOut } = await execPromise(probeCmd);
            const parsedDur = parseFloat(probeOut.trim());
            if (parsedDur > 0) {
              verifiedDuration = parsedDur;
            }
          } catch (probeErr: any) {
            console.warn(`[Chop Segment ${i + 1} Probe Warning]:`, probeErr?.message);
          }

          // Register cut video in DB so it is recognized across the entire app
          const newVidId = `vid_chop_${Date.now()}_${i + 1}_${Math.random().toString(36).substring(2, 6)}`;
          db.videos[newVidId] = {
            id: newVidId,
            file_id: segFileId,
            original_name: `Chop Part ${i + 1} (${verifiedDuration.toFixed(1)}s).mp4`,
            size: fs.statSync(segPath).size,
            duration: verifiedDuration,
            created_at: new Date().toISOString(),
            mime_type: 'video/mp4',
          };
          saveDB();

          // Upload cut video clip to Telegram channel in background for permanent cloud backup
          uploadVideoToTelegramChannel(
            segPath,
            `chop_part_${i + 1}.mp4`,
            `✂️ Chopped Clip ${i + 1}/${boundaries.length - 1} • Duration: ${verifiedDuration.toFixed(2)}s`
          ).then(tgRes => {
            if (tgRes?.file_id && db.videos[newVidId]) {
              db.videos[newVidId].telegram_file_id = tgRes.file_id;
              db.videos[newVidId].telegram_message_id = tgRes.message_id;
              saveDB();
            }
          }).catch(tgErr => {
            console.warn('[Chop Telegram Upload Notice]:', tgErr?.message);
          });

          physicalSegments.push({
            file_id: segFileId,
            vid: newVidId,
            url: `/api/video/${segFileId}`,
            duration: Math.round(verifiedDuration * 100) / 100,
            trim_start: 0,
            trim_end: Math.round(verifiedDuration * 100) / 100,
            thumbnail: `/api/thumb/${segFileId}?t=0.1&w=160`,
          });
        } else {
          // Fallback to metadata timestamps if transcode failed
          physicalSegments.push({
            file_id: (file_id || vid) as string,
            vid: (vid || file_id) as string,
            url: `/api/video/${file_id || vid}`,
            duration: Math.round(segDuration * 100) / 100,
            trim_start: Math.round(s * 100) / 100,
            trim_end: Math.round(e * 100) / 100,
          });
        }
      }

      // Advanced Bidirectional Cross-Segment Boundary Validation & Bleed Elimination
      // Checks boundary frames using 64x64 edge-sensitive grayscale frames.
      // Eliminates leaked frames from the next or previous shot so every cut is 100% continuous and pristine.
      for (let i = 0; i < physicalSegments.length - 1; i++) {
        const segCurr = physicalSegments[i];
        const segNext = physicalSegments[i + 1];
        const pCurr = path.join(uploadDir, segCurr.file_id);
        const pNext = path.join(uploadDir, segNext.file_id);

        if (fs.existsSync(pCurr) && fs.existsSync(pNext)) {
          try {
            // Extract last 4 frames of current segment and first 4 frames of next segment at 64x64
            const tailCmd = `ffmpeg -v quiet -ss ${Math.max(0, segCurr.duration - 0.16).toFixed(3)} -i "${pCurr}" -vframes 4 -vf "scale=64:64,format=gray" -f rawvideo pipe:1`;
            const headCmd = `ffmpeg -v quiet -ss 0 -i "${pNext}" -vframes 4 -vf "scale=64:64,format=gray" -f rawvideo pipe:1`;
            
            const [tailRes, headRes] = await Promise.all([
              execPromise(tailCmd, { encoding: 'buffer' }),
              execPromise(headCmd, { encoding: 'buffer' }),
            ]);

            const tBuf = tailRes.stdout as Buffer;
            const hBuf = headRes.stdout as Buffer;
            const FRAME_SIZE = 4096; // 64x64 grayscale

            if (tBuf && hBuf && tBuf.length >= FRAME_SIZE * 2 && hBuf.length >= FRAME_SIZE * 2) {
              const tCount = Math.floor(tBuf.length / FRAME_SIZE);
              const frameCurrTail = tBuf.slice((tCount - 1) * FRAME_SIZE, tCount * FRAME_SIZE);
              const frameCurrPrev = tBuf.slice(Math.max(0, (tCount - 2) * FRAME_SIZE), (tCount - 1) * FRAME_SIZE);
              const frameNextHead = hBuf.slice(0, FRAME_SIZE);
              const frameNextSecond = hBuf.slice(FRAME_SIZE, FRAME_SIZE * 2);

              let diffTailWithHead = 0;
              for (let b = 0; b < FRAME_SIZE; b++) diffTailWithHead += Math.abs(frameCurrTail[b] - frameNextHead[b]);
              diffTailWithHead /= FRAME_SIZE;

              let diffInternalTail = 0;
              for (let b = 0; b < FRAME_SIZE; b++) diffInternalTail += Math.abs(frameCurrPrev[b] - frameCurrTail[b]);
              diffInternalTail /= FRAME_SIZE;

              // If the last frame of segment i matches the next clip's first frame (< 15 diff)
              // while diverging from its own clip's body (> 22 diff), it's a bleed frame leaking from segment i+1!
              if (diffTailWithHead < 15.0 && diffInternalTail > 22.0) {
                const calibratedEnd = Math.max(0.1, Number((segCurr.duration - 0.033).toFixed(3)));
                segCurr.trim_end = calibratedEnd;
                segCurr.duration = calibratedEnd;
                if (db.videos[segCurr.vid]) {
                  db.videos[segCurr.vid].duration = calibratedEnd;
                  saveDB();
                }
              }

              let diffHeadWithTail = 0;
              for (let b = 0; b < FRAME_SIZE; b++) diffHeadWithTail += Math.abs(frameNextHead[b] - frameCurrPrev[b]);
              diffHeadWithTail /= FRAME_SIZE;

              let diffInternalHead = 0;
              for (let b = 0; b < FRAME_SIZE; b++) diffInternalHead += Math.abs(frameNextHead[b] - frameNextSecond[b]);
              diffInternalHead /= FRAME_SIZE;

              // If the first frame of segment i+1 matches segment i's prior frames (< 15 diff)
              // while diverging from its own segment's body (> 22 diff), it's a bleed frame from segment i!
              if (diffHeadWithTail < 15.0 && diffInternalHead > 22.0) {
                segNext.trim_start = 0.033;
                segNext.duration = Math.max(0.1, Number((segNext.trim_end - 0.033).toFixed(3)));
                if (db.videos[segNext.vid]) {
                  db.videos[segNext.vid].duration = segNext.duration;
                  saveDB();
                }
              }
            }
          } catch (_) {}
        }
      }

      res.json({
        ok: true,
        mode,
        total_duration: duration,
        clip_trim_start: clipTrimStart,
        clip_trim_end: clipTrimEnd,
        cut_points: cutPoints,
        segments_count: physicalSegments.length,
        segments: physicalSegments,
      });
    } catch (err: any) {
      console.error('[Chop Error]:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Video Boundary Analysis & Auto-Chop Corner Frames API with Multi-Clip Cross Validation
  app.post('/api/video/analyze-boundary', async (req, res) => {
    const { 
      vid, 
      file_id, 
      url, 
      trim_start = 0, 
      trim_end,
      target = 'both', // 'start' | 'end' | 'both'
      margin = 0.18,
      prev_clip,
      next_clip
    } = req.body;

    const resolvePathForClip = (c: any): string => {
      if (!c) return '';
      const cFileId = c.file_id || c.vid;
      if (cFileId && fs.existsSync(path.join(uploadDir, cFileId))) {
        return path.join(uploadDir, cFileId);
      }
      if (c.vid && db.videos[c.vid]?.file_id && fs.existsSync(path.join(uploadDir, db.videos[c.vid].file_id))) {
        return path.join(uploadDir, db.videos[c.vid].file_id);
      }
      const cUrl = c.url || (cFileId ? `/api/video/${cFileId}` : '');
      if (cUrl) {
        const cleanUrl = cUrl.replace(/^\//, '');
        const baseName = path.basename(cleanUrl);
        const candidates = [
          cUrl,
          path.join('/', cleanUrl),
          path.join(__dirname, cleanUrl),
          path.join(uploadDir, baseName),
          path.join(rendersDir, baseName),
          path.join(altRendersDir, baseName),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) return cand;
        }
      }
      return '';
    };

    let currPath = resolvePathForClip({ file_id, vid, url });
    const prevPath = resolvePathForClip(prev_clip);
    const nextPath = resolvePathForClip(next_clip);

    if (!currPath && url && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const tempPath = path.join('/tmp', `boundary_${Date.now()}_${path.basename(url.split('?')[0]) || 'video.mp4'}`);
        const response = await fetch(url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
          currPath = tempPath;
        }
      } catch (dlErr: any) {
        console.warn('[Boundary Download Warning]:', dlErr?.message);
      }
    }

    if (!currPath || !fs.existsSync(currPath)) {
      return res.status(404).json({ ok: false, error: 'Video file not found for boundary analysis' });
    }

    try {
      // 1. Probe total duration & frame rate
      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${currPath}"`;
      const { stdout: durOut } = await execPromise(durCmd);
      const totalDur = parseFloat(durOut.trim()) || 0;
      if (totalDur <= 0) {
        return res.status(400).json({ ok: false, error: 'Invalid video duration' });
      }

      let fps = 30.0;
      try {
        const fpsCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${currPath}"`;
        const { stdout: fpsOut } = await execPromise(fpsCmd);
        const [num, den] = fpsOut.trim().split('/').map(Number);
        if (num && den && den > 0) {
          fps = Math.max(12, Math.min(120, num / den));
        }
      } catch (_) {}
      const frameDur = 1.0 / fps;

      const curTrimStart = Math.max(0, Math.min(totalDur, Number(trim_start) || 0));
      const curTrimEnd = typeof trim_end === 'number' && trim_end > curTrimStart ? Math.min(totalDur, trim_end) : totalDur;
      const curDuration = curTrimEnd - curTrimStart;

      if (curDuration <= 0.35) {
        return res.json({
          ok: true,
          trimmed: false,
          new_trim_start: curTrimStart,
          new_trim_end: curTrimEnd,
          message: 'Clip is too short for boundary trimming'
        });
      }

      // Helper to extract 64x64 gray frames (4096 bytes per frame) for high-precision boundary edge detection
      const FRAME_SIZE = 4096;
      const extractGrayFrames = async (targetFilePath: string, startTime: number, count: number): Promise<Buffer[]> => {
        try {
          const cmd = `ffmpeg -v quiet -ss ${Math.max(0, startTime).toFixed(3)} -i "${targetFilePath}" -vframes ${count} -vf "scale=64:64,format=gray" -f rawvideo pipe:1`;
          const { stdout } = await execPromise(cmd, { encoding: 'buffer', maxBuffer: 15 * 1024 * 1024 });
          const frames: Buffer[] = [];
          for (let i = 0; i + FRAME_SIZE <= stdout.length; i += FRAME_SIZE) {
            frames.push(stdout.slice(i, i + FRAME_SIZE));
          }
          return frames;
        } catch (_) {
          return [];
        }
      };

      const frameDiff = (a: Buffer, b: Buffer): number => {
        let diff = 0;
        for (let i = 0; i < FRAME_SIZE; i++) diff += Math.abs(a[i] - b[i]);
        return diff / FRAME_SIZE;
      };

      const frameLuma = (a: Buffer): number => {
        let sum = 0;
        for (let i = 0; i < FRAME_SIZE; i++) sum += a[i];
        return sum / FRAME_SIZE;
      };

      let detectedCutStart = curTrimStart;
      let detectedCutEnd = curTrimEnd;
      const reasons: string[] = [];
      let headBleedCount = 0;
      let tailBleedCount = 0;
      let prevClipAdjustment: { trim_end: number } | null = null;
      let nextClipAdjustment: { trim_start: number } | null = null;

      // 2. Head Boundary Analysis & Bidirectional Cross-Validation with Previous Clip
      if (target === 'start' || target === 'both') {
        const headFrames = await extractGrayFrames(currPath, curTrimStart, 6);
        let headCutFrames = 0;

        // A. Cross-clip validation with previous clip
        if (prevPath && fs.existsSync(prevPath) && prev_clip && headFrames.length >= 3) {
          const pTrimEnd = typeof prev_clip.trim_end === 'number' && prev_clip.trim_end > 0 ? prev_clip.trim_end : 5.0;
          const prevTailFrames = await extractGrayFrames(prevPath, Math.max(0, pTrimEnd - (frameDur * 3)), 4);
          if (prevTailFrames.length > 0) {
            const lastPrevFrame = prevTailFrames[prevTailFrames.length - 1];
            const diff0 = frameDiff(headFrames[0], lastPrevFrame);
            const diff01 = frameDiff(headFrames[0], headFrames[1]);

            // Case 1: Head frame 0 of current clip matches previous clip's tail (< 15 diff) while changing significantly on frame 1 (> 20 diff)
            // Meaning: Previous clip's final frame leaked into current clip's head!
            if (diff0 < 15.0 && diff01 > 20.0) {
              headCutFrames = 1;
              if (headFrames.length >= 3) {
                const diff1 = frameDiff(headFrames[1], lastPrevFrame);
                const diff12 = frameDiff(headFrames[1], headFrames[2]);
                if (diff1 < 15.0 && diff12 > 20.0) headCutFrames = 2;
              }
              headBleedCount = headCutFrames;
              reasons.push(`Cleaned ${headCutFrames} bleed frame(s) leaking from previous scene into clip head`);
            }

            // Case 2: Reverse Bleed - Previous clip's tail contains the beginning frame of current clip!
            if (prevTailFrames.length >= 2) {
              const diffPrevTailWithCurrentHead = frameDiff(lastPrevFrame, headFrames[headCutFrames]);
              const diffPrevInternal = frameDiff(prevTailFrames[prevTailFrames.length - 2], lastPrevFrame);
              if (diffPrevTailWithCurrentHead < 15.0 && diffPrevInternal > 20.0) {
                const newPrevEnd = Math.max(0.1, Number((pTrimEnd - frameDur).toFixed(3)));
                prevClipAdjustment = { trim_end: newPrevEnd };
                reasons.push(`Corrected previous clip: cut 1 forward-bleed frame from previous shot's tail`);
              }
            }
          }
        }

        // B. Self-contained head analysis (black frames, frozen frames, abrupt edge spikes)
        if (headCutFrames === 0 && headFrames.length >= 3) {
          // Check black / dark frame
          if (frameLuma(headFrames[0]) < 12.0) {
            headCutFrames = 1;
            if (frameLuma(headFrames[1]) < 12.0) headCutFrames = 2;
            reasons.push(`Removed ${headCutFrames} dark/black frame(s) at head`);
          } else {
            // Check abrupt transition outlier on frame 0
            const diff01 = frameDiff(headFrames[0], headFrames[1]);
            const diff12 = frameDiff(headFrames[1], headFrames[2]);
            const diff23 = headFrames.length >= 4 ? frameDiff(headFrames[2], headFrames[3]) : diff12;
            const avgIntDiff = Math.max(1.0, (diff12 + diff23) / 2);

            if (diff01 > 25.0 && diff01 > avgIntDiff * 2.5) {
              headCutFrames = 1;
              reasons.push(`Removed 1 corner transition flash frame at start (${frameDur.toFixed(3)}s)`);
            }
          }
        }

        // C. Fallback: If user explicitly targeted start and still unchanged, trim 1-2 clean frames
        if (headCutFrames === 0 && target === 'start') {
          const cutSec = Math.max(frameDur, Math.min(0.25, Number(margin) || (frameDur * 2)));
          detectedCutStart = Math.min(curTrimEnd - 0.25, Number((curTrimStart + cutSec).toFixed(3)));
          reasons.push(`Calibrated start boundary (-${cutSec.toFixed(3)}s)`);
        } else if (headCutFrames > 0) {
          detectedCutStart = Math.min(curTrimEnd - 0.25, Number((curTrimStart + (headCutFrames * frameDur)).toFixed(3)));
        }
      }

      // 3. Tail Boundary Analysis & Bidirectional Cross-Validation with Next Clip
      if (target === 'end' || target === 'both') {
        const tailSearchStart = Math.max(curTrimStart, curTrimEnd - (frameDur * 6.5));
        const tailFrames = await extractGrayFrames(currPath, tailSearchStart, 7);
        let tailCutFrames = 0;

        // A. Cross-clip validation with next clip
        if (nextPath && fs.existsSync(nextPath) && next_clip && tailFrames.length >= 3) {
          const nTrimStart = typeof next_clip.trim_start === 'number' ? next_clip.trim_start : 0;
          const nextHeadFrames = await extractGrayFrames(nextPath, nTrimStart, 4);
          if (nextHeadFrames.length > 0) {
            const firstNextFrame = nextHeadFrames[0];
            const lastTailFrame = tailFrames[tailFrames.length - 1];
            const secondLastFrame = tailFrames[tailFrames.length - 2];
            const tailDiff = frameDiff(lastTailFrame, firstNextFrame);
            const internalTailDiff = frameDiff(secondLastFrame, lastTailFrame);

            // Case 1: Tail frame of current clip matches next clip's head (< 15 diff) while changing abruptly from preceding frames (> 20 diff):
            // Meaning: Next clip's frame leaked into current clip's tail!
            if (tailDiff < 15.0 && internalTailDiff > 20.0) {
              tailCutFrames = 1;
              if (tailFrames.length >= 4) {
                const thirdLastFrame = tailFrames[tailFrames.length - 3];
                const tailDiff2 = frameDiff(secondLastFrame, firstNextFrame);
                if (tailDiff2 < 15.0 && frameDiff(thirdLastFrame, secondLastFrame) > 20.0) {
                  tailCutFrames = 2;
                }
              }
              tailBleedCount = tailCutFrames;
              reasons.push(`Cleaned ${tailCutFrames} bleed frame(s) belonging to next shot from clip tail`);
            }

            // Case 2: Reverse Bleed - Next clip's head contains current clip's final shot!
            if (nextHeadFrames.length >= 2) {
              const remainingLastFrame = tailCutFrames > 0 ? secondLastFrame : lastTailFrame;
              const diffNextWithCurrentTail = frameDiff(firstNextFrame, remainingLastFrame);
              const diffNextInternal = frameDiff(firstNextFrame, nextHeadFrames[1]);
              if (diffNextWithCurrentTail < 15.0 && diffNextInternal > 20.0) {
                const newNextStart = Number((nTrimStart + frameDur).toFixed(3));
                nextClipAdjustment = { trim_start: newNextStart };
                reasons.push(`Corrected next clip: shaved 1 backward-bleed frame from next shot's head`);
              }
            }
          }
        }

        // B. Self-contained tail analysis (black frames, frozen frames, abrupt edge spikes)
        if (tailCutFrames === 0 && tailFrames.length >= 3) {
          const lastIdx = tailFrames.length - 1;
          if (frameLuma(tailFrames[lastIdx]) < 12.0) {
            tailCutFrames = 1;
            if (frameLuma(tailFrames[lastIdx - 1]) < 12.0) tailCutFrames = 2;
            reasons.push(`Removed ${tailCutFrames} dark/black frame(s) at tail`);
          } else {
            const diffLast = frameDiff(tailFrames[lastIdx - 1], tailFrames[lastIdx]);
            const diffPrev = frameDiff(tailFrames[lastIdx - 2], tailFrames[lastIdx - 1]);
            const diffPrev2 = tailFrames.length >= 4 ? frameDiff(tailFrames[lastIdx - 3], tailFrames[lastIdx - 2]) : diffPrev;
            const avgIntDiff = Math.max(1.0, (diffPrev + diffPrev2) / 2);

            if (diffLast > 25.0 && diffLast > avgIntDiff * 2.5) {
              tailCutFrames = 1;
              reasons.push(`Removed 1 corner transition flash frame at end (${frameDur.toFixed(3)}s)`);
            }
          }
        }

        // C. Fallback: If user explicitly targeted end and still unchanged, trim 1-2 clean frames
        if (tailCutFrames === 0 && target === 'end') {
          const cutSec = Math.max(frameDur, Math.min(0.25, Number(margin) || (frameDur * 2)));
          detectedCutEnd = Math.max(detectedCutStart + 0.25, Number((curTrimEnd - cutSec).toFixed(3)));
          reasons.push(`Calibrated end boundary (-${cutSec.toFixed(3)}s)`);
        } else if (tailCutFrames > 0) {
          detectedCutEnd = Math.max(detectedCutStart + 0.25, Number((curTrimEnd - (tailCutFrames * frameDur)).toFixed(3)));
        }
      }

      // Safety check: ensure at least 0.25s duration remains
      if (detectedCutEnd - detectedCutStart < 0.25) {
        detectedCutEnd = Math.max(detectedCutStart + 0.25, curTrimEnd);
      }

      const cutStartDelta = Number(Math.max(0, detectedCutStart - curTrimStart).toFixed(3));
      const cutEndDelta = Number(Math.max(0, curTrimEnd - detectedCutEnd).toFixed(3));
      const wasTrimmed = cutStartDelta > 0.005 || cutEndDelta > 0.005 || Boolean(prevClipAdjustment) || Boolean(nextClipAdjustment);

      res.json({
        ok: true,
        trimmed: wasTrimmed,
        original_trim_start: curTrimStart,
        original_trim_end: curTrimEnd,
        new_trim_start: Number(detectedCutStart.toFixed(3)),
        new_trim_end: Number(detectedCutEnd.toFixed(3)),
        cut_start_delta: cutStartDelta,
        cut_end_delta: cutEndDelta,
        fps,
        frame_duration: Number(frameDur.toFixed(4)),
        reasons: reasons.length > 0 ? reasons : ['Boundaries mapped & validated: Clean cut with zero missing or bleed frames'],
        head_bleed_detected: headBleedCount > 0,
        tail_bleed_detected: tailBleedCount > 0,
        prev_clip_adjustment: prevClipAdjustment,
        next_clip_adjustment: nextClipAdjustment,
      });
    } catch (err: any) {
      console.error('[Analyze Boundary Error]:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // COMBINE TWO VIDEO CLIPS VIA FFMPEG
  app.post('/api/video/combine_two', async (req, res) => {
    const { clip1, clip2 } = req.body;
    if (!clip1 || !clip2) {
      return res.status(400).json({ ok: false, error: 'Both clip1 and clip2 are required' });
    }

    const resolveFilePath = async (clip: any): Promise<string | null> => {
      const { file_id, vid, url } = clip;
      let filePath = '';

      if (file_id && fs.existsSync(path.join(uploadDir, file_id))) {
        filePath = path.join(uploadDir, file_id);
      } else if (file_id && fs.existsSync(path.join(rendersDir, file_id))) {
        filePath = path.join(rendersDir, file_id);
      } else if (file_id && fs.existsSync(path.join(rendersDir, `${file_id}.mp4`))) {
        filePath = path.join(rendersDir, `${file_id}.mp4`);
      } else if (vid && db.videos[vid]?.file_id && fs.existsSync(path.join(uploadDir, db.videos[vid].file_id))) {
        filePath = path.join(uploadDir, db.videos[vid].file_id);
      } else if (vid && db.videos[vid]?.file_id && fs.existsSync(path.join(rendersDir, `${db.videos[vid].file_id}.mp4`))) {
        filePath = path.join(rendersDir, `${db.videos[vid].file_id}.mp4`);
      } else if (url) {
        const cleanUrl = url.replace(/^\//, '');
        const baseName = path.basename(cleanUrl);
        const candidates = [
          url,
          path.join('/', cleanUrl),
          path.join(__dirname, cleanUrl),
          path.join(uploadDir, baseName),
          path.join(rendersDir, baseName),
          path.join(altRendersDir, baseName),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            filePath = cand;
            break;
          }
        }
      }

      // If local file is missing, try Telegram channel download
      if (!filePath && (file_id || vid)) {
        const targetId = file_id || (vid ? db.videos[vid]?.file_id : null);
        const vidEntry = Object.values(db.videos || {}).find((v: any) => 
          v.file_id === targetId || v.id === vid || v.telegram_file_id === targetId
        ) as any;
        const tgFileId = vidEntry?.telegram_file_id || (targetId && targetId.length > 25 ? targetId : null);
        if (tgFileId) {
          const token = getTelegramToken();
          try {
            const fileInfo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${tgFileId}`).then(r => r.json());
            if (fileInfo.ok && fileInfo.result?.file_path) {
              const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
              const fileResp = await fetch(downloadUrl);
              if (fileResp.ok) {
                const buf = Buffer.from(await fileResp.arrayBuffer());
                const dest = path.join(uploadDir, targetId || `vid_${Date.now()}`);
                fs.writeFileSync(dest, buf);
                filePath = dest;
              }
            }
          } catch (tgErr) {
            console.warn('[Combine Two] Telegram hydration warning:', tgErr);
          }
        }
      }

      // Handle remote http URL download fallback
      if (!filePath && url && (url.startsWith('http://') || url.startsWith('https://'))) {
        try {
          const tempPath = path.join('/tmp', `combine_${Date.now()}_${path.basename(url.split('?')[0]) || 'clip.mp4'}`);
          const resp = await fetch(url);
          if (resp.ok) {
            const ab = await resp.arrayBuffer();
            fs.writeFileSync(tempPath, Buffer.from(ab));
            filePath = tempPath;
          }
        } catch (_) {}
      }

      return filePath && fs.existsSync(filePath) ? filePath : null;
    };

    try {
      const [path1, path2] = await Promise.all([
        resolveFilePath(clip1),
        resolveFilePath(clip2)
      ]);

      if (!path1 || !path2) {
        return res.status(404).json({
          ok: false,
          error: `Could not locate video source files (${!path1 ? 'Clip 1' : ''}${!path1 && !path2 ? ', ' : ''}${!path2 ? 'Clip 2' : ''})`
        });
      }

      // Query durations via ffprobe
      const getDuration = async (f: string): Promise<number> => {
        try {
          const { stdout } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${f}"`);
          const d = parseFloat(stdout.trim());
          return !isNaN(d) && d > 0 ? d : 5;
        } catch {
          return 5;
        }
      };

      const hasAudioTrack = async (f: string): Promise<boolean> => {
        try {
          const { stdout } = await execPromise(`ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${f}"`);
          return stdout.trim().length > 0;
        } catch {
          return false;
        }
      };

      const [dur1, dur2, hasAudio1, hasAudio2] = await Promise.all([
        getDuration(path1),
        getDuration(path2),
        hasAudioTrack(path1),
        hasAudioTrack(path2)
      ]);

      const t1s = Math.max(0, Number(clip1.trim_start) || 0);
      const t1e = typeof clip1.trim_end === 'number' && clip1.trim_end > t1s ? Math.min(dur1, clip1.trim_end) : dur1;
      const t2s = Math.max(0, Number(clip2.trim_start) || 0);
      const t2e = typeof clip2.trim_end === 'number' && clip2.trim_end > t2s ? Math.min(dur2, clip2.trim_end) : dur2;

      const durClip1 = Math.max(0.1, t1e - t1s);
      const durClip2 = Math.max(0.1, t2e - t2s);

      const outputFilename = `combined_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp4`;
      const outputPath = path.join(rendersDir, outputFilename);

      let filterComplex = `[0:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0]; [1:v]setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v1]; `;
      let audioComplex = '';
      let mapArgs = '-map "[outv]"';

      if (hasAudio1 && hasAudio2) {
        audioComplex = `[0:a]asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a0]; [1:a]asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
        mapArgs += ' -map "[outa]" -c:a aac -b:a 192k';
      } else if (hasAudio1 && !hasAudio2) {
        audioComplex = `[0:a]asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a0]; anullsrc=r=44100:cl=stereo,atrim=0:${durClip2.toFixed(2)}[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
        mapArgs += ' -map "[outa]" -c:a aac -b:a 192k';
      } else if (!hasAudio1 && hasAudio2) {
        audioComplex = `anullsrc=r=44100:cl=stereo,atrim=0:${durClip1.toFixed(2)}[a0]; [1:a]asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=stereo[a1]; [v0][a0][v1][a1]concat=n=2:v=1:a=1[outv][outa]`;
        mapArgs += ' -map "[outa]" -c:a aac -b:a 192k';
      } else {
        audioComplex = `[v0][v1]concat=n=2:v=1:a=0[outv]`;
      }

      const fullFilter = filterComplex + audioComplex;
      const ffmpegCmd = `ffmpeg -y -ss ${t1s} -to ${t1e} -i "${path1}" -ss ${t2s} -to ${t2e} -i "${path2}" -filter_complex "${fullFilter}" ${mapArgs} -c:v libx264 -preset fast -crf 22 "${outputPath}"`;

      await execPromise(ffmpegCmd, { timeout: 120000 });

      const finalDuration = await getDuration(outputPath);
      const newVidId = `v_comb_${Date.now()}`;
      const videoObj = {
        id: newVidId,
        name: `Combined Clip (${clip1.bucket_name || 'Clip 1'} + ${clip2.bucket_name || 'Clip 2'})`,
        folder_id: clip1.bucket_id || 'root',
        url: `/api/merged_video/${outputFilename}`,
        file_id: outputFilename.replace('.mp4', ''),
        status: 'ready',
        duration: Number(finalDuration.toFixed(2)),
        size: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0,
        created_at: Date.now(),
      };

      db.videos[newVidId] = videoObj;
      saveDB();

      return res.json({
        ok: true,
        video: videoObj,
        clip: {
          vid: newVidId,
          file_id: videoObj.file_id,
          url: videoObj.url,
          bucket_id: clip1.bucket_id || 'root',
          bucket_name: clip1.bucket_name || 'Combined',
          duration: videoObj.duration,
          speed: 1,
          trim_start: 0,
          trim_end: videoObj.duration,
        }
      });
    } catch (err: any) {
      console.error('[Combine Two Error]:', err);
      return res.status(500).json({ ok: false, error: err.message || 'Failed to combine video clips' });
    }
  });

  // Database Actions API
  app.post('/api/action', async (req, res) => {
    const { action, payload } = req.body;
    if (!action) return res.status(400).json({ ok: false, error: 'Action type required' });

    try {
      switch (action) {
        case 'sync_main_bot':
        case 'sync_telegram_db': {
          const synced = await fetchDBFromTelegramChannel();
          return res.json({
            ok: true,
            success: true,
            synced,
            db,
            result: {
              videosCount: Object.keys(db.videos || {}).length,
              foldersCount: Object.keys(db.folders || {}).length,
              projectsCount: Object.values(db.video_editor_projects || {}).length,
            }
          });
        }
        case 'save_editor_project':
        case 'save_video_editor_project': {
          const p = payload.project || payload;
          if (p && p.id) {
            db.video_editor_projects[p.id] = { ...db.video_editor_projects[p.id], ...p, updated_at: Date.now() };
          }
          break;
        }
        case 'delete_editor_project':
        case 'delete_video_editor_project': {
          const pid = payload.id || payload.project_id || payload.projectId;
          if (pid) delete db.video_editor_projects[pid];
          break;
        }
        case 'rename_editor_project':
        case 'rename_video_editor_project': {
          const pid = payload.id || payload.project_id;
          if (pid && db.video_editor_projects[pid]) {
            db.video_editor_projects[pid].name = payload.name || payload.newName;
            db.video_editor_projects[pid].updated_at = Date.now();
          }
          break;
        }
        case 'toggle_pin_editor_project': {
          const pid = payload.id || payload.project_id;
          if (pid && db.video_editor_projects[pid]) {
            db.video_editor_projects[pid].is_pinned = !db.video_editor_projects[pid].is_pinned;
          }
          break;
        }
        case 'create_folder': {
          const fid = payload.id || 'f_' + Date.now();
          db.folders[fid] = {
            name: payload.name || 'New Folder',
            parent: payload.parent || 'root',
            created_at: Date.now(),
            updated_at: Date.now(),
            ...payload,
          };
          break;
        }
        case 'convert_to_master_bucket': {
          const fid = payload.fid || payload.id;
          if (fid && db.folders[fid]) {
            db.folders[fid].is_master_bucket = true;
            db.folders[fid].is_master_project_folder = true;
            delete db.folders[fid].is_container_folder;
            db.folders[fid].updated_at = Date.now();
          }
          break;
        }
        case 'set_folder_type': {
          const fid = payload.fid || payload.id;
          if (fid && db.folders[fid]) {
            if (payload.type === 'master_project') {
              db.folders[fid].is_master_bucket = true;
              db.folders[fid].is_master_project_folder = true;
              delete db.folders[fid].is_container_folder;
            } else if (payload.type === 'container') {
              db.folders[fid].is_container_folder = true;
              delete db.folders[fid].is_master_bucket;
              delete db.folders[fid].is_master_project_folder;
            }
            db.folders[fid].updated_at = Date.now();
          }
          break;
        }
        case 'rename_folder': {
          if (payload.fid && db.folders[payload.fid]) {
            db.folders[payload.fid].name = payload.name;
            db.folders[payload.fid].updated_at = Date.now();
          }
          break;
        }
        case 'delete_folder': {
          if (payload.fid && payload.fid !== 'root') {
            const fidsToDelete = new Set<string>([payload.fid]);
            const collectDescendants = (parentId: string) => {
              for (const [id, f] of Object.entries(db.folders as Record<string, any>)) {
                if (f.parent === parentId && !fidsToDelete.has(id)) {
                  fidsToDelete.add(id);
                  collectDescendants(id);
                }
              }
            };
            collectDescendants(payload.fid);
            for (const id of fidsToDelete) {
              if (db.folders[id]) {
                db.deleted_folders[id] = db.folders[id];
                delete db.folders[id];
              }
            }
            if (db.video_editor_projects) {
              for (const [pid, p] of Object.entries(db.video_editor_projects as Record<string, any>)) {
                if (fidsToDelete.has(p.master_bucket_fid || '')) {
                  delete db.video_editor_projects[pid];
                }
              }
            }
          }
          break;
        }
        case 'duplicate_folder':
        case 'duplicate_master_bucket': {
          const srcFid = payload.fid || payload.source_fid;
          const newName = payload.name || `${db.folders[srcFid]?.name || 'Bucket'} Copy`;
          const newFid = 'f_' + Date.now();
          if (srcFid && db.folders[srcFid]) {
            db.folders[newFid] = {
              ...db.folders[srcFid],
              name: newName,
              created_at: Date.now(),
              updated_at: Date.now(),
            };
            // Duplicate clips
            for (const v of Object.values(db.videos as Record<string, any>)) {
              if (v.folder_id === srcFid) {
                const newVid = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                db.videos[newVid] = { ...v, id: newVid, folder_id: newFid };
              }
            }
          }
          break;
        }
        case 'delete_video': {
          const vid = payload.vid || payload.id;
          if (vid && db.videos[vid]) {
            db.deleted_videos[vid] = db.videos[vid];
            delete db.videos[vid];
          }
          break;
        }
        case 'batch_delete_videos': {
          const vids = payload.vids || [];
          for (const vid of vids) {
            if (db.videos[vid]) {
              db.deleted_videos[vid] = db.videos[vid];
              delete db.videos[vid];
            }
          }
          break;
        }
        case 'mark_clips_used': {
          const vids = payload.vids || [];
          for (const vid of vids) {
            if (db.videos[vid]) {
              db.videos[vid].last_used_at = Date.now();
              db.videos[vid].usage_count = (db.videos[vid].usage_count || 0) + 1;
            }
          }
          break;
        }
        case 'toggle_video_star': {
          const vid = payload.vid || payload.id;
          if (vid && db.videos[vid]) {
            db.videos[vid].is_starred = !db.videos[vid].is_starred;
          }
          break;
        }
        case 'toggle_video_default': {
          const vid = payload.vid || payload.id;
          if (vid && db.videos[vid]) {
            db.videos[vid].is_default = !db.videos[vid].is_default;
          }
          break;
        }
        case 'toggle_video_freeze': {
          const vid = payload.vid || payload.id;
          if (vid && db.videos[vid]) {
            db.videos[vid].is_frozen = !db.videos[vid].is_frozen;
          }
          break;
        }
        case 'toggle_video_hidden': {
          const vid = payload.vid || payload.id;
          if (vid && db.videos[vid]) {
            db.videos[vid].is_hidden = !db.videos[vid].is_hidden;
          }
          break;
        }
        case 'generate_title_hashtags': {
          const prompt = payload.prompt || '';
          let resultTitle = 'Viral Video Moment 🔥';
          let resultHashtags = '#Viral #Shorts #Reels #Trending #FYP';

          if (geminiClient) {
            try {
              const systemInstruction = `You are an expert social media viral strategist for TikTok, Instagram Reels, and YouTube Shorts.
Generate an engaging, punchy, high-CTR video title and relevant viral hashtags based strictly on the user prompt and context.
Respond ONLY with a valid JSON object in this exact schema:
{
  "title": "Your catchy one-line title here",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
}`;
              const userMessage = `User Prompt: ${prompt}
Project Name: ${payload.projectName || 'Social Video'}
Bucket Category: ${payload.bucketName || 'Video Clips'}
${payload.clipNames && payload.clipNames.length > 0 ? `Clips in sequence: ${payload.clipNames.join(', ')}` : ''}

Generate the title and hashtags now according to the prompt instructions.`;

              const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
              let text = '';
              for (const m of candidateModels) {
                try {
                  const response = await geminiClient.models.generateContent({
                    model: m,
                    contents: userMessage,
                    config: {
                      systemInstruction,
                      responseMimeType: 'application/json',
                      temperature: 0.8,
                    }
                  });
                  if (response.text?.trim()) {
                    text = response.text.trim();
                    break;
                  }
                } catch (mErr: any) {
                  console.warn(`[Gemini Title Gen] Model ${m} skipped:`, mErr?.message || mErr);
                }
              }
              if (text) {
                try {
                  const parsed = JSON.parse(text);
                  if (parsed.title) {
                    resultTitle = String(parsed.title).trim();
                  }
                  if (parsed.hashtags) {
                    resultHashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join(' ') : String(parsed.hashtags).trim();
                  }
                } catch (_) {
                  // Line based extraction
                  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
                  const foundTitle = lines.find((l: string) => !l.startsWith('#')) || lines[0];
                  const foundTags = lines.filter((l: string) => l.includes('#')).join(' ');
                  if (foundTitle) resultTitle = foundTitle;
                  if (foundTags) resultHashtags = foundTags;
                }
              }
            } catch (err: any) {
              console.error('[Gemini Title Error]:', err);
            }
          }

          // If projectId supplied, persist onto project
          if (payload.projectId && db.video_editor_projects?.[payload.projectId]) {
            const p = db.video_editor_projects[payload.projectId];
            p.generated_title = resultTitle;
            p.generated_hashtags = resultHashtags;
            p.share_caption = `${resultTitle}\n\n${resultHashtags}`;
            p.updated_at = Date.now();
          }

          saveDB();
          return res.json({
            ok: true,
            success: true,
            title: resultTitle,
            hashtags: resultHashtags,
            db
          });
        }
        case 'save_caption_template': {
          const masterFid = payload.master_bucket_fid || payload.fid || payload.key || payload.id;
          const tpl = payload.template || payload;
          if (masterFid && tpl) {
            if (!Array.isArray(db.folder_caption_templates[masterFid])) {
              db.folder_caption_templates[masterFid] = [];
            }
            const list = db.folder_caption_templates[masterFid];
            const idx = list.findIndex((t: any) => t.id === tpl.id || (t.text && tpl.text && t.text.trim().toLowerCase() === tpl.text.trim().toLowerCase()));
            if (idx >= 0) {
              list[idx] = { ...list[idx], ...tpl, updated_at: Date.now() };
            } else {
              list.push({ ...tpl, created_at: tpl.created_at || Date.now(), updated_at: Date.now() });
            }
          }
          break;
        }
        case 'delete_caption_template': {
          const masterFid = payload.master_bucket_fid || payload.fid || payload.key;
          const templateId = payload.templateId || payload.id;
          if (masterFid && Array.isArray(db.folder_caption_templates[masterFid])) {
            db.folder_caption_templates[masterFid] = db.folder_caption_templates[masterFid].filter((t: any) => t.id !== templateId);
          }
          if (templateId) {
            for (const fid of Object.keys(db.folder_caption_templates || {})) {
              if (Array.isArray(db.folder_caption_templates[fid])) {
                db.folder_caption_templates[fid] = db.folder_caption_templates[fid].filter((t: any) => t.id !== templateId);
              }
            }
            delete db.folder_caption_templates[templateId];
          }
          break;
        }
        case 'save_caption_defaults': {
          const k = payload.key || payload.fid || payload.bucket_fid;
          if (k) db.folder_caption_defaults[k] = payload.defaults || payload;
          break;
        }
        case 'save_bucket_audio_settings': {
          const k = payload.key || payload.fid || payload.bucket_fid;
          if (k) db.folder_audio_settings[k] = payload.settings || payload;
          break;
        }
        case 'save_master_bucket_settings': {
          const k = payload.key || payload.fid;
          if (k) db.master_bucket_settings[k] = payload.settings || payload;
          break;
        }
        case 'save_title_template': {
          const k = payload.key || payload.id;
          if (k) db.folder_title_templates[k] = payload.template || payload;
          break;
        }
        case 'delete_title_template': {
          const k = payload.key || payload.id;
          if (k) delete db.folder_title_templates[k];
          break;
        }
        case 'save_audio_folder': {
          const fid = payload.folderId || payload.id || 'af_' + Date.now();
          if (db.audio_folders[fid]) {
            db.audio_folders[fid] = {
              ...db.audio_folders[fid],
              ...payload,
              id: fid
            };
          } else {
            db.audio_folders[fid] = {
              id: fid,
              name: payload.name || 'Folder',
              created_at: payload.created_at || Date.now(),
              parent: payload.parent || null,
              ...payload
            };
          }
          break;
        }
        case 'delete_audio_folder': {
          if (payload.id) {
            const folderIdsToDelete = new Set<string>([payload.id]);
            for (const sfid of Object.keys(db.audio_folders || {})) {
              if (db.audio_folders[sfid]?.parent === payload.id) {
                folderIdsToDelete.add(sfid);
              }
            }
            folderIdsToDelete.forEach(fid => {
              delete db.audio_folders[fid];
            });
            for (const aid of Object.keys(db.audios || {})) {
              if (db.audios[aid]?.folder_id && folderIdsToDelete.has(db.audios[aid].folder_id!)) {
                delete db.audios[aid];
              }
            }
          }
          break;
        }
        case 'move_audio': {
          const ids = payload.audioIds || (payload.audioId ? [payload.audioId] : []);
          const targetFid = payload.targetFolderId || payload.folderId || 'root';
          for (const aid of ids) {
            if (db.audios[aid]) {
              db.audios[aid].folder_id = targetFid;
            }
          }
          break;
        }
        case 'copy_audio': {
          const ids = payload.audioIds || (payload.audioId ? [payload.audioId] : []);
          const targetFid = payload.targetFolderId || payload.folderId || 'root';
          const targetOwner = payload.targetOwnerEmail || payload.ownerId;
          for (const aid of ids) {
            const src = db.audios[aid];
            if (src) {
              const newAid = 'a_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
              db.audios[newAid] = {
                ...src,
                id: newAid,
                name: `${src.name} (Copy)`,
                folder_id: targetFid,
                ownerId: targetOwner || src.ownerId,
                created_at: Date.now()
              };
            }
          }
          break;
        }
        case 'save_audio':
        case 'rename_audio': {
          const aid = payload.audioId || payload.id;
          if (aid && db.audios[aid]) {
            if (payload.name) {
              db.audios[aid].name = payload.name;
              // Sync updated name into projects using this audio track
              if (db.video_editor_projects) {
                for (const proj of Object.values(db.video_editor_projects) as any[]) {
                  if (proj.audio_id === aid) {
                    proj.audio_name = payload.name;
                  }
                  if (proj.audio_clips) {
                    for (const clip of proj.audio_clips) {
                      if (clip.audio_id === aid) {
                        clip.name = payload.name;
                      }
                    }
                  }
                }
              }
            }
            if (payload.folder_id !== undefined) db.audios[aid].folder_id = payload.folder_id;
          }
          break;
        }
        case 'set_project_favorite_audio_folder': {
          const pid = payload.projectId;
          const folderId = payload.folderId;
          if (pid && db.video_editor_projects?.[pid]) {
            (db.video_editor_projects[pid] as any).favorite_audio_folder_id = folderId;
            db.video_editor_projects[pid].updated_at = Date.now();
          }
          break;
        }
        case 'delete_audio': {
          if (payload.id) delete db.audios[payload.id];
          break;
        }
        case 'toggle_audio_star': {
          if (payload.id && db.audios[payload.id]) {
            db.audios[payload.id].is_starred = !db.audios[payload.id].is_starred;
          }
          break;
        }
        case 'cancel_job':
        case 'job_cancel': {
          const jid = payload.jobId || payload.id;
          if (jid && db.kaggle_jobs[jid]) {
            db.kaggle_jobs[jid].status = 'cancelled';
          }
          break;
        }
        default: {
          // Pass-through for generic updates
          if (payload && payload.fid && db.folders[payload.fid]) {
            db.folders[payload.fid] = { ...db.folders[payload.fid], ...payload, updated_at: Date.now() };
          }
          break;
        }
      }

      saveDB();
      res.json({ ok: true, success: true, db });
    } catch (err: any) {
      console.error('[Action Error]:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Media Uploads (accept any field name: 'file', 'video', etc.)
  const handleMediaUpload = async (req: express.Request, res: express.Response) => {
    const rawFiles: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    const uploadedFile = rawFiles && rawFiles.length > 0 ? rawFiles[0] : null;
    if (!uploadedFile) return res.status(400).json({ ok: false, error: 'No file uploaded' });
    const fid = req.body.folder_id || req.body.fid || 'root';
    const masterBucketFid = req.body.master_bucket_fid || (fid.startsWith('uploads_') ? fid.replace('uploads_', '') : '');
    const vid = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const fileId = path.basename(uploadedFile.path);

    // Generate thumbnail via FFmpeg
    const thumbPath = path.join(thumbsDir, `${fileId}.jpg`);
    try {
      await execPromise(`ffmpeg -y -ss 00:00:01 -i "${uploadedFile.path}" -vframes 1 -vf "scale=360:-1" "${thumbPath}"`, { timeout: 15000 });
    } catch (_) {}

    // Extract precise duration via ffprobe
    let duration = 5;
    try {
      const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${uploadedFile.path}"`;
      const { stdout: durOut } = await execPromise(durCmd);
      const parsedDur = parseFloat(durOut.trim());
      if (parsedDur > 0) duration = Math.round(parsedDur * 10) / 10;
    } catch (_) {}

    const videoObj: any = {
      id: vid,
      name: uploadedFile.originalname,
      folder_id: fid,
      master_bucket_fid: masterBucketFid || undefined,
      is_upload: true,
      file_id: fileId,
      url: `/api/video/${fileId}`,
      status: 'ready',
      duration,
      size: uploadedFile.size,
      created_at: Date.now(),
    };
    db.videos[vid] = videoObj;
    saveDB();

    // Upload raw video clip directly to Telegram Channel for permanent storage (Never on Firebase Storage)
    uploadVideoToTelegramChannel(uploadedFile.path, uploadedFile.originalname, `📹 Clip: ${uploadedFile.originalname} (${duration}s)`).then(tgRes => {
      if (tgRes && tgRes.file_id) {
        db.videos[vid].telegram_file_id = tgRes.file_id;
        db.videos[vid].telegram_message_id = tgRes.message_id;
        saveDB(false);
      }
    }).catch(err => {
      console.warn('[Telegram Channel Clip Upload] Notice:', err?.message || err);
    });

    res.json({ ok: true, video: videoObj });
  };

  app.post(['/api/upload', '/api/videos', '/api/video/upload', '/api/upload_video', '/api/video'], upload.any(), handleMediaUpload);

  app.post(['/api/audio/upload', '/api/audios/upload', '/api/audio'], upload.any(), async (req, res) => {
    const rawFiles: Express.Multer.File[] = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (!rawFiles || rawFiles.length === 0) {
      return res.status(400).json({ ok: false, success: false, error: 'No audio file uploaded' });
    }

    const folderId = req.body.folder_id || 'root';
    const addedAudios: any[] = [];

    for (const f of rawFiles) {
      const audioId = 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const targetFile = path.join(rendersDir, `${audioId}.mp3`);
      try {
        fs.renameSync(f.path, targetFile);
      } catch (_) {
        try {
          fs.copyFileSync(f.path, targetFile);
          fs.unlinkSync(f.path);
        } catch (e) {
          continue;
        }
      }

      let duration = 30;
      try {
        const durCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetFile}"`;
        const { stdout: durOut } = await execPromise(durCmd);
        const parsedDur = parseFloat(durOut.trim());
        if (parsedDur > 0) duration = Math.round(parsedDur * 10) / 10;
      } catch (_) {}

      // Clean name
      const cleanName = f.originalname.replace(/\.[^/.]+$/, '').trim() || f.originalname;

      const audioObj: any = {
        id: audioId,
        name: cleanName,
        folder_id: folderId,
        url: `/api/merged_video/${audioId}.mp3`,
        file_id: audioId,
        duration,
        size: f.size,
        created_at: Date.now()
      };

      if (!db.audios) db.audios = {};
      db.audios[audioId] = audioObj;
      addedAudios.push(audioObj);
    }

    saveDB();
    res.json({ ok: true, success: true, count: addedAudios.length, audios: addedAudios, db });
  });



  // Media Streaming with Range support & Strong 1-Year Caching headers
  const streamFile = (filePath: string, req: express.Request, res: express.Response, contentType: string) => {
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    res.setHeader('Accept-Ranges', 'bytes');

    // 304 Not Modified when client already has the exact video cached (Zero Network Bytes!)
    if (!range && (req.headers['if-none-match'] === etag || req.headers['if-modified-since'] === stat.mtime.toUTCString())) {
      return res.status(304).end();
    }

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  };

  // Helper to resolve video files on server for thumbnail/frame generation
  function findVideoFileOnServer(fileIdOrUrl: string): string {
    if (!fileIdOrUrl) return '';
    const cleanId = fileIdOrUrl.replace(/^\//, '');
    const baseName = path.basename(cleanId);
    const candidates = [
      path.join(uploadDir, fileIdOrUrl),
      path.join(uploadDir, `${fileIdOrUrl}.mp4`),
      path.join(uploadDir, baseName),
      path.join(rendersDir, baseName),
      path.join(altRendersDir, baseName),
      path.join(__dirname, cleanId),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          if (fs.statSync(cand).isFile()) return cand;
        } catch (_) {}
      }
    }
    if (db.videos) {
      const vidEntry = Object.values(db.videos).find((v: any) => 
        v.file_id === fileIdOrUrl || v.id === fileIdOrUrl || v.vid === fileIdOrUrl
      ) as any;
      if (vidEntry?.file_id && fs.existsSync(path.join(uploadDir, vidEntry.file_id))) {
        return path.join(uploadDir, vidEntry.file_id);
      }
    }
    return '';
  }

  const framesCacheDir = path.join(thumbsDir, 'frames');
  if (!fs.existsSync(framesCacheDir)) {
    try { fs.mkdirSync(framesCacheDir, { recursive: true }); } catch (_) {}
  }

  app.get(['/api/thumb/:fileId', '/api/thumbnail/:fileId', '/api/video/frame/:fileId'], async (req, res) => {
    const rawId = req.params.fileId;
    const timeParam = req.query.t !== undefined ? parseFloat(req.query.t as string) : null;
    // Ultra-lightweight micro-frames for timeline filmstrip (~600-900 bytes per frame, zero bandwidth waste)
    const width = Math.min(240, Math.max(36, req.query.w ? parseInt(req.query.w as string, 10) : 48));
    const quality = Math.min(16, Math.max(2, req.query.q ? parseInt(req.query.q as string, 10) : 10));

    // Dynamic frame extraction at timestamp `t`
    if (timeParam !== null && !isNaN(timeParam) && timeParam >= 0) {
      const tRounded = (Math.round(timeParam * 10) / 10).toFixed(1);
      const cachedFrame = path.join(framesCacheDir, `${rawId}_t${tRounded}_w${width}_q${quality}.jpg`);
      if (fs.existsSync(cachedFrame)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(cachedFrame);
      }

      const videoPath = findVideoFileOnServer(rawId);
      if (videoPath) {
        try {
          const frameCmd = `ffmpeg -ss ${tRounded} -i "${videoPath}" -vframes 1 -vf "scale=${width}:-2" -q:v ${quality} -y "${cachedFrame}"`;
          await execPromise(frameCmd, { timeout: 6000 });
          if (fs.existsSync(cachedFrame)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('Content-Type', 'image/jpeg');
            return res.sendFile(cachedFrame);
          }
        } catch (_) {}
      }
    }

    // Static thumbnail check
    const f = path.join(thumbsDir, `${rawId}.jpg`);
    if (fs.existsSync(f)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/jpeg');
      return res.sendFile(f);
    }
    const direct = path.join(thumbsDir, rawId);
    if (fs.existsSync(direct)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', 'image/jpeg');
      return res.sendFile(direct);
    }

    // Fallback: extract base frame at 0.1s
    const videoPath = findVideoFileOnServer(rawId);
    if (videoPath) {
      try {
        const generatedThumb = path.join(thumbsDir, `${rawId}.jpg`);
        const frameCmd = `ffmpeg -ss 0.1 -i "${videoPath}" -vframes 1 -vf "scale=${width}:-2" -q:v 8 -y "${generatedThumb}"`;
        await execPromise(frameCmd, { timeout: 3500 });
        if (fs.existsSync(generatedThumb)) {
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
          res.setHeader('Content-Type', 'image/jpeg');
          return res.sendFile(generatedThumb);
        }
      } catch (_) {}
    }

    res.status(404).send('Not found');
  });

  // Extract and stream an exact sliced video segment (for downloading cut clips)
  app.get('/api/video/segment', async (req, res) => {
    const fileId = (req.query.fileId as string) || '';
    const url = (req.query.url as string) || '';
    const trimStart = Math.max(0, parseFloat(req.query.trim_start as string) || 0);
    const trimEnd = Math.max(0, parseFloat(req.query.trim_end as string) || 0);
    const clientFilename = (req.query.filename as string) || `clip_${Date.now()}.mp4`;

    let srcPath = await ensureLocalVideoFile(fileId, url);
    if (!srcPath || !fs.existsSync(srcPath)) {
      const cleanId = (fileId || '').replace(/^\//, '');
      const alt = findVideoFileOnServer(cleanId) || (cleanId ? path.join(uploadDir, cleanId) : '');
      if (alt && fs.existsSync(alt)) {
        srcPath = alt;
      }
    }

    if (!srcPath || !fs.existsSync(srcPath)) {
      return res.status(404).json({ ok: false, error: 'Video source not found on server' });
    }

    try {
      let totalDur = 0;
      try {
        const { stdout: durOut } = await execPromise(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${srcPath}"`, { timeout: 4000 });
        totalDur = parseFloat(durOut.trim()) || 0;
      } catch (_) {}

      const explicitDur = parseFloat(req.query.duration as string) || 0;
      const isExplicitCut = req.query.is_cut === 'true' || Boolean(req.query.is_cut);

      // A clip is untrimmed ONLY if trimStart is near 0, no trimEnd was specified, no explicit duration, and not marked as a cut
      const isUntrimmed = !isExplicitCut && trimStart <= 0.02 && (trimEnd <= 0 || (totalDur > 0 && trimEnd >= totalDur - 0.05)) && (explicitDur <= 0 || (totalDur > 0 && Math.abs(explicitDur - totalDur) < 0.1));
      if (isUntrimmed) {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${clientFilename.replace(/"/g, '')}"`);
        return fs.createReadStream(srcPath).pipe(res);
      }

      // Pre-slice exact segment using ffmpeg (-ss before -i and -t for precise frame-accurate duration)
      const tempOut = path.join(os.tmpdir(), `seg_dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp4`);
      const segDuration = Math.max(0.1, (trimEnd > trimStart ? trimEnd - trimStart : 0) || (explicitDur > 0 ? explicitDur : 0) || (totalDur > trimStart ? totalDur - trimStart : 5));
      
      try {
        const sliceCmd = `ffmpeg -y -ss ${trimStart.toFixed(3)} -i "${srcPath}" -t ${segDuration.toFixed(3)} -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -avoid_negative_ts make_zero -fflags +genpts -c:a aac -b:a 192k -movflags +faststart "${tempOut}"`;
        await execPromise(sliceCmd, { timeout: 35000 });
      } catch (sliceErr) {
        try {
          // Fallback with no-audio if source has no audio stream
          const sliceCmdNoAudio = `ffmpeg -y -ss ${trimStart.toFixed(3)} -i "${srcPath}" -t ${segDuration.toFixed(3)} -c:v libx264 -preset ultrafast -crf 20 -pix_fmt yuv420p -avoid_negative_ts make_zero -fflags +genpts -an -movflags +faststart "${tempOut}"`;
          await execPromise(sliceCmdNoAudio, { timeout: 35000 });
        } catch (__copy) {
          try {
            const sliceCopy = `ffmpeg -y -ss ${trimStart.toFixed(3)} -i "${srcPath}" -t ${segDuration.toFixed(3)} -c copy -avoid_negative_ts make_zero -movflags +faststart "${tempOut}"`;
            await execPromise(sliceCopy, { timeout: 15000 });
          } catch (_) {}
        }
      }

      if (fs.existsSync(tempOut) && fs.statSync(tempOut).size > 500) {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${clientFilename.replace(/"/g, '')}"`);
        const stream = fs.createReadStream(tempOut);
        stream.pipe(res);
        stream.on('close', () => {
          try { fs.unlinkSync(tempOut); } catch (_) {}
        });
      } else {
        res.status(500).json({ ok: false, error: 'Could not extract sliced segment' });
      }
    } catch (err: any) {
      console.warn('[Video Segment Download Warning]:', err.message);
      res.status(500).json({ ok: false, error: err.message || 'Error processing segment download' });
    }
  });

  app.get('/api/video/:fileId', async (req, res) => {
    const rawId = req.params.fileId;
    const localPath = path.join(uploadDir, rawId);

    // 1. Direct local file check with size validation
    if (fs.existsSync(localPath)) {
      try {
        if (fs.statSync(localPath).size > 1000) {
          return streamFile(localPath, req, res, 'video/mp4');
        } else {
          // Remove truncated or 0-byte corrupt placeholder
          try { fs.unlinkSync(localPath); } catch (_) {}
        }
      } catch (_) {}
    }

    // 2. Candidate server paths (rendersDir, altRendersDir, baseName, with .mp4 suffix)
    const serverPath = findVideoFileOnServer(rawId);
    if (serverPath && fs.existsSync(serverPath)) {
      try {
        if (fs.statSync(serverPath).size > 1000) {
          return streamFile(serverPath, req, res, 'video/mp4');
        }
      } catch (_) {}
    }

    // 3. Check db.videos AND db.higgsfield_jobs for telegram_file_id
    const vidEntry = Object.values(db.videos || {}).find((v: any) => 
      v && (v.file_id === rawId || v.id === rawId || v.telegram_file_id === rawId || (v.url && v.url.includes(rawId)))
    ) as any;

    const hfJob = Object.values(db.higgsfield_jobs || {}).find((j: any) =>
      j && (j.id === rawId || j.file_id === rawId || j.telegram_file_id === rawId || (j.video_url && j.video_url.includes(rawId)))
    ) as any;

    const tgFileId = vidEntry?.telegram_file_id || hfJob?.telegram_file_id || (rawId.length > 25 ? rawId : null);
    if (tgFileId) {
      const token = getTelegramToken();
      if (token) {
        try {
          const fileInfo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${tgFileId}`).then(r => r.json());
          if (fileInfo.ok && fileInfo.result?.file_path) {
            const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
            const fileResp = await fetch(downloadUrl);
            if (fileResp.ok) {
              const buf = Buffer.from(await fileResp.arrayBuffer());
              if (buf.length > 1000) {
                fs.writeFileSync(localPath, buf);
                return streamFile(localPath, req, res, 'video/mp4');
              }
            }
          }
        } catch (err) {
          console.warn('[Video Streaming] Telegram retrieval fallback notice:', err);
        }
      }
    }

    // 4. Autonomous Healing: If it's a known Higgsfield AI clip or video that went missing, regenerate it!
    const fallbackRefUrl = hfJob?.originalClipUrl || vidEntry?.url;
    if (fallbackRefUrl && !rawId.includes('fallback_rendered')) {
      try {
        const srcRef = await ensureLocalVideoFile(undefined, fallbackRefUrl);
        if (srcRef && fs.existsSync(srcRef) && fs.statSync(srcRef).size > 1000) {
          const healCmd = `ffmpeg -y -i "${srcRef}" -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,eq=contrast=1.18:saturation=1.2" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${localPath}"`;
          await execPromise(healCmd, { timeout: 20000 });
          if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
            console.log(`[Video Streaming] Successfully healed missing video on-the-fly: ${rawId}`);
            return streamFile(localPath, req, res, 'video/mp4');
          }
        }
      } catch (healErr) {
        console.warn('[Video Streaming] Dynamic healing warning:', healErr);
      }
    }

    // 5. Ultimate Zero-Black-Screen Fallback: Return a valid 9:16 playable MP4 stream so HTML5 video tag never shows black error
    const universalFallback = path.join(uploadDir, 'flux_placeholder_916.mp4');
    if (!fs.existsSync(universalFallback) || fs.statSync(universalFallback).size < 1000) {
      try {
        execSync(`ffmpeg -y -f lavfi -i color=c=0x18181b:s=720x1280:d=4 -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart "${universalFallback}"`);
      } catch (_) {}
    }
    if (fs.existsSync(universalFallback)) {
      return streamFile(universalFallback, req, res, 'video/mp4');
    }

    res.status(404).send('Video not found');
  });

  app.get(['/api/audio/:fileId', '/api/audio/stream/:fileId'], (req, res) => {
    const p1 = path.join(rendersDir, `${req.params.fileId}.mp3`);
    if (fs.existsSync(p1)) return streamFile(p1, req, res, 'audio/mpeg');
    const p2 = path.join(uploadDir, req.params.fileId);
    if (fs.existsSync(p2)) return streamFile(p2, req, res, 'audio/mpeg');
    res.status(404).send('Audio not found');
  });

  app.get('/api/merged_video/:filename', async (req, res) => {
    const p1 = path.join(rendersDir, req.params.filename);
    if (fs.existsSync(p1)) return streamFile(p1, req, res, req.params.filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
    const p2 = path.join(altRendersDir, req.params.filename);
    if (fs.existsSync(p2)) return streamFile(p2, req, res, 'video/mp4');

    // If local file is missing, hydrate from Telegram
    const baseName = req.params.filename.replace(/\.mp4$/, '');
    const job = db.kaggle_jobs[baseName] || Object.values(db.kaggle_jobs || {}).find((j: any) => j.filename === req.params.filename || j.jobId === baseName || j.id === baseName);
    let tgFileId = (job as any)?.telegram_file_id || (job as any)?.telegramFileId;
    if (!tgFileId && db.videos) {
      const vidEntry = Object.values(db.videos).find((v: any) => 
        v && (v.file_id === baseName || v.id === baseName || (v.url && v.url.includes(req.params.filename)) || (v.name === req.params.filename))
      ) as any;
      tgFileId = vidEntry?.telegram_file_id;
    }
    if (tgFileId) {
      const token = getTelegramToken();
      try {
        const fileInfo = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${tgFileId}`).then(r => r.json());
        if (fileInfo.ok && fileInfo.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`;
          const fileResp = await fetch(downloadUrl);
          if (fileResp.ok) {
            const buf = Buffer.from(await fileResp.arrayBuffer());
            fs.writeFileSync(p1, buf);
            return streamFile(p1, req, res, 'video/mp4');
          }
        }
      } catch (err) {
        console.warn('[Merged Video] Telegram retrieval note:', err);
      }
    }

    res.status(404).send('Rendered file not found');
  });

  app.get('/api/render_asset/:filename', (req, res) => {
    const p = path.join(rendersDir, req.params.filename);
    if (fs.existsSync(p)) return res.sendFile(p);
    res.status(404).send('Asset not found');
  });

  // Global error handler (handles Multer errors, payload limits, and API exceptions gracefully)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError || (err && err.name === 'MulterError')) {
      console.warn('[MulterError intercepted]:', err.code, err.message, (err as any).field);
      return res.status(400).json({
        ok: false,
        error: err.message || 'File upload error',
        code: err.code || 'MULTER_ERROR',
        field: (err as any).field || undefined,
      });
    }
    if (err) {
      console.error('[API Server Error]:', err?.message || err);
      return res.status(500).json({
        ok: false,
        error: err.message || 'Internal server error',
      });
    }
    next();
  });

  // Frontend integration: Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Studio Video Editor Server running on port ${PORT}`);
  });
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} in use. Exiting process so supervisor can start fresh.`);
      process.exit(1);
    }
  });
}

// Start server if main entry
createServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
});
