import { Stack, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { PropsWithChildren } from "react";
import { Pressable, RefreshControl, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "../theme/tokens";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: React.ReactNode;
  back?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Screen({ title, subtitle, children, scroll = true, refreshing = false, onRefresh, right, back, contentStyle }: ScreenProps) {
  const router = useRouter();
  const content = (
    <View style={[styles.content, contentStyle]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {back ? (
              <Pressable accessibilityLabel="Quay lai" onPress={() => router.back()} style={styles.backButton}>
                <ArrowLeft size={20} color={colors.ink} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  scrollContent: {
    paddingBottom: 112
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  title: {
    color: colors.ink,
    fontSize: typography.h1,
    fontWeight: "900"
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 19
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionHeader: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: "900"
  }
});

