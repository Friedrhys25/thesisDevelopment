import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function Reports() {
  // Mock data for charts (since we're not using external chart library)
  const requestStats = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    values: [12, 15, 10, 18, 14, 16],
  };

  const completionStats = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    values: [60, 75, 80, 90],
  };

  // Helper function to create bar height
  const getBarHeight = (value: number, max: number) => {
    return (value / max) * 150;
  };

  const maxRequest = Math.max(...requestStats.values);
  const maxCompletion = Math.max(...completionStats.values);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        <Text style={styles.subtitle}>Track performance and trends</Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Ionicons name="mail" size={28} color="#4a90e2" />
            <Text style={styles.statValue}>48</Text>
            <Text style={styles.statLabel}>Total Requests</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="checkmark-circle" size={28} color="#4caf50" />
            <Text style={styles.statValue}>32</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="time" size={28} color="#ff9800" />
            <Text style={styles.statValue}>16</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Request Trends */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Request Trends</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {requestStats.values.map((value, index) => (
              <View key={index} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: getBarHeight(value, maxRequest) },
                  ]}
                />
                <Text style={styles.barLabel}>{requestStats.labels[index]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legend}>
              <View style={[styles.legendColor, { backgroundColor: "#4a90e2" }]} />
              <Text style={styles.legendText}>Requests per Day</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Completion Rate */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completion Rate</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartBars}>
            {completionStats.values.map((value, index) => (
              <View key={index} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: getBarHeight(value, maxCompletion), backgroundColor: "#4caf50" },
                  ]}
                />
                <Text style={styles.barLabel}>{completionStats.labels[index]}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legend}>
              <View style={[styles.legendColor, { backgroundColor: "#4caf50" }]} />
              <Text style={styles.legendText}>Completion %</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request Category Breakdown</Text>
        <View style={styles.categoryBox}>
          <View style={styles.categoryRow}>
            <View style={styles.categoryDot} />
            <Text style={styles.categoryLabel}>Complaints</Text>
            <Text style={styles.categoryValue}>28</Text>
          </View>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: "#ff9800" }]} />
            <Text style={styles.categoryLabel}>Feedback</Text>
            <Text style={styles.categoryValue}>15</Text>
          </View>
          <View style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: "#4caf50" }]} />
            <Text style={styles.categoryLabel}>Emergency Alerts</Text>
            <Text style={styles.categoryValue}>5</Text>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    backgroundColor: "#4a90e2",
    paddingHorizontal: 20,
    paddingTop: 20,
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
    paddingVertical: 20,
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
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    alignItems: "center",
  },
  chartBars: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 180,
    width: "100%",
    marginBottom: 16,
  },
  barColumn: {
    alignItems: "center",
    flex: 1,
  },
  bar: {
    width: "70%",
    backgroundColor: "#4a90e2",
    borderRadius: 6,
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 12,
    color: "#666",
  },
  legendRow: {
    width: "100%",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: "#666",
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
    backgroundColor: "#e74c3c",
    marginRight: 12,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 14,
    color: "#555",
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
