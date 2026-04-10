import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';

// Keep the native splash visible until we're ready
SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');

export default function AnimatedSplashScreen({
  onFinish,
}: {
  onFinish: () => void;
}) {
  // ── Animation values ──────────────────────────────────────────────────────
  const logoScale    = useRef(new Animated.Value(0)).current;
  const logoRotate   = useRef(new Animated.Value(-8)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const glowScale    = useRef(new Animated.Value(0.8)).current;

  const nameOpacity  = useRef(new Animated.Value(0)).current;
  const nameY        = useRef(new Animated.Value(14)).current;

  const tagOpacity   = useRef(new Animated.Value(0)).current;
  const tagY         = useRef(new Animated.Value(14)).current;

  const dividerW     = useRef(new Animated.Value(0)).current;

  const pillOpacity  = useRef(new Animated.Value(0)).current;
  const pillY        = useRef(new Animated.Value(14)).current;

  const stripOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity= useRef(new Animated.Value(0)).current;
  const progressW    = useRef(new Animated.Value(0)).current;
  const flagOpacity  = useRef(new Animated.Value(0)).current;

  // Ring waves (3 staggered)
  const ring1Scale   = useRef(new Animated.Value(0.7)).current;
  const ring1Opacity = useRef(new Animated.Value(0.5)).current;
  const ring2Scale   = useRef(new Animated.Value(0.7)).current;
  const ring2Opacity = useRef(new Animated.Value(0.5)).current;
  const ring3Scale   = useRef(new Animated.Value(0.7)).current;
  const ring3Opacity = useRef(new Animated.Value(0.5)).current;

  // Glow pulse loop
  const glowOpacity  = useRef(new Animated.Value(1)).current;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const spring = (val: Animated.Value, toValue: number, delay = 0) =>
    Animated.spring(val, {
      toValue,
      delay,
      useNativeDriver: false,
      damping: 12,
      stiffness: 120,
    });

  const timing = (
    val: Animated.Value,
    toValue: number,
    duration: number,
    delay = 0,
    easing = Easing.out(Easing.quad)
  ) =>
    Animated.timing(val, {
      toValue,
      duration,
      delay,
      easing,
      useNativeDriver: false,
    });

  const ringWave = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
    Animated.loop(
      Animated.parallel([
        timing(scale, 1.5, 3000, delay, Easing.out(Easing.ease)),
        timing(opacity, 0, 3000, delay, Easing.out(Easing.ease)),
      ])
    );

  const glowLoop = () =>
    Animated.loop(
      Animated.sequence([
        timing(glowOpacity, 0.5, 1500, 0, Easing.inOut(Easing.ease)),
        timing(glowOpacity, 1.0, 1500, 0, Easing.inOut(Easing.ease)),
      ])
    );

  // ── Mount sequence ────────────────────────────────────────────────────────
  useEffect(() => {
    // Hide the native splash once our JS is mounted
    SplashScreen.hideAsync();

    // Start ring waves & glow loop immediately
    ringWave(ring1Scale, ring1Opacity, 0).start();
    ringWave(ring2Scale, ring2Opacity, 1200).start();
    ringWave(ring3Scale, ring3Opacity, 2400).start();
    glowLoop().start();

    // Main entrance sequence
    Animated.sequence([
      // 1. Logo springs in (400 ms delay)
      Animated.parallel([
        timing(logoOpacity, 1, 400, 400),
        spring(logoScale, 1, 400),
        timing(logoRotate, 0, 500, 400, Easing.out(Easing.back(1.5))),
      ]),

      // 2. Top strip fades down
      timing(stripOpacity, 1, 400, 100),

      // 3. App name
      Animated.parallel([
        timing(nameOpacity, 1, 500),
        timing(nameY, 0, 500),
      ]),

      // 4. Tagline
      Animated.parallel([
        timing(tagOpacity, 1, 500),
        timing(tagY, 0, 500),
      ]),

      // 5. Gold divider expands
      timing(dividerW, 120, 500, 0, Easing.out(Easing.ease)),

      // 6. Feature pills
      Animated.parallel([
        timing(pillOpacity, 1, 500),
        timing(pillY, 0, 500),
      ]),

      // 7. Bottom area + progress bar
      Animated.parallel([
        timing(bottomOpacity, 1, 400),
        timing(progressW, 90, 2000, 100, Easing.inOut(Easing.ease)),
      ]),

      // 8. Flag strip
      timing(flagOpacity, 1, 400),
    ]).start(() => {
      // After all animations, wait 800 ms then call onFinish
      setTimeout(onFinish, 800);
    });
  }, []);

  // ── Derived transforms ────────────────────────────────────────────────────
  const logoRotateDeg = logoRotate.interpolate({
    inputRange: [-8, 0],
    outputRange: ['-8deg', '0deg'],
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Background layers */}
      <View style={styles.bgBase} />
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBot} />
      <View style={styles.bgDots} />

      {/* Ring waves */}
      {[
        [ring1Scale, ring1Opacity],
        [ring2Scale, ring2Opacity],
        [ring3Scale, ring3Opacity],
      ].map(([sc, op], i) => (
        <Animated.View
          key={i}
          style={[
            styles.ring,
            { transform: [{ scale: sc as Animated.Value }], opacity: op as Animated.Value },
          ]}
        />
      ))}

      {/* Top strip */}
      <Animated.View style={[styles.topStrip, { opacity: stripOpacity }]}>
        <View style={styles.stripDot} />
        <Text style={styles.stripText}>Barangay San Roque · Victoria, Laguna</Text>
        <View style={styles.stripDot} />
      </Animated.View>

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { rotate: logoRotateDeg }],
            },
          ]}
        >
          <Animated.View style={[styles.logoGlowRing, { opacity: glowOpacity }]} />
          <Image
            source={require('../assets/615343176_859516540278700_5342692051307596866_n.jpg')}
            style={styles.logoImg}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App name */}
        <Animated.View
          style={[styles.appNameWrap, { opacity: nameOpacity, transform: [{ translateY: nameY }] }]}
        >
          <Text style={styles.appName}>
            {'talk'}
            <Text style={styles.appNameAccent}>2</Text>
            {'us'}
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={{ opacity: tagOpacity, transform: [{ translateY: tagY }] }}
        >
          <Text style={styles.tagline}>AI powered Complaint & Feedback Management</Text>
        </Animated.View>

        {/* Divider */}
        <Animated.View style={[styles.divider, { width: dividerW }]} />

        {/* Feature pills */}
        <Animated.View
          style={[styles.pills, { opacity: pillOpacity, transform: [{ translateY: pillY }] }]}
        >
          {['Reports', 'Alerts', 'Connect'].map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Bottom loading area */}
      <Animated.View style={[styles.bottom, { opacity: bottomOpacity }]}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressW }]} />
        </View>
        <Text style={styles.version}>v1.0.0</Text>
      </Animated.View>

      {/* Philippine flag strip at bottom */}
      <Animated.View style={[styles.flagStrip, { opacity: flagOpacity }]}>
        <View style={[styles.flagSegment, { backgroundColor: '#0038a8' }]} />
        <View style={[styles.flagSegment, { backgroundColor: '#ce1126' }]} />
        <View style={[styles.flagSegment, { backgroundColor: '#fcd116' }]} />
      </Animated.View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const LOGO_SIZE = 190;
const RING_SIZE = 200;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1a3d',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Background
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b1a3d',
  },
  bgGlowTop: {
    position: 'absolute',
    width: width,
    height: 280,
    top: 0,
    backgroundColor: 'rgba(220,160,30,0.06)',
    borderBottomLeftRadius: width / 2,
    borderBottomRightRadius: width / 2,
  },
  bgGlowBot: {
    position: 'absolute',
    width: width,
    height: 220,
    bottom: 0,
    backgroundColor: 'rgba(30,80,220,0.08)',
    borderTopLeftRadius: width / 2,
    borderTopRightRadius: width / 2,
  },
  bgDots: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundColor: 'transparent',
  },

  // Rings
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(220,160,30,0.3)',
    alignSelf: 'center',
    top: height / 2 - RING_SIZE / 2 - 60,
  },

  // Top strip
  topStrip: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stripDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(220,180,60,0.5)',
  },
  stripText: {
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(220,180,60,0.7)',
    textTransform: 'uppercase',
    fontWeight: '500',
  },

  // Logo
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  logoGlowRing: {
    position: 'absolute',
    width: LOGO_SIZE + 20,
    height: LOGO_SIZE + 20,
    borderRadius: (LOGO_SIZE + 20) / 2,
    backgroundColor: 'rgba(220,160,30,0.15)',
  },
  logoImg: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },

  // App name
  appNameWrap: {
    marginBottom: 4,
  },
  appName: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  appNameAccent: {
    color: '#f59e0b',
  },

  // Tagline
  tagline: {
    fontSize: 10,
    color: 'rgba(148,163,184,0.75)',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 24,
  },

  // Divider
  divider: {
    height: 1.5,
    backgroundColor: '#f59e0b',
    marginVertical: 14,
    opacity: 0.6,
  },

  // Pills
  pills: {
    flexDirection: 'row',
    gap: 7,
  },
  pill: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 13,
  },
  pillText: {
    fontSize: 10,
    color: '#fbbf24',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Bottom
  bottom: {
    position: 'absolute',
    bottom: 52,
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    width: 90,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },
  version: {
    fontSize: 9,
    color: 'rgba(148,163,184,0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Flag strip
  flagStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    flexDirection: 'row',
  },
  flagSegment: {
    flex: 1,
  },
});
