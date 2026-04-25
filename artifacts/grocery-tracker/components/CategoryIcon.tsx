import { Feather } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";

import { getCategoryIcon, getCategoryTone } from "@/lib/categories";
import type { Category } from "@/lib/types";

interface Props {
  category: Category;
  size?: number;
}

export function CategoryIcon({ category, size = 36 }: Props) {
  const tone = getCategoryTone(category);
  const icon = getCategoryIcon(category);
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${tone}22`,
        },
      ]}
    >
      <Feather name={icon} size={Math.round(size * 0.5)} color={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
