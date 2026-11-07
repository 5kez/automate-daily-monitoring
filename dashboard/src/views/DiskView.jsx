import React from 'react';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import { downloadFile, getBasename, getFileData, replaceBasenameExtension } from '../../store/api';
import { formatBytes, parseSizeToBytes } from '../utils/size';
import { useToast } from '../components/Toast';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import { useThemeColors } from '../utils/theme';
import { extractDateFromFilename, extractTimeFromFilename, extractDate } from '../utils/stringUtils';
import { getTodayDate, getCalendarDaysForMonth } from '../utils/dateUtils';
import { getProgressColor, formatDeltaPercent, formatDfSize } from '../utils/formatUtils';

// View: DiskView.jsx
// Displays disk storage information with sorting and file selection
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

const DiskView = React.memo(({ serverName, diskData, sortConfig, onSort, controller, diskFiles, selectedDiskFile, onSelectDiskFile, selectedDiskFileData, isLoadingFileData, isHomeView = false }) => {
  const toast = useToast();
  const colors = useThemeColors();

  // Use selected file data if available, otherwise use default diskData
  const displayDiskData = selectedDiskFileData?.df || diskData;
  const [displayLimit, setDisplayLimit] = React.useState(() => {
    const data = selectedDiskFileData?.df || diskData;
    return Array.isArray(data) ? data.length : 10;
  });
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);

  // Use serverName prop if provided (for Home view), otherwise get from controller
  const selectedServerName = serverName || controller?.model?.getSelectedServer?.() || 'DB-01';

  // Compare snapshot (optional)
  const [compareDiskFile, setCompareDiskFile] = React.useState('');
  const [compareDiskData, setCompareDiskData] = React.useState(null);
  const [isCompareLoading, setIsCompareLoading] = React.useState(false);
  const [compareError, setCompareError] = React.useState('');

  // Group files by date
  const filesByDate = React.useMemo(() => {
    const grouped = {};
    diskFiles?.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) {grouped[date] = [];}
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [diskFiles]);

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
          localStorage.setItem('diskSelectedDate', newDate);
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
        localStorage.setItem('diskSelectedDate', selectedDate);
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
      if (selectedDiskFile !== latestFile) {
        onSelectDiskFile(latestFile);
      }
    }
  }, [selectedDate, filesByDate]);

  // State for showing calendar
  const [showDateDropdown, setShowDateDropdown] = React.useState(false);

  // State for showing file dropdown
  const [showFileDropdown, setShowFileDropdown] = React.useState(false);

  // Compare mode UI (optional) - enabled in Home view by default
  const [isCompareEnabled, setIsCompareEnabled] = React.useState(() => isHomeView);
  const [compareSelectedDate, setCompareSelectedDate] = React.useState(null);
  const [compareCalendarMonth, setCompareCalendarMonth] = React.useState(null);
  const [showCompareDateDropdown, setShowCompareDateDropdown] = React.useState(false);
  const [showCompareFileDropdown, setShowCompareFileDropdown] = React.useState(false);

  // When switching server, reset compare state so we never compare against stale data.
  React.useEffect(() => {
    // In Home view, enable compare mode; in regular view, disable it
    setIsCompareEnabled(isHomeView);
    setCompareDiskFile('');
    setCompareDiskData(null);
    setIsCompareLoading(false);
    setCompareError('');
    setShowCompareDateDropdown(false);
    setShowCompareFileDropdown(false);
    
    // Initialize compare date to the current selected date
    if (selectedDate) {
      setCompareSelectedDate(selectedDate);
      setCompareCalendarMonth(selectedDate);
    }
  }, [selectedServerName, isHomeView, selectedDate]);

  // State for showing display limit dropdown
  const [showLimitDropdown, setShowLimitDropdown] = React.useState(false);

  const toPercentNumber = (value) => {
    if (value === null || value === undefined) {return null;}
    if (typeof value === 'number') {return Number.isFinite(value) ? value : null;}
    const text = String(value).trim();
    if (!text) {return null;}

    // Accept formats like "12%", "12 %", "12.3%", "12% (warn)", etc.
    const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) {return null;}
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDiskKey = (mountValue, filesystemValue) => String(mountValue || filesystemValue || '').trim();

  const pickDefaultCompareFile = (filesForDate, primaryFile) => {
    const list = Array.isArray(filesForDate) ? filesForDate.slice().sort().reverse() : [];
    if (list.length === 0) {return '';}
    
    // Find the latest file from any date before the current file's date
    // Extract date from primary file or use today
    let currentDateStr = '';
    if (primaryFile) {
      const match = primaryFile.match(/(\d{4})-(\d{2})-(\d{2})/);
      currentDateStr = match ? `${match[1]}-${match[2]}-${match[3]}` : '';
    }
    if (!currentDateStr) {
      const today = new Date();
      currentDateStr = today.toISOString().slice(0, 10);
    }
    
    // Find the first file (latest) from a date earlier than current date
    const previousDateFile = list.find(file => {
      const match = file.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!match) {return false;}
      const fileDate = `${match[1]}-${match[2]}-${match[3]}`;
      return fileDate < currentDateStr;
    });
    
    if (previousDateFile) {return previousDateFile;}
    
    // Fallback: if no previous date file, use previous file in list
    if (!primaryFile) {return list.length > 1 ? list[1] : list[0];}
    const idx = list.indexOf(primaryFile);
    if (idx >= 0 && idx + 1 < list.length) {return list[idx + 1];}
    return list[0];
  };

  // Load compare snapshot when selected
  React.useEffect(() => {
    let cancelled = false;
    if (!isCompareEnabled || !compareDiskFile) {
      setCompareDiskData(null);
      setCompareError('');
      setIsCompareLoading(false);
      return;
    }

    (async () => {
      setIsCompareLoading(true);
      setCompareError('');
      try {
        const data = await getFileData(selectedServerName, compareDiskFile, 'df');
        if (cancelled) {return;}
        // API returns { parsed_df: [...] } for df snapshots; normalize to the same shape
        // we use elsewhere in the UI ({ df: [...] }) so compare logic works.
        if (data && Array.isArray(data.parsed_df)) {
          setCompareDiskData({ df: data.parsed_df });
        } else if (data && Array.isArray(data.df)) {
          setCompareDiskData({ df: data.df });
        } else if (Array.isArray(data)) {
          setCompareDiskData({ df: data });
        } else {
          setCompareDiskData(null);
          setCompareError('Compare snapshot has no disk rows');
        }
      } catch (err) {
        if (cancelled) {return;}
        setCompareDiskData(null);
        const errorMsg = 'Failed to load compare snapshot';
        setCompareError(errorMsg);
        toast.error(`${errorMsg  }: ${  err.message || 'Unknown error'}`);
      } finally {
        if (!cancelled) {setIsCompareLoading(false);}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCompareEnabled, compareDiskFile, selectedServerName]);

  const calendarDays = React.useMemo(() => calendarMonth ? getCalendarDaysForMonth(calendarMonth) : [], [calendarMonth]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  const compareCalendarDays = React.useMemo(() => compareCalendarMonth ? getCalendarDaysForMonth(compareCalendarMonth) : [], [compareCalendarMonth]);
  const [compareCurrentMonth, compareCurrentYear] = compareCalendarMonth ? compareCalendarMonth.split('-') : ['', ''];

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

  React.useEffect(() => {
    if (!isCompareEnabled) {return;}
    const baseDate = selectedDate && availableDates.includes(selectedDate)
      ? selectedDate
      : (availableDates[0] || getTodayDate());

    // Only auto-set compare date if not already set and valid
    if (!compareSelectedDate || !availableDates.includes(compareSelectedDate)) {
      setCompareSelectedDate(baseDate);
      setCompareCalendarMonth(baseDate);
      return; // Exit early to prevent overwriting just-set selections
    }

    // Only auto-select compare file once on initial enable or if empty
    if (!compareDiskFile) {
      // Pass all disk files to find yesterday's latest file
      const next = pickDefaultCompareFile(diskFiles || [], selectedDiskFile);
      if (next) {
        setCompareDiskFile(next);
        // Update compare date to match the selected file
        const fileDate = extractDate(next);
        if (fileDate && fileDate !== compareSelectedDate) {
          setCompareSelectedDate(fileDate);
          setCompareCalendarMonth(fileDate);
        }
      }
    }
  }, [
    isCompareEnabled,
    selectedDate,
    availableDates,
    selectedDiskFile,
    compareDiskFile,
    compareSelectedDate,
    diskFiles
  ]);

  const compareRows = React.useMemo(() => {
    const rows = compareDiskData?.df || compareDiskData?.parsed_df || compareDiskData;
    if (!Array.isArray(rows)) {return new Map();}
    const map = new Map();
    for (const row of rows) {
      const mount = row?.mount ?? row?.mounted_on ?? row?.mount_on ?? '';
      const filesystem = row?.filesystem ?? '';
      const key = normalizeDiskKey(mount, filesystem);
      if (!key) {continue;}
      map.set(key, row);
    }
    return map;
  }, [compareDiskData]);

  const sortedDisk = React.useMemo(() => {
    if (!Array.isArray(displayDiskData)) {return [];}

    const sortKey = sortConfig?.disk?.key;
    const sortOrder = sortConfig?.disk?.order || 'asc';

    if (!isCompareEnabled) {
      if (sortKey === 'delta_use_percent') {return displayDiskData;}
      return controller.getSortedData(displayDiskData, 'disk', sortConfig);
    }

    if (sortKey !== 'delta_use_percent') {
      return controller.getSortedData(displayDiskData, 'disk', sortConfig);
    }

    const getDeltaUse = (disk) => {
      const mount = disk?.mount ?? disk?.mounted_on ?? disk?.mount_on ?? '';
      const filesystem = disk?.filesystem ?? '';
      const key = normalizeDiskKey(mount, filesystem);
      const currentUse = toPercentNumber(disk?.use_percent);
      const compareRow = compareRows.get(key);
      const compareUse = compareRow ? toPercentNumber(compareRow?.use_percent) : null;
      if (currentUse === null || compareUse === null) {return null;}
      return currentUse - compareUse;
    };

    const copy = [...displayDiskData];
    copy.sort((a, b) => {
      const aDelta = getDeltaUse(a);
      const bDelta = getDeltaUse(b);

      if (aDelta === null && bDelta === null) {return 0;}
      if (aDelta === null) {return 1;}
      if (bDelta === null) {return -1;}

      if (aDelta < bDelta) {return sortOrder === 'asc' ? -1 : 1;}
      if (aDelta > bDelta) {return sortOrder === 'asc' ? 1 : -1;}
      return 0;
    });

    return copy;
  }, [displayDiskData, sortConfig?.disk?.key, sortConfig?.disk?.order, isCompareEnabled, compareRows, controller]);

  // Optimize: Only slice the data we need to render
  const displayedDisk = React.useMemo(() => sortedDisk.slice(0, displayLimit), [sortedDisk, displayLimit]);

  const downloadAsJSON = async () => {
    const fileToDownload = selectedDiskFile || diskFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }
    
    try {
      const data = await downloadFile(selectedServerName, 'df', fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || 'df.json';
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
    const fileToDownload = selectedDiskFile || diskFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || 'df.txt';
    try {
      const data = await downloadFile(selectedServerName, 'df', fileIdForRaw, 'raw');
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

  const SortHeader = ({ label, sortKey, noWrap = false }) => {
    const isActive = sortConfig.disk.key === sortKey;
    const arrow = isActive ? (sortConfig.disk.order === 'asc' ? ' ▲' : ' ▼') : '';
    
    return (
      <th
        onClick={() => onSort('disk', sortKey)}
        style={{
          padding: noWrap ? '10px 10px' : '14px 16px',
          textAlign: 'left',
          cursor: 'pointer',
          background: colors.bg,
          fontWeight: '700',
          userSelect: 'none',
          borderBottom: `2px solid ${colors.border}`,
          fontSize: noWrap ? '13px' : '15px',
          whiteSpace: noWrap ? 'nowrap' : 'normal',
          lineHeight: noWrap ? '1.1' : '1.15',
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
    sortKey: PropTypes.string.isRequired,
    noWrap: PropTypes.bool
  };

  const ProgressBar = ({ percentage }) => (
    <div style={{
      width: '100%',
      height: '6px',
      background: colors.border,
      borderRadius: '3px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: percentage ,
        height: '100%',
        background: getProgressColor(percentage),
        transition: 'width 0.3s'
      }} />
    </div>
  );
  
  ProgressBar.propTypes = {
    percentage: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired
  };

  const hasDiskData = Array.isArray(displayDiskData) && displayDiskData.length > 0;

  if (isLoadingFileData) {
    return (
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '40px 20px',
        marginBottom: '20px',
        textAlign: 'center',
        color: colors.text
      }}>
        <div className="spinning" style={{ fontSize: '32px', color: colors.info, marginBottom: '16px' }}>⟳</div>
        <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: colors.text}}>Loading data for this server...</h2>
        <p style={{margin: 0, color: colors.textSecondary}}>Fetching latest stats, processes, disks, and tablespace.</p>
      </div>
    );
  }

  if (isLoadingFileData) {
    return (
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        textAlign: 'center',
        color: colors.dimText
      }}>
        <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px'}}>Disk Storage</h2>
        <p style={{margin: 0, color: colors.dimText}}>Loading disk data...</p>
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
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
          <h2 style={{marginTop: 0, marginBottom: 0, fontSize: '24px', color: colors.text, fontWeight: '700', letterSpacing: '-0.5px'}}>Disk Storage</h2>
          {diskFiles && diskFiles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = !isCompareEnabled;
                setIsCompareEnabled(next);
                setCompareError('');

                if (!next) {
                  setCompareDiskFile('');
                  setCompareDiskData(null);
                  setIsCompareLoading(false);
                  setShowCompareDateDropdown(false);
                  setShowCompareFileDropdown(false);
                  return;
                }

                const baseDate = selectedDate && availableDates.includes(selectedDate)
                  ? selectedDate
                  : (availableDates[0] || getTodayDate());
                // Pass all disk files to find previous date's latest file
                const compareFile = pickDefaultCompareFile(diskFiles || [], selectedDiskFile);
                if (compareFile) {
                  const fileDate = extractDate(compareFile) || baseDate;
                  setCompareSelectedDate(fileDate);
                  setCompareCalendarMonth(fileDate);
                  setCompareDiskFile(compareFile);
                } else {
                  setCompareSelectedDate(baseDate);
                  setCompareCalendarMonth(baseDate);
                  setCompareDiskFile('');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: colors.text,
                fontSize: '12px',
                fontWeight: '700'
              }}
              title="Toggle compare mode"
            >
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: isCompareEnabled ? colors.success : colors.border
              }} />
              Compare
            </button>
          )}
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end'}}>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          {/* Limit selector */}
          <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
            <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Show:</label>
            <div style={{position: 'relative'}}>
              <button
                onClick={() => {
                  setShowLimitDropdown(!showLimitDropdown);
                  if (!showLimitDropdown) {
                    setShowDateDropdown(false);
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
                  {[5, 10, 15, 20].concat(displayDiskData?.length && ![5, 10, 15, 20].includes(displayDiskData.length) ? [displayDiskData.length] : []).map((value, idx) => (
                    <button
                      key={value}
                      onClick={() => {
                        setDisplayLimit(value);
                        setShowLimitDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: displayLimit === value ? colors.border : 'transparent',
                        color: colors.text,
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'background 0.2s ease',
                        fontWeight: displayLimit === value ? '600' : '400'
                      }}
                      onMouseEnter={(e) => {
                        if (displayLimit !== value) {
                          e.currentTarget.style.background = colors.bgSecondary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (displayLimit !== value) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {value === displayDiskData?.length ? 'All' : value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {diskFiles && diskFiles.length > 0 && (
            <>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Date:</label>
                <div style={{position: 'relative', flex: 1}}>
                  <button
                    onClick={() => {
                      setShowDateDropdown(!showDateDropdown);
                      if (!showDateDropdown) {
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
                    <span>{selectedDate}</span>
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
                        {calendarDays && calendarDays.map((day, idx) => {
                          if (!day) {
                            return <div key={`empty-${idx}`} />;
                          }
                          // Handle both string dates and Date objects
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
                        setShowLimitDropdown(false);
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
                    <span>{selectedDiskFile ? extractTimeFromFilename(selectedDiskFile) : 'Select time'}</span>
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
                                onSelectDiskFile(file);
                                setShowFileDropdown(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: selectedDiskFile === file ? colors.border : 'transparent',
                                color: colors.text,
                                cursor: 'pointer',
                                fontSize: '12px',
                                textAlign: 'left',
                                transition: 'background 0.2s ease',
                                fontWeight: selectedDiskFile === file ? '600' : '400'
                              }}
                              onMouseEnter={(e) => {
                                if (selectedDiskFile !== file) {
                                  e.currentTarget.style.background = colors.bgSecondary;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedDiskFile !== file) {
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
                {selectedDiskFile && isLoadingFileData && (
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
        </div>

        {diskFiles && diskFiles.length > 0 && isCompareEnabled && (
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Compare Date:</label>
              <div style={{position: 'relative', flex: 1}}>
                    <button
                      onClick={() => {
                        setShowCompareDateDropdown(!showCompareDateDropdown);
                        if (!showCompareDateDropdown) {
                          setCompareCalendarMonth(compareSelectedDate);
                          setShowLimitDropdown(false);
                          setShowDateDropdown(false);
                          setShowFileDropdown(false);
                          setShowDownloadDropdown(false);
                          setShowCompareFileDropdown(false);
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
                      <span>{compareSelectedDate}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: showCompareDateDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}>
                        <FaChevronDown style={{color: colors.info}} />
                      </span>
                    </button>

                    {showCompareDateDropdown && (
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
                          <button
                            onClick={() => {
                              if (!compareCalendarMonth) {
                                return;
                              }
                              const [year, month] = compareCalendarMonth.split('-');
                              const date = new Date(year, parseInt(month) - 2, 1);
                              setCompareCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
                            }}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >◀</button>
                          <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{compareCurrentMonth}/{compareCurrentYear}</span>
                          <button
                            onClick={() => {
                              if (!compareCalendarMonth) {
                                return;
                              }
                              const [year, month] = compareCalendarMonth.split('-');
                              const date = new Date(year, parseInt(month), 1);
                              setCompareCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
                            }}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >▶</button>
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} style={{textAlign: 'center', fontSize: '11px', color: colors.text, fontWeight: '600'}}>
                              {day}
                            </div>
                          ))}
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px'}}>
                          {compareCalendarDays && compareCalendarDays.map((day, idx) => {
                            if (!day) {return <div key={`c-empty-${idx}`} />;}
                            // Handle both string dates and Date objects
                            const dateStr = typeof day === 'string' ? day : `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                            const hasFiles = availableDates.includes(dateStr);
                            const isSelected = compareSelectedDate === dateStr;

                            return (
                              <button
                                key={`c-${dateStr}`}
                                onClick={() => {
                                  if (hasFiles) {
                                    setCompareSelectedDate(dateStr);
                                    // Find the latest file for the selected date
                                    const filesForSelectedDate = (diskFiles || [])
                                      .filter(file => {
                                        const fileDate = extractDateFromFilename(file);
                                        return fileDate === dateStr;
                                      })
                                      .sort()
                                      .reverse();
                                    
                                    if (filesForSelectedDate.length > 0) {
                                      setCompareDiskFile(filesForSelectedDate[0]);
                                    }
                                    setShowCompareDateDropdown(false);
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
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Compare Time:</label>
              <div style={{position: 'relative', flex: 1}}>
                    <button
                      onClick={() => {
                        setShowCompareFileDropdown(!showCompareFileDropdown);
                        if (!showCompareFileDropdown) {
                          setShowLimitDropdown(false);
                          setShowDateDropdown(false);
                          setShowFileDropdown(false);
                          setShowDownloadDropdown(false);
                          setShowCompareDateDropdown(false);
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
                      <span>{compareDiskFile ? extractTimeFromFilename(compareDiskFile) : 'Select time'}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: showCompareFileDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}>
                        <FaChevronDown style={{color: colors.info}} />
                      </span>
                    </button>

                    {showCompareFileDropdown && (
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
                      }} className="hide-scrollbar">
                        {(filesByDate[compareSelectedDate] || []).slice().sort().reverse().map(file => (
                          <button
                            key={`c-${file}`}
                            onClick={() => {
                              setCompareDiskFile(file);
                              setShowCompareFileDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: compareDiskFile === file ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '12px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: compareDiskFile === file ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (compareDiskFile !== file) {e.currentTarget.style.background = colors.bgSecondary;}
                            }}
                            onMouseLeave={(e) => {
                              if (compareDiskFile !== file) {e.currentTarget.style.background = 'transparent';}
                            }}
                          >
                            {extractTimeFromFilename(file)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
            </div>

            {compareDiskFile && isCompareLoading && (
              <span style={{fontSize: '11px', color: '#f0883e'}}>Comparing...</span>
            )}
            {compareDiskFile && !isCompareLoading && compareError && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span style={{fontSize: '11px', color: '#f85149'}}>{compareError}</span>
                <button
                  onClick={() => {
                    // Trigger reload by toggling compare off and on
                    const file = compareDiskFile;
                    setCompareDiskFile('');
                    setTimeout(() => setCompareDiskFile(file), 0);
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: '10px',
                    background: '#238636',
                    color: colors.text,
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.target.style.background = colors.success}
                  onMouseLeave={(e) => e.target.style.background = colors.success}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '14px'
      }}>
        <colgroup>
          <col style={{width: '32%'}} />
          <col style={{width: '13%'}} />
          <col style={{width: '13%'}} />
          <col style={{width: '13%'}} />
          <col style={{width: '7%'}} />
          {isCompareEnabled && <col style={{width: '8%'}} />}
          <col style={{width: isCompareEnabled ? '14%' : '22%'}} />
        </colgroup>
        <thead>
          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
            <SortHeader label="Filesystem" sortKey="filesystem" />
            <SortHeader label="Size" sortKey="size" />
            <SortHeader label="Used" sortKey="used" />
            <SortHeader label="Avail" sortKey="avail" />
            <SortHeader label="Use%" sortKey="use_percent" noWrap />
            {isCompareEnabled && (
              <SortHeader label="Δ Use%" sortKey="delta_use_percent" noWrap />
            )}
            <SortHeader label="Mount On" sortKey="mount" />
          </tr>
        </thead>
        <tbody>
          {displayedDisk.map((disk, idx) => (
            (() => {
              const mount = disk?.mount ?? disk?.mounted_on ?? disk?.mount_on ?? '';
              const filesystem = disk?.filesystem ?? '';
              const key = normalizeDiskKey(mount, filesystem);

              const currentUse = toPercentNumber(disk?.use_percent);
              const compareRow = compareRows.get(key);
              const compareUse = compareRow ? toPercentNumber(compareRow?.use_percent) : null;
              const deltaUse = (currentUse !== null && compareUse !== null) ? (currentUse - compareUse) : null;

              return (
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
              <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text, wordBreak: 'break-word', overflowWrap: 'break-word'}}>{disk.filesystem}</td>
              <td title={String(disk.size ?? '')} style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{formatDfSize(disk.size)}</td>
              <td title={String(disk.used ?? '')} style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{formatDfSize(disk.used)}</td>
              <td title={String(disk.avail ?? '')} style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500'}}>{formatDfSize(disk.avail)}</td>
              <td style={{padding: '14px 16px', textAlign: 'center'}}>
                {(() => {
                  const percentNum = typeof disk.use_percent === 'string' 
                    ? parseFloat(disk.use_percent.replace('%', '')) 
                    : disk.use_percent;
                  const bgColor = percentNum >= 90 ? '#f85149' : percentNum >= 80 ? '#d29922' : '#238636';
                  return (
                    <span style={{background: bgColor, padding: '6px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: '700', color: 'white'}}>
                      {disk.use_percent}
                    </span>
                  );
                })()}
              </td>
              {isCompareEnabled && (
                <td style={{padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700'}}>
                  {deltaUse !== null ? (
                    <span style={{
                      background: deltaUse > 0 ? colors.error : deltaUse < 0 ? colors.success : colors.border,
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '4px'
                    }}>
                      {formatDeltaPercent(deltaUse)}
                    </span>
                  ) : (
                    <span style={{color: colors.textSecondary}}>—</span>
                  )}
                </td>
              )}
              <td style={{padding: '14px 16px', fontSize: '14px', color: colors.text, fontWeight: '500', wordBreak: 'break-word', overflowWrap: 'break-word'}}>{mount}</td>
            </tr>
              );
            })()
          ))}
        </tbody>
      </table>
    </div>
  );
});

DiskView.propTypes = {
  serverName: PropTypes.string,
  diskData: PropTypes.array,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  controller: PropTypes.object.isRequired,
  diskFiles: PropTypes.array,
  selectedDiskFile: PropTypes.string,
  onSelectDiskFile: PropTypes.func.isRequired,
  selectedDiskFileData: PropTypes.object,
  isLoadingFileData: PropTypes.bool,
  isHomeView: PropTypes.bool
};

export { DiskView };
