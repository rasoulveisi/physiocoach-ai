# Phase 5: Offline Sync, Settings & Quality Gates

## 1. Goal
Implement 100% offline workout logging with background sync queue, build Settings screen, and verify full-stack stability on Android.

---

## 2. Technical Steps

### 2.1 Offline Sync Queue (`src/services/offlineSync.ts`)
- Uses NetInfo / fetch fallback to detect offline gym network status.
- Queues completed sets, session completions, and pain alerts in `AsyncStorage` (`@physiocoach/offline_queue`).
- Automatically re-submits pending logs when internet reconnects.
- Displays a clean offline banner: *"⚡ Offline Gym Mode (Will sync when connected)"*.

---

### 2.2 Settings Screen (`src/screens/settings/SettingsScreen.tsx`)
- Unit Preference toggle (`kg` vs `lbs`).
- Audio Voice Cues toggle (Enable/Disable rest timer speech).
- Haptic Feedback toggle (Enable/Disable vibrations).
- Keep-Awake toggle (Enable/Disable screen wake lock).
- User Profile card and "Sign Out" button.

---

### 2.3 Quality Gates & Release Verification
- Run TypeScript verification: `npx tsc --noEmit`.
- Run Expo project validator: `npx expo-doctor` (or `npx expo config`).
- Verify live run on physical Android smartphone via Expo Go QR code.

---

## 3. Verification & Definition of Done
1. `npx tsc --noEmit` returns **0 errors**.
2. Offline session logs seamlessly persist and sync back to Cloudflare Workers upon reconnect.
3. Git commit: `feat(mobile): add offline sync queue, settings screen, and finalize mobile v1`.
