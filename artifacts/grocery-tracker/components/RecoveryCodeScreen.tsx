import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Props {
  code: string;
  title?: string;
  description?: string;
  primaryLabel?: string;
  onAcknowledge: () => void;
}

export function RecoveryCodeScreen({
  code,
  title = "Save your recovery code",
  description = "If you ever forget your password, you'll need this code to get back into your account. Store it somewhere safe — we can't show it to you again.",
  primaryLabel = "I've saved it",
  onAcknowledge,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <View style={styles.iconWrap}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: `${colors.primary}1f` },
            ]}
          >
            <Feather name="key" size={26} color={colors.primary} />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          {description}
        </Text>

        <View
          style={[
            styles.codeBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.codeText, { color: colors.foreground }]}>
            {code}
          </Text>
          <Pressable
            onPress={copy}
            style={({ pressed }) => [
              styles.copyButton,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather
              name={copied ? "check" : "copy"}
              size={14}
              color={colors.foreground}
            />
            <Text style={[styles.copyLabel, { color: colors.foreground }]}>
              {copied ? "Copied" : "Copy"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setConfirmed((v) => !v)}
          style={styles.checkRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: confirmed ? colors.primary : colors.border,
                backgroundColor: confirmed ? colors.primary : "transparent",
              },
            ]}
          >
            {confirmed ? (
              <Feather name="check" size={13} color={colors.primaryForeground} />
            ) : null}
          </View>
          <Text style={[styles.checkLabel, { color: colors.foreground }]}>
            I've stored this code somewhere safe.
          </Text>
        </Pressable>

        <Pressable
          onPress={onAcknowledge}
          disabled={!confirmed}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: !confirmed ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text
            style={[styles.primaryLabel, { color: colors.primaryForeground }]}
          >
            {primaryLabel}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  iconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  codeBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 14,
  },
  codeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  copyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flex: 1,
  },
  primaryButton: {
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
