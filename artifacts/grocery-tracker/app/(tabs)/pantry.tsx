import { Feather } from "@expo/vector-icons";
import { useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddItemModal } from "@/components/AddItemModal";
import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getCategoryTone } from "@/lib/categories";
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
  const { pantry, markConsumed, unmarkConsumed, removeItem, addManualPantryItem } = usePantry();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("need");
  const [addOpen, setAddOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const rows = useMemo<PantryListRow[]>(() => {
    let list = pantry.slice();
    if (filter === "need") {
      list = list.filter((p) => {
        const next = new Date(
          new Date(p.lastPurchasedAt).getTime() +
            (p.averageDaysBetweenPurchases ?? p.estimatedShelfLifeDays) *
              86400000,
        );
        return p.consumed || next.getTime() <= Date.now() + 5 * 86400000;
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
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    {
                      color: active ? colors.primaryForeground : colors.foreground,
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
          gap: 10,
        }}
        renderItem={({ item: row }) =>
          row.kind === "item" ? (
            <ItemRow
              item={row.item}
              onPress={() => {
                Alert.alert(
                  row.item.name,
                  "What do you want to do with this item?",
                  [
                    { text: "Cancel", style: "cancel" },
                    row.item.consumed
                      ? {
                          text: "Mark in stock",
                          onPress: () => unmarkConsumed(row.item.id),
                        }
                      : {
                          text: "I used it up",
                          onPress: () => markConsumed(row.item.id),
                        },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => removeItem(row.item.id),
                    },
                  ],
                );
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
                      <ItemRow
                        item={member}
                        onPress={() => {
                          Alert.alert(
                            member.name,
                            "What do you want to do with this item?",
                            [
                              { text: "Cancel", style: "cancel" },
                              member.consumed
                                ? {
                                    text: "Mark in stock",
                                    onPress: () => unmarkConsumed(member.id),
                                  }
                                : {
                                    text: "I used it up",
                                    onPress: () => markConsumed(member.id),
                                  },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => removeItem(member.id),
                              },
                            ],
                          );
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  groupIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontSize: 15,
    flex: 1,
  },
  groupCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  groupMeta: {
    marginTop: 3,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  groupChildWrap: {
    paddingLeft: 14,
  },
});

function inferFamily(name: string): string | null {
  const s = name.toLowerCase();
  if (s.includes("salad") || s.includes("coleslaw") || s.includes("slaw")) {
    return "Salads";
  }
  return null;
}
