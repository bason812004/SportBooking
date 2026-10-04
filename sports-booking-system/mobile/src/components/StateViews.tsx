import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { Button } from "./Buttons";

export function LoadingState({ label = "Dang tai du lieu" }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Khong tai duoc du lieu</Text>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? <Button variant="secondary" onPress={onRetry}>Thu lai</Button> : null}
    </View>
  );
}

export function EmptyState({ title, message, actionLabel, onAction, action }: { title: string; message?: string; actionLabel?: string; onAction?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.text}>{message}</Text> : null}
      {actionLabel && onAction ? <Button variant="secondary" onPress={onAction}>{actionLabel}</Button> : null}
      {action}
    </View>
  );
}

// List footer for paginated lists: also the fallback when a short list never triggers onEndReached.
export function LoadMoreFooter({ hasMore, loading, onPress }: { hasMore: boolean; loading: boolean; onPress: () => void }) {
  if (!hasMore) return null;
  return (
    <View style={styles.loadMore}>
      <Button variant="ghost" loading={loading} onPress={onPress}>Xem thêm</Button>
    </View>
  );
}

export function SkeletonCard() {
  return (
    <Pressable disabled style={styles.skeleton}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonLine} />
      <View style={[styles.skeletonLine, { width: "62%" }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md
  },
  panel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md
  },
  title: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900",
    textAlign: "center"
  },
  text: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: "center",
    lineHeight: 20
  },
  loadMore: {
    paddingTop: spacing.md
  },
  skeleton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm
  },
  skeletonImage: {
    height: 116,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt
  },
  skeletonLine: {
    height: 14,
    width: "86%",
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt
  }
});

