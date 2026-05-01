import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
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
import Svg, { Circle, Line, Defs, RadialGradient, Stop, Rect, Path } from "react-native-svg";
import { auth, firestore } from "../backend/firebaseConfig";

const { width: SCREEN_W } = Dimensions.get("window");

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
const capitalizeWords = (str: string) =>
  str.trim().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

const ALLOWED_DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "live.com", "mail.com", "protonmail.com", "ymail.com",
];

const isAllowedEmailDomain = (email: string) => {
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 && ALLOWED_DOMAINS.includes(parts[1]);
};

const isPasswordStrong = (pw: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(pw);

const getPasswordStrength = (pw: string) => {
  if (!pw) return { label: "", color: "transparent", pct: 0 };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "#EF4444", pct: 20 };
  if (score <= 2) return { label: "Fair", color: "#F97316", pct: 40 };
  if (score <= 3) return { label: "Good", color: "#F59E0B", pct: 60 };
  if (score <= 4) return { label: "Strong", color: "#10B981", pct: 80 };
  return { label: "Very Strong", color: "#10B981", pct: 100 };
};

const calculateAge = (birthdate: string) => {
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const getMax18Date = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
};

const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

const SUFFIX_OPTIONS = [
  { label: "None", value: "" },
  { label: "Jr.", value: "Jr." },
  { label: "Sr.", value: "Sr." },
  { label: "II", value: "II" },
  { label: "III", value: "III" },
  { label: "IV", value: "IV" },
  { label: "V", value: "V" },
];

const PUROK_OPTIONS = [
  { label: "Purok 1", value: "1" },
  { label: "Purok 2", value: "2" },
  { label: "Purok 3", value: "3" },
  { label: "Purok 4", value: "4" },
  { label: "Purok 5", value: "5" },
  { label: "Purok 6", value: "6" },
];

const STEP_META = [
  { icon: "person-outline" as const, label: "Personal" },
  { icon: "home-outline" as const, label: "Address" },
  { icon: "shield-outline" as const, label: "Account" },
  { icon: "checkmark-circle-outline" as const, label: "Review" },
];

// ─── Geometric Background ────────────────────────────────────────────────────
function HeroBg() {
  return (
    <Svg width={SCREEN_W} height={260} style={StyleSheet.absoluteFillObject} viewBox={`0 0 ${SCREEN_W} 260`}>
      <Defs>
        <RadialGradient id="rg1" cx="30%" cy="0%" r="70%">
          <Stop offset="0%" stopColor="#1e3a7a" stopOpacity="0.5" />
          <Stop offset="100%" stopColor="#06112b" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="rg2" cx="0%" cy="100%" r="50%">
          <Stop offset="0%" stopColor="#f59e0b" stopOpacity="0.06" />
          <Stop offset="100%" stopColor="#06112b" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={SCREEN_W} height={260} fill="#06112b" />
      <Rect x="0" y="0" width={SCREEN_W} height={260} fill="url(#rg1)" />
      <Rect x="0" y="0" width={SCREEN_W} height={260} fill="url(#rg2)" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Line key={`h${i}`} x1="0" y1={i * 65} x2={SCREEN_W} y2={i * 65} stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <Line key={`v${i}`} x1={i * (SCREEN_W / 6)} y1="0" x2={i * (SCREEN_W / 6)} y2={260} stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
      ))}
      <Circle cx={SCREEN_W * 0.88} cy={30} r={85} fill="none" stroke="rgba(245,158,11,0.07)" strokeWidth="1" />
      <Circle cx={SCREEN_W * 0.88} cy={30} r={50} fill="none" stroke="rgba(245,158,11,0.09)" strokeWidth="1" />
      <Circle cx={-10} cy={220} r={60} fill="none" stroke="rgba(99,179,237,0.06)" strokeWidth="1" />
    </Svg>
  );
}

// ─── Input Field ─────────────────────────────────────────────────────────────
type InputFieldProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText?: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  isDisplay?: boolean;
  displayText?: string;
};

function InputField({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize = "none", editable = true, maxLength, rightElement, onPress, isDisplay, displayText }: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => { setFocused(true); Animated.timing(focusAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start(); };
  const onBlur = () => { setFocused(false); Animated.timing(focusAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(); };

  const borderColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [C.border, C.borderGold] });
  const bgColor = focusAnim.interpolate({ inputRange: [0, 1], outputRange: [C.surfaceUp, "#152a5e"] });

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Animated.View style={[styles.inputShell, { borderColor: focused ? C.borderGold : C.border, backgroundColor: C.surfaceUp }]}>
          {icon && <Ionicons name={icon} size={17} color={C.textDim} style={styles.inputLeadIcon} />}
          <Text style={[styles.inputText, !displayText && { color: C.textDim }]}>
            {displayText || placeholder}
          </Text>
          {rightElement}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={[styles.inputShell, { borderColor, backgroundColor: bgColor }]}>
      {icon && <Ionicons name={icon} size={17} color={focused ? C.gold : C.textDim} style={styles.inputLeadIcon} />}
      <TextInput
        style={styles.inputText}
        placeholder={placeholder}
        placeholderTextColor={C.textDim}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        editable={editable}
        maxLength={maxLength}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {rightElement}
    </Animated.View>
  );
}

// ─── Select Field ─────────────────────────────────────────────────────────────
function SelectField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.selectShell} onPress={onPress} activeOpacity={0.8}>
      <Text style={value ? styles.selectValue : styles.selectPlaceholder}>{value || label}</Text>
      <Ionicons name="chevron-down" size={16} color={C.gold} />
    </TouchableOpacity>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <View style={styles.stepBar}>
      {STEP_META.map((step, i) => {
        const done = i < current - 1;
        const active = i === current - 1;
        return (
          <React.Fragment key={i}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={C.bg} />
                  : <Ionicons name={step.icon} size={12} color={active ? C.bg : C.textDim} />
                }
              </View>
              <Text style={[styles.stepLabel, (done || active) && styles.stepLabelActive]}>{step.label}</Text>
            </View>
            {i < 3 && (
              <View style={[styles.stepLine, (done) && styles.stepLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Review Row ───────────────────────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [houseStreet, setHouseStreet] = useState("");
  const [subdivision, setSubdivision] = useState("");
  const [purok, setPurok] = useState("1");
  const [number, setNumber] = useState("");
  const [residencyStatus, setResidencyStatus] = useState<"resident" | "renter">("resident");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [accountCreatedModalVisible, setAccountCreatedModalVisible] = useState(false);
  const [selectionModal, setSelectionModal] = useState<null | "suffix" | "purok">(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);

  const allowOnlyLetters = (text: string) => text.replace(/[^A-Za-z\s]/g, "");
  const getSuffixLabel = () => SUFFIX_OPTIONS.find((o) => o.value === suffix)?.label ?? "None";
  const getPurokLabel = () => PUROK_OPTIONS.find((o) => o.value === purok)?.label ?? "Purok 1";

  const isAllSameDigits = (phone: string) => /^(.)\1{10}$/.test(phone);
  const hasTooManyRepeatingPatterns = (phone: string) => {
    const digitPart = phone.slice(2);
    const patterns = digitPart.match(/(.)\1{2,}/g) || [];
    return patterns.length > 1 || (patterns.length === 1 && patterns[0].length > 5);
  };
  const isKnownFakeSequence = (phone: string) =>
    ["09000000000", "09111111111", "09123456789", "09999999999", "09123123123"].includes(phone);

  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) { Alert.alert("Missing Fields", "Please fill in First Name and Last Name."); return false; }
    if (!birthday) { Alert.alert("Missing Fields", "Please select your Birthday."); return false; }
    if (calculateAge(birthday) < 18) { Alert.alert("Age Restriction", "You must be at least 18 years old to register."); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!houseStreet.trim()) { Alert.alert("Missing Fields", "House No. / Street is required."); return false; }
    if (!number) { Alert.alert("Missing Fields", "Contact number is required."); return false; }
    if (!number.startsWith("09") || number.length !== 11 || !/^\d+$/.test(number)) {
      Alert.alert("Invalid Contact Number", "Contact number must start with '09' and be exactly 11 digits."); return false;
    }
    if (isAllSameDigits(number)) { Alert.alert("Invalid Contact Number", "Contact number cannot have all the same digits."); return false; }
    if (isKnownFakeSequence(number)) { Alert.alert("Invalid Contact Number", "This appears to be a test or invalid number."); return false; }
    if (hasTooManyRepeatingPatterns(number)) { Alert.alert("Invalid Contact Number", "Contact number has too many repeating digit patterns."); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!email || !password || !confirmPassword) { Alert.alert("Missing Fields", "Please fill in Email, Password, and Confirm Password."); return false; }
    if (!isAllowedEmailDomain(email)) {
      Alert.alert("Invalid Email", `Only the following email providers are accepted:\n${ALLOWED_DOMAINS.join(", ")}`); return false;
    }
    if (password !== confirmPassword) { Alert.alert("Password Mismatch", "Passwords do not match."); return false; }
    if (!isPasswordStrong(password)) {
      Alert.alert("Weak Password", "Password must include:\n• At least 1 uppercase letter\n• At least 1 lowercase letter\n• At least 1 digit\n• Minimum 6 characters"); return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
    else if (currentStep === 3 && validateStep3()) setCurrentStep(4);
  };

  const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const buildUniqueKey = () => `${normalize(firstName)}_${normalize(lastName)}_${normalize(number)}`;

  const checkDuplicateUser = async () => {
    const uniqueKey = buildUniqueKey();
    const q = query(collection(firestore, "users"), where("uniqueKey", "==", uniqueKey), limit(1));
    const snap = await getDocs(q);
    return { exists: !snap.empty, uniqueKey };
  };

  const handleRegister = async () => {
    if (!email || !password || !firstName || !lastName || !birthday || !houseStreet) {
      Alert.alert("Missing Fields", "Please fill in all required fields."); return;
    }
    setIsLoading(true);
    try {
      let exists = false;
      let uniqueKey = "";
      try {
        const result = await checkDuplicateUser();
        exists = result.exists;
        uniqueKey = result.uniqueKey;
      } catch (dupError: any) {
        if (dupError.code === "permission-denied") Alert.alert("Permission Error", "Unable to verify account uniqueness. Contact support.");
        else Alert.alert("Registration Error", "Failed to verify account uniqueness: " + dupError.message);
        setIsLoading(false);
        return;
      }
      if (exists) {
        Alert.alert("Duplicate Account", "A user with the same first name, last name, and contact number is already registered.");
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: `${capitalizeWords(firstName)} ${capitalizeWords(lastName)}` });
      await sendEmailVerification(user);
      const fullAddress = [houseStreet.trim(), subdivision.trim(), `Purok ${purok}`].filter(Boolean).join(", ");
      try {
        await setDoc(doc(firestore, "users", user.uid), {
          firstName: capitalizeWords(firstName),
          middleName: middleName ? capitalizeWords(middleName) : null,
          lastName: capitalizeWords(lastName),
          suffix: suffix || null,
          email, address: fullAddress, houseStreet: houseStreet.trim(),
          subdivision: subdivision.trim() || null, purok, birthday,
          age: calculateAge(birthday), number, residencyStatus,
          emailVerified: false, idImage: null, uniqueKey, createdAt: serverTimestamp(),
        });
      } catch (saveError: any) {
        Alert.alert("Profile Save Error", "Auth account created, but profile could not be saved. Error: " + saveError.message);
        setIsLoading(false); return;
      }
      await signOut(auth);
      setIsLoading(false);
      setAccountCreatedModalVisible(true);
    } catch (error: any) {
      let errorMessage = "Something went wrong.";
      switch (error.code) {
        case "auth/email-already-in-use": errorMessage = "This email is already registered."; break;
        case "auth/weak-password": errorMessage = "Password should be at least 6 characters."; break;
        case "auth/invalid-email": errorMessage = "Invalid email address."; break;
        case "auth/network-request-failed": errorMessage = "Network error. Please check your connection."; break;
        default: errorMessage = error.message;
      }
      Alert.alert("Registration Error", errorMessage);
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => { setModalVisible(false); router.back(); };
  const handleAccountCreatedClose = () => { setAccountCreatedModalVisible(false); setModalVisible(true); };

  const handleResendVerificationEmail = async () => {
    if (!email || !password) { Alert.alert("Retry Verification", "Unable to resend email because your credentials are incomplete."); return; }
    setIsCheckingVerification(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      Alert.alert("Verification Email Sent", `A new verification email has been sent to ${email}.`);
    } catch (error: any) {
      Alert.alert("Resend Failed", error.message || "Unable to resend the verification email.");
    } finally { setIsCheckingVerification(false); }
  };

  const handleCheckVerificationStatus = async () => {
    if (!email || !password) { Alert.alert("Verification Check", "Please complete your registration first."); return; }
    setIsCheckingVerification(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await userCredential.user.reload();
      if (userCredential.user.emailVerified) { setModalVisible(false); router.replace("/(tabs)/home"); return; }
      await signOut(auth);
      Alert.alert("Email Not Verified", "We still could not verify your email. Please click the verification link in your email.");
    } catch (error: any) {
      await signOut(auth);
      Alert.alert("Verification Check Failed", error.message || "Unable to verify your email at this time.");
    } finally { setIsCheckingVerification(false); }
  };

  const max18Date = getMax18Date();
  const pwStrength = getPasswordStrength(password);

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
            <HeroBg />
            <View style={styles.logoBadge}>
              <Image source={require("../assets/images/sanroquelogoo.png")} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.appName}>Talk2Kap</Text>
            <Text style={styles.heroTitle}>Create{"\n"}Account</Text>
            <Text style={styles.heroSub}>Join the Barangay San Roque community</Text>

            {/* Tab Pill */}
            <View style={styles.tabPill}>
              <TouchableOpacity style={styles.tabPillBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Text style={[styles.tabPillText, styles.tabPillTextInactive]}>Log In</Text>
              </TouchableOpacity>
              <View style={[styles.tabPillActive, { right: 4 }]} />
              <TouchableOpacity style={styles.tabPillBtn} activeOpacity={1}>
                <Text style={[styles.tabPillText, styles.tabPillTextActive]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step Bar */}
          <View style={styles.stepBarWrapper}>
            <StepBar current={currentStep} />
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <View style={styles.cardAccent} />

            {/* ── Step 1: Personal ── */}
            {currentStep === 1 && (
              <>
                <Text style={styles.cardTitle}>Personal Info</Text>
                <Text style={styles.cardSub}>Tell us about yourself</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>First Name *</Text>
                  <InputField icon="person-outline" placeholder="Enter your first name" value={firstName} onChangeText={(t) => setFirstName(allowOnlyLetters(t))} autoCapitalize="words" />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Middle Name</Text>
                  <InputField icon="person-outline" placeholder="Optional" value={middleName} onChangeText={(t) => setMiddleName(allowOnlyLetters(t))} autoCapitalize="words" />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Last Name *</Text>
                  <InputField icon="person-outline" placeholder="Enter your last name" value={lastName} onChangeText={(t) => setLastName(allowOnlyLetters(t))} autoCapitalize="words" />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Suffix</Text>
                  <SelectField label="None" value={getSuffixLabel()} onPress={() => setSelectionModal("suffix")} />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Birthday * (18+ years old)</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      value={birthday}
                      max={max18Date.toISOString().split("T")[0]}
                      onChange={(e) => setBirthday(e.target.value)}
                      style={{
                        width: "100%", padding: "0 16px", height: 54,
                        borderWidth: 1, borderColor: C.border, borderStyle: "solid",
                        borderRadius: 16, backgroundColor: C.surfaceUp,
                        fontSize: 15, color: birthday ? C.text : C.textDim,
                        boxSizing: "border-box", fontFamily: "inherit",
                      }}
                    />
                  ) : (
                    <>
                      <InputField
                        icon="calendar-outline"
                        placeholder="Select your birthday"
                        value={birthday}
                        onPress={() => setShowDatePicker(true)}
                        displayText={birthday}
                        rightElement={<Ionicons name="chevron-down" size={16} color={C.gold} />}
                      />
                      {showDatePicker && (
                        <DateTimePicker
                          value={birthday ? new Date(birthday) : max18Date}
                          mode="date"
                          maximumDate={max18Date}
                          display="default"
                          onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) {
                              const y = selectedDate.getFullYear();
                              const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                              const d = String(selectedDate.getDate()).padStart(2, "0");
                              setBirthday(`${y}-${m}-${d}`);
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            {/* ── Step 2: Address ── */}
            {currentStep === 2 && (
              <>
                <Text style={styles.cardTitle}>Contact & Address</Text>
                <Text style={styles.cardSub}>Where do you reside in the Barangay?</Text>

                <View style={styles.addressCard}>
                  <View style={styles.addressCardHeader}>
                    <Ionicons name="location" size={14} color={C.gold} />
                    <Text style={styles.addressCardTitle}>Home Address</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>House No. / Street *</Text>
                    <InputField icon="home-outline" placeholder="e.g. 123 Rizal Street" value={houseStreet} onChangeText={setHouseStreet} autoCapitalize="words" />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Subdivision / Village</Text>
                    <InputField icon="business-outline" placeholder="Optional" value={subdivision} onChangeText={setSubdivision} autoCapitalize="words" />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Purok</Text>
                    <SelectField label="Select Purok" value={getPurokLabel()} onPress={() => setSelectionModal("purok")} />
                  </View>

                  {houseStreet.trim() !== "" && (
                    <View style={styles.addressPreview}>
                      <Ionicons name="navigate" size={12} color={C.gold} />
                      <Text style={styles.addressPreviewText}>
                        {[houseStreet.trim(), subdivision.trim(), `Purok ${purok}`].filter(Boolean).join(", ")}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Contact Number *</Text>
                  <InputField icon="call-outline" placeholder="09XXXXXXXXX" value={number} onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, ""))} keyboardType="numeric" maxLength={11} />
                  {number.length > 0 && (!number.startsWith("09") || number.length !== 11) && (
                    <Text style={styles.errorMsg}>Must start with 09 and be exactly 11 digits</Text>
                  )}
                  {number.length === 11 && number.startsWith("09") && isAllSameDigits(number) && (
                    <Text style={styles.errorMsg}>Contact number cannot have all the same digits</Text>
                  )}
                  {number.length === 11 && number.startsWith("09") && isKnownFakeSequence(number) && (
                    <Text style={styles.errorMsg}>This appears to be a test or invalid number</Text>
                  )}
                  {number.length === 11 && number.startsWith("09") && hasTooManyRepeatingPatterns(number) && (
                    <Text style={styles.errorMsg}>Contact number has too many repeating patterns</Text>
                  )}
                  {number.length === 11 && number.startsWith("09") && !isAllSameDigits(number) && !isKnownFakeSequence(number) && !hasTooManyRepeatingPatterns(number) && (
                    <View style={styles.successRow}>
                      <Ionicons name="checkmark-circle" size={14} color={C.success} />
                      <Text style={styles.successMsg}>Valid contact number</Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Residency Status</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, residencyStatus === "resident" && styles.toggleBtnActive]}
                      onPress={() => setResidencyStatus("resident")}
                    >
                      <Ionicons name="home" size={14} color={residencyStatus === "resident" ? C.bg : C.textSub} />
                      <Text style={[styles.toggleBtnText, residencyStatus === "resident" && styles.toggleBtnTextActive]}>Resident</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, residencyStatus === "renter" && styles.toggleBtnActive]}
                      onPress={() => setResidencyStatus("renter")}
                    >
                      <Ionicons name="key" size={14} color={residencyStatus === "renter" ? C.bg : C.textSub} />
                      <Text style={[styles.toggleBtnText, residencyStatus === "renter" && styles.toggleBtnTextActive]}>Renter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* ── Step 3: Account ── */}
            {currentStep === 3 && (
              <>
                <Text style={styles.cardTitle}>Account Setup</Text>
                <Text style={styles.cardSub}>Secure your account credentials</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address *</Text>
                  <InputField icon="mail-outline" placeholder="yourname@gmail.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
                  {email.includes("@") && !isAllowedEmailDomain(email) && <Text style={styles.errorMsg}>Email domain not accepted.</Text>}
                  {email.includes("@") && isAllowedEmailDomain(email) && (
                    <View style={styles.successRow}>
                      <Ionicons name="checkmark-circle" size={14} color={C.success} />
                      <Text style={styles.successMsg}>Valid email domain</Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password *</Text>
                  <InputField
                    icon="lock-closed-outline"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!passwordVisible}
                    rightElement={
                      <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.eyeBtn}>
                        <Ionicons name={passwordVisible ? "eye-outline" : "eye-off-outline"} size={17} color={C.textSub} />
                      </TouchableOpacity>
                    }
                  />
                  {password.length > 0 && (
                    <View style={styles.strengthWrap}>
                      <View style={styles.strengthBg}>
                        <Animated.View style={[styles.strengthFill, { width: `${pwStrength.pct}%` as any, backgroundColor: pwStrength.color }]} />
                      </View>
                      <Text style={[styles.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Confirm Password *</Text>
                  <InputField
                    icon="shield-checkmark-outline"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!confirmPasswordVisible}
                    rightElement={
                      <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)} style={styles.eyeBtn}>
                        <Ionicons name={confirmPasswordVisible ? "eye-outline" : "eye-off-outline"} size={17} color={C.textSub} />
                      </TouchableOpacity>
                    }
                  />
                  {confirmPassword.length > 0 && (
                    <View style={styles.successRow}>
                      <Ionicons name={password === confirmPassword ? "checkmark-circle" : "close-circle"} size={14} color={password === confirmPassword ? C.success : C.error} />
                      <Text style={[styles.successMsg, { color: password === confirmPassword ? C.success : C.error }]}>
                        {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* ── Step 4: Review ── */}
            {currentStep === 4 && (
              <>
                <Text style={styles.cardTitle}>Review Details</Text>
                <Text style={styles.cardSub}>Confirm your information before creating your account</Text>

                <View style={styles.reviewCard}>
                  <ReviewRow label="Full Name" value={`${capitalizeWords(firstName)} ${middleName ? capitalizeWords(middleName) + " " : ""}${capitalizeWords(lastName)}${suffix ? " " + suffix : ""}`} />
                  <ReviewRow label="Birthday" value={birthday} />
                  <ReviewRow label="Email" value={email} />
                  <ReviewRow label="Address" value={[houseStreet.trim(), subdivision.trim(), `Purok ${purok}`].filter(Boolean).join(", ")} />
                  <ReviewRow label="Contact Number" value={number} />
                  <ReviewRow label="Residency" value={residencyStatus === "resident" ? "Resident" : "Renter"} />
                </View>

                <View style={styles.verifyBanner}>
                  <View style={styles.verifyBannerIcon}>
                    <Ionicons name="mail" size={16} color={C.gold} />
                  </View>
                  <Text style={styles.verifyBannerText}>
                    A verification email will be sent to <Text style={{ color: C.gold, fontWeight: "700" }}>{email}</Text> after registration.
                  </Text>
                </View>
              </>
            )}

            {/* Navigation Buttons */}
            <View style={styles.navRow}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.8}>
                  <Ionicons name="arrow-back" size={16} color={C.gold} />
                  <Text style={styles.backBtnText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentStep < 4 ? (
                <TouchableOpacity
                  style={[styles.nextBtn, currentStep === 1 && { flex: 1 }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color={C.bg} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.nextBtn, { flex: 1 }]}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={C.bg} />
                  ) : (
                    <>
                      <Text style={styles.nextBtnText}>Create Account</Text>
                      <Ionicons name="checkmark" size={16} color={C.bg} />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => router.back()} style={styles.loginLinkRow} activeOpacity={0.8}>
              <Text style={styles.loginLinkText}>Already have an account? </Text>
              <Text style={styles.loginLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Created Modal */}
      <Modal animationType="fade" transparent visible={accountCreatedModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconWrap, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
              <Ionicons name="checkmark-circle" size={36} color={C.success} />
            </View>
            <Text style={styles.modalTitle}>Account Created!</Text>
            <Text style={styles.modalBody}>
              Your account has been successfully created. A verification email has been sent to{" "}
              <Text style={{ color: C.gold }}>{email}</Text>.
            </Text>
            <Text style={styles.modalNote}>Click the link in the email to activate your account.</Text>
            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleAccountCreatedClose}>
              <Text style={styles.modalPrimaryBtnText}>Next Step</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Verify Email Modal */}
      <Modal animationType="fade" transparent visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconWrap, { backgroundColor: "rgba(245,158,11,0.12)" }]}>
              <Ionicons name="mail-unread" size={36} color={C.gold} />
            </View>
            <Text style={styles.modalTitle}>Verify Your Email</Text>
            <Text style={styles.modalBody}>
              We've sent an activation email to{" "}
              <Text style={{ color: C.gold, fontWeight: "700" }}>{email}</Text>.
              Open it and click the link to complete registration.
            </Text>
            <Text style={styles.modalNote}>Didn't receive it? Check your spam/junk folder.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSecondaryBtn} onPress={handleResendVerificationEmail} disabled={isCheckingVerification}>
                {isCheckingVerification ? <ActivityIndicator size="small" color={C.text} /> : <Text style={styles.modalSecondaryBtnText}>Resend Email</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleCheckVerificationStatus} disabled={isCheckingVerification}>
                {isCheckingVerification ? <ActivityIndicator size="small" color={C.bg} /> : <Text style={styles.modalPrimaryBtnText}>I've Verified</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.modalSecondaryBtn, { marginTop: 10, width: "100%" }]} onPress={handleSuccessClose}>
              <Text style={styles.modalSecondaryBtnText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Selection Modal */}
      <Modal animationType="fade" transparent visible={selectionModal !== null} onRequestClose={() => setSelectionModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { padding: 20, maxHeight: "80%" }]}>
            <Text style={[styles.modalTitle, { marginBottom: 16 }]}>
              {selectionModal === "suffix" ? "Choose Suffix" : "Choose Purok"}
            </Text>
            <ScrollView style={{ width: "100%" }} showsVerticalScrollIndicator={false} scrollEventThrottle={16}>
              <View style={styles.selectionList}>
                {(selectionModal === "suffix" ? SUFFIX_OPTIONS : PUROK_OPTIONS).map((option) => {
                  const isSelected = selectionModal === "suffix" ? suffix === option.value : purok === option.value;
                  return (
                    <TouchableOpacity
                      key={`${selectionModal}-${option.value || "none"}`}
                      style={[styles.selectionItem, isSelected && styles.selectionItemActive]}
                      onPress={() => {
                        if (selectionModal === "suffix") setSuffix(option.value);
                        else setPurok(option.value);
                        setSelectionModal(null);
                      }}
                    >
                      <Text style={[styles.selectionItemText, isSelected && styles.selectionItemTextActive]}>{option.label}</Text>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color={C.gold} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, backgroundColor: C.bg, paddingBottom: 40 },

  // Hero
  hero: {
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: "center",
    overflow: "hidden",
    minHeight: 310,
  },
  logoBadge: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1, borderColor: "rgba(245,158,11,0.22)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  logo: { width: 42, height: 42 },
  appName: {
    fontSize: 10, fontWeight: "800", color: C.gold,
    letterSpacing: 5, textTransform: "uppercase", marginBottom: 10,
  },
  heroTitle: {
    fontSize: 40, fontWeight: "800", color: C.white,
    textAlign: "center", lineHeight: 46, letterSpacing: -0.5, marginBottom: 6,
  },
  heroSub: { fontSize: 13, color: C.textSub, fontWeight: "500", marginBottom: 24 },

  // Tab Pill
  tabPill: {
    flexDirection: "row", backgroundColor: C.surface,
    borderRadius: 50, padding: 4, borderWidth: 1,
    borderColor: C.border, position: "relative", width: 220,
  },
  tabPillActive: {
    position: "absolute", top: 4, width: "50%", height: "100%",
    backgroundColor: C.gold, borderRadius: 50,
  },
  tabPillBtn: { flex: 1, paddingVertical: 10, alignItems: "center", zIndex: 1 },
  tabPillText: { fontSize: 13, fontWeight: "800" },
  tabPillTextActive: { color: C.bg },
  tabPillTextInactive: { color: C.textSub },

  // Step bar
  stepBarWrapper: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: C.bg,
  },
  stepBar: { flexDirection: "row", alignItems: "center" },
  stepItem: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.surfaceUp, borderWidth: 1,
    borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: C.gold, borderColor: C.gold },
  stepDotDone: { backgroundColor: C.success, borderColor: C.success },
  stepLabel: { fontSize: 9, fontWeight: "700", color: C.textDim, letterSpacing: 0.3 },
  stepLabelActive: { color: C.textSub },
  stepLine: { flex: 1, height: 1, backgroundColor: C.border, marginBottom: 14 },
  stepLineDone: { backgroundColor: C.success },

  // Card
  card: {
    marginHorizontal: 16, backgroundColor: C.surface,
    borderRadius: 28, padding: 28, borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3, shadowRadius: 24, elevation: 8, overflow: "hidden",
  },
  cardAccent: {
    height: 3, backgroundColor: C.gold, borderRadius: 2,
    marginBottom: 20, width: 48,
  },
  cardTitle: {
    fontSize: 24, fontWeight: "800", color: C.text,
    letterSpacing: -0.3, marginBottom: 4,
  },
  cardSub: { fontSize: 13, color: C.textSub, fontWeight: "500", marginBottom: 24 },

  // Input
  fieldGroup: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: C.textSub,
    marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase",
  },
  inputShell: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 54,
  },
  inputLeadIcon: { marginRight: 10 },
  inputText: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 0 },
  eyeBtn: { padding: 4 },

  // Select
  selectShell: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: C.border, borderRadius: 16,
    paddingHorizontal: 14, height: 54, backgroundColor: C.surfaceUp,
  },
  selectValue: { fontSize: 15, color: C.text, fontWeight: "600" },
  selectPlaceholder: { fontSize: 15, color: C.textDim },

  // Validation
  errorMsg: { fontSize: 11, color: C.error, fontWeight: "700", marginTop: 5, marginLeft: 2 },
  successRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  successMsg: { fontSize: 11, fontWeight: "700", color: C.success },

  // Password strength
  strengthWrap: { marginTop: 8, gap: 4 },
  strengthBg: { height: 3, backgroundColor: C.surfaceUp, borderRadius: 2, overflow: "hidden" },
  strengthFill: { height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: 10, fontWeight: "700" },

  // Address card
  addressCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20, padding: 16, borderWidth: 1,
    borderColor: C.border, marginBottom: 16,
  },
  addressCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  addressCardTitle: { fontSize: 12, fontWeight: "800", color: C.gold, letterSpacing: 0.3, textTransform: "uppercase" },
  addressPreview: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.surface, paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 12, marginTop: 8,
  },
  addressPreviewText: { fontSize: 12, color: C.textSub, flex: 1, flexWrap: "wrap" },

  // Toggle
  toggleRow: { flexDirection: "row", gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surfaceUp,
  },
  toggleBtnActive: { borderColor: C.gold, backgroundColor: C.goldDim },
  toggleBtnText: { fontSize: 14, fontWeight: "700", color: C.textSub },
  toggleBtnTextActive: { color: C.gold },

  // Review
  reviewCard: {
    borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: C.border, marginBottom: 16,
  },
  reviewRow: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  reviewLabel: { fontSize: 10, fontWeight: "700", color: C.textDim, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  reviewValue: { fontSize: 15, fontWeight: "600", color: C.text },
  verifyBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: C.goldDim, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: C.borderGold,
  },
  verifyBannerIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  verifyBannerText: { fontSize: 13, color: C.textSub, flex: 1, lineHeight: 20 },

  // Nav buttons
  navRow: { flexDirection: "row", gap: 10, marginTop: 28 },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 16, paddingHorizontal: 20,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.borderGold,
    backgroundColor: C.goldDim,
  },
  backBtnText: { fontSize: 14, fontWeight: "700", color: C.gold },
  nextBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    paddingVertical: 16, borderRadius: 16, backgroundColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  nextBtnText: { fontSize: 15, fontWeight: "800", color: C.bg },

  loginLinkRow: {
    flexDirection: "row", justifyContent: "center",
    alignItems: "center", marginTop: 22,
  },
  loginLinkText: { fontSize: 13, color: C.textSub, fontWeight: "500" },
  loginLink: { fontSize: 13, color: C.gold, fontWeight: "800" },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalBox: {
    width: "100%", maxWidth: 380,
    backgroundColor: C.surface, borderRadius: 24,
    padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: C.border,
  },
  modalIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.text, marginBottom: 10 },
  modalBody: {
    fontSize: 14, color: C.textSub, textAlign: "center",
    lineHeight: 22, marginBottom: 6,
  },
  modalNote: {
    fontSize: 12, color: C.textDim, textAlign: "center", marginBottom: 22,
  },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  modalPrimaryBtn: {
    flex: 1, backgroundColor: C.gold,
    paddingVertical: 14, borderRadius: 14, alignItems: "center",
  },
  modalPrimaryBtnText: { fontSize: 14, fontWeight: "800", color: C.bg },
  modalSecondaryBtn: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 14, borderRadius: 14, alignItems: "center",
  },
  modalSecondaryBtnText: { fontSize: 14, fontWeight: "700", color: C.text },

  // Selection modal
  selectionList: { width: "100%", gap: 8 },
  selectionItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surfaceUp,
  },
  selectionItemActive: { borderColor: C.borderGold, backgroundColor: C.goldDim },
  selectionItemText: { fontSize: 15, fontWeight: "600", color: C.text },
  selectionItemTextActive: { color: C.goldLight },
});