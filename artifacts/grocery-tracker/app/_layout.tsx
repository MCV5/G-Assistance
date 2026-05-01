import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PantryProvider } from "@/contexts/PantryContext";
import { getApiBaseUrl } from "@/lib/apiBase";
import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

const _apiBase = getApiBaseUrl();
if (_apiBase) {
  setBaseUrl(_apiBase);
}

setAuthTokenGetter(async () => {
  try {
    return await SecureStore.getItemAsync("auth_session_token");
  } catch {
    return null;
  }
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen
        name="scan-review"
        options={{
          presentation: "modal",
          title: "Review Items",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="barcode-scan"
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="activity"
        options={{
          title: "Shopping activity",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: true,
        }}
      />
    </Stack>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("@grocery_onboarded")
      .then((val) => setOnboarded(val === "true"))
      .catch(() => setOnboarded(false));
  }, []);

  useEffect(() => {
    if (isLoading || onboarded === null) return;
    const first = segments[0];
    const onPublicRoute =
      first === "login" ||
      first === "forgot-password" ||
      first === "onboarding";

    if (!isAuthenticated && !onPublicRoute) {
      router.replace(onboarded ? "/login" : "/onboarding");
    } else if (isAuthenticated && onPublicRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, segments, router, onboarded]);

  if (isLoading || onboarded === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F2EFE6",
        }}
      >
        <ActivityIndicator color="#2D4A1E" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <AuthGate>
                  <PantryProvider>
                    <RootLayoutNav />
                  </PantryProvider>
                </AuthGate>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
