
import { getOriginalUrl } from './media.service';

const DB_NAME = 'dear-us-media-cache';
const DB_VERSION = 1;
const STORE_NAME = 'originals';

const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB

// Prevent duplicate downloads of the same image.
const inFlightRequests = new Map();

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

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'key',
        });

        store.createIndex('lastAccessed', 'lastAccessed');
        store.createIndex('userId', 'userId');
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

async function getEntry(key) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readonly');

  return getRequestResult(
    transaction.objectStore(STORE_NAME).get(key),
  );
}

async function getAllEntries() {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readonly');

  return getRequestResult(
    transaction.objectStore(STORE_NAME).getAll(),
  );
}

async function saveEntry(entry) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');

  transaction.objectStore(STORE_NAME).put(entry);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function deleteEntry(key) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, 'readwrite');

  transaction.objectStore(STORE_NAME).delete(key);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

// --------------------------------------------------
// Cache eviction
// --------------------------------------------------

async function enforceCacheLimit(protectedKeys = []) {
  const entries = await getAllEntries();

  let totalBytes = entries.reduce(
    (total, entry) => total + (entry.size || 0),
    0,
  );

  if (totalBytes <= MAX_CACHE_BYTES) return;

  const protectedSet = new Set(protectedKeys);

  // Prefetched images are removed before viewed images.
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

  // Preserve the existing kind: viewed or prefetch.
  await saveEntry(entry);

  return entry.blob;
}

// --------------------------------------------------
// Save original to IndexedDB
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

  // Protect the currently viewed image.
  await enforceCacheLimit(
    kind === 'viewed' ? [key] : [],
  );
}

// --------------------------------------------------
// Fetch original or return cached image
// --------------------------------------------------


export async function getOrFetchOriginal( userId, mediaId, kind = 'viewed', { onCacheMiss } = {}) {
    
  if (!userId || !mediaId) {
    throw new Error('User ID and media ID are required.');
  }

  const key = createCacheKey(userId, mediaId);

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const request = (async () => {
    let cachedBlob = null;

    // IndexedDB failure must not stop original image downloading.
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



export async function markOriginalViewed(userId, mediaId) {
  if (!userId || !mediaId) return;

  const key = createCacheKey(userId, mediaId);
  const entry = await getEntry(key);

  if (!entry?.blob) return;

  // Promote prefetched image to viewed image.
  entry.kind = 'viewed';
  entry.lastAccessed = Date.now();

  await saveEntry(entry);

  // Protect this image during cache eviction.
  await enforceCacheLimit([key]);
}


// --------------------------------------------------
// Delete cached image
// --------------------------------------------------

export async function removeCachedOriginal(userId, mediaId) {
  if (!userId || !mediaId) return;

  const key = createCacheKey(userId, mediaId);

  await deleteEntry(key);
}

// --------------------------------------------------
// Cache information
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
    totalMB: Number(
      (totalBytes / (1024 * 1024)).toFixed(2),
    ),
    limitMB: 200,
  };
}
