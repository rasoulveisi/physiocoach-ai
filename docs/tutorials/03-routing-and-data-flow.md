# Part 3 — Routing & Client-Side Data Flow
### PhysioCoach AI Masterclass (Part 3 of 6)

Two systems move the user and the data in this app: a declarative route table that decides
*what renders at which URL*, guarded by plain components; and a single hand-written fetch
module through which **all** server communication flows — including token storage, silent
refresh, request deduplication, and a decoupled bridge back into React state. This part covers
both, then traces a complete round trip.

---

## 3.1 The route table — `src/router.tsx` (verbatim)

```tsx
import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { useAuth } from './context/AuthContext';
import { AdminPage } from './pages/AdminPage';
import { AssessmentPage } from './pages/AssessmentPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PlanPage } from './pages/PlanPage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 font-bold text-white">
      <span className="animate-pulse">Loading PhysioCoach…</span>
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
}

export function PublicRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <PublicRoute />,
    children: [{ path: '/auth', element: <AuthPage /> }],
  },
  { path: '/oauth-callback', element: <OAuthCallbackPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <App />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/assessment', element: <AssessmentPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/plan', element: <PlanPage /> },
          { path: '/session', element: <SessionPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/admin', element: <AdminPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
```

### Layout routes and `<Outlet />`

Routes without a `path`, carrying only `element` + `children`, are *layout routes*: they render
purely to wrap their children. `ProtectedRoute` renders either `<Outlet />` (a placeholder
meaning "render the matched child here") or a redirect. Guards are therefore just components
making a render-time decision from context state — no separate guard API exists, because none
is needed. The same mechanism nests `App` (the chrome) inside protection and pages inside
`App`.

### The two redirect flavors

- `<Navigate to="/auth" replace />` renders nothing; it performs a URL change during render.
- `replace` rewrites the current history entry instead of pushing. For guards this matters:
  after being bounced from `/dashboard` to `/auth`, Back returns to `/` (landing), not into the
  page that immediately bounces you again — no redirect loops, no dead history entries.
- The `'*'` route catches unknown paths; it also uses `replace` so junk URLs don't pollute
  history.

### Guard state machine

Read `ProtectedRoute` as a three-state machine over auth context:
`isRestoring → Loading` (session verification still in flight — no decision possible yet),
`authenticated → Outlet`, else `→ /auth`. Rendering `Loading` while restoring is what prevents
a logged-in user from being flickered to `/auth` on every hard refresh. `PublicRoute` is the
mirror image: an already-authenticated visitor to `/auth` is sent to `/dashboard`.

### Navigation APIs

- `<Link to>` for declarative navigation (see Navbar); prevents default anchor behavior and
  drives client-side transitions.
- `useNavigate()` for imperative navigation inside handlers (`navigate('/dashboard')`
  post-login, Part 1).
- URL state vs component state: pages like Session use params/query when the state should be
  shareable/bookmarkable; everything ephemeral stays in `useState`. The router owns the URL;
  React owns the rest.

---

## 3.2 The layout shell — `src/App.tsx` (verbatim)

```tsx
import { Outlet } from 'react-router-dom';
import { DesktopNavbar, MobileNavbar } from './components/ui/Navbar';
import { useAuth } from './context/AuthContext';

export function App() {
  const { user } = useAuth();
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-50 font-sans selection:bg-lime-400 selection:text-zinc-950 overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden md:block shrink-0 z-30">
        <DesktopNavbar user={user} />
      </div>

      {/* Main Page Viewport Container */}
      <main className="flex-1 flex flex-col min-h-0 w-full overflow-hidden relative">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden shrink-0 z-40">
        <MobileNavbar user={user} />
      </div>
    </div>
  );
}
```

One shell, two navbars toggled purely by CSS breakpoints (`hidden md:block` / `md:hidden`) —
no JS media queries, both always rendered, visibility handled by styles. Pages mount into
`<Outlet />`; switching routes swaps only that subtree, so navbar state persists across
navigation. `user` comes from context and flows down as props into navbars — contexts feed
shells, props feed leaves.

---

## 3.3 The data layer — `src/services/api-client.ts`

This module is the entire networking story of the app, and one of the most instructive files in
the repository. Read it whole, then the commentary.

```ts
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return '/api/v1';
  }
  return 'https://physiocoach-ai-api.otconnect.ir/api/v1';
}

export const API_URL = getApiBaseUrl();
export const AUTH_TOKEN_KEY = 'physiocoach_auth_token';
export const REFRESH_TOKEN_KEY = 'physiocoach_refresh_token';
export const USER_KEY = 'physiocoach_auth_user';

export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
  }
}
```

### Environment resolution

`import.meta.env.VITE_API_URL` is Vite's compile-time environment injection (only variables
prefixed `VITE_` are exposed to client bundles). Resolution order: explicit env var →
same-origin relative path on localhost (which the dev proxy forwards, Part 0) → production
origin. One codebase serves local dev, preview builds, and production without conditionals
scattered through calling code.

### Typed error envelope

`ProblemDetails` mirrors the RFC 7807 shape the API emits (Part 4). `ApiError` wraps it,
exposing `.problem.status/.title/.detail` to UI code — so a 409 "profile incomplete" can drive
navigation while a 400 drives a toast, all via typed fields instead of string matching.
Full-stack symmetry: the server's error funnel and the client's parser agree on one contract.

Now the core:

```ts
// Endpoints that manage their own session lifecycle never trigger the silent-refresh flow.
const SESSION_PATHS = new Set(['auth/login', 'auth/register', 'auth/refresh']);

const isSessionPath = (path: string): boolean => SESSION_PATHS.has(path.replace(/^\//, ''));

function clearStoredTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface AuthAttempt { response: Response; payload: unknown; }

async function sendRequest(path: string, method: string, options: ApiRequestOptions, token: string | null): Promise<AuthAttempt> {
  const { body, headers, ...init } = options;
  const response = await fetch(`${API_URL}/${path.replace(/^\//, '')}`, {
    ...init,
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = (response.headers.get('content-type') || '').includes('json');
  const payload: unknown = isJson ? await response.json() : await response.text();
  return { response, payload };
}
```

Straightforward so far: build headers conditionally with spreads, encode JSON bodies, sniff the
response content type before parsing. Note `fetch` does **not** reject on HTTP error statuses —
only on network failure — hence returning `{response, payload}` pairs and deciding below.

```ts
// Silent refresh mutex: at most one /auth/refresh call in flight; concurrent 401s join the shared promise.
let refreshPromise: Promise<string | null> | null = null;

async function performSilentRefresh(): Promise<string | null> {
  try {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      clearStoredTokens();
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      return null;
    }

    const attempt = await sendRequest('auth/refresh', 'POST', { body: { refreshToken }, token: null }, null);
    const data = typeof attempt.payload === 'object' && attempt.payload !== null ? attempt.payload : {};
    if (!attempt.response.ok || !data.accessToken) {
      throw new Error(toProblem(attempt.payload, attempt.response).detail || 'Silent refresh failed.');
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    if (data.user !== undefined && data.user !== null) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('auth:session-updated', { detail: data }));
    return data.accessToken;
  } catch {
    clearStoredTokens();
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    return null;
  } finally {
    refreshPromise = null;
  }
}

function requestSilentRefresh(): Promise<string | null> {
  if (!refreshPromise) refreshPromise = performSilentRefresh();
  return refreshPromise;
}
```

### The single-flight refresh mutex

Scenario: access token expires while eight parallel GETs are outstanding. All eight get 401.
Naive design fires eight concurrent `/auth/refresh` calls; with rotating refresh tokens
(Part 5) each rotation invalidates the previous token, so callers race and most lose — mass
logout. The fix is a shared promise: the first 401 assigns `refreshPromise`; every other 401
awaits *the same promise*; exactly one refresh occurs; all callers retry with the new token.
`finally` clears the slot for the next expiry cycle. This pattern — memoizing a promise to
dedupe async work — recurs across frontend engineering (cache stampedes, lazy singletons).

```ts
// In-flight GET request deduplicator
const inFlightGets = new Map<string, Promise<any>>();

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const allowRefresh = !isSessionPath(path);
  const token = options.token !== undefined ? options.token : localStorage.getItem(AUTH_TOKEN_KEY);
  const cacheKey = method === 'GET' ? `${token || 'anon'}:${path}` : null;

  if (cacheKey && inFlightGets.has(cacheKey)) {
    return inFlightGets.get(cacheKey)! as Promise<T>;
  }

  const promise = (async () => {
    try {
      let attempt = await sendRequest(path, method, options, token);

      if (attempt.response.status === 401 && allowRefresh) {
        const refreshedToken = await requestSilentRefresh();
        if (refreshedToken) attempt = await sendRequest(path, method, options, refreshedToken);
      }

      if (!attempt.response.ok) throw new ApiError(toProblem(attempt.payload, attempt.response));
      return attempt.payload as T;
    } finally {
      if (cacheKey) inFlightGets.delete(cacheKey);
    }
  })();

  if (cacheKey) inFlightGets.set(cacheKey, promise);
  return promise;
}

export const apiClient = {
  get: <T>(path: string, options?) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path, body?, options?) => apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path, body?, options?) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path, options?) => apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
```

Second deduplication layer, orthogonal to the first: identical concurrent GETs share one
promise via a keyed Map (deleted in `finally`). Two components mounting simultaneously and
requesting the same resource produce a single network call. Note what is deliberately absent:
no response cache (freshness stays simple), no retries beyond the refresh-retry, no interceptors
— complexity added strictly where this app needed it.

Also note `allowRefresh`: login/register/refresh themselves never trigger refresh recursion —
a failed login must surface its 401, not silently rotate.

---

## 3.4 Bridging the service layer into React — CustomEvents

The fetch module is plain TypeScript with **zero React imports**. When session state changes
out-of-band (silent refresh succeeded, or refresh failed and the session died), it broadcasts:

```ts
window.dispatchEvent(new CustomEvent('auth:session-updated', { detail: data }));
window.dispatchEvent(new CustomEvent('auth:session-expired'));
```

…and `AuthProvider` (Part 2) subscribes:

```tsx
window.addEventListener('auth:session-updated', handleSessionUpdated);
window.addEventListener('auth:session-expired', handleSessionExpired);
```

Why not import the context directly? Because the dependency direction would invert: services
would know about React. With events, `api-client.ts` remains testable in isolation and usable
outside components; React opts in by listening. This is a pragmatic pub/sub seam between a
framework-free service layer and framework-bound UI. Alternatives exist (callback registries,
state libraries); understand the trade this codebase chose: minimal machinery, explicit event
names, listeners cleaned up on unmount.

---

## 3.5 Full round trip: sign-in

Every layer from Part 1–3 participates, in order:

1. **`AuthPage.submit`** — validate, `setLoading(true)`.
2. **`useAuth().login({email, password})`** — context method.
3. **`apiClient.post('auth/login')`** — `sendRequest` builds headers (no token attached:
   `{ token: null }` was passed explicitly), POSTs JSON.
4. Vite proxy forwards `/api/v1/*` to :8787 (dev).
5. Server responds `{ accessToken, refreshToken, user }` (Part 5 shows the server half).
6. **`storeSession`** writes three localStorage keys and sets two states — identity flip.
7. Re-render: `isAuthenticated` true → router's `ProtectedRoute` passes → `navigate('/dashboard')`
   swaps the subtree under `<Outlet />`.
8. **Later:** access token expires; some GET 401s; single-flight refresh runs once;
   original request retries transparently; `auth:session-updated` syncs AuthContext.

If you can narrate steps 1–8 including the failure branch (refresh fails → storage cleared →
`auth:session-expired` → state nulled → guard redirects to `/auth`), you have the client side
of this architecture cold.

---

## 3.6 Exercises

1. **Redirect loop forensics.** Temporarily remove `replace` from `ProtectedRoute`'s
   `<Navigate>`. Hard-refresh `/dashboard` while logged out; walk the history with Back and
   explain the loop you can create; restore.
2. **Guard gap hunt.** Move `AdminPage`'s route outside `ProtectedRoute`'s children. What
   renders for anonymous users, and where does the failure appear (render? API 401? both)?
   Restore — and note how client guards are UX, while the server check (Part 5) is security.
3. **Dedupe demo.** Add temporary logging to `apiRequest`. Mount two components fetching the
   same endpoint in the same tick; verify one network call. Then add a cache-busting query to
   one caller and explain why the key diverges.
4. **Mutex test.** Simulate expiry: set a garbage `physiocoach_auth_token` in localStorage but
   keep a valid refresh token; fire four concurrent requests through `apiClient`; count
   `/auth/refresh` network calls (should be 1). Explain the shared-promise line responsible.
5. **Error envelope end-to-end.** Trigger a validation failure (register with weak password).
   Follow the `ProblemDetails` from server response → `ApiError` → `catch` in `AuthPage` →
   toast. List every file the error passed through.
6. **Design critique.** Write a half-page: what breaks in this client as the app scales to
   dozens of server-state consumers (no cache invalidation, manual loading flags everywhere),
   and which library category addresses it. Knowing *when the hand-rolled approach stops
   fitting* is part of mastering it.
