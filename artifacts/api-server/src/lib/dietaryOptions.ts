/**
 * Allowed dietary tags (keep in sync with grocery-tracker `DIETARY_OPTIONS`).
 */
export const ALLOWED_DIETARY_GOALS = [
  "High protein",
  "Low sugar",
  "Low sodium",
  "High fibre",
  "Low carb",
  "Dairy-free",
  "Gluten-free",
  "Vegetarian",
  "Vegan",
] as const;

const allowed = new Set<string>(ALLOWED_DIETARY_GOALS);

export function sanitizeDietaryGoals(goals: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of goals) {
    if (allowed.has(g) && !seen.has(g)) {
      seen.add(g);
      out.push(g);
    }
  }
  return out;
}
