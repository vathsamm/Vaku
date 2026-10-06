import React, { useState, useEffect, useRef } from 'react';
import { 
  Share2, X, Smartphone, MessageCircle, Camera, Music, Send, 
  Copy, Check, Sparkles, Loader2
} from 'lucide-react';
import { VideoData } from '../types';

export interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoData | null;
  videoUrl: string;
  title?: string;
  hashtags?: string;
  caption?: string;
  onShared?: (video: VideoData, platform: string) => Promise<void> | void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  video,
  videoUrl,
  title: propTitle,
  hashtags: propHashtags,
  caption: propCaption,
  onShared,
  onToast
}) => {
  const [isNativeSharing, setIsNativeSharing] = useState(false);
  const [isFetchingClip, setIsFetchingClip] = useState(true);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const [dynamicTitle, setDynamicTitle] = useState<string>(propTitle || video?.generated_title || '');
  const [dynamicHashtags, setDynamicHashtags] = useState<string>(propHashtags || video?.generated_hashtags || '');
  const [dynamicCaption, setDynamicCaption] = useState<string>(propCaption || video?.share_caption || '');
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const prefetchedFileRef = useRef<File | null>(null);

  // Sync props when video changes
  useEffect(() => {
    if (video) {
      setDynamicTitle(propTitle || video.generated_title || (video as any).project_name || video.source_name || video.name || '');
      setDynamicHashtags(propHashtags || video.generated_hashtags || '');
      setDynamicCaption(propCaption || video.share_caption || '');
    }
  }, [video, propTitle, propHashtags, propCaption]);

  // Automatically attach title & hashtags to clipboard on modal open
  useEffect(() => {
    if (!isOpen || !video) return;
    const currentTitle = propTitle || video.generated_title || dynamicTitle || '';
    const currentTags = propHashtags || video.generated_hashtags || dynamicHashtags || '';
    const shareText = (propCaption || video.share_caption || dynamicCaption || (currentTitle && currentTags ? `${currentTitle}\n\n${currentTags}` : currentTitle)).trim();
    if (shareText && shareText !== 'Social Video') {
      try {
        navigator.clipboard.writeText(shareText);
      } catch (_) {}
    }
  }, [isOpen, video, propTitle, propHashtags, propCaption, dynamicTitle, dynamicHashtags, dynamicCaption]);

  // Auto-resolve title & hashtags from project template if missing
  useEffect(() => {
    if (!isOpen || !video) return;

    const hasMissingTitle = !dynamicTitle || dynamicTitle === 'Social Video' || !dynamicHashtags;
    if (hasMissingTitle) {
      setIsLoadingDetails(true);
      const vid = video.id || (video as any).vid || video.file_id;
      const projectId = (video as any).project_id;
      const masterBucketFid = (video as any).master_bucket_fid || (video as any).root_bucket_fid;

      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_or_generate_video_title_hashtags',
          payload: { vid, projectId, masterBucketFid }
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.title) {
          setDynamicTitle(data.title);
          setDynamicHashtags(data.hashtags || '');
          setDynamicCaption(data.caption || `${data.title}\n\n${data.hashtags || ''}`);
          if (video) {
            video.generated_title = data.title;
            video.generated_hashtags = data.hashtags;
            video.share_caption = data.caption;
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingDetails(false);
      });
    }

    // Background prefetch video blob so mobile user never waits when clicking Share
    setIsFetchingClip(true);
    const fullUrl = videoUrl.startsWith('http') ? videoUrl : `${window.location.origin}${videoUrl}`;
    const controller = new AbortController();
    fetch(fullUrl, { signal: controller.signal })
      .then(res => (res.ok ? res.blob() : null))
      .then(blob => {
        if (blob) {
          const cleanFileName = `${(dynamicTitle || 'video').replace(/[^a-zA-Z0-9_\-]/g, '_') || 'video'}.mp4`;
          prefetchedFileRef.current = new File([blob], cleanFileName, { type: 'video/mp4' });
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsFetchingClip(false);
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, video?.id, videoUrl]);

  if (!isOpen || !video) return null;

  const resolvedTitle = (
    dynamicTitle ||
    propTitle ||
    video.generated_title ||
    (video as any).project_name ||
    video.source_name ||
    video.name ||
    'Social Video'
  ).trim();

  const resolvedHashtags = (
    dynamicHashtags ||
    propHashtags ||
    video.generated_hashtags ||
    ''
  ).trim();

  const resolvedCaption = (
    dynamicCaption ||
    propCaption ||
    video.share_caption ||
    (resolvedTitle && resolvedHashtags ? `${resolvedTitle}\n\n${resolvedHashtags}` : resolvedTitle)
  ).trim();

  const fullUrl = videoUrl.startsWith('http') ? videoUrl : `${window.location.origin}${videoUrl}`;
  const isPreviouslyShared = Boolean((video as any).is_shared || (video as any).shared || ((video as any).shared_platforms && (video as any).shared_platforms.length > 0));
  const sharedPlatforms: string[] = ((video as any).shared_platforms as string[]) || [];

  const handleRegisterShare = async (platform: string) => {
    try {
      if (onShared && video) {
        await onShared(video, platform);
      } else {
        const vid = video.id || (video as any).vid || video.file_id;
        if (vid) {
          await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'mark_video_shared',
              payload: {
                vid,
                platform,
                share_text: resolvedCaption
              }
            })
          });
        }
      }
      if (onToast) {
        const platLabel = platform === 'phone_share' ? 'Mobile' : platform.replace(/_/g, ' ');
        onToast(`Shared to ${platLabel}! Marked with verified badge ✓`, 'success');
      }
    } catch (_) {}
  };

  // Primary Mobile Native Web Share API (Instant 0-delay execution)
  const handleNativeShare = async () => {
    setIsNativeSharing(true);
    try {
      const shareText = resolvedCaption || `${resolvedTitle}\n\n${resolvedHashtags}`.trim();
      let sharedSuccessfully = false;

      // Always copy title, caption & hashtags to clipboard immediately
      try {
        await navigator.clipboard.writeText(shareText);
      } catch (_) {}

      if (navigator.share) {
        let fileShared = false;

        // If file was already prefetched in background, share it directly
        if (prefetchedFileRef.current && navigator.canShare && navigator.canShare({ files: [prefetchedFileRef.current] })) {
          try {
            await navigator.share({
              title: resolvedTitle,
              text: shareText,
              files: [prefetchedFileRef.current]
            });
            fileShared = true;
            sharedSuccessfully = true;
          } catch (fileErr: any) {
            if (fileErr.name !== 'AbortError') {
              console.log("[NativeShare] File share fallback to instant URL/text:", fileErr);
            } else {
              setIsNativeSharing(false);
              return;
            }
          }
        }

        // Quick fetch attempt (max 500ms) so mobile phone NEVER freezes or loses user gesture
        if (!fileShared && navigator.canShare) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 500);
            const blobRes = await fetch(fullUrl, { signal: ctrl.signal });
            clearTimeout(timer);
            if (blobRes.ok) {
              const blob = await blobRes.blob();
              const cleanFileName = `${resolvedTitle.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'video'}.mp4`;
              const file = new File([blob], cleanFileName, { type: 'video/mp4' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                  title: resolvedTitle,
                  text: shareText,
                  files: [file]
                });
                fileShared = true;
                sharedSuccessfully = true;
              }
            }
          } catch (_) {}
        }

        // Instant Native Share with title, hashtags and video URL (0ms waiting)
        if (!fileShared) {
          await navigator.share({
            title: resolvedTitle,
            text: shareText,
            url: fullUrl
          });
          sharedSuccessfully = true;
        }
      } else {
        await navigator.clipboard.writeText(`${shareText}\n\n${fullUrl}`);
        if (onToast) onToast("Title, hashtags & video link copied to clipboard!", "success");
        sharedSuccessfully = true;
      }

      if (sharedSuccessfully) {
        await handleRegisterShare('phone_share');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn("[NativeShare Error]", err);
      }
    } finally {
      setIsNativeSharing(false);
    }
  };

  const handleShareToPlatform = async (platformId: string, platformName: string) => {
    const shareText = resolvedCaption || `${resolvedTitle}\n\n${resolvedHashtags}`.trim();
    
    // 1. Immediately copy title & hashtags to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch (_) {}

    // 2. If native share with file is supported (e.g. mobile Android), pass video clip + title/hashtags directly
    if (prefetchedFileRef.current && navigator.canShare && navigator.canShare({ files: [prefetchedFileRef.current] })) {
      try {
        await navigator.share({
          title: resolvedTitle,
          text: shareText,
          files: [prefetchedFileRef.current]
        });
        await handleRegisterShare(platformId);
        if (onToast) onToast(`Shared to ${platformName}!`, 'success');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // 3. Platform specific direct deep-link or web app
    if (platformId === 'instagram_reels') {
      window.open('https://www.instagram.com/reels/', '_blank');
    } else if (platformId === 'instagram_feed') {
      window.open('https://www.instagram.com/', '_blank');
    } else if (platformId === 'tiktok') {
      window.open('https://www.tiktok.com/upload', '_blank');
    } else if (platformId === 'youtube_shorts') {
      window.open('https://www.youtube.com/upload', '_blank');
    } else if (platformId === 'whatsapp_status' || platformId === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n\n' + fullUrl)}`, '_blank');
    } else if (platformId === 'facebook_reels' || platformId === 'facebook') {
      window.open(`https://www.facebook.com/reels/create`, '_blank');
    } else if (platformId === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent(shareText)}`, '_blank');
    } else if (platformId === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`, '_blank');
    }

    await handleRegisterShare(platformId);
    if (onToast) onToast(`Title & hashtags copied! Opening ${platformName}...`, 'success');
  };

  const copyText = (text: string, isCaption = true) => {
    navigator.clipboard.writeText(text);
    if (isCaption) {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
      if (onToast) onToast("Title & hashtags copied to clipboard!", "success");
    } else {
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
      if (onToast) onToast("Video link copied to clipboard!", "success");
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[170] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-slate-950 border-t sm:border border-emerald-500/50 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-4 sm:p-5 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] text-white space-y-4 animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-700 mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Share2 size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Share Video
                </h3>
                {isFetchingClip ? (
                  <span className="px-2 py-0.5 bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 rounded-full text-[9px] font-mono font-bold flex items-center gap-1 animate-pulse">
                    <Loader2 size={9} className="animate-spin" /> Fetching Clip...
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full text-[9px] font-mono font-bold flex items-center gap-1">
                    <Check size={9} className="stroke-[3]" /> Clip Ready
                  </span>
                )}
                {isPreviouslyShared && (
                  <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-500/40 rounded-full text-[9px] font-mono font-bold flex items-center gap-0.5">
                    <Check size={9} className="stroke-[3]" /> Shared
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[260px] sm:max-w-xs mt-0.5">
                {resolvedTitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* PRIMARY MOBILE SYSTEM SHARE BUTTON (Web Share API) */}
        <button
          type="button"
          disabled={isNativeSharing}
          onClick={handleNativeShare}
          className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-[0_4px_20px_rgba(16,185,129,0.35)] border border-emerald-400/40 transition active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {isNativeSharing ? (
            <>
              <Loader2 size={16} className="animate-spin text-white" />
              <span>Preparing Mobile Apps Share...</span>
            </>
          ) : (
            <>
              <Smartphone size={17} className="text-emerald-200" />
              <span>📱 Instant Mobile Share (Feeds & Reels)</span>
            </>
          )}
        </button>

        {/* Social platform share buttons grid - Feeds, Reels & Social Apps */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-400 font-bold block">
            Direct Share to Feeds & Reels
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
            {/* Instagram Reels */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('instagram_reels', 'Instagram Reels')}
              className="p-2.5 bg-pink-950/60 hover:bg-pink-900 border border-pink-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-pink-300 transition active:scale-95 cursor-pointer group"
              title="Share to Instagram Reels (Transfers video clip with title & hashtags)"
            >
              <Camera size={19} className="text-pink-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">Insta Reels</span>
            </button>

            {/* Instagram Feed */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('instagram_feed', 'Instagram Feed')}
              className="p-2.5 bg-fuchsia-950/60 hover:bg-fuchsia-900 border border-fuchsia-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-fuchsia-300 transition active:scale-95 cursor-pointer group"
              title="Share to Instagram Feed (Transfers video clip with title & hashtags)"
            >
              <Camera size={19} className="text-fuchsia-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">Insta Feed</span>
            </button>

            {/* TikTok */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('tiktok', 'TikTok')}
              className="p-2.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-purple-300 transition active:scale-95 cursor-pointer group"
              title="Share to TikTok (Transfers video clip with title & hashtags)"
            >
              <Music size={19} className="text-purple-300 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">TikTok</span>
            </button>

            {/* YouTube Shorts */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('youtube_shorts', 'YouTube Shorts')}
              className="p-2.5 bg-red-950/60 hover:bg-red-900 border border-red-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-red-300 transition active:scale-95 cursor-pointer group"
              title="Share to YouTube Shorts"
            >
              <Sparkles size={19} className="text-red-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">YT Shorts</span>
            </button>

            {/* WhatsApp Status */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('whatsapp_status', 'WhatsApp Status')}
              className="p-2.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-emerald-300 transition active:scale-95 cursor-pointer group"
              title="Share to WhatsApp Status"
            >
              <MessageCircle size={19} className="text-emerald-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">WA Status</span>
            </button>

            {/* WhatsApp Chat */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('whatsapp', 'WhatsApp Chat')}
              className="p-2.5 bg-teal-950/60 hover:bg-teal-900 border border-teal-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-teal-300 transition active:scale-95 cursor-pointer group"
              title="Share to WhatsApp Chat"
            >
              <MessageCircle size={19} className="text-teal-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">WA Chat</span>
            </button>

            {/* Facebook Reels */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('facebook_reels', 'Facebook Reels')}
              className="p-2.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-blue-300 transition active:scale-95 cursor-pointer group"
              title="Share to Facebook Reels"
            >
              <span className="text-lg font-black leading-none text-blue-400 font-serif">f</span>
              <span className="text-[10px] font-bold">FB Reels</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('telegram', 'Telegram')}
              className="p-2.5 bg-sky-950/60 hover:bg-sky-900 border border-sky-500/40 rounded-xl flex flex-col items-center justify-center gap-1 text-sky-300 transition active:scale-95 cursor-pointer group"
              title="Share to Telegram"
            >
              <Send size={19} className="text-sky-400 group-hover:scale-110 transition" />
              <span className="text-[10px] font-bold">Telegram</span>
            </button>

            {/* Twitter / X */}
            <button
              type="button"
              onClick={() => handleShareToPlatform('twitter', 'Twitter')}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1 text-white transition active:scale-95 cursor-pointer group"
              title="Post to Twitter / 𝕏"
            >
              <span className="text-base font-black leading-none">𝕏</span>
              <span className="text-[10px] font-bold">Twitter</span>
            </button>
          </div>
        </div>

        {/* 1-CLICK INSTANT COPY TITLE & HASHTAGS TEXT BOX */}
        <div 
          onClick={() => copyText(resolvedCaption, true)}
          className="space-y-1.5 p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-900 border border-emerald-500/40 hover:border-emerald-400/70 transition cursor-pointer group shadow-lg"
          title="Click anywhere to copy title and hashtags"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-400" />
              Title & Hashtags (1-Click Copy Box)
              {isLoadingDetails && (
                <span className="ml-1.5 flex items-center gap-1 text-[9px] text-emerald-300 font-normal animate-pulse">
                  <Loader2 size={10} className="animate-spin text-emerald-400" />
                  Generating...
                </span>
              )}
            </span>
            <div className="shrink-0">
              {copiedCaption ? (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold rounded-lg flex items-center gap-1 animate-in zoom-in">
                  <Check size={11} /> Copied!
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-white/10 group-hover:bg-emerald-600/30 text-gray-200 group-hover:text-white text-[10px] font-bold rounded-lg flex items-center gap-1 border border-white/10 transition">
                  <Copy size={11} /> 1-Tap Copy
                </span>
              )}
            </div>
          </div>

          {resolvedTitle && (
            <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 text-xs font-semibold text-white leading-relaxed group-hover:border-slate-700 transition">
              {resolvedTitle}
            </div>
          )}
          {resolvedHashtags && (
            <div className="bg-slate-950/90 rounded-xl p-2.5 border border-slate-800 text-[11px] font-mono text-cyan-300 leading-relaxed group-hover:border-slate-700 transition">
              {resolvedHashtags}
            </div>
          )}
          <p className="text-[9px] text-slate-400 italic">
            💡 Click anywhere inside this box to instantly copy title and hashtags to your clipboard.
          </p>
        </div>

        {/* Direct Video Link Copy */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-slate-400 font-bold block">Direct Video Link</span>
          <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <input
              type="text"
              readOnly
              value={fullUrl}
              className="flex-1 bg-transparent px-2.5 text-xs text-slate-300 select-all focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={() => copyText(fullUrl, false)}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
            >
              {copiedShareLink ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedShareLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Previously Shared Indicators */}
        {sharedPlatforms.length > 0 && (
          <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center justify-between text-xs">
            <span className="text-emerald-300 font-semibold text-[11px]">
              Previously shared to:
            </span>
            <div className="flex items-center gap-1.5">
              {sharedPlatforms.map(p => (
                <span key={p} className="px-2 py-0.5 bg-emerald-900/80 border border-emerald-500/50 rounded-md text-[10px] font-mono capitalize text-emerald-200">
                  {p === 'phone_share' ? 'Mobile' : p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
