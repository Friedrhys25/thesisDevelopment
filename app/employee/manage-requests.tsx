import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useMemo, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";
import {
  savePushTokenToFirestore,
  showLocalNotification,
} from "../../utils/notifications";

interface CoDeployedTanod {
  uid: string;
  name: string;
}

interface ActiveDeployment {
  complaintKey: string;
  userId: string;
  complainantName: string;
  type: string;
  incidentPurok: string;
  description: string;
  deployedAt: string;
  coDeployedTanods: CoDeployedTanod[];
}

interface HistoryEntry {
  complaintKey: string;
  userId: string;
  complainantName: string;
  type: string;
  incidentPurok: string;
  description: string;
  deployedAt: string;
  resolvedAt: string;
  status: string;
  tanodRating: number | null;
  tanodComment: string | null;
  coDeployedTanods: CoDeployedTanod[];
}

interface ComplaintCard {
  id: string;
  type: string;
  description: string;
  complainantName: string;
  date: string;
  status: string;
  incidentPurok: string;
  coDeployedTanods: CoDeployedTanod[];
  userId?: string;
  complaintKey?: string;
  tanodRating?: number | null;
}

type FilterType = "all" | "active" | "resolved";

const COLORS = {
  page: "#F4F7F8",
  pageAlt: "#EEF4F5",
  card: "#FFFFFF",
  cardSoft: "#FAFBFB",
  line: "#D8E3E6",
  lineStrong: "#C8D5D9",
  text: "#17323A",
  textSoft: "#617980",
  textFaint: "#8AA0A6",
  primary: "#2F7D6D",
  primarySoft: "#E8F4F0",
  accent: "#4C93A2",
  accentSoft: "#EAF4F6",
  warning: "#C78A2C",
  warningSoft: "#FFF5E4",
  danger: "#B85858",
  dangerSoft: "#FCEAEA",
  success: "#3F8B5C",
  successSoft: "#EAF6EE",
  overlay: "rgba(17, 37, 43, 0.45)",
  shadow: "rgba(17, 37, 43, 0.08)",
};

function SummaryBox({
  icon,
  label,
  value,
  tint,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  tint: string;
  bg: string;
}) {
  return (
    <View style={styles.summaryBox}>
      <View style={[styles.summaryIconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterChip, selected && styles.filterChipActive, pressed && styles.pressed]}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ManageRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeDeployment, setActiveDeployment] = useState<ActiveDeployment | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [cardToResolve, setCardToResolve] = useState<ComplaintCard | null>(null);
  const [idStatus, setIdStatus] = useState<string>("Pending");
  const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
      return;
    }

    savePushTokenToFirestore("employee");

    let prevDeploymentStatus: string | null = null;

    const tanodRef = doc(firestore, "employee", user.uid);
    const unsubTanod = onSnapshot(
      tanodRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          setActiveDeployment(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data();
        let status = data.idstatus || "";

        if (!status) {
          try {
            const userDoc = await getDoc(doc(firestore, "users", user.uid));
            if (userDoc.exists()) {
              status = userDoc.data().idstatus || "Pending";
            }
          } catch (error) {
            console.error("Error fetching user doc:", error);
          }
        }

        setIdStatus(status || "Pending");

        const currentDeploymentStatus = data.deploymentStatus || "available";
        if (
          prevDeploymentStatus !== null &&
          prevDeploymentStatus !== "deployed" &&
          currentDeploymentStatus === "deployed" &&
          data.deployedTo
        ) {
          const deployed = data.deployedTo;
          showLocalNotification(
            "New Complaint Assigned",
            `You have been deployed to a ${deployed.type} complaint in Purok ${deployed.incidentPurok}.`,
            { screen: "manage-requests", complaintKey: deployed.complaintKey }
          );
        }

        prevDeploymentStatus = currentDeploymentStatus;

        if (data.deploymentStatus === "deployed" && data.deployedTo) {
          setActiveDeployment(data.deployedTo as ActiveDeployment);
        } else {
          setActiveDeployment(null);
        }

        setLoading(false);
      },
      (error) => {
        console.error("Error listening to tanod document:", error);
        setLoading(false);
      }
    );

    const historyRef = collection(firestore, "employee", user.uid, "deploymentHistory");
    const historyQuery = query(historyRef, orderBy("resolvedAt", "desc"));
    const unsubHistory = onSnapshot(
      historyQuery,
      (snapshot) => {
        const history = snapshot.docs.map((entry) => ({
          ...entry.data(),
          complaintKey: entry.id,
        })) as HistoryEntry[];
        setDeploymentHistory(history);
      },
      (error) => {
        console.error("Error listening to deployment history:", error);
      }
    );

    return () => {
      unsubTanod();
      unsubHistory();
    };
  }, []);

  const allCards: ComplaintCard[] = [];

  if (activeDeployment) {
    allCards.push({
      id: `active-${activeDeployment.complaintKey}`,
      type: activeDeployment.type,
      description: activeDeployment.description,
      complainantName: activeDeployment.complainantName,
      date: activeDeployment.deployedAt,
      status: "in-progress",
      incidentPurok: activeDeployment.incidentPurok,
      coDeployedTanods: activeDeployment.coDeployedTanods || [],
      userId: activeDeployment.userId,
      complaintKey: activeDeployment.complaintKey,
    });
  }

  deploymentHistory.forEach((entry) => {
    allCards.push({
      id: `history-${entry.complaintKey}`,
      type: entry.type,
      description: entry.description,
      complainantName: entry.complainantName,
      date: entry.resolvedAt || entry.deployedAt,
      status: entry.status,
      incidentPurok: entry.incidentPurok,
      coDeployedTanods: entry.coDeployedTanods || [],
      userId: entry.userId,
      complaintKey: entry.complaintKey,
      tanodRating: entry.tanodRating,
    });
  });

  const filteredCards = allCards.filter((card) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return card.status === "in-progress";
    if (activeFilter === "resolved") return card.status === "resolved";
    return true;
  });

  const handleViewDetails = async (card: ComplaintCard) => {
    if (!card.userId || !card.complaintKey) return;
    setDetailLoading(true);
    setDetailModalVisible(true);
    try {
      const complaintRef = doc(firestore, "users", card.userId, "userComplaints", card.complaintKey);
      const complaintSnap = await getDoc(complaintRef);
      if (complaintSnap.exists()) {
        setSelectedComplaint({ ...complaintSnap.data(), ...card });
      } else {
        setSelectedComplaint(card);
      }
    } catch (error) {
      console.error("Error fetching complaint details:", error);
      Alert.alert("Error", "Failed to load complaint details");
      setDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleResolve = async (card: ComplaintCard) => {
    if (!card.userId || !card.complaintKey) return;
    try {
      const complaintRef = doc(firestore, "users", card.userId, "userComplaints", card.complaintKey);
      const complaintSnap = await getDoc(complaintRef);
      if (complaintSnap.exists()) {
        const data = complaintSnap.data();
        setEvidencePhoto(data.evidencePhoto || null);
      }
    } catch (error) {
      console.error("Error fetching evidence photo:", error);
    }
    setCardToResolve(card);
    setResolveModalVisible(true);
  };

  const confirmResolve = async () => {
    if (!cardToResolve) return;
    if (!resolutionPhoto) {
      Alert.alert("Required Photo", "Please upload a resolution photo before resolving the complaint.");
      return;
    }

    setResolving(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(
        doc(firestore, "users", cardToResolve.userId!, "userComplaints", cardToResolve.complaintKey!),
        { status: "resolved", resolvedAt: serverTimestamp(), resolutionPhoto }
      );

      const tanodsToResolve: { uid: string; name: string }[] = [];
      if (activeDeployment && activeDeployment.complaintKey === cardToResolve.complaintKey) {
        tanodsToResolve.push({ uid: user.uid, name: "" });
        if (activeDeployment.coDeployedTanods) {
          tanodsToResolve.push(...activeDeployment.coDeployedTanods);
        }
      } else {
        tanodsToResolve.push({ uid: user.uid, name: "" });
      }

      for (const tanod of tanodsToResolve) {
        const tanodRef = doc(firestore, "employee", tanod.uid);
        const tanodSnap = await getDoc(tanodRef);
        const deployedTo = tanodSnap.exists() ? tanodSnap.data().deployedTo : null;
        const coDeployedTanods = tanodsToResolve.filter((item) => item.uid !== tanod.uid);

        await setDoc(
          doc(firestore, "employee", tanod.uid, "deploymentHistory", cardToResolve.complaintKey!),
          {
            complaintKey: cardToResolve.complaintKey,
            userId: cardToResolve.userId,
            complainantName: cardToResolve.complainantName,
            type: cardToResolve.type,
            incidentPurok: cardToResolve.incidentPurok,
            description: cardToResolve.description,
            deployedAt: deployedTo?.deployedAt || null,
            resolvedAt: new Date().toISOString(),
            status: "resolved",
            tanodRating: null,
            tanodComment: null,
            coDeployedTanods,
          }
        );

        await updateDoc(tanodRef, {
          deploymentStatus: "available",
          deployedTo: null,
        });
      }

      setResolveModalVisible(false);
      setCardToResolve(null);
      setResolutionPhoto(null);
      setEvidencePhoto(null);
      Alert.alert("Success", "Complaint has been marked as resolved.");
    } catch (error) {
      console.error("Error resolving complaint:", error);
      Alert.alert("Error", "Failed to resolve complaint. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const pickImageFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted === false) {
      Alert.alert("Permission Required", "Media library access needed.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null;
      setResolutionPhoto(selectedImage);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Required", "Camera access needed.");
        return;
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].base64 ? `data:image/jpeg;base64,${result.assets[0].base64}` : null;
      setResolutionPhoto(selectedImage);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const getStatusMeta = (status: string) => {
    switch (status) {
      case "pending":
        return {
          label: "Pending",
          color: COLORS.warning,
          bg: COLORS.warningSoft,
          icon: "time-outline" as const,
        };
      case "in-progress":
        return {
          label: "Active",
          color: COLORS.primary,
          bg: COLORS.primarySoft,
          icon: "pulse-outline" as const,
        };
      case "resolved":
        return {
          label: "Resolved",
          color: COLORS.success,
          bg: COLORS.successSoft,
          icon: "checkmark-circle-outline" as const,
        };
      default:
        return {
          label: "Unknown",
          color: COLORS.textSoft,
          bg: COLORS.pageAlt,
          icon: "help-circle-outline" as const,
        };
    }
  };

  const counts = useMemo(() => {
    const active = allCards.filter((card) => card.status === "in-progress").length;
    const resolved = allCards.filter((card) => card.status === "resolved").length;
    return { all: allCards.length, active, resolved };
  }, [allCards.length, activeDeployment, deploymentHistory]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingTitle}>Loading requests</Text>
          <Text style={styles.loadingSubtitle}>Checking your assigned complaints and history.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isIdVerified = idStatus?.toLowerCase() === "verified" || idStatus?.toLowerCase() === "approved";
  if (!isIdVerified) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <View style={styles.blockedWrap}>
          <View style={styles.blockedCard}>
            <View style={styles.blockedIconWrap}>
              <Ionicons name="shield-outline" size={42} color={COLORS.warning} />
            </View>
            <Text style={styles.blockedTitle}>ID verification required</Text>
            <Text style={styles.blockedText}>
              {idStatus === "Pending"
                ? "Your ID is still under review. Complaint management opens after approval."
                : "Your ID verification was denied. Upload a valid ID from your profile to regain access."}
            </Text>
            <TouchableOpacity style={styles.blockedButton} onPress={() => router.push("/employee/profile")}>
              <Text style={styles.blockedButtonText}>Open profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}
        >
          <View style={[styles.hero, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.heroEyebrow}>Complaint center</Text>
            <Text style={styles.heroTitle}>Manage requests</Text>
            <Text style={styles.heroSubtitle}>
              Clear, larger, and easier to scan. Active deployment first, history below.
            </Text>

            <View style={styles.summaryRow}>
              <SummaryBox icon="reader-outline" label="All" value={counts.all} tint={COLORS.text} bg={COLORS.pageAlt} />
              <SummaryBox icon="pulse-outline" label="Active" value={counts.active} tint={COLORS.primary} bg={COLORS.primarySoft} />
              <SummaryBox icon="checkmark-circle-outline" label="Resolved" value={counts.resolved} tint={COLORS.success} bg={COLORS.successSoft} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Show</Text>
            <View style={styles.filterRow}>
              <FilterChip label={`All (${counts.all})`} selected={activeFilter === "all"} onPress={() => setActiveFilter("all")} />
              <FilterChip label={`Active (${counts.active})`} selected={activeFilter === "active"} onPress={() => setActiveFilter("active")} />
              <FilterChip label={`Resolved (${counts.resolved})`} selected={activeFilter === "resolved"} onPress={() => setActiveFilter("resolved")} />
            </View>
          </View>

          <View style={styles.section}>
            {filteredCards.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="document-text-outline" size={36} color={COLORS.textFaint} />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeFilter === "active"
                    ? "No active deployment"
                    : activeFilter === "resolved"
                      ? "No resolved complaints yet"
                      : "No complaints yet"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeFilter === "active"
                    ? "You are currently not assigned to any complaint."
                    : "Your deployment activity will appear here once records are available."}
                </Text>
              </View>
            ) : (
              filteredCards.map((card) => {
                const statusMeta = getStatusMeta(card.status);
                return (
                  <View key={card.id} style={[styles.requestCard, card.status === "in-progress" && styles.requestCardActive]}>
                    <View style={styles.requestTopRow}>
                      <View style={styles.requestTopLeft}>
                        <View style={[styles.typePill, { backgroundColor: COLORS.accentSoft }]}>
                          <Text style={styles.typePillText}>{card.type}</Text>
                        </View>
                        <Text style={styles.requestTitle} numberOfLines={3}>
                          {card.description}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                        <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
                        <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                      </View>
                    </View>

                    <View style={styles.infoGrid}>
                      <View style={styles.infoItem}>
                        <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.infoLabel}>Complainant</Text>
                        <Text style={styles.infoValue}>{card.complainantName}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="location-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.infoLabel}>Purok</Text>
                        <Text style={styles.infoValue}>Purok {card.incidentPurok}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.infoLabel}>{card.status === "resolved" ? "Resolved" : "Assigned"}</Text>
                        <Text style={styles.infoValue}>{formatDate(card.date)}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Ionicons name="star-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.infoLabel}>Rating</Text>
                        <Text style={styles.infoValue}>{card.tanodRating != null ? `${card.tanodRating}/5` : "No rating"}</Text>
                      </View>
                    </View>

                    {card.coDeployedTanods.length > 0 && (
                      <View style={styles.teamRow}>
                        <Ionicons name="people-outline" size={16} color={COLORS.accent} />
                        <Text style={styles.teamRowText}>
                          With: {card.coDeployedTanods.map((tanod) => tanod.name).join(", ")}
                        </Text>
                      </View>
                    )}

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.secondaryButton} onPress={() => handleViewDetails(card)}>
                        <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.secondaryButtonText}>View details</Text>
                      </TouchableOpacity>

                      {card.status === "in-progress" && (
                        <TouchableOpacity
                          style={[styles.primaryButton, resolving && styles.buttonDisabled]}
                          onPress={() => handleResolve(card)}
                          disabled={resolving}
                        >
                          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.primaryButtonText}>{resolving ? "Resolving..." : "Mark resolved"}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {detailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingTitle}>Loading details</Text>
              </View>
            ) : selectedComplaint ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Complaint details</Text>
                    <Text style={styles.modalSubtitle}>Review full information before taking action.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close-circle" size={30} color={COLORS.textFaint} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalPillRow}>
                  <View style={[styles.typePill, { backgroundColor: COLORS.accentSoft }]}>
                    <Text style={styles.typePillText}>{selectedComplaint.type}</Text>
                  </View>
                  {(() => {
                    const statusMeta = getStatusMeta(selectedComplaint.status);
                    return (
                      <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                        <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
                        <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                      </View>
                    );
                  })()}
                </View>

                <View style={styles.detailBlock}>
                  <Text style={styles.detailBlockLabel}>Description</Text>
                  <Text style={styles.detailBlockValue}>{selectedComplaint.description || selectedComplaint.message}</Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailBlockLabel}>Complainant</Text>
                    <Text style={styles.detailCellValue}>{selectedComplaint.complainantName}</Text>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailBlockLabel}>Purok</Text>
                    <Text style={styles.detailCellValue}>Purok {selectedComplaint.incidentPurok}</Text>
                  </View>
                  <View style={styles.detailCell}>
                    <Text style={styles.detailBlockLabel}>Deployed at</Text>
                    <Text style={styles.detailCellValue}>{formatDate(selectedComplaint.deployedAt || selectedComplaint.date)}</Text>
                  </View>
                  {selectedComplaint.resolvedAt && (
                    <View style={styles.detailCell}>
                      <Text style={styles.detailBlockLabel}>Resolved at</Text>
                      <Text style={styles.detailCellValue}>{formatDate(selectedComplaint.resolvedAt)}</Text>
                    </View>
                  )}
                </View>

                {selectedComplaint.incidentLocation && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Location details</Text>
                    <Text style={styles.detailBlockValue}>{selectedComplaint.incidentLocation}</Text>
                  </View>
                )}

                {selectedComplaint.evidencePhoto && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Evidence photo</Text>
                    <Image source={{ uri: selectedComplaint.evidencePhoto }} style={styles.largeImage} resizeMode="cover" />
                  </View>
                )}

                {selectedComplaint.coDeployedTanods?.length > 0 && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Co-deployed tanods</Text>
                    {selectedComplaint.coDeployedTanods.map((tanod: CoDeployedTanod) => (
                      <Text key={tanod.uid} style={styles.detailListItem}>
                        • {tanod.name}
                      </Text>
                    ))}
                  </View>
                )}

                {selectedComplaint.tanodRating != null && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Citizen rating</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= (selectedComplaint.tanodRating || 0) ? "star" : "star-outline"}
                          size={22}
                          color={COLORS.warning}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {selectedComplaint.tanodComment && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailBlockLabel}>Feedback</Text>
                    <Text style={styles.detailBlockValue}>{selectedComplaint.tanodComment}</Text>
                  </View>
                )}

                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={resolveModalVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, styles.centeredOverlay]}>
          <View style={styles.resolveSheet}>
            <View style={styles.resolveIconWrap}>
              <Ionicons name="checkmark-circle" size={46} color={COLORS.success} />
            </View>
            <Text style={styles.resolveTitle}>Mark complaint as resolved</Text>
            <Text style={styles.resolveSubtitle}>
              Add a resolution photo before finishing this deployment.
            </Text>

            {cardToResolve && (
              <View style={styles.resolveDetailsCard}>
                <Text style={styles.resolveDetailText}><Text style={styles.boldText}>Type:</Text> {cardToResolve.type}</Text>
                <Text style={styles.resolveDetailText}><Text style={styles.boldText}>Complainant:</Text> {cardToResolve.complainantName}</Text>
                <Text style={styles.resolveDetailText}><Text style={styles.boldText}>Purok:</Text> {cardToResolve.incidentPurok}</Text>
              </View>
            )}

            <View style={styles.photoPanel}>
              {evidencePhoto && (
                <>
                  <Text style={styles.photoTitle}>Evidence photo</Text>
                  <Image source={{ uri: evidencePhoto }} style={styles.photoPreview} />
                </>
              )}

              <Text style={styles.photoTitle}>Resolution photo</Text>
              {resolutionPhoto ? (
                <Image source={{ uri: resolutionPhoto }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={COLORS.textFaint} />
                  <Text style={styles.photoPlaceholderText}>No photo selected yet</Text>
                </View>
              )}

              <View style={styles.photoButtonRow}>
                <TouchableOpacity style={styles.photoButton} onPress={pickImageFromGallery}>
                  <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.photoButtonText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.resolveButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setResolveModalVisible(false);
                  setCardToResolve(null);
                  setResolutionPhoto(null);
                  setEvidencePhoto(null);
                }}
                disabled={resolving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, resolving && styles.buttonDisabled]}
                onPress={confirmResolve}
                disabled={resolving}
              >
                {resolving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Resolve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.page,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.page,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.page,
    paddingHorizontal: 28,
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  blockedWrap: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
  },
  blockedCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  blockedIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 24,
    backgroundColor: COLORS.warningSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  blockedTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 10,
  },
  blockedText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  blockedButton: {
    marginTop: 22,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
  },
  blockedButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: COLORS.textFaint,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSoft,
  },
  summaryRow: {
    marginTop: 20,
    gap: 12,
  },
  summaryBox: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSoft,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "800",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  filterChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textSoft,
  },
  filterChipTextActive: {
    color: COLORS.primary,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 34,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  emptyIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: COLORS.pageAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  requestCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    marginBottom: 14,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  requestCardActive: {
    borderColor: COLORS.primary,
  },
  requestTopRow: {
    gap: 14,
    marginBottom: 16,
  },
  requestTopLeft: {
    gap: 10,
  },
  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
    textTransform: "capitalize",
  },
  requestTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: COLORS.text,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  infoGrid: {
    gap: 10,
  },
  infoItem: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textFaint,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  teamRowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSoft,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 10,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "flex-end",
  },
  centeredOverlay: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "88%",
  },
  modalLoading: {
    alignItems: "center",
    paddingVertical: 40,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSoft,
  },
  modalPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  detailBlock: {
    marginBottom: 18,
  },
  detailBlockLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textFaint,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  detailBlockValue: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text,
  },
  detailGrid: {
    gap: 12,
    marginBottom: 18,
  },
  detailCell: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
  },
  detailCellValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  largeImage: {
    width: "100%",
    height: 220,
    borderRadius: 20,
  },
  detailListItem: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    marginBottom: 4,
  },
  starRow: {
    flexDirection: "row",
    gap: 6,
  },
  modalCloseButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  resolveSheet: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
  },
  resolveIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.successSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  resolveTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  resolveSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  resolveDetailsCard: {
    marginTop: 18,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  resolveDetailText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
  },
  boldText: {
    fontWeight: "800",
  },
  photoPanel: {
    marginTop: 20,
  },
  photoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 10,
  },
  photoPreview: {
    width: "100%",
    height: 190,
    borderRadius: 18,
    marginBottom: 14,
  },
  photoPlaceholder: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    borderStyle: "dashed",
    backgroundColor: COLORS.pageAlt,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textSoft,
  },
  photoButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary,
  },
  resolveButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textSoft,
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.success,
    flexDirection: "row",
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.9,
  },
});
