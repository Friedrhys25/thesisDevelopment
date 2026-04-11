# PLAY STORE DEPLOYMENT GUIDE — talk2us

## READINESS REVIEW

### What You Already Have ✅
- [x] Android package name: `com.victoria.talk2us`
- [x] App icon configured (Bagong San Roque logo)
- [x] EAS Build configured with `production` profile (auto-increment enabled)
- [x] Firebase configured (google-services.json)
- [x] Expo project ID linked (`bd094578-9bf6-4fe9-8962-294847628923`)
- [x] Signing keystore managed by Expo (Build Credentials I9TprMrNBb)
- [x] eas.json production env vars configured (Firebase) — DONE April 12, 2026
- [x] Production AAB build started (versionCode 3) — DONE April 12, 2026
  - Build: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/703b6aac-e114-4186-9413-8e4474d3882d

### What You Still Need ❌ (all doable on 📱 Phone)
- [ ] **Google Play Developer Account** ($25 one-time fee) — https://play.google.com/console
- [ ] **Privacy Policy URL** (REQUIRED by Play Store) — hosted on a public website
- [ ] **Feature Graphic** (1024x500 PNG) — banner image for Play Store listing
- [ ] **Screenshots** (at least 2) — phone screenshots of your app
- [ ] **Short Description** (max 80 characters) — for Play Store listing
- [ ] **Full Description** (max 4000 characters) — for Play Store listing
- [ ] **App Category** — e.g., "Communication" or "Productivity"
- [ ] **Content Rating Questionnaire** — filled out in Play Console
- [ ] **Data Safety Form** — declare what data your app collects (camera, location, notifications, Firebase)

---

## WHERE TO DO EACH TASK

### 🖥️ VS Code Tasks — ALL COMPLETED ✅
| Task | Status |
|------|--------|
| ~~Update `eas.json` production env vars~~ | ✅ DONE |
| ~~Build production AAB~~ | ✅ DONE (building on cloud) |

### 📱 Remaining Tasks — ALL on Phone
| Task | Where |
|------|-------|
| Create Google Play Developer Account | https://play.google.com/console ($25 fee) |
| Create app listing in Play Console | Play Console → Create App |
| Upload feature graphic & screenshots | Play Console → Store Listing |
| Write short/full description | Play Console → Store Listing |
| Fill Content Rating questionnaire | Play Console → Content Rating |
| Fill Data Safety form | Play Console → Data Safety |
| Set App Access (provide test credentials) | Play Console → App Access |
| Select target audience & ads declaration | Play Console → Target Audience / Ads |
| Download AAB from expo.dev & upload to Play Console | Play Console → Production → Releases |
| Submit for Google review | Play Console → Publishing Overview |
| Create Privacy Policy webpage | Google Sites (free) |
| Create Feature Graphic image (1024x500) | Canva app (phone) |

---

## STEP-BY-STEP DEPLOYMENT PROCESS

### PHASE 1: Prepare Your Google Play Account

**Step 1: Create Google Play Developer Account**
1. Go to https://play.google.com/console
2. Sign in with a Google account
3. Pay the $25 one-time registration fee
4. Complete your developer profile (name, address, contact info)
5. Verify your identity (may take 24-48 hours)

---

### PHASE 2: Prepare App Assets

**Step 2: Create Privacy Policy**
1. Create a privacy policy page (Google requires this)
2. Must disclose: data collection (Firebase analytics, camera, location, notifications)
3. Host it on a public URL (options: GitHub Pages, Google Sites, or your backend)
4. Example URL: `https://yoursite.com/talk2us/privacy-policy`

**Step 3: Prepare Store Listing Graphics**
1. **App Icon**: Already done ✅ (512x512 PNG required — EAS generates this)
2. **Feature Graphic**: Create a 1024x500 PNG banner image
   - Should show app branding, name "talk2us", and Barangay San Roque theme
3. **Screenshots**: Take at least 2 screenshots from your app (phone size)
   - Recommended: 4-8 screenshots showing key features
   - Size: 1080x1920 or similar phone resolution
   - Show: home screen, complaint form, feedback, emergency, profile

---

### ~~PHASE 3: Build Production AAB~~ ✅ COMPLETED

> **Step 4: eas.json production profile** — ✅ DONE (April 12, 2026)
> **Step 5: Production AAB build** — ✅ DONE (versionCode 3, building on Expo cloud)
> Build link: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/703b6aac-e114-4186-9413-8e4474d3882d

---

### PHASE 4: Create App in Play Console

**Step 6: Create a New App in Google Play Console**
1. Go to https://play.google.com/console
2. Click **"Create app"**
3. Fill in:
   - App name: `talk2us`
   - Default language: English
   - App or Game: **App**
   - Free or Paid: **Free**
4. Accept the declarations and click **Create app**

**Step 7: Fill Out Store Listing**
1. Go to **Main store listing** in the left menu
2. Fill in:
   - **App name**: talk2us
   - **Short description**: AI-powered complaint & feedback system for Barangay San Roque
   - **Full description**: (Describe all features — complaints, feedback, emergency alerts, chatbot, etc.)
3. Upload:
   - **App icon**: 512x512 PNG (auto-generated from EAS build)
   - **Feature graphic**: 1024x500 PNG (create this)
   - **Phone screenshots**: At least 2 (recommended 4-8)
4. Click **Save**

**Step 8: Complete Content Rating**
1. Go to **Content rating** in the left menu
2. Click **Start questionnaire**
3. Answer questions about your app content:
   - Violence: No
   - Sexual content: No
   - Language: No profanity
   - User-generated content: Yes (complaints/feedback)
4. Submit and get your rating

**Step 9: Complete Data Safety Form**
1. Go to **Data safety** in the left menu
2. Declare what your app collects:
   - **Personal info**: Name, email (for login/registration)
   - **Location**: Yes (if emergency feature uses location)
   - **Photos/Videos**: Yes (camera permission for complaints)
   - **Device info**: Yes (Firebase analytics/notifications)
3. Specify: data is NOT sold, data is encrypted in transit
4. Link your **Privacy Policy URL**

**Step 10: Set Up App Access**
1. Go to **App access** in the left menu
2. Since your app requires login, select **"All or some functionality is restricted"**
3. Provide test credentials so Google reviewers can test:
   - Username/email and password for a test account
   - Instructions on how to log in

**Step 11: Select Target Audience**
1. Go to **Target audience** in the left menu
2. Select age group: **18+** (or appropriate for government service app)
3. Confirm the app is NOT directed at children

**Step 12: Ads Declaration**
1. Go to **Ads** in the left menu
2. Select: **No, my app does not contain ads**

---

### PHASE 5: Upload and Release

**Step 13: Upload AAB to Play Console**
1. Go to **Production** → **Releases** in the left menu
2. Click **"Create new release"**
3. For **App signing**: Let Google manage your signing key (recommended)
4. Upload the `.aab` file from your EAS build
   - Download the AAB from: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/
   - (Use the production build, not preview)
5. Add **Release notes**: "Initial release of talk2us — AI-powered complaint & feedback management for Barangay San Roque, Victoria, Laguna"

**Step 14: Review and Submit**
1. Go to **Publishing overview** in the left menu
2. Review all sections — make sure everything is green/complete
3. Click **"Send for review"**

---

### PHASE 6: After Submission

**Step 15: Wait for Google Review**
- First-time apps typically take **3-7 days** for review
- Google may request changes or additional info
- You'll receive email notifications about the review status

**Step 16: App Goes Live 🎉**
- Once approved, your app will be live on the Play Store
- Share the Play Store link with Barangay San Roque residents

---

## COMMANDS CHEAT SHEET

```bash
# Build production AAB for Play Store
eas build --platform android --profile production

# Submit to Play Store directly from CLI (after first manual setup)
eas submit --platform android --profile production

# Check build status
eas build:list

# Update app version in app.json before new releases
# (autoIncrement handles versionCode, but update "version" for display)
```

---

## IMPORTANT NOTES

1. **APK vs AAB**: Your `preview` profile builds APK (for testing). Play Store requires AAB. The `production` profile builds AAB by default.
2. **Environment Variables**: Make sure production env vars are set in `eas.json` or EAS dashboard.
3. **Signing Key**: Expo manages your upload key. Google manages the app signing key. This is handled automatically.
4. **Updates**: For future updates, increment `version` in `app.json`, build a new AAB, and create a new release in Play Console.
5. **Backend**: Ensure your backend (app.py on Render) is running and accessible before submitting to Play Store.
6. **Firebase**: Ensure Firebase project has production-ready security rules.

---

## ESTIMATED TIMELINE

| Task | Time |
|------|------|
| Google Play Developer Account setup | 1-2 days (identity verification) |
| Prepare store assets (screenshots, graphics, descriptions) | 1-2 hours |
| Build production AAB | 30-60 minutes |
| Fill out Play Console forms | 1-2 hours |
| Google review | 3-7 days |
| **Total** | **~1 week** |

---

## TODO: iOS APP STORE DEPLOYMENT (Requires Apple Developer Account)

> ⚠️ **Apple Developer Account NOT purchased yet ($99/year)**
> Complete these steps once you have the account and terminal access.

### 📱 Steps you can do on your PHONE (browser):
- [ ] Purchase Apple Developer Account ($99/year) — https://developer.apple.com/programs/
- [ ] Complete Apple Developer identity verification (may take 24-48 hours)
- [ ] Set up App Store Connect listing — https://appstoreconnect.apple.com
- [ ] Fill in app name, description, category, keywords
- [ ] Upload screenshots (need iPhone 6.7", 6.5", 5.5" sizes + iPad if supporting tablets)
- [ ] Upload app icon (1024x1024 PNG — no transparency, no rounded corners)
- [ ] Fill out App Privacy details (similar to Google Data Safety)
- [ ] Fill out Age Rating questionnaire
- [ ] Set pricing (Free)
- [ ] Write release notes

### 💻 Steps that REQUIRE a terminal (laptop/computer):
- [ ] Run `eas credentials` to configure Apple Developer credentials with EAS
- [ ] Run `eas build --platform ios --profile production` to build the IPA
- [ ] Run `eas submit --platform ios --profile production` to upload to App Store Connect
- [ ] (Alternative) Download IPA from expo.dev and upload via Transporter app on Mac

### 📝 iOS-specific notes:
- Apple review is stricter than Google — expect 1-3 day review, possible rejections
- Your app.json already has iOS config: bundleIdentifier `com.talk2us.barangaysanroque`
- GoogleService-Info.plist already present at `./app/GoogleService-Info.plist`
- eas.json production profile already has Firebase env vars (shared with Android)
- You do NOT need a Mac — EAS managed signing handles certificates in the cloud
- Apple requires login test credentials for reviewers (same as Google)

---

## LITERAL STEP-BY-STEP: WHAT TO DO NEXT (IN ORDER)

### ======= ANDROID (PLAY STORE) =======

> ✅ eas.json production env vars — DONE
> ✅ Production AAB build — STARTED (check expo.dev for completion)

**Step 1 (📱 Phone):** Go to https://play.google.com/console and create a Google Play Developer Account. Pay the $25 one-time fee. Complete your developer profile and identity verification. (May take 24-48 hours to verify.)

**Step 2 (📱 Phone):** While waiting for verification, prepare your store assets:
- Open Canva app on phone → create a **Feature Graphic** (1024x500 PNG) with "talk2us" branding and Barangay San Roque theme
- Take **screenshots** of your app (at least 2, recommended 4-8). Open the app on your phone and screenshot: home, complaint form, feedback, emergency, profile screens

**Step 3 (📱 Phone):** Create a **Privacy Policy** page. Go to https://sites.google.com and create a free page with your privacy policy. It must disclose: data collected (name, email, location, camera, Firebase analytics, push notifications), that data is not sold, and that data is encrypted in transit. Save the public URL — you'll need it later.

**Step 4 (📱 Phone):** Once your developer account is verified, go to Play Console → click **"Create app"**:
- App name: `talk2us`
- Default language: English
- App or Game: App
- Free or Paid: Free
- Accept declarations → Create app

**Step 5 (📱 Phone):** Go to **Main store listing** in the left menu and fill in:
- App name: `talk2us`
- Short description (max 80 chars): `AI-powered complaint & feedback system for Barangay San Roque`
- Full description (max 4000 chars): Describe all features — complaints, feedback, emergency alerts, chatbot, RBAC, etc.
- Upload your **app icon** (512x512 PNG — download from expo.dev build page)
- Upload your **Feature Graphic** (1024x500 PNG — from Canva)
- Upload your **screenshots** (at least 2 phone screenshots)
- Click Save

**Step 6 (📱 Phone):** Go to **Content rating** → Start questionnaire:
- Violence: No
- Sexual content: No
- Language: No profanity
- User-generated content: Yes (complaints/feedback)
- Submit and get your rating

**Step 7 (📱 Phone):** Go to **Data safety** and fill out:
- Personal info collected: Name, email (for login)
- Location: Yes (emergency feature)
- Photos/Videos: Yes (camera for complaints)
- Device info: Yes (Firebase analytics/notifications)
- Data is NOT sold
- Data is encrypted in transit
- Paste your **Privacy Policy URL** from Step 3

**Step 8 (📱 Phone):** Go to **App access**:
- Select "All or some functionality is restricted"
- Provide test login credentials so Google reviewers can test your app:
  - Email: (create a test account in your Firebase Auth)
  - Password: (the test account password)
  - Instructions: "Open app → tap Login → enter credentials"

**Step 9 (📱 Phone):** Go to **Target audience**:
- Select age group: 18+
- Confirm app is NOT directed at children

**Step 10 (📱 Phone):** Go to **Ads**:
- Select: "No, my app does not contain ads"

**Step 11 (📱 Phone):** Go to **Production** → **Releases** → **Create new release**:
- App signing: Let Google manage (recommended)
- Download your AAB from: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/ (use the production build, NOT preview)
- Upload the `.aab` file
- Release notes: `Initial release of talk2us — AI-powered complaint & feedback management for Barangay San Roque, Victoria, Laguna`

**Step 12 (📱 Phone):** Go to **Publishing overview**:
- Review all sections — make sure everything is green/complete
- Click **"Send for review"**
- Wait 3-7 days for Google's review. You'll get email notifications.

**Step 13 (📱 Phone):** 🎉 App goes live! Share the Play Store link with Barangay San Roque residents.

---

### ======= iOS (APP STORE) =======

**Step 1 (📱 Phone):** Go to https://developer.apple.com/programs/ and purchase an Apple Developer Account ($99/year). Complete identity verification (24-48 hours).

**Step 2 (📱 Phone):** Once verified, go to https://appstoreconnect.apple.com → create a new app:
- Platform: iOS
- App name: talk2us
- Bundle ID: `com.talk2us.barangaysanroque`
- SKU: `talk2us-v1`
- Language: English
- Click Create

**Step 3 (📱 Phone):** Fill out App Store listing:
- Description, keywords, category (Communication or Utilities)
- Upload screenshots (need multiple sizes: 6.7" iPhone, 6.5" iPhone, 5.5" iPhone)
- Upload app icon (1024x1024 PNG, no transparency, no rounded corners)
- Set pricing: Free
- Write "What's New" / release notes

**Step 4 (📱 Phone):** Fill out **App Privacy** section (similar to Google Data Safety — same info)

**Step 5 (📱 Phone):** Fill out **Age Rating** questionnaire

**Step 6 (📱 Phone):** Go to **App Review Information**:
- Provide test login credentials (same as Google)
- Add contact info for Apple reviewer

**Step 7 (💻 Laptop):** Open terminal in the talk2us-build project folder and run:
```
eas credentials
```
- Select iOS → Production
- Log in with your Apple Developer Account credentials
- Let EAS manage your certificates and provisioning profiles

**Step 8 (💻 Laptop):** Run the iOS production build:
```
eas build --platform ios --profile production
```
- This builds an IPA file on Expo's cloud servers (~30 min)

**Step 9 — Submit to App Store Connect:**

#### Option A: WITHOUT a Mac (Windows/Linux laptop)
```
eas submit --platform ios --profile production
```
- This uploads the IPA directly to App Store Connect from ANY computer
- EAS handles all the Apple signing and uploading — no Mac needed
- You'll be prompted to select which build to submit
- That's it! Skip to Step 10.

#### Option B: WITH a Mac
You have two options:

**Option B1 — Use EAS CLI (same as Option A, easiest):**
```
eas submit --platform ios --profile production
```

**Option B2 — Use Apple Transporter app (manual upload):**
1. Download your IPA from expo.dev: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/
2. Open the **Transporter** app on your Mac (free from Mac App Store)
3. Sign in with your Apple Developer Account
4. Drag and drop the IPA file into Transporter
5. Click **Deliver** to upload to App Store Connect
6. Wait for Apple to process (~15-30 min)

**Option B3 — Use Xcode (advanced, not recommended):**
1. Open Xcode → Window → Organizer
2. Or use `xcrun altool --upload-app --file your-app.ipa --type ios`
3. This is more complex — stick with Option B1 or B2

**Step 10 (📱 Phone):** Go back to App Store Connect → Select your build → Submit for review

**Step 11 (📱 Phone):** Wait 1-3 days for Apple's review. They may reject and ask for changes — check email.

**Step 12 (📱 Phone):** 🎉 App goes live on the App Store!

---

## NEW LAPTOP SETUP (For iOS build steps or future updates)

> If you switch to a different laptop/computer, here's the MINIMAL setup needed.
> You do NOT need full project dependencies — EAS builds in the cloud.

### What to install:
1. **Node.js** — Download from https://nodejs.org (LTS version)
2. **EAS CLI** — Run in terminal: `npm install -g eas-cli`
3. **Login to Expo** — Run: `eas login` (account: rhysjonathan)

### What you do NOT need:
- ❌ `npm install` (no local project dependencies needed)
- ❌ Python
- ❌ Android SDK / Android Studio
- ❌ Xcode (EAS handles iOS signing in the cloud)
- ❌ Java / Gradle
- ❌ CocoaPods

### Then just:
```bash
git clone <your-repo-url>
cd talk2us-build
# For iOS:
eas credentials            # Link Apple Developer Account
eas build --platform ios --profile production    # Build IPA
eas submit --platform ios --profile production   # Upload to App Store
# For Android updates:
eas build --platform android --profile production
```

**That's it — 3 installs (Node, EAS CLI, Expo login) and you're ready to build/submit from any computer.**
