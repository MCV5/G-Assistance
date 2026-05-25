import { daysBetween } from "./predictions";
import { inferFamily } from "./itemInsights";
import type { ConsumptionRecord, PantryItem } from "./types";

export function appendConsumptionRecord(
  item: PantryItem,
  endedAt: string,
  reason: ConsumptionRecord["reason"],
): ConsumptionRecord[] {
  const daysHeld = Math.max(
    1,
    daysBetween(item.lastPurchasedAt, endedAt),
  );
  const record: ConsumptionRecord = {
    endedAt,
    daysHeld,
    reason,
    family: inferFamily(item.name),
    category: item.category,
  };
  return [...(item.consumptionHistory ?? []), record].slice(-24);
}
