import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
import { coerceCategory } from "@/lib/guessCategory";
import { CATEGORIES, type Category, type ScanSource } from "@/lib/types";

function localCalendarDateYyyyMmDd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolvePurchaseDateInput(
  raw: string,
  fallback: string,
): { ok: true; value: string } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: fallback };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false };
  const ms = Date.parse(`${t}T12:00:00`);
  if (Number.isNaN(ms)) return { ok: false };
  return { ok: true, value: t };
}

interface ScanPayload {
  items: ExtractedItem[];
  sourceType: ScanSource;
  storeName?: string;
  purchaseDate?: string;
  /** From analyze API when purchase date was inferred from scan date. */
  purchaseDateIsEstimated?: boolean;
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
      const p = JSON.parse(decodeURIComponent(params.data ?? "")) as ScanPayload;
      const items = (p.items ?? []).map((it) => ({
        ...it,
        category: coerceCategory(it.name, it.category),
      }));
      return { ...p, items };
    } catch {
      return { items: [], sourceType: "receipt" };
    }
  }, [params.data]);

  const [items, setItems] = useState<ExtractedItem[]>(() => initial.items ?? []);
  const [purchaseDate, setPurchaseDate] = useState(
    () => initial.purchaseDate ?? "",
  );
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
    const fallback =
      initial.purchaseDate?.trim() || localCalendarDateYyyyMmDd();
    const resolved = resolvePurchaseDateInput(purchaseDate, fallback);
    if (!resolved.ok) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD, or leave blank to use the suggested date.");
      return;
    }
    setSaving(true);
    try {
      await addScannedItems(
        items,
        initial.sourceType,
        initial.storeName,
        resolved.value,
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
            {!initial.fromBarcode && initial.purchaseDateIsEstimated ? (
              <View
                style={[
                  styles.estimatedBanner,
                  {
                    backgroundColor: `${colors.primary}14`,
                    borderColor: `${colors.primary}40`,
                  },
                ]}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={[styles.estimatedBannerText, { color: colors.foreground }]}>
                  Purchase date was not on the receipt — we used your scan date. Adjust
                  below if needed.
                </Text>
              </View>
            ) : null}
            {!initial.fromBarcode ? (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                  PURCHASE DATE (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={purchaseDate}
                  onChangeText={setPurchaseDate}
                  placeholder={
                    initial.purchaseDate ?? localCalendarDateYyyyMmDd()
                  }
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    styles.purchaseDateInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                />
              </View>
            ) : null}
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
            <CategoryIcon
              category={coerceCategory(item.name, item.category)}
              size={42}
            />
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
  const [category, setCategory] = useState<Category>(() =>
    item ? coerceCategory(item.name, item.category) : "Other",
  );

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQty(String(item.quantity));
      setUnit(item.unit);
      setCategory(coerceCategory(item.name, item.category));
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
  estimatedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  estimatedBannerText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  purchaseDateInput: {
    marginTop: 4,
  },
});
