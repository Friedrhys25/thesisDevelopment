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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0b1a3d" },
        // Smooth horizontal slide — works well on both Android and iOS
        animation: "slide_from_right",
        animationDuration: 280,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        // Prevent the white flash on Android during transitions
        animationTypeForReplace: "push",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          animation: "slide_from_left",
          animationDuration: 280,
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          animation: "slide_from_right",
          animationDuration: 280,
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="employee" />
    </Stack>
  );
}