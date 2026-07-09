import { Eye, EyeOff, Search } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

type FieldProps = TextInputProps & {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
};

export function FormInput({ label, error, leftIcon, style, ...props }: FieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, error && styles.inputError]}>
        {leftIcon}
        <TextInput
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={[styles.input, style]}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PasswordInput({ label, error, leftIcon, style, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, error && styles.inputError]}>
        {leftIcon}
        <TextInput
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          secureTextEntry={!visible}
          style={[styles.input, style]}
          {...props}
        />
        <Pressable accessibilityLabel={visible ? "An mat khau" : "Hien mat khau"} onPress={() => setVisible((value) => !value)} style={styles.iconButton}>
          {visible ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SearchInput({ value, onChangeText, placeholder = "Tim san, dia chi, bo mon" }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  return (
    <View style={styles.searchShell}>
      <Search size={20} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs
  },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "900"
  },
  inputShell: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  inputError: {
    borderColor: colors.danger
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: typography.body
  },
  error: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: "700"
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  },
  searchShell: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: "700"
  }
});
