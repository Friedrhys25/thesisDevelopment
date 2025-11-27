import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { get, ref, update } from "firebase/database";
import { db, auth } from "../../backend/firebaseConfig";
import { signOut } from "firebase/auth";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { RefreshControl } from "react-native";


// ✅ Emoji-based Ionicons (no dependency)
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
  "create-outline": "✏️",
  "document-text-outline": "📄",
  "checkmark-circle": "✓",
  "time-outline": "🕐",
  "trophy-outline": "🏆",
  "cloud-upload-outline": "☁️",
  "camera-outline": "📷",
  close: "✕",
};

const Ionicons: React.FC<IoniconsProps> = ({ name, size, color = "#000" }) => {
  return <Text style={{ fontSize: size, color }}>{iconMap[name]}</Text>;
};

export default function ProfilePage() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [complaintsFiled, setComplaintsFiled] = useState(0);
  const [complaintsResolved, setComplaintsResolved] = useState(0);

  
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

const fetchComplaintsStats = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const complaintsRef = ref(db, `users/${currentUser.uid}/userComplaints`);
    const snapshot = await get(complaintsRef);

    if (snapshot.exists()) {
      const complaints = snapshot.val(); // { complaintId1: {...}, complaintId2: {...} }
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


  // Helper functions for ID status
  const getStatusColor = (status: string) => {
    switch(status) {
      case "Verified": return "#50C878";
      case "Denied": return "#E74C3C";
      case "Pending": return "#F39C12";
      default: return "#F39C12";
    }
  };

  const getStatusEmoji = (status: string) => {
    switch(status) {
      case "Verified": return "✔️";
      case "Denied": return "❌";
      case "Pending": return "⏳";
      default: return "⏳";
    }
  };

  // Fetch user data from Firebase
  useEffect(() => {
    const fetchUserData = async () => {
      await refreshProfile();
      await fetchComplaintsStats();
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          Alert.alert("Error", "No user logged in");
          router.replace("/");
          return;
        }

        const userRef = ref(db, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const data = snapshot.val();
          const createdDate = data.createdAt ? new Date(data.createdAt) : new Date();
          const memberSince = createdDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
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
        } else {
          Alert.alert("Error", "User data not found");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Upload avatar image
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
        Alert.alert("Error", "You must be logged in to change avatar.");
        return;
      }

      setUploading(true);

      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, {
        avatar: `data:image/jpeg;base64,${base64String}`,
        avatar_uploaded_at: new Date().toISOString(),
      });

      setUserData(prev => ({ ...prev, avatar: `data:image/jpeg;base64,${base64String}` }));

      Alert.alert("Success", "Avatar updated successfully!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      Alert.alert("Error", "Failed to update avatar.");
    } finally {
      setUploading(false);
    }
  };

  // Upload ID verification image
  const handleUploadID = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow photo access to upload your ID.");
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
        Alert.alert("Error", "You must be logged in to upload an ID.");
        return;
      }

      setUploading(true);

      const userRef = ref(db, `users/${currentUser.uid}`);
      await update(userRef, {
        id_verification: `data:image/jpeg;base64,${base64String}`,
        id_verification_uploaded_at: new Date().toISOString(),
        idstatus: "Pending",
      });

      setUserData(prev => ({
        ...prev,
        id_verification: `data:image/jpeg;base64,${base64String}`,
        idstatus: "Pending",
      }));

      Alert.alert("Success", "Your ID has been uploaded successfully! Verification is pending.");
    } catch (error) {
      console.error("Error uploading ID:", error);
      Alert.alert("Error", "Failed to upload ID. Please try again.");
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
      console.error("Logout error:", error);
      Alert.alert("Error", "Failed to log out");
    }
  };
  const cancelLogout = () => setShowLogoutModal(false);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={{ marginTop: 10, color: "#666" }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fullAddress = userData.purok 
    ? `Purok ${userData.purok}, ${userData.address}`
    : userData.address;

 const stats = [
  { label: "Complaints Filed", value: complaintsFiled.toString(), icon: "📋", color: "#4A90E2" },
  { label: "Resolved", value: complaintsResolved.toString(), icon: "✅", color: "#50C878" },
];

  const recentActivity = [
    { id: 1, action: "Filed complaint", title: "Road repair needed", time: "2 days ago", status: "In Progress" },
    { id: 2, action: "Received response", title: "Street light issue", time: "5 days ago", status: "Resolved" },
    { id: 3, action: "Submitted feedback", title: "Service improvement", time: "1 week ago", status: "Reviewed" },
  ];


  const handleFetchLocation = async () => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Denied", "Enable location permissions to continue.");
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = location.coords;

    // Convert to address
    const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    let addressText = `${geocode[0].street}, ${geocode[0].city}, ${geocode[0].region}`;

    // Update UI
    setUserData((prev) => ({ ...prev, address: addressText }));

    // Update Firebase
    const currentUser = auth.currentUser;
    if (currentUser) {
      await update(ref(db, `users/${currentUser.uid}`), {
        address: addressText,
        latitude,
        longitude,
      });
    }

    Alert.alert("Success", "Address updated using GPS!");

  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Failed to get location");
  }
};



  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color="#333" />
          </TouchableOpacity>

          <Text style={styles.headerText}>Profile</Text>

          {/* Removed the create-outline button */}
          <View style={{ width: 30 }} /> 
        </View>


        {/* Logout Modal */}
        <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={cancelLogout}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Ionicons name="log-out-outline" size={48} color="#E74C3C" />
              <Text style={styles.modalTitle}>Log Out</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to log out? You'll need to sign in again to access your account.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={cancelLogout}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.confirmBtn]} onPress={confirmLogout}>
                  <Text style={styles.confirmText}>Yes, Log Out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView contentContainerStyle={styles.scroll}  
            refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshProfile}
              colors={["#667eea"]}     // Android spinner color
              tintColor="#667eea"      // iOS spinner color
            />
          }>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Image
                source={
                  userData.avatar
                    ? { uri: userData.avatar }
                    : { uri: "https://via.placeholder.com/100" }
                }
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            </View>
            <TouchableOpacity style={styles.avatarBadge} onPress={handleAvatarUpload}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            {stats.map((stat, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${stat.color}25` }]}>
                  <Text style={{ fontSize: 24 }}>{stat.icon}</Text>
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            {[
              { 
                icon: "person-outline", 
                label: "Full Name", 
                value: `${userData.firstName} ${userData.middleName} ${userData.lastName}`.trim() 
              },
              { icon: "mail-outline", label: "Email", value: userData.email },
              { icon: "call-outline", label: "Phone", value: userData.phone },
              {
                icon: "location-outline",
                label: "Address",
                value: (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", flex: 1 }}>
                      {fullAddress || "No Address"}
                    </Text>

                    <TouchableOpacity
                      onPress={handleFetchLocation}
                      style={{
                        backgroundColor: "#667eea",
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 6,
                        marginLeft: 10,
                      }}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>📍 Get</Text>
                    </TouchableOpacity>
                  </View>
                ),
              },

              ...(userData.age ? [{ icon: "calendar-outline", label: "Age", value: userData.age }] : []),
            ].map((item, i) => (
              <View key={i} style={styles.infoItem}>
                <View style={styles.infoIcon}>
                  <Ionicons name={item.icon} size={20} color="#666" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}

            {/* ID Verification */}
            <View style={styles.verificationSection}>
              <View style={styles.verificationHeader}>
                <Ionicons name="shield-outline" size={20} color="#667eea" />
                <Text style={styles.verificationTitle}>ID Verification</Text>
              </View>

              {userData.id_verification ? (
                <View style={styles.verifiedContainer}>
                  <Image 
                    source={{ uri: userData.id_verification }} 
                    style={styles.idImage}
                    resizeMode="cover"
                  />
                  <Text style={{ color: getStatusColor(userData.idstatus), marginTop: 6 }}>
                    {getStatusEmoji(userData.idstatus)} {userData.idstatus || "Pending"}
                  </Text>

                  <TouchableOpacity 
                    style={styles.reuploadButton}
                    onPress={handleUploadID}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#667eea" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={18} color="#667eea" />
                        <Text style={styles.reuploadText}>Upload New ID</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={handleUploadID}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                      <Text style={styles.uploadButtonText}>Upload ID for Verification</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <Text style={styles.verificationNote}>
                📋 Upload a valid government ID for account verification
              </Text>
            </View>
          </View>


          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Styles (same as your original)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  iconButton: { padding: 8 },
  headerText: { fontSize: 22, fontWeight: "700", color: "#333" },
  scroll: { padding: 20 },
  avatarContainer: { position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  avatarBadge: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#667eea", borderRadius: 16, padding: 6 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 , marginTop: 20},
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 12, alignItems: "center", marginHorizontal: 4, elevation: 2 },
  statIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 12, color: "#666" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 10, color: "#333" },
  infoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoIcon: { width: 40, alignItems: "center" },
  infoLabel: { fontSize: 12, color: "#999" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#333" },
  verificationSection: { marginTop: 20 },
  verificationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  verificationTitle: { marginLeft: 8, fontWeight: "600", fontSize: 14, color: "#333" },
  verifiedContainer: { alignItems: "center", marginVertical: 8 },
  idImage: { width: 150, height: 100, borderRadius: 10 },
  reuploadButton: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  reuploadText: { marginLeft: 6, color: "#667eea", fontWeight: "600" },
  uploadButton: { backgroundColor: "#667eea", flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 12, borderRadius: 8, marginVertical: 8 },
  uploadButtonText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
  verificationNote: { fontSize: 12, color: "#666", marginTop: 6 },
  activityItem: { flexDirection: "row", paddingVertical: 10 },
  activityIcon: { width: 40, alignItems: "center" },
  activityAction: { fontSize: 12, color: "#999" },
  activityTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  activityFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  activityTime: { fontSize: 12, color: "#666" },
  activityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: "#fff", fontWeight: "600" },
  badgeResolved: { backgroundColor: "#50C878" },
  badgeProgress: { backgroundColor: "#F39C12" },
  badgeReviewed: { backgroundColor: "#4A90E2" },
  logoutButton: { flexDirection: "row", alignItems: "center", padding: 12, marginTop: 10 },
  logoutText: { color: "#E74C3C", fontWeight: "600", marginLeft: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "80%", backgroundColor: "#fff", borderRadius: 14, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginTop: 10 },
  modalMessage: { fontSize: 14, color: "#666", textAlign: "center", marginVertical: 12 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, width: "100%" },
  modalBtn: { flex: 1, padding: 10, borderRadius: 8, marginHorizontal: 4, alignItems: "center" },
  cancelBtn: { backgroundColor: "#E0E0E0" },
  confirmBtn: { backgroundColor: "#E74C3C" },
  cancelText: { color: "#333", fontWeight: "600" },
  confirmText: { color: "#fff", fontWeight: "600" },
});
