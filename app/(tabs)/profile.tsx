import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput, // Added TextInput
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db } from "../../backend/firebaseConfig"; // Adjust path if needed


// ✅ Emoji-based Ionicons (Retained as requested)
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

type IoniconsProps = {
  name: keyof typeof iconMap | string;
  size: number;
  color?: string;
  style?: any;
};

const iconMap: { [key: string]: string } = {
  "arrow-back": "←",
  "person-circle": "👤",
  "person-outline": "👤",
  "mail-outline": "✉️",
  "call-outline": "📞",
  "location-outline": "📍",
  "calendar-outline": "📅",
  "settings-outline": "⚙️",
  "notifications-outline": "🔔",
  "shield-outline": "🛡️",
  "help-circle-outline": "❓",
  "log-out-outline": "🚪",
  "create-outline": "✏️", // Used for the new Edit button
  "document-text-outline": "📄",
  "checkmark-circle": "✓",
  "time-outline": "🕐",
  "trophy-outline": "🏆",
  "cloud-upload-outline": "☁️",
  "camera-outline": "📷",
  close: "✕",
};

const Ionicons: React.FC<IoniconsProps> = ({ name, size, color = "#000", style }) => {
  return <Text style={[{ fontSize: size, color }, style]}>{iconMap[name] || "❓"}</Text>;
};

// New types for editing
type EditingField = "address" | "phone" | null;

export default function ProfilePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [complaintsFiled, setComplaintsFiled] = useState(0);
  const [complaintsResolved, setComplaintsResolved] = useState(0);

  // --- New State for Editing ---
  const [isEditing, setIsEditing] = useState<EditingField>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // -----------------------------

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

  // --- LOGIC SECTION (Identical to your original code) ---
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
      case "Verified": return "#10B981"; // Modern Green
      case "Denied": return "#EF4444";   // Modern Red
      case "Pending": return "#F59E0B";  // Modern Amber
      default: return "#F59E0B";
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case "Verified": return "✓";
      case "Denied": return "✕";
      case "Pending": return "⏳";
      default: return "⏳";
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      await refreshProfile();
      await fetchComplaintsStats();
      setLoading(false);
    };
    fetchUserData();
  }, []);

  const handleAvatarUpload = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission required", "Please allow photo access to change your avatar.");
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
      setUserData((prev) => ({ ...prev, avatar: `data:image/jpeg;base64,${base64String}` }));
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
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    } catch (error) {
      Alert.alert("Error", "Failed to log out");
    }
  };
  const cancelLogout = () => setShowLogoutModal(false);

  // --- NEW EDITING LOGIC ---

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
          return;
        }
        updateData.address = value;
        
      } else if (isEditing === "phone") {
        const phoneRegex = /^\d{11}$/; // Exact 11 digits
        if (!phoneRegex.test(value)) {
          Alert.alert("Validation Error", "Mobile number must be exactly 11 digits.");
          return;
        }
        updateData.number = value;
      }

      if (Object.keys(updateData).length > 0) {
        const userRef = ref(db, `users/${auth.currentUser.uid}`);
        await update(userRef, updateData);

        // Update local state
        setUserData(prev => ({
          ...prev,
          ...(isEditing === "address" && { address: value }),
          ...(isEditing === "phone" && { phone: value }),
        }));
        Alert.alert("Success", `${isEditing === "address" ? "Address" : "Phone number"} updated successfully!`);
        closeEditModal();
      }
    } catch (error) {
      console.error("Error saving edit:", error);
      Alert.alert("Error", `Failed to update ${isEditing}.`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- END NEW EDITING LOGIC ---
  

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const fullAddress = userData.purok
    ? `Purok ${userData.purok}, ${userData.address}`
    : userData.address;

  const stats = [
    { label: "Complaints Filed", value: complaintsFiled.toString(), icon: "document-text-outline", color: "#667eea" },
    { label: "Cases Resolved", value: complaintsResolved.toString(), icon: "checkmark-circle", color: "#10B981" },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9FC" />
      <View style={styles.container}>
        
        {/* Header */}
        <View style={[styles.header,]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerText}>My Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scroll Content */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProfile} tintColor="#667eea" />}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Avatar Section */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={
                  userData.avatar
                    ? { uri: userData.avatar }
                    : { uri: "https://via.placeholder.com/150" }
                }
                style={styles.avatar}
              />
              <TouchableOpacity style={styles.avatarBadge} onPress={handleAvatarUpload}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera-outline" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>
              {`${userData.firstName} ${userData.middleName} ${userData.lastName}`.trim() || "User Name"}
            </Text>
            <Text style={styles.userJoined}>Member since {userData.memberSince}</Text>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsGrid}>
            {stats.map((stat, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${stat.color}15` }]}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                </View>
                <View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Personal Information Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Details</Text>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="mail-outline" size={20} color="#6B7280" /></View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userData.email}</Text>
              </View>
            </View>

            {/* Phone Number Row (Modified) */}
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="call-outline" size={20} color="#6B7280" /></View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <View style={styles.addressRow}>
                    <Text style={[styles.infoValue, {flex: 1}]}>{userData.phone}</Text>
                    <TouchableOpacity 
                        onPress={() => openEditModal("phone", userData.phone)} 
                        style={styles.editButton}
                    >
                        <Ionicons name="create-outline" size={14} color="#fff" />
                        <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                </View>
              </View>
            </View>
            
            {/* Address Row (Modified) */}
            <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="location-outline" size={20} color="#6B7280" /></View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Address</Text>
                <View style={styles.addressRow}>
                  <Text style={[styles.infoValue, {flex: 1}]}>{fullAddress || "No Address"}</Text>
                  {/* Changed GPS button to Edit button */}
                  <TouchableOpacity onPress={() => openEditModal("address", userData.address)} style={styles.editButton}>
                    <Ionicons name="create-outline" size={14} color="#fff" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {userData.age ? (
              <View style={styles.infoRow}>
                <View style={styles.iconBox}><Ionicons name="calendar-outline" size={20} color="#6B7280" /></View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Age</Text>
                  <Text style={styles.infoValue}>{userData.age}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Verification Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-outline" size={22} color="#667eea" />
              <Text style={styles.sectionTitleWithIcon}>Identity Verification</Text>
            </View>
            
            <View style={styles.divider} />

            {userData.id_verification ? (
              <View style={styles.verifiedContainer}>
                <Image
                  source={{ uri: userData.id_verification }}
                  style={styles.idImage}
                  resizeMode="cover"
                />
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(userData.idstatus)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(userData.idstatus) }]}>
                      {getStatusEmoji(userData.idstatus)}  {userData.idstatus}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleUploadID}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#667eea" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#667eea" />
                      <Text style={styles.secondaryButtonText}>Re-upload ID</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                  <Text style={styles.emptyStateText}>
                    Please upload a valid government ID to verify your account and access all features.
                  </Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleUploadID}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>Upload ID Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <View style={{height: 40}} /> 
        </ScrollView>

        {/* --- Edit Modal (New) --- */}
        <Modal visible={isEditing !== null} transparent animationType="fade" onRequestClose={closeEditModal}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {isEditing === "address" ? "Edit Address" : "Edit Mobile Number"}
              </Text>
              
              <TextInput
                style={styles.textInput}
                onChangeText={setEditValue}
                value={editValue}
                keyboardType={isEditing === "phone" ? "phone-pad" : "default"}
                maxLength={isEditing === "phone" ? 11 : undefined}
                placeholder={isEditing === "address" ? "Lot/Block/Street, Barangay/City, Province" : "Mobile Number (11 digits)"}
                multiline={isEditing === "address"}
                numberOfLines={isEditing === "address" ? 3 : 1}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={closeEditModal} disabled={isSaving}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleSaveEdit} disabled={isSaving || !editValue.trim()}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.btnConfirmText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {/* --- End Edit Modal --- */}

        {/* Logout Modal (Original) */}
        <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={cancelLogout}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBg}>
                  <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Log Out?</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to log out? You'll need to sign in again to access your account.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalBtnCancel} onPress={cancelLogout}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalBtnConfirm} onPress={confirmLogout}>
                  <Text style={styles.btnConfirmText}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F9FC" },
  container: { flex: 1, backgroundColor: "#F7F9FC" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F7F9FC" },
  loadingText: { marginTop: 12, color: "#6B7280", fontSize: 16 },
  
  // Header
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 20, 
    paddingVertical: 0,
  },
  iconButton: { 
    width: 40, 
    height: 40, 
    backgroundColor: "#fff", 
    borderRadius: 20, 
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  headerText: { fontSize: 20, fontWeight: "700", color: "#1F2937" },
  
  scroll: { padding: 20 },

  // Profile Header
  profileHeader: { alignItems: "center", marginBottom: 25 },
  avatarContainer: { position: "relative", marginBottom: 15 },
  avatar: { 
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    borderWidth: 4, 
    borderColor: "#fff",
  },
  avatarBadge: { 
    position: "absolute", 
    bottom: 0, 
    right: 0, 
    backgroundColor: "#667eea", 
    width: 36,
    height: 36,
    borderRadius: 18, 
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#F7F9FC"
  },
  userName: { fontSize: 22, fontWeight: "bold", color: "#111827", marginBottom: 4 },
  userJoined: { fontSize: 13, color: "#6B7280" },

  // Stats
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  statCard: { 
    flex: 1, 
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 16, 
    marginHorizontal: 6, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  statIconContainer: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 12 
  },
  statValue: { fontSize: 18, fontWeight: "800", color: "#1F2937" },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 0 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 5 },
  sectionTitleWithIcon: { fontSize: 18, fontWeight: "700", color: "#111827", marginLeft: 10 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 15 },

  // Info Rows
  infoRow: { flexDirection: "row", marginBottom: 18 },
  iconBox: { width: 32, alignItems: "center", marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#9CA3AF", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#374151" },
  addressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  
  // GPS Button (now Edit Button)
  editButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#667eea", // Retained the main color
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 20,
    marginLeft: 8
  },
  editButtonText: { color: "#fff", fontSize: 11, fontWeight: "700", marginLeft: 4 },

  // Verification
  verifiedContainer: { alignItems: "center" },
  idImage: { width: "100%", height: 180, borderRadius: 12, backgroundColor: "#F3F4F6", marginBottom: 15 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 15 },
  statusText: { fontWeight: "700", fontSize: 14 },
  secondaryButton: { flexDirection: "row", alignItems: "center", padding: 10 },
  secondaryButtonText: { color: "#667eea", fontWeight: "600", marginLeft: 8 },
  emptyStateContainer: { alignItems: "center", paddingVertical: 10 },
  emptyStateText: { textAlign: "center", color: "#6B7280", marginBottom: 20, lineHeight: 20 },
  
  // Primary Button
  primaryButton: { 
    backgroundColor: "#667eea", 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 14, 
    width: "100%",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16, marginLeft: 8 },

  // Logout Button
  logoutButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 16, 
    backgroundColor: "#ca0404ff", 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2"
  },
  logoutText: { color: "#ffffffff", fontWeight: "600", fontSize: 16, marginLeft: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "85%", backgroundColor: "#fff", borderRadius: 24, padding: 24, alignItems: "center" },
  modalIconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  modalMessage: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  modalButtons: { flexDirection: "row", width: "100%", gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" },
  modalBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#667eea", alignItems: "center" }, // Changed to primary color for Save
  btnCancelText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  btnConfirmText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  
  // New Input Style for Edit Modal
  textInput: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: "#1F2937",
    marginBottom: 20,
    textAlignVertical: "top",
    minHeight: 50
  }
});