import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../components/ThemeProvider';
import { FiRefreshCw } from 'react-icons/fi';
import { FaChevronDown } from 'react-icons/fa';
import { useThemeColors } from '../hooks/useThemeColors';
import { extractTimeFromFilename, extractDateFromFilename } from '../utils/stringUtils';
import { getCalendarDaysForMonth } from '../utils/dateUtils';
import { useToast } from '../components/Toast';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';

const CheckProcessViewContent = memo(({ data, colors }) => {
  if (!data || !data.Check_Processes || data.Check_Processes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textSecondary }}>
        <p>No process check data available</p>
      </div>
    );
  }

  const processes = data.Check_Processes;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '14px'
      }}>
        <colgroup>
          <col style={{width: '30%'}} />
          <col style={{width: '12%'}} />
          <col style={{width: '10%'}} />
          <col style={{width: '18%'}} />
          <col style={{width: '30%'}} />
        </colgroup>
        <thead>
          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
            <th style={{padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: colors.text, background: colors.bg}}>Process Name</th>
            <th style={{padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: colors.text, background: colors.bg}}>Size (MB)</th>
            <th style={{padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: colors.text, background: colors.bg}}>Used %</th>
            <th style={{padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: colors.text, background: colors.bg}}>Start Time</th>
            <th style={{padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: colors.text, background: colors.bg}}>Command</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((process, idx) => {
            const size_mb = process.summary?.current_size_mb || 0;
            const used_percent = process.summary?.used_percent || 0;
            const startTime = process.datafiles?.[0]?.autoextend || 'N/A';
            const command = process.datafiles?.[0]?.datafile_name || 'N/A';
            const badgeColor = used_percent >= 90 ? '#f85149' : used_percent >= 80 ? '#d29922' : '#238636';

            return (
              <tr
                key={idx}
                style={{
                  background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                  borderBottom: `1px solid ${colors.border}`,
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = colors.bgSecondary}
                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg}
              >
                <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text, wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                  {process.Check_Process_name || 'N/A'}
                </td>
                <td style={{padding: '14px 16px', textAlign: 'center', fontSize: '14px', fontWeight: '500', color: colors.text}}>
                  {size_mb.toFixed(2)}
                </td>
                <td style={{padding: '14px 16px', textAlign: 'center'}}>
                  <span style={{background: badgeColor, padding: '6px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: '700', color: '#fff'}}>
                    {used_percent.toFixed(1)}%
                  </span>
                </td>
                <td style={{padding: '14px 16px', color: colors.text, fontSize: '13px', fontWeight: '500'}}>
                  {startTime}
                </td>
                <td style={{padding: '14px 16px', color: colors.text, fontSize: '14px', fontWeight: '500', wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                  {command}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

CheckProcessViewContent.propTypes = {
  data: PropTypes.shape({
    Check_Processes: PropTypes.arrayOf(PropTypes.object)
  }),
  colors: PropTypes.object.isRequired
};

export const CheckProcessView = memo(({ 
  data, 
  theme: propTheme, 
  isLoading = false, 
  checkProcessFiles = [], 
  selectedCheckProcessFile = '', 
  onSelectCheckProcessFile = () => {},
  serverName = ''
}) => {
  const { theme: defaultTheme } = useTheme();
  const theme = propTheme || defaultTheme;
  const colors = useThemeColors();
  const toast = useToast();
  const [showFileDropdown, setShowFileDropdown] = React.useState(false);
  const [showDateDropdown, setShowDateDropdown] = React.useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);

  // Group files by date
  const filesByDate = React.useMemo(() => {
    const grouped = {};
    checkProcessFiles?.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) { grouped[date] = []; }
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [checkProcessFiles]);

  const availableDates = React.useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [calendarMonth, setCalendarMonth] = React.useState(null);
  const prevSelectedDateRef = React.useRef(null);

  React.useEffect(() => {
    if (!availableDates.length) {
      return;
    }

    if (!selectedDate || !availableDates.includes(selectedDate)) {
      const nextDate = availableDates[0];
      setSelectedDate(nextDate);
      setCalendarMonth(nextDate);
    }
  }, [availableDates, selectedDate]);

  React.useEffect(() => {
    if (!selectedDate || !filesByDate[selectedDate]) {
      return;
    }
    // Only auto-select the latest file when the date actually changes
    if (prevSelectedDateRef.current === selectedDate) {
      return;
    }
    prevSelectedDateRef.current = selectedDate;
    const filesForDate = filesByDate[selectedDate];
    if (filesForDate.length > 0) {
      const latestFile = filesForDate.slice().sort().reverse()[0];
      onSelectCheckProcessFile(latestFile);
    }
  }, [filesByDate, onSelectCheckProcessFile, selectedDate]);

  const calendarDays = React.useMemo(() => (calendarMonth ? getCalendarDaysForMonth(calendarMonth) : []), [calendarMonth]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  const previousMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month, 10) - 2, 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setCalendarMonth(newDate);
  };

  const nextMonth = () => {
    if (!calendarMonth) {
      return;
    }
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month, 10), 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setCalendarMonth(newDate);
  };

  const downloadAsJSON = async () => {
    const fileToDownload = selectedCheckProcessFile || checkProcessFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }

    if (!serverName) {
      toast.error('Server name is missing for download');
      return;
    }

    try {
      const data = await downloadFile(serverName, 'check_process', fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || 'check_process.json';
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
    const fileToDownload = selectedCheckProcessFile || checkProcessFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }

    if (!serverName) {
      toast.error('Server name is missing for download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || 'check_process.txt';
    try {
      const data = await downloadFile(serverName, 'check_process', fileIdForRaw, 'raw');
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
        <h2 style={{marginTop: '16px', marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: theme.text}}>Process Check</h2>
        <p style={{margin: 0, color: theme.textSecondary}}>Loading process check data...</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div style={{ 
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '20px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '16px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '700',
          color: colors.text,
          letterSpacing: '-0.5px'
        }}>
          Process Check
        </h2>

        {checkProcessFiles.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
            <label style={{ fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0 }}>Date:</label>
            <div style={{ position: 'relative', flex: 1 }}>
              <button
                onClick={() => {
                  setShowDateDropdown(!showDateDropdown);
                  if (!showDateDropdown) {
                    setCalendarMonth(selectedDate);
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
                  <FaChevronDown style={{ color: colors.info }} />
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
                      const dateStr = typeof day === 'string'
                        ? day
                        : `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
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
                            color: hasFiles ? colors.text : colors.textSecondary,
                            cursor: hasFiles ? 'pointer' : 'default',
                            borderRadius: '4px',
                            fontWeight: isSelected ? '700' : '500',
                            opacity: hasFiles ? 1 : 0.45
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
            <label style={{ fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0 }}>Time:</label>
            <div style={{ position: 'relative', flex: 1 }}>
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
                <span>{selectedCheckProcessFile ? extractTimeFromFilename(selectedCheckProcessFile) : 'Select time'}</span>
                <span style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: showFileDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}>
                  <FaChevronDown style={{ color: colors.info }} />
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
                            onSelectCheckProcessFile(file);
                            setShowFileDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: selectedCheckProcessFile === file ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                            fontWeight: selectedCheckProcessFile === file ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedCheckProcessFile !== file) {
                              e.currentTarget.style.background = colors.bgSecondary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedCheckProcessFile !== file) {
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
        )}
      </div>

      <CheckProcessViewContent data={data} colors={colors} />
    </div>
  );
});

CheckProcessView.propTypes = {
  data: PropTypes.shape({
    Check_Processes: PropTypes.arrayOf(PropTypes.object)
  }),
  theme: PropTypes.object,
  isLoading: PropTypes.bool,
  checkProcessFiles: PropTypes.array,
  selectedCheckProcessFile: PropTypes.string,
  onSelectCheckProcessFile: PropTypes.func,
  serverName: PropTypes.string
};

export default CheckProcessView;
