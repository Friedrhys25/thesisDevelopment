import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";


type IoniconsProps = {
  name: string;
  size: number;
  color: string;
};

// ✅ Emoji-based icons (can replace with @expo/vector-icons)
const Ionicons = ({ name, size, color }: IoniconsProps) => {
  const iconMap: Record<string, string> = {
    "arrow-back": "←",
    "alert-circle": "🚨",
    "call": "📞",
    "location": "📍",
    "time": "🕐",
    "megaphone": "📢",
  };
  return (
    <Text style={{ fontSize: size, color, lineHeight: size }}>{iconMap[name] || "•"}</Text>
  );
};

export default function EmergencyPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedEmergency, setSelectedEmergency] = useState<number | null>(null);


  const emergencyTypes = [
    { id: 1, name: "Police", icon: "🛡️", number: "0910 135 0863 ", color: "#4A90E2", description: "Crime, security threats" },
    { id: 2, name: "Fire", icon: "🔥", number: "0997 298 5204", color: "#FF6B35", description: "Fire incidents, rescue" },
    { id: 3, name: "Ambulance", icon: "🏥", number: "0926 532 6524", color: "#50C878", description: "Medical emergencies" },
  ];

  const recentEmergencies = [
    { id: 1, type: "Medical", location: "Purok 1", time: "5 mins ago", status: "Responding" },
    { id: 2, type: "Fire", location: "Purok 2", time: "15 mins ago", status: "Resolved" },
    { id: 3, type: "Traffic", location: "Purok 4", time: "30 mins ago", status: "Responding" },
  ];

  const safetyTips = [
    { id: 1, title: "Stay Calm", description: "Keep calm and assess the situation before acting." },
    { id: 2, title: "Location Info", description: "Know your exact location to report accurately." },
    { id: 3, title: "Follow Instructions", description: "Listen carefully to emergency responders." },
  ];

  type EmergencyService = {
    id: number;
    name: string;
    icon: string;
    number: string;
    color: string;
    description: string;
  };

  const handleEmergencyCall = (service: EmergencyService) => {
    Alert.alert(
      "Call Emergency",
      `Call ${service.name} at ${service.number}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => Linking.openURL(`tel:${service.number}`) },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Emergency Services</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Alert Banner */}
        <View style={styles.alertBanner}>
          <Ionicons name="alert-circle" size={32} color="#E74C3C" />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>In case of emergency</Text>
            <Text style={styles.alertText}>
              Call immediately or use quick dial buttons below. Help is available 24/7.
            </Text>
          </View>
        </View>

        {/* Emergency Buttons */}
        <Text style={styles.sectionTitle}>Quick Emergency Dial</Text>
        <View style={styles.grid}>
          {emergencyTypes.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={[
                styles.emergencyCard,
                {
                  borderColor: selectedEmergency === service.id ? service.color : "#E0E0E0",
                  backgroundColor: selectedEmergency === service.id ? `${service.color}20` : "white",
                },
              ]}
              onPressIn={() => setSelectedEmergency(service.id)}
              onPressOut={() => setSelectedEmergency(null)}
              onPress={() => handleEmergencyCall(service)}
            >
              <Text style={[styles.icon, { color: service.color }]}>{service.icon}</Text>
              <Text style={styles.emergencyName}>{service.name}</Text>
              <Text style={styles.emergencyNumber}>{service.number}</Text>
              <Text style={styles.emergencyDesc}>{service.description}</Text>
              <TouchableOpacity
                onPress={() => handleEmergencyCall(service)}
                style={[styles.callButton, { backgroundColor: service.color }]}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.callButtonText}>Call Now</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Tips */}
        <Text style={styles.sectionTitle}>Safety Tips</Text>
        {safetyTips.map((tip) => (
          <View key={tip.id} style={styles.tipCard}>
            <View style={styles.tipNumber}>
              <Text style={{ color: "white", fontWeight: "bold" }}>{tip.id}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipDesc}>{tip.description}</Text>
            </View>
          </View>
        ))}

        
      

        {/* Important Note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>Important Reminder</Text>
            <Text style={styles.noteText}>
              Only call emergency services for genuine emergencies. False reports may result in penalties and delay help for others.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#F5F6FA",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: { marginRight: 12, padding: 8 },
  headerText: { fontSize: 22, fontWeight: "700", color: "#333" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  alertBanner: {
    flexDirection: "row",
    backgroundColor: "#FFEBEE",
    borderColor: "#FF5252",
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  alertTitle: { fontSize: 16, fontWeight: "700", color: "#C62828", marginBottom: 4 },
  alertText: { color: "#D32F2F", fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1A1A1A", marginVertical: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  emergencyCard: {
    width: "48%",
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 42, marginBottom: 8 },
  emergencyName: { fontWeight: "700", fontSize: 16, color: "#1A1A1A" },
  emergencyNumber: { fontWeight: "800", fontSize: 20, color: "#333" },
  emergencyDesc: { color: "#666", fontSize: 12, textAlign: "center", marginVertical: 6 },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  callButtonText: { color: "white", fontWeight: "700", marginLeft: 6 },
  tipCard: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 10,
  },
  tipNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#667eea",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  tipTitle: { fontWeight: "700", fontSize: 15, color: "#1A1A1A" },
  tipDesc: { color: "#666", fontSize: 13 },
  recentItem: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 10,
  },
  recentIcon: {
    width: 36,
    height: 36,
    backgroundColor: "#fff",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  recentType: { fontWeight: "700", color: "#1A1A1A", fontSize: 15 },
  recentDetails: { flexDirection: "row", gap: 12 },
  recentText: { color: "#666", fontSize: 13 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  noteCard: {
    flexDirection: "row",
    backgroundColor: "#FFF9E6",
    borderColor: "#FFE082",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  noteIcon: { fontSize: 28, marginRight: 10 },
  noteTitle: { fontWeight: "700", fontSize: 15, color: "#F57C00" },
  noteText: { color: "#E65100", fontSize: 13, lineHeight: 18 },
  
});
