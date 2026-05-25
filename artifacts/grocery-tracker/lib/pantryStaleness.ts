import type { ScanRecord } from "./types";

export const STALE_SCAN_DAYS = 10;

export function getDaysSinceLastScan(scans: ScanRecord[]): number | null {
  const latest = scans[0];
  if (!latest?.scannedAt) return null;
  const ms = Date.now() - new Date(latest.scannedAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isPantryStale(scans: ScanRecord[]): boolean {
  const days = getDaysSinceLastScan(scans);
  if (days === null) return false;
  return days > STALE_SCAN_DAYS;
}
