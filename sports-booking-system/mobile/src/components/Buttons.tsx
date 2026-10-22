import { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type ButtonProps = PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

export function Button({ children, onPress, disabled, loading, variant = "primary", style, accessibilityLabel }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style
      ]}
    >
      {loading ? <ActivityIndicator color={variant === "primary" ? colors.surface : colors.primary} /> : <Text style={[styles.label, labelStyles[variant]]}>{children}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.primarySoft
  },
  danger: {
    backgroundColor: colors.dangerSoft
  },
  ghost: {
    backgroundColor: "transparent"
  },
  disabled: {
    opacity: 0.55
  },
  pressed: {
    transform: [{ scale: 0.98 }]
  },
  label: {
    fontSize: typography.body,
    fontWeight: "900"
  },
  chip: {
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: typography.small
  },
  chipTextActive: {
    color: colors.surface
  }
});

const labelStyles = StyleSheet.create({
  primary: {
    color: colors.surface
  },
  secondary: {
    color: colors.primaryDark
  },
  danger: {
    color: colors.danger
  },
  ghost: {
    color: colors.primary
  }
});

