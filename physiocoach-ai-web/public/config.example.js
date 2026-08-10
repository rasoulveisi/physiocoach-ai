/**
 * Runtime configuration for PhysioCoach AI.
 *
 * This file is generated automatically at build time by:
 *   node scripts/write-runtime-config.mjs
 *
 * To create your local copy:
 *   1. Copy this file:  cp public/config.example.js public/config.js
 *   2. Replace the placeholder values below for your environment.
 *   3. Or simply run:   npm run sync:config
 *      (reads from .env / .env.dev / .env.production or CI env vars)
 *
 * NEVER commit public/config.js — it is gitignored.
 */
window.__PHYSIOCOACH_CONFIG__ = {
  apiUrl: "http://localhost:8787/api/v1",
  environment: "local",
};
