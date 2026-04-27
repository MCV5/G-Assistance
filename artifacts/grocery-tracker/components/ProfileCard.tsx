import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
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
  const { user, logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
    } finally {
      setSigningOut(false);
    }
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
        <View style={styles.securityHead}>
          <Feather name="key" size={14} color={colors.foreground} />
          <Text style={[styles.securityTitle, { color: colors.foreground }]}>
            Password reset
          </Text>
        </View>
        <Text style={[styles.securityNote, { color: colors.mutedForeground }]}>
          Need to change your password? We will email a secure reset link to your
          account address.
        </Text>
        <Pressable
          onPress={() => router.push("/forgot-password")}
          style={({ pressed }) => [
            styles.resetButton,
            {
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="mail" size={13} color={colors.foreground} />
          <Text style={[styles.resetLabel, { color: colors.foreground }]}>
            Send password reset link
          </Text>
        </Pressable>
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
  securityHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  securityTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  securityNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    lineHeight: 18,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  resetLabel: {
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
