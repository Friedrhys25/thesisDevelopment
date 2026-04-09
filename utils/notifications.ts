import * as Device from "expo-device";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { doc, setDoc } from "firebase/firestore";
import { auth, firestore } from "../backend/firebaseConfig";

// ============================================================
// Detect if running in Expo Go (notifications not supported)
// ============================================================
const isExpoGo = Constants.appOwnership === "expo";

// ============================================================
// Notification Channel Setup (Android)
// ============================================================
export async function setupNotificationChannel() {
  if (isExpoGo) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("complaint-updates", {
      name: "Complaint Updates",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "notification.wav",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F16F24",
    });
  }
}

// ============================================================
// Configure how notifications appear when app is in foreground
// ============================================================
export function configureNotificationHandler() {
  if (isExpoGo) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ============================================================
// Request permission & get Expo Push Token
// ============================================================
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo) {
    console.log("⚠️ Push notifications are not supported in Expo Go. Use a development build.");
    return null;
  }

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Ask for permission if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId ?? "bd094578-9bf6-4fe9-8962-294847628923",
    });
    return tokenData.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

// ============================================================
// Save push token to Firestore for the current user
// ============================================================
export async function savePushTokenToFirestore(
  collectionName: "users" | "employee"
) {
  const user = auth.currentUser;
  if (!user) return;

  const token = await registerForPushNotificationsAsync();
  if (!token) return;

  try {
    const userRef = doc(firestore, collectionName, user.uid);
    await setDoc(userRef, { expoPushToken: token }, { merge: true });
    console.log(`✅ Push token saved to ${collectionName}/${user.uid}`);
  } catch (error) {
    console.error("Error saving push token:", error);
  }
}

// ============================================================
// Trigger haptic feedback (vibration)
// ============================================================
export async function triggerHaptic() {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics not available on this device
  }
}

// ============================================================
// Show a local notification (for in-app use)
// ============================================================
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (isExpoGo) {
    // In Expo Go, just trigger haptic since notifications aren't supported
    console.log(`📢 [Notification] ${title}: ${body}`);
    await triggerHaptic();
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "notification.wav",
      data: data || {},
    },
    trigger: null, // Show immediately
  });

  // Also trigger haptic
  await triggerHaptic();
}
