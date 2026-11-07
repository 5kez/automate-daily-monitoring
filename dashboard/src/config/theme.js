// Theme configuration matching the company logo colors
// Logo colors: Blue (#0052CC or #0066FF), Gray (#808080), Black (#000000)

export const themes = {
  light: {
    // Primary colors from the company logo
    primary: '#0052CC',      // Blue
    primaryLight: '#0066FF', // Lighter blue
    primaryDark: '#003D99',  // Darker blue
    
    // Secondary colors
    gray: '#808080',         // Gray from logo
    grayLight: '#E8E8E8',    // Light gray
    grayDark: '#404040',     // Dark gray
    
    // Background and text
    background: '#FFFFFF',
    backgroundSecondary: '#F6F8FA',
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    
    // Borders and dividers
    border: '#D0D7DE',
    divider: '#E1E4E8',
    
    // Status colors
    success: '#0052CC',
    warning: '#D29922',
    error: '#DA3633',
    info: '#0052CC',
    
    // Component specific
    button: {
      background: '#0052CC',
      backgroundHover: '#0048A8',
      text: '#FFFFFF',
    },
    input: {
      background: '#FFFFFF',
      border: '#D0D7DE',
      text: '#000000',
    },
    card: {
      background: '#FFFFFF',
      border: '#D0D7DE',
      shadow: 'rgba(0, 0, 0, 0.1)',
    },
    header: {
      background: '#FFFFFF',
      border: '#D0D7DE',
      text: '#000000',
    },
  },
  dark: {
    // Primary colors from the company logo (adjusted for dark mode)
    primary: '#0066FF',      // Lighter blue for dark background
    primaryLight: '#4D94FF', // Even lighter
    primaryDark: '#0052CC',  // Darker blue
    
    // Secondary colors
    gray: '#A0A0A0',         // Gray from logo (lighter for dark)
    grayLight: '#404040',    // Light gray
    grayDark: '#E0E0E0',     // Dark gray
    
    // Background and text
    background: '#0d1117',
    backgroundSecondary: '#161b22',
    text: '#C9D1D9',
    textSecondary: '#8B949E',
    textTertiary: '#6E7681',
    
    // Borders and dividers
    border: '#30363D',
    divider: '#21262D',
    
    // Status colors
    success: '#0066FF',
    warning: '#D29922',
    error: '#F85149',
    info: '#58A6FF',
    
    // Component specific
    button: {
      background: '#0052CC',
      backgroundHover: '#0066FF',
      text: '#FFFFFF',
    },
    input: {
      background: '#0d1117',
      border: '#30363D',
      text: '#C9D1D9',
    },
    card: {
      background: '#161b22',
      border: '#30363D',
      shadow: 'rgba(0, 0, 0, 0.3)',
    },
    header: {
      background: '#0d1117',
      border: '#30363D',
      text: '#C9D1D9',
    },
  },
};

export const getTheme = (isDark = false) => {
  return isDark ? themes.dark : themes.light;
};

export const createThemeStyles = (isDark = false) => {
  const theme = getTheme(isDark);
  return {
    '--primary': theme.primary,
    '--primary-light': theme.primaryLight,
    '--primary-dark': theme.primaryDark,
    '--gray': theme.gray,
    '--gray-light': theme.grayLight,
    '--gray-dark': theme.grayDark,
    '--bg': theme.background,
    '--bg-secondary': theme.backgroundSecondary,
    '--text': theme.text,
    '--text-secondary': theme.textSecondary,
    '--text-tertiary': theme.textTertiary,
    '--border': theme.border,
    '--divider': theme.divider,
    '--success': theme.success,
    '--warning': theme.warning,
    '--error': theme.error,
    '--info': theme.info,
  };
};
