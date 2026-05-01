import type { Category } from "./types";
import { CATEGORIES } from "./types";

const FRUIT: RegExp =
  /apple|banana|orange|grape|berry|strawberr|blueber|raspberr|mango|melon|watermelon|pear|peach|plum|cherry|lemon|lime|grapefruit|kiwi|papaya|fig|pomegranate|apricot|nectarine|coconut|pineapple|date\b|prune|blackberr|cranberr|boysenberr|guava|passion fruit|persimmon|clementine|mandarin|tangerine/;

const VEG: RegExp =
  /tomato|potato|sweet potato|onion|garlic|carrot|celery|lettuce|spinach|kale|broccoli|cucumber|pepper\b|mushroom|zucchini|corn\b|peas\b|bean sprout|asparagus|artichoke|beet|cabbage|cauliflower|salad kit|mixed greens|herb|basil|cilantro|parsley|ginger|arugula|leek|shallot|radish|scallion|bok choy|eggplant|squash|pumpkin|brussels|collard|chard|turnip|parsnip|okra|jalapeño|jalapeno/;

const PREPARED: RegExp =
  /rotisserie|ready meal|frozen dinner|tv dinner|meal kit|salad kit|sushi|poke bowl|deli sandwich|\bprepared\b|grab and go|grab.and.go|hot bar|takeaway|take-out|party tray|charcuterie|antipasto platter|coleslaw|potato salad|egg salad|chicken salad|macaroni salad|spring roll|egg roll|samosa/;

const RULES: [Category, RegExp][] = [
  ["Prepared", PREPARED],
  ["Fruit", FRUIT],
  ["Vegetables", VEG],
  [
    "Dairy",
    /\bmilk\b|cheese|yogurt|yoghurt|\bbutter\b|cream|\begg|sour cream|cottage|whipping|half.and.half|cheddar|mozzarella|parmesan|feta|brie|colby|gouda|provolone|ricotta|ghee|kefir|queso/,
  ],
  [
    "Meat",
    /chicken|beef|pork|turkey|lamb|salmon|tuna|shrimp|fish|steak|ground meat|ground beef|sausage|bacon|ham|seafood|crab|lobster|tilapia|cod|halibut|meatball|wing|drumstick|filet|fillet|rib|brisket|chorizo|pepperoni/,
  ],
  [
    "Bakery",
    /bread|bagel|muffin|croissant|\broll\b|bun|\bcake\b|cookie|pastry|donut|doughnut|\bpie\b|tortilla|pita|biscuit|scone|pretzel|sourdough|brioche|ciabatta|focaccia|baguette|flatbread|loaf/,
  ],
  [
    "Beverages",
    /juice|sparkling water|mineral water|soda|cola|coffee|espresso|\btea\b|wine|beer|kombucha|lemonade|smoothie|energy drink|sports drink|coconut water|almond milk|oat milk|soy milk|cider|whiskey|vodka|rum|gin|champagne|cocktail|punch/,
  ],
  [
    "Frozen",
    /frozen|ice cream|gelato|popsicle|frozen pizza|frozen waffle|frozen burrito|edamame|frozen veggie|frozen meal|frozen dinner|sorbet/,
  ],
  [
    "Snacks",
    /chip|crisp|popcorn|pretzel|almond|cashew|pecan|walnut|peanut|mixed nuts|granola bar|protein bar|snack|cracker|trail mix|jerky|candy|chocolate|gummy|fruit snack|rice cake|pork rind/,
  ],
  [
    "Pantry",
    /\brice\b|pasta|noodle|spaghetti|penne|flour|sugar|salt|\boil\b|olive oil|canola|vinegar|ketchup|mustard|mayo|mayonnaise|hot sauce|soy sauce|worcestershire|seasoning|spice|cinnamon|cumin|paprika|oregano|canned|soup|broth|stock|\bbeans\b|lentil|chickpea|quinoa|oatmeal|honey|jam|jelly|syrup|peanut butter|nutella|cereal|oats|breadcrumb|baking soda|baking powder|yeast|cocoa|vanilla|dressing|marinade|salsa|hummus/,
  ],
  [
    "Household",
    /cleaner|detergent|dish soap|laundry|paper towel|toilet paper|tissue|sponge|bleach|spray|foil|plastic wrap|ziplock|garbage bag|trash bag|candle|light bulb|battery|filter/,
  ],
  [
    "Personal Care",
    /toothpaste|toothbrush|floss|deodorant|razor|shampoo|conditioner|body wash|lotion|sunscreen|vitamin|supplement|ibuprofen|tylenol|advil|aspirin|band.aid|bandage|medicine|moisturizer|face wash|lip balm|perfume|cologne/,
  ],
];

/** Best-effort category from free text (manual add, barcode fallback). */
export function guessCategory(name: string): Category {
  const lower = name.toLowerCase().trim();
  if (!lower) return "Other";
  for (const [cat, re] of RULES) {
    if (re.test(lower)) return cat;
  }
  return "Other";
}

/** Map API / legacy labels onto app Category. */
export function coerceCategory(name: string, raw: string): Category {
  const c = raw.trim();
  if (c === "Produce") return guessCategory(name);
  if (CATEGORIES.includes(c as Category)) return c as Category;
  return guessCategory(name);
}
