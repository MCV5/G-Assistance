import type { Category } from "./types";

/** Baseline shelf-life when scan/LLM estimate is missing (days). */
const CATEGORY_DAYS: Record<Category, number> = {
  Fruit: 7,
  Vegetables: 5,
  Dairy: 7,
  Meat: 5,
  Pantry: 90,
  Bakery: 5,
  Beverages: 30,
  Frozen: 60,
  Snacks: 30,
  Household: 180,
  "Personal Care": 180,
  Prepared: 4,
  Other: 14,
};

const BULK_STAPLE_PATTERN =
  /\brice\b|\bflour\b|\bsalt\b|\bpepper\b|\bolive oil\b|\bvegetable oil\b|\boil\b|\bsugar\b|\bpasta\b|\bbeans\b|\blentils\b/i;

/** Stable bulk staples decay by time-since-scan, not portions. */
export function isBulkStableItem(name: string): boolean {
  return BULK_STAPLE_PATTERN.test(name);
}

export function getDefaultShelfLifeDays(
  category: Category,
  name: string,
): number {
  if (isBulkStableItem(name)) return 45;
  return CATEGORY_DAYS[category] ?? 14;
}

export function resolveShelfLifeDays(
  category: Category,
  name: string,
  estimated?: number,
): number {
  if (estimated && estimated > 0) {
    if (isBulkStableItem(name) && estimated > 120) return 45;
    return estimated;
  }
  return getDefaultShelfLifeDays(category, name);
}
