import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Linking,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { firestore } from "../../backend/firebaseConfig";

// ====== Centralized App Design System ======
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
  success: "#10B981",
  warning: "#F59E0B",
};


// ===== Premium 911 Slide Button =====
const Emergency911Button = () => {
  const NATIONAL_EMERGENCY_NUMBER = "911";
  const fillAnim = useRef(new Animated.Value(0)).current;
  const isTriggeredRef = useRef(false);

  const handleCall911 = () => {
    Alert.alert(
      "Confirm Call",
      `Do you want to immediately call the National Emergency Hotline (${NATIONAL_EMERGENCY_NUMBER})?`,
      [
        { text: "Cancel", style: "cancel", onPress: resetFill },
        {
          text: "Call 911",
          style: "destructive",
          onPress: () => {
            Linking.openURL(`tel:${NATIONAL_EMERGENCY_NUMBER}`);
            resetFill();
          },
        },
      ]
    );
  };

  const resetFill = () => {
    isTriggeredRef.current = false;
    Animated.timing(fillAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handlePressIn = () => {
    if (isTriggeredRef.current) return;
    Animated.timing(fillAnim, {
      toValue: 1,
      duration: 1500, // Time required to hold (1.5 seconds)
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        isTriggeredRef.current = true;
        handleCall911();
      }
    });
  };

  const handlePressOut = () => {
    if (!isTriggeredRef.current) {
      resetFill();
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.sectionTitle2}>Emergency Hotline</Text>
        <View style={styles.pillDanger}>
          <Text style={styles.pillDangerText}>National</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.holdContainer}>
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.holdTrack}
        >
          <Animated.View style={[styles.holdFill, { transform: [{ scale: fillAnim }] }]} />
          
          <View style={{ position: 'absolute' }}>
             <Ionicons name="call" size={42} color={COLORS.danger} />
          </View>
          <Animated.View style={{ zIndex: 10, position: 'absolute', opacity: fillAnim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1] }) }}>
             <Ionicons name="call" size={42} color="#ffffff" />
          </Animated.View>
        </Pressable>
        <Text style={styles.holdText}>HOLD TO CALL 911</Text>
      </View>

      <Text style={styles.helperText}>
        Use only for real emergencies. False calls may delay response for others.
      </Text>
    </View>
  );
};

type EmergencyService = {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  number: string;
  color: string;
  category: string;
};

const CATEGORY_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  police: { icon: "shield-outline", color: "#3B82F6" },
  fire: { icon: "flame-outline", color: COLORS.primary },
  ambulance: { icon: "medical-outline", color: COLORS.success },
  rescue: { icon: "boat-outline", color: "#6366F1" },
  disaster: { icon: "thunderstorm-outline", color: "#8B5CF6" },
};

const DEFAULT_CATEGORY = { icon: "call-outline" as keyof typeof Ionicons.glyphMap, color: COLORS.muted };

export default function EmergencyPage() {
  const insets = useSafeAreaInsets();
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hotlines, setHotlines] = useState<EmergencyService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotlines = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(firestore, "emergencyHotlines"));
      const data: EmergencyService[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        const cat = (d.category || "").toLowerCase();
        const mapped = CATEGORY_MAP[cat] || DEFAULT_CATEGORY;
        return {
          id: doc.id,
          name: d.name || "Unknown",
          number: d.number || "",
          category: d.category || "",
          icon: mapped.icon,
          color: mapped.color,
        };
      });
      setHotlines(data);
    } catch (e) {
      console.error("Failed to fetch emergency hotlines:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotlines();
  }, [fetchHotlines]);

  const safetyTips = [
    { id: 1, title: "Stay Calm", description: "Keep calm and assess the situation before acting." },
    { id: 2, title: "Location Info", description: "Know your exact location to report accurately." },
    { id: 3, title: "Follow Instructions", description: "Listen carefully to emergency responders." },
  ];

  const handleEmergencyCall = (service: EmergencyService) => {
    Alert.alert("Call Emergency", `Call ${service.name} at ${service.number}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Call", onPress: () => Linking.openURL(`tel:${service.number}`) },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHotlines();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Flat App Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Emergency Services</Text>
        <Text style={styles.headerSubtitle}>
          Quick help, 24/7. Call immediately or use the quick dial cards below.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Notice box style (replacing old alert banner) */}
        <View style={styles.noticeBox}>
          <View style={styles.noticeIcon}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.primary} />
          </View>
          <Text style={styles.noticeText}>
            If this is a life-threatening emergency, use the 911 slider below.
          </Text>
        </View>

        {/* 911 Slider */}
        <Emergency911Button />

        {/* Quick Dial */}
        <Text style={styles.sectionTitle}>Quick Emergency Dial</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
        ) : hotlines.length === 0 ? (
          <View style={{ alignItems: "center", marginVertical: 30 }}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.muted} />
            <Text style={{ color: COLORS.muted, fontWeight: "600", marginTop: 8 }}>No hotlines available</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {hotlines.map((service) => {
              const selected = selectedEmergency === service.id;
              return (
                <Pressable
                  key={service.id}
                  onPressIn={() => setSelectedEmergency(service.id)}
                  onPressOut={() => setSelectedEmergency(null)}
                  onPress={() => handleEmergencyCall(service)}
                  style={[
                    styles.emergencyCard,
                    selected && { borderColor: service.color, backgroundColor: `${service.color}14` },
                  ]}
                >
                  <Ionicons name={service.icon} size={40} color={service.color} style={styles.iconBig} />
                  <Text style={styles.emergencyName}>{service.name}</Text>
                  <Text style={styles.emergencyNumber}>{service.number}</Text>
                  <Text style={styles.emergencyDesc}>{service.category}</Text>

                  <View
                    style={[
                      styles.callBadge,
                      { backgroundColor: service.color }
                    ]}
                  >
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={styles.callBadgeText}>Call</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Safety Tips */}
        <Text style={styles.sectionTitle}>Safety Tips</Text>
        {safetyTips.map((tip) => (
          <View key={tip.id} style={styles.tipCard}>
            <View style={styles.tipDot}>
              <Text style={styles.tipDotText}>{tip.id}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDesc}>{tip.description}</Text>
            </View>
          </View>
        ))}

        {/* Important Note */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.sectionTitle2}>Important Reminder</Text>
            <View style={styles.pillWarn}>
              <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.noteText}>
            Only call emergency services for genuine emergencies. False reports may
            result in penalties and delay help for others.
          </Text>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  // ===== Header =====
  topHeader: {
    backgroundColor: COLORS.primary,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  headerSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600", marginTop: 4 },

  scroll: { padding: 20, paddingTop: 16 },

  // ===== Cards =====
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text, marginBottom: 12, marginTop: 4, paddingHorizontal: 4 },
  sectionTitle2: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  divider: { height: 1, backgroundColor: "rgba(229,231,235,0.7)", marginVertical: 12 },

  // ===== Notice box (like profile's notice) =====
  noticeBox: {
    backgroundColor: "rgba(251, 228, 81, 0.15)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: { flex: 1, color: COLORS.text, lineHeight: 18, fontWeight: "600" },

  // ===== Pills =====
  pillDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
  },
  pillDangerText: { color: COLORS.danger, fontWeight: "900", fontSize: 12 },

  pillWarn: {
    backgroundColor: "rgba(245,158,11,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  // ===== 911 Hold button =====
  holdContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  holdTrack: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  holdFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.danger,
    borderRadius: 55,
  },
  holdText: {
    marginTop: 16,
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  helperText: { marginTop: 10, color: COLORS.muted, fontWeight: "600", lineHeight: 18 },

  // ===== Quick dial grid/cards =====
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  emergencyCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    alignItems: "center",
  },
  iconBig: { marginBottom: 10 },
  emergencyName: { fontWeight: "900", fontSize: 15, color: COLORS.text },
  emergencyNumber: { fontWeight: "800", fontSize: 14, color: COLORS.muted, marginTop: 2 },
  emergencyDesc: { color: COLORS.muted, fontSize: 11, textAlign: "center", marginVertical: 8, lineHeight: 16, fontWeight: "500" },

  callBadge: {
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  callBadgeText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  // ===== Tips =====
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    padding: 14,
    marginBottom: 10,
  },
  tipDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(241, 111, 36, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  tipDotText: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  tipTitle: { fontWeight: "900", fontSize: 15, color: COLORS.text },
  tipDesc: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 2, fontWeight: "500" },

  noteText: { color: COLORS.muted, fontWeight: "600", lineHeight: 20, fontSize: 13 },
});
