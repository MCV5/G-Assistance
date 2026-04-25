import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PantryItem, ScanRecord, ShoppingListItem } from "./types";

const KEYS = {
  pantry: "@grocery_pantry_v1",
  scans: "@grocery_scans_v1",
  shoppingList: "@grocery_shopping_v1",
};

async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getPantry: () => getJson<PantryItem[]>(KEYS.pantry, []),
  setPantry: (items: PantryItem[]) => setJson(KEYS.pantry, items),

  getScans: () => getJson<ScanRecord[]>(KEYS.scans, []),
  setScans: (scans: ScanRecord[]) => setJson(KEYS.scans, scans),

  getShoppingList: () => getJson<ShoppingListItem[]>(KEYS.shoppingList, []),
  setShoppingList: (items: ShoppingListItem[]) => setJson(KEYS.shoppingList, items),

  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
