import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProviders } from "../src/providers/AppProviders";
import { NetworkBanner } from "../src/components/NetworkBanner";
import { colors } from "../src/theme/tokens";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <AppProviders>
        <StatusBar style="dark" />
        <NetworkBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas }
          }}
        />
      </AppProviders>
    </GestureHandlerRootView>
  );
}

