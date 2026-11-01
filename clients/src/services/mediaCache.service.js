
import { getOriginalUrl } from './media.service';

const DB_NAME = 'dear-us-media-cache';
const DB_VERSION = 3;

const STORE_NAME = 'originals';
const THUMBNAIL_STORE_NAME = 'thumbnails';
const METADATA_STORE_NAME = 'metadata';

const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_THUMBNAIL_CACHE_BYTES = 50 * 1024 * 1024; // 50 MB

// Prevent duplicate downloads.
const inFlightRequests = new Map();
const inFlightThumbnailRequests = new Map();

let dbPromise = null;

// --------------------------------------------------
// Database
// --------------------------------------------------


function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Original images
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'key',
        });

        store.createIndex('lastAccessed', 'lastAccessed');
        store.createIndex('userId', 'userId');
      }

      // Thumbnails
      if (!db.objectStoreNames.contains(THUMBNAIL_STORE_NAME)) {
        const store = db.createObjectStore(THUMBNAIL_STORE_NAME, {
          keyPath: 'key',
        });

        store.createIndex('lastAccessed', 'lastAccessed');
        store.createIndex('userId', 'userId');
      }

      // Offline metadata
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        const store = db.createObjectStore(METADATA_STORE_NAME, {
          keyPath: 'key',
        });

        store.createIndex('userId', 'userId');
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };

      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}


function createCacheKey(userId, mediaId) {
  return `${userId}:${mediaId}`;
}

function getRequestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --------------------------------------------------
// Generic IndexedDB helpers
// --------------------------------------------------

async function getEntryFromStore(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readonly');

  return getRequestResult(
    transaction.objectStore(storeName).get(key),
  );
}

async function getAllEntriesFromStore(storeName) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readonly');

  return getRequestResult(
    transaction.objectStore(storeName).getAll(),
  );
}


async function saveEntryToStore(storeName, entry) {
  const db = await openDatabase();

  const transaction = db.transaction(storeName, 'readwrite');

  transaction.objectStore(storeName).put(entry);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();

    transaction.onerror = () => {
      reject(transaction.error);
    };

    transaction.onabort = () => {
      reject(transaction.error);
    };
  });
}


async function deleteEntryFromStore(storeName, key) {
  const db = await openDatabase();
  const transaction = db.transaction(storeName, 'readwrite');

  transaction.objectStore(storeName).delete(key);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// Original-store helpers (preserve existing API).

async function getEntry(key) {
  return getEntryFromStore(STORE_NAME, key);
}

async function getAllEntries() {
  return getAllEntriesFromStore(STORE_NAME);
}

async function saveEntry(entry) {
  return saveEntryToStore(STORE_NAME, entry);
}

async function deleteEntry(key) {
  return deleteEntryFromStore(STORE_NAME, key);
}

// --------------------------------------------------
// Original-image cache eviction
// --------------------------------------------------

async function enforceCacheLimit(protectedKeys = []) {
  const entries = await getAllEntries();

  let totalBytes = entries.reduce(
    (total, entry) => total + (entry.size || 0),
    0,
  );

  if (totalBytes <= MAX_CACHE_BYTES) return;

  const protectedSet = new Set(protectedKeys);

  const candidates = entries
    .filter((entry) => !protectedSet.has(entry.key))
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'prefetch' ? -1 : 1;
      }

      return a.lastAccessed - b.lastAccessed;
    });

  for (const entry of candidates) {
    if (totalBytes <= MAX_CACHE_BYTES) break;

    await deleteEntry(entry.key);
    totalBytes -= entry.size || 0;
  }
}

// --------------------------------------------------
// Read cached original
// --------------------------------------------------

export async function getCachedOriginal(userId, mediaId) {
  if (!userId || !mediaId) return null;

  const key = createCacheKey(userId, mediaId);
  const entry = await getEntry(key);

  if (!entry?.blob) return null;

  entry.lastAccessed = Date.now();

  await saveEntry(entry);

  return entry.blob;
}

// --------------------------------------------------
// Save original
// --------------------------------------------------

export async function cacheOriginal(
  userId,
  mediaId,
  blob,
  kind = 'viewed',
) {
  if (!userId || !mediaId || !blob) return;

  const key = createCacheKey(userId, mediaId);

  const entry = {
    key,
    userId: String(userId),
    mediaId: String(mediaId),
    blob,
    size: blob.size,
    contentType: blob.type,
    kind,
    lastAccessed: Date.now(),
  };

  await saveEntry(entry);

  await enforceCacheLimit(
    kind === 'viewed' ? [key] : [],
  );
}

// --------------------------------------------------
// Fetch original or return cached original
// --------------------------------------------------

export async function getOrFetchOriginal(
  userId,
  mediaId,
  kind = 'viewed',
  { onCacheMiss } = {},
) {
  if (!userId || !mediaId) {
    throw new Error('User ID and media ID are required.');
  }

  const key = createCacheKey(userId, mediaId);

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const request = (async () => {
    let cachedBlob = null;

    try {
      cachedBlob = await getCachedOriginal(userId, mediaId);
    } catch (error) {
      console.warn('[CACHE READ FAILED]', mediaId, error);
    }

    if (cachedBlob) {
      console.log('[CACHE HIT]', {
        mediaId,
        size: cachedBlob.size,
      });

      if (kind === 'viewed') {
        await markOriginalViewed(userId, mediaId).catch((error) => {
          console.warn('[CACHE UPDATE FAILED]', error);
        });
      }

      return cachedBlob;
    }

    console.log('[CACHE MISS]', mediaId);
    onCacheMiss?.();

    console.log('[S3] Requesting signed URL:', mediaId);

    const originalUrl = await getOriginalUrl(mediaId);
    const response = await fetch(originalUrl);

    console.log('[S3] Download response:', {
      status: response.status,
      contentType: response.headers.get('content-type'),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      throw new Error(
        `S3 download failed: ${response.status} - ${errorBody}`,
      );
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error('S3 returned an empty image.');
    }

    console.log('[S3] Original downloaded:', {
      mediaId,
      size: blob.size,
      type: blob.type,
    });

    try {
      await cacheOriginal(userId, mediaId, blob, kind);
      console.log('[CACHE SAVED]', mediaId);
    } catch (error) {
      console.error('[CACHE SAVE FAILED]', mediaId, error);
    }

    return blob;
  })();

  inFlightRequests.set(key, request);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(key);
  }
}

// --------------------------------------------------
// Mark original as viewed
// --------------------------------------------------

export async function markOriginalViewed(userId, mediaId) {
  if (!userId || !mediaId) return;

  const key = createCacheKey(userId, mediaId);
  const entry = await getEntry(key);

  if (!entry?.blob) return;

  entry.kind = 'viewed';
  entry.lastAccessed = Date.now();

  await saveEntry(entry);
  await enforceCacheLimit([key]);
}

// --------------------------------------------------
// Delete cached original
// --------------------------------------------------

export async function removeCachedOriginal(userId, mediaId) {
  if (!userId || !mediaId) return;

  const key = createCacheKey(userId, mediaId);

  await deleteEntry(key);
}

// --------------------------------------------------
// Original cache information
// --------------------------------------------------

export async function getCacheUsage() {
  const entries = await getAllEntries();

  const totalBytes = entries.reduce(
    (total, entry) => total + (entry.size || 0),
    0,
  );

  return {
    totalBytes,
    limitBytes: MAX_CACHE_BYTES,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    limitMB: 200,
  };
}

// ==================================================
// THUMBNAIL CACHE
// ==================================================

// --------------------------------------------------
// Thumbnail cache eviction
// --------------------------------------------------

async function enforceThumbnailCacheLimit(protectedKeys = []) {
  const entries = await getAllEntriesFromStore(
    THUMBNAIL_STORE_NAME,
  );

  let totalBytes = entries.reduce(
    (total, entry) => total + (entry.size || 0),
    0,
  );

  if (totalBytes <= MAX_THUMBNAIL_CACHE_BYTES) return;

  const protectedSet = new Set(protectedKeys);

  const candidates = entries
    .filter((entry) => !protectedSet.has(entry.key))
    .sort((a, b) => a.lastAccessed - b.lastAccessed);

  for (const entry of candidates) {
    if (totalBytes <= MAX_THUMBNAIL_CACHE_BYTES) break;

    await deleteEntryFromStore(
      THUMBNAIL_STORE_NAME,
      entry.key,
    );

    totalBytes -= entry.size || 0;
  }
}

// --------------------------------------------------
// Read cached thumbnail
// --------------------------------------------------

export async function getCachedThumbnail(userId, mediaId) {
  if (!userId || !mediaId) return null;

  const key = createCacheKey(userId, mediaId);

  const entry = await getEntryFromStore(
    THUMBNAIL_STORE_NAME,
    key,
  );

  if (!entry?.blob) return null;

  entry.lastAccessed = Date.now();

  await saveEntryToStore(
    THUMBNAIL_STORE_NAME,
    entry,
  );

  return entry.blob;
}

// --------------------------------------------------
// Save thumbnail
// --------------------------------------------------

export async function cacheThumbnail(userId, mediaId, blob) {
  if (!userId || !mediaId || !blob?.size) return;

  const key = createCacheKey(userId, mediaId);

  const entry = {
    key,
    userId: String(userId),
    mediaId: String(mediaId),
    blob,
    size: blob.size,
    contentType: blob.type,
    lastAccessed: Date.now(),
  };

  await saveEntryToStore(
    THUMBNAIL_STORE_NAME,
    entry,
  );

  await enforceThumbnailCacheLimit([key]);
}

// --------------------------------------------------
// Fetch thumbnail or return cached thumbnail
// --------------------------------------------------

export async function getOrFetchThumbnail(
  userId,
  mediaId,
  thumbnailUrl,
) {
  if (!userId || !mediaId) {
    throw new Error('User ID and media ID are required.');
  }

  const key = createCacheKey(userId, mediaId);

  if (inFlightThumbnailRequests.has(key)) {
    return inFlightThumbnailRequests.get(key);
  }

  const request = (async () => {
    let cachedBlob = null;

    try {
      cachedBlob = await getCachedThumbnail(userId, mediaId);
    } catch (error) {
      console.warn('[THUMBNAIL CACHE READ FAILED]', mediaId, error);
    }

    if (cachedBlob) {
      console.log('[THUMBNAIL CACHE HIT]', mediaId);
      return cachedBlob;
    }

    console.log('[THUMBNAIL CACHE MISS]', mediaId);

    if (!thumbnailUrl) {
      throw new Error('Thumbnail URL is unavailable.');
    }

    const response = await fetch(thumbnailUrl);

    if (!response.ok) {
      throw new Error(
        `Thumbnail download failed: ${response.status}`,
      );
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error('Thumbnail download returned an empty file.');
    }

    console.log('[THUMBNAIL DOWNLOADED]', {
      mediaId,
      size: blob.size,
      type: blob.type,
    });

    try {
      await cacheThumbnail(userId, mediaId, blob);
      console.log('[THUMBNAIL CACHE SAVED]', mediaId);
    } catch (error) {
      console.warn('[THUMBNAIL CACHE SAVE FAILED]', mediaId, error);
    }

    return blob;
  })();

  inFlightThumbnailRequests.set(key, request);

  try {
    return await request;
  } finally {
    inFlightThumbnailRequests.delete(key);
  }
}

// --------------------------------------------------
// Delete cached thumbnail
// --------------------------------------------------

export async function removeCachedThumbnail(userId, mediaId) {
  if (!userId || !mediaId) return;

  const key = createCacheKey(userId, mediaId);

  await deleteEntryFromStore(
    THUMBNAIL_STORE_NAME,
    key,
  );
}

// --------------------------------------------------
// Thumbnail cache information
// --------------------------------------------------

export async function getThumbnailCacheUsage() {
  const entries = await getAllEntriesFromStore(
    THUMBNAIL_STORE_NAME,
  );

  const totalBytes = entries.reduce(
    (total, entry) => total + (entry.size || 0),
    0,
  );

  return {
    totalBytes,
    limitBytes: MAX_THUMBNAIL_CACHE_BYTES,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    limitMB: 50,
  };
}



// ==================================================
// OFFLINE METADATA CACHE
// ==================================================

function createMetadataKey(userId, cacheKey) {
  return `${userId}:${cacheKey}`;
}

// Remove temporary signed S3 URLs before persisting metadata.
function sanitizeMetadata(data) {
  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (
      key === 'thumbnailUrl' ||
      key === 'originalUrl' ||
      key === 'uploadUrl' ||
      key === 'url'
    ) {
      sanitized[key] = null;
      continue;
    }

    sanitized[key] = sanitizeMetadata(value);
  }

  return sanitized;
}

export async function cacheMetadata(userId, cacheKey, data) {
  if (!userId || !cacheKey || data === undefined) {
    return;
  }

  const key = createMetadataKey(userId, cacheKey);

  const entry = {
    key,
    userId: String(userId),
    cacheKey: String(cacheKey),
    data: sanitizeMetadata(data),
    updatedAt: Date.now(),
  };

  await saveEntryToStore(METADATA_STORE_NAME, entry);

  console.log('[METADATA CACHE SAVED]', cacheKey);
}

export async function getCachedMetadata(userId, cacheKey) {
  if (!userId || !cacheKey) {
    return null;
  }

  const key = createMetadataKey(userId, cacheKey);

  const entry = await getEntryFromStore(
    METADATA_STORE_NAME,
    key,
  );

  if (!entry) {
    console.log('[METADATA CACHE MISS]', cacheKey);
    return null;
  }

  console.log('[METADATA CACHE HIT]', {
    cacheKey,
    updatedAt: new Date(entry.updatedAt).toISOString(),
  });

  return entry.data;
}

export async function removeCachedMetadata(userId, cacheKey) {
  if (!userId || !cacheKey) return;

  const key = createMetadataKey(userId, cacheKey);

  await deleteEntryFromStore(METADATA_STORE_NAME, key);
}

