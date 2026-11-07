/**
 * Data extraction utilities for parsing logs and structured data
 */

import { DEFAULT_VALUES, REGEX_PATTERNS } from './constants';

/**
 * Extract backup times from RMAN logs
 * @param {string} logsText - Raw log text
 * @param {object} patterns - Custom regex patterns for start/end
 * @returns {object} - { startTime, endTime }
 */
export const extractBackupTimesFromLogs = (logsText, patterns = REGEX_PATTERNS) => {
  if (!logsText || typeof logsText !== 'string') {
    return { startTime: DEFAULT_VALUES.NOT_AVAILABLE, endTime: DEFAULT_VALUES.NOT_AVAILABLE };
  }

  let startTime = DEFAULT_VALUES.NOT_AVAILABLE;
  let endTime = DEFAULT_VALUES.NOT_AVAILABLE;

  const startMatches = logsText.match(patterns.BACKUP_START);
  const endMatches = logsText.match(patterns.BACKUP_END);

  if (startMatches && startMatches.length > 0) {
    const lastStart = startMatches[startMatches.length - 1];
    const dateMatch = lastStart.match(patterns.COMPACT_DATE);
    if (dateMatch) {
      startTime = dateMatch[0];
    }
  }

  if (endMatches && endMatches.length > 0) {
    const lastEnd = endMatches[endMatches.length - 1];
    const dateMatch = lastEnd.match(patterns.COMPACT_DATE);
    if (dateMatch) {
      endTime = dateMatch[0];
    }
  }

  return { startTime, endTime };
};

/**
 * Extract status from data with fallback support
 * @param {object} data - Data object
 * @param {array} paths - Paths to try in order (e.g. ['backup_summary.status', 'summary.status'])
 * @param {string} defaultStatus - Default status
 * @returns {string} - Extracted status
 */
export const extractStatus = (data, paths = [], defaultStatus = 'Success') => {
  if (!data) return defaultStatus;

  for (const path of paths) {
    const value = getValueByPath(data, path);
    if (value) return value;
  }

  return defaultStatus;
};

/**
 * Extract times from data with fallback support
 * @param {object} data - Data object
 * @param {array} startPaths - Paths to try for start time
 * @param {array} endPaths - Paths to try for end time
 * @returns {object} - { startTime, endTime }
 */
export const extractTimesFromData = (
  data,
  startPaths = [],
  endPaths = []
) => {
  if (!data) {
    return {
      startTime: DEFAULT_VALUES.NOT_AVAILABLE,
      endTime: DEFAULT_VALUES.NOT_AVAILABLE
    };
  }

  let startTime = DEFAULT_VALUES.NOT_AVAILABLE;
  let endTime = DEFAULT_VALUES.NOT_AVAILABLE;

  for (const path of startPaths) {
    const value = getValueByPath(data, path);
    if (value && value !== DEFAULT_VALUES.NOT_AVAILABLE) {
      startTime = value;
      break;
    }
  }

  for (const path of endPaths) {
    const value = getValueByPath(data, path);
    if (value && value !== DEFAULT_VALUES.NOT_AVAILABLE) {
      endTime = value;
      break;
    }
  }

  return { startTime, endTime };
};

/**
 * Get value by dot-notation path
 * @param {object} obj - Object to get from
 * @param {string} path - Dot-notation path
 * @returns {*} - Value or undefined
 */
const getValueByPath = (obj, path) => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Extract hostname from various data structures
 * @param {object} data - Data object
 * @returns {string} - Hostname or 'N/A'
 */
export const extractHostname = (data) => {
  if (!data) return DEFAULT_VALUES.NOT_AVAILABLE;

  return (
    data?.parsed_data?.system?.hostname ||
    data?.system?.hostname ||
    data?.hostname ||
    DEFAULT_VALUES.NOT_AVAILABLE
  );
};
