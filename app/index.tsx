import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../backend/firebaseConfig";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disabledModalVisible, setDisabledModalVisible] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tabWidth, setTabWidth] = useState(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTab = (toValue: number) => {
    Animated.timing(slideAnim, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !loading) {
        const employeeDoc = await getDoc(doc(firestore, "employee", user.uid));
        if (employeeDoc.exists()) {
          console.log("✅ Persistent login - routing to employee dashboard");
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
            console.log("✅ Persistent login - routing to home");
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

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!email || !password) {
      console.warn("Missing Fields: Please enter your email and password.");
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful!");

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
          errorMessage = "No account exists with this email address. Please check your email or register a new account.";
          break;
        case "auth/wrong-password":
          errorTitle = "Incorrect Password";
          errorMessage = "The password you entered is incorrect. Please try again or reset your password.";
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
          errorMessage = "Too many failed login attempts. Please try again later or reset your password.";
          break;
        case "auth/network-request-failed":
          errorTitle = "Network Error";
          errorMessage = "Unable to connect to the server. Please check your internet connection and try again.";
          break;
        case "auth/invalid-credential":
          errorTitle = "Invalid Credentials";
          errorMessage = "The email or password is incorrect. Please check your credentials and try again.";
          break;
        case "auth/operation-not-allowed":
          errorTitle = "Login Unavailable";
          errorMessage = "Email/password login is currently disabled. Please contact support.";
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
      Alert.alert("Reset Link Sent", `A password reset link has been sent to ${email}. Check your inbox.`);
    } catch (error: any) {
      console.log(error);
      Alert.alert("Reset Failed", error.message);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {checkingAuth ? (
        <View style={{ flex: 1, backgroundColor: '#0b1a3d', justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#f59e0b" />
        </View>
      ) : (
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

                <TouchableOpacity style={styles.tabBase} activeOpacity={1}>
                  <Animated.Text
                    style={[
                      styles.tabText,
                      {
                        color: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["#f59e0b", "#8895bb"],
                        }),
                      },
                    ]}
                  >
                    Log In
                  </Animated.Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    animateTab(1);
                    setTimeout(() => router.push("/register"), 200);
                  }}
                  style={styles.tabBase}
                  activeOpacity={1}
                >
                  <Animated.Text
                    style={[
                      styles.tabText,
                      {
                        color: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["#8895bb", "#f59e0b"],
                        }),
                      },
                    ]}
                  >
                    Sign Up
                  </Animated.Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>

              {/* Email Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail" size={20} color="#f59e0b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    placeholderTextColor="#8895bb"
                    style={styles.input}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputSection}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed" size={20} color="#f59e0b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    placeholderTextColor="#8895bb"
                    style={styles.input}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
                    <Ionicons name={showPassword ? "eye" : "eye-off"} size={18} color="#f59e0b" />
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
                <TouchableOpacity
                  onPress={() => {
                    animateTab(1);
                    setTimeout(() => router.push("/register"), 200);
                  }}
                  disabled={loading}
                  activeOpacity={1}
                >
                  <Text style={styles.signupLinkText}>Create an account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

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
    backgroundColor: "#0b1a3d",
  },
  scrollContent: {
    flexGrow: 1,
  },
  bannerSection: {
    backgroundColor: "#0b1a3d",
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

  // Tab styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#0f1e45",
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
    backgroundColor: "#4a5880",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "50%",
    height: 3,
    backgroundColor: "#f59e0b",
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
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 40,
    backgroundColor: "#0f1e45",
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
    color: "#e8eeff",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#162254",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
    color: "#f59e0b",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#e8eeff",
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
    color: "#f59e0b",
    fontWeight: "700",
  },
  actionButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  actionButtonDisabled: {
    backgroundColor: "#fbbf24",
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
    color: "#8895bb",
    fontWeight: "500",
  },
  signupLinkText: {
    fontSize: 14,
    color: "#f59e0b",
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
    backgroundColor: "#0f1e45",
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
    color: "#e8eeff",
    marginTop: 16,
    marginBottom: 8,
  },
  disabledMessage: {
    fontSize: 16,
    color: "#8895bb",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  disabledButton: {
    backgroundColor: "#f59e0b",
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