import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { firestore } from "../../backend/firebaseConfig";

// ── Palette — exact mirror of complain.tsx ────────────────────────────────────
const COLORS = {
  bg:         "#080f26",
  surface:    "#0f1e45",
  surfaceAlt: "#0d1a3c",
  elevated:   "#162254",

  text:       "#E8EEFF",
  textMuted:  "#8895BB",
  textDim:    "#4A5880",

  gold:       "#f59e0b",
  goldLight:  "#fbbf24",
  goldDim:    "rgba(245,158,11,0.15)",
  goldBorder: "rgba(245,158,11,0.3)",

  blue:       "#1447c0",
  blueMid:    "#1E56D8",
  blueLight:  "rgba(20,71,192,0.3)",
  red:        "#ce1126",
  redLight:   "rgba(206,17,38,0.25)",

  pending:    "#f59e0b",
  inProgress: "#3b82f6",
  resolved:   "#10b981",
  danger:     "#ef4444",
  success:    "#10b981",

  border:     "rgba(255,255,255,0.06)",
  borderGold: "rgba(245,158,11,0.2)",
};

// ── Category map ──────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  police:   { icon: "shield-outline",       color: "#3b82f6" },
  fire:     { icon: "flame-outline",        color: "#f97316" },
  ambulance:{ icon: "medical-outline",      color: COLORS.success },
  rescue:   { icon: "boat-outline",         color: "#6366f1" },
  disaster: { icon: "thunderstorm-outline", color: "#8b5cf6" },
};
const DEFAULT_CATEGORY = { icon: "call-outline" as keyof typeof Ionicons.glyphMap, color: COLORS.textMuted };

type EmergencyService = {
  id: string; name: string;
  icon: keyof typeof Ionicons.glyphMap;
  number: string; color: string; category: string;
};

// ── Pulse ring ────────────────────────────────────────────────────────────────
function PulseRing({ color, delay = 0 }: { color: string; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", width: 110, height: 110, borderRadius: 55,
        borderWidth: 1.5, borderColor: color,
        opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.8, 0.4, 0] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
      }}
    />
  );
}

// ── 911 Hold Button ───────────────────────────────────────────────────────────
function Emergency911Button() {
  const NATIONAL_EMERGENCY_NUMBER = "911";
  const fillAnim       = useRef(new Animated.Value(0)).current;
  const scaleAnim      = useRef(new Animated.Value(1)).current;
  const glowAnim       = useRef(new Animated.Value(0)).current;
  const isTriggeredRef = useRef(false);

  const handleCall911 = () => {
    Alert.alert(
      "Confirm Call",
      `Call the National Emergency Hotline (${NATIONAL_EMERGENCY_NUMBER})?`,
      [
        { text: "Cancel", style: "cancel", onPress: resetFill },
        { text: "Call 911", style: "destructive", onPress: () => { Linking.openURL(`tel:${NATIONAL_EMERGENCY_NUMBER}`); resetFill(); } },
      ]
    );
  };

  const resetFill = () => {
    isTriggeredRef.current = false;
    Animated.parallel([
      Animated.timing(fillAnim,  { toValue: 0, duration: 300, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(glowAnim,  { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  };

  const handlePressIn = () => {
    if (isTriggeredRef.current) return;
    Vibration.vibrate(20);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.93, useNativeDriver: true }),
      Animated.timing(glowAnim,  { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
    Animated.timing(fillAnim, { toValue: 1, duration: 1500, useNativeDriver: false })
      .start(({ finished }) => {
        if (finished) { isTriggeredRef.current = true; Vibration.vibrate([0, 60, 50, 60]); handleCall911(); }
      });
  };

  const handlePressOut = () => { if (!isTriggeredRef.current) resetFill(); };

  const glowColor  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(206,17,38,0)", "rgba(206,17,38,0.28)"] });
  const progressW  = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={s.sosCard}>
      <View style={s.sosCardHeader}>
        <View>
          <Text style={s.sosCardEyebrow}>NATIONAL EMERGENCY</Text>
          <Text style={s.sosCardTitle}>Call 911</Text>
        </View>
        <View style={s.sosDangerBadge}>
          <Text style={s.sosDangerBadgeText}>HOTLINE</Text>
        </View>
      </View>
      <View style={s.sosCardDivider} />

      <View style={s.sosButtonArea}>
        <Animated.View style={[s.sosGlow, { backgroundColor: glowColor }]} />
        <PulseRing color={COLORS.red} delay={0} />
        <PulseRing color={COLORS.red} delay={700} />

        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }], shadowColor: COLORS.red, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 20, elevation: 14 }}>
            <LinearGradient
              colors={["#7a000e", "#ce1126", "#ff2040"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.sosButtonInner}
            >
              <Ionicons name="call" size={36} color="#fff" />
              <Text style={s.sosButtonLabel}>911</Text>
              <Text style={s.sosButtonHint}>hold to call</Text>
            </LinearGradient>
          </Animated.View>
        </Pressable>

        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, { width: progressW }]} />
        </View>
        <Text style={s.sosHoldText}>HOLD TO CALL 911</Text>
      </View>

      <Text style={s.sosHelperText}>
        Use only for genuine life-threatening emergencies. False calls delay response for others.
      </Text>
    </View>
  );
}

// ── Stat pill — mirrors complain.tsx header stats ─────────────────────────────
function StatPill({ icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: COLORS.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 4, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.skeletonCard, { opacity: pulse }]} />;
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EmergencyPage() {
  const insets = useSafeAreaInsets();
  const [selectedEmergency, setSelectedEmergency] = useState<string | null>(null);
  const [refreshing, setRefreshing]               = useState(false);
  const [hotlines, setHotlines]                   = useState<EmergencyService[]>([]);
  const [loading, setLoading]                     = useState(true);

  const fetchHotlines = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(firestore, "emergencyHotlines"));
      const data: EmergencyService[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        const cat = (d.category || "").toLowerCase();
        const mapped = CATEGORY_MAP[cat] || DEFAULT_CATEGORY;
        return { id: doc.id, name: d.name || "Unknown", number: d.number || "", category: d.category || "", icon: mapped.icon, color: mapped.color };
      });
      setHotlines(data);
    } catch (e) { console.error("Failed to fetch emergency hotlines:", e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHotlines(); }, [fetchHotlines]);

  const handleEmergencyCall = (service: EmergencyService) => {
    Alert.alert(
      "Call Emergency",
      `Call ${service.name} at ${service.number}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call Now", style: "destructive", onPress: () => Linking.openURL(`tel:${service.number}`) },
      ]
    );
  };

  const onRefresh = async () => { setRefreshing(true); await fetchHotlines(); setRefreshing(false); };

  const safetyTips = [
    { id: 1, icon: "pulse-outline"    as const, title: "Stay Calm",          desc: "Keep calm and assess the situation before acting." },
    { id: 2, icon: "location-outline" as const, title: "Know Your Location", desc: "State your exact address or landmark clearly to responders." },
    { id: 3, icon: "headset-outline"  as const, title: "Follow Instructions",desc: "Listen carefully and cooperate with emergency responders." },
  ];

  return (
    <SafeAreaView style={s.safeArea} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── HEADER — mirrors complain.tsx ── */}
      <LinearGradient
        colors={["#1a0008", "#2a000f", "#0b1a3d"]}
        locations={[0, 0.35, 1]}
        style={[s.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={s.headerRing} />
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerEyebrow}>BARANGAY SAN ROQUE</Text>
            <Text style={s.headerTitle}>Emergency</Text>
          </View>
          <View style={s.headerIconWrap}>
            <Ionicons name="warning" size={26} color={COLORS.red} />
          </View>
        </View>

        {!loading && (
          <View style={s.statsStrip}>
            <StatPill icon="call-outline"   label="Hotlines" value={hotlines.length} color={COLORS.blue} />
            <View style={s.statDivider} />
            <StatPill icon="time-outline"   label="Response" value="24/7"            color={COLORS.gold} />
            <View style={s.statDivider} />
            <StatPill icon="shield-outline" label="National" value="911"             color={COLORS.red} />
          </View>
        )}

        <View style={[s.headerAccentLine, { backgroundColor: COLORS.red }]} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        {/* Notice */}
        <View style={s.noticeBox}>
          <View style={s.noticeIconWrap}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.gold} />
          </View>
          <Text style={s.noticeText}>
            For life-threatening emergencies, use the hold-to-call button below or dial 911 directly.
          </Text>
        </View>

        {/* 911 hold button */}
        <Emergency911Button />

        {/* Quick Dial */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionEyebrow}>DIRECTORY</Text>
          <Text style={s.sectionTitle}>Quick Emergency Dial</Text>
        </View>

        {loading ? (
          <View style={s.skeletonGrid}>
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </View>
        ) : hotlines.length === 0 ? (
          <View style={s.emptyState}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="call-outline" size={36} color={COLORS.gold} />
            </View>
            <Text style={s.emptyTitle}>No hotlines available</Text>
            <Text style={s.emptySubtitle}>Check back later or contact the barangay office</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {hotlines.map((service) => {
              const selected = selectedEmergency === service.id;
              return (
                <Pressable
                  key={service.id}
                  onPressIn={() => setSelectedEmergency(service.id)}
                  onPressOut={() => setSelectedEmergency(null)}
                  onPress={() => handleEmergencyCall(service)}
                  style={[
                    s.hotlineCard,
                    selected && { borderColor: service.color, backgroundColor: service.color + "14" },
                  ]}
                >
                  <View style={[s.hotlineIconWrap, { backgroundColor: service.color + "20", borderColor: service.color + "40" }]}>
                    <Ionicons name={service.icon} size={26} color={service.color} />
                  </View>
                  <Text style={s.hotlineName}>{service.name}</Text>
                  <Text style={s.hotlineNumber}>{service.number}</Text>
                  <Text style={s.hotlineCategory}>{service.category}</Text>
                  <View style={[s.callBadge, { backgroundColor: service.color }]}>
                    <Ionicons name="call" size={13} color="#fff" />
                    <Text style={s.callBadgeText}>Call</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Safety Tips */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionEyebrow}>GUIDELINES</Text>
          <Text style={s.sectionTitle}>Safety Tips</Text>
        </View>

        {safetyTips.map((tip) => (
          <View key={tip.id} style={s.tipCard}>
            <View style={s.tipStepBadge}>
              <Text style={s.tipStepText}>{tip.id}</Text>
            </View>
            <View style={s.tipIconWrap}>
              <Ionicons name={tip.icon} size={18} color={COLORS.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tipTitle}>{tip.title}</Text>
              <Text style={s.tipDesc}>{tip.desc}</Text>
            </View>
          </View>
        ))}

        {/* Reminder card */}
        <View style={s.reminderCard}>
          <View style={s.reminderHeader}>
            <Text style={s.reminderTitle}>Important Reminder</Text>
            <View style={s.reminderBadge}>
              <Ionicons name="warning-outline" size={13} color={COLORS.gold} />
              <Text style={s.reminderBadgeText}>WARNING</Text>
            </View>
          </View>
          <View style={s.reminderDivider} />
          <Text style={s.reminderText}>
            Only contact emergency services for genuine emergencies. False reports violate barangay ordinance, may result in penalties, and delay help for those truly in need.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  // Header — mirrors complain.tsx exactly
  header:          { paddingHorizontal: 22, paddingBottom: 20, overflow: "hidden" },
  headerRing:      { position: "absolute", width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: "rgba(206,17,38,0.08)", top: -80, right: -60 },
  headerRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  headerEyebrow:   { color: "rgba(206,17,38,0.65)", fontSize: 9, fontWeight: "800", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 },
  headerTitle:     { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  headerIconWrap:  { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(206,17,38,0.1)", borderWidth: 1, borderColor: "rgba(206,17,38,0.3)", justifyContent: "center", alignItems: "center" },
  headerAccentLine:{ height: 1, opacity: 0.3, marginTop: 16 },
  statsStrip:      { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border },
  statDivider:     { width: 1, backgroundColor: COLORS.border, alignSelf: "stretch", marginHorizontal: 8 },

  scroll: { paddingHorizontal: 18, paddingTop: 18 },

  // Notice
  noticeBox:     { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "rgba(206,17,38,0.08)", borderWidth: 1, borderColor: "rgba(206,17,38,0.2)", borderRadius: 18, padding: 14, marginBottom: 16 },
  noticeIconWrap:{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(206,17,38,0.15)", borderWidth: 1, borderColor: "rgba(206,17,38,0.3)", justifyContent: "center", alignItems: "center" },
  noticeText:    { flex: 1, color: COLORS.textMuted, fontSize: 13, fontWeight: "600", lineHeight: 19 },

  // 911 card
  sosCard:        { backgroundColor: COLORS.surface, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "rgba(206,17,38,0.25)" },
  sosCardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sosCardEyebrow: { color: "rgba(206,17,38,0.6)", fontSize: 9, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 },
  sosCardTitle:   { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  sosDangerBadge: { backgroundColor: "rgba(206,17,38,0.15)", borderWidth: 1, borderColor: "rgba(206,17,38,0.3)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  sosDangerBadgeText: { color: COLORS.red, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  sosCardDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sosButtonArea:  { alignItems: "center", paddingVertical: 10, position: "relative" },
  sosGlow:        { position: "absolute", width: 110, height: 110, borderRadius: 55 },
  sosButtonInner: { width: 110, height: 110, borderRadius: 55, justifyContent: "center", alignItems: "center", gap: 1 },
  sosButtonLabel: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 3 },
  sosButtonHint:  { color: "rgba(255,255,255,0.5)", fontSize: 9, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  progressTrack:  { width: 160, height: 4, borderRadius: 2, backgroundColor: COLORS.elevated, marginTop: 20, overflow: "hidden" },
  progressFill:   { height: "100%", borderRadius: 2, backgroundColor: COLORS.red },
  sosHoldText:    { color: COLORS.red, fontSize: 12, fontWeight: "900", letterSpacing: 2, marginTop: 10 },
  sosHelperText:  { color: COLORS.textDim, fontSize: 12, fontWeight: "500", lineHeight: 18, textAlign: "center", marginTop: 16 },

  // Section headers
  sectionHeader:  { marginBottom: 14, marginTop: 6 },
  sectionEyebrow: { color: COLORS.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 2 },
  sectionTitle:   { color: COLORS.text, fontSize: 18, fontWeight: "900" },

  // Skeletons
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  skeletonCard: { width: "48%", height: 170, borderRadius: 20, backgroundColor: COLORS.elevated, marginBottom: 10 },

  // Empty state — mirrors complain.tsx
  emptyState:    { alignItems: "center", paddingVertical: 40 },
  emptyIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  emptyTitle:    { color: COLORS.text, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptySubtitle: { color: COLORS.textMuted, fontSize: 13 },

  // Hotline grid — mirrors complain.tsx card
  grid:           { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  hotlineCard:    { width: "48%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 14, alignItems: "center", marginBottom: 4 },
  hotlineIconWrap:{ width: 54, height: 54, borderRadius: 16, borderWidth: 1, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  hotlineName:    { color: COLORS.text, fontWeight: "900", fontSize: 14, textAlign: "center" },
  hotlineNumber:  { color: COLORS.textMuted, fontWeight: "800", fontSize: 13, marginTop: 2 },
  hotlineCategory:{ color: COLORS.textDim, fontSize: 10, textAlign: "center", marginVertical: 8, lineHeight: 15, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  callBadge:      { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  callBadgeText:  { color: "#fff", fontWeight: "900", fontSize: 12 },

  // Safety tips — mirrors complain.tsx instructionRow
  tipCard:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  tipStepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(206,17,38,0.15)", borderWidth: 1, borderColor: "rgba(206,17,38,0.3)", justifyContent: "center", alignItems: "center" },
  tipStepText:  { color: COLORS.red, fontSize: 11, fontWeight: "900" },
  tipIconWrap:  { width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, justifyContent: "center", alignItems: "center" },
  tipTitle:     { color: COLORS.text, fontWeight: "800", fontSize: 14, marginBottom: 2 },
  tipDesc:      { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, fontWeight: "500" },

  // Reminder card — mirrors complain.tsx card anatomy
  reminderCard:    { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, marginTop: 6, marginBottom: 4, borderWidth: 1, borderColor: COLORS.borderGold },
  reminderHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  reminderTitle:   { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  reminderBadge:   { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.goldDim, borderWidth: 1, borderColor: COLORS.goldBorder, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  reminderBadgeText:{ color: COLORS.gold, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  reminderDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  reminderText:    { color: COLORS.textMuted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
});