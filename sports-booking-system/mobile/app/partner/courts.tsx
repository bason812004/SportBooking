import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partnerApi } from "../../src/api/partner";
import { Card } from "../../src/components/Screen";
import { Button } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { LoadingState, ErrorState, EmptyState } from "../../src/components/StateViews";
import { colors, typography, spacing } from "../../src/theme/tokens";
import { formatCurrency } from "../../src/utils/format";
import { Building2, Plus, CheckCircle, Clock } from "lucide-react-native";

export default function PartnerCourtsScreen() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [basePrice, setBasePrice] = useState("");

  const courts = useQuery({
    queryKey: ["partner-courts"],
    queryFn: partnerApi.courts
  });

  const createCourt = useMutation({
    mutationFn: partnerApi.createCourt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["partner-courts"] });
      setShowAddModal(false);
      setName("");
      setAddress("");
      setBasePrice("");
      Alert.alert("Thành công", "Đã tạo sân mới thành công!");
    },
    onError: (err) => Alert.alert("Lỗi", err instanceof Error ? err.message : "Không thể tạo sân")
  });

  const handleCreate = () => {
    if (!name.trim() || !address.trim() || !basePrice.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ tên sân, địa chỉ và giá.");
      return;
    }
    createCourt.mutate({
      name: name.trim(),
      address: address.trim(),
      basePrice: Number(basePrice)
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={courts.isRefetching} onRefresh={() => void courts.refetch()} />}
    >
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Danh Sách Sân ({courts.data?.length ?? 0})</Text>
        <Button size="small" onPress={() => setShowAddModal(!showAddModal)}>
          {showAddModal ? "Hủy" : "+ Thêm sân mới"}
        </Button>
      </View>

      {showAddModal && (
        <Card style={{ gap: 12, borderLineWidth: 2, borderColor: colors.primary }}>
          <Text style={{ fontWeight: "900", fontSize: typography.body, color: colors.ink }}>Tạo Sân Mới</Text>
          <FormInput label="Tên sân" value={name} onChangeText={setName} placeholder="VD: Sân Pickleball Quận 1" />
          <FormInput label="Địa chỉ" value={address} onChangeText={setAddress} placeholder="VD: 123 Nguyễn Thị Minh Khai" />
          <FormInput label="Giá cơ bản / giờ (VNĐ)" value={basePrice} onChangeText={setBasePrice} keyboardType="number-pad" placeholder="130000" />
          <Button loading={createCourt.isPending} onPress={handleCreate}>
            Lưu Sân
          </Button>
        </Card>
      )}

      {courts.isLoading ? (
        <LoadingState label="Đang tải danh sách sân..." />
      ) : courts.isError ? (
        <ErrorState message={courts.error.message} onRetry={() => void courts.refetch()} />
      ) : !courts.data?.length ? (
        <EmptyState title="Chưa có sân nào" message="Bấm '+ Thêm sân mới' để bắt đầu đăng tải sân của bạn." />
      ) : (
        courts.data.map((court) => (
          <Card key={court.id} style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <Text style={{ fontWeight: "900", fontSize: typography.body, color: colors.ink, flex: 1 }}>
                {court.name}
              </Text>
              <View style={[styles.badge, court.approvalStatus === "APPROVED" ? styles.badgeApproved : styles.badgePending]}>
                <Text style={styles.badgeText}>{court.approvalStatus === "APPROVED" ? "Đã duyệt" : "Chờ duyệt"}</Text>
              </View>
            </View>
            <Text style={{ fontSize: typography.small, color: colors.muted }}>📍 {court.address}</Text>
            <Text style={{ fontSize: typography.body, fontWeight: "900", color: colors.primaryDark }}>
              {formatCurrency(Number(court.basePrice ?? court.price ?? 130000))} / giờ
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  title: {
    fontSize: typography.h3,
    fontWeight: "900",
    color: colors.ink
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeApproved: {
    backgroundColor: "#dcfce7"
  },
  badgePending: {
    backgroundColor: "#fef3c7"
  },
  badgeText: {
    fontSize: typography.small,
    fontWeight: "800",
    color: colors.ink
  }
});
