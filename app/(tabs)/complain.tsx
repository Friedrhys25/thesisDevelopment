import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
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
  rawTimestamp?: any;
  purok: string;
  status: string;
  incidentPurok?: string;
  incidentLocation?: string;
  evidencePhoto?: string;
  hasUpdate?: boolean;
  isUrgent?: boolean;
}

const AnimatedCard = ({ children, onPress, disabled, style }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // Flashing animation loop
  const flashAnim = useRef(
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    )
  ).current;

  const handlePressIn = () => {
    Animated.timing(scale, { toValue: 0.95, duration: 200, useNativeDriver: true }).start();
    flashAnim.start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    flashAnim.stop();
    opacity.setValue(1); // Reset opacity
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      onPress={onPress}
      disabled={disabled}
      style={{ marginBottom: 16 }}
    >
      <Animated.View style={[style, { transform: [{ scale }], opacity, marginBottom: 0 }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

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
  const [isUrgent, setIsUrgent] = useState(false);
  const [urgentCooldownMsg, setUrgentCooldownMsg] = useState("");
  const [isUrgentDisabled, setIsUrgentDisabled] = useState(false);

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
          rawTimestamp: value.timestamp,
          purok: value.purok,
          status: value.status,
          incidentPurok: value.incidentPurok,
          incidentLocation: value.incidentLocation,
          evidencePhoto: value.evidencePhoto,
          hasUpdate: value.hasUpdate || false,
          isUrgent: value.isUrgent || false,
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

  // ===========================
  // Effect to Check Urgent Cooldown
  // ===========================
  useEffect(() => {
    // Look at past complaints and evaluate cooldown
    const verifyUrgentUsage = () => {
      const urgentPast7Days = notifications.filter(n => {
        if (!n.isUrgent) return false;
        
        let reportDate;
        if (n.rawTimestamp?.toDate) {
          reportDate = n.rawTimestamp.toDate();
        } else if (n.timestamp) {
           // Fallback attempting to parse strings
           reportDate = new Date(n.timestamp);
        }
        if (!reportDate || isNaN(reportDate.getTime())) return false;
        
        const now = new Date();
        const diffMs = now.getTime() - reportDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }).sort((a, b) => {
        const dateA = a.rawTimestamp?.toDate ? a.rawTimestamp.toDate().getTime() : new Date(a.timestamp).getTime();
        const dateB = b.rawTimestamp?.toDate ? b.rawTimestamp.toDate().getTime() : new Date(b.timestamp).getTime();
        return dateB - dateA; // Descending
      });

      if (urgentPast7Days.length >= 2) {
        setIsUrgentDisabled(true);
        setIsUrgent(false);
        // Find the oldest of the 2 most recent ones
        const oldestOfTop2 = urgentPast7Days[1];
        
        if (oldestOfTop2) {
          let oldestDate = oldestOfTop2.rawTimestamp?.toDate ? oldestOfTop2.rawTimestamp.toDate() : new Date(oldestOfTop2.timestamp);
          const cooldownExpiry = new Date(oldestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          // Calculate human-readable time remaining
          const now = new Date();
          const diffMs = cooldownExpiry.getTime() - now.getTime();
          
          if (diffMs > 0) {
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeStr = "";
            if (days > 0) timeStr += `${days}d `;
            if (hours > 0) timeStr += `${hours}h `;
            timeStr += `${mins}m`;
            
            setUrgentCooldownMsg(`Limit Reached. Available in: ${timeStr}`);
          } else {
            // Edge case
            setIsUrgentDisabled(false);
            setUrgentCooldownMsg("");
          }
        }
      } else {
        setIsUrgentDisabled(false);
        setUrgentCooldownMsg("");
      }
    };

    if (!fetchingComplaints) {
      // Create an interval to keep the timer updated every minute if disabled
      verifyUrgentUsage();
      const interval = setInterval(verifyUrgentUsage, 60000); // 1 minute
      return () => clearInterval(interval);
    }
  }, [notifications, fetchingComplaints]);

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

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "Not logged in");
      return;
    }

    setLoading(true);

    try {
      // Check Daily Limit (Max 2 per day)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const complaintsRef = collection(firestore, "users", user.uid, "userComplaints");
      const q = query(
        complaintsRef,
        where("timestamp", ">=", Timestamp.fromDate(todayStart)),
        where("timestamp", "<=", Timestamp.fromDate(todayEnd))
      );

      const querySnapshot = await getDocs(q);
      if (querySnapshot.size >= 2) {
        Alert.alert("Limit Reached", "You can only submit 2 complaints per day.");
        setLoading(false);
        return;
      }

      const API_URL = "http://192.168.1.49:5000";

      const response = await fetch(`${API_URL}/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      const normalizedLabel = isUrgent ? "urgent" : String(data.label).toLowerCase().trim();
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
        isUrgent: isUrgent,
      };

      if (selectedImage) {
        newItem.evidencePhoto = selectedImage;
      }

      // user is already checked above

      const itemToSave = {
        ...newItem,
        timestamp: serverTimestamp(), // Use Firestore serverTimestamp
      };

      await addDoc(complaintsRef, itemToSave);

      setMessage("");
      setIncidentLocation("");
      setSelectedImage(null);
      setIsUrgent(false);
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
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
                <AnimatedCard
                  key={n.id}
                  onPress={() => n.status?.toLowerCase() !== "resolved" && openDetailModal(n)}
                  disabled={n.status?.toLowerCase() === "resolved"}
                  style={[
                    styles.complaintCard,
                    n.status?.toLowerCase() === "resolved" && styles.resolvedCard
                  ]}
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
                </AnimatedCard>
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
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
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
                        <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
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
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
          <View style={styles.complaintModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complaint Details</Text>
              <TouchableOpacity
                onPress={() => {
                  setComplaintModalVisible(false);
                  setSelectedImage(null);
                  setMessage("");
                  setIncidentLocation("");
                  setIsUrgent(false);
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

              {/* URGENT SWITCH */}
              <View style={styles.urgentContainer}>
                <View style={styles.urgentTextContainer}>
                  <Text style={styles.urgentTitle}>Mark as Urgent</Text>
                  <Text style={styles.urgentDescription}>
                    For severe issues that need immediate action. (Max 2 per week)
                  </Text>
                  {isUrgentDisabled && (
                    <Text style={styles.urgentCooldownText}>{urgentCooldownMsg}</Text>
                  )}
                </View>
                <Switch
                  value={isUrgent}
                  onValueChange={(val) => {
                    if (!isUrgentDisabled) {
                      setIsUrgent(val);
                    }
                  }}
                  disabled={isUrgentDisabled}
                  trackColor={{ false: "#767577", true: "#fca5a5" }}
                  thumbColor={isUrgent ? COLORS.danger : "#f4f3f4"}
                />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading}
                style={{ overflow: 'hidden', borderRadius: 16 }}
              >
                <LinearGradient
                   colors={['#F16F24', '#FEB47B']}
                   start={{ x: 0, y: 0 }}
                   end={{ x: 1, y: 1 }}
                   style={styles.submitButton}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Submit Complaint ➔</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

            </ScrollView>

          </View>
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", alignItems: "center", justifyContent: "center" }}>
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
                    onPress={submitFeedback}
                    style={{ overflow: 'hidden', borderRadius: 16 }}
                  >
                    <LinearGradient
                       colors={['#F16F24', '#FEB47B']}
                       start={{ x: 0, y: 0 }}
                       end={{ x: 1, y: 1 }}
                       style={styles.submitButton}
                    >
                      <Text style={styles.submitButtonText}>Submit Feedback ➔</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
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
    borderRadius: 24,
    padding: 20,
    marginBottom: 0, // Handled by AnimatedCard wrapper
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.4)",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    alignItems: "center",
  },
  labelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  labelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  messagePreview: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
    marginBottom: 16,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(229,231,235,0.6)",
    paddingTop: 12,
    marginTop: 4,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    color: COLORS.muted,
    fontWeight: "500",
  },

  // Detail Modal Styles
  detailModalBox: {
    backgroundColor: COLORS.card,
    borderRadius: 32,
    padding: 24,
    width: "90%",
    maxWidth: 480,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  detailImage: {
    width: "100%",
    height: 220,
    borderRadius: 20,
    marginBottom: 20,
  },
  detailBadges: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  detailBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  detailBadgeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  detailSection: {
    marginBottom: 20,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
    lineHeight: 26,
  },
  detailCloseButton: {
    backgroundColor: COLORS.text,
    paddingVertical: 16,
    justifyContent: "center",
    borderRadius: 20,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailCloseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Chat Styles
  chatContainer: {
    marginTop: 24,
    marginBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 20,
  },
  chatTitle: {
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 16,
    color: COLORS.text,
  },
  chatScrollView: {
    maxHeight: 300,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  emptyChat: {
    color: COLORS.muted,
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 40,
    opacity: 0.7,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: "85%",
  },
  myMessageContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  theirMessageContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  theirMessageBubble: {
    backgroundColor: "#F3F4F6",
    borderBottomLeftRadius: 4,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 20,
  },
  messageActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    marginRight: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
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
    color: "#9CA3AF",
    marginTop: 4,
    paddingHorizontal: 4,
    alignSelf: "flex-end",
  },
  chatInputContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    alignItems: "flex-end",
  },
  chatInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#fff",
    maxHeight: 120,
    fontSize: 15,
    color: COLORS.text,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    justifyContent: "center",
    borderRadius: 24,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 2, // Align with input
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },

  // FAB (+ Report)
  fabContainer: {
    position: "absolute",
    right: 20, // Move to right side for standard FAB placement? Or keep center?
               // User asked for "redesign", usually implies better UX. Center is easier for thumb if holding phone with one hand?
               // Let's keep it center but maybe elevate it more.
    alignSelf: "center",
    alignItems: "center",
    zIndex: 100,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  fabText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  disabledTooltip: {
    backgroundColor: "#1F2937",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  
  // Complaint Modal (Form)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)", // Darker overlay
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  complaintModalBox: {
    backgroundColor: "#fff",
    borderRadius: 32,
    padding: 24,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: -0.5,
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
    fontSize: 16,
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
    fontSize: 16,
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
  urgentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  urgentTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.danger,
    marginBottom: 4,
  },
  urgentDescription: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
  urgentCooldownText: {
    fontSize: 11,
    color: COLORS.danger,
    fontWeight: "bold",
    marginTop: 6,
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
    fontSize: 16,
    color: COLORS.text,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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