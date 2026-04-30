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

/** Shopping rhythm, restocks, and category breakdown (formerly the Insights tab). */
export function ShoppingActivityScreen() {
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
  const groupedRestocks = useMemo(() => groupRestocks(restocks), [restocks]);
  const predictable = useMemo(() => getMostPredictable(pantry), [pantry]);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 16 : insets.top + 8;

  if (pantry.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: topPad, paddingHorizontal: 20 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Shopping activity
          </Text>
        </View>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon="bar-chart-2"
            title="No activity yet"
            subtitle="Scan a few receipts and we'll show your top items, purchase rhythm, and category breakdown."
          />
        </View>
      </View>
    );
  }

  const changeColor =
    summary.weeklyChange > 0
      ? "#8a5600"
      : summary.weeklyChange < 0
        ? "#1b6a3a"
        : "#35513f";
  const changeBg =
    summary.weeklyChange > 0
      ? "#fff4db"
      : summary.weeklyChange < 0
        ? "#e8f7ee"
        : "rgba(255,255,255,0.48)";
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
        paddingBottom: insets.bottom + 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        Shopping activity
      </Text>
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
          <View style={[styles.deltaRow, { backgroundColor: changeBg }]}>
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
        <View style={{ marginTop: 22 }}>
          <SectionHeader
            title="Coming up"
            caption="Predicted to need restocking soon"
          />
          <View style={{ gap: 8 }}>
            {groupedRestocks.map((group) => (
              <View
                key={group.id}
                style={[
                  styles.restockRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <CategoryIcon category={group.category} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.restockName, { color: colors.foreground }]}>
                    {group.label}
                  </Text>
                  <Text
                    style={[
                      styles.restockMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {group.category}
                    {group.count > 1 ? ` · ${group.count} items` : ""}
                  </Text>
                </View>
                <View style={styles.restockRight}>
                  <Text
                    style={[
                      styles.restockDays,
                      {
                        color:
                          group.dueInDays <= 0
                            ? colors.destructive
                            : group.dueInDays <= 3
                              ? colors.warning
                              : colors.foreground,
                      },
                    ]}
                  >
                    {group.dueInDays <= 0
                      ? "Now"
                      : group.dueInDays === 1
                        ? "1 day"
                        : `${group.dueInDays} days`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {topItems.length > 0 && (
        <View style={{ marginTop: 24 }}>
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
        <View style={{ marginTop: 24 }}>
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
        <View style={{ marginTop: 24 }}>
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

function inferFamilyLabel(name: string): string | null {
  const lower = name.toLowerCase();
  if (
    lower.includes("salad") ||
    lower.includes("coleslaw") ||
    lower.includes("slaw")
  ) {
    return "Salads";
  }
  if (lower.includes("milk")) return "Milk";
  if (lower.includes("bread") || lower.includes("pita")) return "Bread";
  return null;
}

function groupRestocks(restocks: ReturnType<typeof getPredictedRestocks>) {
  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      category: (typeof restocks)[number]["category"];
      count: number;
      dueInDays: number;
    }
  >();

  for (const item of restocks) {
    const family = inferFamilyLabel(item.name);
    const key = `${item.category}:${family ?? item.name}`;
    const label = family ?? item.name;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: key,
        label,
        category: item.category,
        count: 1,
        dueInDays: item.dueInDays,
      });
      continue;
    }

    existing.count += 1;
    existing.dueInDays = Math.min(existing.dueInDays, item.dueInDays);
  }

  return [...groups.values()].sort((a, b) => a.dueInDays - b.dueInDays);
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
    marginBottom: 14,
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
    marginTop: 10,
  },
  miniStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 11,
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
