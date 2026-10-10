import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useCallback,
  useEffect,
  useMemo,
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
import {
  buildFullTranscript,
  itemsFromTranscript,
  itemsToTranscript,
  mergePolishedItems,
  parseShoppingListLocally,
  type LiveShoppingItem,
  type SpeechTranscriptUpdate,
} from "@/lib/shoppingListLive";
import type { Category } from "@/lib/types";

type SpeechBridgeComponent = ComponentType<{
  ref?: React.Ref<VoiceAddSpeechBridgeRef>;
  onTranscriptUpdate: (update: SpeechTranscriptUpdate) => void;
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
  const autoStartedRef = useRef(false);
  // Bumped on every start/stop so a slow AI polish from an old session can't
  // overwrite items the user is now editing or re-dictating.
  const sessionRef = useRef(0);
  const listeningRef = useRef(false);
  const committedRef = useRef("");
  const interimRef = useRef("");
  const [SpeechBridge, setSpeechBridge] = useState<SpeechBridgeComponent | null>(
    null,
  );

  const [committed, setCommittedState] = useState("");
  const [interim, setInterimState] = useState("");
  const [items, setItemsState] = useState<LiveShoppingItem[]>([]);
  const itemsRef = useRef<LiveShoppingItem[]>([]);
  const setItems = useCallback(
    (
      next:
        | LiveShoppingItem[]
        | ((cur: LiveShoppingItem[]) => LiveShoppingItem[]),
    ) => {
      const value = typeof next === "function" ? next(itemsRef.current) : next;
      itemsRef.current = value;
      setItemsState(value);
    },
    [],
  );
  const [listening, setListeningState] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [showTypeField, setShowTypeField] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setCommitted = useCallback((v: string) => {
    committedRef.current = v;
    setCommittedState(v);
  }, []);
  const setInterim = useCallback((v: string) => {
    interimRef.current = v;
    setInterimState(v);
  }, []);
  const setListening = useCallback((v: boolean) => {
    listeningRef.current = v;
    setListeningState(v);
  }, []);

  const fullTranscript = useMemo(
    () => buildFullTranscript(committed, interim),
    [committed, interim],
  );

  const livePreview = useMemo(
    () => itemsFromTranscript(committed, interim),
    [committed, interim],
  );

  // Listening → live parse. Stopped → editable items. If the recognizer ended
  // before items were populated, fall back to the local parse so the list
  // never blanks on the user.
  const displayItems = useMemo<LiveShoppingItem[]>(() => {
    if (listening) return livePreview;
    if (items.length > 0) return items;
    return livePreview.map((it) => ({ ...it, pending: false }));
  }, [listening, livePreview, items]);
  const confirmedCount = displayItems.filter((it) => !it.pending).length;

  useEffect(() => {
    if (!visible) return;
    if (!canUseNativeSpeech()) {
      setSpeechAvailable(false);
      setShowTypeField(true);
      return;
    }
    let cancelled = false;
    void import("@/components/VoiceAddSpeechBridge")
      .then((mod) => {
        if (!cancelled) setSpeechBridge(() => mod.VoiceAddSpeechBridge);
      })
      .catch(() => {
        if (!cancelled) {
          setSpeechAvailable(false);
          setShowTypeField(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleTranscriptUpdate = useCallback((update: SpeechTranscriptUpdate) => {
    setCommitted(update.committed);
    setInterim(update.interim);
    if (update.isFinal && Platform.OS !== "web") {
      void Haptics.selectionAsync();
    }
  }, []);

  const reset = useCallback(() => {
    sessionRef.current += 1;
    setCommitted("");
    setInterim("");
    setItems([]);
    setListening(false);
    setPolishing(false);
    setAdding(false);
    setShowTypeField(false);
    setError(null);
    autoStartedRef.current = false;
    speechRef.current?.stop();
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  /**
   * Finalize a listening session: freeze the transcript, show a local parse
   * immediately so the list never blanks, then refine with the API.
   */
  const finalizeTranscript = useCallback(async (text: string) => {
    const session = ++sessionRef.current;
    const trimmed = text.trim();
    setInterim("");
    setCommitted(trimmed);

    if (trimmed.length < 2) {
      setItems([]);
      return;
    }

    const local = parseShoppingListLocally(trimmed).map((it) => ({
      ...it,
      pending: false,
    }));
    setItems(local);

    setPolishing(true);
    setError(null);
    try {
      const refined = await parseShoppingListText(trimmed);
      if (sessionRef.current !== session) return; // user started speaking again
      setItems((cur) => mergePolishedItems(cur, refined));
    } catch {
      if (sessionRef.current === session) {
        setError("Could not refine the list. You can still edit items below.");
      }
    } finally {
      if (sessionRef.current === session) setPolishing(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    sessionRef.current += 1;
    setPolishing(false);
    // Resume from what the user already has (including manual edits/removals).
    const seed =
      itemsRef.current.length > 0
        ? itemsToTranscript(itemsRef.current)
        : committedRef.current;
    setCommitted(seed);
    setInterim("");
    setItems([]); // live preview takes over while listening
    const started = await speechRef.current?.start(seed);
    if (started && Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [setCommitted, setInterim, setItems]);

  const stopListening = useCallback(() => {
    // Bridge fires onListeningChange(false), which finalizes the transcript.
    speechRef.current?.stop();
  }, []);

  const handleListeningChange = useCallback(
    (next: boolean) => {
      const wasListening = listeningRef.current;
      setListening(next);
      if (wasListening && !next) {
        // Covers manual stop, recognizer timeout, and errors — all end here.
        void finalizeTranscript(
          buildFullTranscript(committedRef.current, interimRef.current),
        );
      }
    },
    [finalizeTranscript],
  );

  useEffect(() => {
    if (!visible || !SpeechBridge || !speechAvailable || autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;
    void startListening();
  }, [visible, SpeechBridge, speechAvailable, startListening]);

  const handleTypedText = useCallback(
    (text: string) => {
      sessionRef.current += 1; // typing supersedes any in-flight polish
      setPolishing(false);
      setCommitted(text);
      setInterim("");
      setItems(parseShoppingListLocally(text).map((it) => ({ ...it, pending: false })));
    },
    [setCommitted, setInterim, setItems],
  );

  // Edits operate on `displayItems` (what the user sees) so they also work in
  // the fallback view before `items` has been populated.
  const removeItem = useCallback(
    (id: string) => {
      const next = displayItems.filter((it) => it.id !== id);
      setItems(next);
      setCommitted(itemsToTranscript(next));
    },
    [displayItems, setCommitted, setItems],
  );

  const updateItemName = useCallback(
    (id: string, name: string) => {
      setItems(
        displayItems.map((it) =>
          it.id === id
            ? { ...it, name, category: guessCategory(name), pending: false }
            : it,
        ),
      );
    },
    [displayItems, setItems],
  );

  const handleAddAll = useCallback(async () => {
    setError(null);
    setAdding(true);
    try {
      let payload: { name: string; category: Category }[];

      if (listeningRef.current) {
        // Tapped Add mid-speech: stop and parse everything heard so far.
        sessionRef.current += 1;
        setListening(false);
        speechRef.current?.stop();
        const text = buildFullTranscript(
          committedRef.current,
          interimRef.current,
        ).trim();
        setInterim("");
        setCommitted(text);
        if (text.length < 2) {
          setError("Say or type at least one item.");
          return;
        }
        payload = await parseShoppingListText(text);
      } else {
        // Not listening: submit exactly the rows the user sees and edited.
        payload = displayItems
          .filter((it) => !it.pending)
          .map((it) => ({ name: it.name, category: it.category }));
      }

      payload = payload
        .map((it) => ({ name: it.name.trim(), category: it.category }))
        .filter((it) => it.name.length >= 2);

      if (payload.length === 0) {
        setError("Could not find any items. Try separating with commas.");
        return;
      }

      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await onAddItems(payload);
      handleClose();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setAdding(false);
    }
  }, [displayItems, handleClose, onAddItems, setCommitted, setInterim, setListening]);

  const showMic = speechAvailable && SpeechBridge;
  const canAdd =
    !adding &&
    !polishing &&
    (listening
      ? fullTranscript.trim().length >= 2
      : displayItems.some((it) => !it.pending && it.name.trim().length >= 2));

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
          onTranscriptUpdate={handleTranscriptUpdate}
          onListeningChange={handleListeningChange}
          onError={setError}
          onAvailability={setSpeechAvailable}
        />
      ) : null}

      <View style={[s.sheet, { backgroundColor: colors.background }]}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: colors.foreground }]}>
              Build your list
            </Text>
            <Text style={[s.sub, { color: colors.mutedForeground, marginBottom: 0 }]}>
              {listening
                ? "Speak naturally — items appear as you go."
                : showMic
                  ? "Tap the mic to keep adding, or edit below."
                  : "Type items separated by commas."}
            </Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {showMic ? (
          <View style={s.micRow}>
            <Pressable
              onPress={listening ? stopListening : startListening}
              style={[
                s.micCircle,
                {
                  backgroundColor: listening ? colors.destructive : colors.primary,
                },
              ]}
            >
              <Feather
                name={listening ? "square" : "mic"}
                size={22}
                color={colors.primaryForeground}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={s.statusRow}>
                {listening ? (
                  <View style={[s.liveDot, { backgroundColor: colors.destructive }]} />
                ) : null}
                <Text style={[s.statusText, { color: colors.foreground }]}>
                  {listening ? "Listening…" : "Tap mic to speak"}
                </Text>
                {polishing ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : null}
              </View>
              {listening && fullTranscript ? (
                <Text
                  style={[s.heardText, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  Heard: {fullTranscript}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View
            style={[
              s.micHint,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text style={[s.micHintText, { color: colors.mutedForeground }]}>
              Voice needs a dev or store build. Typing works everywhere.
            </Text>
          </View>
        )}

        <View style={[s.listBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[s.listLabel, { color: colors.mutedForeground }]}>
            {listening
              ? `${confirmedCount} item${confirmedCount === 1 ? "" : "s"} so far`
              : `${displayItems.length} item${displayItems.length === 1 ? "" : "s"}`}
          </Text>

          <ScrollView
            style={{ maxHeight: 280 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {displayItems.length === 0 ? (
              <View style={s.emptyList}>
                <Feather name="shopping-bag" size={28} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                  {listening
                    ? 'Try: "cookie butter, oat milk, and chili lime chips"'
                    : "Your items will show up here"}
                </Text>
              </View>
            ) : (
              displayItems.map((item) => (
                <View
                  key={item.id}
                  style={[
                    s.itemRow,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: item.pending ? 0.55 : 1,
                    },
                  ]}
                >
                  <CategoryIcon category={item.category} size={32} />
                  {listening ? (
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemName, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                      {item.pending ? (
                        <Text style={[s.pendingTag, { color: colors.mutedForeground }]}>
                          listening…
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <TextInput
                      value={item.name}
                      onChangeText={(v) => updateItemName(item.id, v)}
                      style={[s.itemNameInput, { color: colors.foreground }]}
                    />
                  )}
                  {!listening ? (
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Feather name="x" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <Pressable
          onPress={() => setShowTypeField((v) => !v)}
          style={s.typeToggle}
        >
          <Feather name="edit-3" size={14} color={colors.mutedForeground} />
          <Text style={[s.typeToggleText, { color: colors.mutedForeground }]}>
            {showTypeField ? "Hide text field" : "Type or paste instead"}
          </Text>
        </Pressable>

        {showTypeField ? (
          <TextInput
            value={fullTranscript}
            onChangeText={handleTypedText}
            placeholder="Cookie butter, oat milk, everything bagel seasoning"
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
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Pressable
          onPress={handleAddAll}
          disabled={!canAdd}
          style={[
            s.primaryBtn,
            {
              backgroundColor: canAdd ? colors.primary : colors.border,
            },
          ]}
        >
          {adding || polishing ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text style={[s.primaryBtnTxt, { color: colors.primaryForeground }]}>
                {displayItems.filter((it) => !it.pending).length > 0
                  ? `Add ${displayItems.filter((it) => !it.pending).length} to shopping list`
                  : "Add to shopping list"}
              </Text>
            </>
          )}
        </Pressable>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 4,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  micCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  heardText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  micHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  micHintText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  listBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  listLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  emptyList: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  itemNameInput: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    paddingVertical: 2,
  },
  pendingTag: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  typeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 6,
    marginBottom: 8,
  },
  typeToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#c0392b",
    marginBottom: 8,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    marginTop: 12,
  },
  primaryBtnTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
});
