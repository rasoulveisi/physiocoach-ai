# PhysioCoach AI API

Cloudflare Workers serverless API for PhysioCoach AI. Powered by `cloudflare:node` and Express router adapter, connected to Neon PostgreSQL via Cloudflare Hyperdrive connection pooling and OpenRouter LLMs.

## Live Endpoints

- **Production API**: [physiocoach-ai-api.otconnect.ir/api/v1](https://physiocoach-ai-api.otconnect.ir/api/v1)
- **Health Check**: [physiocoach-ai-api.otconnect.ir/api/v1/health](https://physiocoach-ai-api.otconnect.ir/api/v1/health)

---

## 🌟 Key Architecture & Services

1. **Authentication & Identity**: First-party password authentication (PBKDF2 / Argon2 hashing) with rotating JWT refresh tokens and live Google OAuth OIDC integration.
2. **AI Workout Generator**: Deterministic schema validation with OpenRouter LLMs (`gemini-3.7-flash` primary) and clinical contraindication filtering.
3. **Database & Connection Pooling**: Drizzle ORM connecting to Neon PostgreSQL over Cloudflare Hyperdrive connection pooling.
4. **Live Session & Progress Logging**: Real-time workout tracking, volume logging, and safety notes.

---

## 🚀 Local Development

```bash
npm install

# Start local worker with remote Hyperdrive / Neon PostgreSQL connectivity
npm run dev
```

---

## 🏗️ Production Deployment

```bash
# Typecheck API
npm run build

# Deploy directly to Cloudflare Workers
npx wrangler deploy
```
