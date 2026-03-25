import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

const TAB_ITEMS = [
  { name: "home", icon: "home-outline", active: "home", label: "Home" },
  { name: "complain", icon: "alert-circle-outline", active: "alert-circle", label: "Complain" },
  { name: "emergency", icon: "medical-outline", active: "medical", label: "Emergency" },
  { name: "feedback", icon: "chatbubble-outline", active: "chatbubble", label: "Feedback" },
  { name: "FAQS", icon: "help-circle-outline", active: "help-circle", label: "FAQs" },
  { name: "profile", icon: "person-outline", active: "person", label: "Profile" },
];

const COLORS = {
  active: "#2563EB",
  inactive: "#94A3B8",
  bg: "rgba(255,255,255,0.92)",
  shadow: "#000000",
  border: "rgba(37,99,235,0.12)",
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const currentIndex = state.index;

  const isWide = width >= 760;
  const tabCount = state.routes.length;
  const pillContainerWidth = Math.min(560, Math.max(320, width - 32));
  const itemWidth = pillContainerWidth / tabCount;
  const paddingX = 8;
  const bubbleWidth = itemWidth - paddingX * 2;

  const motion = useRef(new Animated.Value(currentIndex)).current;

  useEffect(() => {
    Animated.spring(motion, {
      toValue: currentIndex,
      useNativeDriver: true,
      bounciness: 10,
      speed: 14,
    }).start();
  }, [currentIndex, motion]);

  const inputRange = state.routes.map((_: any, i: number) => i);
  const outputRange = inputRange.map((i: number) => i * itemWidth);

  const activeTranslateX = motion.interpolate({
    inputRange,
    outputRange,
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.pillOuter,
        {
          bottom: Math.max(insets.bottom + 12, 16),
          width: pillContainerWidth,
          height: isWide ? 76 : 64,
          borderRadius: isWide ? 38 : 32,
        },
      ]}
    >
      <View style={styles.backdropContainer} />

      <Animated.View
        style={[
          styles.activeBubble,
          {
            width: bubbleWidth,
            left: paddingX,
            top: 8,
            bottom: 8,
            transform: [{ translateX: activeTranslateX }],
          },
        ]}
      />

      <View style={styles.tabRow}>
        {state.routes.map((route: any, index: number) => {
          const active = currentIndex === index;
          const item = TAB_ITEMS.find((t) => t.name.toLowerCase() === route.name.toLowerCase()) || {
            icon: "ellipse-outline",
            active: "ellipse",
            label: route.name,
          };

          const scale = motion.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [1, 1.15, 1],
            extrapolate: "clamp",
          });

          const translateY = motion.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0, -3, 0],
            extrapolate: "clamp",
          });

          const opacity = motion.interpolate({
            inputRange: [index - 1, index, index + 1],
            outputRange: [0.6, 1, 0.6],
            extrapolate: "clamp",
          });

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!event.defaultPrevented) {
                  navigation.navigate(route.name);
                  Haptics.selectionAsync();
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }
              }}
              style={({ pressed }) => [
                styles.tabTouch,
                { width: itemWidth },
                pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
              ]}
            >
              <Animated.View style={{ transform: [{ scale }, { translateY }] }}>
                <Ionicons
                  name={active ? item.active as any : item.icon as any}
                  size={24}
                  color={active ? COLORS.active : COLORS.inactive}
                />
              </Animated.View>
              
              {isWide ? (
                <Animated.Text
                  style={[
                    styles.tabLabel,
                    { color: active ? COLORS.active : COLORS.inactive, opacity },
                  ]}
                >
                  {item.label}
                </Animated.Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="complain" options={{ title: "Complain" }} />
      <Tabs.Screen name="emergency" options={{ title: "Emergency" }} />
      <Tabs.Screen name="feedback" options={{ title: "Feedback" }} />
      <Tabs.Screen name="FAQS" options={{ title: "FAQs" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  pillOuter: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: COLORS.bg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 14,
    overflow: "hidden",
  },
  backdropContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 999,
  },
  activeBubble: {
    position: "absolute",
    top: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(37,99,235,0.12)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.22)",
  },
  tabRow: {
    flexDirection: "row",
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  tabTouch: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingTop: 4,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
