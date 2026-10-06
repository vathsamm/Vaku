import React, { useState, useEffect } from 'react';
import { 
  Sparkles, X, RefreshCw, Copy, Loader2,
  Hash, FileText, Wand2, CheckCheck, Check,
  Edit3, ChevronDown, Plus, Trash2, Star, FolderInput
} from 'lucide-react';
import { VideoEditorTitleTemplate, VideoEditorProject } from '../../../types';
import { DEFAULT_TITLE_PROMPT } from '../constants';

export interface AiTitleStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleViewMode: 'list' | 'detail';
  setTitleViewMode: (v: 'list' | 'detail') => void;
  editingTitleName: string;
  setEditingTitleName: (v: string) => void;
  editingTitlePrompt: string;
  setEditingTitlePrompt: (v: string) => void;
  isPromptSaved: boolean;
  setIsPromptSaved: (v: boolean) => void;
  masterBucketName: string;
  selectedTitleTemplateId: string | null;
  titleTemplates: VideoEditorTitleTemplate[];
  activeProject: VideoEditorProject | null;
  activeTitleTemplate: VideoEditorTitleTemplate | null;
  handleSaveCurrentPromptDetail: (overrideName?: string, overridePrompt?: string) => void;
  handleStarTitleTemplateForProject: (tpl: VideoEditorTitleTemplate) => void;
  handleDeleteTitleTemplate: (id: string, name: string) => void;
  setImportModalType: (type: 'caption' | 'title' | 'audio' | null) => void;
  handleOpenTitleTemplateDetail: (tpl: VideoEditorTitleTemplate) => void;
  handleAddNewTitleTemplate: () => void;
  handleExecuteTemplateOnProject: (tpl: VideoEditorTitleTemplate) => Promise<void>;
  isTestingTitleGen: boolean;
  handleRetryCurrentPrompt: () => void;
  displayTitle: string;
  displayHashtags: string;
  titleCopiedType: 'title' | 'hashtags' | 'all' | null;
  setTitleCopiedType: (v: 'title' | 'hashtags' | 'all' | null) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onUpdateGeneratedContent?: (title: string, hashtags: string) => void;
}

const PROMPT_INSPIRATIONS = [
  { 
    label: '🔥 Viral Hook', 
    desc: 'Punchy 1-line hook + 4 trending tags', 
    prompt: 'Give me a punchy, viral one-line hook title and 4 trending hashtags for TikTok/Reels.' 
  },
  { 
    label: '❓ Curiosity Question', 
    desc: 'Irresistible question that drives comments', 
    prompt: 'Write an irresistible question hook that makes viewers comment, plus 4 relevant hashtags.' 
  },
  { 
    label: '⚡ Short & Punchy', 
    desc: 'Ultra-impactful 3 to 4 words', 
    prompt: 'Create an ultra-short 3 to 4 word impactful video title and 4 trending hashtags.' 
  },
  { 
    label: '📈 High CTR FOMO', 
    desc: 'Emotional headline with viral curiosity', 
    prompt: 'Generate an emotional high-CTR headline that creates FOMO, followed by 4 niche hashtags.' 
  },
  { 
    label: '🎯 Solution & Tip', 
    desc: 'High-value educational takeaway', 
    prompt: 'Write a high-value problem-solution hook headline followed by 4 relevant niche hashtags.' 
  },
];

export const AiTitleStudioModal: React.FC<AiTitleStudioModalProps> = ({
  isOpen,
  onClose,
  titleViewMode,
  setTitleViewMode,
  editingTitleName,
  setEditingTitleName,
  editingTitlePrompt,
  setEditingTitlePrompt,
  isPromptSaved,
  setIsPromptSaved,
  masterBucketName,
  selectedTitleTemplateId,
  titleTemplates,
  activeProject,
  activeTitleTemplate,
  handleSaveCurrentPromptDetail,
  handleStarTitleTemplateForProject,
  handleDeleteTitleTemplate,
  setImportModalType,
  handleOpenTitleTemplateDetail,
  handleAddNewTitleTemplate,
  handleExecuteTemplateOnProject,
  isTestingTitleGen,
  handleRetryCurrentPrompt,
  displayTitle,
  displayHashtags,
  titleCopiedType,
  setTitleCopiedType,
  showToast,
  onUpdateGeneratedContent,
}) => {
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [isPromptCustomizerOpen, setIsPromptCustomizerOpen] = useState<boolean>(false);
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);

  // Inline editing state for generated title and hashtags
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(displayTitle || '');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [editedTags, setEditedTags] = useState(displayHashtags || '');
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false);

  // Sync edited fields whenever display values change from AI generation
  useEffect(() => {
    setEditedTitle(displayTitle || '');
  }, [displayTitle]);

  useEffect(() => {
    setEditedTags(displayHashtags || '');
  }, [displayHashtags]);

  if (!isOpen) return null;

  const currentTpl = titleTemplates.find(t => t.id === selectedTitleTemplateId) || activeTitleTemplate;
  const isCurrentTemplateStarred = Boolean(
    selectedTitleTemplateId && (
      activeProject?.active_title_template_id === selectedTitleTemplateId ||
      (!activeProject?.active_title_template_id && (activeTitleTemplate?.id === selectedTitleTemplateId))
    )
  );

  const handleCopyText = (text: string, type: 'title' | 'hashtags' | 'all') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setTitleCopiedType(type);
    setTimeout(() => setTitleCopiedType(null), 2000);
    showToast(
      type === 'title' ? 'Copied title to clipboard!' :
      type === 'hashtags' ? 'Copied hashtags to clipboard!' : 'Copied title & hashtags!',
      'success'
    );
  };

  const handleCopySingleTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1800);
    showToast(`Copied ${tag}`, 'info');
  };

  const handleSaveInlineTitle = () => {
    setIsEditingTitle(false);
    if (onUpdateGeneratedContent) {
      onUpdateGeneratedContent(editedTitle, editedTags);
      showToast('Title updated', 'success');
    }
  };

  const handleSaveInlineTags = () => {
    setIsEditingTags(false);
    if (onUpdateGeneratedContent) {
      onUpdateGeneratedContent(editedTitle, editedTags);
      showToast('Hashtags updated', 'success');
    }
  };

  const parsedTagsList = (editedTags || displayHashtags || '')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-[160] bg-zinc-950 flex flex-col w-full h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] text-white animate-in fade-in duration-150 overflow-hidden font-sans">
      
      {/* 1. TOP HEADER: Clean, Focused, No Clutter */}
      <header className="h-12 sm:h-14 px-3 sm:px-4 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-md shrink-0 sticky top-0 z-30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 text-purple-300 flex items-center justify-center border border-purple-500/30 shrink-0">
            <Sparkles size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-xs sm:text-sm font-black text-white tracking-tight truncate">
                AI Title &amp; # Studio
              </h2>
              {masterBucketName && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-950/80 text-purple-300 rounded border border-purple-800/60 hidden xs:inline truncate max-w-[120px]">
                  {masterBucketName}
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 truncate hidden sm:block">
              Generate viral video titles &amp; trending hashtags with Gemini AI
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Templates Switcher Dropdown (Unobtrusive) */}
          {titleTemplates.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTemplatesMenu(prev => !prev)}
                className="h-8 px-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Switch prompt templates"
              >
                <Wand2 size={13} className="text-purple-400" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {currentTpl?.name || 'Template'}
                </span>
                <ChevronDown size={12} className={`transition-transform duration-150 ${showTemplatesMenu ? 'rotate-180' : ''}`} />
              </button>

              {showTemplatesMenu && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowTemplatesMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-64 max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 divide-y divide-zinc-800">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Saved Templates</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTemplatesMenu(false);
                          handleAddNewTitleTemplate();
                        }}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <Plus size={11} /> New
                      </button>
                    </div>
                    {titleTemplates.map((tpl) => {
                      const isSelected = tpl.id === selectedTitleTemplateId;
                      const isStarred = (activeProject?.active_title_template_id === tpl.id) ||
                        (!activeProject?.active_title_template_id && (activeTitleTemplate?.id === tpl.id));
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setShowTemplatesMenu(false);
                            handleOpenTitleTemplateDetail(tpl);
                          }}
                          className={`px-3 py-2 flex items-center justify-between gap-2 hover:bg-zinc-800 cursor-pointer transition ${
                            isSelected ? 'bg-purple-950/40 text-purple-200' : 'text-zinc-200'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold truncate flex items-center gap-1.5">
                              <span>{tpl.name || 'Untitled'}</span>
                              {isStarred && <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />}
                            </div>
                            <div className="text-[10px] text-zinc-400 truncate font-mono">
                              {tpl.prompt ? tpl.prompt.slice(0, 45) : 'Default prompt'}
                            </div>
                          </div>
                          {titleTemplates.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTitleTemplate(tpl.id, tpl.name);
                              }}
                              className="text-zinc-500 hover:text-rose-400 p-1 rounded transition"
                              title="Delete template"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Close Studio Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
      </header>

      {/* 2. MAIN BODY: MODERN STUDIO VIEW */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 pb-24">
        <div className="max-w-3xl mx-auto w-full space-y-3.5">
          
          {/* HERO RESULTS & GENERATION CARD */}
          <div className="bg-gradient-to-b from-zinc-900/95 via-zinc-900/90 to-zinc-950 border border-purple-500/25 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 backdrop-blur-sm">
            {/* Card Header with Status & Primary Actions */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-600/30 text-purple-300 border border-purple-500/30 shrink-0">
                  <Sparkles size={14} />
                </div>
                <span className="text-xs sm:text-sm font-black text-zinc-100 tracking-wide uppercase">
                  AI Title &amp; Hashtags
                </span>
                {isTestingTitleGen ? (
                  <span className="text-[10px] text-purple-300 font-mono font-bold flex items-center gap-1 bg-purple-950/80 border border-purple-700/50 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 size={10} className="animate-spin text-purple-300" />
                    Generating...
                  </span>
                ) : displayTitle ? (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/80 border border-emerald-600/50 px-2 py-0.5 rounded-full">
                    Ready ✓
                  </span>
                ) : null}
              </div>

              {displayTitle && (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRetryCurrentPrompt}
                    disabled={isTestingTitleGen}
                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white font-bold text-xs rounded-xl border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-40 shadow-sm"
                    title="Regenerate title and hashtags"
                  >
                    <RefreshCw size={12} className={isTestingTitleGen ? "animate-spin text-purple-400" : ""} />
                    <span className="hidden xs:inline">Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyText(`${editedTitle || displayTitle}\n\n${editedTags || displayHashtags}`.trim(), 'all')}
                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-md transition cursor-pointer flex items-center gap-1 text-xs font-black active:scale-95"
                    title="Copy Title + Hashtags combined for social caption"
                  >
                    {titleCopiedType === 'all' ? <CheckCheck size={13} className="text-emerald-300" /> : <Copy size={13} />}
                    <span>{titleCopiedType === 'all' ? 'Copied!' : 'Copy All'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Card Content State */}
            {isTestingTitleGen ? (
              <div className="py-12 px-4 bg-black/60 rounded-2xl border border-purple-500/30 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-900/80 to-indigo-900/80 border border-purple-500/50 flex items-center justify-center text-purple-300 shadow-xl shadow-purple-950/60">
                  <Loader2 size={24} className="animate-spin text-purple-300" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Gemini AI is crafting viral titles &amp; hashtags...</p>
                  <p className="text-xs text-purple-300/80 mt-1 max-w-sm">
                    Analyzing clips and optimizing for algorithmic traction, high click-through rate, and search discovery
                  </p>
                </div>
              </div>
            ) : displayTitle ? (
              <div className="space-y-3.5">
                
                {/* 1. Generated Video Title Box */}
                <div className="bg-black/80 rounded-2xl border border-zinc-800 p-3.5 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={12} className="text-amber-400" />
                      Generated Video Title
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsEditingTitle(prev => !prev)}
                        className="text-[11px] text-zinc-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition px-2 py-1 rounded-lg hover:bg-zinc-800"
                        title={isEditingTitle ? "Finish editing" : "Edit title"}
                      >
                        <Edit3 size={11} />
                        <span>{isEditingTitle ? 'Done' : 'Edit'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(editedTitle || displayTitle, 'title')}
                        className="text-[11px] text-zinc-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 active:scale-95"
                      >
                        {titleCopiedType === 'title' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{titleCopiedType === 'title' ? 'Copied' : 'Copy Title'}</span>
                      </button>
                    </div>
                  </div>

                  {isEditingTitle ? (
                    <div className="space-y-2">
                      <textarea
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full bg-zinc-950 border border-purple-500/50 focus:border-purple-400 rounded-xl p-3 text-sm font-bold text-white outline-none resize-none leading-relaxed"
                        rows={2}
                      />
                      <button
                        type="button"
                        onClick={handleSaveInlineTitle}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition active:scale-95"
                      >
                        Save Title
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingTitle(true)}
                      className="text-sm sm:text-base font-black text-white leading-relaxed break-words tracking-tight bg-zinc-950/90 p-3 rounded-xl border border-zinc-800/80 hover:border-zinc-700 cursor-text transition"
                      title="Click to edit title"
                    >
                      {editedTitle || displayTitle}
                    </div>
                  )}
                </div>

                {/* 2. Generated Hashtags Box */}
                {(editedTags || displayHashtags) && (
                  <div className="bg-black/80 rounded-2xl border border-zinc-800 p-3.5 sm:p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Hash size={12} />
                        Viral Hashtags
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingTags(prev => !prev)}
                          className="text-[11px] text-zinc-400 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition px-2 py-1 rounded-lg hover:bg-zinc-800"
                          title={isEditingTags ? "Finish editing" : "Edit tags"}
                        >
                          <Edit3 size={11} />
                          <span>{isEditingTags ? 'Done' : 'Edit'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(editedTags || displayHashtags, 'hashtags')}
                          className="text-[11px] text-cyan-300 hover:text-cyan-200 font-bold flex items-center gap-1 cursor-pointer transition px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 active:scale-95"
                        >
                          {titleCopiedType === 'hashtags' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          <span>{titleCopiedType === 'hashtags' ? 'Copied' : 'Copy Tags'}</span>
                        </button>
                      </div>
                    </div>

                    {isEditingTags ? (
                      <div className="space-y-2">
                        <textarea
                          value={editedTags}
                          onChange={(e) => setEditedTags(e.target.value)}
                          className="w-full bg-zinc-950 border border-cyan-500/50 focus:border-cyan-400 rounded-xl p-3 text-xs font-mono font-bold text-cyan-200 outline-none resize-none leading-relaxed"
                          rows={2}
                          placeholder="#Viral #Shorts #Trending..."
                        />
                        <button
                          type="button"
                          onClick={handleSaveInlineTags}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition active:scale-95"
                        >
                          Save Hashtags
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {parsedTagsList.map((tag, idx) => {
                          const isThisCopied = copiedTag === tag;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleCopySingleTag(tag)}
                              className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-zinc-800/90 hover:bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 border border-zinc-700 hover:border-cyan-500/50 transition cursor-pointer active:scale-95 flex items-center gap-1"
                              title="Click to copy this hashtag"
                            >
                              <span>{tag}</span>
                              {isThisCopied && <Check size={10} className="text-emerald-400 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              /* Empty / Initial State */
              <div className="py-8 px-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-900/30 border border-purple-500/40 flex items-center justify-center text-purple-300 mx-auto shadow-lg shadow-purple-950/50">
                  <Sparkles size={24} className="text-amber-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Generate Viral Title &amp; Hashtags
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Gemini AI analyzes your clips and crafts high-converting titles and trending hashtags ready for TikTok, Instagram Reels, and YouTube Shorts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRetryCurrentPrompt}
                  disabled={isTestingTitleGen}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-500 via-indigo-600 to-purple-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-xl shadow-purple-900/50 transition flex items-center justify-center gap-2 cursor-pointer mx-auto active:scale-95 border border-purple-400/40"
                >
                  <Sparkles size={16} className="text-amber-300" />
                  <span>Generate Title &amp; Hashtags</span>
                </button>
              </div>
            )}
          </div>

          {/* STYLE PRESETS (Quick 1-Tap Styles) */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
            <span className="text-[10.5px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 px-0.5">
              <Sparkles size={12} className="text-amber-400" />
              Style Presets (Tap to apply)
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {PROMPT_INSPIRATIONS.map((preset, idx) => {
                const isActive = activePresetIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActivePresetIndex(idx);
                      setEditingTitlePrompt(preset.prompt);
                      setIsPromptSaved(false);
                      showToast(`Applied style: ${preset.label}`, 'info');
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 shrink-0 whitespace-nowrap shadow-sm cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border-zinc-700/80 hover:border-purple-500/60'
                    }`}
                    title={preset.desc}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLLAPSIBLE PROMPT INSTRUCTIONS / TOPIC HINT */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsPromptCustomizerOpen(prev => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800/50 transition cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Wand2 size={14} className="text-purple-400 shrink-0" />
                <span className="text-xs font-bold text-zinc-300">
                  Custom Prompt Instructions &amp; Topic Hint
                </span>
                <span className="text-[9.5px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                  {isPromptSaved ? 'Saved' : 'Custom'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-semibold">
                <span>{isPromptCustomizerOpen ? 'Hide' : 'Customize'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isPromptCustomizerOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isPromptCustomizerOpen && (
              <div className="p-4 pt-1 border-t border-zinc-800 space-y-3 animate-in fade-in duration-150">
                <textarea
                  value={editingTitlePrompt}
                  onChange={(e) => {
                    setEditingTitlePrompt(e.target.value);
                    setIsPromptSaved(false);
                  }}
                  placeholder="Enter custom instructions or topic hint for AI title generation..."
                  className="w-full bg-black/90 border border-zinc-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-xl p-3 text-xs text-zinc-100 outline-none transition font-mono leading-relaxed resize-y shadow-inner min-h-[90px] max-h-[30vh]"
                  rows={4}
                />

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTitlePrompt(DEFAULT_TITLE_PROMPT);
                      setIsPromptSaved(false);
                      showToast("Reset to default viral prompt", "info");
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700 text-[11px] font-bold transition cursor-pointer active:scale-95"
                  >
                    Reset to Default
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-400">
                      {editingTitlePrompt.length} chars
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveCurrentPromptDetail(editingTitleName, editingTitlePrompt);
                        showToast("Instructions saved", "success");
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition cursor-pointer active:scale-95 shadow-sm"
                    >
                      Save Instructions
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
