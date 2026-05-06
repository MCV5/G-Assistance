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
  const { user, logout, requestPasswordReset } = useAuth();
  const { pantry, scans } = usePantry();

  const [dietaryModal, setDietaryModal] = useState(false);
  const [householdModal, setHouseholdModal] = useState(false);
  const [dietarySelected, setDietarySelected] = useState<string[]>([]);
  const [dietaryDraft, setDietaryDraft] = useState<string[]>([]);
  const [householdSize, setHouseholdSize] = useState(1);
  const [householdDraft, setHouseholdDraft] = useState(1);
  const [expiryAlerts, setExpiryAlerts] = useState(true);
  const [exporting, setExporting] = useState(false);
  const prefsLoadedRef = React.useRef(false);

  const loadPrefs = useCallback(async () => {
    try {
      const [dRaw, hRaw, eRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_PROFILE_DIETARY),
        AsyncStorage.getItem(STORAGE_PROFILE_HOUSEHOLD),
        AsyncStorage.getItem(STORAGE_PROFILE_EXPIRY_ALERTS),
      ]);
      if (dRaw) {
        const parsed = JSON.parse(dRaw) as unknown;
        if (Array.isArray(parsed)) {
          setDietarySelected(parsed.filter((x) => typeof x === "string"));
        }
      }
      if (hRaw) {
        const n = Number.parseInt(hRaw, 10);
        if (Number.isFinite(n) && n >= 1 && n <= 8) setHouseholdSize(n);
      }
      if (eRaw === "off") setExpiryAlerts(false);
      else setExpiryAlerts(true);
    } catch {
      /* defaults */
    }
  }, []);

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
    setDietarySelected([...dietaryDraft]);
    try {
      await AsyncStorage.setItem(
        STORAGE_PROFILE_DIETARY,
        JSON.stringify(dietaryDraft),
      );
    } catch {}
    setDietaryModal(false);
  };

  const openHousehold = () => {
    setHouseholdDraft(householdSize);
    setHouseholdModal(true);
  };

  const saveHousehold = async () => {
    setHouseholdSize(householdDraft);
    try {
      await AsyncStorage.setItem(
        STORAGE_PROFILE_HOUSEHOLD,
        String(householdDraft),
      );
    } catch {}
    setHouseholdModal(false);
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

  const onProPress = () => {
    console.log("[profile] Plans / Pro — stub (Phase A)");
    Alert.alert("Go Pro", "Plans are not available yet. Check back soon.");
  };

  const onExport = async () => {
    if (pantry.length === 0) {
      Alert.alert("Nothing to export", "Your pantry is empty.");
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
          a.download = "pantry_export.csv";
          a.click();
          URL.revokeObjectURL(url);
        }
        return;
      }
      const path = `${FileSystem.cacheDirectory ?? ""}pantry_export.csv`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: "utf8",
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "text/csv",
          dialogTitle: "Export pantry",
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

  const onLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
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
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backRow}
          >
            <Text style={styles.backText}>← Back</Text>
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
              {displayName.toUpperCase()}
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
            <Text style={styles.statLabel}>ITEMS IN PANTRY</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{scansThisMonth}</Text>
            <Text style={styles.statLabel}>SCANS THIS MO.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{memberLabel}</Text>
            <Text style={styles.statLabel}>MEMBER SINCE</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Pressable style={styles.proCard} onPress={onProPress}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.proEyebrow}>UPGRADE</Text>
              <Text style={styles.proTitle}>Go Pro</Text>
              <Text style={styles.proSub}>
                Recipes, nutrition AI & smart suggestions
              </Text>
            </View>
            <View style={styles.proBtn}>
              <Text style={styles.proBtnText}>SEE PLANS →</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionLabel}>PREFERENCES</Text>

          <RowButton
            emoji="🥗"
            title="Dietary goals"
            subtitle={dietarySubtitle}
            onPress={openDietary}
          />
          <RowButton
            emoji="🔔"
            title="Notifications"
            subtitle={expiryAlerts ? "Expiry alerts on" : "Expiry alerts off"}
            onPress={toggleExpiryPref}
            chevron={false}
          />
          <RowButton
            emoji="👨‍👩‍👧"
            title="Household size"
            subtitle={householdSubtitle}
            onPress={openHousehold}
          />

          <Text style={[styles.sectionLabel, { marginTop: 6 }]}>ACCOUNT</Text>

          <RowButton
            emoji="🔑"
            title="Change password"
            subtitle="Reset via email"
            onPress={() => {
              void onResetPassword();
            }}
          />
          <RowButton
            emoji="📦"
            title="Export my data"
            subtitle={
              exporting ? "Preparing file…" : "Download as CSV"
            }
            onPress={() => {
              void onExport();
            }}
            disabled={exporting}
            chevron={false}
            trailing={exporting ? <ActivityIndicator color={c.greenMid} /> : null}
          />

          <View style={styles.hRule} />

          <Pressable
            style={styles.logoutBtn}
            onPress={onLogout}
            disabled={exporting}
          >
            <Text style={styles.logoutText}>Log out</Text>
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
          <Pressable style={styles.sheetSave} onPress={() => void saveDietary()}>
            <Text style={styles.sheetSaveTxt}>Save</Text>
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
          <Pressable style={styles.sheetSave} onPress={() => void saveHousehold()}>
            <Text style={styles.sheetSaveTxt}>Save</Text>
          </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RowButton(props: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  chevron?: boolean;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  const {
    emoji,
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
          <Text style={styles.rowIconTxt}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        {trailing}
        {chevron ? <Text style={styles.chevron}>›</Text> : null}
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
  backRow: { alignSelf: "flex-start", marginBottom: 8 },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: c.greenLight,
    opacity: 0.95,
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
    fontSize: 16,
    color: c.cream,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: c.greenLight,
    opacity: 0.45,
    marginTop: 4,
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
    fontSize: 9,
    color: c.greenLight,
    opacity: 0.75,
    marginTop: 4,
    textAlign: "center",
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: c.cream,
  },
  proCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.greenDeep,
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  proEyebrow: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
    color: c.inkMuted,
    letterSpacing: 0.5,
  },
  proTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: c.greenLight,
    marginTop: 2,
  },
  proSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: c.inkMuted,
    marginTop: 4,
    lineHeight: 14,
  },
  proBtn: {
    backgroundColor: c.greenAccent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  proBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: c.greenDeep,
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
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: c.greenMid,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconTxt: { fontSize: 18 },
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
  chevron: {
    fontSize: 22,
    color: c.inkMuted,
    marginLeft: 8,
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
    ...StyleSheet.absoluteFillObject,
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
