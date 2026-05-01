import { Feather } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { boldTheme as D } from "@/constants/colors";
import { StatusPill } from "@/components/StatusPill";
import { getItemStatus } from "@/lib/predictions";
import type { PantryItem } from "@/lib/types";

interface Props {
  item: PantryItem | null;
  onClose: () => void;
  onUsedItUp: (item: PantryItem) => void;
  onWasted: (item: PantryItem) => void;
  onAddToList: (item: PantryItem) => void;
  onViewDetails: (item: PantryItem) => void;
}

export function ItemActionSheet({
  item,
  onClose,
  onUsedItUp,
  onWasted,
  onAddToList,
  onViewDetails,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const status = getItemStatus(item);

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          {/* Drag handle */}
          <View style={s.handle} />

          {/* Item identity */}
          <View style={s.itemHead}>
            <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
            <View style={s.itemMeta}>
              <StatusPill status={status} />
              <Text style={s.itemCat}>{item.category}</Text>
              {item.isOrganic && (
                <View style={s.orgPill}>
                  <Text style={s.orgTxt}>ORG</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.divider} />

          {/* Primary actions */}
          <ActionRow
            icon="check-circle"
            label="Used It Up"
            sublabel="Mark as consumed"
            color={D.greenMid}
            bg={`${D.greenMid}12`}
            onPress={() => {
              onClose();
              setTimeout(() => onUsedItUp(item), 300);
            }}
          />
          <ActionRow
            icon="trash-2"
            label="It Was Wasted"
            sublabel="Track food waste"
            color="#B83030"
            bg="#fff0ee"
            onPress={() => {
              onClose();
              setTimeout(() => onWasted(item), 300);
            }}
          />
          <ActionRow
            icon="shopping-cart"
            label="Add to Shopping List"
            sublabel="Buy again soon"
            color="#1D6FA4"
            bg="#EAF4FC"
            onPress={() => { onAddToList(item); onClose(); }}
          />

          <View style={s.divider} />

          {/* Details button */}
          <Pressable
            style={({ pressed }) => [s.detailsRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => { onViewDetails(item); onClose(); }}
          >
            <Feather name="info" size={17} color={D.inkMid} />
            <Text style={s.detailsLabel}>View Details</Text>
            <Feather name="chevron-right" size={15} color={D.inkLight} style={{ marginLeft: "auto" }} />
          </Pressable>

          {/* Cancel */}
          <Pressable style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  icon, label, sublabel, color, bg, onPress,
}: {
  icon: string; label: string; sublabel: string;
  color: string; bg: string; onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [s.actionRow, { backgroundColor: pressed ? bg : "transparent" }]}
      onPress={onPress}
    >
      <View style={[s.actionIconWrap, { backgroundColor: bg }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.actionLabel, { color }]}>{label}</Text>
        <Text style={s.actionSub}>{sublabel}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: D.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: D.creamBorder,
    alignSelf: "center",
    marginBottom: 16,
  },
  itemHead: {
    marginBottom: 14,
    gap: 6,
  },
  itemName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: D.inkBlack,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  itemCat: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
  },
  orgPill: {
    backgroundColor: `${D.greenMid}18`,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  orgTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: D.greenMid,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: D.creamBorder,
    marginVertical: 8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  actionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: D.inkLight,
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 6,
  },
  detailsLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: D.inkMid,
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: D.creamDark,
    borderRadius: 12,
  },
  cancelTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: D.inkMid,
  },
});
