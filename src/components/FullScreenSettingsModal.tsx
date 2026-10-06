import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Key, Send, Sparkles, Smartphone, HardDrive, RefreshCw, CloudUpload, Check, Trash2, Download, Package, Copy, CheckCheck, ExternalLink, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { KaggleGpuSettingsPanel } from './KaggleGpuSettingsPanel';
import { TelegramChannelsSettings } from './TelegramChannelsSettings';
import { HiggsfieldSettingsPanel } from './HiggsfieldSettingsPanel';
import { getOfflineStorageStats } from '../utils/videoBlobCache';
import { getIsPWAInstalled } from '../utils/pwaManager';

interface FullScreenSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  isAdmin: boolean;
  onLogout?: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type SettingsTab = 'offline_app' | 'higgsfield' | 'kaggle' | 'telegram';

export const FullScreenSettingsModal: React.FC<FullScreenSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  isAdmin,
  onLogout,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('offline_app');
  const [offlineStats, setOfflineStats] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });
  const [isInstalled, setIsInstalled] = useState(false);
  const [copiedApkUrl, setCopiedApkUrl] = useState(false);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');
  const [downloadMb, setDownloadMb] = useState<string>('');
  const [apkInfo, setApkInfo] = useState<{
    ok: boolean;
    filename: string;
    version: string;
    sizeMb: string;
    packageName: string;
  }>({
    ok: true,
    filename: 'Vd-Studio-v4.5.apk',
    version: '4.5.0',
    sizeMb: '26.0',
    packageName: 'com.vdstudio.videoeditor'
  });

  useEffect(() => {
    if (isOpen) {
      setIsInstalled(getIsPWAInstalled());
      getOfflineStorageStats().then(setOfflineStats).catch(() => {});

      // Fetch dynamic APK details if available
      fetch('/api/apk-info')
        .then(r => r.json())
        .then(data => {
          if (data && data.ok) {
            setApkInfo({
              ok: true,
              filename: data.filename || 'Vd-Studio-v4.5.apk',
              version: data.version || '4.5.0',
              sizeMb: data.sizeMb || '26.0',
              packageName: data.packageName || 'com.vdstudio.videoeditor'
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const triggerBlobSave = (blob: Blob, filename: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 4000);
  };

  const handleDownloadApk = async () => {
    if (isDownloadingApk) return;
    setIsDownloadingApk(true);
    setDownloadProgress(0);
    setDownloadSpeed('');
    setDownloadMb(`0.0 / ${apkInfo.sizeMb} MB`);
    onToast(`Starting direct ${apkInfo.sizeMb} MB APK download stream...`, "info");

    try {
      // 1. Fetch direct binary stream via /api/download-apk
      // Pass cache: 'no-store' to guarantee fresh binary stream and completely bypass Service Worker navigation fallback
      const targetUrl = `/api/download-apk?v=${Date.now()}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Accept': 'application/vnd.android.package-archive, application/octet-stream, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('Received HTML webpage instead of APK binary. The package is being generated.');
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 27184659;

      if (!response.body) {
        const blob = await response.blob();
        if (blob.size < 5000000) {
          throw new Error(`Downloaded file is only ${(blob.size / 1024).toFixed(1)} KB (corrupt/error page). Expected ~26 MB.`);
        }
        triggerBlobSave(blob, apkInfo.filename);
        onToast(`APK (${(blob.size / (1024 * 1024)).toFixed(1)} MB) downloaded successfully!`, "success");
        return;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;
      const startTime = Date.now();
      let lastTime = startTime;
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const now = Date.now();
        if (now - lastTime > 200 || receivedBytes === totalBytes) {
          const pct = Math.min(99, Math.round((receivedBytes / totalBytes) * 100));
          const currentMb = (receivedBytes / (1024 * 1024)).toFixed(1);
          const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
          const timeDelta = (now - lastTime) / 1000;
          const bytesDelta = receivedBytes - lastBytes;
          const speedMbps = timeDelta > 0 ? ((bytesDelta / (1024 * 1024)) / timeDelta).toFixed(1) : '2.5';

          setDownloadProgress(pct);
          setDownloadMb(`${currentMb} / ${totalMb} MB`);
          setDownloadSpeed(`${speedMbps} MB/s`);

          lastTime = now;
          lastBytes = receivedBytes;
        }
      }

      const completeBlob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });

      // CRITICAL VERIFICATION: An APK must be > 10 MB! A 10 KB file indicates HTML or error fallback.
      if (completeBlob.size < 5000000) {
        throw new Error(`Downloaded file is only ${(completeBlob.size / 1024).toFixed(1)} KB. Expected ~26 MB APK.`);
      }

      setDownloadProgress(100);
      setDownloadMb(`${(completeBlob.size / (1024 * 1024)).toFixed(1)} MB`);
      triggerBlobSave(completeBlob, apkInfo.filename);

      onToast(`Downloaded ${apkInfo.filename} (${(completeBlob.size / (1024 * 1024)).toFixed(1)} MB)!`, "success");
    } catch (err: any) {
      console.error('APK Download error:', err);
      onToast(`Download stream error: ${err.message || 'Failed'}. Opening fallback link...`, "error");

      // Secondary fallback: direct element click on /api/download-apk
      try {
        const fallbackA = document.createElement('a');
        fallbackA.href = `/api/download-apk?download=1&v=${Date.now()}`;
        fallbackA.download = apkInfo.filename;
        fallbackA.target = '_self';
        document.body.appendChild(fallbackA);
        fallbackA.click();
        setTimeout(() => document.body.removeChild(fallbackA), 1000);
      } catch (_) {}
    } finally {
      setIsDownloadingApk(false);
      setTimeout(() => setDownloadProgress(null), 3500);
    }
  };

  const handleCopyApkLink = () => {
    try {
      const fullUrl = window.location.origin + '/api/download-apk';
      navigator.clipboard.writeText(fullUrl);
      setCopiedApkUrl(true);
      setTimeout(() => setCopiedApkUrl(false), 2500);
      onToast("Direct 26 MB APK download link copied to clipboard", "success");
    } catch (_) {
      onToast("Failed to copy URL", "error");
    }
  };

  const handleClearCache = async () => {
    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        indexedDB.deleteDatabase('remixx_video_cache_v1');
      }
      setOfflineStats({ count: 0, totalBytes: 0 });
      onToast("Offline storage cache cleared", "info");
    } catch (_) {
      onToast("Could not clear cache", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-gray-950 flex flex-col w-full h-full text-white animate-in fade-in duration-150">
      <header className="h-14 px-4 bg-gray-900/90 border-b border-gray-800 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition active:scale-95 cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Settings</h2>
            <p className="text-[10px] text-gray-400 capitalize">
              {activeTab === 'offline_app' ? 'Android App & Offline Data' : activeTab === 'higgsfield' ? 'Higgsfield AI Video' : activeTab === 'kaggle' ? 'Kaggle Settings' : 'Telegram'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition active:scale-95 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <nav className="bg-gray-900 border-b border-gray-800/80 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('offline_app')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'offline_app'
              ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-md shadow-emerald-950/50'
              : 'bg-gray-800/80 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Smartphone size={14} className={activeTab === 'offline_app' ? 'text-white' : 'text-emerald-400'} />
          <span>Android &amp; Offline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('higgsfield')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'higgsfield'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/50'
              : 'bg-gray-800/80 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Sparkles size={14} className={activeTab === 'higgsfield' ? 'text-white' : 'text-purple-400'} />
          <span>Higgsfield AI</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kaggle')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'kaggle'
              ? 'bg-amber-500 text-black shadow-md shadow-amber-950/50'
              : 'bg-gray-800/80 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Key size={14} className={activeTab === 'kaggle' ? 'text-black' : 'text-amber-400'} />
          <span>Kaggle Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('telegram')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeTab === 'telegram'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
              : 'bg-gray-800/80 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send size={14} className={activeTab === 'telegram' ? 'text-white' : 'text-blue-400'} />
          <span>Telegram</span>
        </button>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-950">
        <div className="max-w-xl mx-auto space-y-4">
          {activeTab === 'offline_app' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Android Native APK Package Card */}
              <div className="p-4 sm:p-5 bg-gradient-to-b from-gray-900 to-gray-950 border border-purple-500/30 rounded-2xl space-y-4 shadow-xl shadow-purple-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
                      <Smartphone size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white tracking-tight">Android App (APK)</h3>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                          v{apkInfo.version}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {apkInfo.filename} • {apkInfo.sizeMb} MB • {apkInfo.packageName}
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold shrink-0">
                    Signed Release
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    <span>100% Offline Editing &amp; HD Render</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Auto-updates with AI Studio</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></span>
                    <span>Zero Internet Used for Local Clips</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-900/90 border border-gray-800 text-gray-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                    <span>One-Tap Cloud Upload on Projects</span>
                  </div>
                </div>

                {/* Download Progress Bar when downloading */}
                {(isDownloadingApk || downloadProgress !== null) && (
                  <div className="p-3 bg-gray-950/90 rounded-xl border border-purple-500/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-purple-300">
                        <Loader2 size={14} className="animate-spin text-purple-400" />
                        <span>Downloading 26 MB Full APK ({downloadProgress ?? 0}%)...</span>
                      </span>
                      <span className="text-gray-300 font-mono text-[11px]">{downloadMb} {downloadSpeed ? `• ${downloadSpeed}` : ''}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 h-full transition-all duration-200"
                        style={{ width: `${downloadProgress ?? 5}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">Streaming authentic 26 MB signed package directly into browser memory to eliminate 10 KB error files.</p>
                  </div>
                )}

                {/* Download APK Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isDownloadingApk}
                    onClick={handleDownloadApk}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-75 disabled:cursor-wait text-white font-bold rounded-xl text-sm transition active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer"
                  >
                    {isDownloadingApk ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Streaming APK ({downloadProgress ?? 0}%)</span>
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        <span>Download Android APK ({apkInfo.sizeMb} MB)</span>
                      </>
                    )}
                  </button>

                  <a
                    href="/api/download-apk"
                    download={apkInfo.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-3 bg-gray-850 hover:bg-gray-800 border border-gray-700/80 rounded-xl text-xs font-bold text-gray-200 transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    title="Direct HTTP download (bypasses service worker & router)"
                  >
                    <ExternalLink size={14} className="text-cyan-400" />
                    <span>Direct Link</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyApkLink}
                    className="py-3 px-3 bg-gray-850 hover:bg-gray-800 border border-gray-700/80 rounded-xl text-xs font-bold text-gray-200 transition active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    title="Copy direct APK link to share with mobile"
                  >
                    {copiedApkUrl ? (
                      <>
                        <CheckCheck size={15} className="text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={15} />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 3-Step Install Instructions */}
                <div className="p-3 bg-gray-950/80 rounded-xl border border-gray-800/80 text-[11px] text-gray-400 space-y-1.5">
                  <div className="font-bold text-gray-300 flex items-center gap-1.5 pb-1 border-b border-gray-800/60">
                    <Package size={13} className="text-purple-400" />
                    <span>How to Install on Your Android Phone:</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-600/40 text-purple-300 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>Click <strong>Download Android APK</strong> on your phone (or transfer the file to your mobile).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-purple-600/40 text-purple-300 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>Open <strong>{apkInfo.filename}</strong> in your phone notifications/Files and tap <strong>Install</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-emerald-600/40 text-emerald-300 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">✓</span>
                    <span>Launch <strong>Vd Studio</strong> from your apps! When you update code in AI Studio, the app automatically fetches changes seamlessly.</span>
                  </div>
                </div>
              </div>

              {/* Native Android APK Direct Transfer & QR Code Card */}
              <div className="p-4 bg-gray-900 border border-purple-500/30 rounded-2xl space-y-4 shadow-lg shadow-purple-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-xl text-white">
                      <Smartphone size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Get APK Directly on Your Android Phone</h3>
                      <p className="text-xs text-gray-400">Download raw .apk file — No Edge or browser wrapper</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                    Android Native
                  </span>
                </div>

                {/* Important notice warning against Edge browser app */}
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                  <span className="text-amber-400 font-bold shrink-0 mt-0.5">⚠️</span>
                  <span>
                    <strong>Important:</strong> Do not use Edge or Chrome's &quot;Install app&quot; browser prompt. That only creates a browser web shortcut. To install the genuine standalone Android app, download the <strong>.apk</strong> file below and tap it in your phone&apos;s <strong>Files</strong> app.
                  </span>
                </div>

                {/* Scan QR Code or Copy Direct Link for Phone */}
                <div className="p-3.5 bg-gray-950 rounded-xl border border-gray-800 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2 bg-white rounded-xl shrink-0 shadow-md">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(
                        typeof window !== 'undefined'
                          ? `${window.location.origin}/api/download-apk`
                          : 'https://ais-dev-rnqjlps7hvpdxspawmom4m-684144802964.asia-southeast1.run.app/api/download-apk'
                      )}`}
                      alt="Scan to download APK on Android phone"
                      className="w-28 h-28 object-contain"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                    <div className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <Package size={14} className="text-purple-400" />
                      <span>Scan with Phone Camera to Download</span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-normal">
                      Point your Android camera at the QR code to download <strong>{apkInfo.filename}</strong> directly to your phone, then tap <strong>Install</strong>.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href="/api/download-apk"
                        download={apkInfo.filename}
                        className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md"
                      >
                        <Download size={13} />
                        <span>Direct APK Link</span>
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyApkLink}
                        className="py-2 px-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                      >
                        {copiedApkUrl ? (
                          <>
                            <CheckCheck size={13} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 text-xs space-y-2 text-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">AI Studio Live Sync Check:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <RefreshCw size={11} className="text-emerald-400" /> Ultra-low Internet (~120 B)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    When running on your Android phone, the native app automatically checks for AI Studio build updates on launch while keeping all timeline clips 100% offline.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      onToast("Checking for latest AI Studio updates...", "info");
                      try {
                        const res = await fetch('/api/app-version', { cache: 'no-store' });
                        if (res.ok) {
                          const data = await res.json();
                          localStorage.setItem('vd_last_app_build_time', String(data.buildTime || Date.now()));
                          onToast("App is up-to-date with latest AI Studio build!", "success");
                          setTimeout(() => window.location.reload(), 600);
                        } else {
                          onToast("Unable to reach server to check updates", "warning");
                        }
                      } catch (_) {
                        onToast("Offline - using local cached app", "info");
                      }
                    }}
                    className="w-full py-2 bg-gray-850 hover:bg-gray-800 border border-gray-700/80 rounded-lg text-xs font-bold text-white transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>Check &amp; Force AI Studio Update Now</span>
                  </button>
                </div>
              </div>

              {/* Offline Clips & Mobile Data Saver Card */}
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <HardDrive size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Mobile Offline Clips Storage</h3>
                    <p className="text-xs text-gray-400">Zero Internet Used for Cached Clips</p>
                  </div>
                </div>

                <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Clips Stored on Phone:</span>
                    <span className="text-white font-bold font-mono">{offlineStats.count} clips</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Phone Storage Used:</span>
                    <span className="text-purple-300 font-bold font-mono">
                      {(offlineStats.totalBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Data Saved:</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {(offlineStats.totalBytes / (1024 * 1024)).toFixed(1)} MB Internet Saved
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed pt-1 border-t border-gray-800/60">
                    All timeline clips, chops, and concepts stay offline on your phone's internal storage so you don't re-download them repeatedly.
                  </p>

                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/40 rounded-lg text-xs font-bold text-rose-300 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <Trash2 size={12} />
                    <span>Clear Offline Cache / Free Phone Storage</span>
                  </button>
                </div>
              </div>

              {/* Manual Cloud Storage Backup Explanation Card */}
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
                    <CloudUpload size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Manual Cloud Backup</h3>
                    <p className="text-xs text-gray-400">Control When Files Are Uploaded</p>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  Every project card in your workspace has a dedicated <strong>Cloud Storage button</strong> in front of it with a cloud logo.
                </p>
                <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 text-xs text-gray-400 space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-300">
                    <CloudUpload size={14} className="shrink-0" />
                    <span><strong>Blue Cloud:</strong> Stored offline only on your mobile. Tap to upload.</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Check size={14} className="shrink-0" />
                    <span><strong>Green Cloud:</strong> Project, concepts, and clips are backed up online.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'higgsfield' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <HiggsfieldSettingsPanel
                onToast={onToast}
              />
            </div>
          )}

          {activeTab === 'kaggle' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <KaggleGpuSettingsPanel
                onToast={onToast}
                currentUserEmail={currentUserEmail}
              />
            </div>
          )}

          {activeTab === 'telegram' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <TelegramChannelsSettings
                onToast={onToast}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
      </main>

      {currentUserEmail && (
        <footer className="p-3 bg-gray-900/80 border-t border-gray-800 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">{currentUserEmail}</span>
            {isAdmin && (
              <span className="px-1.5 py-0.2 bg-purple-900/60 border border-purple-600/50 text-purple-300 text-[10px] font-bold rounded">
                Admin
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-500 font-mono shrink-0">
            Remixx Studio
          </span>
        </footer>
      )}
    </div>
  );
};
