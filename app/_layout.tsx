import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import AnimatedSplashScreen from "../components/AnimatedSplashScreen";
import {
    configureNotificationHandler,
    setupNotificationChannel,
} from "../utils/notifications";

// Configure notification display behavior (must be called outside component)
configureNotificationHandler();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Set up Android notification channel on app start
    setupNotificationChannel();
  }, []);

  if (!splashDone) {
    return <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0b1a3d" } }}>
      <Stack.Screen name="index" options={{ animation: "none" }} />
      <Stack.Screen name="register" options={{ animation: "none" }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="employee" />
    </Stack>
  );
}
