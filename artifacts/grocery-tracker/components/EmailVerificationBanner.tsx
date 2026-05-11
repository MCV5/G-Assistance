import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export function EmailVerificationBanner() {
  const colors = useColors();
  const { resendVerificationEmail, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const onResend = useCallback(async () => {
    setHint(null);
    setBusy(true);
    try {
      await resendVerificationEmail();
      setHint("Check your inbox for a new link.");
    } catch {
      setHint("Couldn’t send right now. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  }, [resendVerificationEmail]);

  if (!user || user.emailVerified !== false) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.warning + "33",
          borderBottomColor: colors.border,
        },
      ]}
      accessibilityRole="alert"
    >
      <Feather name="alert-circle" size={18} color={colors.primary} style={styles.icon} />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.foreground }]}>Verify your email</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          We sent a link to {user.email ?? "your address"}. Confirm it to secure your account.
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: colors.primary }]}>{hint}</Text>
        ) : null}
        <Pressable
          onPress={onResend}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Resend verification email"
          style={[styles.btn, { borderColor: colors.primary }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={[styles.btnLabel, { color: colors.primary }]}>Resend email</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { marginTop: 2, marginRight: 10 },
  textCol: { flex: 1 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  hint: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 6 },
  btn: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: "center",
  },
  btnLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
