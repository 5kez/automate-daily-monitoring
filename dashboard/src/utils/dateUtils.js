/**
 * Utility functions for date manipulation and formatting
 */

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Parse file timestamp to get date and time components
 * Handles formats like "top_2026-01-20_10-23-50.json"
 * @param {string} fileName - The filename to parse
 * @returns {object} Object with date and time components
 */
export const parseFileTimestamp = (fileName) => {
  if (!fileName) {
    return { date: '', time: '', year: '', month: '', day: '', hour: '', minute: '', second: '' };
  }

  const nameWithoutExt = fileName.replace(/\.json$/, '');
  const match = nameWithoutExt.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);

  if (match) {
    return {
      date: `${match[1]}-${match[2]}-${match[3]}`,
      time: `${match[4]}:${match[5]}:${match[6]}`,
      year: match[1],
      month: match[2],
      day: match[3],
      hour: match[4],
      minute: match[5],
      second: match[6]
    };
  }

  return { date: '', time: '', year: '', month: '', day: '', hour: '', minute: '', second: '' };
};

/**
 * Format date for input field (YYYY-MM format for month pickers)
 * @param {Date|Object|string} date - JavaScript Date object, timestamp object from parseFileTimestamp, or string
 * @returns {string} Formatted date string (YYYY-MM)
 */
export const formatDateInput = (date) => {
  if (!date) return '';
  
  // Handle parseFileTimestamp object format
  if (typeof date === 'object' && date.year && date.month) {
    return `${date.year}-${date.month}`;
  }
  
  // Handle Date object
  if (date instanceof Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }
  
  // Handle string format (YYYY-MM-DD)
  if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}/)) {
    return date.slice(0, 7); // YYYY-MM
  }
  
  return '';
};

/**
 * Get calendar days for a given month
 * Returns array of date strings
 * @param {string} monthValue - Month value in YYYY-MM format
 * @returns {Array<string>} Array of dates in that month
 */
export const getCalendarDaysForMonth = (monthValue) => {
  if (!monthValue) return [];

  const [year, month] = monthValue.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month - 1, i);
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }

  return days;
};

/**
 * Get calendar days for current month
 * @returns {Array<string>} Array of dates in current month
 */
export const getCalendarDays = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth() + 1;
  const firstDay = new Date(yyyy, mm - 1, 1);
  const lastDay = new Date(yyyy, mm, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(yyyy, mm - 1, i);
    days.push(`${yyyy}-${String(mm).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }

  return days;
};
