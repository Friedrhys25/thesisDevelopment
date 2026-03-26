import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
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
import React, { useState } from "react";
import {
    Alert,
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

export default function RegisterPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [suffix, setSuffix] = useState(""); // NEW

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const [address, setAddress] = useState("");
  const [purok, setPurok] = useState("1");

  const [birthday, setBirthday] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [number, setNumber] = useState("");

  // NEW: Tenant / Residency
  const [residencyStatus, setResidencyStatus] = useState<"resident" | "tenant">("resident");

  // NEW: Employee toggle
  const [isEmployee, setIsEmployee] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // Step tracking: 1-4

  // BLOCK NUMBERS ON NAME FIELDS
  const allowOnlyLetters = (text: string) => text.replace(/[^A-Za-z\s]/g, "");

  // STEP VALIDATION
  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim() || !birthday) {
      Alert.alert("Missing Fields", "Please fill in First Name, Last Name, and Birthday");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (number.length !== 11 || !/^\d+$/.test(number)) {
      Alert.alert("Invalid Contact", "Contact number must be exactly 11 digits.");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in Email, Password, and Confirm Password");
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
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3);
    } else if (currentStep === 3 && validateStep3()) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // PASSWORD STRENGTH
  const isPasswordStrong = (pw: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    return regex.test(pw);
  };

  // AGE CALCULATION
  const calculateAge = (birthdate: string) => {
    const today = new Date();
    const birth = new Date(birthdate);

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  // Unique key helper for duplicate blocking
  const normalize = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const buildUniqueKey = () => `${normalize(firstName)}_${normalize(lastName)}_${normalize(number)}`;

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
    // Required fields
    if (!email || !password || !confirmPassword || !firstName || !lastName || !birthday) {
      Alert.alert("Missing Fields", "Please fill in all required fields marked with *");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    if (!isPasswordStrong(password)) {
      Alert.alert(
        "Weak Password",
        "Password must include:\n• At least 1 uppercase letter\n• At least 1 lowercase letter\n• At least 1 digit\n• Minimum 6 characters"
      );
      return;
    }

    // Contact number validation
    if (number.length !== 11 || !/^\d+$/.test(number)) {
      Alert.alert("Incorrect Mobile Format", "Contact number must be exactly 11 digits.");
      return;
    }

    try {
      // 1) Duplicate check BEFORE creating Auth account
      let exists = false;
      let uniqueKey = "";

      try {
        const result = await checkDuplicateUser();
        exists = result.exists;
        uniqueKey = result.uniqueKey;
      } catch (dupError: any) {
        console.error("Duplicate Check Error:", dupError);
        if (dupError.code === "permission-denied") {
          Alert.alert(
            "Permission Error",
            "Unable to check for existing accounts. Please ensure Firestore rules allow public queries or contact support."
          );
        } else {
          Alert.alert("Registration Error", "Failed to verify account uniqueness: " + dupError.message);
        }
        return;
      }

      if (exists) {
        Alert.alert(
          "Duplicate Account",
          "A user with the same first name, last name, and contact number is already registered."
        );
        return;
      }

      // 2) Create Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3) Save profile to Firestore
      try {
        await setDoc(doc(firestore, "users", user.uid), {
          firstName,
          middleName: middleName || null,
          lastName,
          suffix: suffix || null,

          email,
          address: address || null,
          purok,
          birthday,
          age: calculateAge(birthday),
          number,

          residencyStatus, // "resident" | "tenant"

          isEmployee,

          idImage: null,
          uniqueKey,
          createdAt: serverTimestamp(),
        });
      } catch (saveError: any) {
        console.error("Profile Save Error:", saveError);
        Alert.alert(
          "Profile Save Error",
          "Auth account created, but failed to save profile data. Please contact support. Error: " + saveError.message
        );
        return;
      }

      setModalVisible(true);
    } catch (error: any) {
      console.error("Registration caught error:", error);
      let errorMessage = "Something went wrong";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage = "This email is already registered";
          break;
        case "auth/weak-password":
          errorMessage = "Password should be at least 6 characters";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address";
          break;
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection.";
          break;
        default:
          errorMessage = error.message;
      }

      Alert.alert("Registration Error", errorMessage);
    }
  };

  const handleSuccessClose = () => {
    setModalVisible(false);
    router.push("/");
  };

  const today = new Date();

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Banner Section */}
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

          {/* Tab Navigation - Inside Banner Section */}
          <View style={styles.tabContainer}>
            <TouchableOpacity onPress={() => router.push("/")} style={styles.tabInactive}>
              <Text style={styles.tabInactiveText}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabActive}>
              <Text style={styles.tabActiveText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Step Counter */}
          <View style={styles.stepCounter}>
            <Text style={styles.stepLabel}>Step {currentStep} of 4</Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(currentStep / 4) * 100}%` }
                ]} 
              />
            </View>
          </View>

          {/* STEP 1: PERSONAL INFORMATION */}
          {currentStep === 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your first name"
                  value={firstName}
                  onChangeText={(t) => setFirstName(allowOnlyLetters(t))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Middle Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Optional"
                  placeholderTextColor="#9CA3AF"
                  value={middleName}
                  onChangeText={(t) => setMiddleName(allowOnlyLetters(t))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your last name"
                  value={lastName}
                  onChangeText={(t) => setLastName(allowOnlyLetters(t))}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Suffix</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={suffix} onValueChange={setSuffix}>
                    <Picker.Item label="None" value="" />
                    <Picker.Item label="Jr." value="Jr." />
                    <Picker.Item label="Sr." value="Sr." />
                    <Picker.Item label="II" value="II" />
                    <Picker.Item label="III" value="III" />
                    <Picker.Item label="IV" value="IV" />
                    <Picker.Item label="V" value="V" />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Birthday *</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <View style={styles.input}>
                    <Text style={{ color: birthday ? "#1F2937" : "#9CA3AF", fontSize: 15 }}>
                      {birthday || "Select your birthday"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={birthday ? new Date(birthday) : new Date()}
                    mode="date"
                    maximumDate={today}
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
              </View>
            </View>
          )}

          {/* STEP 2: CONTACT INFORMATION */}
          {currentStep === 2 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="lot / block / street"
                  placeholderTextColor="#9CA3AF"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Purok</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={purok} onValueChange={setPurok}>
                    <Picker.Item label="Purok 1" value="1" />
                    <Picker.Item label="Purok 2" value="2" />
                    <Picker.Item label="Purok 3" value="3" />
                    <Picker.Item label="Purok 4" value="4" />
                    <Picker.Item label="Purok 5" value="5" />
                    <Picker.Item label="Purok 6" value="6" />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="11-digit number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  maxLength={11}
                  value={number}
                  onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, ""))}
                />
                {number.length > 0 && number.length !== 11 && (
                  <Text style={styles.errorText}>Incorrect mobile format (must be 11 digits)</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tenant in Barangay?</Text>
                <View style={styles.rowBtns}>
                  <TouchableOpacity
                    style={[styles.smallBtn, residencyStatus === "resident" && styles.smallBtnActive]}
                    onPress={() => setResidencyStatus("resident")}
                  >
                    <Text style={styles.smallBtnText}>NO (Resident)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, residencyStatus === "tenant" && styles.smallBtnActive]}
                    onPress={() => setResidencyStatus("tenant")}
                  >
                    <Text style={styles.smallBtnText}>YES (Tenant)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* STEP 3: ACCOUNT INFORMATION */}
          {currentStep === 3 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password *</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Min. 6 characters"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!passwordVisible}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                    <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password *</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Re-enter password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!confirmPasswordVisible}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
                    <Ionicons name={confirmPasswordVisible ? "eye-off" : "eye"} size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {confirmPassword && password !== confirmPassword && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Employee Account?</Text>
                <View style={styles.rowBtns}>
                  <TouchableOpacity
                    style={[styles.smallBtn, !isEmployee && styles.smallBtnActive]}
                    onPress={() => setIsEmployee(false)}
                  >
                    <Text style={styles.smallBtnText}>OFF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallBtn, isEmployee && styles.smallBtnActive]}
                    onPress={() => setIsEmployee(true)}
                  >
                    <Text style={styles.smallBtnText}>ON</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* STEP 4: REVIEW & SUBMIT */}
          {currentStep === 4 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review Your Information</Text>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Name</Text>
                <Text style={styles.reviewValue}>
                  {firstName} {middleName ? middleName + " " : ""}{lastName}{suffix ? " " + suffix : ""}
                </Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Birthday</Text>
                <Text style={styles.reviewValue}>{birthday}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Email</Text>
                <Text style={styles.reviewValue}>{email}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Address</Text>
                <Text style={styles.reviewValue}>{address || "Not provided"}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Contact Number</Text>
                <Text style={styles.reviewValue}>{number}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Purok</Text>
                <Text style={styles.reviewValue}>Purok {purok}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Residency Status</Text>
                <Text style={styles.reviewValue}>
                  {residencyStatus === "resident" ? "Resident" : "Tenant"}
                </Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Employee Account</Text>
                <Text style={styles.reviewValue}>{isEmployee ? "Yes" : "No"}</Text>
              </View>
            </View>
          )}

          {/* NAVIGATION BUTTONS */}
          <View style={styles.buttonRow}>
            {currentStep > 1 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={18} color="#4F46E5" />
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
              >
                <Text style={styles.submitButtonText}>Create Account</Text>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={styles.switchText}>
              Already have an account? <Text style={styles.switchLink}>Log in</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* SUCCESS MODAL */}
        <Modal animationType="fade" transparent={true} visible={modalVisible}>
          <View style={styles.modalBackground}>
            <View style={styles.modalBox}>
              <View style={styles.successIcon}>
                <Text style={styles.successIconText}>✓</Text>
              </View>
              <Text style={styles.modalText}>Registration Successful!</Text>
              <Text style={styles.modalSubText}>
                Your account has been created. You can now log in with your credentials.
              </Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleSuccessClose}>
                <Text style={styles.closeButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F3F4F6",
    paddingBottom: 40,
  },

  bannerSection: {
    backgroundColor: "#4F46E5",
  },

  banner: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#fff",
    marginBottom: 16,
    opacity: 0.95,
  },
  bannerGreeting: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "#E0E7FF",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 20,
  },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  tabActive: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: "#4F46E5",
    alignItems: "center",
  },
  tabActiveText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  tabInactive: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
  },
  tabInactiveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  formCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },

  stepCounter: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4F46E5",
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    backgroundColor: "#4F46E5",
    borderRadius: 3,
  },

  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
    paddingLeft: 12,
  },

  inputGroup: { 
    marginBottom: 16 
  },
  inputLabel: { 
    fontSize: 13, 
    fontWeight: "700", 
    color: "#374151", 
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    width: "100%",
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    fontSize: 16,
    color: "#1F2937",
    justifyContent: "center",
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    height: 56,
  },
  passwordInput: { 
    flex: 1, 
    fontSize: 16,
    color: "#1F2937",
  },

  errorText: { 
    color: "#EF4444", 
    fontSize: 12, 
    marginTop: 4,
    fontWeight: "600",
    marginLeft: 4,
  },

  pickerContainer: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    overflow: "hidden",
  },

  rowBtns: {
    flexDirection: "row",
    gap: 12,
  },
  smallBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  smallBtnActive: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  smallBtnText: { 
    fontWeight: "700", 
    color: "#374151",
    fontSize: 16
  },

  reviewItem: {
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4F46E5",
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9CA3AF",
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#4F46E5",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  backButtonText: {
    color: "#4F46E5",
    fontSize: 15,
    fontWeight: "800",
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  switchText: { 
    textAlign: "center", 
    color: "#6B7280", 
    marginTop: 20,
    fontSize: 14,
    fontWeight: "500",
  },
  switchLink: { 
    color: "#4F46E5", 
    fontWeight: "800" 
  },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 18,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 22,
    alignItems: "center",
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successIconText: { 
    fontSize: 40, 
    color: "#fff",
    fontWeight: "bold",
  },

  modalText: { 
    fontSize: 22, 
    fontWeight: "800", 
    marginBottom: 12,
    color: "#1F2937"
  },
  modalSubText: { 
    textAlign: "center", 
    color: "#6B7280", 
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 22,
  },

  closeButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  closeButtonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "800" 
  },
});
