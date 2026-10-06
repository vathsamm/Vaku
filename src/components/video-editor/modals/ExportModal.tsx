import React, { useState } from 'react';
import { 
  Download, X, Check, Send, Loader2, Sparkles, Copy, Share2, 
  Scissors, ExternalLink, Film, Minimize2, Cpu, Smartphone, Cloud
} from 'lucide-react';
import { DB, VideoData, VideoEditorClip, VideoEditorProject } from '../../../types';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeClips: VideoEditorClip[];
  totalDuration: number;
  isExporting: boolean;
  exportProgress: number;
  exportStatusText: string;
  exportResult: any;
  setExportResult: (r: any) => void;
  handleCancelExport: () => void;
  handleExportMergedVideo: () => void;
  handleExportOnDevice?: () => void;
  renderEngine?: 'mobile_offline' | 'cloud_server';
  setRenderEngine?: (engine: 'mobile_offline' | 'cloud_server') => void;
  handleDownloadExportedVideo: (url: string, filename: string) => void;
  isDownloadingBlob: boolean;
  isSendingToTelegram: boolean;
  handleSendExportResultToTelegram: () => void;
  telegramFeedback: string | null;
  activeProject: VideoEditorProject | null;
  testTitleResult: { title: string; hashtags: string } | null;
  db: DB;
  setSocialShareVideoTarget: (target: any) => void;
  setShowInternalGenHistory: (v: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  useKaggleGpu: boolean;
  setUseKaggleGpu: (v: boolean) => void;
  enableGpuEnhancement: boolean;
  setEnableGpuEnhancement: (v: boolean) => void;
  setEnableProteusUpscale: (v: boolean) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  activeClips,
  totalDuration,
  isExporting,
  exportProgress,
  exportStatusText,
  exportResult,
  setExportResult,
  handleCancelExport,
  handleExportMergedVideo,
  handleExportOnDevice,
  renderEngine = 'mobile_offline',
  setRenderEngine,
  handleDownloadExportedVideo,
  isDownloadingBlob,
  isSendingToTelegram,
  handleSendExportResultToTelegram,
  telegramFeedback,
  activeProject,
  testTitleResult,
  db,
  setSocialShareVideoTarget,
  setShowInternalGenHistory,
  showToast,
  useKaggleGpu,
  setUseKaggleGpu,
  enableGpuEnhancement,
  setEnableGpuEnhancement,
  setEnableProteusUpscale,
}) => {
  const [internalRenderEngine, setInternalRenderEngine] = useState<'mobile_offline' | 'cloud_server'>(() => {
    try {
      const stored = localStorage.getItem('vd_render_engine');
      if (stored === 'cloud_server' || stored === 'mobile_offline') return stored;
    } catch (_) {}
    return 'mobile_offline';
  });

  const activeEngine = setRenderEngine ? renderEngine : internalRenderEngine;
  const updateEngine = (eng: 'mobile_offline' | 'cloud_server') => {
    if (setRenderEngine) setRenderEngine(eng);
    setInternalRenderEngine(eng);
    try {
      localStorage.setItem('vd_render_engine', eng);
    } catch (_) {}
  };
  const hasKaggleAccount = Boolean(
    (db?.config?.kaggle_accounts && db.config.kaggle_accounts.some((a: any) => a && a.enabled !== false && a.username && a.key)) ||
    (db?.config?.kaggle_username && db?.config?.kaggle_key)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600/30 rounded-xl text-purple-300">
              <Download size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Export 9:16 Video</h3>
              <p className="text-[11px] text-gray-400">{activeClips.length} clips • {totalDuration.toFixed(1)}s total</p>
            </div>
          </div>
          <button
            type="button"
            onClick={isExporting ? () => handleCancelExport() : () => {
              setExportResult(null);
              onClose();
            }}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition cursor-pointer"
            title={isExporting ? "Cancel export" : "Close"}
          >
            <X size={16} />
          </button>
        </div>

        {exportResult && exportResult.downloadUrl ? (
          <div className="space-y-3.5 py-1 animate-in fade-in">
            {/* Inline Video Player Preview */}
            <div className="relative w-full rounded-xl overflow-hidden bg-black border border-gray-800 aspect-[9/16] max-h-56 mx-auto flex items-center justify-center">
              <video
                src={exportResult.downloadUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            {/* File Information Card */}
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-xs space-y-1">
              <div className="flex items-center justify-between text-gray-300">
                <span className="text-gray-400">Status:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Check size={13} className="text-emerald-400" /> Export Ready
                </span>
              </div>
              {Boolean(exportResult.telegram_bot_sent) ? (
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400">Telegram Bot:</span>
                  <span className="font-bold text-sky-400 flex items-center gap-1">
                    <Send size={12} className="text-sky-400" /> Sent to Telegram Bot
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-gray-300 pt-0.5">
                  <span className="text-gray-400">Telegram Bot:</span>
                  <button
                    type="button"
                    disabled={isSendingToTelegram}
                    onClick={handleSendExportResultToTelegram}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingToTelegram ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    <span>Send to Telegram</span>
                  </button>
                </div>
              )}
              {telegramFeedback && (
                <div className="text-[10px] text-sky-300 font-mono text-center py-0.5">
                  {telegramFeedback}
                </div>
              )}
              <div className="flex items-center justify-between text-gray-300">
                <span className="text-gray-400">File Name:</span>
                <span className="font-mono text-white text-[11px] truncate max-w-[200px]" title={exportResult.filename}>
                  {exportResult.filename}
                </span>
              </div>
              {exportResult.size ? (
                <div className="flex items-center justify-between text-gray-300">
                  <span className="text-gray-400">File Size:</span>
                  <span className="font-mono font-bold text-purple-300">
                    {(exportResult.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-gray-300">
                <span className="text-gray-400">Format:</span>
                <span className="font-mono text-gray-300">1080x1920 • 30 FPS MP4</span>
              </div>
            </div>

            {/* AI Generated Title & Hashtags Preview (if generated by Master Bucket template) */}
            {(exportResult.generated_title || exportResult.generated_hashtags) && (
              <div className="p-3 bg-purple-950/40 rounded-xl border border-purple-500/40 space-y-1.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-200 flex items-center gap-1.5 text-[11px]">
                    <Sparkles size={12} className="text-purple-400" />
                    AI Title & Hashtags
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const full = `${exportResult.generated_title || ''}\n\n${exportResult.generated_hashtags || ''}`.trim();
                      navigator.clipboard.writeText(full);
                      showToast("Copied title & hashtags to clipboard!", "success");
                    }}
                    className="px-2 py-0.5 text-[10px] bg-purple-900/60 hover:bg-purple-800 text-purple-300 rounded-lg flex items-center gap-1 cursor-pointer transition border border-purple-500/30"
                  >
                    <Copy size={10} />
                    <span>Copy</span>
                  </button>
                </div>
                {exportResult.generated_title && (
                  <p className="font-semibold text-white text-xs leading-snug">
                    {exportResult.generated_title}
                  </p>
                )}
                {exportResult.generated_hashtags && (
                  <p className="font-mono text-cyan-300 text-[11px]">
                    {exportResult.generated_hashtags}
                  </p>
                )}
              </div>
            )}

            {/* Primary Actions: Share & Download */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Share Video Button */}
                <button
                  type="button"
                  onClick={() => {
                    const vidId = exportResult.vid || '';
                    const resolvedTitle = (
                      exportResult.generated_title ||
                      activeProject?.generated_title ||
                      testTitleResult?.title ||
                      activeProject?.name ||
                      exportResult.filename
                    ).trim();

                    const resolvedHashtags = (
                      exportResult.generated_hashtags ||
                      activeProject?.generated_hashtags ||
                      testTitleResult?.hashtags ||
                      ''
                    ).trim();

                    const resolvedCaption = (
                      exportResult.share_caption ||
                      activeProject?.share_caption ||
                      (resolvedTitle && resolvedHashtags ? `${resolvedTitle}\n\n${resolvedHashtags}` : resolvedTitle)
                    ).trim();

                    const vObj: VideoData = (db?.videos && db.videos[vidId]) || {
                      id: vidId,
                      name: exportResult.filename,
                      generated_title: resolvedTitle,
                      generated_hashtags: resolvedHashtags,
                      share_caption: resolvedCaption
                    } as any;
                    const streamUrl = `/api/video/${(exportResult as any).telegram_file_id || exportResult.vid}`;
                    setSocialShareVideoTarget({
                      video: vObj,
                      url: `${window.location.origin}${streamUrl}`,
                      title: resolvedTitle,
                      hashtags: resolvedHashtags,
                      caption: resolvedCaption
                    });
                  }}
                  className="py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/40"
                >
                  <Share2 size={15} className="text-white" />
                  <span>📱 Share Video</span>
                </button>

                {/* Download Video Button */}
                <button
                  type="button"
                  disabled={isDownloadingBlob}
                  onClick={() => handleDownloadExportedVideo(exportResult.downloadUrl, exportResult.filename)}
                  className="py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDownloadingBlob ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      <span>Download {exportResult.size ? `(${(exportResult.size / (1024 * 1024)).toFixed(1)} MB)` : ''}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Re-clip & Rearrange Timeline Button */}
              <button
                type="button"
                onClick={() => {
                  setExportResult(null);
                  onClose();
                }}
                className="w-full py-2 bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 border border-purple-500/50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                <Scissors size={14} className="text-purple-300" />
                <span>Rearrange Clips / Re-clip Timeline</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={exportResult.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={13} />
                  <span>Open in Browser</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setExportResult(null);
                    onClose();
                  }}
                  className="flex-1 py-2 bg-gray-800 hover:bg-gray-750 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition"
                >
                  Done
                </button>
              </div>

              {/* View All Exported History */}
              <button
                type="button"
                onClick={() => {
                  setExportResult(null);
                  onClose();
                  setShowInternalGenHistory(true);
                }}
                className="w-full py-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 rounded-xl text-[11px] font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <Film size={12} className="text-purple-400" />
                <span>Open Generation & Export History</span>
              </button>
            </div>
          </div>
        ) : isExporting ? (
          <div className="space-y-3.5 py-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <Loader2 size={13} className="animate-spin text-purple-400 shrink-0" />
                <span className="text-gray-200 font-semibold truncate">{exportStatusText}</span>
              </div>
              <span className="font-mono text-purple-300 font-bold shrink-0 text-sm">{exportProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden shadow-inner relative">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400 px-0.5">
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Studio HD • 30 FPS CRF 18
              </span>
              <span>Rendering in background</span>
            </div>

            {/* Actions: Minimize to Background or Cancel Export */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  showToast("⚡ Render running on Kaggle GPU in background! Check History or notifications when ready.", "info");
                }}
                className="px-3.5 py-2 bg-purple-950/80 hover:bg-purple-900/90 text-purple-200 border border-purple-600/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                title="Keep rendering in background and return to editor"
              >
                <Minimize2 size={13} className="text-purple-300 shrink-0" />
                <span>Run in Background</span>
              </button>
              <button
                type="button"
                onClick={() => handleCancelExport()}
                className="px-3.5 py-2 bg-gray-800 hover:bg-rose-950/80 active:bg-rose-900/90 text-gray-300 hover:text-rose-200 border border-gray-700 hover:border-rose-500/50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                title="Stop rendering and cancel export"
              >
                <X size={13} className="text-rose-400 shrink-0" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 text-xs space-y-1.5">
              <div className="flex justify-between text-gray-300">
                <span>Resolution:</span>
                <span className="font-mono font-bold text-white">1080x1920 (Full HD 9:16)</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Framerate:</span>
                <span className="font-mono font-bold text-emerald-400">30 FPS Studio</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Encoding:</span>
                <span className="font-mono font-bold text-purple-300">H.264 + AAC (Faststart MP4)</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Clips Count:</span>
                <span className="font-mono font-bold text-white">{activeClips.length}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Total Duration:</span>
                <span className="font-mono font-bold text-white">{totalDuration.toFixed(1)} seconds</span>
              </div>
            </div>

            {/* Render Engine Selection: In-Phone Mobile (100% Offline, Zero Data) vs Cloud Engine */}
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-300">Execution Mode:</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  activeEngine === 'mobile_offline' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                }`}>
                  {activeEngine === 'mobile_offline' ? '📱 100% Offline • 0 KB Internet' : '⚡ Cloud Server'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateEngine('mobile_offline')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    activeEngine === 'mobile_offline'
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xs'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Smartphone size={14} className={activeEngine === 'mobile_offline' ? 'text-emerald-400' : 'text-gray-400'} />
                    <span className="text-xs font-bold text-white">In-Phone Render</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    Renders right on phone. Uses zero internet data.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => updateEngine('cloud_server')}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                    activeEngine === 'cloud_server'
                      ? 'bg-purple-950/40 border-purple-500/60 shadow-xs'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Cloud size={14} className={activeEngine === 'cloud_server' ? 'text-purple-400' : 'text-gray-400'} />
                    <span className="text-xs font-bold text-white">Cloud Engine</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    CPU or Kaggle Dual-T4 GPU server render.
                  </p>
                </button>
              </div>

              {/* In-Phone Render Specs info */}
              {activeEngine === 'mobile_offline' ? (
                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[10px] text-emerald-300 flex items-start gap-1.5">
                  <span className="shrink-0 text-emerald-400 font-bold">✓</span>
                  <span>
                    <strong>Offline Mobile Canvas Engine:</strong> Video elements are read from local phone memory. Captions, styles, audio layers, and 30 FPS timing are processed on your device.
                  </span>
                </div>
              ) : (
                /* Cloud Mode: Studio CPU vs Kaggle Dual-T4 GPU */
                <div className="p-2.5 bg-gray-900/80 rounded-lg border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1 rounded-md shrink-0 ${useKaggleGpu ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {useKaggleGpu ? <Sparkles size={14} /> : <Cpu size={14} />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">
                          {useKaggleGpu ? '⚡ Kaggle Dual-T4 GPU' : '⚡ Studio CPU Engine'}
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {useKaggleGpu ? 'Proteus V3 AI Super-Resolution' : 'Ultra Fast (~15s) H.264 MP4'}
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={useKaggleGpu}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUseKaggleGpu(checked);
                          setEnableGpuEnhancement(checked);
                          setEnableProteusUpscale(checked);
                          try {
                            localStorage.setItem('remixx_use_kaggle_gpu', String(checked));
                            localStorage.setItem('remixx_enable_gpu_enhancement', String(checked));
                          } catch (_) {}
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>

                  {useKaggleGpu && !hasKaggleAccount && (
                    <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-600/40 text-[10px] text-amber-300 flex items-start gap-1.5">
                      <span className="shrink-0 text-amber-400 font-bold">ℹ️</span>
                      <span>
                        No Kaggle API credentials saved. Export will run on the fast Studio CPU engine.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={activeEngine === 'mobile_offline' && handleExportOnDevice ? handleExportOnDevice : handleExportMergedVideo}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>{activeEngine === 'mobile_offline' ? 'Start Mobile Render' : 'Start Cloud Export'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
