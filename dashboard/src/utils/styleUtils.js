/**
 * Color and styling utilities
 */

/**
 * Get status color based on status value
 * @param {string} status - Status value (success, failed, etc)
 * @param {object} theme - Theme object with color properties
 * @returns {string} - Color value
 */
export const getStatusColor = (status, theme) => {
  const statusLower = String(status).toLowerCase();
  
  if (statusLower === 'success' || statusLower === 'complete') {
    return theme.success || '#10b981';
  }
  if (statusLower === 'failed' || statusLower === 'error') {
    return theme.error || '#ef4444';
  }
  if (statusLower === 'incomplete' || statusLower === 'warning') {
    return theme.warning || '#f59e0b';
  }
  
  return theme.info || '#3b82f6';
};

/**
 * Get status badge style
 * @param {string} status - Status value
 * @param {object} theme - Theme object
 * @returns {object} - Style object for badge
 */
export const getStatusBadgeStyle = (status, theme) => ({
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '12px',
  fontWeight: '600',
  color: getStatusColor(status, theme),
  textTransform: 'uppercase'
});

/**
 * Create consistent box style
 * @param {object} theme - Theme object
 * @param {object} overrides - Override properties
 * @returns {object} - Style object
 */
export const createBoxStyle = (theme, overrides = {}) => ({
  background: theme.background || '#fff',
  border: `1px solid ${theme.border || '#e5e7eb'}`,
  borderRadius: '12px',
  padding: '24px',
  ...overrides
});

/**
 * Create header style
 * @param {object} theme - Theme object
 * @returns {object} - Style object
 */
export const createHeaderStyle = (theme) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '16px',
  background: theme.cardBg || '#f9fafb',
  borderBottom: `1px solid ${theme.border || '#e5e7eb'}`
});

/**
 * Create text style
 * @param {object} theme - Theme object
 * @param {string} variant - 'primary', 'secondary', 'muted'
 * @returns {object} - Style object
 */
export const createTextStyle = (theme, variant = 'primary') => {
  const styles = {
    primary: {
      color: theme.text || '#1f2937',
      fontSize: '14px'
    },
    secondary: {
      color: theme.textSecondary || '#6b7280',
      fontSize: '13px'
    },
    muted: {
      color: theme.textSecondary || '#9ca3af',
      fontSize: '12px'
    }
  };
  
  return styles[variant] || styles.primary;
};
