import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Image,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
};

interface Service {
  id: number;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  description?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    fetchUserName();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserName();
    setRefreshing(false);
  };

  const services: Service[] = useMemo(
    () => [
      {
        id: 1,
        name: "Complaints",
        icon: "alert-circle",
        color: COLORS.primary,
        route: "/complain",
        description: "Report issues in the barangay",
      },
      {
        id: 2,
        name: "Emergency",
        icon: "medical",
        color: COLORS.danger, // Keep emergency distinct for quick recognition
        route: "/emergency",
        description: "Get urgent help fast",
      },
      {
        id: 4,
        name: "Profile",
        icon: "person",
        color: COLORS.primary,
        route: "/profile",
        description: "View your account details",
      },
      {
        id: 5,
        name: "FAQS",
        icon: "help-circle",
        color: COLORS.primary,
        route: "/FAQS",
        description: "Find quick answers",
      },
    ],
    []
  );

  const handleServiceClick = (id: number) => {
    const route = services.find((s) => s.id === id)?.route;
    if (route) router.push(route as any);
    else console.warn("No route found for this service");
  };

  const parallaxTranslate = scrollY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [-50, 0, 120],
    extrapolate: "clamp",
  });

  const cardWidth = width >= 380 ? "48%" : "100%";
  const headerTitleSize = width >= 380 ? 24 : 20;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[styles.parallaxContainer, { paddingTop: insets.top }]}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.primaryDark }]} />
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Barangay Services</Text>
            </View>
            <Skeleton style={{ width: 180, height: 28, borderRadius: 6, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.4)" }} />
            <Skeleton style={{ width: 250, height: 16, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" }} />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        >
          <View style={styles.content}>
            <Skeleton style={{ width: 200, height: 20, borderRadius: 4, marginBottom: 8 }} />
            <Skeleton style={{ width: 220, height: 14, borderRadius: 4, marginBottom: 16 }} />
            <View style={styles.grid}>
              {[1, 2, 3, 4, 5].map((idx) => (
                <View key={idx} style={[styles.card, { width: cardWidth }]}>
                  <View style={styles.cardHeader}>
                    <Skeleton style={styles.iconBox} />
                    <Skeleton style={{ width: 20, height: 20, borderRadius: 10 }} />
                  </View>
                  <View style={styles.cardBody}>
                    <Skeleton style={{ width: "80%", height: 18, borderRadius: 4, marginBottom: 6 }} />
                    <Skeleton style={{ width: "60%", height: 12, borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== "web" }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={[styles.parallaxContainer, { paddingTop: insets.top }]}>
          <Animated.View
            style={[
              styles.parallaxBackground,
              { transform: [{ translateY: parallaxTranslate }] },
            ]}
          >
            <Image
              source={require("../../assets/images/sanroquelogoo.png")}
              style={styles.parallaxLogo}
              resizeMode="contain"
            />
          </Animated.View>
          <View style={styles.overlay} />
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Barangay Services</Text>
            </View>
            <Text style={[styles.headerText, { fontSize: headerTitleSize }]}>
              Hello, {userName}
            </Text>
            <Text style={styles.subtitle}>
              Your voice matters. Connect with us anytime!
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>What would you like?</Text>
          <Text style={styles.sectionSubtitle}>Choose a service to get started</Text>
          <View style={styles.grid}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[
                  styles.card,
                  { width: cardWidth },
                  activeCard === service.id && styles.activeCard,
                ]}
                onPressIn={() => setActiveCard(service.id)}
                onPressOut={() => setActiveCard(null)}
                onPress={() => handleServiceClick(service.id)}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: `${service.color}1A` }]}>
                    <Ionicons name={service.icon} size={26} color={service.color} />
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#D1D5DB" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.cardDesc}>{service.description}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.content, { marginTop: 20 }]}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>TIP</Text>
            <Text style={styles.featureTitle}>Did you know?</Text>
            <Text style={styles.featureText}>
              You can track the status of your complaints and receive real-time
              updates through our platform.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  parallaxContainer: {
    height: 210,
    position: "relative",
    overflow: "hidden",
    justifyContent: "flex-end",
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  parallaxBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  parallaxLogo: {
    width: 250,
    height: 250,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  headerContent: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 10 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  badgeText: { color: COLORS.text, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  headerText: { color: "#fff", fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 16, fontWeight: "600" },

  content: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  sectionSubtitle: { fontSize: 16, color: COLORS.muted, marginBottom: 16 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    justifyContent: "space-between",
    minHeight: 140,
  },
  activeCard: { transform: [{ scale: 0.96 }] },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: { marginTop: 16 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 4 },
  cardDesc: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },

  featureCard: {
    backgroundColor: "rgba(251, 228, 81, 0.15)",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  featureIcon: {
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: 2,
    color: COLORS.primary,
    fontWeight: "800",
  },
  featureTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  featureText: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
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
