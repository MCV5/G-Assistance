import {
  getNutritionEstimate,
  type NutritionEstimate,
} from "@/lib/itemInsights";
import type { MacroNutrients, NutritionSnapshot, PantryItem } from "@/lib/types";

function fmtG(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n * 10) / 10;
  return `${r} g`;
}

function fmtKcal(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} kcal`;
}

function macrosToEstimate(m: MacroNutrients, note: string): NutritionEstimate {
  return {
    calories: fmtKcal(m.caloriesKcal),
    protein: fmtG(m.proteinG),
    carbs: fmtG(m.carbsG),
    fat: fmtG(m.fatG),
    fiber: fmtG(m.fiberG),
    note,
  };
}

export function nutritionPanelForItem(item: PantryItem): {
  title: string;
  estimate: NutritionEstimate;
  attribution?: string;
} {
  const snap = item.nutrition;
  if (snap?.perServing) {
    const basis = snap.servingDescription ?? "per serving";
    return {
      title: "NUTRITION (LABEL)",
      estimate: macrosToEstimate(
        snap.perServing,
        snap.note || `Values ${basis}.`,
      ),
      attribution:
        snap.source === "open_food_facts"
          ? "Open Food Facts"
          : snap.source === "usda_fdc"
            ? "USDA FoodData Central"
            : undefined,
    };
  }
  if (snap?.per100g) {
    return {
      title: "NUTRITION (LABEL)",
      estimate: macrosToEstimate(
        snap.per100g,
        snap.note || "Values per 100 g.",
      ),
      attribution:
        snap.source === "usda_fdc"
          ? "USDA FoodData Central"
          : snap.source === "open_food_facts"
            ? "Open Food Facts"
            : undefined,
    };
  }
  return {
    title: "GENERIC NUTRITION ESTIMATE",
    estimate: getNutritionEstimate(item),
  };
}

function normalizeMacros(
  m?: {
    caloriesKcal?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    fiberG?: number | null;
  } | null,
): MacroNutrients | undefined {
  if (!m) return undefined;
  return {
    caloriesKcal: m.caloriesKcal ?? null,
    proteinG: m.proteinG ?? null,
    carbsG: m.carbsG ?? null,
    fatG: m.fatG ?? null,
    fiberG: m.fiberG ?? null,
  };
}

export function snapshotFromLookupResponse(
  res: {
    matched: boolean;
    source: string;
    productName?: string;
    barcode?: string;
    fdcId?: number;
    per100g?: {
      caloriesKcal?: number | null;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
      fiberG?: number | null;
    };
    perServing?: {
      caloriesKcal?: number | null;
      proteinG?: number | null;
      carbsG?: number | null;
      fatG?: number | null;
      fiberG?: number | null;
    };
    servingDescription?: string;
    nutriScore?: string;
    note: string;
    fetchedAt: string;
  },
): NutritionSnapshot | null {
  if (!res.matched) return null;
  return {
    source:
      res.source === "open_food_facts" || res.source === "usda_fdc"
        ? res.source
        : "estimate",
    productName: res.productName,
    barcode: res.barcode,
    fdcId: res.fdcId,
    per100g: normalizeMacros(res.per100g),
    perServing: normalizeMacros(res.perServing),
    servingDescription: res.servingDescription,
    nutriScore: res.nutriScore,
    note: res.note,
    fetchedAt: res.fetchedAt,
  };
}
