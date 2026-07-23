import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "../../src/api/queryKeys";
import { reviewApi } from "../../src/api/reviews";
import { Button } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";
import { colors, spacing, typography } from "../../src/theme/tokens";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional()
});

type FormValues = z.infer<typeof schema>;

export default function CreateReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ bookingId?: string; courtId?: string }>();
  const { control, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 5, comment: "" }
  });
  const rating = watch("rating");
  const create = useMutation({
    mutationFn: reviewApi.create,
    onSuccess: async () => {
      if (params.bookingId) await queryClient.invalidateQueries({ queryKey: queryKeys.booking(params.bookingId) });
      if (params.courtId) await queryClient.invalidateQueries({ queryKey: queryKeys.court(params.courtId) });
      Alert.alert("Da gui danh gia", "Cam on ban da danh gia san.");
      router.back();
    },
    onError: (error) => Alert.alert("Khong gui duoc", error instanceof Error ? error.message : "Vui long thu lai")
  });

  const onSubmit = handleSubmit((values) => {
    if (!params.courtId) return;
    create.mutate({ courtId: params.courtId, bookingId: params.bookingId, rating: values.rating, comment: values.comment || null });
  });

  return (
    <Screen title="Danh gia san" subtitle="Chi booking hoan tat moi co the danh gia." back>
      <Card>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable key={value} onPress={() => setValue("rating", value)}>
              <Star size={34} color={colors.warning} fill={value <= rating ? colors.warning : "transparent"} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.rating}>{rating}/5</Text>
        <Controller control={control} name="comment" render={({ field, fieldState }) => (
          <FormInput label="Nhan xet" multiline style={{ minHeight: 110, textAlignVertical: "top" }} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )} />
        <Button loading={formState.isSubmitting || create.isPending} onPress={onSubmit}>Gui danh gia</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  rating: {
    color: colors.ink,
    textAlign: "center",
    fontSize: typography.h2,
    fontWeight: "900"
  }
});
