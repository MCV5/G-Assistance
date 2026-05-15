import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  const params = useLocalSearchParams<{ email?: string; token?: string; code?: string }>();
  const {
    confirmEmailAddress,
    isAuthenticated,
    syncAuthUser,
    resendVerificationEmail,
    logout,
    user,
  } = useAuth();

  const paramEmail = typeof params.email === "string" ? params.email : "";
  const paramToken = typeof params.token === "string" ? params.token : "";
  const paramCode = typeof params.code === "string" ? params.code.replace(/\D/g, "") : "";

  const [codeInput, setCodeInput] = useState(paramCode.length === 6 ? paramCode : "");
  const emailForConfirm = (user?.email ?? paramEmail).trim().toLowerCase();

  const attemptedRef = useRef(false);
  const hasAutoConfirm =
    Boolean(emailForConfirm) &&
    (paramToken.length >= 20 || paramCode.length === 6);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    hasAutoConfirm ? "working" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  const needsEmailConfirmation =
    isAuthenticated && user?.emailVerified === false && !hasAutoConfirm;

  const runConfirm = useCallback(
    async (opts: { token?: string; code?: string }) => {
      if (!emailForConfirm) {
        setError("Sign in first, then enter the code from your email.");
        setStatus("error");
        return;
      }
      setStatus("working");
      setError(null);
      try {
        await confirmEmailAddress(emailForConfirm, opts);
        await syncAuthUser();
        setStatus("done");
      } catch (err: unknown) {
        setStatus("error");
        setError(getAuthErrorMessage(err, "resetPassword"));
      }
    },
    [confirmEmailAddress, emailForConfirm, syncAuthUser],
  );

  useEffect(() => {
    if (!hasAutoConfirm || attemptedRef.current) return;
    attemptedRef.current = true;
    void runConfirm(
      paramCode.length === 6
        ? { code: paramCode }
        : { token: paramToken },
    );
  }, [hasAutoConfirm, paramCode, paramToken, runConfirm]);

  const goNext = () => {
    router.replace(isAuthenticated ? "/" : "/login");
  };

  const onResend = useCallback(async () => {
    setResendHint(null);
    setResendBusy(true);
    try {
      await resendVerificationEmail();
      setResendHint("Sent — check your inbox for a new 6-digit code.");
    } catch {
      setResendHint("Could not send right now. Try again in a minute.");
    } finally {
      setResendBusy(false);
    }
  }, [resendVerificationEmail]);

  const onSubmitCode = useCallback(async () => {
    const digits = codeInput.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitBusy(true);
    await runConfirm({ code: digits });
    setSubmitBusy(false);
  }, [codeInput, runConfirm]);

  const onSignOut = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout, router]);

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
        ) : status === "error" && !needsEmailConfirmation ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>{"Couldn't verify"}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{error}</Text>
            <Pressable
              onPress={() => setStatus("idle")}
              style={[styles.button, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        ) : needsEmailConfirmation || status === "idle" || status === "error" ? (
          <>
            <Text style={[styles.title, { color: colors.foreground }]}>Confirm your email</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              We emailed a <Text style={{ fontFamily: "Inter_600SemiBold" }}>6-digit code</Text> to{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                {(user?.email ?? emailForConfirm) || "your inbox"}
              </Text>
              . Enter it below. Links from email often do not open Expo Go — the code always works.
            </Text>
            <TextInput
              value={codeInput}
              onChangeText={(t) => {
                setCodeInput(t.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              style={[
                styles.codeInput,
                {
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                },
              ]}
              accessibilityLabel="Verification code"
            />
            {error ? (
              <Text style={[styles.hint, { color: colors.destructive }]}>{error}</Text>
            ) : null}
            <Pressable
              onPress={onSubmitCode}
              disabled={submitBusy || codeInput.length !== 6}
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: codeInput.length === 6 ? 1 : 0.5,
                },
              ]}
            >
              {submitBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              onPress={onResend}
              disabled={resendBusy}
              style={[styles.buttonGhost, { borderColor: colors.border }]}
            >
              {resendBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.buttonGhostText, { color: colors.primary }]}>
                  Resend code
                </Text>
              )}
            </Pressable>
            {resendHint ? (
              <Text style={[styles.hint, { color: colors.primary }]}>{resendHint}</Text>
            ) : null}
            <Pressable
              onPress={onSignOut}
              style={[styles.buttonGhost, { borderColor: colors.border, marginTop: 8 }]}
            >
              <Text style={[styles.buttonGhostText, { color: colors.primary }]}>Sign out</Text>
            </Pressable>
          </>
        ) : null}
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
    alignItems: "stretch",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 20, textAlign: "center", marginBottom: 10 },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  codeInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 28,
    letterSpacing: 8,
    textAlign: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 12,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 8,
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff" },
  buttonGhost: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  buttonGhostText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
