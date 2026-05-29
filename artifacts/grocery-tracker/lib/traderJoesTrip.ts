import type { Category, PantryItem, ScanRecord } from "./types";

/** Phase A — US Trader Joe's trip prep (links only, no scraping). */
export const TRADER_JOES_REGION = "Philadelphia area" as const;
export const TRADER_JOES_STORE_FINDER_ZIP = "19103";

export const TRADER_JOES_LINKS = {
  whatsNew: "https://www.traderjoes.com/home/products/new",
  fearlessFlyer: "https://www.traderjoes.com/home/ff",
  storeFinder: `https://www.traderjoes.com/home/store-search?zip=${TRADER_JOES_STORE_FINDER_ZIP}`,
} as const;

const TJ_NAME_RE =
  /\btrader\s*joe'?s?\b|\btj'?s\b/i;

export function isTraderJoesStoreName(name: string | undefined | null): boolean {
  if (!name?.trim()) return false;
  return TJ_NAME_RE.test(name.trim());
}

export function countTraderJoesScans(scans: ScanRecord[]): number {
  return scans.filter((s) => isTraderJoesStoreName(s.storeName)).length;
}

/** Show TJ card when user has scanned at least one TJ receipt. */
export function isTraderJoesShopper(scans: ScanRecord[]): boolean {
  return countTraderJoesScans(scans) > 0;
}

function categoryCounts(pantry: PantryItem[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const item of pantry) {
    if (item.consumed) continue;
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }
  return counts;
}

const DISCOVERY_BY_CATEGORY: Partial<Record<Category, string>> = {
  Snacks: "snacks & treats",
  Frozen: "freezer finds",
  Beverages: "drinks",
  Dairy: "dairy & cheese",
  Fruit: "produce",
  Vegetables: "produce",
  Bakery: "bakery",
  Prepared: "ready-to-eat",
  Pantry: "pantry staples",
};

export function traderJoesDiscoveryHint(pantry: PantryItem[]): string {
  const top = [...categoryCounts(pantry).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => DISCOVERY_BY_CATEGORY[cat] ?? cat.toLowerCase());

  if (top.length === 0) {
    return "See what's new before your next run.";
  }
  if (top.length === 1) {
    return `You stock a lot of ${top[0]} — browse new ${top[0]} on your next trip.`;
  }
  return `You often buy ${top[0]} and ${top[1]} — see what's new this month.`;
}

export type TraderJoesHomeCard = {
  show: boolean;
  hint: string;
  scanCount: number;
};

export function buildTraderJoesHomeCard(
  scans: ScanRecord[],
  pantry: PantryItem[],
): TraderJoesHomeCard {
  const scanCount = countTraderJoesScans(scans);
  if (scanCount === 0) {
    return { show: false, hint: "", scanCount: 0 };
  }
  return {
    show: true,
    hint: traderJoesDiscoveryHint(pantry),
    scanCount,
  };
}
