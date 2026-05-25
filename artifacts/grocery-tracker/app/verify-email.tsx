import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
    verificationEmailSent,
    verificationEmailError,
    logout,
    user,
  } = useAuth();

  const paramEmail = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const paramToken = typeof params.token === "string" ? params.token : "";
  const paramCode = typeof params.code === "string" ? params.code.replace(/\D/g, "") : "";

  const [codeInput, setCodeInput] = useState(
    paramCode.length >= 6 && paramCode.length <= 6 ? paramCode : "",
  );
  const emailForConfirm = (user?.email ?? paramEmail).trim().toLowerCase();

  const attemptedAutoRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendHint, setResendHint] = useState<string | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);

  const runConfirm = useCallback(
    async (opts: { token?: string; code?: string }) => {
      const email = emailForConfirm || paramEmail;
      if (!email) {
        setError("Enter your email on the Log in screen first, then come back here.");
        setStatus("error");
        return;
      }
      setStatus("working");
      setError(null);
      try {
        await confirmEmailAddress(email, opts);
        if (isAuthenticated) {
          await syncAuthUser();
        }
        setStatus("done");
      } catch (err: unknown) {
        setStatus("error");
        setError(getAuthErrorMessage(err, "resetPassword"));
      }
    },
    [confirmEmailAddress, emailForConfirm, paramEmail, syncAuthUser, isAuthenticated],
  );

  useEffect(() => {
    const autoCode =
      paramCode.length === 6 ? paramCode : codeInput.length === 6 ? codeInput : "";
    const autoToken = paramToken.length >= 20 ? paramToken : "";
    if (attemptedAutoRef.current) return;
    if (!emailForConfirm && !paramEmail) return;
    if (autoCode.length !== 6 && autoToken.length < 20) return;

    attemptedAutoRef.current = true;
    void runConfirm(
      autoCode.length === 6 ? { code: autoCode } : { token: autoToken },
    );
  }, [emailForConfirm, paramEmail, paramCode, paramToken, codeInput, runConfirm]);

  const goNext = () => {
    if (isAuthenticated) {
      router.replace("/");
    } else {
      router.replace("/login");
    }
  };

  const onResend = useCallback(async () => {
    if (!isAuthenticated) {
      setResendHint("Log in first, then tap Resend code.");
      return;
    }
    setResendHint(null);
    setResendBusy(true);
    try {
      await resendVerificationEmail();
      setResendHint("Sent — check your inbox (and spam) for a new 6-digit code.");
    } catch (err: unknown) {
      setResendHint(getAuthErrorMessage(err, "resetPassword"));
    } finally {
      setResendBusy(false);
    }
  }, [isAuthenticated, resendVerificationEmail]);

  const onSubmitCode = useCallback(async () => {
    const digits = codeInput.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter all 6 digits from your email.");
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

  const busy = status === "working" || submitBusy;
  const digitsOnly = codeInput.replace(/\D/g, "");
  const canVerify = digitsOnly.length === 6 && !busy;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + 12}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="always"
      >
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="mail" size={40} color={colors.primary} style={{ marginBottom: 12 }} />

          {status === "done" ? (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>{"You're verified"}</Text>
              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                Thanks — your email is confirmed. You can use the app now.
              </Text>
              <Pressable
                onPress={goNext}
                style={[styles.button, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.buttonText}>Continue to app</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>Confirm your email</Text>
              <Text style={[styles.subtitle, { color: colors.primary }]}>
                {isAuthenticated ? "Account ready — enter your code" : "Log in, then enter your code"}
              </Text>

              {!isAuthenticated ? (
                <Pressable
                  onPress={() => router.replace("/login")}
                  style={[styles.button, { backgroundColor: colors.primary, marginBottom: 12 }]}
                >
                  <Text style={styles.buttonText}>Go to Log in</Text>
                </Pressable>
              ) : null}

              {verificationEmailSent === false ? (
                <View style={[styles.warnBox, { borderColor: colors.border }]}>
                  <Text style={[styles.warnTxt, { color: colors.foreground }]}>
                    Email could not be sent from the server.
                    {verificationEmailError ? `\n\n${verificationEmailError}` : ""}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.body, { color: colors.mutedForeground }]}>
                Enter the <Text style={{ fontFamily: "Inter_600SemiBold" }}>6-digit code</Text>{" "}
                sent to{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }]}>
                  {emailForConfirm || paramEmail || "your email"}
                </Text>
                . Email links do not open Expo Go — typing the code here always works.
              </Text>

              <Pressable
                onPress={() => inputRef.current?.focus()}
                style={styles.codeTapTarget}
              >
                <TextInput
                  ref={inputRef}
                  value={codeInput}
                  onChangeText={(t) => {
                    setCodeInput(t.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="123456"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  editable={!busy}
                  autoFocus
                  selectTextOnFocus
                  textContentType="oneTimeCode"
                  autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
                  importantForAutofill="yes"
                  style={[
                    styles.codeInput,
                    {
                      borderColor: error ? colors.destructive : colors.border,
                      color: colors.foreground,
                      backgroundColor: colors.background,
                    },
                  ]}
                  accessibilityLabel="Six digit verification code"
                />
              </Pressable>

              <Text style={[styles.tapHint, { color: colors.mutedForeground }]}>
                Tap the box above if the keyboard does not appear
              </Text>

              {busy ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
              ) : null}

              {error ? (
                <Text style={[styles.hint, { color: colors.destructive }]}>{error}</Text>
              ) : null}

              <Pressable
                onPress={onSubmitCode}
                disabled={!canVerify}
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    opacity: canVerify ? 1 : 0.45,
                  },
                ]}
              >
                <Text style={styles.buttonText}>Verify email</Text>
              </Pressable>

              <Pressable
                onPress={onResend}
                disabled={resendBusy || !isAuthenticated}
                style={[
                  styles.buttonGhost,
                  { borderColor: colors.border, opacity: isAuthenticated ? 1 : 0.5 },
                ]}
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
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  title: { fontFamily: "Inter_600SemiBold", fontSize: 20, textAlign: "center", marginBottom: 6 },
  subtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 14,
  },
  warnBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#FEF9C3",
  },
  warnTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
  },
  codeTapTarget: { width: "100%" },
  codeInput: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 32,
    letterSpacing: 10,
    textAlign: "center",
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    minHeight: 64,
  },
  tapHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
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
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
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
