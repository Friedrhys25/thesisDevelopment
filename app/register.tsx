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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../backend/firebaseConfig";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const capitalizeWords = (str: string) =>
  str
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const ALLOWED_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mail.com",
  "protonmail.com",
  "ymail.com",
];

const isAllowedEmailDomain = (email: string) => {
  const parts = email.toLowerCase().split("@");
  if (parts.length !== 2) return false;
  return ALLOWED_DOMAINS.includes(parts[1]);
};

const isPasswordStrong = (pw: string) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(pw);

const getPasswordStrength = (pw: string) => {
  if (!pw) return { label: "", color: "transparent", width: "0%" };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", color: "#EF4444", width: "20%" };
  if (score <= 2) return { label: "Fair", color: "#F97316", width: "40%" };
  if (score <= 3) return { label: "Good", color: "#F59E0B", width: "60%" };
  if (score <= 4) return { label: "Strong", color: "#10B981", width: "80%" };
  return { label: "Very Strong", color: "#10B981", width: "100%" };
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

const COLORS = {
  bg: "#0b1a3d",
  surface: "#0f1e45",
  surfaceAlt: "#162254",
  elevated: "#162254",
  text: "#E8EEFF",
  textMuted: "#8895BB",
  textDim: "#4A5880",
  gold: "#f59e0b",
  goldLight: "#fbbf24",
  goldDim: "rgba(245,158,11,0.15)",
  goldBorder: "rgba(245,158,11,0.3)",
  border: "rgba(255,255,255,0.06)",
  red: "#ce1126",
};

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

// ────────────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tabWidth, setTabWidth] = useState(0);
  // Start at 1 since Sign Up is the active tab on this screen
  const slideAnim = useRef(new Animated.Value(1)).current;

  const animateTab = (toValue: number) => {
    Animated.timing(slideAnim, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

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
  const getSuffixLabel = () =>
    SUFFIX_OPTIONS.find((option) => option.value === suffix)?.label ?? "None";
  const getPurokLabel = () =>
    PUROK_OPTIONS.find((option) => option.value === purok)?.label ?? "Purok 1";

  const isAllSameDigits = (phone: string) => /^(.)\\1{10}$/.test(phone);
  
  const hasTooManyRepeatingPatterns = (phone: string) => {
    const digitPart = phone.slice(2);
    const patterns = digitPart.match(/(.)\\1{2,}/g) || [];
    return patterns.length > 1 || (patterns.length === 1 && patterns[0].length > 5);
  };
  
  const isKnownFakeSequence = (phone: string) => {
    const fakes = ["09000000000", "09111111111", "09123456789", "09999999999"];
    return fakes.includes(phone);
  };

  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Missing Fields", "Please fill in First Name and Last Name.");
      return false;
    }
    if (!birthday) {
      Alert.alert("Missing Fields", "Please select your Birthday.");
      return false;
    }
    if (calculateAge(birthday) < 18) {
      Alert.alert("Age Restriction", "You must be at least 18 years old to register.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!houseStreet.trim()) {
      Alert.alert("Missing Fields", "House No. / Street is required.");
      return false;
    }
    if (!number) {
      Alert.alert("Missing Fields", "Contact number is required.");
      return false;
    }
    if (!number.startsWith("09") || number.length !== 11 || !/^\d+$/.test(number)) {
      Alert.alert(
        "Invalid Contact Number",
        "Contact number must start with '09' and be exactly 11 digits."
      );
      return false;
    }
    if (isAllSameDigits(number)) {
      Alert.alert(
        "Invalid Contact Number",
        "Contact number cannot have all the same digits."
      );
      return false;
    }
    if (isKnownFakeSequence(number)) {
      Alert.alert(
        "Invalid Contact Number",
        "This appears to be a test or invalid number. Please enter a real contact number."
      );
      return false;
    }
    if (hasTooManyRepeatingPatterns(number)) {
      Alert.alert(
        "Invalid Contact Number",
        "Contact number has too many repeating digit patterns. Please enter a valid number."
      );
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in Email, Password, and Confirm Password.");
      return false;
    }
    if (!isAllowedEmailDomain(email)) {
      Alert.alert(
        "Invalid Email",
        `Only the following email providers are accepted:\n${ALLOWED_DOMAINS.join(", ")}`
      );
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return false;
    }
    if (!isPasswordStrong(password)) {
      Alert.alert(
        "Weak Password",
        "Password must include:\n• At least 1 uppercase letter\n• At least 1 lowercase letter\n• At least 1 digit\n• Minimum 6 characters"
      );
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
    else if (currentStep === 3 && validateStep3()) setCurrentStep(4);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const buildUniqueKey = () =>
    `${normalize(firstName)}_${normalize(lastName)}_${normalize(number)}`;

  const checkDuplicateUser = async () => {
    const uniqueKey = buildUniqueKey();
    const q = query(
      collection(firestore, "users"),
      where("uniqueKey", "==", uniqueKey),
      limit(1)
    );
    const snap = await getDocs(q);
    return { exists: !snap.empty, uniqueKey };
  };

  const handleRegister = async () => {
    if (!email || !password || !firstName || !lastName || !birthday || !houseStreet) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
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
        if (dupError.code === "permission-denied") {
          Alert.alert("Permission Error", "Unable to verify account uniqueness. Contact support.");
        } else {
          Alert.alert(
            "Registration Error",
            "Failed to verify account uniqueness: " + dupError.message
          );
        }
        setIsLoading(false);
        return;
      }

      if (exists) {
        Alert.alert(
          "Duplicate Account",
          "A user with the same first name, last name, and contact number is already registered."
        );
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${capitalizeWords(firstName)} ${capitalizeWords(lastName)}`,
      });

      await sendEmailVerification(user);

      const fullAddress = [houseStreet.trim(), subdivision.trim(), `Purok ${purok}`]
        .filter(Boolean)
        .join(", ");

      try {
        await setDoc(doc(firestore, "users", user.uid), {
          firstName: capitalizeWords(firstName),
          middleName: middleName ? capitalizeWords(middleName) : null,
          lastName: capitalizeWords(lastName),
          suffix: suffix || null,
          email,
          address: fullAddress,
          houseStreet: houseStreet.trim(),
          subdivision: subdivision.trim() || null,
          purok,
          birthday,
          age: calculateAge(birthday),
          number,
          residencyStatus,
          emailVerified: false,
          idImage: null,
          uniqueKey,
          createdAt: serverTimestamp(),
        });
      } catch (saveError: any) {
        Alert.alert(
          "Profile Save Error",
          "Auth account created, but profile could not be saved. Contact support. Error: " +
            saveError.message
        );
        setIsLoading(false);
        return;
      }

      await signOut(auth);
      setIsLoading(false);
      setAccountCreatedModalVisible(true);
    } catch (error: any) {
      let errorMessage = "Something went wrong.";
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "This email is already registered.";
          break;
        case "auth/weak-password":
          errorMessage = "Password should be at least 6 characters.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your connection.";
          break;
        default:
          errorMessage = error.message;
      }
      Alert.alert("Registration Error", errorMessage);
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setModalVisible(false);
    router.replace("/");
  };

  const handleAccountCreatedClose = () => {
    setAccountCreatedModalVisible(false);
    setModalVisible(true);
  };

  const handleResendVerificationEmail = async () => {
    if (!email || !password) {
      Alert.alert("Retry Verification", "Unable to resend email because your credentials are incomplete.");
      return;
    }

    setIsCheckingVerification(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      Alert.alert(
        "Verification Email Sent",
        `A new verification email has been sent to ${email}. Please check your inbox.`
      );
    } catch (error: any) {
      Alert.alert(
        "Resend Failed",
        error.message || "Unable to resend the verification email. Please try again later."
      );
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleCheckVerificationStatus = async () => {
    if (!email || !password) {
      Alert.alert("Verification Check", "Please complete your registration first.");
      return;
    }

    setIsCheckingVerification(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await userCredential.user.reload();
      if (userCredential.user.emailVerified) {
        setModalVisible(false);
        router.replace("/(tabs)/home");
        return;
      }
      await signOut(auth);
      Alert.alert(
        "Email Not Verified",
        "We still could not verify your email. Please open the email and click the verification link."
      );
    } catch (error: any) {
      await signOut(auth);
      Alert.alert(
        "Verification Check Failed",
        error.message || "Unable to verify your email at this time. Please try again later."
      );
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const max18Date = getMax18Date();

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bannerSection}>
            <View style={[styles.banner, { paddingTop: insets.top + 20 }]}>
              <Image
                source={require("../assets/images/sanroquelogoo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.appName}>Talk2Kap</Text>
              <Text style={styles.bannerGreeting}>Create Account</Text>
              <Text style={styles.bannerSubtitle}>Join us and start making a difference</Text>
            </View>

            {/* Tab Navigation */}
            <View
              style={styles.tabContainer}
              onLayout={(e) => setTabWidth(e.nativeEvent.layout.width / 2)}
            >
              {/* Dim base line */}
              <View style={styles.tabBaseLine} />

              {/* Animated sliding indicator */}
              <Animated.View
                style={[
                  styles.tabIndicator,
                  {
                    transform: [{
                      translateX: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, tabWidth],
                      }),
                    }],
                  },
                ]}
              />

              <TouchableOpacity
                onPress={() => router.replace("/")}
                style={styles.tabBase}
                activeOpacity={1}
              >
                <Animated.Text
                  style={[
                    styles.tabText,
                    {
                      color: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [COLORS.gold, COLORS.textMuted],
                      }),
                    },
                  ]}
                >
                  Log In
                </Animated.Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.tabBase} activeOpacity={1}>
                <Animated.Text
                  style={[
                    styles.tabText,
                    {
                      color: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [COLORS.textMuted, COLORS.gold],
                      }),
                    },
                  ]}
                >
                  Sign Up
                </Animated.Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.stepCounter}>
              <Text style={styles.stepLabel}>Step {currentStep} of 4</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(currentStep / 4) * 100}%` }]} />
              </View>
            </View>

            {currentStep === 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Personal Information</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your first name"
                    placeholderTextColor={COLORS.textMuted}
                    value={firstName}
                    onChangeText={(t) => setFirstName(allowOnlyLetters(t))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Middle Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Optional"
                    placeholderTextColor={COLORS.textMuted}
                    value={middleName}
                    onChangeText={(t) => setMiddleName(allowOnlyLetters(t))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your last name"
                    placeholderTextColor={COLORS.textMuted}
                    value={lastName}
                    onChangeText={(t) => setLastName(allowOnlyLetters(t))}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Suffix</Text>
                  <TouchableOpacity
                    style={styles.selectField}
                    activeOpacity={0.85}
                    onPress={() => setSelectionModal("suffix")}
                  >
                    <Text style={[styles.selectFieldText, !suffix && styles.selectFieldPlaceholder]}>
                      {getSuffixLabel()}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={COLORS.gold} />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Birthday * (Must be 18 years old or above)</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      value={birthday}
                      max={max18Date.toISOString().split("T")[0]}
                      onChange={(e) => setBirthday(e.target.value)}
                      style={{
                        width: "100%",
                        paddingLeft: 16,
                        paddingRight: 16,
                        height: 56,
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderStyle: "solid",
                        borderRadius: 16,
                        backgroundColor: COLORS.elevated,
                        fontSize: 16,
                        color: birthday ? COLORS.text : COLORS.textMuted,
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                        <View style={styles.input}>
                          <Text style={{ color: birthday ? COLORS.text : COLORS.textMuted, fontSize: 15 }}>
                            {birthday || "Select your birthday"}
                          </Text>
                        </View>
                      </TouchableOpacity>

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
              </View>
            )}

            {currentStep === 2 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact & Address</Text>

                <View style={styles.addressCard}>
                  <Text style={styles.addressCardTitle}>📍 Home Address</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>House No. / Street *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 123 Rizal Street"
                      placeholderTextColor={COLORS.textMuted}
                      value={houseStreet}
                      onChangeText={setHouseStreet}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Subdivision / Village</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Optional (e.g. Green Meadows)"
                      placeholderTextColor={COLORS.textMuted}
                      value={subdivision}
                      onChangeText={setSubdivision}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Purok</Text>
                    <TouchableOpacity
                      style={styles.selectField}
                      activeOpacity={0.85}
                      onPress={() => setSelectionModal("purok")}
                    >
                      <Text style={styles.selectFieldText}>{getPurokLabel()}</Text>
                      <Ionicons name="chevron-down" size={18} color={COLORS.gold} />
                    </TouchableOpacity>
                  </View>

                  {houseStreet.trim() !== "" && (
                    <View style={styles.addressPreview}>
                      <Ionicons name="location" size={14} color={COLORS.gold} />
                      <Text style={styles.addressPreviewText}>
                        {[houseStreet.trim(), subdivision.trim(), `Purok ${purok}`]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contact Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="09XXXXXXXXX"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    maxLength={11}
                    value={number}
                    onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, ""))}
                  />
                  {number.length > 0 && (!number.startsWith("09") || number.length !== 11) && (
                    <Text style={styles.errorText}>Must start with 09 and be exactly 11 digits</Text>
                  )}
                  {number.length === 11 && number.startsWith("09") && (
                    <View style={styles.matchRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#10B981" }}>
                        Valid contact number
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Are you a renter in the Barangay?</Text>
                  <View style={styles.rowBtns}>
                    <TouchableOpacity
                      style={[styles.smallBtn, residencyStatus === "resident" && styles.smallBtnActive]}
                      onPress={() => setResidencyStatus("resident")}
                    >
                      <Text style={styles.smallBtnText}>Resident</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, residencyStatus === "renter" && styles.smallBtnActive]}
                      onPress={() => setResidencyStatus("renter")}
                    >
                      <Text style={styles.smallBtnText}>Renter</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {currentStep === 3 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Information</Text>



                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="yourname@gmail.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  {email.includes("@") && !isAllowedEmailDomain(email) && (
                    <Text style={styles.errorText}>Email domain not accepted.</Text>
                  )}
                  {email.includes("@") && isAllowedEmailDomain(email) && (
                    <View style={styles.matchRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#10B981" }}>
                        Valid email domain
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password *</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!passwordVisible}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                      <Ionicons
                        name={passwordVisible ? "eye" : "eye-off"}
                        size={22}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {password.length > 0 && (
                    <View style={{ gap: 4, marginTop: 6 }}>
                      <View style={styles.strengthBarBg}>
                        <View
                          style={[
                            styles.strengthBarFill,
                            {
                              width: getPasswordStrength(password).width as any,
                              backgroundColor: getPasswordStrength(password).color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: getPasswordStrength(password).color }]}>
                        {getPasswordStrength(password).label}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password *</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Re-enter password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!confirmPasswordVisible}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
                      <Ionicons
                        name={confirmPasswordVisible ? "eye" : "eye-off"}
                        size={22}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword.length > 0 && (
                    <View style={styles.matchRow}>
                      <Ionicons
                        name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
                        size={16}
                        color={password === confirmPassword ? "#10B981" : "#EF4444"}
                      />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: password === confirmPassword ? "#10B981" : "#EF4444" }}>
                        {password === confirmPassword ? "Passwords match" : "Passwords do not match"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {currentStep === 4 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Review Your Information</Text>

                {[
                  {
                    label: "Full Name",
                    value: `${capitalizeWords(firstName)} ${middleName ? capitalizeWords(middleName) + " " : ""}${capitalizeWords(lastName)}${suffix ? " " + suffix : ""}`,
                  },
                  { label: "Birthday", value: birthday },
                  { label: "Email", value: email },
                  {
                    label: "Address",
                    value: [houseStreet.trim(), subdivision.trim(), `Purok ${purok}`].filter(Boolean).join(", "),
                  },
                  { label: "Contact Number", value: number },
                  { label: "Residency Status", value: residencyStatus === "resident" ? "Resident" : "Renter" },
                ].map((item) => (
                  <View key={item.label} style={styles.reviewItem}>
                    <Text style={styles.reviewLabel}>{item.label}</Text>
                    <Text style={styles.reviewValue}>{item.value}</Text>
                  </View>
                ))}

                <View style={styles.verificationNotice}>
                  <Ionicons name="mail" size={18} color={COLORS.gold} />
                  <Text style={styles.verificationNoticeText}>
                    A verification email will be sent to{" "}
                    <Text style={{ fontWeight: "800" }}>{email}</Text> after registration.
                    Please check your inbox to activate your account.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.buttonRow}>
              {currentStep > 1 && (
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                  <Ionicons name="arrow-back" size={18} color={COLORS.gold} />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentStep < 4 ? (
                <TouchableOpacity
                  style={[styles.nextButton, currentStep === 1 && { marginLeft: "auto" }]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.submitButton, { marginLeft: "auto" }]}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.submitButtonText}>Create Account</Text>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => router.replace("/")}
              activeOpacity={1}
            >
              <Text style={styles.switchText}>
                Already have an account?{" "}
                <Text style={styles.switchLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Account Created Modal */}
          <Modal animationType="fade" transparent visible={accountCreatedModalVisible}>
            <View style={styles.modalBackground}>
              <View style={styles.modalBox}>
                <View style={styles.emailIcon}>
                  <Ionicons name="checkmark-circle" size={50} color="#10B981" />
                </View>
                <Text style={styles.modalText}>Account Created!</Text>
                <Text style={styles.modalSubText}>
                  Your account has been successfully created. To activate your account, please verify the email that will be sent to:
                </Text>
                <View style={styles.emailChip}>
                  <Ionicons name="mail" size={14} color="#f59e0b" />
                  <Text style={styles.emailChipText}>{email}</Text>
                </View>
                <Text style={styles.modalInstructions}>
                  A verification email has been sent to your inbox. Click the activation link in that email to verify your account and complete your registration.
                </Text>
                <Text style={styles.modalNote}>Didn't receive it? You can resend the email on the next screen.</Text>
                <TouchableOpacity style={[styles.closeButton, { width: "100%" }]} onPress={handleAccountCreatedClose}>
                  <Text style={styles.closeButtonText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Verify Email Modal */}
          <Modal animationType="fade" transparent visible={modalVisible}>
            <View style={styles.modalBackground}>
              <View style={styles.modalBox}>
                <View style={styles.emailIcon}>
                  <Ionicons name="mail-unread" size={40} color="#fff" />
                </View>
                <Text style={styles.modalText}>Verify Your Email</Text>
                <Text style={styles.modalSubText}>
                  We've sent an{" "}
                  <Text style={{ fontWeight: "800", color: COLORS.gold }}>Account Activation email</Text>{" "}to:
                </Text>
                <View style={styles.emailChip}>
                  <Ionicons name="mail" size={14} color={COLORS.gold} />
                  <Text style={styles.emailChipText}>{email}</Text>
                </View>
                <Text style={styles.modalInstructions}>
                  Please open the email and click the activation link to complete your registration. After clicking the link, use the buttons below to confirm verification or resend the email.
                </Text>
                <Text style={styles.modalNote}>Didn't receive it? Check your spam/junk folder.</Text>
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.modalButtonLeft]}
                    onPress={handleResendVerificationEmail}
                    disabled={isCheckingVerification}
                  >
                    {isCheckingVerification ? (
                      <ActivityIndicator color={COLORS.text} size="small" />
                    ) : (
                      <Text style={styles.secondaryButtonText}>Resend Email</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.closeButton, styles.modalButtonRight]}
                    onPress={handleCheckVerificationStatus}
                    disabled={isCheckingVerification}
                  >
                    {isCheckingVerification ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.closeButtonText}>I Have Verified</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.closeButton, styles.modalSecondaryAction]} onPress={handleSuccessClose}>
                  <Text style={styles.closeButtonText}>Go to Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Selection Modal */}
          <Modal
            animationType="fade"
            transparent
            visible={selectionModal !== null}
            onRequestClose={() => setSelectionModal(null)}
          >
            <View style={styles.modalBackground}>
              <View style={styles.selectionModalBox}>
                <Text style={styles.modalText}>
                  {selectionModal === "suffix" ? "Choose Suffix" : "Choose Purok"}
                </Text>
                <View style={styles.selectionList}>
                  {(selectionModal === "suffix" ? SUFFIX_OPTIONS : PUROK_OPTIONS).map((option) => {
                    const isSelected =
                      selectionModal === "suffix" ? suffix === option.value : purok === option.value;
                    return (
                      <TouchableOpacity
                        key={`${selectionModal}-${option.value || "none"}`}
                        style={[styles.selectionOption, isSelected && styles.selectionOptionActive]}
                        onPress={() => {
                          if (selectionModal === "suffix") setSuffix(option.value);
                          else setPurok(option.value);
                          setSelectionModal(null);
                        }}
                      >
                        <Text style={[styles.selectionOptionText, isSelected && styles.selectionOptionTextActive]}>
                          {option.label}
                        </Text>
                        {isSelected && <Ionicons name="checkmark-circle" size={18} color={COLORS.gold} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.selectionCancelButton]}
                  onPress={() => setSelectionModal(null)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.bg, paddingBottom: 40 },
  bannerSection: { backgroundColor: COLORS.bg },
  banner: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24, alignItems: "center" },
  logo: { width: 80, height: 80, marginBottom: 16 },
  appName: {
    fontSize: 20, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase",
    color: COLORS.text, marginBottom: 16, opacity: 0.95,
  },
  bannerGreeting: { fontSize: 30, fontWeight: "800", color: COLORS.text, marginBottom: 8 },
  bannerSubtitle: {
    fontSize: 14, color: COLORS.text, fontWeight: "500",
    textAlign: "center", paddingHorizontal: 20, lineHeight: 22,
  },

  // Tab styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    position: "relative",
    overflow: "hidden",
  },
  tabBaseLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.textDim,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "50%",
    height: 3,
    backgroundColor: COLORS.gold,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    zIndex: 1,
  },
  tabBase: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "800",
  },

  formCard: {
    marginHorizontal: 16, marginTop: 20, marginBottom: 40, backgroundColor: COLORS.surface,
    borderRadius: 20, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12,
  },
  stepCounter: { marginBottom: 24 },
  stepLabel: { fontSize: 13, fontWeight: "800", color: COLORS.gold, marginBottom: 8 },
  progressBar: { height: 6, backgroundColor: COLORS.surfaceAlt, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: COLORS.gold, borderRadius: 3 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 16,
    borderLeftWidth: 4, borderLeftColor: COLORS.gold, paddingLeft: 12,
  },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted, marginBottom: 8, marginLeft: 4 },
  input: {
    width: "100%", paddingHorizontal: 16, height: 56, borderWidth: 1,
    borderColor: COLORS.goldBorder, borderRadius: 16, backgroundColor: COLORS.elevated,
    fontSize: 16, color: COLORS.text, justifyContent: "center",
  },
  passwordContainer: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderColor: COLORS.goldBorder, borderRadius: 16, backgroundColor: COLORS.elevated,
    paddingHorizontal: 12, height: 56,
  },
  passwordInput: { flex: 1, fontSize: 16, color: COLORS.text },
  errorText: { color: COLORS.red, fontSize: 12, marginTop: 4, fontWeight: "600", marginLeft: 4 },
  selectField: {
    minHeight: 56, backgroundColor: COLORS.elevated, borderWidth: 1,
    borderColor: COLORS.goldBorder, borderRadius: 16, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectFieldText: { color: COLORS.text, fontSize: 16, fontWeight: "600", flex: 1 },
  selectFieldPlaceholder: { color: COLORS.textMuted },
  rowBtns: { flexDirection: "row", gap: 12 },
  smallBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: "center",
  },
  smallBtnActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldDim },
  smallBtnText: { fontWeight: "700", color: COLORS.text, fontSize: 16 },
  addressCard: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  addressCardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.gold, marginBottom: 14 },
  addressPreview: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginTop: 4,
  },
  addressPreviewText: { fontSize: 13, fontWeight: "600", color: COLORS.text, flex: 1, flexWrap: "wrap" },
  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: COLORS.surfaceAlt, padding: 12, borderRadius: 12, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoBannerText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", flex: 1, flexWrap: "wrap", lineHeight: 18 },
  reviewItem: {
    backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 12, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: COLORS.gold,
  },
  reviewLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginBottom: 4 },
  reviewValue: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  verificationNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: COLORS.surfaceAlt, padding: 14, borderRadius: 16,
    marginTop: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  verificationNoticeText: { fontSize: 13, color: COLORS.textMuted, flex: 1, lineHeight: 20 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 28 },
  backButton: {
    flex: 1, flexDirection: "row", paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 2, borderColor: COLORS.gold, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  backButtonText: { color: COLORS.gold, fontSize: 15, fontWeight: "800" },
  nextButton: {
    flex: 1, flexDirection: "row", paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 16, backgroundColor: COLORS.gold, alignItems: "center",
    justifyContent: "center", gap: 6, shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  nextButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: "800" },
  submitButton: {
    flex: 1, flexDirection: "row", paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 16, backgroundColor: COLORS.gold, alignItems: "center",
    justifyContent: "center", gap: 6, shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitButtonText: { color: COLORS.bg, fontSize: 15, fontWeight: "800" },
  switchText: { textAlign: "center", color: COLORS.textMuted, marginTop: 20, fontSize: 14, fontWeight: "500" },
  switchLink: { color: COLORS.gold, fontWeight: "800" },
  modalBackground: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)", padding: 18,
  },
  modalBox: { width: "100%", maxWidth: 420, padding: 30, backgroundColor: COLORS.surface, borderRadius: 22, alignItems: "center" },
  emailIcon: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: COLORS.gold,
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  modalText: { fontSize: 22, fontWeight: "800", marginBottom: 8, color: COLORS.text },
  modalSubText: { textAlign: "center", color: COLORS.textMuted, marginBottom: 12, fontSize: 14, lineHeight: 22 },
  emailChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 16,
  },
  emailChipText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  modalInstructions: { textAlign: "center", color: COLORS.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 8 },
  modalNote: { textAlign: "center", color: COLORS.textMuted, fontSize: 12, marginBottom: 24 },
  closeButton: {
    backgroundColor: COLORS.gold, paddingHorizontal: 40, paddingVertical: 16,
    borderRadius: 16, width: "100%", alignItems: "center",
  },
  closeButtonText: { color: COLORS.bg, fontSize: 16, fontWeight: "800" },
  modalActionsRow: { width: "100%", flexDirection: "row", gap: 12, marginBottom: 16 },
  secondaryButton: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1,
    borderColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  secondaryButtonText: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  modalButtonLeft: { flex: 1 },
  modalButtonRight: { flex: 1 },
  modalSecondaryAction: { marginTop: 0 },
  selectionModalBox: { width: "100%", maxWidth: 420, padding: 24, backgroundColor: COLORS.surface, borderRadius: 22 },
  selectionList: { marginTop: 12, marginBottom: 16, gap: 10 },
  selectionOption: {
    minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  selectionOptionActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldDim },
  selectionOptionText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  selectionOptionTextActive: { color: COLORS.goldLight },
  selectionCancelButton: { width: "100%" },
  strengthBarBg: { height: 4, backgroundColor: COLORS.surfaceAlt, borderRadius: 2, overflow: "hidden" },
  strengthBarFill: { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "700", color: COLORS.text },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
});
