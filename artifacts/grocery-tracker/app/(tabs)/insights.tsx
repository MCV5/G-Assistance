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

import { boldTheme as D } from "@/constants/colors";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { buildInsightModel, type InsightBarMetric } from "@/lib/insightRules";
import type { Category } from "@/lib/types";

const MIN_SCANS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreLabel(score: number) {
  if (score >= 75) return "Great basket";
  if (score >= 55) return "Balanced";
  return "Needs work";
}

function scoreSub(score: number) {
  if (score >= 75) return "High variety, good fresh coverage this week.";
  if (score >= 55) return "Good balance. A bit more produce would help.";
  return "Low variety detected. Add more fresh and whole foods.";
}

function barStatusLabel(metric: InsightBarMetric): string {
  const v = metric.invert ? 100 - metric.value : metric.value;
  if (v >= 65) return "High ✓";
  if (v >= 40) return "Good ✓";
  if (v >= 20) return "OK";
  return metric.invert ? "Good ✓" : "Low";
}

function barStatusColor(metric: InsightBarMetric): string {
  const v = metric.invert ? 100 - metric.value : metric.value;
  if (v >= 65) return "#2D7A3A";
  if (v >= 40) return "#2D7A3A";
  if (v >= 20) return D.inkMid;
  return metric.invert ? "#2D7A3A" : "#B85C00";
}

function spotlightText(category: Category) {
  if (category === "Fruit" || category === "Vegetables")
    return "High in fibre and micronutrients. Great for daily balance.";
  if (category === "Meat")
    return "Complete protein. High in B12, iron, and zinc.";
  if (category === "Dairy")
    return "Solid protein source for satiety and recovery.";
  if (category === "Prepared")
    return "Convenient choice. Pair with produce to improve balance.";
  if (category === "Bakery")
    return "Choose whole grain options for more fibre and slower energy.";
  return "Useful pantry staple when paired with whole foods.";
}

// Sample model used for the locked preview so new users see compelling content
const PREVIEW_MODEL = {
  score: 72,
  scoreDelta: 8,
  freshDelta: 14,
  preparedDelta: -5,
  organicShare: 0,
  organicDelta: 0,
  bars: [
    { key: "whole_foods", label: "Whole foods",       value: 70, invert: false },
    { key: "protein",     label: "Protein sources",   value: 55, invert: false },
    { key: "fiber",       label: "Fiber-friendly",    value: 48, invert: false },
    { key: "convenience", label: "Convenience foods", value: 22, invert: true  },
  ] as InsightBarMetric[],
  benefits: ["Calcium", "Protein", "Whole grains", "Fibre", "Vitamin C"],
  spotlight: [
    { id: "p1", name: "Eggs",   category: "Dairy"      as Category },
    { id: "p2", name: "Spinach", category: "Vegetables" as Category },
  ],
  action: "Add more leafy greens or fruit to boost your fibre score this week.",
  confidence: { label: "High confidence", note: "" },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantry, scans } = usePantry();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 0 : insets.top;

  const hasEnoughData = scans.length >= MIN_SCANS;

  const liveModel = useMemo(
    () => (hasEnoughData ? buildInsightModel(pantry, scans) : null),
    [pantry, scans, hasEnoughData],
  );

  const model = liveModel ?? PREVIEW_MODEL;

  const wasteStats = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const wasted = pantry.filter(
      (p) => p.wasWasted && p.wastedAt && new Date(p.wastedAt).getTime() > cutoff,
    );
    return { wastedCount: wasted.length, wastedItems: wasted.slice(0, 3) };
  }, [pantry]);

  // Top item for PRO upsell headline
  const topItemName = pantry
    .filter((p) => !p.consumed)
    .sort((a, b) => (b.purchaseCount ?? 1) - (a.purchaseCount ?? 1))[0]?.name ?? "your items";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: D.cream }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header band ── */}
      <View style={[s.header, { paddingTop: topPad + 20 }]}>
        <Text style={s.headerEyebrow}>YOUR HEALTH</Text>
        <View style={s.headerRow}>
          <Text style={s.headerTitle}>INSIGHTS.</Text>
          <View style={s.freeBadge}>
            <Text style={s.freeBadgeTxt}>FREE</Text>
          </View>
        </View>
        <Text style={s.headerSub}>Based on items in your pantry</Text>
      </View>

      {/* ── Content area (preview + optional overlay) ── */}
      <View style={s.contentWrap}>
        {/* Always-rendered content — dimmed when locked */}
        <View
          // @ts-ignore — pointerEvents as prop is valid in RN
          pointerEvents={hasEnoughData ? "auto" : "none"}
          style={{ opacity: hasEnoughData ? 1 : 0.13 }}
        >
          <InsightsContent
            model={model}
            wasteStats={wasteStats}
            topItemName={topItemName}
            colors={colors}
          />
        </View>

        {/* Lock overlay — only shown when not enough scans */}
        {!hasEnoughData && (
          <View style={s.lockOverlay}>
            <View style={s.lockCard}>
              <View style={[s.lockRing, { borderColor: D.greenMid }]}>
                <Text style={[s.lockCount, { color: D.greenMid }]}>
                  {scans.length}/{MIN_SCANS}
                </Text>
              </View>
              <Text style={s.lockTitle}>
                {MIN_SCANS - scans.length} more scan{MIN_SCANS - scans.length === 1 ? "" : "s"} to unlock
              </Text>
              <Text style={s.lockSub}>
                Insights builds a picture of your eating habits from real shopping history. Scan {MIN_SCANS} receipts to unlock.
              </Text>
              <Pressable
                style={s.lockBtn}
                onPress={() => router.push("/(tabs)/scan")}
              >
                <Feather name="camera" size={15} color={D.cream} />
                <Text style={s.lockBtnTxt}>Scan a receipt</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── InsightsContent ──────────────────────────────────────────────────────────

function InsightsContent({
  model,
  wasteStats,
  topItemName,
  colors,
}: {
  model: typeof PREVIEW_MODEL;
  wasteStats: { wastedCount: number; wastedItems: Array<{ id: string; name: string }> };
  topItemName: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s.content}>
      {/* ── Score card ── */}
      <View style={s.scoreCard}>
        <Text style={s.scoreSectionLabel}>THIS WEEK'S BASKET SCORE</Text>
        <View style={s.scoreBody}>
          <View style={s.scoreRingWrap}>
            <View style={s.scoreRing}>
              <Text style={s.scoreNum}>{model.score}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.scoreLabel}>{scoreLabel(model.score)}</Text>
            <Text style={s.scoreSubTxt}>{scoreSub(model.score)}</Text>
          </View>
        </View>
      </View>

      {/* ── Nutrition snapshot ── */}
      <Text style={s.sectionLabel}>NUTRITION SNAPSHOT</Text>
      <View style={[s.card, { gap: 10 }]}>
        {model.bars.map((metric) => (
          <View key={metric.key} style={s.barRow}>
            <Text style={s.barLabel}>{metric.label}</Text>
            <View style={s.barTrack}>
              <View
                style={[
                  s.barFill,
                  {
                    width: `${Math.max(4, Math.min(100, Math.round(metric.value)))}%`,
                    backgroundColor: metric.invert ? D.amber : D.greenMid,
                  },
                ]}
              />
            </View>
            <Text style={[s.barStatus, { color: barStatusColor(metric) }]}>
              {barStatusLabel(metric)}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Benefits ── */}
      <Text style={s.sectionLabel}>BENEFITS IN YOUR PANTRY</Text>
      <View style={s.chips}>
        {model.benefits.map((chip) => (
          <View key={chip} style={s.chip}>
            <Text style={s.chipTxt}>{chip.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* ── Item spotlight ── */}
      {model.spotlight.length > 0 && (
        <>
          <Text style={s.sectionLabel}>ITEM SPOTLIGHT</Text>
          <View style={{ gap: 8 }}>
            {model.spotlight.map((sp) => (
              <View key={sp.id} style={s.spotlightCard}>
                <View style={s.spotlightHead}>
                  <Text style={s.spotlightName}>{sp.name}</Text>
                  <Text style={s.spotlightCat}>{sp.category.toUpperCase()}</Text>
                </View>
                <Text style={s.spotlightBody}>{spotlightText(sp.category)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ── Food waste ── */}
      <View style={[s.wasteCard, wasteStats.wastedCount > 0 && s.wasteCardAlert]}>
        <View style={s.wasteHead}>
          <Feather
            name="trash-2"
            size={13}
            color={wasteStats.wastedCount > 0 ? "#c0392b" : D.inkLight}
          />
          <Text style={[s.wasteTitleTxt, wasteStats.wastedCount > 0 && { color: "#c0392b" }]}>
            Food waste · last 30 days
          </Text>
          <Text style={[s.wasteCountTxt, wasteStats.wastedCount > 0 && { color: "#c0392b" }]}>
            {wasteStats.wastedCount} item{wasteStats.wastedCount === 1 ? "" : "s"}
          </Text>
        </View>
        {wasteStats.wastedCount === 0 ? (
          <Text style={s.wasteNone}>
            No waste recorded. Tap "It Was Wasted" on any pantry item to track it.
          </Text>
        ) : (
          wasteStats.wastedItems.map((w) => (
            <Text key={w.id} style={s.wasteItemTxt}>· {w.name}</Text>
          ))
        )}
      </View>

      {/* ── Improve this week ── */}
      <View style={s.actionCard}>
        <Text style={s.actionLabel}>IMPROVE THIS WEEK</Text>
        <Text style={s.actionBody}>{model.action}</Text>
      </View>

      {/* ── PRO feature upsell ── */}
      <View style={s.proCard}>
        <Text style={s.proLabel}>PRO FEATURE</Text>
        <Text style={s.proTitle}>
          You bought {topItemName} — here's what to make.
        </Text>
        <Text style={s.proBody}>
          Get personalised recipes based on exactly what's in your pantry right now.
        </Text>
        <Pressable style={s.proBtn}>
          <Text style={s.proBtnTxt}>UNLOCK PRO  →</Text>
        </Pressable>
      </View>

      {/* ── Shopping journey (Pro teaser) ── */}
      <View style={s.journeyCard}>
        <Text style={s.journeyLabel}>PRO · COMING SOON</Text>
        <Text style={s.journeyTitle}>Your shopping journey</Text>
        <Text style={s.journeyBody}>
          A timeline of scans, restocks, what you finished vs. wasted, and how your basket evolves week to week — all in one story you can actually learn from.
        </Text>
        <View style={s.journeyLockRow}>
          <Feather name="lock" size={14} color={D.inkLight} />
          <Text style={s.journeyLockTxt}>Included with Pro</Text>
        </View>
      </View>

      <Text style={s.disclaimer}>
        Directional estimates from pantry category data, not medical advice.
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header band
  header: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  headerEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: D.cream,
    letterSpacing: -0.5,
  },
  freeBadge: {
    backgroundColor: "rgba(168,201,127,0.25)",
    borderWidth: 1,
    borderColor: "rgba(168,201,127,0.4)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  freeBadgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: D.greenLight,
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(197,220,168,0.75)",
  },

  // Content + lock overlay
  contentWrap: {
    position: "relative",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 0,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  lockCard: {
    width: "100%",
    backgroundColor: D.cream,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: D.creamBorder,
    padding: 24,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  lockRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  lockCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  lockTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: D.inkBlack,
    textAlign: "center",
  },
  lockSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkMid,
    textAlign: "center",
    lineHeight: 19,
  },
  lockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: D.greenMid,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 999,
    marginTop: 6,
  },
  lockBtnTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.cream,
  },

  // Score card (dark green)
  scoreCard: {
    backgroundColor: D.greenMid,
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
  },
  scoreSectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  scoreBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreRingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  scoreRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: D.greenLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  scoreNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: D.cream,
  },
  scoreLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: D.cream,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  scoreSubTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(197,220,168,0.8)",
    lineHeight: 17,
  },

  // Section label
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkLight,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },

  // Card wrapper
  card: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },

  // Bars
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.inkBlack,
    width: 110,
  },
  barTrack: {
    flex: 1,
    height: 7,
    backgroundColor: D.creamBorder,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  barStatus: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    width: 52,
    textAlign: "right",
  },

  // Benefit chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: D.greenMid,
    letterSpacing: 0.5,
  },

  // Spotlight
  spotlightCard: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  spotlightHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  spotlightName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: D.inkBlack,
  },
  spotlightCat: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 0.8,
    color: D.inkLight,
  },
  spotlightBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.greenMid,
    lineHeight: 17,
  },

  // Waste card
  wasteCard: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 20,
    marginTop: 12,
  },
  wasteCardAlert: {
    backgroundColor: "#fff0ee",
    borderColor: "#c0392b44",
  },
  wasteHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  wasteTitleTxt: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.inkMid,
  },
  wasteCountTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.inkMid,
  },
  wasteNone: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    lineHeight: 17,
  },
  wasteItemTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#c0392b",
  },

  // Improve this week
  actionCard: {
    backgroundColor: `${D.greenMid}14`,
    borderWidth: 1,
    borderColor: `${D.greenMid}30`,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  actionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.greenMid,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  actionBody: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: D.inkBlack,
    lineHeight: 19,
  },

  // PRO upsell
  proCard: {
    borderWidth: 1.5,
    borderColor: D.creamBorder,
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 16,
    gap: 6,
    marginBottom: 20,
  },
  proLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkLight,
    textTransform: "uppercase",
  },
  proTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: D.inkBlack,
    lineHeight: 22,
  },
  proBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkMid,
    lineHeight: 17,
  },
  proBtn: {
    alignSelf: "flex-start",
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  proBtnTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: D.cream,
    letterSpacing: 1,
  },

  journeyCard: {
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    marginBottom: 20,
    backgroundColor: `${D.greenMid}08`,
  },
  journeyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkLight,
    textTransform: "uppercase",
  },
  journeyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: D.inkBlack,
  },
  journeyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkMid,
    lineHeight: 18,
  },
  journeyLockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  journeyLockTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: D.inkLight,
  },

  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkLight,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 8,
  },
});
