// View: HeaderView.jsx
// Displays the header with title and refresh button
// Performance: Memoized component to prevent unnecessary re-renders

import { memo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../components/ThemeProvider';
import { Logo } from '../components/Logo';

const HeaderView = memo(({ onRefreshAll, isLoading }) => {
  const { isDark, toggleTheme } = useTheme();
  
  return (
    <div style={{
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '30px',
      padding: '20px',
      background: 'var(--bg)',
      borderBottom: '2px solid var(--border)',
      borderRadius: '8px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <Logo width={120} height={120} />
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          fontWeight: '800',
          color: 'var(--text)',
          letterSpacing: '-1px',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>Server Monitoring Dashboard</h1>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button 
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            background: 'var(--primary)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0, 82, 204, 0.2)'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'var(--primary-light)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.3)';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'var(--primary)';
            e.target.style.boxShadow = '0 2px 8px rgba(0, 82, 204, 0.2)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          {isDark ? 'Light' : 'Dark'}
        </button>

        <button 
          type="button"
          onClick={onRefreshAll}
          disabled={isLoading}
          style={{
            background: 'var(--primary)',
            border: '2px solid var(--primary)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: 'var(--text)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 82, 204, 0.2)',
            opacity: isLoading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.target.style.background = 'var(--primary-light)';
              e.target.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.3)';
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'var(--primary)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.2)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          {isLoading ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>
    </div>
  );
});

HeaderView.propTypes = {
  onRefreshAll: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired
};

export { HeaderView };

