# Part 1 — The React Render Model
### PhysioCoach AI Masterclass (Part 1 of 6)

Everything in React follows from one sentence:

> **A component is a function that React calls on every render, and the state that survives
> between those calls lives somewhere else — inside React, not inside your function.**

This part makes that sentence concrete using three real files: the app's entry point, a
design-system button, and the login page. By the end you will be able to predict, for any
change to props or state, exactly which functions re-execute, in what order, and what the
DOM does or does not do about it.

---

## 1.1 Mounting the application — `src/main.tsx` (verbatim)

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ThemeContextProvider } from './context/ThemeContext';
import { router } from './router';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element was not found.');

createRoot(root).render(
  <StrictMode>
    <ThemeContextProvider>
      <AuthProvider>
        <PreferencesProvider>
          <RouterProvider router={router} />
        </PreferencesProvider>
      </AuthProvider>
    </ThemeContextProvider>
  </StrictMode>,
);
```

*(The production file also registers a PWA service worker after render; omitted here as it is
not relevant to the render model.)*

What actually happens, in execution order:

1. **Module graph loads.** All `import` statements resolve first: contexts, router, pages,
   CSS. Nothing has rendered yet; no component function has run.
2. **`createRoot(root)`** creates a *root* — the object through which React owns and manages a
   DOM subtree. React will never touch DOM nodes outside this subtree.
3. **`.render(<element>)`** schedules an initial render pass. The JSX `<StrictMode>…</StrictMode>`
   is not HTML and not executed code — it is a plain JS object (`React.createElement` output)
   describing what to render. This distinction matters: JSX is a **description**, rendering is
   **execution**.
4. React walks the element tree, calling each component function, collecting the returned
   descriptions, until it reaches leaf nodes (`<button>` etc.), then **commits**: creates real
   DOM nodes and inserts them under `#root`.
5. After commit, effects run (Part 2).

### StrictMode

`<StrictMode>` changes nothing in production. In development it deliberately **invokes
component functions twice** and mounts effects twice, so that impure renders and missing
effect cleanup announce themselves immediately. The rule it enforces: *render must be pure;
effects must be idempotent-and-cleaned*. You will see its double-invocations in logs; they are
a feature, not noise.

### Provider stacking

Providers are ordinary components whose render returns
`<SomeContext.Provider value={…}>{children}</SomeContext.Provider>` (you'll see the pattern in
Part 2). Nesting gives visibility direction: inner components can consume outer context,
never the reverse. Here every authenticated route can read theme, auth, and preferences.

---

## 1.2 Components, props, and composition — `src/components/ui/Button.tsx` (verbatim)

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'volt' | 'amber';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'xs';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  pill?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-lime-400 text-zinc-950 hover:bg-lime-300 font-extrabold shadow-sm active:scale-[0.98]',
  volt: 'bg-lime-400 text-zinc-950 hover:bg-lime-300 font-extrabold shadow-sm active:scale-[0.98]',
  secondary: 'bg-zinc-900 text-zinc-100 border border-zinc-800 hover:bg-zinc-800 hover:text-white font-bold active:scale-[0.98]',
  outline: 'border border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:border-lime-400 hover:text-lime-400 font-bold active:scale-[0.98]',
  amber: 'bg-amber-500 text-zinc-950 hover:bg-amber-400 font-extrabold active:scale-[0.98]',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 font-bold active:scale-[0.98]',
  ghost: 'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 font-bold active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-8 px-3 text-xs rounded-lg',
  sm: 'h-9 px-3.5 text-xs rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-12 px-6 text-sm sm:text-base rounded-xl',
  icon: 'size-10 rounded-xl p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, pill, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-bold tracking-tight transition-all duration-150 select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        pill && 'rounded-full',
        className,
      )}
      {...props}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
```

### Props are an immutable input object

One argument, conventionally named `props`: a frozen snapshot of the attributes written at the
call site. Destructuring in the parameter list is idiomatic. Note what the component does when
it wants different values: it never mutates props; it renders differently from them. When a
parent re-renders and passes new props, React re-calls `Button` with the new object. Props flow
one way: parent → child.

`ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>` is the standard idiom for
wrappers around native elements: you inherit all legitimate `<button>` attributes
(`type`, `onClick`, `aria-*`, …) with correct types, then add your own. The spread
`{...props}` forwards everything not destructured onto the real `<button>`, so callers can use
this component anywhere a native button works — including accessibility attributes.

### Default values

`variant = 'primary'` applies per-call when the prop is `undefined`. Defaults live in one place
and every call site stays terse.

### Conditional JSX

JSX is expressions, not templates. `{loading && <span …/>}` evaluates left-to-right: if
`loading` is falsy, nothing renders; if truthy, the spinner renders as a child. Three idioms
cover all conditional UI:
- `{condition && <X/>}` — include or not,
- `{condition ? <A/> : <B/>}` — choose between two,
- early `return null` for whole-component suppression (you will see this in `Modal.tsx`,
  Part 2).

### The lookup-record pattern

```
const variants: Record<ButtonVariant, string> = { … }
className={clsx(base, variants[variant], sizes[size], pill && 'rounded-full', className)}
```

Instead of nested ternaries, variant → class-string maps keyed by a union type. TypeScript
makes a typo'd key a compile error and an unhandled variant impossible (`Record` requires
every key). `clsx` concatenates conditional classes and drops falsy entries
(`pill && 'rounded-full'`). `className` last means caller classes can override via Tailwind's
conflict resolution. This exact pattern recurs across the whole `components/ui/` directory —
learn it once here.

### Refs and `forwardRef`

Normally a component cannot hand its caller a reference to a DOM node — by design, since
rendering must not reach into imperative territory. `forwardRef` is the sanctioned exception:
the second argument `ref` arrives outside the normal props object and is attached to the
underlying `<button>`. Callers who need programmatic focus or measurement get a real node.
`displayName` keeps devtools labels honest through the forwarding wrapper.

---

## 1.3 State, events, and async actions — `src/pages/AuthPage.tsx` (verbatim)

```tsx
import { useState, type FormEvent } from 'react';
import { Dumbbell, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api-client';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    const name = String(form.get('name') || '').trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (mode === 'register' && !name) return setError('Enter your name.');

    setLoading(true);
    setError('');
    try {
      await (mode === 'login' ? login({ email, password }) : register({ email, password }));
      navigate(mode === 'login' ? '/dashboard' : '/onboarding');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  // … branding panel and Google OAuth button omitted (see §1.5) …

  return (
    <main className="grid min-h-screen bg-obsidian-950 text-white lg:grid-cols-2">
      {/* … left panel elided … */}
      <section className="grid place-items-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-obsidian-700 bg-obsidian-900">
          <CardContent className="p-7 sm:p-9">
            <div className="mb-7 flex rounded-xl border border-obsidian-700 bg-obsidian-950 p-1">
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setError('');
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider transition-all ${
                    mode === tab
                      ? 'border border-volt/30 bg-volt/10 text-volt'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <Input label="Athlete Full Name" name="name" autoComplete="name" placeholder="Alex Morgan" />
              )}
              <Input label="Email Address" name="email" type="email" autoComplete="email" placeholder="athlete@example.com" />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
              />

              {error && <Toast type="error" message={error} onClose={() => setError('')} />}

              <Button type="submit" variant="volt" size="lg" className="w-full mt-2" loading={loading}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
```

### What `useState` really does

`useState(initial)` does two things on first render: creates a slot in React's storage for this
component *instance position*, and returns `[currentValue, setter]`. On every subsequent
render, the initial value is ignored and React hands back whatever was last set. Crucially:
the value is a **snapshot of this render**. If three renders happen while a network request is
in flight, each render's `submit` closure sees its own era's `mode`/`loading` — closures
capture the render's constants. This is the single most productive source of React bugs and we
will provoke it deliberately in Part 2's timer exercise.

Setting state does not change a variable; it schedules a re-render. During one event handler,
three consecutive setters cause **one** re-render (automatic batching), executing the
component function once with all updates applied.

### Controlled form flow

The form is uncontrolled (values live in the DOM; `FormData` reads them at submit time), while
everything *around* the form — mode tabs, error banner, submit-button spinner — is controlled
React state. Both approaches coexist naturally: pick per-field pragmatism. The handler shows
the canonical async-action shape used throughout this codebase and most React apps:

```
validate synchronously → setLoading(true) → await work → success navigation | error state → finally setLoading(false)
```

`event.preventDefault()` stops full-page submission because React owns the screen. Errors are
just state: `setError(message)` re-renders, the toast appears; there is no imperative "show
error" API anywhere.

### Derived rendering

The tab highlight, the conditional name field, the button label — all are pure functions of
`mode`. No bookkeeping copies exist ("selectedTabStyle", "wasRegistering"). When you feel the
urge to mirror props into state, don't: derive during render instead.

---

## 1.4 Reconciliation: what the DOM actually does

When `setMode('register')` fires:

1. React re-calls `AuthPage()`.
2. The new element tree differs from the previous one only where `mode` mattered: an extra
   `<Input>`, different tab styling, different labels.
3. React diffs trees positionally. Same component type at the same position = keep the DOM
   node, patch changed attributes. Different type or position = destroy and rebuild.
4. **Keys** stabilize identity across reorderings: in `.map()`, sibling elements need a stable
   `key` so React tracks *which* item moved rather than rewriting the list. Use domain IDs,
   never array indices, whenever items can reorder — index keys silently transpose input state
   across rows.

The cost model follows directly: re-running your component functions is cheap; DOM mutation is
expensive but rare thanks to diffing; therefore write components freely and naturally, and
reserve optimization (memoization, Part 2) for measured problems — usually context fan-out or
huge lists.

---

## 1.5 Imperative escape hatches seen in this file

- **Programmatic navigation:** `const navigate = useNavigate()` — a hook (function provided by
  the router library, valid only inside components). Called after successful login; Part 3
  covers routing properly.
- **Full-page redirect:** the Google button bypasses SPA mechanics entirely —
  `window.location.assign(`${API_URL}/auth/google?returnTo=…`)`. Choosing browser navigation
  over fetch-based flows for an OAuth dance is deliberate: the server responds with a redirect
  chain to Google's consent screen, which cannot happen inside `fetch`.

---

## 1.6 Exercises — break things on purpose

1. **Snapshot capture.** In `AuthPage`, add `setTimeout(() => console.log(mode), 3000)` inside
   the tab `onClick`, click Login, then quickly switch to Register. Which value logs, and why?
   Explain using "state is a snapshot per render".
2. **Purity violation.** Inside the `AuthPage` function body (not a handler), push a line into
   a module-level array and log its length. Enable StrictMode (already on) and explain why the
   count grows twice per render. Move it out — where does side-effectful work belong?
3. **Batching check.** In `submit`, call `setError('x')`, `setLoading(true)` and log between
   them. Count renders with a module counter placed at the top of the component. Predict first.
4. **Key misuse.** Find any `.map()` rendering inputs in the repo, temporarily switch `key`
   from ID to array index, reorder the list, and observe input-state transposition. Restore.
5. **Wrapper ergonomics.** Add a `'xl'` size to `Button` (`Record<ButtonSize,string>` forces
   you to update the map — notice the compiler's help) and use it on the auth form.

---

## 1.7 What you should be able to narrate now

- The full sequence: module load → createRoot → render schedule → component calls → commit.
- Why JSX is data, why render must be pure, what StrictMode double-invocation proves.
- How props travel, how defaults work, how the variants-record + clsx + spread idiom composes.
- What `useState` returns, where the value lives, what setting it triggers, how batching groups updates.
- The canonical async-event-handler shape, and how errors become render output.
- How reconciliation decides to reuse vs rebuild DOM nodes, and what keys protect.
