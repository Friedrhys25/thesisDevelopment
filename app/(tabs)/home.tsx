import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState, useEffect, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../backend/firebaseConfig";
import { get, ref } from "firebase/database";

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
  gradient: readonly [string, string];
  route: string;
  description?: string;
}

export default function HomePage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const userRef = ref(db, `users/${uid}/firstName`);
    get(userRef).then((snapshot) => {
      if (snapshot.exists()) {
        setUserName(snapshot.val());
      } else {
        setUserName("User");
      }
    });
  }, []);

  const services: Service[] = useMemo(
    () => [
      {
        id: 1,
        name: "Complaints",
        icon: "alert-circle-outline",
        gradient: [COLORS.primary, "#7C3AED"] as const,
        route: "/complain",
        description: "Report issues in your barangay.",
      },
      {
        id: 2,
        name: "Emergency",
        icon: "medical-outline",
        gradient: ["#F97316", "#FB7185"] as const,
        route: "/emergency",
        description: "Get urgent help fast.",
      },
      {
        id: 3,
        name: "Feedback",
        icon: "mail-outline",
        gradient: [COLORS.accent, "#22D3EE"] as const,
        route: "/feedback",
        description: "Share suggestions or ideas.",
      },
      {
        id: 4,
        name: "Profile",
        icon: "people-outline",
        gradient: [COLORS.primaryDark, "#6366F1"] as const,
        route: "/profile",
        description: "View your account details.",
      },
      {
        id: 5,
        name: "FAQS",
        icon: "help-circle-outline",
        gradient: ["#10B981", "#34D399"] as const,
        route: "/FAQS",
        description: "Find quick answers.",
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
    inputRange: [0, 300],
    outputRange: [0, 150],
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
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
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
            />
          </Animated.View>
          <View style={styles.overlay} />
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Municipal Services</Text>
            </View>
            <Text style={[styles.headerText, { fontSize: headerTitleSize }]}>
              Hello, {userName ? userName : <ActivityIndicator color="#fff" />}
            </Text>
            <Text style={styles.subtitle}>
              Your voice matters. Connect with us anytime.
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
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={service.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientCard}
                >
                  <Ionicons name={service.icon} size={48} color="#fff" />
                  <Text style={styles.cardLabel}>{service.name}</Text>
                  {service.description && (
                    <Text style={styles.cardDesc}>{service.description}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => handleServiceClick(service.id)}
                  >
                    <Text style={styles.buttonText}>Open</Text>
                  </TouchableOpacity>
                </LinearGradient>
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
  gradientFill: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },
  headerContent: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 10 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
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
    aspectRatio: 1.05,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  gradientCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    padding: 14,
  },
  activeCard: { transform: [{ scale: 0.97 }] },
  cardLabel: { color: "#fff", fontSize: 17, fontWeight: "800", marginTop: 8 },
  cardDesc: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
  button: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.28)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 13 },

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
