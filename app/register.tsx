import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import { auth, db } from "../backend/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address, setAddress] = useState("");
  const [purok, setPurok] = useState("1");
  const [birthday, setBirthday] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [number, setNumber] = useState("");
  const [modalVisible, setModalVisible] = useState(false);


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


  const handleRegister = async () => {
    console.log("Register button pressed");

    if (!email || !password || !confirmPassword || !firstName || !lastName || !birthday) {
      Alert.alert("Missing Fields", "Please fill in all required fields marked with *");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match. Please try again.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters long");
      return;
    }

    try {
      console.log("Creating user with email:", email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log("User created:", user.uid);

      await set(ref(db, `users/${user.uid}`), {
        firstName,
        middleName: middleName || null,
        lastName,
        email,
        address,
        purok,
        birthday,
        age: calculateAge(birthday),
        number,
        idImage: null,
        createdAt: new Date().toISOString(),
      });

      console.log("Saved to database");
      setModalVisible(true);
    } catch (error: any) {
      console.error("Firebase Error:", error.code, error.message);

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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join us today</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Personal Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>First Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                value={firstName}
                onChangeText={setFirstName}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Middle Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your middle name (optional)"
                value={middleName}
                onChangeText={setMiddleName}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Last Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                value={lastName}
                onChangeText={setLastName}
                placeholderTextColor="#999"
              />
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
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);

                    if (selectedDate) {
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                      const day = String(selectedDate.getDate()).padStart(2, "0");
                      setBirthday(`${year}-${month}-${day}`);
                    }
                  }}
                />
              )}
            </View>



          </View>

          {/* Account Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="Min. 6 characters"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <TextInput
                style={[
                  styles.input,
                  confirmPassword && password !== confirmPassword && styles.inputError
                ]}
                placeholder="Re-enter your password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
              {confirmPassword && password !== confirmPassword && (
                <Text style={styles.errorText}>Passwords do not match</Text>
              )}
            </View>
          </View>

          {/* Contact Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your address"
                value={address}
                onChangeText={setAddress}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purok</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={purok}
                  onValueChange={(itemValue) => setPurok(itemValue)}
                  style={styles.picker}
                >
                  <Picker.Item label="Purok 1" value="1" />
                  <Picker.Item label="Purok 2" value="2" />
                  <Picker.Item label="Purok 3" value="3" />
                  <Picker.Item label="Purok 4" value="4" />
                  <Picker.Item label="Purok 5" value="5" />
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contact Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
                value={number}
                onChangeText={setNumber}
                placeholderTextColor="#999"
              />
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

        {/* Success Modal */}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#e3f2fd",
  },
  formContainer: {
    padding: 20,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
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
  inputError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  pickerContainer: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    overflow: "hidden",
  },
  picker: {
    width: "100%",
  },
  imageButton: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f0f8ff",
    borderWidth: 2,
    borderColor: "#4a90e2",
    borderStyle: "dashed",
    alignItems: "center",
    marginBottom: 12,
  },
  imageButtonText: {
    color: "#4a90e2",
    fontWeight: "600",
    fontSize: 15,
  },
  imagePreviewContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  idImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  registerButton: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#4a90e2",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  loginText: {
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    color: "#4a90e2",
    fontWeight: "600",
  },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
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
  successIconText: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#2c3e50",
  },
  modalSubText: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});