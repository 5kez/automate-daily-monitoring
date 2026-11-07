// View: HomeView.jsx
// Displays all server data tables in one view

import { memo, useEffect, useMemo, useState, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../components/ThemeProvider';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { FiServer, FiRefreshCw, FiCpu, FiHardDrive, FiDatabase, FiAlertCircle, FiCheckCircle, FiClock } from 'react-icons/fi';
import { extractDateTime } from '../utils/stringUtils';
import { StatsView } from './StatsView';
import { ProcessesView } from './ProcessesView';
import { AIXProcessesView } from './AIXProcessesView';
import { DiskView } from './DiskView';
import { TableSpaceView } from './TableSpaceView';
import { AIXSystemView } from './AIXSystemView';
import { LoggapView } from './LoggapView';
import { CheckProcessView } from './CheckProcessView';
import { DBBackupView, WeeklyBackupView, BackupLocalView } from './BackupView';
import { ErrptMoreView, ErrptAMoreView } from './ErrorReportView';
import { normalizeTablespacePayload } from '../models/ServerModel';
import { fetchFilesList, getFileData } from '../../store/api';
import { extractTimeFromFilename } from '../utils/stringUtils';
import { getTodayDate } from '../utils/dateUtils';
import './HomeView.css';

const DEFAULT_SORT = {
  processes: { key: null, order: 'asc' },
  disk: { key: 'use_percent', order: 'desc' },
  tablespace: { key: 'used_to_current_percent', order: 'desc' }
};

const buildServerSnapshot = async (serverName, serverStates = {}, isLoadingFileData = false, state = null) => {
  let topFiles, diskFiles, tablespaceFiles, loggapFiles, checkProcessFiles, dbBackupFiles, weeklyBackupFiles, backupLocalFiles, errptMoreFiles, errptAMoreFiles;
  
  try {
    topFiles = await fetchFilesList(serverName, 'top');
  } catch (error) {
    console.error('Error fetching top files:', error);
    topFiles = [];
  }
  
  try {
    diskFiles = await fetchFilesList(serverName, 'df');
  } catch (error) {
    console.error('Error fetching disk files:', error);
    diskFiles = [];
  }
  
  try {
    tablespaceFiles = await fetchFilesList(serverName, 'tablespace');
  } catch (error) {
    console.error('Error fetching tablespace files:', error);
    tablespaceFiles = [];
  }

  // Fetch new table types for DR-SITE and ERP-AIX
  if (serverName === 'DR-SITE') {
    try {
      loggapFiles = await fetchFilesList(serverName, 'loggap');
    } catch (error) {
      console.error('Error fetching loggap files:', error);
      loggapFiles = [];
    }
  } else {
    loggapFiles = [];
  }

  if (serverName === 'ERP-AIX') {
    try {
      checkProcessFiles = await fetchFilesList(serverName, 'check_process');
    } catch (error) {
      console.error('Error fetching checkprocess files:', error);
      checkProcessFiles = [];
    }
    try {
      dbBackupFiles = await fetchFilesList(serverName, 'db_backup');
    } catch (error) {
      console.error('Error fetching db_backup files:', error);
      dbBackupFiles = [];
    }
    try {
      weeklyBackupFiles = await fetchFilesList(serverName, 'weekly_backup');
    } catch (error) {
      console.error('Error fetching weekly_backup files:', error);
      weeklyBackupFiles = [];
    }
    try {
      backupLocalFiles = await fetchFilesList(serverName, 'backup_db_local');
    } catch (error) {
      console.error('Error fetching backup_db_local files:', error);
      backupLocalFiles = [];
    }
    try {
      errptMoreFiles = await fetchFilesList(serverName, 'errpt_more');
    } catch (error) {
      console.error('Error fetching errpt_more files:', error);
      errptMoreFiles = [];
    }
    try {
      errptAMoreFiles = await fetchFilesList(serverName, 'errpt_a_more');
    } catch (error) {
      console.error('Error fetching errpt_-a_more files:', error);
      errptAMoreFiles = [];
    }
  } else {
    checkProcessFiles = [];
    dbBackupFiles = [];
    weeklyBackupFiles = [];
    backupLocalFiles = [];
    errptMoreFiles = [];
    errptAMoreFiles = [];
  }

  const normalizedTopFiles = Array.isArray(topFiles) ? topFiles : [];
  const normalizedDiskFiles = Array.isArray(diskFiles) ? diskFiles : [];
  const normalizedTablespaceFiles = Array.isArray(tablespaceFiles) ? tablespaceFiles : [];
  const normalizedLoggapFiles = Array.isArray(loggapFiles) ? loggapFiles : [];
  const normalizedCheckProcessFiles = Array.isArray(checkProcessFiles) ? checkProcessFiles : [];
  const normalizedDbBackupFiles = Array.isArray(dbBackupFiles) ? dbBackupFiles : [];
  const normalizedWeeklyBackupFiles = Array.isArray(weeklyBackupFiles) ? weeklyBackupFiles : [];
  const normalizedBackupLocalFiles = Array.isArray(backupLocalFiles) ? backupLocalFiles : [];
  const normalizedErrptMoreFiles = Array.isArray(errptMoreFiles) ? errptMoreFiles : [];
  const normalizedErrptAMoreFiles = Array.isArray(errptAMoreFiles) ? errptAMoreFiles : [];

  // Sort files to get the latest one (filename format: prefix_YYYY-MM-DD_HH-MM-SS.json)
  const sortedTopFiles = normalizedTopFiles.slice().sort().reverse();
  const sortedDiskFiles = normalizedDiskFiles.slice().sort().reverse();
  const sortedTablespaceFiles = normalizedTablespaceFiles.slice().sort().reverse();
  const sortedLoggapFiles = normalizedLoggapFiles.slice().sort().reverse();
  const sortedCheckProcessFiles = normalizedCheckProcessFiles.slice().sort().reverse();
  const sortedDbBackupFiles = normalizedDbBackupFiles.slice().sort().reverse();
  const sortedWeeklyBackupFiles = normalizedWeeklyBackupFiles.slice().sort().reverse();
  const sortedBackupLocalFiles = normalizedBackupLocalFiles.slice().sort().reverse();
  const sortedErrptMoreFiles = normalizedErrptMoreFiles.slice().sort().reverse();
  const sortedErrptAMoreFiles = normalizedErrptAMoreFiles.slice().sort().reverse();

  const latestTopFile = (state?.selectedTopFile && state.selectedTopFile.length > 0) ? state.selectedTopFile : (sortedTopFiles[0] || '');
  const latestDiskFile = (state?.selectedDiskFile && state.selectedDiskFile.length > 0) ? state.selectedDiskFile : (sortedDiskFiles[0] || '');
  const latestTablespaceFile = (state?.selectedTablespaceFile && state.selectedTablespaceFile.length > 0) ? state.selectedTablespaceFile : (sortedTablespaceFiles[0] || '');
  const latestLoggapFile = (state?.selectedLoggapFile && state.selectedLoggapFile.length > 0) ? state.selectedLoggapFile : (sortedLoggapFiles[0] || '');
  const latestCheckProcessFile = (state?.selectedCheckProcessFile && state.selectedCheckProcessFile.length > 0) ? state.selectedCheckProcessFile : (sortedCheckProcessFiles[0] || '');
  const latestDbBackupFile = (state?.selectedDbBackupFile && state.selectedDbBackupFile.length > 0) ? state.selectedDbBackupFile : (sortedDbBackupFiles[0] || '');
  const latestWeeklyBackupFile = (state?.selectedWeeklyBackupFile && state.selectedWeeklyBackupFile.length > 0) ? state.selectedWeeklyBackupFile : (sortedWeeklyBackupFiles[0] || '');
  const latestBackupLocalFile = (state?.selectedBackupLocalFile && state.selectedBackupLocalFile.length > 0) ? state.selectedBackupLocalFile : (sortedBackupLocalFiles[0] || '');
  const latestErrptMoreFile = (state?.selectedErrptMoreFile && state.selectedErrptMoreFile.length > 0) ? state.selectedErrptMoreFile : (sortedErrptMoreFiles[0] || '');
  const latestErrptAMoreFile = (state?.selectedErrptAMoreFile && state.selectedErrptAMoreFile.length > 0) ? state.selectedErrptAMoreFile : (sortedErrptAMoreFiles[0] || '');

  let selectedTopFileData = null;
  let selectedDiskFileData = null;
  let selectedLoggapFileData = null;
  let selectedCheckProcessFileData = null;
  let selectedDbBackupFileData = null;
  let selectedWeeklyBackupFileData = null;
  let selectedBackupLocalFileData = null;
  let selectedErrptMoreFileData = null;
  let selectedErrptAMoreFileData = null;
  
  try {
    selectedTopFileData = latestTopFile && latestTopFile.length > 0 ? await getFileData(serverName, latestTopFile, 'top') : null;
    // Transform Linux format (parsed_top) to normalized format
    if (selectedTopFileData && selectedTopFileData.parsed_top) {
      const parsedData = selectedTopFileData.parsed_top;
      const processes = (parsedData.processes || []).map(p => ({
        ...p,
        pid: parseInt(p.pid) || 0,
        cpu: parseFloat(p.cpu) || 0,
        mem: parseFloat(p.mem) || 0,
        user: p.user || 'N/A',
        command: p.command || 'N/A'
      }));
      const loadavg = parsedData.system?.loadavg;
      const convertedLoadavg = loadavg ? {
        '1min': parseFloat(loadavg['1min']) || 0,
        '5min': parseFloat(loadavg['5min']) || 0,
        '15min': parseFloat(loadavg['15min']) || 0
      } : null;
      selectedTopFileData = {
        processes,
        system: parsedData.system,
        tasks: parsedData.tasks,
        cpu: parsedData.cpu,
        memory: parsedData.memory,
        swap: parsedData.swap,
        loadavg: convertedLoadavg,
        uptime: parsedData.system?.uptime,
        metadata: {
          timestamp: latestTopFile ? latestTopFile.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/)?.[0] : null,
          filename: latestTopFile
        }
      };
    }
  } catch (error) {
    console.error('Error loading top file data:', error);
  }
  
  try {
    selectedDiskFileData = latestDiskFile && latestDiskFile.length > 0 ? await getFileData(serverName, latestDiskFile, 'df') : null;
    // Transform disk data
    if (selectedDiskFileData && Array.isArray(selectedDiskFileData.parsed_df)) {
      const dfData = selectedDiskFileData.parsed_df.map(df => ({
        filesystem: df.filesystem || 'N/A',
        '1K-blocks': parseInt(df['1K-blocks']) || 0,
        used: parseInt(df.used) || 0,
        available: parseInt(df.available) || 0,
        'use%': df['use%'] || '0%',
        mounted: df.mounted || 'N/A',
        ...df
      }));
      selectedDiskFileData = {
        df: dfData
      };
    }
  } catch (error) {
    console.error('Error loading disk file data:', error);
  }

  // Load loggap data for DR-SITE
  if (latestLoggapFile) {
    try {
      selectedLoggapFileData = await getFileData(serverName, latestLoggapFile, 'loggap');
    } catch (error) {
      console.error('Error loading loggap file data:', error);
    }
  }

  // Load checkprocess data for ERP-AIX
  if (latestCheckProcessFile) {
    try {
      selectedCheckProcessFileData = await getFileData(serverName, latestCheckProcessFile, 'check_process');
    } catch (error) {
      console.error('Error loading checkprocess file data:', error);
    }
  }

  // Load db_backup data for ERP-AIX
  if (latestDbBackupFile) {
    try {
      selectedDbBackupFileData = await getFileData(serverName, latestDbBackupFile, 'db_backup');
    } catch (error) {
      console.error('Error loading db_backup file data:', error);
    }
  }

  // Load weekly_backup data for ERP-AIX
  if (latestWeeklyBackupFile) {
    try {
      selectedWeeklyBackupFileData = await getFileData(serverName, latestWeeklyBackupFile, 'weekly_backup');
    } catch (error) {
      console.error('Error loading weekly_backup file data:', error);
    }
  }

  // Load backup_db_local data for ERP-AIX
  if (latestBackupLocalFile) {
    try {
      selectedBackupLocalFileData = await getFileData(serverName, latestBackupLocalFile, 'backup_db_local');
    } catch (error) {
      console.error('Error loading backup_db_local file data:', error);
    }
  }

  // Load errpt_more data for ERP-AIX
  if (latestErrptMoreFile) {
    try {
      selectedErrptMoreFileData = await getFileData(serverName, latestErrptMoreFile, 'errpt_more');
    } catch (error) {
      console.error('Error loading errpt_more file data:', error);
    }
  }

  // Load errpt_a_more data for ERP-AIX
  if (latestErrptAMoreFile) {
    try {
      selectedErrptAMoreFileData = await getFileData(serverName, latestErrptAMoreFile, 'errpt_a_more');
    } catch (error) {
      console.error('Error loading errpt_a_more file data:', error);
    }
  }
  
  // For tablespace, use the latest file (first in sorted array)
  let selectedTablespaceFileData = null;
  let selectedTablespaceFile = sortedTablespaceFiles[0] || '';
  
  if (selectedTablespaceFile && selectedTablespaceFile.length > 0) {
    try {
      const rawData = await getFileData(serverName, selectedTablespaceFile, 'tablespace');
      // Normalize the tablespace data using the same function as TableSpaceView
      const normalizedTablespace = normalizeTablespacePayload(rawData);
      selectedTablespaceFileData = normalizedTablespace ? { tablespace: normalizedTablespace } : null;
      if (import.meta.env.DEV) {
        console.log('Loaded tablespace data:', {
          file: selectedTablespaceFile,
          hasData: !!selectedTablespaceFileData,
          tablespaceArray: selectedTablespaceFileData?.tablespace,
          tablespaceLength: selectedTablespaceFileData?.tablespace?.length,
          normalizedLength: normalizedTablespace?.length
        });
      }
    } catch (error) {
      console.error('Error loading tablespace file data:', error);
      // Still keep the file selected, TableSpaceView will handle empty data
    }
  }



  const hasStatsData = !!selectedTopFileData;
  const hasProcessesData = 
    (Array.isArray(selectedTopFileData?.processes) && selectedTopFileData.processes.length > 0) ||
    (Array.isArray(selectedTopFileData?.parsed_top?.processes) && selectedTopFileData.parsed_top.processes.length > 0) ||
    (Array.isArray(selectedTopFileData?.parsed_data?.processes) && selectedTopFileData.parsed_data.processes.length > 0);
  const hasDiskData = 
    (Array.isArray(selectedDiskFileData?.df) && selectedDiskFileData.df.length > 0) ||
    (Array.isArray(selectedDiskFileData?.parsed_df) && selectedDiskFileData.parsed_df.length > 0);
  const hasTablespaceData =
    sortedTablespaceFiles.length > 0 &&
    Array.isArray(selectedTablespaceFileData?.tablespace) &&
    selectedTablespaceFileData.tablespace.length > 0;
  const hasLoggapData = !!selectedLoggapFileData;
  const hasCheckProcessData = !!selectedCheckProcessFileData;
  const hasDbBackupData = !!selectedDbBackupFileData;
  const hasWeeklyBackupData = !!selectedWeeklyBackupFileData;
  const hasBackupLocalData = !!selectedBackupLocalFileData;
  const hasErrptMoreData = !!selectedErrptMoreFileData;
  const hasErrptAMoreData = !!selectedErrptAMoreFileData;

  const hasAnyData = hasStatsData || hasProcessesData || hasDiskData || hasTablespaceData || hasLoggapData || hasCheckProcessData || hasDbBackupData || hasWeeklyBackupData || hasBackupLocalData || hasErrptMoreData || hasErrptAMoreData;


  return {
    topFiles: sortedTopFiles,
    diskFiles: sortedDiskFiles,
    tablespaceFiles: sortedTablespaceFiles,
    loggapFiles: sortedLoggapFiles,
    checkProcessFiles: sortedCheckProcessFiles,
    dbBackupFiles: sortedDbBackupFiles,
    weeklyBackupFiles: sortedWeeklyBackupFiles,
    backupLocalFiles: sortedBackupLocalFiles,
    selectedTopFile: latestTopFile,
    selectedDiskFile: latestDiskFile,
    selectedTablespaceFile: selectedTablespaceFile,
    selectedLoggapFile: latestLoggapFile,
    selectedCheckProcessFile: latestCheckProcessFile,
    selectedDbBackupFile: latestDbBackupFile,
    selectedWeeklyBackupFile: latestWeeklyBackupFile,
    selectedBackupLocalFile: latestBackupLocalFile,
    selectedTopFileData,
    selectedDiskFileData,
    selectedTablespaceFileData,
    selectedLoggapFileData,
    selectedCheckProcessFileData,
    selectedDbBackupFileData,
    selectedWeeklyBackupFileData,
    selectedBackupLocalFileData,
    errptMoreFiles: sortedErrptMoreFiles,
    errptAMoreFiles: sortedErrptAMoreFiles,
    selectedErrptMoreFile: latestErrptMoreFile,
    selectedErrptAMoreFile: latestErrptAMoreFile,
    selectedErrptMoreFileData,
    selectedErrptAMoreFileData,
    hasAnyData,
    isLoadingFileData: isLoadingFileData
  };
};

const HomeViewContent = forwardRef(({ servers = [], controller, state, isRefreshing = false, onExportPdf, onReadinessChange }, ref) => {
  const { theme } = useTheme();
  const [serverStates, setServerStates] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const tableRefsMap = useRef({});

  useImperativeHandle(ref, () => ({
    exportData: async () => {
      if (onExportPdf) {
        onExportPdf(serverStates, tableRefsMap.current);
      }
    }
  }), [onExportPdf, serverStates]);

  const totalServers = servers.length;

  // Track server readiness and notify parent
  useEffect(() => {
    if (!servers || servers.length === 0) {
      onReadinessChange?.(false);
      return;
    }

    const readyCount = Object.values(serverStates).filter(state => state?.status === 'ready').length;
    const hasAnyReady = readyCount > 0;
    onReadinessChange?.(hasAnyReady);
  }, [serverStates, servers, onReadinessChange]);

  const handleSelectTopFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        selectedTopFileData: null,
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'top');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedTopFile: fileName,
          selectedTopFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading top file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectDiskFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        selectedDiskFileData: null,
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'df');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedDiskFile: fileName,
          selectedDiskFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading disk file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectTablespaceFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        selectedTablespaceFileData: null,
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'tablespace');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedTablespaceFile: fileName,
          selectedTablespaceFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading tablespace file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectLoggapFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'loggap');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedLoggapFile: fileName,
          selectedLoggapFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading loggap file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectCheckProcessFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'check_process');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedCheckProcessFile: fileName,
          selectedCheckProcessFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading checkprocess file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectErrptMoreFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'errpt_more');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedErrptMoreFile: fileName,
          selectedErrptMoreFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading errpt_more file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectErrptAMoreFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'errpt_a_more');
    } catch (error) {
      console.error(`Error loading errpt_a_more file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectDbBackupFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'db_backup');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedDbBackupFile: fileName,
          selectedDbBackupFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading db_backup file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectWeeklyBackupFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'weekly_backup');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedWeeklyBackupFile: fileName,
          selectedWeeklyBackupFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading weekly_backup file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  const handleSelectBackupLocalFile = useCallback(async (serverName, fileName) => {
    if (!fileName || !serverName) return;
    
    setServerStates(prev => ({
      ...prev,
      [serverName]: {
        ...(prev[serverName] || {}),
        isLoadingFileData: true
      }
    }));

    try {
      const newData = await getFileData(serverName, fileName, 'backup_db_local');
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          selectedBackupLocalFile: fileName,
          selectedBackupLocalFileData: newData,
          isLoadingFileData: false
        }
      }));
    } catch (error) {
      console.error(`Error loading backup_db_local file for ${serverName}:`, error);
      setServerStates(prev => ({
        ...prev,
        [serverName]: {
          ...(prev[serverName] || {}),
          isLoadingFileData: false
        }
      }));
    }
  }, []);

  useEffect(() => {
    setServerStates(servers.reduce((acc, name) => {
      acc[name] = { status: 'queued' };
      return acc;
    }, {}));
  }, [servers]);

  useEffect(() => {
    let cancelled = false;

    const loadSequentially = async () => {
      for (let idx = 0; idx < servers.length; idx += 1) {
        const serverName = servers[idx];
        if (!serverName) continue;
        if (cancelled) break;

        setActiveIndex(idx);
        setServerStates(prev => ({
          ...prev,
          [serverName]: {
            ...(prev[serverName] || {}),
            status: 'loading',
            isLoadingFileData: true
          }
        }));

        try {
          const snapshot = await buildServerSnapshot(serverName, serverStates, true, state);
          if (cancelled) return;

          setServerStates(prev => ({
            ...prev,
            [serverName]: {
              ...snapshot,
              status: snapshot.hasAnyData ? 'ready' : 'empty',
              isLoadingFileData: false
            }
          }));
        } catch (error) {
          console.error(`Error loading data for ${serverName}:`, error);
          if (cancelled) return;
          setServerStates(prev => ({
            ...prev,
            [serverName]: {
              ...(prev[serverName] || {}),
              status: 'error',
              errorMessage: error?.message || 'Unable to load data',
              isLoadingFileData: false
            }
          }));
        }
      }
    };

    loadSequentially();
    return () => {
      cancelled = true;
    };
  }, [servers, state]);

  const readyCount = useMemo(
    () => Object.values(serverStates).filter(state => state?.status === 'ready').length,
    [serverStates]
  );

  const loadingServerName = servers[activeIndex] || '';

  if (!servers || servers.length === 0) {
    return (
      <div className="home-view">
        <div style={{
          marginTop: '24px',
          padding: '32px',
          border: `1px solid ${theme.border || '#30363d'}`,
          borderRadius: '10px',
          background: theme.background || '#0d1117',
          color: theme.text || '#c9d1d9',
          textAlign: 'center'
        }}>
          <FiAlertCircle style={{ fontSize: '48px', marginBottom: '16px', color: theme.textSecondary || '#8b949e' }} />
          <h3 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700 }}>No servers configured</h3>
          <p style={{ margin: 0, color: theme.textSecondary || '#8b949e' }}>
            Please check your server configuration or ensure the backend is running.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-view">
      <div className="all-servers-container">
        {servers.map((serverName, idx) => (
          <ServerCard
            key={serverName}
            serverName={serverName}
            controller={controller}
            position={idx + 1}
            total={totalServers}
            state={serverStates[serverName]}
            isRefreshing={isRefreshing}
            onSelectTopFile={(fileName) => handleSelectTopFile(serverName, fileName)}
            onSelectDiskFile={(fileName) => handleSelectDiskFile(serverName, fileName)}
            onSelectTablespaceFile={(fileName) => handleSelectTablespaceFile(serverName, fileName)}
            onSelectLoggapFile={(fileName) => handleSelectLoggapFile(serverName, fileName)}
            onSelectCheckProcessFile={(fileName) => handleSelectCheckProcessFile(serverName, fileName)}
            onSelectDbBackupFile={(fileName) => handleSelectDbBackupFile(serverName, fileName)}
            onSelectWeeklyBackupFile={(fileName) => handleSelectWeeklyBackupFile(serverName, fileName)}
            onSelectBackupLocalFile={(fileName) => handleSelectBackupLocalFile(serverName, fileName)}
            onSelectErrptMoreFile={(fileName) => handleSelectErrptMoreFile(serverName, fileName)}
            onSelectErrptAMoreFile={(fileName) => handleSelectErrptAMoreFile(serverName, fileName)}
            tableRefsMap={tableRefsMap}
          />
        ))}
      </div>
    </div>
  );
});

const ServerCard = memo(({ serverName, controller, state, position, total, onSelectTopFile, onSelectDiskFile, onSelectTablespaceFile, onSelectLoggapFile, onSelectCheckProcessFile, onSelectDbBackupFile, onSelectWeeklyBackupFile, onSelectBackupLocalFile, onSelectErrptMoreFile, onSelectErrptAMoreFile, isRefreshing = false, tableRefsMap }) => {
  const { theme } = useTheme();
  const status = state?.status || 'queued';
  const [sortConfig, setSortConfig] = useState(DEFAULT_SORT);

  useEffect(() => {
    setSortConfig(DEFAULT_SORT);
  }, [serverName]);

  const handleSort = (table, key) => {
    setSortConfig(prev => {
      const current = prev[table] || { key: null, order: 'asc' };
      const nextOrder = current.key === key && current.order === 'asc' ? 'desc' : 'asc';
      return {
        ...prev,
        [table]: { key, order: nextOrder }
      };
    });
  };

  const snapshot = state || {};

  const renderStatusCard = (icon, text, description) => (
    <div className="server-section">
      <div style={{
        background: theme.background || '#0d1117',
        border: `1px solid ${theme.border || '#30363d'}`,
        borderRadius: '10px',
        padding: '24px',
        textAlign: 'center',
        color: theme.text || '#c9d1d9'
      }}>
        {icon}
        <p style={{ marginTop: '12px', marginBottom: 0 }}>{text}</p>
        {description ? (
          <p style={{ margin: '6px 0 0', color: theme.textSecondary || '#8b949e' }}>{description}</p>
        ) : null}
      </div>
    </div>
  );

  if (status === 'queued') {
    return renderStatusCard(
      <FiClock className="spinning" style={{ fontSize: '28px', color: theme.textSecondary || '#8b949e' }} />,
      'Waiting its turn...',
      'This server will load after the previous one finishes.'
    );
  }

  if (status === 'loading') {
    return renderStatusCard(
      <FiRefreshCw className="spinning" style={{ fontSize: '28px', color: theme.textSecondary || '#8b949e' }} />,
      'Loading data for this server...',
      'Fetching latest stats, processes, disks, and tablespace.'
    );
  }

  if (status === 'error') {
    return renderStatusCard(
      <FiAlertCircle style={{ fontSize: '28px', color: '#f85149' }} />,
      'Unable to load data',
      snapshot.errorMessage || 'Please try again later.'
    );
  }

  if (status === 'empty') {
    return renderStatusCard(
      <FiAlertCircle style={{ fontSize: '28px', color: theme.textSecondary || '#8b949e' }} />,
      'No monitoring data available for this server',
      'The server returned empty results for all sections.'
    );
  }

  return (
    <div className="server-section">
      <div className="server-data-container">
        {snapshot.selectedTopFileData?.log_type === 'AIX_MONITORING' ? (
          <>
            <ServerDataWrapper
              serverName={serverName}
              type="stats"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectTopFile={onSelectTopFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="processes"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectTopFile={onSelectTopFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
          </>
        ) : (
          <>
            <ServerDataWrapper
              serverName={serverName}
              type="stats"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectTopFile={onSelectTopFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="processes"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectTopFile={onSelectTopFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="disk"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectDiskFile={onSelectDiskFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="tablespace"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectTablespaceFile={onSelectTablespaceFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="loggap"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectLoggapFile={onSelectLoggapFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="check_process"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectCheckProcessFile={onSelectCheckProcessFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="db_backup"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectDbBackupFile={onSelectDbBackupFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="weekly_backup"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectWeeklyBackupFile={onSelectWeeklyBackupFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            <ServerDataWrapper
              serverName={serverName}
              type="backup_local"
              controller={controller}
              snapshot={snapshot}
              sortConfig={sortConfig}
              onSort={handleSort}
              onSelectBackupLocalFile={onSelectBackupLocalFile}
              isRefreshing={isRefreshing}
              tableRefsMap={tableRefsMap}
            />
            {serverName === 'ERP-AIX' && (
              <>
                <ServerDataWrapper
                  serverName={serverName}
                  type="errpt-more"
                  controller={controller}
                  snapshot={snapshot}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  onSelectErrptMoreFile={onSelectErrptMoreFile}
                  isRefreshing={isRefreshing}
                  tableRefsMap={tableRefsMap}
                />
                <ServerDataWrapper
                  serverName={serverName}
                  type="errpt-a-more"
                  controller={controller}
                  snapshot={snapshot}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  onSelectErrptAMoreFile={onSelectErrptAMoreFile}
                  isRefreshing={isRefreshing}
                  tableRefsMap={tableRefsMap}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
});

const ServerDataWrapper = memo(({ serverName, type, controller, snapshot, sortConfig, onSort, onSelectTopFile, onSelectDiskFile, onSelectTablespaceFile, onSelectLoggapFile, onSelectCheckProcessFile, onSelectDbBackupFile, onSelectWeeklyBackupFile, onSelectBackupLocalFile, onSelectErrptMoreFile, onSelectErrptAMoreFile, isRefreshing = false, tableRefsMap }) => {
  // Initialize tableRefsMap for this server if it doesn't exist
  if (tableRefsMap?.current && !tableRefsMap.current[serverName]) {
    tableRefsMap.current[serverName] = {};
  }

  switch (type) {
    case 'stats': {
      if (!snapshot.selectedTopFileData) return null;
      
      // Check if it's AIX data (has parsed_data structure)
      const isAIXData = snapshot.selectedTopFileData?.log_type === 'AIX_MONITORING' || 
                        snapshot.selectedTopFileData?.parsed_data;
      
      if (isAIXData) {
        // Display AIX System View
        return (
          <div className="data-section" ref={(el) => {
            if (tableRefsMap?.current?.[serverName]) {
              tableRefsMap.current[serverName].statsTable = el;
            }
          }}>
            <AIXSystemView
              key={`${serverName}-aix`}
              data={snapshot.selectedTopFileData}
              diskData={snapshot.selectedDiskFileData}
              topFiles={snapshot.topFiles}
              selectedTopFile={snapshot.selectedTopFile}
              onSelectTopFile={onSelectTopFile}
              isLoading={false}
            />
          </div>
        );
      } else {
        // Display Linux Stats View
        return (
          <div className="data-section" ref={(el) => {
            if (tableRefsMap?.current?.[serverName]) {
              tableRefsMap.current[serverName].statsTable = el;
            }
          }}>
            <StatsView
              key={`${serverName}-stats`}
              data={snapshot.selectedTopFileData}
              selectedTopFileData={snapshot.selectedTopFileData}
            selectedTopFile={snapshot.selectedTopFile}
            topFiles={snapshot.topFiles}
            controller={controller}
            systemName={serverName}
            lastUpdated={snapshot.selectedTopFileData?.metadata?.timestamp || extractDateTime(snapshot.selectedTopFile)}
            uptime={snapshot.selectedTopFileData?.uptime || ''}
            onSelectTopFile={onSelectTopFile}
            isLoading={false}
            isHomeView={true}
          />
        </div>
      );
      }
    }
    case 'processes': {
      // Show AIXProcessesView for AIX data, ProcessesView for Linux
      if (snapshot.selectedTopFileData?.log_type === 'AIX_MONITORING') {
        return (
          <div className="data-section" ref={(el) => {
            if (tableRefsMap?.current?.[serverName]) {
              tableRefsMap.current[serverName].processesTable = el;
            }
          }}>
            <AIXProcessesView
              processes={snapshot.selectedTopFileData?.parsed_data?.processes}
              sortConfig={sortConfig}
              onSort={onSort}
              controller={controller}
              topFiles={snapshot.topFiles}
              selectedTopFile={snapshot.selectedTopFile}
              onSelectTopFile={onSelectTopFile}
              selectedTopFileData={snapshot.selectedTopFileData}
              isLoadingFileData={snapshot.isLoadingFileData || false}
            />
          </div>
        );
      }
      
      const processes = snapshot.selectedTopFileData?.parsed_top?.processes || snapshot.selectedTopFileData?.parsed_data?.processes || snapshot.selectedTopFileData?.processes;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].processesTable = el;
          }
        }}>
          <ProcessesView
            processes={processes}
            sortConfig={sortConfig}
            onSort={onSort}
            controller={controller}
            topFiles={snapshot.topFiles}
            selectedTopFile={snapshot.selectedTopFile}
            onSelectTopFile={onSelectTopFile}
            selectedTopFileData={snapshot.selectedTopFileData}
            isLoadingFileData={snapshot.isLoadingFileData || false}
          />
        </div>
      );
    }
    case 'disk': {
      const diskData = snapshot.selectedDiskFileData?.parsed_df || snapshot.selectedDiskFileData?.df;
      if (!Array.isArray(diskData) || diskData.length === 0) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].diskTable = el;
          }
        }}>
          <DiskView
            serverName={serverName}
            diskData={diskData}
            sortConfig={sortConfig}
            onSort={onSort}
            controller={controller}
            diskFiles={snapshot.diskFiles}
            selectedDiskFile={snapshot.selectedDiskFile}
            onSelectDiskFile={onSelectDiskFile}
            selectedDiskFileData={snapshot.selectedDiskFileData}
            isLoadingFileData={snapshot.isLoadingFileData || false}
            isHomeView={true}
          />
        </div>
      );
    }
    case 'tablespace': {
      // Skip tablespace for AIX systems - they don't have tablespace monitoring
      if (snapshot.selectedTopFileData?.log_type === 'AIX_MONITORING' || snapshot.selectedTopFileData?.parsed_data) {
        return null;
      }
      
      // Show TableSpaceView if we have tablespace files
      if (!snapshot.tablespaceFiles || snapshot.tablespaceFiles.length === 0) {
        return null;
      }
      
      // Use selected file or fallback to first file in array (same logic as TableSpaceView)
      const effectiveTablespaceFile = snapshot.selectedTablespaceFile || snapshot.tablespaceFiles[0];
      const tablespaceData = snapshot.selectedTablespaceFileData?.tablespace || [];
      
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].tablespaceTable = el;
          }
        }}>
          <TableSpaceView
            serverName={serverName}
            tablespaceData={tablespaceData}
            sortConfig={sortConfig}
            onSort={onSort}
            controller={controller}
            tablespaceFiles={snapshot.tablespaceFiles}
            selectedTablespaceFile={effectiveTablespaceFile}
            onSelectTablespaceFile={onSelectTablespaceFile}
            selectedTablespaceFileData={snapshot.selectedTablespaceFileData}
            isLoadingFileData={snapshot.isLoadingFileData || false}
            isHomeView={true}
          />
        </div>
      );
    }
    case 'loggap': {
      if (!snapshot.selectedLoggapFileData) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].loggapTable = el;
          }
        }}>
          <LoggapView
            data={snapshot.selectedLoggapFileData}
            loggapFiles={snapshot.loggapFiles || []}
            selectedLoggapFile={snapshot.selectedLoggapFile || ''}
            onSelectLoggapFile={onSelectLoggapFile}
            isLoading={snapshot.isLoadingFileData || false}
          />
        </div>
      );
    }
    case 'check_process': {
      if (!snapshot.selectedCheckProcessFileData) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].checkprocessTable = el;
          }
        }}>
          <CheckProcessView
            data={snapshot.selectedCheckProcessFileData}
            checkProcessFiles={snapshot.checkProcessFiles || []}
            selectedCheckProcessFile={snapshot.selectedCheckProcessFile || ''}
            onSelectCheckProcessFile={onSelectCheckProcessFile}
            isLoading={snapshot.isLoadingFileData || false}
            serverName={serverName}
          />
        </div>
      );
    }
    case 'db_backup': {
      if (!snapshot.selectedDbBackupFileData) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].dbbackupTable = el;
          }
        }}>
          <DBBackupView
            data={snapshot.selectedDbBackupFileData}
            dbBackupFiles={snapshot.dbBackupFiles || []}
            selectedDbBackupFile={snapshot.selectedDbBackupFile || ''}
            onSelectDbBackupFile={onSelectDbBackupFile}
            isLoading={snapshot.isLoadingFileData || false}
          />
        </div>
      );
    }
    case 'weekly_backup': {
      if (!snapshot.selectedWeeklyBackupFileData) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].weeklybackupTable = el;
          }
        }}>
          <WeeklyBackupView
            data={snapshot.selectedWeeklyBackupFileData}
            weeklyBackupFiles={snapshot.weeklyBackupFiles || []}
            selectedWeeklyBackupFile={snapshot.selectedWeeklyBackupFile || ''}
            onSelectWeeklyBackupFile={onSelectWeeklyBackupFile}
            isLoading={snapshot.isLoadingFileData || false}
          />
        </div>
      );
    }
    case 'backup_local': {
      if (!snapshot.selectedBackupLocalFileData) return null;
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].backuplocalTable = el;
          }
        }}>
          <BackupLocalView
            data={snapshot.selectedBackupLocalFileData}
            backupLocalFiles={snapshot.backupLocalFiles || []}
            selectedBackupLocalFile={snapshot.selectedBackupLocalFile || ''}
            onSelectBackupLocalFile={onSelectBackupLocalFile}
            isLoading={snapshot.isLoadingFileData || false}
          />
        </div>
      );
    }
    case 'errpt-more': {
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].errptmoreTable = el;
          }
        }}>
          <ErrptMoreView
            data={snapshot.selectedErrptMoreFileData}
            files={snapshot.errptMoreFiles || []}
            selectedFile={snapshot.selectedErrptMoreFile || ''}
            onSelectFile={onSelectErrptMoreFile}
            isLoading={snapshot.isLoadingFileData || false}
            serverName={serverName}
            fileType="errpt_more"
            onRefresh={() => {}}
          />
        </div>
      );
    }
    case 'errpt-a-more': {
      return (
        <div className="data-section" ref={(el) => {
          if (tableRefsMap?.current?.[serverName]) {
            tableRefsMap.current[serverName].errptamoreTable = el;
          }
        }}>
          <ErrptAMoreView
            data={snapshot.selectedErrptAMoreFileData}
            files={snapshot.errptAMoreFiles || []}
            selectedFile={snapshot.selectedErrptAMoreFile || ''}
            onSelectFile={onSelectErrptAMoreFile}
            isLoading={snapshot.isLoadingFileData || false}
            serverName={serverName}
            fileType="errpt_a_more"
            onRefresh={() => {}}
          />
        </div>
      );
    }
    default:
      return null;
  }
});

HomeViewContent.displayName = 'HomeViewContent';
ServerCard.displayName = 'ServerCard';
ServerDataWrapper.displayName = 'ServerDataWrapper';

HomeViewContent.propTypes = {
  servers: PropTypes.arrayOf(PropTypes.string).isRequired,
  controller: PropTypes.object.isRequired,
  state: PropTypes.object,
  isRefreshing: PropTypes.bool,
  onExportPdf: PropTypes.func,
  onReadinessChange: PropTypes.func
};

ServerCard.propTypes = {
  serverName: PropTypes.string.isRequired,
  controller: PropTypes.object.isRequired,
  state: PropTypes.object,
  position: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  isRefreshing: PropTypes.bool
};

ServerDataWrapper.propTypes = {
  serverName: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  controller: PropTypes.object.isRequired,
  snapshot: PropTypes.object,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  isRefreshing: PropTypes.bool
};

export const HomeView = HomeViewContent;
