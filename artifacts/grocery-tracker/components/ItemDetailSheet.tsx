import { Feather } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { boldTheme as D } from "@/constants/colors";
import { CategoryIcon } from "@/components/CategoryIcon";
import { StatusPill } from "@/components/StatusPill";
import {
  getNutritionEstimate,
  getInsightContribution,
} from "@/lib/itemInsights";
import {
  getDaysUntilNeeded,
  getItemStatus,
  getStatusLabel,
  summarizeCadence,
} from "@/lib/predictions";
import type { ItemStatus, PantryItem } from "@/lib/types";

interface Props {
  item: PantryItem | null;
  onClose: () => void;
  onMarkConsumed: (id: string) => void | Promise<void>;
  onMarkWasted: (id: string) => void | Promise<void>;
  onMarkInStock: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTimeline(item: PantryItem, days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days > 30) {
    // Show a real calendar date instead of a confusing day count
    const expiry = new Date(
      new Date(item.lastPurchasedAt).getTime() +
        (item.averageDaysBetweenPurchases ?? item.estimatedShelfLifeDays) *
          86400000,
    );
    return `Est. expires ${expiry.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }
  return `Need in ${days}d`;
}

function statusBorderColor(status: ItemStatus): string {
  switch (status) {
    case "fresh":       return D.greenMid;
    case "running-low": return D.amber;
    case "due":         return D.amber;
    case "overdue":     return D.amber;
    case "expired":     return "#B91C1C";
    default:            return D.greenMid;
  }
}

export function ItemDetailSheet({
  item,
  onClose,
  onMarkConsumed,
  onMarkWasted,
  onMarkInStock,
  onDelete,
}: Props) {
  if (!item) return null;

  const status = getItemStatus(item);
  const days = getDaysUntilNeeded(item);
  const borderColor = statusBorderColor(status);
  const nutrition = getNutritionEstimate(item);
  const insightNote = getInsightContribution(item);
  const isNonFood =
    item.category === "Household" || item.category === "Personal Care";

  return (
    <Modal
      visible={!!item}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          {/* Handle bar */}
          <View style={s.handle} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Item header ── */}
            <View style={[s.itemHeader, { borderLeftColor: borderColor, borderLeftWidth: 4 }]}>
              <CategoryIcon category={item.category} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={s.pillRow}>
                  <StatusPill status={status} />
                  {item.isOrganic && (
                    <View style={[s.organicPill, { backgroundColor: `${D.greenMid}22` }]}>
                      <Text style={[s.organicTxt, { color: D.greenMid }]}>ORGANIC</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* ── Shelf-life summary ── */}
            <View style={s.infoRow}>
              <InfoTile icon="package" label="QUANTITY" value={`${item.quantity} ${item.unit}`} />
              <InfoTile icon="clock" label="STATUS" value={getStatusLabel(status)} />
              <InfoTile icon="calendar" label="TIMELINE" value={formatTimeline(item, days)} />
            </View>
            <View style={[s.infoRow, { marginTop: 0 }]}>
              <InfoTile
                icon="repeat"
                label="PATTERN"
                value={summarizeCadence(item)}
                wide
              />
            </View>

            {/* ── Nutrition estimate ── */}
            {!isNonFood && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Feather name="bar-chart-2" size={13} color={D.greenMid} />
                  <Text style={s.cardTitle}>GENERIC NUTRITION ESTIMATE</Text>
                </View>

                <View style={s.nutGrid}>
                  <NutRow label="Calories" value={nutrition.calories} />
                  <NutRow label="Protein" value={nutrition.protein} />
                  <NutRow label="Carbs" value={nutrition.carbs} />
                  <NutRow label="Fat" value={nutrition.fat} />
                  <NutRow label="Fiber" value={nutrition.fiber} />
                </View>

                <Text style={s.nutNote}>{nutrition.note}</Text>
              </View>
            )}

            {/* ── Insight contribution ── */}
            <View style={s.insightCard}>
              <Feather name="heart" size={13} color={D.greenMid} />
              <Text style={s.insightTxt}>{insightNote}</Text>
            </View>

            {/* ── Actions ── */}
            <View style={s.actions}>
              {item.consumed ? (
                <Pressable
                  style={[s.actionBtn, s.actionBtnPrimary]}
                  onPress={() => { onMarkInStock(item.id); onClose(); }}
                >
                  <Feather name="refresh-ccw" size={15} color={D.cream} />
                  <Text style={s.actionBtnPrimaryTxt}>Mark in Stock</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => { onMarkConsumed(item.id); onClose(); }}
                  >
                    <Feather name="check-circle" size={15} color={D.cream} />
                    <Text style={s.actionBtnPrimaryTxt}>Used It Up</Text>
                  </Pressable>
                  <Pressable
                    style={[s.actionBtn, s.actionBtnWaste]}
                    onPress={() => { onMarkWasted(item.id); onClose(); }}
                  >
                    <Feather name="trash-2" size={15} color="#fff" />
                    <Text style={s.actionBtnWasteTxt}>It Was Wasted</Text>
                  </Pressable>
                </>
              )}
              <Pressable
                style={[s.actionBtn, s.actionBtnDanger]}
                onPress={() => { onDelete(item.id); onClose(); }}
              >
                <Feather name="x-circle" size={15} color={D.amber} />
                <Text style={s.actionBtnDangerTxt}>Remove Item</Text>
              </Pressable>
            </View>

            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoTile({
  icon,
  label,
  value,
  wide,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[s.tile, wide && { flex: 1 }]}>
      <Feather name={icon} size={12} color={D.inkMid} style={{ marginBottom: 4 }} />
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue}>{value}</Text>
    </View>
  );
}

function NutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.nutRow}>
      <Text style={s.nutLabel}>{label}</Text>
      <Text style={s.nutValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: D.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: D.creamBorder,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },

  // Item header
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingLeft: 12,
    marginBottom: 16,
  },
  itemName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: D.inkBlack,
    marginBottom: 6,
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  organicPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  organicTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.6,
  },

  // Info tiles
  infoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 10,
    padding: 10,
  },
  tileLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 8,
    letterSpacing: 1.2,
    color: D.inkMid,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  tileValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.inkBlack,
  },

  // Nutrition card
  card: {
    backgroundColor: D.creamDark,
    borderWidth: 1,
    borderColor: D.creamBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1.4,
    color: D.greenMid,
    textTransform: "uppercase",
  },
  nutGrid: {
    gap: 6,
    marginBottom: 10,
  },
  nutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: D.creamBorder,
  },
  nutLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: D.inkMid,
  },
  nutValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: D.inkBlack,
  },
  nutNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: D.inkMid,
    lineHeight: 16,
    marginBottom: 6,
  },
  // Insight card
  insightCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: `${D.greenMid}11`,
    borderWidth: 1,
    borderColor: `${D.greenMid}33`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  insightTxt: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkBlack,
    lineHeight: 18,
  },

  // Actions
  actions: {
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 13,
  },
  actionBtnPrimary: {
    backgroundColor: D.greenMid,
  },
  actionBtnPrimaryTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: D.cream,
    letterSpacing: 0.4,
  },
  actionBtnWaste: {
    backgroundColor: "#7D2D2D",
  },
  actionBtnWasteTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#fff",
    letterSpacing: 0.3,
  },
  actionBtnDanger: {
    backgroundColor: "rgba(232,160,64,0.12)",
    borderWidth: 1,
    borderColor: "rgba(232,160,64,0.35)",
  },
  actionBtnDangerTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: D.amber,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  cancelTxt: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: D.inkMid,
  },
});
