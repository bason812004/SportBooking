import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { z } from "zod";
import { Button } from "../../src/components/Buttons";
import { FormInput, PasswordInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";
import { useAuthStore } from "../../src/store/auth";
import { colors, typography } from "../../src/theme/tokens";

const schema = z.object({
  email: z.string().email("Email khong hop le"),
  password: z.string().min(1, "Nhap mat khau")
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const login = useAuthStore((state) => state.login);
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
      router.replace(params.returnTo || "/(tabs)");
    } catch (error) {
      Alert.alert("Dang nhap that bai", error instanceof Error ? error.message : "Vui long thu lai");
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <Screen title="Dang nhap" subtitle="Dung tai khoan khach hang de dat san, nhan voucher va theo doi lich choi." back>
        <Card>
          <Controller control={control} name="email" render={({ field, fieldState }) => (
            <FormInput label="Email" keyboardType="email-address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="password" render={({ field, fieldState }) => (
            <PasswordInput label="Mat khau" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Button loading={formState.isSubmitting} onPress={onSubmit}>Dang nhap</Button>
          <Button variant="ghost" onPress={() => router.push("/auth/register")}>Tao tai khoan moi</Button>
        </Card>
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: colors.actionSoft }}>
          <Text style={{ color: colors.action, fontWeight: "900", fontSize: typography.small }}>Ung dung chi danh cho role USER. Tai khoan partner/admin se khong duoc vao mobile app.</Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

