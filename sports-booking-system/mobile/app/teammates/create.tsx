import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { contentApi } from "../../src/api/content";
import { queryKeys } from "../../src/api/queryKeys";
import type { TeamRecruitmentInput } from "../../src/api/types";
import { Button, Chip } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { Card, Screen, SectionHeader } from "../../src/components/Screen";
import { StickyBottomAction } from "../../src/components/StickyBottomAction";
import { useAuthStore } from "../../src/store/auth";
import { colors, spacing, typography } from "../../src/theme/tokens";
import { todayKey } from "../../src/utils/format";

const sportTypes = ["Bóng đá", "Cầu lông", "Pickleball", "Tennis", "Bóng rổ", "Bóng chuyền"];

export default function CreateTeammatePostScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState("");
  const [sportType, setSportType] = useState("Bóng đá");
  const [courtName, setCourtName] = useState("");
  const [address, setAddress] = useState("");
  const [playingDate, setPlayingDate] = useState(todayKey());
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("20:00");
  const [currentPlayers, setCurrentPlayers] = useState("1");
  const [maxPlayers, setMaxPlayers] = useState("10");
  const [pricePerPerson, setPricePerPerson] = useState("50000");
  const [note, setNote] = useState("");

  const createMutation = useMutation({
    mutationFn: (input: TeamRecruitmentInput) => contentApi.createTeamPost(input),
    onSuccess: async (createdPost) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.teamPosts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myTeamPosts })
      ]);
      Alert.alert("Thành công", "Đã đăng bài tìm bạn thi đấu thành công!", [
        {
          text: "Xem bài đăng",
          onPress: () => router.replace(`/teammates/${createdPost.id}`)
        }
      ]);
    },
    onError: (error) => Alert.alert("Không thể đăng bài", error instanceof Error ? error.message : "Vui lòng kiểm tra lại thông tin.")
  });

  function handleSubmit() {
    if (!title.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tiêu đề bài đăng.");
      return;
    }
    if (!courtName.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên sân thi đấu.");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập địa chỉ sân.");
      return;
    }

    const payload: TeamRecruitmentInput = {
      title: title.trim(),
      sportType,
      courtName: courtName.trim(),
      address: address.trim(),
      playingDate: playingDate || undefined,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      currentPlayers: Number(currentPlayers) || 1,
      maxPlayers: Number(maxPlayers) || 10,
      pricePerPerson: Number(pricePerPerson) || 0,
      note: note.trim() || undefined
    };

    createMutation.mutate(payload);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Đăng Bài Tìm Bạn" subtitle="Tìm đồng đội và ghép trận đấu thể thao dễ dàng" back>
        <Card style={{ gap: spacing.md }}>
          {/* Sport Type */}
          <View>
            <Text style={styles.label}>Chọn môn thể thao</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {sportTypes.map((sport) => (
                <Chip
                  key={sport}
                  label={sport}
                  active={sportType === sport}
                  onPress={() => setSportType(sport)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Title */}
          <FormInput
            label="Tiêu đề bài đăng *"
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Cần tìm 2 bạn đá bóng sân 7 tối nay"
          />

          {/* Court & Address */}
          <FormInput
            label="Tên sân thi đấu *"
            value={courtName}
            onChangeText={setCourtName}
            placeholder="Ví dụ: Sân bóng Sala Quận 2"
          />

          <FormInput
            label="Địa chỉ sân *"
            value={address}
            onChangeText={setAddress}
            placeholder="Ví dụ: 10 Mai Chí Thọ, P. An Lợi Đông, TP. Thủ Đức"
          />

          {/* Date and Time */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Ngày chơi (YYYY-MM-DD)"
                value={playingDate}
                onChangeText={setPlayingDate}
                placeholder="2026-09-05"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Giờ bắt đầu"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="18:00"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Giờ kết thúc"
                value={endTime}
                onChangeText={setEndTime}
                placeholder="20:00"
              />
            </View>
          </View>

          {/* Players count */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Đang có (người)"
                value={currentPlayers}
                onChangeText={setCurrentPlayers}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormInput
                label="Cần tối đa (người)"
                value={maxPlayers}
                onChangeText={setMaxPlayers}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Price */}
          <FormInput
            label="Phí chia mỗi người (VNĐ)"
            value={pricePerPerson}
            onChangeText={setPricePerPerson}
            keyboardType="numeric"
            placeholder="50000"
          />

          {/* Note */}
          <FormInput
            label="Ghi chú thêm cho người tham gia"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Ví dụ: Trình độ giao lưu vui vẻ, mang giày bata hoặc TF..."
          />
        </Card>
      </Screen>

      <StickyBottomAction>
        <Button
          variant="primary"
          loading={createMutation.isPending}
          onPress={handleSubmit}
        >
          Đăng bài tìm bạn ngay
        </Button>
      </StickyBottomAction>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: "900",
    marginBottom: spacing.xs
  },
  chipsRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  row: {
    flexDirection: "row",
    gap: spacing.md
  }
});
