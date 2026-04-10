import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

// ─── Design Tokens ───
const COLORS = {
  brand: "#4a90e2",
  brandDark: "#3a7bc8",
  brandLight: "#e3f2fd",
  brandMuted: "rgba(74,144,226,0.10)",
  surface: "#FFFFFF",
  surface2: "#F7F7F5",
  border: "rgba(0,0,0,0.08)",
  text: "#1A1A1A",
  textMuted: "#6B6B6B",
  success: "#34C759",
  danger: "#FF3B30",
  warning: "#F59E0B",
};

// ─── Pressable Card with Animation + Haptics ───
function PressCard({ children, style, onPress, containerStyle }: { children: React.ReactNode; style?: any; onPress?: () => void; containerStyle?: any }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.955, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Stat Tile Component (V3 Stat Grid) ───
function StatTile({ icon, value, label, color, accent, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressCard style={[styles.statTile, accent && styles.statTileAccent]} onPress={onPress} containerStyle={{ flex: 1 }}>
      <View style={[styles.statIconWrap, { backgroundColor: accent ? "rgba(255,255,255,0.25)" : `${color}15` }]}>
        <Ionicons name={icon} size={18} color={accent ? "#fff" : color} />
      </View>
      <Text style={[styles.statValue, accent && { color: "#fff" }]}>{value}</Text>
      <Text style={[styles.statLabel2, accent && { color: "rgba(255,255,255,0.8)" }]}>{label}</Text>
    </PressCard>
  );
}

// ─── Action Row Component (V2 List Row) ───
function ActionRow({ icon, iconBg, title, subtitle, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <PressCard style={styles.actionRow} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={COLORS.brand} />
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionRowTitle}>{title}</Text>
        <Text style={styles.actionRowSub}>{subtitle}</Text>
      </View>
      <View style={styles.actionArrow}>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </View>
    </PressCard>
  );
}

export default function EmployeeDashboard() {
  const route = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalComplaints, setTotalComplaints] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [officials, setOfficials] = useState<{ name: string; position: string; picture: string }[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      route.replace("/");
      return;
    }

    // Real-time listener on employee doc for ID status + deployment status
    const empRef = doc(firestore, "employee", user.uid);
    const unsubEmp = onSnapshot(empRef, (snapshot) => {
      if (snapshot.exists()) {
        const empData = snapshot.data();
        setActiveCount(empData.deploymentStatus === "deployed" ? 1 : 0);
        setUserData((prev: any) => ({
          ...prev,
          ...empData,
          idstatus: empData.idstatus || prev?.idstatus || "Pending",
        }));
      } else {
        setActiveCount(0);
      }
    });

    // Listen to deployment history for resolved count
    const historyRef = collection(firestore, "employee", user.uid, "deploymentHistory");
    const historyQuery = query(historyRef, orderBy("resolvedAt", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const resolved = snapshot.docs.filter((d) => d.data().status === "resolved").length;
      setResolvedCount(resolved);
    });

    // Initial load from users collection
    loadEmployeeData();
    fetchOfficials();

    return () => {
      unsubEmp();
      unsubHistory();
    };
  }, []);

  // Keep total in sync
  useEffect(() => {
    setTotalComplaints(resolvedCount + activeCount);
  }, [resolvedCount, activeCount]);

  const loadEmployeeData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        route.replace("/");
        return;
      }

      // Load from users collection first
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (!data.isEmployee) {
          Alert.alert("Access Denied", "This page is only for employees.");
          route.replace("/(tabs)/home");
          return;
        }
        setUserData((prev: any) => ({ ...data, ...prev }));
      }

      // Also load from employee collection for more details (idstatus lives here)
      const empDoc = await getDoc(doc(firestore, "employee", user.uid));
      if (empDoc.exists()) {
        const empData = empDoc.data();
        setUserData((prev: any) => ({
          ...prev,
          ...empData,
          idstatus: empData.idstatus || prev?.idstatus || "Pending",
        }));
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
      Alert.alert("Error", "Failed to load employee data");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEmployeeData();
    await fetchOfficials();
    setRefreshing(false);
  };

  const getPositionRank = (position: string) => {
    const p = position.toLowerCase();
    if (p.includes("captain") || p.includes("punong")) return 0;
    if (p.includes("secretary")) return 1;
    if (p.includes("treasurer")) return 2;
    if (p.includes("kagawad")) return 3;
    if (p.includes("sk")) return 4;
    return 5;
  };

  const fetchOfficials = async () => {
    try {
      const snapshot = await getDocs(collection(firestore, "officials"));
      const list = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          name: data.name || "",
          position: data.position || "",
          picture: data.picture || "",
        };
      });
      list.sort((a, b) => getPositionRank(a.position) - getPositionRank(b.position));
      setOfficials(list);
    } catch (error) {
      console.error("Error fetching officials:", error);
    }
  };

  const getIdStatusInfo = useCallback(() => {
    const status = (userData?.idstatus || "").toLowerCase();
    if (status === "verified" || status === "approved") return { text: "Verified", icon: "✅", color: COLORS.success };
    if (status === "denied") return { text: "Denied", icon: "❌", color: COLORS.danger };
    return { text: "Pending", icon: "⏳", color: COLORS.warning };
  }, [userData?.idstatus]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  const idInfo = getIdStatusInfo();

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.brand]} tintColor={COLORS.brand} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Header with Gradient ─── */}
          <LinearGradient
            colors={["#4a90e2", "#3a7bc8", "#2d6cb5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 24 }]}
          >
            <View style={styles.profileSection}>
              {userData?.avatar ? (
                <Image source={{ uri: userData.avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userData?.firstName?.charAt(0)?.toUpperCase() || "E"}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.greeting}>Welcome back!</Text>
                <Text style={styles.name}>
                  {userData?.firstName} {userData?.lastName}
                </Text>
                <View style={styles.roleBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#fff" />
                  <Text style={styles.roleText}>Employee</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* ─── Stat Grid (V3 Style) ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Overview</Text>
            <View style={styles.statsGrid}>
              <StatTile
                icon="layers"
                value={totalComplaints}
                label="Total"
                color={COLORS.brand}
                accent
                onPress={() => route.push("/employee/manage-requests")}
              />
              <StatTile
                icon="checkmark-done"
                value={resolvedCount}
                label="Resolved"
                color={COLORS.success}
                onPress={() => route.push("/employee/manage-requests")}
              />
              <StatTile
                icon="pulse"
                value={activeCount}
                label="Active"
                color={COLORS.warning}
                onPress={() => route.push("/employee/manage-requests")}
              />
            </View>
          </View>

          {/* ─── Quick Actions (V2 List Row Style) ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsContainer}>
              <ActionRow
                icon="list"
                iconBg={COLORS.brandMuted}
                title="Manage Requests"
                subtitle="View complaints & deployments"
                onPress={() => route.push("/employee/manage-requests")}
              />
              <View style={styles.actionSeparator} />
              <ActionRow
                icon="bar-chart"
                iconBg={COLORS.brandMuted}
                title="Reports & Analytics"
                subtitle="Charts, trends & insights"
                onPress={() => route.push("/employee/reports")}
              />
              <View style={styles.actionSeparator} />
              <ActionRow
                icon="person"
                iconBg={COLORS.brandMuted}
                title="My Profile"
                subtitle="View & edit your profile"
                onPress={() => route.push("/employee/profile")}
              />
            </View>
          </View>

          {/* ─── Your Information (V4 Accent Border Card) ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoAccentBorder} />
              <View style={styles.infoContent}>
                <InfoRow icon="person" label="Name" value={`${userData?.firstName || ""} ${userData?.middleName ? userData.middleName + " " : ""}${userData?.lastName || ""}`} />
                <InfoRow icon="mail" label="Email" value={userData?.email || "Not provided"} />
                <InfoRow icon="call" label="Contact" value={userData?.number || "Not provided"} />
                <InfoRow icon="location" label="Address" value={`${userData?.purok ? `Purok ${userData.purok}, ` : ""}${userData?.address || "Not provided"}`} />
                <View style={styles.infoRowContainer}>
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIcon, { backgroundColor: `${idInfo.color}15` }]}>
                      <Ionicons name="shield-checkmark" size={16} color={idInfo.color} />
                    </View>
                    <Text style={styles.infoLabel}>ID Status</Text>
                  </View>
                  <View style={[styles.idBadge, { backgroundColor: `${idInfo.color}18` }]}>
                    <View style={[styles.idDot, { backgroundColor: idInfo.color }]} />
                    <Text style={[styles.idBadgeText, { color: idInfo.color }]}>{idInfo.text}</Text>
                  </View>
                </View>
                <View style={styles.infoRowContainer}>
                  <View style={styles.infoRowLeft}>
                    <View style={[styles.infoIcon, { backgroundColor: `${COLORS.success}15` }]}>
                      <Ionicons name="radio-button-on" size={16} color={COLORS.success} />
                    </View>
                    <Text style={styles.infoLabel}>Status</Text>
                  </View>
                  <View style={[styles.idBadge, { backgroundColor: `${COLORS.success}18` }]}>
                    <View style={[styles.idDot, { backgroundColor: COLORS.success }]} />
                    <Text style={[styles.idBadgeText, { color: COLORS.success }]}>Active</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Barangay Officials Section */}
          {officials.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Barangay Officials</Text>
              <View style={styles.officialsCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {officials.map((official, index) => (
                    <View key={index} style={styles.officialItem}>
                      {official.picture ? (
                        <Image source={{ uri: official.picture }} style={styles.officialAvatar} />
                      ) : (
                        <View style={[styles.officialAvatar, styles.officialAvatarPlaceholder]}>
                          <Ionicons name="person" size={28} color={COLORS.textMuted} />
                        </View>
                      )}
                      <Text style={styles.officialPosition} numberOfLines={2}>{official.position}</Text>
                      <Text style={styles.officialName} numberOfLines={2}>{official.name}</Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.thanksContainer}>
                  <Ionicons name="heart" size={14} color={COLORS.brand} />
                  <Text style={styles.thanksText}>
                    Thank you to the Barangay Officials of San Roque for supporting this project
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Info Row Sub-component ───
function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRowContainer}>
      <View style={styles.infoRowLeft}>
        <View style={[styles.infoIcon, { backgroundColor: COLORS.brandMuted }]}>
          <Ionicons name={icon} size={16} color={COLORS.brand} />
        </View>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surface2,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.surface2,
  },
  content: {
    paddingBottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.surface2,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  profileInfo: {
    flex: 1,
  },
  greeting: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "500",
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    gap: 4,
  },
  roleText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  // ─── Sections ───
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: -0.2,
  },

  // ─── Stat Grid (V3) ───
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
    minWidth: 0,
  },
  statTileAccent: {
    backgroundColor: COLORS.brand,
    borderColor: "transparent",
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  statLabel2: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },

  // ─── Actions Container (V2 List Row) ───
  actionsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  actionContent: {
    flex: 1,
  },
  actionRowTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  actionRowSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  actionArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface2,
    justifyContent: "center",
    alignItems: "center",
  },
  actionSeparator: {
    height: 0.5,
    backgroundColor: COLORS.border,
    marginLeft: 72,
  },

  // ─── Info Card (V4 accent border) ───
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  infoAccentBorder: {
    width: 3,
    backgroundColor: COLORS.brand,
  },
  infoContent: {
    flex: 1,
    padding: 14,
    gap: 14,
  },
  infoRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    maxWidth: "50%",
    textAlign: "right",
  },
  idBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  idDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  idBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },

  spacer: {
    height: 20,
  },
  officialsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  officialItem: {
    alignItems: "center",
    width: 110,
    marginHorizontal: 4,
    paddingVertical: 8,
  },
  officialAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: COLORS.brand,
  },
  officialAvatarPlaceholder: {
    backgroundColor: COLORS.surface2,
    justifyContent: "center",
    alignItems: "center",
  },
  officialPosition: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.brand,
    textAlign: "center",
    lineHeight: 13,
    marginBottom: 2,
  },
  officialName: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 15,
  },
  thanksContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
    gap: 6,
  },
  thanksText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    fontStyle: "italic",
    flex: 1,
  },
});
