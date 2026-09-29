# Token-Efficient Browser E2E Recipes

Ready-to-use snippets for common browser testing workflows with Chrome DevTools MCP.

---

## 1. Fast Auth Seeding (Skip Login UI)

Instead of navigating through login pages, seed `localStorage` directly in the browser:

```ts
// 1. Obtain token via API
// curl -s -X POST http://localhost:8787/api/v1/auth/oauth/exchange ...

// 2. Inject directly into page
evaluate_script({
  pageId: 2,
  function: `() => {
    localStorage.setItem('physiocoach_auth_token', '${TOKEN}');
    localStorage.setItem('physiocoach_refresh_token', '${REFRESH_TOKEN}');
    localStorage.setItem('physiocoach_auth_user', JSON.stringify({
      id: 'test-athlete-uuid',
      email: 'athlete@physiocoach.dev',
      displayName: 'Test Athlete',
      role: 'user',
      roles: ['user']
    }));
    return { authenticated: true };
  }`
});
```

---

## 2. In-Browser Async Polling (Zero LLM Turns)

Instead of calling `take_snapshot` or `sleep` in consecutive agent turns, let the browser loop wait internally and return a single boolean:

```ts
evaluate_script({
  pageId: 2,
  function: `async () => {
    const timeout = 15000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const scoreEl = document.querySelector('[data-testid="safety-score"], h2, .score');
      if (scoreEl && !scoreEl.textContent.includes('Checking') && !scoreEl.textContent.includes('Evaluating')) {
        return { settled: true, score: scoreEl.textContent.trim() };
      }
      await new Promise(r => setTimeout(r, 250));
    }
    return { settled: false, timeout: true };
  }`
});
```
*Token cost: ~25 tokens for the single call and response, replacing 5–8 snapshots (~15,000+ tokens).*

---

## 3. Micro-Verification of UI Feedback & Toasts

Verify that a button click produced the right result without re-snapshotting the whole page:

```ts
evaluate_script({
  pageId: 2,
  function: `() => ({
    url: window.location.pathname,
    toast: document.querySelector('[role="alert"]')?.textContent?.trim() || null,
    modalOpen: !!document.querySelector('[role="dialog"], .fixed.inset-0'),
    buttonDisabled: document.querySelector('button[type="submit"]')?.disabled
  })`
});
```
*Token cost: ~30 tokens.*

---

## 4. Safe Single Snapshot Pattern

When you DO need to find element UIDs:

```ts
// Step 1: Ensure DOM is settled
await evaluate_script({
  pageId: 2,
  function: "() => document.readyState === 'complete' && !document.querySelector('.animate-spin')"
});

// Step 2: Take ONE snapshot to get UIDs
const snapshot = await take_snapshot({ pageId: 2 });

// Step 3: Act on specific UID found in snapshot
await click({ pageId: 2, uid: "12_15" });
```
