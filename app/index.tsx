import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, firestore } from "../backend/firebaseConfig";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    const userDoc = await getDoc(doc(firestore, "users", userCredential.user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.isEmployee) {
        console.log("✅ Employee login - routing to dashboard");
        router.replace("/employee/dashboard");
      } else {
        console.log("✅ Regular user login - routing to home");
        router.replace("/(tabs)/home");
      }
    } else {
      // If user doc doesn't exist, route to regular home (fallback)
      console.warn("User document not found, routing to home");
      router.replace("/(tabs)/home");
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
          <View style={styles.banner}>
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
              <Ionicons name="mail" size={20} color="#4a90e2" style={styles.inputIcon} />
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
              <Ionicons name="lock-closed" size={20} color="#4a90e2" style={styles.inputIcon} />
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
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.bottomOptionsRow}>
            <View style={styles.rememberContainer}>
              <TouchableOpacity style={styles.checkbox}>
                <Ionicons name="checkbox" size={18} color="#4a90e2" />
              </TouchableOpacity>
              <Text style={styles.rememberText}>Remember me</Text>
            </View>
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
            <Text style={styles.actionButtonText}>
              {loading ? "" : "Swipe to Login"}
            </Text>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#fff" />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  scrollContent: {
    flexGrow: 1,
  },
  
  // Banner Section with Tabs
  bannerSection: {
    backgroundColor: "#4a90e2",
  },

  // Banner Header
  banner: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
    opacity: 0.95,
  },
  bannerGreeting: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: "#e3f2fd",
    fontWeight: "500",
  },

  // Tab Navigation - Inside Banner Section
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
  },
  tabActive: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 3,
    borderBottomColor: "#4a90e2",
    alignItems: "center",
  },
  tabActiveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  tabInactive: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    alignItems: "center",
  },
  tabInactiveText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#999",
  },

  // Form Card
  formCard: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  // Input Section
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 10,
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderWidth: 1.5,
    borderColor: "#e8e8e8",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    paddingVertical: 0,
  },

  // Options Row (Remember Me & Forgot)
  bottomOptionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#4a90e2",
    alignItems: "center",
    justifyContent: "center",
  },
  rememberText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  forgotLink: {
    fontSize: 13,
    color: "#4a90e2",
    fontWeight: "600",
  },

  // Action Button
  actionButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    backgroundColor: "#a8c9e8",
    shadowOpacity: 0.15,
  },
  actionButtonText: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Sign Up Section
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  signupBaseText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  signupLinkText: {
    fontSize: 13,
    color: "#4a90e2",
    fontWeight: "700",
  },
});