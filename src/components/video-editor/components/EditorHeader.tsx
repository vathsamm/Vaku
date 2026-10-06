import React from 'react';
import { ArrowLeft, Check, Edit2, Undo2, Redo2, Clock, Download, Film, CloudUpload, CloudCheck, Loader2 } from 'lucide-react';
import { DB, VideoEditorProject, HiggsfieldJob } from '../../../types';

export interface EditorHeaderProps {
  onClose: () => void;
  isEditingName: boolean;
  setIsEditingName: (v: boolean) => void;
  projectNameInput: string;
  setProjectNameInput: (v: string) => void;
  handleSaveRename: () => void;
  activeProject: VideoEditorProject | null;
  db: DB;
  masterBucketFid: string;
  undoStack: any[];
  redoStack: any[];
  handleUndo: () => void;
  handleRedo: () => void;
  setHistoryFilterProjectId: (id: string | null) => void;
  setShowInternalGenHistory: (v: boolean) => void;
  setExportResult: (v: any) => void;
  handleExportMergedVideo: () => void;
  onOpenSettings?: () => void;
  higgsfieldJobs?: HiggsfieldJob[];
  onOpenHiggsfieldTray?: () => void;
  isHiggsfieldTrayOpen?: boolean;
  higgsfieldCredits?: number;
  onCloudSync?: () => void;
  isSyncingCloud?: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  onClose,
  isEditingName,
  setIsEditingName,
  projectNameInput,
  setProjectNameInput,
  handleSaveRename,
  activeProject,
  db,
  masterBucketFid,
  undoStack,
  redoStack,
  handleUndo,
  handleRedo,
  setHistoryFilterProjectId,
  setShowInternalGenHistory,
  setExportResult,
  handleExportMergedVideo,
  onOpenSettings,
  higgsfieldJobs = [],
  onOpenHiggsfieldTray = () => {},
  isHiggsfieldTrayOpen = false,
  higgsfieldCredits,
  onCloudSync,
  isSyncingCloud,
}) => {
  return (
    <header className="h-10 sm:h-11 bg-gray-950 border-b border-gray-900 px-2 sm:px-3 flex items-center justify-between gap-2 shrink-0 z-30">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Back / Exit Button - Arrow mark icon only */}
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-850 active:scale-95 text-white border border-gray-800 transition cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft size={16} className="stroke-[2.5]" />
        </button>

        {/* Project Title (Inline Editable, Flexibly Truncated) */}
        <div className="min-w-0 flex items-center gap-1.5 flex-1 max-w-[140px] xs:max-w-[210px] sm:max-w-[300px]">
          {isEditingName ? (
            <div className="flex items-center gap-1 w-full">
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                autoFocus
                className="bg-gray-900 border border-gray-700 focus:border-white text-white font-bold text-xs px-2.5 py-1 rounded-lg outline-none w-full"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="h-7 w-7 flex items-center justify-center bg-white text-gray-950 rounded-lg hover:bg-gray-100 shrink-0 cursor-pointer font-bold"
              >
                <Check size={14} className="stroke-[3]" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-1.5 cursor-pointer truncate py-1 px-1.5 rounded-lg hover:bg-gray-900 transition"
              title="Click to rename project"
            >
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                {activeProject?.name || "Project"}
              </span>
              <Edit2 size={11} className="text-gray-400 group-hover:text-white shrink-0 opacity-70" />
            </div>
          )}
        </div>
      </div>

      {/* Right Header Controls: Undo/Redo, History, Export */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Undo & Redo (Clean dark button, no white outline box) */}
        <div className="flex items-center bg-gray-900 rounded-lg p-0.5 shrink-0 border border-gray-800">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer active:scale-95 ${
              undoStack.length > 0 ? 'text-white hover:bg-gray-800' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Undo"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition cursor-pointer active:scale-95 ${
              redoStack.length > 0 ? 'text-white hover:bg-gray-800' : 'text-gray-600 cursor-not-allowed'
            }`}
            title="Redo"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* HISTORY BUTTON - Sleek dark button with pure white text and icon */}
        <button
          type="button"
          onClick={() => {
            setHistoryFilterProjectId(activeProject?.id || null);
            setShowInternalGenHistory(true);
          }}
          className="h-8 px-2.5 bg-gray-900 hover:bg-gray-850 text-white border border-gray-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
          title="History"
        >
          <Clock size={14} className="text-white shrink-0" />
          <span className="hidden xs:inline text-white">History</span>
        </button>

        {/* Manual Cloud Storage Backup Button */}
        {onCloudSync && (
          <button
            type="button"
            onClick={onCloudSync}
            disabled={isSyncingCloud}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs ${
              isSyncingCloud
                ? 'bg-sky-950/70 border-sky-500/60 text-sky-400 animate-pulse'
                : activeProject?.cloud_synced
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/60'
                  : 'bg-sky-950/40 border-sky-500/40 text-sky-400 hover:bg-sky-900/60 hover:border-sky-400'
            }`}
            title={
              isSyncingCloud
                ? 'Uploading project & clips to Cloud Storage...'
                : activeProject?.cloud_synced
                  ? `Backed up to Cloud • Tap to re-upload`
                  : 'Upload to Cloud Storage • Manually upload project & clips'
            }
          >
            {isSyncingCloud ? (
              <Loader2 size={13} className="animate-spin text-sky-400" />
            ) : activeProject?.cloud_synced ? (
              <CloudCheck size={14} className="text-emerald-400" />
            ) : (
              <CloudUpload size={14} className="text-sky-400" />
            )}
            <span className="hidden sm:inline">{activeProject?.cloud_synced ? 'Saved Online' : 'Save Cloud'}</span>
          </button>
        )}

        {/* EXPORT BUTTON - Pure high-contrast white button */}
        <button
          type="button"
          onClick={() => {
            setExportResult(null);
            handleExportMergedVideo();
          }}
          className="h-8 px-3.5 bg-white hover:bg-gray-100 text-gray-950 font-black text-xs rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-sm"
          title="Export Video"
          aria-label="Export Video"
        >
          <Download size={14} className="shrink-0 stroke-[2.8] text-gray-950" />
          <span className="text-gray-950 font-black">Export</span>
        </button>
      </div>
    </header>
  );
};
