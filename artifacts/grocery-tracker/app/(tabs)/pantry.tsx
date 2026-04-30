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
import { CATEGORIES, type Category, type PantryItem } from "@/lib/types";

type Filter = "all" | "need" | Category;

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
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo<PantryItem[]>(() => {
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
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [pantry, filter, search]);

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
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 120,
          gap: 10,
        }}
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPress={() => {
              Alert.alert(
                item.name,
                "What do you want to do with this item?",
                [
                  { text: "Cancel", style: "cancel" },
                  item.consumed
                    ? {
                        text: "Mark in stock",
                        onPress: () => unmarkConsumed(item.id),
                      }
                    : {
                        text: "I used it up",
                        onPress: () => markConsumed(item.id),
                      },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => removeItem(item.id),
                  },
                ],
              );
            }}
          />
        )}
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
});
