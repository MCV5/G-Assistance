import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { ItemRow } from "@/components/ItemRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { usePantry } from "@/contexts/PantryContext";
import { useColors } from "@/hooks/useColors";
import { getItemStatus, isPredictedNeeded } from "@/lib/predictions";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pantry, scans } = usePantry();

  const { needNow, runningLow, freshCount } = useMemo(() => {
    const needNow = pantry.filter((p) => {
      const s = getItemStatus(p);
      return s === "overdue" || s === "expired" || s === "due";
    });
    const runningLow = pantry.filter(
      (p) => getItemStatus(p) === "running-low",
    );
    const freshCount = pantry.filter(
      (p) => getItemStatus(p) === "fresh",
    ).length;
    return { needNow, runningLow, freshCount };
  }, [pantry]);

  const predictedCount = useMemo(
    () => pantry.filter(isPredictedNeeded).length,
    [pantry],
  );

  const lastScan = scans[0];
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 16;
  const bottomPad = isWeb ? 110 : 110;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          {greetingByHour()}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Your kitchen, in sync
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            label="Fresh"
            value={freshCount}
            tone={colors.success}
            icon="check-circle"
          />
          <StatCard
            label="Restock"
            value={predictedCount}
            tone={colors.destructive}
            icon="alert-circle"
          />
          <StatCard
            label="Items"
            value={pantry.length}
            tone={colors.primary}
            icon="package"
          />
        </View>

        <View
          style={[
            styles.scanCard,
            { backgroundColor: colors.primary, borderRadius: 20 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.scanTitle, { color: colors.primaryForeground }]}>
              Scan a receipt or bag
            </Text>
            <Text
              style={[
                styles.scanSub,
                { color: colors.primaryForeground, opacity: 0.85 },
              ]}
            >
              Snap a photo and we'll log everything for you
            </Text>
          </View>
          <PrimaryButton
            label="Scan"
            icon="camera"
            variant="secondary"
            onPress={() => router.push("/(tabs)/scan")}
          />
        </View>

        {needNow.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader
              title="Need now"
              caption="Predicted to be running out or gone"
            />
            <View style={{ gap: 10 }}>
              {needNow.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push("/(tabs)/pantry")}
                />
              ))}
            </View>
          </View>
        )}

        {runningLow.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader
              title="Heads up"
              caption="Coming due in the next few days"
            />
            <View style={{ gap: 10 }}>
              {runningLow.slice(0, 4).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onPress={() => router.push("/(tabs)/pantry")}
                />
              ))}
            </View>
          </View>
        )}

        {lastScan && (
          <View style={{ marginTop: 28 }}>
            <SectionHeader title="Recent scan" />
            <View
              style={[
                styles.scanRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.scanIcon,
                  { backgroundColor: `${colors.primary}1f` },
                ]}
              >
                <Feather
                  name={
                    lastScan.sourceType === "receipt"
                      ? "file-text"
                      : lastScan.sourceType === "bag"
                        ? "shopping-bag"
                        : "shopping-cart"
                  }
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scanRowTitle, { color: colors.foreground }]}>
                  {lastScan.storeName ?? capitalize(lastScan.sourceType)}
                </Text>
                <Text
                  style={[styles.scanRowSub, { color: colors.mutedForeground }]}
                >
                  {lastScan.itemCount} item
                  {lastScan.itemCount === 1 ? "" : "s"} ·{" "}
                  {timeAgo(new Date(lastScan.scannedAt))}
                </Text>
              </View>
            </View>
          </View>
        )}

        {pantry.length === 0 && (
          <View style={{ marginTop: 28 }}>
            <EmptyState
              icon="camera"
              title="Start by scanning a receipt"
              subtitle="Take a photo of your grocery receipt, shopping bag, or cart. We'll extract every item and learn how often you buy them."
            >
              <PrimaryButton
                label="Open scanner"
                icon="camera"
                onPress={() => router.push("/(tabs)/scan")}
              />
            </EmptyState>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.statTop}>
        <Feather name={icon} size={16} color={tone} />
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late night.";
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  if (h < 22) return "Good evening.";
  return "Late night.";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = StyleSheet.create({
  greeting: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },
  scanCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 12,
  },
  scanTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginBottom: 4,
  },
  scanSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  scanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scanRowTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  scanRowSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
