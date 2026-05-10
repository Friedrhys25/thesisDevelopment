import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

const COLORS = {
  bg: "#080f26",
  surface: "#0f1e45",
  surfaceAlt: "#0d1a3c",
  elevated: "#162254",

  text: "#E8EEFF",
  textMuted: "#8895BB",
  textDim: "#4A5880",

  gold: "#f59e0b",
  goldLight: "#fbbf24",
  goldDim: "rgba(245,158,11,0.15)",
  goldBorder: "rgba(245,158,11,0.3)",

  blue: "#1447c0",
  blueMid: "#1E56D8",
  blueLight: "rgba(20,71,192,0.3)",
  red: "#ce1126",
  redLight: "rgba(206,17,38,0.22)",
  success: "#10b981",

  border: "rgba(255,255,255,0.06)",
  borderGold: "rgba(245,158,11,0.2)",
};

interface Service {
  id: number;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  description?: string;
}

type Official = {
  name: string;
  position: string;
  picture: string;
};

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function SkeletonCard({ width }: { width: "48%" | "100%" }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.68, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <Animated.View style={[styles.serviceCard, { width, opacity: pulse }]}>
      <View style={styles.serviceCardHeader}>
        <View style={[styles.serviceIconWrap, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]} />
        <View style={styles.skeletonArrow} />
      </View>
      <View style={styles.serviceCardBody}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonLineShort} />
      </View>
    </Animated.View>
  );
}

export default function HomePage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [officials, setOfficials] = useState<Official[]>([]);

  const getPositionRank = (position: string) => {
    const p = position.toLowerCase();
    if (p.includes("kapitan") || p.includes("punong")) return 0;
    if (p.includes("kagawad")) return 1;
    if (p.includes("secretary")) return 2;
    if (p.includes("treasurer")) return 3;
    if (p.includes("sk")) return 4;
    return 5;
  };

  const fetchUserName = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      const userDocRef = doc(firestore, "users", uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists() && snapshot.data().firstName) {
        setUserName(snapshot.data().firstName);
      } else {
        setUserName("User");
      }
    } catch (error) {
      console.error("Error fetching user name:", error);
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    fetchUserName();
    fetchOfficials();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserName();
    await fetchOfficials();
    setRefreshing(false);
  };

  const services: Service[] = useMemo(
    () => [
      {
        id: 1,
        name: "Complaints",
        icon: "alert-circle",
        color: COLORS.gold,
        route: "/complain",
        description: "Report issues around the barangay and track updates.",
      },
      {
        id: 2,
        name: "Emergency",
        icon: "medical",
        color: COLORS.red,
        route: "/emergency",
        description: "Access urgent numbers and fast-response options.",
      },
      {
        id: 4,
        name: "Profile",
        icon: "person",
        color: COLORS.blueMid,
        route: "/profile",
        description: "Review your account details and personal information.",
      },
      {
        id: 5,
        name: "FAQs",
        icon: "help-circle",
        color: COLORS.success,
        route: "/FAQS",
        description: "Read quick answers to common barangay service questions.",
      },
    ],
    []
  );

  const handleServiceClick = (id: number) => {
    const route = services.find((service) => service.id === id)?.route;
    if (route) {
      router.push(route as any);
    } else {
      console.warn("No route found for this service");
    }
  };

  const cardWidth = width >= 380 ? "48%" : "100%";
  const quickStats = {
    services: services.length,
    officials: officials.length,
    support: "24/7",
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={["#07122f", "#0b1a3d", "#11306b"]}
        locations={[0, 0.55, 1]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRing} />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerEyebrow}>BARANGAY SAN ROQUE</Text>
            <Text style={styles.headerTitle}>
              {loading ? "Loading Home" : `Hello, ${userName ?? "User"}`}
            </Text>
            <Text style={styles.headerSubtitle}>
              Access barangay services, updates, and emergency support from one place.
            </Text>
          </View>
          <View style={styles.headerLogoWrap}>
            <Image
              source={require("../../assets/images/sanroquelogoo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.statsStrip}>
          <StatPill icon="apps-outline" label="Services" value={quickStats.services} color={COLORS.gold} />
          <View style={styles.statDivider} />
          <StatPill icon="people-outline" label="Officials" value={quickStats.officials} color={COLORS.blueMid} />
          <View style={styles.statDivider} />
          <StatPill icon="time-outline" label="Support" value={quickStats.support} color={COLORS.success} />
        </View>

        <View style={[styles.headerAccentLine, { backgroundColor: COLORS.gold }]} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
      >
        <View style={styles.noticeBox}>
          <View style={styles.noticeIconWrap}>
            <Ionicons name="sparkles-outline" size={18} color={COLORS.gold} />
          </View>
          <Text style={styles.noticeText}>
            Start with a service card below, check barangay leadership updates, or head to Emergency for urgent assistance.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>SERVICES</Text>
          <Text style={styles.sectionTitle}>What would you like to do?</Text>
        </View>

        {loading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map((id) => (
              <SkeletonCard key={id} width={cardWidth} />
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {services.map((service) => {
              const isActive = activeCard === service.id;

              return (
                <Pressable
                  key={service.id}
                  onPressIn={() => setActiveCard(service.id)}
                  onPressOut={() => setActiveCard(null)}
                  onPress={() => handleServiceClick(service.id)}
                  style={[
                    styles.serviceCard,
                    { width: cardWidth },
                    isActive && {
                      borderColor: service.color,
                      backgroundColor: `${service.color}14`,
                      transform: [{ scale: 0.98 }],
                    },
                  ]}
                >
                  <View style={styles.serviceCardHeader}>
                    <View
                      style={[
                        styles.serviceIconWrap,
                        {
                          backgroundColor: `${service.color}20`,
                          borderColor: `${service.color}40`,
                        },
                      ]}
                    >
                      <Ionicons name={service.icon} size={25} color={service.color} />
                    </View>
                    <Ionicons name="arrow-forward" size={18} color={COLORS.textDim} />
                  </View>
                  <View style={styles.serviceCardBody}>
                    <Text style={styles.serviceTitle}>{service.name}</Text>
                    {service.description ? (
                      <Text style={styles.serviceDescription}>{service.description}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>DISCOVER</Text>
          <Text style={styles.sectionTitle}>Platform Highlight</Text>
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <Text style={styles.reminderTitle}>Did you know?</Text>
            <View style={styles.reminderBadge}>
              <Ionicons name="flash-outline" size={13} color={COLORS.gold} />
              <Text style={styles.reminderBadgeText}>TIP</Text>
            </View>
          </View>
          <View style={styles.reminderDivider} />
          <Text style={styles.reminderText}>
            You can submit a complaint, revisit your account, and check emergency contacts without leaving the same service hub.
          </Text>
        </View>

        {officials.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEyebrow}>LEADERSHIP</Text>
              <Text style={styles.sectionTitle}>Barangay Officials</Text>
            </View>

            <View style={styles.officialsCard}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.officialsRow}
              >
                {officials.map((official, index) => (
                  <View key={`${official.name}-${index}`} style={styles.officialCard}>
                    {official.picture ? (
                      <Image source={{ uri: official.picture }} style={styles.officialAvatar} />
                    ) : (
                      <View style={[styles.officialAvatar, styles.officialAvatarPlaceholder]}>
                        <Ionicons name="person" size={28} color={COLORS.textDim} />
                      </View>
                    )}
                    <Text style={styles.officialPosition} numberOfLines={2}>
                      {official.position}
                    </Text>
                    <Text style={styles.officialName} numberOfLines={2}>
                      {official.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.thanksContainer}>
                <Ionicons name="heart" size={15} color={COLORS.gold} />
                <Text style={styles.thanksText}>
                  Thank you to the officials of Barangay San Roque for supporting this platform.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  header: { paddingHorizontal: 22, paddingBottom: 20, overflow: "hidden" },
  headerRing: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.08)",
    top: -80,
    right: -60,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    gap: 16,
  },
  headerEyebrow: {
    color: "rgba(245,158,11,0.7)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 20,
    maxWidth: 260,
  },
  headerLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  headerLogo: {
    width: 42,
    height: 42,
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statPill: { flex: 1, alignItems: "center" },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 4,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    alignSelf: "stretch",
    marginHorizontal: 8,
  },
  headerAccentLine: { height: 1, opacity: 0.3, marginTop: 16 },

  scroll: { paddingHorizontal: 18, paddingTop: 18 },

  noticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: COLORS.goldDim,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.18)",
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  noticeText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },

  sectionHeader: { marginBottom: 14, marginTop: 6 },
  sectionEyebrow: {
    color: COLORS.textDim,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 4,
    minHeight: 170,
  },
  serviceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  serviceIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  serviceCardBody: {
    marginTop: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  serviceTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },
  serviceDescription: {
    color: COLORS.textMuted,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 19,
  },

  skeletonArrow: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.elevated,
  },
  skeletonTitle: {
    width: "72%",
    height: 18,
    borderRadius: 4,
    backgroundColor: COLORS.elevated,
    marginBottom: 8,
  },
  skeletonLineShort: {
    width: "88%",
    height: 13,
    borderRadius: 4,
    backgroundColor: COLORS.elevated,
  },

  reminderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 18,
    marginTop: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reminderTitle: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  reminderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.goldDim,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  reminderBadgeText: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  reminderDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  reminderText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },

  officialsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  officialsRow: {
    paddingHorizontal: 2,
    gap: 8,
  },
  officialCard: {
    alignItems: "center",
    width: 116,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  officialAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.goldBorder,
  },
  officialAvatarPlaceholder: {
    backgroundColor: COLORS.elevated,
    justifyContent: "center",
    alignItems: "center",
  },
  officialPosition: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.gold,
    textAlign: "center",
    lineHeight: 14,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  officialName: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 17,
  },
  thanksContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 6,
    paddingHorizontal: 10,
  },
  thanksText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    flex: 1,
    lineHeight: 18,
  },
});
