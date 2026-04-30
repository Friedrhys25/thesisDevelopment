import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";
import { savePushTokenToFirestore, showLocalNotification } from "../../utils/notifications";

// Light theme exactly matching reports.tsx
const C = {
  bg: "#F8FAFC", surface: "#FFFFFF", surfaceAlt: "#F1F5F9", elevated: "#E2E8F0",
  text: "#0F172A", textMuted: "#64748B", textDim: "#94A3B8",
  gold: "#D97706", goldLight: "#F59E0B", goldDim: "rgba(217,119,6,0.08)", goldBorder: "rgba(217,119,6,0.2)",
  blue: "#1447c0", blueMid: "#2563EB", blueLight: "rgba(37,99,235,0.08)",
  red: "#DC2626", success: "#059669", successDim: "rgba(5,150,105,0.08)",
  border: "#E2E8F0", borderStrong: "#CBD5E1",
};

function AnimStat({ icon, value, label, color, bg }: any) {
  return (
    <View style={st.statBox}>
      <View style={[st.statIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={18} color={color} /></View>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

export default function ManageRequests() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeDeployment, setActiveDeployment] = useState<any>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [cardToResolve, setCardToResolve] = useState<any>(null);
  const [idStatus, setIdStatus] = useState("Pending");
  const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { router.replace("/"); return; }

    savePushTokenToFirestore("employee");

    let prevDeploymentStatus: string | null = null;
    const unsubTanod = onSnapshot(doc(firestore, "employee", user.uid), async (snapshot) => {
      if (!snapshot.exists()) { setActiveDeployment(null); setLoading(false); return; }
      const data = snapshot.data();
      let status = data.idstatus || "";
      if (!status) {
        try { const userDoc = await getDoc(doc(firestore, "users", user.uid)); if (userDoc.exists()) status = userDoc.data().idstatus || "Pending"; } catch (e) {}
      }
      setIdStatus(status || "Pending");

      const curr = data.deploymentStatus || "available";
      if (prevDeploymentStatus !== null && prevDeploymentStatus !== "deployed" && curr === "deployed" && data.deployedTo) {
        showLocalNotification("New Duty Assigned", `Purok ${data.deployedTo.incidentPurok} - ${data.deployedTo.type}`, { screen: "manage-requests" });
      }
      prevDeploymentStatus = curr;
      setActiveDeployment((curr === "deployed" && data.deployedTo) ? data.deployedTo : null);
      setLoading(false);
    });

    const unsubHistory = onSnapshot(query(collection(firestore, "employee", user.uid, "deploymentHistory"), orderBy("resolvedAt", "desc")), (snap) => {
      setDeploymentHistory(snap.docs.map(e => ({ ...e.data(), complaintKey: e.id })));
    });

    return () => { unsubTanod(); unsubHistory(); };
  }, []);

  const allCards: any[] = [];
  if (activeDeployment) {
    allCards.push({
      id: `active-${activeDeployment.complaintKey}`, type: activeDeployment.type, description: activeDeployment.description,
      complainantName: activeDeployment.complainantName, date: activeDeployment.deployedAt, status: "in-progress",
      incidentPurok: activeDeployment.incidentPurok, coDeployedTanods: activeDeployment.coDeployedTanods || [],
      userId: activeDeployment.userId, complaintKey: activeDeployment.complaintKey,
      deployedAt: activeDeployment.deployedAt,
    });
  }
  deploymentHistory.forEach(entry => {
    allCards.push({
      id: `history-${entry.complaintKey}`, type: entry.type, description: entry.description, complainantName: entry.complainantName,
      date: entry.resolvedAt || entry.deployedAt, status: entry.status, incidentPurok: entry.incidentPurok,
      coDeployedTanods: entry.coDeployedTanods || [], userId: entry.userId, complaintKey: entry.complaintKey,
      deployedAt: entry.deployedAt,
    });
  });

  const filteredCards = allCards.filter(c => activeFilter === "all" || (activeFilter === "active" && c.status === "in-progress") || (activeFilter === "resolved" && c.status === "resolved"));

  const handleViewDetails = async (c: any) => {
    if (!c.userId || !c.complaintKey) return;
    setDetailLoading(true); setDetailModalVisible(true);
    try {
      const snap = await getDoc(doc(firestore, "users", c.userId, "userComplaints", c.complaintKey));
      setSelectedComplaint(snap.exists() ? { ...snap.data(), ...c } : c);
    } catch { Alert.alert("Error", "Load fail."); setDetailModalVisible(false); }
    finally { setDetailLoading(false); }
  };

  const handleResolve = (c: any) => { setCardToResolve(c); setResolveModalVisible(true); };

  const confirmResolve = async () => {
    if (!cardToResolve) return;
    if (!resolutionPhoto) { Alert.alert("Required", "Upload photo."); return; }
    setResolving(true);
    try {
      const user = auth.currentUser; if (!user) return;
      await updateDoc(doc(firestore, "users", cardToResolve.userId, "userComplaints", cardToResolve.complaintKey), { status: "resolved", resolvedAt: serverTimestamp(), resolutionPhoto });

      const tanods = [];
      if (activeDeployment && activeDeployment.complaintKey === cardToResolve.complaintKey) {
        tanods.push({ uid: user.uid, name: "" });
        if (activeDeployment.coDeployedTanods) tanods.push(...activeDeployment.coDeployedTanods);
      } else { tanods.push({ uid: user.uid, name: "" }); }

      for (const t of tanods) {
        const tRef = doc(firestore, "employee", t.uid);
        const tSnap = await getDoc(tRef);
        const dep = tSnap.exists() ? tSnap.data().deployedTo : null;
        await setDoc(doc(firestore, "employee", t.uid, "deploymentHistory", cardToResolve.complaintKey), {
          ...cardToResolve, deployedAt: dep?.deployedAt || null, resolvedAt: new Date().toISOString(), status: "resolved", tanodRating: null, tanodComment: null,
          coDeployedTanods: tanods.filter(item => item.uid !== t.uid),
        });
        await updateDoc(tRef, { deploymentStatus: "available", deployedTo: null });
      }
      setResolveModalVisible(false); setCardToResolve(null); setResolutionPhoto(null);
    } catch { Alert.alert("Error", "Resolve fail."); }
    finally { setResolving(false); }
  };

  const pickImage = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return Alert.alert("Required", "Need library access.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.3, base64: true });
    if (!res.canceled && res.assets[0].base64) setResolutionPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const takePhoto = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return Alert.alert("Required", "Need camera access.");
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.3, base64: true });
    if (!res.canceled && res.assets[0].base64) setResolutionPhoto(`data:image/jpeg;base64,${res.assets[0].base64}`);
  };

  const toDate = (ds: any) => { if (!ds) return null; if (ds.toDate) return ds.toDate(); const d = new Date(ds); return isNaN(d.getTime()) ? null : d; };
  const formatDate = (ds: any) => { const d = toDate(ds); return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "--"; };
  const formatTime = (ds: any) => { const d = toDate(ds); return d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "--"; };

  const getStatusMeta = (s: string) => {
    if (s === "pending") return { label: "Pending", color: C.gold, bg: C.goldDim, icon: "time" };
    if (s === "in-progress") return { label: "Active", color: C.blueMid, bg: C.blueLight, icon: "pulse" };
    if (s === "resolved") return { label: "Resolved", color: C.success, bg: C.successDim, icon: "checkmark" };
    return { label: "Unknown", color: C.textMuted, bg: C.surfaceAlt, icon: "help" };
  };

  const counts = useMemo(() => ({ all: allCards.length, active: allCards.filter(c => c.status === "in-progress").length, resolved: allCards.filter(c => c.status === "resolved").length }), [allCards.length]);

  if (loading) return <SafeAreaView style={st.safe}><View style={st.center}><ActivityIndicator size="large" color={C.gold} /></View></SafeAreaView>;

  if (idStatus?.toLowerCase() !== "verified" && idStatus?.toLowerCase() !== "approved") return (
    <SafeAreaView style={st.safe}>
      <View style={st.center}>
        <Ionicons name="shield-half" size={64} color={C.gold} style={{ marginBottom: 16 }} />
        <Text style={st.title}>Verification Required</Text>
        <Text style={[st.subtitle, { textAlign: "center", marginHorizontal: 40, marginTop: 10, marginBottom: 24 }]}>ID review is pending or denied. Please ensure you have uploaded a valid ID.</Text>
        <TouchableOpacity style={st.btnPrimary} onPress={() => router.push("/employee/profile")}><Text style={st.btnPrimaryText}>Go to Profile</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={[st.header, { paddingTop: insets.top + 14 }]}>
          <Text style={st.eyebrow}>OPERATIONS</Text>
          <Text style={st.title}>Deployments</Text>
          <Text style={st.subtitle}>Manage your assignments</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={st.section}>
            <Text style={st.secEye}>METRICS</Text>
            <View style={st.statsRow}>
              <AnimStat icon="layers" value={counts.all} label="TOTAL" color={C.text} bg={C.surfaceAlt} />
              <AnimStat icon="pulse" value={counts.active} label="ACTIVE" color={C.blueMid} bg={C.blueLight} />
              <AnimStat icon="checkmark-done" value={counts.resolved} label="RESOLVED" color={C.success} bg={C.successDim} />
            </View>
          </View>

          {/* Filters (like tabs in reports.tsx) */}
          <View style={st.section}>
            <Text style={st.secEye}>FILTER VIEW</Text>
            <View style={st.tabRow}>
              {(["all", "active", "resolved"] as const).map(m => (
                <TouchableOpacity key={m} style={[st.tab, activeFilter === m && st.tabActive]} onPress={() => setActiveFilter(m)}>
                  <Text style={[st.tabText, activeFilter === m && st.tabTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* List */}
          <View style={st.section}>
            <Text style={st.secEye}>RECORDS</Text>
            {filteredCards.length === 0 ? (
              <View style={st.emptyWrap}>
                <Ionicons name="document-text-outline" size={40} color={C.textDim} />
                <Text style={st.emptyText}>No records found</Text>
              </View>
            ) : (
              filteredCards.map(c => {
                const meta = getStatusMeta(c.status);
                return (
                  <TouchableOpacity key={c.id} style={[st.histCard, c.status === "in-progress" && st.histCardActive]} onPress={() => handleViewDetails(c)}>
                    <View style={st.histTop}>
                      <View style={[st.histBadge, { backgroundColor: meta.bg, borderColor: meta.color + "33" }]}><Ionicons name={meta.icon as any} size={14} color={meta.color} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.histType}>{c.type}</Text>
                        <Text style={st.histPurok}>Purok {c.incidentPurok}</Text>
                      </View>
                      <View style={[st.durationPill, { backgroundColor: meta.bg }]}><Text style={[st.durationText, { color: meta.color }]}>{meta.label}</Text></View>
                    </View>
                    
                    <View style={st.histExpand}>
                      <Text style={st.histDesc} numberOfLines={2}>{c.description}</Text>
                      <View style={st.histDivider} />
                      <View style={st.histRow}><Ionicons name="person-outline" size={14} color={C.textDim} /><Text style={st.histLabel}>Citizen</Text><Text style={st.histVal}>{c.complainantName}</Text></View>
                      <View style={st.histRow}><Ionicons name="calendar-outline" size={14} color={C.textDim} /><Text style={st.histLabel}>Date</Text><Text style={st.histVal}>{formatDate(c.date)} {formatTime(c.date)}</Text></View>
                      {c.coDeployedTanods.length > 0 && <View style={st.histRow}><Ionicons name="people-outline" size={14} color={C.textDim} /><Text style={st.histLabel}>Team</Text><Text style={st.histVal}>{c.coDeployedTanods.map((t:any)=>t.name).join(", ")}</Text></View>}
                      
                      <View style={st.btnRow}>
                        <TouchableOpacity style={st.btnSecondary} onPress={() => handleViewDetails(c)}>
                          <Ionicons name="document-text-outline" size={14} color={C.textMuted} /><Text style={st.btnSecondaryText}>Details</Text>
                        </TouchableOpacity>
                        {c.status === "in-progress" && (
                          <TouchableOpacity style={st.btnPrimary} onPress={() => handleResolve(c)}>
                            <Ionicons name="checkmark-circle-outline" size={14} color={C.surface} /><Text style={st.btnPrimaryText}>Mark Done</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* DETAIL MODAL */}
      <Modal visible={detailModalVisible} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={st.modalContent}>
            {detailLoading ? <View style={st.center}><ActivityIndicator size="large" color={C.gold} /></View> : selectedComplaint ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={st.modalHeader}>
                  <Text style={st.modalTitle}>Record Details</Text>
                  <TouchableOpacity style={st.modalClose} onPress={() => setDetailModalVisible(false)}><Ionicons name="close" size={20} color={C.textMuted} /></TouchableOpacity>
                </View>
                <View style={st.pillWrap}>
                  <View style={st.modalPill}><Text style={st.modalPillText}>{selectedComplaint.type}</Text></View>
                  <View style={[st.modalPill, { backgroundColor: getStatusMeta(selectedComplaint.status).bg, borderColor: getStatusMeta(selectedComplaint.status).color + "33" }]}>
                    <Text style={[st.modalPillText, { color: getStatusMeta(selectedComplaint.status).color }]}>{getStatusMeta(selectedComplaint.status).label}</Text>
                  </View>
                </View>
                
                <Text style={st.secEye}>DESCRIPTION</Text>
                <Text style={st.modalDesc}>{selectedComplaint.description || selectedComplaint.message}</Text>
                
                <Text style={st.secEye}>INFORMATION</Text>
                <View style={st.card}>
                  <View style={st.recordRow}><Text style={st.recordLabel}>Citizen</Text><Text style={st.recordVal}>{selectedComplaint.complainantName}</Text></View>
                  <View style={st.divider} />
                  <View style={st.recordRow}><Text style={st.recordLabel}>Complaint ID</Text><Text style={st.recordVal}>{selectedComplaint.complaintKey || "--"}</Text></View>
                  <View style={st.divider} />
                  <View style={st.recordRow}><Text style={st.recordLabel}>Location</Text><Text style={st.recordVal}>Purok {selectedComplaint.incidentPurok || selectedComplaint.purok || "--"}</Text></View>
                  {selectedComplaint.specificLocation && (
                    <><View style={st.divider} /><View style={st.recordRow}><Text style={st.recordLabel}>Landmark</Text><Text style={st.recordVal}>{selectedComplaint.specificLocation}</Text></View></>
                  )}
                  <View style={st.divider} />
                  <View style={st.recordRow}><Text style={st.recordLabel}>Date Sent</Text><Text style={st.recordVal}>{formatDate(selectedComplaint.date)} {formatTime(selectedComplaint.date)}</Text></View>
                  <View style={st.divider} />
                  <View style={st.recordRow}><Text style={st.recordLabel}>Deployed</Text><Text style={st.recordVal}>{formatDate(selectedComplaint.deployedAt)} {formatTime(selectedComplaint.deployedAt)}</Text></View>
                  
                  {selectedComplaint.coDeployedTanods && selectedComplaint.coDeployedTanods.length > 0 && (
                    <><View style={st.divider} /><View style={st.recordRow}><Text style={st.recordLabel}>Team</Text><Text style={st.recordVal}>{selectedComplaint.coDeployedTanods.map((t:any)=>t.name).join(", ")}</Text></View></>
                  )}

                  {selectedComplaint.resolvedAt && (
                    <><View style={st.divider} /><View style={st.recordRow}><Text style={st.recordLabel}>Resolved</Text><Text style={st.recordVal}>{formatDate(selectedComplaint.resolvedAt)} {formatTime(selectedComplaint.resolvedAt)}</Text></View></>
                  )}
                </View>

                {selectedComplaint.evidencePhoto && (
                  <><Text style={st.secEye}>EVIDENCE PHOTO</Text><Image source={{ uri: selectedComplaint.evidencePhoto }} style={st.evidenceImg} /></>
                )}
                
                {selectedComplaint.resolutionPhoto && (
                  <><Text style={[st.secEye, { marginTop: 16 }]}>RESOLUTION PHOTO</Text><Image source={{ uri: selectedComplaint.resolutionPhoto }} style={st.evidenceImg} /></>
                )}

                <TouchableOpacity style={[st.btnPrimary, { marginTop: 24 }]} onPress={() => setDetailModalVisible(false)}>
                  <Text style={st.btnPrimaryText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* RESOLVE MODAL */}
      <Modal visible={resolveModalVisible} animationType="fade" transparent>
        <View style={[st.modalOverlay, { justifyContent: "center", padding: 20 }]}>
          <View style={[st.modalContent, { borderRadius: 24, padding: 24, maxHeight: "auto", flex: 0 }]}>
            <View style={st.modalIconWrap}><Ionicons name="camera" size={28} color={C.blueMid} /></View>
            <Text style={[st.modalTitle, { textAlign: "center", marginBottom: 8 }]}>Finalize Duty</Text>
            <Text style={[st.modalDesc, { textAlign: "center", marginBottom: 24 }]}>Upload a photo of the resolved incident.</Text>

            <View style={st.uploadArea}>
              {resolutionPhoto ? <Image source={{ uri: resolutionPhoto }} style={st.previewImg} /> : (
                <View style={st.uploadEmpty}><Ionicons name="image-outline" size={32} color={C.textDim} /><Text style={st.uploadEmptyText}>No photo attached</Text></View>
              )}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={st.btnOutline} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={16} color={C.text} />
                  <Text style={st.btnOutlineText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.btnOutline} onPress={pickImage}>
                  <Ionicons name="image-outline" size={16} color={C.text} />
                  <Text style={st.btnOutlineText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <TouchableOpacity style={st.btnGhost} onPress={() => { setResolveModalVisible(false); setResolutionPhoto(null); }}><Text style={st.btnGhostText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[st.btnPrimary, { flex: 1.5 }, resolving && { opacity: 0.6 }]} onPress={confirmResolve} disabled={resolving}>
                {resolving ? <ActivityIndicator color="#FFF" /> : <Text style={st.btnPrimaryText}>Submit Record</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 22, paddingBottom: 18, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.textMuted, fontWeight: "600" },

  section: { paddingHorizontal: 18, marginTop: 24 },
  secEye: { color: C.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 },
  
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 28, fontWeight: "900", color: C.text },
  statLabel: { fontSize: 9, color: C.textMuted, marginTop: 4, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },

  tabRow: { flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 12 },
  tabActive: { backgroundColor: C.text },
  tabText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: C.textMuted, textTransform: "uppercase" },
  tabTextActive: { color: "#FFF" },

  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: C.textMuted, marginTop: 12, fontSize: 14, fontWeight: "600" },

  histCard: { backgroundColor: C.surface, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  histCardActive: { borderColor: C.blueMid },
  histTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  histBadge: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  histType: { fontSize: 15, fontWeight: "900", color: C.text },
  histPurok: { fontSize: 12, fontWeight: "600", color: C.textMuted, marginTop: 2 },
  durationPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  durationText: { fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  
  histExpand: { marginTop: 16 },
  histDesc: { fontSize: 15, color: C.text, fontWeight: "600", lineHeight: 22 },
  histDivider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  histLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: C.textMuted },
  histVal: { fontSize: 13, fontWeight: "800", color: C.text, maxWidth: "60%", textAlign: "right" },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  btnSecondaryText: { fontSize: 13, fontWeight: "800", color: C.text },
  btnPrimary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: C.blueMid },
  btnPrimaryText: { fontSize: 13, fontWeight: "800", color: "#FFF" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: "90%", flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: C.text, letterSpacing: -0.5 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center" },
  pillWrap: { flexDirection: "row", gap: 8, marginBottom: 24 },
  modalPill: { backgroundColor: C.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  modalPillText: { fontSize: 11, fontWeight: "800", color: C.text, textTransform: "uppercase", letterSpacing: 0.5 },
  modalDesc: { fontSize: 16, color: C.text, fontWeight: "600", lineHeight: 24, marginBottom: 24 },

  card: { backgroundColor: C.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border },
  recordRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  recordLabel: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  recordVal: { fontSize: 14, fontWeight: "800", color: C.text, textAlign: "right" },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  evidenceImg: { width: "100%", height: 200, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.elevated },

  modalIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blueLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16 },
  uploadArea: { backgroundColor: C.bg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, borderStyle: "dashed", marginBottom: 16 },
  uploadEmpty: { height: 120, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  uploadEmptyText: { fontSize: 13, fontWeight: "700", color: C.textMuted, marginTop: 8 },
  previewImg: { width: "100%", height: 160, borderRadius: 12, marginBottom: 16 },
  btnOutline: { flex: 1, flexDirection: "row", paddingVertical: 12, borderRadius: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, alignItems: "center", justifyContent: "center", gap: 6 },
  btnOutlineText: { fontSize: 13, fontWeight: "800", color: C.text },
  btnGhost: { flex: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  btnGhostText: { fontSize: 14, fontWeight: "800", color: C.textMuted },
});
