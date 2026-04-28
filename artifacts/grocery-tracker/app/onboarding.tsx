import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { boldTheme as D } from "@/constants/colors";

// ─── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "1",
    step: "01",
    badge: "SCAN",
    headline: "SNAP YOUR\n",
    accent: "RECEIPT.",
    body: "Point your camera at any receipt or grocery bag. We detect every item in seconds — no typing needed.",
    visual: "scan",
  },
  {
    id: "2",
    step: "02",
    badge: "TRACK",
    headline: "KNOW WHAT\nYOU ",
    accent: "HAVE.",
    body: "Your pantry updates automatically. See stock levels, categories, and what's running low — all in one place.",
    visual: "pantry",
  },
  {
    id: "3",
    step: "03",
    badge: "RESTOCK",
    headline: "SHOP ",
    accent: "SMARTER.",
    body: "Get smart reminders based on your real usage. Never run out of the essentials again.",
    visual: "restock",
  },
] as const;

// ─── Visual panel components (inside dark-green area) ─────────────────────────

function GridLines() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[0, 1, 2, 3].map((r) => (
        <View key={r} style={{ flex: 1, flexDirection: "row" }}>
          {[0, 1, 2, 3, 4].map((c) => (
            <View
              key={c}
              style={{
                flex: 1,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: "rgba(168,201,127,0.12)",
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function DataCard({
  label, value, sub, chip, style,
}: {
  label: string; value: string; sub?: string; chip?: string; style?: object;
}) {
  return (
    <View style={[vc.card, style]}>
      <Text style={vc.cardLabel}>{label}</Text>
      <Text style={vc.cardValue}>{value}</Text>
      {sub  ? <Text style={vc.cardSub}>{sub}</Text>  : null}
      {chip ? (
        <View style={vc.chip}><Text style={vc.chipTxt}>{chip}</Text></View>
      ) : null}
    </View>
  );
}

function ScanPanel() {
  return (
    <View style={{ flex: 1 }}>
      <GridLines />
      <DataCard label="RECEIPT SCANNED" value="12 items" sub="0.8 s"
        style={{ position: "absolute", top: 22, left: 18 }} />
      <DataCard label="PANTRY STATUS" value="94% full" chip="↑ UPDATED"
        style={{ position: "absolute", bottom: 22, right: 18 }} />
      <DataCard label="RESTOCK IN" value="3 days"
        style={{ position: "absolute", top: 80, right: 24 }} />
    </View>
  );
}

function PantryPanel({ width }: { width: number }) {
  const items = [
    { name: "Olive oil", pct: 72, warn: false },
    { name: "Pasta",     pct: 30, warn: true  },
    { name: "Rice",      pct: 88, warn: false },
    { name: "Oats",      pct: 15, warn: true  },
  ];
  const cardW = Math.min(width - 80, 280);
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <GridLines />
      <View style={[vc.card, { width: cardW, marginBottom: 10 }]}>
        <Text style={vc.cardLabel}>PANTRY</Text>
        {items.map((item) => (
          <View key={item.name} style={vc.pantryRow}>
            <Text style={[vc.pantryName, item.warn && { color: D.amber }]}>{item.name}</Text>
            <View style={vc.barTrack}>
              <View style={[vc.barFill, { width: `${item.pct}%`, backgroundColor: item.warn ? D.amber : D.greenLight }]} />
            </View>
            <Text style={[vc.pantryPct, item.warn && { color: D.amber }]}>{item.pct}%</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, width: cardW }}>
        {[
          { lbl: "ITEMS", val: "47", warn: false },
          { lbl: "CATS",  val: "8",  warn: false },
          { lbl: "LOW",   val: "2",  warn: true  },
        ].map((b) => (
          <View key={b.lbl} style={[vc.card, { flex: 1, padding: 8 }, b.warn && { borderColor: "rgba(232,160,64,0.4)" }]}>
            <Text style={[vc.cardLabel, b.warn && { color: "rgba(232,160,64,0.6)" }]}>{b.lbl}</Text>
            <Text style={[vc.cardValue, { fontSize: 18 }, b.warn && { color: D.amber }]}>{b.val}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RestockPanel() {
  return (
    <View style={{ flex: 1 }}>
      <GridLines />
      <View style={[vc.card, { position: "absolute", top: 22, left: 18, right: 18 }]}>
        <Text style={vc.cardLabel}>RESTOCK REMINDERS</Text>
        {[
          { name: "Pasta",    days: "Today",     urgent: true  },
          { name: "Oats",     days: "Tomorrow",  urgent: true  },
          { name: "Olive oil", days: "In 4 days", urgent: false },
        ].map((r) => (
          <View key={r.name} style={vc.restockRow}>
            <View style={[vc.dot, r.urgent && { backgroundColor: D.amber }]} />
            <Text style={vc.restockName}>{r.name}</Text>
            <Text style={[vc.restockDays, r.urgent && { color: D.amber }]}>{r.days}</Text>
          </View>
        ))}
      </View>
      <DataCard label="WEEKLY SAVINGS" value="$12.40" sub="vs. last month"
        style={{ position: "absolute", bottom: 22, right: 24 }} />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const VISUAL_H = 230;
const NAV_H    = Platform.OS === "ios" ? 72 : 64;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const W = Math.min(screenW, 430);

  const listRef  = useRef<FlatList>(null);
  const scrollX  = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  // ── Text content animation ──────────────────────────────────────────────────
  const textOpacity  = useRef(new Animated.Value(1)).current;
  const textY        = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    textOpacity.setValue(0);
    textY.setValue(18);
    Animated.parallel([
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(textY, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animate on first mount
  useEffect(() => { animateIn(); }, []);

  const slide = SLIDES[index];

  const finish = async () => {
    try { await AsyncStorage.setItem("@grocery_onboarded", "true"); } catch {}
    router.replace("/login");
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
      animateIn();
    } else {
      finish();
    }
  };

  // Sync index from user swipes
  const onMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / W);
    if (newIndex !== index) {
      setIndex(newIndex);
      animateIn();
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: D.cream, alignItems: "center" }}>
      <StatusBar barStyle="dark-content" backgroundColor={D.cream} />

      {/* Top stripe */}
      <View style={{ width: W, height: 5, backgroundColor: D.greenMid }} />

      {/* Visual panels — only this part scrolls */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={true}
        style={{ width: W, height: VISUAL_H, flexGrow: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width: W, height: VISUAL_H, backgroundColor: D.greenMid, overflow: "hidden" }}>
            {item.visual === "scan"    ? <ScanPanel /> : null}
            {item.visual === "pantry"  ? <PantryPanel width={W} /> : null}
            {item.visual === "restock" ? <RestockPanel /> : null}
          </View>
        )}
      />

      {/* Animated text content — outside FlatList for smooth animations */}
      <Animated.View
        style={[
          tx.content,
          { width: W, opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}
      >
        <View style={tx.stepRow}>
          <Text style={tx.stepNum}>{slide.step}</Text>
          <View style={tx.badge}>
            <Text style={tx.badgeTxt}>{slide.badge}</Text>
          </View>
        </View>

        <Text style={tx.headline}>
          {slide.headline}
          <Text style={tx.accent}>{slide.accent}</Text>
        </Text>

        <Text style={tx.body}>{slide.body}</Text>
      </Animated.View>

      {/* Spacer to push nav to bottom */}
      <View style={{ flex: 1 }} />

      {/* Bottom nav */}
      <View style={[nav.bar, { width: W, paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          onPress={finish}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={nav.skip}>SKIP</Text>
        </Pressable>

        {/* Dot indicators */}
        <View style={nav.dots}>
          {SLIDES.map((_, i) => {
            const range = [(i - 1) * W, i * W, (i + 1) * W];
            return (
              <Animated.View
                key={i}
                style={[
                  nav.dot,
                  {
                    width: scrollX.interpolate({
                      inputRange: range,
                      outputRange: [16, 28, 16],
                      extrapolate: "clamp",
                    }),
                    opacity: scrollX.interpolate({
                      inputRange: range,
                      outputRange: [0.3, 1, 0.3],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              />
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [nav.nextBtn, { opacity: pressed ? 0.8 : 1 }]}
          onPress={goNext}
        >
          <Text style={nav.nextTxt}>{isLast ? "START →" : "NEXT →"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const vc = StyleSheet.create({
  card: {
    backgroundColor: "rgba(28,58,10,0.95)",
    borderWidth: 1,
    borderColor: "rgba(168,201,127,0.22)",
    borderRadius: 10,
    padding: 12,
    minWidth: 110,
  },
  cardLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(168,201,127,0.5)",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  cardValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: D.greenLight,
  },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: "rgba(168,201,127,0.4)",
    marginTop: 2,
  },
  chip: {
    backgroundColor: D.greenLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  chipTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: D.greenDark,
    letterSpacing: 0.8,
  },
  pantryRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  pantryName: { fontFamily: "Inter_400Regular", fontSize: 9, color: D.greenLight, width: 55 },
  barTrack: { flex: 1, height: 4, backgroundColor: "rgba(168,201,127,0.15)", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
  pantryPct: { fontFamily: "Inter_400Regular", fontSize: 8, color: D.greenLight, width: 30, textAlign: "right" },
  restockRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: D.greenLight },
  restockName: { fontFamily: "Inter_400Regular", fontSize: 10, color: D.greenLight, flex: 1 },
  restockDays: { fontFamily: "Inter_400Regular", fontSize: 9, color: "rgba(168,201,127,0.6)" },
});

const tx = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 42,
    color: D.creamBorder,
    lineHeight: 44,
  },
  badge: {
    backgroundColor: D.greenMid,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: D.greenLight,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: D.inkBlack,
    lineHeight: 34,
    textTransform: "uppercase",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  accent: { color: D.greenMid },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: D.inkMid,
    lineHeight: 22,
  },
});

const nav = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: D.creamBorder,
    backgroundColor: D.cream,
  },
  skip: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: "#AAAAAA",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { height: 4, borderRadius: 2, backgroundColor: D.greenMid },
  nextBtn: {
    backgroundColor: D.greenMid,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nextTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: D.cream,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
