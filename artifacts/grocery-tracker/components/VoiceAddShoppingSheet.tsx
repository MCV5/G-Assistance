import { Feather } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CategoryIcon } from "@/components/CategoryIcon";
import { useColors } from "@/hooks/useColors";
import { guessCategory } from "@/lib/guessCategory";
import { parseShoppingListText } from "@/lib/shoppingListApi";
import type { Category } from "@/lib/types";

type ReviewItem = {
  id: string;
  name: string;
  category: Category;
};

type Step = "capture" | "review";

interface Props {
  visible: boolean;
  onClose: () => void;
  onAddItems: (items: { name: string; category: Category }[]) => void | Promise<void>;
}

export function VoiceAddShoppingSheet({
  visible,
  onClose,
  onAddItems,
}: Props) {
  const colors = useColors();
  const [step, setStep] = useState<Step>("capture");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (!transcript) return;
    setText((prev) => {
      if (event.isFinal) {
        const base = prev.trim();
        return base ? `${base} ${transcript}` : transcript;
      }
      return transcript;
    });
  });

  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (event.error !== "aborted" && event.error !== "no-speech") {
      setError("Could not hear that. Try again or type your list.");
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
  });

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      try {
        const available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
        setSpeechAvailable(available);
      } catch {
        setSpeechAvailable(false);
      }
    })();
  }, [visible]);

  const reset = useCallback(() => {
    setStep("capture");
    setText("");
    setListening(false);
    setParsing(false);
    setReviewItems([]);
    setError(null);
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* noop */
    }
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Microphone permission is needed to capture your list.");
        return;
      }
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: true,
        continuous: true,
      });
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      setError("Voice input is not available on this device. Type your list instead.");
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const handleParse = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setError("Say or type at least one item.");
      return;
    }
    stopListening();
    setParsing(true);
    setError(null);
    try {
      const parsed = await parseShoppingListText(trimmed);
      if (parsed.length === 0) {
        setError("Could not find any items. Try separating with commas.");
        return;
      }
      setReviewItems(
        parsed.map((it, i) => ({
          id: `rev_${Date.now()}_${i}`,
          name: it.name,
          category: it.category,
        })),
      );
      setStep("review");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setParsing(false);
    }
  }, [stopListening, text]);

  const handleAddAll = useCallback(async () => {
    const items = reviewItems
      .map((it) => ({ name: it.name.trim(), category: it.category }))
      .filter((it) => it.name.length >= 2);
    if (items.length === 0) return;
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await onAddItems(items);
    handleClose();
  }, [handleClose, onAddItems, reviewItems]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[s.sheet, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <Text style={[s.title, { color: colors.foreground }]}>
            {step === "capture" ? "Tell us what to buy" : "Review your list"}
          </Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {step === "capture" ? (
          <>
            <Text style={[s.sub, { color: colors.mutedForeground }]}>
              Say everything you want — cookie butter, milk, chili lime chips —
              and we&apos;ll add it to your shopping list.
            </Text>

            <Pressable
              onPress={listening ? stopListening : startListening}
              disabled={!speechAvailable && Platform.OS !== "web"}
              style={[
                s.micBtn,
                {
                  backgroundColor: listening ? colors.destructive : colors.primary,
                  opacity: speechAvailable || Platform.OS === "web" ? 1 : 0.5,
                },
              ]}
            >
              <Feather
                name={listening ? "square" : "mic"}
                size={28}
                color={colors.primaryForeground}
              />
              <Text style={[s.micLabel, { color: colors.primaryForeground }]}>
                {listening ? "Stop listening" : "Tap and speak"}
              </Text>
            </Pressable>

            <Text style={[s.or, { color: colors.mutedForeground }]}>
              or type / edit below
            </Text>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="e.g. Cookie butter, oat milk, everything bagel seasoning"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                s.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              onPress={handleParse}
              disabled={parsing || text.trim().length < 2}
              style={[
                s.primaryBtn,
                {
                  backgroundColor:
                    parsing || text.trim().length < 2
                      ? colors.border
                      : colors.primary,
                },
              ]}
            >
              {parsing ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
                  <Text style={[s.primaryBtnTxt, { color: colors.primaryForeground }]}>
                    Next — review items
                  </Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[s.sub, { color: colors.mutedForeground }]}>
              Remove anything you don&apos;t want, then add the rest to your list.
            </Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }}>
              {reviewItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    s.reviewRow,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <CategoryIcon category={item.category} size={32} />
                  <TextInput
                    value={item.name}
                    onChangeText={(v) =>
                      setReviewItems((cur) =>
                        cur.map((r) =>
                          r.id === item.id
                            ? { ...r, name: v, category: guessCategory(v) }
                            : r,
                        ),
                      )
                    }
                    style={[s.reviewName, { color: colors.foreground }]}
                  />
                  <Pressable
                    onPress={() =>
                      setReviewItems((cur) => cur.filter((r) => r.id !== item.id))
                    }
                    hitSlop={8}
                  >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <View style={s.reviewActions}>
              <Pressable
                onPress={() => setStep("capture")}
                style={[s.ghostBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.ghostBtnTxt, { color: colors.foreground }]}>
                  Back
                </Text>
              </Pressable>
              <Pressable
                onPress={handleAddAll}
                disabled={reviewItems.length === 0}
                style={[
                  s.primaryBtn,
                  {
                    flex: 1,
                    backgroundColor:
                      reviewItems.length === 0 ? colors.border : colors.primary,
                  },
                ]}
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
                <Text style={[s.primaryBtnTxt, { color: colors.primaryForeground }]}>
                  Add {reviewItems.length} to list
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    flex: 1,
    paddingRight: 12,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  micBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 22,
    borderRadius: 16,
    marginBottom: 14,
  },
  micLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  or: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#c0392b",
    marginBottom: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryBtnTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    paddingVertical: 4,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  ghostBtn: {
    paddingHorizontal: 18,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
