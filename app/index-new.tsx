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
      console.warn(
        "Missing Fields: Please enter your email and password."
      );
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn("Invalid Email: Please enter a valid email address.");
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("✅ Login successful!");

      // Check if user is employee to route accordingly
      const userDoc = await getDoc(
        doc(firestore, "users", userCredential.user.uid)
      );
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
          errorMessage =
            "Unable to connect to the server. Please check your internet connection and try again.";
          break;
        case "auth/invalid-credential":
          errorTitle = "Invalid Credentials";
          errorMessage =
            "The email or password is incorrect. Please check your credentials and try again.";
          break;
        case "auth/operation-not-allowed":
          errorTitle = "Login Unavailable";
          errorMessage =
            "Email/password login is currently disabled. Please contact support.";
          break;
        default:
          errorMessage = error.message || "An unexpected error occurred. Please try again.";
      }

      console.warn(`${errorTitle}: ${errorMessage}`);
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert(
        "Enter Email",
        "Please enter your email first to reset your password."
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert(
        "Invalid Email",
        "Please enter a valid email before resetting your password."
      );
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
      >
        {/* Card Container */}
        <View style={styles.card}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.tagline}>Log in to your integ inv account</Text>
          <Text style={styles.title}>Welcome back!</Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
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
              <TouchableOpacity disabled={loading}>
                <Ionicons name="mail" size={20} color="#4a90e2" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
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
                  size={20}
                  color="#4a90e2"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            onPress={handleForgotPassword}
            disabled={loading}
            style={styles.forgotContainer}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Log in</Text>
            )}
          </TouchableOpacity>

          {/* Sign UP Link */}
          <TouchableOpacity onPress={() => router.push("/register")} disabled={loading}>
            <Text style={styles.signupText}>
              Don't have an account yet?{" "}
              <Text style={styles.signupLink}>Sign UP</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7ff",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  backButton: {
    marginBottom: 16,
  },
  tagline: {
    fontSize: 13,
    color: "#4a90e2",
    fontWeight: "600",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#222",
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 14,
    color: "#333",
  },
  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: "#4a90e2",
    fontSize: 13,
    fontWeight: "600",
  },
  loginButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
    marginTop: 4,
  },
  loginButtonDisabled: {
    backgroundColor: "#a8c9e8",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  signupText: {
    textAlign: "center",
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  signupLink: {
    color: "#4a90e2",
    fontWeight: "700",
  },
});
