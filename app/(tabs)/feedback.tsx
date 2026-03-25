import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { get, ref, update } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../backend/firebaseConfig";

type PersonType = "official" | "employee";

interface Person {
  id: string;
  name: string;
  position: string;
  type: PersonType;
}

export default function FeedbackPage() {
  const router = useRouter();
  const [officials, setOfficials] = useState<Person[]>([]);
  const [employees, setEmployees] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PersonType>("official");

  // ✅ Added search state
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedPosition, setSelectedPosition] = useState<string>("all categories");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const officialPositions = [
    "all categories",
    "kapitan",
    "kagawad",
    "secretary",
    "treasurer",
    "barangay record keeper",
    "barangay clerk"
  ];

  const employeePositions = [
    "all categories",
    "day care services",
    "vawc",
    "bns",
    "bhw",
    "chief bantay bayan",
    "bantay bayan",
    "bantay bayan/utility",
    "bantay bayan/driver",
    "lupon tagapamayapa"
  ];

  // ✅ Reset selected position AND search query when switching tabs
  useEffect(() => {
    setSelectedPosition("all categories");
    setSearchQuery("");
  }, [activeTab]);

  // Fetch officials and employees from Firebase
  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const fetchData = async () => {
    try {
      // Fetch Officials
      const officialsRef = ref(db, "officials");
      const officialsSnapshot = await get(officialsRef);

      if (officialsSnapshot.exists()) {
        const data = officialsSnapshot.val();
        const officialsArray = Object.keys(data).map((key) => ({
          id: key,
          name: data[key].name,
          position: data[key].position,
          type: "official" as PersonType,
        }));
        setOfficials(officialsArray);
      }

      // Fetch Employees
      const employeesRef = ref(db, "employees");
      const employeesSnapshot = await get(employeesRef);

      if (employeesSnapshot.exists()) {
        const data = employeesSnapshot.val();
        const employeesArray = Object.keys(data).map((key) => ({
          id: key,
          name: data[key].name,
          position: data[key].position,
          type: "employee" as PersonType,
        }));
        setEmployees(employeesArray);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRating = (id: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [id]: rating }));
  };

  const handleComment = (id: string, text: string) => {
    setComments((prev) => ({ ...prev, [id]: text }));
  };

  const handleSubmitIndividual = async (personId: string, personName: string, personType: PersonType) => {
    if (!ratings[personId]) {
      Alert.alert("Error", "Please provide a rating before submitting");
      return;
    }

    try {
      const feedbackRef = ref(db, `${personType === "official" ? "officials" : "employees"}/${personId}/feedback/${Date.now()}`);
      const feedbackData = {
        rating: ratings[personId],
        comment: comments[personId] || "",
        timestamp: Date.now(),
      };
      await update(feedbackRef, feedbackData);

      Alert.alert("Success", `Feedback for ${personName} submitted successfully!`);

      // Clear this person's feedback after submission
      setRatings(prev => {
        const newRatings = { ...prev };
        delete newRatings[personId];
        return newRatings;
      });
      setComments(prev => {
        const newComments = { ...prev };
        delete newComments[personId];
        return newComments;
      });
    } catch (error) {
      console.error("Error saving feedback:", error);
      Alert.alert("Error", "Failed to submit feedback");
    }
  };

  const handleSubmitGeneral = async () => {
    if (!generalFeedback.trim()) {
      Alert.alert("Error", "Please write some feedback before submitting");
      return;
    }

    setSubmitting(true);

    try {
      const generalFeedbackRef = ref(db, `generalFeedback/${Date.now()}`);
      const feedbackData = {
        feedback: generalFeedback,
        timestamp: Date.now(),
      };
      await update(generalFeedbackRef, feedbackData);

      Alert.alert("Success", "General feedback submitted successfully!");
      setGeneralFeedback("");
      setSubmitted(true);

      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Error saving feedback:", error);
      Alert.alert("Error", "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const RatingStars = ({
    id,
    currentRating,
  }: {
    id: string;
    currentRating: number;
  }) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => handleRating(id, star)}
          style={styles.starButton}
        >
          <Ionicons
            name={star <= currentRating ? "star" : "star-outline"}
            size={32}
            color={star <= currentRating ? "#FFB800" : "#D1D5DB"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={100} color="#10B981" />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successMessage}>
            Your feedback has been submitted successfully.{"\n"}
            We appreciate your input to help us improve our services.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentList = activeTab === "official" ? officials : employees;
  const currentPositions = activeTab === "official" ? officialPositions : employeePositions;

  // ✅ Updated Filter Logic: Checks Position AND Search Query
  const filteredList = currentList.filter(person => {
    const matchesPosition = selectedPosition === "all categories"
      ? true
      : person.position.toLowerCase() === selectedPosition.toLowerCase();

    const matchesSearch = person.name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesPosition && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Feedback & Rating</Text>
            <Text style={styles.headerSubtitle}>Help us improve our services</Text>
          </View>
        </View>

        {loading ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.searchContainer}>
              <Skeleton style={{ width: '100%', height: 20, borderRadius: 4 }} />
            </View>
            <View style={styles.tabContainer}>
               <Skeleton style={{ width: '100%', height: 40, borderRadius: 12 }} />
            </View>
            
            <View style={styles.filterContainer}>
              <Skeleton style={{ width: 120, height: 16, borderRadius: 4, marginBottom: 8 }} />
              <Skeleton style={{ width: '100%', height: 36, borderRadius: 18 }} />
            </View>
            
            {[1, 2, 3].map((idx) => (
              <View key={idx} style={styles.personCard}>
                <View style={styles.personHeader}>
                  <Skeleton style={[styles.avatarContainer, { backgroundColor: '#E5E7EB', marginRight: 16 }]} />
                  <View style={styles.personInfo}>
                    <Skeleton style={{ width: 120, height: 20, borderRadius: 4, marginBottom: 6 }} />
                    <Skeleton style={{ width: 80, height: 14, borderRadius: 4 }} />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4A90E2"
              />
            }
          >
            {/* ✅ Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${activeTab === "official" ? "officials" : "employees"} by name...`}
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearButton}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Tab Selector */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "official" && styles.activeTab,
                ]}
                onPress={() => setActiveTab("official")}
              >
                <Ionicons
                  name="briefcase"
                  size={20}
                  color={activeTab === "official" ? "#4A90E2" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "official" && styles.activeTabText,
                  ]}
                >
                  Officials
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{officials.length}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "employee" && styles.activeTab,
                ]}
                onPress={() => setActiveTab("employee")}
              >
                <Ionicons
                  name="people"
                  size={20}
                  color={activeTab === "employee" ? "#4A90E2" : "#6B7280"}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "employee" && styles.activeTabText,
                  ]}
                >
                  Employees
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{employees.length}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Position Filter */}
            <View style={styles.filterContainer}>
              <Text style={styles.filterLabel}>Filter by Position:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollView}
              >
                {currentPositions.map((position) => (
                  <TouchableOpacity
                    key={position}
                    style={[
                      styles.filterChip,
                      selectedPosition === position && styles.filterChipActive
                    ]}
                    onPress={() => setSelectedPosition(position)}
                  >
                    <Text style={[
                      styles.filterChipText,
                      selectedPosition === position && styles.filterChipTextActive
                    ]}>
                      {position}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#4A90E2" />
              <Text style={styles.infoText}>
                Rate and provide feedback for our barangay {activeTab === "official" ? "officials" : "employees"}
              </Text>
            </View>

            {/* Person Cards */}
            {filteredList.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? `No matches found for "${searchQuery}"`
                    : `No ${activeTab === "official" ? "officials" : "employees"} found for this position`
                  }
                </Text>
              </View>
            ) : (
              filteredList.map((person) => (
                <View key={person.id} style={styles.personCard}>
                  {/* Person Header */}
                  <View style={styles.personHeader}>
                    <View style={styles.avatarContainer}>
                      <Ionicons
                        name={activeTab === "official" ? "shield" : "person"}
                        size={28}
                        color="#4A90E2"
                      />
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={styles.personName}>{person.name}</Text>
                      <Text style={styles.personPosition}>{person.position}</Text>
                    </View>
                  </View>

                  {/* Rating Section */}
                  <View style={styles.ratingSection}>
                    <Text style={styles.ratingLabel}>Your Rating</Text>
                    <RatingStars
                      id={person.id}
                      currentRating={ratings[person.id] || 0}
                    />
                    {ratings[person.id] > 0 && (
                      <Text style={styles.ratingValue}>
                        {ratings[person.id]} out of 5 stars
                      </Text>
                    )}
                  </View>

                  {/* Comment Section */}
                  <View style={styles.commentSection}>
                    <Text style={styles.commentLabel}>Your Comment (Optional)</Text>
                    <TextInput
                      style={styles.commentInput}
                      placeholder={`Share your feedback about ${person.name}...`}
                      placeholderTextColor="#9CA3AF"
                      value={comments[person.id] || ""}
                      onChangeText={(text) => handleComment(person.id, text)}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />

                    {/* Individual Submit Button */}
                    <TouchableOpacity
                      style={styles.individualSubmitButton}
                      onPress={() => handleSubmitIndividual(person.id, person.name, person.type)}
                    >
                      <Text style={styles.individualSubmitText}>Submit Feedback</Text>
                      <Ionicons name="send" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* General Feedback Section */}
            <View style={styles.generalFeedbackSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="chatbox-ellipses" size={24} color="#4A90E2" />
                <Text style={styles.sectionTitle}>General Feedback</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Share your overall thoughts about our barangay services
              </Text>
              <TextInput
                style={styles.generalFeedbackInput}
                placeholder="Write your general feedback here..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={5}
                value={generalFeedback}
                onChangeText={setGeneralFeedback}
                textAlignVertical="top"
              />

              {/* General Feedback Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitGeneral}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Submit General Feedback</Text>
                    <Ionicons name="send" size={20} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6B7280",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // ✅ New Search Bar Styles
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
    height: "100%",
  },
  searchClearButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 6,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: "#EFF6FF",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#4A90E2",
  },
  badge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  filterScrollView: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#4A90E2",
    borderColor: "#4A90E2",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "capitalize",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4A90E2",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  personCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  personPosition: {
    fontSize: 14,
    color: "#6B7280",
    textTransform: "capitalize",
  },
  ratingSection: {
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: "row",
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  ratingValue: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
  },
  commentSection: {
    marginTop: 16,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#F9FAFB",
    color: "#1F2937",
    minHeight: 80,
    marginBottom: 12,
  },
  individualSubmitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: "#4A90E2",
    borderRadius: 12,
  },
  individualSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  generalFeedbackSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  generalFeedbackInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    backgroundColor: "#F9FAFB",
    color: "#1F2937",
    marginBottom: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    backgroundColor: "#4A90E2",
    borderRadius: 16,
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#A8C9E8",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },
  successMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
});

// ===============================
// REUSABLE SKELETON COMPONENT
// ===============================
function Skeleton({ style }: { style: any }) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={[style, { opacity: pulseAnim, backgroundColor: "#E5E7EB" }]} />
  );
}