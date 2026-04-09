import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutAnimation,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#F16F24", // Adjusted to match complain.tsx primary
  primaryDark: "#F16F24",
  accent: "#FBE451",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  secondaryBg: "#F9FAFB",
};

// --- Configuration ---
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://192.168.68.126:5000";


// Define the FAQ structure
const faqs = [
  { q: "How do I submit feedback or a complaint?", a: "Go to the Feedback or Complaints section, fill in the description of the issue. You can also attach photos if needed to support your complaint. Once completed, click the submit button." },
  { q: "How can I track the status of my complaint?", a: "You can check the status under 'My Complaints' section in the app. The status will show as 'Pending' (awaiting review), 'In Progress' (being addressed), or 'Resolved' (completed)." },
  { q: "Who reviews my complaints or feedback?", a: "Assigned administrators or barangay officials review all submissions." },
  { q: "Is my personal information safe?", a: "Yes, all personal information and complaint details are kept strictly confidential and protected by our privacy policies. We comply with data protection regulations and only share information with authorized barangay personnel." },
  { q: "What should I do if I don't get a response?", a: "If you do not receive a response, you can send a follow-up message directly in the chat of your submitted complaint. The barangay staff will reply there once they review your message." },
  { q: "How quickly will my complaint be addressed?", a: "Response times vary depending on the nature and urgency of the complaint. Urgent matters (safety issues) are prioritized and addressed within 24-48 hours. Regular complaints typically receive a response within 5-7 business days." },
  { q: "What types of complaints can I submit?", a: "You can submit complaints about infrastructure issues (damaged roads, streetlights), sanitation concerns, noise complaints, community disputes, environmental issues, and other barangay-related matters." },
  { q: "Can I attach photos to my complaint?", a: "Yes, you can attach photos to your complaint. Photos help officials better understand the issue and provide more accurate solutions. Photo should be under 5MB in size." },
  { q: "How do I delete a complaint I submitted?", a: "You can delete a complaint only if it has not been reviewed yet. Go to 'My Complaints', select the complaint, and tap the delete icon. Once reviewed, complaints cannot be deleted but can be marked as withdrawn." },
  { q: "Will I be notified about updates to my complaint?", a: "Yes, you will receive notifications whenever there is an update to your complaint status. Make sure to enable notifications in your device settings for the app." },
  { q: "What if my issue requires urgent attention?", a: "When submitting your complaint, you can mark it as 'Urgent'. Urgent complaints are prioritized and reviewed first. For life-threatening emergencies, please visit the Emergency page in the app, which lists all the hotline numbers for immediate assistance." },
  { q: "Can I submit feedback about good service?", a: "Absolutely! We welcome positive feedback about excellent service from barangay officials or staff. This helps us recognize outstanding performance and maintain high service standards." },
  { q: "How do I reset my password?", a: "On the login screen, tap 'Forgot Password', enter your registered email address, and you'll receive a password reset link. Follow the instructions in the email to create a new password." },
];

/**
 * Groq-powered FAQ chatbot with hardcoded guardrails.
 * Pre-filters off-topic questions BEFORE calling Groq to save API quota.
 */

// Allowed topic keywords — questions must contain at least one to pass the guardrail
const ALLOWED_KEYWORDS = [
  // Complaints
  "complaint", "complain", "report", "submit", "file", "status", "pending", "progress",
  "resolved", "urgent", "delete", "withdraw", "chat", "message", "respond", "response",
  "review", "classify", "type", "label", "purok", "incident", "evidence", "photo",
  "limit", "daily", "per day",
  // Emergency
  "emergency", "hotline", "911", "police", "fire", "ambulance", "rescue", "call",
  "safety", "danger", "help",
  // Feedback
  "feedback", "rating", "rate", "star", "tanod", "staff", "service",
  // Profile/Account
  "profile", "account", "password", "reset", "login", "register", "sign up", "signup",
  "email", "phone", "address", "avatar", "verification", "verify", "id", "approved",
  // App general
  "app", "barangay", "talk2kap", "notification", "update", "setting", "faq", "question",
  "how", "what", "where", "when", "can i", "do i",
  // Tagalog / Filipino keywords
  "reklamo", "sumbong", "tulong", "tanong", "paano", "saan", "kailan", "ano",
  "problema", "isyu", "kapitan", "barangay", "kontrol", "ayuda", "paalala",
  "magreklamo", "magsumbong", "magtanong", "nasaan", "anong", "papaano",
  "gawa", "lagay", "pasok", "sulat", "kuha", "pag-alam", "opisyal",
];

// Blocked topic patterns — if matched, reject immediately
const BLOCKED_PATTERNS = [
  /\b(code|program|script|function|variable|html|css|javascript|python)\b/i,
  /\b(story|poem|song|joke|riddle|creative)\b/i,
  /\b(politic|election|president|senator|government)\b/i,
  /\b(religion|church|god|bible|quran)\b/i,
  /\b(bitcoin|crypto|stock|invest|money|salary)\b/i,
  /\b(diagnos|symptom|medicine|prescription|doctor)\b/i,
  /\b(lawyer|legal advice|court|sue)\b/i,
  /\b(math|calcul|equation|formula|solve \d)\b/i,
  /\b(history|geography|science|physics|chemistry)\b/i,
  /\b(recipe|cook|food|restaurant)\b/i,
  /\b(game|movie|music|anime|sport)\b/i,
];

const OFF_TOPIC_RESPONSE = "I'm sorry, I can only help with questions about the Talk2Kap barangay system. Please try asking about complaints, emergencies, feedback, or your account.";

/** Hardcoded guardrail check — runs BEFORE any API call */
const passesGuardrail = (question: string): boolean => {
  const lower = question.toLowerCase();

  // Block known off-topic patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(lower)) return false;
  }

  // Require at least one allowed keyword
  return ALLOWED_KEYWORDS.some(kw => lower.includes(kw));
};

const SYSTEM_INSTRUCTION = `You are the official FAQ assistant for Talk2Kap, a barangay complaint and feedback system app. Answer ONLY about this app's features. Keep answers concise (2-4 sentences). If unrelated, say you can only help with the Talk2Kap system.

IMPORTANT: Users may write in Tagalog, Taglish (mixed Tagalog-English), Bisaya, or use Filipino slang. ALWAYS translate any non-English input to English first, understand the question, then respond in English. If the user writes in Tagalog/Taglish, you may include a brief Tagalog translation of your answer in parentheses after the English answer.

APP FEATURES:
- Complaints: submit with description + purok + photo evidence (<5MB). AI-classified types. Status: Pending → In Progress → Resolved. Limit: 5/day. Urgent: 2/day with 24hr cooldown. Chat with staff. Delete before review only.
- Emergency: hotlines — 911, Police (09353581020), Fire (0997 298 5204), Ambulance (0926 532 6524)
- Feedback: rate tanod staff 1-5 stars after complaint resolved
- Profile: edit phone/address/avatar, ID verification (Pending/Verified/Denied), password reset via login screen
- Registration: personal info → contact → credentials → residency

FAQS:
${faqs.map((f, i) => `Q: ${f.q}\nA: ${f.a}`).join('\n')}`;

const fetchChatbotResponse = async (userQuestion: string): Promise<string> => {
  // Hardcoded guardrail — reject off-topic questions without calling API
  if (!passesGuardrail(userQuestion)) {
    return OFF_TOPIC_RESPONSE;
  }

  // Try local FAQ match first — saves API calls for exact FAQ matches
  const localResult = localFaqMatch(userQuestion);
  if (localResult !== null) {
    return localResult;
  }

  // Only call backend for on-topic questions that don't match any FAQ
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: userQuestion },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    return data.answer?.trim() || "Unable to generate a response. Please try again.";
  } catch (error: any) {
    console.error("FAQ Chat Error:", error);
    return "I'm sorry, I can only provide answers based on the Frequently Asked Questions list. Please try rephrasing your question or selecting one of the quick buttons below.";
  }
};

/** Local keyword-matching — returns answer string if matched, null if no match */
const localFaqMatch = (userQuestion: string): string | null => {
  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);

  const stopWords = new Set([
    "i", "me", "my", "the", "a", "an", "is", "are", "was", "were", "do", "does",
    "did", "will", "can", "could", "should", "would", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "it", "this", "that", "and", "or", "but",
    "if", "how", "what", "when", "where", "who", "which", "be", "have", "has",
  ]);

  const queryWords = normalize(userQuestion).filter(w => !stopWords.has(w));
  if (queryWords.length === 0) return null;

  let bestScore = 0;
  let bestFaq: typeof faqs[0] | null = null;

  for (const faq of faqs) {
    const faqWords = new Set([
      ...normalize(faq.q).filter(w => !stopWords.has(w)),
      ...normalize(faq.a).filter(w => !stopWords.has(w)),
    ]);

    let score = 0;
    for (const word of queryWords) {
      for (const faqWord of faqWords) {
        if (faqWord === word) score += 2;
        else if (faqWord.includes(word) || word.includes(faqWord)) score += 1;
      }
    }

    const normalizedScore = score / queryWords.length;
    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestFaq = faq;
    }
  }

  if (bestFaq && bestScore >= 1.5) return bestFaq.a;
  return null; // No confident match — let Groq handle it
};


export default function FAQPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([]);
  const [showChatbot, setShowChatbot] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Initialize chatbot message
  useEffect(() => {
    if (showChatbot && messages.length === 0) {
      setMessages([
        { text: "Hi! I'm here to help answer questions about the Barangay Feedback System. Select a question below or type yours.", isUser: false }
      ]);
    }
  }, [showChatbot]);


  // --- CHATBOT LOGIC ---

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();

    // 1. Add user message
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputText("");
    setIsLoading(true);

    // 2. Fetch bot response (Live Groq API Call)
    try {
      const botResponse = await fetchChatbotResponse(userMessage);
      setMessages(prev => [
        ...prev,
        { text: botResponse, isUser: false }
      ]);
    } catch (error) {
      console.error("Chatbot API Error:", error);
      setMessages(prev => [
        ...prev,
        { text: "Sorry, I encountered an issue. Please try again.", isUser: false }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChatbot = (show: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowChatbot(show);
    if (!show) {
      setExpandedFaqs([]); // Collapse FAQs if leaving
    } else {
        if (messages.length === 0) { // re-init welcome if cleared
             setMessages([
                { text: "Hi! I'm here to help answer questions about the Barangay Feedback System. Select a question below or type yours.", isUser: false }
              ]);
        }
    }
  };

  // --- END CHATBOT LOGIC ---

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const selectFaq = (faq: typeof faqs[0]) => {
    setMessages(prev => [
      ...prev,
      { text: faq.q, isUser: true },
      { text: faq.a, isUser: false }
    ]);
    if (!showChatbot) {
      toggleChatbot(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (showChatbot) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, showChatbot]);

  const sendButtonDisabled = !inputText.trim() || isLoading;

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header - Consistent with Complain.tsx */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
            <View style={{ flex: 1 }} /> 
            <TouchableOpacity 
                style={styles.toggleButton}
                onPress={() => toggleChatbot(!showChatbot)}
            >
                <Ionicons 
                    name={showChatbot ? "list" : "chatbubbles"} 
                    size={20} 
                    color={COLORS.primary} 
                />
                <Text style={styles.toggleButtonText}>
                    {showChatbot ? "FAQs" : "Chat Bot"}
                </Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.headerTitle}>Help & Support</Text>
        <Text style={styles.headerSubtitle}>Find answers or ask our AI assistant</Text>
      </View>

      {!showChatbot ? (
        <>
          {/* FAQ List */}
          <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 20, paddingTop: 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
              />
            }
          >
            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
                <Text style={styles.infoBannerText}>
                Tap any question to view the answer.
                </Text>
            </View>

            <Text style={styles.sectionTitle}>Common Questions ({faqs.length})</Text>

            {faqs.map((item, index) => {
               const isExpanded = expandedFaqs.includes(index);
               return (
              <View key={index} style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}>
                <TouchableOpacity
                  onPress={() => toggleFaq(index)}
                  style={styles.faqHeader}
                  activeOpacity={0.7}
                >
                  <View style={[styles.faqIconBox, isExpanded && styles.faqIconBoxExpanded]}>
                    <Ionicons name="help" size={20} color={isExpanded ? "#fff" : COLORS.primary} />
                  </View>
                  <Text style={[styles.faqQuestion, isExpanded && { color: COLORS.primary }]}>{item.q}</Text>
                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={COLORS.muted}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqBody}>
                    <Text style={styles.faqAnswer}>{item.a}</Text>
                    <TouchableOpacity 
                        style={styles.askBotButton}
                        onPress={() => selectFaq(item)}
                    >
                        <Text style={styles.askBotText}>Ask Bot related to this</Text>
                        <Ionicons name="arrow-forward" size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )})}

            {/* Contact Section */}
            <View style={styles.contactSection}>
              <Text style={styles.contactTitle}>Still need help?</Text>
              <Text style={styles.contactText}>
                Contact the barangay office directly.
              </Text>
              <Text style={styles.contactHours}>Mon - Fri, 8:00 AM - 5:00 PM</Text>
            </View>
          </ScrollView>
        </>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatWrapper}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
             <View style={styles.chatWelcome}>
                <View style={styles.botAvatarLarge}>
                    <Ionicons name="chatbubbles" size={32} color="#fff" />
                </View>
                <Text style={styles.chatWelcomeText}>Barangay AI Assistant</Text>
                <Text style={styles.chatWelcomeSub}>I can answer questions based on our FAQs.</Text>
             </View>

            {messages.slice(1).map((msg, index) => ( // render all except initial if customized header is used, or keep all
             // Actually let's keep all but style the first one nicely if it's the welcome message
              <View
                key={index}
                style={[
                  styles.messageRow,
                  msg.isUser ? styles.messageRowUser : styles.messageRowBot
                ]}
              >
                {!msg.isUser && (
                  <View style={styles.botAvatarSmall}>
                    <Ionicons name="logo-android" size={14} color="#fff" />
                  </View>
                )}
                <View style={[
                  styles.messageBubble,
                  msg.isUser ? styles.bubbleUser : styles.bubbleBot
                ]}>
                  <Text style={[
                    styles.messageText,
                    msg.isUser ? styles.textUser : styles.textBot
                  ]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}
            
            {/* Typing Indicator */}
            {isLoading && (
              <View style={[styles.messageRow, styles.messageRowBot]}>
                 <View style={styles.botAvatarSmall}>
                    <Ionicons name="logo-android" size={14} color="#fff" />
                  </View>
                  <View style={[styles.messageBubble, styles.bubbleBot, { paddingVertical: 12 }]}>
                     <ActivityIndicator size="small" color={COLORS.muted} />
                  </View>
              </View>
            )}
          </ScrollView>
            
            {/* Quick Suggestions */}
          <View style={styles.suggestionsContainer}> 
             <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {faqs.slice(0, 5).map((faq, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.suggestionPill}
                        onPress={() => selectFaq(faq)}
                    >
                        <Text style={styles.suggestionText} numberOfLines={1}>{faq.q}</Text>
                    </TouchableOpacity>
                ))}
             </ScrollView>
          </View>

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your question..."
              placeholderTextColor="#9CA3AF"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, sendButtonDisabled && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sendButtonDisabled}
            >
              <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  
  // Header
  topHeader: {
    backgroundColor: COLORS.primary,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
  },
  backButton: {
      padding: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  headerTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "500", marginTop: 4 },

  container: { flex: 1 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(241, 111, 36, 0.1)", // Primary opacity
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(241, 111, 36, 0.2)",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    fontWeight: "500",
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: COLORS.text,
      marginBottom: 16,
      letterSpacing: 0.5,
  },

  // FAQ Card
  faqCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  faqCardExpanded: {
      borderColor: COLORS.primary,
      backgroundColor: "#fff",
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  faqIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.secondaryBg,
    justifyContent: "center",
    alignItems: "center",
  },
  faqIconBoxExpanded: {
      backgroundColor: COLORS.primary,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15, // 16px requirement (close enough for list item) or should be 16
    fontWeight: "600",
    color: COLORS.text,
    lineHeight: 22,
  },
  faqBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  faqAnswer: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 24,
  },
  askBotButton: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
  },
  askBotText: {
      fontSize: 13,
      fontWeight: "700",
      color: COLORS.primary,
  },

  contactSection: {
    backgroundColor: COLORS.secondaryBg,
    padding: 24,
    borderRadius: 24,
    marginTop: 24,
    alignItems: "center",
    marginBottom: 40,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: "center",
    marginBottom: 4,
  },
  contactHours: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },

  // Chat Interface
  chatWrapper: {
    flex: 1,
    backgroundColor: COLORS.secondaryBg,
  },
  chatWelcome: {
      alignItems: 'center',
      paddingVertical: 32,
  },
  botAvatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 6,
  },
  chatWelcomeText: {
      fontSize: 20,
      fontWeight: "800",
      color: COLORS.text,
      marginBottom: 4,
  },
  chatWelcomeSub: {
      fontSize: 14,
      color: COLORS.muted,
  },
  
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 16 },

  messageRow: {
      marginBottom: 24, // Increased from 16
      flexDirection: 'row',
      maxWidth: '85%',
      alignItems: 'flex-end', // Align avatar to bottom of bubble
  },
  messageRowUser: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
  },
  messageRowBot: {
      alignSelf: 'flex-start',
  },
  botAvatarSmall: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: COLORS.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4, // Align slightly lower
      marginRight: 8, // Added margin instead of gap
  },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    flexShrink: 1, // Prevent overflow
  },
  bubbleUser: {
      backgroundColor: COLORS.primary,
      borderBottomRightRadius: 4,
  },
  bubbleBot: {
      backgroundColor: "#fff",
      borderBottomLeftRadius: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
  },
  messageText: {
      fontSize: 15,
      lineHeight: 22,
  },
  textUser: { color: "#fff" },
  textBot: { color: COLORS.text },

  suggestionsContainer: {
      maxHeight: 50,
      marginBottom: 8,
  },
  suggestionPill: {
      backgroundColor: "#fff",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginRight: 8,
  },
  suggestionText: {
      fontSize: 13,
      fontWeight: "600",
      color: COLORS.text,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 100, // Increased for navbar space
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
    height: 48,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 24, // Circle
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.muted,
    shadowOpacity: 0,
  }
});