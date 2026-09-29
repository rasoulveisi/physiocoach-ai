---
name: token-efficient-browser-e2e
description: >-
  Guides live browser end-to-end testing using Chrome DevTools MCP with minimum token consumption.
  Enforces Declarative Action Flow (DAF) JSON execution, pre-flight auth seeding, targeted micro-assertions
  via evaluate_script, and client-side async waiting to eliminate blind snapshot polling.
---

# Token-Efficient Browser E2E Testing Skill

This skill governs how to execute live, real-flow browser end-to-end tests using Chrome DevTools MCP with **maximum reliability and 75%–85% token savings** by executing **Declarative Action Flows (DAF)**.

---

## 1. The Token Problem in Browser Automation

Traditional agentic browser testing consumes massive tokens (20,000–35,000+ tokens per test) because:
1. **Blind Polling Snapshots**: Calling `take_snapshot` repeatedly while waiting for an API or LLM request dumps 2,000–4,000 tokens of accessibility tree into context on *every call*.
2. **Auth Redirect Ping-Pong**: Navigating to protected routes without pre-seeding `localStorage` triggers redirects to `/auth`, wasting turns troubleshooting.
3. **Ambiguous Natural Language Prompts**: Open-ended conversational instructions force the agent to spend hundreds of tokens guessing what to click and how to verify results.
4. **Stale UID Errors**: Reusing element UIDs from earlier snapshots after DOM re-renders leads to failures and forced snapshot re-queries.

### Token Math: Traditional vs. Declarative Action Flow

| Phase | Traditional Natural Language Flow | Declarative Action Flow (DAF) | Savings |
| :--- | :--- | :--- | :--- |
| **Auth Setup** | Navigate to `/auth`, snapshot, fill inputs, submit, snapshot | `seed_auth` step via 1 `evaluate_script` | **~4,500 tokens (90%)** |
| **Route Load** | Snapshot on load, snapshot during loading, snapshot settled | `navigate` + lightweight `wait` | **~4,500 tokens (75%)** |
| **Action & Wait**| Click, snapshot, snapshot, snapshot waiting for API/LLM | `click` + client-side async wait | **~6,000 tokens (85%)** |
| **Verification** | Full page snapshot dumping entire DOM | `assert` micro-check via `evaluate_script` | **~2,500 tokens (95%)** |
| **Total Test** | **18,000 – 32,000 tokens** | **2,000 – 4,500 tokens** | **~85% Total Reduction** |

---

## 2. Declarative Action Flow (DAF) Architecture

Tests are defined as a **compact, machine-readable JSON flow** where every step specifies an exact action, target selector, and expected assertion.

### Core Strengths of DAF for AI Agents
* **Zero Parsing Ambiguity**: No natural language ambiguity. The action, selector, and expected values are exact.
* **Minimal Prompt Footprint**: Concise JSON keys (`action`, `selector`, `expected`) maximize prompt density and minimize token waste.
* **Direct Tool Mapping**: Each DAF step translates 1:1 into a single, minimal MCP tool call.
* **Predictable Execution**: The agent executes each step sequentially without speculative exploratory turns.

### DAF Action Mapping Matrix

| DAF Action | Purpose | Exact MCP Tool Call | Response Tokens |
| :--- | :--- | :--- | :--- |
| `seed_auth` | Injects JWT tokens & user into `localStorage` | `evaluate_script` | ~20 tokens |
| `navigate` | Moves to target app path | `navigate_page({ pageId, url })` | ~15 tokens |
| `wait` | Waits for text/selector to appear client-side | `evaluate_script` (async loop) | ~25 tokens |
| `click` | Triggers element click | `evaluate_script` or `click({ uid })` | ~10 tokens |
| `fill` | Sets input field value | `fill({ uid, value })` or `evaluate_script` | ~15 tokens |
| `assert` | Checks DOM text, route, or visibility | `evaluate_script` returning `{ pass }` | ~15 tokens |
| `screenshot` | Captures viewport visual evidence | `take_screenshot({ pageId, format: "webp" })` | ~10 tokens (file ref) |

---

## 3. The 5 Core Rules of Token Conservation

### Rule 1: The Rule of the Single Decisive Snapshot
* **Never** call `take_snapshot` to poll or check "if something changed".
* Call `take_snapshot` at most **ONCE per interactive milestone**, strictly **after** the DOM has settled, and only when dynamic UIDs are needed.

### Rule 2: Micro-Assertions with `evaluate_script`
* A targeted JavaScript check costs **10–25 tokens**. A full accessibility snapshot costs **2,000–4,000 tokens**.
* Query specific elements or values directly:
  ```ts
  // 15 tokens response vs 3,000 tokens snapshot
  evaluate_script({
    pageId,
    function: "() => document.querySelector('[role=\"alert\"]')?.textContent"
  })
  ```

### Rule 3: Client-Side Async Waiting (Zero LLM Turns)
* Run async wait loops **inside the browser process** via `evaluate_script`. The waiting happens client-side without consuming any LLM turns:
  ```ts
  evaluate_script({
    pageId: 2,
    function: `async () => {
      const start = Date.now();
      while (Date.now() - start < 15000) {
        if (document.querySelector('.safety-score')?.textContent) return true;
        await new Promise(r => setTimeout(r, 250));
      }
      return false;
    }`
  })
  ```

### Rule 4: Pre-Flight Auth Seeding
* Never navigate to protected routes unauthenticated. Always execute a `seed_auth` step first to prevent redirect loops.

### Rule 5: Visual Evidence on Milestones Only
* Capture a visual screenshot (`take_screenshot`) only at the final goal state or upon milestone completion, offloading image bytes to disk.

---

## 4. Execution Workflow Example

Here is how an agent executes a standard Declarative Action Flow:

```json
{
  "flowName": "custom_plan_safety_1click_swap",
  "steps": [
    { "action": "seed_auth", "role": "user", "limitations": ["shoulder_pain"] },
    { "action": "navigate", "path": "/builder" },
    { "action": "wait", "condition": "text_present", "text": "AI SAFETY EVALUATION", "timeoutMs": 15000 },
    { "action": "assert", "type": "text_contains", "selector": "main", "expected": "Needs a Few Tweaks" },
    { "action": "click", "selector": "button:has-text('Switch to Cable Fly')" },
    { "action": "assert", "type": "text_contains", "selector": "[role='alert']", "expected": "Switched to Cable Fly!" },
    { "action": "screenshot", "name": "builder_after_1click_swap" }
  ]
}
```

### Execution Steps by the Agent:
1. **Step 1 (`seed_auth`)**: Runs `evaluate_script` to set `physiocoach_auth_token`, `refresh_token`, and user metadata in `localStorage`.
2. **Step 2 (`navigate`)**: Calls `navigate_page` to `http://localhost:5173/builder`.
3. **Step 3 (`wait`)**: Runs in-browser async loop in `evaluate_script` waiting for `"AI SAFETY EVALUATION"`. Returns `{ ready: true }` in 1 turn.
4. **Step 4 (`assert`)**: Runs `evaluate_script` checking `document.querySelector('main').textContent.includes('Needs a Few Tweaks')`. Returns `{ pass: true }`.
5. **Step 5 (`click`)**: Calls `take_snapshot` once to resolve the UID of `button:has-text('Switch to Cable Fly')`, then calls `click({ uid })`.
6. **Step 6 (`assert`)**: Runs `evaluate_script` checking `document.querySelector('[role="alert"]').textContent`. Returns `{ pass: true }`.
7. **Step 7 (`screenshot`)**: Calls `take_screenshot` to save visual evidence.

---

## 5. Reference Files in This Skill

* [**Action Specification (`references/action-spec.md`)**](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/.agents/skills/token-efficient-browser-e2e/references/action-spec.md): Complete schema and supported parameters for each action type.
* [**Production Declarative Flows (`references/declarative-flows.md`)**](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/.agents/skills/token-efficient-browser-e2e/references/declarative-flows.md): Ready-to-execute flows for Plan Builder, Safety Checks, Advisory Save Modals, and Onboarding.
* [**Reusable Browser Recipes (`references/recipes.md`)**](file:///Users/rasoul/rasoul/apps/PhysioCoach%20Ai/.agents/skills/token-efficient-browser-e2e/references/recipes.md): Copy-paste JavaScript snippets for auth injection, client-side polling, and micro-assertions.
