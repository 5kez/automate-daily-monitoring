// API Cache Manager
// Provides intelligent caching for API responses with TTL and LRU eviction
// Plus persistent storage via localStorage for permanent data retention

class ApiCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100; // Maximum number of cached items
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.fileListTTL = options.fileListTTL || 2 * 60 * 60 * 1000; // 2 hours for file lists (much longer)
    this.persistentTTL = options.persistentTTL || 30 * 24 * 60 * 60 * 1000; // 30 days default
    this.cache = new Map();
    this.timestamps = new Map();
    this.accessOrder = new Map(); // For LRU tracking
    this.inFlight = new Map(); // Track in-flight promises to dedupe concurrent requests
    this.persistentKeys = new Set(); // Track which keys should persist
    this.fileListKeys = new Set(); // Track file list keys for longer TTL
    this.storagePrefix = 'api_cache_';
    this.initPersistentStorage();
  }

  /**
   * Initialize persistent storage from localStorage
   */
  initPersistentStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    try {
      // Load all persisted cache items from localStorage
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (key.startsWith(this.storagePrefix)) {
          const cacheKey = key.substring(this.storagePrefix.length);
          const stored = JSON.parse(window.localStorage.getItem(key));
          
          if (stored && stored.data !== null && stored.timestamp) {
            const now = Date.now();
            // Check if persisted data hasn't expired
            if (now - stored.timestamp <= this.persistentTTL) {
              this.cache.set(cacheKey, stored.data);
              this.timestamps.set(cacheKey, stored.timestamp);
              this.accessOrder.set(cacheKey, stored.timestamp);
              this.persistentKeys.add(cacheKey);
            } else {
              // Remove expired persisted data
              window.localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted cache:', error);
    }
  }

  /**
   * Generate cache key from API parameters
   */
  generateKey(serverName, identifier, table) {
    return `${serverName}::${table}::${identifier}`;
  }

  /**
   * Get cached data if still valid
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    const now = Date.now();
    const isPersistent = this.persistentKeys.has(key);
    const isFileList = this.fileListKeys.has(key);
    
    // Determine TTL: persistent > file list > default
    let ttl = this.defaultTTL;
    if (isPersistent) {
      ttl = this.persistentTTL;
    } else if (isFileList) {
      ttl = this.fileListTTL;
    }

    // Check if cache has expired
    if (now - timestamp > ttl) {
      this.delete(key);
      if (isPersistent && typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(this.storagePrefix + key);
        } catch (error) {
          console.warn('Failed to remove expired persisted cache:', error);
        }
      }
      return null;
    }

    // Update access time for LRU
    this.accessOrder.set(key, now);
    return this.cache.get(key);
  }

  /**
   * Set cache data with timestamp
   */
  set(key, data) {
    // If cache is full, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, data);
    this.timestamps.set(key, now);
    this.accessOrder.set(key, now);
  }

  /**
   * Set cache data as persistent (stores in localStorage)
   */
  setPersistent(key, data) {
    // Store in memory
    this.set(key, data);
    
    // Mark as persistent
    this.persistentKeys.add(key);
    
    // Store in localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = {
          data: data,
          timestamp: Date.now()
        };
        window.localStorage.setItem(
          this.storagePrefix + key,
          JSON.stringify(stored)
        );
      } catch (error) {
        console.warn(`Failed to persist cache for key ${key}:`, error);
      }
    }
  }

  /**
   * Set cache data for file lists (uses longer TTL)
   * File lists rarely change, so cache them for longer (2 hours)
   */
  setFileListCache(key, data) {
    // Store in memory with extended TTL
    this.set(key, data);
    
    // Mark as file list for longer TTL
    this.fileListKeys.add(key);
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    this.accessOrder.delete(key);
    this.fileListKeys.delete(key);
    
    // Also remove from persistent storage if it was persistent
    if (this.persistentKeys.has(key) && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(this.storagePrefix + key);
      } catch (error) {
        console.warn('Failed to remove persisted cache:', error);
      }
    }
    this.persistentKeys.delete(key);
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    // Clear persistent storage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const keys = Object.keys(window.localStorage);
        for (const key of keys) {
          if (key.startsWith(this.storagePrefix)) {
            window.localStorage.removeItem(key);
          }
        }
      } catch (error) {
        console.warn('Failed to clear persisted cache:', error);
      }
    }
    
    this.cache.clear();
    this.timestamps.clear();
    this.accessOrder.clear();
    this.inFlight.clear();
    this.persistentKeys.clear();
  }

  /**
   * Clear cache for specific server
   */
  clearServer(serverName) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${serverName}::`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Clear cache for specific table
   */
  clearTable(table) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(`::${table}::`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Clear all file list caches (when you need fresh file list from backend)
   */
  clearAllFileLists() {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes('::filelist::')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.defaultTTL,
      keys: Array.from(this.cache.keys()),
      inFlight: this.inFlight.size
    };
  }

  /**
   * Check if cache has valid entry
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * In-flight helpers: get/set/delete a promise for a given key
   */
  getInFlight(key) {
    return this.inFlight.get(key);
  }
  setInFlight(key, promise) {
    this.inFlight.set(key, promise);
  }
  deleteInFlight(key) {
    this.inFlight.delete(key);
  }
}

// Create singleton instance
const apiCache = new ApiCache({
  maxSize: 200, // Cache up to 200 responses
  defaultTTL: 5 * 60 * 1000 // 5 minutes
});

// Export cache instance and utilities
export { apiCache };

/**
 * Cache-aware wrapper for async functions
 */
export const withCache = (cacheKey, fetchFn, options = {}) => async (...args) => {
  const key = typeof cacheKey === 'function' ? cacheKey(...args) : cacheKey;

  // Try to get from cache first
  const cached = apiCache.get(key);
  if (cached !== null && !options.skipCache) {
    return cached;
  }

  // If a request for this key is already in-flight, await it
  const inflight = apiCache.getInFlight(key);
  if (inflight && !options.skipCache) {
    return inflight;
  }

  // Start a new fetch and mark it in-flight to dedupe concurrent callers
  const promise = (async () => {
    try {
      const data = await fetchFn(...args);
      if (data !== null && data !== undefined) {
        apiCache.set(key, data);
      }
      return data;
    } finally {
      apiCache.deleteInFlight(key);
    }
  })();

  apiCache.setInFlight(key, promise);
  return promise;
};

export default apiCache;
