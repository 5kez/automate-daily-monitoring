import React from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import { FiRefreshCw } from 'react-icons/fi';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';
import { useToast } from '../components/Toast';
import { useThemeColors } from '../utils/theme';
import { extractDateFromFilename, extractTime } from '../utils/stringUtils';

// View: AIXProcessesView.jsx
// Displays list of AIX running processes with sorting and file selection
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

const AIXProcessesView = React.memo(({ processes, sortConfig, onSort, controller, topFiles, selectedTopFile, onSelectTopFile, selectedTopFileData, isLoadingFileData, isRefreshing = false, onRefresh = null }) => {
  const toast = useToast();
  const colors = useThemeColors();

  // Use selected file data if available, otherwise use default processes
  const displayProcesses = selectedTopFileData?.parsed_data?.processes || selectedTopFileData?.processes || processes;
  const [displayLimit, setDisplayLimit] = React.useState(10);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);

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
          localStorage.setItem('aixProcessesSelectedDate', newDate);
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
        localStorage.setItem('aixProcessesSelectedDate', selectedDate);
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
  const calendarDays = React.useMemo(() => {
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
  const selectedServerName = controller?.model?.getSelectedServer?.() || 'ERP-AIX';

  const sortedProcesses = React.useMemo(() => {
    if (!displayProcesses || displayProcesses.length === 0) {return [];}
    if (!controller) {return displayProcesses;}
    return controller.getSortedData(displayProcesses, 'aix_processes', sortConfig);
  }, [displayProcesses, sortConfig, controller]);

  // Optimize: Only slice the data we need to render
  const displayedProcesses = React.useMemo(() => sortedProcesses.slice(0, displayLimit), [sortedProcesses, displayLimit]);

  if (isLoadingFileData) {
    return (
      <div style={{
        background: colors.bg,
        border: '1px solid #30363d',
        borderRadius: '8px',
        padding: '40px 20px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <div className="spinning" style={{ fontSize: '32px', color: colors.info, marginBottom: '16px' }}>⟳</div>
        <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: colors.text}}>AIX Processes</h2>
        <p style={{margin: 0, color: colors.textSecondary}}>Loading process data...</p>
      </div>
    );
  }
  
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
    const isActive = sortConfig.aix_processes?.key === sortKey;
    const arrow = isActive ? (sortConfig.aix_processes?.order === 'asc' ? ' ▲' : ' ▼') : '';
    
    return (
      <th
        onClick={() => onSort('aix_processes', sortKey)}
        style={{
          padding: '14px 16px',
          textAlign: 'left',
          cursor: 'pointer',
          background: colors.bg,
          fontWeight: '700',
          userSelect: 'none',
          borderBottom: '2px solid #303d3d',
          fontSize: '15px',
          color: isActive ? '#58a6ff' : colors.text,
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

  return (
    <div style={{
      background: colors.bg,
      border: '1px solid #30363d',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      overflowX: 'auto'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px'}}>
        <h2 style={{marginTop: 0, marginBottom: 0, fontSize: '24px', color: colors.text, fontWeight: '700', letterSpacing: '-0.5px'}}>AIX Processes</h2>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
          {/* Limit selector */}
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: '1px solid #30363d'}}>
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
                  border: '1px solid #30363d',
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
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  zIndex: 1000,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                  minWidth: '70px'
                }}>
                  {[5, 10, 15, 20].concat(displayProcesses?.length > 20 ? [displayProcesses.length] : []).map((limitValue) => (
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
                      Show {limitValue}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {topFiles && topFiles.length > 0 && (
            <>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: '1px solid #30363d'}}>
                <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Date:</label>
                <div style={{position: 'relative', flex: 1}}>
                  <button
                    onClick={() => {
                      setShowCalendar(!showCalendar);
                      if (!showCalendar) {
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
                      border: '1px solid #30363d',
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
                    <span>{selectedDate}</span>
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
                  
                  {showCalendar && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: colors.bg,
                      border: '1px solid #30363d',
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
                                }
                              }}
                              disabled={!hasFiles}
                              style={{
                                padding: '4px 8px',
                                border: isSelected ? `2px solid ${colors.info}` : '1px solid #30363d',
                                borderRadius: '4px',
                                background: isSelected ? colors.border : 'transparent',
                                color: hasFiles ? colors.text : colors.textSecondary,
                                cursor: hasFiles ? 'pointer' : 'default',
                                fontSize: '11px',
                                fontWeight: isSelected ? '600' : '400',
                                transition: 'all 0.2s ease',
                                opacity: hasFiles ? 1 : 0.5
                              }}
                              onMouseEnter={(e) => {
                                if (hasFiles && !isSelected) {
                                  e.currentTarget.style.background = colors.bgSecondary;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (hasFiles && !isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
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

              {/* Time selector */}
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: '1px solid #30363d'}}>
                <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Time:</label>
                <div style={{position: 'relative'}}>
                  <button
                    onClick={() => {
                      setShowFileDropdown(!showFileDropdown);
                      if (!showFileDropdown) {
                        setShowCalendar(false);
                        setShowLimitDropdown(false);
                        setShowDownloadDropdown(false);
                      }
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '4px',
                      border: '1px solid #30363d',
                      background: colors.bg,
                      color: colors.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      minWidth: '80px'
                    }}
                  >
                    <span>{extractTime(selectedTopFile || topFiles?.[0] || 'Select')}</span>
                    <span style={{
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

                  {showFileDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      background: colors.bg,
                      border: '1px solid #30363d',
                      borderRadius: '8px',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                      maxHeight: '200px',
                      overflowY: 'scroll',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }} className="hide-scrollbar">
                      {filesByDate[selectedDate]?.map((file, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            onSelectTopFile(file);
                            setShowFileDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: selectedTopFile === file ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '13px',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                            fontWeight: selectedTopFile === file ? '600' : '400',
                            borderBottom: '1px solid #30363d'
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
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Refresh button */}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary} 100%)`,
                    border: `1px solid ${colors.primaryDark || colors.primary}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: isRefreshing ? 'not-allowed' : 'pointer',
                    opacity: isRefreshing ? 0.6 : 1,
                    transition: 'all 0.2s ease',
                    boxShadow: isRefreshing ? 'none' : '0 4px 12px rgba(0, 82, 204, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isRefreshing) {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`;
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRefreshing) {
                      e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary} 100%)`;
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.2)';
                    }
                  }}
                >
                  <FiRefreshCw style={{fontSize: '16px', transition: 'transform 0.3s', transform: isRefreshing ? 'rotate(180deg)' : 'rotate(0deg)'}} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              )}

              {/* Download button */}
              <div style={{position: 'relative'}}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDownloadDropdown(!showDownloadDropdown);
                    if (!showDownloadDropdown) {
                      setShowCalendar(false);
                      setShowLimitDropdown(false);
                      setShowFileDropdown(false);
                    }
                  }}
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`;
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary} 100%)`;
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.25)';
                  }}
                >
                  Download
                  <FaChevronDown style={{fontSize: '12px', transition: 'transform 0.3s', transform: showDownloadDropdown ? 'rotate(180deg)' : 'rotate(0deg)'}} />
                </button>

                {showDownloadDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: colors.bg,
                    border: '1px solid #30363d',
                    borderRadius: '8px',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    minWidth: '150px'
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
                        borderBottom: '1px solid #30363d'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = colors.bgSecondary;
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
                        e.target.style.background = colors.bgSecondary;
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
            </>
          )}
        </div>
      </div>
      
      {isLoadingFileData ? (
        <div style={{
          background: colors.bg,
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center',
          color: colors.dimText
        }}>
          <p style={{margin: 0, color: colors.dimText}}>Loading AIX processes data...</p>
        </div>
      ) : !displayProcesses || displayProcesses.length === 0 ? (
        <div style={{
          background: colors.bg,
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center',
          color: colors.text
        }}>
          <p style={{margin: 0, color: colors.text}}>No monitoring data available for this server</p>
        </div>
      ) : (
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '14px'
      }}>
        <colgroup>
          <col style={{width: '12%'}} />
          <col style={{width: '12%'}} />
          <col style={{width: '15%'}} />
          <col style={{width: '15%'}} />
          <col style={{width: 'auto'}} />
        </colgroup>
        <thead>
          <tr style={{borderBottom: '2px solid #303d3d', background: colors.bg}}>
            <SortHeader label="PID" sortKey="pid" />
            <SortHeader label="CPU%" sortKey="cpu_pct" />
            <SortHeader label="Memory (MB)" sortKey="size_mb" />
            <SortHeader label="Owner" sortKey="owner" />
            <SortHeader label="Command" sortKey="command" />
          </tr>
        </thead>
        <tbody>
          {displayedProcesses.map((proc, idx) => (
            <tr 
              key={idx} 
              style={{
                background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                borderBottom: '1px solid #303d3d',
                transition: 'background-color 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1c2128'}
              onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg}
            >
              <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: '#58a6ff'}}>{proc.pid}</td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'right'}}>
                <span style={{background: parseFloat(proc.cpu_pct) > 10 ? '#f85149' : parseFloat(proc.cpu_pct) > 5 ? '#d29922' : '#238636', padding: '6px 10px', borderRadius: '4px', fontWeight: '700', color: 'white', fontSize: '14px'}}>
                  {parseFloat(proc.cpu_pct || 0).toFixed(1)}%
                </span>
              </td>
              <td style={{padding: '14px 16px', fontSize: '14px', textAlign: 'right'}}>
                <span style={{background: parseFloat(proc.size_mb) > 500 ? '#f85149' : parseFloat(proc.size_mb) > 200 ? '#d29922' : '#1f6feb', padding: '6px 10px', borderRadius: '4px', fontWeight: '700', color: 'white', fontSize: '14px'}}>
                  {parseFloat(proc.size_mb || 0).toFixed(1)} MB
                </span>
              </td>
              <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{proc.owner}</td>
              <td style={{padding: '14px 16px', color: colors.text, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{proc.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
});

AIXProcessesView.propTypes = {
  processes: PropTypes.array,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  controller: PropTypes.object.isRequired,
  topFiles: PropTypes.array,
  selectedTopFile: PropTypes.string,
  onSelectTopFile: PropTypes.func.isRequired,
  selectedTopFileData: PropTypes.object,
  isLoadingFileData: PropTypes.bool,
  isRefreshing: PropTypes.bool,
  onRefresh: PropTypes.func
};

export { AIXProcessesView };
