import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { queryKeys } from "../../src/api/queryKeys";
import { userApi } from "../../src/api/user";
import { Button } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";
import { useAuthStore } from "../../src/store/auth";

const schema = z.object({
  fullName: z.string().min(2, "Nhap ho ten"),
  phone: z.string().optional(),
  avatarUrl: z.string().url("Avatar phai la URL hop le").optional().or(z.literal(""))
});

type FormValues = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: user?.fullName ?? "", phone: user?.phone ?? "", avatarUrl: user?.avatarUrl ?? "" }
  });
  const update = useMutation({
    mutationFn: userApi.updateMe,
    onSuccess: async (updated) => {
      if (accessToken && refreshToken) await setSession({ accessToken, refreshToken, user: updated });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      Alert.alert("Da luu", "Ho so cua ban da duoc cap nhat.");
      router.back();
    },
    onError: (error) => Alert.alert("Khong luu duoc", error instanceof Error ? error.message : "Vui long thu lai")
  });

  const onSubmit = handleSubmit((values) => update.mutate({ ...values, avatarUrl: values.avatarUrl || undefined }));

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <Screen title="Chinh sua ho so" back>
        <Card>
          <Controller control={control} name="fullName" render={({ field, fieldState }) => (
            <FormInput label="Ho ten" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="phone" render={({ field, fieldState }) => (
            <FormInput label="So dien thoai" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} keyboardType="phone-pad" />
          )} />
          <Controller control={control} name="avatarUrl" render={({ field, fieldState }) => (
            <FormInput label="Avatar URL" value={field.value ?? ""} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Button loading={formState.isSubmitting || update.isPending} onPress={onSubmit}>Luu thay doi</Button>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

