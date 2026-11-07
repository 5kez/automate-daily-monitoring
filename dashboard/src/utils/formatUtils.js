/**
 * Utility functions for percentage-based progress colors and formatting
 */

/**
 * Get progress color based on percentage value
 * Used for CPU, memory, disk usage progress bars
 * @param {number} percentage - The percentage value (0-100)
 * @param {object} theme - Theme object with color properties
 * @param {object} colors - Color object with success, warning, error properties
 * @returns {string} Hex color value
 */
export const getProgressColor = (percentage, theme = null, colors = null) => {
  const value = parseFloat(percentage) || 0;

  // If colors object is provided, use it
  if (colors) {
    if (value >= 80) {
      return colors.error || colors.warning;
    }
    if (value >= 60) {
      return colors.warning;
    }
    return colors.success;
  }

  // If theme object is provided, use it
  if (theme) {
    if (value >= 80) {
      return theme.error || theme.warning;
    }
    if (value >= 60) {
      return theme.warning;
    }
    return theme.success;
  }

  // Default color values
  if (value >= 80) {
    return '#e74c3c'; // red/error
  }
  if (value >= 60) {
    return '#f39c12'; // orange/warning
  }
  return '#27ae60'; // green/success
};

/**
 * Format percentage value for display
 * @param {number} value - The value to format
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value) => {
  const num = parseFloat(value) || 0;
  return `${num.toFixed(1)}%`;
};

/**
 * Format delta percentage change (positive/negative)
 * @param {number} value - The value to format
 * @returns {string} Formatted delta string with +/- sign
 */
export const formatDeltaPercent = (value) => {
  const num = parseFloat(value) || 0;
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

/**
 * Format size value for display
 * @param {number|string} value - The value to format
 * @param {string} unit - The unit to append (MB, GB, KB, etc)
 * @returns {string} Formatted size string
 */
export const formatSize = (value, unit = 'GB') => {
  const num = parseFloat(value) || 0;
  return `${num.toFixed(2)} ${unit}`;
};

/**
 * Format disk usage value
 * @param {number|string} value - The value in MB
 * @returns {string} Formatted disk value
 */
export const formatDfSize = (value) => {
  const num = parseFloat(value) || 0;
  if (num >= 1024) {
    return `${(num / 1024).toFixed(2)} GB`;
  }
  return `${num.toFixed(2)} MB`;
};

/**
 * Get delta usage value (difference between used now and previous)
 * @param {object} item - The item with 'used' property
 * @param {object} compareItem - The compare item with 'used' property
 * @returns {number} Delta value
 */
export const getDeltaUse = (item, compareItem) => {
  if (!item || !compareItem) return 0;
  const itemUsed = parseFloat(item.used) || 0;
  const compareUsed = parseFloat(compareItem.used) || 0;
  return itemUsed - compareUsed;
};
