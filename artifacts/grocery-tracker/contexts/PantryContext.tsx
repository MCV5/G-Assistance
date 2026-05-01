import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ExtractedItem } from "@workspace/api-client-react";

import { useAuth } from "@/lib/auth";
import {
  computeAverageDaysBetweenPurchases,
  isPredictedNeeded,
} from "@/lib/predictions";
import { coerceCategory } from "@/lib/guessCategory";
import { loadStore, newId, saveStore, type StoreSnapshot } from "@/lib/storage";
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
  markWasted: (id: string) => Promise<void>;
  unmarkConsumed: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refreshPredictions: () => Promise<void>;
  addManualPantryItem: (name: string, category: Category) => Promise<void>;
  addManualShoppingItem: (name: string, category: Category) => Promise<void>;
  toggleShoppingItem: (id: string) => Promise<void>;
  removeShoppingItem: (id: string) => Promise<void>;
  clearCheckedShoppingItems: () => Promise<void>;
  resetAll: () => Promise<void>;
}

const PantryContext = createContext<PantryContextValue | null>(null);

function shoppingDedupeKey(name: string, category: Category): string {
  return `${name.trim().toLowerCase()}|${category}`;
}

function rebuildPredictedShoppingList(
  pantry: PantryItem[],
  existing: ShoppingListItem[],
): ShoppingListItem[] {
  const manual = existing.filter((s) => s.reason === "manual");
  const manualKeys = new Set(
    manual.map((s) => shoppingDedupeKey(s.name, s.category)),
  );
  const checkedKeys = new Set(
    existing
      .filter((s) => s.checked)
      .map((s) =>
        s.pantryItemId ? s.pantryItemId : shoppingDedupeKey(s.name, s.category),
      ),
  );

  const predicted: ShoppingListItem[] = pantry
    .filter((p) => isPredictedNeeded(p))
    .filter((p) => !manualKeys.has(shoppingDedupeKey(p.name, p.category)))
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

  const merged = [...predicted, ...manual];
  merged.sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    if (a.reason !== b.reason)
      return a.reason === "predicted" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return merged;
}

export function PantryProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const stateRef = useRef<StoreSnapshot>({
    pantry: [],
    scans: [],
    shoppingList: [],
  });
  stateRef.current = { pantry, scans, shoppingList };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canSaveRef = useRef(false);

  const queueSave = useCallback(() => {
    if (!canSaveRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStore(stateRef.current).catch((err) => {
        console.warn("Failed to sync store:", err);
      });
    }, 350);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    canSaveRef.current = false;

    if (!isAuthenticated) {
      setPantry([]);
      setScans([]);
      setShoppingList([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await loadStore();
        if (!active) return;
        const refreshed = rebuildPredictedShoppingList(
          data.pantry,
          data.shoppingList,
        );
        setPantry(data.pantry);
        setScans(data.scans);
        setShoppingList(refreshed);
        canSaveRef.current = true;
        if (
          JSON.stringify(refreshed) !== JSON.stringify(data.shoppingList)
        ) {
          queueSave();
        }
      } catch (err) {
        console.warn("Failed to load store:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [isAuthenticated, authLoading, user?.id, queueSave]);

  const persistPantry = useCallback(
    async (next: PantryItem[]) => {
      setPantry(next);
      setShoppingList((cur) => rebuildPredictedShoppingList(next, cur));
      queueSave();
    },
    [queueSave],
  );

  const persistShopping = useCallback(
    async (next: ShoppingListItem[]) => {
      setShoppingList(next);
      queueSave();
    },
    [queueSave],
  );

  const addScannedItems = useCallback<PantryContextValue["addScannedItems"]>(
    async (items, sourceType, storeName, purchaseDate) => {
      const now = new Date().toISOString();
      const purchaseDateIso = purchaseDate ?? now;

      const next: PantryItem[] = [...pantry];

      for (const incoming of items) {
        const cat = coerceCategory(incoming.name, incoming.category);
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
            category: cat,
            isOrganic: incoming.isOrganic ?? existing.isOrganic,
            organicConfidence:
              incoming.organicConfidence ?? existing.organicConfidence,
            organicSource: incoming.organicSource ?? existing.organicSource,
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
            category: cat,
            isOrganic: incoming.isOrganic,
            organicConfidence: incoming.organicConfidence,
            organicSource: incoming.organicSource,
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

      const scan: ScanRecord = {
        id: newId(),
        scannedAt: now,
        sourceType,
        storeName,
        itemCount: items.length,
      };
      const nextScans = [scan, ...scans].slice(0, 100);

      setPantry(next);
      setScans(nextScans);
      setShoppingList((cur) => rebuildPredictedShoppingList(next, cur));
      queueSave();

      return scan;
    },
    [pantry, scans, queueSave],
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

  const markWasted = useCallback(
    async (id: string) => {
      const next = pantry.map((p) =>
        p.id === id
          ? { ...p, consumed: true, wasWasted: true, wastedAt: new Date().toISOString() }
          : p,
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

  const addManualPantryItem = useCallback(
    async (name: string, category: Category) => {
      const now = new Date().toISOString();
      const existing = pantry.find(
        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (existing) {
        const next = pantry.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                quantity: p.quantity + 1,
                lastPurchasedAt: now,
                purchases: [
                  ...p.purchases,
                  { date: now, quantity: 1, unit: p.unit || "unit", source: "manual" as const },
                ],
                consumed: false,
              }
            : p,
        );
        await persistPantry(next);
      } else {
        const item: PantryItem = {
          id: newId(),
          name: name.trim(),
          category,
          quantity: 1,
          unit: "unit",
          estimatedShelfLifeDays: 7,
          firstSeenAt: now,
          lastPurchasedAt: now,
          purchases: [{ date: now, quantity: 1, unit: "unit", source: "manual" }],
          averageDaysBetweenPurchases: null,
          consumed: false,
        };
        await persistPantry([...pantry, item]);
      }
    },
    [pantry, persistPantry],
  );

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
      await persistShopping(
        rebuildPredictedShoppingList(pantry, [...shoppingList, item]),
      );
    },
    [pantry, persistShopping, shoppingList],
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
      const filtered = shoppingList.filter((s) => s.id !== id);
      await persistShopping(rebuildPredictedShoppingList(pantry, filtered));
    },
    [pantry, persistShopping, shoppingList],
  );

  const clearCheckedShoppingItems = useCallback(async () => {
    const filtered = shoppingList.filter((s) => !s.checked);
    await persistShopping(rebuildPredictedShoppingList(pantry, filtered));
  }, [pantry, persistShopping, shoppingList]);

  const resetAll = useCallback(async () => {
    setPantry([]);
    setScans([]);
    setShoppingList([]);
    queueSave();
  }, [queueSave]);

  const value = useMemo<PantryContextValue>(
    () => ({
      pantry,
      scans,
      shoppingList,
      loading,
      addScannedItems,
      markConsumed,
      markWasted,
      unmarkConsumed,
      removeItem,
      refreshPredictions,
      addManualPantryItem,
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
      markWasted,
      unmarkConsumed,
      removeItem,
      refreshPredictions,
      addManualPantryItem,
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
