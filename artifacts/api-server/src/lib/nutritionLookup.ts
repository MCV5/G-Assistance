/**
 * Nutrition lookup: Open Food Facts (barcode) + USDA FoodData Central (name search).
 * Keys: USDA_FDC_API_KEY (required for USDA), OFF needs no key.
 */

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

export interface MacroNutrients {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export interface NutritionLookupResult {
  matched: boolean;
  source: "open_food_facts" | "usda_fdc" | "none";
  productName?: string;
  barcode?: string;
  fdcId?: number;
  per100g?: MacroNutrients;
  perServing?: MacroNutrients;
  servingDescription?: string;
  nutriScore?: string;
  note: string;
}

function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function formatMacros(m: MacroNutrients): string {
  const cal = m.caloriesKcal != null ? `${round1(m.caloriesKcal)} kcal` : "—";
  const p = m.proteinG != null ? `${round1(m.proteinG)} g` : "—";
  const c = m.carbsG != null ? `${round1(m.carbsG)} g` : "—";
  const f = m.fatG != null ? `${round1(m.fatG)} g` : "—";
  const fib = m.fiberG != null ? `${round1(m.fiberG)} g` : "—";
  return `${cal} · P ${p} · C ${c} · F ${f} · Fiber ${fib}`;
}

export function macrosFromOffNutriments(
  n: Record<string, number | string | undefined>,
  suffix: "100g" | "serving",
): MacroNutrients | null {
  const num = (key: string): number | null => {
    const v = n[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const p = parseFloat(v);
      return Number.isFinite(p) ? p : null;
    }
    return null;
  };
  const caloriesKcal =
    num(`energy-kcal_${suffix}`) ??
    (num(`energy_${suffix}`) != null ? (num(`energy_${suffix}`)! / 4.184) : null);
  const proteinG = num(`proteins_${suffix}`);
  const carbsG = num(`carbohydrates_${suffix}`);
  const fatG = num(`fat_${suffix}`);
  const fiberG = num(`fiber_${suffix}`);
  if (
    caloriesKcal == null &&
    proteinG == null &&
    carbsG == null &&
    fatG == null
  ) {
    return null;
  }
  return { caloriesKcal, proteinG, carbsG, fatG, fiberG };
}

/** USDA FoodData Central nutrient IDs */
const FDC_NUTRIENT = {
  energyKcal: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
} as const;

function macrosFromFdcFood(food: {
  foodNutrients?: Array<{
    nutrientId?: number;
    nutrientNumber?: string;
    value?: number;
  }>;
}): MacroNutrients | null {
  const nutrients = food.foodNutrients ?? [];
  const byId = new Map<number, number>();
  for (const row of nutrients) {
    if (row.nutrientId != null && typeof row.value === "number") {
      byId.set(row.nutrientId, row.value);
    }
  }
  const pick = (id: number) => {
    const v = byId.get(id);
    return v != null && Number.isFinite(v) ? v : null;
  };
  const caloriesKcal = pick(FDC_NUTRIENT.energyKcal);
  const proteinG = pick(FDC_NUTRIENT.protein);
  const fatG = pick(FDC_NUTRIENT.fat);
  const carbsG = pick(FDC_NUTRIENT.carbs);
  const fiberG = pick(FDC_NUTRIENT.fiber);
  if (
    caloriesKcal == null &&
    proteinG == null &&
    carbsG == null &&
    fatG == null
  ) {
    return null;
  }
  return { caloriesKcal, proteinG, carbsG, fatG, fiberG };
}

async function lookupOpenFoodFacts(
  barcode: string,
): Promise<NutritionLookupResult | null> {
  const cleaned = barcode.replace(/\D/g, "");
  if (!cleaned) return null;

  const fields = [
    "product_name",
    "product_name_en",
    "brands",
    "nutriments",
    "nutrition_grades",
    "serving_size",
  ].join(",");
  const url = `${OFF_BASE}/${cleaned}?fields=${fields}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Goalcery/1.0 (pantry app)" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_en?: string;
      brands?: string;
      nutriments?: Record<string, number | string>;
      nutrition_grades?: string;
      serving_size?: string;
    };
  };
  if (data.status !== 1 || !data.product?.nutriments) return null;

  const p = data.product;
  const name =
    p.product_name_en?.trim() ||
    p.product_name?.trim() ||
    undefined;
  const nutriments = p.nutriments ?? {};
  const perServing = macrosFromOffNutriments(nutriments, "serving");
  const per100g = macrosFromOffNutriments(nutriments, "100g");
  const macros = perServing ?? per100g;
  if (!macros) return null;

  const basis = perServing ? "per serving" : "per 100g";
  return {
    matched: true,
    source: "open_food_facts",
    productName: name,
    barcode: cleaned,
    per100g: per100g ?? undefined,
    perServing: perServing ?? undefined,
    servingDescription: p.serving_size?.trim() || basis,
    nutriScore: p.nutrition_grades?.trim(),
    note: `Label data from Open Food Facts (${basis}). ${formatMacros(macros)}`,
  };
}

async function usdaSearch(
  query: string,
  apiKey: string,
): Promise<{ fdcId: number; description: string } | null> {
  const url = new URL(`${FDC_BASE}/foods/search`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("dataType", "Branded,Foundation,SR Legacy");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    foods?: Array<{ fdcId?: number; description?: string }>;
  };
  const top = data.foods?.[0];
  if (!top?.fdcId) return null;
  return { fdcId: top.fdcId, description: top.description ?? query };
}

async function usdaFoodDetail(
  fdcId: number,
  apiKey: string,
): Promise<MacroNutrients | null> {
  const url = new URL(`${FDC_BASE}/food/${fdcId}`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const food = (await res.json()) as {
    description?: string;
    foodNutrients?: Array<{ nutrientId?: number; value?: number }>;
  };
  return macrosFromFdcFood(food);
}

async function lookupUsda(
  productName: string,
  apiKey: string,
): Promise<NutritionLookupResult | null> {
  const hit = await usdaSearch(productName, apiKey);
  if (!hit) return null;
  const macros = await usdaFoodDetail(hit.fdcId, apiKey);
  if (!macros) return null;

  return {
    matched: true,
    source: "usda_fdc",
    productName: hit.description,
    fdcId: hit.fdcId,
    per100g: macros,
    note: `USDA FoodData Central (per 100g). ${formatMacros(macros)}`,
  };
}

export async function lookupNutrition(input: {
  barcode?: string;
  productName?: string;
}): Promise<NutritionLookupResult> {
  const barcode = input.barcode?.replace(/\D/g, "");
  const name = input.productName?.trim();

  if (barcode) {
    const off = await lookupOpenFoodFacts(barcode);
    if (off?.matched) return off;
  }

  const apiKey = process.env.USDA_FDC_API_KEY?.trim();
  if (name && apiKey) {
    const usda = await lookupUsda(name, apiKey);
    if (usda?.matched) return usda;
  }

  if (name && !apiKey) {
    return {
      matched: false,
      source: "none",
      note: "USDA API key not configured on server. Add USDA_FDC_API_KEY to Render.",
    };
  }

  return {
    matched: false,
    source: "none",
    note: barcode
      ? "No barcode match in Open Food Facts and no USDA name to search."
      : "No product name provided for nutrition lookup.",
  };
}

export function isUsdaConfigured(): boolean {
  return Boolean(process.env.USDA_FDC_API_KEY?.trim());
}
