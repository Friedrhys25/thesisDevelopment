# PLAY STORE DEPLOYMENT GUIDE — talk2us
> **Last Updated: April 14, 2026**

---

## OVERALL STATUS

| Milestone | Status |
|-----------|--------|
| Google Play Developer Account | ✅ DONE |
| Package ownership verified (`com.victoria.talk2us`) | ✅ DONE |
| Production AAB built (versionCode 4, RECORD_AUDIO removed) | ✅ BUILDING |
| Privacy Policy created (`privacy-policy.html`) | ✅ DONE (needs hosting) |
| Content Rating questionnaire | ✅ DONE |
| Data Safety form | ✅ DONE |
| Store listing text (short + full description) | ✅ DONE |
| Target audience (18+) | ✅ DONE |
| Ads declaration (no ads) | ✅ DONE |
| Advertising ID declaration (no) | ✅ DONE |
| Store listing graphics (icon, feature graphic, screenshots) | ❌ PENDING |
| Privacy Policy hosted on public URL | ❌ PENDING |
| Test reviewer account created in Firebase | ❌ PENDING |
| App Access (test credentials for Google reviewers) | ❌ PENDING |
| Account deletion URL (Google Form) | ❌ PENDING |
| Upload AAB to closed testing | ❌ PENDING |
| Add 12+ testers for closed test | ❌ PENDING |
| Apply for Production access (after 14 days) | ❌ PENDING |

---

## BUILDS

| Build | Type | versionCode | Status | Link |
|-------|------|-------------|--------|------|
| Production AAB (old) | AAB | 3 | ✅ Done | https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/703b6aac-e114-4186-9413-8e4474d3882d |
| Ownership verification APK | APK | — | ✅ Done | https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/6e3556de-c392-45e7-8479-5822f1d46f9d |
| **Production AAB (LATEST — USE THIS)** | **AAB** | **4** | **✅ Building** | **https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/480ce3c1-7127-42b6-bbb8-94a10a033347** |

> ⚠️ **USE versionCode 4 AAB** — it has the unused RECORD_AUDIO permission removed. Do NOT upload versionCode 3.

---

## REMAINING STEPS (ALL ON PHONE)

### STEP 1: Host Privacy Policy ❌
1. Go to https://sites.google.com on your phone
2. Create a new site: "talk2us Privacy Policy"
3. Copy ALL text from `privacy-policy.html` (in this project folder)
4. Publish → copy the public URL
5. Paste URL in Play Console → App content → Privacy policy

### STEP 2: Create Account Deletion Google Form ❌
1. Go to https://forms.google.com
2. Create form: "talk2us - Account Deletion Request"
3. Add fields: Email (required), Full Name (required), Reason (optional)
4. Add description: "Submit this form to request deletion of your talk2us account and associated data. Your account and all personal data will be permanently deleted within 30 days."
5. Publish → copy the form URL
6. Paste in Play Console → Data Safety → Delete account URL AND Delete data URL

### STEP 3: Create Test Reviewer Account ❌
**CRITICAL — Without this, Google WILL reject your app!**
1. Open your talk2us app on your phone
2. Register a new account:
   - Email: `reviewer.talk2us@gmail.com`
   - Password: `Review2026!Safe`
   - Name: Google Reviewer
   - Phone: 09123456789
   - Purok: 1
   - Residency: Resident
3. Go to Play Console → App content → App access
4. Select "All or some functionality is restricted"
5. Add instructions:
   ```
   Email: reviewer.talk2us@gmail.com
   Password: Review2026!Safe
   
   Instructions:
   1. Enter the email and password above to log in
   2. Main features: Complaints tab, Emergency tab, FAQs tab, Profile tab
   3. To test complaints: Complaints tab → "+" button → write description → submit
   4. App requires internet connection
   5. Government service app for Barangay San Roque, Victoria, Laguna, Philippines
   ```

### STEP 4: Create Store Graphics ❌

**App Icon (512x512 PNG):**
- Download from your EAS build page, or resize your barangay logo in Canva

**Feature Graphic (1024x500 PNG):**
- Open Canva → Custom size → 1024 x 500
- Background: Dark blue `#0b1a3d`
- Add "Talk2Us" in large white text
- Tagline: "Your Voice, Our Action" or "AI-Powered Barangay Service"
- Add barangay logo
- Download as PNG → Upload to Play Console

**Phone Screenshots (minimum 2, recommended 4-8):**
Take screenshots of these screens:
1. Home screen (welcome + barangay officials)
2. Complaint submission form
3. Emergency hotlines screen
4. FAQ/AI Chatbot screen
5. Complaint list with status badges
6. Profile screen

**Tip:** Go to Store Settings → set app to **Phone only** so you don't need tablet screenshots.

### STEP 5: Download & Upload Production AAB ❌
1. Open on phone: https://expo.dev/accounts/rhysjonathan/projects/talk2us/builds/480ce3c1-7127-42b6-bbb8-94a10a033347
2. Log in to Expo account (rhysjonathanabalon@gmail.com)
3. Download the `.aab` file once build is finished
4. In Play Console → Testing → **Closed testing** → Create track
5. Create a new release → Upload the AAB
6. Add release notes:
   ```
   Initial release of talk2us — the official AI-powered complaint and feedback management system for Barangay San Roque, Victoria, Laguna, Philippines.
   
   Features:
   • Smart complaint filing with AI classification
   • Real-time chat with assigned barangay staff
   • Emergency hotline directory
   • AI-powered FAQ chatbot (Filipino & English)
   • Service quality feedback system
   • Staff dashboard with analytics
   ```

### STEP 6: Add Testers for Closed Testing ❌
**Google requires closed testing before production for new accounts!**
1. In Play Console → Testing → Closed testing
2. Create a testers list → Add at least **12 email addresses**
   - Can be classmates, friends, barangay staff
   - They'll get an invite link to install the app
3. Roll out the release to testers
4. Wait **14 days** of active testing

### STEP 7: Apply for Production Access ❌
After 14 days of closed testing:
1. Go to Production → Create release
2. Upload the same AAB (or a new one if you made changes)
3. Go to Publishing Overview → verify all sections are green
4. Click "Send for review"
5. Wait 3-7 days for Google review

---

## CONTENT RATING ANSWERS (Already Submitted ✅)

| Question | Answer |
|----------|--------|
| Ratings-relevant content in APK? | No |
| Users interact/exchange content? | Yes |
| User-generated content is primary? | No |
| Public sharing of nudity? | No |
| Public sharing of graphic violence? | No |
| Ability to block users? | No |
| Ability to report users? | No |
| Chat moderation? | Yes (AI classification) |
| Interactions limited to invited friends? | No |
| Share precise location with others? | No |
| Purchase digital goods? | No |
| Cash rewards/NFTs? | No |
| Web browser or search engine? | No |
| News or educational product? | No |
| Target age: 18+ | Yes |
| Restrict minors | Yes |

## DATA SAFETY ANSWERS (Already Submitted ✅)

| Setting | Answer |
|---------|--------|
| Collects user data? | Yes |
| Data encrypted in transit? | Yes |
| Account creation method | Username and password |
| Advertising ID? | No |
| Government app? | No (selected to avoid proof requirement delays) |

**Data types collected (all = Collected, NOT shared, NOT ephemeral, Required, App functionality + Account management):**
- Name
- Email address
- User IDs
- Address

**Delete account URL:** Google Form (create per Step 2 above)
**Delete data URL:** Same Google Form

---

## CODE CHANGES MADE (April 14, 2026)

1. **Removed `RECORD_AUDIO` permission** from `app.json` — was unused, would cause rejection
2. **Created `assets/adi-registration.properties`** — Google Play ownership verification snippet
3. **Created `plugins/withAdiRegistration.js`** — Config plugin to inject verification file into Android assets
4. **Added plugin to `app.json`** — `"./plugins/withAdiRegistration"`
5. **Created `privacy-policy.html`** — Complete privacy policy for hosting

---

## IMPORTANT NOTES

1. **USE versionCode 4 AAB** — Has RECORD_AUDIO fix. Do NOT use versionCode 3.
2. **Closed testing is REQUIRED** for new developer accounts before production access.
3. **Test reviewer account is CRITICAL** — Create it before submitting or Google will reject.
4. **Backend must be running** — Ensure `app.py` on Render is active when Google reviews.
5. **Firebase security rules** — Ensure production-ready rules are set.
6. **Privacy Policy must be public** — Host on Google Sites before filling App content section.

---

## COMMANDS CHEAT SHEET (For future laptop access)

```bash
# Build production AAB
npx eas-cli build --platform android --profile production

# Build preview APK (for testing)
npx eas-cli build --platform android --profile preview

# Check build status
npx eas-cli build:list

# Login to Expo
npx eas-cli login

# View credentials
npx eas-cli credentials --platform android
```

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
