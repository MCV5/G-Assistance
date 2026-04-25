import type { Category } from "./types";

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
  categories?: string;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

const CATEGORY_KEYWORDS: { category: Category; words: string[]; shelfDays: number }[] = [
  { category: "Dairy", words: ["dairy", "milk", "cheese", "yogurt", "yoghurt", "butter", "cream"], shelfDays: 10 },
  { category: "Produce", words: ["fruit", "vegetable", "produce", "fresh"], shelfDays: 7 },
  { category: "Meat", words: ["meat", "beef", "pork", "chicken", "poultry", "fish", "seafood", "sausage"], shelfDays: 4 },
  { category: "Bakery", words: ["bread", "bakery", "pastr", "baguette", "bagel", "tortilla"], shelfDays: 7 },
  { category: "Beverages", words: ["beverag", "drink", "juice", "soda", "coffee", "tea", "water"], shelfDays: 60 },
  { category: "Frozen", words: ["frozen"], shelfDays: 120 },
  { category: "Snacks", words: ["snack", "chip", "cracker", "cookie", "candy", "chocolat", "biscuit"], shelfDays: 90 },
  { category: "Personal Care", words: ["cosmetic", "shampoo", "soap", "toothpaste", "deodorant", "hygiene"], shelfDays: 365 },
  { category: "Household", words: ["cleaner", "detergent", "household", "paper", "cleaning"], shelfDays: 999 },
  { category: "Pantry", words: ["pasta", "rice", "cereal", "sauce", "oil", "canned", "condiment", "spice", "flour", "sugar", "soup"], shelfDays: 365 },
];

function inferCategory(product: OpenFoodFactsProduct): { category: Category; shelfDays: number } {
  const haystack = [
    ...(product.categories_tags ?? []),
    product.categories ?? "",
    product.product_name ?? "",
    product.generic_name ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.words.some((w) => haystack.includes(w))) {
      return { category: entry.category, shelfDays: entry.shelfDays };
    }
  }
  return { category: "Other", shelfDays: 60 };
}

function parseQuantity(quantity?: string): { quantity: number; unit: string } {
  if (!quantity) return { quantity: 1, unit: "piece" };
  const trimmed = quantity.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|pack|ct|count)?/i);
  if (!match) return { quantity: 1, unit: "piece" };
  const qty = parseFloat(match[1]);
  let unit = (match[2] ?? "piece").toLowerCase();
  if (unit === "ct" || unit === "count") unit = "piece";
  return {
    quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit,
  };
}

export interface BarcodeLookupResult {
  found: boolean;
  name: string;
  brand?: string;
  category: Category;
  quantity: number;
  unit: string;
  estimatedShelfLifeDays: number;
  barcode: string;
}

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const cleaned = barcode.replace(/\D/g, "");
  if (!cleaned) {
    return {
      found: false,
      name: "",
      category: "Other",
      quantity: 1,
      unit: "piece",
      estimatedShelfLifeDays: 60,
      barcode,
    };
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${cleaned}.json?fields=product_name,product_name_en,generic_name,brands,quantity,categories_tags,categories`,
    );
    if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
    const data = (await res.json()) as OpenFoodFactsResponse;
    if (data.status !== 1 || !data.product) {
      return {
        found: false,
        name: "",
        category: "Other",
        quantity: 1,
        unit: "piece",
        estimatedShelfLifeDays: 60,
        barcode: cleaned,
      };
    }

    const p = data.product;
    const name =
      (p.product_name_en && p.product_name_en.trim()) ||
      (p.product_name && p.product_name.trim()) ||
      (p.generic_name && p.generic_name.trim()) ||
      "Unknown product";
    const { category, shelfDays } = inferCategory(p);
    const { quantity, unit } = parseQuantity(p.quantity);

    return {
      found: true,
      name,
      brand: p.brands?.split(",")[0]?.trim(),
      category,
      quantity,
      unit,
      estimatedShelfLifeDays: shelfDays,
      barcode: cleaned,
    };
  } catch {
    return {
      found: false,
      name: "",
      category: "Other",
      quantity: 1,
      unit: "piece",
      estimatedShelfLifeDays: 60,
      barcode: cleaned,
    };
  }
}
