import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { guessCategory } from "@/lib/guessCategory";
import { CATEGORIES, type Category } from "@/lib/types";

const CATEGORY_EMOJI: Record<Category, string> = {
  Fruit: "🍎",
  Vegetables: "🥦",
  Dairy: "🥛",
  Meat: "🥩",
  Pantry: "🥫",
  Bakery: "🍞",
  Beverages: "🧃",
  Frozen: "🧊",
  Snacks: "🍿",
  Household: "🧹",
  "Personal Care": "🧴",
  Prepared: "🥡",
  Other: "📦",
};

interface Props {
  visible: boolean;
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (name: string, category: Category) => void;
}

export function AddItemModal({
  visible,
  title = "Add item",
  submitLabel = "Add",
  onClose,
  onSubmit,
}: Props) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [overridden, setOverridden] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Auto-detect category whenever name changes (unless manually overridden)
  useEffect(() => {
    if (!overridden) {
      setCategory(guessCategory(name));
    }
  }, [name, overridden]);

  function handleClose() {
    setName("");
    setCategory("Other");
    setOverridden(false);
    setShowPicker(false);
    Keyboard.dismiss();
    onClose();
  }

  function handleSubmit() {
    if (!name.trim()) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(name.trim(), category);
    setName("");
    setCategory("Other");
    setOverridden(false);
    setShowPicker(false);
  }

  function pickCategory(c: Category) {
    setCategory(c);
    setOverridden(true);
    setShowPicker(false);
  }

  const emoji = CATEGORY_EMOJI[category];
  const canSubmit = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[s.sheet, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* Name input */}
        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Whole milk, Chicken breast…"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          style={[
            s.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.foreground,
            },
          ]}
        />

        {/* Auto-detected category badge */}
        <View style={s.catRow}>
          <Text style={[s.catLabel, { color: colors.mutedForeground }]}>Category</Text>
          <Pressable
            onPress={() => setShowPicker((v) => !v)}
            style={[
              s.catBadge,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={s.catEmoji}>{emoji}</Text>
            <Text style={[s.catName, { color: colors.foreground }]}>{category}</Text>
            {!overridden && (
              <View style={[s.autoPill, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[s.autoText, { color: colors.primary }]}>auto</Text>
              </View>
            )}
            <Feather
              name={showPicker ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.mutedForeground}
            />
          </Pressable>
        </View>

        {/* Category picker (compact grid) */}
        {showPicker && (
          <ScrollView
            style={s.pickerScroll}
            contentContainerStyle={s.pickerGrid}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => pickCategory(c)}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={s.chipEmoji}>{CATEGORY_EMOJI[c]}</Text>
                  <Text
                    style={[
                      s.chipText,
                      { color: active ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Submit button */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            s.submitBtn,
            {
              backgroundColor: canSubmit ? colors.primary : colors.border,
            },
          ]}
        >
          <Feather
            name="plus"
            size={18}
            color={canSubmit ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              s.submitText,
              { color: canSubmit ? colors.primaryForeground : colors.mutedForeground },
            ]}
          >
            {submitLabel}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    marginBottom: 16,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  catLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    minWidth: 64,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  catEmoji: {
    fontSize: 16,
  },
  catName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  autoPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  autoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.4,
  },
  pickerScroll: {
    maxHeight: 200,
    marginBottom: 12,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    marginTop: 8,
  },
  submitText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
});
