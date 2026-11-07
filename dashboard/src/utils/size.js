// Shared size parsing/formatting utilities

const KIB = 1024;
const MIB = KIB * 1024;
const GIB = MIB * 1024;
const TIB = GIB * 1024;

const toNumber = (value) => {
  if (value === null || value === undefined) {return null;}
  if (typeof value === 'number') {return Number.isFinite(value) ? value : null;}
  const text = String(value).trim();
  if (!text) {return null;}
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) {return null;}
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
};

export const parseSizeToBytes = (value) => {
  if (value === null || value === undefined) {return null;}

  if (typeof value === 'number') {
    // Assume caller already provided bytes.
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  if (!text) {return null;}

  // Accept formats like:
  // "10G", "10GB", "10 GiB", "512M", "512MB", "1024K", "1024KB", "1T", etc.
  const normalized = text.replace(/\s+/g, '').toUpperCase();
  const numberPart = toNumber(normalized);
  if (numberPart === null) {return null;}

  const unitMatch = normalized.match(/[A-Z]+$/);
  const unit = unitMatch ? unitMatch[0] : '';

  if (unit === 'T' || unit === 'TB' || unit === 'TIB') {return numberPart * TIB;}
  if (unit === 'G' || unit === 'GB' || unit === 'GIB') {return numberPart * GIB;}
  if (unit === 'M' || unit === 'MB' || unit === 'MIB') {return numberPart * MIB;}
  if (unit === 'K' || unit === 'KB' || unit === 'KIB') {return numberPart * KIB;}

  // No/unknown unit — try to treat as bytes.
  return numberPart;
};

export const formatBytes = (bytes, { decimals = 2 } = {}) => {
  if (!Number.isFinite(bytes)) {return 'N/A';}

  const abs = Math.abs(bytes);
  const sign = bytes < 0 ? '-' : '';

  if (abs >= TIB) {return `${sign}${(abs / TIB).toFixed(decimals)} TB`;}
  if (abs >= GIB) {return `${sign}${(abs / GIB).toFixed(decimals)} GB`;}
  if (abs >= MIB) {return `${sign}${(abs / MIB).toFixed(decimals)} MB`;}
  if (abs >= KIB) {return `${sign}${(abs / KIB).toFixed(decimals)} KB`;}
  return `${sign}${abs.toFixed(0)} B`;
};

export const formatFromMb = (mb, { decimals = 2 } = {}) => {
  if (!Number.isFinite(mb)) {return 'N/A';}
  return formatBytes(mb * MIB, { decimals });
};
