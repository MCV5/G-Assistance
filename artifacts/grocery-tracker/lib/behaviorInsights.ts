import { postBehaviorInsight } from "@workspace/api-client-react";

import type { BehaviorMeta } from "./types";

export type BehaviorInsightRequest = {
  latestScanItemNames?: string[];
  force?: boolean;
};

export async function fetchBehaviorInsight(
  body: BehaviorInsightRequest = {},
): Promise<BehaviorMeta> {
  const res = await postBehaviorInsight({
    latestScanItemNames: body.latestScanItemNames,
    force: body.force,
  });
  const meta = res.behaviorMeta;
  return {
    cards: (meta?.cards ?? []) as BehaviorMeta["cards"],
    mutedFamilies: meta?.mutedFamilies ?? [],
    generatedAt: meta?.generatedAt,
  };
}

export const BEHAVIOR_INSIGHT_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function shouldRefreshBehaviorInsight(
  meta: BehaviorMeta | undefined,
  force = false,
): boolean {
  if (force) return true;
  if (!meta?.generatedAt) return true;
  const age = Date.now() - new Date(meta.generatedAt).getTime();
  return age > BEHAVIOR_INSIGHT_MIN_INTERVAL_MS;
}
