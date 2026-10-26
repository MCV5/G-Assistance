import { Feather } from "@expo/vector-icons";
import { patchMyProfile } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DIETARY_OPTIONS,
  profileColors as c,
  STORAGE_PROFILE_DIETARY,
  STORAGE_PROFILE_EXPIRY_ALERTS,
  STORAGE_PROFILE_HOUSEHOLD,
} from "@/constants/profileTheme";
import { usePantry } from "@/contexts/PantryContext";
import { useAuth } from "@/lib/auth";
import type { PantryItem } from "@/lib/types";

function formatMemberSince(iso: string): string {
  const start = new Date(iso).getTime();
  const days = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
  if (days < 0) return "0d";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function startOfUtcMonth(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function countScansThisMonth(
  scans: { scannedAt: string }[],
): number {
  const t0 = startOfUtcMonth();
  return scans.filter((s) => new Date(s.scannedAt).getTime() >= t0).length;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function pantryToCsv(items: PantryItem[]): string {
  const headers =
    "Name,Quantity,Unit,Category,FirstSeenAt,LastPurchasedAt,Consumed,EstimatedShelfLifeDays";
  const rows = items.map((i) =>
    [
      escapeCsvCell(i.name),
      String(i.quantity),
      escapeCsvCell(i.unit),
      escapeCsvCell(i.category),
      escapeCsvCell(i.firstSeenAt),
      escapeCsvCell(i.lastPurchasedAt),
      i.consumed ? "true" : "false",
      String(i.estimatedShelfLifeDays),
    ].join(","),
  );
  return [headers, ...rows].join("\n");
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, requestPasswordReset, syncAuthUser } = useAuth();
  const { pantry, scans } = usePantry();

  const [dietaryModal, setDietaryModal] = useState(false);
  const [householdModal, setHouseholdModal] = useState(false);
  const [dietarySelected, setDietarySelected] = useState<string[]>([]);
  const [dietaryDraft, setDietaryDraft] = useState<string[]>([]);
  const [householdSize, setHouseholdSize] = useState(1);
  const [householdDraft, setHouseholdDraft] = useState(1);
  const [expiryAlerts, setExpiryAlerts] = useState(true);
  const [savingDietary, setSavingDietary] = useState(false);
  const [savingHousehold, setSavingHousehold] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const prefsLoadedRef = React.useRef(false);

  const loadPrefs = useCallback(async () => {
    try {
      const eRaw = await AsyncStorage.getItem(STORAGE_PROFILE_EXPIRY_ALERTS);
      if (eRaw === "off") setExpiryAlerts(false);
      else setExpiryAlerts(true);
    } catch {
      /* defaults */
    }
  }, []);

  const serverPrefsKey = user
    ? `${JSON.stringify(user.dietaryGoals)}|${user.householdSize}`
    : "";

  useEffect(() => {
    if (!user) return;
    setDietarySelected([...user.dietaryGoals]);
    setHouseholdSize(user.householdSize);
    void AsyncStorage.multiSet([
      [STORAGE_PROFILE_DIETARY, JSON.stringify(user.dietaryGoals)],
      [STORAGE_PROFILE_HOUSEHOLD, String(user.householdSize)],
    ]);
  }, [serverPrefsKey, user]);

  useEffect(() => {
    if (prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;
    void loadPrefs();
  }, [loadPrefs]);

  const displayName = useMemo(() => {
    if (!user) return "Account";
    const n = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return n || user.email || "Account";
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return "?";
    const a = (user.firstName ?? "").trim();
    const b = (user.lastName ?? "").trim();
    if (a && b) return (a[0] + b[0]).toUpperCase();
    if (a.length >= 2) return a.slice(0, 2).toUpperCase();
    const e = (user.email ?? "?").trim();
    return e.charAt(0).toUpperCase();
  }, [user]);

  const pantryCount = useMemo(
    () => pantry.filter((p) => !p.consumed).length,
    [pantry],
  );
  const scansThisMonth = useMemo(() => countScansThisMonth(scans), [scans]);
  const memberLabel = user?.createdAt
    ? formatMemberSince(user.createdAt)
    : "—";

  const dietarySubtitle =
    dietarySelected.length === 0
      ? "Not set"
      : dietarySelected.length === 1
        ? dietarySelected[0]
        : `${dietarySelected.length} selected`;

  const householdSubtitle =
    householdSize === 1 ? "1 person" : `${householdSize} people`;

  const openDietary = () => {
    setDietaryDraft([...dietarySelected]);
    setDietaryModal(true);
  };

  const saveDietary = async () => {
    setSavingDietary(true);
    try {
      await patchMyProfile({ dietaryGoals: dietaryDraft });
      await syncAuthUser();
      setDietaryModal(false);
    } catch {
      Alert.alert(
        "Couldn't save",
        "Check your connection and try again. Your changes were not saved.",
      );
    } finally {
      setSavingDietary(false);
    }
  };

  const openHousehold = () => {
    setHouseholdDraft(householdSize);
    setHouseholdModal(true);
  };

  const saveHousehold = async () => {
    setSavingHousehold(true);
    try {
      await patchMyProfile({ householdSize: householdDraft });
      await syncAuthUser();
      setHouseholdModal(false);
    } catch {
      Alert.alert(
        "Couldn't save",
        "Check your connection and try again. Your changes were not saved.",
      );
    } finally {
      setSavingHousehold(false);
    }
  };

  const toggleExpiryPref = async () => {
    const next = !expiryAlerts;
    setExpiryAlerts(next);
    try {
      await AsyncStorage.setItem(
        STORAGE_PROFILE_EXPIRY_ALERTS,
        next ? "on" : "off",
      );
    } catch {}
  };

  const onExport = async () => {
    if (pantry.length === 0) {
      Alert.alert("Nothing to export", "Your kitchen is empty.");
      return;
    }
    setExporting(true);
    try {
      const csv = pantryToCsv(pantry);
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "kitchen_export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }
        return;
      }
      const path = `${FileSystem.cacheDirectory ?? ""}kitchen_export.csv`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: "utf8",
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export kitchen",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Export ready", `Saved to cache:\n${path}`);
      }
    } catch (e) {
      Alert.alert("Export failed", "Could not create the CSV file.");
      console.warn(e);
    } finally {
      setExporting(false);
    }
  };

  const onResetPassword = async () => {
    if (!user?.email) {
      router.push("/forgot-password");
      return;
    }
    try {
      await requestPasswordReset(user.email);
      Alert.alert(
        "Check your email",
        "If an account exists for your address, we sent reset instructions.",
      );
    } catch {
      Alert.alert("Something went wrong", "Please try again in a moment.");
    }
  };

  const performLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setLoggingOut(false);
      Alert.alert("Couldn’t log out", "Please try again.");
    }
  };

  const onLogout = () => {
    if (loggingOut) return;
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm("Log out of Goalcery?");
      if (ok) void performLogout();
      return;
    }
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void performLogout();
        },
      },
    ]);
  };

  if (!user) return null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)");
            }}
            hitSlop={12}
            style={styles.backRow}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={20} color={c.cream} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            {user.profileImageUrl ? (
              <Image
                source={{ uri: user.profileImageUrl }}
                style={styles.avatarImg}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {user.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{pantryCount}</Text>
            <Text style={styles.statLabel}>In kitchen</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{scansThisMonth}</Text>
            <Text style={styles.statLabel}>Scans this month</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{memberLabel}</Text>
            <Text style={styles.statLabel}>With us</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>YOUR HOME</Text>

          <RowButton
            icon="bar-chart-2"
            title="How you eat"
            subtitle="Habits from what you buy"
            onPress={() => router.push("/(tabs)/insights")}
          />
          <RowButton
            icon="grid"
            title="Kitchen"
            subtitle={
              pantryCount === 0
                ? "Nothing tracked yet"
                : `${pantryCount} item${pantryCount === 1 ? "" : "s"} at home`
            }
            onPress={() => router.push("/(tabs)/pantry")}
          />

          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>PREFERENCES</Text>

          <RowButton
            icon="heart"
            title="Dietary goals"
            subtitle={dietarySubtitle}
            onPress={openDietary}
          />
          <View style={styles.rowBtn}>
            <View style={styles.rowLeft}>
              <View style={styles.rowIcon}>
                <Feather name="bell" size={18} color={c.cream} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle}>Low-stock alerts</Text>
                <Text style={styles.rowSub}>
                  {expiryAlerts ? "On — we’ll nudge you" : "Off"}
                </Text>
              </View>
            </View>
            <Switch
              value={expiryAlerts}
              onValueChange={() => {
                void toggleExpiryPref();
              }}
              trackColor={{ false: c.creamBorder, true: c.greenAccent }}
              thumbColor={c.cream}
              accessibilityLabel="Low-stock alerts"
            />
          </View>
          <RowButton
            icon="users"
            title="Household size"
            subtitle={householdSubtitle}
            onPress={openHousehold}
          />

          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>ACCOUNT</Text>

          <RowButton
            icon="lock"
            title="Change password"
            subtitle="We’ll email a reset link"
            onPress={() => {
              void onResetPassword();
            }}
          />
          <RowButton
            icon="download"
            title="Export my kitchen"
            subtitle={exporting ? "Preparing file…" : "Download as CSV"}
            onPress={() => {
              void onExport();
            }}
            disabled={exporting}
            chevron={false}
            trailing={exporting ? <ActivityIndicator color={c.greenMid} /> : null}
          />

          <View style={styles.hRule} />

          <Pressable
            style={({ pressed }) => [
              styles.logoutBtn,
              { opacity: loggingOut ? 0.6 : pressed ? 0.85 : 1 },
            ]}
            onPress={onLogout}
            disabled={exporting || loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            {loggingOut ? (
              <ActivityIndicator color={c.inkMid} />
            ) : (
              <Text style={styles.logoutText}>Log out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={dietaryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setDietaryModal(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalDim}
            accessibilityRole="button"
            onPress={() => setDietaryModal(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Dietary goals</Text>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            <View style={styles.pillWrap}>
              {DIETARY_OPTIONS.map((opt) => {
                const on = dietaryDraft.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      setDietaryDraft((prev) =>
                        on ? prev.filter((x) => x !== opt) : [...prev, opt],
                      );
                    }}
                    style={[styles.pill, on ? styles.pillOn : styles.pillOff]}
                  >
                    <Text
                      style={[styles.pillTxt, on ? styles.pillTxtOn : undefined]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <Pressable
            style={[styles.sheetSave, savingDietary && { opacity: 0.7 }]}
            disabled={savingDietary}
            onPress={() => void saveDietary()}
          >
            {savingDietary ? (
              <ActivityIndicator color={c.cream} />
            ) : (
              <Text style={styles.sheetSaveTxt}>Save</Text>
            )}
          </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={householdModal}
        animationType="slide"
        transparent
        onRequestClose={() => setHouseholdModal(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalDim}
            accessibilityRole="button"
            onPress={() => setHouseholdModal(false)}
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.sheetTitle}>Household size</Text>
          <View style={styles.hhRow}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => setHouseholdDraft(n)}
                style={[
                  styles.hhChip,
                  householdDraft === n ? styles.hhChipOn : styles.hhChipOff,
                ]}
              >
                <Text
                  style={[
                    styles.hhChipTxt,
                    householdDraft === n ? styles.hhChipTxtOn : undefined,
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hhHint}>
            {householdDraft === 1 ? "1 person" : `${householdDraft} people`}
          </Text>
          <Pressable
            style={[styles.sheetSave, savingHousehold && { opacity: 0.7 }]}
            disabled={savingHousehold}
            onPress={() => void saveHousehold()}
          >
            {savingHousehold ? (
              <ActivityIndicator color={c.cream} />
            ) : (
              <Text style={styles.sheetSaveTxt}>Save</Text>
            )}
          </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RowButton(props: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
  chevron?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const {
    icon,
    title,
    subtitle,
    onPress,
    chevron = true,
    disabled = false,
    trailing = null,
  } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.rowBtn,
        { opacity: disabled ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Feather name={icon} size={18} color={c.cream} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        {trailing}
        {chevron ? (
          <Feather name="chevron-right" size={18} color={c.inkMuted} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.cream },
  header: {
    backgroundColor: c.greenHeader,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  backRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 8,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(245,240,230,0.85)",
  },
  headerCenter: { alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.greenAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: c.cream,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: c.cream,
    marginTop: 10,
    letterSpacing: -0.3,
    paddingHorizontal: 16,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.greenLight,
    opacity: 0.75,
    marginTop: 4,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: c.greenDeep,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCell: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: c.greenMid, opacity: 0.5 },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: c.greenAccent,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.greenLight,
    opacity: 0.8,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: c.cream,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: c.inkMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.creamCard,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.greenMid,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: c.inkBlack,
  },
  rowSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: c.inkMuted,
    marginTop: 2,
  },
  hRule: {
    height: 1,
    backgroundColor: c.creamBorder,
    marginVertical: 14,
  },
  logoutBtn: {
    backgroundColor: c.creamCard,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: c.inkMid,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: c.creamCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: c.inkBlack,
    marginBottom: 12,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  pillOn: { backgroundColor: c.greenMid },
  pillOff: { backgroundColor: c.cream },
  pillTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: c.inkBlack,
  },
  pillTxtOn: { color: c.cream },
  sheetSave: {
    backgroundColor: c.greenMid,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  sheetSaveTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: c.cream,
  },
  hhRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  hhChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  hhChipOn: { backgroundColor: c.greenMid },
  hhChipOff: { backgroundColor: c.cream },
  hhChipTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: c.inkBlack,
  },
  hhChipTxtOn: { color: c.cream },
  hhHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: c.inkMuted,
    textAlign: "center",
    marginTop: 14,
  },
});
