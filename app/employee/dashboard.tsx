import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

const COLORS = {
  page: "#F4F7F8",
  pageAlt: "#EDF3F4",
  card: "#FFFFFF",
  cardSoft: "#F9FBFB",
  line: "#D9E3E6",
  lineStrong: "#C6D4D8",
  text: "#17323A",
  textSoft: "#5F7A82",
  textFaint: "#86A0A7",
  primary: "#2F7D6D",
  primarySoft: "#E8F4F0",
  accent: "#4C93A2",
  accentSoft: "#EAF4F6",
  warning: "#C78A2C",
  warningSoft: "#FFF5E4",
  danger: "#B85858",
  dangerSoft: "#FCEAEA",
  shadow: "rgba(16, 39, 47, 0.08)",
};

function StatCard({
  label,
  value,
  hint,
  icon,
  tint,
  tintSoft,
  onPress,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSoft: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.statCard, pressed && styles.pressed]}>
      <View style={[styles.statIconWrap, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </Pressable>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <View style={[styles.quickActionIcon, { backgroundColor: accent + "18" }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View style={styles.quickActionBody}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
    </Pressable>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowLeft}>
        <View style={styles.profileRowIcon}>
          <Ionicons name={icon} size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.profileRowLabel}>{label}</Text>
      </View>
      <Text style={styles.profileRowValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function EmployeeDashboard() {
  const router = useRouter();
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
      router.replace("/");
      return;
    }

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

    return () => {
      unsubEmp();
      unsubHistory();
    };
  }, []);

  useEffect(() => {
    setTotalComplaints(resolvedCount + activeCount);
  }, [resolvedCount, activeCount]);

  const loadData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        router.replace("/");
        return;
      }

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
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load employee data");
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficials = async () => {
    try {
      const snap = await getDocs(collection(firestore, "officials"));
      const list = snap.docs.map((entry) => {
        const value = entry.data();
        return {
          name: value.name || "",
          position: value.position || "",
          picture: value.picture || "",
        };
      });

      const rank = (position: string) => {
        const lower = position.toLowerCase();
        if (lower.includes("captain") || lower.includes("punong")) return 0;
        if (lower.includes("secretary")) return 1;
        if (lower.includes("treasurer")) return 2;
        if (lower.includes("kagawad")) return 3;
        if (lower.includes("sk")) return 4;
        return 5;
      };

      list.sort((a, b) => rank(a.position) - rank(b.position));
      setOfficials(list);
    } catch (error) {
      console.error(error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await fetchOfficials();
    setRefreshing(false);
  };

  const idInfo = useCallback(() => {
    const status = (userData?.idstatus || "").toLowerCase();
    if (status === "verified" || status === "approved") {
      return { text: "Verified", color: COLORS.primary, bg: COLORS.primarySoft, icon: "checkmark-circle" as const };
    }
    if (status === "denied") {
      return { text: "Denied", color: COLORS.danger, bg: COLORS.dangerSoft, icon: "close-circle" as const };
    }
    return { text: "Pending", color: COLORS.warning, bg: COLORS.warningSoft, icon: "time" as const };
  }, [userData?.idstatus]);

  const firstName = userData?.firstName ?? "Officer";
  const fullName = `${userData?.firstName ?? ""} ${userData?.middleName ? `${userData.middleName} ` : ""}${userData?.lastName ?? ""}`.trim() || "Not provided";
  const shift = userData?.shift ? `${userData.shift.charAt(0).toUpperCase()}${userData.shift.slice(1)} shift` : "Shift not assigned";
  const isDeployed = (userData?.deploymentStatus || "") === "deployed";
  const statusMeta = idInfo();

  const summaryMessage = useMemo(() => {
    if (isDeployed) return "You are currently assigned to an active complaint.";
    if (resolvedCount > 0) return "No active deployment right now. Recent resolved work is listed in your records.";
    return "No active deployment yet. New assignments will appear here.";
  }, [isDeployed, resolvedCount]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingHeadline}>Loading dashboard</Text>
        <Text style={styles.loadingSubhead}>Preparing your employee view.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        <LinearGradient
          colors={["#FFFFFF", "#F4F8F8", "#EEF5F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
              <Text style={styles.heroBadgeText}>Employee Dashboard</Text>
            </View>
            {userData?.avatar ? (
              <Image source={{ uri: userData.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{firstName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroGreeting}>Good day, {firstName}</Text>
          <Text style={styles.heroSummary}>{summaryMessage}</Text>

          <View style={styles.heroStatusRow}>
            <View style={[styles.heroChip, { backgroundColor: isDeployed ? COLORS.primarySoft : COLORS.warningSoft }]}>
              <Ionicons name={isDeployed ? "walk" : "pause-circle"} size={15} color={isDeployed ? COLORS.primary : COLORS.warning} />
              <Text style={[styles.heroChipText, { color: isDeployed ? COLORS.primary : COLORS.warning }]}>
                {isDeployed ? "On duty" : "Standby"}
              </Text>
            </View>
            <View style={[styles.heroChip, { backgroundColor: COLORS.accentSoft }]}>
              <Ionicons name="time-outline" size={15} color={COLORS.accent} />
              <Text style={[styles.heroChipText, { color: COLORS.accent }]}>{shift}</Text>
            </View>
            <View style={[styles.heroChip, { backgroundColor: statusMeta.bg }]}>
              <Ionicons name={statusMeta.icon} size={15} color={statusMeta.color} />
              <Text style={[styles.heroChipText, { color: statusMeta.color }]}>ID {statusMeta.text}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <SectionTitle eyebrow="Overview" title="Today at a glance" />
          <View style={styles.statsGrid}>
            <StatCard
              label="Total handled"
              value={totalComplaints}
              hint="Active and resolved combined"
              icon="albums-outline"
              tint={COLORS.primary}
              tintSoft={COLORS.primarySoft}
              onPress={() => router.push("/employee/manage-requests")}
            />
            <StatCard
              label="Resolved"
              value={resolvedCount}
              hint="Finished deployments"
              icon="checkmark-done-outline"
              tint={COLORS.accent}
              tintSoft={COLORS.accentSoft}
              onPress={() => router.push("/employee/manage-requests")}
            />
            <StatCard
              label="Active now"
              value={activeCount}
              hint={isDeployed ? "You have an ongoing assignment" : "No current assignment"}
              icon="pulse-outline"
              tint={isDeployed ? COLORS.primary : COLORS.warning}
              tintSoft={isDeployed ? COLORS.primarySoft : COLORS.warningSoft}
              onPress={() => router.push("/employee/manage-requests")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle eyebrow="Navigation" title="Quick actions" />
          <View style={styles.actionCard}>
            <QuickAction
              icon="list-outline"
              title="Manage requests"
              subtitle="Open assigned complaints and view deployment history."
              accent={COLORS.primary}
              onPress={() => router.push("/employee/manage-requests")}
            />
            <View style={styles.separator} />
            <QuickAction
              icon="bar-chart-outline"
              title="Reports and analytics"
              subtitle="Check trends, charts, and complaint insights."
              accent={COLORS.accent}
              onPress={() => router.push("/employee/reports")}
            />
            <View style={styles.separator} />
            <QuickAction
              icon="person-outline"
              title="My profile"
              subtitle="Review your account details and ID status."
              accent={COLORS.warning}
              onPress={() => router.push("/employee/profile")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle eyebrow="Profile" title="Your employee record" />
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View>
                <Text style={styles.profileHeaderTitle}>Barangay Tanod Profile</Text>
                <Text style={styles.profileHeaderSubtitle}>Keep these details accurate for assignments.</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
                <Text style={[styles.statusPillText, { color: statusMeta.color }]}>{statusMeta.text}</Text>
              </View>
            </View>

            <ProfileRow icon="person-outline" label="Full name" value={fullName} />
            <View style={styles.profileDivider} />
            <ProfileRow icon="mail-outline" label="Email" value={userData?.email ?? "Not provided"} />
            <View style={styles.profileDivider} />
            <ProfileRow icon="call-outline" label="Contact" value={userData?.number ?? "Not provided"} />
            <View style={styles.profileDivider} />
            <ProfileRow
              icon="location-outline"
              label="Address"
              value={`${userData?.purok ? `Purok ${userData.purok}, ` : ""}${userData?.address ?? "Not provided"}`}
            />
            <View style={styles.profileDivider} />
            <ProfileRow icon="time-outline" label="Assigned shift" value={shift} />
          </View>
        </View>

        {officials.length > 0 && (
          <View style={styles.section}>
            <SectionTitle eyebrow="Officials" title="Barangay leadership" />
            <View style={styles.officialsCard}>
              <Text style={styles.officialsIntro}>
                Key barangay officials listed here for quick recognition and coordination.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.officialsScrollContent}
              >
                {officials.map((official, index) => {
                  const isCaptain =
                    official.position.toLowerCase().includes("captain") ||
                    official.position.toLowerCase().includes("punong");

                  return (
                    <View key={`${official.name}-${index}`} style={styles.officialCard}>
                      {official.picture ? (
                        <Image
                          source={{ uri: official.picture }}
                          style={[styles.officialAvatar, isCaptain && styles.officialAvatarCaptain]}
                        />
                      ) : (
                        <View style={[styles.officialAvatar, styles.officialAvatarBlank, isCaptain && styles.officialAvatarCaptain]}>
                          <Ionicons name="person" size={28} color={COLORS.textFaint} />
                        </View>
                      )}
                      <Text style={styles.officialRole}>{official.position}</Text>
                      <Text style={styles.officialName}>{official.name}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </ScrollView>
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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.page,
    paddingHorizontal: 24,
  },
  loadingHeadline: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  loadingSubhead: {
    marginTop: 6,
    fontSize: 15,
    color: COLORS.textSoft,
    textAlign: "center",
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "#E3ECEE",
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
  },
  avatarFallbackText: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.primary,
  },
  heroGreeting: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
  },
  heroSummary: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSoft,
  },
  heroStatusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitleWrap: {
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: COLORS.textFaint,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  statsGrid: {
    gap: 12,
  },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5ECEE",
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  statIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSoft,
  },
  statValue: {
    fontSize: 34,
    fontWeight: "800",
    marginTop: 6,
  },
  statHint: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textFaint,
    marginTop: 6,
  },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5ECEE",
    overflow: "hidden",
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionBody: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSoft,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.line,
    marginLeft: 80,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5ECEE",
  },
  profileHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  profileHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  profileHeaderSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSoft,
    maxWidth: 230,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: "700",
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  profileRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  profileRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profileRowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textSoft,
  },
  profileRowValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    fontWeight: "600",
  },
  profileDivider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 14,
  },
  officialsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E5ECEE",
  },
  officialsIntro: {
    paddingHorizontal: 18,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSoft,
    marginBottom: 14,
  },
  officialsScrollContent: {
    paddingHorizontal: 14,
    gap: 12,
  },
  officialCard: {
    width: 138,
    backgroundColor: COLORS.cardSoft,
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  officialAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 12,
  },
  officialAvatarCaptain: {
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  officialAvatarBlank: {
    backgroundColor: COLORS.pageAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  officialRole: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "700",
    marginBottom: 4,
  },
  officialName: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
    color: COLORS.text,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.9,
  },
});
