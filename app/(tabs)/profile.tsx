import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

// ── Palette — exact mirror of complain.tsx ────────────────────────────────────
const COLORS = {
  bg:         "#080f26",
  surface:    "#0f1e45",
  surfaceAlt: "#0d1a3c",
  elevated:   "#162254",

  text:       "#E8EEFF",
  textMuted:  "#8895BB",
  textDim:    "#4A5880",

  gold:       "#f59e0b",
  goldLight:  "#fbbf24",
  goldDim:    "rgba(245,158,11,0.15)",
  goldBorder: "rgba(245,158,11,0.3)",

  blue:       "#1447c0",
  blueMid:    "#1E56D8",
  blueLight:  "rgba(20,71,192,0.3)",
  red:        "#ce1126",
  redLight:   "rgba(206,17,38,0.25)",

  pending:    "#f59e0b",
  inProgress: "#3b82f6",
  resolved:   "#10b981",
  danger:     "#ef4444",
  success:    "#10b981",

  border:     "rgba(255,255,255,0.06)",
  borderGold: "rgba(245,158,11,0.2)",
};

// ── Types ────────────────────────────────────────────────────────────────────
type UserData = {
  firstName: string; middleName: string; lastName: string;
  email: string; phone: string; address: string; purok: string;
  age: string; memberSince: string; id_verification: string;
  avatar: string; idstatus: "Pending" | "Denied" | "declined" | "Verified";
  declineMessage: string; residencyStatus: string;
};
type EditingField = "address" | "phone" | null;

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ style }: { style: any }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[style, { opacity: pulse, backgroundColor: COLORS.elevated }]} />;
}

// ── Info Row — mirrors complain.tsx detailRow ─────────────────────────────────
function InfoRow({ icon, label, value, actionLabel, onAction }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: string;
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Ionicons name={icon} size={17} color={COLORS.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value || "—"}</Text>
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} style={s.editPill}>
          <Ionicons name="create-outline" size={13} color={COLORS.bg} />
          <Text style={s.editPillText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Password input row ────────────────────────────────────────────────────────
function PasswordInput({ value, onChange, placeholder, show, onToggle }: {
  value: string; onChange: (v: string) => void;
  placeholder: string; show: boolean; onToggle: () => void;
}) {
  return (
    <View style={s.passwordRow}>
      <TextInput
        style={s.passwordInput}
        value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={COLORS.textDim}
        secureTextEntry={!show}
      />
      <TouchableOpacity onPress={onToggle} style={s.eyeBtn}>
        <Ionicons name={show ? "eye-outline" : "eye-off-outline"} size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [refreshing,  setRefreshing]  = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);

  const [isEditing,   setIsEditing]   = useState<EditingField>(null);
  const [editValue,   setEditValue]   = useState("");
  const [isSaving,    setIsSaving]    = useState(false);

  const [showLogout,       setShowLogout]       = useState(false);
  const [showChangePw,     setShowChangePw]     = useState(false);
  const [currentPw,        setCurrentPw]        = useState("");
  const [newPw,            setNewPw]            = useState("");
  const [confirmPw,        setConfirmPw]        = useState("");
  const [isChangingPw,     setIsChangingPw]     = useState(false);
  const [showCurrentPw,    setShowCurrentPw]    = useState(false);
  const [showNewPw,        setShowNewPw]        = useState(false);
  const [showConfirmPw,    setShowConfirmPw]    = useState(false);

  const [userData, setUserData] = useState<UserData>({
    firstName: "", middleName: "", lastName: "", email: "", phone: "",
    address: "", purok: "", age: "", memberSince: "", id_verification: "",
    avatar: "", idstatus: "Pending", declineMessage: "", residencyStatus: "",
  });

  const refreshProfile = async () => {
    setRefreshing(true);
    const user = auth.currentUser; if (!user) { setRefreshing(false); return; }
    try {
      const snap = await getDoc(doc(firestore, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        const createdDate = d.createdAt?.toDate ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt) : new Date());
        setUserData({
          firstName: d.firstName || "", middleName: d.middleName || "", lastName: d.lastName || "",
          email: d.email || user.email || "", phone: d.number || "No phone number",
          address: d.address || "No address", purok: d.purok || "", age: d.age || "",
          memberSince: createdDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          id_verification: d.idImage || "", avatar: d.avatar || "",
          idstatus: d.idstatus || "Pending", declineMessage: d.declineMessage || "",
          residencyStatus: d.residencyStatus || "",
        });
      }
    } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  useEffect(() => { refreshProfile().finally(() => setLoading(false)); }, []);

  const getStatusColor = (s: string) =>
    ({ Verified: COLORS.success, Denied: COLORS.danger, declined: COLORS.danger }[s] ?? COLORS.gold);

  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: "", color: "transparent", pct: 0 };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const map = [
      { label: "", color: "transparent", pct: 0 },
      { label: "Weak",      color: COLORS.danger,  pct: 0.2 },
      { label: "Fair",      color: COLORS.gold,    pct: 0.4 },
      { label: "Good",      color: COLORS.gold,    pct: 0.6 },
      { label: "Strong",    color: COLORS.success, pct: 0.8 },
      { label: "Very Strong", color: COLORS.success, pct: 1.0 },
    ];
    return map[Math.min(score, 5)];
  };

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission Required", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.1, base64: true });
    if (result.canceled || !result.assets?.length) return;
    const b64 = result.assets[0].base64;
    const user = auth.currentUser;
    if (!user || !b64) return;
    if (Math.ceil(b64.length * 0.75) > 700000) { Alert.alert("Image Too Large", "Please choose a smaller image."); return; }
    setUploading(true);
    try {
      const uri = `data:image/jpeg;base64,${b64}`;
      await updateDoc(doc(firestore, "users", user.uid), { avatar: uri });
      setUserData((p) => ({ ...p, avatar: uri }));
      Alert.alert("Success", "Avatar updated!");
    } catch { Alert.alert("Error", "Failed to update avatar."); }
    finally { setUploading(false); }
  };

  const handleUploadID = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission Required", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.1, base64: true });
    if (result.canceled || !result.assets?.length) return;
    const b64 = result.assets[0].base64;
    const user = auth.currentUser;
    if (!user || !b64) return;
    if (Math.ceil(b64.length * 0.75) > 700000) { Alert.alert("Image Too Large", "Please choose a smaller image."); return; }
    setUploading(true);
    try {
      const uri = `data:image/jpeg;base64,${b64}`;
      await updateDoc(doc(firestore, "users", user.uid), { idImage: uri, id_verification_uploaded_at: new Date().toISOString(), idstatus: "Pending" });
      setUserData((p) => ({ ...p, id_verification: uri, idstatus: "Pending" }));
      Alert.alert("Success", "ID uploaded! Verification pending.");
    } catch { Alert.alert("Error", "Failed to upload ID."); }
    finally { setUploading(false); }
  };

  const handleSaveEdit = async () => {
    if (!auth.currentUser || isSaving) return;
    const value = editValue.trim();
    setIsSaving(true);
    try {
      if (isEditing === "phone" && !/^\d{11}$/.test(value)) { Alert.alert("Validation Error", "Mobile number must be exactly 11 digits."); return; }
      if (isEditing === "address" && !value) { Alert.alert("Validation Error", "Address cannot be empty."); return; }
      const key = isEditing === "phone" ? "number" : "address";
      await updateDoc(doc(firestore, "users", auth.currentUser.uid), { [key]: value });
      setUserData((p) => ({ ...p, ...(isEditing === "address" ? { address: value } : { phone: value }) }));
      Alert.alert("Success", `${isEditing === "address" ? "Address" : "Phone"} updated!`);
      setIsEditing(null); setEditValue("");
    } catch { Alert.alert("Error", `Failed to update ${isEditing}.`); }
    finally { setIsSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) { Alert.alert("Validation Error", "All fields are required."); return; }
    if (newPw.length < 6) { Alert.alert("Validation Error", "New password must be at least 6 characters."); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(newPw)) { Alert.alert("Weak Password", "Password must include uppercase, lowercase, and a number."); return; }
    if (newPw !== confirmPw) { Alert.alert("Validation Error", "Passwords do not match."); return; }
    const user = auth.currentUser;
    if (!user?.email) return;
    setIsChangingPw(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPw));
      await updatePassword(user, newPw);
      Alert.alert("Success", "Password changed!");
      setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) {
      Alert.alert("Error", e.code === "auth/wrong-password" || e.code === "auth/invalid-credential" ? "Current password is incorrect." : "Failed to change password.");
    } finally { setIsChangingPw(false); }
  };

  const confirmLogout = async () => {
    try { await signOut(auth); setShowLogout(false); router.replace("/"); }
    catch { Alert.alert("Error", "Failed to log out"); }
  };

  const fullName    = `${userData.firstName} ${userData.middleName} ${userData.lastName}`.trim() || "User";
  const fullAddress = userData.purok ? `Purok ${userData.purok}, ${userData.address}` : userData.address;
  const pwStrength  = getPasswordStrength(newPw);

  // ── LOADING STATE ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={["#0b1a3d", "#111f50"]} style={[s.header, { paddingTop: insets.top + 12 }]}>
          <View style={s.headerRing} />
          <View style={s.headerRow}>
            <Skeleton style={{ width: 100, height: 12, borderRadius: 4 }} />
            <Text style={s.headerTitle}>My Profile</Text>
            <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
          </View>
          <View style={s.avatarSection}>
            <Skeleton style={s.avatar} />
            <Skeleton style={{ width: 140, height: 20, borderRadius: 8, marginTop: 12 }} />
            <Skeleton style={{ width: 100, height: 12, borderRadius: 6, marginTop: 8 }} />
          </View>
          <View style={[s.headerAccentLine, { backgroundColor: COLORS.gold }]} />
        </LinearGradient>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>
          {[1, 2].map((i) => (
            <View key={i} style={[s.card, { marginBottom: 14 }]}>
              <Skeleton style={{ width: 120, height: 16, borderRadius: 6, marginBottom: 16 }} />
              <View style={s.cardDivider} />
              {[1, 2, 3].map((j) => (
                <View key={j} style={[s.infoRow, { marginBottom: 0 }]}>
                  <Skeleton style={s.infoIconWrap} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton style={{ width: 50, height: 10, borderRadius: 4 }} />
                    <Skeleton style={{ width: "75%", height: 14, borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── MAIN UI ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <LinearGradient colors={["#0b1a3d", "#111f50"]} style={[s.header, { paddingTop: insets.top + 12 }]}>
        {/* Blurred avatar bg */}
        {userData.avatar ? (
          <Image source={{ uri: userData.avatar }} style={StyleSheet.absoluteFillObject} blurRadius={14} resizeMode="cover" />
        ) : null}
        <LinearGradient
          colors={["rgba(8,15,38,0.88)", "rgba(11,26,61,0.94)"]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={s.headerRing} />

        <View style={s.headerRow}>
          <Text style={s.headerEyebrow}>BARANGAY SAN ROQUE</Text>
          <Text style={s.headerTitle}>My Profile</Text>
          <View style={s.headerIconWrap}>
            <Ionicons name="person" size={22} color={COLORS.gold} />
          </View>
        </View>

        {/* Avatar section */}
        <View style={s.avatarSection}>
          <TouchableOpacity onPress={handleAvatarUpload} style={s.avatarWrap}>
            {userData.avatar ? (
              <Image source={{ uri: userData.avatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={COLORS.textDim} />
              </View>
            )}
            <View style={s.avatarBadge}>
              {uploading
                ? <ActivityIndicator size="small" color={COLORS.bg} />
                : <Ionicons name="camera" size={15} color={COLORS.bg} />
              }
            </View>
          </TouchableOpacity>
          <Text style={s.nameText}>{fullName}</Text>
          <Text style={s.memberText}>Member since {userData.memberSince}</Text>

          {/* ID status pill */}
          <View style={[s.statusPill, { backgroundColor: getStatusColor(userData.idstatus) + "22", borderColor: getStatusColor(userData.idstatus) + "44" }]}>
            <View style={[s.statusDot, { backgroundColor: getStatusColor(userData.idstatus) }]} />
            <Text style={[s.statusPillText, { color: getStatusColor(userData.idstatus) }]}>
              ID {userData.idstatus}
            </Text>
          </View>
        </View>

        <View style={[s.headerAccentLine, { backgroundColor: COLORS.gold }]} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 130 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProfile} tintColor={COLORS.gold} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── PERSONAL DETAILS ── */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleIcon}>
              <Ionicons name="person-outline" size={16} color={COLORS.gold} />
            </View>
            <Text style={s.cardTitle}>Personal Details</Text>
          </View>
          <View style={s.cardDivider} />

          <InfoRow icon="mail-outline"     label="Email"            value={userData.email} />
          <InfoRow icon="call-outline"     label="Phone"            value={userData.phone}          actionLabel="Edit" onAction={() => { setEditValue(userData.phone); setIsEditing("phone"); }} />
          <InfoRow icon="location-outline" label="Address"          value={fullAddress || "No Address"} actionLabel="Edit" onAction={() => { setEditValue(userData.address); setIsEditing("address"); }} />
          {!!userData.age              && <InfoRow icon="calendar-outline" label="Age"              value={userData.age} />}
          {!!userData.residencyStatus  && <InfoRow icon="home-outline"     label="Residency Status" value={userData.residencyStatus} />}
        </View>

        {/* ── IDENTITY VERIFICATION ── */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <View style={s.cardTitleIcon}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.gold} />
            </View>
            <Text style={s.cardTitle}>Identity Verification</Text>
          </View>
          <View style={s.cardDivider} />

          {userData.id_verification ? (
            <View style={{ gap: 14 }}>
              <Image source={{ uri: userData.id_verification }} style={s.idImage} resizeMode="cover" />

              <View style={[s.idStatusRow, { backgroundColor: getStatusColor(userData.idstatus) + "18", borderColor: getStatusColor(userData.idstatus) + "40" }]}>
                <View style={[s.statusDot, { backgroundColor: getStatusColor(userData.idstatus) }]} />
                <Text style={[s.idStatusText, { color: getStatusColor(userData.idstatus) }]}>{userData.idstatus}</Text>
              </View>

              {userData.idstatus === "declined" && (
                <View style={s.noticeBox}>
                  <View style={s.noticeIconWrap}>
                    <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
                  </View>
                  <Text style={s.noticeText}>
                    Your ID was rejected{userData.declineMessage ? `: ${userData.declineMessage}` : ""}. Please re-upload a valid ID.
                  </Text>
                </View>
              )}

              <TouchableOpacity onPress={handleUploadID} disabled={uploading} style={s.secondaryBtn}>
                {uploading ? <ActivityIndicator size="small" color={COLORS.gold} /> : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={COLORS.gold} />
                    <Text style={s.secondaryBtnText}>Re-upload ID</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={s.noticeBox}>
                <View style={s.noticeIconWrap}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.gold} />
                </View>
                <Text style={s.noticeText}>
                  Upload a valid government ID to verify your account and unlock all features.
                </Text>
              </View>
              <TouchableOpacity onPress={handleUploadID} disabled={uploading} style={{ borderRadius: 16, overflow: "hidden" }}>
                <LinearGradient colors={["#f59e0b", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primaryBtn}>
                  {uploading ? <ActivityIndicator size="small" color={COLORS.bg} /> : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={COLORS.bg} />
                      <Text style={s.primaryBtnText}>Upload ID Now</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── CHANGE PASSWORD ── */}
        <TouchableOpacity onPress={() => setShowChangePw(true)} style={s.outlineBtn}>
          <View style={s.outlineBtnIcon}>
            <Ionicons name="lock-closed-outline" size={17} color={COLORS.gold} />
          </View>
          <Text style={s.outlineBtnText}>Change Password</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
        </TouchableOpacity>

        {/* ── LOGOUT ── */}
        <TouchableOpacity onPress={() => setShowLogout(true)} style={s.dangerBtn}>
          <View style={s.dangerBtnIcon}>
            <Ionicons name="log-out-outline" size={17} color={COLORS.danger} />
          </View>
          <Text style={s.dangerBtnText}>Log Out</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textDim} />
        </TouchableOpacity>
      </ScrollView>

      {/* ── EDIT MODAL ── */}
      <Modal visible={isEditing !== null} transparent animationType="slide" onRequestClose={() => setIsEditing(null)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }}>
            <View style={s.formModal}>
              <View style={s.modalHandle} />
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>{isEditing === "address" ? "Edit Address" : "Edit Phone Number"}</Text>
                <TouchableOpacity onPress={() => setIsEditing(null)} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.formInput}
                value={editValue} onChangeText={setEditValue}
                placeholder={isEditing === "address" ? "Street, Barangay, City" : "11-digit mobile number"}
                placeholderTextColor={COLORS.textDim}
                keyboardType={isEditing === "phone" ? "phone-pad" : "default"}
                maxLength={isEditing === "phone" ? 11 : undefined}
                multiline={isEditing === "address"}
                numberOfLines={isEditing === "address" ? 3 : 1}
              />
              <View style={s.modalBtnRow}>
                <TouchableOpacity onPress={() => setIsEditing(null)} disabled={isSaving} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit} disabled={isSaving || !editValue.trim()}
                  style={[{ flex: 1.4, borderRadius: 16, overflow: "hidden" }, (!editValue.trim() || isSaving) && { opacity: 0.4 }]}
                >
                  <LinearGradient colors={["#f59e0b", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtn}>
                    {isSaving ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.saveBtnText}>Save Changes</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── LOGOUT MODAL ── */}
      <Modal visible={showLogout} transparent animationType="fade" onRequestClose={() => setShowLogout(false)}>
        <View style={s.modalOverlay}>
          <View style={s.alertModal}>
            <LinearGradient colors={["#0b1a3d", "#1a3060"]} style={s.alertGradient}>
              <View style={[s.alertIconWrap, { backgroundColor: COLORS.redLight, borderColor: COLORS.red + "44" }]}>
                <Ionicons name="log-out-outline" size={34} color={COLORS.danger} />
              </View>
              <Text style={s.alertTitle}>Log Out?</Text>
              <Text style={s.alertSub}>You'll need to sign in again to access your account.</Text>
              <View style={s.modalBtnRow}>
                <TouchableOpacity onPress={() => setShowLogout(false)} style={s.cancelBtn}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmLogout} style={{ flex: 1.4, borderRadius: 16, overflow: "hidden" }}>
                  <LinearGradient colors={[COLORS.danger, "#b91c1c"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtn}>
                    <Text style={s.saveBtnText}>Log Out</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* ── CHANGE PASSWORD MODAL ── */}
      <Modal visible={showChangePw} transparent animationType="slide" onRequestClose={() => setShowChangePw(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }}>
            <View style={s.formModal}>
              <View style={s.modalHandle} />
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Change Password</Text>
                <TouchableOpacity onPress={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} style={s.closeBtn}>
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12 }}>
                  <PasswordInput value={currentPw} onChange={setCurrentPw} placeholder="Current Password" show={showCurrentPw} onToggle={() => setShowCurrentPw((p) => !p)} />
                  <PasswordInput value={newPw}     onChange={setNewPw}     placeholder="New Password"     show={showNewPw}     onToggle={() => setShowNewPw((p) => !p)} />

                  {/* Strength bar */}
                  {newPw.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <View style={s.strengthTrack}>
                        <Animated.View style={[s.strengthFill, { width: `${pwStrength.pct * 100}%`, backgroundColor: pwStrength.color }]} />
                      </View>
                      <Text style={[s.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
                    </View>
                  )}

                  <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Confirm New Password" show={showConfirmPw} onToggle={() => setShowConfirmPw((p) => !p)} />

                  {confirmPw.length > 0 && (
                    <View style={s.matchRow}>
                      <Ionicons name={newPw === confirmPw ? "checkmark-circle" : "close-circle"} size={15} color={newPw === confirmPw ? COLORS.success : COLORS.danger} />
                      <Text style={[s.matchText, { color: newPw === confirmPw ? COLORS.success : COLORS.danger }]}>
                        {newPw === confirmPw ? "Passwords match" : "Passwords do not match"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[s.modalBtnRow, { marginTop: 18 }]}>
                  <TouchableOpacity onPress={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} disabled={isChangingPw} style={s.cancelBtn}>
                    <Text style={s.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleChangePassword} disabled={isChangingPw} style={{ flex: 1.4, borderRadius: 16, overflow: "hidden" }}>
                    <LinearGradient colors={["#f59e0b", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.saveBtn}>
                      {isChangingPw ? <ActivityIndicator color={COLORS.bg} /> : <Text style={s.saveBtnText}>Update Password</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  // Header — mirrors complain.tsx
  header:          { paddingHorizontal: 22, paddingBottom: 24, overflow: "hidden" },
  headerRing:      { position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: "rgba(245,158,11,0.08)", top: -80, right: -60 },
  headerRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  headerEyebrow:   { color: "rgba(245,158,11,0.65)", fontSize: 9, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase" },
  headerTitle:     { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerIconWrap:  { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  headerAccentLine:{ height: 1, opacity: 0.3, marginTop: 22 },

  // Avatar section
  avatarSection:       { alignItems: "center", gap: 6 },
  avatarWrap:          { position: "relative", marginBottom: 4 },
  avatar:              { width: 100, height: 100, borderRadius: 50, borderWidth: 2.5, borderColor: COLORS.gold },
  avatarPlaceholder:   { backgroundColor: COLORS.elevated, justifyContent: "center", alignItems: "center" },
  avatarBadge:         { position: "absolute", right: 0, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.gold, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: COLORS.bg },
  nameText:            { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 4 },
  memberText:          { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  statusPill:          { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  statusDot:           { width: 8, height: 8, borderRadius: 4 },
  statusPillText:      { fontSize: 12, fontWeight: "800" },

  // Scroll
  scroll: { paddingHorizontal: 18, paddingTop: 18 },

  // Cards — mirrors complain.tsx
  card:         { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  cardTitleIcon:{ width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  cardTitle:    { color: COLORS.text, fontSize: 15, fontWeight: "900" },
  cardDivider:  { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },

  // Info rows — mirrors complain.tsx detailRow
  infoRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoIconWrap:{ width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  infoLabel:   { color: COLORS.textDim, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  infoValue:   { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  editPill:    { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  editPillText:{ color: COLORS.bg, fontSize: 12, fontWeight: "800" },

  // ID
  idImage:     { width: "100%", height: 190, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  idStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  idStatusText:{ fontSize: 13, fontWeight: "800" },

  // Notice — mirrors complain.tsx goldDim notice
  noticeBox:     { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, borderRadius: 16, padding: 14 },
  noticeIconWrap:{ width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  noticeText:    { flex: 1, color: COLORS.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 },

  // Buttons — mirrors complain.tsx FAB / submitBtn
  primaryBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  primaryBtnText:{ color: COLORS.bg, fontWeight: "900", fontSize: 15 },
  secondaryBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.goldBorder, backgroundColor: COLORS.goldDim },
  secondaryBtnText:{ color: COLORS.gold, fontWeight: "800", fontSize: 14 },
  outlineBtn:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 16, marginBottom: 10 },
  outlineBtnIcon:{ width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  outlineBtnText:{ flex: 1, color: COLORS.text, fontWeight: "800", fontSize: 15 },
  dangerBtn:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: "rgba(206,17,38,0.25)", borderRadius: 18, padding: 16, marginBottom: 10 },
  dangerBtnIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.redLight, borderWidth: 1, borderColor: "rgba(206,17,38,0.3)", justifyContent: "center", alignItems: "center" },
  dangerBtnText: { flex: 1, color: COLORS.danger, fontWeight: "800", fontSize: 15 },

  // Modals — mirrors complain.tsx modal anatomy
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 12 },
  formModal:    { backgroundColor: COLORS.surface, borderRadius: 30, padding: 22, width: "100%", maxWidth: 500, maxHeight: "88%", borderWidth: 1, borderColor: COLORS.border },
  modalHandle:  { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.elevated, alignSelf: "center", marginBottom: 18 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  modalTitle:   { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  closeBtn:     { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.elevated, justifyContent: "center", alignItems: "center" },
  formInput:    { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 15, marginBottom: 16 },
  modalBtnRow:  { flexDirection: "row", gap: 10 },
  cancelBtn:    { flex: 1, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  cancelBtnText:{ color: COLORS.textMuted, fontSize: 15, fontWeight: "800" },
  saveBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 16 },
  saveBtnText:  { color: COLORS.bg, fontSize: 15, fontWeight: "900" },

  // Alert modal — mirrors complain.tsx successModal
  alertModal:    { width: "88%", maxWidth: 370, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  alertGradient: { padding: 30, alignItems: "center" },
  alertIconWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, justifyContent: "center", alignItems: "center", marginBottom: 18 },
  alertTitle:    { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 10 },
  alertSub:      { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 22 },

  // Password inputs
  passwordRow:   { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14 },
  passwordInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: COLORS.text },
  eyeBtn:        { paddingHorizontal: 12, paddingVertical: 12 },
  strengthTrack: { height: 4, backgroundColor: COLORS.elevated, borderRadius: 2, overflow: "hidden" },
  strengthFill:  { height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: "800" },
  matchRow:      { flexDirection: "row", alignItems: "center", gap: 5 },
  matchText:     { fontSize: 12, fontWeight: "700" },
});