# Declarative Action Flow (DAF) Specification

The Declarative Action Flow format is a compact, machine-readable JSON specification for executing browser E2E workflows with minimum token usage and deterministic reliability.

---

## 1. Action Types & Schema

Each step in a Declarative Action Flow is an object conforming to one of the following action types:

### `seed_auth`
Injects JWT session tokens and user profile directly into `localStorage`, bypassing login UI forms.
```json
{
  "action": "seed_auth",
  "role": "user",
  "email": "athlete@physiocoach.dev",
  "displayName": "Test Athlete",
  "limitations": ["shoulder_pain", "lower_back_pain"]
}
```
* **Tool Translation**: `evaluate_script` setting `physiocoach_auth_token`, `physiocoach_refresh_token`, and `physiocoach_auth_user`.
* **Token Cost**: ~20 tokens.

---

### `navigate`
Navigates directly to a target path or URL.
```json
{
  "action": "navigate",
  "path": "/builder"
}
```
* **Tool Translation**: `navigate_page({ pageId, url: "http://localhost:5173" + path })`.
* **Token Cost**: ~15 tokens.

---

### `wait`
Waits for an element, text, route, or network condition to settle.
```json
{
  "action": "wait",
  "condition": "text_present",
  "text": "Needs a Few Tweaks",
  "timeoutMs": 15000
}
```
Conditions supported:
- `text_present`: In-browser client-side JS loop checking for text.
- `selector_present`: In-browser loop checking `document.querySelector(selector)`.
- `loading_gone`: In-browser loop checking `!document.querySelector('.loading-spinner')`.
- `network_idle`: Waits for in-flight API calls to complete.
* **Tool Translation**: Single client-side async `evaluate_script` loop.
* **Token Cost**: ~25 tokens (regardless of wait time!).

---

### `click`
Clicks a button, link, or interactive element by selector or text.
```json
{
  "action": "click",
  "selector": "button:has-text('Switch to Cable Fly')",
  "fallbackUid": "11_7"
}
```
* **Tool Translation**:
  1. Primary: `evaluate_script` executing `el.click()` directly on selector.
  2. Fallback: single `take_snapshot` to resolve `uid`, then `click({ uid })`.
* **Token Cost**: ~10 tokens (direct) or ~500 tokens (fallback).

---

### `fill`
Fills a text field or form input.
```json
{
  "action": "fill",
  "selector": "input[placeholder*='Routine Title']",
  "value": "My Custom Hypertrophy Routine"
}
```
* **Tool Translation**: `evaluate_script` dispatching input events or `fill({ uid, value })`.
* **Token Cost**: ~15 tokens.

---

### `assert`
Performs a targeted assertion without dumping the full page accessibility tree.
```json
{
  "action": "assert",
  "type": "text_contains",
  "selector": "[role='alert']",
  "expected": "Switched to Cable Fly!"
}
```
Assertion types:
- `text_contains`: Asserts `element.textContent` contains string.
- `text_equals`: Asserts exact trimmed text match.
- `route_equals`: Asserts `window.location.pathname === expected`.
- `is_visible`: Asserts element exists and is visible in DOM.
- `attribute_equals`: Asserts attribute value (e.g. `disabled === true`).
* **Tool Translation**: `evaluate_script` returning `{ pass: boolean, actual: string }`.
* **Token Cost**: ~15 tokens.

---

### `screenshot`
Captures viewport visual evidence for final milestone review.
```json
{
  "action": "screenshot",
  "name": "custom_plan_saved_view"
}
```
* **Tool Translation**: `take_screenshot({ pageId, format: "webp" })`.
* **Token Cost**: ~10 tokens.

---

## 2. Complete Flow Structure

```json
{
  "flowName": "custom_plan_safety_1click_swap",
  "description": "Verifies AI safety check HUD, shoulder warning, 1-click swap, and plan save",
  "steps": [
    { "action": "seed_auth", "role": "athlete", "limitations": ["shoulder_pain"] },
    { "action": "navigate", "path": "/builder" },
    { "action": "wait", "condition": "text_present", "text": "AI SAFETY EVALUATION", "timeoutMs": 15000 },
    { "action": "assert", "type": "text_contains", "selector": ".score-value, [data-testid='score']", "expected": "85" },
    { "action": "assert", "type": "text_contains", "selector": "[data-testid='warning-badge'], .text-amber-400", "expected": "stress on your shoulder" },
    { "action": "click", "selector": "button:has-text('Switch to Cable Fly')" },
    { "action": "assert", "type": "text_contains", "selector": "[role='alert']", "expected": "Switched to Cable Fly!" },
    { "action": "click", "selector": "button:has-text('Save')" },
    { "action": "wait", "condition": "selector_present", "selector": "button:has-text('Keep My Choices & Save')" },
    { "action": "click", "selector": "button:has-text('Keep My Choices & Save')" },
    { "action": "wait", "condition": "text_present", "text": "Custom Hypertrophy Blueprint" },
    { "action": "assert", "type": "route_equals", "expected": "/plan" },
    { "action": "screenshot", "name": "saved_plan_active" }
  ]
}
```
