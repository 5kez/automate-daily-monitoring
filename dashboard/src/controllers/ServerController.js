// Controller: ServerController.js
// Handles application logic and coordinates between Model and View

import { serverModel } from '../models/ServerModel';

export class ServerController {
  constructor() {
    this.model = serverModel;
  }

  // Server Selection
  handleSelectServer(serverName) {
    this.model.selectServer(serverName);
  }

  // File Selection
  handleSelectTopFile(fileName) {
    this.model.selectTopFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedTopFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectDiskFile(fileName) {
    this.model.selectDiskFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedDiskFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectTablespaceFile(fileName) {
    this.model.selectTablespaceFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedTablespaceFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectLoggapFile(fileName) {
    this.model.selectLoggapFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedLoggapFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectCheckProcessFile(fileName) {
    this.model.selectCheckProcessFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedCheckProcessFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectDbBackupFile(fileName) {
    this.model.selectDbBackupFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedDbBackupFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectWeeklyBackupFile(fileName) {
    this.model.selectWeeklyBackupFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedWeeklyBackupFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectBackupLocalFile(fileName) {
    this.model.selectBackupLocalFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedBackupLocalFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectErrptMoreFile(fileName) {
    this.model.selectErrptMoreFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedErrptMoreFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  handleSelectErrptAMoreFile(fileName) {
    this.model.selectErrptAMoreFile(fileName);
    // Load data when file is selected and notify
    if (fileName) {
      this.model.loadSelectedErrptAMoreFileData().then(() => {
        this.model.notifyObservers(this.model.getState());
      });
    }
  }

  // Sorting
  handleSort(table, key) {
    const currentSort = this.model.getSortConfig()[table];
    let order = 'asc';
    
    if (currentSort.key === key && currentSort.order === 'asc') {
      order = 'desc';
    }
    
    this.model.setSortConfig(table, key, order);
  }

  // Data Loading
  async handleLoadFiles() {
    await this.model.loadFiles();
  }

  // Refresh
  async handleRefresh() {
    return this.model.refreshData();
  }

  async handleRefreshAll() {
    return this.model.refreshData('ALL');
  }

  async handleRefreshServer(serverName) {
    // Refresh specific server data
    return this.model.refreshData(serverName);
  }

  // State Subscription
  subscribe(callback) {
    this.model.addObserver(callback);
    // Return initial state
    return this.model.getState();
  }

  unsubscribe(callback) {
    this.model.removeObserver(callback);
  }

  // Utility methods
  // Utility function to parse size string to bytes for proper sorting
  parseSizeToBytes(sizeStr) {
    if (!sizeStr) {return 0;}
    
    const match = sizeStr.toString().match(/^([\d.]+)\s*([KMGT]?)B?$/i);
    if (!match) {return 0;}
    
    const value = parseFloat(match[1]);
    const unit = match[2]?.toUpperCase() || '';
    
    const multipliers = {
      'K': 1024,
      'M': 1024 ** 2,
      'G': 1024 ** 3,
      'T': 1024 ** 4
    };
    
    return value * (multipliers[unit] || 1);
  }

  // Utility function to parse TIME+ string (MM:SS.MS or HH:MM:SS) to seconds
  parseTimeToSeconds(timeStr) {
    if (!timeStr) {return 0;}
    
    const str = timeStr.toString().trim();
    const parts = str.split(':');
    
    if (parts.length === 2) {
      // MM:SS.MS format
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      // HH:MM:SS format
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    return 0;
  }

  getSortedData(data, table, sortConfigOverride = null) {
    if (!data) {return [];}
    
    // Use provided sortConfig override, or fall back to model's config
    let sortConfig = sortConfigOverride;
    if (!sortConfig) {
      sortConfig = this.model.getSortConfig()[table];
    } else if (sortConfigOverride[table]) {
      sortConfig = sortConfigOverride[table];
    }
    if (!sortConfig || !sortConfig.key) {return data;}

    // Fields that need size conversion for proper sorting
    const sizeFields = ['size', 'used', 'avail', 'virt', 'res', 'shr'];
    const shouldConvertSize = sizeFields.includes(sortConfig.key);
    
    // Fields that need percentage conversion (remove % and convert to number)
    const percentFields = ['use_percent'];
    const shouldConvertPercent = percentFields.includes(sortConfig.key);
    
    // Numeric fields that should be compared as numbers (cpu, mem, pid, ni, pr)
    const numericFields = ['cpu', 'mem', 'pid', 'ni', 'pr'];
    const shouldConvertNumeric = numericFields.includes(sortConfig.key);

    // Time field that should be parsed to seconds
    const timeFields = ['time', 'time_plus', 'time+'];
    const shouldConvertTime = timeFields.includes(sortConfig.key);

    const sorted = [...data].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Convert size strings to bytes for numeric comparison
      if (shouldConvertSize) {
        aVal = this.parseSizeToBytes(aVal);
        bVal = this.parseSizeToBytes(bVal);
      }
      
      // Convert percentage strings to numbers (remove % sign)
      if (shouldConvertPercent) {
        aVal = typeof aVal === 'string' ? parseFloat(aVal.replace('%', '')) : aVal;
        bVal = typeof bVal === 'string' ? parseFloat(bVal.replace('%', '')) : bVal;
        // Treat NaN or invalid values (like "-") as minimum value so they appear at bottom when sorting desc
        if (isNaN(aVal)) aVal = -Infinity;
        if (isNaN(bVal)) bVal = -Infinity;
      }
      
      // Convert to numbers for numeric fields
      if (shouldConvertNumeric) {
        aVal = typeof aVal === 'string' ? parseFloat(aVal) : aVal;
        bVal = typeof bVal === 'string' ? parseFloat(bVal) : bVal;
      }

      // Convert time strings to seconds
      if (shouldConvertTime) {
        aVal = this.parseTimeToSeconds(aVal);
        bVal = this.parseTimeToSeconds(bVal);
      }

      if (aVal < bVal) {
        return sortConfig.order === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.order === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }

  formatBytes(bytes) {
    if (bytes === 0) {return '0 B';}
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100  } ${  sizes[i]}`;
  }

  formatPercentage(value) {
    return `${Math.round(value * 100) / 100  }%`;
  }

  getProgressColor(percentage) {
    if (percentage >= 90) {return '#da3633';}
    if (percentage >= 80) {return '#f0883e';}
    return '#238636';
  }
}

// Singleton instance
export const serverController = new ServerController();
