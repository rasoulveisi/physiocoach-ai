# PhysioCoach AI Web

React 19 Progressive Web App (PWA) frontend for PhysioCoach AI.

## Live Endpoints

- **Production Web**: [physiocoach.otconnect.ir](https://physiocoach.otconnect.ir)
- **Production API**: [physiocoach-ai-api.otconnect.ir/api/v1](https://physiocoach-ai-api.otconnect.ir/api/v1)

---

## 🌟 Key Capabilities

1. **Touch Gesture & Swiper Engine**: Direction-locked horizontal carousel swiping across workout days and landing hero value propositions.
2. **Locked Mobile Viewport**: Zero window bounce or rubber-banding in mobile Chrome & Safari (`height: 100dvh; position: fixed; inset: 0; overflow: hidden;`).
3. **PWA Offline Shell**: Production Service Worker (`public/sw.js`) with cache versioning, Stale-While-Revalidate asset caching, and standalone install prompt.
4. **Athletic Skeleton Loaders**: Zero-flicker loading states across Dashboard, Plan, Session, and Settings screens.
5. **Real-Time Gym HUD**: Automated rest timers, audio cues, barbell plate math, and live exercise substitution modal.

---

## 🚀 Local Development

```bash
npm install
npm run dev
```

The app will run at `http://localhost:5173`.

---

## 🏗️ Production Build & Deployment

```bash
# Build production bundle
npm run build

# Deploy directly to Cloudflare Pages
npm run deploy
```
