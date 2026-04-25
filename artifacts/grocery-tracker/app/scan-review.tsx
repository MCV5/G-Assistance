import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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
import type { ExtractedItem } from "@workspace/api-client-react";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { CATEGORIES, type Category, type ScanSource } from "@/lib/types";

interface ScanPayload {
  items: ExtractedItem[];
  sourceType: ScanSource;
  storeName?: string;
  purchaseDate?: string;
  fromBarcode?: boolean;
  notFound?: boolean;
  barcode?: string;
}

export default function ScanReviewScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ data: string }>();
  const { addScannedItems } = usePantry();

  const initial = useMemo<ScanPayload>(() => {
    try {
      return JSON.parse(decodeURIComponent(params.data ?? "")) as ScanPayload;
    } catch {
      return { items: [], sourceType: "receipt" };
    }
  }, [params.data]);

  const [items, setItems] = useState<ExtractedItem[]>(initial.items ?? []);
  const [editing, setEditing] = useState<{ index: number; item: ExtractedItem } | null>(null);
  const [saving, setSaving] = useState(false);

  function updateItem(index: number, next: ExtractedItem) {
    setItems((prev) => prev.map((it, i) => (i === index ? next : it)));
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (items.length === 0) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      await addScannedItems(
        items,
        initial.sourceType,
        initial.storeName,
        initial.purchaseDate,
      );
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.back();
    } catch {
      Alert.alert("Couldn't save", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={items}
        keyExtractor={(_, idx) => `item_${idx}`}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 140,
          gap: 10,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {initial.fromBarcode
                ? initial.notFound
                  ? "Barcode not in database"
                  : "Product found"
                : `${items.length} item${items.length === 1 ? "" : "s"} found`}
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {initial.fromBarcode && initial.notFound
                ? `We couldn't find barcode ${initial.barcode ?? ""} in our database. Edit the name and category below, then add it to your pantry.`
                : initial.storeName
                  ? `From ${initial.storeName}. Tap any item to edit. Long-press to remove.`
                  : "Tap any item to edit. Long-press to remove."}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => setEditing({ index, item })}
            onLongPress={() =>
              Alert.alert(item.name, "Remove from this scan?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => removeAt(index),
                },
              ])
            }
            style={({ pressed }) => [
              styles.itemRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <CategoryIcon category={item.category as Category} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>
                {item.name}
              </Text>
              <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                {item.quantity} {item.unit} · {item.category}
              </Text>
            </View>
            <Feather name="edit-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="image"
            title="No items detected"
            subtitle="The image was unclear. Try another photo with better lighting."
          />
        }
      />
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <PrimaryButton
          label={items.length === 0 ? "Close" : `Add ${items.length} to pantry`}
          icon={items.length === 0 ? "x" : "check"}
          fullWidth
          size="lg"
          loading={saving}
          onPress={save}
        />
      </View>

      <EditItemModal
        visible={!!editing}
        item={editing?.item ?? null}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          if (editing) updateItem(editing.index, next);
          setEditing(null);
        }}
      />
    </View>
  );
}

function EditItemModal({
  visible,
  item,
  onClose,
  onSave,
}: {
  visible: boolean;
  item: ExtractedItem | null;
  onClose: () => void;
  onSave: (item: ExtractedItem) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState(item?.name ?? "");
  const [qty, setQty] = useState(String(item?.quantity ?? 1));
  const [unit, setUnit] = useState(item?.unit ?? "piece");
  const [category, setCategory] = useState<Category>(
    (item?.category as Category) ?? "Other",
  );

  // Reset state when item changes
  useMemo(() => {
    if (item) {
      setName(item.name);
      setQty(String(item.quantity));
      setUnit(item.unit);
      setCategory(item.category as Category);
    }
  }, [item]);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            Edit item
          </Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
          NAME
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
              QTY
            </Text>
            <TextInput
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
              UNIT
            </Text>
            <TextInput
              value={unit}
              onChangeText={setUnit}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          </View>
        </View>
        <Text
          style={[
            styles.modalLabel,
            { color: colors.mutedForeground, marginTop: 16 },
          ]}
        >
          CATEGORY
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
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
            label="Save changes"
            icon="check"
            fullWidth
            size="lg"
            onPress={() => {
              const parsedQty = parseFloat(qty);
              onSave({
                ...item,
                name: name.trim() || item.name,
                quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
                unit: unit.trim() || "piece",
                category,
              });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  itemName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  itemMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
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
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  modalLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
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
