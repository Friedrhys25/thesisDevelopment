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
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, firestore } from "../backend/firebaseConfig";

export default function RegisterPage() {
  const router = useRouter();

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

  // NEW: Employee toggle + role
  const [isEmployee, setIsEmployee] = useState(false);
  const [employeeRole, setEmployeeRole] = useState("all categories");

  const [modalVisible, setModalVisible] = useState(false);

  const ROLE_OPTIONS = [
    "all categories",
    "day care services",
    "vawc",
    "bns",
    "bhw",
    "chief bantay bayan",
    "bantay bayan",
    "bantay bayan/utility",
    "bantay bayan/driver",
    "lupon tagapamayapa",
  ];

  // BLOCK NUMBERS ON NAME FIELDS
  const allowOnlyLetters = (text: string) => text.replace(/[^A-Za-z\s]/g, "");

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

    // If employee is ON, role must be selected (safety check)
    if (isEmployee && !employeeRole) {
      Alert.alert("Missing Role", "Please select an employee role.");
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
          employeeRole: isEmployee ? employeeRole : null,

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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us today</Text>
        </View>

        <View style={styles.formContainer}>
          {/* PERSONAL INFO */}
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

            {/* NEW: Suffix */}
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
                  <Text style={{ color: birthday ? "#333" : "#999" }}>
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

          {/* ACCOUNT INFO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
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
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
                  <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={22} color="#555" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Re-enter password"
                  secureTextEntry={!confirmPasswordVisible}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setConfirmPasswordVisible(!confirmPasswordVisible)}>
                  <Ionicons name={confirmPasswordVisible ? "eye-off" : "eye"} size={22} color="#555" />
                </TouchableOpacity>
              </View>

              {confirmPassword && password !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
            </View>
          </View>

          {/* CONTACT INFO */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="lot / block / street"
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
              <Text style={styles.inputLabel}>Contact Number</Text>
              <TextInput
                style={styles.input}
                placeholder="11-digit number"
                keyboardType="numeric"
                maxLength={11}
                value={number}
                onChangeText={(t) => setNumber(t.replace(/[^0-9]/g, ""))}
              />

              {number.length > 0 && number.length !== 11 && (
                <Text style={styles.errorText}>Incorrect mobile format (must be 11 digits)</Text>
              )}
            </View>

            {/* NEW: Residency status */}
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

            {/* NEW: Employee switch + role dropdown */}
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

              {isEmployee && (
                <>
                  <Text style={[styles.inputLabel, { marginTop: 12 }]}>Employee Role</Text>
                  <View style={styles.pickerContainer}>
                    <Picker selectedValue={employeeRole} onValueChange={setEmployeeRole}>
                      {ROLE_OPTIONS.map((r) => (
                        <Picker.Item key={r} label={r} value={r} />
                      ))}
                    </Picker>
                  </View>
                </>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginLink}>Log in</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f7fa",
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#4a90e2",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 5,
  },
  title: { fontSize: 36, fontWeight: "bold", color: "#fff" },
  subtitle: { fontSize: 18, color: "#e3f2fd" },
  formContainer: { padding: 20 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4a90e2",
    paddingLeft: 12,
  },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#555", marginBottom: 8 },

  input: {
    width: "100%",
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    fontSize: 16,
    color: "#333",
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    paddingHorizontal: 12,
  },
  passwordInput: { flex: 1, padding: 12, fontSize: 16 },

  errorText: { color: "#e74c3c", fontSize: 12, marginTop: 4 },

  pickerContainer: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
  },

  rowBtns: {
    flexDirection: "row",
    gap: 10,
  },
  smallBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    alignItems: "center",
  },
  smallBtnActive: {
    borderColor: "#4a90e2",
    backgroundColor: "#e6f4fe",
  },
  smallBtnText: { fontWeight: "700", color: "#2c3e50" },

  registerButton: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#4a90e2",
    alignItems: "center",
    marginTop: 10,
  },
  registerButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  loginText: { textAlign: "center", color: "#666", marginTop: 10 },
  loginLink: { color: "#4a90e2", fontWeight: "bold" },

  modalBackground: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalBox: {
    width: 320,
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 20,
    alignItems: "center",
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#4caf50",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successIconText: { fontSize: 40, color: "#fff" },

  modalText: { fontSize: 22, fontWeight: "bold", marginBottom: 12 },
  modalSubText: { textAlign: "center", color: "#666", marginBottom: 20 },

  closeButton: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
