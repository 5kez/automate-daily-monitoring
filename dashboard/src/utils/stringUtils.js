/**
 * String and text manipulation utilities
 */

import { REGEX_PATTERNS } from './constants';

/**
 * Extract date from filename in format YYYY-MM-DD or AIX date format
 * @param {string} filename - Filename to extract date from
 * @returns {string|null} - Extracted date in YYYY-MM-DD format or null
 */
export const extractDateFromFilename = (filename) => {
  // Try ISO date format first (e.g., "df_2026-02-10_10-12-06.json")
  const isoMatch = String(filename).match(REGEX_PATTERNS.ISO_DATE);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  // Try AIX date format (e.g., "errpt_more_Tue Feb 10 10:12:06 THAIST 2026.json")
  const aixMatch = String(filename).match(REGEX_PATTERNS.AIX_DATE);
  if (aixMatch) {
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const year = aixMatch[7];
    const month = monthMap[aixMatch[2]];
    const day = String(aixMatch[3]).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
};

/**
 * Extract time from filename in format HH-MM-SS or from AIX date format
 * @param {string} filename - Filename to extract time from
 * @returns {string} - Formatted time HH:MM:SS or original filename
 */
export const extractTimeFromFilename = (filename) => {
  // Try AIX date format first (e.g., "errpt_more_Tue Feb 10 10:12:06 THAIST 2026.json")
  const aixMatch = String(filename).match(REGEX_PATTERNS.AIX_DATE);
  if (aixMatch) {
    return `${aixMatch[4]}:${aixMatch[5]}:${aixMatch[6]}`;
  }
  
  // Try standard format (e.g., "df_2026-02-10_10-12-06.json")
  const nameWithoutExt = String(filename).replace(/\.json$/, '');
  const match = nameWithoutExt.match(REGEX_PATTERNS.FILE_DATE);
  if (match) {
    return `${match[1]}:${match[2]}:${match[3]}`;
  }
  
  return filename;
};

/**
 * Safe get nested property with fallback
 * @param {object} obj - Object to get from
 * @param {string} path - Property path (e.g. 'a.b.c')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} - Property value or default
 */
export const getNestedProperty = (obj, path, defaultValue = null) => {
  if (!obj || !path) {
    return defaultValue;
  }
  
  const parts = String(path).split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return defaultValue;
    }
  }
  
  return current;
};

/**
 * Truncate string to max length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
export const truncateString = (str, maxLength = 50) => {
  if (!str || str.length <= maxLength) {
    return str;
  }
  return `${str.substring(0, maxLength - 3)}...`;
};

/**
 * Convert status string to display format
 * @param {string} status - Status string
 * @returns {string} - Formatted status
 */
export const formatStatus = (status) => {
  if (!status) {
    return 'N/A';
  }
  return String(status).toUpperCase();
};

/**
 * Extract both date and time from filename
 * @param {string} filename - Filename to extract from
 * @returns {string} - Formatted as 'YYYY-MM-DD HH:MM:SS'
 */
export const extractDateTime = (filename) => {
  const date = extractDateFromFilename(filename);
  const time = extractTimeFromFilename(filename);
  
  if (date && time && time !== filename) {
    return `${date} ${time}`;
  }
  return time || filename;
};

/**
 * Extract just the time portion from filename
 * Alias for extractTimeFromFilename for consistency
 * @param {string} filename - Filename to extract time from
 * @returns {string} - Formatted time HH:MM:SS or original filename
 */
export const extractTime = (filename) => extractTimeFromFilename(filename);

/**
 * Extract just the date portion from filename
 * Alias for extractDateFromFilename for consistency
 * @param {string} filename - Filename to extract date from
 * @returns {string|null} - Extracted date YYYY-MM-DD or null
 */
export const extractDate = (filename) => extractDateFromFilename(filename);
/**
 * Format timestamp from YYYY-MM-DD_HH-MM-SS to YYYY-MM-DD HH:MM:SS
 * @param {string} timestamp - Timestamp to format
 * @returns {string} - Formatted timestamp or original if invalid
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }
  // Replace underscore with space and dashes with colons in time part
  return timestamp.replace(/_/, ' ').replace(/(\d{2})-(\d{2})-(\d{2})$/, '$1:$2:$3');
};