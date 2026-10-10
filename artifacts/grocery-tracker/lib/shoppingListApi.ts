import { customFetch } from "@workspace/api-client-react";

import { coerceCategory } from "@/lib/guessCategory";
import { parseShoppingListLocally as parseLocallyCore } from "@/lib/shoppingListLive";
import type { Category } from "@/lib/types";

export type ParsedShoppingListItem = {
  name: string;
  category: Category;
};

export async function parseShoppingListText(
  text: string,
): Promise<ParsedShoppingListItem[]> {
  try {
    const res = await customFetch<{ items: { name: string; category: string }[] }>(
      "/api/shopping/parse-list",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
    return (res.items ?? []).map((it) => ({
      name: it.name.trim(),
      category: coerceCategory(it.name, it.category),
    }));
  } catch {
    return parseShoppingListLocally(text);
  }
}

export function parseShoppingListLocally(text: string): ParsedShoppingListItem[] {
  return parseLocallyCore(text).map(({ name, category }) => ({ name, category }));
}
