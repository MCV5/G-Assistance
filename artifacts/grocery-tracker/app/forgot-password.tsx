import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestPasswordReset, resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string; token?: string }>();

  const prefilledEmail = typeof params.email === "string" ? params.email : "";
  const resetToken = typeof params.token === "string" ? params.token : "";

  const [email, setEmail] = useState(prefilledEmail);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [debugResetLink, setDebugResetLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasToken = resetToken.length > 0;

  const requestLink = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email.");
      return;
    }
    try {
      setSubmitting(true);
      const response = await requestPasswordReset(email.trim().toLowerCase());
      setRequested(true);
      setDebugResetLink(response.resetLink ?? null);
    } catch (err: unknown) {
      setError(
        "Couldn't send the reset link right now. Please check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    try {
      setSubmitting(true);
      await resetPassword(email.trim().toLowerCase(), resetToken, newPassword);
      router.replace("/login");
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "resetPassword"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backRow}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={[styles.backLabel, { color: colors.foreground }]}>
            Back
          </Text>
        </Pressable>

        <View style={styles.header}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: `${colors.primary}1f` },
            ]}
          >
            <Feather name="key" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Reset your password
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {hasToken
              ? "Enter your email and choose a new password."
              : "Use the same email you signed up with. If an account exists, we'll send reset instructions to that inbox."}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          {hasToken ? (
            <Field
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="At least 6 characters"
            />
          ) : null}

          {requested ? (
            <Text style={[styles.success, { color: colors.primary }]}>
              If an account exists for that email, we sent instructions. Check your
              inbox and spam. If nothing arrives after a few minutes, try another
              email or confirm you didn't typo the address.
            </Text>
          ) : null}
          {debugResetLink ? (
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
              Dev reset link: {debugResetLink}
            </Text>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={hasToken ? submitReset : requestLink}
            disabled={submitting}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed || submitting ? 0.85 : 1,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text
                style={[
                  styles.primaryLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                {hasToken ? "Reset password" : "Request reset email"}
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          {hasToken
            ? "Reset links expire after about an hour. Request a new email if this one stops working."
            : "For your security, we use the same message whether or not that email is in our system — only a real account receives mail."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
}

function Field({ label, ...rest }: FieldProps) {
  const colors = useColors();
  return (
    <View style={{ gap: 6, marginTop: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
        {label}
      </Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 12,
  },
  success: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 12,
  },
  fieldHint: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  helper: {
    marginTop: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
});
