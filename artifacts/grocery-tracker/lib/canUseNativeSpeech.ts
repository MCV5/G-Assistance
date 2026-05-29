import Constants from "expo-constants";
import { Platform } from "react-native";

/** Native speech recognition is unavailable in Expo Go (requires a dev build). */
export function canUseNativeSpeech(): boolean {
  if (Platform.OS === "web") return true;
  return Constants.appOwnership !== "expo";
}
