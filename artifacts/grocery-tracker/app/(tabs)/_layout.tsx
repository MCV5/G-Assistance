import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
          headerShown: false,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : colors.background,
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: colors.border,
            elevation: 0,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: colors.background },
                ]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={24} />
              ) : (
                <Feather name="home" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="shopping"
          options={{
            title: "List",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="cart" tintColor={color} size={24} />
              ) : (
                <Feather name="shopping-cart" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="pantry"
          options={{
            title: "Kitchen",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="basket" tintColor={color} size={24} />
              ) : (
                <Feather name="grid" size={22} color={color} />
              ),
          }}
        />
        {/* Reachable via Home / List CTAs — not primary destinations */}
        <Tabs.Screen
          name="scan"
          options={{
            href: null,
            title: "Scan",
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            href: null,
            title: "Insights",
          }}
        />
      </Tabs>
    </View>
  );
}
