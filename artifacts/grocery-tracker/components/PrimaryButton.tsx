import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  icon?: ComponentProps<typeof Feather>["name"];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  fullWidth,
  size = "md",
}: Props) {
  const colors = useColors();

  const palette = (() => {
    switch (variant) {
      case "primary":
        return {
          bg: colors.primary,
          fg: colors.primaryForeground,
          border: colors.primary,
        };
      case "secondary":
        return {
          bg: colors.secondary,
          fg: colors.secondaryForeground,
          border: colors.border,
        };
      case "destructive":
        return {
          bg: colors.destructive,
          fg: colors.destructiveForeground,
          border: colors.destructive,
        };
      case "ghost":
        return {
          bg: "transparent",
          fg: colors.foreground,
          border: "transparent",
        };
    }
  })();

  const heightMap = { sm: 38, md: 48, lg: 56 } as const;
  const fontSizeMap = { sm: 14, md: 16, lg: 17 } as const;

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          height: heightMap[size],
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon ? (
              <Feather
                name={icon}
                size={fontSizeMap[size] + 2}
                color={palette.fg}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                {
                  color: palette.fg,
                  fontSize: fontSizeMap[size],
                },
              ]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
  },
});
