import { getMyStore, putMyStore } from "@workspace/api-client-react";

import type { PantryItem, ScanRecord, ShoppingListItem } from "./types";

export interface StoreSnapshot {
  pantry: PantryItem[];
  scans: ScanRecord[];
  shoppingList: ShoppingListItem[];
}

export async function loadStore(): Promise<StoreSnapshot> {
  const data = await getMyStore();
  return {
    pantry: ((data.pantry ?? []) as unknown) as PantryItem[],
    scans: ((data.scans ?? []) as unknown) as ScanRecord[],
    shoppingList: ((data.shoppingList ?? []) as unknown) as ShoppingListItem[],
  };
}

export async function saveStore(snapshot: StoreSnapshot): Promise<void> {
  await putMyStore({
    pantry: snapshot.pantry as unknown as Record<string, unknown>[],
    scans: snapshot.scans as unknown as Record<string, unknown>[],
    shoppingList: snapshot.shoppingList as unknown as Record<string, unknown>[],
  });
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
