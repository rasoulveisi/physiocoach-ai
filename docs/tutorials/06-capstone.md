# Part 6 — Capstone: Build, Then Graduate
### PhysioCoach AI Masterclass (Part 6 of 6)

Parts 1–5 taught mechanisms; this part makes you prove them by building. Three graded builds,
each a vertical slice through more of the system than the last, followed by the graduation
checklist. Work against the real repo with both dev servers running (Part 0 §4).

Ground rules for all builds: TypeScript strict, zod at every boundary, thin routes, no new
libraries unless stated — the point is to exercise the primitives you have learned, not to
escape them.

---

## Build A — Exercise Library (client-heavy)

**Goal:** a protected `/exercises` page listing the catalog from the real API.

1. **Route & shell.** Add `{ path: '/exercises', element: <ExercisesPage /> }` inside
   `ProtectedRoute`'s `App` children (`src/router.tsx`); add navigation in both navbars.
2. **Fetch.** Use `apiClient.get('exercises')` (the alias middleware maps it to
   `/exercise-catalog/exercises`). Model the item type from the actual response shape — check
   `routes/exercise-catalog.ts` and its types; do not guess fields.
3. **States.** Implement loading (skeletons exist: `components/ui/Skeleton.tsx`), error (toast),
   empty, and success states explicitly. The canonical async shape from Part 1 applies:
   load-in-effect with cancellation flag (Part 2's race protection).
4. **Derived UI.** Add a client-side search box filtering rendered items. One state variable
   (`query`) only — filtering is derived during render (Part 1 §1.3).
5. **Custom hook.** Extract `useExerciseCatalog()` into `src/services/` or `src/hooks/`;
   the page becomes presentation-only. Reuse the CustomEvent pattern if you need out-of-band
   refresh signaling.

**Passing bar:** typing fast never shows stale/out-of-order results; two components mounting
simultaneously produce one network call (verify via the dedup logger from Part 3's exercise 3);
guards behave correctly when logged out.

---

## Build B — Notes on the Server (server-heavy)

**Goal:** a small authenticated resource, built with full backend discipline.

1. **Schema.** New table `training_notes`: `id` (text PK), `userId` FK→users cascade, `content`
   text with max length enforced in zod AND the DB column, `...timestamps`. Follow
   `schema.ts` conventions exactly.
2. **Migration.** `npm run db:generate`; inspect the generated SQL like a reviewer, then
   `db:migrate:local`.
3. **Router.** `src/routes/notes.ts` using `createExpressRouter()` (the adapter): 
   - `GET /notes` — list caller's notes, newest first;
   - `POST /notes` — validate `{ content: z.string().min(1).max(2000) }` via
     `parseJsonPayload`, insert with `userId = context.get('authUser').id`;
   - `DELETE /notes/:id` — delete **only if owned by caller** (ownership check in the WHERE,
     not read-then-decide).
4. **Mount** in `app.ts` under `/api/v1`. Note what you did *not* write: zero error handling —
   throwing paths flow to the funnel automatically (Part 4). Force one failure on purpose and
   confirm the problem+json envelope arrives.
5. **Test.** One vitest integration test through `.fetch()`: create → list → delete → 404 on
   repeat delete, modeled on `tests/express-app.test.ts`.

**Passing bar:** another user's note ID returns 404 (not 403, not success) — decide and justify
which is correct; invalid payloads return fielded issues; the route file contains no business
logic beyond delegation.

---

## Build C — Full-stack slice: profile field

**Goal:** add one meaningful profile field end-to-end. Every part of the course appears.

Suggested field: `injuryFlags` (array of strings) or `preferredWorkoutTime` — pick something the
assessment flow could plausibly use.

1. Column + migration (Drizzle workflow).
2. Extend the profiles route contract (`routes/profiles.ts` + its zod schemas) — read how the
   existing fields flow first; match the house style precisely.
3. Surface it in the settings form (`pages/SettingsPage.tsx`): controlled input, optimistic
   local state update on save, error rollback path.
4. Persist through `apiClient.patch`, handle validation errors by mapping `issues[]` onto the
   field (the contract from Parts 3–4).
5. Verify persistence across reload and across accounts (field isolation between users).

**Passing bar:** narrate your own change over the Part 5 §5.9 trace diagram — where your field
enters each layer, who validates it, where identity checks happen.

---

## Graduation checklist

Answer each without opening the files. Any hesitation marks your re-read target.

**Render model**
- [ ] Full sequence from module load to DOM commit; what StrictMode double-invocation proves.
- [ ] Why render must be pure; three legal escapes for side effects (handlers, effects, refs).
- [ ] State snapshots vs closures; batching; reconciliation reuse rules; key discipline.

**Hooks & context**
- [ ] Effect timing relative to commit; cleanup guarantees; deps semantics (`Object.is`).
- [ ] The cancelled-flag race fix; functional setState; ref guard patterns (timer specimen).
- [ ] Context value identity → consumer re-renders; where useMemo/useCallback are load-bearing.
- [ ] Lazy initializers; children-as-slot composition; useId for label binding.

**Routing & data flow**
- [ ] Layout routes, Outlet, guards as components, `replace` semantics, restore-state Loading.
- [ ] Single-flight refresh mutex; GET dedup Map; ProblemDetails → ApiError symmetry.
- [ ] The service↔React CustomEvent seam and why dependency direction matters.

**Express pipeline**
- [ ] All fourteen layers of app.ts in order, each one's contribution; order-is-semantics cases.
- [ ] Async-handler error contract; decorated errors; funnel classification ladder; RFC 7807.
- [ ] Parse-don't-validate with compile-time output types; thin-controller discipline.

**Auth & data**
- [ ] HS256 signing/verification with pinned algorithms; sid-bound access tokens.
- [ ] Opaque hashed rotating refresh tokens; reuse detection; why frontend single-flight matters.
- [ ] Dummy-hash enumeration defense; fixed-window limiter mechanics and honest limits.
- [ ] Drizzle schema-first workflow; pool settings rationale; contracts around nondeterminism.
- [ ] Integration testing through `.fetch()` against assembled apps.

---

## Where to go next

With these fundamentals, library adoption becomes deliberate rather than desperate:

- **Server state:** TanStack Query replaces hand-rolled caching/dedup/loading flags once many
  consumers share endpoints — you now understand exactly which of its problems it solves
  (compare its mutex/cache with api-client's).
- **Forms:** react-hook-form + zod resolvers formalize the AuthPage pattern at scale.
- **API layer:** OpenAPI generation already exists in this repo (`openapi.ts`); explore
  generating typed clients from it.
- **React internals:** rendering strategies (memo/startTransition/Suspense) — you have the
  execution model to reason about them; this codebase deliberately doesn't need them yet.
- **Express depth:** streaming, file uploads, background jobs, and the Workers adapter's
  constraints as real deployment topics.

Final advice: keep the mechanisms journal going. When a framework misbehaves, the engineer who
can say *what executes, when, and why* debugs from evidence instead of folklore.
