import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, Text } from "react-native";
import { z } from "zod";
import { authApi } from "../../src/api/auth";
import { Button } from "../../src/components/Buttons";
import { FormInput, PasswordInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";
import { colors } from "../../src/theme/tokens";

const schema = z.object({
  fullName: z.string().min(2, "Nhap ho ten"),
  email: z.string().email("Email khong hop le"),
  phone: z.string().optional(),
  password: z.string().min(8, "Mat khau toi thieu 8 ky tu"),
  confirmPassword: z.string().min(8, "Xac nhan mat khau")
}).refine((value) => value.password === value.confirmPassword, {
  message: "Mat khau xac nhan khong khop",
  path: ["confirmPassword"]
});

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "" }
  });

  const onSubmit = handleSubmit(async ({ confirmPassword, ...payload }) => {
    try {
      const result = await authApi.requestRegistrationCode(payload);
      router.replace({ pathname: "/auth/verify", params: { email: result.email } });
    } catch (error) {
      Alert.alert("Dang ky that bai", error instanceof Error ? error.message : "Vui long thu lai");
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <Screen title="Tao tai khoan" subtitle="Dang ky tai khoan khach hang. Mobile app khong ho tro dang ky doi tac." back>
        <Card>
          <Controller control={control} name="fullName" render={({ field, fieldState }) => (
            <FormInput label="Ho ten" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="email" render={({ field, fieldState }) => (
            <FormInput label="Email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="phone" render={({ field, fieldState }) => (
            <FormInput label="So dien thoai" keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="password" render={({ field, fieldState }) => (
            <PasswordInput label="Mat khau" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="confirmPassword" render={({ field, fieldState }) => (
            <PasswordInput label="Xac nhan mat khau" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Text style={{ color: colors.muted, fontWeight: "700" }}>Mat khau can toi thieu 8 ky tu. Sau khi gui form, he thong se yeu cau ma OTP.</Text>
          <Button loading={formState.isSubmitting} onPress={onSubmit}>Gui ma xac thuc</Button>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

