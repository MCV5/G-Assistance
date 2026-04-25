import { Feather } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryIcon } from "@/components/CategoryIcon";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getCategoryTone } from "@/lib/categories";
import {
  computeSummary,
  getCategoryBreakdown,
  getMostPredictable,
  getPredictedRestocks,
  getTopItems,
} from "@/lib/insights";

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pantry, scans } = usePantry();

  const summary = useMemo(
    () => computeSummary(pantry, scans),
    [pantry, scans],
  );
  const topItems = useMemo(() => getTopItems(pantry), [pantry]);
  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(pantry),
    [pantry],
  );
  const restocks = useMemo(() => getPredictedRestocks(pantry), [pantry]);
  const predictable = useMemo(() => getMostPredictable(pantry), [pantry]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;

  if (pantry.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 20 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Insights
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="bar-chart-2"
            title="No insights yet"
            subtitle="Scan a few receipts and we'll show your top items, purchase rhythm, and category breakdown."
          />
        </View>
      </View>
    );
  }

  const changeColor =
    summary.weeklyChange > 0
      ? colors.warning
      : summary.weeklyChange < 0
        ? colors.success
        : colors.mutedForeground;
  const changeIcon =
    summary.weeklyChange > 0
      ? "trending-up"
      : summary.weeklyChange < 0
        ? "trending-down"
        : "minus";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingHorizontal: 20,
        paddingBottom: 140,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Insights</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your shopping rhythm at a glance.
      </Text>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.primary, borderRadius: 20 },
        ]}
      >
        <View style={styles.summaryTop}>
          <Text
            style={[
              styles.summaryLabel,
              { color: colors.primaryForeground, opacity: 0.8 },
            ]}
          >
            THIS WEEK
          </Text>
          <View style={styles.deltaRow}>
            <Feather name={changeIcon} size={14} color={changeColor} />
            <Text style={[styles.deltaText, { color: changeColor }]}>
              {summary.weeklyChange === 0
                ? "no change"
                : `${summary.weeklyChange > 0 ? "+" : ""}${summary.weeklyChange}% vs last`}
            </Text>
          </View>
        </View>
        <Text style={[styles.summaryBig, { color: colors.primaryForeground }]}>
          {summary.itemsBoughtThisWeek}
        </Text>
        <Text
          style={[
            styles.summaryCaption,
            { color: colors.primaryForeground, opacity: 0.8 },
          ]}
        >
          item{summary.itemsBoughtThisWeek === 1 ? "" : "s"} bought ·{" "}
          {summary.scansThisWeek} scan
          {summary.scansThisWeek === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.miniRow}>
        <MiniStat
          label="Tracked"
          value={String(summary.uniqueItemsTracked)}
          caption="unique items"
          icon="package"
        />
        <MiniStat
          label="Learned"
          value={String(summary.itemsWithCadence)}
          caption="cadence detected"
          icon="activity"
        />
        <MiniStat
          label="Cadence"
          value={
            summary.averageCadenceDays
              ? `${summary.averageCadenceDays}d`
              : "—"
          }
          caption="avg gap"
          icon="repeat"
        />
      </View>

      {restocks.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <SectionHeader
            title="Coming up"
            caption="Predicted to need restocking soon"
          />
          <View style={{ gap: 8 }}>
            {restocks.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.restockRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <CategoryIcon category={r.category} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.restockName, { color: colors.foreground }]}>
                    {r.name}
                  </Text>
                  <Text
                    style={[
                      styles.restockMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {r.category}
                  </Text>
                </View>
                <View style={styles.restockRight}>
                  <Text
                    style={[
                      styles.restockDays,
                      {
                        color:
                          r.dueInDays <= 0
                            ? colors.destructive
                            : r.dueInDays <= 3
                              ? colors.warning
                              : colors.foreground,
                      },
                    ]}
                  >
                    {r.dueInDays <= 0
                      ? "Now"
                      : r.dueInDays === 1
                        ? "1 day"
                        : `${r.dueInDays} days`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {topItems.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <SectionHeader
            title="Most bought"
            caption="The staples in your kitchen"
          />
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {topItems.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.topRow,
                  idx > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rank,
                    { backgroundColor: `${colors.primary}1f` },
                  ]}
                >
                  <Text style={[styles.rankText, { color: colors.primary }]}>
                    {idx + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topName, { color: colors.foreground }]}>
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.topMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.category}
                    {item.cadenceDays
                      ? ` · every ~${item.cadenceDays} days`
                      : ""}
                  </Text>
                </View>
                <View style={styles.countPill}>
                  <Text style={[styles.countText, { color: colors.foreground }]}>
                    {item.purchaseCount}×
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {categoryBreakdown.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <SectionHeader
            title="Categories"
            caption="What fills your pantry"
          />
          <View
            style={[
              styles.listCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {categoryBreakdown.map((c, idx) => (
              <View
                key={c.category}
                style={[
                  styles.catRow,
                  idx > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <View style={styles.catHeader}>
                  <CategoryIcon category={c.category} size={28} />
                  <Text style={[styles.catName, { color: colors.foreground }]}>
                    {c.category}
                  </Text>
                  <Text
                    style={[styles.catCount, { color: colors.mutedForeground }]}
                  >
                    {c.count}
                  </Text>
                </View>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(4, c.share * 100)}%`,
                        backgroundColor: getCategoryTone(c.category),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {predictable.length > 0 && (
        <View style={{ marginTop: 32 }}>
          <SectionHeader
            title="Most predictable"
            caption="You buy these like clockwork"
          />
          <View style={{ gap: 8 }}>
            {predictable.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.predictableRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <CategoryIcon category={item.category} size={32} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.predictName, { color: colors.foreground }]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      styles.predictMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Every ~{item.cadenceDays} days
                  </Text>
                </View>
                <View
                  style={[
                    styles.consistencyPill,
                    { backgroundColor: `${colors.success}22` },
                  ]}
                >
                  <Feather name="zap" size={12} color={colors.success} />
                  <Text
                    style={[styles.consistencyText, { color: colors.success }]}
                  >
                    {item.consistency}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function MiniStat({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.miniStat,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.miniHeader}>
        <Feather name={icon} size={13} color={colors.mutedForeground} />
        <Text
          style={[styles.miniLabel, { color: colors.mutedForeground }]}
        >
          {label}
        </Text>
      </View>
      <Text style={[styles.miniValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.miniCaption, { color: colors.mutedForeground }]}>
        {caption}
      </Text>
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
  },
  summaryCard: {
    padding: 20,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deltaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  summaryBig: {
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    letterSpacing: -1.2,
    marginTop: 4,
  },
  summaryCaption: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 2,
  },
  miniRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  miniStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  miniHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  miniLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  miniValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  miniCaption: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  restockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  restockName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  restockMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  restockRight: {
    alignItems: "flex-end",
  },
  restockDays: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  topName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  topMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  countPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  catRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  catCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginLeft: 38,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  predictableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  predictName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  predictMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  consistencyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  consistencyText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});
