import { useState, useEffect } from 'react';

// Utility to get CSS variable values from the current theme
export const getCSSVariable = (variableName) => {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
};

// Get theme-aware colors
export const getThemeColors = () => {
  return {
    primary: getCSSVariable('--primary'),
    primaryLight: getCSSVariable('--primary-light'),
    primaryDark: getCSSVariable('--primary-dark'),
    bg: getCSSVariable('--bg'),
    bgSecondary: getCSSVariable('--bg-secondary'),
    text: getCSSVariable('--text'),
    textSecondary: getCSSVariable('--text-secondary'),
    textTertiary: getCSSVariable('--text-tertiary'),
    border: getCSSVariable('--border'),
    divider: getCSSVariable('--divider'),
    success: getCSSVariable('--success'),
    warning: getCSSVariable('--warning'),
    error: getCSSVariable('--error'),
    info: getCSSVariable('--info'),
    gray: getCSSVariable('--gray'),
    grayLight: getCSSVariable('--gray-light'),
    grayDark: getCSSVariable('--gray-dark'),
  };
};

// Hook to use theme colors with automatic updates
export const useThemeColors = () => {
  const [colors, setColors] = useState(getThemeColors());

  useEffect(() => {
    const updateColors = () => {
      setColors(getThemeColors());
    };

    // Watch for class changes on body (dark-mode toggle)
    const observer = new MutationObserver(updateColors);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    // Initial update
    updateColors();

    return () => observer.disconnect();
  }, []);

  return colors;
};
