import { ScrollView, StyleSheet } from "react-native";
import { Chip } from "../Buttons";
import { colors, spacing } from "../../theme/tokens";

export function QuickSuggestions({ isAuthenticated, onPick }: { isAuthenticated: boolean; onPick: (text: string) => void }) {
  const suggestions = [
    "Giờ mở cửa sân thế nào?",
    "Chính sách hủy sân ra sao?",
    ...(isAuthenticated ? ["Lịch đặt sân sắp tới của tôi", "Đặt giúp tôi sân cầu lông tối nay"] : [])
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {suggestions.map((suggestion) => (
        <Chip key={suggestion} label={suggestion} onPress={() => onPick(suggestion)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface
  }
});
