import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ManageRequests() {
  const router = useRouter();

  // Mock data - replace with actual Firestore data later
  const requests = [
    {
      id: "1",
      type: "Complaint",
      title: "Water Supply Issue",
      requestor: "Juan Dela Cruz",
      date: "2024-03-08",
      status: "pending",
    },
    {
      id: "2",
      type: "Feedback",
      title: "Great Community Program",
      requestor: "Maria Santos",
      date: "2024-03-07",
      status: "resolved",
    },
    {
      id: "3",
      type: "Complaint",
      title: "Damaged Road",
      requestor: "Pedro Lopez",
      date: "2024-03-06",
      status: "in-progress",
    },
  ];

  const handleRequestPress = (requestId: string) => {
    Alert.alert("Request Details", `Viewing request ${requestId}. Full details coming soon.`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#ff9800";
      case "in-progress":
        return "#2196f3";
      case "resolved":
        return "#4caf50";
      default:
        return "#999";
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Requests</Text>
        <Text style={styles.subtitle}>View and manage community complaints & feedback</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.filterButtons}>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, styles.filterBtnActive]}>
            <Text style={styles.filterText}>Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterText}>In Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterText}>Resolved</Text>
          </TouchableOpacity>
        </View>

        {requests.map((request) => (
          <TouchableOpacity
            key={request.id}
            style={styles.requestCard}
            onPress={() => handleRequestPress(request.id)}
          >
            <View style={styles.requestHeader}>
              <View style={styles.requestTitleSection}>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: request.type === "Complaint" ? "#e74c3c" : "#3498db" },
                  ]}
                >
                  <Text style={styles.typeBadgeText}>{request.type}</Text>
                </View>
                <Text style={styles.requestTitle}>{request.title}</Text>
              </View>
              <View
                style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}
              >
                <Text style={styles.statusText}>{request.status}</Text>
              </View>
            </View>

            <View style={styles.requestDetails}>
              <Ionicons name="person" size={16} color="#999" />
              <Text style={styles.detailText}>{request.requestor}</Text>
              <Text style={styles.separator}>•</Text>
              <Ionicons name="calendar" size={16} color="#999" />
              <Text style={styles.detailText}>{request.date}</Text>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="eye" size={18} color="#4a90e2" />
                <Text style={styles.actionText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="create" size={18} color="#4a90e2" />
                <Text style={styles.actionText}>Update</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
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
    fontSize: 16,
    color: "#e3f2fd",
  },
  section: {
    padding: 20,
  },
  filterButtons: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  filterBtnActive: {
    borderColor: "#4a90e2",
    backgroundColor: "#e6f4fe",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  requestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  requestTitleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  requestDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#666",
  },
  separator: {
    color: "#ccc",
    marginHorizontal: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f4f9",
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a90e2",
  },
  spacer: {
    height: 20,
  },
});
