import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import { RecoveryCodeScreen } from "@/components/RecoveryCodeScreen";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email.");
      return;
    }
    if (recoveryCode.replace(/[^A-Za-z0-9]/g, "").length < 8) {
      setError("Please enter your full recovery code.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    try {
      setSubmitting(true);
      const next = await resetPassword(
        email.trim().toLowerCase(),
        recoveryCode,
        newPassword,
      );
      setFreshCode(next);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err instanceof Error ? err.message : null) ??
        "Couldn't reset your password. Please try again.";
      setError(String(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (freshCode) {
    return (
      <RecoveryCodeScreen
        code={freshCode}
        title="Password updated"
        description="Your password is set. Here's your new recovery code — the old one no longer works. Save this somewhere safe."
        primaryLabel="Back to log in"
        onAcknowledge={() => router.replace("/login")}
      />
    );
  }

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
            Enter your email, the recovery code we showed you at signup, and
            your new password.
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
          <Field
            label="Recovery code"
            value={recoveryCode}
            onChangeText={setRecoveryCode}
            autoCapitalize="characters"
            placeholder="XXXX-XXXX-XXXX-XXXX"
          />
          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 6 characters"
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={submit}
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
                Reset password
              </Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Lost your recovery code? You'll need to create a new account.
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
