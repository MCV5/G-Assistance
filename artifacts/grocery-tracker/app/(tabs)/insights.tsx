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
import { buildInsightModel, type InsightBarMetric } from "@/lib/insightRules";
import type { Category } from "@/lib/types";

function clampPct(v: number) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function scoreLabel(score: number) {
  if (score >= 75) return "Great basket";
  if (score >= 55) return "Balanced";
  return "Needs work";
}

function barStatus(metric: InsightBarMetric): "Good" | "OK" | "Low" {
  const v = metric.invert ? 100 - metric.value : metric.value;
  if (v >= 65) return "Good";
  if (v >= 40) return "OK";
  return "Low";
}

function spotlightText(category: Category) {
  if (category === "Fruit" || category === "Vegetables") {
    return "High in fiber and micronutrients. Great for daily balance.";
  }
  if (category === "Meat" || category === "Dairy") {
    return "Solid protein source for satiety and recovery.";
  }
  if (category === "Prepared") {
    return "Convenient choice. Pair with produce to improve balance.";
  }
  return "Useful pantry staple when paired with whole foods.";
}

function DeltaChip({
  label,
  value,
  suffix,
  colors,
  invert = false,
}: {
  label: string;
  value: number;
  suffix: string;
  colors: ReturnType<typeof useColors>;
  invert?: boolean;
}) {
  const effective = invert ? -value : value;
  const trend: "up" | "down" | "flat" =
    effective > 0 ? "up" : effective < 0 ? "down" : "flat";
  const icon = trend === "up" ? "trending-up" : trend === "down" ? "trending-down" : "minus";
  const fg =
    trend === "up" ? "#1b6a3a" : trend === "down" ? "#8a5600" : colors.mutedForeground;
  const bg = trend === "up" ? "#e8f7ee" : trend === "down" ? "#fff4db" : `${colors.mutedForeground}22`;
  const sign = value > 0 ? "+" : "";

  return (
    <View style={[styles.deltaChip, { backgroundColor: bg }]}>
      <Text style={[styles.deltaChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.deltaChipMain}>
        <Feather name={icon} size={12} color={fg} />
        <Text style={[styles.deltaChipValue, { color: fg }]}>{`${sign}${value}${suffix}`}</Text>
      </View>
    </View>
  );
}

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantry, scans } = usePantry();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;

  const model = useMemo(() => buildInsightModel(pantry, scans), [pantry, scans]);

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
        Visual nutrition snapshots from your pantry habits.
      </Text>

      {pantry.length > 0 ? (
        <View
          style={[
            styles.snapshot,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.hero,
              { backgroundColor: `${colors.primary}16`, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.scoreRing,
                { borderColor: colors.primary, backgroundColor: colors.background },
              ]}
            >
              <Text style={[styles.scoreValue, { color: colors.foreground }]}>
                {model.score}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreTitle, { color: colors.foreground }]}>
                This week's basket score
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.primary }]}>
                {scoreLabel(model.score)}
              </Text>
              <Text style={[styles.scoreSub, { color: colors.mutedForeground }]}>
                Based on items currently in your pantry.
              </Text>
              <View
                style={[
                  styles.confidencePill,
                  {
                    backgroundColor:
                      model.confidence.label === "High confidence"
                        ? `${colors.success}22`
                        : model.confidence.label === "Medium confidence"
                          ? "#fff4db"
                          : `${colors.mutedForeground}22`,
                  },
                ]}
              >
                <Feather
                  name="shield"
                  size={11}
                  color={
                    model.confidence.label === "High confidence"
                      ? colors.success
                      : model.confidence.label === "Medium confidence"
                        ? "#8a5600"
                        : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.confidenceText,
                    {
                      color:
                        model.confidence.label === "High confidence"
                          ? colors.success
                          : model.confidence.label === "Medium confidence"
                            ? "#8a5600"
                            : colors.mutedForeground,
                    },
                  ]}
                >
                  {model.confidence.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.deltaRow}>
            <DeltaChip label="Score" value={model.scoreDelta} suffix=" pts" colors={colors} />
            <DeltaChip label="Fresh" value={model.freshDelta} suffix=" pp" colors={colors} />
            <DeltaChip
              label="Prepared"
              value={model.preparedDelta}
              suffix=" pp"
              colors={colors}
              invert
            />
          </View>

          <View
            style={[
              styles.organicCard,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <View>
              <Text style={[styles.organicLabel, { color: colors.mutedForeground }]}>
                Organic share
              </Text>
              <Text style={[styles.organicValue, { color: colors.foreground }]}>
                {model.organicShare}%
              </Text>
            </View>
            <DeltaChip
              label="vs last week"
              value={model.organicDelta}
              suffix=" pp"
              colors={colors}
            />
          </View>

          <Text style={[styles.snapshotLabel, { color: colors.foreground }]}>Nutrition snapshot</Text>
          <View style={{ gap: 9 }}>
            {model.bars.map((metric) => (
              <View key={metric.key}>
                <View style={styles.barHead}>
                  <Text style={[styles.barLabel, { color: colors.foreground }]}>
                    {metric.label}
                  </Text>
                  <Text style={[styles.barStatus, { color: colors.mutedForeground }]}>
                    {barStatus(metric)}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(4, clampPct(metric.value))}%`,
                        backgroundColor: metric.invert ? "#cc8f2a" : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.snapshotLabel, { color: colors.foreground, marginTop: 14 }]}>
            Benefits in your pantry
          </Text>
          <View style={styles.chips}>
            {model.benefits.length > 0 ? (
              model.benefits.map((chip) => (
                <View
                  key={chip}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>{chip}</Text>
                </View>
              ))
            ) : (
              <Text style={[styles.snapshotHint, { color: colors.mutedForeground }]}>
                Add a few more category types to unlock benefit tags.
              </Text>
            )}
          </View>

          {model.spotlight.length > 0 ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <Text style={[styles.snapshotLabel, { color: colors.foreground }]}>Item spotlight</Text>
              {model.spotlight.map((s) => (
                <View
                  key={s.id}
                  style={[
                    styles.spotlightCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.spotlightHead}>
                    <Text style={[styles.spotlightName, { color: colors.foreground }]}>{s.name}</Text>
                    <Text style={[styles.spotlightCat, { color: colors.mutedForeground }]}>
                      {s.category}
                    </Text>
                  </View>
                  <Text style={[styles.spotlightBody, { color: colors.mutedForeground }]}>
                    {spotlightText(s.category)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.actionCard,
              { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}40` },
            ]}
          >
            <Text style={[styles.actionTitle, { color: colors.primary }]}>
              Improve this week
            </Text>
            <Text style={[styles.actionBody, { color: colors.foreground }]}>
              {model.action}
            </Text>
          </View>

          <Text style={[styles.snapshotHint, { color: colors.mutedForeground }]}>
            {model.confidence.note} Directional estimate from pantry category data, not medical advice.
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
    marginBottom: 14,
    lineHeight: 19,
  },
  snapshot: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  deltaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  deltaChip: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  deltaChipLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  deltaChipMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deltaChipValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  organicCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  organicLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  organicValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    marginTop: 2,
  },
  scoreRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  scoreTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreLabel: {
    marginTop: 2,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  scoreSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 1,
    lineHeight: 17,
  },
  confidencePill: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  confidenceText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10.5,
  },
  snapshotLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginBottom: 6,
  },
  barHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  barStatus: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  spotlightCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  spotlightHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  spotlightName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  spotlightCat: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  spotlightBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },
  actionCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  actionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  actionBody: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  snapshotHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 10,
    lineHeight: 17,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 8,
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
