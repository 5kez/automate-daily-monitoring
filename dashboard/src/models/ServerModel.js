// Model: ServerModel.js
// Manages server data, state, and business logic

import { fetchFilesList, getFileData, clearServerCache, refreshFilesListPersistent } from '../../store/api';
import API_CONFIG from '../config/config.js';

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) {return null;}
  if (typeof value === 'number') {return Number.isFinite(value) ? value : null;}

  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/%$/, '');
    if (!cleaned) {return null;}
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pickFirstNumber = (obj, keys) => {
  if (!obj || typeof obj !== 'object') {return null;}
  for (const key of keys) {
    const n = toFiniteNumber(obj[key]);
    if (n !== null) {return n;}
  }
  return null;
};

const normalizeTablespaceDatafileRow = (row) => {
  if (!row || typeof row !== 'object') {return null;}

  const datafile_name = row.datafile_name ?? row.datafileName ?? row.name ?? 'N/A';
  const current_size_mb = pickFirstNumber(row, ['current_size_mb', 'current_mb', 'size_mb', 'current_size']);
  const used_mb = pickFirstNumber(row, ['used_mb', 'used_size_mb', 'used']);
  const free_mb = pickFirstNumber(row, ['free_mb', 'free_size_mb', 'free']);
  const used_percent = pickFirstNumber(row, ['used_percent', 'usage_percent', 'pct_used']);
  const max_size_mb = pickFirstNumber(row, ['max_size_mb', 'maximum_size_mb', 'max_mb', 'max_size', 'maximum_size']);
  const autoextend = row.autoextend ?? row.autoExtend ?? row.auto_extend ?? 'N/A';

  // Fill missing basics where possible.
  const inferredUsedPercent =
    used_percent === null && used_mb !== null && current_size_mb !== null && current_size_mb !== 0
      ? (used_mb / current_size_mb) * 100
      : used_percent;

  const inferredUsedMb =
    used_mb === null && current_size_mb !== null && inferredUsedPercent !== null
      ? (current_size_mb * inferredUsedPercent) / 100
      : used_mb;

  const inferredFreeMb =
    free_mb === null && current_size_mb !== null && inferredUsedMb !== null
      ? current_size_mb - inferredUsedMb
      : free_mb;

  return {
    datafile_name,
    current_size_mb,
    used_mb: inferredUsedMb,
    free_mb: inferredFreeMb,
    used_percent: inferredUsedPercent,
    max_size_mb,
    autoextend
  };
};

const normalizeTablespaceRow = (row) => {
  if (!row || typeof row !== 'object') {return null;}

  // New format often nests metrics under `summary`.
  const combined = {
    ...row,
    ...(row.summary && typeof row.summary === 'object' ? row.summary : null)
  };

  const tablespace_name =
    combined.tablespace_name ??
    combined.tablespaceName ??
    combined.name ??
    combined.tablespace ??
    'N/A';

  // Try common field variants from old + new formats.
  const maximum_size_mb = pickFirstNumber(combined, [
    'maximum_size_mb',
    'max_size_mb',
    'max_mb',
    'maximum_mb',
    'maximum_size',
    'max_size',
    'max'
  ]);

  let current_size_mb = pickFirstNumber(combined, [
    'current_size_mb',
    'current_mb',
    'size_mb',
    'total_mb',
    'current_size',
    'current'
  ]);

  let used_to_current_mb = pickFirstNumber(combined, [
    'used_to_current_mb',
    'used_mb',
    'used_size_mb',
    'used'
  ]);

  let used_to_current_percent = pickFirstNumber(combined, [
    'used_to_current_percent',
    'used_percent',
    'usage_percent',
    'pct_used'
  ]);

  let used_to_max_percent = pickFirstNumber(combined, [
    'used_to_max_percent',
    'used_to_max_pct',
    'used_max_percent'
  ]);

  // Fill missing metrics where possible.
  if (used_to_current_mb === null && current_size_mb !== null && used_to_current_percent !== null) {
    used_to_current_mb = (current_size_mb * used_to_current_percent) / 100;
  }

  if (current_size_mb === null && used_to_current_mb !== null && used_to_current_percent !== null && used_to_current_percent !== 0) {
    current_size_mb = (used_to_current_mb * 100) / used_to_current_percent;
  }

  if (used_to_current_percent === null && used_to_current_mb !== null && current_size_mb !== null && current_size_mb !== 0) {
    used_to_current_percent = (used_to_current_mb / current_size_mb) * 100;
  }

  if (used_to_max_percent === null && used_to_current_mb !== null && maximum_size_mb !== null && maximum_size_mb !== 0) {
    used_to_max_percent = (used_to_current_mb / maximum_size_mb) * 100;
  }

  const datafiles = Array.isArray(row.datafiles)
    ? row.datafiles
        .map((df) => normalizeTablespaceDatafileRow(df))
        .filter(Boolean)
    : null;

  return {
    tablespace_name,
    maximum_size_mb,
    used_to_max_percent,
    current_size_mb,
    used_to_current_mb,
    used_to_current_percent,
    datafiles
  };
};

export const normalizeTablespacePayload = (data) => {
  if (!data) {return null;}

  // Old format: { parsed_tablespace: Array<Row> }
  if (Array.isArray(data.parsed_tablespace)) {
    return data.parsed_tablespace
      .map((r) => normalizeTablespaceRow(r))
      .filter(Boolean);
  }

  // New format: { tablespaces: Array<{ tablespace_name, summary, ... }> }
  if (Array.isArray(data.tablespaces)) {
    return data.tablespaces
      .map((r) => normalizeTablespaceRow(r))
      .filter(Boolean);
  }

  // Defensive: sometimes the new payload is nested.
  if (data.parsed_tablespace && Array.isArray(data.parsed_tablespace.tablespaces)) {
    return data.parsed_tablespace.tablespaces
      .map((r) => normalizeTablespaceRow(r))
      .filter(Boolean);
  }

  return null;
};

export class ServerModel {
  constructor() {
    this.servers = [
      'DB-01',
      'DOCS-01',
      'HELPDESK-01',
      'HELPDESK-02',
      'CORE-DB',
      'CORE-APP',
      'RETAIL-APP',
      'RETAIL-DB',
      'ERP-AIX',
      'DR-SITE'
    ];
    this.selectedServer = null;
    this.topFiles = [];
    this.diskFiles = [];
    this.tablespaceFiles = [];
    this.loggapFiles = [];
    this.checkProcessFiles = [];
    this.dbBackupFiles = [];
    this.weeklyBackupFiles = [];
    this.backupLocalFiles = [];
    this.errptMoreFiles = [];
    this.errptAMoreFiles = [];
    this.selectedTopFile = '';
    this.selectedDiskFile = '';
    this.selectedTablespaceFile = '';
    this.selectedLoggapFile = '';
    this.selectedCheckProcessFile = '';
    this.selectedDbBackupFile = '';
    this.selectedWeeklyBackupFile = '';
    this.selectedBackupLocalFile = '';
    this.selectedErrptMoreFile = '';
    this.selectedErrptAMoreFile = '';
    this.selectedTopFileData = null;
    this.selectedDiskFileData = null;
    this.selectedTablespaceFileData = null;
    this.selectedLoggapFileData = null;
    this.selectedCheckProcessFileData = null;
    this.selectedDbBackupFileData = null;
    this.selectedWeeklyBackupFileData = null;
    this.selectedBackupLocalFileData = null;
    this.selectedErrptMoreFileData = null;
    this.selectedErrptAMoreFileData = null;
    this.sortConfig = {
      processes: { key: null, order: 'asc' },
      aix_processes: { key: null, order: 'asc' },
      disk: { key: 'use_percent', order: 'desc' },
      tablespace: { key: 'used_to_current_percent', order: 'desc' },
      loggap: { key: null, order: 'asc' },
      checkprocess: { key: null, order: 'asc' },
      dbbackup: { key: null, order: 'asc' },
      weeklybackup: { key: null, order: 'asc' },
      backuplocal: { key: null, order: 'asc' },
      errptmore: { key: null, order: 'asc' },
      errptamore: { key: null, order: 'asc' }
    };
    this.isLoading = false;
    this.isLoadingFiles = false;
    this.isLoadingFileData = false;
    this.observers = [];
    this.loadFilesToken = 0;
  }

  // Observer pattern for state updates
  addObserver(callback) {
    this.observers.push(callback);
  }

  removeObserver(callback) {
    this.observers = this.observers.filter(obs => obs !== callback);
  }

  notifyObservers(state) {
    this.observers.forEach(callback => callback(state));
  }

  // Getters
  getServers() {
    return this.servers;
  }

  getSelectedServer() {
    return this.selectedServer;
  }

  getTopFiles() {
    return this.topFiles;
  }

  getDiskFiles() {
    return this.diskFiles;
  }

  getTablespaceFiles() {
    return this.tablespaceFiles;
  }

  getLoggapFiles() {
    return this.loggapFiles;
  }

  getCheckProcessFiles() {
    return this.checkProcessFiles;
  }

  getDbBackupFiles() {
    return this.dbBackupFiles;
  }

  getWeeklyBackupFiles() {
    return this.weeklyBackupFiles;
  }

  getBackupLocalFiles() {
    return this.backupLocalFiles;
  }

  getSelectedTopFile() {
    return this.selectedTopFile;
  }

  getSelectedDiskFile() {
    return this.selectedDiskFile;
  }

  getSelectedTablespaceFile() {
    return this.selectedTablespaceFile;
  }

  getSelectedLoggapFile() {
    return this.selectedLoggapFile;
  }

  getSelectedCheckProcessFile() {
    return this.selectedCheckProcessFile;
  }

  getSelectedDbBackupFile() {
    return this.selectedDbBackupFile;
  }

  getSelectedWeeklyBackupFile() {
    return this.selectedWeeklyBackupFile;
  }

  getSelectedBackupLocalFile() {
    return this.selectedBackupLocalFile;
  }

  getSortConfig() {
    return this.sortConfig;
  }

  getIsLoading() {
    return this.isLoading;
  }

  getIsLoadingFiles() {
    return this.isLoadingFiles;
  }

  getIsLoadingFileData() {
    return this.isLoadingFileData;
  }

  // Setters
  selectServer(serverName) {
    this.selectedServer = serverName;
    // Increment token to invalidate any in-flight loadFiles() requests
    this.loadFilesToken++;
    // Always clear selected files so loadFiles() can auto-select latest
    this.selectedTopFile = '';
    this.selectedDiskFile = '';
    this.selectedTablespaceFile = '';
    this.selectedLoggapFile = '';
    this.selectedCheckProcessFile = '';
    this.selectedDbBackupFile = '';
    this.selectedWeeklyBackupFile = '';
    this.selectedBackupLocalFile = '';
    this.selectedErrptMoreFile = '';
    this.selectedErrptAMoreFile = '';
    this.selectedTopFileData = null;
    this.selectedDiskFileData = null;
    this.selectedTablespaceFileData = null;
    this.selectedLoggapFileData = null;
    this.selectedCheckProcessFileData = null;
    this.selectedDbBackupFileData = null;
    this.selectedWeeklyBackupFileData = null;
    this.selectedBackupLocalFileData = null;
    this.selectedErrptMoreFileData = null;
    this.selectedErrptAMoreFileData = null;
    // Clear loading states immediately to prevent stale loading screens
    this.setLoadingFiles(false);
    this.setLoadingFileData(false);
    this.notifyObservers(this.getState());
    
    // Auto-load files for this server (will auto-select latest file)
    if (serverName) {
      this.loadFiles();
    }
  }

  // Helper function to extract timestamp from filename
  // Extracts YYYY-MM-DD_HH-MM-SS format from filename
  extractTimestamp(fileName) {
    // Try multiple timestamp formats
    // Format 1: YYYY-MM-DD_HH-MM-SS
    let match = fileName.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
    
    // Format 2: YYYY-MM-DD HH:MM:SS (with space and colons)
    match = fileName.match(/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/);
    if (match) {
      // Normalize to YYYY-MM-DD_HH-MM-SS format for consistent comparison
      const normalized = match[1].replace(/\s/, '_').replace(/:/g, '-');
      return normalized;
    }
    
    // Format 3: YYYYMMDD_HHMMSS (no separators)
    match = fileName.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (match) {
      // Normalize to YYYY-MM-DD_HH-MM-SS format
      const normalized = `${match[1]}-${match[2]}-${match[3]}_${match[4]}-${match[5]}-${match[6]}`;
      return normalized;
    }
    
    // Format 4: YYYY_MM_DD_HH_MM_SS (underscores only)
    match = fileName.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
    if (match) {
      // Normalize to YYYY-MM-DD_HH-MM-SS format
      const normalized = `${match[1]}-${match[2]}-${match[3]}_${match[4]}-${match[5]}-${match[6]}`;
      return normalized;
    }
    
    // Format 5: Human-readable format like "Thu Feb  5 09:18:27 THAIST 2026"
    // Match: DayName MonthName Day HH:MM:SS TIMEZONE Year
    match = fileName.match(/([A-Za-z]{3})\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+[A-Z]+\s+(\d{4})/);
    if (match) {
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const year = match[7];
      const month = monthMap[match[2]];
      const day = match[3].padStart(2, '0');
      const hour = match[4];
      const minute = match[5];
      const second = match[6];
      const normalized = `${year}-${month}-${day}_${hour}-${minute}-${second}`;
      return normalized;
    }
    
    return null;
  }

  // Sort files by extracted timestamp (descending - newest first). Files without timestamps are placed at the end.
  sortFilesByTimestamp(filesList) {
    if (!Array.isArray(filesList)) {return [];}
    const copy = [...filesList];

    copy.sort((a, b) => {
      const aTs = this.extractTimestamp(String(a || ''));
      const bTs = this.extractTimestamp(String(b || ''));

      if (!aTs && !bTs) {return String(a || '').localeCompare(String(b || ''));}
      if (!aTs) {return 1;}  // Files without timestamps go to the end
      if (!bTs) {return -1;} // Files without timestamps go to the end
      // Sort in DESCENDING order so newest files are first
      return bTs.localeCompare(aTs);
    });

    return copy;
  }
  
  // Get the file with the latest timestamp from a list
  getLatestFile(filesList) {
    if (!Array.isArray(filesList) || filesList.length === 0) return null;
    
    let latestFile = filesList[0];
    let maxTimestamp = this.extractTimestamp(String(latestFile || ''));
    
    // Find file with the maximum timestamp by direct comparison
    for (let i = 1; i < filesList.length; i++) {
      const file = filesList[i];
      const ts = this.extractTimestamp(String(file || ''));
      
      if (ts && (!maxTimestamp || ts.localeCompare(maxTimestamp) > 0)) {
        maxTimestamp = ts;
        latestFile = file;
      }
    }
    
    return latestFile;
  }

  // Helper function to find file with matching timestamp
  findFileWithTimestamp(filesList, timestamp) {
    if (!filesList || !timestamp) {return null;}
    return filesList.find(file => this.extractTimestamp(file) === timestamp);
  }

  // Helper function to sync all file selections to the same timestamp (without triggering recursion)
  syncFilesToTimestamp(timestamp) {
    const topFileMatch = this.findFileWithTimestamp(this.topFiles, timestamp);
    const diskFileMatch = this.findFileWithTimestamp(this.diskFiles, timestamp);
    const tablespaceFileMatch = this.findFileWithTimestamp(this.tablespaceFiles, timestamp);

    let changed = false;

    if (topFileMatch && topFileMatch !== this.selectedTopFile) {
      this.selectedTopFile = topFileMatch;
      this.selectedTopFileData = null;
      changed = true;
    }

    if (diskFileMatch && diskFileMatch !== this.selectedDiskFile) {
      this.selectedDiskFile = diskFileMatch;
      this.selectedDiskFileData = null;
      changed = true;
    }

    if (tablespaceFileMatch && tablespaceFileMatch !== this.selectedTablespaceFile) {
      this.selectedTablespaceFile = tablespaceFileMatch;
      this.selectedTablespaceFileData = null;
      changed = true;
    }

    // Load data for all synced files
    if (changed) {
      this.loadSelectedTopFileData();
      this.loadSelectedDiskFileData();
      if (this.selectedTablespaceFile) {
        this.loadSelectedTablespaceFileData();
      }
      this.notifyObservers(this.getState());
    }
  }

  isAixSelected() {
    return this.selectedTopFileData?.log_type === 'AIX_MONITORING' || Boolean(this.selectedTopFileData?.parsed_data);
  }

  async waitForAixRefresh(serverName) {
    const previousLatest = this.getLatestFile(this.topFiles || []);
    const maxAttempts = 6;
    const intervalMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await delay(intervalMs);
      try {
        const files = await refreshFilesListPersistent(serverName, 'top');
        const latest = this.getLatestFile(this.sortFilesByTimestamp(files));
        if (latest && latest !== previousLatest) {
          return true;
        }
      } catch (error) {
        // Ignore and keep retrying.
      }
    }

    return false;
  }

  selectTopFile(fileName) {
    this.selectedTopFile = fileName;
    this.selectedTopFileData = null;
    const timestamp = this.extractTimestamp(fileName);
    if (timestamp) {
      // Sync disk and tablespace to match this timestamp
      const diskFileMatch = this.findFileWithTimestamp(this.diskFiles, timestamp);
      const tablespaceFileMatch = this.findFileWithTimestamp(this.tablespaceFiles, timestamp);
      
      if (diskFileMatch && diskFileMatch !== this.selectedDiskFile) {
        this.selectedDiskFile = diskFileMatch;
        this.selectedDiskFileData = null;
      }
      
      if (tablespaceFileMatch && tablespaceFileMatch !== this.selectedTablespaceFile) {
        this.selectedTablespaceFile = tablespaceFileMatch;
        this.selectedTablespaceFileData = null;
      }

      // Notify immediately so dropdowns update
      this.notifyObservers(this.getState());

      // Then load all data in parallel
      this.loadSelectedTopFileData();
      this.loadSelectedDiskFileData();
      if (this.selectedTablespaceFile) {
        this.loadSelectedTablespaceFileData();
      }
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectDiskFile(fileName) {
    this.selectedDiskFile = fileName;
    this.selectedDiskFileData = null;
    const timestamp = this.extractTimestamp(fileName);
    if (timestamp) {
      // Sync top and tablespace to match this timestamp
      const topFileMatch = this.findFileWithTimestamp(this.topFiles, timestamp);
      const tablespaceFileMatch = this.findFileWithTimestamp(this.tablespaceFiles, timestamp);
      
      if (topFileMatch && topFileMatch !== this.selectedTopFile) {
        this.selectedTopFile = topFileMatch;
        this.selectedTopFileData = null;
      }
      
      if (tablespaceFileMatch && tablespaceFileMatch !== this.selectedTablespaceFile) {
        this.selectedTablespaceFile = tablespaceFileMatch;
        this.selectedTablespaceFileData = null;
      }

      // Notify immediately so dropdowns update
      this.notifyObservers(this.getState());

      // Then load all data in parallel
      this.loadSelectedTopFileData();
      this.loadSelectedDiskFileData();
      if (this.selectedTablespaceFile) {
        this.loadSelectedTablespaceFileData();
      }
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectTablespaceFile(fileName) {
    this.selectedTablespaceFile = fileName;
    this.selectedTablespaceFileData = null;
    const timestamp = this.extractTimestamp(fileName);
    if (timestamp) {
      // Sync top and disk to match this timestamp
      const topFileMatch = this.findFileWithTimestamp(this.topFiles, timestamp);
      const diskFileMatch = this.findFileWithTimestamp(this.diskFiles, timestamp);
      
      if (topFileMatch && topFileMatch !== this.selectedTopFile) {
        this.selectedTopFile = topFileMatch;
        this.selectedTopFileData = null;
      }
      
      if (diskFileMatch && diskFileMatch !== this.selectedDiskFile) {
        this.selectedDiskFile = diskFileMatch;
        this.selectedDiskFileData = null;
      }

      // Notify immediately so dropdowns update
      this.notifyObservers(this.getState());

      // Then load all data in parallel
      this.loadSelectedTopFileData();
      this.loadSelectedDiskFileData();
      this.loadSelectedTablespaceFileData();
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectLoggapFile(fileName) {
    this.selectedLoggapFile = fileName;
    this.selectedLoggapFileData = null;
    this.notifyObservers(this.getState());
  }

  selectCheckProcessFile(fileName) {
    this.selectedCheckProcessFile = fileName;
    this.selectedCheckProcessFileData = null;
    if (fileName) {
      this.loadSelectedCheckProcessFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectDbBackupFile(fileName) {
    this.selectedDbBackupFile = fileName;
    this.selectedDbBackupFileData = null;
    if (fileName) {
      this.loadSelectedDbBackupFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectWeeklyBackupFile(fileName) {
    this.selectedWeeklyBackupFile = fileName;
    this.selectedWeeklyBackupFileData = null;
    if (fileName) {
      this.loadSelectedWeeklyBackupFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectBackupLocalFile(fileName) {
    this.selectedBackupLocalFile = fileName;
    this.selectedBackupLocalFileData = null;
    if (fileName) {
      this.loadSelectedBackupLocalFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectErrptMoreFile(fileName) {
    this.selectedErrptMoreFile = fileName;
    this.selectedErrptMoreFileData = null;
    if (fileName) {
      this.loadSelectedErrptMoreFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  selectErrptAMoreFile(fileName) {
    this.selectedErrptAMoreFile = fileName;
    this.selectedErrptAMoreFileData = null;
    if (fileName) {
      this.loadSelectedErrptAMoreFileData().then(() => {
        this.notifyObservers(this.getState());
      });
    } else {
      this.notifyObservers(this.getState());
    }
  }

  setSortConfig(table, key, order) {
    this.sortConfig = {
      ...this.sortConfig,
      [table]: { key, order }
    };
    this.notifyObservers(this.getState());
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.notifyObservers(this.getState());
  }

  setLoadingFiles(loading) {
    this.isLoadingFiles = loading;
    this.notifyObservers(this.getState());
  }

  setLoadingFileData(loading) {
    this.isLoadingFileData = loading;
    this.notifyObservers(this.getState());
  }

  // Business Logic Methods
  async loadFiles() {
    // Capture current token to detect if this request becomes stale
    const requestToken = this.loadFilesToken;
    
    try {
      if (!this.selectedServer) {
        this.setLoadingFiles(false);
        this.setLoadingFileData(false);
        return;
      }

      this.setLoadingFiles(true);
      this.setLoadingFileData(true);
      // Notify observers that loading has started
      this.notifyObservers(this.getState());
      
      // Define which tables each server type has
      const serverTableMap = {
        'ERP-AIX': ['top', 'df', 'tablespace', 'check_process', 'db_backup', 'weekly_backup', 'backup_db_local', 'errpt_more', 'errpt_a_more'],
        'DR-SITE': ['top', 'df', 'loggap'],
        'APP-01': ['top', 'df', 'tablespace'],
        'DB-01': ['top', 'df', 'tablespace'],
        'RETAIL-DB': ['top', 'df', 'tablespace'],
        'CORE-DB': ['top', 'df', 'tablespace'],
        'HELPDESK-01': ['top', 'df', 'tablespace'],
        'HELPDESK-02': ['top', 'df', 'tablespace'],
        // Default for servers not explicitly mapped (e.g., DOCS-01, RETAIL-APP, CORE-APP)
        'default': ['top', 'df']
      };

      // Get the tables for this server
      const allowedTables = serverTableMap[this.selectedServer] || serverTableMap.default;

      // Create promises only for tables this server has
      const fetchPromises = allowedTables.map(table =>
        fetchFilesList(this.selectedServer, table)
          .catch(error => {
            if (import.meta.env.DEV) {
              console.error(`Error fetching ${table} files:`, error);
            }
            return [];
          })
      );

      // Wait for all promises to resolve in parallel
      const results = await Promise.all(fetchPromises);

      // Map results back to variables with empty defaults
      let topFilesList = [];
      let diskFilesList = [];
      let tablespaceFilesList = [];
      let loggapFilesList = [];
      let checkProcessFilesList = [];
      let dbBackupFilesList = [];
      let weeklyBackupFilesList = [];
      let backupLocalFilesList = [];
      let errptMoreFilesList = [];
      let errptAMoreFilesList = [];

      // Assign results based on what was requested
      let resultIdx = 0;
      if (allowedTables.includes('top')) topFilesList = results[resultIdx++];
      if (allowedTables.includes('df')) diskFilesList = results[resultIdx++];
      if (allowedTables.includes('tablespace')) tablespaceFilesList = results[resultIdx++];
      if (allowedTables.includes('loggap')) loggapFilesList = results[resultIdx++];
      if (allowedTables.includes('check_process')) checkProcessFilesList = results[resultIdx++];
      if (allowedTables.includes('db_backup')) dbBackupFilesList = results[resultIdx++];
      if (allowedTables.includes('weekly_backup')) weeklyBackupFilesList = results[resultIdx++];
      if (allowedTables.includes('backup_db_local')) backupLocalFilesList = results[resultIdx++];
      if (allowedTables.includes('errpt_more')) errptMoreFilesList = results[resultIdx++];
      if (allowedTables.includes('errpt_a_more')) errptAMoreFilesList = results[resultIdx++];

      const sortedTopFiles = this.sortFilesByTimestamp(topFilesList);
      const sortedDiskFiles = this.sortFilesByTimestamp(diskFilesList);
      const sortedTablespaceFiles = this.sortFilesByTimestamp(tablespaceFilesList);
      const sortedLoggapFiles = this.sortFilesByTimestamp(loggapFilesList);
      const sortedCheckProcessFiles = this.sortFilesByTimestamp(checkProcessFilesList);
      const sortedDbBackupFiles = this.sortFilesByTimestamp(dbBackupFilesList);
      const sortedWeeklyBackupFiles = this.sortFilesByTimestamp(weeklyBackupFilesList);
      const sortedBackupLocalFiles = this.sortFilesByTimestamp(backupLocalFilesList);
      const sortedErrptMoreFiles = this.sortFilesByTimestamp(errptMoreFilesList);
      const sortedErrptAMoreFiles = this.sortFilesByTimestamp(errptAMoreFilesList);

      this.topFiles = sortedTopFiles;
      this.diskFiles = sortedDiskFiles;
      this.tablespaceFiles = sortedTablespaceFiles;
      this.loggapFiles = sortedLoggapFiles;
      this.checkProcessFiles = sortedCheckProcessFiles;
      this.dbBackupFiles = sortedDbBackupFiles;
      this.weeklyBackupFiles = sortedWeeklyBackupFiles;
      this.backupLocalFiles = sortedBackupLocalFiles;
      this.errptMoreFiles = sortedErrptMoreFiles;
      this.errptAMoreFiles = sortedErrptAMoreFiles;
      
      // Auto-select latest file from today (or most recent if none today) - Load all in parallel
      // Always reset to latest file on each refresh to prevent file locking
      const loadPromises = [];
      
      if (sortedTopFiles.length > 0) {
        // Get the latest (most recent) file - files are sorted newest first
        const latestTopFile = this.getLatestFile(sortedTopFiles);
        // Always force select the latest file - never lock to a previously selected file
        this.selectedTopFile = latestTopFile;
        this.selectedTopFileData = null; // Clear data so it reloads
        loadPromises.push(this.loadSelectedTopFileData());
      } else {
        this.selectedTopFile = '';
        this.selectedTopFileData = null;
      }
      
      if (sortedDiskFiles.length > 0) {
        // Always select the latest (most recent) disk file - never lock to a previously selected file
        this.selectedDiskFile = this.getLatestFile(sortedDiskFiles);
        this.selectedDiskFileData = null; // Clear data so it reloads
        loadPromises.push(this.loadSelectedDiskFileData());
      } else {
        this.selectedDiskFile = '';
        this.selectedDiskFileData = null;
      }
      
      if (sortedTablespaceFiles.length > 0) {
        // Try to load tablespace files from newest to oldest until we find one with data
        loadPromises.push((async () => {
          for (let i = 0; i < sortedTablespaceFiles.length; i++) {
            this.selectedTablespaceFile = sortedTablespaceFiles[i];
            this.selectedTablespaceFileData = null; // Clear data on each attempt so it reloads
            try {
              await this.loadSelectedTablespaceFileData();
              // If data is not empty, stop
              if (this.selectedTablespaceFileData?.tablespace?.length > 0) {
                break;
              }
            } catch (error) {
              // Stop trying older files when API keeps failing
              this.selectedTablespaceFileData = null;
              break;
            }
          }
        })());
      } else {
        this.selectedTablespaceFile = '';
        this.selectedTablespaceFileData = null;
      }
      
      // Auto-select latest files for DR-SITE special tables
      if (sortedLoggapFiles.length > 0) {
        this.selectedLoggapFile = this.getLatestFile(sortedLoggapFiles);
        loadPromises.push(this.loadSelectedLoggapFileData());
      } else {
        this.selectedLoggapFile = '';
        this.selectedLoggapFileData = null;
      }

      // Auto-select latest files for ERP-AIX special tables
      if (sortedCheckProcessFiles.length > 0) {
        this.selectedCheckProcessFile = this.getLatestFile(sortedCheckProcessFiles);
        loadPromises.push(this.loadSelectedCheckProcessFileData());
      } else {
        this.selectedCheckProcessFile = '';
        this.selectedCheckProcessFileData = null;
      }

      if (sortedDbBackupFiles.length > 0) {
        this.selectedDbBackupFile = this.getLatestFile(sortedDbBackupFiles);
        loadPromises.push(this.loadSelectedDbBackupFileData());
      } else {
        this.selectedDbBackupFile = '';
        this.selectedDbBackupFileData = null;
      }

      if (sortedWeeklyBackupFiles.length > 0) {
        this.selectedWeeklyBackupFile = this.getLatestFile(sortedWeeklyBackupFiles);
        loadPromises.push(this.loadSelectedWeeklyBackupFileData());
      } else {
        this.selectedWeeklyBackupFile = '';
        this.selectedWeeklyBackupFileData = null;
      }

      if (sortedBackupLocalFiles.length > 0) {
        this.selectedBackupLocalFile = this.getLatestFile(sortedBackupLocalFiles);
        loadPromises.push(this.loadSelectedBackupLocalFileData());
      } else {
        this.selectedBackupLocalFile = '';
        this.selectedBackupLocalFileData = null;
      }

      // Auto-select latest files for errpt error reports
      if (sortedErrptMoreFiles.length > 0) {
        this.selectedErrptMoreFile = this.getLatestFile(sortedErrptMoreFiles);
        loadPromises.push(this.loadSelectedErrptMoreFileData());
      } else {
        this.selectedErrptMoreFile = '';
        this.selectedErrptMoreFileData = null;
      }

      if (sortedErrptAMoreFiles.length > 0) {
        this.selectedErrptAMoreFile = this.getLatestFile(sortedErrptAMoreFiles);
        loadPromises.push(this.loadSelectedErrptAMoreFileData());
      } else {
        this.selectedErrptAMoreFile = '';
        this.selectedErrptAMoreFileData = null;
      }
      
      // Wait for all file data to load in parallel
      await Promise.all(loadPromises);
      
      // Only update state if this request is still current (not superseded by a newer selectServer call)
      if (requestToken === this.loadFilesToken) {
        // Give charts and heavy components time to initialize and start loading
        // This ensures loading screen stays visible until most async operations begin
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Clear loading states - data mapping is complete now
        this.setLoadingFiles(false);
        this.setLoadingFileData(false);
        
        // Notify after all data loaded and transformed completely
        this.notifyObservers(this.getState());
      }
    } catch (error) {
      // Handle any errors during loading and ensure loading states are cleared
      // Only update state if this request is still current
      if (requestToken === this.loadFilesToken) {
        if (import.meta.env.DEV) {
          console.error('Error loading files:', error);
        }
        this.setLoadingFiles(false);
        this.setLoadingFileData(false);
        this.notifyObservers(this.getState());
      }
    }
  }

  // Transform AIX format to normalized format compatible with StatsView
  _transformAIXData(aixData) {
    const toNumber = (value) => {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      const cleaned = String(value).replace('%', '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    // Extract CPU info from cpu_lpar
    const cpuLpar = aixData.cpu_lpar || {};
    const cpu = {
      user: toNumber(cpuLpar.user_pct),
      kernel: toNumber(cpuLpar.kern_pct),
      iowait: toNumber(cpuLpar.wait_pct),
      idle: toNumber(cpuLpar.idle_pct)
    };

    // Extract memory info
    const memData = aixData.memory || {};
    const totalMem = toNumber(memData.total_mb) || 1;
    const freeMem = toNumber(memData.free_ram_mb) || 0;
    const usedMem = totalMem - freeMem;
    const memoryUsedPct = (usedMem / totalMem) * 100;

    const memory = {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: memoryUsedPct
    };

    // Extract swap/paging info
    const pagingData = aixData.paging || {};
    const swapTotal = toNumber(pagingData.size_mb) || 1;
    const swapUsedPct = toNumber(pagingData.used_pct);
    const swapUsed = (swapTotal * swapUsedPct) / 100;

    const swap = {
      total: swapTotal,
      used: swapUsed,
      free: swapTotal - swapUsed,
      percent: swapUsedPct
    };

    // Transform processes
    const processes = (aixData.processes || []).map(p => ({
      pid: p.pid,
      cpu: toNumber(p.cpu_pct),
      cpu_pct: toNumber(p.cpu_pct),
      mem: toNumber(p.size_mb),
      mem_pct: (toNumber(p.size_mb) / totalMem) * 100,
      size_mb: toNumber(p.size_mb),
      owner: p.owner,
      user: p.owner,
      command: p.command,
      cmd: p.command
    }));

    // Create system info object
    const system = {
      hostname: aixData.system?.hostname || 'unknown',
      timestamp: aixData.system?.timestamp,
      uptime: 'AIX System'
    };

    return {
      cpu,
      memory,
      swap,
      processes,
      system,
      tasks: {
        total: processes.length,
        running: processes.filter(p => p.cpu > 0).length
      }
    };
  }

  async loadSelectedTopFileData() {
    if (!this.selectedTopFile) {
      this.selectedTopFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedTopFile, 'top');
      
      // Extract timestamp from filename (YYYY-MM-DD_HH-MM-SS format)
      let timestamp = 'N/A';
      if (this.selectedTopFile) {
        const match = this.selectedTopFile.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
        if (match) {
          timestamp = `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
        }
      }

      // Handle AIX format (parsed_data) or Linux format (parsed_top)
      if (data && data.log_type === 'AIX_MONITORING' && data.parsed_data) {
        // Keep AIX data as-is, don't transform
        this.selectedTopFileData = data;
        this.isAIXData = true;
      } else if (data && data.parsed_top) {
        // Standard Linux format - transform completely before setting
        let parsedData = data.parsed_top;

        let processes = (parsedData.processes || []);
        // Convert numeric string fields to numbers - complete mapping
        processes = processes.map(p => ({
          ...p,
          pid: parseInt(p.pid) || 0,
          cpu: parseFloat(p.cpu) || 0,
          mem: parseFloat(p.mem) || 0,
          user: p.user || 'N/A',
          command: p.command || 'N/A',
          virt: p.virt || '0',
          res: p.res || '0',
          shr: p.shr || '0',
          s: p.s || 'S'
        }));
        
        // Convert loadavg values from strings to numbers - complete mapping
        const loadavg = parsedData.system?.loadavg;
        const convertedLoadavg = loadavg ? {
          '1min': parseFloat(loadavg['1min']) || 0,
          '5min': parseFloat(loadavg['5min']) || 0,
          '15min': parseFloat(loadavg['15min']) || 0
        } : null;
        
        // Map system data completely
        const systemData = parsedData.system ? {
          uptime: parsedData.system.uptime || 'N/A',
          users: parsedData.system.users || 0,
          loadavg: convertedLoadavg,
          ...parsedData.system
        } : null;

        // Map tasks data completely
        const tasksData = parsedData.tasks ? {
          total: parseInt(parsedData.tasks.total) || 0,
          running: parseInt(parsedData.tasks.running) || 0,
          sleeping: parseInt(parsedData.tasks.sleeping) || 0,
          stopped: parseInt(parsedData.tasks.stopped) || 0,
          zombie: parseInt(parsedData.tasks.zombie) || 0
        } : null;

        // Map CPU data completely
        const cpuData = parsedData.cpu ? {
          user: parseFloat(parsedData.cpu.user) || 0,
          system: parseFloat(parsedData.cpu.system) || 0,
          nice: parseFloat(parsedData.cpu.nice) || 0,
          idle: parseFloat(parsedData.cpu.idle) || 0,
          iowait: parseFloat(parsedData.cpu.iowait) || 0,
          irq: parseFloat(parsedData.cpu.irq) || 0,
          softirq: parseFloat(parsedData.cpu.softirq) || 0
        } : null;

        // Map memory data completely
        const memoryData = parsedData.memory ? {
          total: parseInt(parsedData.memory.total_kb) || 0,
          used: parseInt(parsedData.memory.used_kb) || 0,
          free: parseInt(parsedData.memory.free_kb) || 0,
          shared: parseInt(parsedData.memory.shared) || 0,
          buffer: parseInt(parsedData.memory.buffers_kb) || 0,
          cache: parseInt(parsedData.memory.cache) || 0,
          // Add _kb versions for compatibility with view
          total_kb: parseInt(parsedData.memory.total_kb) || 0,
          used_kb: parseInt(parsedData.memory.used_kb) || 0,
          free_kb: parseInt(parsedData.memory.free_kb) || 0,
          buffers_kb: parseInt(parsedData.memory.buffers_kb) || 0
        } : null;

        // Map swap data completely
        const swapData = parsedData.swap ? {
          total: parseInt(parsedData.swap.total_kb) || 0,
          used: parseInt(parsedData.swap.used_kb) || 0,
          free: parseInt(parsedData.swap.free_kb) || 0,
          cached: parseInt(parsedData.swap.cached_kb) || 0,
          // Add _kb versions for compatibility with view
          total_kb: parseInt(parsedData.swap.total_kb) || 0,
          used_kb: parseInt(parsedData.swap.used_kb) || 0,
          free_kb: parseInt(parsedData.swap.free_kb) || 0,
          cached_kb: parseInt(parsedData.swap.cached_kb) || 0
        } : null;
        
        this.selectedTopFileData = {
          processes,
          system: systemData,
          tasks: tasksData,
          cpu: cpuData,
          memory: memoryData,
          swap: swapData,
          loadavg: convertedLoadavg,
          uptime: systemData?.uptime,
          metadata: {
            timestamp,
            filename: this.selectedTopFile
          }
        };
        this.isAIXData = false;
      } else {
        this.selectedTopFileData = null;
        this.isAIXData = false;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading top file data:', error);
      }
      this.selectedTopFileData = null;
      this.isAIXData = false;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedDiskFileData() {
    if (!this.selectedDiskFile) {
      this.selectedDiskFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedDiskFile, 'df');
      // parsed_df is directly an array - transform completely before setting
      if (data && Array.isArray(data.parsed_df)) {
        const dfData = data.parsed_df.map(df => ({
          filesystem: df.filesystem || 'N/A',
          '1K-blocks': parseInt(df['1K-blocks']) || 0,
          used: parseInt(df.used) || 0,
          available: parseInt(df.available) || 0,
          'use%': df['use%'] || '0%',
          mounted: df.mounted || 'N/A',
          ...df
        }));
        this.selectedDiskFileData = {
          df: dfData
        };
      } else {
        this.selectedDiskFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading disk file data:', error);
      }
      this.selectedDiskFileData = null;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedTablespaceFileData() {
    if (!this.selectedTablespaceFile) {
      this.selectedTablespaceFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedTablespaceFile, 'tablespace');

      const normalizedTablespace = normalizeTablespacePayload(data);
      if (Array.isArray(normalizedTablespace)) {
        this.selectedTablespaceFileData = {
          tablespace: normalizedTablespace
        };
      } else {
        this.selectedTablespaceFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading tablespace file data:', error);
      }
      this.selectedTablespaceFileData = null;
      throw error;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedLoggapFileData() {
    if (!this.selectedLoggapFile) {
      this.selectedLoggapFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedLoggapFile, 'loggap');
      if (data && data.Loggaps) {
        // Keep the new structure with capital 'Loggaps' and preserve all fields
        const loggaps = (Array.isArray(data.Loggaps) ? data.Loggaps : [data.Loggaps]).map(lg => ({
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
        this.selectedLoggapFileData = {
          Loggaps: loggaps,
          timestamp: data.timestamp || '',
          raw_stdout: data.raw_stdout || ''
        };
      } else {
        this.selectedLoggapFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading loggap file data:', error);
      }
      this.selectedLoggapFileData = null;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedCheckProcessFileData() {
    if (!this.selectedCheckProcessFile) {
      this.selectedCheckProcessFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedCheckProcessFile, 'check_process');
      if (data && data.Check_Processes) {
        // Map check process data completely before setting
        const checkProcesses = (Array.isArray(data.Check_Processes) ? data.Check_Processes : [data.Check_Processes]).map(cp => ({
          process: cp.process || 'N/A',
          status: cp.status || 'N/A',
          pid: cp.pid || 0,
          ...cp
        }));
        this.selectedCheckProcessFileData = {
          ...data,
          Check_Processes: checkProcesses
        };
      } else {
        this.selectedCheckProcessFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading checkprocess file data:', error);
      }
      this.selectedCheckProcessFileData = null;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedDbBackupFileData() {
    if (!this.selectedDbBackupFile) {
      this.selectedDbBackupFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedDbBackupFile, 'db_backup');
      if (data) {
        // Return full data with raw_stdout for time extraction
        this.selectedDbBackupFileData = data;
      } else {
        this.selectedDbBackupFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading db_backup file data:', error);
      }
      this.selectedDbBackupFileData = null;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedWeeklyBackupFileData() {
    if (!this.selectedWeeklyBackupFile) {
      this.selectedWeeklyBackupFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedWeeklyBackupFile, 'weekly_backup');
      if (data) {
        // Return full data with raw_stdout for time extraction
        this.selectedWeeklyBackupFileData = data;
      } else {
        this.selectedWeeklyBackupFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading weekly_backup file data:', error);
      }
      this.selectedWeeklyBackupFileData = null;
    }
    
    // Don't notify here - let loadFiles() notify after all data is loaded
    return true; // Indicates loading complete
  }

  async loadSelectedBackupLocalFileData() {
    if (!this.selectedBackupLocalFile) {
      this.selectedBackupLocalFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedBackupLocalFile, 'backup_db_local');
      if (data) {
        // Return full data with raw_stdout for time extraction
        this.selectedBackupLocalFileData = data;
      } else {
        this.selectedBackupLocalFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading backup_db_local file data:', error);
    
    // Notify observers immediately after this specific data is loaded and mapped
    this.notifyObservers(this.getState());
      }
      this.selectedBackupLocalFileData = null;
    }
    return true; // Indicates loading complete
  }

  async loadSelectedErrptMoreFileData() {
    if (!this.selectedServer || !this.selectedErrptMoreFile) {
      this.selectedErrptMoreFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedErrptMoreFile, 'errpt_more');
      if (data) {
        this.selectedErrptMoreFileData = data;
      } else {
        this.selectedErrptMoreFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading errpt_more file data:', error);
      }
      this.selectedErrptMoreFileData = null;
    }
    
    // Notify observers immediately after this specific data is loaded and mapped
    this.notifyObservers(this.getState());
    return true; // Indicates loading complete
  }

  async loadSelectedErrptAMoreFileData() {
    if (!this.selectedServer || !this.selectedErrptAMoreFile) {
      this.selectedErrptAMoreFileData = null;
      return;
    }

    try {
      const data = await getFileData(this.selectedServer, this.selectedErrptAMoreFile, 'errpt_a_more');
      if (data) {
        this.selectedErrptAMoreFileData = data;
      } else {
        this.selectedErrptAMoreFileData = null;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading errpt_a_more file data:', error);
      }
      this.selectedErrptAMoreFileData = null;
    }
    
    // Notify observers immediately after this specific data is loaded and mapped
    this.notifyObservers(this.getState());
    return true; // Indicates loading complete
  }

  async refreshData(serverName = null) {
    this.setLoading(true);
    const mode = serverName === 'ALL' ? 'ALL' : (serverName || this.selectedServer);

    try {
      // Call webhook to trigger refresh
      const response = await fetch(API_CONFIG.getRefreshUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mode })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Parse response from server (expected array of entries)
      const responseData = await response.json();
      const entries = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.results)
          ? responseData.results
          : [];

      const failures = entries.filter((item) => String(item?.status || '').toLowerCase() === 'fail');

      // Clear cache before reloading files
      const serverToClear = mode === 'ALL' ? null : mode;
      if (serverToClear) {
        clearServerCache(serverToClear);
      } else if (mode === 'ALL') {
        const serversToClear = Array.isArray(this.servers) ? this.servers : [];
        serversToClear.forEach((server) => {
          if (server) {
            clearServerCache(server);
          }
        });
      }

      // If response received successfully, reload files (not page)
      if (responseData) {
        const shouldWaitForAix = mode && mode === this.selectedServer && this.isAixSelected();
        if (shouldWaitForAix) {
          await this.waitForAixRefresh(mode);
        }
        await this.loadFiles();
      }

      return { response: responseData, failures };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error during refresh:', error);
      }

      return {
        response: null,
        failures: [{
          server: mode || 'ALL',
          command: 'refresh',
          status: 'fail',
          message: error?.message || 'Refresh failed'
        }]
      };
    } finally {
      this.setLoading(false);
    }
  }

  getState() {
    return {
      servers: this.servers,
      selectedServer: this.selectedServer,
      topFiles: this.topFiles,
      diskFiles: this.diskFiles,
      tablespaceFiles: this.tablespaceFiles,
      loggapFiles: this.loggapFiles,
      checkProcessFiles: this.checkProcessFiles,
      dbBackupFiles: this.dbBackupFiles,
      weeklyBackupFiles: this.weeklyBackupFiles,
      backupLocalFiles: this.backupLocalFiles,
      errptMoreFiles: this.errptMoreFiles,
      errptAMoreFiles: this.errptAMoreFiles,
      selectedTopFile: this.selectedTopFile,
      selectedDiskFile: this.selectedDiskFile,
      selectedTablespaceFile: this.selectedTablespaceFile,
      selectedLoggapFile: this.selectedLoggapFile,
      selectedCheckProcessFile: this.selectedCheckProcessFile,
      selectedDbBackupFile: this.selectedDbBackupFile,
      selectedWeeklyBackupFile: this.selectedWeeklyBackupFile,
      selectedBackupLocalFile: this.selectedBackupLocalFile,
      selectedErrptMoreFile: this.selectedErrptMoreFile,
      selectedErrptAMoreFile: this.selectedErrptAMoreFile,
      selectedTopFileData: this.selectedTopFileData,
      selectedDiskFileData: this.selectedDiskFileData,
      selectedTablespaceFileData: this.selectedTablespaceFileData,
      selectedLoggapFileData: this.selectedLoggapFileData,
      selectedCheckProcessFileData: this.selectedCheckProcessFileData,
      selectedDbBackupFileData: this.selectedDbBackupFileData,
      selectedWeeklyBackupFileData: this.selectedWeeklyBackupFileData,
      selectedBackupLocalFileData: this.selectedBackupLocalFileData,
      selectedErrptMoreFileData: this.selectedErrptMoreFileData,
      selectedErrptAMoreFileData: this.selectedErrptAMoreFileData,
      sortConfig: this.sortConfig,
      isLoading: this.isLoading,
      isLoadingFiles: this.isLoadingFiles,
      isLoadingFileData: this.isLoadingFileData
    };
  }
}

// Singleton instance
export const serverModel = new ServerModel();
