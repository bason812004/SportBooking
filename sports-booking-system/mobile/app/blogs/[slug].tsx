import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MessageSquare, Send } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { useAuthStore } from "../../src/store/auth";
import { colors, radii, spacing, typography } from "../../src/theme/tokens";
import { formatDate, stripHtml } from "../../src/utils/format";

const fallbackImage = "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1400&auto=format&fit=crop";

export default function BlogDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const value = Array.isArray(slug) ? slug[0] : slug;
  const [commentInput, setCommentInput] = useState("");

  const blog = useQuery({
    queryKey: queryKeys.blog(value),
    queryFn: () => contentApi.blog(value),
    enabled: Boolean(value)
  });

  const comments = useQuery({
    queryKey: queryKeys.blogComments(value),
    queryFn: () => contentApi.blogComments(value),
    enabled: Boolean(value)
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => contentApi.createBlogComment(value, text),
    onSuccess: () => {
      setCommentInput("");
      queryClient.invalidateQueries({ queryKey: queryKeys.blogComments(value) });
      Alert.alert("Thành công", "Đã gửi bình luận của bạn.");
    },
    onError: (error) => Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể gửi bình luận.")
  });

  if (blog.isLoading) return <Screen back><LoadingState label="Đang tải bài viết..." /></Screen>;
  if (blog.isError) return <Screen back><ErrorState message={blog.error.message} onRetry={() => void blog.refetch()} /></Screen>;
  if (!blog.data) return <Screen back><ErrorState message="Không tìm thấy bài viết." /></Screen>;

  const data = blog.data;

  function handleSendComment() {
    if (!commentInput.trim() || commentMutation.isPending) return;
    if (!user) {
      router.push({ pathname: "/auth/login", params: { returnTo: `/blogs/${value}` } });
      return;
    }
    commentMutation.mutate(commentInput.trim());
  }

  return (
    <Screen
      title={data.title}
      subtitle={`${data.author?.fullName ?? "SportBooking"} · ${formatDate(data.publishedAt ?? data.createdAt)}`}
      back
    >
      <Image source={{ uri: data.coverImageUrl ?? fallbackImage }} style={styles.cover} contentFit="cover" />

      {/* Blog Content */}
      <Card>
        <Text style={styles.body}>{stripHtml(data.content)}</Text>
      </Card>

      {/* Comments Section */}
      <SectionHeader title={`Bình luận (${comments.data?.length ?? 0})`} />

      {/* Add comment box */}
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.commentLabel}>Viết bình luận của bạn</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={user ? "Nhập ý kiến của bạn..." : "Đăng nhập để bình luận..."}
            placeholderTextColor={colors.muted}
            value={commentInput}
            onChangeText={setCommentInput}
            editable={Boolean(user)}
          />
          <Button
            disabled={!commentInput.trim() || commentMutation.isPending || !user}
            loading={commentMutation.isPending}
            onPress={handleSendComment}
          >
            Gửi
          </Button>
        </View>
      </Card>

      {/* Comments list */}
      {comments.isLoading ? (
        <LoadingState label="Đang tải bình luận..." />
      ) : comments.data?.length ? (
        <View style={{ gap: spacing.sm }}>
          {comments.data.map((c) => (
            <Card key={c.id} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.commenterName}>{c.user?.fullName || "Ẩn danh"}</Text>
                <Text style={styles.timeText}>{formatDate(c.createdAt)}</Text>
              </View>
              <Text style={styles.commentContent}>{c.content}</Text>
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <Text style={styles.meta}>Chưa có bình luận nào. Hãy là người đầu tiên!</Text>
        </Card>
      )}

      <View style={{ marginTop: spacing.md }}>
        <Button variant="secondary" onPress={() => Linking.openURL(`sportbooking://blogs/${data.slug}`)}>
          Chia sẻ bài viết
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 220,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceAlt
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24
  },
  commentLabel: {
    fontSize: typography.small,
    fontWeight: "900",
    color: colors.ink
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center"
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.ink
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  commenterName: {
    fontSize: typography.body,
    fontWeight: "900",
    color: colors.ink
  },
  commentContent: {
    fontSize: typography.body,
    color: colors.text,
    lineHeight: 20
  },
  timeText: {
    fontSize: typography.tiny,
    color: colors.muted
  },
  meta: {
    fontSize: typography.small,
    color: colors.muted
  }
});
