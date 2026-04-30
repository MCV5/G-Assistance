import type { Category } from "./types";

export const CATEGORY_META: Record<
  Category,
  { icon: keyof typeof iconMap; tone: string }
> = {
  Fruit: { icon: "sun", tone: "#e07c3c" },
  Vegetables: { icon: "leaf", tone: "#3a8a4f" },
  Dairy: { icon: "cup", tone: "#5b8ab8" },
  Meat: { icon: "flame", tone: "#b94a3a" },
  Pantry: { icon: "package", tone: "#8a6b3a" },
  Bakery: { icon: "bread", tone: "#c08a45" },
  Beverages: { icon: "bottle", tone: "#3a85a8" },
  Frozen: { icon: "snow", tone: "#5d92b5" },
  Snacks: { icon: "cookie", tone: "#b87a3a" },
  Household: { icon: "home", tone: "#6b6b8a" },
  "Personal Care": { icon: "heart", tone: "#b86b8a" },
  Prepared: { icon: "shoppingBag", tone: "#8e6bc9" },
  Other: { icon: "tag", tone: "#7a7a7a" },
};

import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

type FeatherName = ComponentProps<typeof Feather>["name"];

const iconMap = {
  sun: "sun" as FeatherName,
  leaf: "leaf" as FeatherName,
  cup: "coffee" as FeatherName,
  flame: "zap" as FeatherName,
  package: "package" as FeatherName,
  bread: "circle" as FeatherName,
  bottle: "droplet" as FeatherName,
  snow: "cloud-snow" as FeatherName,
  cookie: "disc" as FeatherName,
  home: "home" as FeatherName,
  heart: "heart" as FeatherName,
  shoppingBag: "shopping-bag" as FeatherName,
  tag: "tag" as FeatherName,
};

export function getCategoryIcon(category: Category): FeatherName {
  return iconMap[CATEGORY_META[category].icon];
}

export function getCategoryTone(category: Category): string {
  return CATEGORY_META[category].tone;
}
