// View: StatsView.jsx
// Displays system statistics (CPU, Memory, Swap)
// Performance: Memoized component with lazy loading support

import { useEffect, useMemo, useRef, useState, memo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getFileData } from '../../store/api';
import { FaChevronDown } from 'react-icons/fa';
import { FiRefreshCw } from 'react-icons/fi';
import { useToast } from '../components/Toast';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import { useThemeColors } from '../utils/theme';
import { extractDateFromFilename } from '../utils/stringUtils';
import { parseFileTimestamp, formatDateInput, getTodayDate, getCalendarDaysForMonth } from '../utils/dateUtils';
import { getProgressColor } from '../utils/formatUtils';

const StatsView = memo(({ data, selectedTopFileData, selectedTopFile = '', topFiles = [], controller, systemName = 'DB-01', lastUpdated = '', uptime = '', onSelectTopFile, onRefresh = null, isLoading = false, isRefreshing = false, isHomeView = false }) => {
  const toast = useToast();
  const colors = useThemeColors();
  const [memoryUnit, setMemoryUnit] = useState('GB'); // GB, MB, KB
  const [swapUnit, setSwapUnit] = useState('GB');
  const [hoveredMemoryUnit, setHoveredMemoryUnit] = useState(null);
  const [hoveredSwapUnit, setHoveredSwapUnit] = useState(null);
  const [cpuViewMode, setCpuViewMode] = useState('DETAILS'); // DETAILS | DONUT
  const [memoryViewMode, setMemoryViewMode] = useState('DETAILS'); // DETAILS | DONUT
  const [swapViewMode, setSwapViewMode] = useState('DETAILS'); // DETAILS | DONUT
  const [cpuChartMode, setCpuChartMode] = useState('DAY_RANGE'); // DAY_RANGE | MONTH | YEAR
  const [ramChartMode, setRamChartMode] = useState('DAY_RANGE'); // DAY_RANGE | MONTH | YEAR
  const [cpuChartLoading, setCpuChartLoading] = useState(false);
  const [cpuChartError, setCpuChartError] = useState('');
  const [cpuChartData, setCpuChartData] = useState([]);
  const [ramChartLoading, setRamChartLoading] = useState(false);
  const [ramChartError, setRamChartError] = useState('');
  const [ramChartData, setRamChartData] = useState([]);
  const [showSwapOverlay, setShowSwapOverlay] = useState(isHomeView);
  const [cpuDayStart, setCpuDayStart] = useState(''); // YYYY-MM-DD
  const [cpuDayEnd, setCpuDayEnd] = useState(''); // YYYY-MM-DD
  const [cpuMonth, setCpuMonth] = useState(''); // YYYY-MM
  const [cpuYear, setCpuYear] = useState(''); // YYYY
  const [ramDayStart, setRamDayStart] = useState(''); // YYYY-MM-DD
  const [ramDayEnd, setRamDayEnd] = useState(''); // YYYY-MM-DD
  const [ramMonth, setRamMonth] = useState(''); // YYYY-MM
  const [ramYear, setRamYear] = useState(''); // YYYY
  const cpuUsedCacheRef = useRef(new Map()); // filename -> cpuUsed
  const ramSwapCacheRef = useRef(new Map()); // filename -> { ramUsedPct, swapUsedPct }

  const cpuChartPngRef = useRef(null);
  const ramChartPngRef = useRef(null);

  const cpuRangeUserSelectedRef = useRef(false);
  const cpuMonthUserSelectedRef = useRef(false);
  const cpuYearUserSelectedRef = useRef(false);

  const ramRangeUserSelectedRef = useRef(false);
  const ramMonthUserSelectedRef = useRef(false);
  const ramYearUserSelectedRef = useRef(false);

  const [showCpuMonthDropdown, setShowCpuMonthDropdown] = useState(false);
  const [showCpuYearDropdown, setShowCpuYearDropdown] = useState(false);

  const [showRamMonthDropdown, setShowRamMonthDropdown] = useState(false);
  const [showRamYearDropdown, setShowRamYearDropdown] = useState(false);

  // DAY_RANGE: calendar dropdown with drag-to-select range
  const [isCpuRangeDragging, setIsCpuRangeDragging] = useState(false);
  const [cpuRangeDragStart, setCpuRangeDragStart] = useState(''); // YYYY-MM-DD
  const [cpuRangeDragEnd, setCpuRangeDragEnd] = useState(''); // YYYY-MM-DD
  const lastCpuAnchorKeyRef = useRef('');
  const lastAutoMonthSwitchRef = useRef(0);

  const [isRamRangeDragging, setIsRamRangeDragging] = useState(false);
  const [ramRangeDragStart, setRamRangeDragStart] = useState(''); // YYYY-MM-DD
  const [ramRangeDragEnd, setRamRangeDragEnd] = useState(''); // YYYY-MM-DD
  const lastRamAnchorKeyRef = useRef('');
  const lastAutoMonthSwitchRamRef = useRef(0);

  // Keep card height stable when switching view modes
  const usageCardMinHeight = 360;
  
  // Use selected file data if available, otherwise use default data
  const displayData = selectedTopFileData || data;

  // Handle both direct top data and parsed_top structure from API
  const topData = displayData?.parsed_top || displayData?.top || displayData;

  // loadavg can be at topData.loadavg (APP-01) or topData.system.loadavg (Home)
  const loadavgData = topData?.loadavg || topData?.system?.loadavg;

  const hasTopStats = !!(topData && topData.cpu && topData.memory && topData.swap);

  // Safe number conversion helper
  const toNumber = (value) => {
    if (typeof value === 'number') {return value;}
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const ChartTooltip = ({ active, payload, label, valueFormatter }) => {
    if (!active || !Array.isArray(payload) || payload.length === 0) {return null;}

    const rows = payload
      .filter((p) => p && p.value !== undefined && p.value !== null)
      // Hide internal stack helper keys if any appear.
      .filter((p) => !String(p.dataKey || '').toLowerCase().includes('trend') || true);

    return (
      <div style={{ background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '10px 12px' }}>
        <div style={{ color: colors.info, fontSize: '12px', fontWeight: 800, marginBottom: '6px' }}>{label}</div>
        <div style={{ display: 'grid', gap: '4px' }}>
          {rows.map((p, idx) => {
            const color = p.color || p.stroke || p.fill || colors.textSecondary;
            const valueText = valueFormatter ? valueFormatter(p.value) : String(p.value);
            return (
              <div key={`${p.dataKey || p.name || 'row'}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', fontWeight: 700 }}>
                <span style={{ color, whiteSpace: 'nowrap' }}>{p.name || p.dataKey}</span>
                <span style={{ color: colors.textSecondary }}>{valueText}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  ChartTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
    label: PropTypes.string,
    valueFormatter: PropTypes.func
  };

  const sanitizeForFilename = (value) => String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  const downloadSvgAsPng = async ({ rootEl, fileNameBase }) => {
    const container = rootEl?.current || rootEl;
    if (!container) {return;}

    // Recharts can render multiple SVGs (e.g., main chart + Brush).
    // Pick the largest visible SVG so we export the real chart, not the tiny brush preview.
    const svgs = Array.from(container.querySelectorAll('svg'));
    if (svgs.length === 0) {return;}

    const svg = svgs
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect && rect.width > 1 && rect.height > 1)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0]?.el;

    if (!svg) {return;}

    // Clone to avoid mutating the live chart
    const clonedSvg = svg.cloneNode(true);

    // Ensure explicit dimensions so rasterization is crisp
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));
    clonedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Add a background so it doesn't export transparent
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', colors.bg);
    clonedSvg.insertBefore(bg, clonedSvg.firstChild);

    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    try {
      const img = new Image();
      img.decoding = 'async';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });

      const scale = 2; // export at 2x for readability
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {return;}
      ctx.imageSmoothingEnabled = true;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const safeServer = sanitizeForFilename(systemName) || 'server';
      const safeBase = sanitizeForFilename(fileNameBase) || 'chart';
      const filename = `${safeServer}-${safeBase}-${ts}.png`;

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const computeCpuYDomainFromData = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    let min = Infinity;
    let max = -Infinity;

    for (const row of list) {
      const values = [row?.cpuUsed, row?.avgTrend, row?.maxTrend].map((v) => toNumber(v)).filter((v) => Number.isFinite(v));
      for (const v of values) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {return { min: 0, max: 100 };}

    // Keep within percent bounds.
    min = clamp(min, 0, 100);
    max = clamp(max, 0, 100);

    // Add a small padding so bars/lines don't touch the frame.
    const rawRange = Math.max(0, max - min);
    const pad = clamp(Math.max(1, Math.round(rawRange * 0.1)), 1, 10);
    let nextMin = clamp(min - pad, 0, 100);
    let nextMax = clamp(max + pad, 0, 100);

    // Round to readable steps.
    const range = Math.max(1, nextMax - nextMin);
    const step = range <= 10 ? 1 : 5;
    nextMin = clamp(Math.floor(nextMin / step) * step, 0, 100);
    nextMax = clamp(Math.ceil(nextMax / step) * step, 0, 100);

    if (nextMax - nextMin < 1) {
      nextMax = clamp(nextMin + 1, 0, 100);
      nextMin = clamp(nextMax - 1, 0, 100);
    }

    return { min: nextMin, max: nextMax };
  };

  const cpuYDomain = useMemo(() => computeCpuYDomainFromData(cpuChartData), [cpuChartData]);

  const percentOf = (part, total) => {
    const safeTotal = toNumber(total);
    if (safeTotal <= 0) {return 0;}
    return (toNumber(part) / safeTotal) * 100;
  };

  const cpuYAxisTicks = useMemo(() => {
    const min = clamp(Math.floor(toNumber(cpuYDomain.min)), 0, 100);
    const max = clamp(Math.ceil(toNumber(cpuYDomain.max)), 0, 100);
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const range = safeMax - safeMin;

    // Prefer 5% steps for readability; fall back to 1% when very zoomed in.
    const step = range <= 10 ? 1 : 5;
    const first = Math.ceil(safeMin / step) * step;

    const ticks = [safeMin];
    for (let v = first; v <= safeMax; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== safeMax) {ticks.push(safeMax);}

    // Unique + clamped
    return Array.from(new Set(ticks.map((v) => clamp(Math.round(v), 0, 100)))).sort((a, b) => a - b);
  }, [cpuYDomain.min, cpuYDomain.max]);

  const percentTicks0100 = useMemo(() => [0, 20, 40, 60, 80, 100], []);

  const DonutChart = ({ percent, color, size = 120, strokeWidth = 12, valueDecimals = 0 }) => {
    const clamped = clamp(toNumber(percent), 0, 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;
    const gap = circumference - dash;

    return (
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '14px'}}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.border}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{transition: 'stroke-dasharray 0.3s ease'}}
          />
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#fff"
            fontSize="22"
            fontWeight="800"
          >
            {clamped.toFixed(valueDecimals)}%
          </text>
        </svg>
      </div>
    );
  };
  
  DonutChart.propTypes = {
    percent: PropTypes.number.isRequired,
    color: PropTypes.string.isRequired,
    size: PropTypes.number,
    strokeWidth: PropTypes.number,
    valueDecimals: PropTypes.number
  };

  const ViewModeToggle = ({ value, onChange }) => (
    <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`, alignSelf: 'flex-end'}}>
      {['DETAILS', 'DONUT'].map(mode => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            background: value === mode ? colors.success : 'transparent',
            color: value === mode ? '#fff' : '#fff',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (value !== mode) {
              e.target.style.color = colors.info;
              e.target.style.background = `${colors.primary}20`;
            }
          }}
          onMouseLeave={(e) => {
            if (value !== mode) {
              e.target.style.color = '#fff';
              e.target.style.background = 'transparent';
            }
          }}
        >
          {mode}
        </button>
      ))}
    </div>
  );

  ViewModeToggle.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
  };

  const CpuChartModeToggle = ({ value, onChange }) => (
    <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`}}>
      {[
        { key: 'DAY_RANGE', label: 'Day Range' },
        { key: 'MONTH', label: 'Month' },
        { key: 'YEAR', label: 'Year' }
      ].map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onChange(mode.key)}
          style={{
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: '700',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            background: value === mode.key ? colors.success : 'transparent',
            color: value === mode.key ? '#fff' : '#fff',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (value !== mode.key) {
              e.target.style.color = colors.info;
              e.target.style.background = `${colors.primary}20`;
            }
          }}
          onMouseLeave={(e) => {
            if (value !== mode.key) {
              e.target.style.color = '#fff';
              e.target.style.background = 'transparent';
            }
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  CpuChartModeToggle.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired
  };

  // Day range validation: if start > end, swap automatically.
  useEffect(() => {
    if (!cpuDayStart || !cpuDayEnd) {return;}
    // ISO date strings (YYYY-MM-DD) can be compared lexicographically.
    if (cpuDayStart > cpuDayEnd) {
      const start = cpuDayStart;
      const end = cpuDayEnd;
      setCpuDayStart(end);
      setCpuDayEnd(start);
    }
  }, [cpuDayStart, cpuDayEnd]);

  useEffect(() => {
    if (!ramDayStart || !ramDayEnd) {return;}
    if (ramDayStart > ramDayEnd) {
      const start = ramDayStart;
      const end = ramDayEnd;
      setRamDayStart(end);
      setRamDayEnd(start);
    }
  }, [ramDayStart, ramDayEnd]);

  const formatMonthInput = (date) => {
    if (!date) {return '';}
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  const dateKey = (date) => {
    if (!date) {return '';}
    // Handle timestamp object from parseFileTimestamp
    if (typeof date === 'object' && date.year && date.month && date.day) {
      return `${date.year}-${date.month}-${date.day}`;
    }
    // Handle Date object
    if (date instanceof Date) {
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };

  const monthKey = (date) => {
    if (!date) {return '';}
    // Handle timestamp object from parseFileTimestamp
    if (typeof date === 'object' && date.year && date.month) {
      return `${date.year}-${date.month}`;
    }
    // Handle Date object
    if (date instanceof Date) {
      const yyyy = String(date.getFullYear());
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      return `${yyyy}-${mm}`;
    }
    return '';
  };

  const selectedTopFileTs = useMemo(() => parseFileTimestamp(selectedTopFile), [selectedTopFile]);

  // Calendar-style date dropdown (same concept as Running Processes date picker)
  const filesByDate = useMemo(() => {
    const grouped = {};
    for (const file of topFiles || []) {
      const d = extractDateFromFilename(file);
      if (!d) {continue;}
      if (!grouped[d]) {grouped[d] = [];}
      grouped[d].push(file);
    }
    return grouped;
  }, [topFiles]);

  const availableDates = useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);

  const [showCpuDateDropdown, setShowCpuDateDropdown] = useState(false);
  const [cpuCalendarMonth, setCpuCalendarMonth] = useState(() => {
    const base = selectedTopFileTs ? formatDateInput(selectedTopFileTs) : (availableDates[0] || '');
    return base ? `${base.slice(0, 7)}-01` : '';
  });

  const [showRamDateDropdown, setShowRamDateDropdown] = useState(false);
  const [ramCalendarMonth, setRamCalendarMonth] = useState(() => {
    const base = selectedTopFileTs ? formatDateInput(selectedTopFileTs) : (availableDates[0] || '');
    return base ? `${base.slice(0, 7)}-01` : '';
  });

  useEffect(() => {
    // Keep calendar month aligned with selected file date
    const base = selectedTopFileTs ? formatDateInput(selectedTopFileTs) : '';
    if (!base) {return;}
    const month = `${base.slice(0, 7)}-01`;
    setCpuCalendarMonth(month);
  }, [selectedTopFileTs]);

  useEffect(() => {
    const base = selectedTopFileTs ? formatDateInput(selectedTopFileTs) : '';
    if (!base) {return;}
    const month = `${base.slice(0, 7)}-01`;
    setRamCalendarMonth(month);
  }, [selectedTopFileTs]);

  const cpuCalendarDays = useMemo(() => {
    if (!cpuCalendarMonth) {return [];}
    const [year, month] = cpuCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const days = [];

    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) {days.push(null);}

    while (date.getMonth() === parseInt(month, 10) - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return days;
  }, [cpuCalendarMonth]);

  const ramCalendarDays = useMemo(() => {
    if (!ramCalendarMonth) {return [];}
    const [year, month] = ramCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const days = [];

    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) {days.push(null);}

    while (date.getMonth() === parseInt(month, 10) - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    return days;
  }, [ramCalendarMonth]);

  const cpuPrevMonth = () => {
    if (!cpuCalendarMonth) {return;}
    const [year, month] = cpuCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 2, 1);
    setCpuCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const ramPrevMonth = () => {
    if (!ramCalendarMonth) {return;}
    const [year, month] = ramCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 2, 1);
    setRamCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const cpuNextMonth = () => {
    if (!cpuCalendarMonth) {return;}
    const [year, month] = cpuCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 0, 1);
    setCpuCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const ramNextMonth = () => {
    if (!ramCalendarMonth) {return;}
    const [year, month] = ramCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 0, 1);
    setRamCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`);
  };

  const maybeAutoSwitchMonth = (direction) => {
    if (!isCpuRangeDragging) {return;}
    const now = Date.now();
    // throttle to avoid rapid month-jumps while hovering
    if (now - lastAutoMonthSwitchRef.current < 300) {return;}
    lastAutoMonthSwitchRef.current = now;

    if (direction === 'prev') {cpuPrevMonth();}
    if (direction === 'next') {cpuNextMonth();}
  };

  const maybeAutoSwitchRamMonth = (direction) => {
    if (!isRamRangeDragging) {return;}
    const now = Date.now();
    if (now - lastAutoMonthSwitchRamRef.current < 300) {return;}
    lastAutoMonthSwitchRamRef.current = now;

    if (direction === 'prev') {ramPrevMonth();}
    if (direction === 'next') {ramNextMonth();}
  };

  // Group snapshot files by day (YYYY-MM-DD). If a day has multiple files, we'll average that day.
  const filesByDay = useMemo(() => {
    const map = new Map();
    for (const fileName of topFiles || []) {
      const ts = parseFileTimestamp(fileName);
      if (!ts) {continue;}
      const key = dateKey(ts);
      const list = map.get(key) || [];
      list.push({ fileName, ts });
      map.set(key, list);
    }
    // Sort each day by timestamp for stable behavior.
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        // Create comparable timestamp from year, month, day, hour, minute, second
        const aTime = `${a.ts.year}${a.ts.month}${a.ts.day}${a.ts.hour}${a.ts.minute}${a.ts.second}`;
        const bTime = `${b.ts.year}${b.ts.month}${b.ts.day}${b.ts.hour}${b.ts.minute}${b.ts.second}`;
        return aTime.localeCompare(bTime);
      });
      map.set(key, list);
    }
    return map;
  }, [topFiles]);

  const dayKeysSorted = useMemo(() => Array.from(filesByDay.keys()).sort(), [filesByDay]);

  const availableDateSet = useMemo(() => {
    const set = new Set();
    for (const key of dayKeysSorted) {set.add(key);}
    return set;
  }, [dayKeysSorted]);

  useEffect(() => {
    if (!isCpuRangeDragging) {return;}
    const onUp = () => setIsCpuRangeDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isCpuRangeDragging]);

  useEffect(() => {
    if (!isRamRangeDragging) {return;}
    const onUp = () => setIsRamRangeDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isRamRangeDragging]);

  const availableYears = useMemo(() => {
    const years = new Set();
    for (const key of dayKeysSorted) {years.add(key.slice(0, 4));}
    return Array.from(years).sort();
  }, [dayKeysSorted]);

  const availableMonthsForYear = useMemo(() => {
    const months = new Set();
    for (const key of dayKeysSorted) {
      const y = key.slice(0, 4);
      if (cpuYear && y !== cpuYear) {continue;}
      months.add(key.slice(0, 7));
    }
    return Array.from(months).sort();
  }, [dayKeysSorted, cpuYear]);

  const availableRamMonthsForYear = useMemo(() => {
    const months = new Set();
    for (const key of dayKeysSorted) {
      const y = key.slice(0, 4);
      if (ramYear && y !== ramYear) {continue;}
      months.add(key.slice(0, 7));
    }
    return Array.from(months).sort();
  }, [dayKeysSorted, ramYear]);

  const availableMonthsAll = useMemo(() => {
    const months = new Set();
    for (const key of dayKeysSorted) {months.add(key.slice(0, 7));}
    return Array.from(months).sort();
  }, [dayKeysSorted]);

  const availableMinDate = useMemo(() => {
    if (!dayKeysSorted.length) {return '';}
    return dayKeysSorted[0];
  }, [dayKeysSorted]);

  const availableMaxDate = useMemo(() => {
    if (!dayKeysSorted.length) {return '';}
    return dayKeysSorted[dayKeysSorted.length - 1];
  }, [dayKeysSorted]);

  useEffect(() => {
    if (!dayKeysSorted.length) {return;}

    // Default DAY_RANGE = latest available day and the prior 3 available days (reduced from 7 for faster load).
    // Do not jump to "today" when there's no file yet.
    const fallbackIdx = dayKeysSorted.length - 1;
    const anchorKey = dayKeysSorted[fallbackIdx];

    // If user already picked a range manually, don't overwrite it.
    if (cpuRangeUserSelectedRef.current) {
      // still allow month/year defaults to track the anchor (but don't override explicit picks)
      const anchorDayKey = anchorKey;
      setCpuYear((prev) => (cpuYearUserSelectedRef.current ? prev : (prev || anchorDayKey.slice(0, 4))));
      setCpuMonth((prev) => (cpuMonthUserSelectedRef.current ? prev : (prev || anchorDayKey.slice(0, 7))));
      lastCpuAnchorKeyRef.current = anchorKey;
      return;
    }

    // If user hasn't manually picked a range and the anchor day hasn't changed, don't overwrite.
    if (cpuDayStart && cpuDayEnd && lastCpuAnchorKeyRef.current === anchorKey) {return;}
    lastCpuAnchorKeyRef.current = anchorKey;

    const idx = fallbackIdx;
    const anchorDayKey = anchorKey;

    setCpuYear((prev) => (cpuYearUserSelectedRef.current ? prev : anchorDayKey.slice(0, 4)));
    setCpuMonth((prev) => (cpuMonthUserSelectedRef.current ? prev : anchorDayKey.slice(0, 7)));

    // Day range = 7 available days ending at the anchor day
    const days = 7;
    const startIdx = Math.max(0, idx - (days - 1));
    setCpuDayEnd(anchorDayKey);
    setCpuDayStart(dayKeysSorted[startIdx]);
  }, [dayKeysSorted]);

  useEffect(() => {
    if (!dayKeysSorted.length) {return;}

    const fallbackIdx = dayKeysSorted.length - 1;
    const anchorKey = dayKeysSorted[fallbackIdx];

    if (ramRangeUserSelectedRef.current) {
      const anchorDayKey = anchorKey;
      setRamYear((prev) => (ramYearUserSelectedRef.current ? prev : (prev || anchorDayKey.slice(0, 4))));
      setRamMonth((prev) => (ramMonthUserSelectedRef.current ? prev : (prev || anchorDayKey.slice(0, 7))));
      lastRamAnchorKeyRef.current = anchorKey;
      return;
    }

    if (ramDayStart && ramDayEnd && lastRamAnchorKeyRef.current === anchorKey) {return;}
    lastRamAnchorKeyRef.current = anchorKey;

    const idx = fallbackIdx;
    const anchorDayKey = anchorKey;

    setRamYear((prev) => (ramYearUserSelectedRef.current ? prev : anchorDayKey.slice(0, 4)));
    setRamMonth((prev) => (ramMonthUserSelectedRef.current ? prev : anchorDayKey.slice(0, 7)));

    const days = 7;
    const startIdx = Math.max(0, idx - (days - 1));
    setRamDayEnd(anchorDayKey);
    setRamDayStart(dayKeysSorted[startIdx]);
  }, [dayKeysSorted]);

  const selectedRamDayKeys = useMemo(() => {
    if (!dayKeysSorted.length) {return [];}

    if (ramChartMode === 'YEAR') {
      const year = ramYear || dayKeysSorted[dayKeysSorted.length - 1].slice(0, 4);
      return dayKeysSorted.filter((k) => k.startsWith(`${year}-`));
    }

    if (ramChartMode === 'MONTH') {
      const month = ramMonth || dayKeysSorted[dayKeysSorted.length - 1].slice(0, 7);
      return dayKeysSorted.filter((k) => k.startsWith(`${month}-`));
    }

    const startKey = ramDayStart || dayKeysSorted[0];
    const endKey = ramDayEnd || dayKeysSorted[dayKeysSorted.length - 1];
    const safeStart = startKey <= endKey ? startKey : endKey;
    const safeEnd = startKey <= endKey ? endKey : startKey;
    return dayKeysSorted.filter((k) => k >= safeStart && k <= safeEnd);
  }, [dayKeysSorted, ramChartMode, ramDayStart, ramDayEnd, ramMonth, ramYear]);

  const selectedCpuDayKeys = useMemo(() => {
    if (!dayKeysSorted.length) {return [];}

    if (cpuChartMode === 'YEAR') {
      const year = cpuYear || dayKeysSorted[dayKeysSorted.length - 1].slice(0, 4);
      return dayKeysSorted.filter((k) => k.startsWith(`${year}-`));
    }

    if (cpuChartMode === 'MONTH') {
      const month = cpuMonth || dayKeysSorted[dayKeysSorted.length - 1].slice(0, 7);
      return dayKeysSorted.filter((k) => k.startsWith(`${month}-`));
    }

    // DAY_RANGE: user-selected start/end (YYYY-MM-DD). Compare lexicographically.
    const startKey = cpuDayStart || dayKeysSorted[0];
    const endKey = cpuDayEnd || dayKeysSorted[dayKeysSorted.length - 1];
    const safeStart = startKey <= endKey ? startKey : endKey;
    const safeEnd = startKey <= endKey ? endKey : startKey;

    return dayKeysSorted.filter((k) => k >= safeStart && k <= safeEnd);
  }, [dayKeysSorted, cpuChartMode, cpuDayStart, cpuDayEnd, cpuMonth, cpuYear]);

  const computeTrend = (points, valueKey) => {
    let runningSum = 0;
    let runningMax = 0;
    return points.map((p, idx) => {
      const value = toNumber(p[valueKey]);
      runningSum += value;
      runningMax = Math.max(runningMax, value);
      return {
        ...p,
        avgTrend: runningSum / (idx + 1),
        maxTrend: runningMax
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasTopStats || !systemName || !selectedCpuDayKeys.length) {
        setCpuChartData([]);
        setCpuChartError('');
        return;
      }

      setCpuChartLoading(true);
      setCpuChartError('');

      try {
        // Build DAILY rows. Use ONLY the latest file per day for faster loading.
        const dailyResults = await Promise.all(
          selectedCpuDayKeys.map(async (dayKey) => {
            const files = filesByDay.get(dayKey) || [];
            // Use only the latest file per day (sorted by timestamp descending)
            const latestFile = files[0];
            
            let used = 0;
            if (latestFile) {
              const cacheKey = `${systemName}::${latestFile.fileName}`;
              const cached = cpuUsedCacheRef.current.get(cacheKey);
              if (typeof cached === 'number') {
                used = cached;
              } else {
                const response = await getFileData(systemName, latestFile.fileName, 'top');
                const cpu = response?.parsed_top?.cpu;
                const idle = toNumber(cpu?.idle);
                used = clamp(100 - idle, 0, 100);
                cpuUsedCacheRef.current.set(cacheKey, used);
              }
            }

            const ts = new Date(`${dayKey}T12:00:00`);
            return {
              ts,
              date: dayKey,
              month: dayKey.slice(0, 7),
              label: `${dayKey.slice(5, 7)}-${dayKey.slice(8, 10)}`,
              cpuUsed: used
            };
          })
        );

        if (cancelled) {return;}

        if (cpuChartMode === 'YEAR') {
          // Bar = avg per month from DAILY AVERAGE values
          const byMonth = new Map();
          for (const r of dailyResults) {
            const key = r.month;
            const current = byMonth.get(key) || { key, ts: r.ts, sum: 0, count: 0 };
            current.sum += r.cpuUsed;
            current.count += 1;
            // Keep earliest ts in the month for stable sort label
            if (r.ts.getTime() < current.ts.getTime()) {current.ts = r.ts;}
            byMonth.set(key, current);
          }
          const months = Array.from(byMonth.values())
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((m) => ({
              label: m.key,
              cpuUsed: m.count ? m.sum / m.count : 0
            }));
          setCpuChartData(computeTrend(months, 'cpuUsed'));
        } else {
          // Day range / Month: Bar = DAILY AVERAGE value
          const days = dailyResults
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((r) => ({ label: r.label, cpuUsed: r.cpuUsed }));
          setCpuChartData(computeTrend(days, 'cpuUsed'));
        }
      } catch (e) {
        if (!cancelled) {
          const errorMsg = 'Failed to load CPU chart data';
          setCpuChartError(errorMsg);
          setCpuChartData([]);
          toast.error(`${errorMsg  }: ${  e.message || 'Unknown error'}`);
        }
      } finally {
        if (!cancelled) {setCpuChartLoading(false);}
      }
    };

    load();
    return () => { cancelled = true; };
  }, [hasTopStats, systemName, selectedCpuDayKeys, cpuChartMode, filesByDay, cpuYear, cpuMonth]);


  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!hasTopStats || !systemName || !selectedRamDayKeys.length) {
        setRamChartData([]);
        setRamChartError('');
        return;
      }

      setRamChartLoading(true);
      setRamChartError('');

      try {
        const dailyResults = await Promise.all(
          selectedRamDayKeys.map(async (dayKey) => {
            const files = filesByDay.get(dayKey) || [];

            // Use only the latest file per day for faster loading
            let ramUsedPct = 0;
            let swapUsedPct = 0;
            
            const latestFile = files[0];
            if (latestFile) {
              const cacheKey = `${systemName}::${latestFile.fileName}`;
              const cached = ramSwapCacheRef.current.get(cacheKey);
              if (cached && typeof cached.ramUsedPct === 'number' && typeof cached.swapUsedPct === 'number') {
                ramUsedPct = cached.ramUsedPct;
                swapUsedPct = cached.swapUsedPct;
              } else {
                const response = await getFileData(systemName, latestFile.fileName, 'top');
                const memory = response?.parsed_top?.memory;
                const swap = response?.parsed_top?.swap;

                ramUsedPct = clamp(percentOf(memory?.used_kb, memory?.total_kb), 0, 100);
                swapUsedPct = clamp(percentOf(swap?.used_kb, swap?.total_kb), 0, 100);
                ramSwapCacheRef.current.set(cacheKey, { ramUsedPct, swapUsedPct });
              }
            }

            const ts = new Date(`${dayKey}T12:00:00`);
            return {
              ts,
              dayKey,
              month: dayKey.slice(0, 7),
              label: ramChartMode === 'YEAR'
                ? dayKey.slice(0, 7)
                : `${dayKey.slice(5, 7)}-${dayKey.slice(8, 10)}`,
              ramUsed: ramUsedPct,
              ramCacheFree: clamp(100 - ramUsedPct, 0, 100),
              swapUsed: swapUsedPct,
              swapFree: clamp(100 - swapUsedPct, 0, 100)
            };
          })
        );

        if (cancelled) {return;}

        if (ramChartMode === 'YEAR') {
          // Bar = avg per month from DAILY AVERAGE values
          const byMonth = new Map();
          for (const r of dailyResults) {
            const key = r.month;
            const current = byMonth.get(key) || { key, ts: r.ts, ramSum: 0, swapSum: 0, count: 0 };
            current.ramSum += r.ramUsed;
            current.swapSum += r.swapUsed;
            current.count += 1;
            if (r.ts.getTime() < current.ts.getTime()) {current.ts = r.ts;}
            byMonth.set(key, current);
          }

          const months = Array.from(byMonth.values())
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((m) => {
              const ramUsed = m.count ? (m.ramSum / m.count) : 0;
              const swapUsed = m.count ? (m.swapSum / m.count) : 0;
              return {
                label: m.key,
                ramUsed,
                ramCacheFree: clamp(100 - ramUsed, 0, 100),
                swapUsed,
                swapFree: clamp(100 - swapUsed, 0, 100)
              };
            });

          // Trend lines based on RAM used
          setRamChartData(computeTrend(months, 'ramUsed'));
        } else {
          const days = dailyResults
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((r) => ({
              label: r.label,
              ramUsed: r.ramUsed,
              ramCacheFree: r.ramCacheFree,
              swapUsed: r.swapUsed,
              swapFree: r.swapFree
            }));

          setRamChartData(computeTrend(days, 'ramUsed'));
        }
      } catch (e) {
        if (!cancelled) {
          const errorMsg = 'Failed to load RAM/Swap chart data';
          setRamChartError(errorMsg);
          setRamChartData([]);
          toast.error(`${errorMsg  }: ${  e.message || 'Unknown error'}`);
        }
      } finally {
        if (!cancelled) {setRamChartLoading(false);}
      }
    };

    load();
    return () => { cancelled = true; };
  }, [hasTopStats, systemName, selectedRamDayKeys, ramChartMode, filesByDay, ramYear, ramMonth]);


  // Render loading or placeholder after hooks to keep hook order stable.
  if (isLoading) {
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

  // Early return null if no data
  if (!hasTopStats) {
    return null;
  }

  const ProgressBar = ({ value, label }) => {
    const percentage = Math.min(value, 100);
    return (
      <div style={{marginBottom: '12px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
          <label style={{fontSize: '14px', fontWeight: '500'}}>{label}</label>
          <span style={{fontSize: '14px', color: colors.text}}>{percentage.toFixed(1)}%</span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: colors.border,
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage  }%`,
            height: '100%',
            background: getProgressColor(percentage),
            transition: 'width 0.3s'
          }} />
        </div>
      </div>
    );
  };

  ProgressBar.propTypes = {
    value: PropTypes.number.isRequired,
    label: PropTypes.string.isRequired
  };

  const formatBytes = (kb) => {
    const gb = kb / (1024 * 1024);
    return `${gb.toFixed(0)  }GB`;
  };

  const formatBytesWithUnit = (kb, unit = 'GB') => {
    if (unit === 'GB') {
      const gb = kb / (1024 * 1024);
      return `${gb.toFixed(2)  } GB`;
    } else if (unit === 'MB') {
      const mb = kb / 1024;
      return `${mb.toFixed(2)  } MB`;
    } else {
      return `${kb.toFixed(0)  } KB`;
    }
  };

  const StatCard = ({ label, value, color = colors.info }) => (
    <div style={{
      background: colors.bg,
      padding: '16px',
      borderRadius: '8px',
      border: `1px solid ${colors.border}`,
      textAlign: 'center',
      transition: 'all 0.3s ease',
      cursor: 'default',
      ':hover': {
        borderColor: color,
        boxShadow: `0 0 12px ${color}40`
      }
    }}
    onMouseEnter={(e) => {
      e.target.style.borderColor = color;
      e.target.style.boxShadow = `0 0 12px ${color}40`;
      e.target.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.target.style.borderColor = colors.border;
      e.target.style.boxShadow = 'none';
      e.target.style.transform = 'translateY(0)';
    }}>
      <p style={{margin: '0 0 6px 0', color: colors.text, fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px'}}>{label}</p>
      <p style={{margin: 0, fontSize: '24px', fontWeight: '800', color, letterSpacing: '-0.5px'}}>{value}</p>
    </div>
  );

  StatCard.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    color: PropTypes.string
  };

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '24px 28px',
      marginBottom: '20px',
      boxShadow: 'none'
    }}>
      {/* Header with System Info and Refresh Button */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px'}}>
        <div>
          <h1 style={{margin: '0 0 8px 0', fontSize: '28px', fontWeight: '800', color: colors.text}}>{systemName}</h1>
          <p style={{margin: 0, fontSize: '12px', color: colors.text}}>Last updated: <span style={{color: colors.info, fontWeight: '600'}}>{lastUpdated || 'N/A'}</span></p>
        </div>
        {onRefresh && (
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
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            opacity: isRefreshing ? 0.6 : 1,
            transition: 'all 0.2s ease',
            boxShadow: isRefreshing ? 'none' : '0 4px 12px rgba(0, 82, 204, 0.25)'
          }}
          onClick={onRefresh}
          disabled={isRefreshing}
          onMouseEnter={(e) => {
            if (!isRefreshing) {
              e.target.style.background = `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`;
              e.target.style.boxShadow = '0 6px 16px rgba(0, 82, 204, 0.3)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRefreshing) {
              e.target.style.background = `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`;
              e.target.style.boxShadow = '0 4px 12px rgba(0, 82, 204, 0.2)';
            }
          }}>
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      <h2 id="trend-charts" style={{
        marginTop: 0,
        marginBottom: '20px',
        fontSize: '24px',
        fontWeight: '700',
        letterSpacing: '-0.5px',
        color: colors.text
      }}>Trend Charts</h2>

      {/* CPU Bar + Line Trend */}
      <div style={{
        marginBottom: '24px',
        background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap'}}>
          <h3 style={{margin: 0, fontSize: '18px', fontWeight: '800', color: colors.warning, textTransform: 'uppercase', letterSpacing: '0.5px'}}>CPU Trend</h3>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
            {cpuChartMode === 'DAY_RANGE' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Range:</span>
                <div style={{position: 'relative', minWidth: '200px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuDateDropdown((v) => !v);
                      const base = cpuDayEnd || (selectedTopFileTs ? formatDateInput(selectedTopFileTs) : (availableDates[0] || ''));
                      if (base) {setCpuCalendarMonth(`${base.slice(0, 7)}-01`);}
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
                      alignItems: 'center'
                    }}
                  >
                    <span>{cpuDayStart && cpuDayEnd ? `${cpuDayStart} → ${cpuDayEnd}` : 'Select range'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showCpuDateDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>

                  {showCpuDateDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
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
                            type="button"
                            onClick={cpuPrevMonth}
                            onMouseEnter={() => maybeAutoSwitchMonth('prev')}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >
                            ◀
                          </button>
                        <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{cpuCalendarMonth ? `${cpuCalendarMonth.slice(5, 7)}/${cpuCalendarMonth.slice(0, 4)}` : ''}</span>
                          <button
                            type="button"
                            onClick={cpuNextMonth}
                            onMouseEnter={() => maybeAutoSwitchMonth('next')}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >
                            ▶
                          </button>
                      </div>

                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                          <div key={d} style={{textAlign: 'center', fontSize: '11px', color: colors.text, fontWeight: '600'}}>{d}</div>
                        ))}
                      </div>

                      <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px'}}>
                        {cpuCalendarDays.map((day, idx) => {
                          if (!day) {return <div key={`empty-${idx}`} />;}

                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                          const hasFiles = availableDateSet.has(dateStr);

                          const dragStart = isCpuRangeDragging ? cpuRangeDragStart : '';
                          const dragEnd = isCpuRangeDragging ? (cpuRangeDragEnd || cpuRangeDragStart) : '';
                          const rangeStart = (dragStart || cpuDayStart) || '';
                          const rangeEnd = (dragEnd || cpuDayEnd) || '';
                          const minRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : (rangeStart || rangeEnd);
                          const maxRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : (rangeStart || rangeEnd);
                          const inRange = minRange && maxRange && dateStr >= minRange && dateStr <= maxRange;
                          const isBoundary = minRange && maxRange && (dateStr === minRange || dateStr === maxRange);

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onMouseDown={() => {
                                setCpuRangeDragStart(dateStr);
                                setCpuRangeDragEnd(dateStr);
                                setIsCpuRangeDragging(true);
                              }}
                              onMouseEnter={() => {
                                if (!isCpuRangeDragging) {return;}
                                setCpuRangeDragEnd(dateStr);
                              }}
                              onMouseUp={() => {
                                if (!isCpuRangeDragging) {return;}
                                const start = cpuRangeDragStart;
                                const end = cpuRangeDragEnd || dateStr;
                                if (!start || !end) {
                                  setIsCpuRangeDragging(false);
                                  return;
                                }
                                const min = start <= end ? start : end;
                                const max = start <= end ? end : start;
                                cpuRangeUserSelectedRef.current = true;
                                setCpuDayStart(min);
                                setCpuDayEnd(max);
                                setIsCpuRangeDragging(false);
                                setShowCpuDateDropdown(false);
                              }}
                              style={{
                                padding: '6px',
                                fontSize: '11px',
                                border: isBoundary ? `2px solid ${colors.info}` : 'none',
                                background: isBoundary
                                  ? colors.bgSecondary
                                  : inRange
                                    ? `${colors.primary}20`
                                    : colors.bg,
                                color: hasFiles ? colors.text : colors.textTertiary,
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontWeight: isBoundary ? '700' : '500',
                                userSelect: 'none'
                              }}
                              title={hasFiles ? 'Has data' : 'No data for this day'}
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
            )}

            {cpuChartMode === 'MONTH' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Month:</span>
                <div style={{position: 'relative', minWidth: '140px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuMonthDropdown((v) => !v);
                      if (!showCpuMonthDropdown) {
                        setShowCpuYearDropdown(false);
                        setShowCpuDateDropdown(false);
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
                    <span>{cpuMonth || 'Select month'}</span>
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: showCpuMonthDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>

                  {showCpuMonthDropdown && (
                    <div
                      style={{
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
                      {availableMonthsAll.slice().sort().reverse().map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            cpuMonthUserSelectedRef.current = true;
                            setCpuMonth(m);
                            setShowCpuMonthDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: cpuMonth === m ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                            fontWeight: cpuMonth === m ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (cpuMonth !== m) {e.currentTarget.style.background = colors.bgSecondary;}
                          }}
                          onMouseLeave={(e) => {
                            if (cpuMonth !== m) {e.currentTarget.style.background = 'transparent';}
                          }}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {cpuChartMode === 'YEAR' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Year:</span>
                <div style={{position: 'relative', minWidth: '110px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuYearDropdown((v) => !v);
                      if (!showCpuYearDropdown) {
                        setShowCpuMonthDropdown(false);
                        setShowCpuDateDropdown(false);
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
                    <span>{cpuYear || 'Select year'}</span>
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: showCpuYearDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>

                  {showCpuYearDropdown && (
                    <div
                      style={{
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
                      {availableYears.slice().sort().reverse().map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            cpuYearUserSelectedRef.current = true;
                            setCpuYear(y);

                            // Keep month within year if user previously picked a month
                            if (cpuMonth && cpuMonth.slice(0, 4) !== y) {
                              const months = availableMonthsForYear.filter((m) => m.startsWith(y));
                              if (months.length) {
                                cpuMonthUserSelectedRef.current = true;
                                setCpuMonth(months[months.length - 1]);
                              }
                            }

                            setShowCpuYearDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: cpuYear === y ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            transition: 'background 0.2s ease',
                            fontWeight: cpuYear === y ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (cpuYear !== y) {e.currentTarget.style.background = colors.bgSecondary;}
                          }}
                          onMouseLeave={(e) => {
                            if (cpuYear !== y) {e.currentTarget.style.background = 'transparent';}
                          }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <CpuChartModeToggle value={cpuChartMode} onChange={setCpuChartMode} />
          </div>
        </div>

        {cpuChartError ? (
          <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{color: colors.error, fontSize: '12px'}}>{cpuChartError}</span>
            <button
              onClick={() => {
                // Clear error and trigger reload by resetting error state
                setCpuChartError('');
                setCpuChartLoading(true);
                // Re-render will trigger useEffect to reload
              }}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                background: colors.success,
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
        ) : cpuChartLoading || !topFiles || topFiles.length === 0 ? (
          <ChartSkeleton />
        ) : cpuChartData.length === 0 && !cpuChartError ? (
          <ChartSkeleton />
        ) : cpuChartData.length === 0 ? (
          <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px'}}>
            No CPU history data available.
          </div>
        ) : (
          <div style={{width: '100%'}}>
            <div ref={cpuChartPngRef} style={{width: '100%', height: '280px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cpuChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    stroke={colors.textTertiary}
                    tick={{ fontSize: 11, fill: colors.text }}
                    axisLine={{ stroke: colors.textTertiary }}
                    tickLine={{ stroke: colors.textTertiary }}
                  />
                  <YAxis
                    domain={[cpuYDomain.min, cpuYDomain.max]}
                    ticks={cpuYAxisTicks}
                    stroke={colors.textTertiary}
                    tick={{ fontSize: 11, fill: colors.text }}
                    axisLine={{ stroke: colors.textTertiary }}
                    tickLine={{ stroke: colors.textTertiary }}
                  />
                  <Tooltip
                    cursor={{ fill: colors.text, fillOpacity: 0.06 }}
                    content={(props) => (
                      <ChartTooltip
                        {...props}
                        valueFormatter={(value) => `${toNumber(value).toFixed(1)}%`}
                      />
                    )}
                  />
                  <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                  <Bar name="CPU% (Daily)" dataKey="cpuUsed" fill={colors.error} fillOpacity={0.45} radius={[6, 6, 0, 0]} />
                  <Line name="Avg Trend" type="monotone" dataKey="avgTrend" stroke={colors.info} strokeWidth={4} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.info }} />
                  <Line name="Max Trend" type="monotone" dataKey="maxTrend" stroke={colors.error} strokeWidth={4} dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.error }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
              <button
                type="button"
                disabled={cpuChartLoading || cpuChartData.length === 0}
                onClick={() => downloadSvgAsPng({ rootEl: cpuChartPngRef, fileNameBase: 'cpu-trend' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: cpuChartLoading || cpuChartData.length === 0 ? 'not-allowed' : 'pointer',
                  color: cpuChartLoading || cpuChartData.length === 0 ? colors.textTertiary : colors.text,
                  fontSize: '12px',
                  fontWeight: '700',
                  opacity: cpuChartLoading || cpuChartData.length === 0 ? 0.6 : 1
                }}
                title="Download chart as PNG"
              >
                Download PNG
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{marginBottom: '24px'}}>
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <h3 style={{margin: 0, fontSize: '18px', fontWeight: '800', color: colors.info, textTransform: 'none', letterSpacing: 'normal'}}>RAM + SWAP TREND</h3>
              <button
                type="button"
                onClick={() => setShowSwapOverlay((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: colors.text,
                  fontSize: '12px',
                  fontWeight: '700'
                }}
                title="Toggle Swap overlay"
              >
                <span style={{width: '10px', height: '10px', borderRadius: '2px', background: showSwapOverlay ? colors.success : colors.border}} />
                Swap
              </button>
            </div>

            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              {ramChartMode === 'DAY_RANGE' && (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                  <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Range:</span>
                  <div style={{position: 'relative', minWidth: '200px'}}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRamDateDropdown((v) => !v);
                        const base = ramDayEnd || (selectedTopFileTs ? formatDateInput(selectedTopFileTs) : (availableDates[0] || ''));
                        if (base) {setRamCalendarMonth(`${base.slice(0, 7)}-01`);}
                        setShowRamMonthDropdown(false);
                        setShowRamYearDropdown(false);
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
                        alignItems: 'center'
                      }}
                    >
                      <span>{ramDayStart && ramDayEnd ? `${ramDayStart} → ${ramDayEnd}` : 'Select range'}</span>
                      <span style={{display: 'flex', alignItems: 'center', transform: showRamDateDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                        <FaChevronDown style={{color: colors.info}} />
                      </span>
                    </button>

                    {showRamDateDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
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
                            type="button"
                            onClick={ramPrevMonth}
                            onMouseEnter={() => maybeAutoSwitchRamMonth('prev')}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >
                            ◀
                          </button>
                          <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>{ramCalendarMonth ? `${ramCalendarMonth.slice(5, 7)}/${ramCalendarMonth.slice(0, 4)}` : ''}</span>
                          <button
                            type="button"
                            onClick={ramNextMonth}
                            onMouseEnter={() => maybeAutoSwitchRamMonth('next')}
                            style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                          >
                            ▶
                          </button>
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px'}}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                            <div key={d} style={{textAlign: 'center', fontSize: '11px', color: colors.text, fontWeight: '600'}}>{d}</div>
                          ))}
                        </div>

                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px'}}>
                          {ramCalendarDays.map((day, idx) => {
                            if (!day) {return <div key={`empty-${idx}`} />;}

                            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                            const hasFiles = availableDateSet.has(dateStr);

                            const dragStart = isRamRangeDragging ? ramRangeDragStart : '';
                            const dragEnd = isRamRangeDragging ? (ramRangeDragEnd || ramRangeDragStart) : '';
                            const rangeStart = (dragStart || ramDayStart) || '';
                            const rangeEnd = (dragEnd || ramDayEnd) || '';
                            const minRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : (rangeStart || rangeEnd);
                            const maxRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : (rangeStart || rangeEnd);
                            const inRange = minRange && maxRange && dateStr >= minRange && dateStr <= maxRange;
                            const isBoundary = minRange && maxRange && (dateStr === minRange || dateStr === maxRange);

                            return (
                              <button
                                key={dateStr}
                                type="button"
                                onMouseDown={() => {
                                  setRamRangeDragStart(dateStr);
                                  setRamRangeDragEnd(dateStr);
                                  setIsRamRangeDragging(true);
                                }}
                                onMouseEnter={() => {
                                  if (!isRamRangeDragging) {return;}
                                  setRamRangeDragEnd(dateStr);
                                }}
                                onMouseUp={() => {
                                  if (!isRamRangeDragging) {return;}
                                  const start = ramRangeDragStart;
                                  const end = ramRangeDragEnd || dateStr;
                                  if (!start || !end) {
                                    setIsRamRangeDragging(false);
                                    return;
                                  }
                                  const min = start <= end ? start : end;
                                  const max = start <= end ? end : start;
                                  ramRangeUserSelectedRef.current = true;
                                  setRamDayStart(min);
                                  setRamDayEnd(max);
                                  setIsRamRangeDragging(false);
                                  setShowRamDateDropdown(false);
                                }}
                                style={{
                                  padding: '6px',
                                  fontSize: '11px',
                                  border: isBoundary ? `2px solid ${colors.info}` : 'none',
                                  background: isBoundary
                                    ? colors.bgSecondary
                                    : inRange
                                      ? `${colors.primary}20`
                                      : colors.bg,
                                  color: hasFiles ? colors.text : colors.textTertiary,
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  fontWeight: isBoundary ? '700' : '500',
                                  userSelect: 'none'
                                }}
                                title={hasFiles ? 'Has data' : 'No data for this day'}
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
              )}

              {ramChartMode === 'MONTH' && (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                  <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Month:</span>
                  <div style={{position: 'relative', minWidth: '140px'}}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRamMonthDropdown((v) => !v);
                        if (!showRamMonthDropdown) {
                          setShowRamYearDropdown(false);
                          setShowRamDateDropdown(false);
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
                      <span>{ramMonth || 'Select month'}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: showRamMonthDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}>
                        <FaChevronDown style={{color: colors.info}} />
                      </span>
                    </button>

                    {showRamMonthDropdown && (
                      <div
                        style={{
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
                        {availableMonthsAll.slice().sort().reverse().map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              ramMonthUserSelectedRef.current = true;
                              setRamMonth(m);
                              setShowRamMonthDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: ramMonth === m ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '12px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: ramMonth === m ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (ramMonth !== m) {e.currentTarget.style.background = colors.bgSecondary;}
                            }}
                            onMouseLeave={(e) => {
                              if (ramMonth !== m) {e.currentTarget.style.background = 'transparent';}
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {ramChartMode === 'YEAR' && (
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                  <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Year:</span>
                  <div style={{position: 'relative', minWidth: '110px'}}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRamYearDropdown((v) => !v);
                        if (!showRamYearDropdown) {
                          setShowRamMonthDropdown(false);
                          setShowRamDateDropdown(false);
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
                      <span>{ramYear || 'Select year'}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transform: showRamYearDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}>
                        <FaChevronDown style={{color: colors.info}} />
                      </span>
                    </button>

                    {showRamYearDropdown && (
                      <div
                        style={{
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
                        {availableYears.slice().sort().reverse().map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => {
                              ramYearUserSelectedRef.current = true;
                              setRamYear(y);

                              if (ramMonth && ramMonth.slice(0, 4) !== y) {
                                const months = availableRamMonthsForYear.filter((m) => m.startsWith(y));
                                if (months.length) {
                                  ramMonthUserSelectedRef.current = true;
                                  setRamMonth(months[months.length - 1]);
                                }
                              }

                              setShowRamYearDropdown(false);
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: ramYear === y ? colors.border : 'transparent',
                              color: colors.text,
                              cursor: 'pointer',
                              fontSize: '12px',
                              textAlign: 'left',
                              transition: 'background 0.2s ease',
                              fontWeight: ramYear === y ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (ramYear !== y) {e.currentTarget.style.background = colors.bgSecondary;}
                            }}
                            onMouseLeave={(e) => {
                              if (ramYear !== y) {e.currentTarget.style.background = 'transparent';}
                            }}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <CpuChartModeToggle value={ramChartMode} onChange={setRamChartMode} />
            </div>
          </div>

          {ramChartError ? (
            <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <span style={{color: colors.error, fontSize: '12px'}}>{ramChartError}</span>
              <button
                onClick={() => {
                  // Clear error and trigger reload by resetting error state
                  setRamChartError('');
                  setRamChartLoading(true);
                  // Re-render will trigger useEffect to reload
                }}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  background: colors.success,
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
          ) : ramChartLoading || !topFiles || topFiles.length === 0 ? (
            <ChartSkeleton />
          ) : ramChartData.length === 0 && !ramChartError ? (
            <ChartSkeleton />
          ) : ramChartData.length === 0 ? (
            <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: '12px'}}>
              No RAM/Swap history data available.
            </div>
          ) : (
            <div style={{width: '100%'}}>
              <div ref={ramChartPngRef} style={{width: '100%', height: '280px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ramChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      stroke={colors.textTertiary}
                      tick={{ fontSize: 11, fill: colors.text }}
                      axisLine={{ stroke: colors.textTertiary }}
                      tickLine={{ stroke: colors.textTertiary }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={percentTicks0100}
                      stroke={colors.textTertiary}
                      tick={{ fontSize: 11, fill: colors.text }}
                      axisLine={{ stroke: colors.textTertiary }}
                      tickLine={{ stroke: colors.textTertiary }}
                    />
                    <Tooltip
                      cursor={{ fill: colors.text, fillOpacity: 0.06 }}
                      content={(props) => (
                        <ChartTooltip
                          {...props}
                          valueFormatter={(value) => `${toNumber(value).toFixed(1)}%`}
                        />
                      )}
                    />
                    <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                    <Bar name="RAM Used" dataKey="ramUsed" stackId="ram" fill={colors.error} fillOpacity={0.5} radius={[0, 0, 0, 0]} />
                    <Bar name="RAM Cache/Free" dataKey="ramCacheFree" stackId="ram" fill={colors.textSecondary} fillOpacity={0.35} radius={[6, 6, 0, 0]} />
                    <Line name="Avg Trend (RAM)" type="monotone" dataKey="avgTrend" stroke={colors.info} strokeWidth={4} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.info }} />
                    <Line name="Max Trend (RAM)" type="monotone" dataKey="maxTrend" stroke={colors.warning} strokeWidth={4} dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.warning }} />
                    {showSwapOverlay ? (
                      <>
                        <Bar name="Swap Used" dataKey="swapUsed" stackId="swap" fill={colors.primary} fillOpacity={0.55} radius={[0, 0, 0, 0]} />
                        <Bar name="Swap Free" dataKey="swapFree" stackId="swap" fill={colors.textSecondary} fillOpacity={0.35} radius={[6, 6, 0, 0]} />
                      </>
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
                <button
                  type="button"
                  disabled={ramChartLoading || ramChartData.length === 0}
                  onClick={() => downloadSvgAsPng({ rootEl: ramChartPngRef, fileNameBase: 'ram-swap-trend' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    cursor: ramChartLoading || ramChartData.length === 0 ? 'not-allowed' : 'pointer',
                    color: ramChartLoading || ramChartData.length === 0 ? colors.textTertiary : colors.text,
                    fontSize: '12px',
                    fontWeight: '700',
                    opacity: ramChartLoading || ramChartData.length === 0 ? 0.6 : 1
                  }}
                  title="Download chart as PNG"
                >
                  Download PNG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 id="statistics" style={{marginTop: 0, marginBottom: '32px', fontSize: '24px', fontWeight: '700', color: colors.text, letterSpacing: '-0.5px'}}>Statistics</h2>
      
      {/* Row 1 - System Info, Load Average, Tasks */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px'}}>
        {/* System Info */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{fontSize: '20px', color: colors.info, marginTop: 0, marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>System Info</h3>
          <div style={{display: 'grid', gap: '10px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Time</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.info}}>{topData.system?.time || 'N/A'}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Uptime</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.success}}>{topData.system?.uptime || 'N/A'}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Users</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.info}}>{topData.system?.users !== undefined ? topData.system.users : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Load Average Section */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{fontSize: '20px', color: colors.info, marginTop: 0, marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Load Average</h3>
          <div style={{display: 'grid', gap: '10px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>1m</span>
              <span style={{fontSize: '16px', fontWeight: '800', color: colors.info}}>{loadavgData ? toNumber(loadavgData['1min']).toFixed(2) : 'N/A'}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>5m</span>
              <span style={{fontSize: '16px', fontWeight: '800', color: colors.info}}>{loadavgData ? toNumber(loadavgData['5min']).toFixed(2) : 'N/A'}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>15m</span>
              <span style={{fontSize: '16px', fontWeight: '800', color: colors.info}}>{loadavgData ? toNumber(loadavgData['15min']).toFixed(2) : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* All Tasks */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h3 style={{fontSize: '20px', color: colors.success, marginTop: 0, marginBottom: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Tasks</h3>
          <div style={{display: 'grid', gap: '8px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Total</span>
              <span style={{fontSize: '16px', fontWeight: '800', color: colors.info}}>{toNumber(topData.tasks?.total)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Running</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.success}}>{toNumber(topData.tasks?.running)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Sleeping</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.info}}>{toNumber(topData.tasks?.sleeping)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Stopped</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.warning}}>{toNumber(topData.tasks?.stopped)}</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
              <span style={{fontSize: '12px', color: colors.text, fontWeight: '600'}}>Zombie</span>
              <span style={{fontSize: '16px', fontWeight: '700', color: colors.error}}>{toNumber(topData.tasks?.zombie)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 - CPU Full, Memory Full, Swap Full */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'}}>

        {/* CPU - All Fields */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          minHeight: `${usageCardMinHeight}px`,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
            <h3 style={{fontSize: '20px', color: colors.warning, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>CPU Usage</h3>
            <ViewModeToggle value={cpuViewMode} onChange={setCpuViewMode} />
          </div>

          {cpuViewMode === 'DONUT' ? (
            <>
              <DonutChart
                percent={100 - toNumber(topData.cpu?.idle)}
                color={getProgressColor(100 - toNumber(topData.cpu?.idle))}
                valueDecimals={1}
              />
              <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{color: colors.text, fontWeight: '600'}}>User</span>
                  <strong style={{color: colors.success}}>{toNumber(topData.cpu?.user).toFixed(1)}%</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{color: colors.text, fontWeight: '600'}}>System</span>
                  <strong style={{color: colors.error}}>{toNumber(topData.cpu?.system).toFixed(1)}%</strong>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{color: colors.text, fontWeight: '600'}}>Idle</span>
                  <strong style={{color: colors.textSecondary}}>{toNumber(topData.cpu?.idle).toFixed(1)}%</strong>
                </div>
              </div>
            </>
          ) : (
            <div style={{display: 'grid', gap: '0px', fontSize: '12px', flex: 1}}>
            <div style={{marginBottom: '0px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px'}}>
                <span style={{color: colors.text, fontWeight: '600'}}>Overall</span>
                <span style={{fontWeight: '600'}}>{(100 - toNumber(topData.cpu?.idle)).toFixed(1)}%</span>
              </div>
              <div style={{width: '100%', height: '6px', background: colors.bg, borderRadius: '3px', overflow: 'hidden'}}>
                <div style={{
                  width: `${Math.min(100 - toNumber(topData.cpu?.idle), 100)}%`,
                  height: '100%',
                  background: (100 - toNumber(topData.cpu?.idle)) >= 90 ? colors.error : (100 - toNumber(topData.cpu?.idle)) >= 80 ? colors.warning : colors.success,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>User</span>
                <strong style={{color: colors.success, fontSize: '10px'}}>{toNumber(topData.cpu?.user).toFixed(1)}%</strong>
              </div>
              <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                <div style={{
                  width: `${Math.min(toNumber(topData.cpu?.user), 100)}%`,
                  height: '100%',
                  background: colors.success,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>System</span>
                <strong style={{color: colors.error, fontSize: '10px'}}>{toNumber(topData.cpu?.system).toFixed(1)}%</strong>
              </div>
              <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                <div style={{
                  width: `${Math.min(toNumber(topData.cpu?.system), 100)}%`,
                  height: '100%',
                  background: colors.error,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Nice</span>
                <strong style={{fontSize: '10px'}}>{toNumber(topData.cpu?.nice).toFixed(1)}%</strong>
              </div>
              <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                <div style={{
                  width: `${Math.min(toNumber(topData.cpu?.nice), 100)}%`,
                  height: '100%',
                  background: colors.info,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{marginTop: '3px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Idle</span>
                <strong style={{color: colors.text, fontSize: '10px'}}>{toNumber(topData.cpu?.idle).toFixed(1)}%</strong>
              </div>
              <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                <div style={{
                  width: `${Math.min(toNumber(topData.cpu?.idle), 100)}%`,
                  height: '100%',
                  background: colors.border,
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
            <div style={{borderTop: `1px solid ${colors.border}`, paddingTop: '6px', marginTop: '4px'}}>
              <div style={{marginTop: '3px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                  <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>I/O Wait</span>
                  <strong style={{fontSize: '10px'}}>{toNumber(topData.cpu?.wait).toFixed(1)}%</strong>
                </div>
                <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                  <div style={{
                    width: `${Math.min(toNumber(topData.cpu?.wait), 100)}%`,
                    height: '100%',
                    background: colors.warning,
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
              <div style={{marginTop: '3px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                  <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>HW IRQ</span>
                  <strong style={{fontSize: '10px'}}>{toNumber(topData.cpu?.hardware_irq).toFixed(1)}%</strong>
                </div>
                <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                  <div style={{
                    width: `${Math.min(toNumber(topData.cpu?.hardware_irq), 100)}%`,
                    height: '100%',
                    background: '#a371f7',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
              <div style={{marginTop: '3px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                  <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>SW IRQ</span>
                  <strong style={{fontSize: '10px'}}>{toNumber(topData.cpu?.software_irq).toFixed(1)}%</strong>
                </div>
                <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                  <div style={{
                    width: `${Math.min(toNumber(topData.cpu?.software_irq), 100)}%`,
                    height: '100%',
                    background: colors.info,
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
              <div style={{marginTop: '3px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                  <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Steal</span>
                  <strong style={{fontSize: '10px'}}>{toNumber(topData.cpu?.steal).toFixed(1)}%</strong>
                </div>
                <div style={{width: '100%', height: '3px', background: colors.bg, borderRadius: '1px', overflow: 'hidden'}}>
                  <div style={{
                    width: `${Math.min(toNumber(topData.cpu?.steal), 100)}%`,
                    height: '100%',
                    background: colors.error,
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Memory - All Fields */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          minHeight: `${usageCardMinHeight}px`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
            <h3 style={{fontSize: '20px', color: colors.info, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Memory Usage</h3>
            <ViewModeToggle value={memoryViewMode} onChange={setMemoryViewMode} />
          </div>

          <div style={{display: 'grid', gap: '2px', flex: 1}}>
            {memoryViewMode === 'DONUT' ? (
              <>
                <DonutChart
                  percent={percentOf(topData.memory?.used_kb, topData.memory?.total_kb)}
                  color={getProgressColor(percentOf(topData.memory?.used_kb, topData.memory?.total_kb))}
                />
                <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Total</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.memory?.total_kb), memoryUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Used</span>
                    <strong style={{color: colors.success}}>{formatBytesWithUnit(toNumber(topData.memory?.used_kb), memoryUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Free</span>
                    <strong style={{color: colors.info}}>{formatBytesWithUnit(toNumber(topData.memory?.free_kb), memoryUnit)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{marginBottom: '0px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
                    <span style={{color: colors.text, fontWeight: '600'}}>Usage</span>
                    <span style={{fontWeight: '600'}}>{percentOf(topData.memory?.used_kb, topData.memory?.total_kb).toFixed(0)}%</span>
                  </div>
                  <div style={{width: '100%', height: '6px', background: colors.bg, borderRadius: '3px', overflow: 'hidden'}}>
                    <div style={{
                      width: `${Math.min(percentOf(topData.memory?.used_kb, topData.memory?.total_kb), 100)}%`,
                      height: '100%',
                      background: percentOf(topData.memory?.used_kb, topData.memory?.total_kb) >= 90 ? colors.error : percentOf(topData.memory?.used_kb, topData.memory?.total_kb) >= 80 ? colors.warning : colors.success,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Total</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.memory?.total_kb), memoryUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Used</span>
                    <strong style={{color: colors.success}}>{formatBytesWithUnit(toNumber(topData.memory?.used_kb), memoryUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Free</span>
                    <strong style={{color: colors.info}}>{formatBytesWithUnit(toNumber(topData.memory?.free_kb), memoryUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Buffers</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.memory?.buffers_kb), memoryUnit)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`, marginTop: 'auto', alignSelf: 'flex-end'}}>
            {['KB', 'MB', 'GB'].map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => setMemoryUnit(unit)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: memoryUnit === unit ? colors.success : hoveredMemoryUnit === unit ? `${colors.primary}20` : 'transparent',
                  color: memoryUnit === unit ? '#fff' : hoveredMemoryUnit === unit ? colors.info : '#fff',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={() => setHoveredMemoryUnit(unit)}
                onMouseLeave={() => setHoveredMemoryUnit(null)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>

        {/* Swap - All Fields */}
        <div style={{
          background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          minHeight: `${usageCardMinHeight}px`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
            <h3 style={{fontSize: '20px', color: colors.info, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Swap Usage</h3>
            <ViewModeToggle value={swapViewMode} onChange={setSwapViewMode} />
          </div>

          <div style={{display: 'grid', gap: '2px', flex: 1}}>
            {swapViewMode === 'DONUT' ? (
              <>
                <DonutChart
                  percent={percentOf(topData.swap?.used_kb, topData.swap?.total_kb)}
                  color={percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 50 ? colors.error : percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 20 ? colors.warning : colors.success}
                />
                <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Total</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.swap?.total_kb), swapUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Used</span>
                    <strong style={{color: percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 50 ? colors.error : colors.success}}>{formatBytesWithUnit(toNumber(topData.swap?.used_kb), swapUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Free</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.swap?.free_kb), swapUnit)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{marginBottom: '0px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
                    <span style={{color: colors.text, fontWeight: '600'}}>Usage</span>
                    <span style={{fontWeight: '600'}}>{percentOf(topData.swap?.used_kb, topData.swap?.total_kb).toFixed(0)}%</span>
                  </div>
                  <div style={{width: '100%', height: '6px', background: colors.bg, borderRadius: '3px', overflow: 'hidden'}}>
                    <div style={{
                      width: `${Math.min(percentOf(topData.swap?.used_kb, topData.swap?.total_kb), 100)}%`,
                      height: '100%',
                      background: percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 50 ? colors.error : percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 20 ? colors.warning : colors.success,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                <div style={{display: 'grid', gap: '8px', fontSize: '12px', marginTop: '4px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Total</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.swap?.total_kb), swapUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Used</span>
                    <strong style={{color: percentOf(topData.swap?.used_kb, topData.swap?.total_kb) > 50 ? colors.error : colors.success}}>{formatBytesWithUnit(toNumber(topData.swap?.used_kb), swapUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Free</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.swap?.free_kb), swapUnit)}</strong>
                  </div>
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <span style={{color: colors.text, fontSize: '12px', fontWeight: '600'}}>Cached</span>
                    <strong>{formatBytesWithUnit(toNumber(topData.swap?.cached_kb), swapUnit)}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`, marginTop: 'auto', alignSelf: 'flex-end'}}>
            {['KB', 'MB', 'GB'].map(unit => (
              <button
                key={unit}
                type="button"
                onClick={() => setSwapUnit(unit)}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: swapUnit === unit ? colors.success : hoveredSwapUnit === unit ? `${colors.primary}20` : 'transparent',
                  color: swapUnit === unit ? '#fff' : hoveredSwapUnit === unit ? colors.info : '#fff',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={() => setHoveredSwapUnit(unit)}
                onMouseLeave={() => setHoveredSwapUnit(null)}
              >
                {unit}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
});

StatsView.propTypes = {
  data: PropTypes.object,
  selectedTopFileData: PropTypes.object,
  selectedTopFile: PropTypes.string,
  topFiles: PropTypes.array,
  controller: PropTypes.object.isRequired,
  systemName: PropTypes.string,
  lastUpdated: PropTypes.string,
  uptime: PropTypes.string,
  onSelectTopFile: PropTypes.func.isRequired,
  onRefresh: PropTypes.func,
  isLoading: PropTypes.bool,
  isRefreshing: PropTypes.bool,
  isHomeView: PropTypes.bool
};

export { StatsView };
