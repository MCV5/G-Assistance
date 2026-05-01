import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HttpApiError, useAnalyzeReceipt } from "@workspace/api-client-react";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";

function localCalendarDateYyyyMmDd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SourceType = "receipt" | "bag" | "cart";

const SOURCE_OPTIONS: {
  key: SourceType;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  tip: string;
}[] = [
  {
    key: "receipt",
    label: "Receipt",
    icon: "file-text",
    tip: "Lay the receipt flat, use good lighting, and fit the full receipt in frame.",
  },
  {
    key: "bag",
    label: "Bag",
    icon: "shopping-bag",
    tip: "Hold the bag open and capture as many product labels as possible.",
  },
  {
    key: "cart",
    label: "Cart",
    icon: "shopping-cart",
    tip: "Shoot from above so item labels are visible and not overlapping.",
  },
];

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sourceType, setSourceType] = useState<SourceType>("receipt");
  const [preview, setPreview] = useState<{
    uri: string;
    base64: string;
    mimeType: string;
  } | null>(null);
  const currentTip = SOURCE_OPTIONS.find((o) => o.key === sourceType)?.tip;

  const analyze = useAnalyzeReceipt({
    mutation: {
      onSuccess: (data) => {
        const payload = encodeURIComponent(
          JSON.stringify({
            items: data.items,
            sourceType,
            storeName: data.storeName,
            purchaseDate: data.purchaseDate,
          }),
        );
        setPreview(null);
        router.push(`/scan-review?data=${payload}`);
      },
      onError: (mutationErr) => {
        const err: unknown = mutationErr;
        const networkMsg =
          "Could not reach the API. Set EXPO_PUBLIC_API_URL to your server origin (e.g. https://your-app.onrender.com) with no trailing slash, then restart Expo.";

        if (err instanceof HttpApiError) {
          const d = err.data as { error?: string } | null;
          const fromBody =
            d && typeof d.error === "string" ? d.error.trim() : "";
          if (fromBody) {
            Alert.alert("Couldn't analyze this image", fromBody);
            return;
          }
          if (err.status === 0) {
            Alert.alert("Couldn't analyze this image", networkMsg);
            return;
          }
          Alert.alert("Couldn't analyze this image", err.message);
          return;
        }

        const isNetworkish =
          err instanceof Error &&
          /network request failed|failed to fetch|load failed|network error/i.test(
            err.message,
          );
        if (isNetworkish) {
          Alert.alert("Couldn't analyze this image", networkMsg);
          return;
        }

        const msg =
          err instanceof Error
            ? err.message
            : "Please try a clearer photo with better lighting.";
        Alert.alert("Couldn't analyze this image", msg);
      },
    },
  });

  function handleAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!asset.base64) {
      Alert.alert("Image error", "Could not read this image. Please try another one.");
      return;
    }
    // Expo always encodes base64 as JPEG, regardless of the original format (HEIC etc.)
    setPreview({ uri: asset.uri, base64: asset.base64, mimeType: "image/jpeg" });
  }

  async function pickFromCamera() {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in Settings to scan receipts.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      // eslint-disable-next-line deprecation/deprecation
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      allowsEditing: sourceType === "receipt",
      aspect: sourceType === "receipt" ? ([3, 4] as [number, number]) : undefined,
      quality: 0.7,
    });
    if (!result.canceled) handleAsset(result.assets[0]);
  }

  async function pickFromLibrary() {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      // eslint-disable-next-line deprecation/deprecation
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      allowsEditing: sourceType === "receipt",
      aspect: sourceType === "receipt" ? ([3, 4] as [number, number]) : undefined,
      quality: 0.7,
    });
    if (!result.canceled) handleAsset(result.assets[0]);
  }

  function submit() {
    if (!preview) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    analyze.mutate({
      data: {
        imageBase64: preview.base64,
        mimeType: preview.mimeType,
        sourceType,
        scannedAt: localCalendarDateYyyyMmDd(),
      },
    });
  }

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;

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
      <Text style={[styles.title, { color: colors.foreground }]}>Scan</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Snap a photo and we'll detect every item.
      </Text>

      {/* ── Source type chips ── */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        WHAT ARE YOU SCANNING?
      </Text>
      <View style={styles.chipRow}>
        {SOURCE_OPTIONS.map((opt) => {
          const active = sourceType === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSourceType(opt.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active
                    ? colors.primary
                    : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Feather
                name={opt.icon}
                size={14}
                color={active ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.foreground,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Tip card ── */}
      {currentTip ? (
        <View
          style={[
            styles.tipCard,
            { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` },
          ]}
        >
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.tipText, { color: colors.primary }]}>
            {currentTip}
          </Text>
        </View>
      ) : null}

      {/* ── Photo zone ── */}
      {preview ? (
        <View
          style={[
            styles.previewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Image source={{ uri: preview.uri }} style={styles.preview} />
          {analyze.isPending ? (
            <View
              style={[
                StyleSheet.absoluteFillObject,
                styles.previewOverlay,
                { backgroundColor: "rgba(0,0,0,0.55)" },
              ]}
            >
              <ActivityIndicator color="#fff" size="large" />
              <Text style={styles.overlayText}>Reading items from your photo…</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setPreview(null)}
              style={[styles.removeBtn, { backgroundColor: colors.background }]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          )}
        </View>
      ) : (
        <View
          style={[
            styles.dropZone,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.dropIcon,
              { backgroundColor: `${colors.primary}1f` },
            ]}
          >
            <Feather name="camera" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.dropTitle, { color: colors.foreground }]}>
            Add a photo
          </Text>
          <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>
            Use your camera or pick from your library.
          </Text>
        </View>
      )}

      {/* ── Action buttons ── */}
      <View style={{ gap: 10, marginTop: 16 }}>
        {preview ? (
          <PrimaryButton
            label="Analyze items"
            icon="zap"
            fullWidth
            size="lg"
            loading={analyze.isPending}
            onPress={submit}
          />
        ) : (
          <>
            <PrimaryButton
              label="Take photo"
              icon="camera"
              fullWidth
              size="lg"
              onPress={pickFromCamera}
            />
            <PrimaryButton
              label="Pick from library"
              icon="image"
              variant="secondary"
              fullWidth
              size="lg"
              onPress={pickFromLibrary}
            />
          </>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* ── Barcode option ── */}
      <Pressable
        onPress={() => router.push("/barcode-scan")}
        style={({ pressed }) => [
          styles.barcodeRow,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.barcodeIcon,
            { backgroundColor: `${colors.accent}33` },
          ]}
        >
          <Feather name="maximize" size={20} color={colors.accentForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.barcodeTitle, { color: colors.foreground }]}>
            Scan a barcode instead
          </Text>
          <Text style={[styles.barcodeSub, { color: colors.mutedForeground }]}>
            Quickly add a single packaged item
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
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
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  tipText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  dropZone: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  dropTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  dropSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  previewCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    aspectRatio: 4 / 3,
    position: "relative",
  },
  preview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  previewOverlay: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  overlayText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "#fff",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  barcodeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  barcodeTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  barcodeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
});
