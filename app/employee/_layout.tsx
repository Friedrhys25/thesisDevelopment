import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Platform,
    Pressable,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_ITEMS = [
  { name: "dashboard",       icon: "home-outline",      active: "home",      label: "Dashboard" },
  { name: "manage-requests", icon: "list-outline",       active: "list",      label: "Requests"  },
  { name: "reports",         icon: "bar-chart-outline",  active: "bar-chart", label: "Reports"   },
  { name: "profile",         icon: "person-outline",     active: "person",    label: "Profile"   },
];

// ── Palette matches splash + complaints redesign ───────────────────────────────
const C = {
  gold:        "#f59e0b",
  goldDim:     "rgba(245,158,11,0.18)",
  goldBorder:  "rgba(245,158,11,0.35)",
  navy:        "#0b1a3d",
  navyLight:   "#0f2050",
  inactive:    "rgba(255,255,255,0.38)",
  border:      "rgba(255,255,255,0.07)",
  glow:        "rgba(245,158,11,0.22)",
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const currentIndex = state.index;

  const tabCount          = state.routes.length;
  const barWidth          = Math.min(540, Math.max(300, width - 28));
  const itemWidth         = barWidth / tabCount;
  const indicatorPad      = 6;
  const indicatorW        = itemWidth - indicatorPad * 2;

  const motion = useRef(new Animated.Value(currentIndex)).current;
  const glowOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(motion, {
      toValue: currentIndex,
      useNativeDriver: true,
      bounciness: 8,
      speed: 16,
    }).start();

    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 0.4, duration: 80,  useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1,   duration: 320, useNativeDriver: true }),
    ]).start();
  }, [currentIndex]);

  const inputRange = state.routes.map((_: any, i: number) => i);
  const translateX = motion.interpolate({ inputRange, outputRange: inputRange.map((i: number) => i * itemWidth), extrapolate: "clamp" });

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom + 10, 14) }]}>
      {/* Outer glow ring */}
      <Animated.View style={[styles.outerGlow, { width: barWidth, opacity: glowOpacity }]} />

      <View style={[styles.bar, { width: barWidth }]}>
        {/* Sliding indicator */}
        <Animated.View
          style={[
            styles.indicator,
            {
              width:     indicatorW,
              left:      indicatorPad,
              transform: [{ translateX }],
            },
          ]}
        />

        {/* Tabs */}
        {state.routes.map((route: any, index: number) => {
          const active = currentIndex === index;
          const item   = TAB_ITEMS.find((t) => t.name.toLowerCase() === route.name.toLowerCase()) || {
            icon: "ellipse-outline", active: "ellipse", label: route.name,
          };

          const iconScale = motion.interpolate({
            inputRange:  [index - 1, index, index + 1],
            outputRange: [0.88, 1.12, 0.88],
            extrapolate: "clamp",
          });
          const iconY = motion.interpolate({
            inputRange:  [index - 1, index, index + 1],
            outputRange: [0, -2, 0],
            extrapolate: "clamp",
          });

          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name);
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={({ pressed }) => [
                styles.tab,
                { width: itemWidth },
                pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] },
              ]}
            >
              <Animated.View style={{ transform: [{ scale: iconScale }, { translateY: iconY }], alignItems: "center" }}>
                <Ionicons
                  name={active ? item.active as any : item.icon as any}
                  size={22}
                  color={active ? C.gold : C.inactive}
                />
                {/* Active dot */}
                {active && <View style={styles.activeDot} />}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="dashboard"       options={{ title: "Dashboard" }} />
      <Tabs.Screen name="manage-requests" options={{ title: "Requests"  }} />
      <Tabs.Screen name="reports"         options={{ title: "Reports"   }} />
      <Tabs.Screen name="profile"         options={{ title: "Profile"   }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position:  "absolute",
    alignSelf: "center",
    alignItems: "center",
    zIndex:    100,
  },

  // Ambient glow behind bar
  outerGlow: {
    position:     "absolute",
    alignSelf:    "center",
    height:       60,
    borderRadius: 999,
    backgroundColor: C.gold,
    opacity:      0.12,
    shadowColor:  C.gold,
    // blur-like effect via shadow on Android too
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation:    0,
  },

  bar: {
    height:          60,
    borderRadius:    999,
    backgroundColor: C.navy,
    borderWidth:     1,
    borderColor:     C.goldBorder,
    flexDirection:   "row",
    alignItems:      "center",
    overflow:        "hidden",
    // Deep shadow
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 12 },
    shadowOpacity:   0.5,
    shadowRadius:    20,
    elevation:       20,
  },

  // Sliding gold highlight
  indicator: {
    position:        "absolute",
    top:             8,
    bottom:          8,
    borderRadius:    14,
    backgroundColor: C.goldDim,
    borderWidth:     1,
    borderColor:     C.goldBorder,
  },

  tab: {
    height:         "100%",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         10,
  },

  // Small gold dot under active icon
  activeDot: {
    marginTop:       4,
    width:           4,
    height:          4,
    borderRadius:    2,
    backgroundColor: C.gold,
  },
});
