import {
  computeAverageDaysBetweenPurchases,
  daysBetween,
  predictNextNeededDate,
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

export function getTopItems(pantry: PantryItem[], limit = 5): TopItem[] {
  return pantry
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      purchaseCount: p.purchases.length,
      cadenceDays: p.averageDaysBetweenPurchases,
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

export function getPredictedRestocks(
  pantry: PantryItem[],
  withinDays = 14,
): PredictedRestock[] {
  return pantry
    .map((item) => {
      const date = predictNextNeededDate(item);
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
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length < 2) continue;
    const mean =
      computeAverageDaysBetweenPurchases(item.purchases) ??
      gaps.reduce((s, g) => s + g, 0) / gaps.length;
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
