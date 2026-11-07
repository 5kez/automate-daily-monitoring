import { useTheme } from '../components/ThemeProvider';

export const useThemeColors = () => {
  const { theme } = useTheme();
  
  return {
    success: theme.success,
    warning: '#f0883e',
    error: theme.error,
    info: theme.info,
    primary: theme.primary,
    primaryLight: theme.primaryLight,
    text: theme.text,
    textSecondary: theme.textSecondary,
    textTertiary: theme.textTertiary,
    border: theme.border,
    background: theme.background,
    backgroundSecondary: theme.backgroundSecondary,
    bg: theme.background,
    bgSecondary: theme.backgroundSecondary,
    card: theme.card,
    button: theme.button,
  };
};

export const getProgressColor = (percentage, theme) => {
  if (percentage >= 90) return theme.error;
  if (percentage >= 80) return '#f0883e';
  return theme.success;
};

export const getTooltipStyle = (theme) => ({
  background: theme.backgroundSecondary,
  border: `1px solid ${theme.border}`,
  borderRadius: '8px',
  padding: '10px 12px',
});

export const getChartGridStyle = (theme) => ({
  stroke: theme.border,
  strokeDasharray: '3 3',
});
