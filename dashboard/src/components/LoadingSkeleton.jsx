import React from 'react';
import PropTypes from 'prop-types';
import { useThemeColors } from '../hooks/useThemeColors';

// Loading skeleton component for better UX
// Shows animated placeholder while content is loading

export const TableSkeleton = ({ rows = 5, columns = 5 }) => {
  const colors = useThemeColors();
  
  // Determine colors based on theme
  const skeletonBg = colors.bgSecondary || '#f6f8fa';
  const shimmerDark = colors.bg || '#ffffff';
  const borderColor = colors.border || '#d0d7de';
  
  // Create gradient that works with theme
  const shimmerGradient = `linear-gradient(90deg, ${shimmerDark} 0%, ${skeletonBg} 50%, ${shimmerDark} 100%)`;
  
  return (
    <div style={{
      width: '100%',
      animation: 'pulse 1.5s ease-in-out infinite',
      opacity: 0.6
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: `1px solid ${borderColor}`,
        background: skeletonBg
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '16px',
              background: shimmerGradient,
              backgroundSize: '1000px 100%',
              animation: 'shimmer 2s infinite linear',
              borderRadius: '4px'
            }}
          />
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'flex',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: `1px solid ${borderColor}`
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                flex: 1,
                height: '14px',
                background: shimmerGradient,
                backgroundSize: '1000px 100%',
                animation: 'shimmer 2s infinite linear',
                borderRadius: '4px',
                animationDelay: `${(rowIndex * 0.05 + colIndex * 0.02)}s`
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton = () => {
  const colors = useThemeColors();
  
  // Determine colors based on theme
  const skeletonBg = colors.bgSecondary || '#f6f8fa';
  const shimmerDark = colors.bg || '#ffffff';
  const borderColor = colors.border || '#d0d7de';
  
  // Create gradient that works with theme
  const shimmerGradient = `linear-gradient(90deg, ${shimmerDark} 0%, ${skeletonBg} 50%, ${shimmerDark} 100%)`;
  const shimmerVertical = `linear-gradient(180deg, ${skeletonBg} 0%, ${borderColor} 100%)`;
  
  return (
    <div style={{
      width: '100%',
      height: '280px',
      background: colors.bg || '#ffffff',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>

      {/* Chart bars */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        paddingBottom: '8px'
      }}>
        {Array.from({ length: 12 }).map((_, i) => {
          const height = Math.random() * 60 + 30; // Random height between 30% and 90%
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${height}%`,
                background: shimmerVertical,
                borderRadius: '4px 4px 0 0',
                animation: 'shimmer 2s infinite linear',
                backgroundSize: '1000px 100%',
                animationDelay: `${i * 0.1}s`
              }}
            />
          );
        })}
      </div>

      {/* X-axis labels */}
      <div style={{
        display: 'flex',
        gap: '8px'
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '12px',
              background: shimmerGradient,
              backgroundSize: '1000px 100%',
              animation: 'shimmer 2s infinite linear',
              borderRadius: '4px',
              animationDelay: `${i * 0.05}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton = () => {
  const colors = useThemeColors();
  
  // Determine colors based on theme
  const skeletonBg = colors.bgSecondary || '#f6f8fa';
  const shimmerDark = colors.bg || '#ffffff';
  const borderColor = colors.border || '#d0d7de';
  
  // Create gradient that works with theme
  const shimmerGradient = `linear-gradient(90deg, ${skeletonBg} 0%, ${borderColor} 50%, ${skeletonBg} 100%)`;
  
  return (
    <div style={{
      background: colors.bg || '#ffffff',
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>

      {/* Title */}
      <div
        style={{
          height: '20px',
          width: '60%',
          background: shimmerGradient,
          backgroundSize: '1000px 100%',
          animation: 'shimmer 2s infinite linear',
          borderRadius: '4px'
        }}
      />

      {/* Content lines */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '14px',
            width: `${90 - i * 15}%`,
            background: shimmerGradient,
            backgroundSize: '1000px 100%',
            animation: 'shimmer 2s infinite linear',
            borderRadius: '4px',
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );
};

TableSkeleton.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number
};

export default { TableSkeleton, ChartSkeleton, CardSkeleton };
