import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

// ====== Design system copied from your ProfilePage concept ======
const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
};

// ===== Slider constants (your logic kept) =====
const SCREEN_WIDTH = Dimensions.get("window").width;
const SLIDE_THRESHOLD = SCREEN_WIDTH * 0.55;
const PADDING = 16 * 2;
const BUTTON_SIZE = 50;
const BAR_WIDTH = SCREEN_WIDTH - PADDING;
const MAX_DRAG = BAR_WIDTH - BUTTON_SIZE - 10;

// ===== Premium 911 Slide Button (design updated) =====
const Emergency911Button = () => {
  const NATIONAL_EMERGENCY_NUMBER = "911";
  const translateX = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  const handleCall911 = () => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();

    Alert.alert(
      "Confirm Emergency Call",
      `Do you want to immediately call the National Emergency Hotline (${NATIONAL_EMERGENCY_NUMBER})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call 911",
          style: "destructive",
          onPress: () => Linking.openURL(`tel:${NATIONAL_EMERGENCY_NUMBER}`),
        },
      ]
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: translateX }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dx > SLIDE_THRESHOLD) {
          setBusy(true);
          Animated.timing(translateX, {
            toValue: MAX_DRAG,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            setBusy(false);
            handleCall911();
          });
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const panStyle = {
    transform: [
      {
        translateX: translateX.interpolate({
          inputRange: [0, MAX_DRAG],
          outputRange: [0, MAX_DRAG],
          extrapolate: "clamp",
        }),
      },
    ],
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

      <View style={styles.slideTrack}>
        <Text style={styles.slideText}>SLIDE TO CALL 911</Text>

        <Animated.View
          style={[styles.slideKnob, panStyle]}
          {...panResponder.panHandlers}
        >
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.danger} />
          ) : (
            <Ionicons name="call" size={22} color={COLORS.danger} />
          )}
        </Animated.View>
      </View>

      <Text style={styles.helperText}>
        Use only for real emergencies. False calls may delay response for others.
      </Text>
    </View>
  );
};

type EmergencyService = {
  id: number;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  number: string;
  color: string;
  description: string;
};

export default function EmergencyPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedEmergency, setSelectedEmergency] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const emergencyTypes: EmergencyService[] = [
    { id: 1, name: "Police", icon: "shield-outline", number: "09353581020", color: "#4A90E2", description: "Crime, security threats" },
    { id: 2, name: "Fire", icon: "flame-outline", number: "0997 298 5204", color: "#FF6B35", description: "Fire incidents, rescue" },
    { id: 3, name: "Ambulance", icon: "medical-outline", number: "0926 532 6524", color: "#50C878", description: "Medical emergencies" },
  ];

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
    // You can add any future fetch here
    setTimeout(() => setRefreshing(false), 400);
  };

  const quickDialCards = useMemo(() => emergencyTypes, []);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Header like ProfilePage */}
      <LinearGradient
        colors={[COLORS.primary, "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topHeader}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.headerIconBtn}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>

          <Text style={styles.headerTitle}>Emergency Services</Text>

          {/* spacer to balance layout */}
          <View style={styles.headerIconBtn} />
        </View>

        <View style={styles.headerSub}>
          <Text style={styles.headerHeadline}>Quick help, 24/7</Text>
          <Text style={styles.headerCaption}>
            Call immediately or use the quick dial cards below.
          </Text>
        </View>
      </LinearGradient>

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

        <View style={styles.grid}>
          {quickDialCards.map((service) => {
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
                <Text style={styles.emergencyDesc}>{service.description}</Text>

                <Pressable
                  onPress={() => handleEmergencyCall(service)}
                  style={({ pressed }) => [
                    styles.primaryBtnSmall,
                    { backgroundColor: service.color },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons name="call" size={16} color="#fff" />
                  <Text style={styles.primaryBtnSmallText}>Call Now</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>

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
    paddingBottom: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  headerRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { paddingHorizontal: 18, paddingTop: 10 },
  headerHeadline: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerCaption: { marginTop: 4, color: "rgba(255,255,255,0.85)", fontSize: 12 },

  scroll: { padding: 18, paddingTop: 16 },

  // ===== Cards =====
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.65)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  sectionTitle2: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  divider: { height: 1, backgroundColor: "rgba(229,231,235,0.7)", marginVertical: 12 },

  // ===== Notice box (like profile's notice) =====
  noticeBox: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  noticeIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  noticeText: { flex: 1, color: "#374151", lineHeight: 18, fontWeight: "600" },

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

  // ===== 911 slider =====
  slideTrack: {
    height: 70,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    overflow: "hidden",
    justifyContent: "center",
  },
  slideText: {
    alignSelf: "center",
    color: "rgba(239,68,68,0.8)",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  slideKnob: {
    position: "absolute",
    left: 10,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(239,68,68,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  helperText: { marginTop: 10, color: COLORS.muted, fontWeight: "600", lineHeight: 18 },

  // ===== Quick dial grid/cards =====
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  emergencyCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.75)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    alignItems: "center",
  },
  iconBig: { marginBottom: 8 },
  emergencyName: { fontWeight: "800", fontSize: 15, color: COLORS.text },
  emergencyNumber: { fontWeight: "900", fontSize: 17, color: "#374151", marginTop: 2 },
  emergencyDesc: { color: COLORS.muted, fontSize: 12, textAlign: "center", marginVertical: 8, lineHeight: 16 },

  primaryBtnSmall: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnSmallText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  // ===== Tips =====
  tipCard: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.75)",
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  tipDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  tipDotText: { color: "#fff", fontWeight: "900" },
  tipTitle: { fontWeight: "800", fontSize: 15, color: COLORS.text },
  tipDesc: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },

  noteText: { color: COLORS.muted, fontWeight: "600", lineHeight: 19 },
});
