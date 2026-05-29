import {
  computeAverageDaysBetweenPurchases,
  daysBetween,
  isReasonableCadence,
  predictNextNeededDate,
  purchaseRebuyGaps,
  type PredictionContext,
} from "./predictions";
import type { Category, PantryItem, ScanRecord } from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;

export interface InsightSummary {
  itemsBoughtThisWeek: number;
  itemsBoughtLastWeek: number;
  scansThisWeek: number;
  uniqueItemsTracked: number;
  itemsWithCadence: number;
  averageCadenceDays: number | null;
  weeklyChange: number;
}

export interface TopItem {
  id: string;
  name: string;
  category: Category;
  purchaseCount: number;
  cadenceDays: number | null;
}

export interface CategoryBreakdown {
  category: Category;
  count: number;
  share: number;
}

export interface PredictedRestock {
  id: string;
  name: string;
  category: Category;
  dueInDays: number;
  date: Date;
}

export interface CadenceVarianceItem {
  id: string;
  name: string;
  category: Category;
  cadenceDays: number;
  consistency: number;
}

function startOfWeekAgo(weeksAgo: number): number {
  const now = Date.now();
  return now - weeksAgo * 7 * DAY_MS;
}

export function computeSummary(
  pantry: PantryItem[],
  scans: ScanRecord[],
): InsightSummary {
  const weekAgo = startOfWeekAgo(1);
  const twoWeeksAgo = startOfWeekAgo(2);

  let itemsThisWeek = 0;
  let itemsLastWeek = 0;
  const cadences: number[] = [];

  for (const item of pantry) {
    for (const p of item.purchases) {
      const ts = new Date(p.date).getTime();
      if (ts >= weekAgo) itemsThisWeek += 1;
      else if (ts >= twoWeeksAgo) itemsLastWeek += 1;
    }
    if (item.averageDaysBetweenPurchases) {
      cadences.push(item.averageDaysBetweenPurchases);
    }
  }

  const scansThisWeek = scans.filter(
    (s) => new Date(s.scannedAt).getTime() >= weekAgo,
  ).length;

  const avgCadence =
    cadences.length > 0
      ? Math.round(
          cadences.reduce((sum, c) => sum + c, 0) / cadences.length,
        )
      : null;

  const weeklyChange =
    itemsLastWeek === 0
      ? itemsThisWeek > 0
        ? 100
        : 0
      : Math.round(((itemsThisWeek - itemsLastWeek) / itemsLastWeek) * 100);

  return {
    itemsBoughtThisWeek: itemsThisWeek,
    itemsBoughtLastWeek: itemsLastWeek,
    scansThisWeek,
    uniqueItemsTracked: pantry.length,
    itemsWithCadence: cadences.length,
    averageCadenceDays: avgCadence,
    weeklyChange,
  };
}

function rebuyCadenceDays(item: PantryItem): number | null {
  const gap =
    computeAverageDaysBetweenPurchases(item.purchases) ??
    item.averageDaysBetweenPurchases;
  return isReasonableCadence(gap) ? gap : null;
}

export function getTopItems(pantry: PantryItem[], limit = 5): TopItem[] {
  return pantry
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      purchaseCount: p.purchases.length,
      cadenceDays: rebuyCadenceDays(p),
    }))
    .filter((p) => p.purchaseCount > 0)
    .sort((a, b) => b.purchaseCount - a.purchaseCount)
    .slice(0, limit);
}

export function getCategoryBreakdown(
  pantry: PantryItem[],
): CategoryBreakdown[] {
  const counts = new Map<Category, number>();
  for (const item of pantry) {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  const total = pantry.length;
  return Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface ScanRhythm {
  totalScans: number;
  avgDaysBetween: number | null;
  lastScanDaysAgo: number | null;
  rhythmLine: string;
}

export function computeScanRhythm(scans: ScanRecord[]): ScanRhythm {
  const sorted = [...scans].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
  );
  const totalScans = sorted.length;
  if (totalScans === 0) {
    return {
      totalScans: 0,
      avgDaysBetween: null,
      lastScanDaysAgo: null,
      rhythmLine: "Scan a receipt to learn how often you shop.",
    };
  }

  const lastScanDaysAgo = Math.floor(
    (Date.now() - new Date(sorted[0]!.scannedAt).getTime()) / DAY_MS,
  );
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = daysBetween(sorted[i + 1]!.scannedAt, sorted[i]!.scannedAt);
    if (gap > 0) gaps.push(gap);
  }
  const avgDaysBetween =
    gaps.length > 0
      ? Math.round(gaps.reduce((sum, g) => sum + g, 0) / gaps.length)
      : null;

  let rhythmLine: string;
  if (avgDaysBetween != null && avgDaysBetween <= 10) {
    rhythmLine = `You shop about every ${avgDaysBetween} day${avgDaysBetween === 1 ? "" : "s"} on average.`;
  } else if (avgDaysBetween != null) {
    rhythmLine = `You usually restock every ~${avgDaysBetween} days.`;
  } else if (lastScanDaysAgo === 0) {
    rhythmLine = "Last shop was today.";
  } else {
    rhythmLine = `Last shop was ${lastScanDaysAgo} day${lastScanDaysAgo === 1 ? "" : "s"} ago.`;
  }

  return { totalScans, avgDaysBetween, lastScanDaysAgo, rhythmLine };
}

export function getNutritionLabelCoverage(pantry: PantryItem[]): {
  total: number;
  labeled: number;
} {
  const active = pantry.filter(
    (p) =>
      !p.consumed &&
      p.category !== "Household" &&
      p.category !== "Personal Care",
  );
  const labeled = active.filter(
    (p) =>
      p.nutrition &&
      p.nutrition.source !== "estimate" &&
      (p.nutrition.perServing || p.nutrition.per100g),
  ).length;
  return { total: active.length, labeled };
}

function inferFamilyLabel(name: string): string | null {
  const lower = name.toLowerCase();
  if (
    lower.includes("salad") ||
    lower.includes("coleslaw") ||
    lower.includes("slaw")
  ) {
    return "Salads";
  }
  if (lower.includes("milk")) return "Milk";
  if (lower.includes("bread") || lower.includes("pita")) return "Bread";
  return null;
}

export type GroupedRestock = {
  id: string;
  label: string;
  category: Category;
  count: number;
  dueInDays: number;
};

export function groupPredictedRestocks(
  restocks: PredictedRestock[],
): GroupedRestock[] {
  const groups = new Map<string, GroupedRestock>();

  for (const item of restocks) {
    const family = inferFamilyLabel(item.name);
    const key = `${item.category}:${family ?? item.name}`;
    const label = family ?? item.name;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        label,
        category: item.category,
        count: 1,
        dueInDays: item.dueInDays,
      });
      continue;
    }

    existing.count += 1;
    existing.dueInDays = Math.min(existing.dueInDays, item.dueInDays);
  }

  return [...groups.values()].sort((a, b) => a.dueInDays - b.dueInDays);
}

export function getPredictedRestocks(
  pantry: PantryItem[],
  withinDays = 14,
  ctx: PredictionContext = {},
): PredictedRestock[] {
  return pantry
    .filter((p) => !p.consumed)
    .map((item) => {
      const date = predictNextNeededDate(item, ctx);
      const dueInDays = daysBetween(new Date(), date);
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        dueInDays,
        date,
      };
    })
    .filter((p) => p.dueInDays <= withinDays)
    .sort((a, b) => a.dueInDays - b.dueInDays)
    .slice(0, 8);
}

export function getMostPredictable(
  pantry: PantryItem[],
  limit = 5,
): CadenceVarianceItem[] {
  const candidates: CadenceVarianceItem[] = [];

  for (const item of pantry) {
    if (item.purchases.length < 3) continue;
    const sorted = [...item.purchases].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const gaps = purchaseRebuyGaps(item.purchases);
    if (gaps.length < 2) continue;
    const mean =
      computeAverageDaysBetweenPurchases(item.purchases) ??
      gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (!isReasonableCadence(mean)) continue;
    const variance =
      gaps.reduce((acc, g) => acc + Math.pow(g - mean, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(
      0,
      Math.min(100, Math.round((1 - stdDev / Math.max(mean, 1)) * 100)),
    );
    candidates.push({
      id: item.id,
      name: item.name,
      category: item.category,
      cadenceDays: Math.round(mean),
      consistency,
    });
  }

  return candidates
    .sort((a, b) => b.consistency - a.consistency)
    .slice(0, limit);
}
