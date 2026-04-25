import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { ItemStatus } from "@/lib/types";
import { getStatusLabel } from "@/lib/predictions";

interface Props {
  status: ItemStatus;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: Props) {
  const colors = useColors();
  const palette = (() => {
    switch (status) {
      case "fresh":
        return { bg: `${colors.success}22`, fg: colors.success };
      case "running-low":
        return { bg: `${colors.warning}22`, fg: colors.warning };
      case "due":
        return { bg: `${colors.warning}33`, fg: colors.warning };
      case "overdue":
      case "expired":
        return { bg: `${colors.destructive}22`, fg: colors.destructive };
    }
  })();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.bg,
          paddingVertical: size === "sm" ? 3 : 5,
          paddingHorizontal: size === "sm" ? 8 : 10,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: palette.fg,
            fontSize: size === "sm" ? 11 : 13,
          },
        ]}
      >
        {getStatusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
});
