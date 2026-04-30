import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getCategoryBreakdown } from "@/lib/insights";

const FRESH_CATEGORIES = new Set([
  "Fruit",
  "Vegetables",
  "Meat",
  "Dairy",
  "Bakery",
  "Prepared",
]);

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantry } = usePantry();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;

  const freshShare = useMemo(() => {
    if (pantry.length === 0) return null;
    const breakdown = getCategoryBreakdown(pantry);
    let fresh = 0;
    let total = 0;
    for (const row of breakdown) {
      total += row.count;
      if (FRESH_CATEGORIES.has(row.category)) fresh += row.count;
    }
    if (total === 0) return null;
    return Math.round((fresh / total) * 100);
  }, [pantry]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Insights</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Health-focused guidance from your pantry and shopping — coming together here.
      </Text>

      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: `${colors.primary}1a` },
          ]}
        >
          <Feather name="heart" size={22} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Eating & wellness insights
        </Text>
        <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
          Soon this space will highlight balance across food groups, how often fresh
          items show up in your scans, and gentle nudges based on your habits — all
          from data you already add when you shop.
        </Text>
        <View style={{ marginTop: 14, gap: 10 }}>
          <Bullet colors={colors} text="Variety and whole-food share from your categories" />
          <Bullet colors={colors} text="Rhythm of produce, protein, and prepared foods" />
          <Bullet colors={colors} text="Optional goals you set (e.g. more vegetables per week)" />
        </View>
      </View>

      {pantry.length > 0 && freshShare != null ? (
        <View
          style={[
            styles.snapshot,
            { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}35` },
          ]}
        >
          <Text style={[styles.snapshotLabel, { color: colors.primary }]}>
            Early snapshot
          </Text>
          <Text style={[styles.snapshotValue, { color: colors.foreground }]}>
            About {freshShare}% of tracked line items are fresh or short-shelf categories
            (fruit, vegetables, meat, dairy, bakery, prepared).
          </Text>
          <Text style={[styles.snapshotHint, { color: colors.mutedForeground }]}>
            This is a simple ratio from your pantry labels, not medical advice.
          </Text>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          <EmptyState
            icon="heart"
            title="Add a few items first"
            subtitle="Scan receipts or add pantry items so we can summarize patterns for health insights."
          />
        </View>
      )}

      <Text
        style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 28 }]}
      >
        RELATED
      </Text>
      <Pressable
        onPress={() => router.push("/activity")}
        style={({ pressed }) => [
          styles.linkRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Feather name="bar-chart-2" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, { color: colors.foreground }]}>
            Shopping activity
          </Text>
          <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>
            Restock predictions, most-bought items, and category mix
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          label="Open shopping activity"
          icon="bar-chart-2"
          variant="secondary"
          fullWidth
          size="lg"
          onPress={() => router.push("/activity")}
        />
      </View>
    </ScrollView>
  );
}

function Bullet({
  colors,
  text,
}: {
  colors: ReturnType<typeof useColors>;
  text: string;
}) {
  return (
    <View style={styles.bulletRow}>
      <Feather name="check-circle" size={16} color={colors.success} />
      <Text style={[styles.bulletText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 8,
  },
  heroBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  snapshot: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  snapshotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  snapshotValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  snapshotHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  linkTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  linkSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
