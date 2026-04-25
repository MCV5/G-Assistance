import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { lookupBarcode } from "@/lib/barcode";

export default function BarcodeScanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);
  const isWeb = Platform.OS === "web";

  const handleCode = useCallback(async (code: string) => {
    const now = Date.now();
    if (
      lastCodeRef.current === code &&
      now - lastTimeRef.current < 2500
    ) {
      return;
    }
    lastCodeRef.current = code;
    lastTimeRef.current = now;

    setScanning(false);
    setBusy(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      const result = await lookupBarcode(code);
      const payload = encodeURIComponent(
        JSON.stringify({
          items: [
            {
              name: result.found
                ? result.brand
                  ? `${result.brand} ${result.name}`
                  : result.name
                : `Item ${code}`,
              category: result.category,
              quantity: result.quantity,
              unit: result.unit,
              estimatedShelfLifeDays: result.estimatedShelfLifeDays,
            },
          ],
          sourceType: "barcode",
          fromBarcode: true,
          notFound: !result.found,
          barcode: result.barcode,
        }),
      );
      router.replace(`/scan-review?data=${payload}`);
    } catch {
      setBusy(false);
      setScanning(true);
    }
  }, []);

  function submitManual() {
    const trimmed = manual.trim();
    if (!trimmed) return;
    handleCode(trimmed);
  }

  const renderManualEntry = () => (
    <View
      style={[
        styles.manualBox,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.manualTitle, { color: colors.foreground }]}>
        Type a barcode
      </Text>
      <Text style={[styles.manualSub, { color: colors.mutedForeground }]}>
        Web preview can't open the camera. You can still test by entering a
        barcode number manually.
      </Text>
      <TextInput
        value={manual}
        onChangeText={setManual}
        keyboardType="number-pad"
        placeholder="e.g. 737628064502"
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.manualInput,
          {
            backgroundColor: colors.background,
            color: colors.foreground,
            borderColor: colors.border,
          },
        ]}
      />
      <PrimaryButton
        label="Look up"
        icon="search"
        fullWidth
        onPress={submitManual}
        disabled={!manual.trim() || busy}
        loading={busy}
      />
    </View>
  );

  if (isWeb) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.webHeader}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Feather name="x" size={26} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.webTitle, { color: colors.foreground }]}>
            Barcode
          </Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.webBody}>{renderManualEntry()}</View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background, padding: 24 },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: `${colors.primary}1f` },
          ]}
        >
          <Feather name="camera-off" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.permTitle, { color: colors.foreground }]}>
          Camera access needed
        </Text>
        <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
          We need the camera to scan product barcodes. Photos are processed on
          your device.
        </Text>
        <View style={{ marginTop: 20, width: "100%", gap: 10 }}>
          <PrimaryButton
            label="Allow camera"
            icon="camera"
            fullWidth
            onPress={() => requestPermission()}
          />
          <PrimaryButton
            label="Cancel"
            variant="ghost"
            fullWidth
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "qr",
          ],
        }}
        onBarcodeScanned={
          scanning && !busy
            ? (event) => handleCode(event.data)
            : undefined
        }
      />
      <View
        style={[styles.topBar, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.topTitle}>Scan a barcode</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.frameHint}>
          Center the barcode in the frame
        </Text>
      </View>

      {busy ? (
        <View
          style={[StyleSheet.absoluteFillObject, styles.busyOverlay]}
          pointerEvents="auto"
        >
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.busyText}>Looking up product...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  permTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 6,
    textAlign: "center",
  },
  permSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  frameWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 270,
    height: 170,
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#fff",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  frameHint: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 16,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 4,
  },
  busyOverlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  busyText: {
    color: "#fff",
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  webTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  webBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  manualBox: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  manualTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  manualSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  manualInput: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
