import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";
import { savePushTokenToFirestore, showLocalNotification } from "../../utils/notifications";

// Light theme exactly matching reports.tsx
const C = {
  bg: "#F8FAFC", surface: "#FFFFFF", surfaceAlt: "#F1F5F9", elevated: "#E2E8F0",
  text: "#0F172A", textMuted: "#64748B", textDim: "#94A3B8",
  gold: "#D97706", goldLight: "#F59E0B", goldDim: "rgba(217,119,6,0.08)", goldBorder: "rgba(217,119,6,0.2)",
  blue: "#1447c0", blueMid: "#2563EB", blueLight: "rgba(37,99,235,0.08)",
  red: "#DC2626", redLight: "rgba(220,38,38,0.08)",
  success: "#059669", successDim: "rgba(5,150,105,0.08)",
  border: "#E2E8F0", borderStrong: "#CBD5E1",
};

export default function EmployeeProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState<"address" | "phone" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);

  const [userData, setUserData] = useState<any>({});

  const refreshProfile = async () => {
    setRefreshing(true);
    const user = auth.currentUser; if (!user) { setRefreshing(false); return; }
    try {
      const snap = await getDoc(doc(firestore, "employee", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        const createdDate = d.createdAt?.toDate ? d.createdAt.toDate() : (d.createdAt ? new Date(d.createdAt) : new Date());
        setUserData({
          firstName: d.firstName || "", middleName: d.middleName || "", lastName: d.lastName || "",
          email: d.email || user.email || "", phone: d.number || "No phone number",
          address: d.address || "No address", purok: d.purok || "", age: d.age || "",
          memberSince: createdDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          id_verification: d.idImage || "", avatar: d.avatar || "",
          idstatus: d.idstatus || "Pending", declineMessage: d.declineMessage || "", residencyStatus: d.residencyStatus || "",
        });
      }
    } catch (e) { console.error(e); }
    setRefreshing(false);
  };

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));

    const user = auth.currentUser;
    if (!user) return;

    savePushTokenToFirestore("employee");

    let prevIdStatus: string | null = null;
    const unsub = onSnapshot(doc(firestore, "employee", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const currentIdStatus = data.idstatus || "Pending";
        
        if (prevIdStatus !== null && prevIdStatus !== currentIdStatus) {
          showLocalNotification(
            "ID Verification Update",
            `Your ID status is now: ${currentIdStatus}`,
            { screen: "profile" }
          );
          setUserData((p: any) => ({ ...p, idstatus: currentIdStatus, declineMessage: data.declineMessage || "" }));
        }
        prevIdStatus = currentIdStatus;
      }
    });

    return () => unsub();
  }, []);

  const getStatusMeta = (s: string) => {
    const l = (s || "pending").toLowerCase();
    if (l === "verified" || l === "approved") return { label: "Verified", color: C.success, bg: C.successDim, icon: "shield-checkmark" };
    if (l === "denied" || l === "declined") return { label: "Denied", color: C.red, bg: C.redLight, icon: "close-circle" };
    return { label: "Pending", color: C.gold, bg: C.goldDim, icon: "time" };
  };

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Required", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.1, base64: true });
    if (result.canceled || !result.assets?.length) return;
    const b64 = result.assets[0].base64; const user = auth.currentUser; if (!user || !b64) return;
    setUploading(true);
    try {
      const uri = `data:image/jpeg;base64,${b64}`;
      await updateDoc(doc(firestore, "employee", user.uid), { avatar: uri });
      setUserData((p:any) => ({ ...p, avatar: uri }));
      Alert.alert("Success", "Avatar updated!");
    } catch { Alert.alert("Error", "Failed to update avatar."); }
    finally { setUploading(false); }
  };

  const takeIDPhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Required", "Please allow camera access.");
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.1, base64: true });
    if (result.canceled || !result.assets?.length) return;
    await processIDUpload(result.assets[0].base64);
  };

  const pickIDImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Required", "Please allow photo access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.1, base64: true });
    if (result.canceled || !result.assets?.length) return;
    await processIDUpload(result.assets[0].base64);
  };

  const processIDUpload = async (b64?: string | null) => {
    const user = auth.currentUser; if (!user || !b64) return;
    setUploading(true);
    try {
      const uri = `data:image/jpeg;base64,${b64}`;
      await updateDoc(doc(firestore, "employee", user.uid), { idImage: uri, id_verification_uploaded_at: new Date().toISOString(), idstatus: "Pending" });
      setUserData((p:any) => ({ ...p, id_verification: uri, idstatus: "Pending" }));
      Alert.alert("Success", "ID uploaded! Verification pending.");
    } catch { Alert.alert("Error", "Failed to upload ID."); }
    finally { setUploading(false); }
  };

  const handleUploadID = () => {
    Alert.alert("Upload ID", "Choose an option", [
      { text: "Camera", onPress: takeIDPhoto },
      { text: "Gallery", onPress: pickIDImage },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const handleSaveEdit = async () => {
    if (!auth.currentUser || isSaving) return;
    const value = editValue.trim(); setIsSaving(true);
    try {
      if (isEditing === "phone" && !/^\d{11}$/.test(value)) { Alert.alert("Validation Error", "Mobile number must be exactly 11 digits."); setIsSaving(false); return; }
      if (isEditing === "address" && !value) { Alert.alert("Validation Error", "Address cannot be empty."); setIsSaving(false); return; }
      const key = isEditing === "phone" ? "number" : "address";
      await updateDoc(doc(firestore, "employee", auth.currentUser.uid), { [key]: value });
      setUserData((p:any) => ({ ...p, ...(isEditing === "address" ? { address: value } : { phone: value }) }));
      Alert.alert("Success", `${isEditing === "address" ? "Address" : "Phone"} updated!`);
      setIsEditing(null); setEditValue("");
    } catch { Alert.alert("Error", `Failed to update ${isEditing}.`); }
    finally { setIsSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) return Alert.alert("Required", "All fields are required.");
    if (newPw.length < 6) return Alert.alert("Weak", "New password must be at least 6 characters.");
    if (newPw !== confirmPw) return Alert.alert("Mismatch", "Passwords do not match.");
    const user = auth.currentUser; if (!user?.email) return;
    setIsChangingPw(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPw));
      await updatePassword(user, newPw);
      Alert.alert("Success", "Password changed!");
      setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) { Alert.alert("Error", "Failed to change password. Current password might be incorrect."); }
    finally { setIsChangingPw(false); }
  };

  const confirmLogout = async () => { try { await signOut(auth); setShowLogout(false); router.replace("/"); } catch { Alert.alert("Error", "Log out failed"); } };

  const fullName = `${userData.firstName || ""} ${userData.middleName || ""} ${userData.lastName || ""}`.trim() || "User";
  const meta = getStatusMeta(userData.idstatus);

  if (loading) return <SafeAreaView style={st.safe}><View style={st.center}><ActivityIndicator size="large" color={C.gold} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={st.safe} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        {/* Header matching reports.tsx */}
        <View style={[st.header, { paddingTop: insets.top + 14 }]}>
          <Text style={st.eyebrow}>ACCOUNT</Text>
          <Text style={st.title}>My Profile</Text>
          <Text style={st.subtitle}>Manage details & identity</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProfile} tintColor={C.gold} />}>
          
          {/* Identity Box */}
          <View style={st.section}>
            <Text style={st.secEye}>IDENTITY</Text>
            <View style={st.card}>
              <View style={st.profileTop}>
                <TouchableOpacity onPress={handleAvatarUpload} style={st.avatarWrap}>
                  {userData.avatar ? <Image source={{ uri: userData.avatar }} style={st.avatar} /> : <View style={st.avatarEmpty}><Ionicons name="person" size={24} color={C.textDim} /></View>}
                  <View style={st.avatarBadge}>{uploading ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="camera" size={12} color="#FFF" />}</View>
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={st.nameText}>{fullName}</Text>
                  <Text style={st.memberText}>Joined {userData.memberSince}</Text>
                  <View style={[st.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + "33" }]}>
                    <Ionicons name={meta.icon as any} size={12} color={meta.color} />
                    <Text style={[st.statusPillText, { color: meta.color }]}>ID {meta.label}</Text>
                  </View>
                </View>
              </View>

              <View style={st.divider} />
              
              <View style={st.recordRow}>
                <View style={st.recordLeft}><Ionicons name="mail" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Email</Text></View>
                <Text style={st.recordValue}>{userData.email}</Text>
              </View>
              <View style={st.recordRow}>
                <View style={st.recordLeft}><Ionicons name="call" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Phone</Text></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={st.recordValue}>{userData.phone}</Text>
                  <TouchableOpacity onPress={() => { setEditValue(userData.phone); setIsEditing("phone"); }}><Ionicons name="pencil" size={16} color={C.gold} /></TouchableOpacity>
                </View>
              </View>
              <View style={st.recordRow}>
                <View style={st.recordLeft}><Ionicons name="location" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Address</Text></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" }}>
                  <Text style={st.recordValue} numberOfLines={1}>{userData.purok ? `Purok ${userData.purok}, ` : ""}{userData.address}</Text>
                  <TouchableOpacity onPress={() => { setEditValue(userData.address); setIsEditing("address"); }}><Ionicons name="pencil" size={16} color={C.gold} /></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Document Verification */}
          <View style={st.section}>
            <Text style={st.secEye}>VERIFICATION</Text>
            <View style={st.card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Text style={st.cardTitle}>Government ID</Text>
                <View style={[st.statusPill, { backgroundColor: meta.bg, borderColor: meta.color + "33", marginTop: 0 }]}><Ionicons name={meta.icon as any} size={12} color={meta.color} /><Text style={[st.statusPillText, { color: meta.color }]}>{meta.label}</Text></View>
              </View>
              
              {meta.label === "Denied" && (
                <View style={st.noticeBox}>
                  <Ionicons name="warning" size={16} color={C.red} />
                  <Text style={st.noticeText}>Rejected: {userData.declineMessage || "Please upload a clearer ID."}</Text>
                </View>
              )}

              {userData.id_verification ? (
                <>
                  <Image source={{ uri: userData.id_verification }} style={st.idImg} resizeMode="cover" />
                  <TouchableOpacity style={st.btnOutline} onPress={handleUploadID} disabled={uploading}>
                    {uploading ? <ActivityIndicator color={C.text} size="small" /> : <><Ionicons name="cloud-upload-outline" size={16} color={C.text} /><Text style={st.btnOutlineText}>Re-upload ID</Text></>}
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <Ionicons name="card-outline" size={48} color={C.textDim} />
                  <Text style={{ fontSize: 13, color: C.textMuted, marginVertical: 12, textAlign: "center" }}>No ID uploaded. Please provide a valid ID to access full features.</Text>
                  <TouchableOpacity style={[st.btnPrimary, { alignSelf: "stretch" }]} onPress={handleUploadID} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#FFF" size="small" /> : <><Ionicons name="cloud-upload" size={16} color="#FFF" /><Text style={st.btnPrimaryText}>Upload ID</Text></>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Security */}
          <View style={st.section}>
            <Text style={st.secEye}>SECURITY</Text>
            <TouchableOpacity style={st.actionBtn} onPress={() => setShowChangePw(true)}>
              <View style={[st.actionIconWrap, { backgroundColor: C.surfaceAlt }]}><Ionicons name="lock-closed" size={16} color={C.text} /></View>
              <Text style={st.actionBtnText}>Change Password</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[st.actionBtn, { borderColor: C.redLight }]} onPress={() => setShowLogout(true)}>
              <View style={[st.actionIconWrap, { backgroundColor: C.redLight }]}><Ionicons name="log-out" size={16} color={C.red} /></View>
              <Text style={[st.actionBtnText, { color: C.red }]}>Log Out</Text>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* EDIT MODAL */}
      <Modal visible={isEditing !== null} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }}>
            <View style={st.modalContent}>
              <View style={st.modalHeaderRow}>
                <Text style={st.modalTitle}>Edit {isEditing === "address" ? "Address" : "Phone"}</Text>
                <TouchableOpacity onPress={() => setIsEditing(null)} style={st.modalClose}><Ionicons name="close" size={20} color={C.textMuted} /></TouchableOpacity>
              </View>
              <TextInput
                style={st.input} value={editValue} onChangeText={setEditValue}
                placeholder={isEditing === "address" ? "Street, Barangay" : "11-digit mobile"} placeholderTextColor={C.textDim}
                keyboardType={isEditing === "phone" ? "phone-pad" : "default"} maxLength={isEditing === "phone" ? 11 : undefined}
                multiline={isEditing === "address"} numberOfLines={isEditing === "address" ? 3 : 1}
              />
              <View style={st.btnRow}>
                <TouchableOpacity style={st.btnGhost} onPress={() => setIsEditing(null)} disabled={isSaving}><Text style={st.btnGhostText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[st.btnPrimary, { flex: 1.5 }, (!editValue.trim() || isSaving) && { opacity: 0.5 }]} onPress={handleSaveEdit} disabled={isSaving || !editValue.trim()}>
                  {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnPrimaryText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal visible={showChangePw} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center" }}>
            <View style={st.modalContent}>
              <View style={st.modalHeaderRow}>
                <Text style={st.modalTitle}>Change Password</Text>
                <TouchableOpacity onPress={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} style={st.modalClose}><Ionicons name="close" size={20} color={C.textMuted} /></TouchableOpacity>
              </View>
              <View style={{ gap: 12 }}>
                <TextInput style={st.input} value={currentPw} onChangeText={setCurrentPw} placeholder="Current Password" secureTextEntry placeholderTextColor={C.textDim} />
                <TextInput style={st.input} value={newPw} onChangeText={setNewPw} placeholder="New Password" secureTextEntry placeholderTextColor={C.textDim} />
                <TextInput style={st.input} value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm New Password" secureTextEntry placeholderTextColor={C.textDim} />
              </View>
              <View style={[st.btnRow, { marginTop: 24 }]}>
                <TouchableOpacity style={st.btnGhost} onPress={() => { setShowChangePw(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }} disabled={isChangingPw}><Text style={st.btnGhostText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[st.btnPrimary, { flex: 1.5 }, isChangingPw && { opacity: 0.5 }]} onPress={handleChangePassword} disabled={isChangingPw}>
                  {isChangingPw ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnPrimaryText}>Update</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* LOGOUT MODAL */}
      <Modal visible={showLogout} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { alignItems: "center", padding: 30 }]}>
            <View style={[st.actionIconWrap, { width: 64, height: 64, borderRadius: 32, backgroundColor: C.redLight, marginBottom: 16 }]}><Ionicons name="log-out" size={32} color={C.red} /></View>
            <Text style={st.modalTitle}>Log Out</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: "center", marginTop: 8, marginBottom: 24 }}>Are you sure you want to log out of your account?</Text>
            <View style={st.btnRow}>
              <TouchableOpacity style={st.btnGhost} onPress={() => setShowLogout(false)}><Text style={st.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[st.btnPrimary, { flex: 1.5, backgroundColor: C.red }]} onPress={confirmLogout}><Text style={st.btnPrimaryText}>Log Out</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 22, paddingBottom: 18, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.textMuted, fontWeight: "600" },

  section: { paddingHorizontal: 18, marginTop: 24 },
  secEye: { color: C.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 },
  
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  profileTop: { flexDirection: "row", alignItems: "center" },
  avatarWrap: { position: "relative" },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.surfaceAlt },
  avatarEmpty: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.border },
  avatarBadge: { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: C.text, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.surface },
  nameText: { fontSize: 18, fontWeight: "900", color: C.text },
  memberText: { fontSize: 12, fontWeight: "600", color: C.textMuted, marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  statusPillText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  
  divider: { height: 1, backgroundColor: C.border, marginVertical: 16 },
  recordRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  recordLeft: { flexDirection: "row", alignItems: "center", gap: 8, width: 100 },
  recordLabel: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  recordValue: { fontSize: 13, fontWeight: "800", color: C.text },

  cardTitle: { fontSize: 16, fontWeight: "900", color: C.text },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.redLight, padding: 12, borderRadius: 12, marginBottom: 14 },
  noticeText: { fontSize: 12, fontWeight: "700", color: C.red, flex: 1 },
  idImg: { width: "100%", height: 180, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  
  btnOutline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  btnOutlineText: { fontSize: 13, fontWeight: "800", color: C.text },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: C.text, width: "100%" },
  btnPrimaryText: { fontSize: 13, fontWeight: "800", color: "#FFF" },

  actionBtn: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.surface, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  actionIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionBtnText: { flex: 1, fontSize: 15, fontWeight: "800", color: C.text },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "center", padding: 20 },
  modalContent: { backgroundColor: C.bg, borderRadius: 24, padding: 24, width: "100%", maxWidth: 400 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  input: { backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15, fontWeight: "500" },
  
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnGhost: { flex: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  btnGhostText: { fontSize: 14, fontWeight: "800", color: C.textMuted },
});
