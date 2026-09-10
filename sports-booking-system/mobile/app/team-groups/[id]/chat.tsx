import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Info, LogOut, Send, Smile, Users, MapPin, CalendarDays, Clock, UsersRound } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentApi } from "../../../src/api/content";
import { queryKeys } from "../../../src/api/queryKeys";
import type { TeamPostMessage } from "../../../src/api/types";
import { Button } from "../../../src/components/Buttons";
import { Card, SectionHeader } from "../../../src/components/Screen";
import { ErrorState, LoadingState } from "../../../src/components/StateViews";
import { useAuthStore } from "../../../src/store/auth";
import { colors, radii, spacing, typography } from "../../../src/theme/tokens";
import { formatDate } from "../../../src/utils/format";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏"];

export default function TeamGroupChatScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [inputMessage, setInputMessage] = useState("");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const post = useQuery({
    queryKey: queryKeys.teamPost(id),
    queryFn: () => contentApi.teamPost(id),
    enabled: Boolean(id)
  });

  const members = useQuery({
    queryKey: queryKeys.teamPostMembers(id),
    queryFn: () => contentApi.teamPostMembers(id),
    enabled: Boolean(id)
  });

  const messages = useQuery({
    queryKey: queryKeys.teamPostMessages(id),
    queryFn: () => contentApi.teamPostMessages(id),
    enabled: Boolean(id),
    refetchInterval: 4000 // Poll every 4 seconds for fresh chat messages
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => contentApi.createTeamPostMessage(id, { content: text, messageType: "TEXT" }),
    onSuccess: (newMessage) => {
      setInputMessage("");
      queryClient.setQueryData<TeamPostMessage[]>(queryKeys.teamPostMessages(id), (old = []) => [...old, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (error) => Alert.alert("Không thể gửi", error instanceof Error ? error.message : "Vui lòng thử lại.")
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: string; reaction: string }) =>
      contentApi.reactToMessage(id, { messageId, reaction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamPostMessages(id) });
    }
  });

  const leaveMutation = useMutation({
    mutationFn: () => contentApi.leaveGroup(id),
    onSuccess: () => {
      Alert.alert("Đã rời nhóm", "Bạn đã rời khỏi nhóm này.");
      router.replace("/(tabs)/teammates");
    }
  });

  function handleSend() {
    if (!inputMessage.trim() || sendMutation.isPending) return;
    sendMutation.mutate(inputMessage.trim());
  }

  function handleLeave() {
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn rời khỏi nhóm này không?",
      [
        { text: "Hủy", style: "cancel" },
        { text: "Rời nhóm", style: "destructive", onPress: () => leaveMutation.mutate() }
      ]
    );
  }

  if (post.isLoading) return <LoadingState label="Đang tải phòng chat..." />;
  if (post.isError) return <ErrorState message={post.error.message} onRetry={() => void post.refetch()} />;
  if (!post.data) return <ErrorState message="Không tìm thấy nhóm chat." />;

  const group = post.data;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      {/* Top Chat Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>

        <Pressable onPress={() => setInfoModalOpen(true)} style={styles.headerTitleContainer}>
          <Text numberOfLines={1} style={styles.headerTitle}>{group.title}</Text>
          <Text style={styles.headerSubtitle}>
            {group.sportType} · {members.data?.length ?? group.currentPlayers} thành viên
          </Text>
        </Pressable>

        <Pressable onPress={() => setInfoModalOpen(true)} style={styles.headerButton}>
          <Info size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages.data ?? []}
        keyExtractor={(item, index) => item.id || String(index)}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender?.id === user?.id;
          return (
            <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
              {!isMe && (
                <View style={styles.messageAvatar}>
                  <Text style={styles.avatarLetter}>
                    {item.sender?.fullName?.charAt(0)?.toUpperCase() || "U"}
                  </Text>
                </View>
              )}
              <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                {!isMe && (
                  <Text style={styles.senderName}>{item.sender?.fullName || "Thành viên"}</Text>
                )}
                <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
                  {item.content}
                </Text>
                <View style={styles.bubbleFooter}>
                  <Text style={[styles.timeText, isMe && styles.myTimeText]}>
                    {(item.createdAt || "").slice(11, 16)}
                  </Text>
                  {/* Reactions view */}
                  {item.reactions && item.reactions.length > 0 && (
                    <View style={styles.reactionsRow}>
                      {item.reactions.map((r, i) => (
                        <Text key={i} style={styles.reactionEmoji}>{r.reaction}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Chưa có tin nhắn</Text>
            <Text style={styles.emptySubtitle}>Hãy gửi tin nhắn đầu tiên để chào mọi người!</Text>
          </View>
        }
      />

      {/* Message Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={colors.muted}
          value={inputMessage}
          onChangeText={setInputMessage}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          disabled={!inputMessage.trim() || sendMutation.isPending}
          onPress={handleSend}
          style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]}
        >
          <Send size={18} color={colors.surface} />
        </Pressable>
      </View>

      {/* Group Info Modal */}
      <Modal visible={infoModalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInfoModalOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thông Tin Nhóm</Text>
            <Button variant="ghost" onPress={() => setInfoModalOpen(false)}>Đóng</Button>
          </View>

          <FlatList
            data={members.data ?? []}
            keyExtractor={(item) => item.userId}
            ListHeaderComponent={
              <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
                <Card style={{ gap: spacing.sm }}>
                  <Text style={styles.groupInfoTitle}>{group.title}</Text>
                  <View style={styles.inline}>
                    <MapPin size={15} color={colors.primary} />
                    <Text style={styles.meta}>{group.courtName} - {group.address}</Text>
                  </View>
                  <View style={styles.inline}>
                    <CalendarDays size={15} color={colors.muted} />
                    <Text style={styles.meta}>
                      {group.playingDate ? formatDate(group.playingDate) : "Linh hoạt"} · {(group.startTime || "").slice(0, 5)} - {(group.endTime || "").slice(0, 5)}
                    </Text>
                  </View>
                  <View style={styles.inline}>
                    <UsersRound size={15} color={colors.muted} />
                    <Text style={styles.meta}>{group.currentPlayers}/{group.maxPlayers} người</Text>
                  </View>
                </Card>
                <SectionHeader title={`Danh sách thành viên (${members.data?.length ?? 0})`} />
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <View style={styles.inline}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.avatarLetter}>{item.fullName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.memberName}>{item.fullName}</Text>
                </View>
                <Text style={item.role === "OWNER" ? styles.ownerBadge : styles.memberBadge}>
                  {item.role === "OWNER" ? "Trưởng nhóm" : "Thành viên"}
                </Text>
              </View>
            )}
            ListFooterComponent={
              <View style={{ marginTop: spacing.xl, paddingBottom: 40 }}>
                <Button variant="danger" onPress={handleLeave}>
                  Rời khỏi nhóm
                </Button>
              </View>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.sm
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitleContainer: {
    flex: 1
  },
  headerTitle: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink
  },
  headerSubtitle: {
    fontSize: typography.tiny,
    color: colors.muted,
    fontWeight: "600"
  },
  messagesList: {
    padding: spacing.md,
    gap: spacing.sm
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    marginVertical: 2
  },
  myMessageRow: {
    justifyContent: "flex-end"
  },
  otherMessageRow: {
    justifyContent: "flex-start"
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarLetter: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: "900"
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  senderName: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primaryDark,
    marginBottom: 2
  },
  messageText: {
    fontSize: typography.body,
    lineHeight: 20
  },
  myMessageText: {
    color: colors.surface,
    fontWeight: "600"
  },
  otherMessageText: {
    color: colors.ink
  },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4
  },
  timeText: {
    fontSize: 10,
    color: colors.muted
  },
  myTimeText: {
    color: "rgba(255,255,255,0.8)"
  },
  reactionsRow: {
    flexDirection: "row",
    gap: 2
  },
  reactionEmoji: {
    fontSize: 12
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink
  },
  emptySubtitle: {
    fontSize: typography.small,
    color: colors.muted,
    marginTop: 4
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: spacing.sm
  },
  input: {
    flex: 1,
    minHeight: 42,
    backgroundColor: colors.canvas,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: colors.ink
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: spacing.md
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  modalTitle: {
    fontSize: typography.h2,
    fontWeight: "900",
    color: colors.ink
  },
  groupInfoTitle: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  meta: {
    fontSize: typography.small,
    color: colors.muted
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  memberName: {
    fontSize: typography.body,
    fontWeight: "800",
    color: colors.ink
  },
  ownerBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm
  },
  memberBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted
  }
});
