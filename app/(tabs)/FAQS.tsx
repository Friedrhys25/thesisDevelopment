import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GEMINI_API_KEY = "AIzaSyDg_EbxqAGrgiAAOBN1jZIoPVzjeeJaXvk"; // Replace with your API key

export default function FAQPage() {
  const router = useRouter();
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([]);
  const [showChatbot, setShowChatbot] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([
    { text: "Hi! I'm here to help answer questions about the Barangay Feedback System. How can I assist you?", isUser: false }
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const sendMessage = async () => {
  if (!inputText.trim()) return;

  const userMessage = inputText.trim();
  setInputText("");
  setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
  setIsLoading(true);

  try {
    // Create context from FAQs
    const faqContext = faqs.map(faq => `Q: ${faq.q}\nA: ${faq.a}`).join("\n\n");
    
    const prompt = `You are a helpful assistant for a Barangay Feedback System. Answer questions ONLY based on the following FAQs. If the question is not related to these FAQs, politely say you can only answer questions about the feedback system based on the available FAQs.

FAQs:
${faqContext}

User Question: ${userMessage}

Please provide a helpful, concise answer based only on the information in the FAQs above. If the question cannot be answered from the FAQs, suggest the user contact the barangay office directly.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error:", errorData);
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log("API Response:", JSON.stringify(data, null, 2)); // Debug log
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const botResponse = data.candidates[0].content.parts[0].text;
      setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
    } else {
      console.error("Unexpected response structure:", data);
      setMessages(prev => [...prev, { 
        text: "I apologize, but I'm having trouble processing your question. Please try rephrasing or contact the barangay office directly.", 
        isUser: false 
      }]);
    }
  } catch (error) {
    console.error("Error details:", error);
    setMessages(prev => [...prev, { 
      text: "I'm sorry, I'm having technical difficulties. Please try again later or contact the barangay office directly during office hours (8 AM - 5 PM).", 
      isUser: false 
    }]);
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    if (showChatbot) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, showChatbot]);

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>Help & Support</Text>
        <TouchableOpacity 
          style={styles.chatButton} 
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowChatbot(!showChatbot);
          }}
        >
          <Ionicons name={showChatbot ? "close" : "chatbubble-ellipses"} size={24} color="#fff" />
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
          <ScrollView style={styles.faqList} contentContainerStyle={styles.faqContainer}>
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
          keyboardVerticalOffset={90}
        >
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderContent}>
              <View style={styles.botAvatar}>
                <Ionicons name="chatbox" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>AI Assistant</Text>
                <Text style={styles.chatHeaderSubtitle}>Ask me anything about FAQs</Text>
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
            {isLoading && (
              <View style={[styles.messageBubble, styles.botMessage]}>
                <View style={styles.botAvatarSmall}>
                  <Ionicons name="chatbox" size={16} color="#fff" />
                </View>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.loadingText}>Typing...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type your question..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Floating Chat Button (when FAQ is visible) */}
      {!showChatbot && (
        <TouchableOpacity 
          style={styles.floatingChatButton}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowChatbot(true);
          }}
        >
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
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
  chatButton: { padding: 4 },

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
  loadingContainer: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
  },

  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: "#1E293B",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  floatingChatButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});