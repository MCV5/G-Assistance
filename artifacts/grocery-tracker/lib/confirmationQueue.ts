import {
  getDaysUntilNeeded,
  getItemStatus,
  type PredictionContext,
} from "./predictions";
import type { PantryItem } from "./types";

export interface ConfirmationCandidate {
  item: PantryItem;
  status: "overdue" | "expired";
}

export function getConfirmationCandidates(
  active: PantryItem[],
  max = 6,
  ctx: PredictionContext = {},
): ConfirmationCandidate[] {
  const candidates: ConfirmationCandidate[] = [];
  for (const item of active) {
    const status = getItemStatus(item, ctx);
    if (status === "overdue" || status === "expired") {
      candidates.push({
        item,
        status: status === "expired" ? "expired" : "overdue",
      });
    }
  }
  candidates.sort((a, b) => {
    const da = getDaysUntilNeeded(a.item, ctx);
    const db = getDaysUntilNeeded(b.item, ctx);
    return da - db;
  });
  return candidates.slice(0, max);
}

/** Pantry health excludes items awaiting user confirmation. */
export function computePantryHealthPct(
  active: PantryItem[],
  ctx: PredictionContext = {},
): number {
  const pending = new Set(
    getConfirmationCandidates(active, 99, ctx).map((c) => c.item.id),
  );
  const tracked = active.filter((p) => !pending.has(p.id));
  if (tracked.length === 0) return active.length === 0 ? 0 : 50;
  const freshCount = tracked.filter(
    (p) => getItemStatus(p, ctx) === "fresh",
  ).length;
  return Math.round((freshCount / tracked.length) * 100);
}

export function confirmationPrompt(
  item: PantryItem,
  ctx: PredictionContext = {},
): string {
  const status = getItemStatus(item, ctx);
  if (status === "expired") return "Likely finished — still have any?";
  return "Might be out — quick check";
}
