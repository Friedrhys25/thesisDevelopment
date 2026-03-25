import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  accent: "#06B6D4",
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
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchUserName = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
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
        color: "#EF4444",
        route: "/complain",
        description: "Report issues in the barangay",
      },
      {
        id: 2,
        name: "Emergency",
        icon: "medical",
        color: "#F97316",
        route: "/emergency",
        description: "Get urgent help fast",
      },
      {
        id: 3,
        name: "Feedback",
        icon: "chatbubbles",
        color: "#06B6D4",
        route: "/feedback",
        description: "Share suggestions or ideas",
      },
      {
        id: 4,
        name: "Profile",
        icon: "person",
        color: "#6366F1",
        route: "/profile",
        description: "View your account details",
      },
      {
        id: 5,
        name: "FAQS",
        icon: "help-circle",
        color: "#10B981",
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: Platform.OS !== "web" }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={[COLORS.primary]}
          />
        }
      >
        <View style={styles.parallaxContainer}>
          <Animated.View
            style={[
              styles.parallaxBackground,
              { transform: [{ translateY: parallaxTranslate }] },
            ]}
          >
            <LinearGradient
              colors={[COLORS.primary, "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientFill}
            >
              <View style={styles.circleOne} />
              <View style={styles.circleTwo} />
            </LinearGradient>
          </Animated.View>
          <View style={styles.overlay} />
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Barangay Services</Text>
            </View>
            <Text style={[styles.headerText, { fontSize: headerTitleSize }]}>
              Hello, {userName ? userName : <ActivityIndicator color="#fff" size="small" />}
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

        <View style={[styles.content, { marginTop: 20, marginBottom: 60 }]}>
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
  parallaxBackground: { ...StyleSheet.absoluteFillObject },
  gradientFill: { flex: 1, position: "relative", overflow: "hidden" },
  circleOne: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -60,
    right: -60,
  },
  circleTwo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -40,
    left: -20,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  headerContent: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 10 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  headerText: { color: "#fff", fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },

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
  sectionSubtitle: { fontSize: 12, color: COLORS.muted, marginBottom: 16 },
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
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },

  featureCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  featureIcon: { fontSize: 14, marginBottom: 8, letterSpacing: 2 },
  featureTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  featureText: {
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
});
