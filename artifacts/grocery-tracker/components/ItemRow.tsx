import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { StatusPill } from "@/components/StatusPill";
import { useColors } from "@/hooks/useColors";
import { getCategoryTone } from "@/lib/categories";
import {
  getDaysUntilNeeded,
  getItemStatus,
  summarizeCadence,
} from "@/lib/predictions";
import type { PantryItem } from "@/lib/types";

interface Props {
  item: PantryItem;
  onPress?: () => void;
  rightAction?: React.ReactNode;
  showCadence?: boolean;
}

function formatDays(days: number): string {
  if (days === 0) return "Due today";
  if (days > 0) return `Need in ${days}d`;
  return `${Math.abs(days)}d overdue`;
}

export function ItemRow({
  item,
  onPress,
  rightAction,
  showCadence = true,
}: Props) {
  const colors = useColors();
  const status = getItemStatus(item);
  const days = getDaysUntilNeeded(item);
  const tone = getCategoryTone(item.category);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: tone,
          borderLeftWidth: 3,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <CategoryIcon category={item.category} size={34} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: colors.foreground }]}
          >
            {item.name}
          </Text>
          <Text style={[styles.qty, { color: colors.mutedForeground }]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <StatusPill status={status} />
          {item.isOrganic ? (
            <View style={[styles.organicPill, { backgroundColor: `${colors.success}22` }]}>
              <Text style={[styles.organicText, { color: colors.success }]}>ORG</Text>
            </View>
          ) : null}
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {showCadence
              ? `${formatDays(days)} · ${summarizeCadence(item)}`
              : formatDays(days)}
          </Text>
        </View>
      </View>
      {rightAction ?? (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    minHeight: 68,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  qty: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
    overflow: "hidden",
  },
  meta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    flexShrink: 1,
  },
  organicPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  organicText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    letterSpacing: 0.5,
  },
});
