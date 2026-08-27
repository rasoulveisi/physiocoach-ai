# PhysioCoach AI — React & Express Masterclass
## Course Guide (Part 0 of 6)

This six-part course teaches modern React and modern Express.js by walking through a real,
production-grade codebase: **PhysioCoach AI**, an AI-powered physiotherapy workout platform.
Every code sample in this course is taken verbatim from that repository. Nothing is simplified
or invented; when a topic needs context, the surrounding production code is included so you
can see how the technique behaves under real requirements.

The course assumes you are already an experienced software engineer: you understand HTTP,
authentication architecture, relational databases, validation strategy, testing, and
dependency wiring. We therefore spend **zero** time on general programming concepts and all of
our time on what is specific to React and Express: their execution models, their idioms, their
failure modes, and the engineering judgment encoded in this codebase.

---

## 1. The system at a glance

PhysioCoach AI has two deployable units:

| Unit | Directory | Stack | Role |
|---|---|---|---|
| `physiocoach-ai-web` | web client | React 19, TypeScript, Vite, react-router-dom v7, Tailwind CSS | SPA: landing, auth, onboarding, health assessment, dashboard, plan viewer, live workout session tracker, settings |
| `physiocoach-ai-api` | backend | Express 5, TypeScript, Drizzle ORM, PostgreSQL (Neon), zod, jose | REST API under `/api/v1`: auth (password + Google OAuth), profiles, assessments, AI workout-plan generation via OpenRouter, exercise catalog, admin |

A deliberate property of the web app: it has **no Redux, no TanStack Query, no Zustand**.
Global state is plain React Context; server interaction is a hand-written `fetch` wrapper.
This makes it an ideal specimen for learning React's own primitives deeply instead of
library APIs. You can add libraries later; first learn what they are built on.

A deliberate property of the API: it is genuine Express 5, with one deployment twist — it runs
on Cloudflare Workers through a Node.js compatibility bridge (`httpServerHandler`). Locally it
behaves exactly like a normal Express server listening on a port; we treat the Worker bridge
as an advanced aside, not a distraction.

### How the two halves talk

During development:

1. The web app runs on Vite's dev server (port 5173).
2. `vite.config.ts` proxies every `/api/*` request to the API on port 8787:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } } },
});
```

3. The browser only ever sees same-origin URLs like `/api/v1/auth/login`; the proxy makes
   CORS a non-issue locally. In production the client calls the deployed API origin directly
   (see `getApiBaseUrl()` in Part 3).

---

## 2. Repository map (only what matters for this course)

```
physiocoach-ai-web/
  index.html                 ← single HTML page the SPA mounts into
  src/
    main.tsx                 ← entry point: createRoot, providers, router
    App.tsx                  ← authenticated layout shell (navbar + <Outlet/>)
    router.tsx               ← route table + auth guards
    index.css                ← Tailwind entry
    components/ui/           ← design-system primitives (Button, Input, Card, Modal…)
    context/                 ← AuthContext, PreferencesContext, ThemeContext
    pages/                   ← one module per screen (Auth, Dashboard, Session…)
    services/api-client.ts   ← fetch wrapper: tokens, silent refresh, dedup

physiocoach-ai-api/
  src/
    index.ts                 ← Worker entry: bridges Express onto Cloudflare
    app.ts                   ← THE Express application assembly (start here)
    middleware/auth.ts       ← JWT verification → req.user
    middleware/error.ts      ← centralized error funnel (RFC 7807)
    routes/                  ← one router per resource + express-adapter + validation
    auth/                    ← tokens (jose), sessions (rotation), passwords, rate limit
    db/                      ← Drizzle schema, client, migrations
    services/                ← business logic (workout-generator, OpenRouter integration)
  tests/                     ← vitest integration tests against the real app
```

---

## 3. Course structure and dependency order

Read the parts in order; later parts assume vocabulary from earlier ones.

| Part | Title | You will learn |
|---|---|---|
| 0 | Course Guide (this document) | Orientation, setup, how to study |
| 1 | The React Render Model | What a component really is: render → commit, props, state snapshots, JSX, events |
| 2 | Hooks & Context Deep Dive | useEffect semantics, refs, memoization, context re-render economics, custom hooks |
| 3 | Routing & Client-Side Data Flow | Route tables, guards, layouts, and a production fetch client with silent token refresh |
| 4 | The Express Request Pipeline | Middleware composition, routing, validation, centralized error handling |
| 5 | Auth Engineering & the Data Layer | JWT issuing/verification, rotating refresh sessions, rate limiting, Drizzle ORM, service layer, testing |

Each part ends with **exercises that break things on purpose**. Doing them is the point:
predict the failure, cause it, observe it, explain it, revert it.

---

## 4. Running the code

```bash
# Terminal 1 — API (port 8787)
cd "apps/PhysioCoach Ai/physiocoach-ai-api"
npm install
npm run dev            # wrangler dev; consult the api README for required env vars

# Terminal 2 — Web (port 5173)
cd "apps/PhysioCoach Ai/physiocoach-ai-web"
npm install
npm run dev
```

Useful checks once both are up:

- `GET http://localhost:8787/api/v1/health` → JSON with database response time.
- Opening `http://localhost:5173` → landing page; register a local account and you will be
  walked into onboarding. In local dev mode the API's auth middleware accepts requests without
  tokens (see Part 5 for exactly why and where that shortcut lives).

---

## 5. How to study this material

1. **Read the code first, prose second.** Each section quotes a complete file or a marked
   excerpt, then explains it. Try to narrate the code to yourself before reading the
   explanation; check your story against ours.
2. **Trace, don't skim.** For every request/response pair discussed, follow it through every
   layer by hand. Part 5 closes with a full-stack trace of sign-in; being able to reproduce
   that trace from memory is the exit criterion of the whole course.
3. **Break things deliberately.** Comment out a middleware; remove a dependency from a hook;
   return invalid data. Predict first, then observe. React and Express both fail in
   *characteristic* ways; you need to recognize those signatures on sight.
4. **Keep a mechanisms journal.** After each part, write three sentences: what executes,
   when, and why it is designed that way. If you cannot, re-read that section.

Conventions used in these documents: code blocks labeled `(verbatim)` are copied unchanged
from the repository; excerpts are marked with `…` elisions; file paths are relative to the
repository root shown in §2.
