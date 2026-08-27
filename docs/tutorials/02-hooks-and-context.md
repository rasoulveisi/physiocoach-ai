# Part 2 — Hooks & Context Deep Dive
### PhysioCoach AI Masterclass (Part 2 of 6)

Hooks are the mechanism by which a function component gets persistent capabilities — state,
subscriptions, timers, context — despite being re-executed from scratch on every render.
This part covers the semantics that separate competent React usage from expert React usage:
exact effect timing and cleanup, the stale-closure trap and its fixes, referential identity
and why memoization is load-bearing around Context, and the composition patterns this codebase
uses for modals and inputs.

---

## 2.1 The full hook contract

Rules first, mechanics second:

1. **Call hooks unconditionally at the top level** of a component or another hook — never in
   conditionals, loops, or nested functions. React tracks hooks by *call order* per component;
   a conditional call shifts the order and corrupts the mapping between your code and its
   storage slots. Conditional *behavior* is fine: `if (!isRunning) return;` inside an effect is
   normal; a conditional `useEffect()` is not.
2. **Only from function components** (or custom hooks). Hooks are how components talk to the
   render engine; plain modules have no render engine.

Now the individual mechanisms, each shown from production code.

---

## 2.2 `useEffect`: synchronization with cleanup and race protection

`src/context/AuthContext.tsx` (verbatim excerpt):

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  // Sync React state with silent background refreshes performed by api-client.
  // Declared before the restore effect so listeners are active while it verifies the session.
  useEffect(() => {
    const handleSessionUpdated = (event: Event) => {
      const data = (event as CustomEvent<Partial<AuthSession>>).detail;
      if (!data?.accessToken) return;
      setToken(data.accessToken);
      if (data.user) setUser(data.user);
    };
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:session-updated', handleSessionUpdated);
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-updated', handleSessionUpdated);
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);
```

### Timing model

Effects run **after commit** — after the DOM has been updated — asynchronously, and in
declaration order. The dependency array controls *when they re-run*:

- `[]` → run once after mount (and again after every unmount-remount cycle).
- `[a, b]` → run after mount AND after any commit where `Object.is(prevA, a)` or
  `Object.is(prevB, b)` is false.
- no array → run after **every** commit (rarely what you want).

Dependencies are compared by value identity (`Object.is`), so objects/arrays/functions created
during render are "new" every render. Passing one as a dep without memoizing it (§2.4) makes
the effect run every time.

### Cleanup: the half most code gets wrong

The returned function runs before the next effect execution and after final unmount. Here it
removes both listeners. Without cleanup, every remount of `AuthProvider` would stack duplicate
listeners — a classic leak that StrictMode's double-mount will surface immediately in dev.

Mental model to adopt: an effect doesn't mean *"do X when the component mounts"*; it means
*"keep X synchronized while these dependencies hold"*. Setup + cleanup = subscribe/unsubscribe
pairs. Anything acquired must be releasable.

### Async race protection

Second effect from the same file (verbatim excerpt):

```tsx
  // Startup restore: hydrate from storage, then verify the access token against the API.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      setToken(storedToken);
      setUser(readStoredUser());

      if (storedToken) {
        try {
          const { user: verified } = await apiClient.get<{ user: User }>('auth/me');
          if (!cancelled && verified) {
            setUser(verified);
            localStorage.setItem(USER_KEY, JSON.stringify(verified));
          }
        } catch {
          /* Stale session: api-client already cleared storage and dispatched auth:session-expired. */
        }
      }
      if (!cancelled) setIsRestoring(false);
    };
    void restore();
    return () => { cancelled = true; };
  }, []);
```

An async effect always completes *after* its own synchronous body returns. If deps changed
meanwhile (or the component unmounted), the late `await` result belongs to a previous
"synchronization era" and must not touch state. The `cancelled` flag flips in cleanup exactly
at era boundaries. Note also the deliberate ordering comment in the first effect: the listener
effect is declared **before** the restore effect so events fired during restore are not missed
— effects run in declaration order, and this codebase leans on that guarantee explicitly.

---

## 2.3 Refs: values that persist without causing renders

`useRef(initial)` returns `{ current: initial }` — the *same object* on every render. Writing
`.current` does not schedule a render. That makes refs the correct home for two kinds of data:

1. **Instance handles:** DOM nodes (`forwardRef`, Part 1), interval IDs, third-party widgets.
2. **Cross-render flags that must not trigger rendering:** "did we already fire the finish
   callback?"

Both uses appear in `src/components/ui/RestTimerHUD.tsx` (excerpt):

```tsx
const finishedFiredRef = useRef(false);

useEffect(() => {
  if (!isRunning) return;

  const timer = setInterval(() => {
    setRemainingSeconds((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        setIsRunning(false);
        setIsFinished(true);

        if (!finishedFiredRef.current) {
          finishedFiredRef.current = true;
          if (soundEnabled) soundCueService.playTimerCompleteChime();
          if (onFinished) onFinished();
        }
        return 0;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [isRunning, soundEnabled, onFinished]);
```

Study this effect; it contains four lessons at once:

- **Interval lifecycle:** `setInterval` in setup, `clearInterval` in cleanup. When `isRunning`
  toggles, teardown runs then fresh setup — pause/resume falls out of dependency changes for
  free.
- **Functional setState:** `setRemainingSeconds(prev => …)` receives the freshest committed
  value rather than whatever snapshot the closure captured. Inside a 1-second interval you
  cannot know which render's snapshot you have; the updater form removes the doubt.
- **Side effects inside the state updater?** Yes here — deliberately. The updater may run more
  than once under StrictMode, which is precisely why the `finishedFiredRef` guard exists: the
  chime and `onFinished` fire once even if React double-invokes the updater. A ref guard makes
  an idempotent-once side effect out of a potentially-repeated one.
- **Deps honesty:** `soundEnabled` and `onFinished` are listed because the closure reads them.
  Omitting them would freeze stale values ("stale closure" — §2.5); listing them restarts the
  interval when they change, which is semantically correct here.

Also note the reset pattern earlier in the file: when props change (`initialSeconds`,
`autoStart`), a dedicated effect resynchronizes local state to the new props. State initialized
from props needs this explicit sync — there is no automatic "props changed" hook, by design:
React treats prop-derived state as something you either avoid (derive during render instead)
or manage deliberately like this.

---

## 2.4 Identity, memoization, and Context economics

`src/context/AuthContext.tsx` (verbatim excerpt):

```tsx
  const storeSession = useCallback((session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
    if (session.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.accessToken);
    setUser(session.user);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    storeSession(await apiClient.post<AuthSession>('auth/login', credentials, { token: null }));
  }, [storeSession]);
```

```tsx
  const value = useMemo(
    () => ({
      user, token, isAuthenticated: Boolean(token), isRestoring,
      login, register, logout, setSession: storeSession, updateUser,
    }),
    [user, token, isRestoring, login, register, logout, storeSession, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
```

### Why identity matters

Every object/function created in a render body is a new instance. Without `useMemo`, the
provider's `value` would be a fresh object **every time AuthProvider renders**, even when its
contents were unchanged. And the cost lands on consumers: when Provider `value` differs by
identity, **every component reading that context re-renders** — regardless of whether the
pieces they use changed.

`AuthProvider` re-renders whenever token/user change (its own state). With memoization:
- `login/register/logout/storeSession/updateUser` have stable identities across all renders
  (empty or stable deps), so…
- `value` only changes when `user/token/isRestoring` genuinely change — exactly the moments
  consumers *should* re-render.

Remove the `useMemo` (exercise 3 below) and every unrelated provider render pushes a new
`value` through the whole consumer tree. This is the case where memoization is load-bearing,
not decorative. Contrast with `PreferencesContext` (below), where the same pattern appears but
with a subtler flaw worth studying.

### The updater form and side effects in updaters

`updateUser` uses `setUser(prev => …)` and persists to localStorage *inside* the updater.
Under StrictMode the updater may run twice; writing the same derived value twice is harmless —
but this only stays safe because the write is idempotent. General rule: updaters must be pure
computations of next-state; external writes belong in handlers or effects. This file bends the
rule knowingly for atomicity (state and storage never diverge); understand the trade before
imitating it.

---

## 2.5 The stale-closure trap, formally

A closure captures variables from the render in which it was created. Any callback that
outlives that render — interval ticks, event listeners, promises resolving later, timeouts —
reads frozen values unless you use one of the escapes:

| Escape | Mechanism | Use when |
|---|---|---|
| Functional setState | React passes freshest state into the updater | Updating based on current state |
| Ref | Same mutable box across renders | Flags/handles read by long-lived callbacks |
| Honest deps | Effect restarts, closures rebuilt | Callbacks that should track changing values |

The `RestTimerHUD` effect above demonstrates all three simultaneously. You will build the bug
yourself in exercise 1 and feel the difference.

---

## 2.6 Context done twice: the disciplined version and the instructive flaw

`src/context/PreferencesContext.tsx` (verbatim, condensed):

```tsx
const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
    return (localStorage.getItem(STORAGE_KEYS.UNIT_SYSTEM) as UnitSystem) || 'metric';
  });
  // … three more useState blocks with lazy initializers …

  const setUnitSystem = (unit: UnitSystem) => {
    setUnitSystemState(unit);
    localStorage.setItem(STORAGE_KEYS.UNIT_SYSTEM, unit);
  };

  const formatWeight = (weightKg: number) => { /* pure conversion using unitSystem */ };

  return (
    <PreferencesContext.Provider
      value={{ unitSystem, setUnitSystem, defaultRestSeconds, /* … */ formatWeight }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesState {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider');
  return context;
}
```

What this teaches beyond AuthContext:

- **Lazy state initializers:** `useState(() => …)` defers the initializer until first render —
  the right form when initialization reads `localStorage` (or anything non-trivial). The
  argument form would read storage on *every* render just to discard the value.
- **Write-through persistence:** setters update state and storage together, so persistence is
  invisible to every consumer. Components just call `setSoundEnabled(true)`.
- **Derived helpers in context:** `formatWeight` closes over `unitSystem`; consumers get unit-
  aware formatting without knowing the unit system themselves.
- **The instructive flaw:** `value` is a bare object literal and the setters are bare functions
  — recreated every provider render. Since preferences change rarely, the practical damage is
  small; but notice the inconsistency with AuthContext and ask *why* it still works: because
  provider renders are rare. Frequency of provider renders, not dogma, decides how hard to
  memoize. Also note the missing dep arrays would fail exhaustive-deps lint — AuthContext is
  the stricter standard.
- **The custom-hook guard clause:** `createContext(undefined)` + throw-if-missing turns a
  wiring mistake into an immediate, named error instead of a mysterious crash three screens
  later. Both contexts do this; copy it everywhere.

### Consuming

`useContext(Context)` returns the nearest ancestor Provider's current `value` — the snapshot
from the current render. Any consumer re-renders when that identity changes (§2.4). Scoping
rule of thumb: keep high-frequency state (keystrokes, animation) out of context consumed by
wide trees; pass it down as props, co-locate it, or split contexts (stable API parts vs
fast-changing data parts).

---

## 2.7 Composition patterns: generic shell + specific content

`src/components/ui/Modal.tsx` (verbatim):

```tsx
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose(): void;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxSizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-2xl' };

export function Modal({ open, title, children, onClose, footer, maxWidth = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 sm:p-4 backdrop-blur-md animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="modal-title"
        className={`w-full ${maxSizes[maxWidth]} max-h-[90vh] flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl animate-scale-in overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-zinc-800/90 p-4 sm:p-5">
          <h2 id="modal-title" className="text-lg sm:text-xl font-black tracking-tight text-white">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"
            className="text-zinc-400 hover:text-white"><X className="h-5 w-5" /></Button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 sm:gap-3 border-t border-zinc-800/90 p-3.5 sm:p-4 bg-zinc-950/60">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}
```

Three techniques, all idiomatic React:

1. **`children` as a typed slot.** The modal knows nothing about swap-exercise lists or plate
   calculators; callers inject arbitrary JSX via the `children` prop (type `ReactNode`). The
   caller's JSX is created in the caller's render — so modal content re-renders with its
   parent automatically. Specialized modals (`ExerciseSwapModal`, `PlateCalculatorModal`) are
   thin wrappers composing `Modal` with their content.
2. **Conditional whole-component render.** `if (!open) return null;` after hooks — hooks stay
   unconditional (rule §2.1), the output vanishes. Note the effect guards `if (!open) return;`
   internally too, so listeners attach only while open.
3. **DOM-event bridging.** Escape-to-close and backdrop-click-to-close wire browser events into
   React callbacks. The backdrop handler checks `e.target === e.currentTarget` — clicks on
   children bubble, and only a click landing on the backdrop itself may close.

And `src/components/ui/Input.tsx` adds label/id plumbing worth copying:

```tsx
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    return (
      <label className="block text-sm font-semibold text-slate-300" htmlFor={inputId}>
        {label && <span className="…">{label}</span>}
        <input ref={ref} id={inputId} className={clsx(/* error ? red border : normal */)} {...props} />
        {error ? <span className="mt-1 block text-xs text-red-400">{error}</span>
               : hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      </label>
    );
  },
);
```

`useId()` generates SSR-safe unique IDs so `<label htmlFor>` binds correctly even when the same
form renders multiple times. Error/hint display is pure derivation from props — no imperative
validation UI anywhere.

---

## 2.8 Exercises

1. **Build the stale-closure bug.** Write a counter component: `useState(0)`, an interval that
   logs `count` from a plain closure every second, and a button incrementing count. Watch the
   log freeze at the captured value. Fix it twice — functional setState, then a ref — and be
   able to say what each fix changes about *where the value comes from*.
2. **Leak it.** In `Modal`, delete the cleanup line from the keydown effect. Open/close the
   modal five times, press Escape once, count how many close calls fire. Explain via
   setup/cleanup pairing, then restore.
3. **Break the provider.** In `AuthContext`, replace `const value = useMemo(…)` with a plain
   object literal. Put `console.log` in a deep consumer's render (e.g. Navbar). Toggle theme /
   cause unrelated provider renders and watch the consumer re-render. Restore. Write down the
   rule: *context value identity is the re-render signal*.
4. **Race it.** On any page, add a button firing two sequential awaits updating the same state;
   add navigation away between them (or simulate with a quick unmount). Observe the warning /
   wrong-state outcome; add the `cancelled` flag; verify.
5. **Split a context.** Design a two-part split of PreferencesContext (stable setters vs
   frequently-read values) and argue whether it is justified at real usage frequency. Defending
   a "not worth it" verdict is the actual skill.
6. **StrictMode forensics.** Add logs to render bodies and effect setup/cleanup of
   `RestTimerHUD`; run dev; explain every doubled line. Then reason about why the
   `finishedFiredRef` guard is still required even though effects double-run.

---

## 2.9 Narration check

Without opening files, explain: effect timing relative to commit; what cleanup guarantees; how
the `cancelled` flag prevents cross-era state writes; why interval-based countdowns need
functional setState; where refs belong vs state; why `value` identity governs consumer
re-renders and how useCallback/useMemo stabilize it; why lazy initializers fit localStorage;
how children-slots compose specialized modals from a generic shell.
