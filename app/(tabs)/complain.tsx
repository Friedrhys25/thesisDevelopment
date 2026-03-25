import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { auth, firestore } from "../../backend/firebaseConfig";

const COLORS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#F16F24",
  primaryDark: "#F16F24",
  accent: "#FBE451",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
};

interface NotificationItem {
  firebaseKey?: string;
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
  hasUpdate?: boolean;
}

export default function App() {
  const insets = useSafeAreaInsets();
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
  const [idStatus, setIdStatus] = useState<string>("Pending");
  const [refreshing, setRefreshing] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ read: boolean; id: string; senderId: string; message: string; timestamp: string; }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "in progress" | "resolved">("all");
  const [statusUpdates, setStatusUpdates] = useState<Record<string, Set<string>>>({
    pending: new Set(),
    inprogress: new Set(),
    resolved: new Set(),
  });
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [viewingFeedback, setViewingFeedback] = useState<string>("");
  const [feedbackComplaintKey, setFeedbackComplaintKey] = useState<string>("");
  const [complaintFeedbacks, setComplaintFeedbacks] = useState<Record<string, string>>({});

  const isIdApproved = idStatus?.toLowerCase() === "verified" || idStatus?.toLowerCase() === "approved";



  const chatScrollViewRef = useRef<ScrollView>(null);

  // Helper to determine if a chat message should be considered "unread" for the current user.
  const isUnread = (msg: any, userId?: string) => {
    if (!msg) return false;
    if (msg.senderId === userId) return false; // message from me is not unread for me
    if (typeof msg.read === "boolean") return msg.read === false;
    if (typeof msg.read === "string") return msg.read.toLowerCase() !== "true";
    // If missing or other types, consider it unread (from someone else)
    return true;
  };

  const addStatusUpdateKey = (statusKey: string, firebaseKey?: string) => {
    if (!firebaseKey) return;
    setStatusUpdates((prev) => {
      const copy: Record<string, Set<string>> = {
        pending: new Set(prev.pending),
        inprogress: new Set(prev.inprogress),
        resolved: new Set(prev.resolved),
      };
      if (!copy[statusKey]) copy[statusKey] = new Set();
      copy[statusKey].add(firebaseKey);
      return copy;
    });
  };

  // ===========================
  // Fetch User's Purok and idStatus from Firestore
  // ===========================
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDocRef = doc(firestore, "users", user.uid);
      const snapshot = await getDoc(userDocRef);

      if (snapshot.exists()) {
        const userData = snapshot.data();
        setUserPurok(userData.purok || "");
        setIdStatus(userData.idstatus || "Pending");
      }
    } catch (error) {
      console.error("Error fetching user data from Firestore:", error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    // Re-triggering other fetches if necessary, 
    // though onSnapshot handles real-time updates for complaints and feedback
    setRefreshing(false);
  };

  // ===========================
  // Fetch Feedbacks from Firebase
  // ===========================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const feedbackRef = collection(firestore, "complaintFeedback");

    const unsubscribe = onSnapshot(feedbackRef, (snapshot) => {
      const feedbacks: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.feedbackMessage) {
          feedbacks[doc.id] = data.feedbackMessage;
        }
      });
      setComplaintFeedbacks(feedbacks);
    });

    return () => unsubscribe();
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

    const complaintsRef = collection(firestore, "users", user.uid, "userComplaints");
    const q = query(complaintsRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const complaintsArray: NotificationItem[] = [];

      snapshot.forEach((docSnap) => {
        const value = docSnap.data();
        complaintsArray.push({
          firebaseKey: docSnap.id,
          id: value.id || Date.now(),
          message: value.message,
          label: value.label,
          type: value.type,
          timestamp: value.timestamp instanceof Timestamp ? value.timestamp.toDate().toLocaleString() : value.timestamp,
          purok: value.purok,
          status: value.status,
          incidentPurok: value.incidentPurok,
          incidentLocation: value.incidentLocation,
          evidencePhoto: value.evidencePhoto,
          hasUpdate: value.hasUpdate || false,
        });
      });

      setNotifications((prevNotifs) => {
        const prevMap = new Map<string, NotificationItem>();
        prevNotifs.forEach((p) => { if (p.firebaseKey) prevMap.set(p.firebaseKey, p); });

        complaintsArray.forEach((c) => {
          const fk = c.firebaseKey;
          const statusKey = (c.status || "").toLowerCase().replace(" ", "") as "pending" | "inprogress" | "resolved";

          const prev = fk ? prevMap.get(fk) : undefined;
          if (prev && prev.status !== c.status && fk) {
            addStatusUpdateKey(statusKey, fk);
          }

          if (c.hasUpdate && fk) {
            addStatusUpdateKey(statusKey, fk);
          }
        });

        return complaintsArray;
      });

      setFetchingComplaints(false);
    });

    return () => unsubscribe();
  }, []);

  // Check if complaint has status update badge
  const hasStatusUpdate = (complaint: NotificationItem) => {
    if (!complaint.firebaseKey) return false;
    const statusKey = (complaint.status || "").toLowerCase().replace(" ", "") as "pending" | "inprogress" | "resolved";
    return statusUpdates[statusKey]?.has(complaint.firebaseKey) || false;
  };

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
      const API_URL = "http://192.168.224.3:5000";

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
        purok: userPurok,
        incidentPurok: incidentPurok,
        incidentLocation: incidentLocation,
        status: "pending",
      };

      if (selectedImage) {
        newItem.evidencePhoto = selectedImage;
      }

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Not logged in");
        setLoading(false);
        return;
      }

      const complaintsRef = collection(firestore, "users", user.uid, "userComplaints");
      const itemToSave = {
        ...newItem,
        timestamp: serverTimestamp(), // Use Firestore serverTimestamp
      };

      await addDoc(complaintsRef, itemToSave);

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

    // Note: We don't clear status update badge here anymore
    // It will only be cleared when the user clicks the filter button

    if (!complaint.firebaseKey) return;

    const user = auth.currentUser;
    if (!user) return;

    const chatRef = collection(firestore, "users", user.uid, "userComplaints", complaint.firebaseKey, "chat");
    const chatQuery = query(chatRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(chatQuery, (snapshot) => {
      const messagesArray: any[] = [];
      snapshot.forEach((docSnap) => {
        const value = docSnap.data();
        messagesArray.push({
          id: docSnap.id,
          senderId: value.senderId,
          message: value.message,
          timestamp: value.timestamp instanceof Timestamp ? value.timestamp.toDate().toLocaleString() : value.timestamp,
          read: value.read === true || value.read === "true" ? true : false,
        });

        // Mark all admin messages as read
        if (value.senderId !== user.uid && isUnread(value, user.uid)) {
          updateDoc(doc(firestore, "users", user.uid, "userComplaints", complaint.firebaseKey!, "chat", docSnap.id), {
            read: true
          });
        }
      });
      setChatMessages(messagesArray);

      // Auto-scroll to bottom when messages update
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    // Remove red notification badge for this complaint
    setNotifications((prev) =>
      prev.map((c) =>
        c.firebaseKey === complaint.firebaseKey
          ? { ...c, hasUpdate: false }
          : c
      )
    );

    // Clear hasUpdate badge in Firestore
    if (complaint.firebaseKey) {
      updateDoc(doc(firestore, "users", user.uid, "userComplaints", complaint.firebaseKey), {
        hasUpdate: false
      });
    }

    // Remove this complaint from statusUpdates sets (clear notification dot for its status)
    if (complaint.firebaseKey) {
      setStatusUpdates((prev) => {
        const copy: Record<string, Set<string>> = {
          pending: new Set(prev.pending),
          inprogress: new Set(prev.inprogress),
          resolved: new Set(prev.resolved),
        };
        Object.keys(copy).forEach((k) => copy[k].delete(complaint.firebaseKey as string));
        return copy;
      });
    }
  };

  // Confirm and delete a complaint (only allowed for pending complaints)
  const confirmAndDelete = (complaint: NotificationItem) => {
    if (!complaint.firebaseKey) return;

    Alert.alert(
      "Delete Complaint",
      "Are you sure you want to delete this complaint? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;

              const complaintRef = doc(firestore, "users", user.uid, "userComplaints", complaint.firebaseKey!);
              await deleteDoc(complaintRef);

              // Close modal and clear selected complaint
              setDetailModalVisible(false);
              setSelectedComplaint(null);

              // Remove locally cached notification and any status update markers
              setNotifications((prev) => prev.filter((c) => c.firebaseKey !== complaint.firebaseKey));
              setStatusUpdates((prev) => {
                const copy: Record<string, Set<string>> = {
                  pending: new Set(prev.pending),
                  inprogress: new Set(prev.inprogress),
                  resolved: new Set(prev.resolved),
                };
                Object.keys(copy).forEach((k) => copy[k].delete(complaint.firebaseKey as string));
                return copy;
              });

              Alert.alert("Deleted", "Complaint deleted successfully.");
            } catch (err) {
              console.error("Failed to delete complaint:", err);
              Alert.alert("Error", "Failed to delete complaint. Please try again.");
            }
          }
        }
      ]
    );
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !selectedComplaint?.firebaseKey) return;

    const user = auth.currentUser;
    if (!user) return;

    const chatRef = collection(firestore, "users", user.uid, "userComplaints", selectedComplaint.firebaseKey, "chat");

    const newMessage = {
      senderId: user.uid,
      message: text,
      timestamp: serverTimestamp(),
      read: false,
    };

    try {
      setChatInput("");
      await addDoc(chatRef, newMessage);

      // Auto-scroll to bottom after sending
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  // Submit Feedback
  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert("Error", "Please enter your feedback");
      return;
    }

    if (!feedbackComplaintKey) return;

    try {
      const feedbackRef = doc(firestore, "complaintFeedback", feedbackComplaintKey);
      await setDoc(feedbackRef, {
        feedbackMessage: feedbackMessage.trim(),
        timestamp: serverTimestamp(),
      });

      setFeedbackMessage("");
      setFeedbackModalVisible(false);
      Alert.alert("Success", "Feedback submitted successfully!");
    } catch (error: any) {
      Alert.alert("Error", "Failed to submit feedback: " + error.message);
    }
  };

  // Open feedback modal for sending or viewing
  const handleFeedbackAction = (complaintKey: string) => {
    setFeedbackComplaintKey(complaintKey);

    if (complaintFeedbacks[complaintKey]) {
      // View existing feedback
      setViewingFeedback(complaintFeedbacks[complaintKey]);
      setFeedbackModalVisible(true);
    } else {
      // Send new feedback
      setViewingFeedback("");
      setFeedbackMessage("");
      setFeedbackModalVisible(true);
    }
  };

  const getStatusColor = (status?: string) => {
    switch ((status || "").toLowerCase()) {
      case "pending": return "#f59e0b";
      case "resolved": return "#10b981";
      case "in progress": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  const getLabelColor = (label?: string) => {
    switch ((label || "").toLowerCase()) {
      case "urgent": return "#ef4444";
      case "high": return "#f97316";
      case "medium": return "#eab308";
      case "low": return "#22c55e";
      default: return "#6366f1";
    }
  };

  // Calculate filter badge - show red dot if any complaints in this status have updates
  const hasFilterUpdate = (status: string) => {
    if (status === "all") {
      // Check if any status category has updates
      return Object.values(statusUpdates).some(set => set.size > 0);
    }

    const statusKey = status.toLowerCase().replace(" ", "") as "pending" | "inprogress" | "resolved";
    return statusUpdates[statusKey] && statusUpdates[statusKey].size > 0;
  };

  // ===========================
  // UI
  // ===========================
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>My Complaints</Text>
        <Text style={styles.headerSubtitle}>Track and manage your reports</Text>

        {!fetchingComplaints && (
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStatBox}>
              <Text style={styles.headerStatLabel}>Total Filed</Text>
              <Text style={styles.headerStatValue}>{notifications.length}</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStatBox}>
              <Text style={styles.headerStatLabel}>Resolved</Text>
              <Text style={styles.headerStatValue}>
                {notifications.filter(n => n.status?.toLowerCase() === "resolved").length}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {["all", "pending", "in progress", "resolved"].map((status) => {
          const showDot = hasFilterUpdate(status);
          const key = status.toLowerCase().replace(" ", "") as "pending" | "inprogress" | "resolved";

          return (
            <TouchableOpacity
              key={status}
              onPress={() => {
                setFilterStatus(status as any);
                // Clear the status update dots when clicking the filter
                if (status === "all") {
                  // Clear all status updates
                  setStatusUpdates({ pending: new Set(), inprogress: new Set(), resolved: new Set() });
                } else {
                  // Clear only the specific status
                  setStatusUpdates(prev => ({ ...prev, [key]: new Set() }));
                }
              }}
              style={[
                styles.filterPill,
                filterStatus === status && styles.filterPillActive
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filterStatus === status && styles.filterTextActive
                ]}
              >
                {status}
              </Text>

              {showDot && (
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: COLORS.danger,
                  marginLeft: 6,
                }} />
              )}
            </TouchableOpacity>
          );
        })}
        </ScrollView>
      </View>

      {/* Loading State */}
      {fetchingComplaints ? (
        <ScrollView 
          style={styles.listContainer} 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
        >
          {[1, 2, 3].map((idx) => (
            <View key={idx} style={[styles.complaintCard]}>
              <View style={[styles.cardHeader, { marginBottom: 12 }]}>
                <Skeleton style={{ width: 60, height: 20, borderRadius: 6 }} />
                <Skeleton style={{ width: 60, height: 20, borderRadius: 6 }} />
              </View>
              <Skeleton style={{ width: "100%", height: 16, borderRadius: 4, marginBottom: 8 }} />
              <Skeleton style={{ width: "80%", height: 16, borderRadius: 4, marginBottom: 12 }} />
              <View style={styles.cardFooter}>
                <Skeleton style={{ width: 100, height: 12, borderRadius: 4, marginTop: 8 }} />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <>
          {/* Complaint Cards */}
          <ScrollView
            style={styles.listContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {notifications
              .filter((n) => {
                if (filterStatus === "all") return true;

                // Normalize both strings by removing ALL spaces and converting to lowercase
                const status = (n.status || "").toLowerCase().replace(/\s+/g, "").trim();
                const filterKey = filterStatus.toLowerCase().replace(/\s+/g, "").trim();

                // Handle various "in progress" formats
                if (filterKey === "inprogress") {
                  return status === "inprogress" ||
                    status === "in-progress" ||
                    status === "in_progress" ||
                    status === "inprocess" ||
                    status === "processing";
                }

                return status === filterKey;
              })
              .map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[
                    styles.complaintCard,
                    n.status?.toLowerCase() === "resolved" && styles.resolvedCard
                  ]}
                  onPress={() => n.status?.toLowerCase() !== "resolved" && openDetailModal(n)}
                  activeOpacity={n.status?.toLowerCase() === "resolved" ? 1 : 0.7}
                  disabled={n.status?.toLowerCase() === "resolved"}
                >
                  {(n.hasUpdate || hasStatusUpdate(n)) && (
                    <View style={styles.updateBadge}>
                      <Text style={styles.updateText}>!</Text>
                    </View>
                  )}

                  {/* Evidence Photo */}
                  {n.evidencePhoto && (
                    <Image
                      source={{ uri: n.evidencePhoto }}
                      style={[
                        styles.cardImage,
                        n.status?.toLowerCase() === "resolved" && styles.blurredImage
                      ]}
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
                  <Text
                    style={[
                      styles.messagePreview,
                      n.status?.toLowerCase() === "resolved" && styles.blurredText
                    ]}
                    numberOfLines={2}
                  >
                    {n.message}
                  </Text>

                  {/* Footer Row */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>🕒 {n.timestamp}</Text>
                  </View>

                  {/* Feedback Button Overlay for Resolved Complaints */}
                  {n.status?.toLowerCase() === "resolved" && (
                    <View style={styles.feedbackOverlay}>
                      <TouchableOpacity
                        style={styles.feedbackButton}
                        onPress={() => n.firebaseKey && handleFeedbackAction(n.firebaseKey)}
                      >
                        <Text style={styles.feedbackButtonText}>
                          {n.firebaseKey && complaintFeedbacks[n.firebaseKey]
                            ? "📝 View Feedback"
                            : "✍️ Send Feedback"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>
        </>
      )}

      {/* Add Complaint FAB */}
      <View style={[styles.fabContainer, { bottom: Math.max(insets.bottom + 85, 90) }]}>
        {!isIdApproved && (
          <View style={styles.disabledTooltip}>
            <Text style={styles.disabledMessage}>ID verification required to post</Text>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.fab,
            !isIdApproved && { backgroundColor: COLORS.muted, shadowOpacity: 0 }
          ]}
          onPress={() => isIdApproved && setComplaintModalVisible(true)}
          disabled={!isIdApproved}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Report</Text>
        </TouchableOpacity>
      </View>

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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {selectedComplaint?.status?.toLowerCase()?.replace(/\s+/g, "") === "pending" && (
                  <TouchableOpacity
                    onPress={() => selectedComplaint && confirmAndDelete(selectedComplaint)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {selectedComplaint && (
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>

                {/* Chat Section - ONLY show when status is IN PROGRESS or RESOLVED */}
                {selectedComplaint?.status?.toLowerCase() !== "pending" && (
                  <View style={{ flex: 1, marginBottom: 20 }}>
                    <Text style={styles.chatTitle}>Chat</Text>

                    <ScrollView
                      ref={chatScrollViewRef}
                      style={styles.chatScrollView}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={true}
                      onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
                      contentContainerStyle={{ paddingBottom: 12 }}
                    >
                      {chatMessages.length === 0 ? (
                        <Text style={styles.emptyChat}>No messages yet</Text>
                      ) : (
                        chatMessages.map((msg) => {
                          const isMine = msg.senderId === auth.currentUser?.uid;
                          return (
                            <View key={msg.id} style={[
                              styles.messageContainer,
                              isMine ? styles.myMessageContainer : styles.theirMessageContainer
                            ]}>
                              <View style={[
                                styles.messageBubble,
                                isMine ? styles.myMessageBubble : styles.theirMessageBubble
                              ]}>
                                <Text style={[
                                  styles.messageText,
                                  isMine ? styles.myMessageText : styles.theirMessageText
                                ]}>
                                  {msg.message}
                                </Text>
                              </View>
                              <Text style={styles.messageTimestamp}>
                                {msg.timestamp} {isMine && (msg.read === true ? " • Read" : " • Unread")}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </ScrollView>

                    {/* Chat Input */}
                    <View style={styles.chatInputContainer}>
                      <TextInput
                        value={chatInput}
                        onChangeText={setChatInput}
                        placeholder="Type a message..."
                        style={styles.chatInput}
                        multiline
                      />
                      <TouchableOpacity
                        onPress={sendMessage}
                        style={styles.sendButton}
                      >
                        <Text style={styles.sendButtonText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

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
                <Ionicons name="close" size={24} color={COLORS.muted} />
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

      {/* FEEDBACK MODAL */}
      <Modal visible={feedbackModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.complaintModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {viewingFeedback ? "Your Feedback" : "Send Feedback"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFeedbackModalVisible(false);
                  setFeedbackMessage("");
                  setViewingFeedback("");
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {viewingFeedback ? (
                // View existing feedback
                <View style={styles.feedbackViewContainer}>
                  <Text style={styles.feedbackViewText}>{viewingFeedback}</Text>
                </View>
              ) : (
                // Send new feedback
                <>
                  <Text style={styles.label}>Your Feedback *</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Please share your feedback about how this complaint was handled..."
                    value={feedbackMessage}
                    onChangeText={setFeedbackMessage}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={submitFeedback}
                  >
                    <Text style={styles.submitButtonText}>Submit Feedback ➔</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ===============================
// STYLES
// ===============================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  topHeader: {
    backgroundColor: COLORS.primary,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  headerSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", marginTop: 4 },

  headerStatsRow: {
    flexDirection: "row",
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
  },
  headerStatBox: { flex: 1, alignItems: "center" },
  headerStatLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerStatValue: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerStatDivider: { width: 1, height: "70%", backgroundColor: "rgba(255,255,255,0.2)" },

  filterWrapper: { marginTop: 16, marginBottom: 10 },
  filterScroll: { paddingHorizontal: 18, gap: 8 },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { color: COLORS.muted, fontWeight: "700", textTransform: "capitalize", fontSize: 13 },
  filterTextActive: { color: "#fff" },

  listContainer: { flex: 1, paddingHorizontal: 18 },

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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
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
    fontWeight: "800",
  },
  messagePreview: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
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
    fontWeight: "800",
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  detailCloseButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  detailCloseButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },

  // Chat Styles
  chatContainer: {
    marginTop: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
  },
  chatTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 12,
    color: COLORS.text,
  },
  chatScrollView: {
    maxHeight: 250,
    marginBottom: 12,
    paddingRight: 8,
  },
  emptyChat: {
    color: COLORS.muted,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessageContainer: {
    alignItems: "flex-end",
  },
  theirMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    padding: 14,
    borderWidth: 1,
    maxWidth: "80%",
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  theirMessageBubble: {
    backgroundColor: "#F9FAFB",
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopRightRadius: 18,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: COLORS.text,
  },
  messageTimestamp: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  chatInputContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    maxHeight: 100,
    fontSize: 14,
    color: COLORS.text,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  fabContainer: {
    position: "absolute",
    alignSelf: "center",
    alignItems: "center",
    zIndex: 100,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    gap: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  disabledTooltip: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
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
    fontWeight: "900",
    color: COLORS.text,
  },
  closeButton: {
    padding: 5,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  label: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(251, 228, 81, 0.1)",
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 130,
    marginBottom: 18,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
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
    borderColor: COLORS.primary,
  },
  removeImageButton: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: COLORS.danger,
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    marginBottom: 20,
  },
  uploadIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  uploadIcon: {
    fontSize: 24,
  },
  uploadText: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: "600",
    marginBottom: 12,
  },
  chooseFilesButton: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 100,
    alignItems: "center",
  },
  chooseFilesText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
  },

  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },


  // Success Modal
  modalBox: {
    backgroundColor: COLORS.card,
    padding: 30,
    borderRadius: 20,
    width: 280,
    alignItems: "center",
  },
  successIcon: {
    fontSize: 50,
    color: COLORS.success,
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
    color: COLORS.text,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 14,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: "#F9FAFB",
    marginBottom: 14,
  },
  picker: {
    fontSize: 14,
    color: COLORS.text,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },

  disabledMessage: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  updateBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: COLORS.danger,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  updateText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  resolvedCard: {
    opacity: 0.85,
  },
  blurredImage: {
    opacity: 0.3,
  },
  blurredText: {
    opacity: 0.3,
  },
  feedbackOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
  },
  feedbackButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  feedbackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  feedbackViewContainer: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 150,
  },
  feedbackViewText: {
    fontSize: 15,
    color: "#1f2937",
    lineHeight: 22,
  },
});

// ===============================
// REUSABLE SKELETON COMPONENT
// ===============================
function Skeleton({ style }: { style: any }) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={[style, { opacity: pulseAnim, backgroundColor: "#E5E7EB" }]} />
  );
}