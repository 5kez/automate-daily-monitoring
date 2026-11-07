/**
 * Common constants used throughout the application
 */

export const BACKUP_STATUS = {
  SUCCESS: 'success',
  FAILED: 'failed',
  INCOMPLETE: 'incomplete',
  RUNNING: 'running'
};

export const DEFAULT_VALUES = {
  NOT_AVAILABLE: 'N/A',
  LOADING: 'Loading...'
};

export const REGEX_PATTERNS = {
  // Date patterns
  ISO_DATE: /(\d{4})-(\d{2})-(\d{2})/,
  COMPACT_DATE: /(\d{2})-([A-Z]{3})-(\d{2})/,
  FILE_DATE: /(\d{2})-(\d{2})-(\d{2})$/,
  // AIX date format: "Tue Feb 10 10:12:06 THAIST 2026"
  AIX_DATE: /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+\w+\s+(\d{4})/,
  
  // Time patterns
  TIME_ONLY: /^(\d{2}):(\d{2}):(\d{2})$/,
  TIME_WITH_MS: /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/,
  
  // Backup log patterns
  BACKUP_START: /Starting backup at\s+(\d{2}-[A-Z]{3}-\d{2})/g,
  BACKUP_END: /Finished backup at\s+(\d{2}-[A-Z]{3}-\d{2})/g
};

export const THEME_COLORS_DEFAULT = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};
