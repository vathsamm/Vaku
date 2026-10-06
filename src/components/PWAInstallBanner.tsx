import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Sparkles, Check, RefreshCw, X, HardDrive } from 'lucide-react';
import { 
  promptPWAInstall, 
  subscribePWAInstall, 
  subscribePWAUpdate, 
  forcePWAUpdate,
  getIsPWAInstalled 
} from '../utils/pwaManager';
import { getOfflineStorageStats } from '../utils/videoBlobCache';

export const PWAInstallBanner: React.FC = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('vd_pwa_banner_dismissed') === 'true';
    } catch {
      return false;
    }
  });
  const [offlineStats, setOfflineStats] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    setIsInstalled(getIsPWAInstalled());

    const unsubInstall = subscribePWAInstall((installable) => {
      setCanInstall(installable);
    });

    const unsubUpdate = subscribePWAUpdate((updateAvailable) => {
      setHasUpdate(updateAvailable);
    });

    getOfflineStorageStats().then(setOfflineStats).catch(() => {});
    const interval = setInterval(() => {
      getOfflineStorageStats().then(setOfflineStats).catch(() => {});
    }, 15000);

    return () => {
      unsubInstall();
      unsubUpdate();
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    const success = await promptPWAInstall();
    if (!success) {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('vd_pwa_banner_dismissed', 'true');
    } catch (_) {}
  };

  // If new update is available from AI Studio, show prominent update bar
  if (hasUpdate) {
    return (
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-cyan-600 text-white px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shadow-lg z-50 text-xs sm:text-sm animate-in slide-in-from-top duration-200">
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw size={15} className="animate-spin text-cyan-200 shrink-0" />
          <span className="font-bold truncate">
            New AI Studio update available! Auto-updating...
          </span>
        </div>
        <button
          type="button"
          onClick={forcePWAUpdate}
          className="px-3 py-1 bg-white text-gray-950 font-black rounded-lg text-xs shadow-md hover:bg-gray-100 transition active:scale-95 shrink-0 cursor-pointer"
        >
          Update Now
        </button>
      </div>
    );
  }

  // If already installed or dismissed, do not show persistent banner
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <>
      <div className="bg-gradient-to-r from-purple-950/90 via-gray-900 to-indigo-950/90 border-b border-purple-500/30 px-3 py-2 flex items-center justify-between gap-2 text-xs z-40 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-gradient-to-tr from-purple-600 to-cyan-500 rounded-lg text-white shrink-0 shadow-sm">
            <Smartphone size={14} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-1.5 truncate">
              <span>Install Vd Studio on Android</span>
              <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-mono">
                100% Offline
              </span>
            </div>
            <p className="text-[10px] text-gray-400 truncate hidden xs:block">
              Clips stay offline on your phone • Auto-updates from AI Studio without downloading APKs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg text-[11px] transition active:scale-95 flex items-center gap-1 shadow-md cursor-pointer"
          >
            <Download size={12} />
            <span>Install App</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-white rounded-md cursor-pointer transition"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Manual Installation Guide Modal (For browsers that don't trigger native dialog) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-600/30 rounded-xl text-purple-300">
                  <Smartphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Install on Android</h3>
                  <p className="text-[11px] text-gray-400">Add to your Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300 bg-gray-950 p-3.5 rounded-xl border border-gray-800/80">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <span>Open this link in <strong>Chrome</strong>, <strong>Samsung Internet</strong>, or <strong>Edge</strong> on your Android phone.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <span>Tap the <strong>three dots menu (⋮)</strong> at the top right of your browser.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <span>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">✓</span>
                <span>The app installs with the <strong>Vd Studio</strong> icon, launches in full screen, and auto-updates with every AI Studio update!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
