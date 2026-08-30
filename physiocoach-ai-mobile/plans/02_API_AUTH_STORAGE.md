# Phase 2: API Client, Authentication & Persistent Storage

## 1. Goal
Establish a robust HTTP client connecting to `physiocoach-ai-api`, implement JWT authentication flow, and manage persistent storage using `AsyncStorage`.

---

## 2. Technical Steps

### 2.1 API Client (`src/api/client.ts`)
- Base URL configuration:
  - Default: `https://physiocoach-ai-api.otconnect.ir/api/v1`
  - Fallback / Dev: Configurable via environment variable or in-app toggle.
- Request Interceptor:
  - Automatically attaches `Authorization: Bearer <accessToken>` if available.
  - Adds `x-request-id: <uuid>` for medical audit traceability.
- Response Interceptor:
  - Handles `401 Unauthorized` token expiry and triggers silent refresh using `/auth/refresh` or logs out cleanly.
  - Formats error payloads to return traceable `traceId`.

---

### 2.2 Auth Context & Storage (`src/context/AuthContext.tsx`)
- Storage Keys (`@physiocoach/access_token`, `@physiocoach/refresh_token`, `@physiocoach/user_profile`).
- Methods:
  - `login(email, password)` $\rightarrow$ calls `POST /auth/login`, stores tokens in `AsyncStorage`, sets user state.
  - `register(email, password, name)` $\rightarrow$ calls `POST /auth/register`.
  - `logout()` $\rightarrow$ clears storage and resets navigation state to Auth Stack.
  - `checkAuthStatus()` $\rightarrow$ runs on app startup to restore session without flickering.

---

### 2.3 Auth Screens (`src/screens/auth/`)
- `LoginScreen.tsx`:
  - Minimalist dark form (Email, Password).
  - "Demo Quick Login" button for instant testing.
  - Error alert banners with clear B1-level messaging.
- `RegisterScreen.tsx`:
  - Quick signup form (Name, Email, Password).
  - Navigation link to switch between Login and Register.

---

## 3. Verification & Definition of Done
1. `npx tsc --noEmit` returns **0 errors**.
2. Successfully logs in against live production API (`https://physiocoach-ai-api.otconnect.ir`) and persists tokens across app reboots.
3. Git commit: `feat(mobile): implement api client, jwt auth context, and login/register screens`.
