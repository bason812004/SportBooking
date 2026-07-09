import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/tokens";

export function StickyBottomAction({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={["bottom"]} style={styles.wrap}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line
  }
});

