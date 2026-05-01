import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddItemModal } from "@/components/AddItemModal";
import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SwipeRemoveAction } from "@/components/SwipeActions";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { type ShoppingListItem } from "@/lib/types";

export default function ShoppingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    shoppingList,
    addManualShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearCheckedShoppingItems,
  } = usePantry();
  const [addOpen, setAddOpen] = useState(false);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;
  const checkedCount = shoppingList.filter((s) => s.checked).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={shoppingList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: 140,
          paddingHorizontal: 20,
          gap: 10,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Shopping list
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Suggested restocks and items you add — one list, no duplicates.
                </Text>
              </View>
              <Pressable
                onPress={() => setAddOpen(true)}
                style={[
                  styles.addBtn,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Feather
                  name="plus"
                  size={20}
                  color={colors.primaryForeground}
                />
              </Pressable>
            </View>
            {checkedCount > 0 && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Clear bought items?",
                    `Remove the ${checkedCount} checked item${checkedCount === 1 ? "" : "s"} from your list.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: clearCheckedShoppingItems,
                      },
                    ],
                  );
                }}
                style={[
                  styles.clearBtn,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Feather name="check" size={14} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.clearText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Clear {checkedCount} bought
                </Text>
              </Pressable>
            )}
            <View style={{ height: 8 }} />
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableShoppingRow
            item={item}
            onToggle={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              toggleShoppingItem(item.id);
            }}
            onRemove={() => removeShoppingItem(item.id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shopping-cart"
            title="Nothing to buy yet"
            subtitle="When pantry items run low, we'll suggest them here. Tap + to add anything else."
          >
            <PrimaryButton
              label="Add an item"
              icon="plus"
              onPress={() => setAddOpen(true)}
            />
          </EmptyState>
        }
      />

      <AddItemModal
        visible={addOpen}
        title="Add to list"
        submitLabel="Add to list"
        onClose={() => setAddOpen(false)}
        onSubmit={(name, category) => {
          addManualShoppingItem(name, category);
          setAddOpen(false);
        }}
      />
    </View>
  );
}

function SwipeableShoppingRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      renderLeftActions={() => <SwipeRemoveAction />}
      onSwipeableLeftOpen={() => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        onRemove();
      }}
    >
      <ShoppingRow item={item} onToggle={onToggle} />
    </Swipeable>
  );
}

function ShoppingRow({
  item,
  onToggle,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
}) {
  const colors = useColors();
  const badgeLabel =
    item.reason === "manual"
      ? "You added"
      : item.reason === "expired"
        ? "Restock"
        : "Suggested";

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Pressable onPress={onToggle} hitSlop={10}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: item.checked ? colors.primary : "transparent",
              borderColor: item.checked ? colors.primary : colors.border,
            },
          ]}
        >
          {item.checked ? (
            <Feather name="check" size={14} color={colors.primaryForeground} />
          ) : null}
        </View>
      </Pressable>
      <CategoryIcon category={item.category} size={36} />
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.rowName,
            {
              color: colors.foreground,
              textDecorationLine: item.checked ? "line-through" : "none",
              opacity: item.checked ? 0.5 : 1,
            },
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
          {badgeLabel} · {item.category}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  clearText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  rowMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
