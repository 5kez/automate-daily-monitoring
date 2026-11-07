/**
 * Font configuration and utilities for consistent typography across the application
 */

/**
 * Standard font family for the application
 * Using system fonts for optimal performance and consistency
 */
export const FONT_FAMILY = {
  // Main system font stack (used for most UI elements)
  SYSTEM: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  
  // Monospace font for code, identifiers, values (numbers, IDs, etc)
  MONO: '"Monaco", "Menlo", "Ubuntu Mono", "Consolas", "source-code-pro", monospace',
  
  // Fallback system font
  FALLBACK: 'system-ui, -apple-system, sans-serif'
};

/**
 * Font size constants for consistent typography
 */
export const FONT_SIZE = {
  XS: '11px',
  SM: '12px',
  BASE: '13px',
  MD: '14px',
  LG: '15px',
  XL: '16px',
  '2XL': '18px',
  '3XL': '20px'
};

/**
 * Font weight constants
 */
export const FONT_WEIGHT = {
  LIGHT: 300,
  NORMAL: 400,
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 700
};

/**
 * Get font family for a specific component type
 * @param {string} type - Component type: 'system', 'mono', or 'fallback'
 * @returns {string} Font family value
 */
export const getFontFamily = (type = 'system') => {
  return FONT_FAMILY[type.toUpperCase()] || FONT_FAMILY.SYSTEM;
};

/**
 * Style object for monospace font (for identifiers, values, IDs)
 */
export const monoSpaceStyle = {
  fontFamily: FONT_FAMILY.MONO
};

/**
 * Style object for system font (default)
 */
export const systemFontStyle = {
  fontFamily: FONT_FAMILY.SYSTEM
};

/**
 * Create font style object with size and weight
 * @param {string|number} size - Font size (px or use FONT_SIZE constants)
 * @param {string|number} weight - Font weight (use FONT_WEIGHT constants)
 * @param {string} family - Font family type ('system', 'mono', 'fallback')
 * @returns {object} Style object
 */
export const createFontStyle = (size = FONT_SIZE.BASE, weight = FONT_WEIGHT.NORMAL, family = 'system') => {
  return {
    fontSize: typeof size === 'number' ? `${size}px` : size,
    fontWeight: weight,
    fontFamily: getFontFamily(family)
  };
};
