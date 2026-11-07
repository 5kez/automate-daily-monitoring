import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import { useTheme } from '../components/ThemeProvider';
import { useThemeColors } from '../hooks/useThemeColors';
import { calculateDuration, formatTimeDisplay } from '../utils/dateTimeFormatter';
import { extractBackupTimesFromLogs, extractHostname } from '../utils/dataExtraction';
import { extractDateFromFilename, extractTimeFromFilename } from '../utils/stringUtils';
import { getCalendarDaysForMonth } from '../utils/dateUtils';
import { getStatusColor } from '../utils/styleUtils';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';
import { useToast } from '../components/Toast';

// Extract backup times from RMAN logs
const extractBackupTimes = (logsText) => {
  if (!logsText || typeof logsText !== 'string') {
    return { startTime: 'N/A', endTime: 'N/A' };
  }

  let startTime = 'N/A';
  let endTime = 'N/A';

  // Search for the last occurrence of "Starting backup at" and "Finished backup at"
  // These patterns appear multiple times in RMAN logs, so we get the last one for the complete backup
  const startMatches = logsText.match(/Starting backup at\s+(\d{2}-[A-Z]{3}-\d{2})/g);
  const endMatches = logsText.match(/Finished backup at\s+(\d{2}-[A-Z]{3}-\d{2})/g);

  if (startMatches && startMatches.length > 0) {
    const lastStart = startMatches[startMatches.length - 1];
    const dateMatch = lastStart.match(/(\d{2}-[A-Z]{3}-\d{2})/);
    if (dateMatch) {
      startTime = dateMatch[1];
    }
  }

  if (endMatches && endMatches.length > 0) {
    const lastEnd = endMatches[endMatches.length - 1];
    const dateMatch = lastEnd.match(/(\d{2}-[A-Z]{3}-\d{2})/);
    if (dateMatch) {
      endTime = dateMatch[1];
    }
  }

  return { startTime, endTime };
};

const BackupSummaryItem = memo(({ data, theme, title, showTitle = true }) => {
  if (!data) {
    return null;
  }

  // Extract info from nested structure
  const parsedData = data.parsed_data || data;
  const hostname = parsedData.system?.hostname || data.hostname || 'N/A';
  
  // Try different summary structures (different backup types have different structures)
  let status = 'Success';
  let startTime = 'N/A';
  let endTime = 'N/A';
  
  // For Backup_DB_Local: uses summary
  if (parsedData.summary) {
    status = parsedData.summary.status || 'Success';
    startTime = parsedData.summary.start_time || 'N/A';
    endTime = parsedData.summary.end_time || 'N/A';
  }
  
  // For DB_Backup: uses backup_summary
  if (parsedData.backup_summary) {
    status = parsedData.backup_summary.status || status || 'Success';
    startTime = parsedData.backup_summary.start_time || startTime || 'N/A';
    endTime = parsedData.backup_summary.end_time || endTime || 'N/A';
  }
  
  // If times are still N/A, try to extract from raw_stdout
  if (startTime === 'N/A' || endTime === 'N/A') {
    const logsText = data.raw_stdout || data.logs || data.log || '';
    const { startTime: extractedStart, endTime: extractedEnd } = extractBackupTimes(logsText);
    if (startTime === 'N/A') startTime = extractedStart;
    if (endTime === 'N/A') endTime = extractedEnd;
  }

  const duration = calculateDuration(startTime, endTime);

  return (
    <div style={{ padding: '20px' }}>
      {showTitle && (
        <h3 style={{
          fontSize: '18px',
          color: theme.warning,
          margin: 0,
          marginBottom: '16px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {title}
        </h3>
      )}
      
      <div style={{ display: 'grid', gap: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.text, fontWeight: '500' }}>{title}</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: getStatusColor(status, theme), textTransform: 'uppercase' }}>
            {status}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.text, fontWeight: '500' }}>Start Time</span>
          <span style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '500' }}>
            {formatTimeDisplay(startTime)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.text, fontWeight: '500' }}>End Time</span>
          <span style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '500' }}>
            {formatTimeDisplay(endTime)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.text, fontWeight: '500' }}>Duration</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: theme.info }}>
            {duration}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: theme.text, fontWeight: '500' }}>Hostname</span>
          <span style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '500' }}>
            {hostname}
          </span>
        </div>
      </div>
    </div>
  );
});

BackupSummaryItem.propTypes = {
  data: PropTypes.object,
  theme: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired,
  showTitle: PropTypes.bool
};

const BackupCard = memo(({ title, data, theme, colors, files = [], selectedFile = '', onSelectFile = () => {}, serverName = '', fileType }) => {
  const toast = useToast();
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(null);

  const filesByDate = useMemo(() => {
    const grouped = {};
    files.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) {grouped[date] = [];}
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [files]);

  const availableDates = useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);
  const prevSelectedDateRef = useRef(null);

  useEffect(() => {
    if (!availableDates.length) {
      return;
    }
    if (!selectedDate || !availableDates.includes(selectedDate)) {
      const nextDate = availableDates[0];
      setSelectedDate(nextDate);
      setCalendarMonth(nextDate);
    }
  }, [availableDates, selectedDate]);

  useEffect(() => {
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
      onSelectFile(latestFile);
    }
  }, [filesByDate, onSelectFile, selectedDate]);

  const calendarDays = useMemo(() => (calendarMonth ? getCalendarDaysForMonth(calendarMonth) : []), [calendarMonth]);
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
    const fileToDownload = selectedFile || files?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }
    if (!serverName) {
      toast.error('Server name is missing for download');
      return;
    }

    try {
      const data = await downloadFile(serverName, fileType, fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || `${fileType}.json`;
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
    const fileToDownload = selectedFile || files?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }
    if (!serverName) {
      toast.error('Server name is missing for download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || `${fileType}.txt`;
    try {
      const data = await downloadFile(serverName, fileType, fileIdForRaw, 'raw');
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

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      overflow: 'visible'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        overflow: 'visible'
      }}>
        <div style={{ fontSize: '16px', fontWeight: '700', color: colors.text }}>
          {title}
        </div>
        {files.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '6px 10px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{ fontSize: '11px', color: colors.text, fontWeight: '500', margin: 0 }}>Date:</label>
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
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    minWidth: '90px'
                  }}
                >
                  <span>{selectedDate || 'Select date'}</span>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '11px',
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
                    minWidth: '240px',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                  }}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                      <button onClick={previousMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '14px'}}>◀</button>
                      <span style={{color: colors.text, fontWeight: '600', fontSize: '12px'}}>{currentMonth}/{currentYear}</span>
                      <button onClick={nextMonth} style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '14px'}}>▶</button>
                    </div>

                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} style={{textAlign: 'center', fontSize: '10px', color: colors.text, fontWeight: '600'}}>
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
                              padding: '5px',
                              fontSize: '10px',
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

            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '6px 10px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{ fontSize: '11px', color: colors.text, fontWeight: '500', margin: 0 }}>Time:</label>
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
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bg,
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: '11px',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    minWidth: '90px'
                  }}
                >
                  <span>{selectedFile ? extractTimeFromFilename(selectedFile) : 'Select time'}</span>
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '11px',
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
                    overflowY: 'auto'
                  }}>
                    {filesByDate[selectedDate]?.length ? (
                      filesByDate[selectedDate]
                        .slice()
                        .sort()
                        .reverse()
                        .map(file => (
                          <button
                            key={file}
                            onClick={() => {
                              onSelectFile(file);
                              setShowFileDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: selectedFile === file ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '11px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: selectedFile === file ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (selectedFile !== file) {
                                e.currentTarget.style.background = colors.bgSecondary;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedFile !== file) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {extractTimeFromFilename(file)}
                          </button>
                        ))
                    ) : (
                      <div style={{padding: '8px 12px', color: colors.text, fontSize: '11px'}}>No files</div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
      <BackupSummaryItem data={data} theme={theme} title={title} showTitle={false} />
      {files.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 16px' }}>
          <div style={{position: 'relative'}}>
            <button
              type="button"
              style={{
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                border: `1px solid ${colors.primaryDark || colors.primary}`,
                borderRadius: '8px',
                padding: '6px 10px',
                color: '#fff',
                fontSize: '12px',
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
              <FaChevronDown style={{fontSize: '11px', transition: 'transform 0.3s', transform: showDownloadDropdown ? 'rotate(180deg)' : 'rotate(0deg)'}} />
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
                    padding: '8px 12px',
                    background: colors.bg,
                    border: 'none',
                    color: colors.text,
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease',
                    borderBottom: `1px solid ${colors.border}`
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colors.bgSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = colors.bg;
                  }}
                >
                  Download as JSON
                </button>
                <button
                  type="button"
                  onClick={downloadAsRAW}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: colors.bg,
                    border: 'none',
                    color: colors.text,
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = colors.bgSecondary;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = colors.bg;
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
  );
});

BackupSummaryItem.propTypes = {
  data: PropTypes.object,
  theme: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired
};

// Individual backup view component
const IndividualBackupView = memo(({
  data,
  isLoading,
  title,
  theme: propTheme
}) => {
  const { theme: defaultTheme } = useTheme();
  const theme = propTheme || defaultTheme;
  const colors = useThemeColors();

  return (
    <div style={{
      background: theme.background,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease',
      height: '100%'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <h3 style={{fontSize: '18px', color: theme.warning, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
          {title}
        </h3>
      </div>

      {/* Backup summary */}
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <BackupSummaryItem data={data} theme={theme} title={title} />
      </div>
    </div>
  );
});

IndividualBackupView.propTypes = {
  data: PropTypes.object,
  isLoading: PropTypes.bool,
  title: PropTypes.string.isRequired,
  theme: PropTypes.object
};

// Combined Backup View with all three backup types in a single card
export const BackupView = memo(({
  dbBackupData,
  dbBackupFiles,
  selectedDbBackupFile,
  onSelectDbBackupFile,
  weeklyBackupData,
  weeklyBackupFiles,
  selectedWeeklyBackupFile,
  onSelectWeeklyBackupFile,
  backupLocalData,
  backupLocalFiles,
  selectedBackupLocalFile,
  onSelectBackupLocalFile,
  serverName,
  theme: propTheme,
  isLoading = false
}) => {
  const { theme: defaultTheme } = useTheme();
  const theme = propTheme || defaultTheme;
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <div style={{
        background: theme.background,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.3s ease'
      }}>
        <h2 style={{marginTop: 0, marginBottom: '28px', fontSize: '24px', fontWeight: '700', color: colors.text, letterSpacing: '-0.5px'}}>Backup</h2>
        <p style={{margin: 0, color: theme.textSecondary}}>Loading backup data...</p>
      </div>
    );
  }

  return (
    <div style={{
      background: theme.background,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '32px',
      marginBottom: '24px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.3s ease'
    }}>
      <h2 style={{marginTop: 0, marginBottom: '28px', fontSize: '24px', fontWeight: '700', color: colors.text, letterSpacing: '-0.5px'}}>Backup</h2>

      {/* Backup summaries in a horizontal grid layout */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {backupLocalData && (
          <BackupCard
            title="Local Backup"
            data={backupLocalData}
            files={backupLocalFiles || []}
            selectedFile={selectedBackupLocalFile}
            onSelectFile={onSelectBackupLocalFile}
            serverName={serverName}
            fileType="backup_db_local"
            theme={theme}
            colors={colors}
          />
        )}
        
        {weeklyBackupData && (
          <BackupCard
            title="Weekly Backup"
            data={weeklyBackupData}
            files={weeklyBackupFiles || []}
            selectedFile={selectedWeeklyBackupFile}
            onSelectFile={onSelectWeeklyBackupFile}
            serverName={serverName}
            fileType="weekly_backup"
            theme={theme}
            colors={colors}
          />
        )}
        
        {dbBackupData && (
          <BackupCard
            title="Database Backup"
            data={dbBackupData}
            files={dbBackupFiles || []}
            selectedFile={selectedDbBackupFile}
            onSelectFile={onSelectDbBackupFile}
            serverName={serverName}
            fileType="db_backup"
            theme={theme}
            colors={colors}
          />
        )}
        
        {!backupLocalData && !weeklyBackupData && !dbBackupData && (
          <div style={{ 
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '20px'
          }}>
            <p style={{ margin: 0, color: theme.textSecondary, fontSize: '13px' }}>No backup data available</p>
          </div>
        )}
      </div>
    </div>
  );
});

BackupView.propTypes = {
  dbBackupData: PropTypes.object,
  dbBackupFiles: PropTypes.array,
  selectedDbBackupFile: PropTypes.string,
  onSelectDbBackupFile: PropTypes.func,
  weeklyBackupData: PropTypes.object,
  weeklyBackupFiles: PropTypes.array,
  selectedWeeklyBackupFile: PropTypes.string,
  onSelectWeeklyBackupFile: PropTypes.func,
  backupLocalData: PropTypes.object,
  backupLocalFiles: PropTypes.array,
  selectedBackupLocalFile: PropTypes.string,
  onSelectBackupLocalFile: PropTypes.func,
  serverName: PropTypes.string,
  theme: PropTypes.object,
  isLoading: PropTypes.bool
};

// Export individual views for each backup type
export const DBBackupView = memo((props) => (
  <IndividualBackupView
    {...props}
    data={props.data}
    title="Database Backup"
  />
));

DBBackupView.propTypes = {
  data: PropTypes.object,
  dbBackupFiles: PropTypes.array,
  selectedDbBackupFile: PropTypes.string,
  onSelectDbBackupFile: PropTypes.func,
  isLoading: PropTypes.bool
};

export const WeeklyBackupView = memo((props) => (
  <IndividualBackupView
    {...props}
    data={props.data}
    title="Weekly Backup"
  />
));

WeeklyBackupView.propTypes = {
  data: PropTypes.object,
  weeklyBackupFiles: PropTypes.array,
  selectedWeeklyBackupFile: PropTypes.string,
  onSelectWeeklyBackupFile: PropTypes.func,
  isLoading: PropTypes.bool
};

export const BackupLocalView = memo((props) => (
  <IndividualBackupView
    {...props}
    data={props.data}
    title="Local Backup"
  />
));

BackupLocalView.propTypes = {
  data: PropTypes.object,
  backupLocalFiles: PropTypes.array,
  selectedBackupLocalFile: PropTypes.string,
  onSelectBackupLocalFile: PropTypes.func,
  isLoading: PropTypes.bool
};

export default BackupView;
