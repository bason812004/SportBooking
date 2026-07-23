import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { z } from "zod";
import { authApi } from "../../src/api/auth";
import { Button } from "../../src/components/Buttons";
import { PasswordInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";

const schema = z.object({
  currentPassword: z.string().min(1, "Nhap mat khau hien tai"),
  newPassword: z.string().min(8, "Mat khau moi toi thieu 8 ky tu"),
  confirmPassword: z.string().min(8, "Xac nhan mat khau")
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Mat khau xac nhan khong khop",
  path: ["confirmPassword"]
});

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      Alert.alert("Da doi mat khau", "Lan dang nhap tiep theo hay dung mat khau moi.");
      router.back();
    } catch (error) {
      Alert.alert("Khong doi duoc", error instanceof Error ? error.message : "Vui long thu lai");
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <Screen title="Doi mat khau" back>
        <Card>
          <Controller control={control} name="currentPassword" render={({ field, fieldState }) => (
            <PasswordInput label="Mat khau hien tai" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="newPassword" render={({ field, fieldState }) => (
            <PasswordInput label="Mat khau moi" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="confirmPassword" render={({ field, fieldState }) => (
            <PasswordInput label="Xac nhan mat khau moi" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Button loading={formState.isSubmitting} onPress={onSubmit}>Doi mat khau</Button>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

