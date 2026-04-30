import type { Category, PantryItem, ScanRecord } from "./types";

export type InsightBarMetric = {
  key: string;
  label: string;
  value: number;
  invert?: boolean;
};

export type InsightSpotlight = {
  id: string;
  name: string;
  category: Category;
};

export type InsightConfidence = {
  label: "High confidence" | "Medium confidence" | "Low confidence";
  note: string;
};

export type InsightModel = {
  score: number;
  scoreDelta: number;
  freshShare: number;
  freshDelta: number;
  preparedShare: number;
  preparedDelta: number;
  organicShare: number;
  organicDelta: number;
  variety: number;
  bars: InsightBarMetric[];
  benefits: string[];
  spotlight: InsightSpotlight[];
  action: string;
  confidence: InsightConfidence;
};

const WHOLE_FOOD = new Set<Category>(["Fruit", "Vegetables"]);
const PROTEIN_SRC = new Set<Category>(["Meat", "Dairy"]);

const BENEFIT_BY_CATEGORY: Partial<Record<Category, string[]>> = {
  Fruit: ["Fiber", "Antioxidants"],
  Vegetables: ["Fiber", "Vitamin C"],
  Dairy: ["Calcium", "Protein"],
  Meat: ["Protein", "Iron"],
  Pantry: ["Whole grains"],
  Prepared: ["Quick meals"],
};

function clampPct(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeCategory(raw: string): Category {
  return raw === "Produce" ? "Vegetables" : (raw as Category);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

function addCount(map: Map<Category, number>, category: Category) {
  map.set(category, (map.get(category) ?? 0) + 1);
}

function windowCategoryCounts(
  pantry: PantryItem[],
  start: Date,
  end: Date,
): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const item of pantry) {
    for (const purchase of item.purchases) {
      const ts = new Date(purchase.date);
      if (ts >= start && ts < end) {
        addCount(counts, normalizeCategory(item.category));
      }
    }
  }
  return counts;
}

function windowOrganicShare(pantry: PantryItem[], start: Date, end: Date): number {
  let total = 0;
  let organic = 0;
  for (const item of pantry) {
    for (const purchase of item.purchases) {
      const ts = new Date(purchase.date);
      if (ts >= start && ts < end) {
        total += 1;
        if (item.isOrganic) organic += 1;
      }
    }
  }
  return total === 0 ? 0 : organic / total;
}

function liveOrganicShare(pantry: PantryItem[]): number {
  const active = pantry.filter((p) => !p.consumed);
  if (active.length === 0) return 0;
  const organic = active.filter((p) => p.isOrganic).length;
  return organic / active.length;
}

function liveCategoryCounts(pantry: PantryItem[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const item of pantry) {
    if (item.consumed) continue;
    addCount(counts, normalizeCategory(item.category));
  }
  return counts;
}

function summarize(counts: Map<Category, number>) {
  const total = [...counts.values()].reduce((acc, v) => acc + v, 0);
  const safeTotal = Math.max(1, total);
  const share = (cats: Set<Category>) =>
    [...counts.entries()].reduce((acc, [cat, count]) => (cats.has(cat) ? acc + count : acc), 0) /
    safeTotal;
  const one = (cat: Category) => (counts.get(cat) ?? 0) / safeTotal;

  const freshShare = share(WHOLE_FOOD);
  const proteinShare = share(PROTEIN_SRC);
  const preparedShare = one("Prepared");
  const snackShare = one("Snacks");
  const variety = counts.size;

  const score = clampPct(
    100 *
      (0.43 * freshShare +
        0.22 * proteinShare +
        0.2 * (1 - preparedShare) +
        0.15 * Math.min(variety / 8, 1) -
        0.08 * snackShare),
  );

  return { score, freshShare, proteinShare, preparedShare, snackShare, variety, total };
}

function trendDelta(current: number, previous: number) {
  return Math.round((current - previous) * 100);
}

function buildBenefits(counts: Map<Category, number>) {
  const total = Math.max(1, [...counts.values()].reduce((acc, v) => acc + v, 0));
  const benefits = new Set<string>();
  for (const [category, count] of counts) {
    if (count / total < 0.08) continue;
    const tags = BENEFIT_BY_CATEGORY[category];
    if (!tags) continue;
    for (const t of tags) benefits.add(t);
  }
  return [...benefits].slice(0, 8);
}

function buildSpotlight(pantry: PantryItem[]): InsightSpotlight[] {
  const active = pantry.filter((p) => !p.consumed);
  const now = Date.now();
  return [...active]
    .map((item) => {
      const recencyDays = (now - new Date(item.lastPurchasedAt).getTime()) / 86400000;
      const purchaseCount = Math.max(1, item.purchases.length);
      const category = normalizeCategory(item.category);
      const categoryWeight =
        category === "Vegetables" || category === "Fruit"
          ? 1.3
          : category === "Meat" || category === "Dairy"
            ? 1.15
            : 1;
      const recencyWeight = Math.max(0.2, 1.5 - recencyDays / 14);
      const score = purchaseCount * categoryWeight * recencyWeight;
      return { item, score, category };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ item, category }) => ({
      id: item.id,
      name: item.name,
      category,
    }));
}

function actionFromSummary(summary: ReturnType<typeof summarize>) {
  if (summary.freshShare < 0.3) {
    return "Add 2 produce items this week to raise your whole-food score.";
  }
  if (summary.preparedShare > 0.3) {
    return "Swap one prepared item for a whole-food option this week.";
  }
  if (summary.proteinShare < 0.2) {
    return "Add one protein source (eggs, yogurt, fish, or beans) this week.";
  }
  if (summary.snackShare > 0.22) {
    return "Replace one snack run with fruit or nuts this week.";
  }
  return "Keep this rhythm. Add one colorful produce item this week.";
}

function confidence(scans: ScanRecord[], pantry: PantryItem[]): InsightConfidence {
  const last30 = daysAgo(30).getTime();
  const recentScans = scans.filter((s) => new Date(s.scannedAt).getTime() >= last30).length;
  const recurringItems = pantry.filter((p) => p.purchases.length >= 2).length;

  if (recentScans >= 6 && recurringItems >= 6) {
    return {
      label: "High confidence",
      note: "Based on strong recent scan activity and repeat purchase patterns.",
    };
  }
  if (recentScans >= 3 && recurringItems >= 3) {
    return {
      label: "Medium confidence",
      note: "Based on moderate recent scan activity and repeat purchase patterns.",
    };
  }
  return {
    label: "Low confidence",
    note: "Add a few more scans for more stable nutrition insights.",
  };
}

export function buildInsightModel(pantry: PantryItem[], scans: ScanRecord[]): InsightModel {
  const now = new Date();
  const currentStart = daysAgo(7);
  const previousStart = daysAgo(14);
  const previousEnd = currentStart;

  const currentCounts = windowCategoryCounts(pantry, currentStart, now);
  const previousCounts = windowCategoryCounts(pantry, previousStart, previousEnd);
  const liveCounts = liveCategoryCounts(pantry);

  const currentBase = currentCounts.size > 0 ? currentCounts : liveCounts;
  const current = summarize(currentBase);
  const previous = summarize(previousCounts);
  const currentOrganicRaw =
    currentCounts.size > 0
      ? windowOrganicShare(pantry, currentStart, now)
      : liveOrganicShare(pantry);
  const previousOrganicRaw = windowOrganicShare(pantry, previousStart, previousEnd);

  const bars: InsightBarMetric[] = [
    { key: "whole", label: "Whole foods", value: current.freshShare * 100 },
    { key: "protein", label: "Protein sources", value: current.proteinShare * 100 },
    {
      key: "fiber",
      label: "Fiber-friendly",
      value:
        (current.freshShare * 0.8 + ((currentBase.get("Pantry") ?? 0) / Math.max(1, current.total)) * 0.2) *
        100,
    },
    {
      key: "convenience",
      label: "Convenience foods",
      value: (current.preparedShare + current.snackShare * 0.6) * 100,
      invert: true,
    },
  ];

  return {
    score: current.score,
    scoreDelta: current.score - previous.score,
    freshShare: clampPct(current.freshShare * 100),
    freshDelta: trendDelta(current.freshShare, previous.freshShare),
    preparedShare: clampPct(current.preparedShare * 100),
    preparedDelta: trendDelta(current.preparedShare, previous.preparedShare),
    organicShare: clampPct(currentOrganicRaw * 100),
    organicDelta: trendDelta(currentOrganicRaw, previousOrganicRaw),
    variety: current.variety,
    bars,
    benefits: buildBenefits(currentBase),
    spotlight: buildSpotlight(pantry),
    action: actionFromSummary(current),
    confidence: confidence(scans, pantry),
  };
}

