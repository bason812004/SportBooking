import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MessageCircle, Send, X } from "lucide-react-native";
import { useAuthStore } from "../../store/auth";
import { useChatbot, type ChatDisplayMessage } from "../../hooks/useChatbot";
import { colors, radii, spacing, typography } from "../../theme/tokens";
import { PendingBookingCard } from "./PendingBookingCard";
import { QuickSuggestions } from "./QuickSuggestions";

export function ChatFab() {
  const user = useAuthStore((state) => state.user);
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatDisplayMessage>>(null);
  const { messages, sendMessage, isSending, pendingBooking, clearPendingBooking, error } = useChatbot();

  useEffect(() => {
    if (isOpen) listRef.current?.scrollToEnd({ animated: true });
  }, [isOpen, messages.length, isSending]);

  const submit = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    sendMessage(text);
    setDraft("");
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isOpen ? "Đóng trợ lý hỗ trợ" : "Mở trợ lý hỗ trợ"}
        accessibilityHint="Mở cửa sổ trò chuyện hỗ trợ đặt sân"
        onPress={() => setIsOpen((previous) => !previous)}
        hitSlop={8}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 88 }, pressed && styles.pressed]}
      >
        {isOpen ? <X size={25} color={colors.surface} /> : <MessageCircle size={25} color={colors.surface} />}
      </Pressable>

      <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setIsOpen(false)}>
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Trợ lý hỗ trợ</Text>
                <Text style={styles.headerSubtitle}>Hỏi về sân hoặc nhờ đặt sân giúp bạn.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Đóng cửa sổ trò chuyện" onPress={() => setIsOpen(false)} hitSlop={8} style={styles.iconButton}>
                <X size={22} color={colors.surface} />
              </Pressable>
            </View>

            {!user ? <Text style={styles.guestBanner}>Bạn đang ở chế độ khách. Đăng nhập để xem lịch đặt sân và được hỗ trợ đặt sân tự động.</Text> : null}

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.messages}
              renderItem={({ item }) => <ChatMessageBubble message={item} />}
              ListEmptyComponent={<Text style={styles.empty}>Xin chào! Bạn cần hỗ trợ gì về việc đặt sân hôm nay?</Text>}
              ListFooterComponent={
                <>
                  {isSending ? (
                    <View style={styles.typing}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.typingText}>Đang trả lời...</Text></View>
                  ) : null}
                  {pendingBooking ? <PendingBookingCard pendingBooking={pendingBooking} onDismiss={clearPendingBooking} /> : null}
                  {error ? <Text style={styles.error}>{error.message || "Có lỗi xảy ra, vui lòng thử lại."}</Text> : null}
                </>
              }
            />

            <QuickSuggestions isAuthenticated={Boolean(user)} onPick={sendMessage} />
            <View style={styles.inputBar}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={submit}
                returnKeyType="send"
                editable={!isSending}
                placeholder="Nhập câu hỏi của bạn..."
                placeholderTextColor={colors.muted}
                accessibilityLabel="Tin nhắn"
                style={styles.input}
                multiline
                maxLength={2000}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Gửi tin nhắn"
                disabled={!draft.trim() || isSending}
                onPress={submit}
                hitSlop={6}
                style={({ pressed }) => [styles.sendButton, (!draft.trim() || isSending) && styles.sendDisabled, pressed && styles.pressed]}
              >
                <Send size={20} color={colors.surface} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function ChatMessageBubble({ message }: { message: ChatDisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: spacing.lg, width: 56, height: 56, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, elevation: 7, shadowColor: colors.shadow, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, zIndex: 100 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  modalSafe: { flex: 1, backgroundColor: colors.canvas },
  modal: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.primary, gap: spacing.md },
  headerText: { flex: 1 },
  headerTitle: { color: colors.surface, fontSize: typography.h2, fontWeight: "900" },
  headerSubtitle: { color: colors.primarySoft, fontSize: typography.tiny, marginTop: 2 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  guestBanner: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.warningSoft, color: colors.text, fontSize: typography.tiny, lineHeight: 17 },
  messages: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm },
  empty: { alignSelf: "center", maxWidth: 280, marginTop: spacing.xxl, color: colors.muted, fontSize: typography.body, lineHeight: 22, textAlign: "center" },
  messageRow: { flexDirection: "row", width: "100%" },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
  messageText: { fontSize: typography.body, lineHeight: 22 },
  userText: { color: colors.surface, fontWeight: "600" },
  assistantText: { color: colors.ink },
  typing: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  typingText: { color: colors.muted, fontSize: typography.small },
  error: { color: colors.danger, fontSize: typography.small, lineHeight: 19, paddingVertical: spacing.sm },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 48, maxHeight: 110, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas, color: colors.ink, fontSize: typography.body },
  sendButton: { width: 48, height: 48, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
  sendDisabled: { opacity: 0.45 }
});
