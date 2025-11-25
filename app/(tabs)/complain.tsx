import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";

import { auth, db } from "../../backend/firebaseConfig";
import { ref, push, set, onValue, get } from "firebase/database";

interface NotificationItem {
  id: number;
  message: string;
  label: string;
  type: string;
  timestamp: string;
  purok: string;
  status: string;
  incidentPurok?: string;
  incidentLocation?: string;
  evidencePhoto?: string;
}

export default function App() {
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingComplaints, setFetchingComplaints] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<NotificationItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [incidentPurok, setIncidentPurok] = useState("1");
  const [incidentLocation, setIncidentLocation] = useState("");
  const [userPurok, setUserPurok] = useState<string>("");
  const [idStatus, setIdStatus] = useState<string>("pending");

  // ===========================
  // Fetch User's Purok from Database
  // ===========================
useEffect(() => {
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        setUserPurok(userData.purok || "");
        setIdStatus(userData.idstatus || "pending"); // <-- add this line
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  fetchUserData();
}, []);


  // ===========================
  // Pick Image from Gallery
  // ===========================
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow photo access to upload evidence.");
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
      if (!base64String) {
        Alert.alert("Error", "Failed to process image");
        return;
      }

      setSelectedImage(`data:image/jpeg;base64,${base64String}`);
    } catch (error: any) {
      Alert.alert("Error", "Failed to pick image: " + error.message);
    }
  };

  // ===========================
  // Take Photo with Camera
  // ===========================
  const takePhoto = async () => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "We need camera permissions to take photos.");
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const base64String = result.assets[0].base64;
      if (!base64String) {
        Alert.alert("Error", "Failed to process image");
        return;
      }

      setSelectedImage(`data:image/jpeg;base64,${base64String}`);
    } catch (error: any) {
      Alert.alert("Error", "Failed to take photo: " + error.message);
    }
  };

  // ===========================
  // Show Image Options
  // ===========================
  const showImageOptions = () => {
    Alert.alert(
      "Add Evidence Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: takePhoto },
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // ===========================
  // Remove Selected Image
  // ===========================
  const removeImage = () => {
    setSelectedImage(null);
  };

  // ===========================
  // Fetch Complaints from Firebase
  // ===========================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setFetchingComplaints(false);
      return;
    }

    const complaintsRef = ref(db, `users/${user.uid}/userComplaints`);
    
    const unsubscribe = onValue(complaintsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const complaintsArray = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: value.id || Date.now(),
          message: value.message,
          label: value.label,
          type: value.type,
          timestamp: value.timestamp,
          purok: value.purok,
          status: value.status,
          incidentPurok: value.incidentPurok,
          incidentLocation: value.incidentLocation,
          evidencePhoto: value.evidencePhoto,
        }));
        setNotifications(complaintsArray.reverse());
      } else {
        setNotifications([]);
      }
      setFetchingComplaints(false);
    }, (error) => {
      console.error("Error fetching complaints:", error);
      Alert.alert("Error", "Failed to load complaints");
      setFetchingComplaints(false);
    });

    return () => unsubscribe();
  }, []);

  // ===========================
  // Submit Complaint
  // ===========================
  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert("Error", "Please enter a complaint message");
      return;
    }

    if (!incidentLocation.trim()) {
      Alert.alert("Error", "Please enter the location of the incident");
      return;
    }

    setLoading(true);

    try {
      const API_URL = "https://talk2us.onrender.com";

      const response = await fetch(`${API_URL}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      const normalizedLabel = String(data.label).toLowerCase().trim();
      const normalizedType = String(data.type).toLowerCase().trim();

      const newItem: NotificationItem = {
        id: Date.now(),
        message: data.message,
        label: normalizedLabel,
        type: normalizedType,
        timestamp: new Date().toLocaleString(),
        purok: userPurok, // Use the fetched user's purok
        incidentPurok: incidentPurok,
        incidentLocation: incidentLocation,
        status: "pending",
      };

      // Prevents the Firebase undefined error
      if (selectedImage) {
        newItem.evidencePhoto = selectedImage;
      }

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Not logged in");
        setLoading(false);
        return;
      }

      const complaintRef = push(ref(db, `users/${user.uid}/userComplaints`));
      await set(complaintRef, newItem);

      setMessage("");
      setIncidentLocation("");
      setSelectedImage(null);
      setComplaintModalVisible(false);
      setModalVisible(true);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const openDetailModal = (complaint: NotificationItem) => {
    setSelectedComplaint(complaint);
    setDetailModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return "#f59e0b";
      case "resolved": return "#10b981";
      case "in progress": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  const getLabelColor = (label: string) => {
    switch (label.toLowerCase()) {
      case "urgent": return "#ef4444";
      case "high": return "#f97316";
      case "medium": return "#eab308";
      case "low": return "#22c55e";
      default: return "#6366f1";
    }
  };

  // ===========================
  // UI
  // ===========================
  return (
    <View style={styles.container}>
      
      {/* Header */}
      <Text style={styles.header}>Complaints</Text>

      {/* Loading State */}
      {fetchingComplaints ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      ) : (
        <>
          {/* Complaint Cards */}
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No complaints yet</Text>
                <Text style={styles.emptySubtext}>Tap "New Complaint" to get started</Text>
              </View>
            ) : (
              notifications.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={styles.complaintCard}
                  onPress={() => openDetailModal(n)}
                  activeOpacity={0.7}
                >
                  {/* Evidence Photo */}
                  {n.evidencePhoto && (
                    <Image 
                      source={{ uri: n.evidencePhoto }} 
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                  )}

                  {/* Header Row */}
                  <View style={styles.cardHeader}>
                    <View style={[styles.labelBadge, { backgroundColor: getLabelColor(n.label) }]}>
                      <Text style={styles.labelText}>{n.label.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(n.status) }]}>
                      <Text style={styles.statusText}>{n.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Message Preview */}
                  <Text style={styles.messagePreview} numberOfLines={2}>
                    {n.message}
                  </Text>

                  {/* Footer Row */}
                  <View style={styles.cardFooter}> 
                    <Text style={styles.footerText}>🕒 {n.timestamp}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* Add Complaint Button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          idStatus !== "approved" && { backgroundColor: "#d1d5db" } // gray out if not approved
        ]}
        onPress={() => idStatus === "approved" && setComplaintModalVisible(true)}
        disabled={idStatus !== "approved"} // disable click
      >
        <Text style={styles.addButtonText}>+ New Complaint</Text>
      </TouchableOpacity>
      {idStatus !== "approved" && (
        <Text style={styles.disabledMessage}>
          You cannot submit a complaint until your ID is approved.
        </Text>
      )}



      {/* DETAIL MODAL */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalBox}>
            
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complaint Details</Text>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedComplaint && (
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Evidence Photo */}
                {selectedComplaint.evidencePhoto && (
                  <Image
                    source={{ uri: selectedComplaint.evidencePhoto }}
                    style={styles.detailImage}
                    resizeMode="cover"
                  />
                )}

                {/* Badges */}
                <View style={styles.detailBadges}>
                  <View style={[styles.detailBadge, { backgroundColor: getLabelColor(selectedComplaint.label) }]}>
                    <Text style={styles.detailBadgeText}>{selectedComplaint.label.toUpperCase()}</Text>
                  </View>

                  <View style={[styles.detailBadge, { backgroundColor: getStatusColor(selectedComplaint.status) }]}>
                    <Text style={styles.detailBadgeText}>{selectedComplaint.status.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Message */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Message</Text>
                  <Text style={styles.detailValue}>{selectedComplaint.message}</Text>
                </View>

                {/* Type */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedComplaint.type}</Text>
                </View>


                {/* Incident Purok */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Incident Purok</Text>
                  <Text style={styles.detailValue}>🏠 Purok {selectedComplaint.incidentPurok}</Text>
                </View>

                {/* Incident Location */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Specific Location</Text>
                  <Text style={styles.detailValue}>{selectedComplaint.incidentLocation}</Text>
                </View>

                {/* Timestamp */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Submitted</Text>
                  <Text style={styles.detailValue}>🕒 {selectedComplaint.timestamp}</Text>
                </View>

              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={styles.detailCloseButton}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.detailCloseButtonText}>Close</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* COMPLAINT FORM MODAL */}
      <Modal
        visible={complaintModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComplaintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.complaintModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complaint Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setComplaintModalVisible(false);
                  setSelectedImage(null);
                  setMessage("");
                  setIncidentLocation("");
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* INCIDENT PUROK DROPDOWN */}
              <Text style={styles.label}>Incident Purok *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={incidentPurok}
                  onValueChange={(v) => setIncidentPurok(v)}
                  style={styles.picker}
                >
                  <Picker.Item label="Purok 1" value="1" />
                  <Picker.Item label="Purok 2" value="2" />
                  <Picker.Item label="Purok 3" value="3" />
                  <Picker.Item label="Purok 4" value="4" />
                  <Picker.Item label="Purok 5" value="5" />
                  <Picker.Item label="Purok 6" value="6" />
                </Picker>
              </View>

              {/* LOCATION OF INCIDENT */}
              <Text style={styles.label}>Location of Incident *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter specific location (e.g., near basketball court)"
                value={incidentLocation}
                onChangeText={setIncidentLocation}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Please describe your complaint in detail..."
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* Image Preview */}
              {selectedImage && (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: selectedImage }} 
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={removeImage}
                  >
                    <Text style={styles.removeImageText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Upload Section */}
              <TouchableOpacity 
                style={styles.uploadSection}
                onPress={showImageOptions}
                disabled={uploading}
              >
                <View style={styles.uploadIconContainer}>
                  <Text style={styles.uploadIcon}>📷</Text>
                </View>
                <Text style={styles.uploadText}>Upload Photos (Proof)</Text>
                <View style={styles.chooseFilesButton}>
                  {uploading ? (
                    <ActivityIndicator size="small" color="#374151" />
                  ) : (
                    <Text style={styles.chooseFilesText}>Choose Files</Text>
                  )}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Complaint ➔</Text>
                )}
              </TouchableOpacity>

            </ScrollView>

          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.modalText}>Complaint Sent Successfully!</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ===============================
// STYLES
// ===============================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingTop: 50,
    paddingHorizontal: 15,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1f2937",
  },
  listContainer: {
    flex: 1,
    marginBottom: 10,
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
  },

  // Complaint Card Styles
  complaintCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  messagePreview: {
    fontSize: 15,
    color: "#374151",
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: "#6b7280",
  },

  // Detail Modal Styles
  detailModalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  detailImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailBadges: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  detailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    color: "#1f2937",
    lineHeight: 22,
  },
  detailCloseButton: {
    backgroundColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  detailCloseButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
  },

  addButton: {
    backgroundColor: "#6366f1",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Complaint Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  complaintModalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: "#6b7280",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  
  // Image Preview
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 20,
    alignSelf: "center",
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#6366f1",
  },
  removeImageButton: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#ef4444",
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  removeImageText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },

  uploadSection: {
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    marginBottom: 20,
  },
  uploadIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  uploadIcon: {
    fontSize: 24,
  },
  uploadText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  chooseFilesButton: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    minWidth: 100,
    alignItems: "center",
  },
  chooseFilesText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },

  submitButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },

  // Success Modal
  modalBox: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    width: 280,
    alignItems: "center",
  },
  successIcon: {
    fontSize: 50,
    color: "#10b981",
    marginBottom: 15,
  },
  modalText: { 
    fontSize: 16, 
    fontWeight: "600", 
    marginBottom: 20,
    textAlign: "center",
    color: "#1f2937",
  },
  modalButton: {
    backgroundColor: "#6366f1",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    width: "100%",
  },
  input: {
    width: "100%",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  disabledMessage: {
  color: "#ef4444",
  fontSize: 14,
  marginBottom: 6,
  textAlign: "center",
},

});