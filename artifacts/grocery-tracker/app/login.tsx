import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAuthErrorMessage } from "@/lib/auth-errors";
import { useAuth } from "@/lib/auth";

// Design tokens — bold typographic / dark-forest theme
const D = {
  greenDark:   "#1C3A0A",
  greenMid:    "#2D5016",
  greenLight:  "#A8C97F",
  cream:       "#F5F1E8",
  creamDark:   "#EDEAE0",
  creamBorder: "#C8C4BA",
  inkBlack:    "#1A1A1A",
  inkMid:      "#5A5750",
  inkLight:    "#9E9B96",
};

type Mode = "login" | "signup";

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const maxW = Math.min(screenW, 430);
  const router = useRouter();
  const { login, signup } = useAuth();

  const [mode, setMode]           = useState<Mode>("login");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchMode = (next: Mode) => {
    if (submitting) return;
    setMode(next);
    setError(null);
    Animated.spring(tabAnim, {
      toValue: next === "login" ? 0 : 1,
      useNativeDriver: false,
      damping: 20,
      stiffness: 160,
    }).start();
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
      setError(getAuthErrorMessage(err, mode === "signup" ? "signup" : "login"));
    } finally {
      setSubmitting(false);
    }
  };

  const tabLeft = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "50%"],
  });

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: D.cream }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor={D.cream} />

      {/* Top accent stripe */}
      <View style={s.stripe} />

      <ScrollView
        style={s.flex}
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 36, alignItems: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.body, { width: maxW }]}>
          {/* Brand header */}
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={s.eyebrow}>GROCERY TRACKER</Text>
              <Text style={s.headline}>
                {"TRACK "}
                <Text style={s.headlineAccent}>SMARTER.</Text>
              </Text>
            </View>
            <Pressable
              style={s.introBtn}
              onPress={() => router.push("/onboarding")}
            >
              <Text style={s.introBtnTxt}>How it works →</Text>
            </Pressable>
          </View>

          <View style={s.divider} />

          {/* Animated tab switcher */}
          <View style={s.tabs}>
            <Animated.View style={[s.tabSlider, { left: tabLeft }]} />
            <Pressable style={s.tabBtn} onPress={() => switchMode("login")}>
              <Text style={[s.tabTxt, mode === "login" && s.tabTxtActive]}>
                LOG IN
              </Text>
            </Pressable>
            <Pressable style={s.tabBtn} onPress={() => switchMode("signup")}>
              <Text style={[s.tabTxt, mode === "signup" && s.tabTxtActive]}>
                SIGN UP
              </Text>
            </Pressable>
          </View>

          {/* Form */}
          {mode === "signup" && (
            <>
              <Text style={s.label}>FIRST NAME</Text>
              <TextInput
                style={s.input}
                placeholder="Alex"
                placeholderTextColor={D.inkLight}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </>
          )}

          <Text style={s.label}>EMAIL</Text>
          <TextInput
            style={s.input}
            placeholder="you@example.com"
            placeholderTextColor={D.inkLight}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />

          <Text style={s.label}>PASSWORD</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={D.inkLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {mode === "signup" && (
            <Text style={s.hint}>Min. 6 characters</Text>
          )}

          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => [
              s.submit,
              { opacity: pressed || submitting ? 0.7 : 1 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={D.cream} />
            ) : (
              <Text style={s.submitTxt}>
                {mode === "login" ? "→ ENTER" : "→ CREATE ACCOUNT"}
              </Text>
            )}
          </Pressable>

          {mode === "login" ? (
            <Pressable
              style={s.forgotWrap}
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={s.forgotTxt}>Forgot your password?</Text>
            </Pressable>
          ) : (
            <Pressable
              style={s.forgotWrap}
              onPress={() => switchMode("login")}
            >
              <Text style={s.forgotTxt}>Already have an account? Log in</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:  { flex: 1 },
  scroll: { flexGrow: 1 },

  stripe: {
    height: 5,
    backgroundColor: D.greenMid,
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2.5,
    color: D.greenMid,
    marginBottom: 10,
    textTransform: "uppercase",
  },

  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 44,
    color: D.inkBlack,
    lineHeight: 46,
    textTransform: "uppercase",
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: D.greenMid,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
  },
  introBtn: {
    paddingBottom: 4,
    paddingLeft: 8,
  },
  introBtnTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.greenMid,
  },

  divider: {
    height: 1,
    backgroundColor: D.creamBorder,
    marginVertical: 18,
  },

  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
    height: 42,
  },
  tabSlider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "50%",
    backgroundColor: D.greenMid,
    borderRadius: 5,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: D.inkMid,
  },
  tabTxtActive: {
    color: D.cream,
  },

  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkMid,
    marginBottom: 6,
    marginTop: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: D.inkBlack,
    marginBottom: 2,
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkLight,
    marginBottom: 10,
    marginTop: 4,
  },

  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  errorTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#B91C1C",
  },

  submit: {
    backgroundColor: D.greenMid,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  submitTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: D.cream,
    letterSpacing: 1.5,
  },

  forgotWrap: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 4,
  },
  forgotTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
  },
});
