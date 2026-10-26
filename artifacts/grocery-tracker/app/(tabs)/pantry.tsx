import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useMemo, useRef, useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddItemModal } from "@/components/AddItemModal";
import { EmptyState } from "@/components/EmptyState";
import { ItemActionSheet } from "@/components/ItemActionSheet";
import { ItemDetailSheet } from "@/components/ItemDetailSheet";
import { ItemRow } from "@/components/ItemRow";
import { SwipeAddAction, SwipeUsedAction } from "@/components/SwipeActions";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getCategoryTone } from "@/lib/categories";
import { inferFamily } from "@/lib/itemInsights";
import { getDaysUntilNeeded } from "@/lib/predictions";
import { CATEGORIES, type Category, type PantryItem } from "@/lib/types";

type Filter = "all" | "need" | Category;
type SortMode = "az" | "need" | "recent";
type PantryListRow =
  | { kind: "item"; item: PantryItem }
  | {
      kind: "group";
      id: string;
      label: string;
      category: Category;
      count: number;
      dueInDays: number;
      organicCount: number;
      members: PantryItem[];
    };

const SORTS: { key: SortMode; label: string }[] = [
  { key: "need", label: "Soonest" },
  { key: "recent", label: "Newest" },
  { key: "az", label: "A–Z" },
];

export default function PantryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    pantry,
    markConsumed,
    markWasted,
    unmarkConsumed,
    removeItem,
    addManualPantryItem,
    addManualShoppingItem,
    setStockLevel,
    predictionCtx,
    enrichNutritionForItems,
  } = usePantry();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("need");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [actionItem, setActionItem] = useState<PantryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);

  const activeCount = pantry.filter((p) => !p.consumed).length;
  const categoryFilter = filter !== "all" && filter !== "need" ? filter : null;

  const promptAddToShoppingList = useCallback(
    (item: PantryItem, context: "used" | "wasted") => {
      const preface =
        context === "wasted"
          ? "Sorry that went to waste."
          : "Great — it's marked off your kitchen.";
      Alert.alert(
        "Add to shopping list?",
        `${preface}\n\nRemember to buy "${item.name}" on your next trip?`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Add to list",
            onPress: () => addManualShoppingItem(item.name, item.category),
          },
        ],
      );
    },
    [addManualShoppingItem],
  );

  const handleUsedItUp = useCallback(
    async (item: PantryItem) => {
      await markConsumed(item.id);
      promptAddToShoppingList(item, "used");
    },
    [markConsumed, promptAddToShoppingList],
  );

  const handleWasted = useCallback(
    async (item: PantryItem) => {
      await markWasted(item.id);
      promptAddToShoppingList(item, "wasted");
    },
    [markWasted, promptAddToShoppingList],
  );

  const rows = useMemo<PantryListRow[]>(() => {
    let list = pantry.filter((p) => !p.consumed);
    if (filter === "need") {
      list = list.filter((p) => {
        const next = new Date(
          new Date(p.lastPurchasedAt).getTime() +
            (p.averageDaysBetweenPurchases ?? p.estimatedShelfLifeDays) *
              86400000,
        );
        return next.getTime() <= Date.now() + 5 * 86400000;
      });
    } else if (filter !== "all") {
      list = list.filter((p) => p.category === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    switch (sortMode) {
      case "recent":
        list.sort(
          (a, b) =>
            new Date(b.lastPurchasedAt).getTime() - new Date(a.lastPurchasedAt).getTime(),
        );
        break;
      case "az":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "need":
      default:
        list.sort(
          (a, b) =>
            getDaysUntilNeeded(a, predictionCtx) -
            getDaysUntilNeeded(b, predictionCtx),
        );
        break;
    }

    const grouped = new Map<string, PantryListRow>();
    const output: PantryListRow[] = [];
    for (const item of list) {
      const family = inferFamily(item.name);
      if (!family) {
        output.push({ kind: "item", item });
        continue;
      }
      const key = `${item.category}:${family}`;
      const existing = grouped.get(key);
      if (!existing || existing.kind !== "group") {
        const group: PantryListRow = {
          kind: "group",
          id: key,
          label: family,
          category: item.category,
          count: 1,
          dueInDays: getDaysUntilNeeded(item, predictionCtx),
          organicCount: item.isOrganic ? 1 : 0,
          members: [item],
        };
        grouped.set(key, group);
        output.push(group);
      } else {
        existing.count += 1;
        existing.dueInDays = Math.min(
          existing.dueInDays,
          getDaysUntilNeeded(item, predictionCtx),
        );
        existing.organicCount += item.isOrganic ? 1 : 0;
        existing.members.push(item);
      }
    }
    return output;
  }, [pantry, filter, search, sortMode, predictionCtx]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 24 : insets.top + 12;

  const setScope = (next: "all" | "need") => {
    setFilter(next);
    setCategoryOpen(false);
  };

  const setCategory = (cat: Category) => {
    setFilter(cat);
    setCategoryOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ItemActionSheet
        item={actionItem}
        onClose={() => setActionItem(null)}
        onUsedItUp={(item) => {
          handleUsedItUp(item);
        }}
        onWasted={(item) => {
          handleWasted(item);
        }}
        onAddToList={(item) => addManualShoppingItem(item.name, item.category)}
        onViewDetails={(item) => setSelectedItem(item)}
      />

      <ItemDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSetStockLevel={setStockLevel}
        predictionCtx={predictionCtx}
        onFetchNutrition={(id) => enrichNutritionForItems([id])}
        onMarkConsumed={async (id) => {
          const it = selectedItem?.id === id ? selectedItem : pantry.find((p) => p.id === id);
          await markConsumed(id);
          setSelectedItem(null);
          if (it) promptAddToShoppingList(it, "used");
        }}
        onMarkWasted={async (id) => {
          const it = selectedItem?.id === id ? selectedItem : pantry.find((p) => p.id === id);
          await markWasted(id);
          setSelectedItem(null);
          if (it) promptAddToShoppingList(it, "wasted");
        }}
        onMarkInStock={async (id) => {
          await unmarkConsumed(id);
          setSelectedItem(null);
        }}
        onDelete={async (id) => {
          await removeItem(id);
          setSelectedItem(null);
        }}
      />
      <AddItemModal
        visible={addOpen}
        title="Add to kitchen"
        submitLabel="Add to kitchen"
        onClose={() => setAddOpen(false)}
        onSubmit={(name, category) => {
          addManualPantryItem(name, category);
          setAddOpen(false);
        }}
      />

      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "item" ? row.item.id : row.id)}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingHorizontal: 20,
          paddingBottom: 120,
          gap: 8,
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  Kitchen
                </Text>
                <Text
                  style={[styles.subtitle, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {activeCount === 0
                    ? "What you have at home"
                    : `${activeCount} item${activeCount === 1 ? "" : "s"} at home`}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => router.push("/(tabs)/scan")}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan receipt"
                >
                  <Feather name="camera" size={18} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={() => router.push("/(tabs)/insights")}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="How you eat"
                >
                  <Feather name="bar-chart-2" size={18} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={() => setAddOpen(true)}
                  style={[styles.iconBtn, { backgroundColor: colors.primary, borderWidth: 0 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Add item"
                >
                  <Feather name="plus" size={20} color={colors.primaryForeground} />
                </Pressable>
              </View>
            </View>

            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search items"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.searchInput, { color: colors.foreground }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search ? (
                <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search">
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.scopeRow}>
              <Pressable
                onPress={() => setScope("all")}
                style={[
                  styles.scopeChip,
                  {
                    backgroundColor: filter === "all" ? colors.primary : colors.card,
                    borderColor: filter === "all" ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    {
                      color:
                        filter === "all"
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  All
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScope("need")}
                style={[
                  styles.scopeChip,
                  {
                    backgroundColor: filter === "need" ? colors.primary : colors.card,
                    borderColor: filter === "need" ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    {
                      color:
                        filter === "need"
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  Running low
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCategoryOpen((open) => !open)}
                style={[
                  styles.scopeChip,
                  styles.categoryChip,
                  {
                    backgroundColor: categoryFilter ? colors.primary : colors.card,
                    borderColor: categoryFilter ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Filter by category"
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    {
                      color: categoryFilter
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {categoryFilter ?? "Category"}
                </Text>
                <Feather
                  name={categoryOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={
                    categoryFilter
                      ? colors.primaryForeground
                      : colors.mutedForeground
                  }
                />
              </Pressable>
            </View>

            {categoryOpen ? (
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((cat) => {
                  const active = filter === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.categoryTag,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryTagText,
                          {
                            color: active
                              ? colors.primaryForeground
                              : colors.foreground,
                          },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View
              style={[
                styles.sortRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {SORTS.map((srt) => {
                const active = sortMode === srt.key;
                return (
                  <Pressable
                    key={srt.key}
                    onPress={() => setSortMode(srt.key)}
                    style={[
                      styles.sortSeg,
                      active && { backgroundColor: colors.background },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.sortSegText,
                        {
                          color: active ? colors.foreground : colors.mutedForeground,
                          fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {srt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item: row }) =>
          row.kind === "item" ? (
            <SwipeableItemRow
              item={row.item}
              onPress={() => setActionItem(row.item)}
              onAddToList={() => {
                if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                addManualShoppingItem(row.item.name, row.item.category);
              }}
              onMarkUsed={() => {
                if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                handleUsedItUp(row.item);
              }}
            />
          ) : (
            <View style={{ gap: 8 }}>
              <Pressable
                onPress={() =>
                  setExpandedGroups((prev) => ({
                    ...prev,
                    [row.id]: !prev[row.id],
                  }))
                }
                style={[
                  styles.groupRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.groupIcon,
                    { backgroundColor: `${getCategoryTone(row.category)}22` },
                  ]}
                >
                  <Feather name="layers" size={16} color={getCategoryTone(row.category)} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.groupHead}>
                    <Text
                      style={[styles.groupTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {row.label}
                    </Text>
                    <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>
                      {row.count}
                    </Text>
                  </View>
                  <Text
                    style={[styles.groupMeta, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {row.category}
                    {" · "}
                    {row.dueInDays <= 0 ? "Need now" : `Need in ${row.dueInDays}d`}
                    {row.organicCount > 0 ? ` · ${row.organicCount} organic` : ""}
                  </Text>
                </View>
                <Feather
                  name={expandedGroups[row.id] ? "chevron-down" : "chevron-right"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {expandedGroups[row.id]
                ? row.members.map((member) => (
                    <View key={member.id} style={styles.groupChildWrap}>
                      <SwipeableItemRow
                        item={member}
                        onPress={() => setActionItem(member)}
                        onAddToList={() => {
                          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          addManualShoppingItem(member.name, member.category);
                        }}
                        onMarkUsed={() => {
                          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          handleUsedItUp(member);
                        }}
                      />
                    </View>
                  ))
                : null}
            </View>
          )
        }
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title={
              pantry.length === 0
                ? "Your kitchen is empty"
                : "No matches"
            }
            subtitle={
              pantry.length === 0
                ? "Scan a receipt after a trip, or tap + to add items."
                : "Try a different filter or search term."
            }
          />
        }
      />
    </View>
  );
}

function SwipeableItemRow({
  item,
  onPress,
  onAddToList,
  onMarkUsed,
}: {
  item: import("@/lib/types").PantryItem;
  onPress: () => void;
  onAddToList: () => void;
  onMarkUsed: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={60}
      leftThreshold={60}
      renderRightActions={() => <SwipeAddAction />}
      renderLeftActions={() => <SwipeUsedAction />}
      onSwipeableRightOpen={() => {
        onAddToList();
        setTimeout(() => swipeRef.current?.close(), 300);
      }}
      onSwipeableLeftOpen={() => {
        onMarkUsed();
      }}
    >
      <ItemRow item={item} onPress={onPress} />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    minWidth: 0,
  },
  scopeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  scopeChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryTagText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  sortRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  sortSeg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 0,
  },
  sortSegText: {
    fontSize: 12,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  groupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    flex: 1,
  },
  groupCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  groupMeta: {
    marginTop: 2,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  groupChildWrap: {
    paddingLeft: 12,
  },
});
