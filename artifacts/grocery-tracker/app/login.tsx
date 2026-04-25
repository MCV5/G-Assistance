import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();
  const [submitting, setSubmitting] = React.useState(false);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      await login();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = isLoading || submitting;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.brand}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: colors.primary },
          ]}
        >
          <Feather name="shopping-bag" size={28} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.appName, { color: colors.foreground }]}>
          Grocery Tracker
        </Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Snap your groceries. We'll learn your rhythm and remind you what to
          restock.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleLogin}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: colors.primary,
              opacity: pressed || busy ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="log-in" size={18} color={colors.primaryForeground} />
              <Text
                style={[
                  styles.primaryLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                Log in
              </Text>
            </>
          )}
        </Pressable>
        <Text style={[styles.fineprint, { color: colors.mutedForeground }]}>
          Your pantry, scans, and shopping list sync securely to your account.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  brand: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  iconBubble: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  actions: {
    gap: 14,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  fineprint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
