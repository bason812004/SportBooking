import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AvailabilitySlot } from "../api/types";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { formatCurrency } from "../utils/format";

export function SlotPicker({
  slots,
  selected,
  onToggle
}: {
  slots: AvailabilitySlot[];
  selected: AvailabilitySlot[];
  onToggle: (slot: AvailabilitySlot) => void;
}) {
  return (
    <View style={styles.wrap}>
      {slots.map((slot) => {
        const active = selected.some((item) => item.startTime === slot.startTime && item.endTime === slot.endTime);
        const disabled = slot.status !== "AVAILABLE";
        return (
          <Pressable
            key={`${slot.startTime}-${slot.endTime}`}
            disabled={disabled}
            onPress={() => onToggle(slot)}
            style={[styles.slot, active && styles.slotActive, disabled && styles.slotDisabled]}
          >
            <Text style={[styles.slotTime, active && styles.slotActiveText]}>{slot.startTime} - {slot.endTime}</Text>
            <Text style={[styles.slotPrice, active && styles.slotActiveText]}>{formatCurrency(slot.price)}</Text>
            {disabled ? <Text style={styles.disabledText}>{slot.status === "PENDING_PAYMENT" ? "Đang giữ" : "Đã đặt"}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateStrip({ value, onChange, days = 10 }: { value: string; onChange: (value: string) => void; days?: number }) {
  const items = Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, day: date.toLocaleDateString("vi-VN", { weekday: "short" }), date: date.getDate() };
  });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.dateChip, active && styles.dateChipActive]}>
            <Text style={[styles.dateDay, active && styles.dateActiveText]}>{item.day}</Text>
            <Text style={[styles.dateNumber, active && styles.dateActiveText]}>{item.date}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  slot: {
    width: "48%",
    minHeight: 78,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: "center",
    gap: 3
  },
  slotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  slotDisabled: {
    backgroundColor: colors.surfaceAlt,
    opacity: 0.7
  },
  slotTime: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: typography.small
  },
  slotPrice: {
    color: colors.primaryDark,
    fontWeight: "800",
    fontSize: typography.tiny
  },
  slotActiveText: {
    color: colors.surface
  },
  disabledText: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "800"
  },
  dateStrip: {
    gap: spacing.sm,
    paddingRight: spacing.lg
  },
  dateChip: {
    minWidth: 62,
    minHeight: 66,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  dateChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  dateDay: {
    color: colors.muted,
    fontSize: typography.tiny,
    fontWeight: "800"
  },
  dateNumber: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  },
  dateActiveText: {
    color: colors.surface
  }
});

