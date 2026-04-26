import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth";

export function ProfileCard() {
  const colors = useColors();
  const { user, logout, regenerateRecoveryCode } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const next = await regenerateRecoveryCode();
      setCode(next);
      setCopied(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't generate a new code.";
      Alert.alert("Recovery code", message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!user) return null;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Signed in";
  const initial = (user.firstName ?? user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.identityRow}>
        {user.profileImageUrl ? (
          <Image source={{ uri: user.profileImageUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: `${colors.primary}26` },
            ]}
          >
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>
              {initial}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          {user.email ? (
            <Text
              style={[styles.email, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.recoveryBox,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.recoveryHead}>
          <Feather name="key" size={14} color={colors.foreground} />
          <Text style={[styles.recoveryTitle, { color: colors.foreground }]}>
            Account recovery
          </Text>
        </View>
        {code ? (
          <>
            <Text style={[styles.codeText, { color: colors.foreground }]}>
              {code}
            </Text>
            <Text
              style={[styles.recoveryNote, { color: colors.mutedForeground }]}
            >
              Save this code. The previous one no longer works.
            </Text>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.copyButton,
                {
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name={copied ? "check" : "copy"}
                size={13}
                color={colors.foreground}
              />
              <Text style={[styles.copyLabel, { color: colors.foreground }]}>
                {copied ? "Copied" : "Copy code"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text
              style={[styles.recoveryNote, { color: colors.mutedForeground }]}
            >
              Generate a new code if you've lost the one you saved at signup.
              Doing this invalidates the previous code.
            </Text>
            <Pressable
              onPress={handleGenerate}
              disabled={generating}
              style={({ pressed }) => [
                styles.generateButton,
                {
                  borderColor: colors.border,
                  opacity: pressed || generating ? 0.7 : 1,
                },
              ]}
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Feather
                    name="refresh-cw"
                    size={13}
                    color={colors.foreground}
                  />
                  <Text
                    style={[styles.generateLabel, { color: colors.foreground }]}
                  >
                    Generate new recovery code
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </View>

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            borderColor: colors.border,
            opacity: pressed || signingOut ? 0.7 : 1,
          },
        ]}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <>
            <Feather name="log-out" size={15} color={colors.foreground} />
            <Text style={[styles.signOutLabel, { color: colors.foreground }]}>
              Log out
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  recoveryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  recoveryHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recoveryTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  recoveryNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
  },
  codeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    letterSpacing: 1.5,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  generateLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
  },
  copyLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  signOutLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
