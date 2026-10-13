import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "@/components/CategoryIcon";
import { boldTheme as D } from "@/constants/colors";
import { usePantry } from "@/contexts/PantryContext";
import {
  computeScanRhythm,
  computeSummary,
  getCategoryBreakdown,
  getMostPredictable,
  getNutritionLabelCoverage,
  getPredictedRestocks,
  getTopItems,
  groupPredictedRestocks,
} from "@/lib/insights";
import { getFamilyIntervalStats } from "@/lib/personalIntervals";
import { getCategoryTone } from "@/lib/categories";

function dueLabel(days: number): string {
  if (days <= 0) return "Now";
  if (days === 1) return "~1 day";
  return `~${days} days`;
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    Fruit: "🍎",
    Vegetables: "🥦",
    Dairy: "🥛",
    Meat: "🥩",
    Pantry: "🫙",
    Bakery: "🍞",
    Beverages: "🧃",
    Frozen: "🧊",
    Snacks: "🍿",
    Household: "🧹",
    "Personal Care": "🧴",
    Prepared: "🥡",
    Other: "📦",
  };
  return map[cat] ?? "📦";
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pantry, scans, predictionCtx } = usePantry();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 0 : insets.top;

  const summary = useMemo(
    () => computeSummary(pantry, scans),
    [pantry, scans],
  );
  const scanRhythm = useMemo(() => computeScanRhythm(scans), [scans]);
  const topItems = useMemo(() => getTopItems(pantry, 5), [pantry]);
  const familyRhythms = useMemo(
    () => getFamilyIntervalStats(pantry).slice(0, 4),
    [pantry],
  );
  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(pantry.filter((p) => !p.consumed)),
    [pantry],
  );
  const groupedRestocks = useMemo(() => {
    const restocks = getPredictedRestocks(
      pantry.filter((p) => !p.consumed),
      14,
      predictionCtx,
    );
    return groupPredictedRestocks(restocks);
  }, [pantry, predictionCtx]);
  const predictable = useMemo(
    () => getMostPredictable(pantry, 4),
    [pantry],
  );
  const nutritionCoverage = useMemo(
    () => getNutritionLabelCoverage(pantry),
    [pantry],
  );

  const wasteStats = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    const wasted = pantry.filter(
      (p) => p.wasWasted && p.wastedAt && new Date(p.wastedAt).getTime() > cutoff,
    );
    return { wastedCount: wasted.length, wastedItems: wasted.slice(0, 3) };
  }, [pantry]);

  const activeCount = pantry.filter((p) => !p.consumed).length;
  const hasData = scans.length > 0 || activeCount > 0;

  const changeIcon =
    summary.weeklyChange > 0
      ? "trending-up"
      : summary.weeklyChange < 0
        ? "trending-down"
        : "minus";
  const changeText =
    summary.weeklyChange === 0
      ? "Same as last week"
      : `${summary.weeklyChange > 0 ? "+" : ""}${summary.weeklyChange}% vs last week`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: D.cream }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.header, { paddingTop: topPad + 20 }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/pantry");
          }}
          style={s.backRow}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={20} color={D.cream} />
          <Text style={s.backText}>Back</Text>
        </Pressable>
        <Text style={s.headerEyebrow}>FROM YOUR TRIPS</Text>
        <Text style={s.headerTitle}>Patterns</Text>
        <Text style={s.headerSub}>
          How often you shop, what you buy, what may need restocking
        </Text>
      </View>

      <View style={s.body}>
        {!hasData ? (
          <View style={s.emptyCard}>
            <Feather name="bar-chart-2" size={28} color={D.greenMid} />
            <Text style={s.emptyTitle}>No patterns yet</Text>
            <Text style={s.emptySub}>
              Scan a receipt and we&apos;ll show how often you shop, what you
              buy most, and what may need restocking soon.
            </Text>
            <Pressable
              style={({ pressed }) => [
                s.emptyBtn,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => router.push("/(tabs)/scan")}
            >
              <Feather name="camera" size={15} color={D.cream} />
              <Text style={s.emptyBtnTxt}>Scan a receipt</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.rhythmCard}>
              <Text style={s.cardEyebrow}>SHOPPING RHYTHM</Text>
              <Text style={s.rhythmLine}>{scanRhythm.rhythmLine}</Text>
              <View style={s.rhythmStats}>
                <RhythmStat
                  label="This week"
                  value={String(summary.itemsBoughtThisWeek)}
                  sub="items bought"
                />
                <RhythmStat
                  label="Scans"
                  value={String(scanRhythm.totalScans)}
                  sub="all time"
                />
                <RhythmStat
                  label="Usual gap"
                  value={
                    summary.averageCadenceDays
                      ? `${summary.averageCadenceDays}d`
                      : "—"
                  }
                  sub="between rebuys"
                />
              </View>
              {summary.itemsBoughtThisWeek > 0 ||
              summary.itemsBoughtLastWeek > 0 ? (
                <View style={s.deltaRow}>
                  <Feather name={changeIcon} size={13} color={D.greenLight} />
                  <Text style={s.deltaTxt}>{changeText}</Text>
                </View>
              ) : null}
            </View>

            {groupedRestocks.length > 0 && (
              <Section title="RESTOCK FORECAST" sub="Based on your usual timing">
                <View style={{ gap: 8 }}>
                  {groupedRestocks.map((group) => (
                    <View key={group.id} style={s.rowCard}>
                      <CategoryIcon category={group.category} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {group.label}
                        </Text>
                        <Text style={s.rowMeta}>
                          {group.category}
                          {group.count > 1 ? ` · ${group.count} items` : ""}
                        </Text>
                      </View>
                      <Text
                        style={[
                          s.dueBadge,
                          group.dueInDays <= 0 && s.dueBadgeUrgent,
                        ]}
                      >
                        {dueLabel(group.dueInDays)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {familyRhythms.length > 0 && (
              <Section
                title="REPEAT CYCLES"
                sub="How often you restock similar items"
              >
                <View style={s.listCard}>
                  {familyRhythms.map((fam, i) => (
                    <View
                      key={fam.family}
                      style={[s.listRow, i > 0 && s.listRowBorder]}
                    >
                      <Text style={s.listTitle}>{fam.family}</Text>
                      <Text style={s.listValue}>
                        ~{fam.medianDays}d
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {topItems.length > 0 && (
              <Section title="MOST BOUGHT" sub="Staples in your kitchen">
                <View style={s.listCard}>
                  {topItems.map((item, i) => (
                    <View
                      key={item.id}
                      style={[s.listRow, i > 0 && s.listRowBorder]}
                    >
                      <Text style={s.rank}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={s.rowMeta}>
                          {item.category}
                          {item.cadenceDays
                            ? ` · every ~${item.cadenceDays}d`
                            : ""}
                        </Text>
                      </View>
                      <Text style={s.countPill}>{item.purchaseCount}×</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {categoryBreakdown.length > 0 && (
              <Section title="PANTRY MIX" sub="Active items by category">
                <View style={s.listCard}>
                  {categoryBreakdown.slice(0, 6).map((c, i) => (
                    <View
                      key={c.category}
                      style={[s.catBlock, i > 0 && s.listRowBorder]}
                    >
                      <View style={s.catHead}>
                        <Text style={s.catEmoji}>
                          {categoryEmoji(c.category)}
                        </Text>
                        <Text style={s.listTitle}>{c.category}</Text>
                        <Text style={s.catCount}>{c.count}</Text>
                      </View>
                      <View style={s.barTrack}>
                        <View
                          style={[
                            s.barFill,
                            {
                              width: `${Math.max(
                                6,
                                Math.round(
                                  (c.count /
                                    (categoryBreakdown[0]?.count ?? 1)) *
                                    100,
                                ),
                              )}%`,
                              backgroundColor: getCategoryTone(c.category),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {predictable.length > 0 && (
              <Section title="LIKE CLOCKWORK" sub="Very consistent rebuys">
                <View style={{ gap: 8 }}>
                  {predictable.map((item) => (
                    <View key={item.id} style={s.rowCard}>
                      <CategoryIcon category={item.category} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={s.rowMeta}>
                          Every ~{item.cadenceDays} days
                        </Text>
                      </View>
                      <View style={s.consistencyPill}>
                        <Feather name="zap" size={11} color={D.greenMid} />
                        <Text style={s.consistencyTxt}>
                          {item.consistency}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {nutritionCoverage.total > 0 && (
              <Section title="NUTRITION LABELS" sub="Items with real label data">
                <View style={s.nutCard}>
                  <Text style={s.nutBig}>
                    {nutritionCoverage.labeled}
                    <Text style={s.nutBigMuted}>
                      {" "}
                      / {nutritionCoverage.total}
                    </Text>
                  </Text>
                  <Text style={s.nutSub}>
                    {nutritionCoverage.labeled === 0
                      ? "Open item details after scanning to fetch USDA or Open Food Facts data."
                      : "Label-backed nutrition from scans and item lookups. Estimates used when no label is found."}
                  </Text>
                </View>
              </Section>
            )}

            <View
              style={[
                s.wasteCard,
                wasteStats.wastedCount > 0 && s.wasteCardAlert,
              ]}
            >
              <View style={s.wasteHead}>
                <Feather
                  name="trash-2"
                  size={13}
                  color={wasteStats.wastedCount > 0 ? "#c0392b" : D.inkLight}
                />
                <Text
                  style={[
                    s.wasteTitle,
                    wasteStats.wastedCount > 0 && { color: "#c0392b" },
                  ]}
                >
                  Food waste · last 30 days
                </Text>
                <Text
                  style={[
                    s.wasteCount,
                    wasteStats.wastedCount > 0 && { color: "#c0392b" },
                  ]}
                >
                  {wasteStats.wastedCount}
                </Text>
              </View>
              {wasteStats.wastedCount === 0 ? (
                <Text style={s.wasteNone}>
                  Nothing marked wasted. Use &quot;It was wasted&quot; on a
                  pantry item if you toss it.
                </Text>
              ) : (
                wasteStats.wastedItems.map((w) => (
                  <Text key={w.id} style={s.wasteItem}>
                    · {w.name}
                  </Text>
                ))
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                s.activityLink,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => router.push("/activity")}
            >
              <Text style={s.activityLinkTxt}>Full activity timeline →</Text>
            </Pressable>

            <Text style={s.disclaimer}>
              Patterns come from your scan history — not medical advice.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
      {children}
    </View>
  );
}

function RhythmStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={s.rhythmStat}>
      <Text style={s.rhythmStatLabel}>{label}</Text>
      <Text style={s.rhythmStatValue}>{value}</Text>
      <Text style={s.rhythmStatSub}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(245,240,230,0.85)",
  },
  headerEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: D.cream,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(197,220,168,0.85)",
    lineHeight: 18,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 14,
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: D.inkBlack,
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkMid,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: D.greenMid,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 999,
    marginTop: 6,
  },
  emptyBtnTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.cream,
  },
  rhythmCard: {
    backgroundColor: D.greenMid,
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
  },
  cardEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  rhythmLine: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: D.cream,
    lineHeight: 21,
    marginBottom: 14,
  },
  rhythmStats: {
    flexDirection: "row",
    gap: 8,
  },
  rhythmStat: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 10,
    padding: 10,
  },
  rhythmStatLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1,
    color: "rgba(168,201,127,0.65)",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  rhythmStatValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: D.cream,
  },
  rhythmStatSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(197,220,168,0.75)",
    marginTop: 2,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(168,201,127,0.25)",
  },
  deltaTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.greenLight,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkMid,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    marginBottom: 10,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 12,
  },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.inkBlack,
  },
  rowMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkLight,
    marginTop: 2,
  },
  dueBadge: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: D.greenMid,
    letterSpacing: 0.3,
  },
  dueBadgeUrgent: {
    color: D.amber,
  },
  listCard: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listRowBorder: {
    borderTopWidth: 1,
    borderTopColor: D.creamBorder,
  },
  listTitle: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.inkBlack,
  },
  listValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenMid,
  },
  rank: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenMid,
    width: 18,
  },
  countPill: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: D.greenMid,
  },
  catBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  catHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catEmoji: {
    fontSize: 16,
    width: 22,
    textAlign: "center",
  },
  catCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.inkMid,
  },
  barTrack: {
    height: 7,
    backgroundColor: D.cream,
    borderRadius: 4,
    overflow: "hidden",
    marginLeft: 30,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  consistencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(58,92,38,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  consistencyTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: D.greenMid,
  },
  nutCard: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 14,
  },
  nutBig: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: D.inkBlack,
    marginBottom: 6,
  },
  nutBigMuted: {
    fontSize: 16,
    color: D.inkLight,
  },
  nutSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkMid,
    lineHeight: 17,
  },
  wasteCard: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
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
  wasteTitle: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.inkMid,
  },
  wasteCount: {
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
  wasteItem: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#c0392b",
  },
  activityLink: {
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 8,
  },
  activityLinkTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
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
