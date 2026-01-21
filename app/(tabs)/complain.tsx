import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { get, onValue, push, ref, remove, set } from "firebase/database";
import { auth, db } from "../../backend/firebaseConfig";

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
  const [idStatus, setIdStatus] = useState<string>("pending");
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
          setIdStatus(userData.idstatus || "pending");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, []);

  // ===========================
// Fetch Feedbacks from Firebase
// ===========================
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const feedbackRef = ref(db, "complaintFeedback");
    
    const unsubscribe = onValue(feedbackRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const feedbacks: Record<string, string> = {};
        Object.entries(data).forEach(([complaintKey, feedbackData]: [string, any]) => {
          if (feedbackData.feedbackMessage) {
            feedbacks[complaintKey] = feedbackData.feedbackMessage;
          }
        });
        setComplaintFeedbacks(feedbacks);
      }
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

    const complaintsRef = ref(db, `users/${user.uid}/userComplaints`);
    
    const unsubscribe = onValue(complaintsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const complaintsArray = Object.entries(data).map(([key, value]: [string, any]) => {
          const chat = value.chat || {};
          // Determine unread admin messages robustly
          const hasUnreadMsg = Object.values(chat).some((msg: any) => isUnread(msg, auth.currentUser?.uid));

          return {
            firebaseKey: key,
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
            hasUpdate: hasUnreadMsg,
          };
        });

        // Use functional update so we can compare previous notifications to detect status changes
        setNotifications((prevNotifs) => {
          const reversed = complaintsArray.reverse();

          // Build a map of previous notifications by firebaseKey for quick lookup
          const prevMap = new Map<string, NotificationItem>();
          prevNotifs.forEach((p) => { if (p.firebaseKey) prevMap.set(p.firebaseKey, p); });

          // For each complaint, detect status change and unread messages and mark statusUpdates
          reversed.forEach((c) => {
            const fk = c.firebaseKey;
            const statusKey = (c.status || "").toLowerCase().replace(" ", "") as "pending" | "inprogress" | "resolved";

            const prev = fk ? prevMap.get(fk) : undefined;
            if (prev && prev.status !== c.status && fk) {
              addStatusUpdateKey(statusKey, fk);
            }

            // If there are unread admin messages, add to status updates for that status key
            if (c.hasUpdate && fk) {
              addStatusUpdateKey(statusKey, fk);
            }
          });

          return reversed;
        });
      } else {
        setNotifications([]);
      }
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

  const onRefresh = async () => {
    setRefreshing(true);

    try {
      const user = auth.currentUser;
      if (!user) return;

      const complaintsRef = ref(db, `users/${user.uid}/userComplaints`);
      const snapshot = await get(complaintsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const complaintsArray = Object.entries(data).map(([key, value]: [string, any]) => {
          const chat = value.chat || {};
          const hasUpdate = Object.values(chat).some((msg: any) => isUnread(msg, auth.currentUser?.uid));

          return {
            firebaseKey: key,
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
            hasUpdate,
          };
        });
        // Compare with previous notifications to detect status changes and add status update markers
        setNotifications((prevNotifs) => {
          const reversed = complaintsArray.reverse();
          const prevMap = new Map<string, NotificationItem>();
          prevNotifs.forEach((p) => { if (p.firebaseKey) prevMap.set(p.firebaseKey, p); });

          reversed.forEach((c) => {
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

          return reversed;
        });
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to refresh");
    }

    setRefreshing(false);
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
      const API_URL = "http://192.168.68.135:5000";

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

    // Note: We don't clear status update badge here anymore
    // It will only be cleared when the user clicks the filter button

    if (!complaint.firebaseKey) return;

    const user = auth.currentUser;
    if (!user) return;

    const chatRef = ref(db, `users/${user.uid}/userComplaints/${complaint.firebaseKey}/chat`);

    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesArray = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          senderId: value.senderId,
          message: value.message,
          timestamp: value.timestamp,
          read: value.read === true || value.read === "true" ? true : false,
        }));
        setChatMessages(messagesArray);

        // Mark all admin messages as read (use isUnread so we handle boolean/string/missing formats)
        Object.entries(data).forEach(async ([key, value]: [string, any]) => {
          if (value.senderId !== user.uid && isUnread(value, user.uid)) {
            await set(ref(db, `users/${user.uid}/userComplaints/${complaint.firebaseKey}/chat/${key}/read`), true);
          }
        });

        // Auto-scroll to bottom when messages update
        setTimeout(() => {
          chatScrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        setChatMessages([]);
      }
    });

    // Remove red notification badge for this complaint
    setNotifications((prev) =>
      prev.map((c) =>
        c.firebaseKey === complaint.firebaseKey
          ? { ...c, hasUpdate: false }
          : c
      )
    );

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

              const complaintRef = ref(db, `users/${user.uid}/userComplaints/${complaint.firebaseKey}`);
              await remove(complaintRef);

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

    const chatRef = push(ref(db, `users/${user.uid}/userComplaints/${selectedComplaint.firebaseKey}/chat`));

    const newMessage = {
      senderId: user.uid,
      message: text,
      timestamp: new Date().toLocaleString(),
      read: false, // ensure boolean false is written to Firebase
    } as const;

    try {
      // Optimistic UI update: show the message immediately
      setChatMessages((prev) => [
        ...prev,
        { id: chatRef.key || String(Date.now()), senderId: newMessage.senderId, message: newMessage.message, timestamp: newMessage.timestamp, read: false },
      ]);

      setChatInput("");

      await set(chatRef, newMessage);

      // Auto-scroll to bottom after sending
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
      // Revert optimistic update on failure
      setChatMessages((prev) => prev.filter((m) => m.id !== (chatRef.key || "")));
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
      const feedbackRef = ref(db, `complaintFeedback/${feedbackComplaintKey}`);
      await set(feedbackRef, {
        feedbackMessage: feedbackMessage.trim(),
        timestamp: new Date().toLocaleString(),
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
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      
      {/* Header */}
      <Text style={styles.header}>Complaints</Text>
      
      {/* FILTER HEADER */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 10 }}>
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
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: filterStatus === status ? "#6366f1" : "#e5e7eb",
                flexDirection: "row",
                alignItems: "center",
                position: "relative",
              }}
            >
              <Text
                style={{
                  color: filterStatus === status ? "#fff" : "#374151",
                  fontWeight: "600",
                  textTransform: "capitalize",
                }}
              >
                {status}
              </Text>

              {showDot && (
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#ef4444",
                  marginLeft: 6,
                }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Loading State */}
      {fetchingComplaints ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      ) : (
        <>
          {/* Complaint Cards */}
          <ScrollView
            style={styles.listContainer}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 20 }}
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

      {/* Add Complaint Button */}
      <TouchableOpacity
        style={[
          styles.addButton,
          idStatus !== "approved" && { backgroundColor: "#d1d5db" }
        ]}
        onPress={() => idStatus === "approved" && setComplaintModalVisible(true)}
        disabled={idStatus !== "approved"}
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
                  <Text style={styles.closeButtonText}>✕</Text>
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
          <Text style={styles.closeButtonText}>✕</Text>
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
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    paddingTop: 0,
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
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 15,
    color: "#1f2937",
    lineHeight: 22,
    flexWrap: 'wrap',
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

  // Chat Styles
  chatContainer: {
    marginTop: 20,
    marginBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
  },
  chatTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 12,
    color: "#1f2937",
  },
  chatScrollView: {
    maxHeight: 250,
    marginBottom: 12,
    paddingRight: 8,
  },
  emptyChat: {
    color: "#6b7280",
    fontStyle: "italic",
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
    padding: 12,
    borderRadius: 16,
    maxWidth: "80%",
  },
  myMessageBubble: {
    backgroundColor: "#6366f1",
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: "#e5e7eb",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: "#374151",
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
    borderColor: "#d1d5db",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
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
  deleteButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
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
  updateBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#ef4444",
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
    fontWeight: "bold",
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
  backgroundColor: "#6366f1",
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 10,
  shadowColor: "#6366f1",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 5,
},
feedbackButtonText: {
  color: "#fff",
  fontSize: 16,
  fontWeight: "bold",
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