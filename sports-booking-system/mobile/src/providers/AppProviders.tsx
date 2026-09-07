import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { PropsWithChildren, useEffect, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../store/auth";
import { colors } from "../theme/tokens";

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    // In local development, isConnected is sufficient (isInternetReachable can be false on local Wi-Fi without WAN)
    setOnline(Boolean(state.isConnected));
  });
});

export function AppProviders({ children }: PropsWithChildren) {
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error: any) => {
              if (failureCount >= 1) return false;
              const msg = String(error?.message ?? "");
              if (
                msg.includes("Timeout") ||
                msg.includes("thời gian chờ") ||
                msg.includes("401") ||
                msg.includes("403") ||
                msg.includes("404")
              ) {
                return false;
              }
              return true;
            },
            staleTime: 60 * 1000, // Keep data fresh for 1 minute before re-fetching
            gcTime: 10 * 60 * 1000, // Keep in memory for 10 minutes
            refetchOnWindowFocus: false, // Prevent lag when returning to app
            refetchOnMount: false,
            refetchOnReconnect: true
          },
          mutations: { retry: false }
        }
      }),
    []
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!bootstrapped) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
