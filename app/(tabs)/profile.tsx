import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../backend/firebaseConfig";

type UserData = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  purok: string;
  age: string;
  memberSince: string;
  id_verification: string;
  avatar: string;
  idstatus: "Pending" | "Denied" | "Verified";
};

type EditingField = "address" | "phone" | null;

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#4F46E5", // indigo-600
  primaryDark: "#4338CA",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
};

export default function ProfilePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [complaintsFiled, setComplaintsFiled] = useState(0);
  const [complaintsResolved, setComplaintsResolved] = useState(0);

  const [isEditing, setIsEditing] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [userData, setUserData] = useState<UserData>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    purok: "",
    age: "",
    memberSince: "",
    id_verification: "",
    avatar: "",
    idstatus: "Pending",
  });

  // ===== LOGIC (same as yours) =====
  const fetchComplaintsStats = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const complaintsRef = ref(db, `users/${currentUser.uid}/userComplaints`);
      const snapshot = await get(complaintsRef);
      if (snapshot.exists()) {
        const complaints = snapshot.val();
        const allComplaints = Object.values(complaints);
        const resolvedComplaints = allComplaints.filter(
          (c: any) => c.status?.toLowerCase() === "resolved"
        );
        setComplaintsFiled(allComplaints.length);
        setComplaintsResolved(resolvedComplaints.length);
      } else {
        setComplaintsFiled(0);
        setComplaintsResolved(0);
      }
    } catch (error) {
      console.error("Error fetching complaints:", error);
    }
  };

  const refreshProfile = async () => {
    setRefreshing(true);
    await fetchComplaintsStats();

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userRef = ref(db, `users/${currentUser.uid}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      const createdDate = data.createdAt ? new Date(data.createdAt) : new Date();
      const memberSince = createdDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      setUserData({
        firstName: data.firstName || "",
        middleName: data.middleName || "",
        lastName: data.lastName || "",
        email: data.email || currentUser.email || "",
        phone: data.number || "No phone number",
        address: data.address || "No address",
        purok: data.purok || "",
        age: data.age || "",
        memberSince,
        id_verification: data.id_verification || "",
        avatar: data.avatar || "",
        idstatus: data.idstatus || "Pending",
      });
    }

    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return COLORS.success;
      case "Denied":
        return COLORS.danger;
      case "Pending":
      default:
        return COLORS.warning;
    }
  };

  useEffect(() => {
    const init = async () => {
      await refreshProfile();
      await fetchComplaintsStats();
      setLoading(false);
    };
    init();
  }, []);

  const handleAvatarUpload = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo access to change your avatar."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const base64String = result.assets[0].base64;
      const currentUser = auth.currentUser;

      if (!currentUser || !base64String) {
        Alert.alert("Error", "You must be logged in.");
        return;
      }

      setUploading(true);
      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, {
        avatar: `data:image/jpeg;base64,${base64String}`,
        avatar_uploaded_at: new Date().toISOString(),
      });

      setUserData((prev) => ({
        ...prev,
        avatar: `data:image/jpeg;base64,${base64String}`,
      }));

      Alert.alert("Success", "Avatar updated successfully!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to update avatar.");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadID = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow photo access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const base64String = result.assets[0].base64;
      const currentUser = auth.currentUser;

      if (!currentUser || !base64String) {
        Alert.alert("Error", "Login required.");
        return;
      }

      setUploading(true);
      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, {
        id_verification: `data:image/jpeg;base64,${base64String}`,
        id_verification_uploaded_at: new Date().toISOString(),
        idstatus: "Pending",
      });

      setUserData((prev) => ({
        ...prev,
        id_verification: `data:image/jpeg;base64,${base64String}`,
        idstatus: "Pending",
      }));

      Alert.alert("Success", "ID uploaded! Verification pending.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to upload ID.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = async () => {
    try {
      await signOut(auth);
      setShowLogoutModal(false);
      router.replace("/");
    } catch {
      Alert.alert("Error", "Failed to log out");
    }
  };

  const openEditModal = (field: EditingField, currentValue: string) => {
    if (!field) return;
    setEditValue(currentValue);
    setIsEditing(field);
  };

  const closeEditModal = () => {
    setIsEditing(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!auth.currentUser || isSaving) return;
    const value = editValue.trim();
    setIsSaving(true);

    try {
      let updateData: { [key: string]: string } = {};

      if (isEditing === "address") {
        if (!value) {
          Alert.alert("Validation Error", "Address cannot be empty.");
          setIsSaving(false);
          return;
        }
        updateData.address = value;
      } else if (isEditing === "phone") {
        const phoneRegex = /^\d{11}$/;
        if (!phoneRegex.test(value)) {
          Alert.alert(
            "Validation Error",
            "Mobile number must be exactly 11 digits."
          );
          setIsSaving(false);
          return;
        }
        updateData.number = value;
      }

      if (Object.keys(updateData).length > 0) {
        const userRef = ref(db, `users/${auth.currentUser.uid}`);
        await update(userRef, updateData);

        setUserData((prev) => ({
          ...prev,
          ...(isEditing === "address" && { address: value }),
          ...(isEditing === "phone" && { phone: value }),
        }));

        Alert.alert(
          "Success",
          `${isEditing === "address" ? "Address" : "Phone"} updated successfully!`
        );
        closeEditModal();
      }
    } catch (error) {
      console.error("Error saving edit:", error);
      Alert.alert("Error", `Failed to update ${isEditing}.`);
    } finally {
      setIsSaving(false);
    }
  };

  // ===== UI derived =====
  const fullName =
    `${userData.firstName} ${userData.middleName} ${userData.lastName}`.trim() ||
    "User Name";

  const fullAddress = userData.purok
    ? `Purok ${userData.purok}, ${userData.address}`
    : userData.address;

  const stats = useMemo(
    () => [
      {
        label: "Complaints Filed",
        value: complaintsFiled.toString(),
        icon: "document-text-outline" as const,
        color: COLORS.primary,
      },
      {
        label: "Cases Resolved",
        value: complaintsResolved.toString(),
        icon: "checkmark-done-circle-outline" as const,
        color: COLORS.success,
      },
    ],
    [complaintsFiled, complaintsResolved]
  );

  const statCardWidth = width >= 380 ? "48%" : "100%";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* Premium Gradient Header */}
      <LinearGradient
        colors={[COLORS.primary, "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topHeader}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>

          <Text style={styles.headerTitle}>My Profile</Text>

          <Pressable onPress={handleLogout} style={styles.headerIconBtn}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Avatar + Name inside header */}
        <View style={styles.headerProfile}>
          <View style={styles.avatarWrap}>
            <Image
              source={
                userData.avatar
                  ? { uri: userData.avatar }
                  : { uri: "https://via.placeholder.com/150" }
              }
              style={styles.avatar}
            />
            <Pressable onPress={handleAvatarUpload} style={styles.avatarBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={18} color="#fff" />
              )}
            </Pressable>
          </View>

          <Text style={styles.nameText}>{fullName}</Text>
          <Text style={styles.memberText}>Member since {userData.memberSince}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshProfile}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((s, idx) => (
            <View key={idx} style={[styles.statCard, { width: statCardWidth }]}>
              <View
                style={[
                  styles.statIcon,
                  { backgroundColor: `${s.color}1A` },
                ]}
              >
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Personal details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <View style={styles.divider} />

          <InfoRow icon="mail-outline" label="Email" value={userData.email} />

          <InfoRow
            icon="call-outline"
            label="Phone"
            value={userData.phone}
            actionLabel="Edit"
            onAction={() => openEditModal("phone", userData.phone)}
          />

          <InfoRow
            icon="location-outline"
            label="Address"
            value={fullAddress || "No Address"}
            actionLabel="Edit"
            onAction={() => openEditModal("address", userData.address)}
          />

          {!!userData.age && (
            <InfoRow icon="calendar-outline" label="Age" value={userData.age} />
          )}
        </View>

        {/* Verification */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
            <Text style={styles.sectionTitle2}>Identity Verification</Text>
          </View>

          <View style={styles.divider} />

          {userData.id_verification ? (
            <View style={{ gap: 12 }}>
              <Image
                source={{ uri: userData.id_verification }}
                style={styles.idImage}
                resizeMode="cover"
              />

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: `${getStatusColor(userData.idstatus)}1A` },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(userData.idstatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(userData.idstatus) },
                  ]}
                >
                  {userData.idstatus}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleUploadID}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.secondaryBtnText}>Re-upload ID</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.noticeText}>
                  Upload a valid government ID to verify your account and unlock all features.
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
                onPress={handleUploadID}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>Upload ID Now</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 18 }} />

        {/* Logout CTA */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditing !== null}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {isEditing === "address" ? "Edit Address" : "Edit Mobile Number"}
            </Text>

            <TextInput
              style={styles.input}
              onChangeText={setEditValue}
              value={editValue}
              keyboardType={isEditing === "phone" ? "phone-pad" : "default"}
              maxLength={isEditing === "phone" ? 11 : undefined}
              placeholder={
                isEditing === "address"
                  ? "Lot/Block/Street, Barangay/City, Province"
                  : "Mobile Number (11 digits)"
              }
              multiline={isEditing === "address"}
              numberOfLines={isEditing === "address" ? 3 : 1}
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancel,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={closeEditModal}
                disabled={isSaving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalConfirm,
                  pressed && { opacity: 0.9 },
                  (!editValue.trim() || isSaving) && { opacity: 0.6 },
                ]}
                onPress={handleSaveEdit}
                disabled={isSaving || !editValue.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="log-out-outline" size={26} color={COLORS.danger} />
            </View>

            <Text style={styles.modalTitle}>Log out?</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to log out? You’ll need to sign in again.
            </Text>

            <View style={styles.modalBtnRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalCancel,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalDanger,
                  pressed && { opacity: 0.9 },
                ]}
                onPress={confirmLogout}
              >
                <Text style={styles.modalConfirmText}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>

      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.editPill,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Ionicons name="create-outline" size={14} color="#fff" />
          <Text style={styles.editPillText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 10, color: COLORS.muted, fontSize: 15 },

  topHeader: {
    paddingBottom: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },

  headerProfile: { alignItems: "center", marginTop: 14 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  nameText: { marginTop: 10, color: "#fff", fontSize: 20, fontWeight: "800" },
  memberText: { marginTop: 2, color: "rgba(255,255,255,0.85)", fontSize: 12 },

  scroll: { padding: 18, paddingTop: 16 },

  statsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  statLabel: { marginTop: 2, fontSize: 12, color: COLORS.muted },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  divider: { height: 1, backgroundColor: "rgba(229,231,235,0.7)", marginVertical: 12 },

  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 11, color: "#9CA3AF", letterSpacing: 0.6, textTransform: "uppercase" },
  infoValue: { marginTop: 2, fontSize: 15, fontWeight: "700", color: "#374151" },

  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  editPillText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle2: { fontSize: 16, fontWeight: "800", color: COLORS.text },

  idImage: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, fontWeight: "900" },

  noticeBox: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noticeText: { flex: 1, color: "#374151", lineHeight: 18, fontWeight: "600" },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 14 },

  logoutBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  logoutText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, marginBottom: 10 },
  modalMessage: { color: COLORS.muted, lineHeight: 20, marginBottom: 14, fontWeight: "600" },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 50,
  },

  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancel: { backgroundColor: "#F3F4F6" },
  modalCancelText: { color: "#374151", fontWeight: "900" },
  modalConfirm: { backgroundColor: COLORS.primary },
  modalDanger: { backgroundColor: COLORS.danger },
  modalConfirmText: { color: "#fff", fontWeight: "900" },
});
