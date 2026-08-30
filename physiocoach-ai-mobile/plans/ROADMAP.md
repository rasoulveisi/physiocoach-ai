# PhysioCoach AI — React Native Mobile Roadmap

## 1. Overview & Objective
`physiocoach-ai-mobile` is the dedicated native mobile application for PhysioCoach AI built with **React Native (Expo SDK 52 + TypeScript)**. It connects to the Cloudflare Worker API (`physiocoach-ai-api`) and provides a zero-latency, offline-first gym workout experience with native haptics, voice cues, and progressive overload intelligence.

---

## 2. Technical Stack
- **Framework**: React Native 0.76 + Expo SDK 52 (TypeScript).
- **Navigation**: React Navigation v7 (Native Bottom Tabs + Native Stack).
- **State & Storage**: React Context + `@react-native-async-storage/async-storage`.
- **Native Hardware Integration**:
  - `expo-haptics`: Tactile vibrations for set check-off and timer completion.
  - `expo-speech`: Text-to-Speech rest timer countdowns and exercise announcements.
  - `expo-keep-awake`: Screen wake lock during active workout sessions.
  - `expo-status-bar`: Immersive dark status bar matching `#090D15`.
- **API & Contracts**: REST API client targeting `https://physiocoach-ai-api.otconnect.ir/api/v1` (and local Worker proxy).
- **Testing Workflow**: Free **Expo Go** app on physical Android device (zero Android Studio/emulator disk footprint on Mac).

---

## 3. Phased Execution Modules

```
physiocoach-ai-mobile/plans/
├── ROADMAP.md                            # Master Overview & Architecture (This File)
├── 01_SCAFFOLDING_THEME.md               # Phase 1: Expo Setup, Dark Design Tokens & Shell
├── 02_API_AUTH_STORAGE.md                # Phase 2: API Client, JWT Auth & Persistent Storage
├── 03_CORE_SCREENS_WORKOUT_ENGINE.md     # Phase 3: Dashboard, Plan, Live Session & Rest Timer
├── 04_EXPLORE_TOOLS_CALCULATOR.md        # Phase 4: Explore Marketplace, 1RM Calculator & Prehab
└── 05_OFFLINE_SYNC_QUALITY_GATES.md      # Phase 5: Offline Sync Queue, Haptics & Verification
```

---

## 4. Quality & Definition of Done
Every phase must satisfy:
1. `npx tsc --noEmit` completes with **0 errors**.
2. Zero unnecessary third-party package bloat.
3. Clean Precision Dark hardware UI theme (`#090D15`, `#121722`, `#10E760`, `#F59E0B`, `#06B6D4`).
4. Discrete git commit at the end of each module.
