import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { serverController } from './controllers/ServerController';
import { fetchFilesListPersistent, getFileData } from '../store/api';
import { normalizeTablespacePayload } from './models/ServerModel';
import { ToastProvider, useToast } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Logo } from './components/Logo';
import { FiChevronLeft, FiChevronRight, FiHome, FiSun, FiMoon, FiServer, FiRefreshCw, FiDownload } from 'react-icons/fi';
import { formatTimestamp } from './utils/stringUtils';
import { exportHomeViewToPdf } from './utils/exportPdf';
import './App.css';

// Lazy load heavy components for better performance
const AIXSystemView = lazy(() => import('./views/AIXSystemView').then(m => ({ default: m.AIXSystemView })));
const StatsView = lazy(() => import('./views/StatsView').then(m => ({ default: m.StatsView })));
const ProcessesView = lazy(() => import('./views/ProcessesView').then(m => ({ default: m.ProcessesView })));
const DiskView = lazy(() => import('./views/DiskView').then(m => ({ default: m.DiskView })));
const TableSpaceView = lazy(() => import('./views/TableSpaceView').then(m => ({ default: m.TableSpaceView })));
const LoggapView = lazy(() => import('./views/LoggapView').then(m => ({ default: m.LoggapView })));
const CheckProcessView = lazy(() => import('./views/CheckProcessView').then(m => ({ default: m.CheckProcessView })));
const BackupView = lazy(() => import('./views/BackupView'));
const ErrptMoreView = lazy(() => import('./views/ErrorReportView').then(m => ({ default: m.ErrptMoreView })));
const ErrptAMoreView = lazy(() => import('./views/ErrorReportView').then(m => ({ default: m.ErrptAMoreView })));

const SERVER_TABLE_MAP = {
  'ERP-AIX': ['top', 'df', 'tablespace', 'check_process', 'db_backup', 'weekly_backup', 'backup_db_local', 'errpt_more', 'errpt_a_more'],
  'DR-SITE': ['top', 'df', 'loggap'],
  'APP-01': ['top', 'df', 'tablespace'],
  'DB-01': ['top', 'df', 'tablespace'],
  'RETAIL-DB': ['top', 'df', 'tablespace'],
  'CORE-DB': ['top', 'df', 'tablespace'],
  'HELPDESK-01': ['top', 'df', 'tablespace'],
  'HELPDESK-02': ['top', 'df', 'tablespace'],
  default: ['top', 'df']
};

const HOME_PRIMARY_TABLES = new Set(['top', 'df', 'tablespace']);
const HOME_SECONDARY_TABLES = new Set([
  'loggap',
  'check_process',
  'db_backup',
  'weekly_backup',
  'backup_db_local',
  'errpt_more',
  'errpt_a_more'
]);
const HOME_TABLESPACE_CANDIDATE_COUNT = 3;

const createHomeServerState = (serverName) => ({
  serverName,
  topFiles: [],
  diskFiles: [],
  tablespaceFiles: [],
  loggapFiles: [],
  checkProcessFiles: [],
  dbBackupFiles: [],
  weeklyBackupFiles: [],
  backupLocalFiles: [],
  errptMoreFiles: [],
  errptAMoreFiles: [],
  selectedTopFile: '',
  selectedDiskFile: '',
  selectedTablespaceFile: '',
  selectedLoggapFile: '',
  selectedCheckProcessFile: '',
  selectedDbBackupFile: '',
  selectedWeeklyBackupFile: '',
  selectedBackupLocalFile: '',
  selectedErrptMoreFile: '',
  selectedErrptAMoreFile: '',
  selectedTopFileData: null,
  selectedDiskFileData: null,
  selectedTablespaceFileData: null,
  selectedLoggapFileData: null,
  selectedCheckProcessFileData: null,
  selectedDbBackupFileData: null,
  selectedWeeklyBackupFileData: null,
  selectedBackupLocalFileData: null,
  selectedErrptMoreFileData: null,
  selectedErrptAMoreFileData: null,
  isLoadingFileData: false,
  isLoadingSecondary: false
});

const normalizeTablespaceData = (data) => {
  const normalized = normalizeTablespacePayload(data);
  return Array.isArray(normalized) ? { tablespace: normalized } : null;
};

const normalizeDiskData = (data) => {
  if (!data || !Array.isArray(data.parsed_df)) {
    return null;
  }

  const dfData = data.parsed_df.map(df => ({
    filesystem: df.filesystem || 'N/A',
    '1K-blocks': parseInt(df['1K-blocks']) || 0,
    used: parseInt(df.used) || 0,
    available: parseInt(df.available) || 0,
    'use%': df['use%'] || '0%',
    mounted: df.mounted || 'N/A',
    ...df
  }));

  return {
    df: dfData,
    timestamp: data.timestamp || '',
    raw_stdout: data.raw_stdout || ''
  };
};

const normalizeLoggapData = (data) => {
  if (!data || !data.Loggaps) {
    return null;
  }

  const loggaps = (Array.isArray(data.Loggaps) ? data.Loggaps : [data.Loggaps]).map((lg) => ({
    Loggap_name: lg.Loggap_name || 'N/A',
    summary: {
      time_lag: lg.summary?.time_lag || 'N/A',
      transfer_gap: lg.summary?.transfer_gap ?? 0,
      apply_gap: lg.summary?.apply_gap ?? 0,
      source_sequence: lg.summary?.source_sequence ?? 0,
      last_archived: lg.summary?.last_archived ?? 0,
      source_scn: lg.summary?.source_scn || '',
      source_time: lg.summary?.source_time || '',
      destination_scn: lg.summary?.destination_scn || '',
      destination_time: lg.summary?.destination_time || '',
      last_transferred_ts: lg.summary?.last_transferred_ts || '',
      next_required_seq: lg.summary?.next_required_seq ?? 0,
      ...lg.summary
    },
    ...lg
  }));

  return {
    Loggaps: loggaps,
    timestamp: data.timestamp || '',
    raw_stdout: data.raw_stdout || ''
  };
};

const normalizeCheckProcessData = (data) => {
  if (!data || !data.Check_Processes) {
    return null;
  }

  const checkProcesses = (Array.isArray(data.Check_Processes) ? data.Check_Processes : [data.Check_Processes]).map((cp) => ({
    process: cp.process || 'N/A',
    status: cp.status || 'N/A',
    pid: cp.pid || 0,
    ...cp
  }));

  return {
    ...data,
    Check_Processes: checkProcesses
  };
};

const resolveHomeTablespaceSelection = async (serverName, sortedTablespaceFiles) => {
  if (!Array.isArray(sortedTablespaceFiles) || sortedTablespaceFiles.length === 0) {
    return { selectedTablespaceFile: '', selectedTablespaceFileData: null };
  }

  const candidates = sortedTablespaceFiles.slice(0, HOME_TABLESPACE_CANDIDATE_COUNT);
  const results = await Promise.all(candidates.map(async (fileName) => {
    try {
      const rawData = await getFileData(serverName, fileName, 'tablespace');
      return { fileName, data: normalizeTablespaceData(rawData) };
    } catch (error) {
      return { fileName, data: null };
    }
  }));

  const hit = results.find((item) => item.data?.tablespace?.length > 0);
  const picked = hit || results[0];

  return {
    selectedTablespaceFile: picked?.fileName || '',
    selectedTablespaceFileData: picked?.data || null
  };
};

function AppContentInner() {
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();
  const [state, setState] = useState(() => serverController.model.getState());
  const [collapsed, setCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingServer, setIsLoadingServer] = useState(false); // Flag to ignore file selections during server load
  const [isHomeView, setIsHomeView] = useState(true);
  const [homeData, setHomeData] = useState({});
  const [isHomeLoading, setIsHomeLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const homeDataRef = useRef({});
  const homeRequestRef = useRef({});
  const serversRef = useRef([]);
  const isLoadingHomeRef = useRef(false);

  const getHomeRequestToken = useCallback((serverName) => {
    const next = (homeRequestRef.current[serverName] || 0) + 1;
    homeRequestRef.current[serverName] = next;
    return next;
  }, []);

  const isHomeRequestCurrent = useCallback((serverName, token) => {
    return homeRequestRef.current[serverName] === token;
  }, []);

  const updateHomeServerState = useCallback((serverName, patch) => {
    setHomeData((prev) => ({
      ...prev,
      [serverName]: {
        ...createHomeServerState(serverName),
        ...prev[serverName],
        ...patch
      }
    }));
  }, []);

  const scrollToSectionFromHash = useCallback(() => {
    const raw = window.location.hash || '';
    const id = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!id) {return;}

    // Defer one tick so the DOM is ready.
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {el.scrollIntoView({ behavior: 'smooth', block: 'start' });}
    }, 0);
  }, []);

  const notifyRefreshResult = useCallback((result, label = 'Refresh') => {
    const failures = result?.failures || [];

    if (failures.length === 0) {
      toast.success(`${label} completed`);
      return;
    }

    const sample = failures
      .slice(0, 3)
      .map((f) => `${f.server || 'Unknown'} (${f.command || 'unknown'})`)
      .join(', ');
    const suffix = failures.length > 3 ? ' …' : '';
    toast.error(`${label} failed on ${failures.length} task(s): ${sample}${suffix}`);
  }, [toast]);

  const loadHomeServerPrimary = useCallback(async (serverName) => {
    const model = serverController.model;
    const allowedTables = SERVER_TABLE_MAP[serverName] || SERVER_TABLE_MAP.default;
    const primaryTables = allowedTables.filter((table) => HOME_PRIMARY_TABLES.has(table));
    const fetchList = (table) => fetchFilesListPersistent(serverName, table).catch(() => []);
    const results = await Promise.all(primaryTables.map((table) => fetchList(table)));
    const tableResults = new Map();

    primaryTables.forEach((table, index) => {
      tableResults.set(table, results[index] || []);
    });

    const sortedTopFiles = model.sortFilesByTimestamp(tableResults.get('top') || []);
    const sortedDiskFiles = model.sortFilesByTimestamp(tableResults.get('df') || []);
    const sortedTablespaceFiles = model.sortFilesByTimestamp(tableResults.get('tablespace') || []);

    const selectedTopFile = sortedTopFiles.length > 0 ? model.getLatestFile(sortedTopFiles) : '';
    const selectedDiskFile = sortedDiskFiles.length > 0 ? model.getLatestFile(sortedDiskFiles) : '';

    const { selectedTablespaceFile, selectedTablespaceFileData } = await resolveHomeTablespaceSelection(
      serverName,
      sortedTablespaceFiles
    );

    const [selectedTopFileData, selectedDiskFileData] = await Promise.all([
      selectedTopFile ? getFileData(serverName, selectedTopFile, 'top') : null,
      selectedDiskFile ? getFileData(serverName, selectedDiskFile, 'df') : null
    ]);

    return {
      serverName,
      topFiles: sortedTopFiles,
      diskFiles: sortedDiskFiles,
      tablespaceFiles: sortedTablespaceFiles,
      selectedTopFile,
      selectedDiskFile,
      selectedTablespaceFile,
      selectedTopFileData,
      selectedDiskFileData: normalizeDiskData(selectedDiskFileData),
      selectedTablespaceFileData,
      isLoadingFileData: false
    };
  }, []);

  const loadHomeServerSecondary = useCallback(async (serverName) => {
    const model = serverController.model;
    const allowedTables = SERVER_TABLE_MAP[serverName] || SERVER_TABLE_MAP.default;
    const secondaryTables = allowedTables.filter((table) => HOME_SECONDARY_TABLES.has(table));
    if (secondaryTables.length === 0) {
      return { serverName, isLoadingSecondary: false };
    }

    const fetchList = (table) => fetchFilesListPersistent(serverName, table).catch(() => []);
    const results = await Promise.all(secondaryTables.map((table) => fetchList(table)));
    const tableResults = new Map();

    secondaryTables.forEach((table, index) => {
      tableResults.set(table, results[index] || []);
    });

    const sortedLoggapFiles = model.sortFilesByTimestamp(tableResults.get('loggap') || []);
    const sortedCheckProcessFiles = model.sortFilesByTimestamp(tableResults.get('check_process') || []);
    const sortedDbBackupFiles = model.sortFilesByTimestamp(tableResults.get('db_backup') || []);
    const sortedWeeklyBackupFiles = model.sortFilesByTimestamp(tableResults.get('weekly_backup') || []);
    const sortedBackupLocalFiles = model.sortFilesByTimestamp(tableResults.get('backup_db_local') || []);
    const sortedErrptMoreFiles = model.sortFilesByTimestamp(tableResults.get('errpt_more') || []);
    const sortedErrptAMoreFiles = model.sortFilesByTimestamp(tableResults.get('errpt_a_more') || []);

    const selectedLoggapFile = sortedLoggapFiles.length > 0 ? model.getLatestFile(sortedLoggapFiles) : '';
    const selectedCheckProcessFile = sortedCheckProcessFiles.length > 0 ? model.getLatestFile(sortedCheckProcessFiles) : '';
    const selectedDbBackupFile = sortedDbBackupFiles.length > 0 ? model.getLatestFile(sortedDbBackupFiles) : '';
    const selectedWeeklyBackupFile = sortedWeeklyBackupFiles.length > 0 ? model.getLatestFile(sortedWeeklyBackupFiles) : '';
    const selectedBackupLocalFile = sortedBackupLocalFiles.length > 0 ? model.getLatestFile(sortedBackupLocalFiles) : '';
    const selectedErrptMoreFile = sortedErrptMoreFiles.length > 0 ? model.getLatestFile(sortedErrptMoreFiles) : '';
    const selectedErrptAMoreFile = sortedErrptAMoreFiles.length > 0 ? model.getLatestFile(sortedErrptAMoreFiles) : '';

    const [
      rawLoggapData,
      rawCheckProcessData,
      selectedDbBackupFileData,
      selectedWeeklyBackupFileData,
      selectedBackupLocalFileData,
      selectedErrptMoreFileData,
      selectedErrptAMoreFileData
    ] = await Promise.all([
      selectedLoggapFile ? getFileData(serverName, selectedLoggapFile, 'loggap') : null,
      selectedCheckProcessFile ? getFileData(serverName, selectedCheckProcessFile, 'check_process') : null,
      selectedDbBackupFile ? getFileData(serverName, selectedDbBackupFile, 'db_backup') : null,
      selectedWeeklyBackupFile ? getFileData(serverName, selectedWeeklyBackupFile, 'weekly_backup') : null,
      selectedBackupLocalFile ? getFileData(serverName, selectedBackupLocalFile, 'backup_db_local') : null,
      selectedErrptMoreFile ? getFileData(serverName, selectedErrptMoreFile, 'errpt_more') : null,
      selectedErrptAMoreFile ? getFileData(serverName, selectedErrptAMoreFile, 'errpt_a_more') : null
    ]);

    return {
      serverName,
      loggapFiles: sortedLoggapFiles,
      checkProcessFiles: sortedCheckProcessFiles,
      dbBackupFiles: sortedDbBackupFiles,
      weeklyBackupFiles: sortedWeeklyBackupFiles,
      backupLocalFiles: sortedBackupLocalFiles,
      errptMoreFiles: sortedErrptMoreFiles,
      errptAMoreFiles: sortedErrptAMoreFiles,
      selectedLoggapFile,
      selectedCheckProcessFile,
      selectedDbBackupFile,
      selectedWeeklyBackupFile,
      selectedBackupLocalFile,
      selectedErrptMoreFile,
      selectedErrptAMoreFile,
      selectedLoggapFileData: normalizeLoggapData(rawLoggapData),
      selectedCheckProcessFileData: normalizeCheckProcessData(rawCheckProcessData),
      selectedDbBackupFileData,
      selectedWeeklyBackupFileData,
      selectedBackupLocalFileData,
      selectedErrptMoreFileData,
      selectedErrptAMoreFileData,
      isLoadingSecondary: false
    };
  }, []);

  const loadHomeData = useCallback(async () => {
    const servers = serversRef.current;
    if (!Array.isArray(servers) || servers.length === 0) {
      setIsHomeLoading(false);
      return;
    }

    // Prevent concurrent loads
    if (isLoadingHomeRef.current) {
      return;
    }
    isLoadingHomeRef.current = true;
    setIsHomeLoading(true);
    
    // Capture tokens outside try block so secondary load can use them
    const requestTokens = {};
    servers.forEach((serverName) => {
      requestTokens[serverName] = getHomeRequestToken(serverName);
    });
    
    try {
      setHomeData((prev) => {
        const next = { ...prev };
        servers.forEach((serverName) => {
          next[serverName] = {
            ...createHomeServerState(serverName),
            ...prev[serverName],
            isLoadingFileData: true,
            isLoadingSecondary: false
          };
        });
        return next;
      });

      const results = await Promise.all(servers.map((serverName) => loadHomeServerPrimary(serverName)));
      setHomeData((prev) => {
        const next = { ...prev };
        results.forEach((serverData) => {
          if (!isHomeRequestCurrent(serverData.serverName, requestTokens[serverData.serverName])) {
            return;
          }
          // Spread order: base state -> previous data (preserve secondary) -> new primary data
          next[serverData.serverName] = {
            ...prev[serverData.serverName],
            ...serverData
          };
        });
        return next;
      });
    } finally {
      // Don't hide loading yet - wait for secondary data
    }

    // Load secondary data for all servers in parallel
    const secondaryPromises = servers.map(async (serverName) => {
      const token = requestTokens[serverName];
      updateHomeServerState(serverName, { isLoadingSecondary: true, isLoadingFileData: false });
      
      const serverData = await loadHomeServerSecondary(serverName);
      if (!isHomeRequestCurrent(serverName, token)) {
        return;
      }
      setHomeData((prev) => ({
        ...prev,
        [serverName]: {
          ...prev[serverName],
          ...serverData,
          isLoadingFileData: false
        }
      }));
    });

    // Wait for all secondary data to load
    await Promise.all(secondaryPromises);
    
    // Give charts and heavy components time to initialize and start loading
    // This ensures loading screen stays visible until most async operations begin
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setIsHomeLoading(false);
    isLoadingHomeRef.current = false;
  }, [getHomeRequestToken, isHomeRequestCurrent, loadHomeServerPrimary, loadHomeServerSecondary, updateHomeServerState]);

  const handleRefreshAll = useCallback(async () => {
    if (state.isLoading || isRefreshing) {return;} // prevent double-trigger
    setIsRefreshing(true);
    try {
      const result = await serverController.handleRefreshAll();
      notifyRefreshResult(result, 'Refresh all');
      if (isHomeView) {
        await loadHomeData();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [state.isLoading, isRefreshing, notifyRefreshResult, isHomeView, loadHomeData]);

  const handleServerRefresh = useCallback(async (serverName) => {
    if (state.isLoading || isRefreshing) {return;}
    setIsRefreshing(true);
    try {
      const result = await serverController.handleRefreshServer(serverName);
      notifyRefreshResult(result, `Refresh ${serverName || 'server'}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [state.isLoading, isRefreshing, notifyRefreshResult]);

  const handleExportPDF = useCallback(async () => {
    if (isExporting || isHomeLoading) return;
    
    // Check if data is still loading
    const hasLoadingData = Object.values(homeData).some(serverData => 
      serverData.isLoadingFileData || serverData.isLoadingSecondary
    );
    
    if (hasLoadingData) {
      toast.error('Please wait for all data to finish loading before exporting.');
      return;
    }
    
    // Show confirmation dialog
    setShowExportConfirm(true);
  }, [isExporting, isHomeLoading, homeData, toast]);

  const handleConfirmExport = useCallback(async () => {
    setShowExportConfirm(false);
    setIsExporting(true);
    toast.success('Starting PDF generation...');
    
    try {
      const result = await exportHomeViewToPdf(state.servers);
      
      if (result.success) {
        toast.success(`PDF exported successfully: ${result.fileName}`);
      } else {
        toast.error('Failed to export PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [state.servers, toast]);

  const handleCancelExport = useCallback(() => {
    setShowExportConfirm(false);
  }, []);

  const handleSelectServer = useCallback((server) => {
    setIsHomeView(false);
    // Reset home loading ref when leaving home view to allow fresh load on return
    isLoadingHomeRef.current = false;
    setIsHomeLoading(false);
    serverController.handleSelectServer(server);
  }, []);

  const handleSelectHome = useCallback(() => {
    setIsHomeView(true);
    // Clear selected server to remove blue highlight
    serverController.model.selectedServer = '';
    // Clear loading states from server view to prevent flickering
    serverController.model.setLoadingFiles(false);
    serverController.model.setLoadingFileData(false);
    serverController.model.notifyObservers(serverController.model.getState());
    
    // Clear any stuck loading states in homeData to prevent showing loading screen when switching to server view
    setHomeData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((serverName) => {
        if (next[serverName]?.isLoadingFileData === true) {
          next[serverName] = {
            ...next[serverName],
            isLoadingFileData: false,
            isLoadingSecondary: false
          };
        }
      });
      return next;
    });
  }, []);

  const handleSelectTopFile = useCallback((file) => {
    // Ignore file selections during server load to prevent cached callbacks from overwriting correct selection
    if (!isLoadingServer) {
      serverController.handleSelectTopFile(file);
    }
  }, [isLoadingServer]);

  const handleSelectDiskFile = useCallback((file) => {
    serverController.handleSelectDiskFile(file);
  }, []);

  const handleSelectTablespaceFile = useCallback((file) => {
    serverController.handleSelectTablespaceFile(file);
  }, []);

  const handleSelectLoggapFile = useCallback((file) => {
    serverController.handleSelectLoggapFile(file);
  }, []);

  const handleSelectCheckProcessFile = useCallback((file) => {
    serverController.handleSelectCheckProcessFile(file);
  }, []);

  const handleSelectDbBackupFile = useCallback((file) => {
    serverController.handleSelectDbBackupFile(file);
  }, []);

  const handleSelectWeeklyBackupFile = useCallback((file) => {
    serverController.handleSelectWeeklyBackupFile(file);
  }, []);

  const handleSelectBackupLocalFile = useCallback((file) => {
    serverController.handleSelectBackupLocalFile(file);
  }, []);

  const handleSelectErrptMoreFile = useCallback((file) => {
    serverController.handleSelectErrptMoreFile(file);
  }, []);

  const handleSelectErrptAMoreFile = useCallback((file) => {
    serverController.handleSelectErrptAMoreFile(file);
  }, []);

  const handleSort = useCallback((table, key) => {
    serverController.handleSort(table, key);
  }, []);

  useEffect(() => {
    // Subscribe to model changes
    const onModelChange = (newState) => {
      setState(newState);
    };
    serverController.subscribe(onModelChange);

    // Cleanup
    return () => {
      serverController.unsubscribe(onModelChange);
    };
  }, []);

  // Legacy: Auto-select first server only if not in Home view and no server selected
  // Note: Now we have Home view as default, so this rarely triggers
  useEffect(() => {
    if (!isHomeView && !state.selectedServer && Array.isArray(state.servers) && state.servers.length > 0) {
      serverController.handleSelectServer(state.servers[0]);
    }
  }, [isHomeView, state.selectedServer, state.servers]);

  // Enable in-page navigation via URL hash, e.g.
  // /#server /#trend-charts /#statistics /#processes /#disk /#tablespace
  useEffect(() => {
    scrollToSectionFromHash();

    const onHashChange = () => {
      scrollToSectionFromHash();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [scrollToSectionFromHash]);

  // Load files when server changes
  useEffect(() => {
    let cancelled = false;
    
    const loadServerFiles = async () => {
      if (state.selectedServer) {
        setIsLoadingServer(true);
        // Wait a tick for selectServer's loadFiles() to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!cancelled) {
          const latestState = serverController.model.getState();
          setState(latestState);
          setIsLoadingServer(false);
        }
      }
    };
    
    loadServerFiles();
    
    return () => {
      cancelled = true;
    };
  }, [state.selectedServer]);

  useEffect(() => {
    homeDataRef.current = homeData;
  }, [homeData]);

  // Update servers ref when state.servers changes
  useEffect(() => {
    serversRef.current = state.servers;
  }, [state.servers]);

  useEffect(() => {
    if (isHomeView) {
      loadHomeData();
    }
  }, [isHomeView, loadHomeData]);

  const reloadHomeServer = useCallback(async (serverName) => {
    const token = getHomeRequestToken(serverName);
    updateHomeServerState(serverName, { isLoadingFileData: true, isLoadingSecondary: false });
    const serverData = await loadHomeServerPrimary(serverName);
    if (!isHomeRequestCurrent(serverName, token)) {
      return;
    }
    setHomeData((prev) => ({
      ...prev,
      [serverName]: {
        ...prev[serverName],
        ...serverData,
        isLoadingFileData: false
      }
    }));

    updateHomeServerState(serverName, { isLoadingSecondary: true, isLoadingFileData: false });
    setTimeout(async () => {
      const secondaryData = await loadHomeServerSecondary(serverName);
      if (!isHomeRequestCurrent(serverName, token)) {
        return;
      }
      setHomeData((prev) => ({
        ...prev,
        [serverName]: {
          ...prev[serverName],
          ...secondaryData,
          isLoadingFileData: false
        }
      }));
    }, 0);
  }, [getHomeRequestToken, isHomeRequestCurrent, loadHomeServerPrimary, loadHomeServerSecondary, updateHomeServerState]);

  const handleHomeServerRefresh = useCallback(async (serverName) => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      const result = await serverController.handleRefreshServer(serverName);
      notifyRefreshResult(result, `Refresh ${serverName || 'server'}`);
      await reloadHomeServer(serverName);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, notifyRefreshResult, reloadHomeServer]);

  const handleHomeSelectTopFile = useCallback(async (serverName, fileName) => {
    if (!fileName) {
      return;
    }

    const model = serverController.model;
    const current = homeDataRef.current[serverName] || createHomeServerState(serverName);
    const timestamp = model.extractTimestamp(fileName);
    const diskFileMatch = timestamp ? model.findFileWithTimestamp(current.diskFiles, timestamp) : null;
    const tablespaceFileMatch = timestamp ? model.findFileWithTimestamp(current.tablespaceFiles, timestamp) : null;
    const nextDiskFile = diskFileMatch || current.selectedDiskFile;
    const nextTablespaceFile = tablespaceFileMatch || current.selectedTablespaceFile;

    const token = getHomeRequestToken(serverName);
    updateHomeServerState(serverName, {
      selectedTopFile: fileName,
      selectedTopFileData: null,
      selectedDiskFile: nextDiskFile,
      selectedDiskFileData: diskFileMatch ? null : current.selectedDiskFileData,
      selectedTablespaceFile: nextTablespaceFile,
      selectedTablespaceFileData: tablespaceFileMatch ? null : current.selectedTablespaceFileData,
      isLoadingFileData: true
    });

    const [topData, diskData, tablespaceData] = await Promise.all([
      getFileData(serverName, fileName, 'top'),
      nextDiskFile ? getFileData(serverName, nextDiskFile, 'df') : null,
      nextTablespaceFile ? getFileData(serverName, nextTablespaceFile, 'tablespace') : null
    ]);

    if (!isHomeRequestCurrent(serverName, token)) {
      return;
    }

    updateHomeServerState(serverName, {
      selectedTopFileData: topData,
      selectedDiskFileData: normalizeDiskData(diskData),
      selectedTablespaceFileData: normalizeTablespaceData(tablespaceData),
      isLoadingFileData: false
    });
  }, [getHomeRequestToken, isHomeRequestCurrent, updateHomeServerState]);

  const handleHomeSelectDiskFile = useCallback(async (serverName, fileName) => {
    if (!fileName) {
      return;
    }

    const model = serverController.model;
    const current = homeDataRef.current[serverName] || createHomeServerState(serverName);
    const timestamp = model.extractTimestamp(fileName);
    const topFileMatch = timestamp ? model.findFileWithTimestamp(current.topFiles, timestamp) : null;
    const tablespaceFileMatch = timestamp ? model.findFileWithTimestamp(current.tablespaceFiles, timestamp) : null;
    const nextTopFile = topFileMatch || current.selectedTopFile;
    const nextTablespaceFile = tablespaceFileMatch || current.selectedTablespaceFile;

    const token = getHomeRequestToken(serverName);
    updateHomeServerState(serverName, {
      selectedDiskFile: fileName,
      selectedDiskFileData: null,
      selectedTopFile: nextTopFile,
      selectedTopFileData: topFileMatch ? null : current.selectedTopFileData,
      selectedTablespaceFile: nextTablespaceFile,
      selectedTablespaceFileData: tablespaceFileMatch ? null : current.selectedTablespaceFileData,
      isLoadingFileData: true
    });

    const [topData, diskData, tablespaceData] = await Promise.all([
      nextTopFile ? getFileData(serverName, nextTopFile, 'top') : null,
      getFileData(serverName, fileName, 'df'),
      nextTablespaceFile ? getFileData(serverName, nextTablespaceFile, 'tablespace') : null
    ]);

    if (!isHomeRequestCurrent(serverName, token)) {
      return;
    }

    updateHomeServerState(serverName, {
      selectedTopFileData: topData,
      selectedDiskFileData: normalizeDiskData(diskData),
      selectedTablespaceFileData: normalizeTablespaceData(tablespaceData),
      isLoadingFileData: false
    });
  }, [getHomeRequestToken, isHomeRequestCurrent, updateHomeServerState]);

  const handleHomeSelectTablespaceFile = useCallback(async (serverName, fileName) => {
    if (!fileName) {
      return;
    }

    const model = serverController.model;
    const current = homeDataRef.current[serverName] || createHomeServerState(serverName);
    const timestamp = model.extractTimestamp(fileName);
    const topFileMatch = timestamp ? model.findFileWithTimestamp(current.topFiles, timestamp) : null;
    const diskFileMatch = timestamp ? model.findFileWithTimestamp(current.diskFiles, timestamp) : null;
    const nextTopFile = topFileMatch || current.selectedTopFile;
    const nextDiskFile = diskFileMatch || current.selectedDiskFile;

    const token = getHomeRequestToken(serverName);
    updateHomeServerState(serverName, {
      selectedTablespaceFile: fileName,
      selectedTablespaceFileData: null,
      selectedTopFile: nextTopFile,
      selectedTopFileData: topFileMatch ? null : current.selectedTopFileData,
      selectedDiskFile: nextDiskFile,
      selectedDiskFileData: diskFileMatch ? null : current.selectedDiskFileData,
      isLoadingFileData: true
    });

    const [topData, diskData, tablespaceData] = await Promise.all([
      nextTopFile ? getFileData(serverName, nextTopFile, 'top') : null,
      nextDiskFile ? getFileData(serverName, nextDiskFile, 'df') : null,
      getFileData(serverName, fileName, 'tablespace')
    ]);

    if (!isHomeRequestCurrent(serverName, token)) {
      return;
    }

    updateHomeServerState(serverName, {
      selectedTopFileData: topData,
      selectedDiskFileData: normalizeDiskData(diskData),
      selectedTablespaceFileData: normalizeTablespaceData(tablespaceData),
      isLoadingFileData: false
    });
  }, [getHomeRequestToken, isHomeRequestCurrent, updateHomeServerState]);

  const handleHomeSelectSimpleFile = useCallback(async (serverName, fileName, config) => {
    if (!fileName) {
      return;
    }

    const token = getHomeRequestToken(serverName);
    updateHomeServerState(serverName, {
      [config.selectedKey]: fileName,
      [config.dataKey]: null,
      isLoadingFileData: true
    });

    const rawData = await getFileData(serverName, fileName, config.table);
    if (!isHomeRequestCurrent(serverName, token)) {
      return;
    }

    const normalized = config.normalize ? config.normalize(rawData) : rawData;
    updateHomeServerState(serverName, {
      [config.dataKey]: normalized,
      isLoadingFileData: false
    });
  }, [getHomeRequestToken, isHomeRequestCurrent, updateHomeServerState]);

  const handleHomeSelectLoggapFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'loggap',
      selectedKey: 'selectedLoggapFile',
      dataKey: 'selectedLoggapFileData',
      normalize: normalizeLoggapData
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectCheckProcessFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'check_process',
      selectedKey: 'selectedCheckProcessFile',
      dataKey: 'selectedCheckProcessFileData',
      normalize: normalizeCheckProcessData
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectDbBackupFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'db_backup',
      selectedKey: 'selectedDbBackupFile',
      dataKey: 'selectedDbBackupFileData'
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectWeeklyBackupFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'weekly_backup',
      selectedKey: 'selectedWeeklyBackupFile',
      dataKey: 'selectedWeeklyBackupFileData'
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectBackupLocalFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'backup_db_local',
      selectedKey: 'selectedBackupLocalFile',
      dataKey: 'selectedBackupLocalFileData'
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectErrptMoreFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'errpt_more',
      selectedKey: 'selectedErrptMoreFile',
      dataKey: 'selectedErrptMoreFileData'
    });
  }, [handleHomeSelectSimpleFile]);

  const handleHomeSelectErrptAMoreFile = useCallback((serverName, fileName) => {
    handleHomeSelectSimpleFile(serverName, fileName, {
      table: 'errpt_a_more',
      selectedKey: 'selectedErrptAMoreFile',
      dataKey: 'selectedErrptAMoreFileData'
    });
  }, [handleHomeSelectSimpleFile]);

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
          <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-logo">
              <Logo width={collapsed ? 52 : 90} height={collapsed ? 52 : 90} />
              {!collapsed && <span className="sidebar-title">Auto Monitoring</span>}
            </div>

            <nav className="sidebar-nav">
              <button
                className={`nav-item ${isHomeView ? 'active' : ''}`}
                onClick={handleSelectHome}
                title="Home"
              >
                <span className="nav-icon"><FiHome /></span>
                {!collapsed && <span className="nav-label">Home</span>}
              </button>
              {state.servers && state.servers.map((serverName) => {
                const isActive = state.selectedServer === serverName;
                return (
                  <button
                    key={serverName}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectServer(serverName)}
                    title={serverName}
                  >
                    <span className="nav-icon"><FiServer /></span>
                    {!collapsed && <span className="nav-label">{serverName}</span>}
                  </button>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              <button
                className="collapse-btn"
                onClick={() => setCollapsed(!collapsed)}
                title={collapsed ? 'Expand' : 'Collapse'}
              >
                {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
              </button>
            </div>
          </aside>

          <div className="content-area">
            <header className="content-header">
              <div>
                <p className="content-kicker">{isHomeView ? 'Overview' : 'Server'}</p>
                <h1 className="content-title">{isHomeView ? 'Home' : (state.selectedServer || 'Select a server')}</h1>
                <p className="content-sub">{isHomeView ? 'All servers overview' : 'Auto monitoring dashboard'}</p>
              </div>
              <div className="header-actions">
                <button
                  className="refresh-btn"
                  onClick={handleRefreshAll}
                  title="Refresh all servers"
                  disabled={state.isLoading || isRefreshing}
                >
                  {state.isLoading || isRefreshing ? 'Refreshing...' : 'Refresh All'}
                </button>
                {isHomeView && (
                  <button
                    className="refresh-btn"
                    onClick={handleExportPDF}
                    title="Export Home View to PDF"
                    disabled={isExporting || isHomeLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <FiDownload />
                    {isExporting ? 'Exporting...' : 'Export PDF'}
                  </button>
                )}
                <button
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {isDark ? <FiSun /> : <FiMoon />}
                </button>
              </div>
            </header>

            <main className="app-main">
              <div className="content-scroll">
                {isHomeView ? (
                  <div className="content-block">
                    {isHomeLoading ? (
                      <div style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '60px 24px',
                        textAlign: 'center',
                        color: 'var(--text)',
                        maxWidth: '600px',
                        margin: '40px auto'
                      }}>
                        <FiRefreshCw className="spinning" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '20px' }} />
                        <p style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>Loading Home data...</p>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Fetching latest stats, processes, disks, and tablespace for all servers.</p>
                      </div>
                    ) : (
                      state.servers && state.servers.map((serverName) => {
                        const serverData = homeData[serverName] || createHomeServerState(serverName);
                        const isAix = serverData.selectedTopFileData?.log_type === 'AIX_MONITORING'
                          || serverData.selectedTopFileData?.parsed_data;

                        return (
                          <div key={serverName} id={`server-container-${serverName}`} style={{ marginBottom: '36px' }}>
                            <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                              {isAix ? (
                                <div id={`stats-${serverName}`}>
                                  <AIXSystemView 
                                    data={serverData.selectedTopFileData}
                                    topFiles={serverData.topFiles}
                                    selectedTopFile={serverData.selectedTopFile}
                                    onSelectTopFile={(file) => handleHomeSelectTopFile(serverName, file)}
                                    isLoading={false}
                                    systemName={serverName}
                                    controller={serverController}
                                    lastUpdated={formatTimestamp(serverData.selectedTopFileData?.timestamp || serverData.selectedTopFileData?.metadata?.timestamp || '')}
                                    onRefresh={() => handleHomeServerRefresh(serverName)}
                                    isRefreshing={isRefreshing}
                                  />
                                </div>
                              ) : (
                                <div id={`stats-${serverName}`}>
                                  <StatsView 
                                    data={serverData.selectedTopFileData}
                                    selectedTopFileData={serverData.selectedTopFileData}
                                    selectedTopFile={serverData.selectedTopFile}
                                    topFiles={serverData.topFiles}
                                    controller={serverController}
                                    systemName={serverName}
                                    lastUpdated={formatTimestamp(serverData.selectedTopFileData?.timestamp || serverData.selectedTopFileData?.metadata?.timestamp || '')}
                                    uptime={serverData.selectedTopFileData?.uptime || ''}
                                    onSelectTopFile={(file) => handleHomeSelectTopFile(serverName, file)}
                                    onRefresh={() => handleHomeServerRefresh(serverName)}
                                    isLoading={false}
                                    isRefreshing={isRefreshing}
                                    isHomeView={true}
                                  />
                                </div>
                              )}

                              {serverData.topFiles && serverData.topFiles.length > 0 && (
                                <div id={`processes-${serverName}`}>
                                  <ProcessesView 
                                    serverName={serverName}
                                    processes={serverData.selectedTopFileData?.parsed_top?.processes || serverData.selectedTopFileData?.parsed_data?.processes || serverData.selectedTopFileData?.processes}
                                    sortConfig={state.sortConfig}
                                    onSort={handleSort}
                                    controller={serverController}
                                    topFiles={serverData.topFiles}
                                    selectedTopFile={serverData.selectedTopFile}
                                    onSelectTopFile={(file) => handleHomeSelectTopFile(serverName, file)}
                                    selectedTopFileData={serverData.selectedTopFileData}
                                    isLoadingFileData={serverData.isLoadingFileData}
                                  />
                                </div>
                              )}

                              <div id={`disk-${serverName}`}>
                                <DiskView 
                                  serverName={serverName}
                                  diskData={serverData.selectedDiskFileData?.df}
                                  sortConfig={state.sortConfig}
                                  onSort={handleSort}
                                  controller={serverController}
                                  diskFiles={serverData.diskFiles}
                                  selectedDiskFile={serverData.selectedDiskFile}
                                  onSelectDiskFile={(file) => handleHomeSelectDiskFile(serverName, file)}
                                  selectedDiskFileData={serverData.selectedDiskFileData}
                                  isLoadingFileData={serverData.isLoadingFileData}
                                  isHomeView={true}
                                />
                              </div>

                              {serverData.tablespaceFiles && serverData.tablespaceFiles.length > 0 && (
                                <div id={`tablespace-${serverName}`}>
                                  <TableSpaceView 
                                    serverName={serverName}
                                    tablespaceData={serverData.selectedTablespaceFileData?.tablespace}
                                    sortConfig={state.sortConfig}
                                    onSort={handleSort}
                                    controller={serverController}
                                    tablespaceFiles={serverData.tablespaceFiles}
                                    selectedTablespaceFile={serverData.selectedTablespaceFile}
                                    onSelectTablespaceFile={(file) => handleHomeSelectTablespaceFile(serverName, file)}
                                    selectedTablespaceFileData={serverData.selectedTablespaceFileData}
                                    isLoadingFileData={serverData.isLoadingFileData}
                                    isHomeView={true}
                                  />
                                </div>
                              )}

                              {serverData.loggapFiles && serverData.loggapFiles.length > 0 && (
                                <div id={`loggap-${serverName}`}>
                                  <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                                    <LoggapView 
                                      data={serverData.selectedLoggapFileData}
                                      loggapFiles={serverData.loggapFiles}
                                      selectedLoggapFile={serverData.selectedLoggapFile}
                                      onSelectLoggapFile={(file) => handleHomeSelectLoggapFile(serverName, file)}
                                      serverName={serverName}
                                      isLoading={serverData.isLoadingSecondary || serverData.isLoadingFileData}
                                    />
                                  </Suspense>
                                </div>
                              )}

                              {serverData.checkProcessFiles && serverData.checkProcessFiles.length > 0 && (
                                <div id={`checkprocess-${serverName}`}>
                                  <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                                    <CheckProcessView 
                                      data={serverData.selectedCheckProcessFileData}
                                      checkProcessFiles={serverData.checkProcessFiles}
                                      selectedCheckProcessFile={serverData.selectedCheckProcessFile}
                                      onSelectCheckProcessFile={(file) => handleHomeSelectCheckProcessFile(serverName, file)}
                                      isLoading={serverData.isLoadingSecondary || serverData.isLoadingFileData}
                                      serverName={serverName}
                                    />
                                  </Suspense>
                                </div>
                              )}

                              {(serverData.dbBackupFiles?.length > 0 || serverData.weeklyBackupFiles?.length > 0 || serverData.backupLocalFiles?.length > 0) && (
                                <div id={`backup-${serverName}`}>
                                  <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                                    <BackupView
                                      serverName={serverName}
                                      dbBackupData={serverData.selectedDbBackupFileData}
                                      dbBackupFiles={serverData.dbBackupFiles}
                                      selectedDbBackupFile={serverData.selectedDbBackupFile}
                                      onSelectDbBackupFile={(file) => handleHomeSelectDbBackupFile(serverName, file)}
                                      weeklyBackupData={serverData.selectedWeeklyBackupFileData}
                                      weeklyBackupFiles={serverData.weeklyBackupFiles}
                                      selectedWeeklyBackupFile={serverData.selectedWeeklyBackupFile}
                                      onSelectWeeklyBackupFile={(file) => handleHomeSelectWeeklyBackupFile(serverName, file)}
                                      backupLocalData={serverData.selectedBackupLocalFileData}
                                      backupLocalFiles={serverData.backupLocalFiles}
                                      selectedBackupLocalFile={serverData.selectedBackupLocalFile}
                                      onSelectBackupLocalFile={(file) => handleHomeSelectBackupLocalFile(serverName, file)}
                                      isLoading={serverData.isLoadingSecondary || serverData.isLoadingFileData}
                                    />
                                  </Suspense>
                                </div>
                              )}

                              {serverData.errptMoreFiles && serverData.errptMoreFiles.length > 0 && (
                                <div id={`errpt_more-${serverName}`}>
                                  <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                                    <ErrptMoreView 
                                      data={serverData.selectedErrptMoreFileData}
                                      isLoading={serverData.isLoadingSecondary || serverData.isLoadingFileData || false}
                                      files={serverData.errptMoreFiles}
                                      selectedFile={serverData.selectedErrptMoreFile}
                                      onSelectFile={(file) => handleHomeSelectErrptMoreFile(serverName, file)}
                                      serverName={serverName}
                                      fileType="errpt_more"
                                    />
                                  </Suspense>
                                </div>
                              )}

                              {serverData.errptAMoreFiles && serverData.errptAMoreFiles.length > 0 && (
                                <div id={`errpt_a_more-${serverName}`}>
                                  <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                                    <ErrptAMoreView 
                                      data={serverData.selectedErrptAMoreFileData}
                                      isLoading={serverData.isLoadingSecondary || serverData.isLoadingFileData || false}
                                      files={serverData.errptAMoreFiles}
                                      selectedFile={serverData.selectedErrptAMoreFile}
                                      onSelectFile={(file) => handleHomeSelectErrptAMoreFile(serverName, file)}
                                      serverName={serverName}
                                      fileType="errpt_a_more"
                                    />
                                  </Suspense>
                                </div>
                              )}
                            </Suspense>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div id="server" className="content-block">
                    {!isHomeView && (state.isLoadingFiles || state.isLoadingFileData) ? (
                      <div style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '60px 24px',
                        textAlign: 'center',
                        color: 'var(--text)',
                        maxWidth: '600px',
                        margin: '40px auto'
                      }}>
                        <FiRefreshCw className="spinning" style={{ fontSize: '48px', color: 'var(--text-secondary)', marginBottom: '20px' }} />
                        <p style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>Loading data for this server...</p>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Fetching latest stats, processes, disks, and tablespace.</p>
                      </div>
                    ) : (
                      <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                      {(state.selectedTopFileData?.log_type === 'AIX_MONITORING' || state.selectedTopFileData?.parsed_data) ? (
                        <div id="stats">
                          <AIXSystemView 
                            data={state.selectedTopFileData}
                            topFiles={state.topFiles}
                            selectedTopFile={state.selectedTopFile}
                            onSelectTopFile={handleSelectTopFile}
                            isLoading={false}
                            systemName={state.selectedServer}
                            controller={serverController}
                            lastUpdated={formatTimestamp(state.selectedTopFileData?.timestamp || state.selectedTopFileData?.metadata?.timestamp || '')}
                            onRefresh={() => handleServerRefresh(state.selectedServer)}
                            isRefreshing={isRefreshing}
                          />
                        </div>
                      ) : (
                      <div id="stats">
                        <StatsView 
                          data={state.selectedTopFileData}
                          selectedTopFileData={state.selectedTopFileData}
                          selectedTopFile={state.selectedTopFile}
                          topFiles={state.topFiles}
                          controller={serverController}
                          systemName={state.selectedServer}
                          lastUpdated={formatTimestamp(state.selectedTopFileData?.timestamp || state.selectedTopFileData?.metadata?.timestamp || '')}
                          uptime={state.selectedTopFileData?.uptime || ''}
                          onSelectTopFile={handleSelectTopFile}
                          onRefresh={() => handleServerRefresh(state.selectedServer)}
                          isLoading={false}
                          isRefreshing={isRefreshing}
                        />
                      </div>
                      )}

                      {/* Show processes view for all systems */}
                      {state.topFiles && state.topFiles.length > 0 && (
                      <div id="processes">
                        <ProcessesView 
                          serverName={state.selectedServer}
                          processes={state.selectedTopFileData?.parsed_top?.processes || state.selectedTopFileData?.parsed_data?.processes || state.selectedTopFileData?.processes}
                          sortConfig={state.sortConfig}
                          onSort={handleSort}
                          controller={serverController}
                          topFiles={state.topFiles}
                          selectedTopFile={state.selectedTopFile}
                          onSelectTopFile={handleSelectTopFile}
                          selectedTopFileData={state.selectedTopFileData}
                          isLoadingFileData={state.isLoadingFileData}
                        />
                      </div>
                      )}

                      <div id="disk">
                        <DiskView 
                          serverName={state.selectedServer}
                          diskData={state.selectedDiskFileData?.df}
                          sortConfig={state.sortConfig}
                          onSort={handleSort}
                          controller={serverController}
                          diskFiles={state.diskFiles}
                          selectedDiskFile={state.selectedDiskFile}
                          onSelectDiskFile={handleSelectDiskFile}
                          selectedDiskFileData={state.selectedDiskFileData}
                          isLoadingFileData={state.isLoadingFileData}
                        />
                      </div>

                      {/* Only show Tablespace section if there are tablespace files */}
                      {state.tablespaceFiles && state.tablespaceFiles.length > 0 && (
                        <div id="tablespace">
                          <TableSpaceView 
                            serverName={state.selectedServer}
                            tablespaceData={state.selectedTablespaceFileData?.tablespace}
                            sortConfig={state.sortConfig}
                            onSort={handleSort}
                            controller={serverController}
                            tablespaceFiles={state.tablespaceFiles}
                            selectedTablespaceFile={state.selectedTablespaceFile}
                            onSelectTablespaceFile={handleSelectTablespaceFile}
                            selectedTablespaceFileData={state.selectedTablespaceFileData}
                            isLoadingFileData={state.isLoadingFileData}
                          />
                        </div>
                      )}

                      {/* Show Loggap section for DR-SITE */}
                      {state.selectedServer === 'DR-SITE' && (
                        <div id="loggap">
                          <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                            <LoggapView 
                              data={state.selectedLoggapFileData}
                              loggapFiles={state.loggapFiles}
                              selectedLoggapFile={state.selectedLoggapFile}
                              onSelectLoggapFile={handleSelectLoggapFile}
                              serverName={state.selectedServer}
                              isLoading={state.isLoadingFileData}
                            />
                          </Suspense>
                        </div>
                      )}

                      {/* Show CheckProcess section for ERP-AIX */}
                      {state.checkProcessFiles && state.checkProcessFiles.length > 0 && (
                        <div id="checkprocess">
                          <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                            <CheckProcessView 
                              data={state.selectedCheckProcessFileData}
                              checkProcessFiles={state.checkProcessFiles}
                              selectedCheckProcessFile={state.selectedCheckProcessFile}
                              onSelectCheckProcessFile={handleSelectCheckProcessFile}
                              isLoading={state.isLoadingFileData}
                              serverName={state.selectedServer}
                            />
                          </Suspense>
                        </div>
                      )}

                      {/* Backup Sections - 3 Column Layout */}
                      {(state.dbBackupFiles?.length > 0 || state.weeklyBackupFiles?.length > 0 || state.backupLocalFiles?.length > 0) && (
                        <div id="backup">
                          <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                            <BackupView
                              serverName={state.selectedServer}
                              dbBackupData={state.selectedDbBackupFileData}
                              dbBackupFiles={state.dbBackupFiles}
                              selectedDbBackupFile={state.selectedDbBackupFile}
                              onSelectDbBackupFile={handleSelectDbBackupFile}
                              weeklyBackupData={state.selectedWeeklyBackupFileData}
                              weeklyBackupFiles={state.weeklyBackupFiles}
                              selectedWeeklyBackupFile={state.selectedWeeklyBackupFile}
                              onSelectWeeklyBackupFile={handleSelectWeeklyBackupFile}
                              backupLocalData={state.selectedBackupLocalFileData}
                              backupLocalFiles={state.backupLocalFiles}
                              selectedBackupLocalFile={state.selectedBackupLocalFile}
                              onSelectBackupLocalFile={handleSelectBackupLocalFile}
                              isLoading={state.isLoadingFileData}
                            />
                          </Suspense>
                        </div>
                      )}

                      {/* Show Errpt_More section for ERP-AIX */}
                      {state.errptMoreFiles && state.errptMoreFiles.length > 0 && (
                        <div id="errpt_more">
                          <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                            <ErrptMoreView 
                              data={state.selectedErrptMoreFileData}
                              isLoading={state.isLoadingFileData || false}
                              files={state.errptMoreFiles}
                              selectedFile={state.selectedErrptMoreFile}
                              onSelectFile={handleSelectErrptMoreFile}
                              serverName={state.selectedServer}
                              fileType="errpt_more"
                            />
                          </Suspense>
                        </div>
                      )}

                      {/* Show Errpt_A_More section for ERP-AIX */}
                      {state.errptAMoreFiles && state.errptAMoreFiles.length > 0 && (
                        <div id="errpt_a_more">
                          <Suspense fallback={<div style={{padding: '20px', textAlign: 'center', color: '#FFFFFF'}}>Loading...</div>}>
                            <ErrptAMoreView 
                              data={state.selectedErrptAMoreFileData}
                              isLoading={state.isLoadingFileData || false}
                              files={state.errptAMoreFiles}
                              selectedFile={state.selectedErrptAMoreFile}
                              onSelectFile={handleSelectErrptAMoreFile}
                              serverName={state.selectedServer}
                              fileType="errpt_a_more"
                            />
                          </Suspense>
                        </div>
                      )}
                      </Suspense>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>

        {/* Export PDF Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showExportConfirm}
          title="Export Home View to PDF"
          message={
            <div>
              <p><strong>Before exporting, please verify:</strong></p>
              <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
                <li>All server data is loaded correctly</li>
                <li>Charts and tables are displaying properly</li>
                <li>All sections show the correct information</li>
              </ul>
              <p>This process may take 30-60 seconds depending on the number of servers.</p>
            </div>
          }
          onConfirm={handleConfirmExport}
          onCancel={handleCancelExport}
          confirmText="Generate PDF"
          cancelText="Cancel"
        />
      </ErrorBoundary>
    );
  }

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContentInner />
      </ToastProvider>
    </ThemeProvider>
  );
}
