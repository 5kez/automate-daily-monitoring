// Configuration: config.js
// Centralized API configuration from environment variables

const defaultWebhookHost = (() => {
  // In development, use relative paths to leverage Vite proxy
  // In production, use the full webhook host or environment variable
  if (import.meta.env.DEV) {
    return '';  // Empty string means use relative paths (Vite proxy will handle it)
  }
  // Prefer same-origin in production deployments (nginx can reverse-proxy /webhook/*).
  // Fall back to localhost for non-browser contexts.
  if (typeof window !== 'undefined' && window.location?.origin) {return window.location.origin;}
  return 'http://localhost:5678';
})();

const API_CONFIG = {
  webhookHost: import.meta.env.VITE_API_WEBHOOK_HOST || defaultWebhookHost,
  listFilesPath: import.meta.env.VITE_API_LIST_FILES_PATH || '/webhook/api/v1/list-files',
  getFilePath: import.meta.env.VITE_API_GET_FILE_PATH || '/webhook/get-file',
  downloadPath: import.meta.env.VITE_API_DOWNLOAD_PATH || '/webhook/download-file',
  refreshPath: import.meta.env.VITE_API_REFRESH_PATH || '/webhook/refresh',

  // Generated URLs
  get listFilesUrl() {
    return `${this.webhookHost}${this.listFilesPath}`;
  },

  get getFileUrl() {
    return `${this.webhookHost}${this.getFilePath}`;
  },

  get downloadUrl() {
    return `${this.webhookHost}${this.downloadPath}`;
  },

  get refreshUrl() {
    return `${this.webhookHost}${this.refreshPath}`;
  },

  // Utility methods
  getListFilesUrl() {
    return this.listFilesUrl;
  },

  getGetFileUrl() {
    return this.getFileUrl;
  },

  getDownloadUrl() {
    return this.downloadUrl;
  },

  getRefreshUrl() {
    return this.refreshUrl;
  },

  // Log configuration (useful for debugging)
  logConfig() {
    // Only log in development mode or when explicitly enabled
    if (import.meta.env.VITE_DEBUG_CONFIG !== 'true' && !import.meta.env.DEV) {
      return;
    }
    // API configuration available for debugging
  }
};

export default API_CONFIG;
