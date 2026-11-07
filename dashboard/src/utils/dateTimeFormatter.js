/**
 * Shared date/time formatting utilities
 * Used across multiple components (BackupView, ErrorReportView, etc)
 */

// Month mapping for date parsing
export const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

// Month number to name mapping for display
export const MONTH_NAMES = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
};

/**
 * Parse time string in multiple formats
 * Supported formats:
 * 1. "Wed Jan 28 01:30:00 THAIST 2026" (full weekday + month name)
 * 2. "28-JAN-26 01:32:00 THAIST" (compact with timezone)
 * 3. "2026-01-28 01:32:00" (ISO-like)
 * 4. "01:32:00" (time only)
 * 
 * @param {string} timeStr - Time string to parse
 * @returns {Date|null} - Parsed Date object or null if parsing fails
 */
export const parseTime = (timeStr) => {
  if (!timeStr) {
    return null;
  }

  const str = String(timeStr).trim();

  // Format 1: "Wed Jan 28 01:30:00 THAIST 2026" (full weekday + month name)
  const parts = str.split(/\s+/);
  if (parts.length >= 6) {
    const month = parts[1].toUpperCase();
    const day = parts[2];
    const timeStr = parts[3];
    const year = parts[parts.length - 1];

    const monthTest = /^[A-Z]{3}$/.test(month);
    const dayTest = /^\d{1,2}$/.test(day);
    const yearTest = /^\d{4}$/.test(year);
    const monthNum = MONTH_MAP[month];

    if (monthTest && dayTest && yearTest && monthNum !== undefined) {
      const timeParts = timeStr.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (timeParts) {
        const [, hour, min, sec] = timeParts;
        const date = new Date(parseInt(year), monthNum, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
  }

  // Format 2: "28-JAN-26 01:32:00 THAIST" (with timezone)
  let match = str.match(/(\d{2})-([A-Z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, min, sec] = match;
    const monthNum = MONTH_MAP[month];
    if (monthNum !== undefined) {
      const date = new Date(2000 + parseInt(year), monthNum, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Format 3: "2026-01-28 01:32:00" (ISO-like)
  match = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Format 4: "01:32:00" or "HH:MM:SS" (time only - assume same day)
  match = str.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, hour, min, sec] = match;
    const date = new Date(2026, 0, 28, parseInt(hour), parseInt(min), parseInt(sec));
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
};

/**
 * Format time display from "Wed Jan 28 01:30:00 THAIST 2026" to "2026-01-28 01:30:00"
 * @param {string} timeStr - Raw time string
 * @returns {string} - Formatted time string or 'N/A'
 */
export const formatTimeDisplay = (timeStr) => {
  if (!timeStr || timeStr === 'N/A') {
    return 'N/A';
  }

  const parts = String(timeStr).trim().split(/\s+/);
  if (parts.length >= 6) {
    const monthMap = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };

    const day = parts[2].padStart(2, '0');
    const month = monthMap[parts[1].toUpperCase()];
    const time = parts[3];
    const year = parts[parts.length - 1];

    if (month) {
      return `${year}-${month}-${day} ${time}`;
    }
  }

  return timeStr; // Return as-is if format doesn't match
};

/**
 * Format Loggap timestamp for display
 * Converts formats like:
 * - "2026-02-05_13-26-54" -> "Feb 5, 2026 13:26:54"
 * - "2026-02-05:06:40:04 +07:00" -> "Feb 5, 2026 06:40:04"
 * - "2026-02-05 06:39:56" -> "Feb 5, 2026 06:39:56"
 * @param {string} timestamp - Raw timestamp string
 * @returns {string} - Formatted timestamp or 'N/A'
 */
export const formatLoggapTimestamp = (timestamp) => {
  if (!timestamp || timestamp === 'N/A') {
    return 'N/A';
  }

  try {
    let dateStr = String(timestamp).trim();
    
    // Remove timezone suffix if present (e.g., "+07:00")
    dateStr = dateStr.replace(/\s*[+-]\d{2}:\d{2}\s*$/, '');
    
    // Replace underscore with space and colon with space for time separator
    // "2026-02-05_13-26-54" -> "2026-02-05 13-26-54"
    dateStr = dateStr.replace('_', ' ');
    
    // Match pattern: YYYY-MM-DD HH-MM-SS or YYYY-MM-DD HH:MM:SS or YYYY-MM-DD:HH:MM:SS
    let match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[:\s](\d{2})[:-](\d{2})[:-](\d{2})/);
    
    if (!match) {
      // Try simpler pattern: YYYY-MM-DD HH:MM:SS (without seconds)
      match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    }
    
    if (!match) {
      // Try pattern with colon separator: YYYY-MM-DD:HH:MM:SS
      match = dateStr.match(/(\d{4})-(\d{2})-(\d{2}):(\d{2}):(\d{2}):(\d{2})/);
    }
    
    if (match) {
      const [, year, month, day, hour, min, sec] = match;
      const monthName = MONTH_NAMES[month] || month;
      const dayNum = parseInt(day, 10);
      
      return `${monthName} ${dayNum}, ${year} ${hour}:${min}:${sec}`;
    }
    
    return timestamp; // Return as-is if no pattern matches
  } catch (e) {
    return timestamp;
  }
};

/**
 * Calculate duration between two time strings
 * @param {string} startTime - Start time string
 * @param {string} endTime - End time string
 * @returns {string} - Formatted duration (e.g., "1h 44m", "29m 20s", "45s") or 'N/A'
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime || startTime === 'N/A' || endTime === 'N/A') {
    return 'N/A';
  }

  try {
    const startDate = parseTime(startTime);
    const endDate = parseTime(endTime);

    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return 'N/A';
    }

    const diffMs = endDate - startDate;
    if (diffMs < 0) {
      return 'N/A';
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  } catch (e) {
    return 'N/A';
  }
};
