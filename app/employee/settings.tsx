import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../backend/firebaseConfig";

export default function EmployeeSettings() {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Logout",
        onPress: async () => {
          try {
            await auth.signOut();
            router.replace("/");
          } catch (error) {
            Alert.alert("Error", "Failed to logout");
          }
        },
      },
    ]);
  };

  const handleClearCache = () => {
    Alert.alert("Clear Cache", "This will clear cached data. Continue?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Clear",
        onPress: () => {
          Alert.alert("Success", "Cache cleared successfully");
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage your preferences and account</Text>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingBox}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications" size={24} color="#4a90e2" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Receive push alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: "#e0e0e0", true: "#81c784" }}
              thumbColor={notificationsEnabled ? "#4caf50" : "#f1f1f1"}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="mail" size={24} color="#4a90e2" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Email Alerts</Text>
                <Text style={styles.settingDesc}>Get notified via email</Text>
              </View>
            </View>
            <Switch
              value={emailAlertsEnabled}
              onValueChange={setEmailAlertsEnabled}
              trackColor={{ false: "#e0e0e0", true: "#81c784" }}
              thumbColor={emailAlertsEnabled ? "#4caf50" : "#f1f1f1"}
            />
          </View>
        </View>
      </View>

      {/* Account Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="key" size={24} color="#4a90e2" />
            <Text style={styles.settingButtonText}>Change Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="shield" size={24} color="#4a90e2" />
            <Text style={styles.settingButtonText}>Privacy & Security</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="person-circle" size={24} color="#4a90e2" />
            <Text style={styles.settingButtonText}>Manage Account</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="globe" size={24} color="#4a90e2" />
            <Text style={styles.settingButtonText}>Language</Text>
          </View>
          <Text style={styles.languageTag}>English</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="contrast" size={24} color="#4a90e2" />
            <Text style={styles.settingButtonText}>Theme</Text>
          </View>
          <Text style={styles.themeTag}>System</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleClearCache} style={styles.settingButton}>
          <View style={styles.settingButtonContent}>
            <Ionicons name="trash" size={24} color="#ff9800" />
            <Text style={[styles.settingButtonText, { color: "#ff9800" }]}>Clear Cache</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutBox}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>App Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Build Number</Text>
            <Text style={styles.aboutValue}>2024001</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Last Updated</Text>
            <Text style={styles.aboutValue}>March 10, 2024</Text>
          </View>
        </View>
      </View>

      {/* Danger Zone */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: "#e74c3c" }]}>Danger Zone</Text>
        <TouchableOpacity onPress={handleLogout} style={[styles.dangerButton]}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.dangerButtonText}>Logout</Text>
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
  header: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
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
  settingBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  settingDesc: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  settingButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },
  settingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  languageTag: {
    backgroundColor: "#e6f4fe",
    color: "#4a90e2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  themeTag: {
    backgroundColor: "#f3e5f5",
    color: "#7b1fa2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  aboutBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  aboutLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  aboutValue: {
    fontSize: 16,
    color: "#2c3e50",
  },
  dangerButton: {
    backgroundColor: "#e74c3c",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 2,
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  spacer: {
    height: 20,
  },
});
