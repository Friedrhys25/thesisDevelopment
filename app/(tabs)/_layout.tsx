import { Tabs } from "expo-router";
import { Text } from "react-native"; 

// 1. Define your Icon Map here
const iconMap = {
  "home": "🏠", // Added this so the Home tab has an icon
  "mail-outline": "✉️",
  "alert-circle-outline": "🚨",
  "analytics-outline": "📊",
  "people-outline": "👤",
  "shield-outline": "🛡️",
  "medical-outline": "🏥",
  "flame-outline": "🔥",
  "chevron-forward": "→",
  "chatbubble-outline": "💬",
  "faqs": "❓",
};

export default function RootLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: 'blue' }}> 
      
      {/* Home Tab */}
      <Tabs.Screen 
        name="home" 
        options={{ 
          headerShown: false,
          tabBarLabel: "Home",
          // We use Text instead of Ionicons here
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["home"]}</Text>
          ),
        }} 
      />

      {/* Complain Tab - Mapped to "alert-circle-outline" (🚨) */}
      <Tabs.Screen 
        name="complain" 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["alert-circle-outline"]}</Text>
          ),
        }} 
      />

      {/* Emergency Tab - Mapped to "medical-outline" (🏥) */}
      <Tabs.Screen 
        name="emergency" 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["medical-outline"]}</Text>
          ),
        }} 
      />

      {/* Feedback Tab - Mapped to "analytics-outline" (📊) or "chatbubble-outline" */}
      <Tabs.Screen 
        name="feedback" 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["mail-outline"]}</Text>
          ),
        }} 
      />

      {/* Messages Tab - Mapped to "mail-outline" (✉️) */}
      <Tabs.Screen 
        name="FAQS" 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["faqs"]}</Text>
          ),
        }} 
      />

      {/* Profile Tab - Mapped to "people-outline" (👤) */}
      <Tabs.Screen 
        name="profile" 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ size }) => (
            <Text style={{ fontSize: size }}>{iconMap["people-outline"]}</Text>
          ),
        }} 
      />
      
    </Tabs>
  );
}