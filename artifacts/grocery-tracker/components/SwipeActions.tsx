import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { boldTheme as D } from "@/constants/colors";

export function SwipeAddAction() {
  return (
    <View style={[s.action, s.addBg]}>
      <Feather name="shopping-cart" size={18} color="#fff" />
      <Text style={s.label}>Add to list</Text>
    </View>
  );
}

export function SwipeUsedAction() {
  return (
    <View style={[s.action, s.usedBg]}>
      <Feather name="check-circle" size={18} color="#fff" />
      <Text style={s.label}>Used it</Text>
    </View>
  );
}

export function SwipeRemoveAction() {
  return (
    <View style={[s.action, s.removeBg]}>
      <Feather name="trash-2" size={18} color="#fff" />
      <Text style={s.label}>Remove</Text>
    </View>
  );
}

const s = StyleSheet.create({
  action: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 5,
    borderRadius: 12,
    marginVertical: 1,
  },
  addBg: {
    backgroundColor: D.greenMid,
  },
  usedBg: {
    backgroundColor: D.amber,
  },
  removeBg: {
    backgroundColor: "#C0392B",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#fff",
    letterSpacing: 0.3,
  },
});
