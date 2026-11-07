import React from 'react';
import PropTypes from 'prop-types';
import { FaCalendarAlt, FaChevronDown } from 'react-icons/fa';
import { downloadFile, getBasename, getFileData, replaceBasenameExtension } from '../../store/api';
import { normalizeTablespacePayload } from '../models/ServerModel';
import { formatFromMb } from '../utils/size';
import { useToast } from '../components/Toast';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import { useThemeColors } from '../utils/theme';
import { extractDateFromFilename, extractTimeFromFilename, extractDate, extractTime, extractDateTime } from '../utils/stringUtils';
import { getTodayDate, getCalendarDaysForMonth } from '../utils/dateUtils';

// View: TableSpaceView.jsx
// Displays tablespace information with sorting and file selection
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

const TableSpaceView = React.memo(({ serverName, tablespaceData, sortConfig, onSort, controller, tablespaceFiles, selectedTablespaceFile, onSelectTablespaceFile, selectedTablespaceFileData, isLoadingFileData, isHomeView = false }) => {
  const hasTablespaceFiles = Array.isArray(tablespaceFiles) && tablespaceFiles.length > 0;
  const toast = useToast();
  const colors = useThemeColors();

  // Use serverName prop if provided (for Home view), otherwise get from controller
  const selectedServerName = serverName || controller?.model?.getSelectedServer?.() || 'DB-01';

  // Use selected file data if available, otherwise use default tablespaceData
  // If selectedTablespaceFile is empty, use the latest file (first in array)
  const effectiveSelectedFile = selectedTablespaceFile || (hasTablespaceFiles ? tablespaceFiles[0] : '');
  const displayTablespaceData = selectedTablespaceFileData?.tablespace || tablespaceData;
  const [displayLimit, setDisplayLimit] = React.useState(20);
  const [showDownloadDropdown, setShowDownloadDropdown] = React.useState(false);
  const [expandedTablespaces, setExpandedTablespaces] = React.useState(() => new Set());

  // Compare snapshot (optional)
  const [compareTablespaceFile, setCompareTablespaceFile] = React.useState('');
  const [compareTablespaceData, setCompareTablespaceData] = React.useState(null);
  const [isCompareLoading, setIsCompareLoading] = React.useState(false);
  const [compareError, setCompareError] = React.useState('');

  // Group files by date
  const filesByDate = React.useMemo(() => {
    const grouped = {};
    tablespaceFiles?.forEach(file => {
      const date = extractDate(file);
      if (date) {
        if (!grouped[date]) {grouped[date] = [];}
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [tablespaceFiles]);

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
          localStorage.setItem('tablespaceSelectedDate', newDate);
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
        localStorage.setItem('tablespaceSelectedDate', selectedDate);
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
      if (selectedTablespaceFile !== latestFile) {
        onSelectTablespaceFile(latestFile);
      }
    }
  }, [selectedDate, filesByDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // State for showing calendar
  const [showDateDropdown, setShowDateDropdown] = React.useState(false);

  // State for showing file dropdown
  const [showFileDropdown, setShowFileDropdown] = React.useState(false);

  // Compare mode UI (optional) - enabled in Home view by default
  const [isCompareEnabled, setIsCompareEnabled] = React.useState(() => isHomeView);
  const [compareSelectedDate, setCompareSelectedDate] = React.useState(selectedDate);
  const [compareCalendarMonth, setCompareCalendarMonth] = React.useState(selectedDate);
  const [showCompareDateDropdown, setShowCompareDateDropdown] = React.useState(false);
  const [showCompareFileDropdown, setShowCompareFileDropdown] = React.useState(false);

  // When switching server, reset compare state so we never compare against stale data.
  React.useEffect(() => {
    // Always reset compare state when server changes
    setIsCompareEnabled(isHomeView);
    setCompareTablespaceFile('');
    setCompareTablespaceData(null);
    setIsCompareLoading(false);
    setCompareError('');
    setShowCompareDateDropdown(false);
    setShowCompareFileDropdown(false);
  }, [selectedServerName, isHomeView]);

  // State for showing display limit dropdown
  const [showLimitDropdown, setShowLimitDropdown] = React.useState(false);

  const toFiniteNumber = (value) => {
    if (value === null || value === undefined) {return null;}
    if (typeof value === 'number') {return Number.isFinite(value) ? value : null;}
    const cleaned = String(value).trim().replace(/%$/, '');
    if (!cleaned) {return null;}
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const normalizeDatafileKey = (value) => String(value || '').trim().toLowerCase();

  const formatDeltaNumber = (value, digits = 2) => {
    if (!Number.isFinite(value)) {return '—';}
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}`;
  };

  const formatMbCell = (value) => Number.isFinite(value) ? formatFromMb(value, { decimals: 2 }) : 'N/A';

  const formatDeltaMbCell = (value) => {
    if (!Number.isFinite(value)) {return '—';}
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatFromMb(Math.abs(value), { decimals: 2 })}`;
  };

  const formatDeltaPercent = (value) => {
    if (!Number.isFinite(value)) {return '—';}
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

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

  const getCalendarDaysForMonth = (monthValue) => {
    const [year, month] = String(monthValue || '').split('-');
    if (!year || !month) {return [];}

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
  };

  // Load compare snapshot when selected
  React.useEffect(() => {
    let cancelled = false;
    if (!isCompareEnabled || !compareTablespaceFile) {
      setCompareTablespaceData(null);
      setCompareError('');
      setIsCompareLoading(false);
      return;
    }

    (async () => {
      setIsCompareLoading(true);
      setCompareError('');
      try {
        const data = await getFileData(selectedServerName, compareTablespaceFile, 'tablespace');
        if (cancelled) {return;}
        const normalized = normalizeTablespacePayload(data);
        setCompareTablespaceData(Array.isArray(normalized) ? normalized : null);
        if (!Array.isArray(normalized)) {setCompareError('Invalid compare snapshot');}
      } catch (err) {
        if (cancelled) {return;}
        setCompareTablespaceData(null);
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
  }, [isCompareEnabled, compareTablespaceFile, selectedServerName]);

  const calendarDays = React.useMemo(() => getCalendarDaysForMonth(calendarMonth), [calendarMonth]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  const compareCalendarDays = React.useMemo(() => getCalendarDaysForMonth(compareCalendarMonth), [compareCalendarMonth]);
  const [compareCurrentMonth, compareCurrentYear] = compareCalendarMonth ? compareCalendarMonth.split('-') : ['', ''];

  const previousMonth = () => {
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month) - 2, 1);
    const newDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    setCalendarMonth(newDate);
  };

  const nextMonth = () => {
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

    if (!compareSelectedDate || !availableDates.includes(compareSelectedDate)) {
      setCompareSelectedDate(baseDate);
      setCompareCalendarMonth(baseDate);
    }

    const primaryFile = effectiveSelectedFile;
    if (!compareTablespaceFile || compareTablespaceFile === primaryFile) {
      // Pass all tablespace files to find yesterday's latest file
      const next = pickDefaultCompareFile(tablespaceFiles || [], primaryFile);
      if (next && next !== compareTablespaceFile) {
        setCompareTablespaceFile(next);
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
    compareSelectedDate,
    compareTablespaceFile,
    effectiveSelectedFile,
    filesByDate
  ]);

  const compareRows = React.useMemo(() => {
    if (!Array.isArray(compareTablespaceData)) {return new Map();}
    const map = new Map();
    for (const row of compareTablespaceData) {
      const key = String(row?.tablespace_name || '');
      if (key) {map.set(key, row);}
    }
    return map;
  }, [compareTablespaceData]);

  const compareDatafilesByTablespace = React.useMemo(() => {
    if (!Array.isArray(compareTablespaceData)) {return new Map();}
    const outer = new Map();

    for (const ts of compareTablespaceData) {
      const tsName = String(ts?.tablespace_name || '').trim();
      if (!tsName) {continue;}
      const datafiles = Array.isArray(ts?.datafiles) ? ts.datafiles : [];
      if (datafiles.length === 0) {continue;}

      const inner = new Map();
      for (const df of datafiles) {
        const key = normalizeDatafileKey(df?.datafile_name);
        if (!key) {continue;}
        inner.set(key, df);
      }

      if (inner.size > 0) {outer.set(tsName, inner);}
    }

    return outer;
  }, [compareTablespaceData]);

  const hasTablespaceData = Array.isArray(displayTablespaceData) && displayTablespaceData.length > 0;

  const sortedTablespace = React.useMemo(() => {
    if (!Array.isArray(displayTablespaceData)) {return [];}

    const sortKey = sortConfig?.tablespace?.key;
    const sortOrder = sortConfig?.tablespace?.order || 'asc';

    if (!isCompareEnabled) {
      if (sortKey === 'delta_used_to_max_percent' || sortKey === 'delta_usage_percent') {return displayTablespaceData;}
      return controller.getSortedData(displayTablespaceData, 'tablespace', sortConfig);
    }

    if (sortKey !== 'delta_used_to_max_percent' && sortKey !== 'delta_usage_percent') {
      return controller.getSortedData(displayTablespaceData, 'tablespace', sortConfig);
    }

    const getDeltaUsedToMax = (ts) => {
      const compareRow = compareRows.get(String(ts?.tablespace_name || ''));
      const currentVal = toFiniteNumber(ts?.used_to_max_percent);
      const compareVal = compareRow ? toFiniteNumber(compareRow?.used_to_max_percent) : null;
      if (currentVal === null || compareVal === null) {return null;}
      return currentVal - compareVal;
    };

    const getDeltaUsage = (ts) => {
      const compareRow = compareRows.get(String(ts?.tablespace_name || ''));
      const currentVal = toFiniteNumber(ts?.used_to_current_percent);
      const compareVal = compareRow ? toFiniteNumber(compareRow?.used_to_current_percent) : null;
      if (currentVal === null || compareVal === null) {return null;}
      return currentVal - compareVal;
    };

    const getDelta = (ts) => (sortKey === 'delta_used_to_max_percent' ? getDeltaUsedToMax(ts) : getDeltaUsage(ts));

    const copy = [...displayTablespaceData];
    copy.sort((a, b) => {
      const aDelta = getDelta(a);
      const bDelta = getDelta(b);

      if (aDelta === null && bDelta === null) {return 0;}
      if (aDelta === null) {return 1;}
      if (bDelta === null) {return -1;}

      if (aDelta < bDelta) {return sortOrder === 'asc' ? -1 : 1;}
      if (aDelta > bDelta) {return sortOrder === 'asc' ? 1 : -1;}
      return 0;
    });

    return copy;
  }, [displayTablespaceData, sortConfig?.tablespace?.key, sortConfig?.tablespace?.order, isCompareEnabled, compareRows, controller]);

  // Optimize: Only slice the data we need to render
  const displayedTablespace = React.useMemo(() => sortedTablespace.slice(0, displayLimit), [sortedTablespace, displayLimit]);

  const toggleExpanded = React.useCallback((tablespaceName) => {
    setExpandedTablespaces((prev) => {
      const next = new Set(prev);
      if (next.has(tablespaceName)) {next.delete(tablespaceName);}
      else {next.add(tablespaceName);}
      return next;
    });
  }, []);

  const DatafilesTable = ({ datafiles, tablespaceName }) => {
    if (!Array.isArray(datafiles) || datafiles.length === 0) {
      return (
        <div style={{ color: colors.textSecondary, fontSize: '13px' }}>No datafiles</div>
      );
    }

    return (
      <div style={{ overflowX: 'hidden' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: colors.text, marginBottom: '10px' }}>
          Datafiles{tablespaceName ? ` — ${tablespaceName}` : ''}
        </div>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          <colgroup>
            <col style={{ width: isCompareEnabled ? '36%' : '44%' }} />
            <col style={{ width: isCompareEnabled ? '10%' : '12%' }} />
            <col style={{ width: isCompareEnabled ? '10%' : '12%' }} />
            {isCompareEnabled && <col style={{ width: '10%' }} />}
            <col style={{ width: isCompareEnabled ? '10%' : '12%' }} />
            {isCompareEnabled && <col style={{ width: '10%' }} />}
            <col style={{ width: isCompareEnabled ? '7%' : '10%' }} />
            {isCompareEnabled && <col style={{ width: '7%' }} />}
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.border}`, background: colors.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Datafile</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Cur</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Used</th>
              {isCompareEnabled && (
                <th style={{ padding: '10px 12px', textAlign: 'right', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Δ Used</th>
              )}
              <th style={{ padding: '10px 12px', textAlign: 'right', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Free</th>
              {isCompareEnabled && (
                <th style={{ padding: '10px 12px', textAlign: 'right', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Δ Free</th>
              )}
              <th style={{ padding: '10px 12px', textAlign: 'center', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Used %</th>
              {isCompareEnabled && (
                <th title="Δ Used%" style={{ padding: '8px 10px', textAlign: 'center', color: colors.text, fontWeight: '700', whiteSpace: 'nowrap', lineHeight: '1.1', fontSize: '12px', overflow: 'hidden', textOverflow: 'clip', verticalAlign: 'top' }}>Δ Used%</th>
              )}
              <th style={{ padding: '10px 12px', textAlign: 'center', color: colors.text, fontWeight: '700', whiteSpace: 'normal', lineHeight: '1.15' }}>Auto Extend</th>
            </tr>
          </thead>
          <tbody>
            {datafiles.map((df, idx) => {
              const usedPercent = Number(df.used_percent) || 0;

              const tsKey = String(tablespaceName || '').trim();
              const compareForTs = tsKey ? compareDatafilesByTablespace.get(tsKey) : null;
              const compareDf = compareForTs ? compareForTs.get(normalizeDatafileKey(df?.datafile_name)) : null;

              const currentUsedMb = Number.isFinite(df.used_mb) ? df.used_mb : null;
              const compareUsedMb = compareDf && Number.isFinite(compareDf.used_mb) ? compareDf.used_mb : null;
              const deltaUsedMb = (currentUsedMb !== null && compareUsedMb !== null) ? (currentUsedMb - compareUsedMb) : null;

              const currentFreeMb = Number.isFinite(df.free_mb) ? df.free_mb : null;
              const compareFreeMb = compareDf && Number.isFinite(compareDf.free_mb) ? compareDf.free_mb : null;
              const deltaFreeMb = (currentFreeMb !== null && compareFreeMb !== null) ? (currentFreeMb - compareFreeMb) : null;

              const currentUsedPct = toFiniteNumber(df.used_percent);
              const compareUsedPct = compareDf ? toFiniteNumber(compareDf.used_percent) : null;
              const deltaUsedPct = (currentUsedPct !== null && compareUsedPct !== null) ? (currentUsedPct - compareUsedPct) : null;
              return (
                <tr
                  key={`${df.datafile_name || 'df'}-${idx}`}
                  style={{
                    background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <td style={{ padding: '10px 12px', color: colors.text, fontWeight: '700', wordBreak: 'break-word', overflowWrap: 'break-word' }} title={df.datafile_name || 'N/A'}>
                    {df.datafile_name || 'N/A'}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.text, textAlign: 'right' }}>{formatMbCell(df.current_size_mb)}</td>
                  <td style={{ padding: '10px 12px', color: colors.text, textAlign: 'right' }}>{formatMbCell(df.used_mb)}</td>
                  {isCompareEnabled && (
                    <td style={{ padding: '10px 12px', color: colors.textSecondary, textAlign: 'right', fontWeight: '800' }}>
                      {formatDeltaMbCell(deltaUsedMb)}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px', color: colors.text, textAlign: 'right' }}>{formatMbCell(df.free_mb)}</td>
                  {isCompareEnabled && (
                    <td style={{ padding: '10px 12px', color: colors.textSecondary, textAlign: 'right', fontWeight: '800' }}>
                      {formatDeltaMbCell(deltaFreeMb)}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{
                      background: usedPercent >= 90 ? '#f85149' : usedPercent >= 80 ? '#d29922' : '#238636',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: 'white'
                    }}>
                      {usedPercent.toFixed(2)}%
                    </span>
                  </td>
                  {isCompareEnabled && (
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '900' }}>
                      {deltaUsedPct !== null ? (
                        <span style={{
                          background: deltaUsedPct > 0 ? '#f85149' : deltaUsedPct < 0 ? '#0969da' : colors.border,
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {formatDeltaPercent(deltaUsedPct)}
                        </span>
                      ) : (
                        <span style={{color: colors.textSecondary}}>—</span>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px', color: colors.text, textAlign: 'center' }}>
                    <span style={{
                      background: df.autoextend === 'YES' ? '#238636' : colors.border,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '800',
                      color: 'white'
                    }}>
                      {df.autoextend || 'N/A'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  DatafilesTable.propTypes = {
    datafiles: PropTypes.array.isRequired,
    tablespaceName: PropTypes.string
  };

  const downloadAsJSON = async () => {
    const fileToDownload = selectedTablespaceFile || tablespaceFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }
    
    try {
      const data = await downloadFile(selectedServerName, 'tablespace', fileToDownload, 'json');
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getBasename(fileToDownload) || 'tablespace.json';
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
    const fileToDownload = selectedTablespaceFile || tablespaceFiles?.[0];
    if (!fileToDownload) {
      toast.error('No file available to download');
      return;
    }

    const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
    const downloadName = getBasename(fileIdForRaw) || 'tablespace.txt';
    try {
      const data = await downloadFile(selectedServerName, 'tablespace', fileIdForRaw, 'raw');
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
    const isActive = sortConfig.tablespace.key === sortKey;
    const arrow = isActive ? (sortConfig.tablespace.order === 'asc' ? ' ▲' : ' ▼') : '';
    
    return (
      <th
        title={label}
        onClick={() => onSort('tablespace', sortKey)}
        style={{
          padding: noWrap ? '10px 10px' : '12px 12px',
          textAlign: 'left',
          cursor: 'pointer',
          background: colors.bg,
          fontWeight: '700',
          userSelect: 'none',
          borderBottom: `2px solid ${colors.border}`,
          fontSize: noWrap ? '13px' : '14px',
          whiteSpace: noWrap ? 'nowrap' : 'normal',
          lineHeight: noWrap ? '1.1' : '1.15',
          overflow: 'hidden',
          textOverflow: 'clip',
          verticalAlign: 'top',
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

  // Show loading state
  if (isLoadingFileData) {
    return (
      <div style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', color: colors.text}}>Tablespace</h2>
        <p style={{margin: 0, color: colors.dimText}}>Loading tablespace data...</p>
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
      overflowX: 'hidden'
    }}>
      <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
          <h2 style={{marginTop: 0, marginBottom: 0, fontSize: '24px', color: colors.text, fontWeight: '700', letterSpacing: '-0.5px'}}>Tablespace</h2>
          {tablespaceFiles && tablespaceFiles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const next = !isCompareEnabled;
                setIsCompareEnabled(next);
                setCompareError('');

                if (!next) {
                  setCompareTablespaceFile('');
                  setCompareTablespaceData(null);
                  setIsCompareLoading(false);
                  setShowCompareDateDropdown(false);
                  setShowCompareFileDropdown(false);
                  return;
                }

                const baseDate = selectedDate && availableDates.includes(selectedDate)
                  ? selectedDate
                  : (availableDates[0] || getTodayDate());
                // Pass all tablespace files to find previous date's latest file
                const compareFile = pickDefaultCompareFile(tablespaceFiles || [], effectiveSelectedFile);
                if (compareFile) {
                  const fileDate = extractDate(compareFile) || baseDate;
                  setCompareSelectedDate(fileDate);
                  setCompareCalendarMonth(fileDate);
                  setCompareTablespaceFile(compareFile);
                } else {
                  setCompareSelectedDate(baseDate);
                  setCompareCalendarMonth(baseDate);
                  setCompareTablespaceFile('');
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
                  {[5, 10, 15, 20].concat(displayTablespaceData?.length && ![5, 10, 15, 20].includes(displayTablespaceData.length) ? [displayTablespaceData.length] : []).map((value, idx) => (
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
                      {value === displayTablespaceData?.length ? 'All' : value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {tablespaceFiles && tablespaceFiles.length > 0 && (
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
                <span>{selectedTablespaceFile ? extractTime(selectedTablespaceFile) : 'Select time'}</span>
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
                  {filesByDate[selectedDate]?.sort().reverse().map(file => (
                    <button
                      key={file}
                      onClick={() => {
                        onSelectTablespaceFile(file);
                        setShowFileDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: 'none',
                        background: selectedTablespaceFile === file ? colors.border : 'transparent',
                        color: colors.text,
                        cursor: 'pointer',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'background 0.2s ease',
                        fontWeight: selectedTablespaceFile === file ? '600' : '400'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedTablespaceFile !== file) {
                          e.currentTarget.style.background = colors.bgSecondary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTablespaceFile !== file) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      {extractTime(file)}
                    </button>
                  )) || (
                    <div style={{padding: '8px 12px', color: colors.textSecondary, fontSize: '12px'}}>No files</div>
                  )}
                </div>
              )}
            </div>
          </div>
            {selectedTablespaceFile && isLoadingFileData && (
              <span style={{fontSize: '11px', color: '#f0883e'}}>Loading...</span>
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
          </>
        )}
        </div>

        </div>
        </div>

        {tablespaceFiles && tablespaceFiles.length > 0 && isCompareEnabled && (
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
                              const [year, month] = compareCalendarMonth.split('-');
                              const date = new Date(year, parseInt(month) - 2, 1);
                              setCompareCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
                            }}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >◀</button>
                          <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{compareCurrentMonth}/{compareCurrentYear}</span>
                          <button
                            onClick={() => {
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
                          {compareCalendarDays.map((day, idx) => {
                            if (!day) {return <div key={`c-empty-${idx}`} />;}
                            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                            const hasFiles = availableDates.includes(dateStr);
                            const isSelected = compareSelectedDate === dateStr;

                            return (
                              <button
                                key={`c-${dateStr}`}
                                onClick={() => {
                                  if (hasFiles) {
                                    setCompareSelectedDate(dateStr);
                                    // Find the latest file for the selected date
                                    const filesForSelectedDate = (tablespaceFiles || [])
                                      .filter(file => {
                                        const fileDate = extractDateFromFilename(file);
                                        return fileDate === dateStr;
                                      })
                                      .sort()
                                      .reverse();
                                    
                                    if (filesForSelectedDate.length > 0) {
                                      setCompareTablespaceFile(filesForSelectedDate[0]);
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
                      title={compareTablespaceFile ? extractDateTime(compareTablespaceFile) : 'No compare snapshot'}
                    >
                      <span>{compareTablespaceFile ? extractTime(compareTablespaceFile) : 'Select time'}</span>
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
                              setCompareTablespaceFile(file);
                              setShowCompareFileDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: compareTablespaceFile === file ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '12px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: compareTablespaceFile === file ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (compareTablespaceFile !== file) {e.currentTarget.style.background = colors.bgSecondary;}
                            }}
                            onMouseLeave={(e) => {
                              if (compareTablespaceFile !== file) {e.currentTarget.style.background = 'transparent';}
                            }}
                          >
                            {extractTime(file)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
            </div>

            {compareTablespaceFile && isCompareLoading && (
              <span style={{fontSize: '11px', color: '#f0883e'}}>Comparing...</span>
            )}
            {compareTablespaceFile && !isCompareLoading && compareError && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span style={{fontSize: '11px', color: '#f85149'}}>{compareError}</span>
                <button
                  onClick={() => {
                    // Trigger reload by toggling compare off and on
                    const file = compareTablespaceFile;
                    setCompareTablespaceFile('');
                    setTimeout(() => setCompareTablespaceFile(file), 0);
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
                  onMouseLeave={(e) => e.target.style.background = '#238636'}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasTablespaceData ? (
        <div style={{
          textAlign: 'center',
          color: colors.text,
          padding: '20px 0'
        }}>
          <h2 style={{marginTop: 0, marginBottom: '12px', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px'}}>Tablespace</h2>
          <p style={{margin: 0, color: colors.textSecondary}}>
          {isLoadingFileData
            ? 'Loading tablespace data...'
            : effectiveSelectedFile
              ? 'No tablespace data available in this file (Oracle returned no rows)'
              : 'Select a file from the Tablespace dropdown to view tablespace data'}
        </p>
        </div>
      ) : (
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontSize: '14px'
      }}>
        <colgroup>
          <col style={{width: isCompareEnabled ? '24%' : '28%'}} />
          <col style={{width: isCompareEnabled ? '9%' : '11%'}} />
          <col style={{width: isCompareEnabled ? '9%' : '11%'}} />
          {isCompareEnabled && <col style={{width: '10%'}} />}
          <col style={{width: isCompareEnabled ? '14%' : '16%'}} />
          <col style={{width: isCompareEnabled ? '18%' : '22%'}} />
          <col style={{width: isCompareEnabled ? '8%' : '12%'}} />
          {isCompareEnabled && <col style={{width: '8%'}} />}
        </colgroup>
        <thead>
          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
            <SortHeader label="Tablespace Name" sortKey="tablespace_name" />
            <SortHeader label="Max Size" sortKey="maximum_size_mb" noWrap />
            <SortHeader label="Used to Max %" sortKey="used_to_max_percent" noWrap />
            {isCompareEnabled && (
              <SortHeader label="Δ Used to Max %" sortKey="delta_used_to_max_percent" noWrap />
            )}
            <SortHeader label="Current Size" sortKey="current_size_mb" noWrap />
            <SortHeader label="Used to Current" sortKey="used_to_current_mb" noWrap />
            <SortHeader label="Usage %" sortKey="used_to_current_percent" />
            {isCompareEnabled && (
              <SortHeader label="Δ Usage %" sortKey="delta_usage_percent" />
            )}
          </tr>
        </thead>
        <tbody>
          {displayedTablespace.flatMap((ts, idx) => {
            const usagePercent = parseFloat(ts.used_to_current_percent) || 0;
            const compareRow = compareRows.get(String(ts.tablespace_name || ''));
            const compareUsedToMax = compareRow ? toFiniteNumber(compareRow.used_to_max_percent) : null;
            const compareUsage = compareRow ? toFiniteNumber(compareRow.used_to_current_percent) : null;
            const currentUsedToMax = toFiniteNumber(ts.used_to_max_percent);
            const currentUsage = toFiniteNumber(ts.used_to_current_percent);
            const deltaUsedToMax = (currentUsedToMax !== null && compareUsedToMax !== null) ? (currentUsedToMax - compareUsedToMax) : null;
            const deltaUsage = (currentUsage !== null && compareUsage !== null) ? (currentUsage - compareUsage) : null;
            const isExpanded = expandedTablespaces.has(ts.tablespace_name);
            const hasDatafiles = Array.isArray(ts.datafiles) && ts.datafiles.length > 0;

            const mainRow = (
              <tr
                key={`ts-${ts.tablespace_name || idx}`}
                style={{
                  background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                  borderBottom: isExpanded ? 'none' : `1px solid ${colors.border}`,
                  transition: 'background-color 0.2s',
                  cursor: hasDatafiles ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (hasDatafiles) {toggleExpanded(ts.tablespace_name);}
                }}
                onMouseEnter={(e) => {
                  if (hasDatafiles) {e.currentTarget.style.background = '#6b7a87';}
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg;
                }}
              >
                <td
                  style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text, wordBreak: 'break-word', overflowWrap: 'break-word'}}
                  title={hasDatafiles ? 'Click to toggle datafiles' : undefined}
                >
                  {ts.tablespace_name || 'N/A'}
                </td>
                <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{formatMbCell(ts.maximum_size_mb)}</td>
                <td style={{padding: '14px 16px', textAlign: 'center'}}>
                  <span style={{
                    background: ts.used_to_max_percent >= 90 ? '#f85149' : ts.used_to_max_percent >= 80 ? '#d29922' : '#238636',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white'
                  }}>
                    {ts.used_to_max_percent?.toFixed?.(2) ?? 'N/A'}%
                  </span>
                </td>
                {isCompareEnabled && (
                  <td style={{padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700'}}>
                    {deltaUsedToMax !== null ? (
                      <span style={{
                        background: deltaUsedToMax > 0 ? colors.error : deltaUsedToMax < 0 ? colors.success : colors.border,
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '4px'
                      }}>
                        {formatDeltaPercent(deltaUsedToMax)}
                      </span>
                    ) : (
                      <span style={{color: colors.textSecondary}}>—</span>
                    )}
                  </td>
                )}
                <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{formatMbCell(ts.current_size_mb)}</td>
                <td style={{padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text}}>{formatMbCell(ts.used_to_current_mb)}</td>
                <td style={{padding: '14px 16px', textAlign: 'center'}}>
                  <span style={{
                    background: usagePercent >= 90 ? '#f85149' : usagePercent >= 80 ? '#d29922' : '#238636',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'white'
                  }}>
                    {usagePercent.toFixed(2)}%
                  </span>
                </td>
                {isCompareEnabled && (
                  <td style={{padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '700'}}>
                    {deltaUsage !== null ? (
                      <span style={{
                        background: deltaUsage > 0 ? colors.error : deltaUsage < 0 ? colors.success : colors.border,
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '4px'
                      }}>
                        {formatDeltaPercent(deltaUsage)}
                      </span>
                    ) : (
                      <span style={{color: colors.textSecondary}}>—</span>
                    )}
                  </td>
                )}
              </tr>
            );

            const detailRow = isExpanded ? (
              <tr key={`df-${ts.tablespace_name || idx}`}
                style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}
              >
                <td colSpan={isCompareEnabled ? 8 : 6} style={{ padding: '16px', background: colors.bg }}>
                  <DatafilesTable datafiles={ts.datafiles} tablespaceName={ts.tablespace_name} />
                </td>
              </tr>
            ) : null;

            return detailRow ? [mainRow, detailRow] : [mainRow];
          })}
        </tbody>
      </table>
      )}
    </div>
  );
});

TableSpaceView.propTypes = {
  serverName: PropTypes.string,
  tablespaceData: PropTypes.array,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  controller: PropTypes.object.isRequired,
  tablespaceFiles: PropTypes.array,
  selectedTablespaceFile: PropTypes.string,
  onSelectTablespaceFile: PropTypes.func.isRequired,
  selectedTablespaceFileData: PropTypes.object,
  isLoadingFileData: PropTypes.bool,
  isHomeView: PropTypes.bool
};

export { TableSpaceView };
