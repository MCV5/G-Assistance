/** Phase A profile screen palette (design spec). */
export const profileColors = {
  greenDeep: "#1C2E0A",
  greenHeader: "#2D4A1E",
  greenMid: "#3A5C26",
  greenAccent: "#7AAD52",
  greenLight: "#C5DCA8",
  cream: "#F2EFE6",
  creamCard: "#E8E4D9",
  creamBorder: "#D8D4CA",
  inkBlack: "#1A1A18",
  inkMid: "#5A5750",
  inkMuted: "#8A8780",
} as const;

export const STORAGE_PROFILE_DIETARY = "@profile_dietary_goals";
export const STORAGE_PROFILE_HOUSEHOLD = "@profile_household_size";
export const STORAGE_PROFILE_EXPIRY_ALERTS = "@profile_expiry_alerts_pref";

/**
 * Dietary pill labels. Must match `artifacts/api-server/src/lib/dietaryOptions.ts`.
 */
export const DIETARY_OPTIONS = [
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
