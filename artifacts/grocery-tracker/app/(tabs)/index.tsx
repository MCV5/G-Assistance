import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { useAuth } from "@/lib/auth";
import { getItemStatus } from "@/lib/predictions";
import type { PantryItem } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5)  return "LATE NIGHT";
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  if (h < 22) return "GOOD EVENING";
  return "LATE NIGHT";
}

function timeAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return `${d}d ago`;
}

function lastScanLabel(date: Date): string {
  const d = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function getDaysUntilNeeded(item: PantryItem): number {
  const status = getItemStatus(item);
  if (status === "overdue" || status === "expired") return 0;
  if (status === "due") return 1;
  if (status === "running-low") return Math.min(5, item.estimatedShelfLifeDays ?? 5);
  return 99;
}

function urgencyLabel(item: PantryItem): { text: string; urgent: boolean } {
  const days = getDaysUntilNeeded(item);
  if (days <= 0) return { text: "BUY TODAY", urgent: true };
  if (days === 1) return { text: "TOMORROW",  urgent: true };
  return { text: `IN ${days} DAYS`, urgent: false };
}

function getInitials(firstName?: string | null, email?: string): string {
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email)     return email.slice(0, 2).toUpperCase();
  return "?";
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { pantry, scans } = usePantry();

  const {
    runningLow,
    freshCount,
    healthPct,
    categoryBreakdown,
    recentItems,
    totalItems,
    categoryCount,
  } = useMemo(() => {
    const active = pantry.filter((p) => !p.consumed);

    const runningLow = active
      .filter((p) => {
        const s = getItemStatus(p);
        return s === "overdue" || s === "expired" || s === "due" || s === "running-low";
      })
      .slice(0, 4);

    const freshCount = active.filter((p) => getItemStatus(p) === "fresh").length;
    const totalItems = active.length;
    const healthPct  = totalItems === 0 ? 0 : Math.round((freshCount / totalItems) * 100);

    // Category breakdown — top 5 by count
    const catMap: Record<string, number> = {};
    for (const item of active) {
      catMap[item.category] = (catMap[item.category] ?? 0) + 1;
    }
    const categoryBreakdown = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const categoryCount = Object.keys(catMap).length;

    // Recently added — sorted by lastPurchasedAt desc
    const recentItems = [...active]
      .sort((a, b) => new Date(b.lastPurchasedAt).getTime() - new Date(a.lastPurchasedAt).getTime())
      .slice(0, 3);

    return { runningLow, freshCount, healthPct, categoryBreakdown, recentItems, totalItems, categoryCount };
  }, [pantry]);

  const lastScan = scans[0];
  const maxCatCount = categoryBreakdown[0]?.[1] ?? 1;

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 110 : 110;

  const displayName = user?.firstName
    ? user.firstName.toUpperCase()
    : user?.email?.split("@")[0].toUpperCase() ?? "YOU";

  return (
    <View style={{ flex: 1, backgroundColor: D.cream }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        {/* ── Header band ── */}
        <View style={[s.header, { paddingTop: topPad + 20 }]}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>{greetingByHour()}</Text>
              <Text style={s.name}>{displayName}.</Text>
            </View>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>
                {getInitials(user?.firstName, user?.email)}
              </Text>
            </View>
          </View>

          {/* Pantry health bar */}
          <View style={s.healthRow}>
            <Text style={s.healthLabel}>PANTRY HEALTH</Text>
            <View style={s.healthTrack}>
              <View style={[s.healthFill, { width: `${healthPct}%` }]} />
            </View>
            <Text style={s.healthPct}>{healthPct}%</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Scan CTA ── */}
          <Pressable
            style={({ pressed }) => [s.scanCard, { opacity: pressed ? 0.9 : 1 }]}
            onPress={() => router.push("/(tabs)/scan")}
          >
            <View style={s.scanIconWrap}>
              <Feather name="camera" size={20} color={D.greenMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.scanTitle}>SCAN RECEIPT</Text>
              <Text style={s.scanSub}>ADD ITEMS INSTANTLY</Text>
            </View>
            <Text style={s.scanArrow}>→</Text>
          </Pressable>

          {/* ── Running Low ── */}
          {runningLow.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Feather name="alert-triangle" size={11} color={D.amber} />
                  <Text style={s.sectionTitle}>RUNNING LOW</Text>
                </View>
                <Pressable onPress={() => router.push("/(tabs)/pantry")}>
                  <Text style={s.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={{ gap: 8 }}>
                {runningLow.map((item) => {
                  const { text, urgent } = urgencyLabel(item);
                  return (
                    <Pressable
                      key={item.id}
                      style={s.lowCard}
                      onPress={() => router.push("/(tabs)/pantry")}
                    >
                      <View style={[s.lowDot, urgent && s.lowDotUrgent]} />
                      <Text style={s.lowName}>{item.name}</Text>
                      <Text style={[s.lowDays, urgent && s.lowDaysUrgent]}>
                        {text}
                      </Text>
                      {urgent && (
                        <View style={s.urgentBadge}>
                          <Text style={s.urgentBadgeTxt}>URGENT</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── This week stats ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>THIS WEEK</Text>
            <View style={s.statsGrid}>
              <StatBox
                label="ITEMS TRACKED"
                value={String(totalItems)}
                sub={`+${scans.length} scan${scans.length === 1 ? "" : "s"}`}
                accent
              />
              <StatBox
                label="CATEGORIES"
                value={String(categoryCount)}
                sub="all stocked"
              />
              <StatBox
                label="FRESH"
                value={String(freshCount)}
                sub="in pantry"
              />
              <StatBox
                label="LAST SCAN"
                value={lastScan ? lastScanLabel(new Date(lastScan.scannedAt)) : "—"}
                sub={lastScan ? `${lastScan.itemCount} items` : "no scans yet"}
              />
            </View>
          </View>

          {/* ── By category ── */}
          {categoryBreakdown.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>BY CATEGORY</Text>
                <Pressable onPress={() => router.push("/(tabs)/pantry")}>
                  <Text style={s.seeAll}>Details</Text>
                </Pressable>
              </View>
              <View style={{ gap: 10 }}>
                {categoryBreakdown.map(([cat, count]) => (
                  <View key={cat} style={s.catRow}>
                    <Text style={s.catName}>{cat}</Text>
                    <View style={s.catTrack}>
                      <View
                        style={[
                          s.catFill,
                          { width: `${Math.round((count / maxCatCount) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={s.catCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Recently added ── */}
          {recentItems.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>RECENTLY ADDED</Text>
                <Pressable onPress={() => router.push("/(tabs)/pantry")}>
                  <Text style={s.seeAll}>All items</Text>
                </Pressable>
              </View>
              <View style={s.recentList}>
                {recentItems.map((item, i) => (
                  <Pressable
                    key={item.id}
                    style={[
                      s.recentRow,
                      i < recentItems.length - 1 && s.recentRowBorder,
                    ]}
                    onPress={() => router.push("/(tabs)/pantry")}
                  >
                    <View style={s.recentIcon}>
                      <Text style={s.recentEmoji}>{categoryEmoji(item.category)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentName}>{item.name}</Text>
                      <Text style={s.recentMeta}>
                        {item.category.toUpperCase()} · {timeAgo(new Date(item.lastPurchasedAt))}
                      </Text>
                    </View>
                    <Text style={s.recentQty}>x{item.quantity}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Empty state ── */}
          {pantry.length === 0 && (
            <View style={s.emptyWrap}>
              {/* Preview of what the app looks like with data */}
              <View style={s.emptyPreview}>
                <View style={s.emptyPreviewHead}>
                  <Text style={s.emptyPreviewLabel}>YOUR PANTRY WILL LOOK LIKE</Text>
                </View>
                {[
                  { name: "Olive Oil",     cat: "Condiments", qty: "x2", warn: false },
                  { name: "Basmati Rice",  cat: "Grains",     qty: "x1", warn: false },
                  { name: "Whole Milk",    cat: "Dairy",      qty: "x3", warn: true  },
                ].map((item, i, arr) => (
                  <View key={item.name} style={[
                    s.emptyPreviewRow,
                    i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: D.creamBorder },
                  ]}>
                    <View style={[s.emptyPreviewDot, item.warn && { backgroundColor: D.amber }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.emptyPreviewName}>{item.name}</Text>
                      <Text style={s.emptyPreviewCat}>{item.cat.toUpperCase()}</Text>
                    </View>
                    <Text style={s.emptyPreviewQty}>{item.qty}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.emptyTitle}>Scan to fill your pantry</Text>
              <Text style={s.emptySub}>
                Take a photo of any receipt, grocery bag, or cart. Every item is logged in seconds.
              </Text>
              <Pressable
                style={({ pressed }) => [s.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => router.push("/(tabs)/scan")}
              >
                <Feather name="camera" size={16} color={D.cream} style={{ marginRight: 8 }} />
                <Text style={s.emptyBtnTxt}>SCAN YOUR FIRST RECEIPT</Text>
              </Pressable>

              <Text style={s.emptyOr}>or add items manually in</Text>
              <Pressable onPress={() => router.push("/(tabs)/pantry")}>
                <Text style={s.emptyLink}>Pantry →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <View style={[s.statBox, accent && s.statBoxAccent]}>
      <Text style={[s.statLabel, accent && s.statLabelAccent]}>{label}</Text>
      <Text style={[s.statValue, accent && s.statValueAccent]}>{value}</Text>
      <Text style={[s.statSub, accent && s.statSubAccent]}>{sub}</Text>
    </View>
  );
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    Produce: "🥦", Dairy: "🥛", Meat: "🥩", Pantry: "🫙",
    Bakery: "🍞", Beverages: "🧃", Frozen: "🧊", Snacks: "🍿",
    Household: "🧹", "Personal Care": "🧴", Other: "📦",
  };
  return map[cat] ?? "📦";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  greeting: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: D.cream,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: D.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: D.greenDark,
    letterSpacing: 0.5,
  },
  // Health bar
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  healthLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.5,
    color: "rgba(168,201,127,0.6)",
    textTransform: "uppercase",
    width: 88,
  },
  healthTrack: {
    flex: 1,
    height: 5,
    backgroundColor: "rgba(168,201,127,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  healthFill: {
    height: "100%",
    backgroundColor: D.greenLight,
    borderRadius: 3,
  },
  healthPct: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenLight,
    width: 36,
    textAlign: "right",
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Scan CTA
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EAF0E0",
    borderWidth: 1,
    borderColor: "#C5D6A8",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  scanIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(45,80,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenDark,
    letterSpacing: 0.5,
  },
  scanSub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: D.inkMid,
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  scanArrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: D.greenMid,
  },

  // Section
  section: {
    marginTop: 22,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkMid,
    textTransform: "uppercase",
  },
  seeAll: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: D.greenMid,
  },

  // Running low cards
  lowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2A1A00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  lowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.greenLight,
  },
  lowDotUrgent: {
    backgroundColor: D.amber,
  },
  lowName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#F5E8C8",
  },
  lowDays: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: "rgba(168,201,127,0.6)",
    textTransform: "uppercase",
  },
  lowDaysUrgent: {
    color: D.amber,
  },
  urgentBadge: {
    backgroundColor: "rgba(232,160,64,0.2)",
    borderWidth: 1,
    borderColor: "rgba(232,160,64,0.4)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  urgentBadgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: D.amber,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Stats grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBox: {
    width: "47%",
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 10,
    padding: 14,
  },
  statBoxAccent: {
    backgroundColor: D.greenMid,
    borderColor: D.greenMid,
  },
  statLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: D.inkMid,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statLabelAccent: {
    color: "rgba(168,201,127,0.6)",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: D.inkBlack,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  statValueAccent: {
    color: D.cream,
  },
  statSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkLight,
    marginTop: 4,
  },
  statSubAccent: {
    color: "rgba(168,201,127,0.5)",
  },

  // Category bars
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catName: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.inkBlack,
    width: 72,
  },
  catTrack: {
    flex: 1,
    height: 6,
    backgroundColor: D.creamDark,
    borderRadius: 3,
    overflow: "hidden",
  },
  catFill: {
    height: "100%",
    backgroundColor: D.greenMid,
    borderRadius: 3,
  },
  catCount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: D.inkMid,
    width: 20,
    textAlign: "right",
  },

  // Recently added
  recentList: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    overflow: "hidden",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.creamBorder,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  recentEmoji: {
    fontSize: 18,
  },
  recentName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.inkBlack,
  },
  recentMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: D.inkLight,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  recentQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: D.greenMid,
  },

  // Empty state
  emptyWrap: {
    marginTop: 24,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  emptyPreview: {
    width: "100%",
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    opacity: 0.7,
  },
  emptyPreviewHead: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyPreviewLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(168,201,127,0.8)",
    textTransform: "uppercase",
  },
  emptyPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  emptyPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.greenLight,
  },
  emptyPreviewName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.inkBlack,
  },
  emptyPreviewCat: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: D.inkLight,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  emptyPreviewQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenMid,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: D.inkBlack,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkMid,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 300,
  },
  emptyBtn: {
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyBtnTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: D.cream,
    letterSpacing: 1.2,
  },
  emptyOr: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    marginBottom: 4,
  },
  emptyLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.greenMid,
  },
});
