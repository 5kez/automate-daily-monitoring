import { memo, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useToast } from '../components/Toast';
import { AIXProcessesView } from './AIXProcessesView';

// View: AIXProcessesPage.jsx
// Dedicated page for AIX Processes display
// Performance: Memoized component to prevent unnecessary re-renders

const AIXProcessesPage = memo(({ 
  topFiles, 
  selectedTopFile, 
  onSelectTopFile, 
  selectedTopFileData, 
  isLoadingFileData,
  controller,
  systemName
}) => {
  const toast = useToast();
  const [sortConfig, setSortConfig] = useState({});

  const handleSort = (key) => {
    setSortConfig(prevConfig => {
      const newConfig = { ...prevConfig };
      if (newConfig.key === key) {
        newConfig.order = newConfig.order === 'asc' ? 'desc' : 'asc';
      } else {
        newConfig.key = key;
        newConfig.order = 'asc';
      }
      return newConfig;
    });
  };

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '30px'
    }}>
      <div style={{
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid var(--border)'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: '700',
          color: 'var(--text)'
        }}>
          AIX Running Processes
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          Detailed view of all running processes on {systemName}
        </p>
      </div>

      <AIXProcessesView
        processes={selectedTopFileData?.parsed_data?.processes || []}
        sortConfig={sortConfig}
        onSort={handleSort}
        controller={controller}
        topFiles={topFiles}
        selectedTopFile={selectedTopFile}
        onSelectTopFile={onSelectTopFile}
        selectedTopFileData={selectedTopFileData}
        isLoadingFileData={isLoadingFileData}
      />
    </div>
  );
});

AIXProcessesPage.propTypes = {
  topFiles: PropTypes.array,
  selectedTopFile: PropTypes.string,
  onSelectTopFile: PropTypes.func.isRequired,
  selectedTopFileData: PropTypes.object,
  isLoadingFileData: PropTypes.bool,
  controller: PropTypes.object,
  systemName: PropTypes.string
};

AIXProcessesPage.defaultProps = {
  topFiles: [],
  isLoadingFileData: false
};

export { AIXProcessesPage };
