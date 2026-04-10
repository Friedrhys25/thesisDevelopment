# Card Components Design System
**React Native · Expo · TSX**
Brand color: `#F16F24`

---

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| `--brand` | `#F16F24` | Primary accent, CTAs, badges |
| `--brand-dark` | `#C4541A` | Press state, borders |
| `--brand-light` | `#FDE8D8` | Background tints, icon fills |
| `--brand-muted` | `rgba(241,111,36,0.10)` | Subtle fills, tag backgrounds |
| `--surface` | `#FFFFFF` | Card background |
| `--surface-2` | `#F7F7F5` | Page / list background |
| `--border` | `rgba(0,0,0,0.08)` | Card border |
| `--text` | `#1A1A1A` | Primary text |
| `--text-muted` | `#6B6B6B` | Secondary / caption text |
| `--radius-sm` | `8px` | Stat tiles, tags |
| `--radius-md` | `14px` | Standard cards |
| `--radius-lg` | `20px` | Full-bleed hero cards |
| `--success` | `#34C759` | Positive delta |
| `--danger` | `#FF3B30` | Negative delta |

---

## Press-Hold Animation (Reanimated 3)

All card variants share the same base press interaction. Apply via `useAnimatedStyle` and `Gesture.LongPress`.

```tsx
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

export function usePressAnimation() {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);

  const gesture = Gesture.LongPress()
    .minDuration(80)
    .onBegin(() => {
      scale.value   = withSpring(0.955, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(0.85,  { duration: 100 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
    .onFinalize(() => {
      scale.value   = withSpring(1,  { damping: 12 });
      opacity.value = withTiming(1,  { duration: 150 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return { gesture, animStyle };
}
```

### Base card wrapper

```tsx
import Animated from 'react-native-reanimated';

function PressCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { gesture, animStyle } = usePressAnimation();
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animStyle, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
});
```

---

## Variant 1 — Hero Image Card

A large visual card with a gradient header, live badge, category chip, and a branded CTA button. Best for featured content, course cards, and event listings.

```
┌─────────────────────────────────┐
│  ● LIVE                [Chip]   │  ← gradient header (110dp tall)
│                                 │
├─────────────────────────────────┤
│  Card Title                     │
│  Short supporting description   │
├─────────────────────────────────┤
│  [Tag]                     →    │  ← footer row
└─────────────────────────────────┘
```

**Style rules**

| Property | Value |
|---|---|
| Header height | `110dp` |
| Header background | `linear-gradient(135deg, #F16F24, #E84393, #9B59B6)` |
| Live badge | `rgba(255,255,255,0.25)` fill, white text `10sp` |
| Green dot (live indicator) | `#34C759`, `8dp` diameter, `border: 1.5dp #FFF` |
| Title | `14sp · weight 500 · #1A1A1A` |
| Description | `11sp · #6B6B6B · lineHeight 1.5` |
| Footer border | `0.5dp · rgba(0,0,0,0.08)` |
| CTA button | `28dp circle · bg #F16F24 · white arrow` |
| Tag pill | `bg rgba(241,111,36,0.10) · color #F16F24 · 10sp` |

```tsx
function HeroCard({ title, description, tag }: HeroCardProps) {
  const { gesture, animStyle } = usePressAnimation();
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.heroCard, animStyle]}>
        {/* Header */}
        <View style={styles.heroHeader}>
          <View style={styles.liveDot} />
          <View style={styles.chip}>
            <Text style={styles.chipText}>✦ Featured</Text>
          </View>
        </View>
        {/* Body */}
        <View style={styles.heroBody}>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroDesc}>{description}</Text>
        </View>
        {/* Footer */}
        <View style={styles.heroFooter}>
          <View style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>
          <View style={styles.arrowBtn}><Text style={{ color: '#FFF' }}>→</Text></View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
```

---

## Variant 2 — List Row Card

A compact horizontal card for lists, feeds, and transaction history. Supports grouped rows with a shared container border.

```
┌─────────────────────────────────┐
│  [Avatar]  Title          $24.99│
│            Subtitle       +8.4% │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  [Avatar]  Title          $39.00│
│            Subtitle       -1.2% │
└─────────────────────────────────┘
```

**Style rules**

| Property | Value |
|---|---|
| Avatar size | `44 × 44dp · borderRadius 14` |
| Avatar brand fill | `rgba(241,111,36,0.10) · icon #F16F24` |
| Avatar dark fill | `#1C1C1E · icon white` |
| Avatar green fill | `rgba(52,199,89,0.12) · icon #34C759` |
| Row title | `13sp · weight 500 · #1A1A1A` |
| Row subtitle | `11sp · #6B6B6B` |
| Metric value | `13sp · weight 500 · #1A1A1A` |
| Positive delta | `10sp · #34C759 · weight 500` |
| Negative delta | `10sp · #FF3B30 · weight 500` |
| Row separator | `0.5dp · rgba(0,0,0,0.08)` |

**Interaction note:** each row is independently pressable. Wrap each row in `PressCard` with `borderRadius: 0` and apply the outer container border/radius on the wrapping `View`.

---

## Variant 3 — Stat Grid Card

A `2 × 2` tile grid for dashboard summaries. The top-left tile uses the brand fill as an accent to draw the eye to the primary metric.

```
┌──────────────┬──────────────┐
│  📈          │  ⏱          │
│  $4,280      │  142h        │
│  Earnings    │  Learning    │
│  ↑ 18.3%     │  ↑ 5h today │
├──────────────┼──────────────┤
│  🎯          │  ⭐          │
│  38          │  4.9         │
│  Completed   │  Rating      │
│  ↑ 3 this wk │  ↓ 0.1 pts  │
└──────────────┴──────────────┘
```

**Style rules**

| Property | Value |
|---|---|
| Container | `gap: 8dp · display grid 2-col` |
| Tile `borderRadius` | `8dp` |
| Tile padding | `12dp` |
| Icon size | `18sp · marginBottom 8` |
| Stat value | `18sp · weight 500 · #1A1A1A` |
| Label | `10sp · #6B6B6B · marginTop 2` |
| Trend text size | `10sp · weight 500` |
| **Accent tile bg** | `#F16F24` |
| **Accent tile text** | `rgba(255,255,255,0.9)` |

Each tile is independently pressable via `usePressAnimation`. The accent tile presses to `scale(0.95)`.

---

## Variant 4 — Action + Progress Card

A task/course card with a left accent border, icon header, and an inline progress bar. Good for onboarding flows, learning trackers, and to-do items.

```
┌║────────────────────────────────┐   ← 3dp left border, brand color
│  🚀  Card Title                 │
│      Supporting subtitle text   │
│                                 │
│  ████████████████░░░░░░  68%   │   ← progress bar
│  68% complete      42 min left  │
└─────────────────────────────────┘
```

**Style rules**

| Property | Value |
|---|---|
| Left border | `width 3dp · color #F16F24` |
| Icon size | `22sp` |
| Title | `13sp · weight 500 · #1A1A1A` |
| Subtitle | `11sp · #6B6B6B` |
| Progress track | `height 4dp · bg rgba(0,0,0,0.08) · borderRadius 2` |
| Progress fill | `bg #F16F24 · borderRadius 2` |
| Progress labels | `10sp · #6B6B6B · justify space-between` |

```tsx
function ProgressBar({ value }: { value: number }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withSpring(value, { damping: 20 });
  }, [value]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, barStyle]} />
    </View>
  );
}
```

---

## Spacing & Layout

```
Screen horizontal padding:  16dp
Card gap (in list):         12dp
Card internal padding:      14dp (horizontal) · 12dp (vertical)
Section label margin-top:   24dp
```

---

## Dependencies

```bash
# Install
npx expo install react-native-reanimated
npx expo install react-native-gesture-handler
npx expo install expo-haptics

# babel.config.js — add reanimated plugin last
module.exports = {
  plugins: ['react-native-reanimated/plugin'],
};
```

---

## Quick Reference: Variant Comparison

| Variant | Best for | Key interaction | Accent usage |
|---|---|---|---|
| V1 Hero image | Featured content, events | Press + haptic | Gradient header, CTA button |
| V2 List row | Feeds, transactions, search | Per-row press | Avatar fill, delta color |
| V3 Stat grid | Dashboards, analytics | Per-tile press | Accent tile background |
| V4 Action + progress | Tasks, courses, onboarding | Press + spring bar | Left border + fill bar |