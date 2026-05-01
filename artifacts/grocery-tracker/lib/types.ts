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
