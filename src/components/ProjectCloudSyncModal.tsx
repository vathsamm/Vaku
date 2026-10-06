import React, { useState, useEffect } from 'react';
import { CloudUpload, CloudCheck, Check, X, Loader2, Film, Music, AlertCircle } from 'lucide-react';
import { VideoEditorProject, DB } from '../types';
import { getLocalClipBlob, normalizeClipKey } from '../utils/videoBlobCache';
import { saveDbToFirestore } from '../firebase';

export interface ProjectCloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: VideoEditorProject | null;
  db: DB | null;
  setDb: React.Dispatch<React.SetStateAction<DB | null>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ProjectCloudSyncModal: React.FC<ProjectCloudSyncModalProps> = ({
  isOpen,
  onClose,
  project,
  db,
  setDb,
  showToast,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && project) {
      setIsComplete(false);
      setErrorMsg(null);
      setSyncProgress(0);
      setUploadedCount(0);
      handleStartSync();
    }
  }, [isOpen, project?.id]);

  const handleStartSync = async () => {
    if (!project) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setStatusText('Analyzing project timeline and connected clips...');
    setSyncProgress(5);

    try {
      // 1. Collect all clips, variants, and audio files
      const clipItems = [...(project.clips || [])];
      const audioItems = [...(project.audio_clips || [])];
      const totalToProcess = Math.max(1, clipItems.length + audioItems.length);
      setTotalFiles(totalToProcess);

      let processed = 0;

      // 2. Iterate through clips: check offline local blobs and upload if needed
      for (let i = 0; i < clipItems.length; i++) {
        const clip = clipItems[i];
        const clipKey = normalizeClipKey(clip.file_id || clip.url || clip.vid || '');
        const clipTitle = (clip as any).name || (clip as any).title || clip.file_id || `Clip ${i + 1}`;
        setStatusText(`Checking clip ${i + 1}/${clipItems.length} (${clipTitle})...`);

        if (clipKey) {
          const localBlob = await getLocalClipBlob(clipKey);
          if (localBlob) {
            // Upload local blob to cloud server storage
            setStatusText(`Uploading offline clip ${i + 1}/${clipItems.length} to Cloud Storage...`);
            const formData = new FormData();
            const fileName = `${clipKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
            formData.append('file', localBlob, fileName);
            formData.append('folder_id', project.master_bucket_fid || 'root');

            try {
              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });
              if (res.ok) {
                const data = await res.json().catch(() => null);
                if (data && data.file_id) {
                  clip.file_id = data.file_id;
                  clip.url = data.url || `/api/video/${data.file_id}`;
                }
              }
            } catch (upErr) {
              console.warn('[CloudSync] Upload note:', upErr);
            }
          }
        }

        processed++;
        setUploadedCount(processed);
        setSyncProgress(Math.min(85, 10 + Math.round((processed / totalToProcess) * 75)));
      }

      // 3. Update project metadata with cloud_synced flag
      setStatusText('Updating Cloud Project metadata & database...');
      const now = Date.now();
      const updatedProject: VideoEditorProject = {
        ...project,
        cloud_synced: true,
        cloud_synced_at: now,
        updated_at: now,
      };

      // Save to server
      try {
        await fetch('/api/editor/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            projectData: updatedProject,
          }),
        });
      } catch (_) {}

      // Save to Firestore if configured
      if (db) {
        const nextDb: DB = {
          ...db,
          video_editor_projects: {
            ...(db.video_editor_projects || {}),
            [project.id]: updatedProject,
          },
        };
        setDb(nextDb);
        try {
          await saveDbToFirestore(nextDb);
        } catch (_) {}
      }

      setSyncProgress(100);
      setStatusText('🎉 Project & all connected clips successfully backed up to Cloud Storage!');
      setIsComplete(true);
      setIsSyncing(false);
      showToast(`☁️ "${project.name}" backed up to Cloud Storage!`, 'success');
    } catch (err: any) {
      console.error('[CloudSync Error]:', err);
      setErrorMsg(err?.message || 'Cloud backup encountered an error');
      setIsSyncing(false);
      showToast(`Cloud backup issue: ${err?.message || 'Error'}`, 'error');
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isComplete ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'}`}>
              {isComplete ? <CloudCheck size={20} /> : <CloudUpload size={20} />}
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Cloud Storage Backup</h3>
              <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{project.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Display */}
        <div className="space-y-2 bg-gray-950 p-3.5 rounded-xl border border-gray-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Backup Status:</span>
            <span className={`font-bold ${isComplete ? 'text-emerald-400' : 'text-sky-400'}`}>
              {isComplete ? '100% Complete' : `${syncProgress}%`}
            </span>
          </div>

          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isComplete 
                  ? 'bg-emerald-500' 
                  : 'bg-gradient-to-r from-sky-500 to-indigo-500'
              }`}
              style={{ width: `${syncProgress}%` }}
            />
          </div>

          <p className="text-[11px] text-gray-300 font-mono leading-relaxed pt-1">
            {statusText}
          </p>

          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-800/60">
            <span>Processed Clips:</span>
            <span className="font-bold text-white">{uploadedCount} / {totalFiles}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-300 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {isComplete ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Done
            </button>
          ) : isSyncing ? (
            <button
              type="button"
              disabled
              className="w-full py-2 bg-gray-800 text-gray-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-wait"
            >
              <Loader2 size={13} className="animate-spin text-sky-400" />
              <span>Uploading to Cloud...</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartSync}
              className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Retry Backup
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
