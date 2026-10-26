import { BYTES_PER_MINUTE } from '@/constants/recording';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number, decimals = 0): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent >= 3 ? Math.max(decimals, 1) : decimals)} ${UNITS[exponent]}`;
}


export function estimateRecordingMinutes(freeBytes: number): number {
  return Math.floor(freeBytes / BYTES_PER_MINUTE);
}
