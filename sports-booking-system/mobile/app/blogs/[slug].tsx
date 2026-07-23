import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import { Button } from "../../src/components/Buttons";
import { Card, Screen } from "../../src/components/Screen";
import { ErrorState, LoadingState } from "../../src/components/StateViews";
import { colors, typography } from "../../src/theme/tokens";
import { formatDate, stripHtml } from "../../src/utils/format";

const fallbackImage = "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1400&auto=format&fit=crop";

export default function BlogDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const value = Array.isArray(slug) ? slug[0] : slug;
  const blog = useQuery({ queryKey: queryKeys.blog(value), queryFn: () => contentApi.blog(value), enabled: Boolean(value) });

  if (blog.isLoading) return <Screen back><LoadingState /></Screen>;
  if (blog.isError) return <Screen back><ErrorState message={blog.error.message} onRetry={() => void blog.refetch()} /></Screen>;
  if (!blog.data) return <Screen back><ErrorState message="Khong tim thay bai viet" /></Screen>;

  return (
    <Screen title={blog.data.title} subtitle={`${blog.data.author?.fullName ?? "SportBooking"} · ${formatDate(blog.data.publishedAt ?? blog.data.createdAt)}`} back>
      <Image source={{ uri: blog.data.coverImageUrl ?? fallbackImage }} style={styles.cover} contentFit="cover" />
      <Card>
        <Text style={styles.body}>{stripHtml(blog.data.content)}</Text>
      </Card>
      <Button variant="secondary" onPress={() => Linking.openURL(`sportbooking://blogs/${blog.data.slug}`)}>Chia se bai viet</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    height: 240,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt
  },
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24
  }
});

