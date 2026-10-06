import React from 'react';
import { 
  Film, Download, Send, Check, Loader2, Play, Trash2, 
  Share2, Copy, Clock, CheckCircle2, X 
} from 'lucide-react';
import { VideoData } from '../../types';
import { InstagramIcon, FacebookIcon, WhatsAppIcon, TelegramIcon } from './SocialPlatformIcons';

export interface ExportHistoryVideoCardProps {
  v: VideoData;
  vid: string;
  streamUrl: string;
  isMuted: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  videoRef: (el: HTMLVideoElement | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  handleDeleteVideo: (vid: string) => void;
  deletingVid: string | null;
  isPlaying: boolean;
  onVideoClick: () => void;
  isIgShared: boolean;
  isFbShared: boolean;
  isWaShared: boolean;
  isTgShared: boolean;
  handleDirectPlatformShare: (v: VideoData, platform: 'instagram' | 'facebook' | 'whatsapp' | 'telegram') => void;
  handleInstantMobileShare: (v: VideoData) => void;
  handleDownloadVideo: (v: VideoData) => void;
  downloadingVid: string | null;
  handleSendToTelegram: (v: VideoData) => void;
  sendingTgVid: string | null;
  isSentTelegramBot: boolean;
  activeSharePromptVid: string | null;
  setActiveSharePromptVid: (id: string | null) => void;
  handleRegisterPlatformShare: (v: VideoData, platform: 'instagram' | 'facebook' | 'whatsapp' | 'telegram', action: 'add' | 'remove') => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  getFormattedTime: (v: VideoData) => string | null;
  title: string;
  hashtags: string;
  copiedId: string | null;
  copyTitleAndHashtags: (v: VideoData) => void;
}

export const ExportHistoryVideoCard: React.FC<ExportHistoryVideoCardProps> = ({
  v,
  vid,
  streamUrl,
  isMuted,
  cardRef,
  videoRef,
  confirmDeleteId,
  setConfirmDeleteId,
  handleDeleteVideo,
  deletingVid,
  isPlaying,
  onVideoClick,
  isIgShared,
  isFbShared,
  isWaShared,
  isTgShared,
  handleDirectPlatformShare,
  handleInstantMobileShare,
  handleDownloadVideo,
  downloadingVid,
  handleSendToTelegram,
  sendingTgVid,
  isSentTelegramBot,
  activeSharePromptVid,
  setActiveSharePromptVid,
  handleRegisterPlatformShare,
  showToast,
  getFormattedTime,
  title,
  hashtags,
  copiedId,
  copyTitleAndHashtags
}) => {
  return (
    <div
      ref={cardRef}
      data-vid-id={vid}
      className="snap-center shrink-0 w-[84vw] max-w-[360px] sm:w-[380px] h-[64vh] max-h-[600px] min-h-[460px] flex items-center justify-center relative select-none"
    >
      {/* CLEAN FRAME CONTAINER: NO NEEDLE GREEN BORDER EVER */}
      <div className="relative w-full h-full bg-neutral-950 rounded-2xl sm:rounded-3xl border border-neutral-800/80 shadow-[0_12px_36px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col justify-between group">
        {/* FULL FRAME PORTRAIT VIDEO */}
        <video
          ref={videoRef}
          src={streamUrl}
          poster={`/api/thumb/${v.file_id || (v as any).telegram_file_id || vid}`}
          playsInline
          loop
          preload="metadata"
          muted={isMuted}
          onClick={onVideoClick}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer rounded-2xl sm:rounded-3xl"
        />

        {/* TOP OVERLAYS: Export Badge (Left) + Delete (Right) */}
        <div className="relative z-20 p-2.5 sm:p-3 flex items-center justify-between w-full pointer-events-none bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-purple-600/95 text-white flex items-center gap-1 shadow-md backdrop-blur-md">
              <Film size={11} />
              <span>Export</span>
            </span>
          </div>

          {/* Right: Delete Icon with Confirmation */}
          <div className="pointer-events-auto">
            {confirmDeleteId === vid ? (
              <div className="flex items-center gap-1 bg-black/90 p-1 rounded-xl border border-rose-500/60 shadow-xl backdrop-blur-md animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => handleDeleteVideo(vid)}
                  disabled={deletingVid === vid}
                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition"
                >
                  {deletingVid === vid ? <Loader2 size={11} className="animate-spin" /> : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2 py-1 bg-gray-800 text-gray-300 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(vid)}
                className="p-1.5 bg-black/50 hover:bg-rose-600/80 text-white/80 hover:text-white rounded-full backdrop-blur-md transition cursor-pointer shadow-lg border border-white/10"
                title="Delete video"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* CENTER PLAY BUTTON (WHEN PAUSED: VIDEO NEVER PLAYS UNTIL THIS IS CLICKED) */}
        {!isPlaying && (
          <div 
            onClick={onVideoClick}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 hover:bg-black/30 transition-colors cursor-pointer"
            title="Click to play video"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVideoClick();
              }}
              className="w-14 h-14 rounded-full bg-purple-600/95 hover:bg-purple-500 text-white flex items-center justify-center shadow-[0_10px_35px_rgba(147,51,234,0.6)] border border-white/30 backdrop-blur-md hover:scale-110 active:scale-95 transition-transform cursor-pointer group/btn"
              title="Play Video"
            >
              <Play size={24} className="fill-white translate-x-0.5 group-hover/btn:scale-105 transition" />
            </button>
          </div>
        )}

        {/* RIGHT SIDE FLOATING ACTION STACK WITH SOCIAL SHARE BADGES IN FRONT OF SHARE TAG */}
        <div className="absolute right-2.5 bottom-24 z-30 flex flex-col items-center gap-2.5 pointer-events-auto">
          {/* SOCIAL MEDIA SHARE BADGES (OVER THE CLIP IN FRONT OF SHARE TAG) */}
          <div className="flex flex-col items-center gap-1.5 bg-black/75 backdrop-blur-md p-1.5 rounded-2xl border border-white/15 shadow-xl">
            {/* Instagram Logo with Tick Mark on successful share */}
            <button
              type="button"
              onClick={() => handleDirectPlatformShare(v, 'instagram')}
              className={`flex items-center gap-0.5 p-1 rounded-xl transition cursor-pointer group/ig ${
                isIgShared 
                  ? 'bg-pink-500/25 ring-1 ring-pink-500/80 shadow-md' 
                  : 'opacity-40 hover:opacity-100 hover:bg-white/10'
              }`}
              title={isIgShared ? "Instagram marked ✓ (Tap to remove)" : "Instant Share to Instagram"}
            >
              <InstagramIcon size={18} className="group-hover/ig:scale-110 transition" />
              {isIgShared && <Check size={11} className="text-emerald-400 stroke-[3] -ml-0.5" />}
            </button>

            {/* Facebook Logo with Tick Mark on successful share */}
            <button
              type="button"
              onClick={() => handleDirectPlatformShare(v, 'facebook')}
              className={`flex items-center gap-0.5 p-1 rounded-xl transition cursor-pointer group/fb ${
                isFbShared 
                  ? 'bg-blue-500/25 ring-1 ring-blue-500/80 shadow-md' 
                  : 'opacity-40 hover:opacity-100 hover:bg-white/10'
              }`}
              title={isFbShared ? "Facebook marked ✓ (Tap to remove)" : "Instant Share to Facebook"}
            >
              <FacebookIcon size={18} className="group-hover/fb:scale-110 transition" />
              {isFbShared && <Check size={11} className="text-emerald-400 stroke-[3] -ml-0.5" />}
            </button>

            {/* WhatsApp Logo with Tick Mark on successful share */}
            <button
              type="button"
              onClick={() => handleDirectPlatformShare(v, 'whatsapp')}
              className={`flex items-center gap-0.5 p-1 rounded-xl transition cursor-pointer group/wa ${
                isWaShared 
                  ? 'bg-emerald-500/25 ring-1 ring-emerald-500/80 shadow-md' 
                  : 'opacity-40 hover:opacity-100 hover:bg-white/10'
              }`}
              title={isWaShared ? "WhatsApp marked ✓ (Tap to remove)" : "Instant Share to WhatsApp"}
            >
              <WhatsAppIcon size={18} className="group-hover/wa:scale-110 transition" />
              {isWaShared && <Check size={11} className="text-emerald-400 stroke-[3] -ml-0.5" />}
            </button>

            {/* Telegram Logo with Tick Mark on successful share */}
            <button
              type="button"
              onClick={() => handleDirectPlatformShare(v, 'telegram')}
              className={`flex items-center gap-0.5 p-1 rounded-xl transition cursor-pointer group/tg ${
                isTgShared 
                  ? 'bg-sky-500/25 ring-1 ring-sky-500/80 shadow-md' 
                  : 'opacity-40 hover:opacity-100 hover:bg-white/10'
              }`}
              title={isTgShared ? "Telegram marked ✓ (Tap to remove)" : "Send to Telegram (Instant)"}
            >
              <TelegramIcon size={18} className="group-hover/tg:scale-110 transition" />
              {isTgShared && <Check size={11} className="text-emerald-400 stroke-[3] -ml-0.5" />}
            </button>
          </div>

          {/* Main Share Button: NO POPUP! Instantly copies title & hashtags, and immediately triggers native mobile OS driver */}
          <button
            type="button"
            onClick={() => handleInstantMobileShare(v)}
            className="flex flex-col items-center gap-0.5 group cursor-pointer transition active:scale-90"
            title="Instant Mobile Share (Copies Title & Opens Device Share Driver)"
          >
            <div className="w-9 h-9 rounded-full bg-black/80 hover:bg-black text-sky-400 backdrop-blur-md border border-white/20 hover:border-sky-400/60 shadow-lg flex items-center justify-center transition">
              <Share2 size={16} className="group-hover:scale-110 transition" />
            </div>
            <span className="text-[9px] font-bold text-gray-200 drop-shadow">
              Share
            </span>
          </button>

          {/* Download / Save Button */}
          <button
            type="button"
            onClick={() => handleDownloadVideo(v)}
            disabled={downloadingVid === vid}
            className="flex flex-col items-center gap-0.5 group cursor-pointer transition active:scale-90 disabled:opacity-50"
            title="Download MP4"
          >
            <div className="w-9 h-9 rounded-full bg-black/80 hover:bg-black text-purple-400 backdrop-blur-md border border-white/20 hover:border-purple-400/60 shadow-lg flex items-center justify-center transition">
              {downloadingVid === vid ? (
                <Loader2 size={15} className="animate-spin text-purple-400" />
              ) : (
                <Download size={15} className="group-hover:scale-110 transition" />
              )}
            </div>
            <span className="text-[9px] font-bold text-gray-200 drop-shadow">
              Save
            </span>
          </button>

          {/* Telegram Bot Button */}
          <button
            type="button"
            onClick={() => handleSendToTelegram(v)}
            disabled={sendingTgVid === vid}
            className="flex flex-col items-center gap-0.5 group cursor-pointer transition active:scale-90 disabled:opacity-50"
            title={isSentTelegramBot ? "Already sent to Telegram Bot (click to re-send)" : "Send to Telegram Bot"}
          >
            <div className={`w-9 h-9 rounded-full ${
              isSentTelegramBot 
                ? 'bg-emerald-950/85 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/30' 
                : 'bg-black/80 hover:bg-black text-cyan-400 border-white/20 hover:border-cyan-400/60'
            } backdrop-blur-md border shadow-lg flex items-center justify-center transition`}>
              {sendingTgVid === vid ? (
                <Loader2 size={15} className="animate-spin text-cyan-400" />
              ) : isSentTelegramBot ? (
                <Check size={16} className="text-emerald-400 stroke-[3]" />
              ) : (
                <Send size={15} className="group-hover:scale-110 transition -translate-y-0.5 translate-x-0.5" />
              )}
            </div>
            <span className="text-[9px] font-bold text-gray-200 drop-shadow">
              {isSentTelegramBot ? "Sent" : "Bot"}
            </span>
          </button>
        </div>

        {/* Quick Platform Confirm Picker */}
        {activeSharePromptVid === vid && (
          <div className="absolute inset-x-2 bottom-20 z-40 bg-black/95 backdrop-blur-md p-2 rounded-2xl border border-purple-500/60 shadow-2xl flex flex-col gap-1.5 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-gray-200 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span>Which app did you share to?</span>
              </span>
              <button 
                type="button" 
                onClick={() => setActiveSharePromptVid(null)}
                className="text-gray-400 hover:text-white p-0.5 cursor-pointer"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => {
                  handleRegisterPlatformShare(v, 'instagram', 'add');
                  setActiveSharePromptVid(null);
                  showToast("Instagram marked ✓", "success");
                }}
                className="p-1.5 bg-pink-950/80 hover:bg-pink-900 border border-pink-500/50 rounded-xl flex items-center justify-center gap-1 text-[10px] font-bold text-pink-300 transition active:scale-95 cursor-pointer"
              >
                <InstagramIcon size={14} />
                <span>Insta</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRegisterPlatformShare(v, 'facebook', 'add');
                  setActiveSharePromptVid(null);
                  showToast("Facebook marked ✓", "success");
                }}
                className="p-1.5 bg-blue-950/80 hover:bg-blue-900 border border-blue-500/50 rounded-xl flex items-center justify-center gap-1 text-[10px] font-bold text-blue-300 transition active:scale-95 cursor-pointer"
              >
                <FacebookIcon size={14} />
                <span>FB</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRegisterPlatformShare(v, 'whatsapp', 'add');
                  setActiveSharePromptVid(null);
                  showToast("WhatsApp marked ✓", "success");
                }}
                className="p-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 rounded-xl flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-300 transition active:scale-95 cursor-pointer"
              >
                <WhatsAppIcon size={14} />
                <span>WA</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRegisterPlatformShare(v, 'telegram', 'add');
                  setActiveSharePromptVid(null);
                  showToast("Telegram marked ✓", "success");
                }}
                className="p-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-500/50 rounded-xl flex items-center justify-center gap-1 text-[10px] font-bold text-sky-300 transition active:scale-95 cursor-pointer"
              >
                <TelegramIcon size={14} />
                <span>TG</span>
              </button>
            </div>
          </div>
        )}

        {/* BOTTOM OVERLAY: TITLE, HASHTAGS & 1-TAP COPY */}
        <div className="relative z-20 w-full p-2.5 sm:p-3 bg-gradient-to-t from-black via-black/85 to-transparent flex flex-col gap-1 rounded-b-2xl sm:rounded-b-3xl pointer-events-auto">
          {getFormattedTime(v) && (
            <div className="flex items-center gap-1 text-[10px] text-gray-300 font-mono px-0.5">
              <Clock size={11} className="text-purple-400 shrink-0" />
              <span>{getFormattedTime(v)}</span>
            </div>
          )}

          {/* 1-CLICK INSTANT COPY TEXT BOX (Title + Hashtags) */}
          <div
            onClick={() => copyTitleAndHashtags(v)}
            className="p-2 sm:p-2.5 bg-black/80 hover:bg-purple-950/40 border border-white/15 hover:border-purple-500/60 rounded-xl backdrop-blur-md cursor-pointer transition active:scale-98 group/copy flex flex-col gap-0.5"
            title="Click to copy Title and Hashtags"
          >
            <div className="flex items-center justify-between gap-1.5">
              <h3 className="font-bold text-xs text-white group-hover/copy:text-purple-300 transition truncate leading-tight flex-1">
                {title}
              </h3>
              <div className="shrink-0">
                {copiedId === vid ? (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold flex items-center gap-1 animate-in zoom-in">
                    <Check size={9} /> Copied!
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-white/10 group-hover/copy:bg-purple-600/30 text-gray-300 group-hover/copy:text-white border border-white/10 text-[9px] font-medium flex items-center gap-1 transition">
                    <Copy size={9} /> Copy
                  </span>
                )}
              </div>
            </div>
            <p className="text-[10px] font-mono text-cyan-300/90 truncate leading-tight">
              {hashtags}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
