import { Feather } from "@expo/vector-icons";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileCard } from "@/components/ProfileCard";
import { useAuth } from "@/lib/auth";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 16 : 12;

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email ||
      "Account"
    : "Account";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 28,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Your account and sign-in settings.
      </Text>

      <View
        style={[
          styles.summaryRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: `${colors.primary}22` },
          ]}
        >
          <Feather name="user" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          {user?.email ? (
            <Text
              style={[styles.email, { color: colors.mutedForeground }]}
              numberOfLines={2}
            >
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}
      >
        ACCOUNT
      </Text>
      <View style={{ marginTop: 10 }}>
        <ProfileCard />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
});
