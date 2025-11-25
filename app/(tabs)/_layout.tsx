import { Tabs } from "expo-router";

export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ headerShown: false}} />
      <Tabs.Screen name="complain" options={{ headerShown: false}} />
      <Tabs.Screen name="emergency" options={{ headerShown: false}} />
      <Tabs.Screen name="feedback" options={{ headerShown: false}} />
      <Tabs.Screen name="messages" options={{ headerShown: false}} />
      <Tabs.Screen name="profile" options={{ headerShown: false}} />
      
    </Tabs>
  );
}
