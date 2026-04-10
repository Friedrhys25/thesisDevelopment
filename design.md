# Talk2Kap App Design Architecture

This document summarizes the UI/UX design architecture and styling patterns found across the `app/(tabs)` screens in the **Talk2Kap** application. The app adopts a modern, clean, and highly accessible user interface built for React Native and Expo.

## 1. Global Color Palette
A centralized `COLORS` object is consistently declared across screens, maintaining a cohesive theme:
- **Primary / Brand:** `#F16F24` (A vibrant Orange/Tangerine, used for headers, active states, buttons, etc.)
- **Backgrounds:**
  - `bg`: `#FFFFFF` (Main screen backgrounds)
  - `card`: `#FFFFFF` (Surface container backgrounds)
- **Text:**
  - `text`: `#111827` (Dark Gray/Black for primary headings and body)
  - `muted`: `#6B7280` (Lighter gray for subtitles, placeholders, and secondary info)
- **Borders & Dividers:** `#E5E7EB`
- **Feedback & Status:**
  - `accent`: `#FBE451` (Yellow accents, badges)
  - `danger`: `#EF4444` (Red for emergency actions and error states)
  - `success`: `#10B981` (Green for verified/approved states)
  - `warning`: `#F59E0B` (Amber for pending states/important notices)

## 2. Navigation Layout (`_layout.tsx`)
- **Type:** Custom Floating Pill Bottom Tab Bar
- **Design:** Instead of a traditional edge-to-edge bottom bar, the app features a floating center-aligned "pill" shape positioned above the bottom safe area.
- **Interactions:**
  - Uses `Animated.spring` to slide an "active bubble" behind the selected tab icon.
  - Icons scale up `1.15x` and translate upwards slightly (`-3px`) when active.
  - Native haptic feedback (`expo-haptics`) triggers on selection.
- **Responsive:** Scales width up to a max of `560px` for tablets/web, and reveals text labels dynamically.

## 3. Screen Structure & Layout
Almost all tab screens follow a consistent foundational layout:
- **Wrapper:** `SafeAreaView` from `react-native-safe-area-context` to handle modern device notches.
- **Scroll Container:** Vertically rolling `Animated.ScrollView` or `ScrollView` with `showsVerticalScrollIndicator={false}`.
- **Refresh Control:** Standard pull-to-refresh mapped to the app's primary color.

### **Headers**
- **Parallax Header (`home.tsx`):** Large headers combining `Animated.View` and interpolation to create parallax scrolling. Features a completely immersive background color (`COLORS.primaryDark`) ending in deep bottom-border radii (`borderBottomLeftRadius`, `borderBottomRightRadius` = `26px`). Features a prominent transparent logo overlay (`rgba(0,0,0,0.18)`).
- **Flat Header (`emergency.tsx`):** Uses a solid `#F16F24` padded container ending in the same `26px` bottom radii.
- **Gradient Overlay Header (`profile.tsx`):** Uses a large background `Image` with extreme blur (`blurRadius={30}`) overlaid perfectly by a translucent `LinearGradient` (using `rgba(241, 111, 36, 0.85)`). It creates a highly polished glassmorphic contrast point for avatars.

### **Cards ("Surface" Containers)**
Cards are frequently used to group content (e.g., service grids, profiles, emergency contacts):
- **Base Style:** White background (`#FFFFFF`), rounded corners (`borderRadius: 20px` to `22px`), and subtle drop shadows (opacity `0.04`, radius `8`).
- **Interaction:** Uses a custom `AnimatedCard` wrapper or `Pressable` combining slight scale-down (`0.95`) and opacity adjustments on press, delivering tactile feedback.
- **Dividers:** Soft grey 1px horizontal lines (`rgba(229,231,235,0.7)`) are commonly utilized between list items inside cards.

## 4. Notable UI Components

### **Premium 911 Slide Button (`emergency.tsx`)**
- A highly custom "Hold to Call" slider built for critical emergencies.
- **Mechanism:** Integrates `Pressable` with deep red (`COLORS.danger`) aesthetics. Requires the user to press and hold for 1.5 seconds minimum to trigger the emergency call link to avoid accidental dials.
- Uses `Animated.timing` to visually fill a tracking bar while holding.

### **InfoRow List Item (`profile.tsx`)**
- A highly reusable component inside cards that displays an icon, label, and value.
- **Design:** Icons are placed in small, slightly rounded soft gray boxes (`#F3F4F6`, `borderRadius: 12`). Labels feature aggressive tracking (`letterSpacing: 0.6`) and are styled in `uppercase`. Includes optional inline Action Pills (like "Edit") utilizing a compact `paddingVertical: 8` style.

### **Status Pills (`profile.tsx`)**
- Used heavily for account verification status.
- **Design:** Instead of solid badges, it takes the status color (Success, Danger, or Warning) and applies it to the text, a small dot icon, and adds a `+1A` hex-code equivalent background to give a beautiful soft glow effect (e.g., `#10B9811A`).

### **Forms and Inputs**
- **Text Inputs:** Padded heavily (`paddingHorizontal: 16`), thick height (`56px`), with light gray borders (`#E5E7EB`) and soft curved radii (`12px` to `16px`).

### **Modals & Overlays (`profile.tsx`)**
- Both Logout and Edit Modals are uniform.
- **Backgrounds:** They use absolute fill overlays with `rgba(0,0,0,0.55)` ensuring focus on the modal content.
- **Modal Cards:** A clean white card mapped to max width `420px`, full width `100%`, and padding `18px-24px`.
- **Action Buttons:** Utilizes a dense row of symmetric flat buttons stretching equally, with a neutral option (Cancel) matching the muted palette, and a primary option (Save/Log Out) mapping to the theme's core primary or danger color.

## 5. Typography and Micro-Interactions
- Uses system font faces mapped to highly readable weights (`fontWeight: '800' or '900'` for massive headers, `'700'` for labels, and `'500'` for muted body text).
- **Micro-Interactions:** Custom animated opacities, skeleton loading screens (visible in `home.tsx` handling auth loading), and color-coded status badges (`Profile` ID verification status mapping to Success/Warning/Danger colors).

## Summary
Talk2Kap heavily emphasizes an inviting, citizen-friendly interface. The application avoids sharp squared corners in favor of generous, smooth border radii (`16px`-`999px`) and vibrant, high-contrast actions, ensuring accessibility across different age groups within the community.