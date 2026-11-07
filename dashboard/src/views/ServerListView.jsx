// View: ServerListView.jsx
// Displays server selection buttons
// Performance: Memoized component to prevent unnecessary re-renders

import { memo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../components/ThemeProvider';

const ServerListViewContent = memo(({ servers, selectedServer, onSelectServer, onServerRefresh }) => {
  const { theme } = useTheme();

  return (
    <div style={{marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'}}>
      {servers.map(server => (
        <button
          key={server}
          onClick={() => onSelectServer(server)}
          style={{
            background: selectedServer === server 
              ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryLight} 100%)`
              : theme.backgroundSecondary,
            padding: '10px 16px',
            borderRadius: '8px',
            border: selectedServer === server 
              ? `2px solid ${theme.primary}` 
              : `2px solid ${theme.border}`,
            color: selectedServer === server ? theme.text : theme.text,
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            fontSize: '13px',
            boxShadow: selectedServer === server 
              ? `0 4px 12px ${theme.primary}33`
              : `0 2px 8px ${theme.card.shadow}`
          }}
          onMouseEnter={(e) => {
            if (selectedServer === server) {
              e.target.style.background = `linear-gradient(135deg, ${theme.primaryLight} 0%, ${theme.primaryLight} 100%)`;
              e.target.style.boxShadow = `0 6px 16px ${theme.primary}44`;
              e.target.style.transform = 'translateY(-2px)';
            } else {
              e.target.style.borderColor = theme.primary;
              e.target.style.boxShadow = `0 4px 12px ${theme.primary}22`;
              e.target.style.transform = 'translateY(-2px)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedServer === server) {
              e.target.style.background = `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryLight} 100%)`;
              e.target.style.boxShadow = `0 4px 12px ${theme.primary}33`;
            } else {
              e.target.style.borderColor = theme.border;
              e.target.style.boxShadow = `0 2px 8px ${theme.card.shadow}`;
            }
            e.target.style.transform = 'translateY(0)';
          }}
        >
          {server}
        </button>
      ))}
    </div>
  );
});

const ServerListView = memo(ServerListViewContent);

ServerListView.propTypes = {
  servers: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedServer: PropTypes.string.isRequired,
  onSelectServer: PropTypes.func.isRequired,
  onServerRefresh: PropTypes.func.isRequired
};

export { ServerListView };

