"use no memo"; // Large screen + subcomponents: React Compiler + Hermes Fast Refresh caused ReferenceErrors on this file.

import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { VoiceAddShoppingSheet } from "@/components/VoiceAddShoppingSheet";
import { boldTheme as D } from "@/constants/colors";
import { usePantry } from "@/contexts/PantryContext";
import { useAuth } from "@/lib/auth";
import {
  confirmationPrompt,
  getConfirmationCandidates,
} from "@/lib/confirmationQueue";
import { buildRunningLowSignals } from "@/lib/itemInsights";
import {
  getDaysSinceLastScan,
  isPantryStale,
  STALE_SCAN_DAYS,
} from "@/lib/pantryStaleness";
import { urgencyLabel } from "@/lib/predictions";
import {
  buildTraderJoesHomeCard,
  TRADER_JOES_LINKS,
  TRADER_JOES_REGION,
} from "@/lib/traderJoesTrip";
import type { BehaviorCard, PantryItem, ScanRecord } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 5)  return "LATE NIGHT";
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  if (h < 22) return "GOOD EVENING";
  return "LATE NIGHT";
}

function timeAgo(date: Date): string {
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "Just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = Math.floor(diff / 86400);
  return `${d}d ago`;
}

function lastScanLabel(date: Date): string {
  const d = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function getInitials(firstName?: string | null, email?: string | null): string {
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email)     return email.slice(0, 2).toUpperCase();
  return "?";
}

function pantryStatusMessage(params: {
  stale: boolean;
  totalItems: number;
  attentionCount: number;
  lastScanText: string | null;
}): { primary: string; secondary: string } {
  if (params.stale) {
    return {
      primary: "Tracking paused",
      secondary: params.lastScanText
        ? `Last scan ${params.lastScanText.toLowerCase()}`
        : "Scan when you're back from the store",
    };
  }
  if (params.totalItems === 0) {
    return {
      primary: "Ready when you are",
      secondary: "Say what you need — or scan a receipt to start tracking",
    };
  }
  if (params.attentionCount > 0) {
    const n = params.attentionCount;
    return {
      primary: `${n} quick ${n === 1 ? "check" : "checks"} waiting`,
      secondary: `${params.totalItems} items in your kitchen`,
    };
  }
  const scanBit = params.lastScanText
    ? ` · last scan ${params.lastScanText.toLowerCase()}`
    : "";
  return {
    primary: "You're all caught up",
    secondary: `${params.totalItems} items tracked${scanBit}`,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    pantry,
    scans,
    shoppingList,
    behaviorMeta,
    predictionCtx,
    confirmStillHave,
    confirmOut,
    addManualShoppingItem,
    addManualShoppingItems,
    dismissBehaviorCard,
  } = usePantry();
  const [voiceOpen, setVoiceOpen] = useState(false);

  const {
    lowSignals,
    recentItems,
    totalItems,
    confirmationItems,
    insightCards,
    stale,
    daysSinceScan,
    status,
  } = useMemo(() => {
    const active = pantry.filter((p) => !p.consumed);
    const stale = isPantryStale(scans);
    const daysSinceScan = getDaysSinceLastScan(scans);

    const confirmationItems = stale
      ? []
      : getConfirmationCandidates(active, 6, predictionCtx);
    const confirmIds = new Set(confirmationItems.map((c) => c.item.id));
    const insightCards = stale
      ? []
      : (behaviorMeta.cards ?? []).filter(
          (c) => !c.pantryItemId || !confirmIds.has(c.pantryItemId),
        ).slice(0, 3);

    const lowSignals = stale
      ? []
      : confirmationItems.length > 0 || insightCards.length > 0
        ? []
        : buildRunningLowSignals(active, 4, predictionCtx);

    const totalItems = active.length;
    const attentionCount =
      confirmationItems.length + insightCards.length + lowSignals.length;

    const recentItems = [...active]
      .sort(
        (a, b) =>
          new Date(b.lastPurchasedAt).getTime() -
          new Date(a.lastPurchasedAt).getTime(),
      )
      .slice(0, 3);

    const lastScan = scans[0];
    const lastScanText = lastScan
      ? lastScanLabel(new Date(lastScan.scannedAt))
      : null;

    const status = pantryStatusMessage({
      stale,
      totalItems,
      attentionCount,
      lastScanText,
    });

    return {
      lowSignals,
      recentItems,
      totalItems,
      confirmationItems,
      insightCards,
      stale,
      daysSinceScan,
      status,
    };
  }, [pantry, scans, behaviorMeta.cards, predictionCtx]);

  const lastScan = scans[0];

  const listPreview = useMemo(() => {
    const open = shoppingList.filter((s) => !s.checked);
    return {
      items: open.slice(0, 5),
      total: open.length,
    };
  }, [shoppingList]);

  const traderJoesCard = useMemo(
    () => buildTraderJoesHomeCard(scans, pantry),
    [scans, pantry],
  );

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const botPad = Platform.OS === "web" ? 110 : 110;

  const displayName = user?.firstName
    ? user.firstName.toUpperCase()
    : user?.email?.split("@")[0].toUpperCase() ?? "YOU";

  return (
    <View style={{ flex: 1, backgroundColor: D.cream }}>
      {/* ── Fixed header band ── */}
      <View style={[s.header, { paddingTop: topPad + 20 }]}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greetingByHour()}</Text>
            <Text style={s.name}>{displayName}.</Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityRole="button"
            accessibilityLabel="Profile and account"
            style={({ pressed }) => [s.avatar, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.avatarTxt}>
              {getInitials(user?.firstName, user?.email)}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [s.statusRow, { opacity: pressed ? 0.92 : 1 }]}
          onPress={() => router.push("/(tabs)/pantry")}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.statusPrimary}>{status.primary}</Text>
            <Text style={s.statusSecondary}>{status.secondary}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={D.greenLight} />
        </Pressable>
      </View>

      {/* ── Trip hub: voice list + scan receipt ── */}
      <View style={s.tripHub}>
        <Pressable
          style={({ pressed }) => [
            s.tripPrimary,
            { opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={() => setVoiceOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Tell us what to buy"
        >
          <View style={s.tripMicRing}>
            <Feather name="mic" size={26} color={D.cream} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tripPrimaryTitle}>What&apos;s on the list?</Text>
            <Text style={s.tripPrimarySub}>
              Tap and speak — items appear as you go
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={D.greenLight} />
        </Pressable>

        <View style={s.tripRow}>
          <Pressable
            style={({ pressed }) => [
              s.tripSecondary,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => router.push("/(tabs)/scan")}
            accessibilityRole="button"
            accessibilityLabel="Scan receipt"
          >
            <View style={s.tripSecIcon}>
              <Feather name="camera" size={18} color={D.greenMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tripSecTitle}>Scan receipt</Text>
              <Text style={s.tripSecSub}>Just got back?</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              s.tripSecondary,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => router.push("/(tabs)/shopping")}
            accessibilityRole="button"
            accessibilityLabel="Open shopping list"
          >
            <View style={s.tripSecIcon}>
              <Feather name="shopping-cart" size={18} color={D.greenMid} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tripSecTitle}>
                {listPreview.total > 0
                  ? `${listPreview.total} on list`
                  : "Your list"}
              </Text>
              <Text style={s.tripSecSub}>
                {listPreview.total > 0 ? "Open & check off" : "Empty for now"}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        <View style={s.body}>
          {/* Live shopping list preview */}
          <Pressable
            style={({ pressed }) => [
              s.listPreview,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            onPress={() =>
              listPreview.total > 0
                ? router.push("/(tabs)/shopping")
                : setVoiceOpen(true)
            }
          >
            <View style={s.listPreviewHead}>
              <Text style={s.listPreviewLabel}>YOUR LIST</Text>
              <Text style={s.listPreviewAction}>
                {listPreview.total > 0 ? "Open →" : "Add →"}
              </Text>
            </View>
            {listPreview.total === 0 ? (
              <Text style={s.listPreviewEmpty}>
                Nothing yet. Tap the mic and say what you need.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {listPreview.items.map((item) => (
                  <View key={item.id} style={s.listPreviewRow}>
                    <View style={s.listPreviewDot} />
                    <Text style={s.listPreviewName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={s.listPreviewMeta} numberOfLines={1}>
                      {item.reason === "manual" ? "You" : "Suggested"}
                    </Text>
                  </View>
                ))}
                {listPreview.total > listPreview.items.length ? (
                  <Text style={s.listPreviewMore}>
                    +{listPreview.total - listPreview.items.length} more
                  </Text>
                ) : null}
              </View>
            )}
          </Pressable>

          {stale && (
            <View style={s.staleBanner}>
              <Text style={s.staleTitle}>It&apos;s been a while!</Text>
              <Text style={s.staleSub}>
                {daysSinceScan != null
                  ? `Last scan was ${daysSinceScan} days ago. We paused alerts so nothing feels urgent from old data.`
                  : `No scan in ${STALE_SCAN_DAYS}+ days. Update when you can.`}
              </Text>
              <View style={s.staleActions}>
                <Pressable
                  style={({ pressed }) => [
                    s.staleBtnPrimary,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={() => router.push("/(tabs)/scan")}
                >
                  <Text style={s.staleBtnPrimaryTxt}>Scan latest receipt</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    s.staleBtnGhost,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={() => router.push("/(tabs)/pantry")}
                >
                  <Text style={s.staleBtnGhostTxt}>Quick update</Text>
                </Pressable>
              </View>
            </View>
          )}

          {insightCards.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Feather name="zap" size={11} color={D.greenMid} />
                  <Text style={s.sectionTitle}>SMART SUGGESTIONS</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {insightCards.map((card) => (
                  <InsightCard
                    key={card.id}
                    card={card}
                    onDismiss={() => dismissBehaviorCard(card.id)}
                    onStillHave={
                      card.pantryItemId
                        ? () => {
                            confirmStillHave(card.pantryItemId!);
                            dismissBehaviorCard(card.id);
                          }
                        : undefined
                    }
                    onOut={
                      card.pantryItemId
                        ? () => {
                            confirmOut(card.pantryItemId!);
                            dismissBehaviorCard(card.id);
                          }
                        : undefined
                    }
                    onAddShop={
                      card.itemName
                        ? () => {
                            const item = pantry.find(
                              (p) => p.id === card.pantryItemId,
                            );
                            addManualShoppingItem(
                              card.itemName!,
                              item?.category ?? "Pantry",
                            );
                            dismissBehaviorCard(card.id);
                          }
                        : undefined
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {confirmationItems.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Feather name="help-circle" size={11} color={D.greenMid} />
                  <Text style={s.sectionTitle}>QUICK CHECK</Text>
                </View>
              </View>
              <Text style={s.confirmIntro}>
                Based on your usual routine, you might be out of these. Tap to confirm:
              </Text>
              <View style={{ gap: 8 }}>
                {confirmationItems.map(({ item }) => (
                  <ConfirmationCard
                    key={item.id}
                    item={item}
                    onStillHave={() => confirmStillHave(item.id)}
                    onOut={() => confirmOut(item.id)}
                    ctx={predictionCtx}
                  />
                ))}
              </View>
            </View>
          )}

          {lowSignals.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <View style={s.sectionHeadLeft}>
                  <Feather name="clock" size={11} color={D.greenMid} />
                  <Text style={s.sectionTitle}>COMING UP</Text>
                </View>
                <Pressable onPress={() => router.push("/(tabs)/pantry")}>
                  <Text style={s.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={{ gap: 7 }}>
                {lowSignals.map((signal) =>
                  signal.kind === "single" ? (
                    <SingleLowCard
                      key={signal.item.id}
                      signal={signal}
                    />
                  ) : (
                    <GroupLowCard
                      key={signal.label}
                      signal={signal}
                    />
                  ),
                )}
              </View>
            </View>
          )}

          {traderJoesCard.show && !stale && (
            <TraderJoesDiscoveryCard hint={traderJoesCard.hint} />
          )}

          {(recentItems.length > 0 || lastScan) && pantry.length > 0 && (
            <LastShopRecap
              lastScan={lastScan}
              recentItems={recentItems}
              onOpenPantry={() => router.push("/(tabs)/pantry")}
              onOpenActivity={() => router.push("/activity")}
            />
          )}

          {pantry.length > 0 && scans.length >= 2 && !stale && (
            <Pressable
              style={({ pressed }) => [
                s.insightsLink,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={() => router.push("/(tabs)/insights")}
            >
              <Feather name="bar-chart-2" size={14} color={D.greenMid} />
              <Text style={s.insightsLinkTxt}>
                See how you eat →
              </Text>
            </Pressable>
          )}

          {/* ── Empty state ── */}
          {pantry.length === 0 && (
            <View style={s.emptyWrap}>
              <View style={s.emptyPreview}>
                <View style={s.emptyPreviewHead}>
                  <Text style={s.emptyPreviewLabel}>YOUR KITCHEN WILL LOOK LIKE</Text>
                </View>
                {[
                  { name: "Olive Oil",     cat: "Condiments", qty: "x2", warn: false },
                  { name: "Basmati Rice",  cat: "Grains",     qty: "x1", warn: false },
                  { name: "Whole Milk",    cat: "Dairy",      qty: "x3", warn: true  },
                ].map((item, i, arr) => (
                  <View key={item.name} style={[
                    s.emptyPreviewRow,
                    i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: D.creamBorder },
                  ]}>
                    <View style={[s.emptyPreviewDot, item.warn && { backgroundColor: D.amber }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.emptyPreviewName}>{item.name}</Text>
                      <Text style={s.emptyPreviewCat}>{item.cat.toUpperCase()}</Text>
                    </View>
                    <Text style={s.emptyPreviewQty}>{item.qty}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.emptyTitle}>Start with your list</Text>
              <Text style={s.emptySub}>
                Say three things you need — then scan a receipt after the trip so we can track what you buy.
              </Text>
              <Pressable
                style={({ pressed }) => [s.emptyBtn, { opacity: pressed ? 0.8 : 1 }]}
                onPress={() => setVoiceOpen(true)}
              >
                <Feather name="mic" size={16} color={D.cream} style={{ marginRight: 8 }} />
                <Text style={s.emptyBtnTxt}>TELL US WHAT TO BUY</Text>
              </Pressable>

              <Text style={s.emptyOr}>or jump straight to</Text>
              <Pressable onPress={() => router.push("/(tabs)/scan")}>
                <Text style={s.emptyLink}>Scan a receipt →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <VoiceAddShoppingSheet
        visible={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onAddItems={addManualShoppingItems}
      />
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TraderJoesDiscoveryCard({ hint }: { hint: string }) {
  const openLink = (url: string) => {
    void WebBrowser.openBrowserAsync(url);
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.sectionHeadLeft}>
          <Feather name="compass" size={11} color={D.greenMid} />
          <Text style={s.sectionTitle}>TRY SOMETHING NEW</Text>
        </View>
      </View>
      <View style={s.tjCard}>
        <Text style={s.tjTitle}>Trader Joe&apos;s · {TRADER_JOES_REGION}</Text>
        <Text style={s.tjHint}>{hint}</Text>
        <View style={s.tjActions}>
          <Pressable
            style={({ pressed }) => [
              s.tjBtnPrimary,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openLink(TRADER_JOES_LINKS.whatsNew)}
          >
            <Text style={s.tjBtnPrimaryTxt}>What&apos;s new</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              s.tjBtnGhost,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openLink(TRADER_JOES_LINKS.fearlessFlyer)}
          >
            <Text style={s.tjBtnGhostTxt}>Fearless Flyer</Text>
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            s.tjStoreLink,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => openLink(TRADER_JOES_LINKS.storeFinder)}
        >
          <Text style={s.tjStoreLinkTxt}>Find stores near Philly →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LastShopRecap({
  lastScan,
  recentItems,
  onOpenPantry,
  onOpenActivity,
}: {
  lastScan?: ScanRecord;
  recentItems: PantryItem[];
  onOpenPantry: () => void;
  onOpenActivity: () => void;
}) {
  const scanLine = lastScan
    ? `${lastScanLabel(new Date(lastScan.scannedAt))} · ${lastScan.itemCount} item${lastScan.itemCount === 1 ? "" : "s"}${lastScan.storeName ? ` · ${lastScan.storeName}` : ""}`
    : null;

  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>LAST SHOP</Text>
        <Pressable onPress={onOpenPantry}>
          <Text style={s.seeAll}>Pantry</Text>
        </Pressable>
      </View>
      {scanLine ? (
        <Pressable
          style={({ pressed }) => [
            s.lastShopBanner,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={onOpenActivity}
        >
          <Feather name="check-circle" size={14} color={D.greenMid} />
          <Text style={s.lastShopBannerTxt}>{scanLine}</Text>
        </Pressable>
      ) : null}
      <View style={s.recentList}>
        {recentItems.map((item, i) => (
          <Pressable
            key={item.id}
            style={[
              s.recentRow,
              i < recentItems.length - 1 && s.recentRowBorder,
            ]}
            onPress={onOpenPantry}
          >
            <View style={s.recentIcon}>
              <Text style={s.recentEmoji}>{categoryEmoji(item.category)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.recentName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.recentMeta}>
                {item.category.toUpperCase()} ·{" "}
                {timeAgo(new Date(item.lastPurchasedAt))}
              </Text>
            </View>
            <Text style={s.recentQty}>x{item.quantity}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function InsightCard({
  card,
  onDismiss,
  onStillHave,
  onOut,
  onAddShop,
}: {
  card: BehaviorCard;
  onDismiss: () => void;
  onStillHave?: () => void;
  onOut?: () => void;
  onAddShop?: () => void;
}) {
  return (
    <View style={s.insightCard}>
      <Text style={s.insightTitle}>{card.title}</Text>
      <Text style={s.insightMsg}>{card.message}</Text>
      <View style={s.confirmRow}>
        {onAddShop ? (
          <Pressable
            style={({ pressed }) => [
              s.confirmBtnOut,
              { opacity: pressed ? 0.88 : 1 },
            ]}
            onPress={onAddShop}
          >
            <Text style={s.confirmBtnOutTxt}>Add to list</Text>
          </Pressable>
        ) : null}
        {onOut ? (
          <Pressable
            style={({ pressed }) => [
              s.confirmBtnOut,
              { opacity: pressed ? 0.88 : 1 },
            ]}
            onPress={onOut}
          >
            <Text style={s.confirmBtnOutTxt}>Yes, out</Text>
          </Pressable>
        ) : null}
        {onStillHave ? (
          <Pressable
            style={({ pressed }) => [
              s.confirmBtnHave,
              { opacity: pressed ? 0.88 : 1 },
            ]}
            onPress={onStillHave}
          >
            <Text style={s.confirmBtnHaveTxt}>Still have</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            s.confirmBtnHave,
            { opacity: pressed ? 0.88 : 1, flex: 0.6 },
          ]}
          onPress={onDismiss}
        >
          <Text style={s.confirmBtnHaveTxt}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmationCard({
  item,
  onStillHave,
  onOut,
  ctx,
}: {
  item: PantryItem;
  onStillHave: () => void;
  onOut: () => void;
  ctx: import("@/lib/predictions").PredictionContext;
}) {
  return (
    <View style={s.confirmCard}>
      <Text style={s.confirmName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={s.confirmHint}>{confirmationPrompt(item, ctx)}</Text>
      <View style={s.confirmRow}>
        <Pressable
          style={({ pressed }) => [
            s.confirmBtnOut,
            { opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={onOut}
        >
          <Text style={s.confirmBtnOutTxt}>Yes, out</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            s.confirmBtnHave,
            { opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={onStillHave}
        >
          <Text style={s.confirmBtnHaveTxt}>Still have some</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SingleLowCard({ signal }: { signal: import("@/lib/itemInsights").LowItem; }) {
  const { text } = urgencyLabel(signal.item);
  return (
    <Pressable
      style={s.lowCard}
      onPress={() => router.push("/(tabs)/pantry")}
    >
      <View style={s.lowDot} />
      <Text style={s.lowName} numberOfLines={1}>{signal.item.name}</Text>
      <Text style={s.lowDays}>{text}</Text>
    </Pressable>
  );
}

function GroupLowCard({ signal }: { signal: import("@/lib/itemInsights").LowGroup }) {
  const daysLabel =
    signal.soonestDays <= 0
      ? "check soon"
      : signal.soonestDays === 1
        ? "~1d"
        : `~${signal.soonestDays}d`;
  return (
    <Pressable
      style={[s.lowCard, s.lowCardGroup]}
      onPress={() => router.push("/(tabs)/pantry")}
    >
      <Feather name="layers" size={13} color={D.greenLight} />
      <View style={{ flex: 1 }}>
        <Text style={s.lowName} numberOfLines={1}>
          {signal.label}
          <Text style={[s.lowCount, { color: D.inkLight }]}> · {signal.count} items</Text>
        </Text>
        <Text style={s.lowGroupSub}>Soonest: {daysLabel}</Text>
      </View>
    </Pressable>
  );
}

function categoryEmoji(cat: string): string {
  const map: Record<string, string> = {
    Fruit: "🍎",
    Vegetables: "🥦",
    Dairy: "🥛",
    Meat: "🥩",
    Pantry: "🫙",
    Bakery: "🍞",
    Beverages: "🧃",
    Frozen: "🧊",
    Snacks: "🍿",
    Household: "🧹",
    "Personal Care": "🧴",
    Prepared: "🥡",
    Other: "📦",
  };
  return map[cat] ?? "📦";
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  greeting: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(168,201,127,0.7)",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: D.cream,
    letterSpacing: -0.5,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: D.greenLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: D.greenDark,
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  statusPrimary: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: D.cream,
    marginBottom: 2,
  },
  statusSecondary: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(168,201,127,0.75)",
    lineHeight: 17,
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  staleBanner: {
    backgroundColor: D.cream,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  staleTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: D.inkBlack,
    marginBottom: 6,
  },
  staleSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkLight,
    lineHeight: 19,
    marginBottom: 14,
  },
  staleActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  staleBtnPrimary: {
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  staleBtnPrimaryTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.cream,
  },
  staleBtnGhost: {
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  staleBtnGhostTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
  },

  confirmIntro: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkLight,
    lineHeight: 18,
    marginBottom: 10,
  },
  confirmCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 14,
  },
  confirmName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: D.inkBlack,
    marginBottom: 4,
  },
  confirmHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    marginBottom: 12,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 8,
  },
  confirmBtnOut: {
    flex: 1,
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmBtnOutTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.cream,
  },
  confirmBtnHave: {
    flex: 1.2,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmBtnHaveTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
  },

  insightCard: {
    backgroundColor: "#F8FBF3",
    borderWidth: 1,
    borderColor: D.greenLight,
    borderRadius: 12,
    padding: 14,
  },
  insightTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: D.greenMid,
    marginBottom: 4,
  },
  insightMsg: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkBlack,
    lineHeight: 18,
    marginBottom: 12,
  },

  // Trip hub — voice-first dual actions
  tripHub: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: D.cream,
    borderBottomWidth: 1,
    borderBottomColor: D.creamBorder,
    gap: 10,
  },
  tripPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: D.greenDark,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tripMicRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(197,220,168,0.22)",
    borderWidth: 1.5,
    borderColor: "rgba(197,220,168,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  tripPrimaryTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: D.cream,
    letterSpacing: -0.2,
  },
  tripPrimarySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(242,239,230,0.72)",
    marginTop: 3,
    lineHeight: 16,
  },
  tripRow: {
    flexDirection: "row",
    gap: 8,
  },
  tripSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tripSecIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(45,74,30,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tripSecTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenDark,
  },
  tripSecSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkMid,
    marginTop: 1,
  },
  listPreview: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  listPreviewHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  listPreviewLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkMid,
  },
  listPreviewAction: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
  },
  listPreviewEmpty: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkMid,
    lineHeight: 18,
  },
  listPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listPreviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: D.greenMid,
  },
  listPreviewName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.inkBlack,
  },
  listPreviewMeta: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: D.inkLight,
  },
  listPreviewMore: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.inkMid,
    marginTop: 2,
    paddingLeft: 16,
  },

  // Section
  section: {
    marginTop: 22,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeadLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.5,
    color: D.inkMid,
    textTransform: "uppercase",
  },
  seeAll: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: D.greenMid,
  },

  // Running low cards
  lowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2A1A00",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  lowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.greenLight,
  },
  lowDotUrgent: {
    backgroundColor: D.amber,
  },
  lowName: {
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#F5E8C8",
  },
  lowDays: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.8,
    color: "rgba(168,201,127,0.6)",
    textTransform: "uppercase",
  },
  lowDaysUrgent: {
    color: D.amber,
  },
  urgentBadge: {
    backgroundColor: "rgba(232,160,64,0.2)",
    borderWidth: 1,
    borderColor: "rgba(232,160,64,0.4)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  urgentBadgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 7,
    color: D.amber,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  lowCardGroup: {
    gap: 10,
    alignItems: "flex-start",
    paddingVertical: 11,
  },
  lowCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  lowGroupSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(168,201,127,0.5)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  lastShopBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  lastShopBannerTxt: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.inkBlack,
  },
  insightsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
  },
  insightsLinkTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
  },

  tjCard: {
    backgroundColor: "#F8FBF3",
    borderWidth: 1,
    borderColor: D.greenLight,
    borderRadius: 12,
    padding: 14,
  },
  tjTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: D.greenMid,
    marginBottom: 6,
  },
  tjHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkBlack,
    lineHeight: 19,
    marginBottom: 12,
  },
  tjActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  tjBtnPrimary: {
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tjBtnPrimaryTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.cream,
  },
  tjBtnGhost: {
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: D.cream,
  },
  tjBtnGhostTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.greenMid,
  },
  tjStoreLink: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  tjStoreLinkTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: D.inkMid,
  },

  // Last shop recap
  recentList: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    overflow: "hidden",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: D.creamBorder,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: D.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  recentEmoji: {
    fontSize: 18,
  },
  recentName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: D.inkBlack,
  },
  recentMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: D.inkLight,
    letterSpacing: 0.3,
    marginTop: 2,
  },
  recentQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: D.greenMid,
  },

  // Empty state
  emptyWrap: {
    marginTop: 24,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  emptyPreview: {
    width: "100%",
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 24,
    opacity: 0.7,
  },
  emptyPreviewHead: {
    backgroundColor: D.greenMid,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyPreviewLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: "rgba(168,201,127,0.8)",
    textTransform: "uppercase",
  },
  emptyPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  emptyPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: D.greenLight,
  },
  emptyPreviewName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.inkBlack,
  },
  emptyPreviewCat: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: D.inkLight,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  emptyPreviewQty: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.greenMid,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: D.inkBlack,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: D.inkMid,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    maxWidth: 300,
  },
  emptyBtn: {
    backgroundColor: D.greenMid,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyBtnTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: D.cream,
    letterSpacing: 1.2,
  },
  emptyOr: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    marginBottom: 4,
  },
  emptyLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.greenMid,
  },
});
