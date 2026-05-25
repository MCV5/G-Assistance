import { getMyStore, putMyStore } from "@workspace/api-client-react";

import type {
  BehaviorMeta,
  PantryItem,
  ScanRecord,
  ShoppingListItem,
} from "./types";

const EMPTY_BEHAVIOR_META: BehaviorMeta = {
  cards: [],
  mutedFamilies: [],
};

export interface StoreSnapshot {
  pantry: PantryItem[];
  scans: ScanRecord[];
  shoppingList: ShoppingListItem[];
  behaviorMeta: BehaviorMeta;
}

export async function loadStore(): Promise<StoreSnapshot> {
  const data = await getMyStore();
  const rawMeta = (data as { behaviorMeta?: BehaviorMeta }).behaviorMeta;
  return {
    pantry: ((data.pantry ?? []) as unknown) as PantryItem[],
    scans: ((data.scans ?? []) as unknown) as ScanRecord[],
    shoppingList: ((data.shoppingList ?? []) as unknown) as ShoppingListItem[],
    behaviorMeta: rawMeta?.cards
      ? {
          cards: rawMeta.cards,
          mutedFamilies: rawMeta.mutedFamilies ?? [],
          generatedAt: rawMeta.generatedAt,
        }
      : EMPTY_BEHAVIOR_META,
  };
}

export async function saveStore(snapshot: StoreSnapshot): Promise<void> {
  await putMyStore({
    pantry: snapshot.pantry as unknown as Record<string, unknown>[],
    scans: snapshot.scans as unknown as Record<string, unknown>[],
    shoppingList: snapshot.shoppingList as unknown as Record<string, unknown>[],
    behaviorMeta: snapshot.behaviorMeta as unknown as Record<string, unknown>,
  });
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
