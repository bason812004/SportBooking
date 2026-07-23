import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { bookingStatusLabel, paymentStatusLabel } from "../utils/format";

export function StatusBadge({ status, kind = "booking" }: { status: string; kind?: "booking" | "payment" | "plain" }) {
  const tone = statusTone(status);
  const label = kind === "booking" ? bookingStatusLabel(status) : kind === "payment" ? paymentStatusLabel(status) : status;
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

function statusTone(status: string) {
  if (["COMPLETED", "PAID", "ACTIVE", "CLAIMED", "AVAILABLE"].includes(status)) return { bg: colors.successSoft, fg: colors.success };
  if (["CONFIRMED", "PENDING_PAYMENT", "PENDING", "UNPAID"].includes(status)) return { bg: colors.warningSoft, fg: colors.warning };
  if (["CANCELLED", "NO_SHOW", "FAILED", "EXPIRED", "USED"].includes(status)) return { bg: colors.dangerSoft, fg: colors.danger };
  return { bg: colors.surfaceAlt, fg: colors.muted };
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6
  },
  text: {
    fontSize: typography.tiny,
    fontWeight: "900"
  }
});

