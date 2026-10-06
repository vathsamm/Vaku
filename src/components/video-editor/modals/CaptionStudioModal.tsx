import React from 'react';
import { 
  ArrowLeft, Type, Trash2, FolderInput, X, Star, Pin, 
  RefreshCw, ChevronRight, EyeOff, Eye, Check, Bold, Plus 
} from 'lucide-react';
import { 
  VideoEditorCaptionTemplate, VideoEditorCaption, 
  VideoEditorCaptionDefault, VideoEditorProject 
} from '../../../types';
import { CAPTION_FONTS } from '../constants';

export interface CaptionStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  captionViewMode: 'list' | 'settings';
  setCaptionViewMode: (v: 'list' | 'settings') => void;
  editingTemplate: VideoEditorCaptionTemplate | null;
  setEditingTemplate: (tpl: any) => void;
  masterBucketName: string;
  setDeleteConfirmDialog: (target: any) => void;
  setImportModalType: (type: 'caption' | 'title' | 'audio' | null) => void;
  availableCaptionTemplates: VideoEditorCaptionTemplate[];
  activeCaptions: VideoEditorCaption[];
  captionTemplates: VideoEditorCaptionTemplate[];
  handleOpenTemplateSettings: (tpl: VideoEditorCaptionTemplate) => void;
  handleToggleCaptionOnProject: (tpl: VideoEditorCaptionTemplate) => void;
  handleToggleTemplateMode: (tplId: string, mode: 'all' | 'change') => void;
  formatTemplateRuleDisplay: (tpl: VideoEditorCaptionTemplate) => string;
  hiddenCaptionTemplates: VideoEditorCaptionTemplate[];
  handleToggleHideCaptionForProject: (tplId: string) => void;
  captionDefaults: VideoEditorCaptionDefault;
  activeProject: VideoEditorProject | null;
  projectHiddenCaptionIds: Set<string>;
  templateProjectActive: boolean;
  setTemplateProjectActive: (v: boolean) => void;
  handleSaveTemplateSettings: (tpl: VideoEditorCaptionTemplate, projectActive: boolean) => void;
  showNewCaptionPrompt: boolean;
  setShowNewCaptionPrompt: (v: boolean) => void;
  newCaptionPromptText: string;
  setNewCaptionPromptText: (v: string) => void;
  newCaptionMode: 'must' | 'change';
  setNewCaptionMode: (v: 'must' | 'change') => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const CaptionStudioModal: React.FC<CaptionStudioModalProps> = ({
  isOpen,
  onClose,
  captionViewMode,
  setCaptionViewMode,
  editingTemplate,
  setEditingTemplate,
  masterBucketName,
  setDeleteConfirmDialog,
  setImportModalType,
  availableCaptionTemplates,
  activeCaptions,
  captionTemplates,
  handleOpenTemplateSettings,
  handleToggleCaptionOnProject,
  handleToggleTemplateMode,
  formatTemplateRuleDisplay,
  hiddenCaptionTemplates,
  handleToggleHideCaptionForProject,
  captionDefaults,
  activeProject,
  projectHiddenCaptionIds,
  templateProjectActive,
  setTemplateProjectActive,
  handleSaveTemplateSettings,
  showNewCaptionPrompt,
  setShowNewCaptionPrompt,
  newCaptionPromptText,
  setNewCaptionPromptText,
  newCaptionMode,
  setNewCaptionMode,
  showToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[160] bg-gray-950 flex flex-col w-full h-full text-white animate-in fade-in duration-150 overflow-hidden">
      {/* Header (Thin & Sleek) */}
      <div className="h-9 sm:h-9.5 px-3 flex items-center justify-between border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {captionViewMode === 'settings' ? (
              <button
                type="button"
                onClick={() => {
                  setCaptionViewMode('list');
                  setEditingTemplate(null);
                }}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Back to captions list"
              >
                <ArrowLeft size={15} />
              </button>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Type size={15} />
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                {captionViewMode === 'settings' 
                  ? (editingTemplate?.name ? `${editingTemplate.name}` : 'Settings') 
                  : 'Captions'}
              </h3>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-950/80 text-purple-300 border border-purple-700/50 rounded truncate max-w-[120px]">
                {masterBucketName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {captionViewMode === 'settings' && editingTemplate && (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmDialog({
                    type: 'caption_template',
                    id: editingTemplate.id,
                    name: editingTemplate.name ? `${editingTemplate.name} ("${editingTemplate.text}")` : `"${editingTemplate.text}"`
                  });
                }}
                className="w-7 h-7 flex items-center justify-center text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/40 active:scale-95 transition cursor-pointer"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
            {captionViewMode === 'list' && (
              <button
                type="button"
                onClick={() => setImportModalType('caption')}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 flex items-center justify-center transition cursor-pointer active:scale-95"
                title="Import from other projects"
              >
                <FolderInput size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 active:scale-95 transition cursor-pointer ml-0.5"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          {captionViewMode === 'list' ? (
            /* VIEW 1: CONTINUOUS CAPTION TEMPLATES LIST */
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Master Bucket Captions ({availableCaptionTemplates.length})
                </span>
                <span className="text-[11px] text-amber-300 font-medium">
                  {activeCaptions.length} on video
                </span>
              </div>

              {availableCaptionTemplates.length === 0 ? (
                <div className="p-7 text-center rounded-2xl bg-gray-950/60 border border-gray-800/80 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-850 flex items-center justify-center text-gray-500">
                    <Type size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-200">
                      No Captions
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs">
                      Create a caption or import from other projects.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-3.5">
                      <button
                        type="button"
                        onClick={() => setImportModalType('caption')}
                        className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow active:scale-95"
                      >
                        <FolderInput size={13} />
                        <span>Import</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCaptionPromptText('');
                          setShowNewCaptionPrompt(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow active:scale-95"
                      >
                        <Plus size={13} className="stroke-[3]" />
                        <span>New Caption</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableCaptionTemplates.map((tpl) => {
                    const isStarred = activeCaptions.some(
                      c => c.template_id === tpl.id || (c.text.trim().toLowerCase() === tpl.text.trim().toLowerCase() && c.font_family === tpl.font_family)
                    );
                    const isAll = tpl.mode === 'all' || tpl.mode === 'must' || Boolean(tpl.is_must);

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => handleOpenTemplateSettings(tpl)}
                        className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer group select-none active:scale-[0.99] touch-manipulation ${
                          isStarred
                            ? 'bg-gradient-to-r from-amber-950/40 via-gray-900 to-gray-900 border-amber-500/50 hover:border-amber-400 shadow-md ring-1 ring-amber-500/20'
                            : 'bg-gray-950/80 hover:bg-gray-900 border-gray-800/90 hover:border-gray-700 shadow-sm'
                        }`}
                      >
                        {/* Front: Star Button ⭐ */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCaptionOnProject(tpl);
                          }}
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition active:scale-90 cursor-pointer ${
                            isStarred
                              ? 'bg-amber-400 text-black shadow-md ring-2 ring-amber-300'
                              : 'bg-gray-850 hover:bg-gray-800 text-gray-400 hover:text-amber-300 border border-gray-750'
                          }`}
                          title={isStarred ? "Starred on video (Tap to remove from video)" : "Not on video (Tap to add ⭐ to video)"}
                        >
                          <Star size={17} className={isStarred ? "fill-black stroke-black" : ""} />
                        </button>

                        {/* Caption Text & Subtitle Info */}
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="text-sm sm:text-base font-bold text-white tracking-wide block truncate group-hover:text-amber-200 transition">
                            {tpl.text}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTemplateMode(tpl.id, isAll ? 'change' : 'all');
                              }}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer active:scale-95 ${
                                isAll
                                  ? 'bg-amber-400 text-black border-amber-300 hover:bg-amber-300 font-black shadow-xs'
                                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-purple-500/60 hover:text-white'
                              }`}
                              title={`Mode: ${isAll ? 'For All (Shows on every video). Click to set Change.' : 'Change (Auto Swapped). Click to set For All.'}`}
                            >
                              {isAll ? <Pin size={9} className="fill-black stroke-black" /> : <RefreshCw size={9} />}
                              <span>{isAll ? 'All' : 'Change'}</span>
                            </button>

                            {isStarred && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-700/40 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                On Video
                              </span>
                            )}

                            <span className="text-[11px] text-gray-400 font-normal truncate hidden sm:inline">
                              {formatTemplateRuleDisplay(tpl)}
                            </span>
                          </div>
                        </div>

                        {/* Right Controls: Delete + Chevron */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmDialog({
                                type: 'caption_template',
                                id: tpl.id,
                                name: tpl.name ? `${tpl.name} ("${tpl.text}")` : `"${tpl.text}"`
                              });
                            }}
                            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-rose-400 rounded-xl hover:bg-rose-950/40 active:bg-rose-900/50 transition cursor-pointer"
                            title="Delete caption"
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenTemplateSettings(tpl)}
                            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-amber-300 transition"
                            title="Open Caption Settings"
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Separately Listed: Hidden in this project */}
              {hiddenCaptionTemplates.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-gray-800/80 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md bg-gray-800 flex items-center justify-center text-gray-400">
                        <EyeOff size={12} />
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Hidden in This Project ({hiddenCaptionTemplates.length})
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Excluded from Auto
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 px-1 leading-tight">
                    Hidden only in this specific project. Still available in all other projects inside this master bucket.
                  </p>
                  <div className="space-y-1.5">
                    {hiddenCaptionTemplates.map((tpl) => {
                      const isAll = tpl.mode === 'all' || tpl.mode === 'must' || Boolean(tpl.is_must);
                      return (
                        <div
                          key={tpl.id}
                          className="p-3 rounded-2xl border border-gray-855/80 bg-gray-950/60 hover:bg-gray-900/60 transition flex items-center justify-between gap-2.5 select-none"
                        >
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-gray-400 truncate line-through opacity-75">
                                {tpl.text}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                                isAll 
                                  ? 'bg-amber-950/80 text-amber-400 border border-amber-800/50' 
                                  : 'bg-purple-950/80 text-purple-400 border border-purple-800/50'
                              }`}>
                                {isAll ? 'All' : 'Change'}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 block mt-0.5">
                              Hidden from this project only
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleHideCaptionForProject(tpl.id);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                              title="Unhide and restore this caption for this project"
                            >
                              <Eye size={13} />
                              <span>Unhide</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmDialog({
                                  type: 'caption_template',
                                  id: tpl.id,
                                  name: tpl.name ? `${tpl.name} ("${tpl.text}")` : `"${tpl.text}"`
                                });
                              }}
                              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                              title="Permanently delete from every project"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: CAPTION SETTINGS PAGE */
            editingTemplate && (
              <div className="space-y-4 pb-2">
                {/* Caption Text Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Caption Text
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.text}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, text: e.target.value })}
                    placeholder="Enter caption text..."
                    className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-medium text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
                  />
                </div>

                {/* Live Styled Preview Card */}
                <div className="bg-black/90 rounded-2xl p-4 border border-gray-800 shadow-inner flex flex-col items-center justify-center min-h-[75px] overflow-hidden relative">
                  <span className="text-[10px] font-mono text-gray-500 absolute top-2 left-2 uppercase">
                    Live Preview
                  </span>
                  <span
                    style={{
                      fontFamily: editingTemplate.font_family || captionDefaults.font_family || CAPTION_FONTS[0].family,
                      fontSize: `${Math.min(editingTemplate.font_size || 24, 26)}px`,
                      fontWeight: editingTemplate.is_bold ? 800 : 500,
                      color: editingTemplate.color || '#ffffff',
                      textShadow: '0 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                    }}
                    className="leading-tight px-3 py-1 break-words max-w-full text-center mt-3"
                  >
                    {editingTemplate.text || "Your caption preview"}
                  </span>
                </div>

                {/* CAPTION BEHAVIOR: ALL VS CHANGE */}
                <div className="space-y-1.5 bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                      Caption Behavior
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {(editingTemplate.mode === 'all' || editingTemplate.mode === 'must' || editingTemplate.is_must) ? 'Locks to every video' : 'Swaps on Auto click'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {/* ALL BUTTON */}
                    <button
                      type="button"
                      onClick={() => setEditingTemplate({ ...editingTemplate, mode: 'all', is_must: true, for_all_videos: true })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer active:scale-95 flex flex-col gap-1 ${
                        (editingTemplate.mode === 'all' || editingTemplate.mode === 'must' || editingTemplate.is_must)
                          ? 'bg-amber-400/20 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 shadow-sm'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Pin size={13} className={(editingTemplate.mode === 'all' || editingTemplate.mode === 'must' || editingTemplate.is_must) ? 'fill-amber-400 text-amber-400' : 'text-gray-500'} />
                          <span className="text-xs font-extrabold">All (Every Video)</span>
                        </div>
                        {(editingTemplate.mode === 'all' || editingTemplate.mode === 'must' || editingTemplate.is_must) && (
                          <Check size={14} className="text-amber-400 stroke-[3]" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        Guaranteed on every video clip. Stays permanent across all videos and Auto generation.
                      </p>
                    </button>

                    {/* CHANGE BUTTON */}
                    <button
                      type="button"
                      onClick={() => setEditingTemplate({ ...editingTemplate, mode: 'change', is_must: false, for_all_videos: false })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer active:scale-95 flex flex-col gap-1 ${
                        (editingTemplate.mode !== 'all' && editingTemplate.mode !== 'must' && !editingTemplate.is_must)
                          ? 'bg-purple-600/25 border-purple-400 text-purple-200 ring-1 ring-purple-400/50 shadow-sm'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <RefreshCw size={13} className={(editingTemplate.mode !== 'all' && editingTemplate.mode !== 'must' && !editingTemplate.is_must) ? 'text-purple-400' : 'text-gray-500'} />
                          <span className="text-xs font-extrabold">Change (Auto Swap)</span>
                        </div>
                        {(editingTemplate.mode !== 'all' && editingTemplate.mode !== 'must' && !editingTemplate.is_must) && (
                          <Check size={14} className="text-purple-400 stroke-[3]" />
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        Swaps between all change captions every time you click the Auto button.
                      </p>
                    </button>
                  </div>
                </div>

                {/* PROJECT-LEVEL ISOLATION: HIDE FOR THIS PROJECT ONLY */}
                {activeProject && (
                  <div
                    onClick={() => {
                      handleToggleHideCaptionForProject(editingTemplate.id);
                      setCaptionViewMode('list');
                    }}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition select-none ${
                      projectHiddenCaptionIds.has(editingTemplate.id)
                        ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                        : 'bg-gray-950/80 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        projectHiddenCaptionIds.has(editingTemplate.id)
                          ? 'bg-rose-900/60 text-rose-300'
                          : 'bg-gray-850 text-gray-400'
                      }`}>
                        <EyeOff size={16} />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">
                          {projectHiddenCaptionIds.has(editingTemplate.id)
                            ? 'Hidden in this project'
                            : 'Hide in this project only'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {projectHiddenCaptionIds.has(editingTemplate.id)
                            ? 'Excluded from this project. Tap to unhide.'
                            : 'Keeps caption in master bucket for other projects, but excludes from this project.'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                      projectHiddenCaptionIds.has(editingTemplate.id)
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        : 'bg-gray-850 border border-gray-700 text-amber-300'
                    }`}>
                      {projectHiddenCaptionIds.has(editingTemplate.id) ? 'Unhide' : 'Hide'}
                    </span>
                  </div>
                )}

                {/* Star / Project Video Inclusion Switch */}
                <div
                  onClick={() => setTemplateProjectActive(!templateProjectActive)}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition select-none ${
                    templateProjectActive
                      ? 'bg-amber-400/15 border-amber-400/60 text-white shadow-sm ring-1 ring-amber-400/30'
                      : 'bg-gray-950/80 border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      templateProjectActive ? 'bg-amber-400 text-black shadow' : 'bg-gray-800 text-gray-500'
                    }`}>
                      <Star size={18} className={templateProjectActive ? "fill-black" : ""} />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-white block">
                        Include on this video project (⭐)
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {templateProjectActive ? "Active on timeline & canvas" : "Saved as template only"}
                      </span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                    templateProjectActive ? 'bg-amber-400 border-amber-400 text-black' : 'border-gray-600 bg-gray-900'
                  }`}>
                    {templateProjectActive && <Check size={16} className="stroke-[3]" />}
                  </div>
                </div>

                {/* Typography: Font Family Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Font Family
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {CAPTION_FONTS.map((f) => {
                      const isSel = (editingTemplate.font_family || captionDefaults.font_family) === f.family;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setEditingTemplate({ ...editingTemplate, font_family: f.family })}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer active:scale-95 ${
                            isSel
                              ? 'bg-amber-400/15 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                              : 'bg-gray-950/80 border-gray-800 text-gray-300 hover:bg-gray-900'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <span className="text-xs font-bold block truncate" style={{ fontFamily: f.family }}>
                              {f.name}
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate">
                              {f.label}
                            </span>
                          </div>
                          {isSel && <Check size={14} className="text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Size & Bold Toggle */}
                <div className="grid grid-cols-2 gap-3 bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Size</span>
                      <span className="font-mono font-bold text-amber-300">{editingTemplate.font_size || 24}px</span>
                    </div>
                    <input
                      type="range"
                      min={14}
                      max={48}
                      step={1}
                      value={editingTemplate.font_size || 24}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, font_size: Number(e.target.value) })}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-gray-400 text-xs font-medium mb-1">Weight</span>
                    <button
                      type="button"
                      onClick={() => setEditingTemplate({ ...editingTemplate, is_bold: !editingTemplate.is_bold })}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                        editingTemplate.is_bold
                          ? 'bg-amber-400 text-black border-amber-300 font-extrabold shadow-sm'
                          : 'bg-gray-900 border-gray-700 text-gray-300'
                      }`}
                    >
                      <Bold size={13} className={editingTemplate.is_bold ? 'stroke-[3]' : ''} />
                      <span>{editingTemplate.is_bold ? 'Bold Weight' : 'Regular'}</span>
                    </button>
                  </div>
                </div>

                {/* Screen Position Controls */}
                <div className="space-y-2 bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Screen Location
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Top', x: 50, y: 15 },
                      { label: 'Above Mid', x: 50, y: 35 },
                      { label: 'Center', x: 50, y: 50 },
                      { label: 'Lower 3rd', x: 50, y: 70 },
                      { label: 'Bottom', x: 50, y: 85 }
                    ].map((pos) => {
                      const isCur = Math.abs((editingTemplate.y_pct ?? 35) - pos.y) <= 5;
                      return (
                        <button
                          key={pos.label}
                          type="button"
                          onClick={() => setEditingTemplate({ ...editingTemplate, x_pct: pos.x, y_pct: pos.y })}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                            isCur
                              ? 'bg-amber-400 text-black border-amber-300 shadow-sm'
                              : 'bg-gray-900 hover:bg-gray-855 text-gray-300 border-gray-750'
                          }`}
                        >
                          {pos.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Y-Position slider */}
                  <div className="pt-1.5 space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Vertical Height</span>
                      <span className="font-mono text-amber-300 font-bold">{editingTemplate.y_pct ?? 35}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={1}
                      value={editingTemplate.y_pct ?? 35}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, y_pct: Number(e.target.value) })}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Clip Timing & Scheduling Rules */}
                <div className="space-y-2 bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider block">
                    Clip Timing & Schedule
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { rule: 'all' as const, label: 'All Clips', desc: 'Visible throughout whole video' },
                      { rule: 'end' as const, label: 'Last Clip(s)', desc: 'Visible at ending clip(s)' },
                      { rule: 'start' as const, label: 'First Clip(s)', desc: 'Visible at opening clip(s)' },
                      { rule: 'until_next' as const, label: 'Until Next Caption', desc: 'Until next caption begins' }
                    ].map((r) => {
                      const isSel = (editingTemplate.clip_rule || 'all') === r.rule;
                      return (
                        <button
                          key={r.rule}
                          type="button"
                          onClick={() => setEditingTemplate({ ...editingTemplate, clip_rule: r.rule })}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer active:scale-95 ${
                            isSel
                              ? 'bg-amber-400/15 border-amber-400 text-amber-200 ring-1 ring-amber-400/40'
                              : 'bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                          }`}
                        >
                          <span className="text-xs font-bold block">{r.label}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{r.desc}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Number of clips if First or Last is selected */}
                  {(editingTemplate.clip_rule === 'end' || editingTemplate.clip_rule === 'start') && (
                    <div className="pt-2 flex items-center justify-between border-t border-gray-800/80">
                      <span className="text-xs text-gray-300 font-medium">
                        Number of clips:
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4].map((count) => {
                          const isCountSel = (editingTemplate.clip_count || 1) === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setEditingTemplate({ ...editingTemplate, clip_count: count })}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                isCountSel
                                  ? 'bg-amber-400 text-black font-extrabold shadow-sm'
                                  : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-750'
                              }`}
                            >
                              {count}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Bottom Footer Action Bar - Only shown in settings view now */}
      {captionViewMode === 'settings' && (
        <div className="p-3 bg-gray-900 border-t border-gray-800 shrink-0">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCaptionViewMode('list');
                setEditingTemplate(null);
              }}
              className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-650 text-gray-200 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!editingTemplate) return;
                handleSaveTemplateSettings(editingTemplate, templateProjectActive);
              }}
              className="px-4 py-1.5 bg-white hover:bg-gray-100 active:scale-95 text-gray-950 font-black text-xs rounded-xl shadow transition cursor-pointer"
            >
              Save Caption
            </button>
          </div>
        </div>
      )}

      {/* Simple Floating Plus Bubble for Adding New Caption (Only in list view when captions exist) */}
      {captionViewMode === 'list' && availableCaptionTemplates.length > 0 && (
        <div className="absolute bottom-6 right-5 sm:bottom-7 sm:right-6 z-30">
          <button
            type="button"
            onClick={() => {
              setNewCaptionPromptText('');
              setShowNewCaptionPrompt(true);
            }}
            className="w-12 h-12 rounded-full bg-white hover:bg-gray-100 text-gray-950 font-black shadow-xl border border-gray-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Add New Caption"
            aria-label="Add New Caption"
          >
            <Plus size={22} className="stroke-[2.8]" />
          </button>
        </div>
      )}

      {/* NEW CAPTION PROMPT MODAL */}
      {showNewCaptionPrompt && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-4.5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                  <Type size={18} />
                </div>
                <h4 className="text-sm font-bold text-white">Add New Caption</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCaptionPrompt(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-300 font-medium block">
                Caption Text
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Wait for the twist at the end 👀"
                value={newCaptionPromptText}
                onChange={(e) => setNewCaptionPromptText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = newCaptionPromptText.trim();
                    if (!trimmed) {
                      showToast("Please enter caption text", "warning");
                      return;
                    }
                    const isAll = newCaptionMode === 'must';
                    const existing = captionTemplates.find(t => (t.text || '').trim().toLowerCase() === trimmed.toLowerCase());
                    if (existing) {
                      setEditingTemplate({
                        ...existing,
                        mode: isAll ? 'all' : 'change',
                        is_must: isAll,
                        for_all_videos: isAll
                      });
                      setTemplateProjectActive(true);
                      setCaptionViewMode('settings');
                      setShowNewCaptionPrompt(false);
                      setNewCaptionPromptText('');
                      showToast(`Editing existing caption "${existing.name || 'C'}"`, "info");
                      return;
                    }
                    const nextNum = captionTemplates.length + 1;
                    const newTpl: VideoEditorCaptionTemplate = {
                      id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      name: `C${nextNum}`,
                      text: trimmed,
                      mode: isAll ? 'all' : 'change',
                      is_must: isAll,
                      font_size: captionDefaults.font_size || 24,
                      font_family: captionDefaults.font_family || CAPTION_FONTS[0].family,
                      is_bold: captionDefaults.is_bold ?? true,
                      box_width_pct: 85,
                      x_pct: captionDefaults.x_pct ?? 50,
                      y_pct: captionDefaults.y_pct ?? 35,
                      clip_rule: captionDefaults.clip_rule || 'all',
                      clip_count: 1,
                      clip_indices: [],
                      for_all_videos: isAll,
                      created_at: Date.now()
                    };
                    setEditingTemplate(newTpl);
                    setTemplateProjectActive(true);
                    setCaptionViewMode('settings');
                    setShowNewCaptionPrompt(false);
                    setNewCaptionPromptText('');
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-medium text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>

            {/* Mode Selector in Prompt: Change (Default) vs All */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-gray-300 font-medium block">
                Behavior Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewCaptionMode('change')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    newCaptionMode === 'change'
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-1 ring-purple-400/50 font-bold'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <RefreshCw size={12} className={newCaptionMode === 'change' ? 'text-purple-300' : 'text-gray-500'} />
                    <span className="text-xs">Change (Auto)</span>
                  </div>
                  {newCaptionMode === 'change' && <Check size={13} className="text-purple-300" />}
                </button>

                <button
                  type="button"
                  onClick={() => setNewCaptionMode('must')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    newCaptionMode === 'must'
                      ? 'bg-amber-400/25 border-amber-400 text-amber-200 ring-1 ring-amber-400/50 font-bold'
                      : 'bg-gray-950 border-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Pin size={12} className={newCaptionMode === 'must' ? 'text-amber-300 fill-amber-300' : 'text-gray-500'} />
                    <span className="text-xs">All (Every Video)</span>
                  </div>
                  {newCaptionMode === 'must' && <Check size={13} className="text-amber-300" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewCaptionPrompt(false)}
                className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const trimmed = newCaptionPromptText.trim();
                  if (!trimmed) {
                    showToast("Please enter caption text", "warning");
                    return;
                  }
                  const isAll = newCaptionMode === 'must';
                  const existing = captionTemplates.find(t => (t.text || '').trim().toLowerCase() === trimmed.toLowerCase());
                  if (existing) {
                    setEditingTemplate({
                      ...existing,
                      mode: isAll ? 'all' : 'change',
                      is_must: isAll,
                      for_all_videos: isAll
                    });
                    setTemplateProjectActive(true);
                    setCaptionViewMode('settings');
                    setShowNewCaptionPrompt(false);
                    setNewCaptionPromptText('');
                    showToast(`Editing existing caption "${existing.name || 'C'}"`, "info");
                    return;
                  }
                  const nextNum = captionTemplates.length + 1;
                  const newTpl: VideoEditorCaptionTemplate = {
                    id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: `C${nextNum}`,
                    text: trimmed,
                    mode: isAll ? 'all' : 'change',
                    is_must: isAll,
                    font_size: captionDefaults.font_size || 24,
                    font_family: captionDefaults.font_family || CAPTION_FONTS[0].family,
                    is_bold: captionDefaults.is_bold ?? true,
                    box_width_pct: 85,
                    x_pct: captionDefaults.x_pct ?? 50,
                    y_pct: captionDefaults.y_pct ?? 35,
                    clip_rule: captionDefaults.clip_rule || 'all',
                    clip_count: 1,
                    clip_indices: [],
                    for_all_videos: isAll,
                    created_at: Date.now()
                  };
                  setEditingTemplate(newTpl);
                  setTemplateProjectActive(true);
                  setCaptionViewMode('settings');
                  setShowNewCaptionPrompt(false);
                  setNewCaptionPromptText('');
                }}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-black rounded-xl transition cursor-pointer active:scale-95 shadow"
              >
                Continue to Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
