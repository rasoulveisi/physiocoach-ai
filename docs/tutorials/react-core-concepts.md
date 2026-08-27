# React Tutorial — All Core Concepts
*Examples from PhysioCoach AI (`physiocoach-ai-web`). Short sections, simple language.*

---

## 1. Components

A component is a function that returns UI (JSX). Name starts with a capital letter.

```tsx
function Loading() {
  return <span className="animate-pulse">Loading…</span>;
}
```
*(`src/router.tsx`)*

## 2. JSX

JSX looks like HTML but it is JavaScript. Rules:
- One root element per return (use `<>...</>` if needed).
- `{}` embeds any expression.
- `className` instead of `class`. Self-close tags: `<Input />`.

```tsx
<h2 className="text-2xl font-black">{mode === 'login' ? 'Sign In' : 'Register'}</h2>
```
*(`src/pages/AuthPage.tsx`)*

## 3. Props

Props are inputs passed from parent to child. Read-only.

```tsx
<Button type="submit" variant="volt" size="lg" loading={loading}>
  Sign In
</Button>
```

Inside Button they arrive as one object:

```tsx
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, pill, children, ...props }, ref) => (
    <button disabled={disabled || loading} {...props}>{children}</button>
  ),
);
```
*(`src/components/ui/Button.tsx`)*

Notes from this example:
- `variant = 'primary'` → default value when prop is missing.
- `children` → content written between the tags.
- `{...props}` → forwards the rest to the real `<button>`.
- `extends ButtonHTMLAttributes<HTMLButtonElement>` → inherit all native button props in TypeScript.

## 4. State — `useState`

State is data that changes over time. Changing it re-renders the component.

```tsx
const [mode, setMode] = useState<'login' | 'register'>('login');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
```
*(`src/pages/AuthPage.tsx`)*

Rules:
- Never set state during render.
- Setter with the **same value** skips re-render.
- Multiple setters in one handler are batched into one re-render.
- **Updater form** when new value depends on old value:

```tsx
setRemainingSeconds((prev) => prev - 1);
```
*(`src/components/ui/RestTimerHUD.tsx`)*

## 5. Conditional rendering

Three ways:

```tsx
{error && <Toast message={error} />}              // render or nothing
{loading ? <Spinner /> : <Content />}             // choose one
if (!open) return null;                            // whole component off
```
*(AuthPage.tsx, Modal.tsx)*

## 6. Lists and keys

Render arrays with `.map()`. Give each item a stable `key`.

```tsx
{(['login', 'register'] as const).map((tab) => (
  <button key={tab} onClick={() => setMode(tab)}>{tab}</button>
))}
```
*(`src/pages/AuthPage.tsx`)*

Use an ID, not the array index, when items can reorder.

## 7. Events

Pass functions to `onX` props. For forms, block page reload first:

```tsx
async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  // read fields, call API...
}
<form onSubmit={submit}> ... </form>
```
*(`src/pages/AuthPage.tsx`)*

## 8. The async action pattern

Standard shape for any button that calls an API:

```tsx
setLoading(true);
setError('');
try {
  await login({ email, password });
  navigate('/dashboard');
} catch (cause) {
  setError(cause instanceof Error ? cause.message : 'Failed.');
} finally {
  setLoading(false);
}
```
*(`src/pages/AuthPage.tsx`)*

## 9. Forms

This app reads fields at submit time (uncontrolled):

```tsx
const form = new FormData(event.currentTarget);
const email = String(form.get('email')).trim();
```

Controlled way (value lives in state) is also common:

```tsx
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.target.value)} />
```

Both are fine. Controlled is better when other UI must react while typing.

## 10. Lifting state up

When two components need the same data, put state in their closest common parent and pass it down as props. Example: `App` reads `user` once and passes to both navbars.

```tsx
const { user } = useAuth();
<DesktopNavbar user={user} />
<MobileNavbar user={user} />
```
*(`src/App.tsx`)*

## 11. Context — shared state without prop drilling

Create → provide → consume.

```tsx
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

<AuthContext.Provider value={value}>{children}</AuthContext.Provider>

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider.');
  return ctx;
}
```
*(`src/context/AuthContext.tsx`)*

Any component can now call `useAuth()`. The throw-on-missing guard catches wiring mistakes early.

Performance rule: consumers re-render whenever the provider's `value` object identity changes. Wrap it in `useMemo` if the provider renders often:

```tsx
const value = useMemo(() => ({ user, token, login, logout }), [user, token, login, logout]);
```

## 12. Effects — `useEffect`

Runs **after** render. Use it to sync with things outside React (server, timers, browser events).

```tsx
useEffect(() => {
  let cancelled = false;
  const restore = async () => {
    const { user } = await apiClient.get('auth/me');
    if (!cancelled) setUser(user);      // ignore result if unmounted
  };
  void restore();
  return () => { cancelled = true; };   // cleanup
}, []);                                  // [] = run once after mount
```
*(`src/context/AuthContext.tsx`)*

Key points:
- Dependency array controls re-runs. `[a]` → reruns when `a` changes.
- Return a cleanup function to remove listeners/timers.
- Always cancel late async results (the `cancelled` flag).
- Timers pair setup with cleanup:

```tsx
useEffect(() => {
  if (!isRunning) return;
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}, [isRunning]);
```
*(`src/components/ui/RestTimerHUD.tsx`)*

## 13. Refs — `useRef`

A box that survives renders. Changing `.current` does **not** re-render.

```tsx
const finishedFiredRef = useRef(false);
// later, inside a callback:
if (!finishedFiredRef.current) {
  finishedFiredRef.current = true;
  onFinished();                         // fire only once
}
```
*(`src/components/ui/RestTimerHUD.tsx`)*

Use refs for: DOM nodes, timer IDs, "already did X" flags. Use state when UI should update.

## 14. Memoization — `useMemo`, `useCallback`, `memo`

They cache values/functions between renders. Use only when identity matters or work is heavy.

```tsx
const value = useMemo(() => ({ user, token }), [user, token]);   // cache object
const login = useCallback(async (c) => { ... }, [storeSession]); // cache function
```
*(`src/context/AuthContext.tsx`)*

Rule of thumb: memoize props passed to context providers and expensive computations. Skip elsewhere until measured slow.

## 15. Reducers — `useReducer` *(not used in this app)*

Alternative to `useState` for complex state with many transitions. One reducer function decides next state from `(state, action)`:

```tsx
const [state, dispatch] = useReducer(reducer, { step: 1 });
dispatch({ type: 'next' });
```

This app keeps multi-step flows (Onboarding) with several `useState`s instead. Both are valid.

## 16. Custom hooks

Reuse logic by moving hooks into a function named `useX`. This app wraps every context:

```tsx
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}
```
*(`src/context/PreferencesContext.tsx`)*

A fetch hook would follow the same idea: state + effect + return values.

## 17. Lazy state initialization

If the initial value is costly (e.g. reading localStorage), pass a function:

```tsx
const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
  const saved = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
  return saved !== null ? saved === 'true' : true;
});
```
*(`src/context/PreferencesContext.tsx`)*

The function runs only on first render.

## 18. Composition (children)

Components accept JSX through `children` — build generic shells, fill with content:

```tsx
<Modal open={open} title="Swap Exercise" onClose={close}>
  <ExerciseList />                      {/* anything fits here */}
</Modal>
```
*(`src/components/ui/Modal.tsx` usage)*

## 19. Routing — react-router

Route table with nested layouts and guards:

```tsx
export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/auth', element: <AuthPage /> },
  {
    element: <ProtectedRoute />,                  // guard as a layout route
    children: [
      { element: <App />, children: [             // shell with navbar
        { path: '/dashboard', element: <DashboardPage /> },
      ]},
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
```
*(`src/router.tsx`)*

A guard is just a component:

```tsx
export function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  if (isRestoring) return <Loading />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/auth" replace />;
}
```

Navigation tools:
- `<Link to="/plan">` in JSX.
- `const navigate = useNavigate()` in handlers.
- `<Outlet />` marks where child routes render.
- `replace` swaps history entry instead of pushing (used for redirects).

## 20. Calling APIs

One fetch wrapper serves the whole app:

```tsx
const plans = await apiClient.get<WorkoutPlan>('workout-plans/current');
await apiClient.post('auth/login', { email, password });
```
*(`src/services/api-client.ts`)*

Errors arrive typed (`ApiError.problem.status/.detail`) — check status, show messages in state.

## 21. Styling with Tailwind

Classes describe styles directly in JSX. Variants come from lookup records:

```tsx
const variants = { primary: 'bg-lime-400 text-zinc-950', ghost: 'bg-transparent text-zinc-400' };
<button className={clsx('inline-flex items-center', variants[variant], className)} />
```
*(`src/components/ui/Button.tsx`)*

`clsx` joins classes and drops false ones. Responsive prefixes like `hidden md:block` toggle visibility by screen size.

## 22. App entry point

Everything starts in one file:

```tsx
createRoot(root).render(
  <StrictMode>
    <ThemeProvider><AuthProvider><PreferencesProvider>
      <RouterProvider router={router} />
    </PreferencesProvider></AuthProvider></ThemeProvider>
  </StrictMode>,
);
```
*(`src/main.tsx`)*

`StrictMode` double-runs code in dev to expose impure renders and missing cleanups. Provider order = visibility order (inner can use outer).

---

## Quick reference

| Need | Tool |
|---|---|
| Value that updates UI | `useState` |
| Work after render | `useEffect` + cleanup |
| Box across renders | `useRef` |
| Share state widely | Context + custom hook |
| Cache value/function | `useMemo` / `useCallback` |
| Reuse logic | custom `useX` hook |
| Navigate | `<Link>`, `useNavigate` |
| API calls | `apiClient.get/post` |
| Show/hide UI | conditional rendering |
