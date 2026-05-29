export type Category =
  | "Fruit"
  | "Vegetables"
  | "Dairy"
  | "Meat"
  | "Pantry"
  | "Bakery"
  | "Beverages"
  | "Frozen"
  | "Snacks"
  | "Household"
  | "Personal Care"
  | "Prepared"
  | "Other";

export const CATEGORIES: Category[] = [
  "Fruit",
  "Vegetables",
  "Dairy",
  "Meat",
  "Pantry",
  "Bakery",
  "Beverages",
  "Frozen",
  "Snacks",
  "Household",
  "Personal Care",
  "Prepared",
  "Other",
];

export type ScanSource = "receipt" | "bag" | "cart" | "barcode";

export interface Purchase {
  date: string;
  quantity: number;
  unit: string;
  source: ScanSource | "manual";
}

/** Logged when an item cycle ends (rescan replace, confirmed out, etc.). */
export interface ConsumptionRecord {
  endedAt: string;
  daysHeld: number;
  reason: "replaced" | "confirmed_out" | "wasted";
  family: string | null;
  category: Category;
}

export type BulkStockLevel = "full" | "low" | "empty";

export interface MacroNutrients {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
}

export type NutritionSource = "open_food_facts" | "usda_fdc" | "estimate";

export interface NutritionSnapshot {
  source: NutritionSource;
  productName?: string;
  barcode?: string;
  fdcId?: number;
  per100g?: MacroNutrients;
  perServing?: MacroNutrients;
  servingDescription?: string;
  nutriScore?: string;
  note: string;
  fetchedAt: string;
}

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  isOrganic?: boolean;
  organicConfidence?: number;
  organicSource?: "label" | "name_keyword" | "manual";
  quantity: number;
  unit: string;
  estimatedShelfLifeDays: number;
  firstSeenAt: string;
  lastPurchasedAt: string;
  purchases: Purchase[];
  averageDaysBetweenPurchases: number | null;
  consumed: boolean;
  wasWasted?: boolean;
  wastedAt?: string;
  purchaseCount?: number;
  /** User tapped "still have" — resets prediction clock. */
  lastConfirmedAt?: string;
  consumptionHistory?: ConsumptionRecord[];
  /** Bulk staples (rice, flour): simple stock override. */
  stockLevel?: BulkStockLevel;
  barcode?: string;
  nutrition?: NutritionSnapshot;
}

export interface ScanRecord {
  id: string;
  scannedAt: string;
  sourceType: ScanSource;
  storeName?: string;
  itemCount: number;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: Category;
  reason: "predicted" | "manual" | "expired";
  predictedAt?: string;
  pantryItemId?: string;
  checked: boolean;
  createdAt: string;
}

export type ItemStatus = "fresh" | "running-low" | "due" | "overdue" | "expired";

export type BehaviorCardType =
  | "forgot_staple"
  | "confirm_exhaustion"
  | "soft_reminder"
  | "diet_shift";

export interface BehaviorCard {
  id: string;
  type: BehaviorCardType;
  title: string;
  message: string;
  family?: string;
  itemName?: string;
  pantryItemId?: string;
  confidence: number;
}

export interface BehaviorMeta {
  generatedAt?: string;
  cards: BehaviorCard[];
  mutedFamilies: string[];
}
