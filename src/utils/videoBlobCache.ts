import { useState, useEffect } from 'react';

const DB_NAME = 'remixx_video_cache_v1';
const STORE_NAME = 'video_blobs';

const memoryBlobUrlMap = new Map<string, string>();
const ongoingDownloads = new Map<string, Promise<string>>();

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.warn('[VideoCache] IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

export function normalizeClipKey(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return '';
  if (fileIdOrUrl.startsWith('/api/video/')) {
    return fileIdOrUrl.replace('/api/video/', '').split('?')[0];
  }
  return fileIdOrUrl.split('?')[0];
}

export function getMemoryBlobUrl(fileIdOrUrl: string): string | null {
  const key = normalizeClipKey(fileIdOrUrl);
  return memoryBlobUrlMap.get(key) || null;
}

// Zero-network local storage check: returns blob URL if already saved in memory or IndexedDB, null if not
export async function getExistingLocalBlobUrl(fileIdOrUrl: string): Promise<string | null> {
  const key = normalizeClipKey(fileIdOrUrl);
  if (!key) return null;

  const existingMemUrl = memoryBlobUrlMap.get(key);
  if (existingMemUrl) return existingMemUrl;

  try {
    const db = await getDb().catch(() => null);
    if (!db) return null;

    const storedBlob = await new Promise<Blob | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });

    if (storedBlob && storedBlob.size > 1000) {
      const blobUrl = URL.createObjectURL(storedBlob);
      memoryBlobUrlMap.set(key, blobUrl);
      return blobUrl;
    } else if (storedBlob) {
      try {
        const delTx = db.transaction(STORE_NAME, 'readwrite');
        delTx.objectStore(STORE_NAME).delete(key);
      } catch (_) {}
    }
  } catch (_) {}

  return null;
}

// Save a Blob directly into IndexedDB on the device so it never needs network fetching
export async function saveLocalClipBlob(fileIdOrUrl: string, blob: Blob): Promise<string> {
  const key = normalizeClipKey(fileIdOrUrl);
  if (!key || !blob) return '';

  const blobUrl = URL.createObjectURL(blob);
  memoryBlobUrlMap.set(key, blobUrl);

  try {
    const db = await getDb().catch(() => null);
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: key,
        blob,
        size: blob.size,
        type: blob.type || 'video/mp4',
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('[VideoCache] saveLocalClipBlob error:', err);
  }

  return blobUrl;
}

// Retrieve the raw offline Blob object for in-phone offline rendering
export async function getLocalClipBlob(fileIdOrUrl: string): Promise<Blob | null> {
  const key = normalizeClipKey(fileIdOrUrl);
  if (!key) return null;

  try {
    const db = await getDb().catch(() => null);
    if (!db) return null;

    return new Promise<Blob | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  } catch (_) {
    return null;
  }
}

// Check if a clip is 100% saved offline in mobile storage
export async function isClipCachedLocally(fileIdOrUrl: string): Promise<boolean> {
  const key = normalizeClipKey(fileIdOrUrl);
  if (!key) return false;
  if (memoryBlobUrlMap.has(key)) return true;

  try {
    const db = await getDb().catch(() => null);
    if (!db) return false;

    return new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.count(key);
        req.onsuccess = () => resolve((req.result || 0) > 0);
        req.onerror = () => resolve(false);
      } catch (_) {
        resolve(false);
      }
    });
  } catch (_) {
    return false;
  }
}

// Get device offline storage statistics
export async function getOfflineStorageStats(): Promise<{ count: number; totalBytes: number }> {
  try {
    const db = await getDb().catch(() => null);
    if (!db) return { count: 0, totalBytes: 0 };

    return new Promise<{ count: number; totalBytes: number }>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          let totalBytes = 0;
          for (const item of items) {
            totalBytes += item.size || item.blob?.size || 0;
          }
          resolve({ count: items.length, totalBytes });
        };
        req.onerror = () => resolve({ count: 0, totalBytes: 0 });
      } catch (_) {
        resolve({ count: 0, totalBytes: 0 });
      }
    });
  } catch (_) {
    return { count: 0, totalBytes: 0 };
  }
}

export async function getCachedVideoBlobUrl(fileIdOrUrl: string): Promise<string> {
  const key = normalizeClipKey(fileIdOrUrl);
  if (!key) return fileIdOrUrl;

  const existingMemUrl = memoryBlobUrlMap.get(key);
  if (existingMemUrl) {
    return existingMemUrl;
  }

  if (ongoingDownloads.has(key)) {
    return ongoingDownloads.get(key)!;
  }

  const downloadTask = (async (): Promise<string> => {
    try {
      const db = await getDb().catch(() => null);
      if (db) {
        const storedBlob = await new Promise<Blob | null>((resolve) => {
          try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.blob : null);
            req.onerror = () => resolve(null);
          } catch (_) {
            resolve(null);
          }
        });

        if (storedBlob && storedBlob.size > 1000) {
          const blobUrl = URL.createObjectURL(storedBlob);
          memoryBlobUrlMap.set(key, blobUrl);
          return blobUrl;
        } else if (storedBlob) {
          try {
            const delTx = db.transaction(STORE_NAME, 'readwrite');
            delTx.objectStore(STORE_NAME).delete(key);
          } catch (_) {}
        }
      }

      // If not yet saved offline on phone, download once and persist permanently into IndexedDB!
      const targetUrl = fileIdOrUrl.startsWith('http') || fileIdOrUrl.startsWith('/') 
        ? fileIdOrUrl 
        : `/api/video/${key}`;

      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch video: ${res.status}`);
      }

      const blob = await res.blob();
      if (!blob || blob.size <= 1000) {
        throw new Error(`Fetched video too small or corrupt: ${blob?.size || 0} bytes`);
      }

      const blobUrl = URL.createObjectURL(blob);
      memoryBlobUrlMap.set(key, blobUrl);

      if (db) {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: key,
            blob,
            size: blob.size,
            type: blob.type || 'video/mp4',
            updatedAt: Date.now(),
          });
        } catch (dbPutErr) {
          console.warn('[VideoCache] Save to IndexedDB error:', dbPutErr);
        }
      }

      return blobUrl;
    } catch (err) {
      console.warn('[VideoCache] Download error for clip:', key, err);
      const fallbackUrl = fileIdOrUrl.startsWith('http') || fileIdOrUrl.startsWith('/') 
        ? fileIdOrUrl 
        : `/api/video/${key}`;
      return fallbackUrl;
    } finally {
      ongoingDownloads.delete(key);
    }
  })();

  ongoingDownloads.set(key, downloadTask);
  return downloadTask;
}

export async function preloadProjectClips(
  clipFileIds: string[], 
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  const uniqueKeys = Array.from(new Set(clipFileIds.filter(Boolean)));
  if (uniqueKeys.length === 0) return;

  let loadedCount = 0;
  const total = uniqueKeys.length;

  await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        await getCachedVideoBlobUrl(key);
      } catch (_) {}
      loadedCount++;
      if (onProgress) onProgress(loadedCount, total);
    })
  );
}

export function useCachedVideoSrc(fileIdOrUrl?: string | null): { src: string; isBlob: boolean; isLoading: boolean } {
  const normalized = fileIdOrUrl ? normalizeClipKey(fileIdOrUrl) : '';
  const fallbackUrl = fileIdOrUrl 
    ? (fileIdOrUrl.startsWith('http') || fileIdOrUrl.startsWith('/') ? fileIdOrUrl : `/api/video/${normalized}`)
    : '';

  const initialMem = normalized ? memoryBlobUrlMap.get(normalized) : null;
  const [src, setSrc] = useState<string>(initialMem || fallbackUrl);
  const [isBlob, setIsBlob] = useState<boolean>(Boolean(initialMem));
  const [isLoading, setIsLoading] = useState<boolean>(!initialMem && Boolean(normalized));

  useEffect(() => {
    if (!normalized) {
      setSrc('');
      setIsBlob(false);
      setIsLoading(false);
      return;
    }

    const memUrl = memoryBlobUrlMap.get(normalized);
    if (memUrl) {
      setSrc(memUrl);
      setIsBlob(true);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getCachedVideoBlobUrl(normalized).then((cachedBlobUrl) => {
      if (isMounted) {
        setSrc(cachedBlobUrl);
        setIsBlob(cachedBlobUrl.startsWith('blob:'));
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSrc(fallbackUrl);
        setIsBlob(false);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [normalized]);

  return { src, isBlob, isLoading };
}
