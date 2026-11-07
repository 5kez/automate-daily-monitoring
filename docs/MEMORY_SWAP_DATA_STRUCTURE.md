# Memory and Swap Data Structure Reference

## Overview
This document details the exact memory and swap data structures used throughout the application, including extraction logic, field names, and data transformations.

---

## 1. Source Data Structure: `parsed_top`

The raw parsed data from the backend API comes in the `parsed_top` object with the following memory and swap fields:

### Memory Fields (in `parsed_top.memory`)
- `total` - Total memory in KB
- `used` - Used memory in KB
- `free` - Free memory in KB
- `shared` - Shared memory in KB
- `buffer` - Buffer memory in KB
- `cache` - Cache memory in KB

### Swap Fields (in `parsed_top.swap`)
- `total` - Total swap in KB
- `used` - Used swap in KB
- `free` - Free swap in KB

---

## 2. Data Extraction and Transformation

### Location
**File:** [src/models/ServerModel.js](src/models/ServerModel.js#L1035-L1120)  
**Method:** `loadSelectedTopFileData()`

### Extraction Process

#### Memory Data Mapping (Lines 1091-1102)
```javascript
const memoryData = parsedData.memory ? {
  total: parseInt(parsedData.memory.total) || 0,
  used: parseInt(parsedData.memory.used) || 0,
  free: parseInt(parsedData.memory.free) || 0,
  shared: parseInt(parsedData.memory.shared) || 0,
  buffer: parseInt(parsedData.memory.buffer) || 0,
  cache: parseInt(parsedData.memory.cache) || 0,
  // Add _kb versions for compatibility with view
  total_kb: parseInt(parsedData.memory.total) || 0,
  used_kb: parseInt(parsedData.memory.used) || 0,
  free_kb: parseInt(parsedData.memory.free) || 0,
  buffers_kb: parseInt(parsedData.memory.buffer) || 0
} : null;
```

**Key Points:**
- All values are converted from string to integer using `parseInt()`
- Default value of 0 is used if field is missing or cannot be parsed
- Fields are stored in KB (Kilobytes)
- Both regular and `_kb` suffix versions are provided for compatibility

#### Swap Data Mapping (Lines 1106-1113)
```javascript
const swapData = parsedData.swap ? {
  total: parseInt(parsedData.swap.total) || 0,
  used: parseInt(parsedData.swap.used) || 0,
  free: parseInt(parsedData.swap.free) || 0,
  // Add _kb versions for compatibility with view
  total_kb: parseInt(parsedData.swap.total) || 0,
  used_kb: parseInt(parsedData.swap.used) || 0,
  free_kb: parseInt(parsedData.swap.free) || 0
} : null;
```

**Key Points:**
- Simpler structure than memory (no shared, buffer, cache)
- All values in KB
- Both regular and `_kb` suffix versions provided
- Default value of 0 for missing fields

---

## 3. Final Data Structure

### In `selectedTopFileData` Object
After transformation, the data is stored as:

```javascript
this.selectedTopFileData = {
  // ... other fields
  memory: memoryData,      // Memory object with fields described above
  swap: swapData,          // Swap object with fields described above
  // ... other fields
}
```

---

## 4. Unit Conversion Logic

### No Explicit Conversion in Extraction
The extraction logic uses `parseInt()` to parse string values but **does NOT perform unit conversion**. All values remain in **KB (Kilobytes)**.

### Display-Time Conversion
The actual display conversion happens in the view components. For example, in [src/views/StatsView.jsx](src/views/StatsView.jsx#L948-L949):

```javascript
const ramUsedPct = clamp(percentOf(memory?.used_kb, memory?.total_kb), 0, 100);
const swapUsedPct = clamp(percentOf(swap?.used_kb, swap?.total_kb), 0, 100);
```

The `formatBytesWithUnit()` function handles KB to MB/GB conversion for display.

---

## 5. References Throughout the Application

### Memory Data References

**File:** [src/models/ServerModel.js](src/models/ServerModel.js#L1091-L1102)
- Primary extraction and mapping logic

**File:** [src/views/HomeView.jsx](src/views/HomeView.jsx#L182)
- Used in memory assignment: `memory: parsedData.memory,`

**File:** [src/views/AIXSystemView.jsx](src/views/AIXSystemView.jsx#L1431)
- Memory display: `<MemoryCard memory={parsedData.memory} ... />`

**File:** [src/views/StatsView.jsx](src/views/StatsView.jsx#L945-L949)
- Memory usage calculation from `response?.parsed_top?.memory`

### Swap Data References

**File:** [src/models/ServerModel.js](src/models/ServerModel.js#L1106-L1113)
- Primary extraction and mapping logic

**File:** [src/views/HomeView.jsx](src/views/HomeView.jsx#L183)
- Used in swap assignment: `swap: parsedData.swap,`

**File:** [src/views/AIXSystemView.jsx](src/views/AIXSystemView.jsx#L900-902)
- For AIX data: `const paging = response?.parsed_data?.paging || response?.paging || {}`

**File:** [src/views/StatsView.jsx](src/views/StatsView.jsx#L946-L949)
- Swap usage calculation from `response?.parsed_top?.swap`

---

## 6. AIX vs Linux Data Structures

### Linux Format (parsed_top)
```javascript
parsedData.memory = {
  total: number,      // in KB
  used: number,       // in KB
  free: number,       // in KB
  shared: number,     // in KB
  buffer: number,     // in KB
  cache: number       // in KB
}

parsedData.swap = {
  total: number,      // in KB
  used: number,       // in KB
  free: number        // in KB
}
```

### AIX Format (parsed_data)
**File:** [src/views/AIXSystemView.jsx](src/views/AIXSystemView.jsx#L882-906)

```javascript
memory = {
  total_mb: number,       // in MB
  free_ram_mb: number,    // in MB
  // Used calculated as: total_mb - free_ram_mb
}

paging = {
  size_mb: number,        // in MB
  used_pct: number        // percentage
}
```

**Key Difference:** AIX data uses MB (Megabytes) and percentages, while Linux uses KB.

---

## 7. Data Transformation Summary

| Aspect | Source | Transform | Storage | Unit |
|--------|--------|-----------|---------|------|
| **Memory Total** | `parsedData.memory.total` | `parseInt(value)` | `memory.total` and `memory.total_kb` | KB |
| **Memory Used** | `parsedData.memory.used` | `parseInt(value)` | `memory.used` and `memory.used_kb` | KB |
| **Memory Free** | `parsedData.memory.free` | `parseInt(value)` | `memory.free` and `memory.free_kb` | KB |
| **Memory Shared** | `parsedData.memory.shared` | `parseInt(value)` | `memory.shared` | KB |
| **Memory Buffer** | `parsedData.memory.buffer` | `parseInt(value)` | `memory.buffer` and `memory.buffers_kb` | KB |
| **Memory Cache** | `parsedData.memory.cache` | `parseInt(value)` | `memory.cache` | KB |
| **Swap Total** | `parsedData.swap.total` | `parseInt(value)` | `swap.total` and `swap.total_kb` | KB |
| **Swap Used** | `parsedData.swap.used` | `parseInt(value)` | `swap.used` and `swap.used_kb` | KB |
| **Swap Free** | `parsedData.swap.free` | `parseInt(value)` | `swap.free` and `swap.free_kb` | KB |

---

## 8. Error Handling

All field extractions use the **fallback pattern**:
```javascript
parseInt(parsedData.memory.field) || 0
```

This ensures:
- If field is missing → defaults to 0
- If value cannot be parsed → defaults to 0
- Prevents application crashes from malformed data

---

## 9. Field Name Quick Reference

### For Linux/parsed_top Data
**Memory object fields:**
- `total`, `used`, `free`, `shared`, `buffer`, `cache`
- `total_kb`, `used_kb`, `free_kb`, `buffers_kb`

**Swap object fields:**
- `total`, `used`, `free`
- `total_kb`, `used_kb`, `free_kb`

### For AIX/parsed_data Data
**Memory object fields:**
- `total_mb`, `free_ram_mb`

**Paging object fields:**
- `size_mb`, `used_pct`

---

## 10. Access Paths in Components

### Direct from Model
```javascript
// Linux format
const memory = selectedTopFileData.memory;        // Memory object
const swap = selectedTopFileData.swap;            // Swap object

// AIX format
const memory = data.parsed_data.memory;           // Memory object
const paging = data.parsed_data.paging;          // Paging object
```

### Via parsed_top
```javascript
// After API response
const topData = response?.parsed_top;
const memory = topData?.memory;
const swap = topData?.swap;
```

### Usage in Calculations
```javascript
// Percentage calculations
const memoryUsedPct = (memory.used_kb / memory.total_kb) * 100;
const swapUsedPct = (swap.used_kb / swap.total_kb) * 100;
```

---

## 11. File Location Summary

| Component | File | Line Range |
|-----------|------|-----------|
| Extraction Logic | `src/models/ServerModel.js` | 1035-1120 |
| HomeView Usage | `src/views/HomeView.jsx` | 160-190 |
| AIXSystemView Usage | `src/views/AIXSystemView.jsx` | 882-906, 1431 |
| StatsView Usage | `src/views/StatsView.jsx` | 82-83, 848, 945-949 |
| ProcessesView Usage | `src/views/ProcessesView.jsx` | 32 |

---

## Conclusion

The memory and swap data follows a consistent pattern:
1. **Source:** `parsed_top.memory` and `parsed_top.swap` from API
2. **Extraction:** All string values are parsed to integers
3. **Unit:** All values stored in KB (Kilobytes)
4. **Compatibility:** Both regular and `_kb` suffix versions provided
5. **Display:** Views handle unit conversion for presentation
6. **Error Handling:** All fields default to 0 if missing/invalid
