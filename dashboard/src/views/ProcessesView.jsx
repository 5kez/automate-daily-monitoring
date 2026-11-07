import React from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';
import { useToast } from '../components/Toast';
import { useThemeColors } from '../utils/theme';
import { extractDateFromFilename, extractTime } from '../utils/stringUtils';

// View: ProcessesView.jsx
// Displays list of running processes with sorting and file selection
// Performance: Memoized component to prevent unnecessary re-renders

// Style to hide scrollbars
const hideScrollbarStyle = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

// Add style to document
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = hideScrollbarStyle;
  document.head.appendChild(style);
}

const ProcessesView = React.memo(({ processes, sortConfig, onSort, controller, topFiles, selectedTopFile, onSelectTopFile, selectedTopFileData, isLoadingFileData }) => {
  const toast = useToast();
  const colors = useThemeColors();

  // Use selected file data if available, otherwise use default processes
  const displayProcesses = selectedTopFileData?.parsed_top?.processes || selectedTopFileData?.processes || processes;
  const [displayLimit, setDisplayLimit] = React.useState(10);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);

  // Detect data format: ERP-AIX format (has 'owner' field) vs AIX/Linux format (has 'user' field)
  const isERPFormat = displayProcesses && displayProcesses.length > 0 && 
    (displayProcesses[0]?.owner !== undefined || displayProcesses[0]?.cpu_pct !== undefined);

  // Group files by date
  const filesByDate = React.useMemo(() => {
    const grouped = {};
    topFiles?.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) {grouped[date] = [];}
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [topFiles]);

  // Get all unique dates sorted in descending order
  const availableDates = React.useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);

  // State for date selection - initialize from localStorage if available
  const [selectedDate, setSelectedDate] = React.useState(null);

  // State for calendar viewing month (separate from selected date)
  const [calendarMonth, setCalendarMonth] = React.useState(null);
  
  // Track if initialization is done and available dates
  const isInitializedRef = React.useRef(false);
  const prevAvailableDatesRef = React.useRef(null);

  // Initialize selected date on first render only
  React.useEffect(() => {
    // Only initialize once - never again
    if (isInitializedRef.current) {
      return;
    }

    if (!availableDates || availableDates.length === 0) {
      return;
    }
    
    isInitializedRef.current = true;
    prevAvailableDatesRef.current = availableDates;
    
    // Always select the most recent date (first in sorted array) instead of localStorage
    // This ensures the latest data is always shown
    setSelectedDate(availableDates[0]);
    setCalendarMonth(availableDates[0]);
  }, [availableDates]);

  // When availableDates actually changes (not just reference), validate selected date
  React.useEffect(() => {
    if (!isInitializedRef.current) {
      return; // Not initialized yet
    }

    if (!availableDates || availableDates.length === 0) {
      return;
    }

    // Check if availableDates array content actually changed
    const datesChanged = !prevAvailableDatesRef.current || 
      availableDates.length !== prevAvailableDatesRef.current.length ||
      !availableDates.every(date => prevAvailableDatesRef.current.includes(date));

    if (datesChanged) {
      prevAvailableDatesRef.current = availableDates;
      
      // Only reset if selected date no longer exists
      if (selectedDate && !availableDates.includes(selectedDate)) {
        const newDate = availableDates[0];
        setSelectedDate(newDate);
        setCalendarMonth(newDate);
        try {
          localStorage.setItem('processesSelectedDate', newDate);
        } catch (e) {
          // localStorage not available
        }
      }
    }
  }, [availableDates, selectedDate]);
  
  // Save selected date to localStorage when it changes
  React.useEffect(() => {
    if (selectedDate) {
      try {
        localStorage.setItem('processesSelectedDate', selectedDate);
      } catch (e) {
        // localStorage not available
      }
    }
  }, [selectedDate]);

  // Auto-select latest file when selected date changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!selectedDate || !filesByDate[selectedDate]) {
      return;
    }
    
    const filesForDate = filesByDate[selectedDate];
    if (filesForDate.length > 0) {
      // Auto-select the latest time file for this date
      const latestFile = filesForDate.sort().reverse()[0];
      // Only call if different to avoid unnecessary updates
      if (selectedTopFile !== latestFile) {
        onSelectTopFile(latestFile);
      }
    }
  }, [selectedDate, filesByDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // State for showing calendar
  const [showCalendar, setShowCalendar] = React.useState(false);

  // State for showing file dropdown
  const [showFileDropdown, setShowFileDropdown] = React.useState(false);

  // State for showing display limit dropdown
  const [showLimitDropdown, setShowLimitDropdown] = React.useState(false);

  // Get current month dates
  const getCalendarDays = React.useCallback(() => {
    if (!calendarMonth) {
      return [];
    }
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    const days = [];
    
    // Add empty cells for days before month starts
    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    // Add days of month
    while (date.getMonth() === parseInt(month) - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    
    return days;
  }, [calendarMonth]);

  const calendarDays = React.useMemo(() => getCalendarDays(), [getCalendarDays]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  const previousMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month) - 2, 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setCalendarMonth(newDate);
  };

  const nextMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month), 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setCalendarMonth(newDate);
  };

  // Move all hooks before early return to maintain hook order
  const selectedServerName = controller?.model?.getSelectedServer?.() || 'DB-01';

  const sortedProcesses = React.useMemo(() => {
    if (!displayProcesses || displayProcesses.length === 0) {return [];}
    return controller.getSortedData(displayProcesses, 'processes', sortConfig);
  }, [displayProcesses, sortConfig, controller]);

  // Optimize: Only slice the data we need to render
  const displayedProcesses = React.useMemo(() => sortedProcesses.slice(0, displayLimit), [sortedProcesses, displayLimit]);

  if (isLoadingFileData) {
    return (
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '40px 20px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div className="spinning" style={{ fontSize: '32px', color: colors.info, marginBottom: '16px' }}>⟳</div>
        <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: colors.text}}>Loading data for this server...</h2>
        <p style={{margin: 0, color: colors.textSecondary}}>Fetching latest stats, processes, disks, and tablespace.</p>
      </div>
    );
  }

  // Don't check for empty displayProcesses here - let App.jsx handle unified loading state
  
  const downloadAsJSON = async () => {
    const fileToDownload = selectedTopFile || topFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }
    
    try {
      const data = await downloadFile(selectedServerName, 'top', fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || 'top.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('File downloaded successfully');
      } else {
        toast.error('Failed to download file');
      }
    } catch (error) {
      toast.error(`Download failed: ${  error.message}`);
    } finally {
      setShowDownloadDropdown(false);
    }
  };

  const downloadAsRAW = async () => {
    const fileToDownload = selectedTopFile || topFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || 'top.txt';
    try {
      const data = await downloadFile(selectedServerName, 'top', fileIdForRaw, 'raw');
      if (data) {
        const blob = new Blob([data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Raw file downloaded successfully');
      } else {
        toast.error('Failed to download raw file');
      }
    } catch (error) {
      toast.error(`Download failed: ${  error.message}`);
    } finally {
      setShowDownloadDropdown(false);
    }
  };
  
  const SortHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.processes.key === sortKey;
    const arrow = isActive ? (sortConfig.processes.order === 'asc' ? ' ▲' : ' ▼') : '';
    
    return (
      <th
        onClick={() => onSort('processes', sortKey)}
        style={{
          padding: '14px 16px',
          textAlign: 'left',
          cursor: 'pointer',
          background: colors.bg,
          fontWeight: '700',
          userSelect: 'none',
          borderBottom: `2px solid ${colors.border}`,
          fontSize: '15px',
          color: isActive ? colors.info : colors.text,
          transition: 'color 0.2s'
        }}
      >
        {label}{arrow}
      </th>
    );
  };
  
  SortHeader.propTypes = {
    label: PropTypes.string.isRequired,
    sortKey: PropTypes.string.isRequired
  };

  if (isLoadingFileData) {
    return (
      <div style={{
        textAlign: 'center',
        color: colors.text,
        padding: '40px 20px',
        marginBottom: '20px'
      }}>
        <div className="spinning" style={{ fontSize: '32px', color: colors.info, marginBottom: '16px' }}>⟳</div>
        <h2 style={{marginTop: 0, marginBottom: '20px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px'}}>Running Processes (Top)</h2>
        <p style={{margin: 0, color: colors.textSecondary}}>Loading process data...</p>
      </div>
    );
  }

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      overflowX: 'auto'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
        <h2 style={{marginTop: 0, marginBottom: 0, fontSize: '24px', color: colors.text, fontWeight: '700', letterSpacing: '-0.5px'}}>Running Processes (Top)</h2>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
          {/* Limit selector */}
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
            <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Show:</label>
            <div style={{position: 'relative'}}>
              <button
                onClick={() => {
                  setShowLimitDropdown(!showLimitDropdown);
                  if (!showLimitDropdown) {
                    setShowCalendar(false);
                    setShowFileDropdown(false);
                    setShowDownloadDropdown(false);
                  }
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: `1px solid ${colors.border}`,
                  background: colors.bg,
                  color: colors.text,
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  minWidth: '50px'
                }}
              >
                <span>{displayLimit}</span>
                <span style={{
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: showLimitDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  <FaChevronDown style={{color: colors.info}} />
                </span>
              </button>

              {showLimitDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  zIndex: 1000,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  minWidth: '70px'
                }}>
                  {[5, 10, 20].concat(displayProcesses?.length > 20 ? [displayProcesses.length] : []).map((limitValue) => (
                    <button
                      key={limitValue}
                      onClick={() => {
                        setDisplayLimit(limitValue);
                        setShowLimitDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: displayLimit === limitValue ? colors.border : 'transparent',
                        color: colors.text,
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'background 0.2s ease',
                        fontWeight: displayLimit === limitValue ? '600' : '400'
                      }}
                      onMouseEnter={(e) => {
                        if (displayLimit !== limitValue) {
                          e.currentTarget.style.background = colors.bgSecondary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (displayLimit !== limitValue) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {limitValue === displayProcesses?.length ? 'All' : limitValue}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {topFiles && topFiles.length > 0 && (
            <>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Date:</label>
                <div style={{position: 'relative', flex: 1}}>
                  <button
                    onClick={() => {
                      setShowCalendar(!showCalendar);
                      if (!showCalendar && selectedDate) {
                        setCalendarMonth(selectedDate);
                        setShowLimitDropdown(false);
                        setShowFileDropdown(false);
                        setShowDownloadDropdown(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bg,
                      color: colors.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{selectedDate || 'Select date'}</span>
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: showCalendar ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showCalendar && calendarMonth && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '12px',
                      minWidth: '250px',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                    }}>
                      {/* Month Navigation */}
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                        <button onClick={previousMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}>◀</button>
                        <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{currentMonth}/{currentYear}</span>
                        <button onClick={nextMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}>▶</button>
                      </div>
                      
                      {/* Weekday Headers */}
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                          <div key={day} style={{textAlign: 'center', fontSize: '11px', color: colors.text, fontWeight: '600'}}>
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Days */}
                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px'}}>
                        {calendarDays.map((day, idx) => {
                          if (!day) {
                            return <div key={`empty-${idx}`} />;
                          }
                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                          const hasFiles = availableDates.includes(dateStr);
                          const isSelected = selectedDate === dateStr;
                          
                          return (
                            <button
                              key={dateStr}
                              onClick={() => {
                                if (hasFiles) {
                                  setSelectedDate(dateStr);
                                  setShowCalendar(false);
                                  // Effect will auto-select latest file for this date
                                }
                              }}
                              style={{
                                padding: '6px',
                                fontSize: '11px',
                                border: isSelected ? `2px solid ${colors.info}` : 'none',
                                background: isSelected ? colors.bgSecondary : hasFiles ? colors.bg : 'transparent',
                                color: hasFiles ? colors.text : colors.textTertiary,
                                cursor: hasFiles ? 'pointer' : 'default',
                                borderRadius: '4px',
                                fontWeight: isSelected ? '700' : '500',
                                opacity: 1
                              }}
                              disabled={!hasFiles}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Time:</label>
                <div style={{position: 'relative', flex: 1}}>
                  <button
                    onClick={() => {
                      setShowFileDropdown(!showFileDropdown);
                      if (!showFileDropdown) {
                        setShowLimitDropdown(false);
                        setShowCalendar(false);
                        setShowDownloadDropdown(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bg,
                      color: colors.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>{selectedTopFile ? extractTime(selectedTopFile) : 'Select time'}</span>
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: showFileDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showFileDropdown && selectedDate && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                      maxHeight: '200px',
                      overflowY: 'scroll',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                    className="hide-scrollbar"
                    >
                      {(filesByDate[selectedDate]?.sort().reverse() || []).length > 0 ? (
                        filesByDate[selectedDate].sort().reverse().map(file => (
                        <button
                          key={file}
                          onClick={() => {
                            onSelectTopFile(file);
                            setShowFileDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: selectedTopFile === file ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                            fontWeight: selectedTopFile === file ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedTopFile !== file) {
                              e.currentTarget.style.background = colors.bgSecondary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedTopFile !== file) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {extractTime(file)}
                        </button>
                      ))
                      ) : (
                        <div style={{padding: '8px 12px', color: colors.text, fontSize: '12px'}}>No files available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
                {selectedTopFile && isLoadingFileData && (
                  <span style={{fontSize: '11px', color: '#f0883e'}}>Loading...</span>
                )}
            </>
          )}
          
          {/* Download Button */}
          <div style={{position: 'relative'}}>
            <button 
            type="button"
            style={{
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
              border: `1px solid ${colors.primaryDark || colors.primary}`,
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0, 82, 204, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => {
              setShowDownloadDropdown(!showDownloadDropdown);
              if (!showDownloadDropdown) {
                setShowLimitDropdown(false);
                setShowCalendar(false);
                setShowFileDropdown(false);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`;
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary} 100%)`;
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.25)';
            }}>
              Download
              <FaChevronDown style={{fontSize: '12px', transition: 'transform 0.3s', transform: showDownloadDropdown ? 'rotate(180deg)' : 'rotate(0deg)'}} />
            </button>

            {/* Dropdown Menu */}
            {showDownloadDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                zIndex: 1000,
                minWidth: '150px',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={downloadAsJSON}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: colors.bg,
                    border: 'none',
                    color: colors.text,
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    borderBottom: `1px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colors.bg;
                    e.target.style.color = colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = colors.bg;
                    e.target.style.color = colors.text;
                  }}>
                  Download as JSON
                </button>
                <button
                  type="button"
                  onClick={downloadAsRAW}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: colors.bg,
                    border: 'none',
                    color: colors.text,
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colors.bg;
                    e.target.style.color = colors.text;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = colors.bg;
                    e.target.style.color = colors.text;
                  }}>
                  Download as RAW
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isLoadingFileData ? (
        <div style={{
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          color: colors.dimText
        }}>
          <p style={{margin: 0, color: colors.dimText}}>Loading processes data...</p>
        </div>
      ) : isERPFormat ? (
      // ERP-AIX/AIX Format Table: PID, Owner, CPU%, Size, Command
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '15px'
      }}>
        <colgroup>
          <col style={{width: '15%'}} />
          <col style={{width: '18%'}} />
          <col style={{width: '18%'}} />
          <col style={{width: '18%'}} />
          <col style={{width: 'auto'}} />
        </colgroup>
        <thead>
          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
            <SortHeader label="PID" sortKey="pid" />
            <SortHeader label="Owner" sortKey="owner" />
            <SortHeader label="CPU %" sortKey="cpu_pct" />
            <SortHeader label="Size (MB)" sortKey="size_mb" />
            <SortHeader label="Command" sortKey="command" />
          </tr>
        </thead>
        <tbody>
          {displayedProcesses.map((proc, idx) => (
            <tr 
              key={idx} 
              style={{
                background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                borderBottom: `1px solid ${colors.border}`,
                transition: 'background-color 0.2s',
                cursor: 'pointer',
                height: '50px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#6b7a87'}
              onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg}
            >
              <td style={{padding: '12px 20px', fontSize: '15px', fontWeight: '600', color: colors.info, verticalAlign: 'middle'}}>{proc.pid}</td>
              <td style={{padding: '12px 20px', fontSize: '15px', fontWeight: '500', color: colors.text, verticalAlign: 'middle'}}>{proc.owner}</td>
              <td style={{padding: '12px 20px', fontSize: '15px', textAlign: 'center', verticalAlign: 'middle'}}>
                <span style={{background: parseFloat(proc.cpu_pct) > 10 ? '#f85149' : parseFloat(proc.cpu_pct) > 5 ? '#d29922' : '#238636', padding: '8px 12px', borderRadius: '4px', fontWeight: '700', color: 'white', fontSize: '15px'}}>
                  {parseFloat(proc.cpu_pct || 0).toFixed(1)}%
                </span>
              </td>
              <td style={{padding: '12px 20px', fontSize: '15px', textAlign: 'center', color: colors.text, fontWeight: '500', verticalAlign: 'middle'}}>
                {parseFloat(proc.size_mb || 0).toFixed(1)} MB
              </td>
              <td style={{padding: '12px 20px', color: colors.text, fontSize: '15px', wordBreak: 'break-word', overflowWrap: 'break-word', verticalAlign: 'middle'}}>{proc.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
      ) : (
      // Standard AIX/Linux Format Table: PID, User, PR, NI, VIRT, RES, SHR, S, CPU%, MEM%, TIME+, Command
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '14px'
      }}>
        <colgroup>
          <col style={{width: '7%'}} />
          <col style={{width: '10%'}} />
          <col style={{width: '5%'}} />
          <col style={{width: '5%'}} />
          <col style={{width: '10%'}} />
          <col style={{width: '10%'}} />
          <col style={{width: '8%'}} />
          <col style={{width: '4%'}} />
          <col style={{width: '7%'}} />
          <col style={{width: '7%'}} />
          <col style={{width: '10%'}} />
          <col style={{width: 'auto'}} />
        </colgroup>
        <thead>
          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
            <SortHeader label="PID" sortKey="pid" />
            <SortHeader label="User" sortKey="user" />
            <SortHeader label="PR" sortKey="pr" />
            <SortHeader label="NI" sortKey="ni" />
            <SortHeader label="VIRT" sortKey="virt" />
            <SortHeader label="RES" sortKey="res" />
            <SortHeader label="SHR" sortKey="shr" />
            <SortHeader label="S" sortKey="state" />
            <SortHeader label="CPU%" sortKey="cpu" />
            <SortHeader label="MEM%" sortKey="mem" />
            <SortHeader label="TIME+" sortKey="time" />
            <SortHeader label="Command" sortKey="command" />
          </tr>
        </thead>
        <tbody>
          {displayedProcesses.map((proc, idx) => (
            <tr 
              key={idx} 
              style={{
                background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                borderBottom: `1px solid ${colors.border}`,
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#6b7a87'}
              onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg}
            >
              <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.info}}>{proc.pid}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{proc.user}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'center', fontWeight: '500', color: colors.text}}>{proc.pr}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'center', fontWeight: '500', color: colors.text}}>{proc.ni}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500'}}>{proc.virt}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500'}}>{proc.res}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500'}}>{proc.shr}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'center', fontWeight: '600', color: colors.text}}>{proc.state}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'right'}}>
                <span style={{background: parseFloat(proc.cpu) > 10 ? '#f85149' : parseFloat(proc.cpu) > 5 ? '#d29922' : '#238636', padding: '6px 10px', borderRadius: '4px', fontWeight: '700', color: 'white', fontSize: '14px'}}>
                  {parseFloat(proc.cpu || 0).toFixed(1)}%
                </span>
              </td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'right'}}>
                <span style={{background: parseFloat(proc.mem) > 10 ? '#f85149' : parseFloat(proc.mem) > 5 ? '#d29922' : '#1f6feb', padding: '6px 10px', borderRadius: '4px', fontWeight: '700', color: 'white', fontSize: '14px'}}>
                  {parseFloat(proc.mem || 0).toFixed(1)}%
                </span>
              </td>
              <td style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500'}}>{proc.time}</td>
              <td style={{padding: '14px 16px', color: colors.text, fontSize: '14px', wordBreak: 'break-word', overflowWrap: 'break-word'}}>{proc.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
});

ProcessesView.propTypes = {
  processes: PropTypes.array,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  controller: PropTypes.object.isRequired,
  topFiles: PropTypes.array,
  selectedTopFile: PropTypes.string,
  onSelectTopFile: PropTypes.func.isRequired,
  selectedTopFileData: PropTypes.object,
  isLoadingFileData: PropTypes.bool
};

export { ProcessesView };
