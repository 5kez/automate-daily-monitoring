import React, { memo, useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown, FaCalendarAlt, FaDownload } from 'react-icons/fa';
import { useTheme } from '../components/ThemeProvider';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatTimeDisplay } from '../utils/dateTimeFormatter';
import { extractDateFromFilename, extractTimeFromFilename, extractDate } from '../utils/stringUtils';
import { getStatusColor } from '../utils/styleUtils';
import { getTodayDate, getCalendarDaysForMonth } from '../utils/dateUtils';
import { downloadFile, getBasename, replaceBasenameExtension } from '../../store/api';
import { useToast } from '../components/Toast';

// Normalize error objects from both errpt_more and errpt_a_more to a common format
const normalizeError = (error, source = 'errpt_more') => {
  if (!error || typeof error !== 'object') return null;

  if (source === 'errpt_a_more') {
    // errpt_a_more structure
    return {
      identifier: error.identifier,
      timestamp: error.date_time,
      type: error.type === 'PERM' ? 'P' : error.type === 'TEMP' ? 'T' : 'I',
      class: error.class,
      resource: error.resource_name,
      description: error.description,
      // Additional errpt_a_more fields
      label: error.label,
      node_id: error.node_id,
      machine_id: error.machine_id,
      sequence_number: error.sequence_number,
    };
  } else {
    // errpt_more structure - already normalized
    return {
      identifier: error.identifier,
      timestamp: error.timestamp || error.date_time || error.time_stamp || error.datetime || error.date || error.time,
      type: error.type,
      class: error.class,
      resource: error.resource,
      description: error.description,
    };
  }
};

// Extract error count and summary from error_list (errpt_more) or error_detail (errpt_a_more)
const extractErrorSummary = (parsedData) => {
  if (!parsedData) {
    return { count: 0, types: {}, errorsByClass: {}, errorsByType: {}, errorsByResource: {} };
  }

  const types = {};
  const errorsByClass = {};     // Group by class (H=Hardware, S=Software)
  const errorsByType = {};      // Group by type (P=Predictive, T=Temporary, I=Informational)
  const errorsByResource = {};  // Group by resource (rmt0, fscsi0, hdisk1, etc)
  let count = 0;
  let errors = [];
  let source = 'errpt_more';

  // Handle errpt_more (has error_list array)
  if (Array.isArray(parsedData.error_list)) {
    errors = parsedData.error_list;
    source = 'errpt_more';
  }
  // Handle errpt_a_more (has single error_detail object)
  else if (parsedData.error_detail && typeof parsedData.error_detail === 'object') {
    errors = [parsedData.error_detail];
    source = 'errpt_a_more';
  }
  
  // Return early if no errors
  if (errors.length === 0) {
    return { count: 0, types: {}, errorsByClass: {}, errorsByType: {}, errorsByResource: {} };
  }

  errors.forEach((error) => {
    const normalized = normalizeError(error, source);
    if (normalized && normalized.description) {
      count++;
      
      // Group by description (error type)
      const description = normalized.description;
      types[description] = (types[description] || 0) + 1;

      // Group by class (Hardware vs Software)
      const errorClass = normalized.class || 'Unknown';
      const classLabel = errorClass === 'H' ? 'Hardware' : errorClass === 'S' ? 'Software' : 'Unknown';
      errorsByClass[classLabel] = (errorsByClass[classLabel] || 0) + 1;

      // Group by type (Predictive, Temporary, Informational)
      const errorType = normalized.type || 'Unknown';
      const typeLabel = errorType === 'P' ? 'Predictive' : errorType === 'T' ? 'Temporary' : errorType === 'I' ? 'Informational' : 'Unknown';
      errorsByType[typeLabel] = (errorsByType[typeLabel] || 0) + 1;

      // Group by resource
      const resource = normalized.resource || 'Unknown';
      errorsByResource[resource] = (errorsByResource[resource] || 0) + 1;
    }
  });

  return { count, types, errorsByClass, errorsByType, errorsByResource };
};

const ErrorReportSummaryContent = ({ data, isLoading }) => {
  const colors = useThemeColors();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <span style={{ animation: 'spin 2s linear infinite', display: 'inline-block', marginRight: '10px' }}>⟳</span>
        <span>Loading error reports...</span>
      </div>
    );
  }

  if (!data || !data.parsed_data) {
    return (
      <div style={{ padding: '20px', color: colors.text }}>
        No error report data available
      </div>
    );
  }

  const { system, error_list } = data.parsed_data;
  const { count, types, errorsByClass, errorsByType, errorsByResource } = extractErrorSummary(data.parsed_data);

  const typesSorted = Object.entries(types).sort((a, b) => b[1] - a[1]);
  const classEntriesSorted = Object.entries(errorsByClass).sort((a, b) => b[1] - a[1]);
  const typeEntriesSorted = Object.entries(errorsByType).sort((a, b) => b[1] - a[1]);
  const resourceEntriesSorted = Object.entries(errorsByResource).sort((a, b) => b[1] - a[1]).slice(0, 8); // Top 8 resources

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
      {/* Error Count Card */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '8px' }}>Total Errors</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: colors.text }}>{count}</div>
      </div>

      {/* Hostname Card */}
      {system && (
        <div
          style={{
            background: colors.cardBg,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '8px' }}>Hostname</div>
          <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, wordBreak: 'break-word' }}>
            {system.hostname || 'N/A'}
          </div>
        </div>
      )}

      {/* Error Severity Card (Hardware vs Software) */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>Error Severity</div>
        <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.8' }}>
          {classEntriesSorted.length > 0 ? (
            classEntriesSorted.map(([className, count], idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '500' }}>{className}</span>: <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{count} errors</span>
              </div>
            ))
          ) : (
            <span style={{ color: colors.textSecondary }}>No data</span>
          )}
        </div>
      </div>

      {/* Error Classification Card (Predictive, Temporary, Informational) */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>Error Types</div>
        <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.8' }}>
          {typeEntriesSorted.length > 0 ? (
            typeEntriesSorted.map(([errorType, count], idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <span style={{ fontWeight: '500' }}>{errorType}</span>: <span style={{ color: colors.textSecondary, fontSize: '12px' }}>{count} errors</span>
              </div>
            ))
          ) : (
            <span style={{ color: colors.textSecondary }}>No data</span>
          )}
        </div>
      </div>

      {/* Top Error Descriptions Card */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '16px',
          gridColumn: 'span 1',
        }}
      >
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>Top Error Descriptions</div>
        <div style={{ fontSize: '12px', color: colors.text, lineHeight: '1.6', maxHeight: '200px', overflow: 'auto' }}>
          {typesSorted.length > 0 ? (
            typesSorted.map(([type, count], idx) => (
              <div key={idx} style={{ marginBottom: '4px', paddingBottom: '6px', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: '500', fontSize: '12px', marginBottom: '2px' }}>{type}</div>
                <div style={{ color: colors.textSecondary, fontSize: '11px' }}>Count: {count}</div>
              </div>
            ))
          ) : (
            <span style={{ color: colors.textSecondary }}>No errors found</span>
          )}
        </div>
      </div>

      {/* Affected Resources Card */}
      <div
        style={{
          background: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>Affected Resources (Top 8)</div>
        <div style={{ fontSize: '12px', color: colors.text, lineHeight: '1.8' }}>
          {resourceEntriesSorted.length > 0 ? (
            resourceEntriesSorted.map(([resource, count], idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>
                <span style={{ fontWeight: '500', fontSize: '12px' }}>{resource}</span>
              </div>
            ))
          ) : (
            <span style={{ color: colors.textSecondary }}>No resources found</span>
          )}
        </div>
      </div>
    </div>
  );
};

ErrorReportSummaryContent.propTypes = {
  data: PropTypes.shape({
    parsed_data: PropTypes.shape({
      system: PropTypes.shape({
        hostname: PropTypes.string,
      }),
      error_list: PropTypes.array,
    }),
  }),
  isLoading: PropTypes.bool.isRequired,
};

const ErrorReportView = memo(({ 
  data, 
  isLoading, 
  title, 
  subtitle,
  files = [],
  selectedFile = '',
  onSelectFile = () => {},
  serverName = 'ERP-AIX',
  fileType = 'errpt_more'
}) => {
  const { isDark } = useTheme();
  const colors = useThemeColors();
  const toast = useToast();
  
  // Display limit state
  const [displayLimit, setDisplayLimit] = useState(10);
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', order: 'desc' });
  
  // Date/File selection states
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(null);

  // Group files by date
  const filesByDate = useMemo(() => {
    const grouped = {};
    files?.forEach(file => {
      const date = extractDate(file);
      if (date) {
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [files]);

  // Get all unique dates sorted in descending order
  const availableDates = useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);

  // Track if initialization is done
  const isInitializedRef = useRef(false);
  const prevAvailableDatesRef = useRef(null);
  const prevSelectedDateForFileRef = useRef(null);

  // Initialize selected date on first render only
  useEffect(() => {
    // Only initialize once
    if (isInitializedRef.current) {
      return;
    }

    if (!availableDates || availableDates.length === 0) {
      return;
    }
    
    isInitializedRef.current = true;
    prevAvailableDatesRef.current = availableDates;
    
    // Always select the most recent date (first in sorted array)
    setSelectedDate(availableDates[0]);
    setCalendarMonth(availableDates[0]);
  }, [availableDates]);

  // When availableDates actually changes, validate selected date
  useEffect(() => {
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
      }
    }
  }, [availableDates, selectedDate]);

  // Auto-select latest file when date changes
  useEffect(() => {
    if (!selectedDate || !filesByDate[selectedDate]) return;
    // Only auto-select the latest file when the date actually changes
    if (prevSelectedDateForFileRef.current === selectedDate) return;
    prevSelectedDateForFileRef.current = selectedDate;
    const filesForDate = filesByDate[selectedDate];
    if (filesForDate.length > 0) {
      const latestFile = filesForDate.slice().sort().reverse()[0];
      onSelectFile(latestFile);
    }
  }, [selectedDate, filesByDate, onSelectFile]);

  const calendarDays = useMemo(() => calendarMonth ? getCalendarDaysForMonth(calendarMonth) : [], [calendarMonth]);
  const [currentMonth, currentYear] = calendarMonth ? calendarMonth.split('-') : ['', ''];

  // Calendar navigation functions
  const previousMonth = () => {
    if (!calendarMonth) return;
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month) - 2, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const nextMonth = () => {
    if (!calendarMonth) return;
    const [year, month] = calendarMonth.split('-');
    const date = new Date(year, parseInt(month), 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  // Download functions
  const downloadAsJSON = async () => {
    const fileToDownload = selectedFile || files?.[0];
    if (!fileToDownload) {
      toast.error('No file selected');
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
        toast.error('Failed to download JSON file');
      }
    } catch (error) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      setShowDownloadDropdown(false);
    }
  };

  const downloadAsRaw = async () => {
    const fileToDownload = selectedFile || files?.[0];
    if (!fileToDownload) {
      toast.error('No file selected');
      return;
    }
    try {
      // Change filename extension from .json to .txt for backend request
      const fileIdForRaw = replaceBasenameExtension(fileToDownload, '.json', '.txt');
      const downloadName = getBasename(fileIdForRaw) || `${fileType}.txt`;
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

  // Extract timestamp from data
  const lastUpdate = data?.timestamp || null;
  const errorListLength = Array.isArray(data?.parsed_data?.error_list) ? data.parsed_data.error_list.length : 0;
  const hasErrorList = errorListLength > 0;

  const parseTimestamp = (value) => {
    if (!value) {return null;}
    const text = String(value).trim().replace(/\s+/g, ' ');
    if (!text) {return null;}

    const monthMap = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11
    };

    const now = new Date();
    const defaultYear = now.getFullYear();

    // ISO-ish pattern anywhere in string
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1;
      const day = Number(isoMatch[3]);
      const hour = Number(isoMatch[4] || 0);
      const minute = Number(isoMatch[5] || 0);
      const second = Number(isoMatch[6] || 0);
      if ([year, month, day, hour, minute, second].every(Number.isFinite)) {
        return new Date(year, month, day, hour, minute, second).getTime();
      }
    }

    // AIX-like pattern anywhere (weekday optional, year optional)
    const aixMatch = text.match(/(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}):(\d{2})(?::(\d{2}))?(?:\s+\w+)?(?:\s+(\d{4}))?/i);
    if (aixMatch) {
      const month = monthMap[String(aixMatch[2]).toLowerCase()];
      const day = Number(aixMatch[3]);
      const hour = Number(aixMatch[4]);
      const minute = Number(aixMatch[5]);
      const second = aixMatch[6] ? Number(aixMatch[6]) : 0;
      const year = aixMatch[7] ? Number(aixMatch[7]) : defaultYear;
      if ([month, day, hour, minute, second, year].every(Number.isFinite)) {
        return new Date(year, month, day, hour, minute, second).getTime();
      }
    }

    const isoLike = text.replace(' ', 'T');
    const direct = Date.parse(isoLike);
    if (Number.isFinite(direct)) {return direct;}

    return null;
  };

  const getSortedErrors = (errors) => {
    if (!Array.isArray(errors) || !sortConfig?.key) {
      return errors || [];
    }

    const { key, order } = sortConfig;
    const direction = order === 'asc' ? 1 : -1;
    const copy = errors.slice();

    copy.sort((a, b) => {
      if (key === 'timestamp') {
        const aTs = parseTimestamp(a?.timestamp);
        const bTs = parseTimestamp(b?.timestamp);

        if (aTs === null && bTs === null) {return 0;}
        if (aTs === null || bTs === null) {
          const aText = String(a?.timestamp || '').trim();
          const bText = String(b?.timestamp || '').trim();
          if (!aText && !bText) {return 0;}
          if (!aText) {return 1;}
          if (!bText) {return -1;}
          return aText.localeCompare(bText) * direction;
        }
        return aTs < bTs ? -direction : aTs > bTs ? direction : 0;
      }

      return 0;
    });

    return copy;
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: 'asc' };
    });
  };

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        overflowX: 'auto'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
          <h2 style={{ margin: 0, color: colors.text, fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '12px' }}>
              {subtitle}
            </p>
          )}
        </div>
        
        <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end'}}>
          {hasErrorList && (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Show:</label>
              <div style={{position: 'relative'}}>
                <button
                  onClick={() => setShowLimitDropdown(!showLimitDropdown)}
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
                    right: 0,
                    marginTop: '4px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    minWidth: '70px'
                  }}>
                    {[5, 10, 15, 20]
                      .concat(errorListLength && ![5, 10, 15, 20].includes(errorListLength) ? [errorListLength] : [])
                      .map((value) => (
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
                          {value === errorListLength ? 'All' : value}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date, File, and Download selectors */}
          {files && files.length > 0 && (
            <>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Date:</label>
              <div style={{position: 'relative', flex: 1}}>
                <button
                  onClick={() => {
                    setShowDateDropdown(!showDateDropdown);
                    if (!showDateDropdown) {
                      setCalendarMonth(selectedDate);
                      setShowFileDropdown(false);
                      setShowDownloadDropdown(false);
                      setShowLimitDropdown(false);
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
                              cursor: hasFiles ? 'pointer' : 'not-allowed',
                              borderRadius: '4px',
                              fontWeight: isSelected ? '700' : '500',
                              opacity: hasFiles ? 1 : 0.4,
                              pointerEvents: hasFiles ? 'auto' : 'none'
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

            {/* Time/File selector */}
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
              <label style={{fontSize: '12px', color: colors.text, fontWeight: '500', margin: 0}}>Time:</label>
              <div style={{position: 'relative', flex: 1}}>
                <button
                  onClick={() => {
                    setShowFileDropdown(!showFileDropdown);
                    if (!showFileDropdown) {
                      setShowDateDropdown(false);
                      setShowDownloadDropdown(false);
                      setShowLimitDropdown(false);
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
                  <span>{selectedFile ? extractTimeFromFilename(selectedFile) : 'Select time'}</span>
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
                    maxHeight: '200px',
                    overflowY: 'scroll',
                    zIndex: 1000,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  }}>
                    {(filesByDate[selectedDate] || []).length > 0 ? (
                      (filesByDate[selectedDate] || []).slice().sort().reverse().map(file => (
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
                            fontSize: '12px',
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
                      <div style={{padding: '8px 12px', color: colors.text, fontSize: '12px'}}>No files</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Download button */}
            <div style={{position: 'relative'}}>
              <button
                onClick={() => {
                  setShowDownloadDropdown(!showDownloadDropdown);
                  if (!showDownloadDropdown) {
                    setShowDateDropdown(false);
                    setShowFileDropdown(false);
                    setShowLimitDropdown(false);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 14px',
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary} 100%)`,
                  border: `1px solid ${colors.primaryDark || colors.primary}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '700',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0, 82, 204, 0.25)'
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
                <span>Download</span>
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
                    onClick={downloadAsRaw}
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
          </>
          )}
        </div>
      </div>

      {/* Content */}
      <>
          {/* Error Details */}
          {data && data.parsed_data && (
            <div style={{ marginTop: '10px' }}>
              {(() => {
                const isErrptAMore = data.parsed_data.error_detail && !Array.isArray(data.parsed_data.error_list);
                const errors = Array.isArray(data.parsed_data.error_list) ? data.parsed_data.error_list : (data.parsed_data.error_detail ? [data.parsed_data.error_detail] : []);
                const source = Array.isArray(data.parsed_data.error_list) ? 'errpt_more' : 'errpt_a_more';
                const normalizedErrors = errors.map(err => normalizeError(err, source));
                
                if (normalizedErrors.length === 0) return null;

                // For errpt_a_more (single error detail), show detailed card view
                if (isErrptAMore && normalizedErrors.length === 1) {
                  const error = normalizedErrors[0];
                  const rawError = data.parsed_data.error_detail;
                  
                  return (
                    <div>
                      <div style={{
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        padding: '20px',
                      }}>
                        {/* Header Row */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: error.type === 'P' ? '#ff6b6b' : error.type === 'T' ? '#ffa500' : '#4dabf7',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '700',
                          }}>
                            {error.type === 'P' ? 'Predictive' : error.type === 'T' ? 'Temporary' : 'Info'}
                          </span>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: error.class === 'H' ? '#fa5252' : '#ff922b',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: '700',
                          }}>
                            {error.class === 'H' ? 'Hardware' : 'Software'}
                          </span>
                          <span style={{ color: colors.text, fontSize: '13px', fontWeight: '600', marginLeft: 'auto' }}>
                            {error.timestamp}
                          </span>
                        </div>

                        {/* Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div>
                            <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Identifier</div>
                            <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{error.identifier}</div>
                          </div>
                          <div>
                            <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Resource</div>
                            <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{error.resource}</div>
                          </div>
                          {rawError.label && (
                            <div>
                              <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Label</div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{rawError.label}</div>
                            </div>
                          )}
                          {rawError.sequence_number && (
                            <div>
                              <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Sequence #</div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{rawError.sequence_number}</div>
                            </div>
                          )}
                          {rawError.node_id && (
                            <div>
                              <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Node ID</div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{rawError.node_id}</div>
                            </div>
                          )}
                          {rawError.machine_id && (
                            <div>
                              <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Machine ID</div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>{rawError.machine_id}</div>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${colors.border}` }}>
                          <div style={{ color: colors.text, fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Description</div>
                          <div style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', fontWeight: '500' }}>{error.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // For errpt_more (multiple errors), show table view
                const sortedErrors = getSortedErrors(normalizedErrors);
                const displayedErrors = sortedErrors.slice(0, displayLimit);
                
                return (
                  <>
                    <div style={{
                      overflowX: 'auto'
                    }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        tableLayout: 'auto',
                        fontSize: '14px'
                      }}>
                        <thead>
                          <tr style={{borderBottom: `2px solid ${colors.border}`, background: colors.bg}}>
                            <th style={{ padding: '14px 16px', textAlign: 'left', background: colors.bg, fontWeight: '700', userSelect: 'none', fontSize: '15px', color: colors.text, whiteSpace: 'nowrap' }}>Identifier</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', background: colors.bg, fontWeight: '700', userSelect: 'none', fontSize: '15px', color: colors.text, whiteSpace: 'nowrap' }}>Type</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', background: colors.bg, fontWeight: '700', userSelect: 'none', fontSize: '15px', color: colors.text, whiteSpace: 'nowrap' }}>Class</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', background: colors.bg, fontWeight: '700', userSelect: 'none', fontSize: '15px', color: colors.text, whiteSpace: 'nowrap' }}>Resource</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', background: colors.bg, fontWeight: '700', userSelect: 'none', fontSize: '15px', color: colors.text }}>Description</th>
                            <th
                              onClick={() => toggleSort('timestamp')}
                              style={{
                                padding: '14px 16px',
                                textAlign: 'left',
                                background: colors.bg,
                                fontWeight: '700',
                                userSelect: 'none',
                                fontSize: '15px',
                                color: sortConfig?.key === 'timestamp' ? colors.info : colors.text,
                                whiteSpace: 'nowrap',
                                cursor: 'pointer'
                              }}
                            >
                              Timestamp{sortConfig?.key === 'timestamp' ? (sortConfig.order === 'asc' ? ' ▲' : ' ▼') : ''}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedErrors.map((error, idx) => (
                            <tr key={idx} style={{
                              background: idx % 2 === 0 ? colors.bgSecondary : colors.bg,
                              borderBottom: `1px solid ${colors.border}`,
                              transition: 'background-color 0.2s',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = colors.bgSecondary}
                            onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? colors.bgSecondary : colors.bg}
                            >
                              <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                {error.identifier || 'N/A'}
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', color: colors.text, textAlign: 'center', fontWeight: '500' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  background: error.type === 'P' ? '#ff6b6b' : error.type === 'T' ? '#ffa500' : '#4dabf7',
                                  color: 'white',
                                  fontSize: '14px',
                                  fontWeight: '700',
                                }}>
                                  {error.type === 'P' ? 'Predictive' : error.type === 'T' ? 'Temporary' : 'Info'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', color: colors.text, textAlign: 'center', fontWeight: '500' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '6px 12px',
                                  borderRadius: '4px',
                                  background: error.class === 'H' ? '#fa5252' : '#ff922b',
                                  color: 'white',
                                  fontSize: '14px',
                                  fontWeight: '700',
                                }}>
                                  {error.class === 'H' ? 'HW' : 'SW'}
                                </span>
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '500', color: colors.text, whiteSpace: 'nowrap' }}>
                                {error.resource || 'N/A'}
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', color: colors.text, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {error.description || 'N/A'}
                              </td>
                              <td style={{ padding: '14px 16px', fontSize: '14px', color: colors.text, whiteSpace: 'nowrap', fontWeight: '500' }}>
                                {error.timestamp ? error.timestamp.substring(0, 16) : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </>

        <style>
          {`
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    );
  });

  ErrorReportView.displayName = 'ErrorReportView';

ErrorReportView.propTypes = {
  data: PropTypes.shape({
    parsed_data: PropTypes.shape({
      system: PropTypes.shape({
        hostname: PropTypes.string,
      }),
      error_list: PropTypes.array,
    }),
    timestamp: PropTypes.string,
  }),
  isLoading: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  files: PropTypes.array,
  selectedFile: PropTypes.string,
  onSelectFile: PropTypes.func,
  serverName: PropTypes.string,
  fileType: PropTypes.string,
};

// Export both the main view and the specific error report views
export const ErrptMoreView = memo((props) => (
  <ErrorReportView
    {...props}
    title="Error Report (errpt_more)"
  />
));

export const ErrptAMoreView = memo((props) => (
  <ErrorReportView
    {...props}
    title="Advanced Error Report (errpt_a_more)"
  />
));

export default ErrorReportView;
