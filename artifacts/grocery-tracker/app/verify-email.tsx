import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/lib/auth";

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const { confirmEmailAddress, isAuthenticated, syncAuthUser } = useAuth();

  const prefilledEmail = typeof params.email === "string" ? params.email : "";
  const token = typeof params.token === "string" ? params.token : "";

  const attemptedRef = useRef(false);
  const hasLink = token.length >= 20 && Boolean(prefilledEmail.trim());
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    hasLink ? "working" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLink || attemptedRef.current) return;
    attemptedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        setStatus("working");
        setError(null);
        await confirmEmailAddress(prefilledEmail.trim().toLowerCase(), token);
        await syncAuthUser();
        if (!cancelled) setStatus("done");
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus("error");
          setError(getAuthErrorMessage(err, "resetPassword"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLink, confirmEmailAddress, prefilledEmail, token, syncAuthUser]);

  const goNext = () => {
    router.replace(isAuthenticated ? "/" : "/login");
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="mail" size={40} color={colors.primary} style={{ marginBottom: 12 }} />
        {status === "working" ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Verifying your email…
            </Text>
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          </>
        ) : status === "done" ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>{"You're verified"}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Thanks — your email is confirmed.
            </Text>
            <Pressable
              onPress={goNext}
              style={[styles.button, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </>
        ) : status === "error" ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>{"Link didn't work"}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable
              onPress={() => router.back()}
              style={[styles.button, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Open your verification link
            </Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Tap the link in the email we sent you. If something went wrong, use “Resend” from the banner
              in the app while {"you're"} logged in.
            </Text>
            <Pressable
              onPress={() => router.replace(isAuthenticated ? "/" : "/login")}
              style={[styles.buttonGhost, { borderColor: colors.border }]}
            >
              <Text style={[styles.buttonGhostText, { color: colors.primary }]}>Close</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, justifyContent: "center" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 20, textAlign: "center", marginBottom: 10 },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  button: { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 10 },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  buttonGhost: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonGhostText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
