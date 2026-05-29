import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
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
import type { VoiceAddSpeechBridgeRef } from "@/lib/voiceAddSpeechTypes";
import { useColors } from "@/hooks/useColors";
import { canUseNativeSpeech } from "@/lib/canUseNativeSpeech";
import { guessCategory } from "@/lib/guessCategory";
import { parseShoppingListText } from "@/lib/shoppingListApi";
import type { Category } from "@/lib/types";

type ReviewItem = {
  id: string;
  name: string;
  category: Category;
};

type Step = "capture" | "review";

type SpeechBridgeComponent = ComponentType<{
  ref?: React.Ref<VoiceAddSpeechBridgeRef>;
  onTranscript: (text: string, isFinal: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  onError: (message: string) => void;
  onAvailability: (available: boolean) => void;
}>;

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
  const speechRef = useRef<VoiceAddSpeechBridgeRef>(null);
  const [SpeechBridge, setSpeechBridge] = useState<SpeechBridgeComponent | null>(
    null,
  );
  const [step, setStep] = useState<Step>("capture");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (!canUseNativeSpeech()) {
      setSpeechAvailable(false);
      return;
    }
    let cancelled = false;
    void import("@/components/VoiceAddSpeechBridge")
      .then((mod) => {
        if (!cancelled) setSpeechBridge(() => mod.VoiceAddSpeechBridge);
      })
      .catch(() => {
        if (!cancelled) setSpeechAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleTranscript = useCallback((transcript: string, isFinal: boolean) => {
    setText((prev) => {
      if (isFinal) {
        const base = prev.trim();
        return base ? `${base} ${transcript}` : transcript;
      }
      return transcript;
    });
  }, []);

  const reset = useCallback(() => {
    setStep("capture");
    setText("");
    setListening(false);
    setParsing(false);
    setReviewItems([]);
    setError(null);
    speechRef.current?.stop();
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const startListening = useCallback(async () => {
    setError(null);
    const started = await speechRef.current?.start();
    if (started && Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const stopListening = useCallback(() => {
    speechRef.current?.stop();
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

  const showMic = speechAvailable && SpeechBridge;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      {SpeechBridge ? (
        <SpeechBridge
          ref={speechRef}
          onTranscript={handleTranscript}
          onListeningChange={setListening}
          onError={setError}
          onAvailability={setSpeechAvailable}
        />
      ) : null}

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
              {showMic
                ? "Say everything you want — cookie butter, milk, chili lime chips — and we'll add it to your shopping list."
                : "Type your list below — cookie butter, milk, chili lime chips — and we'll add it to your shopping list."}
            </Text>

            {showMic ? (
              <Pressable
                onPress={listening ? stopListening : startListening}
                style={[
                  s.micBtn,
                  {
                    backgroundColor: listening ? colors.destructive : colors.primary,
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
            ) : (
              <View
                style={[
                  s.micHint,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="info" size={16} color={colors.mutedForeground} />
                <Text style={[s.micHintText, { color: colors.mutedForeground }]}>
                  Voice needs a dev build on your phone. Typing works everywhere.
                </Text>
              </View>
            )}

            {showMic ? (
              <Text style={[s.or, { color: colors.mutedForeground }]}>
                or type / edit below
              </Text>
            ) : null}

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
  micHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  micHintText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
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
