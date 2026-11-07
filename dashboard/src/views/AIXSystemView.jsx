import { memo, useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { FaChevronDown } from 'react-icons/fa';
import { getFileData } from '../../store/api';
import { useThemeColors } from '../hooks/useThemeColors';
import { useTheme } from '../components/ThemeProvider';
import { ChartSkeleton } from '../components/LoadingSkeleton';
import { extractDateFromFilename } from '../utils/stringUtils';
import { parseFileTimestamp } from '../utils/dateUtils';
import { getProgressColor } from '../utils/formatUtils';

const toNumber = (value) => {
  if (typeof value === 'number') {
    return value;
  }
  const num = parseFloat(String(value || 0).replace('%', '').trim());
  return isNaN(num) ? 0 : num;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const ChartTooltip = memo(({ active, payload, label, valueFormatter }) => {
  const colors = useThemeColors();
  
  if (!active || !payload || !payload.length) {return null;}

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <p style={{margin: '0 0 4px 0', color: colors.textSecondary, fontSize: '11px', fontWeight: '500'}}>
        {label}
      </p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{margin: '2px 0', color: entry.color || colors.text, fontSize: '12px', fontWeight: '500'}}>
          <span style={{color: colors.textSecondary}}>{entry.name}:</span> {valueFormatter ? valueFormatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
});

ChartTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
  valueFormatter: PropTypes.func
};

const ViewModeToggle = ({ value, onChange, colors }) => (
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
          color: '#fff',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          if (value !== mode) {
            e.target.style.color = colors.info;
            e.target.style.background = `${colors.primary}20`;
          } else {
            e.target.style.color = '#fff';
          }
        }}
        onMouseLeave={(e) => {
          e.target.style.color = '#fff';
          if (value !== mode) {
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
  onChange: PropTypes.func.isRequired,
  colors: PropTypes.object.isRequired
};

const CPUCard = memo(({ cpuLpar, theme, colors, cpuViewMode, setCpuViewMode }) => {
  const user = toNumber(cpuLpar?.user_pct) || 0;
  const kern = toNumber(cpuLpar?.kern_pct) || 0;
  const wait = toNumber(cpuLpar?.wait_pct) || 0;
  const idle = toNumber(cpuLpar?.idle_pct) || 0;
  const physc = toNumber(cpuLpar?.physc) || 0;
  const entc = toNumber(cpuLpar?.entc) || 0;
  const totalUsed = clamp(user + kern + wait, 0, 100);

  return (
    <div style={{
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '24px',
      boxShadow: 'none',
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '360px'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
        <h3 style={{fontSize: '20px', color: theme.warning, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>CPU & LPAR</h3>
        {colors && setCpuViewMode && <ViewModeToggle value={cpuViewMode} onChange={setCpuViewMode} colors={colors} />}
      </div>

      {cpuViewMode === 'DONUT' && colors ? (
        <>
          <DonutChart
            percent={totalUsed}
            color={getProgressColor(totalUsed, theme)}
            colors={colors}
            valueDecimals={1}
          />
          <div style={{display: 'grid', gap: '8px', fontSize: '12px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Physc</span>
              <strong style={{color: colors.text}}>{physc.toFixed(2)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Entc</span>
              <strong style={{color: colors.text}}>{entc.toFixed(2)}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>User</span>
              <strong style={{color: theme.success}}>{user.toFixed(1)}%</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Kern</span>
              <strong style={{color: theme.info}}>{kern.toFixed(1)}%</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Wait</span>
              <strong style={{color: theme.warning}}>{wait.toFixed(1)}%</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Idle</span>
              <strong style={{color: theme.success}}>{idle.toFixed(1)}%</strong>
            </div>
          </div>
        </>
      ) : (
      <div style={{display: 'grid', gap: '10px', flex: 1}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
          <span style={{fontSize: '12px', color: theme.text, fontWeight: '600'}}>Physc</span>
          <span style={{fontSize: '12px', fontWeight: '600', color: theme.primary}}>{physc.toFixed(2)}</span>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1}}>
          <span style={{fontSize: '12px', color: theme.text, fontWeight: '600'}}>Entc</span>
          <span style={{fontSize: '12px', fontWeight: '600', color: theme.info}}>{entc.toFixed(2)}</span>
        </div>
        <div style={{marginTop: '3px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
            <span style={{color: theme.text, fontSize: '12px', fontWeight: '600'}}>User</span>
            <strong style={{color: theme.success, fontSize: '12px'}}>{user.toFixed(1)}%</strong>
          </div>
          <div style={{width: '100%', height: '3px', background: theme.bg, borderRadius: '1px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(user, 100)}%`, height: '100%', background: theme.success, transition: 'width 0.3s'}}></div>
          </div>
        </div>
        <div style={{marginTop: '3px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
            <span style={{color: theme.text, fontSize: '12px', fontWeight: '600'}}>Kern</span>
            <strong style={{color: theme.info, fontSize: '12px'}}>{kern.toFixed(1)}%</strong>
          </div>
          <div style={{width: '100%', height: '3px', background: theme.bg, borderRadius: '1px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(kern, 100)}%`, height: '100%', background: theme.info, transition: 'width 0.3s'}}></div>
          </div>
        </div>
        <div style={{marginTop: '3px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
            <span style={{color: theme.text, fontSize: '12px', fontWeight: '600'}}>Wait</span>
            <strong style={{color: theme.warning, fontSize: '12px'}}>{wait.toFixed(1)}%</strong>
          </div>
          <div style={{width: '100%', height: '3px', background: theme.bg, borderRadius: '1px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(wait, 100)}%`, height: '100%', background: theme.warning, transition: 'width 0.3s'}}></div>
          </div>
        </div>
        <div style={{marginTop: '3px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
            <span style={{color: theme.text, fontSize: '12px', fontWeight: '600'}}>Idle</span>
            <strong style={{fontSize: '12px'}}>{idle.toFixed(1)}%</strong>
          </div>
          <div style={{width: '100%', height: '3px', background: theme.bg, borderRadius: '1px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(idle, 100)}%`, height: '100%', background: theme.success, transition: 'width 0.3s'}}></div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
});

CPUCard.propTypes = {
  cpuLpar: PropTypes.object,
  theme: PropTypes.object.isRequired,
  colors: PropTypes.object.isRequired,
  cpuViewMode: PropTypes.string.isRequired,
  setCpuViewMode: PropTypes.func.isRequired
};

const DonutChart = ({ percent, color, colors, size = 120, strokeWidth = 12, valueDecimals = 0 }) => {
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
          fill={colors.text}
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
  colors: PropTypes.object.isRequired,
  size: PropTypes.number,
  strokeWidth: PropTypes.number,
  valueDecimals: PropTypes.number
};

const MemoryCard = memo(({ memory, theme, colors, memoryUnit = 'GB', setMemoryUnit, memoryViewMode, setMemoryViewMode, hoveredMemoryUnit = null, setHoveredMemoryUnit = () => {} }) => {
  const total = toNumber(memory?.total_mb) || 1;
  const free = toNumber(memory?.free_ram_mb) || 0;
  const used = total - free;
  const usedPct = (used / total) * 100;

  // Unit conversion helpers
  const convertMemory = (mb) => {
    if (memoryUnit === 'GB') {
      return (mb / 1024).toFixed(2);
    }
    if (memoryUnit === 'MB') {
      return mb.toFixed(2);
    }
    if (memoryUnit === 'KB') {
      return (mb * 1024).toFixed(2);
    }
    return mb.toFixed(2);
  };

  return (
    <div style={{
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '24px',
      boxShadow: 'none',
      transition: 'all 0.3s ease',
      minHeight: '360px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
        <h3 style={{fontSize: '20px', color: theme.error, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Memory (RAM)</h3>
        <ViewModeToggle value={memoryViewMode} onChange={setMemoryViewMode} colors={colors} />
      </div>

      {memoryViewMode === 'DONUT' ? (
        <>
          <DonutChart
            percent={usedPct}
            color={getProgressColor(usedPct, theme)}
            colors={colors}
            valueDecimals={1}
          />
          <div style={{display: 'grid', gap: '8px', fontSize: '12px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Total</span>
              <strong style={{color: colors.text}}>{convertMemory(total)} {memoryUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used</span>
              <strong style={{color: theme.error}}>{convertMemory(used)} {memoryUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Free</span>
              <strong style={{color: theme.success}}>{convertMemory(free)} {memoryUnit}</strong>
            </div>
          </div>
        </>
      ) : (
      <div style={{display: 'grid', gap: '10px', flex: 1}}>
          <div style={{marginBottom: '0px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used%</span>
              <span style={{fontWeight: '600', color: getProgressColor(usedPct, theme)}}>
                {usedPct.toFixed(1)}%
              </span>
            </div>
            <div style={{width: '100%', height: '6px', background: theme.backgroundSecondary, borderRadius: '3px', overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${Math.min(100, usedPct)}%`, background: getProgressColor(usedPct, theme)}}></div>
            </div>
          </div>
          <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Total</span>
              <strong>{convertMemory(total)} {memoryUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used</span>
              <strong style={{color: theme.error}}>{convertMemory(used)} {memoryUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Free</span>
              <strong style={{color: theme.success}}>{convertMemory(free)} {memoryUnit}</strong>
            </div>
          </div>
      </div>
      )}
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
  );
});

MemoryCard.propTypes = {
  memory: PropTypes.object,
  theme: PropTypes.object.isRequired,
  colors: PropTypes.object.isRequired,
  memoryUnit: PropTypes.string.isRequired,
  setMemoryUnit: PropTypes.func.isRequired,
  memoryViewMode: PropTypes.string.isRequired,
  setMemoryViewMode: PropTypes.func.isRequired,
  hoveredMemoryUnit: PropTypes.string,
  setHoveredMemoryUnit: PropTypes.func
};

const PagingCard = memo(({ paging, theme, colors, pagingViewMode, setPagingViewMode }) => {
  const size = toNumber(paging?.size_mb) || 1;
  const usedPct = toNumber(paging?.used_pct) || 0;
  const faults = toNumber(paging?.faults) || 0;
  const used = (size * usedPct) / 100;
  const [pagingUnit, setPagingUnit] = useState('GB');
  const [hoveredPagingUnit, setHoveredPagingUnit] = useState(null);

  // Unit conversion helpers
  const convertPaging = (mb) => {
    if (pagingUnit === 'GB') {
      return (mb / 1024).toFixed(2);
    }
    if (pagingUnit === 'MB') {
      return mb.toFixed(2);
    }
    if (pagingUnit === 'KB') {
      return (mb * 1024).toFixed(2);
    }
    return mb.toFixed(2);
  };

  return (
    <div style={{
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '24px',
      boxShadow: 'none',
      transition: 'all 0.3s ease',
      minHeight: '360px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
        <h3 style={{fontSize: '20px', color: theme.info, marginTop: 0, marginBottom: 0, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Paging Space</h3>
        <ViewModeToggle value={pagingViewMode} onChange={setPagingViewMode} colors={colors} />
      </div>

      {pagingViewMode === 'DONUT' ? (
        <>
          <DonutChart
            percent={usedPct}
            color={getProgressColor(usedPct, theme)}
            colors={colors}
            valueDecimals={1}
          />
          <div style={{display: 'grid', gap: '8px', fontSize: '12px', flex: 1}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Total</span>
              <strong style={{color: colors.text}}>{convertPaging(size)} {pagingUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used</span>
              <strong style={{color: theme.warning}}>{convertPaging(used)} {pagingUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Faults</span>
              <strong style={{color: theme.info}}>{(faults / 1e9).toFixed(2)}B</strong>
            </div>
          </div>
        </>
      ) : (
      <div style={{display: 'grid', gap: '10px', flex: 1}}>
          <div style={{marginBottom: '0px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used%</span>
              <span style={{fontWeight: '600', color: getProgressColor(usedPct, theme)}}>
                {usedPct.toFixed(1)}%
              </span>
            </div>
            <div style={{width: '100%', height: '6px', background: theme.backgroundSecondary, borderRadius: '3px', overflow: 'hidden'}}>
              <div style={{height: '100%', width: `${Math.min(100, usedPct)}%`, background: getProgressColor(usedPct, theme)}}></div>
            </div>
          </div>
          <div style={{display: 'grid', gap: '8px', fontSize: '12px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Total</span>
              <strong>{convertPaging(size)} {pagingUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Used</span>
              <strong style={{color: theme.warning}}>{convertPaging(used)} {pagingUnit}</strong>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <span style={{color: colors.text, fontWeight: '600'}}>Faults</span>
              <strong style={{color: theme.info}}>
                {(faults / 1e9).toFixed(2)}B
              </strong>
            </div>
          </div>
      </div>
      )}
      <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`, marginTop: 'auto', alignSelf: 'flex-end'}}>
        {['KB', 'MB', 'GB'].map(unit => (
          <button
            key={unit}
            type="button"
            onClick={() => setPagingUnit(unit)}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: pagingUnit === unit ? colors.success : hoveredPagingUnit === unit ? `${colors.primary}20` : 'transparent',
              color: pagingUnit === unit ? '#fff' : hoveredPagingUnit === unit ? colors.info : '#fff',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={() => setHoveredPagingUnit(unit)}
            onMouseLeave={() => setHoveredPagingUnit(null)}
          >
            {unit}
          </button>
        ))}
      </div>
    </div>
  );
});

PagingCard.propTypes = {
  paging: PropTypes.object,
  theme: PropTypes.object.isRequired,
  colors: PropTypes.object.isRequired,
  pagingViewMode: PropTypes.string.isRequired,
  setPagingViewMode: PropTypes.func.isRequired
};

export const AIXSystemView = memo(({
  data,
  theme: propTheme,
  isLoading = false,
  isRefreshing = false,
  topFiles = [],
  selectedTopFile = '',
  _onSelectTopFile = () => {},
  onRefresh = null,
  systemName = 'AIX System',
  lastUpdated = '',
  _uptime = ''
}) => {
  const { theme: defaultTheme } = useTheme();
  const theme = propTheme || defaultTheme;
  const colors = useThemeColors();
  const [memoryUnit, setMemoryUnit] = useState('GB');
  const [hoveredMemoryUnit, setHoveredMemoryUnit] = useState(null);
  const [memoryViewMode, setMemoryViewMode] = useState('DETAILS');
  const [pagingViewMode, setPagingViewMode] = useState('DETAILS');
  const [cpuViewMode, setCpuViewMode] = useState('DETAILS');
  const [isCpuRangeDragging, setIsCpuRangeDragging] = useState(false);

  const lastStableDataRef = useRef(null);

  useEffect(() => {
    if (!isRefreshing && data) {
      lastStableDataRef.current = data;
    }
  }, [isRefreshing, data]);

  const cpuUsedCacheRef = useRef(new Map());
  const memoryUsedCacheRef = useRef(new Map());
  const pagingUsedCacheRef = useRef(new Map());
  const memoryChartPngRef = useRef(null);

  const [cpuChartMode, setCpuChartMode] = useState('DAY_RANGE');
  const [cpuChartLoading, setCpuChartLoading] = useState(false);
  const [cpuChartError, setCpuChartError] = useState('');
  const [cpuChartData, setCpuChartData] = useState([]);
  
  const [memoryChartMode, setMemoryChartMode] = useState('DAY_RANGE');
  const [memoryChartLoading, setMemoryChartLoading] = useState(false);
  const [memoryChartError, setMemoryChartError] = useState('');
  const [memoryChartData, setMemoryChartData] = useState([]);
  
  // Calendar picker states for CPU
  const [cpuDayStart, setCpuDayStart] = useState('');
  const [cpuDayEnd, setCpuDayEnd] = useState('');
  const [cpuMonth, setCpuMonth] = useState('');
  const [cpuYear, setCpuYear] = useState('');
  const [showCpuDateDropdown, setShowCpuDateDropdown] = useState(false);
  const [showCpuMonthDropdown, setShowCpuMonthDropdown] = useState(false);
  const [showCpuYearDropdown, setShowCpuYearDropdown] = useState(false);
  const [cpuCalendarMonth, setCpuCalendarMonth] = useState('');
  const [cpuRangeDragStart, setCpuRangeDragStart] = useState('');
  const [cpuRangeDragEnd, setCpuRangeDragEnd] = useState('');
  const cpuRangeUserSelectedRef = useRef(false);
  const cpuMonthUserSelectedRef = useRef(false);
  const cpuYearUserSelectedRef = useRef(false);
  
  // Calendar picker states for Memory
  const [memoryDayStart, setMemoryDayStart] = useState('');
  const [memoryDayEnd, setMemoryDayEnd] = useState('');
  const [memoryMonth, setMemoryMonth] = useState('');
  const [memoryYear, setMemoryYear] = useState('');
  const [showMemoryDateDropdown, setShowMemoryDateDropdown] = useState(false);
  const [showMemoryMonthDropdown, setShowMemoryMonthDropdown] = useState(false);
  const [showMemoryYearDropdown, setShowMemoryYearDropdown] = useState(false);
  const [memoryCalendarMonth, setMemoryCalendarMonth] = useState('');
  const [memoryRangeDragStart, setMemoryRangeDragStart] = useState('');
  const [memoryRangeDragEnd, setMemoryRangeDragEnd] = useState('');
  const [isMemoryRangeDragging, setIsMemoryRangeDragging] = useState(false);
  const memoryRangeUserSelectedRef = useRef(false);
  const memoryMonthUserSelectedRef = useRef(false);
  const memoryYearUserSelectedRef = useRef(false);

  const [pagingChartData, setPagingChartData] = useState([]);

  const [showPagingInMemoryChart, setShowPagingInMemoryChart] = useState(false);

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

  const filesByDate = useMemo(() => {
    const grouped = {};
    topFiles?.forEach(file => {
      const date = extractDateFromFilename(file);
      if (date) {
        if (!grouped[date]) { grouped[date] = []; }
        grouped[date].push(file);
      }
    });
    return grouped;
  }, [topFiles]);

  const availableDates = useMemo(() => Object.keys(filesByDate).sort().reverse(), [filesByDate]);
  const dayKeysSorted = useMemo(() => Object.keys(filesByDate).sort(), [filesByDate]);
  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  
  // Get unique months and years from available dates
  const availableMonths = useMemo(() => {
    const months = new Set();
    dayKeysSorted.forEach(k => {
      if (k.length >= 7) months.add(k.slice(0, 7));
    });
    return Array.from(months).sort();
  }, [dayKeysSorted]);

  const availableYears = useMemo(() => {
    const years = new Set();
    dayKeysSorted.forEach(k => {
      if (k.length >= 4) years.add(k.slice(0, 4));
    });
    return Array.from(years).sort();
  }, [dayKeysSorted]);
  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] || '');

  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  const _selectedTopFileTs = useMemo(() => parseFileTimestamp(selectedTopFile), [selectedTopFile]);
  
  // Helper to format date for input
  const formatDateInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  // Initialize calendar months and date ranges
  useEffect(() => {
    if (!dayKeysSorted.length) return;
    
    const fallbackIdx = dayKeysSorted.length - 1;
    const anchorKey = dayKeysSorted[fallbackIdx];
    const anchorDayKey = anchorKey;
    
    // Initialize month and year for CPU
    if (!cpuYearUserSelectedRef.current && !cpuYear) {
      setCpuYear(anchorDayKey.slice(0, 4));
    }
    if (!cpuMonthUserSelectedRef.current && !cpuMonth) {
      setCpuMonth(anchorDayKey.slice(0, 7));
    }
    
    // Initialize month and year for Memory
    if (!memoryYearUserSelectedRef.current && !memoryYear) {
      setMemoryYear(anchorDayKey.slice(0, 4));
    }
    if (!memoryMonthUserSelectedRef.current && !memoryMonth) {
      setMemoryMonth(anchorDayKey.slice(0, 7));
    }
    
    // Initialize calendar months
    if (!cpuCalendarMonth) {
      setCpuCalendarMonth(`${anchorDayKey.slice(0, 7)}-01`);
    }
    if (!memoryCalendarMonth) {
      setMemoryCalendarMonth(`${anchorDayKey.slice(0, 7)}-01`);
    }
    
    // Set default range to last 7 days if not user-selected
    if (!cpuRangeUserSelectedRef.current && dayKeysSorted.length >= 7) {
      const startIdx = Math.max(0, fallbackIdx - 6);
      setCpuDayStart(dayKeysSorted[startIdx]);
      setCpuDayEnd(anchorDayKey);
    } else if (!cpuRangeUserSelectedRef.current && dayKeysSorted.length > 0) {
      setCpuDayStart(dayKeysSorted[0]);
      setCpuDayEnd(anchorDayKey);
    }
    
    if (!memoryRangeUserSelectedRef.current && dayKeysSorted.length >= 7) {
      const startIdx = Math.max(0, fallbackIdx - 6);
      setMemoryDayStart(dayKeysSorted[startIdx]);
      setMemoryDayEnd(anchorDayKey);
    } else if (!memoryRangeUserSelectedRef.current && dayKeysSorted.length > 0) {
      setMemoryDayStart(dayKeysSorted[0]);
      setMemoryDayEnd(anchorDayKey);
    }
  }, [dayKeysSorted, cpuCalendarMonth, memoryCalendarMonth, cpuYear, cpuMonth, memoryYear, memoryMonth]);
  
  // CPU Calendar days
  const cpuCalendarDays = useMemo(() => {
    if (!cpuCalendarMonth) return [];
    const [year, month] = cpuCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const days = [];
    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) days.push(null);
    while (date.getMonth() === parseInt(month, 10) - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [cpuCalendarMonth]);
  
  // Memory Calendar days
  const memoryCalendarDays = useMemo(() => {
    if (!memoryCalendarMonth) return [];
    const [year, month] = memoryCalendarMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const days = [];
    const startDay = date.getDay();
    for (let i = 0; i < startDay; i++) days.push(null);
    while (date.getMonth() === parseInt(month, 10) - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  }, [memoryCalendarMonth]);
  
  // Calendar navigation
  const cpuPrevMonth = () => {
    if (!cpuCalendarMonth) return;
    const d = new Date(cpuCalendarMonth);
    d.setMonth(d.getMonth() - 1);
    setCpuCalendarMonth(formatDateInput(d).slice(0, 7) + '-01');
  };
  
  const cpuNextMonth = () => {
    if (!cpuCalendarMonth) return;
    const d = new Date(cpuCalendarMonth);
    d.setMonth(d.getMonth() + 1);
    setCpuCalendarMonth(formatDateInput(d).slice(0, 7) + '-01');
  };
  
  const memoryPrevMonth = () => {
    if (!memoryCalendarMonth) return;
    const d = new Date(memoryCalendarMonth);
    d.setMonth(d.getMonth() - 1);
    setMemoryCalendarMonth(formatDateInput(d).slice(0, 7) + '-01');
  };
  
  const memoryNextMonth = () => {
    if (!memoryCalendarMonth) return;
    const d = new Date(memoryCalendarMonth);
    d.setMonth(d.getMonth() + 1);
    setMemoryCalendarMonth(formatDateInput(d).slice(0, 7) + '-01');
  };

  useEffect(() => {
    if (!isCpuRangeDragging) {return;}
    const onUp = () => setIsCpuRangeDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isCpuRangeDragging]);
  
  useEffect(() => {
    if (!isMemoryRangeDragging) return;
    const onUp = () => setIsMemoryRangeDragging(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [isMemoryRangeDragging]);

  const selectedCpuDayKeys = useMemo(() => {
    if (cpuChartMode === 'MONTH') {
      const month = cpuMonth || (dayKeysSorted.length > 0 ? dayKeysSorted[dayKeysSorted.length - 1].slice(0, 7) : '');
      if (!month) return [];
      return dayKeysSorted.filter((k) => k.slice(0, 7) === month);
    }
    if (cpuChartMode === 'YEAR') {
      const year = cpuYear || (dayKeysSorted.length > 0 ? dayKeysSorted[dayKeysSorted.length - 1].slice(0, 4) : '');
      if (!year) return [];
      return dayKeysSorted.filter((k) => k.slice(0, 4) === year);
    }
    // DAY_RANGE - use user-selected range
    const start = cpuDayStart || '';
    const end = cpuDayEnd || '';
    if (!start || !end) return dayKeysSorted;
    return dayKeysSorted.filter(k => k >= start && k <= end);
  }, [dayKeysSorted, cpuChartMode, cpuDayStart, cpuDayEnd, cpuMonth, cpuYear]);

  const selectedMemoryDayKeys = useMemo(() => {
    if (memoryChartMode === 'MONTH') {
      const month = memoryMonth || (dayKeysSorted.length > 0 ? dayKeysSorted[dayKeysSorted.length - 1].slice(0, 7) : '');
      if (!month) return [];
      return dayKeysSorted.filter((k) => k.slice(0, 7) === month);
    }
    if (memoryChartMode === 'YEAR') {
      const year = memoryYear || (dayKeysSorted.length > 0 ? dayKeysSorted[dayKeysSorted.length - 1].slice(0, 4) : '');
      if (!year) return [];
      return dayKeysSorted.filter((k) => k.slice(0, 4) === year);
    }
    // DAY_RANGE - use user-selected range
    const start = memoryDayStart || '';
    const end = memoryDayEnd || '';
    if (!start || !end) return dayKeysSorted;
    return dayKeysSorted.filter(k => k >= start && k <= end);
  }, [dayKeysSorted, memoryChartMode, memoryDayStart, memoryDayEnd, memoryMonth, memoryYear]);

  const filesByDay = useMemo(() => {
    const map = new Map();
    dayKeysSorted.forEach((dateKey) => {
      const files = filesByDate[dateKey] || [];
      map.set(dateKey, files.map(fileName => ({ fileName })));
    });
    return map;
  }, [dayKeysSorted, filesByDate]);

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

  const computeTrendCombined = (points) => {
    let memRunningSum = 0;
    let memRunningMax = 0;
    let pagingRunningSum = 0;
    let pagingRunningMax = 0;
    return points.map((p, idx) => {
      const memValue = toNumber(p.memoryUsed);
      const pagingValue = toNumber(p.pagingUsed);
      memRunningSum += memValue;
      memRunningMax = Math.max(memRunningMax, memValue);
      pagingRunningSum += pagingValue;
      pagingRunningMax = Math.max(pagingRunningMax, pagingValue);
      return {
        ...p,
        avgTrend: memRunningSum / (idx + 1),
        maxTrend: memRunningMax,
        pagingAvgTrend: pagingRunningSum / (idx + 1),
        pagingMaxTrend: pagingRunningMax
      };
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!topFiles || topFiles.length === 0 || !selectedCpuDayKeys.length) {
        setCpuChartData([]);
        setCpuChartError('');
        return;
      }

      setCpuChartLoading(true);
      setCpuChartError('');

      try {
        const dailyResults = await Promise.all(
          selectedCpuDayKeys.map(async (dayKey) => {
            const files = filesByDay.get(dayKey) || [];
            const values = await Promise.all(
              files.map(async ({ fileName }) => {
                const cacheKey = `${systemName}::${fileName}`;
                const cached = cpuUsedCacheRef.current.get(cacheKey);
                if (typeof cached === 'number') {return cached;}
                
                const response = await getFileData(systemName, fileName, 'top');
                const cpu_lpar = response?.parsed_data?.cpu_lpar || response?.cpu_lpar;
                const user = toNumber(cpu_lpar?.user_pct) || 0;
                const kern = toNumber(cpu_lpar?.kern_pct) || 0;
                const wait = toNumber(cpu_lpar?.wait_pct) || 0;
                const used = clamp(user + kern + wait, 0, 100);
                
                cpuUsedCacheRef.current.set(cacheKey, used);
                return used;
              })
            );

            const sum = values.reduce((acc, v) => acc + toNumber(v), 0);
            const avg = values.length ? (sum / values.length) : 0;

            const ts = new Date(`${dayKey}T12:00:00`);
            return {
              ts,
              date: dayKey,
              month: dayKey.slice(0, 7),
              label: `${dayKey.slice(5, 7)}-${dayKey.slice(8, 10)}`,
              cpuUsed: avg
            };
          })
        );

        if (cancelled) {return;}

        if (cpuChartMode === 'YEAR') {
          const byMonth = new Map();
          for (const r of dailyResults) {
            const key = r.month;
            const current = byMonth.get(key) || { key, ts: r.ts, sum: 0, count: 0 };
            current.sum += r.cpuUsed;
            current.count += 1;
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
        }
      } finally {
        if (!cancelled) {setCpuChartLoading(false);}
      }
    };

    load();
    return () => { cancelled = true; };
  }, [topFiles, selectedCpuDayKeys, cpuChartMode, filesByDay, systemName]);

  // Memory Chart Data Loading
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!topFiles || topFiles.length === 0 || !selectedMemoryDayKeys.length) {
        setMemoryChartData([]);
        setMemoryChartError('');
        return;
      }

      setMemoryChartLoading(true);
      setMemoryChartError('');

      try {
        const dailyResults = await Promise.all(
          selectedMemoryDayKeys.map(async (dayKey) => {
            const files = filesByDay.get(dayKey) || [];
            const memValues = await Promise.all(
              files.map(async ({ fileName }) => {
                const cacheKey = `${systemName}::${fileName}`;
                const cached = memoryUsedCacheRef.current.get(cacheKey);
                if (typeof cached === 'number') {return cached;}
                
                const response = await getFileData(systemName, fileName, 'top');
                const memory = response?.parsed_data?.memory || response?.memory || {};
                const total_mb = toNumber(memory?.total_mb) || 1;
                const free_mb = toNumber(memory?.free_ram_mb) || 0;
                const used_mb = total_mb - free_mb;
                const pct = (used_mb / total_mb) * 100;
                
                memoryUsedCacheRef.current.set(cacheKey, pct);
                return pct;
              })
            );

            const pagingValues = await Promise.all(
              files.map(async ({ fileName }) => {
                const cacheKey = `${systemName}::${fileName}`;
                const cached = pagingUsedCacheRef.current.get(cacheKey);
                if (typeof cached === 'number') {return cached;}
                
                const response = await getFileData(systemName, fileName, 'top');
                const paging = response?.parsed_data?.paging || response?.paging || {};
                const used_pct = toNumber(paging?.used_pct) || 0;
                
                pagingUsedCacheRef.current.set(cacheKey, used_pct);
                return used_pct;
              })
            );

            const memSum = memValues.reduce((acc, v) => acc + toNumber(v), 0);
            const memAvg = memValues.length ? (memSum / memValues.length) : 0;
            
            const pagingSum = pagingValues.reduce((acc, v) => acc + toNumber(v), 0);
            const pagingAvg = pagingValues.length ? (pagingSum / pagingValues.length) : 0;

            const ts = new Date(`${dayKey}T12:00:00`);
            return {
              ts,
              date: dayKey,
              month: dayKey.slice(0, 7),
              label: `${dayKey.slice(5, 7)}-${dayKey.slice(8, 10)}`,
              memoryUsed: memAvg,
              pagingUsed: pagingAvg
            };
          })
        );

        if (cancelled) {return;}

        if (memoryChartMode === 'YEAR') {
          const byMonth = new Map();
          for (const r of dailyResults) {
            const key = r.month;
            const current = byMonth.get(key) || { key, ts: r.ts, memSum: 0, pagingSum: 0, count: 0 };
            current.memSum += r.memoryUsed;
            current.pagingSum += r.pagingUsed;
            current.count += 1;
            if (r.ts.getTime() < current.ts.getTime()) {current.ts = r.ts;}
            byMonth.set(key, current);
          }
          const months = Array.from(byMonth.values())
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((m) => ({
              label: m.key,
              memoryUsed: m.count ? m.memSum / m.count : 0,
              pagingUsed: m.count ? m.pagingSum / m.count : 0
            }));
          setMemoryChartData(computeTrendCombined(months));
        } else {
          const days = dailyResults
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((r) => ({ label: r.label, memoryUsed: r.memoryUsed, pagingUsed: r.pagingUsed }));
          setMemoryChartData(computeTrendCombined(days));
        }
        
        // Also set paging chart data for backward compatibility
        const pagingOnlyData = dailyResults.map(r => ({ label: r.label, date: r.date, month: r.month, ts: r.ts, pagingUsed: r.pagingUsed }));
        if (memoryChartMode === 'YEAR') {
          const byMonth = new Map();
          for (const r of pagingOnlyData) {
            const key = r.month;
            const current = byMonth.get(key) || { key, ts: r.ts, sum: 0, count: 0 };
            current.sum += r.pagingUsed;
            current.count += 1;
            if (r.ts.getTime() < current.ts.getTime()) {current.ts = r.ts;}
            byMonth.set(key, current);
          }
          const months = Array.from(byMonth.values())
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((m) => ({
              label: m.key,
              pagingUsed: m.count ? m.sum / m.count : 0
            }));
          setPagingChartData(computeTrend(months, 'pagingUsed'));
        } else {
          const days = pagingOnlyData
            .sort((a, b) => a.ts.getTime() - b.ts.getTime())
            .map((r) => ({ label: r.label, pagingUsed: r.pagingUsed }));
          setPagingChartData(computeTrend(days, 'pagingUsed'));
        }
      } catch (e) {
        if (!cancelled) {
          const errorMsg = 'Failed to load Memory chart data';
          setMemoryChartError(errorMsg);
          setMemoryChartData([]);
        }
      } finally {
        if (!cancelled) {setMemoryChartLoading(false);}
      }
    };

    load();
    return () => { cancelled = true; };
  }, [topFiles, selectedMemoryDayKeys, memoryChartMode, filesByDay, systemName]);

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

    min = clamp(min, 0, 100);
    max = clamp(max, 0, 100);

    const rawRange = Math.max(0, max - min);
    const pad = clamp(Math.max(1, Math.round(rawRange * 0.1)), 1, 10);
    let nextMin = clamp(min - pad, 0, 100);
    let nextMax = clamp(max + pad, 0, 100);

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

  const cpuYAxisTicks = useMemo(() => {
    const min = clamp(Math.floor(toNumber(cpuYDomain.min)), 0, 100);
    const max = clamp(Math.ceil(toNumber(cpuYDomain.max)), 0, 100);
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const range = safeMax - safeMin;

    const step = range <= 10 ? 1 : 5;
    const first = Math.ceil(safeMin / step) * step;

    const ticks = [safeMin];
    for (let v = first; v <= safeMax; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== safeMax) {ticks.push(safeMax);}

    return Array.from(new Set(ticks.map((v) => clamp(Math.round(v), 0, 100)))).sort((a, b) => a - b);
  }, [cpuYDomain.min, cpuYDomain.max]);

  // Memory and Paging Y Domain Calculations (same as CPU since they're percentages)
  const memoryYDomain = useMemo(() => computeCpuYDomainFromData(memoryChartData.map(r => ({...r, cpuUsed: r.memoryUsed, avgTrend: r.avgTrend, maxTrend: r.maxTrend}))), [memoryChartData]);
  const memoryYAxisTicks = useMemo(() => {
    const min = clamp(Math.floor(toNumber(memoryYDomain.min)), 0, 100);
    const max = clamp(Math.ceil(toNumber(memoryYDomain.max)), 0, 100);
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const range = safeMax - safeMin;

    const step = range <= 10 ? 1 : 5;
    const first = Math.ceil(safeMin / step) * step;

    const ticks = [safeMin];
    for (let v = first; v <= safeMax; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== safeMax) {ticks.push(safeMax);}

    return Array.from(new Set(ticks.map((v) => clamp(Math.round(v), 0, 100)))).sort((a, b) => a - b);
  }, [memoryYDomain.min, memoryYDomain.max]);

  const pagingYDomain = useMemo(() => computeCpuYDomainFromData(pagingChartData.map(r => ({...r, cpuUsed: r.pagingUsed, avgTrend: r.avgTrend, maxTrend: r.maxTrend}))), [pagingChartData]);
  const pagingYAxisTicks = useMemo(() => {
    const min = clamp(Math.floor(toNumber(pagingYDomain.min)), 0, 100);
    const max = clamp(Math.ceil(toNumber(pagingYDomain.max)), 0, 100);
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    const range = safeMax - safeMin;

    const step = range <= 10 ? 1 : 5;
    const first = Math.ceil(safeMin / step) * step;

    const ticks = [safeMin];
    for (let v = first; v <= safeMax; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== safeMax) {ticks.push(safeMax);}

    return Array.from(new Set(ticks.map((v) => clamp(Math.round(v), 0, 100)))).sort((a, b) => a - b);
  }, [pagingYDomain.min, pagingYDomain.max]);

  const effectiveData = (isRefreshing && lastStableDataRef.current) ? lastStableDataRef.current : data;
  const parsedData = effectiveData?.parsed_data || effectiveData?.parsed_top || effectiveData;

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

  if (!parsedData) {
    return null;
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
            }}
          >
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

      {/* CPU Trend Chart Section */}
      <div style={{
        marginBottom: '24px',
        background: `linear-gradient(135deg, colors.bgSecondary 0%, colors.bg 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: 'none'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap'}}>
          <h3 style={{margin: 0, fontSize: '18px', fontWeight: '800', color: colors.warning, textTransform: 'uppercase', letterSpacing: '0.5px'}}>CPU Trend</h3>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
            {/* Range selector - only show when in DAY_RANGE mode */}
            {cpuChartMode === 'DAY_RANGE' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Range:</span>
                <div style={{position: 'relative', minWidth: '200px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuDateDropdown(!showCpuDateDropdown);
                      const base = cpuDayEnd || (availableDates[0] || '');
                      if (base) setCpuCalendarMonth(`${base.slice(0, 7)}-01`);
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
                          style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                        >
                          ◀
                        </button>
                        <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>
                          {cpuCalendarMonth ? `${cpuCalendarMonth.slice(5, 7)}/${cpuCalendarMonth.slice(0, 4)}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={cpuNextMonth}
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
                          if (!day) return <div key={`empty-${idx}`} />;

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
                                if (!isCpuRangeDragging) return;
                                setCpuRangeDragEnd(dateStr);
                              }}
                              onMouseUp={() => {
                                if (!isCpuRangeDragging) return;
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
                                background: isBoundary ? colors.bgSecondary : inRange ? `${colors.primary}20` : colors.bg,
                                color: hasFiles ? colors.text : colors.textTertiary,
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontWeight: isBoundary ? '700' : '500',
                                userSelect: 'none'
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
            )}
            
            {/* Month selector - only show when in MONTH mode */}
            {cpuChartMode === 'MONTH' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Month:</span>
                <div style={{position: 'relative', minWidth: '140px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuMonthDropdown(!showCpuMonthDropdown);
                      setShowCpuYearDropdown(false);
                      setShowCpuDateDropdown(false);
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
                    <span>{cpuMonth || 'Select month'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showCpuMonthDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showCpuMonthDropdown && (
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
                      {availableMonths.slice().sort().reverse().map((m) => (
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
                            fontWeight: cpuMonth === m ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (cpuMonth !== m) e.currentTarget.style.background = colors.bgSecondary;
                          }}
                          onMouseLeave={(e) => {
                            if (cpuMonth !== m) e.currentTarget.style.background = 'transparent';
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

            {/* Year selector - only show when in YEAR mode */}
            {cpuChartMode === 'YEAR' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Year:</span>
                <div style={{position: 'relative', minWidth: '110px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCpuYearDropdown(!showCpuYearDropdown);
                      setShowCpuMonthDropdown(false);
                      setShowCpuDateDropdown(false);
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
                    <span>{cpuYear || 'Select year'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showCpuYearDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showCpuYearDropdown && (
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
                      {availableYears.slice().sort().reverse().map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            cpuYearUserSelectedRef.current = true;
                            setCpuYear(y);
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
                            fontWeight: cpuYear === y ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (cpuYear !== y) e.currentTarget.style.background = colors.bgSecondary;
                          }}
                          onMouseLeave={(e) => {
                            if (cpuYear !== y) e.currentTarget.style.background = 'transparent';
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
            
            <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`}}>
              {[
                { key: 'DAY_RANGE', label: 'Day Range' },
                { key: 'MONTH', label: 'Month' },
                { key: 'YEAR', label: 'Year' }
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setCpuChartMode(mode.key)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: cpuChartMode === mode.key ? colors.success : 'transparent',
                    color: '#fff',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (cpuChartMode !== mode.key) {
                      e.target.style.color = colors.info;
                      e.target.style.background = `${colors.primary}20`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#fff';
                    if (cpuChartMode !== mode.key) {
                      e.target.style.background = 'transparent';
                    }
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {cpuChartError ? (
          <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{color: colors.error, fontSize: '12px'}}>{cpuChartError}</span>
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
          <div style={{width: '100%', height: '280px', minWidth: '200px', minHeight: '200px'}}>
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
        )}
      </div>

      {/* Memory & Paging Space Combined Trend Chart */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.bgSecondary} 0%, ${colors.bg} 100%)`,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
            <h3 style={{margin: 0, fontSize: '18px', fontWeight: '800', color: colors.info, textTransform: 'uppercase', letterSpacing: '0.5px'}}>Memory (RAM) Trend</h3>
            
            <button
              type="button"
              onClick={() => setShowPagingInMemoryChart(!showPagingInMemoryChart)}
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
              title="Toggle Paging Space visibility on the chart"
            >
              <span style={{width: '10px', height: '10px', borderRadius: '2px', background: showPagingInMemoryChart ? colors.success : colors.border}} />
              Paging
            </button>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'}}>
            {/* Range selector - only show when in DAY_RANGE mode */}
            {memoryChartMode === 'DAY_RANGE' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Range:</span>
                <div style={{position: 'relative', minWidth: '200px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMemoryDateDropdown(!showMemoryDateDropdown);
                      const base = memoryDayEnd || (availableDates[0] || '');
                      if (base) setMemoryCalendarMonth(`${base.slice(0, 7)}-01`);
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
                    <span>{memoryDayStart && memoryDayEnd ? `${memoryDayStart} → ${memoryDayEnd}` : 'Select range'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showMemoryDateDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showMemoryDateDropdown && (
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
                          onClick={memoryPrevMonth}
                          style={{background: 'none', border: 'none', color: colors.info, cursor: 'pointer', fontSize: '16px'}}
                        >
                          ◀
                        </button>
                        <span style={{color: colors.text, fontWeight: '600', fontSize: '13px'}}>
                          {memoryCalendarMonth ? `${memoryCalendarMonth.slice(5, 7)}/${memoryCalendarMonth.slice(0, 4)}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={memoryNextMonth}
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
                        {memoryCalendarDays.map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} />;

                          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                          const hasFiles = availableDateSet.has(dateStr);

                          const dragStart = isMemoryRangeDragging ? memoryRangeDragStart : '';
                          const dragEnd = isMemoryRangeDragging ? (memoryRangeDragEnd || memoryRangeDragStart) : '';
                          const rangeStart = (dragStart || memoryDayStart) || '';
                          const rangeEnd = (dragEnd || memoryDayEnd) || '';
                          const minRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeStart : rangeEnd) : (rangeStart || rangeEnd);
                          const maxRange = rangeStart && rangeEnd ? (rangeStart <= rangeEnd ? rangeEnd : rangeStart) : (rangeStart || rangeEnd);
                          const inRange = minRange && maxRange && dateStr >= minRange && dateStr <= maxRange;
                          const isBoundary = minRange && maxRange && (dateStr === minRange || dateStr === maxRange);

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onMouseDown={() => {
                                setMemoryRangeDragStart(dateStr);
                                setMemoryRangeDragEnd(dateStr);
                                setIsMemoryRangeDragging(true);
                              }}
                              onMouseEnter={() => {
                                if (!isMemoryRangeDragging) return;
                                setMemoryRangeDragEnd(dateStr);
                              }}
                              onMouseUp={() => {
                                if (!isMemoryRangeDragging) return;
                                const start = memoryRangeDragStart;
                                const end = memoryRangeDragEnd || dateStr;
                                if (!start || !end) {
                                  setIsMemoryRangeDragging(false);
                                  return;
                                }
                                const min = start <= end ? start : end;
                                const max = start <= end ? end : start;
                                memoryRangeUserSelectedRef.current = true;
                                setMemoryDayStart(min);
                                setMemoryDayEnd(max);
                                setIsMemoryRangeDragging(false);
                                setShowMemoryDateDropdown(false);
                              }}
                              style={{
                                padding: '6px',
                                fontSize: '11px',
                                border: isBoundary ? `2px solid ${colors.info}` : 'none',
                                background: isBoundary ? colors.bgSecondary : inRange ? `${colors.primary}20` : colors.bg,
                                color: hasFiles ? colors.text : colors.textTertiary,
                                cursor: 'pointer',
                                borderRadius: '4px',
                                fontWeight: isBoundary ? '700' : '500',
                                userSelect: 'none'
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
            )}
            
            {/* Month selector - only show when in MONTH mode */}
            {memoryChartMode === 'MONTH' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Month:</span>
                <div style={{position: 'relative', minWidth: '140px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMemoryMonthDropdown(!showMemoryMonthDropdown);
                      setShowMemoryYearDropdown(false);
                      setShowMemoryDateDropdown(false);
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
                    <span>{memoryMonth || 'Select month'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showMemoryMonthDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showMemoryMonthDropdown && (
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
                      {availableMonths.slice().sort().reverse().map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            memoryMonthUserSelectedRef.current = true;
                            setMemoryMonth(m);
                            setShowMemoryMonthDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: memoryMonth === m ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            fontWeight: memoryMonth === m ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (memoryMonth !== m) e.currentTarget.style.background = colors.bgSecondary;
                          }}
                          onMouseLeave={(e) => {
                            if (memoryMonth !== m) e.currentTarget.style.background = 'transparent';
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

            {/* Year selector - only show when in YEAR mode */}
            {memoryChartMode === 'YEAR' && (
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', background: colors.bgSecondary, padding: '8px 12px', borderRadius: '6px', border: `1px solid ${colors.border}`}}>
                <span style={{fontSize: '12px', color: colors.text, fontWeight: '500'}}>Year:</span>
                <div style={{position: 'relative', minWidth: '110px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMemoryYearDropdown(!showMemoryYearDropdown);
                      setShowMemoryMonthDropdown(false);
                      setShowMemoryDateDropdown(false);
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
                    <span>{memoryYear || 'Select year'}</span>
                    <span style={{display: 'flex', alignItems: 'center', transform: showMemoryYearDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'}}>
                      <FaChevronDown style={{color: colors.info}} />
                    </span>
                  </button>
                  
                  {showMemoryYearDropdown && (
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
                      {availableYears.slice().sort().reverse().map((y) => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => {
                            memoryYearUserSelectedRef.current = true;
                            setMemoryYear(y);
                            setShowMemoryYearDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: 'none',
                            background: memoryYear === y ? colors.border : 'transparent',
                            color: colors.text,
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left',
                            fontWeight: memoryYear === y ? '600' : '400'
                          }}
                          onMouseEnter={(e) => {
                            if (memoryYear !== y) e.currentTarget.style.background = colors.bgSecondary;
                          }}
                          onMouseLeave={(e) => {
                            if (memoryYear !== y) e.currentTarget.style.background = 'transparent';
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
            
            <div style={{display: 'flex', gap: '2px', backgroundColor: colors.bg, borderRadius: '6px', padding: '4px', border: `1px solid ${colors.border}`}}>
              {[
                { key: 'DAY_RANGE', label: 'Day Range' },
                { key: 'MONTH', label: 'Month' },
                { key: 'YEAR', label: 'Year' }
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setMemoryChartMode(mode.key)}
                  style={{
                    padding: '6px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: memoryChartMode === mode.key ? colors.success : 'transparent',
                    color: '#fff',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (memoryChartMode !== mode.key) {
                      e.target.style.color = colors.info;
                      e.target.style.background = `${colors.primary}20`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#fff';
                    if (memoryChartMode !== mode.key) {
                      e.target.style.background = 'transparent';
                    }
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {memoryChartError ? (
          <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <span style={{color: colors.error, fontSize: '12px'}}>{memoryChartError}</span>
          </div>
        ) : memoryChartLoading || !topFiles || topFiles.length === 0 ? (
          <ChartSkeleton />
        ) : memoryChartData.length === 0 && !memoryChartError ? (
          <ChartSkeleton />
        ) : memoryChartData.length === 0 ? (
          <div style={{padding: '12px', borderRadius: '8px', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.textSecondary, fontSize: '12px'}}>
            No memory history data available.
          </div>
        ) : (
          <>
            <div ref={memoryChartPngRef} style={{width: '100%', height: '280px', minWidth: '200px', minHeight: '200px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={memoryChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    stroke={colors.textTertiary}
                    tick={{ fontSize: 11, fill: colors.text }}
                    axisLine={{ stroke: colors.textTertiary }}
                    tickLine={{ stroke: colors.textTertiary }}
                  />
                  <YAxis
                    domain={showPagingInMemoryChart ? [Math.min(memoryYDomain.min, pagingYDomain.min), Math.max(memoryYDomain.max, pagingYDomain.max)] : [memoryYDomain.min, memoryYDomain.max]}
                    ticks={showPagingInMemoryChart ? pagingYAxisTicks : memoryYAxisTicks}
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
                  <Bar name="RAM Used" dataKey="memoryUsed" stackId="ram" fill={colors.error} fillOpacity={0.5} radius={[0, 0, 0, 0]} />
                  <Line name="Avg Trend (RAM)" type="monotone" dataKey="avgTrend" stroke={colors.info} strokeWidth={4} strokeDasharray="6 4" dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.info }} />
                  <Line name="Max Trend (RAM)" type="monotone" dataKey="maxTrend" stroke={colors.warning} strokeWidth={4} dot={false} activeDot={{ r: 4, stroke: colors.text, strokeWidth: 2, fill: colors.warning }} />
                  {showPagingInMemoryChart && pagingChartData.length > 0 && (
                    <>
                      <Bar name="Swap Used" dataKey="pagingUsed" stackId="swap" fill={colors.primary} fillOpacity={0.55} radius={[0, 0, 0, 0]} />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
              <button
                type="button"
                disabled={memoryChartLoading || memoryChartData.length === 0}
                onClick={() => downloadSvgAsPng({ rootEl: memoryChartPngRef, fileNameBase: 'memory-paging-trend' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: memoryChartLoading || memoryChartData.length === 0 ? 'not-allowed' : 'pointer',
                  color: memoryChartLoading || memoryChartData.length === 0 ? colors.textTertiary : colors.text,
                  fontSize: '12px',
                  fontWeight: '700',
                  opacity: memoryChartLoading || memoryChartData.length === 0 ? 0.6 : 1
                }}
                title="Download chart as PNG"
              >
                Download PNG
              </button>
            </div>
          </>
        )}
      </div>

      <h2 style={{marginTop: 0, marginBottom: '32px', fontSize: '24px', fontWeight: '700', color: colors.text, letterSpacing: '-0.5px'}}>Statistics</h2>

      {/* Row - CPU, Memory, Paging - Responsive Grid */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px'}}>
        <CPUCard cpuLpar={parsedData.cpu_lpar} theme={theme} colors={colors} cpuViewMode={cpuViewMode} setCpuViewMode={setCpuViewMode} />
        <MemoryCard memory={parsedData.memory} theme={theme} colors={colors} memoryUnit={memoryUnit} setMemoryUnit={setMemoryUnit} memoryViewMode={memoryViewMode} setMemoryViewMode={setMemoryViewMode} hoveredMemoryUnit={hoveredMemoryUnit} setHoveredMemoryUnit={setHoveredMemoryUnit} />
        <PagingCard paging={parsedData.paging} theme={theme} colors={colors} pagingViewMode={pagingViewMode} setPagingViewMode={setPagingViewMode} />
      </div>
    </div>
  );
});

AIXSystemView.propTypes = {
  data: PropTypes.object,
  theme: PropTypes.object,
  isLoading: PropTypes.bool,
  isRefreshing: PropTypes.bool,
  topFiles: PropTypes.array,
  selectedTopFile: PropTypes.string,
  _onSelectTopFile: PropTypes.func,
  onRefresh: PropTypes.func,
  systemName: PropTypes.string,
  lastUpdated: PropTypes.string,
  _uptime: PropTypes.string
};

export default AIXSystemView;
