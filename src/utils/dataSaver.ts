import { useState, useEffect } from 'react';

export interface UltraDataSaverConfig {
  enabled: boolean;
  noAutoplayHover: boolean;
  microThumbnails: boolean;
  timelineSingleFrame: boolean;
  smartPolling: boolean;
  lazyTimelineVideo: boolean;
  noAudioPreload: boolean;
  savedBytes: number;
}

const STORAGE_KEY = 'ai_studio_ultra_data_saver';
const SAVED_BYTES_KEY = 'ai_studio_saved_bytes_v1';
const EVENT_NAME = 'remixx_data_saver_change';

const DEFAULT_CONFIG: UltraDataSaverConfig = {
  enabled: true,
  noAutoplayHover: true,
  microThumbnails: true,
  timelineSingleFrame: true,
  smartPolling: true,
  lazyTimelineVideo: true,
  noAudioPreload: true,
  savedBytes: 0,
};

export function getUltraDataSaverConfig(): UltraDataSaverConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG, enabled: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const savedBytesRaw = localStorage.getItem(SAVED_BYTES_KEY);
    const savedBytes = savedBytesRaw ? parseInt(savedBytesRaw, 10) || 0 : 0;

    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        enabled: true,
        savedBytes: Math.max(savedBytes, parsed.savedBytes || 0),
      };
    }
  } catch (_) {}

  return { ...DEFAULT_CONFIG, enabled: true };
}

export function saveUltraDataSaverConfig(config: Partial<UltraDataSaverConfig>): UltraDataSaverConfig {
  const current = getUltraDataSaverConfig();
  const updated: UltraDataSaverConfig = {
    ...current,
    ...config,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(SAVED_BYTES_KEY, updated.savedBytes.toString());
    localStorage.setItem('ai_studio_data_saver', String(updated.enabled));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: updated }));
  } catch (_) {}

  return updated;
}

export function recordDataSaved(
  type: 'video_hover' | 'thumb_compression' | 'filmstrip_suppressed' | 'polling_skip' | 'audio_preload',
  multiplier: number = 1
): void {
  const bytesByType: Record<string, number> = {
    video_hover: 5 * 1024 * 1024,
    thumb_compression: 42 * 1024,
    filmstrip_suppressed: 280 * 1024,
    polling_skip: 85 * 1024,
    audio_preload: 1.5 * 1024 * 1024,
  };

  const delta = (bytesByType[type] || 50000) * multiplier;
  const current = getUltraDataSaverConfig();
  const nextSaved = Math.max(0, current.savedBytes + delta);

  try {
    localStorage.setItem(SAVED_BYTES_KEY, nextSaved.toString());
  } catch (_) {}
}

export function resetDataSavedCounter(): void {
  try {
    localStorage.setItem(SAVED_BYTES_KEY, '0');
    saveUltraDataSaverConfig({ savedBytes: 0 });
  } catch (_) {}
}

export function formatDataSavedBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function useUltraDataSaver() {
  const [config, setConfig] = useState<UltraDataSaverConfig>(() => getUltraDataSaverConfig());

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<UltraDataSaverConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        setConfig(getUltraDataSaverConfig());
      }
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const updateConfig = (patch: Partial<UltraDataSaverConfig>) => {
    const next = saveUltraDataSaverConfig(patch);
    setConfig(next);
  };

  return { config, updateConfig, isUltra: config.enabled };
}
