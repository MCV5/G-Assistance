import type { PredictionContext } from "./predictions";
import type { PantryItem } from "./types";

export function makePredictionContext(
  pantry: PantryItem[],
  mutedFamilies: string[] = [],
): PredictionContext {
  return { pantry, mutedFamilies };
}
