import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Alert } from "react-native";
import { z } from "zod";
import { authApi } from "../../src/api/auth";
import { Button } from "../../src/components/Buttons";
import { FormInput } from "../../src/components/Forms";
import { Card, Screen } from "../../src/components/Screen";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Ma OTP gom 6 chu so")
});

type FormValues = z.infer<typeof schema>;

export default function VerifyRegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? "";
  const { control, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { code: "" } });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await authApi.verifyRegistrationCode({ email, code: values.code });
      Alert.alert("Dang ky thanh cong", "Hay dang nhap de bat dau dat san.");
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("Xac thuc that bai", error instanceof Error ? error.message : "Vui long thu lai");
    }
  });

  return (
    <Screen title="Nhap ma xac thuc" subtitle={`Ma OTP da duoc gui den ${email || "email cua ban"}.`} back>
      <Card>
        <Controller control={control} name="code" render={({ field, fieldState }) => (
          <FormInput label="Ma OTP" keyboardType="number-pad" maxLength={6} value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
        )} />
        <Button loading={formState.isSubmitting} onPress={onSubmit}>Xac thuc</Button>
        <Button variant="ghost" onPress={() => email && authApi.resendRegistrationCode(email)}>Gui lai ma</Button>
      </Card>
    </Screen>
  );
}

