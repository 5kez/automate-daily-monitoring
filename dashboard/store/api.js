// API Integration with Environment Variables
import API_CONFIG from '../src/config/config.js';
import { apiCache, withCache } from '../src/utils/apiCache.js';

// Simple global concurrency limiter to avoid overwhelming the backend
// Increased to 8 for faster parallel loading (especially for Home view with multiple servers)
const MAX_CONCURRENT = 8;
let activeCount = 0;
const waitQueue = [];

const runLimited = async (fn) => {
  if (activeCount >= MAX_CONCURRENT) {
    await new Promise((resolve) => waitQueue.push(resolve));
  }
  activeCount += 1;
  try {
    return await fn();
  } finally {
    activeCount -= 1;
    const next = waitQueue.shift();
    if (next) next();
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch with a single retry on 5xx errors
const fetchResponseWithRetry = async (url, options = {}, maxRetries = 1) => {
  let attempt = 0;
  while (true) {
    const response = await runLimited(() => fetch(url, options));
    if (response.ok) {
      return response;
    }
    const isServerError = response.status >= 500 && response.status < 600;
    if (!isServerError || attempt >= maxRetries) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    attempt += 1;
    await delay(400 * attempt);
  }
};

export const getBasename = (maybePath = '') => {
  const normalized = String(maybePath || '').replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
};

const replaceExtension = (name, fromExt, toExt) => {
  const s = String(name || '');
  if (!fromExt || !toExt) {return s;}
  return s.toLowerCase().endsWith(String(fromExt).toLowerCase())
    ? s.slice(0, -String(fromExt).length) + String(toExt)
    : s;
};

// Replace extension on the basename only, preserving any leading directories.
// Example: "2025/12/top_....json" -> "2025/12/top_....txt"
export const replaceBasenameExtension = (maybePath = '', fromExt = '.json', toExt = '.txt') => {
  const normalized = String(maybePath || '').replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) {return replaceExtension(normalized, fromExt, toExt);}
  const dir = normalized.slice(0, lastSlash + 1);
  const base = normalized.slice(lastSlash + 1);
  return dir + replaceExtension(base, fromExt, toExt);
};

// Fetch list of files from backend (cached with persistent storage)
const fetchFilesListCore = async (serverName, table) => {
  try {
    // Build query string with encodeURIComponent to avoid '+' for spaces
    const base = API_CONFIG.getListFilesUrl();
    const query = `?app=${encodeURIComponent(serverName || '')}`
      + `&table=${encodeURIComponent(table || '')}`
      + `&type=${encodeURIComponent('json')}`;
    const response = await fetchResponseWithRetry(`${base}${query}`);
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error(`Error fetching ${table} files:`, error);
    return [];
  }
};

// Persistent cache wrapper for file lists (stores permanently with 30-day TTL)
export const fetchFilesListPersistent = async (serverName, table) => {
  const cacheKey = apiCache.generateKey(serverName, 'filelist', table);
  
  // Try to get from cache/persistent storage first
  const cached = apiCache.get(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // If a request for this key is already in-flight, await it
  const inflight = apiCache.getInFlight(cacheKey);
  if (inflight) {
    return inflight;
  }

  // Start a new fetch and mark it in-flight to dedupe concurrent callers
  const promise = (async () => {
    try {
      const data = await fetchFilesListCore(serverName, table);
      if (data !== null && data !== undefined) {
        // Use setFileListCache for longer TTL (2 hours instead of 5 minutes)
        apiCache.setFileListCache(cacheKey, data);
      }
      return data;
    } finally {
      apiCache.deleteInFlight(cacheKey);
    }
  })();

  apiCache.setInFlight(cacheKey, promise);
  return promise;
};

// Cached version with 3 minute TTL for file lists (for backward compatibility)
export const fetchFilesList = fetchFilesListPersistent;

// Core function to get file data
const getFileDataCore = async (serverName, fileName, table) => {
  try {
    const base = API_CONFIG.getGetFileUrl();
    const query = `?app=${encodeURIComponent(serverName || '')}`
      + `&table=${encodeURIComponent(table || '')}`
      + `&type=${encodeURIComponent('json')}`
      + `&filename=${encodeURIComponent(fileName || '')}`;
    const response = await fetchResponseWithRetry(`${base}${query}`);
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching file:', error);
    return null;
  }
};

// Cached version - most important for performance
export const getFileData = withCache(
  (serverName, fileName, table) => apiCache.generateKey(serverName, fileName, table),
  getFileDataCore
);

// Download file from webhook - GET request
// Tables: top, df, tablespace, errpt_more, errpt_a_more, loggap, check_process, db_backup, weekly_backup, backup_db_local
// Types: raw, json
export const downloadFile = async (app, table, filename, type = 'json') => {
  try {
    // Validate table and type
    const validTables = ['top', 'df', 'tablespace', 'errpt_more', 'errpt_a_more', 'loggap', 'check_process', 'db_backup', 'weekly_backup', 'backup_db_local'];
    const validTypes = ['raw', 'json'];
    
    if (!validTables.includes(table)) {
      throw new Error(`Invalid table: ${table}. Must be one of: ${validTables.join(', ')}`);
    }
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const base = API_CONFIG.getDownloadUrl();
    const query = `?app=${encodeURIComponent(app || '')}`
      + `&table=${encodeURIComponent(table || '')}`
      + `&type=${encodeURIComponent(type || 'json')}`
      + `&filename=${encodeURIComponent(filename || '')}`;
    const response = await fetchResponseWithRetry(`${base}${query}`);

    // Get the file content based on type
    let content;
    if (type === 'json') {
      content = await response.json();
    } else {
      content = await response.text();
    }

    return content;
  } catch (error) {
    console.error('Error downloading file:', error);
    return null;
  }
};

// Export cache utilities for manual cache management
export { apiCache };

/**
 * Clear all API cache
 */
export const clearApiCache = () => {
  apiCache.clear();
};

/**
 * Clear cache for specific server
 */
export const clearServerCache = (serverName) => {
  apiCache.clearServer(serverName);
};

/**
 * Refresh file lists from backend and update persistent storage
 * Useful for manual refresh or periodic updates
 */
export const refreshFilesListPersistent = async (serverName, table) => {
  const cacheKey = apiCache.generateKey(serverName, 'filelist', table);
  
  // Force fetch fresh data from backend
  try {
    const data = await fetchFilesListCore(serverName, table);
    if (data !== null && data !== undefined) {
      // Update persistent storage with fresh data
      apiCache.setPersistent(cacheKey, data);
    }
    return data;
  } catch (error) {
    console.error(`Error refreshing ${table} files for ${serverName}:`, error);
    // Return cached data if refresh fails
    const cached = apiCache.get(cacheKey);
    return cached || [];
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => apiCache.getStats();