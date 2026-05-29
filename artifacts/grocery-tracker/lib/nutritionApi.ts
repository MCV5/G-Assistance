import { postNutritionLookup } from "@workspace/api-client-react";

import { snapshotFromLookupResponse } from "@/lib/nutritionDisplay";
import type { NutritionSnapshot } from "@/lib/types";

export async function fetchNutritionForItem(input: {
  barcode?: string;
  productName: string;
}): Promise<NutritionSnapshot | null> {
  const res = await postNutritionLookup({
    barcode: input.barcode,
    productName: input.productName,
  });
  return snapshotFromLookupResponse(res);
}
