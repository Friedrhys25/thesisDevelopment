import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState, useEffect } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { auth, db } from "../../backend/firebaseConfig";
import { get, ref } from "firebase/database";

// ✅ Define a TypeScript interface for Ionicons
interface IoniconsProps {
  name: keyof typeof iconMap;
  size: number;
  color: string;
}

// ✅ Icon map
const iconMap = {
  "mail-outline": "✉️",
  "alert-circle-outline": "🚨",
  "analytics-outline": "📊",
  "people-outline": "👤",
  "shield-outline": "🛡️",
  "medical-outline": "🏥",
  "flame-outline": "🔥",
  "chevron-forward": "→",
  "chatbubble-outline": "💬",
  "faqs": "❓",
};

// ✅ Typed Ionicons component
const Ionicons = ({ name, size, color }: IoniconsProps) => (
  <Text style={{ fontSize: size, color, lineHeight: size }}>{iconMap[name] || "•"}</Text>
);

// ✅ Service type
interface Service {
  id: number;
  name: string;
  icon: keyof typeof iconMap;
  gradient: readonly [string, string];
  route: string;
  description?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Fetch user firstName from Firebase
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

  const services: Service[] = [
    { id: 1, name: "Complaints", icon: "alert-circle-outline", gradient: ["#FF6B6B", "#FF8E8E"] as const, route: "/complaints" },
    { id: 2, name: "Emergency", icon: "medical-outline", gradient: ["#FF6B6B", "#FF8E8E"] as const, route: "/emergency" },
    { id: 3, name: "Feedback", icon: "mail-outline", gradient: ["#FF6B6B", "#FF8E8E"] as const, route: "/feedback" },
    { id: 4, name: "Profile", icon: "people-outline", gradient: ["#FF6B6B", "#FF8E8E"] as const, route: "/profile" },
    { id: 5, name: "FAQS", icon: "faqs", gradient: ["#FF6B6B", "#FF8E8E"] as const, route: "/FAQS" },
  ];

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

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Parallax Header */}
        <View style={styles.parallaxContainer}>
          <Animated.View
            style={[styles.parallaxBackground, { transform: [{ translateY: parallaxTranslate }] }]}
          />
          <View style={styles.overlay} />
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Municipal Services</Text>
            </View>
            <Text style={styles.headerText}>
              Hello, {userName ? userName : <ActivityIndicator color="#fff" />}
            </Text>
            <Text style={styles.subtitle}>
              Your voice matters. Connect with us anytime.
            </Text>
          </View>
        </View>

        {/* Services Grid */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>What would you like?</Text>
          <Text style={styles.sectionSubtitle}>Choose a service to get started</Text>
          <View style={styles.grid}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[styles.card, activeCard === service.id && styles.activeCard]}
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

        {/* Feature Card */}
        <View style={[styles.content, { marginTop: 20, marginBottom: 60 }]}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>💡</Text>
            <Text style={styles.featureTitle}>Did you know?</Text>
            <Text style={styles.featureText}>
              You can track the status of your complaints and receive real-time
              updates through our platform.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  parallaxContainer: { height: 180, position: "relative", overflow: "hidden", justifyContent: "flex-end" },
  parallaxBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: "#667eea" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  headerContent: { padding: 20 },
  badge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  headerText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  content: { backgroundColor: "#fff", marginHorizontal: 18, marginTop: 18, borderRadius: 20, padding: 18, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A1A" },
  sectionSubtitle: { fontSize: 13, color: "#6B7280", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: { width: "48%", aspectRatio: 1, borderRadius: 20, overflow: "hidden", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 3 },
  gradientCard: { flex: 1, justifyContent: "center", alignItems: "center", borderRadius: 16, padding: 12 },
  activeCard: { transform: [{ scale: 0.95 }] },
  cardLabel: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 6 },
  cardDesc: { color: "rgba(255,255,255,0.9)", fontSize: 11, textAlign: "center", marginTop: 2 },
  button: { marginTop: 12, backgroundColor: "rgba(255,255,255,0.3)", paddingVertical: 6, paddingHorizontal: 14, borderRadius: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  featureCard: { backgroundColor: "#FFF9E6", borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "rgba(255, 193, 7, 0.2)" },
  featureIcon: { fontSize: 42, marginBottom: 8 },
  featureTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A1A" },
  featureText: { fontSize: 13, color: "#4B5563", textAlign: "center", marginTop: 6, lineHeight: 18 },
});
