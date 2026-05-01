import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { auth, firestore } from "../backend/firebaseConfig";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── Design Tokens ──────────────────────────────────────────────────────────
const C = {
  bg: "#06112b",
  bgMid: "#0a1a3a",
  surface: "#0e2147",
  surfaceUp: "#122554",
  glass: "rgba(14,33,71,0.85)",
  border: "rgba(255,255,255,0.07)",
  borderGold: "rgba(245,158,11,0.35)",
  gold: "#f59e0b",
  goldLight: "#fcd34d",
  goldDim: "rgba(245,158,11,0.12)",
  text: "#EEF2FF",
  textSub: "#94A3C0",
  textDim: "#3D5280",
  white: "#FFFFFF",
  error: "#F43F5E",
  success: "#10B981",
};

// ─── Geometric Background ────────────────────────────────────────────────────
function HeroBg() {
  return (
    <Svg
      width={SCREEN_W}
      height={320}
      style={StyleSheet.absoluteFillObject}
      viewBox={`0 0 ${SCREEN_W} 320`}
    >
      <Defs>
        <RadialGradient id="rg1" cx="50%" cy="0%" r="70%">
          <Stop offset="0%" stopColor="#1e3a7a" stopOpacity="0.6" />
          <Stop offset="100%" stopColor="#06112b" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rg2" cx="100%" cy="100%" r="60%">
          <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.07" />
          <Stop offset="100%" stopColor="#06112b" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={SCREEN_W} height={320} fill="#06112b" />
      <Rect x="0" y="0" width={SCREEN_W} height={320} fill="url(#rg1)" />
      <Rect x="0" y="0" width={SCREEN_W} height={320} fill="url(#rg2)" />

      {/* Grid lines */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Line
          key={`h${i}`}
          x1="0" y1={i * 60} x2={SCREEN_W} y2={i * 60}
          stroke="rgba(255,255,255,0.03)" strokeWidth="1"
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Line
          key={`v${i}`}
          x1={i * (SCREEN_W / 7)} y1="0" x2={i * (SCREEN_W / 7)} y2={320}
          stroke="rgba(255,255,255,0.03)" strokeWidth="1"
        />
      ))}

      {/* Accent circles */}
      <Circle cx={SCREEN_W * 0.85} cy={40} r={90} fill="none" stroke="rgba(245,158,11,0.06)" strokeWidth="1" />
      <Circle cx={SCREEN_W * 0.85} cy={40} r={55} fill="none" stroke="rgba(245,158,11,0.08)" strokeWidth="1" />
      <Circle cx={SCREEN_W * 0.85} cy={40} r={25} fill="rgba(245,158,11,0.05)" />

      <Circle cx={20} cy={260} r={70} fill="none" stroke="rgba(99,179,237,0.05)" strokeWidth="1" />
      <Circle cx={20} cy={260} r={40} fill="none" stroke="rgba(99,179,237,0.07)" strokeWidth="1" />
    </Svg>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────
type InputFieldProps = {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  autoCorrect?: boolean;
  editable?: boolean;
  rightElement?: React.ReactNode;
};

function InputField({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  autoCorrect = false,
  editable = true,
  rightElement,
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.border, C.borderGold],
  });
  const bgColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.surfaceUp, "#152a5e"],
  });

  return (
    <Animated.View style={[styles.inputShell, { borderColor, backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={18} color={focused ? C.gold : C.textDim} style={styles.inputLeadIcon} />
      <TextInput
        style={styles.inputText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabledModalVisible, setDisabledModalVisible] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.timing(slideUpAnim, { toValue: 0, duration: 500, delay: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !loading) {
        const employeeDoc = await getDoc(doc(firestore, "employee", user.uid));
        if (employeeDoc.exists()) {
          router.replace("/employee/dashboard");
        } else {
          const userDoc = await getDoc(doc(firestore, "users", user.uid));
          if (userDoc.exists()) {
            if (!user.emailVerified) {
              await signOut(auth);
              Alert.alert("Email Not Verified", "Your email address has not been verified yet. Please check your inbox for the verification link.");
              setCheckingAuth(false);
              return;
            }
            const userData = userDoc.data();
            if (userData.disabled === true) {
              await signOut(auth);
              setDisabledModalVisible(true);
              setCheckingAuth(false);
              return;
            }
            router.replace("/(tabs)/home");
          } else {
            setCheckingAuth(false);
          }
        }
      } else {
        setCheckingAuth(false);
      }
    });
    return unsubscribe;
  }, [loading]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const employeeDoc = await getDoc(doc(firestore, "employee", userCredential.user.uid));
      if (employeeDoc.exists()) {
        router.replace("/employee/dashboard");
      } else {
        const userDoc = await getDoc(doc(firestore, "users", userCredential.user.uid));
        if (userDoc.exists()) {
          if (!userCredential.user.emailVerified) {
            await signOut(auth);
            Alert.alert("Email Not Verified", "Your email address has not been verified yet. Please check your inbox for the verification link.");
            return;
          }
          const userData = userDoc.data();
          if (userData.disabled === true) {
            await signOut(auth);
            setDisabledModalVisible(true);
            return;
          }
          router.replace("/(tabs)/home");
        } else {
          router.replace("/(tabs)/home");
        }
      }
    } catch (error: any) {
      let errorTitle = "Login Failed";
      let errorMessage = "Something went wrong. Please try again.";
      switch (error.code) {
        case "auth/user-not-found": errorTitle = "Account Not Found"; errorMessage = "No account exists with this email address."; break;
        case "auth/wrong-password": errorTitle = "Incorrect Password"; errorMessage = "The password you entered is incorrect."; break;
        case "auth/invalid-email": errorTitle = "Invalid Email"; errorMessage = "The email address is not valid."; break;
        case "auth/user-disabled": errorTitle = "Account Disabled"; errorMessage = "This account has been disabled. Please contact support."; break;
        case "auth/too-many-requests": errorTitle = "Too Many Attempts"; errorMessage = "Too many failed login attempts. Please try again later."; break;
        case "auth/network-request-failed": errorTitle = "Network Error"; errorMessage = "Unable to connect. Please check your internet connection."; break;
        case "auth/invalid-credential": errorTitle = "Invalid Credentials"; errorMessage = "The email or password is incorrect."; break;
        case "auth/operation-not-allowed": errorTitle = "Login Unavailable"; errorMessage = "Email/password login is currently disabled."; break;
        default: errorMessage = error.message || "An unexpected error occurred.";
      }
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { Alert.alert("Enter Email", "Please enter your email first."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { Alert.alert("Invalid Email", "Please enter a valid email."); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert("Reset Link Sent", `A password reset link has been sent to ${email}.`);
    } catch (error: any) {
      Alert.alert("Reset Failed", error.message);
    }
  };

  if (checkingAuth) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadingText}>Talk2Kap</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
            <HeroBg />

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideUpAnim }], alignItems: "center" }}>
              {/* Logo badge */}
              <View style={styles.logoBadge}>
                <Image
                  source={require("../assets/images/sanroquelogoo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.appName}>Talk2Kap</Text>
              <Text style={styles.heroTitle}>Welcome{"\n"}Back</Text>
              <Text style={styles.heroSub}>Sign in to your barangay account</Text>
            </Animated.View>

            {/* Tab Pill */}
            <Animated.View style={[styles.tabPillWrapper, { opacity: fadeAnim }]}>
              <View style={styles.tabPill}>
                {/* Active highlight */}
                <View style={[styles.tabPillActive, { left: 4 }]} />

                <TouchableOpacity style={styles.tabPillBtn} activeOpacity={1}>
                  <Text style={[styles.tabPillText, styles.tabPillTextActive]}>Log In</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabPillBtn}
                  onPress={() => router.push("/register")}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabPillText, styles.tabPillTextInactive]}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>

          {/* Form Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>

            {/* Decorative top bar */}
            <View style={styles.cardAccent} />

            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSub}>Enter your credentials to continue</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <InputField
                icon="mail-outline"
                placeholder="yourname@gmail.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <InputField
                icon="lock-closed-outline"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                rightElement={
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showPassword ? "eye-outline" : "eye-off-outline"}
                      size={18}
                      color={C.textSub}
                    />
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Forgot */}
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.primaryBtnInner}>
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                  <View style={styles.primaryBtnArrow}>
                    <Ionicons name="arrow-forward" size={16} color={C.gold} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/register")}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Create a new account</Text>
            </TouchableOpacity>

            {/* Footer note */}
            <Text style={styles.footerNote}>
              Barangay San Roque · Secure Community Portal
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Disabled Account Modal */}
      <Modal
        visible={disabledModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDisabledModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={32} color="#F97316" />
            </View>
            <Text style={styles.modalTitle}>Account Disabled</Text>
            <Text style={styles.modalBody}>
              Your account has been suspended. For more information, please contact support at{" "}
              <Text style={{ color: C.gold }}>test@gmail.com</Text>
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setDisabledModalVisible(false)}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, backgroundColor: C.bg },

  loadingScreen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 22,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: 3,
    textTransform: "uppercase",
  },

  // Hero
  hero: {
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingBottom: 0,
    alignItems: "center",
    overflow: "hidden",
    minHeight: 340,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logo: { width: 48, height: 48 },
  appName: {
    fontSize: 11,
    fontWeight: "800",
    color: C.gold,
    letterSpacing: 5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: "800",
    color: C.white,
    textAlign: "center",
    lineHeight: 50,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: C.textSub,
    fontWeight: "500",
    marginBottom: 32,
  },

  // Tab Pill
  tabPillWrapper: { width: "100%", alignItems: "center", marginBottom: -1 },
  tabPill: {
    flexDirection: "row",
    backgroundColor: C.surface,
    borderRadius: 50,
    padding: 4,
    borderWidth: 1,
    borderColor: C.border,
    position: "relative",
    width: 220,
  },
  tabPillActive: {
    position: "absolute",
    top: 4,
    width: "50%",
    height: "100%",
    backgroundColor: C.gold,
    borderRadius: 50,
  },
  tabPillBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    zIndex: 1,
  },
  tabPillText: { fontSize: 13, fontWeight: "800" },
  tabPillTextActive: { color: C.bg },
  tabPillTextInactive: { color: C.textSub },

  // Card
  card: {
    margin: 16,
    marginTop: 24,
    backgroundColor: C.surface,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    overflow: "hidden",
  },
  cardAccent: {
    height: 3,
    backgroundColor: C.gold,
    borderRadius: 2,
    marginBottom: 24,
    width: 48,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 14,
    color: C.textSub,
    fontWeight: "500",
    marginBottom: 28,
  },

  // Input
  fieldGroup: { marginBottom: 18 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.textSub,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 54,
  },
  inputLeadIcon: { marginRight: 10 },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 0,
  },
  eyeBtn: { padding: 4 },

  // Forgot
  forgotRow: { alignSelf: "flex-end", marginBottom: 24, marginTop: -4 },
  forgotText: { fontSize: 13, color: C.gold, fontWeight: "700" },

  // Primary button
  primaryBtn: {
    backgroundColor: C.gold,
    borderRadius: 16,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.6, shadowOpacity: 0.1 },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: C.bg,
    letterSpacing: 0.3,
  },
  primaryBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(6,17,43,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 12, color: C.textDim, fontWeight: "600" },

  // Secondary button
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: C.borderGold,
    borderRadius: 16,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.goldDim,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.gold,
  },

  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: C.textDim,
    marginTop: 24,
    letterSpacing: 0.3,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    color: C.textSub,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: C.bg,
  },
});