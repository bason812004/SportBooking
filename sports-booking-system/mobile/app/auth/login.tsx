import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, Text, View, TouchableOpacity } from "react-native";
import { z } from "zod";
import { Button } from "../../src/components/Buttons";
import { FormInput, PasswordInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";
import { useAuthStore } from "../../src/store/auth";
import { useLanguageStore } from "../../src/i18n";
import { colors, typography } from "../../src/theme/tokens";

const schema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu")
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const login = useAuthStore((state) => state.login);
  const { t, language, setLanguage } = useLanguageStore();

  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
      const user = useAuthStore.getState().user;
      if (user?.role === "PARTNER") {
        router.replace("/partner");
      } else {
        router.replace((params.returnTo as any) || "/(tabs)");
      }
    } catch (error) {
      Alert.alert(t.auth.loginTitle, error instanceof Error ? error.message : t.common.error);
    }
  });

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <Screen title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setLanguage(language === "vi" ? "en" : "vi")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
              backgroundColor: colors.actionSoft,
              borderWidth: 1,
              borderColor: "#a7f3d0"
            }}
          >
            <Text style={{ fontSize: typography.small, fontWeight: "800", color: colors.action }}>
              🌐 {language.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <Card style={{ gap: 14 }}>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <FormInput
                label={t.auth.email}
                keyboardType="email-address"
                autoCapitalize="none"
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <PasswordInput
                label={t.auth.password}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
          <Button loading={formState.isSubmitting} onPress={onSubmit}>
            {t.auth.loginButton}
          </Button>

          <Button variant="ghost" onPress={() => router.push("/auth/register")}>
            {t.auth.noAccount} {t.auth.registerTitle}
          </Button>
        </Card>

        <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", marginTop: 16 }}>
          <Text style={{ color: "#166534", fontWeight: "700", fontSize: typography.small, textAlign: "center" }}>
            Đăng nhập cho cả Khách hàng (User) & Đối tác quản lý sân (Partner).
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
