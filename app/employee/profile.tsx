import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, firestore } from "../../backend/firebaseConfig";

export default function EmployeeProfile() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/");
        return;
      }

      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userData?.firstName?.charAt(0)?.toUpperCase() || "E"}
            </Text>
          </View>
          <Text style={styles.nameText}>
            {userData?.firstName} {userData?.lastName}
          </Text>
          <Text style={styles.roleText}>🔐 Employee</Text>
        </View>
      </View>

      {/* Personal Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>
              {userData?.firstName} {userData?.middleName ? userData.middleName + " " : ""}
              {userData?.lastName}
              {userData?.suffix ? " " + userData.suffix : ""}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userData?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Birthday</Text>
            <Text style={styles.infoValue}>{userData?.birthday || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age</Text>
            <Text style={styles.infoValue}>{userData?.age || "N/A"}</Text>
          </View>
        </View>
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{userData?.number || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>{userData?.address || "Not provided"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purok</Text>
            <Text style={styles.infoValue}>Purok {userData?.purok || "N/A"}</Text>
          </View>
        </View>
      </View>

      {/* Account Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Status</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badge}>👤 Employee</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeActive}>🟢 Active</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{userData?.createdAt?.toDate?.()?.toLocaleDateString() || "Recently"}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="create" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="key" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Change Password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 30,
    alignItems: "center",
  },
  avatarSection: {
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4a90e2",
  },
  nameText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: "#e3f2fd",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  infoValue: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
  },
  badgeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    backgroundColor: "#e6f4fe",
    color: "#4a90e2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  badgeActive: {
    backgroundColor: "#e8f5e9",
    color: "#4caf50",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  actionButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 2,
  },
  warningButton: {
    backgroundColor: "#ff9800",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  spacer: {
    height: 20,
  },
});
