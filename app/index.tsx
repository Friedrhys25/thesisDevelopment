import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabledModalVisible, setDisabledModalVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

const handleLogin = async () => {
  if (!email || !password) {
    console.warn("Missing Fields: Please enter your email and password."); // log first
    Alert.alert("Missing Fields", "Please enter your email and password.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.warn("Invalid Email: Please enter a valid email address."); // log first
    Alert.alert("Invalid Email", "Please enter a valid email address.");
    return;
  }

  setLoading(true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful!");

    // 🔐 Check if user is employee to route accordingly
    const employeeDoc = await getDoc(doc(firestore, "employee", userCredential.user.uid));

    if (employeeDoc.exists()) {
      console.log("✅ Employee login - routing to dashboard");
      router.replace("/employee/dashboard");
    } else {
      const userDoc = await getDoc(doc(firestore, "users", userCredential.user.uid));
      if (userDoc.exists()) {
        if (!userCredential.user.emailVerified) {
          await signOut(auth);
          Alert.alert(
            "Email Not Verified",
            "Your email address has not been verified yet. Please check your inbox for the verification link."
          );
          return;
        }
        const userData = userDoc.data();
        if (userData.disabled === true) {
          await signOut(auth);
          setDisabledModalVisible(true);
          return;
        }
        console.log("✅ Regular user login - routing to home");
        router.replace("/(tabs)/home");
      } else {
        console.warn("User document not found in either table, routing to home");
        router.replace("/(tabs)/home");
      }
    }
  } catch (error: any) {
    let errorTitle = "Login Failed";
    let errorMessage = "Something went wrong. Please try again.";

    switch (error.code) {
      case "auth/user-not-found":
        errorTitle = "Account Not Found";
        errorMessage =
          "No account exists with this email address. Please check your email or register a new account.";
        break;
      case "auth/wrong-password":
        errorTitle = "Incorrect Password";
        errorMessage =
          "The password you entered is incorrect. Please try again or reset your password.";
        break;
      case "auth/invalid-email":
        errorTitle = "Invalid Email";
        errorMessage = "The email address is not valid. Please check and try again.";
        break;
      case "auth/user-disabled":
        errorTitle = "Account Disabled";
        errorMessage = "This account has been disabled. Please contact support.";
        break;
      case "auth/too-many-requests":
        errorTitle = "Too Many Attempts";
        errorMessage =
          "Too many failed login attempts. Please try again later or reset your password.";
        break;
      case "auth/network-request-failed":
        errorTitle = "Network Error";
        errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
        break;
      case "auth/invalid-credential":
        errorTitle = "Invalid Credentials";
        errorMessage =
          "The email or password is incorrect. Please check your credentials and try again.";
        break;
      case "auth/operation-not-allowed":
        errorTitle = "Login Unavailable";
        errorMessage = "Email/password login is currently disabled. Please contact support.";
        break;
      default:
        errorMessage = error.message || "An unexpected error occurred. Please try again.";
    }

    // ✅ Log first, then show Alert
    console.warn(`${errorTitle}: ${errorMessage}`);
    Alert.alert(errorTitle, errorMessage);
  } finally {
    setLoading(false);
  }
};


  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter Email", "Please enter your email first to reset your password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Invalid Email", "Please enter a valid email before resetting your password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      console.log("✅ Password reset email sent!");
      Alert.alert(
        "Reset Link Sent",
        `A password reset link has been sent to ${email}. Check your inbox.`
      );
    } catch (error: any) {
      console.log(error);
      Alert.alert("Reset Failed", error.message);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Banner Section */}
        <View style={styles.bannerSection}>
          <View style={[styles.banner, { paddingTop: insets.top + 20 }]}>
            <Image 
              source={require("../assets/images/sanroquelogoo.png")} 
              style={styles.logo} 
              resizeMode="contain" 
            />
            <Text style={styles.appName}>Talk2Kap</Text>
            <Text style={styles.bannerGreeting}>Hi! Welcome Back</Text>
            <Text style={styles.bannerSubtitle}>Sign in to continue enjoying your favorite features</Text>
          </View>

          {/* Tab Navigation - Inside Banner Section */}
          <View style={styles.tabContainer}>
            <TouchableOpacity style={styles.tabActive}>
              <Text style={styles.tabActiveText}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/register")} style={styles.tabInactive}>
              <Text style={styles.tabInactiveText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Card */}
        <View style={styles.formCard}>

          {/* Email Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail" size={20} color="#4F46E5" style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                placeholderTextColor="#ccc"
                style={styles.input}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed" size={20} color="#4F46E5" style={styles.inputIcon} />
              <TextInput
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                placeholderTextColor="#ccc"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={18}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <View style={styles.bottomOptionsRow}>
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.actionButton, loading && styles.actionButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.actionButtonText}>Log In</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupBaseText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/register")} disabled={loading}>
              <Text style={styles.signupLinkText}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Disabled Account Modal */}
    <Modal visible={disabledModalVisible} transparent animationType="fade" onRequestClose={() => setDisabledModalVisible(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.disabledModal}>
          <Ionicons name="warning" size={60} color="#ff9800" />
          <Text style={styles.disabledTitle}>Account Disabled</Text>
          <Text style={styles.disabledMessage}>
            This account has been disabled. For more information, please contact support at test@gmail.com
          </Text>
          <TouchableOpacity style={styles.disabledButton} onPress={() => setDisabledModalVisible(false)}>
            <Text style={styles.disabledButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 16,
    color: "#E0E7FF",
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 24,
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
    fontSize: 15,
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
    fontSize: 15,
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

  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    paddingVertical: 0,
  },

  bottomOptionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 32,
  },
  forgotLink: {
    fontSize: 15,
    color: "#4F46E5",
    fontWeight: "700",
  },

  actionButton: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: "#A5B4FC",
    shadowOpacity: 0.1,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginRight: 8,
  },

  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  signupBaseText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  signupLinkText: {
    fontSize: 14,
    color: "#4F46E5",
    fontWeight: "800",
  },

  // Disabled Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  disabledModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 32,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  disabledMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  disabledButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  disabledButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});