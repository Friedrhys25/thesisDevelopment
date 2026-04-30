import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

// Light theme exactly matching reports.tsx
const C = {
  bg: "#F8FAFC", surface: "#FFFFFF", surfaceAlt: "#F1F5F9", elevated: "#E2E8F0",
  text: "#0F172A", textMuted: "#64748B", textDim: "#94A3B8",
  gold: "#D97706", goldLight: "#F59E0B", goldDim: "rgba(217,119,6,0.08)", goldBorder: "rgba(217,119,6,0.2)",
  blue: "#1447c0", blueMid: "#2563EB", blueLight: "rgba(37,99,235,0.08)",
  red: "#DC2626", success: "#059669", successDim: "rgba(5,150,105,0.08)",
  border: "#E2E8F0", borderStrong: "#CBD5E1",
};

export default function EmployeeDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [officials, setOfficials] = useState<any[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { router.replace("/"); return; }

    const unsubEmp = onSnapshot(doc(firestore, "employee", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setActiveCount(data.deploymentStatus === "deployed" ? 1 : 0);
        setUserData((prev: any) => ({ ...prev, ...data, idstatus: data.idstatus || prev?.idstatus || "Pending" }));
      } else {
        setActiveCount(0);
      }
    });

    const unsubHistory = onSnapshot(
      query(collection(firestore, "employee", user.uid, "deploymentHistory"), orderBy("resolvedAt", "desc")),
      (snap) => setResolvedCount(snap.docs.filter((entry) => entry.data().status === "resolved").length)
    );

    loadData();
    fetchOfficials();

    return () => { unsubEmp(); unsubHistory(); };
  }, []);

  useEffect(() => { setTotalComplaints(resolvedCount + activeCount); }, [resolvedCount, activeCount]);

  const loadData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { router.replace("/"); return; }
      const userSnap = await getDoc(doc(firestore, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (!data.isEmployee) {
          Alert.alert("Access Denied", "This page is only for employees.");
          router.replace("/(tabs)/home");
          return;
        }
        setUserData((prev: any) => ({ ...data, ...prev }));
      }
      const employeeSnap = await getDoc(doc(firestore, "employee", user.uid));
      if (employeeSnap.exists()) {
        const data = employeeSnap.data();
        setUserData((prev: any) => ({ ...prev, ...data, idstatus: data.idstatus || prev?.idstatus || "Pending" }));
      }
    } catch (error) { console.error(error); Alert.alert("Error", "Failed to load employee data"); }
    finally { setLoading(false); }
  };

  const fetchOfficials = async () => {
    try {
      const snap = await getDocs(collection(firestore, "officials"));
      const list = snap.docs.map((entry) => ({ name: entry.data().name || "", position: entry.data().position || "", picture: entry.data().picture || "" }));
      const rank = (pos: string) => {
        const l = pos.toLowerCase();
        if (l.includes("captain") || l.includes("punong")) return 0;
        if (l.includes("secretary")) return 1;
        if (l.includes("treasurer")) return 2;
        if (l.includes("kagawad")) return 3;
        if (l.includes("sk")) return 4;
        return 5;
      };
      list.sort((a, b) => rank(a.position) - rank(b.position));
      setOfficials(list);
    } catch (error) { console.error(error); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await fetchOfficials();
    setRefreshing(false);
  };

  const idInfo = useCallback(() => {
    const status = (userData?.idstatus || "").toLowerCase();
    if (status === "verified" || status === "approved") return { text: "Verified", color: C.success, bg: C.successDim, icon: "shield-checkmark" as const };
    if (status === "denied") return { text: "Denied", color: C.red, bg: "rgba(220,38,38,0.08)", icon: "close-circle" as const };
    return { text: "Pending", color: C.gold, bg: C.goldDim, icon: "time" as const };
  }, [userData?.idstatus]);

  const firstName = userData?.firstName ?? "Officer";
  const fullName = `${userData?.firstName ?? ""} ${userData?.middleName ? `${userData.middleName} ` : ""}${userData?.lastName ?? ""}`.trim() || "Not provided";
  const shift = userData?.shift ? `${userData.shift.charAt(0).toUpperCase()}${userData.shift.slice(1)}` : "None";
  const isDeployed = (userData?.deploymentStatus || "") === "deployed";
  const statusMeta = idInfo();

  if (loading) return (
    <SafeAreaView style={st.safe}><StatusBar barStyle="dark-content" /><View style={st.center}><ActivityIndicator size="large" color={C.gold} /></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {/* Header exactly matching reports.tsx */}
      <View style={[st.header, { paddingTop: insets.top + 14 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={st.eyebrow}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
            <Text style={st.title}>Hello, {firstName}.</Text>
            <Text style={st.subtitle}>Employee Dashboard</Text>
          </View>
          {userData?.avatar ? (
            <Image source={{ uri: userData.avatar }} style={st.avatar} />
          ) : (
            <View style={st.avatarPlaceholder}><Text style={st.avatarText}>{firstName.charAt(0)}</Text></View>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}>
        
        {/* Status Box */}
        <View style={st.section}>
          <Text style={st.secEye}>DUTY STATUS</Text>
          <View style={[st.card, isDeployed ? { borderColor: C.blueMid, backgroundColor: C.surface } : {}]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <View style={[st.badge, { backgroundColor: isDeployed ? C.blueLight : C.surfaceAlt, borderColor: isDeployed ? "rgba(37,99,235,0.2)" : C.border }]}>
                <View style={[st.dot, { backgroundColor: isDeployed ? C.blueMid : C.textDim }]} />
                <Text style={[st.badgeText, { color: isDeployed ? C.blueMid : C.textMuted }]}>{isDeployed ? "ON DUTY" : "STANDBY"}</Text>
              </View>
            </View>
            <Text style={st.statusDesc}>{isDeployed ? "You have an active deployment. Stay safe." : "Awaiting your next assignment."}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <View style={st.pill}><Ionicons name="time-outline" size={12} color={C.textMuted} /><Text style={st.pillText}>{shift} Shift</Text></View>
              <View style={[st.pill, { backgroundColor: statusMeta.bg, borderColor: statusMeta.bg }]}><Ionicons name={statusMeta.icon} size={12} color={statusMeta.color} /><Text style={[st.pillText, { color: statusMeta.color }]}>ID {statusMeta.text}</Text></View>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={st.section}>
          <Text style={st.secEye}>ACTIVITY SUMMARY</Text>
          <View style={st.statsRow}>
            <View style={st.statBox}>
              <View style={[st.statIcon, { backgroundColor: C.blueLight }]}><Ionicons name="layers" size={18} color={C.blueMid} /></View>
              <Text style={st.statValue}>{totalComplaints}</Text>
              <Text style={st.statLabel}>TOTAL CASES</Text>
            </View>
            <View style={st.statBox}>
              <View style={[st.statIcon, { backgroundColor: C.successDim }]}><Ionicons name="checkmark-done" size={18} color={C.success} /></View>
              <Text style={st.statValue}>{resolvedCount}</Text>
              <Text style={st.statLabel}>RESOLVED</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={st.section}>
          <Text style={st.secEye}>QUICK ACTIONS</Text>
          <View style={st.card}>
            <Pressable style={st.actionRow} onPress={() => router.push("/employee/manage-requests")}>
              <View style={[st.actionIcon, { backgroundColor: C.blueLight }]}><Ionicons name="shield-half" size={16} color={C.blueMid} /></View>
              <View style={{ flex: 1 }}><Text style={st.actionTitle}>Manage Deployments</Text><Text style={st.actionSub}>View active assignments</Text></View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </Pressable>
            <View style={st.divider} />
            <Pressable style={st.actionRow} onPress={() => router.push("/employee/reports")}>
              <View style={[st.actionIcon, { backgroundColor: C.successDim }]}><Ionicons name="pie-chart" size={16} color={C.success} /></View>
              <View style={{ flex: 1 }}><Text style={st.actionTitle}>Reports Hub</Text><Text style={st.actionSub}>Analytics and records</Text></View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </Pressable>
            <View style={st.divider} />
            <Pressable style={st.actionRow} onPress={() => router.push("/employee/profile")}>
              <View style={[st.actionIcon, { backgroundColor: C.goldDim }]}><Ionicons name="person-circle" size={16} color={C.gold} /></View>
              <View style={{ flex: 1 }}><Text style={st.actionTitle}>Officer Profile</Text><Text style={st.actionSub}>Account settings</Text></View>
              <Ionicons name="chevron-forward" size={16} color={C.textDim} />
            </Pressable>
          </View>
        </View>

        {/* Personnel Record */}
        <View style={st.section}>
          <Text style={st.secEye}>IDENTITY</Text>
          <View style={st.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={st.recordTitle}>Barangay Tanod</Text>
              <View style={[st.pill, { backgroundColor: statusMeta.bg, borderColor: statusMeta.bg, borderWidth: 0 }]}><Ionicons name={statusMeta.icon} size={10} color={statusMeta.color} /><Text style={[st.pillText, { color: statusMeta.color, fontSize: 9 }]}>{statusMeta.text}</Text></View>
            </View>
            <View style={st.divider} />
            <View style={st.recordRow}><View style={st.recordLeft}><Ionicons name="person" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Name</Text></View><Text style={st.recordValue}>{fullName}</Text></View>
            <View style={st.recordRow}><View style={st.recordLeft}><Ionicons name="mail" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Email</Text></View><Text style={st.recordValue}>{userData?.email || "--"}</Text></View>
            <View style={st.recordRow}><View style={st.recordLeft}><Ionicons name="call" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Contact</Text></View><Text style={st.recordValue}>{userData?.number || "--"}</Text></View>
            <View style={st.recordRow}><View style={st.recordLeft}><Ionicons name="location" size={14} color={C.textMuted} /><Text style={st.recordLabel}>Address</Text></View><Text style={st.recordValue}>{userData?.purok ? `Purok ${userData.purok}, ` : ""}{userData?.address || "--"}</Text></View>
          </View>
        </View>

        {/* Officials */}
        {officials.length > 0 && (
          <View style={st.section}>
            <Text style={st.secEye}>LEADERSHIP</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 18, gap: 12, paddingBottom: 10 }}>
              {officials.map((o, i) => {
                const isCap = o.position.toLowerCase().includes("captain") || o.position.toLowerCase().includes("punong");
                return (
                  <View key={i} style={[st.officialCard, isCap && st.officialCardCap]}>
                    {o.picture ? <Image source={{ uri: o.picture }} style={st.offAv} /> : <View style={st.offAvEmpty}><Ionicons name="person" size={20} color={C.textDim} /></View>}
                    <Text style={st.offRole} numberOfLines={1}>{o.position}</Text>
                    <Text style={st.offName} numberOfLines={2}>{o.name}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>
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
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.border },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.elevated, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border },
  avatarText: { fontSize: 16, fontWeight: "800", color: C.text },

  section: { paddingHorizontal: 18, marginTop: 24 },
  secEye: { color: C.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 },
  
  card: { backgroundColor: C.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  badge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  statusDesc: { fontSize: 16, fontWeight: "700", color: C.text, marginTop: 14, lineHeight: 22 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border },
  pillText: { fontSize: 11, fontWeight: "800", color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },

  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: "900", color: C.text },
  statLabel: { fontSize: 9, color: C.textMuted, marginTop: 4, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontWeight: "800", color: C.text, marginBottom: 2 },
  actionSub: { fontSize: 12, color: C.textMuted, fontWeight: "600" },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 50, marginVertical: 4 },

  recordTitle: { fontSize: 15, fontWeight: "900", color: C.text },
  recordRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  recordLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  recordLabel: { fontSize: 13, fontWeight: "700", color: C.textMuted },
  recordValue: { fontSize: 13, fontWeight: "800", color: C.text, flex: 1, textAlign: "right", marginLeft: 20 },

  officialCard: { width: 120, backgroundColor: C.surface, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  officialCardCap: { borderColor: C.goldBorder, backgroundColor: C.surface },
  offAv: { width: 48, height: 48, borderRadius: 24, marginBottom: 10 },
  offAvEmpty: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center", marginBottom: 10, borderWidth: 1, borderColor: C.border },
  offRole: { fontSize: 9, fontWeight: "900", color: C.gold, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, textAlign: "center" },
  offName: { fontSize: 12, fontWeight: "800", color: C.text, textAlign: "center", lineHeight: 16 },
});
