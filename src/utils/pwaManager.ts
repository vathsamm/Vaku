// PWA Manager with Automatic Forced Updates on AI Studio Code Changes
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let updateSWHandler: ((reloadPage?: boolean) => Promise<void>) | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();
const updateListeners = new Set<(hasUpdate: boolean) => void>();

let isInstalledState = false;
let hasPendingUpdateState = false;

// Check initial standalone mode (already installed as PWA on Android or desktop)
if (typeof window !== 'undefined') {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  isInstalledState = isStandalone;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((cb) => cb(true));
  });

  window.addEventListener('appinstalled', () => {
    isInstalledState = true;
    deferredInstallPrompt = null;
    installListeners.forEach((cb) => cb(false));
  });
}

// Initialize Service Worker with instant auto-update
export function initPWA() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Disable Service Worker in Vite development mode to prevent dev server / websocket interception
  if (import.meta.env.DEV) {
    return;
  }

  try {
    updateSWHandler = registerSW({
      immediate: true,
      onNeedRefresh() {
        hasPendingUpdateState = true;
        updateListeners.forEach((cb) => cb(true));
        // Force update automatically without requiring manual APK reinstallation!
        console.log('[PWA] New AI Studio build detected! Auto-updating application...');
        if (updateSWHandler) {
          updateSWHandler(true).catch(() => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      },
      onOfflineReady() {
        console.log('[PWA] App is ready for 100% offline mobile use.');
      },
      onRegisteredSW(swUrl, registration) {
        console.log('[PWA] Service Worker active:', swUrl);
        if (registration) {
          // Check for updates every 30 seconds
          setInterval(() => {
            registration.update().catch(() => {});
          }, 30000);

          // Also check when app comes back to foreground
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              registration.update().catch(() => {});
            }
          });
        }
      },
    });
  } catch (err) {
    console.warn('[PWA] Service Worker registration note:', err);
  }
}

export function promptPWAInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return Promise.resolve(false);
  }
  return deferredInstallPrompt.prompt().then(() => {
    return deferredInstallPrompt!.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        isInstalledState = true;
        deferredInstallPrompt = null;
        installListeners.forEach((cb) => cb(false));
        return true;
      }
      return false;
    });
  }).catch(() => false);
}

export function subscribePWAInstall(cb: (canInstall: boolean) => void): () => void {
  installListeners.add(cb);
  cb(Boolean(deferredInstallPrompt) && !isInstalledState);
  return () => installListeners.delete(cb);
}

export function subscribePWAUpdate(cb: (hasUpdate: boolean) => void): () => void {
  updateListeners.add(cb);
  cb(hasPendingUpdateState);
  return () => updateListeners.delete(cb);
}

export function forcePWAUpdate() {
  if (updateSWHandler) {
    updateSWHandler(true).catch(() => window.location.reload());
  } else {
    window.location.reload();
  }
}

export function getIsPWAInstalled(): boolean {
  return isInstalledState;
}

export function getCanInstallPWA(): boolean {
  return Boolean(deferredInstallPrompt) && !isInstalledState;
}
