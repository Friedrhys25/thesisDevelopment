# Migration Guide: Expo Go → Development Build

## Overview

This document outlines all changes needed when switching from **Expo Go** to a **Development Build (EAS)** for the Talk2Us app. Items are categorized by critical level.

---

## 🔴 CRITICAL — Will Break / Must Fix Before Building

### 1. Configure `eas.json` (DONE ✅)

- `eas.json` is now properly configured with build profiles.
- EAS project ID `bd094578-9bf6-4fe9-8962-294847628923` is set in `app.json`.

---

### 2. Hardcoded Backend URL in `FAQS.tsx`

- **File:** `app/(tabs)/FAQS.tsx`
- **Problem:** `const BACKEND_URL = "http://192.168.68.126:5000"` is a local network IP.
- **Fix:** Move to an environment variable:
  ```typescript
  const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.68.126:5000";
  ```
- Add `EXPO_PUBLIC_BACKEND_URL` to your `.env.local` with the actual deployed backend URL.

---

### 3. Firebase Service Account Key (for Push Notifications)

- **File needed:** `backend/serviceAccountKey.json`
- **How to get it:**
  1. Go to [Firebase Console](https://console.firebase.google.com)
  2. Select your project → ⚙️ Project Settings → Service Accounts tab
  3. Click "Generate New Private Key"
  4. Rename to `serviceAccountKey.json`
  5. Place in: `talk2us/backend/serviceAccountKey.json`
- **IMPORTANT:** Add `serviceAccountKey.json` to `.gitignore`.

---

### 4. Missing iOS Firebase Config (If Building for iOS)

- Only `google-services.json` (Android) exists.
- **Missing:** `GoogleService-Info.plist` for iOS.
- **How to get it:** Firebase Console → Project Settings → Your Apps → iOS app → Download config
- Place in `talk2us/app/` and add to `app.json`:
  ```json
  "ios": {
    "supportsTablet": true,
    "googleServicesFile": "./app/GoogleService-Info.plist"
  }
  ```

---

## 🟠 HIGH — May Cause Issues / Should Fix

### 5. `expo-camera` Not Installed

- The `takePhoto()` function in `complain.tsx` uses the camera.
- **Fix:** `npx expo install expo-camera`

---

### 6. Firebase Auth — AsyncStorage Persistence

- Firebase Auth defaults to memory persistence — users must log in every app restart.
- **Fix:**
  ```bash
  npx expo install @react-native-async-storage/async-storage
  ```
  Then update `firebaseConfig.ts`:
  ```typescript
  import { initializeAuth, getReactNativePersistence } from "firebase/auth";
  import AsyncStorage from "@react-native-async-storage/async-storage";

  export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  ```

---

### 7. New Architecture Compatibility

- `app.json` has `"newArchEnabled": true`
- If build crashes, set to `false`.

---

## 🟡 MEDIUM — Should Fix for Production

### 8. Production Environment Variables

- `.env.local` vars won't be in release builds automatically.
- Use EAS Secrets or `eas.json` env config.

---

### 9. Google Sign-In SHA-1 Fingerprint

- After first EAS build, get SHA-1 via `eas credentials`
- Add to Firebase Console → Android → Add Fingerprint
- Re-download `google-services.json`

---

## 🟢 LOW — No Changes Needed

| Item | Status |
|------|--------|
| All Expo SDK packages | ✅ Work seamlessly |
| Firebase client SDK | ✅ No changes |
| React Navigation / Expo Router | ✅ No changes |
| Notification code (`utils/notifications.ts`) | ✅ Auto-enables in dev build |
| Components, hooks, constants | ✅ No changes |

---

## Quick Start Commands

```bash
# Install EAS CLI (if not already)
npm install -g eas-cli

# Login
eas login

# Build development version for Android
eas build --profile development --platform android

# Build for both platforms
eas build --profile development --platform all
```
