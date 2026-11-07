// View: HistoryView.jsx
// Displays history selector for viewing past data snapshots
// Performance: Memoized component to prevent unnecessary re-renders

import { memo } from 'react';
import PropTypes from 'prop-types';

const HistoryView = memo(({ historyData, selectedIndex, onSelectIndex, currentData }) => {

  if (!historyData || historyData.length === 0) {
    return null;
  }

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <h3 style={{marginTop: 0, marginBottom: '15px', fontSize: '16px'}}>Data History</h3>
      
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '10px'
      }}>
        {historyData.map((data, index) => (
          <button
            key={index}
            onClick={() => onSelectIndex(index)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: selectedIndex === index ? '#238636' : '#30363d',
              color: 'white',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '12px',
              fontWeight: selectedIndex === index ? '600' : '400',
              transition: 'background 0.2s'
            }}
          >
            {data.timestamp || `Entry ${index + 1}`}
          </button>
        ))}
      </div>

      {currentData && (
        <div style={{
          marginTop: '12px',
          padding: '10px',
          background: '#161b22',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#8b949e'
        }}>
          Current snapshot: {currentData.timestamp || new Date().toLocaleString()}
        </div>
      )}
    </div>
  );
});

HistoryView.propTypes = {
  historyData: PropTypes.arrayOf(PropTypes.object),
  selectedIndex: PropTypes.number,
  onSelectIndex: PropTypes.func.isRequired,
  currentData: PropTypes.object
};

export { HistoryView };
