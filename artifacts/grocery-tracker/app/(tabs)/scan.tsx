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
import { useAnalyzeReceipt } from "@workspace/api-client-react";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";

type SourceType = "receipt" | "bag" | "cart";

const SOURCE_OPTIONS: { key: SourceType; label: string; description: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  {
    key: "receipt",
    label: "Receipt",
    description: "A printed grocery receipt",
    icon: "file-text",
  },
  {
    key: "bag",
    label: "Bag",
    description: "Items inside a shopping bag",
    icon: "shopping-bag",
  },
  {
    key: "cart",
    label: "Cart",
    description: "Items in a shopping cart",
    icon: "shopping-cart",
  },
];

export default function ScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [sourceType, setSourceType] = useState<SourceType>("receipt");
  const [preview, setPreview] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);

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
      onError: (err) => {
        Alert.alert(
          "Couldn't analyze this image",
          err instanceof Error ? err.message : "Please try a clearer photo.",
        );
      },
    },
  });

  async function pickFromCamera() {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera access needed",
        "Allow camera access in Settings to scan receipts.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      allowsEditing: false,
    });
    handleResult(result);
  }

  async function pickFromLibrary() {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
      allowsEditing: false,
    });
    handleResult(result);
  }

  function handleResult(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert("Image error", "Could not read this image. Try another one.");
      return;
    }
    const mimeType = asset.mimeType ?? guessMime(asset.uri);
    setPreview({ uri: asset.uri, base64: asset.base64, mimeType });
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

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        WHAT ARE YOU SCANNING?
      </Text>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {SOURCE_OPTIONS.map((opt) => {
          const active = sourceType === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setSourceType(opt.key)}
              style={[
                styles.sourceRow,
                {
                  backgroundColor: active ? `${colors.primary}10` : colors.card,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.sourceIcon,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : `${colors.primary}15`,
                  },
                ]}
              >
                <Feather
                  name={opt.icon}
                  size={18}
                  color={active ? colors.primaryForeground : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceLabel, { color: colors.foreground }]}>
                  {opt.label}
                </Text>
                <Text
                  style={[
                    styles.sourceDesc,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {opt.description}
                </Text>
              </View>
              {active ? (
                <Feather name="check-circle" size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
      </View>

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
              <Text style={styles.overlayText}>
                Reading items from your photo...
              </Text>
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
            Use your camera or pick from your photo library.
          </Text>
        </View>
      )}

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
    </ScrollView>
  );
}

function guessMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
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
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
  },
  sourceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  sourceDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
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
});
