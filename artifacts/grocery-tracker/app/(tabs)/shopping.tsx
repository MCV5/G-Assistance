import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES, type Category, type ShoppingListItem } from "@/lib/types";

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
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Produce");

  const grouped = useMemo(() => {
    const predicted = shoppingList.filter((s) => s.reason !== "manual");
    const manual = shoppingList.filter((s) => s.reason === "manual");
    return { predicted, manual };
  }, [shoppingList]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;
  const checkedCount = shoppingList.filter((s) => s.checked).length;

  function submitManual() {
    if (!name.trim()) return;
    addManualShoppingItem(name.trim(), category);
    setName("");
    setCategory("Produce");
    setAddOpen(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={[...grouped.predicted, ...grouped.manual]}
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
                  Predicted from your habits, plus anything you add.
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
            {grouped.predicted.length > 0 && (
              <View style={{ marginTop: 16, marginBottom: 8 }}>
                <SectionHeader
                  title="Predicted"
                  caption="Based on how often you buy these"
                />
              </View>
            )}
          </View>
        }
        renderItem={({ item, index }) => {
          const showManualHeader =
            item.reason === "manual" &&
            (index === 0 ||
              (index > 0 &&
                shoppingList.filter((s) => s.reason !== "manual").length ===
                  index));
          return (
            <View>
              {showManualHeader && (
                <View style={{ marginTop: 16, marginBottom: 8 }}>
                  <SectionHeader title="Added by you" />
                </View>
              )}
              <ShoppingRow
                item={item}
                onToggle={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  toggleShoppingItem(item.id);
                }}
                onRemove={() => removeShoppingItem(item.id)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="shopping-cart"
            title="Nothing to buy yet"
            subtitle="Once we learn your habits, predicted restocks will appear here. Add anything else you need with the + button."
          >
            <PrimaryButton
              label="Add an item"
              icon="plus"
              onPress={() => setAddOpen(true)}
            />
          </EmptyState>
        }
      />

      <Modal
        visible={addOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAddOpen(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              New item
            </Text>
            <Pressable onPress={() => setAddOpen(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="What do you need?"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
          <Text
            style={[
              styles.modalSection,
              { color: colors.mutedForeground },
            ]}
          >
            CATEGORY
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
          >
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 24 }}>
            <PrimaryButton
              label="Add to list"
              icon="plus"
              fullWidth
              size="lg"
              disabled={!name.trim()}
              onPress={submitManual}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ShoppingRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const reasonLabel = (() => {
    switch (item.reason) {
      case "predicted":
        return "Restock soon";
      case "expired":
        return "Likely gone";
      case "manual":
        return "Added by you";
    }
  })();

  return (
    <Pressable
      onPress={onToggle}
      onLongPress={() =>
        Alert.alert(item.name, "Remove this from your list?", [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: onRemove },
        ])
      }
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
          {reasonLabel} · {item.category}
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
  modalContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  modalSection: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 20,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  catChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
