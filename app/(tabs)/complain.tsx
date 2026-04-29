import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
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
    Timestamp,
    updateDoc,
    where
} from "firebase/firestore";
import { auth, firestore } from "../../backend/firebaseConfig";
import {
  savePushTokenToFirestore,
  showLocalNotification,
} from "../../utils/notifications";

// ── Palette from the Splash Screen ──────────────────────────────────────────
const COLORS = {
  // Base
  bg:          "#080f26",        // even deeper than splash's #0b1a3d
  surface:     "#0f1e45",        // card background
  surfaceAlt:  "#0d1a3c",
  elevated:    "#162254",

  // Text
  text:        "#E8EEFF",
  textMuted:   "#8895BB",
  textDim:     "#4A5880",

  // Accent — Gold / Amber
  gold:        "#f59e0b",
  goldLight:   "#fbbf24",
  goldDim:     "rgba(245,158,11,0.15)",
  goldBorder:  "rgba(245,158,11,0.3)",

  // Philippine flag accents
  blue:        "#1447c0",
  blueMid:     "#1E56D8",
  blueLight:   "rgba(20,71,192,0.3)",
  red:         "#ce1126",
  redLight:    "rgba(206,17,38,0.25)",

  // Status
  pending:     "#f59e0b",
  inProgress:  "#3b82f6",
  resolved:    "#10b981",
  danger:      "#ef4444",
  success:     "#10b981",

  // Borders
  border:      "rgba(255,255,255,0.06)",
  borderGold:  "rgba(245,158,11,0.2)",
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
  resolutionPhoto?: string;
  hasUpdate?: boolean;
  isUrgent?: boolean;
  deployedTanodUid?: string;
  deployedTanods?: { uid: string; name: string }[];
  hasFeedback?: boolean;
}

// ── Animated Card ────────────────────────────────────────────────────────────
const AnimatedCard = ({ children, onPress, disabled, style }: any) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const glowAnim= useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 0.97, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 1, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const borderColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(245,158,11,0.15)", "rgba(245,158,11,0.55)"],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={!disabled ? handlePressIn : undefined}
      onPressOut={!disabled ? handlePressOut : undefined}
      onPress={onPress}
      disabled={disabled}
      style={{ marginBottom: 14 }}
    >
      <Animated.View style={[style, { transform: [{ scale }], borderColor, marginBottom: 0 }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ style }: { style: any }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[style, { opacity: pulse, backgroundColor: COLORS.elevated }]} />;
}

// ── Star Row ─────────────────────────────────────────────────────────────────
function StarRow({ rating, onRate }: { rating: number; onRate?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <TouchableOpacity key={s} onPress={() => onRate?.(s)} disabled={!onRate}>
          <Ionicons
            name={s <= rating ? "star" : "star-outline"}
            size={onRate ? 34 : 26}
            color={s <= rating ? COLORS.gold : COLORS.textDim}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function App() {
  const insets = useSafeAreaInsets();

  const [message,             setMessage]             = useState("");
  const [notifications,       setNotifications]       = useState<NotificationItem[]>([]);
  const [loading,             setLoading]             = useState(false);
  const [fetchingComplaints,  setFetchingComplaints]  = useState(true);
  const [modalVisible,        setModalVisible]        = useState(false);
  const [complaintModalVisible, setComplaintModalVisible] = useState(false);
  const [detailModalVisible,  setDetailModalVisible]  = useState(false);
  const [selectedComplaint,   setSelectedComplaint]   = useState<NotificationItem | null>(null);
  const [selectedImage,       setSelectedImage]       = useState<string | null>(null);
  const [uploading,           setUploading]           = useState(false);
  const [incidentPurok,       setIncidentPurok]       = useState("1");
  const [incidentLocation,    setIncidentLocation]    = useState("");
  const [userPurok,           setUserPurok]           = useState<string>("");
  const [idStatus,            setIdStatus]            = useState<string>("Pending");
  const [refreshing,          setRefreshing]          = useState(false);
  const [chatMessages,        setChatMessages]        = useState<{ read: boolean; id: string; senderId: string; message: string; timestamp: string; }[]>([]);
  const [chatInput,           setChatInput]           = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "in progress" | "resolved">("all");
  const [statusUpdates, setStatusUpdates] = useState<Record<string, Set<string>>>({
    pending: new Set(), inprogress: new Set(), resolved: new Set(),
  });
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState<{ rating: number; comment: string } | null>(null);
  const [feedbackComplaint,   setFeedbackComplaint]   = useState<NotificationItem | null>(null);
  const [feedbackLoading,     setFeedbackLoading]     = useState(false);
  const [tanodRatings, setTanodRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [viewingTanodRatings, setViewingTanodRatings] = useState<Record<string, { rating: number; comment: string }>>({});
  const [isUrgent,            setIsUrgent]            = useState(false);
  const [urgentCooldownMsg,   setUrgentCooldownMsg]   = useState("");
  const [isUrgentDisabled,    setIsUrgentDisabled]    = useState(false);
  const [tanodAvatars, setTanodAvatars] = useState<Record<string, { avatar: string; name: string }>>({});
  const [tanodInfoModalVisible, setTanodInfoModalVisible] = useState(false);
  const [selectedTanod, setSelectedTanod] = useState<{ uid: string; name: string; avatar: string } | null>(null);

  const isIdApproved = idStatus?.toLowerCase() === "verified" || idStatus?.toLowerCase() === "approved";
  const chatScrollViewRef = useRef<ScrollView>(null);

  const isUnread = (msg: any, userId?: string) => {
    if (!msg) return false;
    if (msg.senderId === userId) return false;
    if (typeof msg.read === "boolean") return msg.read === false;
    if (typeof msg.read === "string") return msg.read.toLowerCase() !== "true";
    return true;
  };

  const addStatusUpdateKey = (statusKey: string, firebaseKey?: string) => {
    if (!firebaseKey) return;
    setStatusUpdates((prev) => {
      const copy: Record<string, Set<string>> = {
        pending: new Set(prev.pending), inprogress: new Set(prev.inprogress), resolved: new Set(prev.resolved),
      };
      if (!copy[statusKey]) copy[statusKey] = new Set();
      copy[statusKey].add(firebaseKey);
      return copy;
    });
  };

  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const snap = await getDoc(doc(firestore, "users", user.uid));
      if (snap.exists()) {
        const d = snap.data();
        setUserPurok(d.purok || "");
        setIdStatus(d.idstatus || "Pending");
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchUserData(); savePushTokenToFirestore("users"); }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchUserData(); setRefreshing(false); };

  const pickImage = async () => {
    try {
      const r = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!r.granted) { Alert.alert("Permission Required", "Please allow photo access."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true });
      if (result.canceled || !result.assets?.length) return;
      const b64 = result.assets[0].base64;
      if (!b64) { Alert.alert("Error", "Failed to process image"); return; }
      setSelectedImage(`data:image/jpeg;base64,${b64}`);
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const takePhoto = async () => {
    try {
      if (Platform.OS !== "web") { const { status } = await ImagePicker.requestCameraPermissionsAsync(); if (status !== "granted") { Alert.alert("Permission Required", "Camera access needed."); return; } }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.5, base64: true });
      if (result.canceled || !result.assets?.length) return;
      const b64 = result.assets[0].base64;
      if (!b64) { Alert.alert("Error", "Failed to process image"); return; }
      setSelectedImage(`data:image/jpeg;base64,${b64}`);
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const showImageOptions = () => Alert.alert("Add Evidence", "Choose an option", [
    { text: "Take Photo", onPress: takePhoto },
    { text: "Choose from Gallery", onPress: pickImage },
    { text: "Cancel", style: "cancel" },
  ]);

  // Complaints listener
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setFetchingComplaints(false); return; }
    const ref = collection(firestore, "users", user.uid, "userComplaints");
    const q   = query(ref, orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: NotificationItem[] = [];
      snap.forEach((ds) => {
        const v = ds.data();
        arr.push({
          firebaseKey: ds.id, id: v.id || Date.now(), message: v.message, label: v.label, type: v.type,
          timestamp: v.timestamp instanceof Timestamp ? v.timestamp.toDate().toLocaleString() : v.timestamp,
          rawTimestamp: v.timestamp, purok: v.purok, status: v.status,
          incidentPurok: v.incidentPurok, incidentLocation: v.incidentLocation, evidencePhoto: v.evidencePhoto, resolutionPhoto: v.resolutionPhoto,
          hasUpdate: v.hasUpdate || false, isUrgent: v.isUrgent || false,
          deployedTanodUid: v.deployedTanodUid || null, deployedTanods: v.deployedTanods || [], hasFeedback: v.hasFeedback || false,
        });
      });
      setNotifications((prev) => {
        const pm = new Map<string, NotificationItem>();
        prev.forEach((p) => { if (p.firebaseKey) pm.set(p.firebaseKey, p); });
        arr.forEach((c) => {
          const fk = c.firebaseKey;
          const sk = (c.status || "").toLowerCase().replace(" ", "") as any;
          const pv = fk ? pm.get(fk) : undefined;
          if (pv && pv.status !== c.status && fk) {
            addStatusUpdateKey(sk, fk);
            if (c.status?.toLowerCase() === "in progress") showLocalNotification("Complaint In Progress", `Your ${c.type} complaint is now being handled.`, { screen: "complain", complaintKey: fk });
            else if (c.status?.toLowerCase() === "resolved") showLocalNotification("Complaint Resolved", `Your ${c.type} complaint has been resolved.`, { screen: "complain", complaintKey: fk });
          }
          if (c.hasUpdate && fk) addStatusUpdateKey(sk, fk);
        });
        return arr;
      });
      setFetchingComplaints(false);
    });
    return () => unsub();
  }, []);

  // Tanod avatars
  useEffect(() => {
    const fetch = async () => {
      const uids = new Set<string>();
      notifications.forEach((n) => {
        n.deployedTanods?.forEach((t) => uids.add(t.uid));
        if (n.deployedTanodUid) uids.add(n.deployedTanodUid);
      });
      const newUids = [...uids].filter((u) => !tanodAvatars[u]);
      if (!newUids.length) return;
      const fetched: Record<string, { avatar: string; name: string }> = {};
      for (const uid of newUids) {
        try {
          const d = await getDoc(doc(firestore, "employee", uid));
          if (d.exists()) { const data = d.data(); fetched[uid] = { avatar: data.avatar || "", name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Tanod" }; }
        } catch {}
      }
      if (Object.keys(fetched).length) setTanodAvatars((p) => ({ ...p, ...fetched }));
    };
    fetch();
  }, [notifications]);

  // Urgent cooldown
  useEffect(() => {
    const verify = () => {
      const urgentToday = notifications.filter((n) => {
        if (!n.isUrgent) return false;
        const d = n.rawTimestamp?.toDate ? n.rawTimestamp.toDate() : new Date(n.timestamp);
        if (isNaN(d.getTime())) return false;
        return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24) <= 1;
      }).sort((a, b) => {
        const da = a.rawTimestamp?.toDate ? a.rawTimestamp.toDate().getTime() : new Date(a.timestamp).getTime();
        const db = b.rawTimestamp?.toDate ? b.rawTimestamp.toDate().getTime() : new Date(b.timestamp).getTime();
        return db - da;
      });
      if (urgentToday.length >= 2) {
        setIsUrgentDisabled(true); setIsUrgent(false);
        const oldest = urgentToday[1];
        if (oldest) {
          const od = oldest.rawTimestamp?.toDate ? oldest.rawTimestamp.toDate() : new Date(oldest.timestamp);
          const expiry = new Date(od.getTime() + 86400000);
          const diff = expiry.getTime() - Date.now();
          if (diff > 0) {
            const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
            setUrgentCooldownMsg(`Limit reached. Resets in ${h}h ${m}m`);
          } else { setIsUrgentDisabled(false); setUrgentCooldownMsg(""); }
        }
      } else { setIsUrgentDisabled(false); setUrgentCooldownMsg(""); }
    };
    if (!fetchingComplaints) { verify(); const iv = setInterval(verify, 60000); return () => clearInterval(iv); }
  }, [notifications, fetchingComplaints]);

  const hasStatusUpdate = (c: NotificationItem) => {
    if (!c.firebaseKey) return false;
    const sk = (c.status || "").toLowerCase().replace(" ", "") as any;
    return statusUpdates[sk]?.has(c.firebaseKey) || false;
  };

  const handleSubmit = async () => {
    if (!message.trim()) { Alert.alert("Error", "Please enter a complaint message"); return; }
    if (!incidentLocation.trim()) { Alert.alert("Error", "Please enter the incident location"); return; }
    const user = auth.currentUser;
    if (!user) { Alert.alert("Error", "Not logged in"); return; }
    setLoading(true);
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const ref = collection(firestore, "users", user.uid, "userComplaints");
      const snap = await getDocs(query(ref, where("timestamp", ">=", Timestamp.fromDate(todayStart)), where("timestamp", "<=", Timestamp.fromDate(todayEnd))));
      if (snap.size >= 5) { Alert.alert("Limit Reached", "You can only submit 5 complaints per day."); setLoading(false); return; }
      const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.68.126:5000";
      const response = await fetch(`${API_URL}/classify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const data = await response.json();
      const newItem: any = { id: Date.now(), message: data.message, label: isUrgent ? "urgent" : String(data.label).toLowerCase().trim(), type: String(data.type).toLowerCase().trim(), timestamp: serverTimestamp(), purok: userPurok, incidentPurok, incidentLocation, status: "pending", isUrgent };
      if (selectedImage) newItem.evidencePhoto = selectedImage;
      await addDoc(ref, newItem);
      setMessage(""); setIncidentLocation(""); setSelectedImage(null); setIsUrgent(false);
      setComplaintModalVisible(false); setModalVisible(true);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoading(false); }
  };

  const openDetailModal = (c: NotificationItem) => {
    setSelectedComplaint(c); setDetailModalVisible(true);
    if (!c.firebaseKey) return;
    const user = auth.currentUser; if (!user) return;
    const chatRef = collection(firestore, "users", user.uid, "userComplaints", c.firebaseKey, "chat");
    const unsub = onSnapshot(query(chatRef, orderBy("timestamp", "asc")), (snap) => {
      const msgs: any[] = [];
      snap.forEach((ds) => {
        const v = ds.data();
        msgs.push({ id: ds.id, senderId: v.senderId, message: v.message, timestamp: v.timestamp instanceof Timestamp ? v.timestamp.toDate().toLocaleString() : v.timestamp, read: v.read === true });
        if (v.senderId !== user.uid && isUnread(v, user.uid))
          updateDoc(doc(firestore, "users", user.uid, "userComplaints", c.firebaseKey!, "chat", ds.id), { read: true });
      });
      setChatMessages(msgs);
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    });
    setNotifications((p) => p.map((n) => n.firebaseKey === c.firebaseKey ? { ...n, hasUpdate: false } : n));
    if (c.firebaseKey) {
      updateDoc(doc(firestore, "users", user.uid, "userComplaints", c.firebaseKey), { hasUpdate: false });
      setStatusUpdates((p) => {
        const copy = { pending: new Set(p.pending), inprogress: new Set(p.inprogress), resolved: new Set(p.resolved) };
        Object.keys(copy).forEach((k) => (copy as any)[k].delete(c.firebaseKey));
        return copy;
      });
    }
  };

  const confirmAndDelete = (c: NotificationItem) => {
    if (!c.firebaseKey) return;
    Alert.alert("Delete Complaint", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const user = auth.currentUser; if (!user) return;
          await deleteDoc(doc(firestore, "users", user.uid, "userComplaints", c.firebaseKey!));
          setDetailModalVisible(false); setSelectedComplaint(null);
          setNotifications((p) => p.filter((n) => n.firebaseKey !== c.firebaseKey));
          Alert.alert("Deleted", "Complaint deleted successfully.");
        } catch { Alert.alert("Error", "Failed to delete."); }
      }},
    ]);
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !selectedComplaint?.firebaseKey) return;
    const user = auth.currentUser; if (!user) return;
    try {
      setChatInput("");
      await addDoc(collection(firestore, "users", user.uid, "userComplaints", selectedComplaint.firebaseKey, "chat"), { senderId: user.uid, message: text, timestamp: serverTimestamp(), read: false });
      setTimeout(() => chatScrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) { Alert.alert("Error", "Failed to send message."); }
  };

  const submitFeedback = async () => {
    if (!feedbackComplaint?.firebaseKey) return;
    const tanods = feedbackComplaint.deployedTanods || [];
    for (const t of tanods) { if (!(tanodRatings[t.uid]?.rating)) { Alert.alert("Error", `Please rate ${t.name || "each tanod"}`); return; } }
    const user = auth.currentUser; if (!user) return;
    setFeedbackLoading(true);
    try {
      for (const t of tanods) {
        const e = tanodRatings[t.uid];
        await updateDoc(doc(firestore, "employee", t.uid, "deploymentHistory", feedbackComplaint.firebaseKey!), { tanodRating: e.rating, tanodComment: e.comment.trim() || null });
      }
      await updateDoc(doc(firestore, "users", user.uid, "userComplaints", feedbackComplaint.firebaseKey!), { hasFeedback: true });
      setTanodRatings({}); setFeedbackComplaint(null); setFeedbackModalVisible(false);
      Alert.alert("Success", "Thank you for your ratings!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setFeedbackLoading(false); }
  };

  const handleFeedbackAction = async (c: NotificationItem) => {
    if (!c.firebaseKey) return;
    const tanods = [...(c.deployedTanods || [])];
    if (!tanods.length && c.deployedTanodUid) tanods.push({ uid: c.deployedTanodUid, name: "Tanod" });
    if (!tanods.length) { Alert.alert("Not Available", "No tanod assigned yet."); return; }
    setFeedbackComplaint({ ...c, deployedTanods: tanods });
    if (c.hasFeedback) {
      const ratings: Record<string, { rating: number; comment: string }> = {};
      for (const t of tanods) {
        try {
          const d = await getDoc(doc(firestore, "employee", t.uid, "deploymentHistory", c.firebaseKey));
          ratings[t.uid] = d.exists() ? { rating: d.data().tanodRating || 0, comment: d.data().tanodComment || "" } : { rating: 0, comment: "" };
        } catch { ratings[t.uid] = { rating: 0, comment: "" }; }
      }
      setViewingTanodRatings(ratings); setViewingFeedback({ rating: 0, comment: "" });
    } else {
      const init: Record<string, { rating: number; comment: string }> = {};
      tanods.forEach((t) => { init[t.uid] = { rating: 0, comment: "" }; });
      setTanodRatings(init); setViewingFeedback(null); setViewingTanodRatings({});
    }
    setFeedbackModalVisible(true);
  };

  const getStatusColor  = (s?: string) => ({ pending: COLORS.pending, resolved: COLORS.resolved, "in progress": COLORS.inProgress }[(s || "").toLowerCase()] || COLORS.textMuted);
  const getLabelColor   = (l?: string) => ({ urgent: COLORS.red, high: "#f97316", medium: COLORS.gold, low: "#22c55e" }[(l || "").toLowerCase()] || "#6366f1");
  const hasFilterUpdate = (status: string) => status === "all" ? Object.values(statusUpdates).some((s) => s.size > 0) : statusUpdates[(status.toLowerCase().replace(" ", "")) as any]?.size > 0;

  const filteredNotifs = notifications.filter((n) => {
    if (filterStatus === "all") return true;
    const st = (n.status || "").toLowerCase().replace(/\s+/g, "");
    const fk = filterStatus.toLowerCase().replace(/\s+/g, "");
    if (fk === "inprogress") return ["inprogress","in-progress","in_progress"].includes(st);
    return st === fk;
  });

  // ── Counts ────────────────────────────────────────────────────────────────
  const totalCount    = notifications.length;
  const resolvedCount = notifications.filter((n) => n.status?.toLowerCase() === "resolved").length;
  const pendingCount  = notifications.filter((n) => n.status?.toLowerCase() === "pending").length;

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HEADER ── */}
      <LinearGradient
        colors={["#0b1a3d", "#111f50"]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        {/* Decorative top ring */}
        <View style={styles.headerRing} />

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerEyebrow}>BARANGAY SAN ROQUE</Text>
            <Text style={styles.headerTitle}>My Reports</Text>
          </View>
          <View style={styles.headerIconWrap}>
            <Ionicons name="shield-checkmark" size={28} color={COLORS.gold} />
          </View>
        </View>

        {/* Stats strip */}
        {!fetchingComplaints && (
          <View style={styles.statsStrip}>
            <StatPill icon="layers-outline"    label="Total"    value={totalCount}    color={COLORS.blue} />
            <View style={styles.statDivider} />
            <StatPill icon="time-outline"      label="Pending"  value={pendingCount}  color={COLORS.gold} />
            <View style={styles.statDivider} />
            <StatPill icon="checkmark-circle-outline" label="Resolved" value={resolvedCount} color={COLORS.resolved} />
          </View>
        )}

        {/* Gold accent line */}
        <View style={styles.headerAccentLine} />
      </LinearGradient>

      {/* ── FILTER PILLS ── */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(["all", "pending", "in progress", "resolved"] as const).map((status) => {
            const active    = filterStatus === status;
            const showDot   = hasFilterUpdate(status);
            const sk        = status.toLowerCase().replace(" ", "") as any;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  setFilterStatus(status);
                  if (status === "all") setStatusUpdates({ pending: new Set(), inprogress: new Set(), resolved: new Set() });
                  else setStatusUpdates((p) => ({ ...p, [sk]: new Set() }));
                }}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                {showDot && <View style={styles.filterDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── LIST ── */}
      {fetchingComplaints ? (
        <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
                <Skeleton style={{ width: 70, height: 22, borderRadius: 8 }} />
                <Skeleton style={{ width: 70, height: 22, borderRadius: 8 }} />
              </View>
              <Skeleton style={{ width: "100%", height: 14, borderRadius: 6, marginBottom: 8 }} />
              <Skeleton style={{ width: "70%",  height: 14, borderRadius: 6, marginBottom: 18 }} />
              <Skeleton style={{ width: 120, height: 11, borderRadius: 4 }} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          {filteredNotifs.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={40} color={COLORS.gold} />
              </View>
              <Text style={styles.emptyTitle}>No complaints found</Text>
              <Text style={styles.emptySubtitle}>Tap Report below to submit one</Text>
            </View>
          )}

          {filteredNotifs.map((n) => (
            <AnimatedCard
              key={n.id}
              onPress={() => n.status?.toLowerCase() !== "resolved" && openDetailModal(n)}
              disabled={n.status?.toLowerCase() === "resolved"}
              style={[styles.card, { borderColor: COLORS.borderGold, borderWidth: 1 }]}
            >
              {/* Update badge */}
              {(n.hasUpdate || hasStatusUpdate(n)) && (
                <View style={styles.updateBadge}>
                  <Ionicons name="alert" size={11} color="#fff" />
                </View>
              )}

              {/* Evidence photo */}
              {n.evidencePhoto && (
                <Image
                  source={{ uri: n.evidencePhoto }}
                  style={[styles.cardPhoto, n.status?.toLowerCase() === "resolved" && { opacity: 0.2 }]}
                />
              )}

              {/* Badges row */}
              <View style={styles.cardBadgeRow}>
                <Badge label={n.label.toUpperCase()} color={getLabelColor(n.label)} />
                <Badge label={n.status.toUpperCase()} color={getStatusColor(n.status)} />
                {n.isUrgent && <Badge label="URGENT" color={COLORS.red} />}
              </View>

              {/* Message */}
              <Text
                style={[styles.cardMessage, n.status?.toLowerCase() === "resolved" && { opacity: 0.3 }]}
                numberOfLines={2}
              >
                {n.message}
              </Text>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textDim} />
                  <Text style={styles.cardTimestamp}>{n.timestamp}</Text>
                </View>

                {/* Tanod avatars */}
                {(n.deployedTanods?.length || n.deployedTanodUid) && (
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {(n.deployedTanods || (n.deployedTanodUid ? [{ uid: n.deployedTanodUid, name: "Tanod" }] : [])).map((t: any) => {
                      const info = tanodAvatars[t.uid];
                      return (
                        <TouchableOpacity key={t.uid} onPress={() => { setSelectedTanod({ uid: t.uid, name: info?.name || t.name, avatar: info?.avatar || "" }); setTanodInfoModalVisible(true); }}>
                          {info?.avatar ? (
                            <Image source={{ uri: info.avatar }} style={styles.tanodAvatar} />
                          ) : (
                            <View style={styles.tanodAvatarPlaceholder}>
                              <Ionicons name="shield" size={13} color={COLORS.gold} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Resolved overlay */}
              {n.status?.toLowerCase() === "resolved" && (
                <View style={styles.resolvedOverlay}>
                  <TouchableOpacity style={styles.rateButton} onPress={() => handleFeedbackAction(n)}>
                    <Ionicons name="star" size={14} color={COLORS.bg} />
                    <Text style={styles.rateButtonText}>
                      {n.hasFeedback ? "View Rating" : (n.deployedTanods?.length || n.deployedTanodUid) ? "Rate Tanod(s)" : "Awaiting Assignment"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </AnimatedCard>
          ))}
        </ScrollView>
      )}

      {/* ── FAB ── */}
      <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom + 85, 90) }]}>
        {!isIdApproved && (
          <View style={styles.fabTooltip}>
            <Ionicons name="lock-closed" size={12} color={COLORS.gold} />
            <Text style={styles.fabTooltipText}>ID verification required</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.fab, !isIdApproved && styles.fabDisabled]}
          onPress={() => isIdApproved && setComplaintModalVisible(true)}
          disabled={!isIdApproved}
        >
          <LinearGradient
            colors={isIdApproved ? ["#f59e0b", "#d97706"] : [COLORS.textDim, COLORS.textDim]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add-circle" size={22} color={isIdApproved ? COLORS.bg : COLORS.textMuted} />
            <Text style={[styles.fabText, !isIdApproved && { color: COLORS.textMuted }]}>File Report</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── DETAIL MODAL ── */}
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={() => setDetailModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKB}>
            <View style={styles.detailModal}>
              {/* Handle */}
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Complaint Details</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {selectedComplaint?.status?.toLowerCase().replace(/\s+/g, "") === "pending" && (
                    <TouchableOpacity onPress={() => selectedComplaint && confirmAndDelete(selectedComplaint)} style={styles.deleteBtn}>
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {selectedComplaint && (
                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>

                  {/* Chat (when in-progress or resolved) */}
                  {selectedComplaint.status?.toLowerCase() !== "pending" && (
                    <View style={styles.chatSection}>
                      <View style={styles.chatHeader}>
                        <Ionicons name="chatbubbles" size={16} color={COLORS.gold} />
                        <Text style={styles.chatTitle}>Live Chat</Text>
                      </View>
                      <ScrollView
                        ref={chatScrollViewRef}
                        style={styles.chatScroll}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
                        contentContainerStyle={{ paddingBottom: 8 }}
                      >
                        {chatMessages.length === 0 ? (
                          <Text style={styles.chatEmpty}>No messages yet</Text>
                        ) : chatMessages.map((msg) => {
                          const mine = msg.senderId === auth.currentUser?.uid;
                          return (
                            <View key={msg.id} style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                                <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>{msg.message}</Text>
                              </View>
                              <Text style={styles.msgTime}>{msg.timestamp}{mine && (msg.read ? " · Read" : " · Sent")}</Text>
                            </View>
                          );
                        })}
                      </ScrollView>
                      <View style={styles.chatInputRow}>
                        <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Type a message…" placeholderTextColor={COLORS.textDim} style={styles.chatInput} multiline />
                        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                          <Ionicons name="send" size={18} color={COLORS.bg} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Photo */}
                  {selectedComplaint.evidencePhoto && (
                    <Image source={{ uri: selectedComplaint.evidencePhoto }} style={styles.detailPhoto} resizeMode="cover" />
                  )}

                  {/* Resolution Photo */}
                  {selectedComplaint.status === "resolved" && selectedComplaint.resolutionPhoto && (
                    <>
                      <Text style={styles.detailLabel}>Resolution Photo:</Text>
                      <Image source={{ uri: selectedComplaint.resolutionPhoto }} style={styles.detailPhoto} resizeMode="cover" />
                    </>
                  )}

                  {/* Badges */}
                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
                    <Badge label={selectedComplaint.label.toUpperCase()} color={getLabelColor(selectedComplaint.label)} />
                    <Badge label={selectedComplaint.status.toUpperCase()} color={getStatusColor(selectedComplaint.status)} />
                  </View>

                  <DetailRow label="Description"     value={selectedComplaint.message} />
                  <DetailRow label="Type"            value={selectedComplaint.type} />
                  <DetailRow label="Incident Purok"  value={`Purok ${selectedComplaint.incidentPurok}`} icon="home-outline" />
                  <DetailRow label="Specific Location" value={selectedComplaint.incidentLocation || "—"} icon="location-outline" />
                  <DetailRow label="Submitted"       value={selectedComplaint.timestamp} icon="time-outline" />

                  {selectedComplaint.deployedTanods?.length ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Assigned Tanod(s)</Text>
                      {selectedComplaint.deployedTanods.map((t: any) => (
                        <View key={t.uid} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <Ionicons name="shield-checkmark" size={16} color={COLORS.gold} />
                          <Text style={styles.detailValue}>{t.name}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              )}

              <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailModalVisible(false)}>
                <Text style={styles.detailCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── COMPLAINT FORM MODAL ── */}
      <Modal visible={complaintModalVisible} transparent animationType="slide" onRequestClose={() => setComplaintModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKB}>
            <View style={styles.formModal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>File a Report</Text>
                <TouchableOpacity onPress={() => { setComplaintModalVisible(false); setSelectedImage(null); setMessage(""); setIncidentLocation(""); setIsUrgent(false); }} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <FormLabel>Incident Purok *</FormLabel>
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={incidentPurok} onValueChange={setIncidentPurok} style={styles.picker} dropdownIconColor={COLORS.gold}>
                    {[1,2,3,4,5,6].map((n) => <Picker.Item key={n} label={`Purok ${n}`} value={`${n}`} color="#000000" />)}
                  </Picker>
                </View>

                <FormLabel>Landmark of Incident *</FormLabel>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., near basketball court"
                  placeholderTextColor={COLORS.textDim}
                  value={incidentLocation}
                  onChangeText={setIncidentLocation}
                />

                <FormLabel>Description *</FormLabel>
                <TextInput
                  style={styles.formTextArea}
                  placeholder="Describe the incident in detail…"
                  placeholderTextColor={COLORS.textDim}
                  value={message}
                  onChangeText={setMessage}
                  multiline numberOfLines={5}
                  textAlignVertical="top"
                />

                {selectedImage && (
                  <View style={styles.imgPreviewWrap}>
                    <Image source={{ uri: selectedImage }} style={styles.imgPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => setSelectedImage(null)}>
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity style={styles.uploadBtn} onPress={showImageOptions}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.gold} />
                  <Text style={styles.uploadBtnText}>Add Evidence Photo</Text>
                </TouchableOpacity>

                {/* Urgent toggle */}
                <View style={styles.urgentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.urgentTitle}>Mark as Urgent</Text>
                    <Text style={styles.urgentSub}>For severe issues needing immediate action. (Max 2/day)</Text>
                    {isUrgentDisabled && <Text style={styles.urgentCooldown}>{urgentCooldownMsg}</Text>}
                  </View>
                  <Switch
                    value={isUrgent}
                    onValueChange={(v) => { if (!isUrgentDisabled) setIsUrgent(v); }}
                    disabled={isUrgentDisabled}
                    trackColor={{ false: COLORS.elevated, true: "rgba(206,17,38,0.4)" }}
                    thumbColor={isUrgent ? COLORS.red : COLORS.textMuted}
                  />
                </View>

                <TouchableOpacity onPress={handleSubmit} disabled={loading} style={{ overflow: "hidden", borderRadius: 16, marginBottom: 20 }}>
                  <LinearGradient colors={["#f59e0b", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
                    {loading ? <ActivityIndicator color={COLORS.bg} /> : (
                      <>
                        <Ionicons name="send" size={18} color={COLORS.bg} />
                        <Text style={styles.submitBtnText}>Submit Report</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── SUCCESS MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <LinearGradient colors={["#0b1a3d", "#1a3060"]} style={styles.successGradient}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={60} color={COLORS.gold} />
              </View>
              <Text style={styles.successTitle}>Report Submitted!</Text>
              <Text style={styles.successSub}>Your complaint has been received. We'll keep you updated.</Text>
              <TouchableOpacity style={styles.successBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.successBtnText}>Got it</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* ── FEEDBACK MODAL ── */}
      <Modal visible={feedbackModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalKB}>
            <View style={styles.formModal}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{viewingFeedback ? "Tanod Ratings" : "Rate the Tanod(s)"}</Text>
                <TouchableOpacity onPress={() => { setFeedbackModalVisible(false); setTanodRatings({}); setViewingFeedback(null); setViewingTanodRatings({}); setFeedbackComplaint(null); }} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {viewingFeedback
                  ? (
                    <>
                      {feedbackComplaint?.resolutionPhoto && (
                        <View style={{ marginBottom: 20 }}>
                          <Text style={styles.formLabel}>Resolution Photo</Text>
                          <Image source={{ uri: feedbackComplaint.resolutionPhoto }} style={styles.detailPhoto} resizeMode="cover" />
                        </View>
                      )}
                      {(feedbackComplaint?.deployedTanods || []).map((t, i) => {
                        const ex = viewingTanodRatings[t.uid] || { rating: 0, comment: "" };
                        return (
                          <View key={t.uid} style={[styles.tanodRatingBlock, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 20, marginTop: 20 }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                              {tanodAvatars[t.uid]?.avatar ? (
                                <Image source={{ uri: tanodAvatars[t.uid].avatar }} style={styles.tanodAvatar} />
                              ) : (
                                <View style={styles.tanodAvatarPlaceholder}>
                                  <Ionicons name="shield" size={13} color={COLORS.gold} />
                                </View>
                              )}
                              <Text style={styles.tanodName}>{t.name}</Text>
                            </View>
                            <StarRow rating={ex.rating} />
                            {ex.comment ? (
                              <View style={styles.remarkBox}>
                                <Text style={styles.remarkLabel}>REMARK</Text>
                                <Text style={styles.remarkText}>{ex.comment}</Text>
                              </View>
                            ) : <Text style={styles.noRemark}>No remark provided</Text>}
                          </View>
                        );
                      })}
                    </>
                  )
                  : (
                    <>
                      {feedbackComplaint?.resolutionPhoto && (
                        <View style={{ marginBottom: 20 }}>
                          <Text style={styles.formLabel}>Resolution Photo</Text>
                          <Image source={{ uri: feedbackComplaint.resolutionPhoto }} style={styles.detailPhoto} resizeMode="cover" />
                        </View>
                      )}
                      <Text style={styles.feedbackIntro}>Rate each tanod who responded to your complaint</Text>
                      {(feedbackComplaint?.deployedTanods || []).map((t, i) => {
                        const entry = tanodRatings[t.uid] || { rating: 0, comment: "" };
                        const labels = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
                        return (
                          <View key={t.uid} style={[styles.tanodRatingBlock, i > 0 && { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 20, marginTop: 20 }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                              {tanodAvatars[t.uid]?.avatar ? (
                                <Image source={{ uri: tanodAvatars[t.uid].avatar }} style={styles.tanodAvatar} />
                              ) : (
                                <View style={styles.tanodAvatarPlaceholder}>
                                  <Ionicons name="shield" size={13} color={COLORS.gold} />
                                </View>
                              )}
                              <Text style={styles.tanodName}>{t.name}</Text>
                            </View>
                            <View style={{ alignItems: "center", marginBottom: 10 }}>
                              <StarRow rating={entry.rating} onRate={(s) => setTanodRatings((p) => ({ ...p, [t.uid]: { ...p[t.uid], rating: s } }))} />
                              {entry.rating > 0 && <Text style={styles.ratingLabel}>{labels[entry.rating]}</Text>}
                            </View>
                            <FormLabel>Remark (Optional)</FormLabel>
                            <TextInput
                              style={[styles.formTextArea, { minHeight: 80 }]}
                              placeholder={`Comment about ${t.name}…`}
                              placeholderTextColor={COLORS.textDim}
                              value={entry.comment}
                              onChangeText={(v) => setTanodRatings((p) => ({ ...p, [t.uid]: { ...p[t.uid], comment: v } }))}
                              multiline numberOfLines={3} textAlignVertical="top"
                            />
                          </View>
                        );
                      })}

                      <TouchableOpacity onPress={submitFeedback} disabled={feedbackLoading} style={{ overflow: "hidden", borderRadius: 16, marginBottom: 20 }}>
                        <LinearGradient colors={["#f59e0b", "#d97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
                          {feedbackLoading ? <ActivityIndicator color={COLORS.bg} /> : (
                            <>
                              <Ionicons name="star" size={18} color={COLORS.bg} />
                              <Text style={styles.submitBtnText}>Submit Ratings</Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </>
                  )
                }
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── TANOD INFO MODAL ── */}
      <Modal visible={tanodInfoModalVisible} transparent animationType="fade" onRequestClose={() => setTanodInfoModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTanodInfoModalVisible(false)}>
          <View style={styles.tanodModal}>
            {selectedTanod?.avatar
              ? <Image source={{ uri: selectedTanod.avatar }} style={styles.tanodModalAvatar} />
              : <View style={styles.tanodModalAvatarPlaceholder}><Ionicons name="shield-checkmark" size={40} color={COLORS.gold} /></View>
            }
            <Text style={styles.tanodModalName}>{selectedTanod?.name || "Tanod"}</Text>
            <Text style={styles.tanodModalRole}>Assigned Tanod</Text>
            <TouchableOpacity style={styles.tanodModalClose} onPress={() => setTanodInfoModalVisible(false)}>
              <Text style={styles.tanodModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small sub-components ─────────────────────────────────────────────────────

function StatPill({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 4, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ backgroundColor: color + "28", borderWidth: 1, borderColor: color + "55", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value, icon }: { label: string; value?: string; icon?: any }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon && <Ionicons name={icon} size={14} color={COLORS.gold} />}
        <Text style={styles.detailValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.formLabel}>{children}</Text>;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header:       { paddingHorizontal: 22, paddingBottom: 20, overflow: "hidden" },
  headerRing:   { position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: "rgba(245,158,11,0.08)", top: -80, right: -60 },
  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  headerEyebrow:{ color: "rgba(245,158,11,0.65)", fontSize: 9, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:  { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  headerIconWrap:{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(245,158,11,0.1)", borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  headerAccentLine: { height: 1, backgroundColor: COLORS.gold, opacity: 0.25, marginTop: 16 },

  statsStrip:   { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border },
  statDivider:  { width: 1, backgroundColor: COLORS.border, alignSelf: "stretch", marginHorizontal: 8 },

  // Filters
  filterWrapper: { paddingVertical: 14 },
  filterScroll:  { paddingHorizontal: 18, gap: 8 },
  filterPill:    { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterPillActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  filterText:    { color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: COLORS.bg },
  filterDot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.red, marginLeft: 6 },

  // List
  list:          { flex: 1, paddingHorizontal: 18 },

  // Skeleton
  skeletonCard:  { backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },

  // Empty
  emptyState:    { alignItems: "center", paddingVertical: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle:    { color: COLORS.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 13 },

  // Card
  card:          { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, overflow: "hidden" },
  cardPhoto:     { width: "100%", height: 180, borderRadius: 14, marginBottom: 14 },
  cardBadgeRow:  { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  cardMessage:   { color: COLORS.text, fontSize: 15, fontWeight: "600", lineHeight: 22, marginBottom: 14 },
  cardFooter:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  cardTimestamp: { color: COLORS.textDim, fontSize: 11, fontWeight: "500" },

  updateBadge:   { position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.red, justifyContent: "center", alignItems: "center", zIndex: 10 },

  tanodAvatar:   { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.gold },
  tanodAvatarPlaceholder: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.goldDim, borderWidth: 1.5, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },

  resolvedOverlay: { position: "absolute", inset: 0, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(8,15,38,0.55)", borderRadius: 22 },
  rateButton:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.gold, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  rateButtonText:{ color: COLORS.bg, fontSize: 14, fontWeight: "900" },

  // FAB
  fabWrap:       { position: "absolute", alignSelf: "center", alignItems: "center", zIndex: 100 },
  fab:           { borderRadius: 32, overflow: "hidden", shadowColor: COLORS.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  fabDisabled:   { opacity: 0.5 },
  fabGradient:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 32 },
  fabText:       { color: COLORS.bg, fontSize: 17, fontWeight: "900" },
  fabTooltip:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.goldBorder, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginBottom: 10 },
  fabTooltipText:{ color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },

  // Modals shared
  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 12 },
  modalKB:       { width: "100%", alignItems: "center", justifyContent: "center" },
  modalHandle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: COLORS.elevated, alignSelf: "center", marginBottom: 18 },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  modalTitle:    { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  closeBtn:      { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.elevated, justifyContent: "center", alignItems: "center" },
  deleteBtn:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.red, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  deleteBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  // Detail modal
  detailModal:   { backgroundColor: COLORS.surface, borderRadius: 30, padding: 22, width: "100%", maxWidth: 500, maxHeight: "88%", borderWidth: 1, borderColor: COLORS.border },
  detailPhoto:   { width: "100%", height: 200, borderRadius: 18, marginBottom: 18 },
  detailRow:     { backgroundColor: COLORS.elevated, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  detailLabel:   { color: COLORS.textDim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 },
  detailValue:   { color: COLORS.text, fontSize: 15, fontWeight: "600", lineHeight: 24 },
  detailCloseBtn:{ backgroundColor: COLORS.gold, paddingVertical: 15, borderRadius: 18, alignItems: "center", marginTop: 10 },
  detailCloseBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: "900" },

  // Chat
  chatSection:   { backgroundColor: COLORS.elevated, borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  chatHeader:    { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  chatTitle:     { color: COLORS.gold, fontSize: 14, fontWeight: "800" },
  chatScroll:    { maxHeight: 260, marginBottom: 12 },
  chatEmpty:     { color: COLORS.textDim, textAlign: "center", paddingVertical: 30, fontStyle: "italic" },
  msgRow:        { marginBottom: 12, maxWidth: "82%" },
  msgRowMine:    { alignSelf: "flex-end", alignItems: "flex-end" },
  msgRowTheirs:  { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble:        { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  bubbleMine:    { backgroundColor: COLORS.gold, borderBottomRightRadius: 4 },
  bubbleTheirs:  { backgroundColor: COLORS.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  bubbleText:    { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  bubbleTextMine:{ color: COLORS.bg },
  bubbleTextTheirs:{ color: COLORS.text },
  msgTime:       { color: COLORS.textDim, fontSize: 10, marginTop: 3, paddingHorizontal: 4 },
  chatInputRow:  { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  chatInput:     { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text, fontSize: 14, maxHeight: 100 },
  sendBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.gold, justifyContent: "center", alignItems: "center" },

  // Form modal
  formModal:     { backgroundColor: COLORS.surface, borderRadius: 30, padding: 22, width: "100%", maxWidth: 500, maxHeight: "90%", borderWidth: 1, borderColor: COLORS.border },
  formLabel:     { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8, textTransform: "uppercase" },
  formInput:     { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 15, marginBottom: 16 },
  formTextArea:  { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, color: COLORS.text, fontSize: 15, minHeight: 120, marginBottom: 16 },
  pickerWrap:    { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginBottom: 16, overflow: "hidden" },
  picker:        { color: COLORS.text },

  imgPreviewWrap:{ alignSelf: "center", marginBottom: 16, position: "relative" },
  imgPreview:    { width: 200, height: 150, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.gold },
  imgRemoveBtn:  { position: "absolute", top: -8, right: -8, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.red, justifyContent: "center", alignItems: "center" },

  uploadBtn:     { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: COLORS.goldBorder, borderStyle: "dashed", borderRadius: 16, padding: 16, justifyContent: "center", marginBottom: 16, backgroundColor: COLORS.goldDim },
  uploadBtnText: { color: COLORS.gold, fontWeight: "700", fontSize: 14 },

  urgentRow:     { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(206,17,38,0.08)", borderWidth: 1, borderColor: "rgba(206,17,38,0.2)", borderRadius: 16, padding: 16, marginBottom: 20 },
  urgentTitle:   { color: COLORS.red, fontSize: 14, fontWeight: "800", marginBottom: 3 },
  urgentSub:     { color: "rgba(206,17,38,0.7)", fontSize: 11, lineHeight: 16 },
  urgentCooldown:{ color: COLORS.red, fontSize: 11, fontWeight: "700", marginTop: 5 },

  submitBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17, borderRadius: 16 },
  submitBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: "900" },

  // Success modal
  successModal:  { width: "86%", maxWidth: 360, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: COLORS.goldBorder },
  successGradient:{ padding: 34, alignItems: "center" },
  successIconWrap:{ width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.goldDim, borderWidth: 1.5, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  successTitle:  { color: "#fff", fontSize: 22, fontWeight: "900", marginBottom: 10 },
  successSub:    { color: COLORS.textMuted, fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 28 },
  successBtn:    { backgroundColor: COLORS.gold, paddingVertical: 14, paddingHorizontal: 48, borderRadius: 16 },
  successBtnText:{ color: COLORS.bg, fontSize: 15, fontWeight: "900" },

  // Feedback modal
  feedbackIntro: { color: COLORS.textMuted, textAlign: "center", fontSize: 13, marginBottom: 20, lineHeight: 20 },
  tanodRatingBlock:{ marginBottom: 8 },
  tanodName:     { color: COLORS.text, fontSize: 16, fontWeight: "800", marginBottom: 14 },
  ratingLabel:   { color: COLORS.gold, fontSize: 13, fontWeight: "700", marginTop: 8 },
  remarkBox:     { backgroundColor: COLORS.elevated, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  remarkLabel:   { color: COLORS.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6, textTransform: "uppercase" },
  remarkText:    { color: COLORS.text, fontSize: 14, lineHeight: 22 },
  noRemark:      { color: COLORS.textDim, fontStyle: "italic", fontSize: 13, marginTop: 8 },

  // Tanod info modal
  tanodModal:    { backgroundColor: COLORS.surface, borderRadius: 24, padding: 28, width: 290, alignItems: "center", borderWidth: 1, borderColor: COLORS.goldBorder },
  tanodModalAvatar:         { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: COLORS.gold, marginBottom: 16 },
  tanodModalAvatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.goldDim, borderWidth: 2, borderColor: COLORS.gold, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  tanodModalName:{ color: COLORS.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
  tanodModalRole:{ color: COLORS.textMuted, fontSize: 13, marginBottom: 20 },
  tanodModalClose:{ backgroundColor: COLORS.gold, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14 },
  tanodModalCloseText: { color: COLORS.bg, fontWeight: "800", fontSize: 14 },
});