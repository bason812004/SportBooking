import { Minus, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

export function QuantityStepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel="Giam so luong" disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} style={styles.button}>
        <Minus size={16} color={colors.ink} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable accessibilityLabel="Tang so luong" disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} style={styles.button}>
        <Plus size={16} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface
  },
  button: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  value: {
    minWidth: 28,
    textAlign: "center",
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "900"
  }
});

