import type { Category, PantryItem } from "./types";
import { getDaysUntilNeeded, getItemStatus } from "./predictions";

// ─── Family inference ─────────────────────────────────────────────────────────

const FAMILY_RULES: Array<{ test: RegExp; label: string }> = [
  { test: /salad|coleslaw|slaw/i, label: "Salads" },
  { test: /\bmilk\b|oat milk|almond milk|soy milk/i, label: "Milk" },
  { test: /bread|loaf|baguette|pita|tortilla|wrap/i, label: "Bread" },
  { test: /\byogurt\b|yoghurt/i, label: "Yogurt" },
  { test: /\bjuice\b/i, label: "Juice" },
  { test: /\begg(s)?\b/i, label: "Eggs" },
  { test: /\bcheese\b/i, label: "Cheese" },
  { test: /\bchicken\b/i, label: "Chicken" },
  { test: /\bbeef\b|\bsteak\b|\bground beef\b/i, label: "Beef" },
  { test: /\bpasta\b|\bnoodle(s)?\b/i, label: "Pasta" },
  { test: /\brice\b/i, label: "Rice" },
  { test: /\bwater\b/i, label: "Water" },
  { test: /\bsoda\b|\bdrink\b|\bbeverage\b/i, label: "Drinks" },
  { test: /\bchips?\b|\bcrisp(s)?\b/i, label: "Chips" },
  { test: /\bcookie(s)?\b|\bbiscuit(s)?\b/i, label: "Cookies" },
];

export function inferFamily(name: string): string | null {
  for (const rule of FAMILY_RULES) {
    if (rule.test.test(name)) return rule.label;
  }
  return null;
}

// ─── Running-low priority scoring ────────────────────────────────────────────

const STATUS_WEIGHT: Record<string, number> = {
  expired: 100,
  overdue: 80,
  due: 50,
  "running-low": 20,
  fresh: 0,
};

export interface LowItem {
  kind: "single";
  item: PantryItem;
  score: number;
}

export interface LowGroup {
  kind: "group";
  label: string;
  count: number;
  category: Category;
  soonestDays: number;
  score: number;
  members: PantryItem[];
}

export type LowSignal = LowItem | LowGroup;

export function buildRunningLowSignals(
  active: PantryItem[],
  maxRows = 4,
): LowSignal[] {
  const lowItems = active.filter((p) => {
    const s = getItemStatus(p);
    return s !== "fresh";
  });

  // Group by family
  const families = new Map<string, PantryItem[]>();
  const singles: PantryItem[] = [];

  for (const item of lowItems) {
    const fam = inferFamily(item.name);
    if (fam) {
      const existing = families.get(fam) ?? [];
      existing.push(item);
      families.set(fam, existing);
    } else {
      singles.push(item);
    }
  }

  const signals: LowSignal[] = [];

  // Singles
  for (const item of singles) {
    const status = getItemStatus(item);
    const days = getDaysUntilNeeded(item);
    const baseScore = STATUS_WEIGHT[status] ?? 0;
    const daysPenalty = Math.max(0, 10 - days);
    signals.push({ kind: "single", item, score: baseScore + daysPenalty });
  }

  // Groups — only emit as group when 2+ items, otherwise as single
  for (const [label, members] of families) {
    if (members.length === 1) {
      const item = members[0];
      const status = getItemStatus(item);
      const days = getDaysUntilNeeded(item);
      const baseScore = STATUS_WEIGHT[status] ?? 0;
      signals.push({ kind: "single", item, score: baseScore + Math.max(0, 10 - days) });
      continue;
    }
    const soonestDays = Math.min(...members.map((m) => getDaysUntilNeeded(m)));
    const topStatus = members
      .map((m) => getItemStatus(m))
      .sort((a, b) => (STATUS_WEIGHT[b] ?? 0) - (STATUS_WEIGHT[a] ?? 0))[0];
    const baseScore = STATUS_WEIGHT[topStatus] ?? 0;
    const countBonus = Math.min(members.length * 3, 15);
    const daysPenalty = Math.max(0, 10 - soonestDays);
    signals.push({
      kind: "group",
      label,
      count: members.length,
      category: members[0].category,
      soonestDays,
      score: baseScore + daysPenalty + countBonus,
      members,
    });
  }

  return signals
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRows);
}

// ─── Generic nutrition estimate ───────────────────────────────────────────────

export interface NutritionEstimate {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  note: string;
}

const CATEGORY_NUTRITION: Record<Category, NutritionEstimate> = {
  Fruit: {
    calories: "~65 kcal",
    protein: "~1 g",
    carbs: "~16 g",
    fat: "<1 g",
    fiber: "~3 g",
    note: "Natural sugars, vitamins C & A, antioxidants.",
  },
  Vegetables: {
    calories: "~35 kcal",
    protein: "~2 g",
    carbs: "~7 g",
    fat: "<1 g",
    fiber: "~3 g",
    note: "High micronutrient density. Great for fiber intake.",
  },
  Dairy: {
    calories: "~130 kcal",
    protein: "~7 g",
    carbs: "~11 g",
    fat: "~6 g",
    fiber: "0 g",
    note: "Good source of calcium and vitamin D.",
  },
  Meat: {
    calories: "~215 kcal",
    protein: "~27 g",
    carbs: "0 g",
    fat: "~11 g",
    fiber: "0 g",
    note: "Complete protein source. Iron and B12.",
  },
  Pantry: {
    calories: "~200 kcal",
    protein: "~5 g",
    carbs: "~32 g",
    fat: "~5 g",
    fiber: "~2 g",
    note: "Check label for added sugar and sodium.",
  },
  Bakery: {
    calories: "~185 kcal",
    protein: "~5 g",
    carbs: "~31 g",
    fat: "~4 g",
    fiber: "~2 g",
    note: "Whole grain options offer more fiber.",
  },
  Beverages: {
    calories: "~60 kcal",
    protein: "0 g",
    carbs: "~14 g",
    fat: "0 g",
    fiber: "0 g",
    note: "Prefer unsweetened options. Water is always best.",
  },
  Frozen: {
    calories: "~200 kcal",
    protein: "~9 g",
    carbs: "~25 g",
    fat: "~7 g",
    fiber: "~2 g",
    note: "Often preserves nutrients well. Watch sodium content.",
  },
  Snacks: {
    calories: "~175 kcal",
    protein: "~3 g",
    carbs: "~22 g",
    fat: "~9 g",
    fiber: "~2 g",
    note: "Treat as occasional. Nuts/seeds are healthier picks.",
  },
  Household: {
    calories: "—",
    protein: "—",
    carbs: "—",
    fat: "—",
    fiber: "—",
    note: "Non-food item — no nutrition data.",
  },
  "Personal Care": {
    calories: "—",
    protein: "—",
    carbs: "—",
    fat: "—",
    fiber: "—",
    note: "Non-food item — no nutrition data.",
  },
  Prepared: {
    calories: "~400 kcal",
    protein: "~16 g",
    carbs: "~40 g",
    fat: "~16 g",
    fiber: "~2 g",
    note: "Ready-to-eat. Sodium content often higher.",
  },
  Other: {
    calories: "—",
    protein: "—",
    carbs: "—",
    fat: "—",
    fiber: "—",
    note: "Check the product label for accurate values.",
  },
};

const NAME_NUTRITION_OVERRIDES: Array<{
  test: RegExp;
  patch: Partial<NutritionEstimate>;
}> = [
  {
    test: /\begg(s)?\b/i,
    patch: {
      calories: "~70 kcal",
      protein: "~6 g",
      fat: "~5 g",
      carbs: "<1 g",
      note: "Complete protein. Vitamins B12, D, choline.",
    },
  },
  {
    test: /\bchicken\b/i,
    patch: {
      calories: "~165 kcal",
      protein: "~31 g",
      fat: "~4 g",
      carbs: "0 g",
      note: "Lean protein. Excellent for muscle maintenance.",
    },
  },
  {
    test: /\bsalmon\b|\btrout\b|\btuna\b/i,
    patch: {
      calories: "~180 kcal",
      protein: "~25 g",
      fat: "~8 g",
      carbs: "0 g",
      note: "Omega-3 fatty acids. Heart-health benefit.",
    },
  },
  {
    test: /\bgreek yogurt\b|\bgreek yoghurt\b/i,
    patch: {
      calories: "~100 kcal",
      protein: "~10 g",
      fat: "~2 g",
      carbs: "~8 g",
      note: "High protein dairy. Probiotic benefit.",
    },
  },
  {
    test: /\bwhole wheat\b|\bwholemeal\b/i,
    patch: { fiber: "~4 g", note: "Whole grain — better fiber than white options." },
  },
  {
    test: /\bavocado\b/i,
    patch: {
      calories: "~160 kcal",
      fat: "~15 g",
      note: "Healthy monounsaturated fats. Potassium-rich.",
    },
  },
];

export function getNutritionEstimate(item: PantryItem): NutritionEstimate {
  let base: NutritionEstimate = {
    ...CATEGORY_NUTRITION[item.category],
  };

  for (const override of NAME_NUTRITION_OVERRIDES) {
    if (override.test.test(item.name)) {
      base = { ...base, ...override.patch };
    }
  }

  return base;
}

// ─── Insight contribution text ────────────────────────────────────────────────

export function getInsightContribution(item: PantryItem): string {
  const cat = item.category;
  if (cat === "Fruit" || cat === "Vegetables") {
    return "Boosts your fresh & fiber score in Insights.";
  }
  if (cat === "Meat") {
    return "Counts toward your protein sources in Insights.";
  }
  if (cat === "Dairy") {
    return "Tracked as a whole-food protein source in Insights.";
  }
  if (cat === "Prepared") {
    return "Counted as a convenience food — balancing with fresh items improves your health score.";
  }
  if (cat === "Snacks") {
    return "Tracked as convenience. Fewer snacks = higher health score.";
  }
  if (cat === "Bakery") {
    const isWhole = /whole wheat|wholemeal|whole grain/i.test(item.name);
    return isWhole
      ? "Whole grain — contributes positively to your fiber score."
      : "Refined grain — minimal impact on health score.";
  }
  if (cat === "Beverages") {
    return "Tracked. Unsweetened beverages don't affect your health score.";
  }
  if (cat === "Pantry") {
    return "Pantry staple — neutral impact on your health score.";
  }
  if (cat === "Frozen") {
    return "Frozen items are tracked by category for freshness diversity.";
  }
  return "Tracked in your pantry. More data improves insight accuracy.";
}
