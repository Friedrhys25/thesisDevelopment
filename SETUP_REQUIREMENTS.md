# Talk2Us — Setup Requirements

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v18+ (tested on v24.14.1) | JavaScript runtime |
| npm | v9+ (tested on 11.11.0) | Package manager |
| Python | 3.10+ (tested on 3.14.4) | Backend ML server |
| Expo CLI | Installed via `npx expo` | React Native tooling |
| Git | Latest | Version control |

---

## Credentials Needed

After cloning, you must create the following files manually. **These are not included in the repo for security.**

### 1. Root `.env.local`

Create `.env.local` in the project root:

```env
# Firebase (get from Firebase Console → Project Settings → General → Your App)
EXPO_PUBLIC_FIREBASE_API_KEY=<your-firebase-api-key>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://<your-project>-default-rtdb.firebaseio.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<your-project-id>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<your-project>.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
EXPO_PUBLIC_FIREBASE_APP_ID=<app-id>
```

> **Note:** The Groq API key is no longer needed in the frontend. All AI chat requests are proxied through the backend.

### 2. Backend `backend/.env`

Create `.env` inside the `backend/` folder:

```env
GROQ_API_KEY=<your-groq-api-key>
```

### 3. Android Firebase Config `app/google-services.json`

Download from Firebase Console → Project Settings → Your Apps → Android → `google-services.json`.
Place it at `app/google-services.json`.

---

## Where to Get Each Credential

| Credential | Source |
|------------|--------|
| Firebase API Key | [Firebase Console](https://console.firebase.google.com) → Project Settings → General |
| Firebase Auth Domain | Same as above |
| Firebase Database URL | Firebase Console → Realtime Database → URL |
| Firebase Project ID | Firebase Console → Project Settings |
| Firebase Storage Bucket | Firebase Console → Storage |
| Firebase Messaging Sender ID | Firebase Console → Cloud Messaging |
| Firebase App ID | Firebase Console → Project Settings → Your Apps |
| `google-services.json` | Firebase Console → Project Settings → Your Apps → Android → Download |
| Groq API Key (backend only) | [Groq Console](https://console.groq.com/keys) → Create API Key |

---

## Installation Steps

### Frontend (Expo / React Native)

```bash
# 1. Clone the repo
git clone <repo-url>
cd talk2us

# 2. Install dependencies
npm install

# 3. Create .env.local with credentials (see above)

# 4. Place google-services.json in app/ folder

# 5. Start the dev server
npx expo start
```

### Backend (Flask / ML)

```bash
# 1. Navigate to backend
cd backend

# 2. Create virtual environment (recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Create .env with GROQ_API_KEY (see above)

# 5. Train ML models (generates .pkl files)
python train.py

# 6. Start the Flask server
python app.py
# Server runs on http://0.0.0.0:5000
```

---

## Frontend Dependencies (package.json)

| Package | Version | Purpose |
|---------|---------|---------|
| expo | ~54.0.33 | Core framework |
| react | 19.1.0 | UI library |
| react-native | 0.81.5 | Mobile runtime |
| firebase | ^12.4.0 | Auth, Firestore, Storage |
| expo-router | ~6.0.23 | File-based routing |
| expo-image-picker | ~17.0.10 | Photo/camera upload |
| expo-haptics | ~15.0.8 | Haptic feedback |
| expo-linear-gradient | ~15.0.8 | Gradient backgrounds |
| expo-location | ~19.0.8 | GPS location |
| react-native-chart-kit | ^6.12.0 | Report charts |
| react-native-svg | 15.12.1 | SVG rendering (charts) |
| react-native-gesture-handler | ~2.28.0 | Touch gestures |
| react-native-reanimated | ~4.1.1 | Animations |
| react-native-screens | ~4.16.0 | Native screen transitions |
| react-native-safe-area-context | ~5.6.0 | Safe area insets |
| @react-native-picker/picker | 2.11.1 | Dropdown picker |
| @react-native-community/datetimepicker | 8.4.4 | Date picker |
| @react-native-google-signin/google-signin | ^16.0.0 | Google sign-in |
| @react-navigation/bottom-tabs | ^7.4.0 | Tab navigation |
| dotenv | ^17.2.3 | Environment variables |

## Backend Dependencies (requirements.txt)

| Package | Version | Purpose |
|---------|---------|---------|
| Flask | 3.1.2 | Web server |
| flask-cors | 6.0.1 | CORS support |
| scikit-learn | 1.8.0 | ML classification |
| nltk | 3.9.1 | NLP text processing |
| pandas | 2.3.3 | Data handling |
| numpy | 2.4.4 | Numerical computing |
| requests | 2.32.5 | HTTP client (Groq API) |
| python-dotenv | 1.2.1 | Environment variables |
| pydantic | 2.12.4 | Data validation |

### Backend API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/classify` | POST | ML-based complaint classification (label + type) |
| `/api/chat` | POST | FAQ chatbot proxy — forwards to Groq API server-side |

---

## Firebase Setup

The project uses these Firebase services:
- **Authentication** — Email/password sign-in
- **Cloud Firestore** — Database (collections: `users`, `employee`, `complaints`)
- **Realtime Database** — (configured but primary is Firestore)
- **Cloud Storage** — File uploads

### Firestore Security Rules

Ensure your Firestore rules restrict access to authenticated users only.

---

## Network Requirements

- Frontend and backend must be on the **same local network** (for development)
- Backend URL is set in frontend code — update the IP if your local IP changes
- Default backend port: **5000**
- Expo dev server port: **8081**
- Ensure firewall allows ports 5000 and 8081 on your network

---

## Known Security Notes

- `google-services.json` should NOT be committed to git — it's in `.gitignore`
- All API keys should stay in `.env` files, never hardcoded
- The Groq API key is used only server-side in `backend/.env` — it is **never exposed** to the client
- FAQ chat requests from the frontend are proxied through `backend/app.py` (`/api/chat` endpoint)
