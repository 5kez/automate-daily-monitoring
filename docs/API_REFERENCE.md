# 🔌 API Reference & Backend Integration Guide

**Complete Backend API Documentation**

---

## 📍 Base URL

```
http://n8n.local:5678/webhook/api/v1
```

---

## 1️⃣ List Files Endpoint

### Purpose
Get list of available monitoring data files for a specific server and monitoring type

### Endpoint
```
GET /list-files
```

### Query Parameters

| Parameter | Type   | Required | Description                    | Example               |
|-----------|--------|----------|--------------------------------|-----------------------|
| app       | string | Yes      | Server name (lowercase)         | ERP-AIX, DB-01, APP-01        |
| table     | string | Yes      | Monitoring type (lowercase)     | errpt_more            |
| type      | string | Yes      | File format type               | json                  |

### Complete URL Examples

```
# Error Reports - Standard
GET /list-files?app=ERP-AIX&table=errpt_more&type=json

# Error Reports - Advanced
GET /list-files?app=ERP-AIX&table=errpt_a_more&type=json

# Disk Usage
GET /list-files?app=ERP-AIX&table=df&type=json

# Process Data
GET /list-files?app=ERP-AIX&table=top&type=json

# Database Tablespace
GET /list-files?app=ERP-AIX&table=tablespace&type=json

# Log Gaps
GET /list-files?app=ERP-AIX&table=loggap&type=json

# Process Checking
GET /list-files?app=ERP-AIX&table=checkprocess&type=json

# Backup Logs
GET /list-files?app=ERP-AIX&table=db_backup&type=json
GET /list-files?app=ERP-AIX&table=weekly_backup&type=json
GET /list-files?app=ERP-AIX&table=backup_db_local&type=json
```

### Response Format

**Success (200 OK):**
```json
[
  "errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json",
  "errpt_more_Tue Jan 27 10:33:25 THAIST 2026.json",
  "errpt_more_Mon Jan 26 10:33:25 THAIST 2026.json"
]
```

**Empty Result (Still 200 OK):**
```json
[]
```
**Meaning:** Table is recognized but has no files (normal)

**Error (500):**
```json
{"message":"Error in workflow"}
```
**Meaning:** Invalid table name or API error

### HTTP Status Codes

| Status | Meaning                                    |
|--------|-------------------------------------------|
| 200    | Success - returns file list (may be empty)|
| 500    | Invalid table name or server error        |

### Table Names (Valid Values)

```
Core Monitoring Types:
├─ errpt_more       (Standard AIX error reports)
├─ errpt_a_more     (Advanced error reports with hardware details)
├─ df               (Disk free/usage information)
├─ top              (Process, CPU, memory data)
├─ tablespace       (Database tablespace usage)
├─ loggap           (Log file gap analysis)
└─ checkprocess     (Process status checking)

ERP-AIX-Specific Backup Types:
├─ db_backup        (Database backup logs)
├─ weekly_backup    (Weekly backup logs)
└─ backup_db_local  (Local database backups)

Important:
• MUST be lowercase
• MUST use underscores (not hyphens)
• MUST not have spaces
• Case-sensitive
```

### Filename Pattern Analysis

**Standard Format:**
```
table_name_TIMESTAMP.json
└─ table_name: Type of data (errpt_more, df, top, etc.)
└─ TIMESTAMP: Collection date and time
└─ .json: File extension

Examples:
"errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json"
"df_Tue Jan 27 14:20:15 THAIST 2026.json"
"top_Mon Jan 26 08:00:00 THAIST 2026.json"

Note: Filename uses "errpt_-a_more" (with hyphen) but API expects "errpt_a_more" (without)
```

### Frontend Implementation

```javascript
// In src/controllers/ServerController.js and src/views/HomeView.jsx

const fetchFilesList = async (serverName, tableName) => {
  try {
    const response = await fetch(
      `http://n8n.local:5678/webhook/api/v1/list-files?app=${serverName}&table=${tableName}&type=json`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch ${tableName} files for ${serverName}`);
      return [];
    }
    
    const files = await response.json();
    return Array.isArray(files) ? files : [];
  } catch (error) {
    console.error(`Error fetching files: ${error.message}`);
    return [];
  }
};

// Usage:
const files = await fetchFilesList('ERP-AIX', 'errpt_more');
// Returns: ["errpt_more_Wed Jan 28..json", "errpt_more_Tue Jan 27..json", ...]
```

---

## 2️⃣ Get File Data Endpoint

### Purpose
Retrieve complete JSON data for a specific monitoring file

### Endpoint
```
GET /get-file
```

### Query Parameters

| Parameter | Type   | Required | Description                    | Example               |
|-----------|--------|----------|--------------------------------|-----------------------|
| app       | string | Yes      | Server name                    | ERP-AIX                   |
| file      | string | Yes      | Exact filename from list-files | errpt_more_Wed...json |
| type      | string | Yes      | File format                    | json                  |
| table     | string | Yes      | Monitoring type                | errpt_more            |

### Complete URL Example

```
GET /get-file?app=ERP-AIX&file=errpt_more_Wed%20Jan%2028%2010:33:25%20THAIST%202026.json&type=json&table=errpt_more
```

**URL Encoding Required:**
```
Spaces     → %20
:          → %3A  (colon)
Parenthes  → %28 %29
```

### Response Format (Error Report Example)

**errpt_more Response:**
```json
{
  "system": {
    "hostname": "aix-erp-01",
    "log_type": "ERROR_REPORT_ERRPT"
  },
  "error_list": [
    {
      "identifier": "4865FA9B",
      "timestamp": "Wed Jan 28 01:32:00 THAIST 2026",
      "type": "P",
      "class": "H",
      "resource": "rmt0",
      "description": "TAPE OPERATION ERROR"
    },
    {
      "identifier": "C69F5C9B",
      "timestamp": "Mon Jan 19 10:01:00 THAIST 2026",
      "type": "P",
      "class": "S",
      "resource": "SYSPROC",
      "description": "SOFTWARE PROGRAM ABNORMALLY TERMINATED"
    },
    {
      "identifier": "3074FEB7",
      "timestamp": "Tue Dec 16 18:21:00 THAIST 2025",
      "type": "T",
      "class": "H",
      "resource": "fscsi1",
      "description": "ADAPTER ERROR"
    }
    // ... more errors
  ],
  "raw_stdout": "IDENTIFIER TIMESTAMP  T C RESOURCE_NAME  DESCRIPTION\n..."
}
```

**DF (Disk Free) Response:**
```json
{
  "system": {
    "hostname": "aix-erp-01"
  },
  "disk_usage": [
    {
      "filesystem": "/dev/hd1",
      "total": 1048576,
      "used": 890000,
      "available": 158576,
      "percent": "85%",
      "mounted_on": "/"
    },
    // ... more filesystems
  ]
}
```

**TOP (Process) Response:**
```json
{
  "system": {
    "hostname": "aix-erp-01",
    "cpus": 4,
    "uptime": "105 days, 14:32"
  },
  "summary": {
    "user_cpu": "5.2%",
    "system_cpu": "3.1%",
    "idle_cpu": "91.7%",
    "real_memory": "16.0G",
    "memory_used": "12.5G",
    "memory_percent": "78%"
  },
  "processes": [
    {
      "pid": "1234",
      "user": "oracle",
      "cpu_percent": "2.5",
      "memory_percent": "15.3",
      "command": "oracle@aix-erp-01 (LOCAL=NO)"
    },
    // ... more processes
  ]
}
```

### HTTP Status Codes

| Status | Meaning                              |
|--------|--------------------------------------|
| 200    | Success - returns complete JSON data |
| 500    | Invalid table name, file not found   |

### Data Structure by Table Type

#### Error Reports (errpt_more / errpt_a_more)

```javascript
// Error object properties:
{
  identifier: string    // Unique error code (hex: 8 chars)
  timestamp: string     // AIX timestamp format
  type: string          // P=Predictive, T=Temporary, I=Informational
  class: string         // H=Hardware, S=Software
  resource: string      // Affected device (rmt0, hdisk1, fscsi0, etc.)
  description: string   // Human-readable error message
}
```

#### Disk Usage (df)

```javascript
// Filesystem object:
{
  filesystem: string    // Device path (/dev/hd1, /dev/hd2, etc.)
  total: number         // Total size in MB
  used: number          // Used space in MB
  available: number     // Available space in MB
  percent: string       // Percentage string ("85%")
  mounted_on: string    // Mount point (/, /usr, /home, etc.)
}
```

#### Process Data (top)

```javascript
// Process object:
{
  pid: string           // Process ID
  user: string          // Process owner
  cpu_percent: string   // CPU usage percentage
  memory_percent: string// Memory usage percentage
  command: string       // Command/process name
}
```

#### Database Tablespace (tablespace)

```javascript
// Tablespace object:
{
  name: string          // Tablespace name
  total: number         // Total size in MB
  used: number          // Used space in MB
  available: number     // Available space in MB
  percent: string       // Percentage string ("75%")
}
```

### Frontend Implementation

```javascript
// In src/store/api.js or src/views/HomeView.jsx

const getFileData = async (serverName, fileName, tableName) => {
  // URL encode the filename
  const encodedFile = encodeURIComponent(fileName);
  
  try {
    const response = await fetch(
      `http://n8n.local:5678/webhook/api/v1/get-file?app=${serverName}&file=${encodedFile}&type=json&table=${tableName}`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch ${fileName}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching file: ${error.message}`);
    return null;
  }
};

// Usage:
const fileData = await getFileData(
  'ERP-AIX',
  'errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json',
  'errpt_more'
);

// fileData structure:
// {
//   system: { hostname: "aix-erp-01", log_type: "ERROR_REPORT_ERRPT" },
//   error_list: [...]
// }
```

---

## 🚨 Common Errors & Solutions

### Error 1: Invalid Table Name

**Symptom:**
```
Response: 500 {"message":"Error in workflow"}
```

**Causes:**
- Table name has capital letters (should be lowercase)
- Table name uses hyphens instead of underscores
- Table name has extra spaces
- Table doesn't exist for that server

**Solution:**
```javascript
// ❌ WRONG:
fetchFilesList('ERP-AIX', 'Errpt_More')     // Capital letters
fetchFilesList('ERP-AIX', 'errpt-more')     // Hyphens instead of underscores
fetchFilesList('ERP-AIX', 'errpt more')     // Spaces

// ✅ CORRECT:
fetchFilesList('ERP-AIX', 'errpt_more')     // Lowercase, underscores
fetchFilesList('ERP-AIX', 'errpt_a_more')   // Valid table name
```

### Error 2: Empty File List

**Symptom:**
```
Response: 200 []
```

**Meaning:**
- Table is valid, but no files have been collected yet
- Server may not have that monitoring type enabled
- Normal response (not an error!)

**Solution:**
```javascript
const files = await fetchFilesList('ERP-AIX', 'errpt_more');

if (files.length === 0) {
  console.log('No errpt_more files available yet');
  // Don't show error, show "No data" message
  return;
}

// Proceed with file selection
```

### Error 3: Filename Mismatch

**Symptom:**
```
Backend returns: "errpt_-a_more_Wed Jan 28.json"
Frontend expects: table='errpt_a_more'
Data doesn't load
```

**Explanation:**
- Backend filename uses hyphen: `errpt_-a_more_`
- Backend API table parameter is: `errpt_a_more` (no hyphen)
- This inconsistency is in backend, not frontend

**Solution (Already Fixed):**
```javascript
// When calling getFileData with advanced errors:
const fileData = await getFileData(
  'ERP-AIX',
  'errpt_-a_more_Wed Jan 28 10:33:25 THAIST 2026.json',  // From list-files response
  'errpt_a_more'  // Table parameter (without hyphen)
);
```

### Error 4: URL Encoding Issues

**Symptom:**
```
Filename with spaces doesn't work
404 or 500 error
```

**Solution:**
```javascript
// ✅ CORRECT - Use encodeURIComponent()
const fileName = 'errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json';
const encoded = encodeURIComponent(fileName);
const url = `/get-file?app=ERP-AIX&file=${encoded}&type=json&table=errpt_more`;

// ✅ ALSO CORRECT - Use URLSearchParams
const params = new URLSearchParams({
  app: 'ERP-AIX',
  file: 'errpt_more_Wed Jan 28 10:33:25 THAIST 2026.json',
  type: 'json',
  table: 'errpt_more'
});
const url = `/get-file?${params.toString()}`;
```

---

## 📊 API Response Times

### Typical Latencies

```
Operation                               Time
────────────────────────────────────   ────
list-files (empty response)             ~100ms
list-files (with data)                  ~150ms
get-file (small: < 100KB)               ~200ms
get-file (medium: 100KB-1MB)            ~300ms
get-file (large: > 1MB)                 ~500ms-1s

Total Home View Load (all servers):     ~2-3 seconds
Total Server View Load (initial):       ~1-2 seconds
File selection (from cache):            ~5-20ms
File selection (API call):              ~200-500ms
```

---

## 🔒 API Security & Best Practices

### Rate Limiting (if applicable)

```
Recommended rate limits:
• list-files: 60 calls/minute per server
• get-file: 30 calls/minute per server
```

### Caching Strategy

```javascript
// Implemented in src/store/apiCache.js

const apiCache = {
  cache: {},
  ttl: 300000, // 5 minutes
  
  set: (key, value) => {
    apiCache.cache[key] = {
      data: value,
      timestamp: Date.now(),
      ttl: apiCache.ttl
    };
  },
  
  get: (key) => {
    const item = apiCache.cache[key];
    if (!item) return null;
    
    const age = Date.now() - item.timestamp;
    if (age > item.ttl) {
      delete apiCache.cache[key];
      return null;
    }
    
    return item.data;
  }
};

// Usage:
const cached = apiCache.get('ERP-AIX-errpt_more-json');
if (cached) return cached; // Fast
else fetchFromAPI(); // Slower
```

### Error Handling

```javascript
// Comprehensive error handling:

const getFileDataSafely = async (serverName, fileName, tableName) => {
  try {
    // 1. Validate inputs
    if (!serverName || !fileName || !tableName) {
      console.error('Missing required parameters');
      return null;
    }
    
    // 2. Check cache first
    const cacheKey = `${serverName}-${tableName}-json`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;
    
    // 3. Make API call with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(
      `/get-file?app=${serverName}&file=${encodeURIComponent(fileName)}&type=json&table=${tableName}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeout);
    
    // 4. Handle response
    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // 5. Cache successful response
    apiCache.set(cacheKey, data);
    
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('API request timeout');
    } else {
      console.error(`API error: ${error.message}`);
    }
    return null;
  }
};
```

---

## 🧪 Testing API Endpoints

### Using curl (Terminal)

```bash
# List files
curl "http://n8n.local:5678/webhook/api/v1/list-files?app=ERP-AIX&table=errpt_more&type=json"

# Get file data
curl "http://n8n.local:5678/webhook/api/v1/get-file?app=ERP-AIX&file=errpt_more_Wed%20Jan%2028%2010%3A33%3A25%20THAIST%202026.json&type=json&table=errpt_more"
```

### Using Postman

1. Create new GET request
2. Enter URL: `http://n8n.local:5678/webhook/api/v1/list-files`
3. Add query parameters:
   - `app`: ERP-AIX
   - `table`: errpt_more
   - `type`: json
4. Send request
5. Check response in JSON viewer

### Using Browser DevTools

1. Open DevTools (F12)
2. Go to Network tab
3. Reload page
4. Look for requests to `list-files` or `get-file`
5. Click request to see:
   - Request URL (with parameters)
   - Request headers
   - Response body (JSON)
   - Response status
   - Response timing

---

## 📚 Related Files

- **Frontend Implementation:** [src/store/api.js](src/store/api.js)
- **Cache Layer:** [src/store/apiCache.js](src/store/apiCache.js)
- **Data Processing:** [src/views/ErrorReportView.jsx](src/views/ErrorReportView.jsx)
- **State Management:** [src/models/ServerModel.js](src/models/ServerModel.js)

---

**API Documentation Complete** ✅  
**Last Updated:** January 28, 2026  
**Version:** 1.0
