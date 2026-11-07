import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../components/ThemeProvider';
import { FiRefreshCw } from 'react-icons/fi';
import { FaChevronDown } from 'react-icons/fa';
import { useThemeColors } from '../hooks/useThemeColors';
import { extractTimeFromFilename, extractDateFromFilename } from '../utils/stringUtils';
import { formatLoggapTimestamp } from '../utils/dateTimeFormatter';
import { getCalendarDaysForMonth } from '../utils/dateUtils';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';
import { useToast } from '../components/Toast';

const LoggapViewContent = memo(({ data, theme }) => {
  const loggaps = Array.isArray(data?.Loggaps) ? data.Loggaps : [];
  const rawText = data?.raw_stdout || '';
  const timeLagFromSummary = loggaps[0]?.summary?.time_lag || '';
  const timeLagFromRaw = rawText.match(/time lag[^:]*:\s*([+\-]?\d{2}:\d{2}:\d{2})/i)?.[1] || '';
  const timeLagText = timeLagFromSummary || timeLagFromRaw;

  const parseLagToMinutes = (value) => {
    const text = String(value || '').trim();
    if (!text) {return null;}
    const sign = text.startsWith('-') ? -1 : 1;
    const parts = text.replace(/^[+-]/, '').split(':').map((p) => Number(p));
    if (parts.some((p) => Number.isNaN(p))) {return null;}
    if (parts.length === 3) {
      const [hh, mm, ss] = parts;
      return sign * (hh * 60 + mm + ss / 60);
    }
    if (parts.length === 4) {
      const [dd, hh, mm, ss] = parts;
      return sign * (dd * 24 * 60 + hh * 60 + mm + ss / 60);
    }
    return null;
  };

  const getLagColor = (value) => {
    const minutes = parseLagToMinutes(value);
    if (minutes === null) {return theme.text;}
    if (minutes >= 45) {return '#f85149';}
    if (minutes >= 30) {return '#d29922';}
    return '#238636';
  };

  if (!data || (loggaps.length === 0 && !rawText)) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.textSecondary }}>
        <p>No loggap data available</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {rawText ? (
        <div style={{
          background: theme.background,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          padding: '16px',
          overflowX: 'auto'
        }}>
          {timeLagText && (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '12px'
            }}>
              <tbody>
                <tr style={{
                  background: theme.backgroundSecondary,
                  border: `1px solid ${theme.border}`
                }}>
                  <td style={{
                    color: theme.text,
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '10px 12px'
                  }}>
                    Time Lag
                  </td>
                  <td style={{
                    color: theme.text,
                    fontSize: '14px',
                    fontWeight: '700',
                    textAlign: 'right',
                    padding: '10px 12px'
                  }}>
                    <span style={{
                      background: getLagColor(timeLagText),
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      display: 'inline-block'
                    }}>
                      {timeLagText}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <pre style={{
            margin: 0,
            color: theme.text,
            fontSize: '12px',
            lineHeight: '1.5',
            fontFamily: 'Consolas, "Courier New", monospace',
            whiteSpace: 'pre'
          }}>
            {rawText}
          </pre>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {loggaps.map((loggap, idx) => {
            const summary = loggap.summary || {};
            const transferGap = summary.transfer_gap ?? 'N/A';
            const applyGap = summary.apply_gap ?? 'N/A';
            const transferGapColor = Number(transferGap) > 0 ? theme.success : theme.gray;
            const applyGapColor = Number(applyGap) > 0 ? theme.success : theme.gray;

            return (
              <div
                key={`${loggap.Loggap_name || 'loggap'}-${idx}`}
                style={{
                  background: theme.background,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ color: theme.text, fontSize: '14px', fontWeight: '700' }}>
                    {loggap.Loggap_name || 'N/A'}
                  </div>
                  <div style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: '700' }}>
                    <span style={{
                      background: getLagColor(summary.time_lag),
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      display: 'inline-block'
                    }}>
                      {summary.time_lag || 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div style={{
                    background: transferGapColor,
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    Transfer Gap: {transferGap}
                  </div>
                  <div style={{
                    background: applyGapColor,
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '700',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    Apply Gap: {applyGap}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Source Seq</div>
                    <div style={{ color: theme.text, fontSize: '14px', fontWeight: '600' }}>{summary.source_sequence ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Last Archived</div>
                    <div style={{ color: theme.text, fontSize: '14px', fontWeight: '600' }}>{summary.last_archived ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Next Required Seq</div>
                    <div style={{ color: theme.text, fontSize: '14px', fontWeight: '600' }}>{summary.next_required_seq ?? 'N/A'}</div>
                  </div>
                  <div>
                    <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Last Transferred</div>
                    <div style={{ color: theme.text, fontSize: '14px', fontWeight: '500' }}>{formatLoggapTimestamp(summary.last_transferred_ts)}</div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${theme.border}` }}>
                  <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Source Time</div>
                  <div style={{ color: theme.text, fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    {formatLoggapTimestamp(summary.source_time)}
                  </div>
                  <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Destination Time</div>
                  <div style={{ color: theme.text, fontSize: '14px', fontWeight: '500' }}>
                    {formatLoggapTimestamp(summary.destination_time)}
                  </div>
                  <div style={{ color: theme.text, fontSize: '12px', marginBottom: '4px', marginTop: '8px', fontWeight: '600' }}>Completion Time</div>
                  <div style={{ color: theme.text, fontSize: '14px', fontWeight: '500' }}>
                    {formatLoggapTimestamp(summary.completion_time)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

LoggapViewContent.propTypes = {
  data: PropTypes.shape({
    Loggaps: PropTypes.arrayOf(PropTypes.object),
    timestamp: PropTypes.string
  }),
  theme: PropTypes.object.isRequired
};

export const LoggapView = memo(({ 
  data, 
  theme: propTheme, 
  isLoading = false, 
  loggapFiles = [], 
  selectedLoggapFile = '', 
  onSelectLoggapFile = () => {},
  serverName = ''
}) => {
  const { theme: defaultTheme } = useTheme();
  const theme = propTheme || defaultTheme;
  const colors = useThemeColors();
  const toast = useToast();
  const headerTitleStyle = {
    margin: 0,
    color: colors.text,
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '-0.5px'
  };
  const [showFileDropdown, setShowFileDropdown] = React.useState(false);
  const [showDateDropdown, setShowDateDropdown] = React.useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(null);

  // Group files by date
  const filesByDate = React.useMemo(() => {
    const grouped = {};
    loggapFiles?.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) { grouped[date] = []; }
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [loggapFiles]);

  const availableDates = React.useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);
  
  // State for date selection
  const [selectedDate, setSelectedDate] = React.useState(null);
  
  const isInitializedRef = React.useRef(false);
  const prevAvailableDatesRef = React.useRef(null);
  const prevSelectedDateRef = React.useRef(null);

  // Initialize selected date
  React.useEffect(() => {
    if (isInitializedRef.current) { return; }
    if (!availableDates || availableDates.length === 0) { return; }
    
    isInitializedRef.current = true;
    prevAvailableDatesRef.current = availableDates;
    setSelectedDate(availableDates[0]);
    setCalendarMonth(availableDates[0]);
  }, [availableDates]);

  // Validate selected date when available dates change
  React.useEffect(() => {
    if (!isInitializedRef.current || !availableDates || availableDates.length === 0) { return; }

    const datesChanged = !prevAvailableDatesRef.current || 
      availableDates.length !== prevAvailableDatesRef.current.length ||
      !availableDates.every(date => prevAvailableDatesRef.current.includes(date));

    if (datesChanged) {
      prevAvailableDatesRef.current = availableDates;
    }

    if (!selectedDate || !availableDates.includes(selectedDate)) {
      const newDate = availableDates[0];
      setSelectedDate(newDate);
      setCalendarMonth(newDate);
      try {
        localStorage.setItem('loggapSelectedDate', newDate);
      } catch (e) {
        // ignore
      }
    }
  }, [availableDates, selectedDate]);
  
  // Save selected date
  React.useEffect(() => {
    if (selectedDate) {
      try {
        localStorage.setItem('loggapSelectedDate', selectedDate);
      } catch (e) {
        // ignore
      }
    }
  }, [selectedDate]);

  React.useEffect(() => {
    if (!selectedDate || !filesByDate[selectedDate]) {
      return;
    }

    // Only auto-select latest file when the date actually changes, not when user picks a time manually
    if (prevSelectedDateRef.current === selectedDate) {
      return;
    }

    prevSelectedDateRef.current = selectedDate;

    const filesForDate = filesByDate[selectedDate];
    if (filesForDate.length > 0) {
      const latestFile = filesForDate.slice().sort().reverse()[0];
      onSelectLoggapFile(latestFile);
    }
  }, [selectedDate, filesByDate, onSelectLoggapFile]);

  // Calendar navigation
  const previousMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const newDate = new Date(Number(year), Number(month) - 2, 1);
    setCalendarMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const nextMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const newDate = new Date(Number(year), Number(month), 1);
    setCalendarMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const calendarDays = React.useMemo(() => calendarMonth ? getCalendarDaysForMonth(calendarMonth) : [], [calendarMonth]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  const downloadAsJSON = async () => {
    const fileToDownload = selectedLoggapFile || loggapFiles?.[0];
    if (!fileToDownload || !serverName) {
      toast.error('No file available to download');
      return;
    }

    try {
      const data = await downloadFile(serverName, 'loggap', fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || 'loggap.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('File downloaded successfully');
      } else {
        toast.error('Failed to download file');
      }
    } catch (error) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setShowDownloadDropdown(false);
    }
  };

  const downloadAsRAW = async () => {
    const fileToDownload = selectedLoggapFile || loggapFiles?.[0];
    if (!fileToDownload || !serverName) {
      toast.error('No file available to download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || 'loggap.txt';

    try {
      const data = await downloadFile(serverName, 'loggap', fileIdForRaw, 'raw');
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
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setShowDownloadDropdown(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        background: theme.background,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '40px 20px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <FiRefreshCw className="spinning" style={{ fontSize: '32px', color: theme.primary }} />
        <h2 style={{...headerTitleStyle, marginTop: '16px', marginBottom: '12px'}}>Loggap Information</h2>
        <p style={{margin: 0, color: theme.textSecondary}}>Loading loggap data...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ 
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '20px',
      overflow: 'visible'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
          <h2 style={headerTitleStyle}>
            Loggap Information
          </h2>
        </div>

        {/* Date/Time/Download Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
        {loggapFiles && loggapFiles.length > 0 && (
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Date:</label>
              <div style={{position: 'relative', flex: 1}}>
                <button
                  onClick={() => {
                    setShowDateDropdown(!showDateDropdown);
                    if (!showDateDropdown) {
                      setCalendarMonth(selectedDate || availableDates[0] || null);
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
                    transform: showDateDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    <FaChevronDown style={{color: colors.info}} />
                  </span>
                </button>

                {showDateDropdown && (
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
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                      <button onClick={previousMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}>◀</button>
                      <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{currentMonth}/{currentYear}</span>
                      <button onClick={nextMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}>▶</button>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} style={{textAlign: 'center', fontSize: '11px', color: colors.text, fontWeight: '600'}}>
                          {day}
                        </div>
                      ))}
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px'}}>
                      {calendarDays && calendarDays.map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} />;
                        }
                        const dateStr = typeof day === 'string' ? day : `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const hasFiles = availableDates.includes(dateStr);
                        const isSelected = selectedDate === dateStr;

                        return (
                          <button
                            key={dateStr}
                            onClick={() => {
                              if (hasFiles) {
                                setSelectedDate(dateStr);
                                setShowDateDropdown(false);
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
                            {dateStr.split('-')[2]}
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
                      setShowDateDropdown(false);
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
                  <span>{selectedLoggapFile ? extractTimeFromFilename(selectedLoggapFile) : 'Select time'}</span>
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

                {showFileDropdown && (
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
                    {filesByDate[selectedDate]?.length ? (
                      filesByDate[selectedDate]
                        .slice()
                        .sort()
                        .reverse()
                        .map(file => (
                          <button
                            key={file}
                            onClick={() => {
                              onSelectLoggapFile(file);
                              setShowFileDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: selectedLoggapFile === file ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '12px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: selectedLoggapFile === file ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedLoggapFile !== file) {
                                e.currentTarget.style.background = colors.bgSecondary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedLoggapFile !== file) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {extractTimeFromFilename(file)}
                          </button>
                        ))
                    ) : (
                      <div style={{padding: '8px 12px', color: colors.text, fontSize: '12px'}}>No files</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                setShowDateDropdown(false);
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
                }}
              >
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
                }}
              >
                Download as RAW
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      <LoggapViewContent data={data} theme={theme} />
    </div>
  );
});

LoggapView.propTypes = {
  data: PropTypes.shape({
    Loggaps: PropTypes.arrayOf(PropTypes.object),
    timestamp: PropTypes.string
  }),
  theme: PropTypes.object,
  isLoading: PropTypes.bool,
  loggapFiles: PropTypes.array,
  selectedLoggapFile: PropTypes.string,
  onSelectLoggapFile: PropTypes.func,
  serverName: PropTypes.string
};

export default LoggapView;
