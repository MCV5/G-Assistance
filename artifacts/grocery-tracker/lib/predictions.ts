import type { ItemStatus, PantryItem, Purchase } from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;

export function daysBetween(a: string | Date, b: string | Date): number {
  const ad = typeof a === "string" ? new Date(a) : a;
  const bd = typeof b === "string" ? new Date(b) : b;
  return Math.round((bd.getTime() - ad.getTime()) / DAY_MS);
}

export function computeAverageDaysBetweenPurchases(
  purchases: Purchase[],
): number | null {
  if (purchases.length < 2) return null;
  const sorted = [...purchases].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return null;
  const sum = gaps.reduce((acc, g) => acc + g, 0);
  return Math.round(sum / gaps.length);
}

export function predictNextNeededDate(item: PantryItem): Date {
  const last = new Date(item.lastPurchasedAt);
  const cycle =
    item.averageDaysBetweenPurchases ?? item.estimatedShelfLifeDays;
  return new Date(last.getTime() + cycle * DAY_MS);
}

export function getDaysUntilNeeded(item: PantryItem): number {
  const next = predictNextNeededDate(item);
  return daysBetween(new Date(), next);
}

export function getItemStatus(item: PantryItem): ItemStatus {
  if (item.consumed) return "expired";
  const days = getDaysUntilNeeded(item);
  if (days < -3) return "expired";
  if (days <= 0) return "overdue";
  if (days <= 2) return "due";
  if (days <= 5) return "running-low";
  return "fresh";
}

export function getStatusLabel(status: ItemStatus): string {
  switch (status) {
    case "fresh":
      return "Fresh";
    case "running-low":
      return "Running low";
    case "due":
      return "Due soon";
    case "overdue":
      return "Restock now";
    case "expired":
      return "Likely gone";
  }
}

export function isPredictedNeeded(item: PantryItem): boolean {
  const status = getItemStatus(item);
  return (
    status === "due" ||
    status === "overdue" ||
    status === "expired" ||
    status === "running-low"
  );
}

export function summarizeCadence(item: PantryItem): string {
  if (item.averageDaysBetweenPurchases) {
    const d = item.averageDaysBetweenPurchases;
    if (d <= 2) return "Bought every couple of days";
    if (d <= 9) return `Bought about every ${d} days`;
    if (d <= 16) return "Bought about weekly";
    if (d <= 24) return "Bought every couple of weeks";
    if (d <= 45) return "Bought about monthly";
    return `Bought every ~${Math.round(d / 30)} months`;
  }
  return `Estimated shelf life: ${item.estimatedShelfLifeDays} days`;
}
