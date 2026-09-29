# PhysioCoach AI: Declarative Action Flows

Pre-defined, production-ready Declarative Action Flows for the PhysioCoach AI platform.
Execute these flows directly through the token-efficient browser runner.

---

## Flow 1: Custom Plan AI Safety & 1-Click Swap (`custom_plan_safety_swap.json`)

```json
{
  "flowName": "custom_plan_safety_swap",
  "description": "Verifies AI safety evaluation, shoulder joint warning badge, 1-click swap to Cable Fly, and score recalculation",
  "steps": [
    {
      "action": "seed_auth",
      "role": "user",
      "email": "athlete@physiocoach.dev",
      "displayName": "Google Athlete",
      "limitations": ["shoulder_pain"]
    },
    {
      "action": "navigate",
      "path": "/builder"
    },
    {
      "action": "wait",
      "condition": "text_present",
      "text": "AI SAFETY EVALUATION",
      "timeoutMs": 15000
    },
    {
      "action": "assert",
      "type": "text_contains",
      "selector": "main",
      "expected": "Needs a Few Tweaks"
    },
    {
      "action": "assert",
      "type": "text_contains",
      "selector": "main",
      "expected": "Safety Note:"
    },
    {
      "action": "click",
      "selector": "button:has-text('Switch to Cable Fly'), button:has-text('Switch to Dumbbell Shoulder Press')"
    },
    {
      "action": "assert",
      "type": "text_contains",
      "selector": "[role='alert']",
      "expected": "Switched to"
    },
    {
      "action": "screenshot",
      "name": "builder_after_1click_swap"
    }
  ]
}
```

---

## Flow 2: Non-Blocking Advisory Save Flow (`plan_advisory_save.json`)

```json
{
  "flowName": "plan_advisory_save",
  "description": "Verifies that when saving a plan with safety warnings, the advisory modal displays non-blocking choices and persists user choices",
  "steps": [
    {
      "action": "seed_auth",
      "role": "user",
      "email": "athlete@physiocoach.dev",
      "displayName": "Google Athlete"
    },
    {
      "action": "navigate",
      "path": "/builder"
    },
    {
      "action": "wait",
      "condition": "text_present",
      "text": "AI SAFETY EVALUATION",
      "timeoutMs": 15000
    },
    {
      "action": "click",
      "selector": "button:has-text('Save')"
    },
    {
      "action": "wait",
      "condition": "text_present",
      "text": "Routine Safety Check",
      "timeoutMs": 5000
    },
    {
      "action": "assert",
      "type": "is_visible",
      "selector": "button:has-text('Review Fixes')"
    },
    {
      "action": "assert",
      "type": "is_visible",
      "selector": "button:has-text('Keep My Choices & Save')"
    },
    {
      "action": "click",
      "selector": "button:has-text('Keep My Choices & Save')"
    },
    {
      "action": "wait",
      "condition": "text_present",
      "text": "Exercises",
      "timeoutMs": 10000
    },
    {
      "action": "assert",
      "type": "route_equals",
      "expected": "/plan"
    },
    {
      "action": "screenshot",
      "name": "saved_plan_page_view"
    }
  ]
}
```

---

## Flow 3: Athlete Physical Assessment Intake (`assessment_flow.json`)

```json
{
  "flowName": "assessment_flow",
  "description": "Completes athlete physical assessment and initiates personalized plan synthesis",
  "steps": [
    {
      "action": "seed_auth",
      "role": "user",
      "email": "new.athlete@physiocoach.dev"
    },
    {
      "action": "navigate",
      "path": "/assessment"
    },
    {
      "action": "click",
      "selector": "button:has-text('Muscle Gain')"
    },
    {
      "action": "click",
      "selector": "button:has-text('Full Gym')"
    },
    {
      "action": "click",
      "selector": "button:has-text('Generate My Blueprint')"
    },
    {
      "action": "wait",
      "condition": "text_present",
      "text": "Weekly Sets",
      "timeoutMs": 25000
    },
    {
      "action": "assert",
      "type": "route_equals",
      "expected": "/plan"
    }
  ]
}
```
