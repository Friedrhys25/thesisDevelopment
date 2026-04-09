import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BarChart from "react-native-chart-kit/dist/BarChart";
import LineChart from "react-native-chart-kit/dist/line-chart";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, firestore } from "../../backend/firebaseConfig";

type ChartMode = "bar" | "line" | "area";

interface HistoryEntry {
  complaintKey: string;
  type: string;
  incidentPurok: string;
  deployedAt: string;
  resolvedAt: string;
  status: string;
}

export default function Reports() {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get("window").width - 40;

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>("bar");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    // Listen to employee doc for active deployment
    const tanodRef = doc(firestore, "employee", user.uid);
    const unsubTanod = onSnapshot(tanodRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveCount(data.deploymentStatus === "deployed" ? 1 : 0);
      }
    });

    // Listen to deployment history
    const historyRef = collection(firestore, "employee", user.uid, "deploymentHistory");
    const historyQuery = query(historyRef, orderBy("resolvedAt", "desc"));
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const entries = snapshot.docs.map((d) => d.data() as HistoryEntry);
      setHistory(entries);
      setLoading(false);
    });

    return () => {
      unsubTanod();
      unsubHistory();
    };
  }, []);

  const resolvedCount = history.filter((h) => h.status === "resolved").length;
  const totalCount = history.length + activeCount;

  // --- Per-Purok complaint counts ---
  const purokCounts: Record<string, number> = {};
  history.forEach((entry) => {
    const purok = entry.incidentPurok || "Unknown";
    purokCounts[purok] = (purokCounts[purok] || 0) + 1;
  });
  const purokLabels = Object.keys(purokCounts).sort();
  const purokValues = purokLabels.map((p) => purokCounts[p]);

  // --- Per-Type complaint counts ---
  const typeCounts: Record<string, number> = {};
  history.forEach((entry) => {
    const type = entry.type || "Unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const typeLabels = Object.keys(typeCounts).sort();
  const typeValues = typeLabels.map((t) => typeCounts[t]);

  // --- Weekly trends (last 4 weeks) ---
  const now = new Date();
  const weeklyData: number[] = [0, 0, 0, 0];
  const weekLabels = ["4 wks ago", "3 wks ago", "2 wks ago", "This week"];
  history.forEach((entry) => {
    const resolved = entry.resolvedAt ? new Date(entry.resolvedAt) : null;
    if (!resolved) return;
    const diffMs = now.getTime() - resolved.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks < 4) {
      weeklyData[3 - diffWeeks] += 1;
    }
  });

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(74, 144, 226, ${opacity})`,
    labelColor: () => "#666",
    barPercentage: 0.6,
    propsForBackgroundLines: { stroke: "#e0e0e0" },
  };

  const areaChartConfig = {
    ...chartConfig,
    fillShadowGradient: "#4a90e2",
    fillShadowGradientOpacity: 0.3,
  };

  const chartModes: { key: ChartMode; label: string; icon: string }[] = [
    { key: "bar", label: "Bar", icon: "bar-chart" },
    { key: "line", label: "Line", icon: "analytics" },
    { key: "area", label: "Area", icon: "trending-up" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={{ marginTop: 12, color: "#666" }}>Loading reports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView 
        style={styles.safeArea} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.container}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        >
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.title}>Reports & Analytics</Text>
            <Text style={styles.subtitle}>Track performance and trends</Text>
          </View>

      {/* Summary Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Ionicons name="mail" size={28} color="#4a90e2" />
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>Total Received</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="checkmark-circle" size={28} color="#4caf50" />
            <Text style={[styles.statValue, { color: "#4caf50" }]}>{resolvedCount}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="time" size={28} color="#ff9800" />
            <Text style={[styles.statValue, { color: "#ff9800" }]}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>
      </View>

      {/* Chart Mode Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chart Style</Text>
        <View style={styles.chartModeRow}>
          {chartModes.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              style={[styles.chartModeBtn, chartMode === mode.key && styles.chartModeBtnActive]}
              onPress={() => setChartMode(mode.key)}
            >
              <Ionicons name={mode.icon as any} size={18} color={chartMode === mode.key ? "#fff" : "#4a90e2"} />
              <Text style={[styles.chartModeText, chartMode === mode.key && styles.chartModeTextActive]}>
                {mode.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Weekly Trends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Complaint Trends</Text>
        <View style={styles.chartContainer}>
          {weeklyData.some((v) => v > 0) ? (
            chartMode === "bar" ? (
              <BarChart
                data={{ labels: weekLabels, datasets: [{ data: weeklyData }] }}
                width={screenWidth - 24}
                height={200}
                chartConfig={chartConfig}
                fromZero
                showValuesOnTopOfBars
                yAxisLabel=""
                yAxisSuffix=""
                style={styles.chart}
              />
            ) : (
              <LineChart
                data={{ labels: weekLabels, datasets: [{ data: weeklyData }] }}
                width={screenWidth - 24}
                height={200}
                chartConfig={chartMode === "area" ? areaChartConfig : chartConfig}
                bezier={chartMode === "area"}
                fromZero
                style={styles.chart}
              />
            )
          ) : (
            <Text style={styles.noDataText}>No data for the last 4 weeks</Text>
          )}
        </View>
      </View>

      {/* Complaints per Purok */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complaints per Purok</Text>
        <View style={styles.chartContainer}>
          {purokLabels.length > 0 ? (
            <>
              {chartMode === "bar" ? (
                <BarChart
                  data={{
                    labels: purokLabels.map((p) => `P${p}`),
                    datasets: [{ data: purokValues }],
                  }}
                  width={screenWidth - 24}
                  height={220}
                  chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})` }}
                  fromZero
                  showValuesOnTopOfBars
                  yAxisLabel=""
                  yAxisSuffix=""
                  style={styles.chart}
                />
              ) : (
                <LineChart
                  data={{
                    labels: purokLabels.map((p) => `P${p}`),
                    datasets: [{ data: purokValues }],
                  }}
                  width={screenWidth - 24}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                    ...(chartMode === "area" ? { fillShadowGradient: "#4caf50", fillShadowGradientOpacity: 0.3 } : {}),
                  }}
                  bezier={chartMode === "area"}
                  fromZero
                  style={styles.chart}
                />
              )}
              {/* Purok detail list */}
              <View style={styles.purokList}>
                {purokLabels.map((purok) => (
                  <View key={purok} style={styles.purokRow}>
                    <View style={[styles.purokDot, { backgroundColor: "#4caf50" }]} />
                    <Text style={styles.purokLabel}>Purok {purok}</Text>
                    <Text style={styles.purokValue}>{purokCounts[purok]} complaints</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No purok data available</Text>
          )}
        </View>
      </View>

      {/* Complaint Type Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Complaint Type Breakdown</Text>
        <View style={styles.categoryBox}>
          {typeLabels.length > 0 ? (
            typeLabels.map((type, index) => {
              const colors = ["#4a90e2", "#e74c3c", "#ff9800", "#4caf50", "#9c27b0", "#00bcd4", "#795548", "#607d8b", "#f44336", "#3f51b5", "#009688", "#ff5722", "#cddc39"];
              return (
                <View key={type} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: colors[index % colors.length] }]} />
                  <Text style={styles.categoryLabel}>{type}</Text>
                  <Text style={styles.categoryValue}>{typeCounts[type]}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noDataText}>No complaint data yet</Text>
          )}
        </View>
      </View>

      <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#e3f2fd",
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#4a90e2",
    paddingLeft: 12,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4a90e2",
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  chartModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  chartModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#4a90e2",
    backgroundColor: "#fff",
  },
  chartModeBtnActive: {
    backgroundColor: "#4a90e2",
    borderColor: "#4a90e2",
  },
  chartModeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a90e2",
  },
  chartModeTextActive: {
    color: "#fff",
  },
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    alignItems: "center",
  },
  chart: {
    borderRadius: 12,
  },
  noDataText: {
    color: "#999",
    fontSize: 14,
    paddingVertical: 30,
    textAlign: "center",
  },
  purokList: {
    width: "100%",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  purokRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  purokDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  purokLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  purokValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c3e50",
  },
  categoryBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4a90e2",
    marginRight: 12,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    textTransform: "capitalize",
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  spacer: {
    height: 20,
  },
});
