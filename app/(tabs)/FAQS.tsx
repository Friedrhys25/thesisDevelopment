import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
// Import the Google Gen AI SDK
import { GoogleGenAI } from '@google/genai';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- Configuration ---
// !!! IMPORTANT: REPLACE THIS WITH YOUR ACTUAL GEMINI API KEY !!!
const GEMINI_API_KEY = "AIzaSyDg_EbxqAGrgiAAOBN1jZIoPVzjeeJaXvk";

// Initialize the GoogleGenAI client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });


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
 * GEMINI API Function: Generates a response strictly based on the provided FAQs.
 * @param userQuestion The question sent by the user.
 * @param faqsList The list of all available FAQs.
 * @returns A promise that resolves to the bot's response string.
 */
const fetchChatbotResponse = async (userQuestion: string): Promise<string> => {
  // 1. Format the FAQs into a single reference text
  const faqContext = faqs.map(item => `Q: ${item.q}\nA: ${item.a}`).join('\n---\n');

  // 2. Define the System Instruction for strict constraint
  const systemInstruction = `You are a helpful and constrained FAQ chatbot for the Barangay Feedback System. Your SOLE source of information is the following list of Frequently Asked Questions (FAQs). You MUST only answer questions based on the content of these FAQs. If the user asks a question that is not covered in the FAQs, you MUST respond with the following exact sentence: "I'm sorry, I can only provide answers based on the Frequently Asked Questions list. Please try rephrasing your question or selecting one of the quick buttons below."

    Available FAQs:
    ---
    ${faqContext}
    ---`;

  // 3. Construct the API call
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userQuestion,
      config: {
        systemInstruction: systemInstruction,
        // Optional: Reduce randomness to make responses more factual/lookup-based
        temperature: 0.1,
      }
    });

    // 4. Return the model's text response
    return response.text || "Unable to generate a response. Please try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback response for API errors
    return "Sorry, I ran into an error while connecting to the help service. Please check your API key or network connection and try again.";
  }
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

    // 2. Fetch bot response (Live Gemini API Call)
    try {
      // Pass the user question and the FAQs list to the API wrapper
      const botResponse = await fetchChatbotResponse(userMessage);
      setMessages(prev => [
        ...prev,
        { text: botResponse, isUser: false }
      ]);
    } catch (error) {
      console.error("Chatbot API Error:", error);
      setMessages(prev => [
        ...prev,
        { text: "Sorry, I encountered an issue. Please ensure your API key is correct and retry.", isUser: false }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChatbot = (show: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowChatbot(show);
    if (!show) {
      setMessages([]); // Clear chat history when exiting chatbot
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
    // This now simulates the Gemini API result using the hardcoded answer
    setMessages(prev => [
      ...prev,
      { text: faq.q, isUser: true },
      { text: faq.a, isUser: false }
    ]);
    if (!showChatbot) {
      toggleChatbot(true); // Switch to chat view if selecting from FAQ list
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // FAQs are currently static, so we just simulate a refresh.
    // In the future, this could re-fetch FAQs from a database.
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
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Help & Support</Text>

        {/* Chat/FAQ Toggle Button (Swapped Logic) */}
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => toggleChatbot(!showChatbot)}
        >
          <Ionicons
            // Icon shows the view the user will switch to
            name={showChatbot ? "list-outline" : "chatbubble-ellipses"}
            size={22}
            color="#3B82F6"
          />
          <Text style={styles.toggleButtonText}>
            {/* Text shows the view the user will switch to */}
            {showChatbot ? "View All FAQs" : "Start Chat"}
          </Text>
        </TouchableOpacity>
      </View>

      {!showChatbot ? (
        <>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={24} color="#3B82F6" />
            <Text style={styles.infoBannerText}>
              Find quick answers below or chat with our AI assistant
            </Text>
          </View>

          {/* FAQ List */}
          <ScrollView
            style={styles.faqList}
            contentContainerStyle={styles.faqContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#3B82F6"
              />
            }
          >
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
            {faqs.map((item, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  onPress={() => toggleFaq(index)}
                  style={styles.faqQuestionContainer}
                >
                  <View style={styles.faqIconContainer}>
                    <Ionicons name="help-circle" size={20} color="#3B82F6" />
                  </View>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Ionicons
                    name={expandedFaqs.includes(index) ? "chevron-up" : "chevron-down"}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
                {expandedFaqs.includes(index) && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={styles.faqAnswer}>{item.a}</Text>
                  </View>
                )}
              </View>
            ))}

            {/* Contact Section */}
            <View style={styles.contactSection}>
              <Text style={styles.contactTitle}>Still need help?</Text>
              <Text style={styles.contactText}>
                Contact the barangay office during office hours
              </Text>
              <Text style={styles.contactHours}>Monday - Friday, 8:00 AM - 5:00 PM</Text>
            </View>
          </ScrollView>
        </>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderContent}>
              <View style={styles.botAvatar}>
                <Ionicons name="chatbox" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>FAQ Chatbot</Text>
                <Text style={styles.chatHeaderSubtitle}>Powered by Gemini (Limited to FAQ knowledge)</Text>
              </View>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg, index) => (
              <View
                key={index}
                style={[
                  styles.messageBubble,
                  msg.isUser ? styles.userMessage : styles.botMessage
                ]}
              >
                {!msg.isUser && (
                  <View style={styles.botAvatarSmall}>
                    <Ionicons name="chatbox" size={16} color="#fff" />
                  </View>
                )}
                <View style={[
                  styles.messageContent,
                  msg.isUser ? styles.userMessageContent : styles.botMessageContent
                ]}>
                  <Text style={[
                    styles.messageText,
                    msg.isUser ? styles.userMessageText : styles.botMessageText
                  ]}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            ))}
            {/* Typing Indicator */}
            {isLoading && (
              <View style={[styles.messageBubble, styles.botMessage]}>
                <View style={styles.botAvatarSmall}>
                  <Ionicons name="chatbox" size={16} color="#fff" />
                </View>
                <View style={[styles.messageContent, styles.botMessageContent]}>
                  <Text style={styles.botMessageText}>...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input Area */}
          <View style={styles.inputArea}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask a question..."
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, sendButtonDisabled && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={sendButtonDisabled}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* FAQ Buttons (Quick Picks) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.faqButtonsContainer}
            contentContainerStyle={styles.faqButtonsContent}
          >
            {faqs.map((faq, index) => (
              <TouchableOpacity
                key={index}
                style={styles.faqButton}
                onPress={() => selectFaq(faq)}
              >
                <Text style={styles.faqButtonText} numberOfLines={2}>{faq.q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
      )}


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#3B82F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  backButton: { padding: 4 },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
    marginLeft: 12,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  toggleButtonText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#1E40AF",
    lineHeight: 20,
  },

  faqList: { flex: 1 },
  faqContainer: { padding: 16, paddingBottom: 80 },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  faqItem: {
    backgroundColor: "#fff",
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  faqQuestionContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  faqIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 22,
  },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 60,
  },
  faqAnswer: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 22,
  },

  contactSection: {
    backgroundColor: "#F1F5F9",
    padding: 24,
    borderRadius: 12,
    marginTop: 24,
    alignItems: "center",
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 4,
  },
  contactHours: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },

  chatContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  chatHeader: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  chatHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  botAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  chatHeaderSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },

  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyMessageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyMessageText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
  },
  messageBubble: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-start",
    gap: 8,
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  botMessage: {
    justifyContent: "flex-start",
  },
  botAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  messageContent: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  userMessageContent: {
    backgroundColor: "#3B82F6",
    borderBottomRightRadius: 4,
    marginLeft: "auto",
  },
  botMessageContent: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#fff",
  },
  botMessageText: {
    color: "#1E293B",
  },
  faqButtonsContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    maxHeight: 120,
  },
  faqButtonsContent: {
    padding: 12,
    gap: 8,
  },
  faqButton: {
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  faqButtonText: {
    color: "#1E40AF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  // Input Styles
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  }
});