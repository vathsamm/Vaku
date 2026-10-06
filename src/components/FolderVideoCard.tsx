import React, { useMemo } from 'react';
import { 
  CheckSquare, Square, Layers, AlertCircle, Sparkles, Zap, Scissors, Download, MoreVertical, Clock, Film, EyeOff, Play 
} from 'lucide-react';
import { VideoData } from '../types';
import { formatRecentlyUsed } from '../utils/clipUsage';
import { useUltraDataSaver } from '../utils/dataSaver';
import { LongPressVideoPreviewOverlay } from './LongPressVideoPreview';
import { useLongPressPreview } from '../utils/useLongPressPreview';

interface FolderVideoCardProps {
  id: string;
  v: VideoData;
  isSelected: boolean;
  canEdit: boolean;
  isInsideMergedBranch?: boolean;
  ultraDataSaver?: boolean;
  onSelectToggle: (id: string) => void;
  onPlay: (fileId: string) => void;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent, id: string, v: VideoData) => void;
  onDelete: (id: string, name: string) => void;
  onCompress: (id: string) => void;
  onTrim: (id: string) => void;
  onDownload: (id: string, v: VideoData) => void;
  onOpenAiStudio?: (v: VideoData) => void;
  onToggleHide?: (id: string) => void;
}

export const FolderVideoCard: React.FC<FolderVideoCardProps> = ({
  id,
  v,
  isSelected,
  canEdit,
  isInsideMergedBranch = false,
  ultraDataSaver: propUltraDataSaver,
  onSelectToggle,
  onPlay,
  onContextMenu,
  onCompress,
  onTrim,
  onDownload,
  onOpenAiStudio,
  onToggleHide
}) => {
  const { config } = useUltraDataSaver();
  const isUltra = propUltraDataSaver ?? config.enabled;

  const dur = typeof v.duration === 'number' ? v.duration : 4.0;
  const isOver = dur > 3.0;
  const isCompressible = dur > 3.0 && dur <= 3.5;
  const isNeedsTrim = dur > 3.5;
  const isMrg = v.status === 'merging' || v.status === 'processing';

  const fileKey = v.file_id || v.id || id;
  const thumbUrl = (isUltra && config.microThumbnails) 
    ? `/api/thumb/${fileKey}?ultra=1` 
    : `/api/thumb/${fileKey}`;
  const videoSrc = v.url?.startsWith('/api/') ? v.url : (v.file_id ? `/api/video/${v.file_id}` : (v.id ? `/api/video/${v.id}` : `/api/video/${id}`));

  const { 
    activePreview, 
    startLongPress, 
    moveLongPress, 
    endLongPress, 
    checkDidLongPress, 
    closePreview 
  } = useLongPressPreview();

  const previewData = useMemo(() => ({
    videoSrc,
    posterUrl: thumbUrl,
    title: v.name || v.source_name || `Clip ${id.slice(-6)}`,
    duration: dur
  }), [videoSrc, thumbUrl, v.name, v.source_name, id, dur]);

  return (
    <>
      <div 
        onContextMenu={(e) => onContextMenu(e, id, v)}
        onTouchStart={(e) => startLongPress(previewData, e)}
        onTouchMove={moveLongPress}
        onTouchEnd={endLongPress}
        onTouchCancel={endLongPress}
        onMouseDown={(e) => startLongPress(previewData, e)}
        onMouseMove={moveLongPress}
        onMouseUp={endLongPress}
        className={`group relative aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col justify-end cursor-pointer select-none ${
          isSelected
            ? 'border-2 border-purple-500 ring-2 ring-purple-500/70 shadow-purple-950/60'
            : isOver 
              ? 'border-2 border-red-500 shadow-md shadow-red-950/70 ring-2 ring-red-500/80'
              : v.is_new
                ? 'border-2 border-orange-500 shadow-lg shadow-orange-950/60 ring-2 ring-orange-500/70 hover:border-orange-400'
                : isMrg
                  ? 'border-purple-500/60 ring-2 ring-purple-500/30'
                  : isInsideMergedBranch
                    ? 'border border-amber-500/50 hover:border-amber-400'
                    : 'border-gray-800 hover:border-gray-600'
        }`}
        onClick={() => {
          if (checkDidLongPress()) return;
          if (!isMrg) {
            if (onPlay) {
              onPlay(v.file_id || id);
            } else {
              onSelectToggle(id);
            }
          }
        }}
      >
        <div className="absolute top-1.5 inset-x-1.5 z-30 flex items-center justify-between gap-1 pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectToggle(id);
              }}
              className={`p-1 rounded-md transition-all cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-purple-600 text-white shadow ring-1 ring-purple-300'
                  : 'bg-black/70 text-gray-300 opacity-90 sm:opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/90'
              }`}
              title={isSelected ? "Deselect clip" : "Select clip (multi-select)"}
            >
              {isSelected ? <CheckSquare size={12} /> : <Square size={12} />}
            </button>

            {v.variation && (
              <span className="text-[8px] font-mono font-black px-1 py-0.2 rounded bg-amber-400 text-black shadow border border-amber-300 shrink-0">
                {v.variation}
              </span>
            )}

            {(() => {
              const usedTag = formatRecentlyUsed(v.last_used_at, v.usage_count);
              if (!usedTag) return null;
              return (
                <span 
                  className="hidden md:flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/85 backdrop-blur-xs border border-purple-500/50 text-[8px] font-bold text-purple-200 shadow shrink-0 truncate max-w-[70px]"
                  title={`Clip was exported in video editor: ${usedTag}`}
                >
                  <Clock size={7} className="text-purple-400 shrink-0" />
                  <span className="truncate">{usedTag}</span>
                </span>
              );
            })()}
          </div>

          <div className="flex items-center gap-0.5 pointer-events-auto shrink-0 ml-auto">
            {isUltra && (
              <span 
                className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-black/85 border border-emerald-500/50 text-[7.5px] font-bold text-emerald-300 shadow shrink-0"
                title="Ultra Internet Saving Mode: Video streaming on hover disabled"
              >
                <Zap size={7} className="text-emerald-400 fill-emerald-400" />
                <span className="hidden sm:inline">Saver</span>
              </span>
            )}
            {onToggleHide && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHide(id);
                }}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`p-1 rounded-md transition cursor-pointer shadow ${
                  v.is_hidden
                    ? 'bg-red-600 text-white ring-1 ring-red-400'
                    : 'bg-black/70 text-gray-300 opacity-90 sm:opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-black/90'
                }`}
                title={v.is_hidden ? "Unhide clip (Hidden across Master Bucket)" : "Hide clip from Master Bucket (All Projects)"}
              >
                <EyeOff size={10} className={v.is_hidden ? 'stroke-[2.5]' : ''} />
              </button>
            )}
          </div>
        </div>

        {isMrg ? (
          <div className="absolute inset-0 bg-gray-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
            <div className="relative mb-2">
              <div className="w-9 h-9 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
              <Layers size={16} className="absolute inset-0 m-auto text-purple-300" />
            </div>
            <p className="text-xs font-bold text-purple-300 animate-pulse">Merging Video...</p>
            <p className="text-[10px] text-gray-400 font-mono mt-0.5">FFmpeg Processing</p>
          </div>
        ) : (v.file_id || v.url) && (v.status === 'success' || v.status === 'ready' || v.status === 'completed' || v.is_export_video) ? (
          <>
            <img
              src={thumbUrl}
              alt={v.name || 'Video thumbnail'}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover transition-all duration-300 opacity-90 group-hover:opacity-100 group-hover:scale-105 pointer-events-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Play hover/tap indicator */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (checkDidLongPress()) return;
                onPlay(v.file_id || id);
              }}
              className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25 cursor-pointer pointer-events-auto"
              title="Click to play video"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg border border-white/25 hover:scale-110 active:scale-95 transition-transform">
                <Play size={14} className="fill-white translate-x-0.5" />
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gray-900">
            <AlertCircle size={32} className="text-rose-500 mb-2" />
            <p className="text-xs text-gray-400">{v.status || "Processing..."}</p>
          </div>
        )}

        {v.is_hidden && (
          <div 
            className="absolute inset-0 z-20 pointer-events-none rounded-2xl bg-red-950/35 backdrop-blur-[0.5px] border-2 border-red-500/80 shadow-inner" 
            title="Hidden across Master Bucket (All Projects)"
          />
        )}

        <div className="relative z-20 p-1.5 sm:p-2.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-1 justify-end">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-nowrap min-w-0">
            {isOver ? (
              <span className="text-[10px] font-mono font-bold text-red-300 bg-red-950/90 border border-red-500/80 px-1.5 py-0.2 rounded-md flex items-center gap-1 shadow" title="Duration exceeds 3.0s (Compress recommended)">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                <span>{Math.round(dur * 10) / 10}s</span>
              </span>
            ) : (
              <span className="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded-md">
                {v.duration ? `${Math.round(dur * 10) / 10}s` : 'Video'}
              </span>
            )}
            {v.is_hidden && (
              <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded-md bg-red-600 text-white shadow flex items-center gap-0.5" title="Hidden across Master Bucket (All Projects)">
                <EyeOff size={8} />
                <span>HIDDEN</span>
              </span>
            )}
            {Boolean(v.is_export_video || (v as any).is_exported) && (
              <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded-md bg-cyan-400 text-black shadow flex items-center gap-0.5" title="Exported Video Timeline Master">
                <Film size={8} className="fill-black" />
                <span>EXPORTED</span>
              </span>
            )}
            {v.is_ai_generated && (
              <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded-md bg-amber-400 text-black shadow flex items-center gap-0.5" title={`AI Generated Clip (${v.ai_model || 'FLUX.3 / Kling'})`}>
                <Sparkles size={8} className="fill-black" />
                <span>AI</span>
              </span>
            )}
            {v.is_new && (
              <span className="text-[9px] font-bold font-mono px-1 py-0.2 rounded-md bg-gradient-to-r from-orange-500 to-amber-400 text-black shadow-md shadow-orange-500/40 flex items-center gap-0.5 animate-pulse">
                <Sparkles size={8} className="fill-black" />
                <span>NEW</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 w-full pt-0.5">
            <div className="flex items-center gap-1 min-w-0">
              {onOpenAiStudio && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAiStudio(v);
                  }}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="p-1 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 rounded-md transition active:scale-95 cursor-pointer shrink-0 flex items-center justify-center min-w-[22px] min-h-[22px]"
                  title="AI Studio"
                >
                  <Sparkles size={11} className="text-amber-300" />
                </button>
              )}

              {canEdit && isCompressible && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompress(id);
                  }}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="p-1 bg-red-950/90 hover:bg-red-800 border border-red-500/80 rounded-md text-red-200 transition cursor-pointer shrink-0 flex items-center justify-center min-w-[22px] min-h-[22px]"
                  title="Compress"
                >
                  <Zap size={11} className="fill-amber-400 text-amber-400" />
                </button>
              )}

              {canEdit && isNeedsTrim && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrim(id);
                  }}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="p-1 bg-rose-950/90 hover:bg-rose-800 border border-rose-500/80 rounded-md text-rose-200 transition cursor-pointer shrink-0 flex items-center justify-center min-w-[22px] min-h-[22px]"
                  title="Trim"
                >
                  <Scissors size={11} className="text-purple-300" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(id, v);
                }} 
                onTouchEnd={(e) => e.stopPropagation()}
                className="p-1 bg-black/70 hover:bg-purple-600 rounded-md text-gray-300 hover:text-white transition cursor-pointer shrink-0 flex items-center justify-center min-w-[22px] min-h-[22px]"
                title="Download"
              >
                <Download size={11} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(e, id, v);
                }}
                className="p-1 bg-black/80 hover:bg-purple-600 active:bg-purple-500 border border-gray-700/70 hover:border-purple-400 rounded-md text-gray-200 hover:text-white transition cursor-pointer shrink-0 min-w-[22px] min-h-[22px] flex items-center justify-center active:scale-90"
                title="Options"
                aria-label="More clip actions"
              >
                <MoreVertical size={12} className="shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <LongPressVideoPreviewOverlay 
        preview={activePreview} 
        onClose={closePreview} 
      />
    </>
  );
};
