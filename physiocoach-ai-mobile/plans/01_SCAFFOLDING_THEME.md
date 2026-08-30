# Phase 1: Project Scaffolding & Native Design System

## 1. Goal
Initialize `physiocoach-ai-mobile` using **Expo SDK 52 + TypeScript**, install necessary native packages, and build the Precision Dark Theme foundation.

---

## 2. Technical Steps

### 2.1 Project Initialization
1. In workspace root:
   ```bash
   npx create-expo-app@latest physiocoach-ai-mobile --template blank-typescript
   ```
2. Install Navigation & Native Dependencies:
   ```bash
   cd physiocoach-ai-mobile
   npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
   npm install react-native-screens react-native-safe-area-context
   npm install lucide-react-native
   npm install expo-haptics expo-speech expo-keep-awake expo-status-bar
   npm install @react-native-async-storage/async-storage
   ```

---

### 2.2 Dark Theme Tokens (`src/theme/colors.ts`, `src/theme/typography.ts`)
- Palette constants:
  - `bgPrimary`: `#090D15` (Deep Black Canvas)
  - `bgSurface`: `#121722` (Card / Surface)
  - `bgElevated`: `#182030` (Modal / Dropdown / Floating HUD)
  - `borderSubtle`: `rgba(255, 255, 255, 0.08)`
  - `accentVolt`: `#10E760` (Primary Action & Completed States)
  - `accentAmber`: `#F59E0B` (Warning / Moderate Effort)
  - `accentCyan`: `#06B6D4` (Telemetry & Stats)
  - `accentRed`: `#EF4444` (Pain Alert / Deload Indicator)
  - `textPrimary`: `#F8FAFC`
  - `textSecondary`: `#94A3B8`
  - `textMuted`: `#64748B`

---

### 2.3 Reusable UI Components (`src/components/ui/`)
- `Button.tsx`: Variants (`volt`, `secondary`, `outline`, `ghost`, `danger`), with loading spinner and disabled state.
- `Card.tsx`: Styled surface container with subtle border.
- `Badge.tsx`: Compact pill badge for tags (`Volt`, `Amber`, `Cyan`, `Zinc`).
- `ScreenContainer.tsx`: SafeAreaView wrapper with `#090D15` background.
- `Header.tsx`: Screen title, subtitle, and optional right-side action icon.

---

### 2.4 Root Navigation Shell (`src/navigation/RootNavigator.tsx`)
- Tab Navigator with 5 tabs:
  1. **Dashboard** (`Home` icon)
  2. **My Plan** (`Calendar` icon)
  3. **Workout** (`Dumbbell` icon — prominent central button)
  4. **Explore** (`Compass` icon)
  5. **Settings** (`Settings` icon)
- Immersive dark bottom bar styling with `#121722` background and `#10E760` active tint.

---

## 3. Verification & Definition of Done
1. `npx tsc --noEmit` returns **0 errors**.
2. App boots cleanly in Expo Go with dark theme and bottom navigation visible.
3. Git commit: `chore(mobile): scaffold expo project with dark design tokens and navigation shell`.
