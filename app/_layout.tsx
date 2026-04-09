import { Stack } from "expo-router";
import { useEffect } from "react";
import {
  configureNotificationHandler,
  setupNotificationChannel,
} from "../utils/notifications";

// Configure notification display behavior (must be called outside component)
configureNotificationHandler();

export default function RootLayout() {
  useEffect(() => {
    // Set up Android notification channel on app start
    setupNotificationChannel();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="employee" />
    </Stack>
  );
}
