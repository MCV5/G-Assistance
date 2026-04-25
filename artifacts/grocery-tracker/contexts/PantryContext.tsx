import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ExtractedItem } from "@workspace/api-client-react";

import {
  computeAverageDaysBetweenPurchases,
  isPredictedNeeded,
} from "@/lib/predictions";
import { newId, storage } from "@/lib/storage";
import type {
  Category,
  PantryItem,
  ScanRecord,
  ScanSource,
  ShoppingListItem,
} from "@/lib/types";

interface PantryContextValue {
  pantry: PantryItem[];
  scans: ScanRecord[];
  shoppingList: ShoppingListItem[];
  loading: boolean;
  addScannedItems: (
    items: ExtractedItem[],
    sourceType: ScanSource,
    storeName?: string,
    purchaseDate?: string,
  ) => Promise<ScanRecord>;
  markConsumed: (id: string) => Promise<void>;
  unmarkConsumed: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refreshPredictions: () => Promise<void>;
  addManualShoppingItem: (name: string, category: Category) => Promise<void>;
  toggleShoppingItem: (id: string) => Promise<void>;
  removeShoppingItem: (id: string) => Promise<void>;
  clearCheckedShoppingItems: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const PantryContext = createContext<PantryContextValue | null>(null);

function rebuildPredictedShoppingList(
  pantry: PantryItem[],
  existing: ShoppingListItem[],
): ShoppingListItem[] {
  const manual = existing.filter((s) => s.reason === "manual");
  const checkedKeys = new Set(
    existing.filter((s) => s.checked).map((s) => `${s.pantryItemId ?? s.name}`),
  );

  const predicted: ShoppingListItem[] = pantry
    .filter((p) => isPredictedNeeded(p))
    .map((p) => {
      const key = p.id;
      const reason: ShoppingListItem["reason"] =
        p.consumed ? "expired" : "predicted";
      return {
        id: `pred_${p.id}`,
        name: p.name,
        category: p.category,
        reason,
        predictedAt: new Date().toISOString(),
        pantryItemId: p.id,
        checked: checkedKeys.has(key),
        createdAt: new Date().toISOString(),
      };
    });

  return [...predicted, ...manual];
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, s, l] = await Promise.all([
        storage.getPantry(),
        storage.getScans(),
        storage.getShoppingList(),
      ]);
      if (!active) return;
      setPantry(p);
      setScans(s);
      const refreshed = rebuildPredictedShoppingList(p, l);
      setShoppingList(refreshed);
      await storage.setShoppingList(refreshed);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persistPantry = useCallback(
    async (next: PantryItem[]) => {
      setPantry(next);
      await storage.setPantry(next);
      const refreshed = rebuildPredictedShoppingList(next, shoppingList);
      setShoppingList(refreshed);
      await storage.setShoppingList(refreshed);
    },
    [shoppingList],
  );

  const persistShopping = useCallback(async (next: ShoppingListItem[]) => {
    setShoppingList(next);
    await storage.setShoppingList(next);
  }, []);

  const addScannedItems = useCallback<PantryContextValue["addScannedItems"]>(
    async (items, sourceType, storeName, purchaseDate) => {
      const now = new Date().toISOString();
      const purchaseDateIso = purchaseDate ?? now;

      const next: PantryItem[] = [...pantry];

      for (const incoming of items) {
        const lowerName = incoming.name.trim().toLowerCase();
        const existingIdx = next.findIndex(
          (p) => p.name.trim().toLowerCase() === lowerName,
        );

        if (existingIdx >= 0) {
          const existing = next[existingIdx];
          const purchase = {
            date: purchaseDateIso,
            quantity: incoming.quantity,
            unit: incoming.unit,
            source: sourceType,
          };
          const purchases = [...existing.purchases, purchase];
          next[existingIdx] = {
            ...existing,
            quantity: existing.quantity + incoming.quantity,
            unit: incoming.unit || existing.unit,
            category: incoming.category as Category,
            estimatedShelfLifeDays:
              incoming.estimatedShelfLifeDays || existing.estimatedShelfLifeDays,
            lastPurchasedAt: purchaseDateIso,
            purchases,
            averageDaysBetweenPurchases:
              computeAverageDaysBetweenPurchases(purchases),
            consumed: false,
          };
        } else {
          const purchase = {
            date: purchaseDateIso,
            quantity: incoming.quantity,
            unit: incoming.unit,
            source: sourceType,
          };
          next.push({
            id: newId(),
            name: incoming.name.trim(),
            category: incoming.category as Category,
            quantity: incoming.quantity,
            unit: incoming.unit,
            estimatedShelfLifeDays: incoming.estimatedShelfLifeDays,
            firstSeenAt: now,
            lastPurchasedAt: purchaseDateIso,
            purchases: [purchase],
            averageDaysBetweenPurchases: null,
            consumed: false,
          });
        }
      }

      await persistPantry(next);

      const scan: ScanRecord = {
        id: newId(),
        scannedAt: now,
        sourceType,
        storeName,
        itemCount: items.length,
      };
      const nextScans = [scan, ...scans].slice(0, 100);
      setScans(nextScans);
      await storage.setScans(nextScans);

      return scan;
    },
    [pantry, persistPantry, scans],
  );

  const markConsumed = useCallback(
    async (id: string) => {
      const next = pantry.map((p) =>
        p.id === id ? { ...p, consumed: true } : p,
      );
      await persistPantry(next);
    },
    [pantry, persistPantry],
  );

  const unmarkConsumed = useCallback(
    async (id: string) => {
      const next = pantry.map((p) =>
        p.id === id ? { ...p, consumed: false } : p,
      );
      await persistPantry(next);
    },
    [pantry, persistPantry],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const next = pantry.filter((p) => p.id !== id);
      await persistPantry(next);
    },
    [pantry, persistPantry],
  );

  const refreshPredictions = useCallback(async () => {
    const refreshed = rebuildPredictedShoppingList(pantry, shoppingList);
    await persistShopping(refreshed);
  }, [pantry, persistShopping, shoppingList]);

  const addManualShoppingItem = useCallback(
    async (name: string, category: Category) => {
      const item: ShoppingListItem = {
        id: newId(),
        name: name.trim(),
        category,
        reason: "manual",
        checked: false,
        createdAt: new Date().toISOString(),
      };
      await persistShopping([...shoppingList, item]);
    },
    [persistShopping, shoppingList],
  );

  const toggleShoppingItem = useCallback(
    async (id: string) => {
      const next = shoppingList.map((s) =>
        s.id === id ? { ...s, checked: !s.checked } : s,
      );
      await persistShopping(next);
    },
    [persistShopping, shoppingList],
  );

  const removeShoppingItem = useCallback(
    async (id: string) => {
      await persistShopping(shoppingList.filter((s) => s.id !== id));
    },
    [persistShopping, shoppingList],
  );

  const clearCheckedShoppingItems = useCallback(async () => {
    await persistShopping(shoppingList.filter((s) => !s.checked));
  }, [persistShopping, shoppingList]);

  const resetAll = useCallback(async () => {
    await storage.clearAll();
    setPantry([]);
    setScans([]);
    setShoppingList([]);
  }, []);

  const value = useMemo<PantryContextValue>(
    () => ({
      pantry,
      scans,
      shoppingList,
      loading,
      addScannedItems,
      markConsumed,
      unmarkConsumed,
      removeItem,
      refreshPredictions,
      addManualShoppingItem,
      toggleShoppingItem,
      removeShoppingItem,
      clearCheckedShoppingItems,
      resetAll,
    }),
    [
      pantry,
      scans,
      shoppingList,
      loading,
      addScannedItems,
      markConsumed,
      unmarkConsumed,
      removeItem,
      refreshPredictions,
      addManualShoppingItem,
      toggleShoppingItem,
      removeShoppingItem,
      clearCheckedShoppingItems,
      resetAll,
    ],
  );

  return (
    <PantryContext.Provider value={value}>{children}</PantryContext.Provider>
  );
}

export function usePantry(): PantryContextValue {
  const ctx = useContext(PantryContext);
  if (!ctx) throw new Error("usePantry must be used inside PantryProvider");
  return ctx;
}
