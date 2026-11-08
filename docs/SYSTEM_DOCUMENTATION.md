# Daily Monitor System Architecture Documentation

**Last Updated:** January 28, 2026  
**System Version:** 1.0  
**Documentation Scope:** Complete system flow from backend to frontend UI

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Backend API Server                         │
│                  (n8n.local:5678/webhook)                   │
│                                                                  │
│  Database/File Storage:                                         │
│  - log/ERP-AIX/errpt_more/json/2026/01/ (Error Report Files)       │
│  - log/ERP-AIX/errpt_a_more/... (Advanced Error Reports)           │
│  - log/ERP-AIX/df/json/... (Disk Free Data)                        │
│  - log/ERP-AIX/top/json/... (Process Data)                         │
│  - log/ERP-AIX/tablespace/json/... (DB Tablespace Data)            │
│  - Similar structure for DB-01, APP-01, DOCS-01, CORE-DB, etc.      │
└──────────────────┬──────────────────────────────────────────────┘
                   │ REST API Calls
                   │
         ┌─────────▼────────────┐
         │  API Endpoints:      │
         │  - list-files        │
         │  - get-file          │
         └─────────┬────────────┘
                   │
                   │
┌──────────────────▼──────────────────────────────────────────────┐
│                    Frontend (React + Vite)                       │
│                     (localhost:3000)                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  State Management Layer (ServerModel)                      │  │
│  │  - Observable pattern for reactive updates                │  │
│  │  - Server selection state                                 │  │
│  │  - File selection state                                   │  │
│  │  - File data caching                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API Cache Layer (apiCache)                               │  │
│  │  - Reduces redundant API calls                            │  │
│  │  - Cache TTL-based expiration                             │  │
│  │  - Per-server, per-table caching                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  View Components (React)                                   │  │
│  │  ├─ HomeView         (All servers snapshot)               │  │
│  │  ├─ ServerListView   (Server selection)                   │  │
│  │  ├─ DiskView         (DF monitoring)                      │  │
│  │  ├─ ProcessesView    (TOP monitoring)                     │  │
│  │  ├─ TableSpaceView   (Tablespace monitoring)              │  │
│  │  ├─ LoggapView       (Log gap analysis)                   │  │
│  │  ├─ CheckProcessView (Process checking)                   │  │
│  │  ├─ ErrorReportView  (Errpt error reports)               │  │
│  │  ├─ StatsView        (Statistics & trends)                │  │
│  │  └─ HistoryView      (Historical data)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Entry Point: App.jsx                                           │
│  └─ Routes between HomeView and individual ServerView           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## API Communication Layer

### Endpoint 1: List Files
**Purpose:** Get list of available JSON files for a specific server and monitoring type

```
GET /webhook/api/v1/list-files
?app=SERVER_NAME&table=TABLE_NAME&type=json

Parameters:
- app: Server name (ERP-AIX, DB-01, APP-01, DOCS-01, etc.)
- table: Monitoring type (lowercase with underscores)
  * errpt_more   : Standard error reports
  * errpt_a_more : Advanced error reports with hardware info
  * df           : Disk free information
  * top          : Process and CPU information
  * tablespace   : Database tablespace usage
  * loggap       : Log gap analysis
  * checkprocess : Process status checking
  * db_backup    : Database backup logs
  * weekly_backup: Weekly backup logs
  * etc.
- type: File type (always 'json')

Response:
[
  "errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json",
  "errpt_more_Tue Jan 27 10:33:25 THAIST 2026.json",
  ...
]
```

### Endpoint 2: Get File Data
**Purpose:** Retrieve complete JSON data for a specific file

```
GET /webhook/api/v1/get-file
?app=SERVER_NAME&file=FILENAME&type=json&table=TABLE_NAME

Parameters:
- app: Server name
- file: Exact filename from list-files response
- table: Monitoring type (must match the filename's actual type)
- type: File type (always 'json')

Response: JSON object with complete data structure (see below)
```

**Important Backend Behavior:**
- Table name is **case-sensitive** and must be **lowercase with underscores**
- Filename patterns may differ from table parameter:
  - Table parameter: `errpt_a_more`
  - File naming: `errpt_-a_more_Wed Jan 28 10:33:25 THAIST 2026.json`
- Backend returns **empty array** for valid but unpopulated tables (not 500 error)
- Backend returns **500 error** for unrecognized table names

---

## Data Flow: Home View (All Servers Overview)

### 1. HomeView Component Lifecycle

```
User Opens Application
    ↓
App.jsx renders → HomeView.jsx renders
    ↓
HomeView.useEffect() triggers on mount
    ↓
buildServerSnapshot() called for EACH server
    ↓
For each server (ERP-AIX, DB-01, APP-01, DOCS-01, etc.):
  1. Fetch latest files for each monitoring type
  2. Load file data for each type
  3. Extract summary statistics
  4. Build snapshot object
    ↓
Combined snapshot data stored in ServerModel
    ↓
HomeView renders cards with:
  - Server status
  - Latest disk usage
  - Process info
  - Error counts
  - Backup status
  - Log gaps
```

### 2. File Loading Pattern (buildServerSnapshot)

```javascript
// For ERP-AIX server example:

1. Disk Usage (df):
   - Fetch: list-files(ERP-AIX, 'df')
   - Load Latest: getFileData(ERP-AIX, latestDFFile, 'df')
   - Display: Last df snapshot

2. Process Data (top):
   - Fetch: list-files(ERP-AIX, 'top')
   - Load Latest: getFileData(ERP-AIX, latestTopFile, 'top')
   - Display: Top processes and CPU usage

3. Error Reports (errpt_more):
   - Fetch: list-files(ERP-AIX, 'errpt_more')
   - Load Latest: getFileData(ERP-AIX, latestErrptMoreFile, 'errpt_more')
   - Display: Error count and types

4. Advanced Errors (errpt_a_more):
   - Fetch: list-files(ERP-AIX, 'errpt_a_more')
   - Load Latest: getFileData(ERP-AIX, latestErrptAMoreFile, 'errpt_a_more')
   - Display: Advanced error analysis with hardware breakdown

5. Tablespace:
   - Fetch: list-files(ERP-AIX, 'tablespace')
   - Load Latest: getFileData(ERP-AIX, latestTablespaceFile, 'tablespace')
   - Display: Database tablespace usage

6. Log Gaps:
   - Fetch: list-files(ERP-AIX, 'loggap')
   - Load Latest: getFileData(ERP-AIX, latestLoggapFile, 'loggap')
   - Display: Log gap analysis

7. Check Process:
   - Fetch: list-files(ERP-AIX, 'checkprocess')
   - Load Latest: getFileData(ERP-AIX, latestCheckProcessFile, 'checkprocess')
   - Display: Process status
```

### 3. Data Cache Layer

```javascript
// Location: src/store/apiCache.js

Cache Structure:
{
  "ERP-AIX-errpt_more-json": {
    data: [...],
    timestamp: 1234567890000,
    ttl: 300000 // 5 minutes
  },
  "ERP-AIX-errpt_a_more-json": { ... },
  "DB-01-df-json": { ... },
  ...
}

Benefits:
- Prevents duplicate API calls within 5-minute window
- Improves user experience (instant data on navigation)
- Reduces server load
- Persists data when switching between Home and individual server views
```

---

## Data Flow: Individual Server View

### 1. Server Selection & Route Change

```
User clicks server in ServerListView
    ↓
App.jsx receives selectedServer prop
    ↓
Route updates to /server/:serverName
    ↓
ServerView component loads
    ↓
ServerController.selectServer(serverName) called
    ↓
ServerModel updates state with selected server
    ↓
loadFiles() method in ServerModel triggers
```

### 2. Load Files (ServerModel.loadFiles)

```javascript
const loadFiles = async (serverName) => {
  // Fetch file lists for all monitoring types
  
  const topFiles = await fetchFilesList(serverName, 'top');
  const dfFiles = await fetchFilesList(serverName, 'df');
  const tablespaceFiles = await fetchFilesList(serverName, 'tablespace');
  const loggapFiles = await fetchFilesList(serverName, 'loggap');
  const checkProcessFiles = await fetchFilesList(serverName, 'checkprocess');
  const errptMoreFiles = await fetchFilesList(serverName, 'errpt_more');
  const errptAMoreFiles = await fetchFilesList(serverName, 'errpt_a_more');
  
  // If server is ERP-AIX, also fetch ERP-AIX-specific tables
  if (serverName === 'ERP-AIX') {
    const dbBackupFiles = await fetchFilesList(serverName, 'db_backup');
    const weeklyBackupFiles = await fetchFilesList(serverName, 'weekly_backup');
    const backupDbLocalFiles = await fetchFilesList(serverName, 'backup_db_local');
  }
  
  // Update state with file lists
  // (state becomes reactive, views re-render)
}
```

### 3. File Selection & Data Loading

```
User selects file from dropdown in StatsView/DiskView/ProcessesView
    ↓
Handler: handleSelectXxxFile(serverName, fileName)
    ↓
ServerController.selectXxxFile() called
    ↓
ServerModel.loadSelectedXxxFileData() triggered
    ↓
getFileData(serverName, fileName, tableName) called
    ↓
Check apiCache first (if exists and fresh)
    ↓
If not cached:
  - Make API call: /get-file?app=serverName&file=fileName&...
  - Parse response JSON
  - Store in cache
  ↓
Update state with file data
    ↓
Component re-renders with selected file data
```

### 4. View Rendering Hierarchy

```
App.jsx (Routes)
├─ HomeView (selectedServer === null)
│  └─ Renders all servers sequentially
│     └─ Each server card shows latest snapshot
│
└─ ServerView (selectedServer !== null)
   ├─ HeaderView
   │  └─ Shows server name and selected file info
   │
   ├─ StatsView
   │  └─ Process data (top)
   │  └─ File selector dropdown
   │  └─ Data visualization
   │
   ├─ DiskView
   │  └─ Disk space data (df)
   │  └─ File selector dropdown
   │  └─ Gauge chart visualization
   │
   ├─ TableSpaceView (if applicable)
   │  └─ Database tablespace data
   │  └─ File selector dropdown
   │
   ├─ LoggapView
   │  └─ Log gap analysis
   │  └─ File selector dropdown
   │
   ├─ CheckProcessView
   │  └─ Process status checking
   │  └─ File selector dropdown
   │
   ├─ ErrptMoreView
   │  └─ Error Report (errpt_more)
   │  └─ File selector dropdown
   │  └─ Error summary + detailed table
   │
   ├─ ErrptAMoreView
   │  └─ Advanced Error Report (errpt_a_more)
   │  └─ File selector dropdown
   │  └─ Error summary + detailed table
   │
   └─ HistoryView
      └─ Historical trend analysis
```

---

## Error Report Data Structure (Errpt)

### Raw Data from Backend

```javascript
{
  system: {
    hostname: "aix-erp-01",
    log_type: "ERROR_REPORT_ERRPT"
  },
  error_list: [
    {
      identifier: "4865FA9B",
      timestamp: "Wed Jan 28 01:32:00 THAIST 2026",
      type: "P",           // P=Predictive, T=Temporary, I=Informational
      class: "H",          // H=Hardware, S=Software
      resource: "rmt0",    // Device/resource name
      description: "TAPE OPERATION ERROR"
    },
    {
      identifier: "C69F5C9B",
      timestamp: "Mon Jan 19 10:01:00 THAIST 2026",
      type: "P",
      class: "S",
      resource: "SYSPROC",
      description: "SOFTWARE PROGRAM ABNORMALLY TERMINATED"
    },
    // ... more errors
  ],
  raw_stdout: "IDENTIFIER TIMESTAMP  T C RESOURCE_NAME  DESCRIPTION\n..."
}
```

### Data Extraction Function (extractErrorSummary)

```javascript
// Location: src/views/ErrorReportView.jsx

const extractErrorSummary = (parsedData) => {
  // Processes error_list array of objects
  // Returns aggregated statistics:
  
  return {
    count: 156,                              // Total error count
    types: {                                 // Group by error description
      "TAPE OPERATION ERROR": 45,
      "ADAPTER ERROR": 78,
      "DISK OPERATION ERROR": 18,
      "PATH HAS FAILED": 12,
      "SOFTWARE PROGRAM ABNORMALLY TERMINATED": 3
    },
    errorsByClass: {                         // Hardware vs Software
      "Hardware": 120,
      "Software": 36
    },
    errorsByType: {                          // Predictive vs Temporary vs Informational
      "Predictive": 78,
      "Temporary": 65,
      "Informational": 13
    },
    errorsByResource: {                      // Which devices/resources are affected
      "fscsi0": 45,
      "fscsi1": 32,
      "rmt0": 15,
      "hdisk1": 8,
      "hdisk2": 8,
      "hdisk0": 6,
      // ... etc
    }
  };
}
```

### UI Display Components

**ErrorReportView.jsx renders:**

1. **Summary Cards:**
   - Total Error Count (large bold number)
   - Hostname (system information)
   - Error Severity breakdown (Hardware vs Software)
   - Error Type breakdown (Predictive/Temporary/Informational)
   - Top Error Descriptions (with counts)
   - Affected Resources (top 8 devices)

2. **Detailed Error Table:**
   ```
   ┌────────────┬──────┬───────┬──────────┬──────────────────────┬─────────────┐
   │ Identifier │ Type │ Class │ Resource │ Description          │ Timestamp   │
   ├────────────┼──────┼───────┼──────────┼──────────────────────┼─────────────┤
   │ 4865FA9B   │ Pred │ HW    │ rmt0     │ TAPE OPERATION ERROR │ Jan 28 01:32│
   │ C69F5C9B   │ Pred │ SW    │ SYSPROC  │ SOFTWARE...TERM...   │ Jan 19 10:01│
   │ 3074FEB7   │ Temp │ HW    │ fscsi1   │ ADAPTER ERROR        │ Dec 16 18:21│
   └────────────┴──────┴───────┴──────────┴──────────────────────┴─────────────┘
   
   Features:
   - Color-coded type badges (Predictive=Red, Temporary=Orange, Info=Blue)
   - Color-coded class badges (Hardware=Red, Software=Orange)
   - Sortable by column
   - Scrollable with fixed header
   - Max 400px height before scrolling
   ```

3. **File Selector Dropdown:**
   - Lists all available errpt files for the server
   - User can switch between different dates
   - Automatically loads new data when selection changes

---

## Component Connection Map

### State Management (ServerModel)

```javascript
class ServerModel {
  // Server Selection
  selectedServer: string
  
  // File Lists (empty array if no files available)
  topFiles: string[]
  dfFiles: string[]
  tablespaceFiles: string[]
  loggapFiles: string[]
  checkProcessFiles: string[]
  errptMoreFiles: string[]
  errptAMoreFiles: string[]
  
  // File Selection
  selectedTopFile: string
  selectedDfFile: string
  selectedErrptMoreFile: string
  selectedErrptAMoreFile: string
  
  // File Data (cached)
  selectedTopFileData: object
  selectedDfFileData: object
  selectedErrptMoreFileData: object
  selectedErrptAMoreFileData: object
  
  // Methods
  selectServer(name)
  selectTopFile(filename)
  selectDfFile(filename)
  selectErrptMoreFile(filename)
  selectErrptAMoreFile(filename)
  loadFiles(serverName)
  loadSelectedTopFileData()
  loadSelectedDfFileData()
  loadSelectedErrptMoreFileData()
  loadSelectedErrptAMoreFileData()
}
```

### Controller Layer (ServerController)

```javascript
// Location: src/controllers/ServerController.js

class ServerController {
  constructor(model) {
    this.model = model; // ServerModel instance
  }
  
  // Server selection
  selectServer(serverName) {
    this.model.selectedServer = serverName;
    this.model.loadFiles(serverName);
  }
  
  // File selection handlers
  selectTopFile(serverName, fileName) {
    this.model.selectedTopFile = fileName;
    this.model.loadSelectedTopFileData();
  }
  
  selectDfFile(serverName, fileName) {
    this.model.selectedDfFile = fileName;
    this.model.loadSelectedDfFileData();
  }
  
  selectErrptMoreFile(serverName, fileName) {
    this.model.selectedErrptMoreFile = fileName;
    this.model.loadSelectedErrptMoreFileData();
  }
  
  selectErrptAMoreFile(serverName, fileName) {
    this.model.selectedErrptAMoreFile = fileName;
    this.model.loadSelectedErrptAMoreFileData();
  }
}
```

### App.jsx Main Router

```javascript
// Location: src/App.jsx

function App() {
  const serverModel = useServerModel(); // Global state
  const [state, setState] = useObservable(serverModel);
  
  return (
    <>
      {state.selectedServer === null ? (
        // Home View: All servers overview
        <HomeView serverModel={serverModel} />
      ) : (
        // Server View: Individual server details
        <>
          <HeaderView selectedServer={state.selectedServer} />
          <StatsView data={state.selectedTopFileData} ... />
          <DiskView data={state.selectedDfFileData} ... />
          {/* ... other view components ... */}
          <ErrptMoreView data={state.selectedErrptMoreFileData} ... />
          <ErrptAMoreView data={state.selectedErrptAMoreFileData} ... />
        </>
      )}
    </>
  );
}
```

---

## Theme & Styling

### Color System (useThemeColors)

```javascript
// Light Mode
colors = {
  background: '#ffffff',
  cardBg: '#f5f5f5',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e0e0e0',
  primary: '#4361ee',
  primaryHover: '#3650d3'
}

// Dark Mode
colors = {
  background: '#1a1a1a',
  cardBg: '#2d2d2d',
  text: '#ffffff',
  textSecondary: '#aaaaaa',
  border: '#404040',
  primary: '#6b7fff',
  primaryHover: '#5a6ee0'
}
```

### Component Styling Pattern

```javascript
// All components use inline styles with color variables
<div style={{
  background: colors.cardBg,
  border: `1px solid ${colors.border}`,
  borderRadius: '8px',
  padding: '16px',
  color: colors.text
}}>
  Content
</div>
```

---

## Performance Optimizations

### 1. API Caching

```javascript
// src/store/apiCache.js
// - 5-minute TTL per request
// - Key format: "serverName-tableName-type"
// - Shared across components and views
```

### 2. Lazy Loading Components

```javascript
// src/App.jsx
const HomeView = lazy(() => import('./views/HomeView'));
const StatsView = lazy(() => import('./views/StatsView'));
const ErrorReportView = lazy(() => import('./views/ErrorReportView'));
// ... etc

// Reduces initial bundle size
// Code splitting improves load time
```

### 3. Observable Pattern

```javascript
// ServerModel notifies all observers of state changes
// Only components that use changed data re-render
// Prevents unnecessary re-renders
```

### 4. Memo Components

```javascript
export const ErrptMoreView = memo((props) => {
  // Component only re-renders if props actually change
  // Prevents unnecessary re-renders from parent updates
});
```

---

## Testing Scenarios

### Scenario 1: Fresh Application Load

```
1. Browser opens http://localhost:3000
2. App.jsx loads, ServerModel initialized
3. HomeView renders, shows loading skeletons
4. For each server (ERP-AIX, DB-01, APP-01, ...):
   - buildServerSnapshot() runs
   - API calls triggered for all monitoring types
   - Latest files fetched and data loaded
   - Cache populated
5. After ~2-3 seconds, cards appear with data
6. User can scroll through all server snapshots
7. User clicks ERP-AIX → selectedServer = 'ERP-AIX'
8. App routes to ServerView
9. loadFiles() triggers again for detailed view
10. File selectors populate with available dates
11. All view components render with latest data
```

### Scenario 2: Switching Servers

```
1. User on ERP-AIX ServerView
2. User clicks DB-01 in ServerListView
3. selectedServer changes to 'DB-01'
4. ServerView unmounts for ERP-AIX, mounts for DB-01
5. loadFiles(DB-01) called
6. API cache checked for DB-01 files (may already exist from HomeView)
7. File lists populate immediately or within 1-2 seconds
8. User can select files and view data
9. API cache prevents redundant calls
```

### Scenario 3: Error Report Selection

```
1. User on ERP-AIX ServerView
2. ErrptMoreView shows dropdown with 5 available dates
3. User selects "errpt_more_Tue Jan 27 10:33:25 THAIST 2026.json"
4. handleSelectErrptMoreFile() triggered
5. ServerController.selectErrptMoreFile() called
6. ServerModel.loadSelectedErrptMoreFileData() executes
7. API call to /get-file with table='errpt_more'
8. Response: JSON with 156 errors
9. extractErrorSummary() processes error_list array
10. ErrorReportView renders:
    - Summary cards (count=156, Hardware=120, Software=36, etc.)
    - Detailed table with all 156 errors
    - Table shows: Identifier, Type, Class, Resource, Description, Timestamp
    - Table is scrollable (max 400px height)
11. User can hover over table rows for hover effects
12. User can switch files anytime via dropdown
```

### Scenario 4: Theme Toggle

```
1. User clicks theme toggle button
2. isDark state changes
3. useThemeColors() returns new color set
4. All components re-render with new colors
5. ApiCache is theme-agnostic (only stores raw data)
6. No API calls triggered
```

---

## Debugging Tips

### Console Logging Points

**HomeView.jsx:**
```javascript
console.log('=== buildServerSnapshot called for:', serverName)
console.log('fetchFilesList errpt_more response:', errptMoreFiles)
console.log('Loaded errpt_more:', { file, hasData })
```

**ServerModel.js:**
```javascript
console.log('loadFiles() triggered for:', serverName)
console.log('Fetched file list:', topFiles)
console.log('Loaded data for file:', fileName)
```

**ErrorReportView.jsx:**
```javascript
// Automatically shows:
// - Total error count
// - Error breakdown by class
// - Error breakdown by type
// - Resources affected
// - Detailed error table
```

### Network Debugging (Browser DevTools)

1. Open DevTools → Network tab
2. Filter by "list-files" and "get-file" requests
3. Check:
   - URL parameters (app, table, file)
   - Response status (200 = success, 500 = invalid table)
   - Response body (file list or error data)
   - Request/Response timing

### API Cache Debugging

```javascript
// In browser console:
// Check cached data
console.log(apiCache.cache)

// Clear cache
apiCache.cache = {}

// Reload page (will trigger fresh API calls)
```

---

## File Structure Summary

```
src/
├── App.jsx                              (Main router)
├── components/
│   ├── ThemeProvider.jsx                (Theme context)
│   ├── LoadingSkeleton.jsx              (Loading UI)
│   ├── ErrorBoundary.jsx                (Error handling)
│   └── Toast.jsx                        (Notifications)
│
├── controllers/
│   └── ServerController.js              (State management)
│
├── models/
│   └── ServerModel.js                   (Observable state)
│
├── views/
│   ├── HomeView.jsx                     (All servers overview)
│   ├── ServerListView.jsx               (Server selection)
│   ├── HeaderView.jsx                   (Server header)
│   ├── DiskView.jsx                     (DF data)
│   ├── StatsView.jsx                    (TOP data)
│   ├── TableSpaceView.jsx               (Tablespace data)
│   ├── LoggapView.jsx                   (Log gap analysis)
│   ├── CheckProcessView.jsx             (Process status)
│   ├── ErrorReportView.jsx              (Errpt reports)
│   ├── HistoryView.jsx                  (Historical trends)
│   └── AIXSystemView.jsx                (AIX metrics)
│
├── hooks/
│   └── useThemeColors.js                (Theme hook)
│
├── store/
│   └── apiCache.js                      (API response cache)
│
└── config/
    ├── config.js                        (App configuration)
    └── theme.js                         (Theme definitions)
```

---

## Key Takeaways

1. **Backend returns objects, not strings** - error_list contains `[{object}, {object}, ...]`, not `["string", "string", ...]`

2. **Table names are case-sensitive** - Must use lowercase with underscores: `errpt_more`, `errpt_a_more`, `db_backup`, etc.

3. **API Cache prevents redundant calls** - HomeView populates cache, ServerView benefits immediately

4. **Observer pattern keeps views in sync** - One ServerModel state, all components observe and re-render

5. **File lists may be empty** - Backend returns `[]` for valid tables with no files (not an error)

6. **Summary UI vs Detailed UI** - ErrorReportView shows both aggregated statistics and detailed error table

---

**Generated:** January 28, 2026  
**System Status:** Production Ready
