import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

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

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace("/");
      return;
    }

    // Listen to tanod's own employee document for current deployment
    const tanodRef = doc(firestore, "employee", user.uid);
    const unsubTanod = onSnapshot(tanodRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveDeployment(null);
        setLoading(false);
        return;
      }
      const data = snapshot.data();
      if (data.deploymentStatus === "deployed" && data.deployedTo) {
        setActiveDeployment(data.deployedTo as ActiveDeployment);
      } else {
        setActiveDeployment(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to tanod document:", error);
      setLoading(false);
    });

    // Listen to deployment history
    const historyRef = collection(firestore, "employee", user.uid, "deploymentHistory");
    const historyQuery = query(historyRef, orderBy("resolvedAt", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const history = snapshot.docs.map((d) => ({
        ...d.data(),
        complaintKey: d.id,
      })) as HistoryEntry[];
      setDeploymentHistory(history);
    }, (error) => {
      console.error("Error listening to deployment history:", error);
    });

    return () => {
      unsubTanod();
      unsubHistory();
    };
  }, []);

  // Build cards from active deployment + history
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

  // Filter cards
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

  const handleResolve = (card: ComplaintCard) => {
    if (!card.userId || !card.complaintKey) return;
    setCardToResolve(card);
    setResolveModalVisible(true);
  };

  const confirmResolve = async () => {
    if (!cardToResolve) return;
    setResolving(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Update complaint status to resolved
      await updateDoc(
        doc(firestore, "users", cardToResolve.userId!, "userComplaints", cardToResolve.complaintKey!),
        { status: "resolved", resolvedAt: serverTimestamp() }
      );

      // 2. Get deployed tanods from the complaint or from activeDeployment
      const tanodsToResolve: { uid: string; name: string }[] = [];
      if (activeDeployment && activeDeployment.complaintKey === cardToResolve.complaintKey) {
        // Current user is deployed
        tanodsToResolve.push({ uid: user.uid, name: "" });
        // Add co-deployed tanods
        if (activeDeployment.coDeployedTanods) {
          tanodsToResolve.push(...activeDeployment.coDeployedTanods);
        }
      } else {
        tanodsToResolve.push({ uid: user.uid, name: "" });
      }

      // 3. For each tanod: save to deploymentHistory and clear deployment
      for (const tanod of tanodsToResolve) {
        const tanodRef = doc(firestore, "employee", tanod.uid);
        const tanodSnap = await getDoc(tanodRef);
        const deployedTo = tanodSnap.exists() ? tanodSnap.data().deployedTo : null;

        const coDeployedTanods = tanodsToResolve.filter((t) => t.uid !== tanod.uid);

        // Save to history subcollection
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

        // Clear current deployment
        await updateDoc(tanodRef, {
          deploymentStatus: "available",
          deployedTo: null,
        });
      }

      setResolveModalVisible(false);
      setCardToResolve(null);
      Alert.alert("Success", "Complaint has been marked as resolved.");
    } catch (error) {
      console.error("Error resolving complaint:", error);
      Alert.alert("Error", "Failed to resolve complaint. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#ff9800";
      case "in-progress":
        return "#2196f3";
      case "resolved":
        return "#4caf50";
      default:
        return "#999";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Loading complaints...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>My Deployments</Text>
        <Text style={styles.subtitle}>View your assigned complaints & deployment history</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.filterButtons}>
          {(["all", "active", "resolved"] as FilterType[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterBtn, activeFilter === filter && styles.filterBtnActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                {filter === "all" ? `All (${allCards.length})` : filter === "active" ? `Active (${allCards.filter(c => c.status === "in-progress").length})` : `Resolved (${allCards.filter(c => c.status === "resolved").length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {filteredCards.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {activeFilter === "active" ? "No Active Deployment" : activeFilter === "resolved" ? "No Resolved Complaints" : "No Complaints Yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === "active" ? "You are currently not deployed to any complaint." : "Your deployment history will appear here."}
            </Text>
          </View>
        ) : (
          filteredCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.requestCard, card.status === "in-progress" && styles.activeCard]}
              onPress={() => handleViewDetails(card)}
            >
              <View style={styles.requestHeader}>
                <View style={styles.requestTitleSection}>
                  <View style={[styles.typeBadge, { backgroundColor: "#e74c3c" }]}>
                    <Text style={styles.typeBadgeText}>{card.type}</Text>
                  </View>
                  <Text style={styles.requestTitle} numberOfLines={2}>{card.description}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(card.status) }]}>
                  <Text style={styles.statusText}>{card.status}</Text>
                </View>
              </View>

              <View style={styles.requestDetails}>
                <Ionicons name="person" size={16} color="#999" />
                <Text style={styles.detailText}>{card.complainantName}</Text>
                <Text style={styles.separator}>•</Text>
                <Ionicons name="location" size={16} color="#999" />
                <Text style={styles.detailText}>Purok {card.incidentPurok}</Text>
              </View>

              <View style={styles.requestDetails}>
                <Ionicons name="calendar" size={16} color="#999" />
                <Text style={styles.detailText}>{formatDate(card.date)}</Text>
                {card.tanodRating != null && (
                  <>
                    <Text style={styles.separator}>•</Text>
                    <Ionicons name="star" size={16} color="#f39c12" />
                    <Text style={styles.detailText}>{card.tanodRating}/5</Text>
                  </>
                )}
              </View>

              {card.coDeployedTanods.length > 0 && (
                <View style={styles.coDeployedRow}>
                  <Ionicons name="people" size={16} color="#999" />
                  <Text style={styles.coDeployedText}>
                    With: {card.coDeployedTanods.map(t => t.name).join(", ")}
                  </Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleViewDetails(card)}>
                  <Ionicons name="eye" size={18} color="#4a90e2" />
                  <Text style={styles.actionText}>View Details</Text>
                </TouchableOpacity>
                {card.status === "in-progress" && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={() => handleResolve(card)}
                    disabled={resolving}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.resolveButtonText}>
                      {resolving ? "Resolving..." : "Resolve"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {detailLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#4a90e2" />
                <Text style={styles.loadingText}>Loading details...</Text>
              </View>
            ) : selectedComplaint ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Complaint Details</Text>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close-circle" size={28} color="#999" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.typeBadge, { backgroundColor: "#e74c3c", alignSelf: "flex-start", marginBottom: 12 }]}>
                  <Text style={styles.typeBadgeText}>{selectedComplaint.type}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedComplaint.status), alignSelf: "flex-start", marginBottom: 16 }]}>
                  <Text style={styles.statusText}>{selectedComplaint.status}</Text>
                </View>

                <Text style={styles.modalLabel}>Description</Text>
                <Text style={styles.modalValue}>{selectedComplaint.description || selectedComplaint.message}</Text>

                <Text style={styles.modalLabel}>Complainant</Text>
                <Text style={styles.modalValue}>{selectedComplaint.complainantName}</Text>

                <Text style={styles.modalLabel}>Purok</Text>
                <Text style={styles.modalValue}>Purok {selectedComplaint.incidentPurok}</Text>

                {selectedComplaint.incidentLocation && (
                  <>
                    <Text style={styles.modalLabel}>Location</Text>
                    <Text style={styles.modalValue}>{selectedComplaint.incidentLocation}</Text>
                  </>
                )}

                <Text style={styles.modalLabel}>Deployed At</Text>
                <Text style={styles.modalValue}>{formatDate(selectedComplaint.deployedAt || selectedComplaint.date)}</Text>

                {selectedComplaint.resolvedAt && (
                  <>
                    <Text style={styles.modalLabel}>Resolved At</Text>
                    <Text style={styles.modalValue}>{formatDate(selectedComplaint.resolvedAt)}</Text>
                  </>
                )}

                {selectedComplaint.evidencePhoto && (
                  <>
                    <Text style={styles.modalLabel}>Evidence</Text>
                    <Image source={{ uri: selectedComplaint.evidencePhoto }} style={styles.evidenceImage} resizeMode="cover" />
                  </>
                )}

                {selectedComplaint.coDeployedTanods?.length > 0 && (
                  <>
                    <Text style={styles.modalLabel}>Co-Deployed Tanods</Text>
                    {selectedComplaint.coDeployedTanods.map((t: CoDeployedTanod) => (
                      <Text key={t.uid} style={styles.modalValue}>• {t.name}</Text>
                    ))}
                  </>
                )}

                {selectedComplaint.tanodRating != null && (
                  <>
                    <Text style={styles.modalLabel}>Rating</Text>
                    <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= (selectedComplaint.tanodRating || 0) ? "star" : "star-outline"}
                          size={24}
                          color="#f39c12"
                        />
                      ))}
                    </View>
                  </>
                )}

                {selectedComplaint.tanodComment && (
                  <>
                    <Text style={styles.modalLabel}>Feedback</Text>
                    <Text style={styles.modalValue}>{selectedComplaint.tanodComment}</Text>
                  </>
                )}

                <TouchableOpacity style={styles.closeButton} onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Resolve Confirmation Modal */}
      <Modal visible={resolveModalVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
          <View style={styles.resolveModalContent}>
            <View style={styles.resolveModalIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#4caf50" />
            </View>
            <Text style={styles.resolveModalTitle}>Mark as Resolved</Text>
            <Text style={styles.resolveModalMessage}>
              Are you sure you want to mark this complaint as resolved?
            </Text>
            {cardToResolve && (
              <View style={styles.resolveModalDetails}>
                <Text style={styles.resolveModalDetailText}>
                  <Text style={{ fontWeight: "600" }}>Type:</Text> {cardToResolve.type}
                </Text>
                <Text style={styles.resolveModalDetailText}>
                  <Text style={{ fontWeight: "600" }}>Complainant:</Text> {cardToResolve.complainantName}
                </Text>
                <Text style={styles.resolveModalDetailText}>
                  <Text style={{ fontWeight: "600" }}>Purok:</Text> {cardToResolve.incidentPurok}
                </Text>
              </View>
            )}
            <View style={styles.resolveModalButtons}>
              <TouchableOpacity
                style={styles.resolveModalCancelBtn}
                onPress={() => {
                  setResolveModalVisible(false);
                  setCardToResolve(null);
                }}
                disabled={resolving}
              >
                <Text style={styles.resolveModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resolveModalConfirmBtn, resolving && { opacity: 0.6 }]}
                onPress={confirmResolve}
                disabled={resolving}
              >
                {resolving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.resolveModalConfirmText}>Resolve</Text>
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
    backgroundColor: "#f5f7fa",
  },
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#e3f2fd",
  },
  section: {
    padding: 20,
  },
  filterButtons: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  filterBtnActive: {
    borderColor: "#4a90e2",
    backgroundColor: "#e6f4fe",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  filterTextActive: {
    color: "#4a90e2",
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  activeCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4a90e2",
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  requestTitleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2c3e50",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  requestDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
  },
  separator: {
    color: "#ccc",
    marginHorizontal: 4,
  },
  coDeployedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  coDeployedText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f4f9",
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a90e2",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#999",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 8,
    textAlign: "center",
  },
  spacer: {
    height: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  modalLoading: {
    alignItems: "center",
    paddingVertical: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  modalValue: {
    fontSize: 15,
    color: "#2c3e50",
    marginBottom: 4,
  },
  evidenceImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  closeButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resolveButton: {
    backgroundColor: "#4caf50",
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  resolveModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 30,
    alignItems: "center",
  },
  resolveModalIcon: {
    marginBottom: 12,
  },
  resolveModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  resolveModalMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  resolveModalDetails: {
    backgroundColor: "#f5f7fa",
    borderRadius: 10,
    padding: 12,
    width: "100%",
    marginBottom: 20,
  },
  resolveModalDetailText: {
    fontSize: 14,
    color: "#2c3e50",
    marginBottom: 4,
  },
  resolveModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  resolveModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  resolveModalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  resolveModalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#4caf50",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resolveModalConfirmText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
