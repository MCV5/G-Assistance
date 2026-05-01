import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useRef, useState, useCallback } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
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

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "need", label: "Need" },
  ...CATEGORIES.map((c) => ({ key: c, label: c })),
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
  } = usePantry();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("need");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [actionItem, setActionItem] = useState<PantryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);

  const promptAddToShoppingList = useCallback(
    (item: PantryItem, context: "used" | "wasted") => {
      const preface =
        context === "wasted"
          ? "Sorry that went to waste."
          : "Great — it's marked off your pantry.";
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
    // Active pantry only — finished items leave the main list (insights still has history)
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
        list.sort((a, b) => getDaysUntilNeeded(a) - getDaysUntilNeeded(b));
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
          dueInDays: getDaysUntilNeeded(item),
          organicCount: item.isOrganic ? 1 : 0,
          members: [item],
        };
        grouped.set(key, group);
        output.push(group);
      } else {
        existing.count += 1;
        existing.dueInDays = Math.min(existing.dueInDays, getDaysUntilNeeded(item));
        existing.organicCount += item.isOrganic ? 1 : 0;
        existing.members.push(item);
      }
    }
    return output;
  }, [pantry, filter, search, sortMode]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Quick action sheet — opens on tap */}
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

      {/* Full detail sheet — opens from "View Details" */}
      <ItemDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
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
        title="Add to pantry"
        submitLabel="Add to pantry"
        onClose={() => setAddOpen(false)}
        onSubmit={(name, category) => {
          addManualPantryItem(name, category);
          setAddOpen(false);
        }}
      />
      <View style={{ paddingTop: topPad, paddingHorizontal: 20 }}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Pantry</Text>
          <Pressable
            onPress={() => setAddOpen(true)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
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
            placeholder="Search your pantry"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: active
                        ? colors.primaryForeground
                        : colors.foreground,
                    },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 10, gap: 8 }}
        >
          {[
            { key: "need", label: "Need soon" },
            { key: "recent", label: "Recent" },
            { key: "az", label: "A-Z" },
          ].map((srt) => {
            const active = sortMode === srt.key;
            return (
              <Pressable
                key={srt.key}
                onPress={() => setSortMode(srt.key as SortMode)}
                style={[
                  styles.sortChip,
                  {
                    backgroundColor: colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                {active && (
                  <Feather name="check" size={11} color={colors.primary} />
                )}
                <Text
                  style={[
                    styles.sortChipText,
                    {
                      color: active ? colors.primary : colors.mutedForeground,
                    },
                  ]}
                >
                  {srt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === "item" ? row.item.id : row.id)}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
          gap: 7,
        }}
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
                <View style={{ flex: 1 }}>
                  <View style={styles.groupHead}>
                    <Text style={[styles.groupTitle, { color: colors.foreground }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.groupCount, { color: colors.mutedForeground }]}>
                      {row.count} items
                    </Text>
                  </View>
                  <Text style={[styles.groupMeta, { color: colors.mutedForeground }]}>
                    {row.category} · {row.dueInDays <= 0 ? "Need now" : `Need in ${row.dueInDays}d`}
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
                        key={member.id}
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
                ? "Your pantry is empty"
                : "No matches"
            }
            subtitle={
              pantry.length === 0
                ? "Scan a receipt or tap + to add items manually."
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: "Inter_500Medium",
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

