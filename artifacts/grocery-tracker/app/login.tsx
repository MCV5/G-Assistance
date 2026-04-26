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

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

interface Step {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: "camera",
    title: "Snap your groceries",
    body: "Photograph a receipt, bag, or your full cart.",
  },
  {
    icon: "zap",
    title: "AI extracts every item",
    body: "Names, categories, and quantities — automatically.",
  },
  {
    icon: "package",
    title: "Track your pantry",
    body: "See what you have and what's running low at a glance.",
  },
  {
    icon: "trending-up",
    title: "Predict your restocks",
    body: "We learn your rhythm and tell you when to buy again.",
  },
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    if (submitting) return;
    setMode(next);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!isValidEmail(email)) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      if (mode === "signup") {
        await signup(email.trim().toLowerCase(), password, firstName);
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err instanceof Error ? err.message : null) ??
        "Something went wrong. Please try again.";
      setError(String(message));
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
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: colors.primary },
            ]}
          >
            <Feather
              name="shopping-bag"
              size={26}
              color={colors.primaryForeground}
            />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>
            Grocery Tracker
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Snap your groceries. We'll learn your rhythm and remind you what to
            restock.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.tabRow,
              { backgroundColor: `${colors.primary}14` },
            ]}
          >
            <TabButton
              label="Log in"
              active={mode === "login"}
              onPress={() => switchMode("login")}
            />
            <TabButton
              label="Sign up"
              active={mode === "signup"}
              onPress={() => switchMode("signup")}
            />
          </View>

          {mode === "signup" && (
            <Field
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              placeholder="Alex"
            />
          )}
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
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
          />

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={handleSubmit}
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
                {mode === "signup" ? "Create account" : "Log in"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              switchMode(mode === "signup" ? "login" : "signup")
            }
            style={styles.switchHint}
          >
            <Text
              style={[styles.switchText, { color: colors.mutedForeground }]}
            >
              {mode === "signup"
                ? "Already have an account? "
                : "New here? "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                {mode === "signup" ? "Log in" : "Create one"}
              </Text>
            </Text>
          </Pressable>

          {mode === "login" && (
            <Pressable
              onPress={() => router.push("/forgot-password")}
              style={styles.forgotHint}
              hitSlop={6}
            >
              <Text
                style={[styles.forgotText, { color: colors.primary }]}
              >
                Forgot your password?
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.previewSection}>
          <Text
            style={[styles.previewTitle, { color: colors.foreground }]}
          >
            How it works
          </Text>
          <View style={{ gap: 10 }}>
            {STEPS.map((step, idx) => (
              <View
                key={step.title}
                style={[
                  styles.stepRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepIcon,
                    { backgroundColor: `${colors.primary}1f` },
                  ]}
                >
                  <Feather name={step.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.stepNum, { color: colors.mutedForeground }]}
                  >
                    STEP {idx + 1}
                  </Text>
                  <Text
                    style={[styles.stepTitle, { color: colors.foreground }]}
                  >
                    {step.title}
                  </Text>
                  <Text
                    style={[
                      styles.stepBody,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {step.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabButton,
        active && { backgroundColor: colors.card },
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          {
            color: active ? colors.foreground : colors.mutedForeground,
            fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface FieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
}

function Field({ label, ...rest }: FieldProps) {
  const colors = useColors();
  return (
    <View style={{ gap: 6, marginTop: 14 }}>
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
  brand: {
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 320,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  tabRow: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 14,
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
  switchHint: {
    marginTop: 14,
    alignItems: "center",
  },
  switchText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  forgotHint: {
    marginTop: 8,
    alignItems: "center",
  },
  forgotText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  previewSection: {
    marginTop: 28,
    gap: 12,
  },
  previewTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.7,
  },
  stepTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginTop: 2,
  },
  stepBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
});
