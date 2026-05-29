import { inferFamily } from "./itemInsights";
import {
  computeAverageDaysBetweenPurchases,
  daysBetween,
  isReasonableCadence,
  MAX_REBUY_GAP_DAYS,
} from "./predictions";
import { resolveShelfLifeDays } from "./shelfLifeDefaults";
import type { PantryItem } from "./types";

export interface FamilyIntervalStats {
  family: string;
  medianDays: number;
  sampleCount: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

/** Collect days-between-restock signals per product family. */
export function buildFamilyIntervalMap(
  pantry: PantryItem[],
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();

  const push = (family: string, days: number) => {
    if (!isReasonableCadence(days)) return;
    const key = family.trim();
    if (!key) return;
    const arr = buckets.get(key) ?? [];
    arr.push(days);
    buckets.set(key, arr);
  };

  for (const item of pantry) {
    const family = inferFamily(item.name) ?? item.name.trim();
    const purchaseGap = computeAverageDaysBetweenPurchases(item.purchases);
    if (purchaseGap) push(family, purchaseGap);

    for (const rec of item.consumptionHistory ?? []) {
      const f = rec.family ?? family;
      push(f, rec.daysHeld);
    }

    if (item.purchases.length >= 2) {
      const sorted = [...item.purchases].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const gap = daysBetween(sorted[i - 1]!.date, sorted[i]!.date);
        if (gap > 0 && gap <= MAX_REBUY_GAP_DAYS) push(family, gap);
      }
    }
  }

  return buckets;
}

export function getFamilyIntervalStats(
  pantry: PantryItem[],
): FamilyIntervalStats[] {
  const map = buildFamilyIntervalMap(pantry);
  const out: FamilyIntervalStats[] = [];
  for (const [family, values] of map) {
    if (values.length === 0) continue;
    out.push({
      family,
      medianDays: median(values),
      sampleCount: values.length,
    });
  }
  out.sort((a, b) => b.sampleCount - a.sampleCount);
  return out;
}

export function getFamilyMedianDays(
  family: string,
  pantry: PantryItem[],
): number | null {
  const map = buildFamilyIntervalMap(pantry);
  const values = map.get(family);
  if (!values?.length) return null;
  return median(values);
}

/** Layer-1 personalized cycle for an item (family stats → item avg → shelf default). */
export function getPersonalCycleDays(
  item: PantryItem,
  pantry: PantryItem[],
  mutedFamilies: string[] = [],
): number {
  const family = inferFamily(item.name);
  if (family && mutedFamilies.includes(family)) {
    return resolveShelfLifeDays(
      item.category,
      item.name,
      item.estimatedShelfLifeDays,
    );
  }
  if (family) {
    const medianDays = getFamilyMedianDays(family, pantry);
    if (medianDays && medianDays >= 2) return medianDays;
  }
  if (isReasonableCadence(item.averageDaysBetweenPurchases)) {
    return item.averageDaysBetweenPurchases;
  }
  return resolveShelfLifeDays(
    item.category,
    item.name,
    item.estimatedShelfLifeDays,
  );
}
