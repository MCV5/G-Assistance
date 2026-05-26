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
import { REQUIRE_EMAIL_VERIFICATION } from "@/lib/features";
import { appendConsumptionRecord } from "@/lib/consumptionHistory";
import {
  fetchBehaviorInsight,
  shouldRefreshBehaviorInsight,
} from "@/lib/behaviorInsights";
import { fetchNutritionForItem } from "@/lib/nutritionApi";
import { makePredictionContext } from "@/lib/predictionContext";
import {
  computeAverageDaysBetweenPurchases,
  isPredictedNeeded,
  type PredictionContext,
} from "@/lib/predictions";
import { coerceCategory } from "@/lib/guessCategory";
import { resolveShelfLifeDays } from "@/lib/shelfLifeDefaults";
import { loadStore, newId, saveStore, type StoreSnapshot } from "@/lib/storage";
import type {
  BehaviorMeta,
  BulkStockLevel,
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
  behaviorMeta: BehaviorMeta;
  predictionCtx: PredictionContext;
  loading: boolean;
  refreshBehaviorInsights: (
    latestScanItemNames?: string[],
    force?: boolean,
  ) => Promise<void>;
  dismissBehaviorCard: (cardId: string) => void;
  addScannedItems: (
    items: ExtractedItem[],
    sourceType: ScanSource,
    storeName?: string,
    purchaseDate?: string,
    options?: { barcode?: string },
  ) => Promise<ScanRecord>;
  enrichNutritionForItems: (itemIds: string[], barcode?: string) => Promise<void>;
  markConsumed: (id: string) => Promise<void>;
  markWasted: (id: string) => Promise<void>;
  unmarkConsumed: (id: string) => Promise<void>;
  confirmStillHave: (id: string) => Promise<void>;
  confirmOut: (id: string) => Promise<void>;
  setStockLevel: (id: string, level: BulkStockLevel) => Promise<void>;
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
  ctx: PredictionContext = {},
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
    .filter((p) => isPredictedNeeded(p, ctx))
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
  const [behaviorMeta, setBehaviorMeta] = useState<BehaviorMeta>({
    cards: [],
    mutedFamilies: [],
  });
  const [loading, setLoading] = useState(true);

  const predictionCtx = useMemo(
    () => makePredictionContext(pantry, behaviorMeta.mutedFamilies),
    [pantry, behaviorMeta.mutedFamilies],
  );

  const stateRef = useRef<StoreSnapshot>({
    pantry: [],
    scans: [],
    shoppingList: [],
    behaviorMeta: { cards: [], mutedFamilies: [] },
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = { pantry, scans, shoppingList, behaviorMeta };
  }, [pantry, scans, shoppingList, behaviorMeta]);
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
      setBehaviorMeta({ cards: [], mutedFamilies: [] });
      setLoading(false);
      return;
    }

    if (REQUIRE_EMAIL_VERIFICATION && user?.emailVerified === false) {
      setPantry([]);
      setScans([]);
      setShoppingList([]);
      setBehaviorMeta({ cards: [], mutedFamilies: [] });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    (async () => {
      try {
        const data = await loadStore();
        if (!active) return;
        const ctx = makePredictionContext(
          data.pantry,
          data.behaviorMeta.mutedFamilies,
        );
        const refreshed = rebuildPredictedShoppingList(
          data.pantry,
          data.shoppingList,
          ctx,
        );
        setPantry(data.pantry);
        setScans(data.scans);
        setBehaviorMeta(data.behaviorMeta);
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
  }, [isAuthenticated, authLoading, user?.id, user?.emailVerified, queueSave]);

  const persistPantry = useCallback(
    async (next: PantryItem[]) => {
      setPantry(next);
      setShoppingList((cur) =>
        rebuildPredictedShoppingList(next, cur, predictionCtx),
      );
      queueSave();
    },
    [queueSave, predictionCtx],
  );

  const persistBehaviorMeta = useCallback(
    (next: BehaviorMeta) => {
      setBehaviorMeta(next);
      queueSave();
    },
    [queueSave],
  );

  const dismissBehaviorCard = useCallback(
    (cardId: string) => {
      setBehaviorMeta((cur) => ({
        ...cur,
        cards: cur.cards.filter((c) => c.id !== cardId),
      }));
      queueSave();
    },
    [queueSave],
  );

  const refreshBehaviorInsights = useCallback(
    async (latestScanItemNames?: string[], force = false) => {
      if (!canSaveRef.current) return;
      if (!shouldRefreshBehaviorInsight(behaviorMeta, force)) return;
      try {
        const meta = await fetchBehaviorInsight({
          latestScanItemNames,
          force,
        });
        persistBehaviorMeta(meta);
      } catch (err) {
        console.warn("Behavior insight failed:", err);
      }
    },
    [behaviorMeta, persistBehaviorMeta],
  );

  const persistShopping = useCallback(
    async (next: ShoppingListItem[]) => {
      setShoppingList(next);
      queueSave();
    },
    [queueSave],
  );

  const enrichNutritionForItems = useCallback(
    async (itemIds: string[], barcode?: string) => {
      if (!canSaveRef.current) return;
      let next = [...stateRef.current.pantry];
      let changed = false;
      for (const id of itemIds.slice(0, 10)) {
        const item = next.find((p) => p.id === id);
        if (!item || item.nutrition) continue;
        if (
          item.category === "Household" ||
          item.category === "Personal Care"
        ) {
          continue;
        }
        try {
          const snap = await fetchNutritionForItem({
            barcode: barcode ?? item.barcode,
            productName: item.name,
          });
          if (!snap) continue;
          next = next.map((p) =>
            p.id === id
              ? {
                  ...p,
                  nutrition: snap,
                  barcode: snap.barcode ?? p.barcode ?? barcode,
                }
              : p,
          );
          changed = true;
        } catch (err) {
          console.warn("Nutrition lookup failed for", item.name, err);
        }
      }
      if (changed) {
        const ctx = makePredictionContext(
          next,
          stateRef.current.behaviorMeta?.mutedFamilies ?? [],
        );
        setPantry(next);
        setShoppingList((cur) =>
          rebuildPredictedShoppingList(next, cur, ctx),
        );
        queueSave();
      }
    },
    [queueSave],
  );

  const addScannedItems = useCallback<PantryContextValue["addScannedItems"]>(
    async (items, sourceType, storeName, purchaseDate, options) => {
      const now = new Date().toISOString();
      const purchaseDateIso = purchaseDate ?? now;
      const scanBarcode = options?.barcode?.replace(/\D/g, "");

      const next: PantryItem[] = [...pantry];
      const touchedIds: string[] = [];

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
          const shelfLife = resolveShelfLifeDays(
            cat,
            incoming.name,
            incoming.estimatedShelfLifeDays || existing.estimatedShelfLifeDays,
          );
          const consumptionHistory = !existing.consumed
            ? appendConsumptionRecord(existing, purchaseDateIso, "replaced")
            : (existing.consumptionHistory ?? []);
          next[existingIdx] = {
            ...existing,
            quantity: incoming.quantity,
            unit: incoming.unit || existing.unit,
            category: cat,
            isOrganic: incoming.isOrganic ?? existing.isOrganic,
            organicConfidence:
              incoming.organicConfidence ?? existing.organicConfidence,
            organicSource: incoming.organicSource ?? existing.organicSource,
            estimatedShelfLifeDays: shelfLife,
            lastPurchasedAt: purchaseDateIso,
            lastConfirmedAt: purchaseDateIso,
            purchases,
            averageDaysBetweenPurchases:
              computeAverageDaysBetweenPurchases(purchases),
            consumed: false,
            consumptionHistory,
            stockLevel: undefined,
            barcode: existing.barcode ?? scanBarcode,
          };
          touchedIds.push(existing.id);
        } else {
          const purchase = {
            date: purchaseDateIso,
            quantity: incoming.quantity,
            unit: incoming.unit,
            source: sourceType,
          };
          const newItemId = newId();
          next.push({
            id: newItemId,
            name: incoming.name.trim(),
            category: cat,
            isOrganic: incoming.isOrganic,
            organicConfidence: incoming.organicConfidence,
            organicSource: incoming.organicSource,
            quantity: incoming.quantity,
            unit: incoming.unit,
            estimatedShelfLifeDays: resolveShelfLifeDays(
              cat,
              incoming.name,
              incoming.estimatedShelfLifeDays,
            ),
            firstSeenAt: now,
            lastPurchasedAt: purchaseDateIso,
            lastConfirmedAt: purchaseDateIso,
            purchases: [purchase],
            averageDaysBetweenPurchases: null,
            consumed: false,
            barcode: scanBarcode,
          });
          touchedIds.push(newItemId);
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

      const ctx = makePredictionContext(next, behaviorMeta.mutedFamilies);
      setPantry(next);
      setScans(nextScans);
      setShoppingList((cur) => rebuildPredictedShoppingList(next, cur, ctx));
      queueSave();

      const scanNames = items.map((i) => i.name);
      void refreshBehaviorInsights(scanNames, true);
      void enrichNutritionForItems(touchedIds, scanBarcode);

      return scan;
    },
    [
      pantry,
      scans,
      queueSave,
      behaviorMeta.mutedFamilies,
      refreshBehaviorInsights,
      enrichNutritionForItems,
    ],
  );

  const markConsumed = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const next = pantry.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          consumed: true,
          consumptionHistory: appendConsumptionRecord(p, now, "confirmed_out"),
        };
      });
      await persistPantry(next);
    },
    [pantry, persistPantry],
  );

  const confirmStillHave = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      const next = pantry.map((p) =>
        p.id === id
          ? {
              ...p,
              consumed: false,
              lastPurchasedAt: now,
              lastConfirmedAt: now,
              stockLevel: p.stockLevel === "empty" ? ("low" as const) : p.stockLevel,
            }
          : p,
      );
      await persistPantry(next);
    },
    [pantry, persistPantry],
  );

  const confirmOut = useCallback(
    async (id: string) => {
      const item = pantry.find((p) => p.id === id);
      if (!item) return;
      const now = new Date().toISOString();
      const next = pantry.map((p) => {
        if (p.id !== id) return p;
        return {
          ...p,
          consumed: true,
          stockLevel: "empty" as const,
          consumptionHistory: appendConsumptionRecord(p, now, "confirmed_out"),
        };
      });
      setPantry(next);
      const shopEntry: ShoppingListItem = {
        id: newId(),
        name: item.name,
        category: item.category,
        reason: "manual",
        pantryItemId: item.id,
        checked: false,
        createdAt: now,
      };
      const merged = rebuildPredictedShoppingList(
        next,
        [...shoppingList, shopEntry],
        predictionCtx,
      );
      setShoppingList(merged);
      queueSave();
    },
    [pantry, shoppingList, queueSave, predictionCtx],
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

  const setStockLevel = useCallback(
    async (id: string, level: BulkStockLevel) => {
      const now = new Date().toISOString();
      const next = pantry.map((p) => {
        if (p.id !== id) return p;
        if (level === "full") {
          return {
            ...p,
            stockLevel: "full" as const,
            consumed: false,
            lastPurchasedAt: now,
            lastConfirmedAt: now,
          };
        }
        if (level === "low") {
          return { ...p, stockLevel: "low" as const, consumed: false };
        }
        return {
          ...p,
          stockLevel: "empty" as const,
          consumed: true,
          consumptionHistory: appendConsumptionRecord(p, now, "confirmed_out"),
        };
      });
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
    const refreshed = rebuildPredictedShoppingList(
      pantry,
      shoppingList,
      predictionCtx,
    );
    await persistShopping(refreshed);
  }, [pantry, persistShopping, shoppingList, predictionCtx]);

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
        rebuildPredictedShoppingList(pantry, [...shoppingList, item], predictionCtx),
      );
    },
    [pantry, persistShopping, shoppingList, predictionCtx],
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
      await persistShopping(
        rebuildPredictedShoppingList(pantry, filtered, predictionCtx),
      );
    },
    [pantry, persistShopping, shoppingList, predictionCtx],
  );

  const clearCheckedShoppingItems = useCallback(async () => {
    const filtered = shoppingList.filter((s) => !s.checked);
    await persistShopping(
      rebuildPredictedShoppingList(pantry, filtered, predictionCtx),
    );
  }, [pantry, persistShopping, shoppingList, predictionCtx]);

  const resetAll = useCallback(async () => {
    setPantry([]);
    setScans([]);
    setShoppingList([]);
    setBehaviorMeta({ cards: [], mutedFamilies: [] });
    queueSave();
  }, [queueSave]);

  useEffect(() => {
    if (!canSaveRef.current || loading || !isAuthenticated) return;
    if (pantry.length === 0) return;
    void refreshBehaviorInsights(undefined, false);
  }, [isAuthenticated, loading, pantry.length, refreshBehaviorInsights]);

  const value = useMemo<PantryContextValue>(
    () => ({
      pantry,
      scans,
      shoppingList,
      behaviorMeta,
      predictionCtx,
      loading,
      refreshBehaviorInsights,
      dismissBehaviorCard,
      enrichNutritionForItems,
      addScannedItems,
      markConsumed,
      markWasted,
      unmarkConsumed,
      confirmStillHave,
      confirmOut,
      setStockLevel,
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
      behaviorMeta,
      predictionCtx,
      loading,
      refreshBehaviorInsights,
      dismissBehaviorCard,
      enrichNutritionForItems,
      addScannedItems,
      markConsumed,
      markWasted,
      unmarkConsumed,
      confirmStillHave,
      confirmOut,
      setStockLevel,
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
