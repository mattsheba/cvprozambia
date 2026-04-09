# CVPro Zambia (cv-generator-html) — Copilot instructions

## Big picture
- Static site entrypoints: [index.html](../index.html) (main) and [admin/index.html](../admin/index.html) (admin dashboard).
- Production loads **versioned assets** for caching: `css/styles.v20260205.2.css`, `js/config.v20260205.js`, `js/app-standalone.v20260205.js`, `js/admin.v20260205.js`.
- Client app is plain browser JS (no bundler). Core logic lives in `js/app-standalone.v20260205.js` (wizard, live preview, PDF via jsPDF, Identity, payments, serverless calls).
- “Backend” is Netlify Functions in [netlify/functions](../netlify/functions) using `@netlify/blobs` store `cvpro-zambia-cvs`.

## Which files are “live”
- Prefer editing the **versioned** assets referenced by HTML; unversioned siblings like `js/app-standalone.js` / `css/styles.css` are not what production serves.
- `js/app.js` looks like an older/non-standalone variant (it calls `/api/...`); the shipped site uses `js/app-standalone.v20260205.js`.

## Local dev workflows
- Static-only (no functions/Identity): `python3 -m http.server 8000` (per [README.md](../README.md)).
- Full app (Netlify Functions + Identity context): `npm install` then `netlify dev` (per [NETLIFY_SETUP.md](../NETLIFY_SETUP.md)).
  - Put secrets in `.env` locally; in Netlify, configure env vars in the dashboard.

## Frontend ↔ functions contracts (important)
- AI suggestions: `POST /.netlify/functions/generate-ai` with JSON `{ prompt, type: 'summary'|'skills'|'responsibilities', model?, debug? }` → `{ text, success }`.
  - Controlled by env vars: `GEMINI_API_KEY`, `AI_ENABLED`, `AI_RATE_WINDOW_MS`, `AI_RATE_MAX_REQUESTS`, `AI_MAX_PROMPT_CHARS`, `AI_MAX_OUTPUT_TOKENS`, `GEMINI_MODEL`, `GEMINI_MODEL_SKILLS`.
- Identity-authenticated endpoints (frontend uses `fetchWithAuth()` with `Authorization: Bearer <jwt>`):
  - `GET /.netlify/functions/cv-load` and `POST /.netlify/functions/cv-save` (saved CV snapshot)
  - `GET /.netlify/functions/cv-entitlement` and `POST /.netlify/functions/cv-mark-paid` (free re-download entitlement)
  - `GET /.netlify/functions/admin-ping` and `GET /.netlify/functions/admin-metrics` (admin dashboard)
- Blob key conventions (store `cvpro-zambia-cvs`): `${userId}:latest`, `${userId}:entitlement`, and `sales/<timestamp>_<userId>_<hash>.json`.

## Versioned-asset workflow (immutable caching)
- Because [netlify.toml](../netlify.toml) sets `Cache-Control: immutable` for `/js/*` + `/css/*`, production changes require a **new filename**.
- Usual flow: create new `js/app-standalone.vYYYYMMDD.js` (and/or `css/styles.vYYYYMMDD.N.css`), then update script/link tags in [index.html](../index.html) and [admin/index.html](../admin/index.html).

## Project-specific conventions / gotchas
- Payment is via Lenco inline widget (public key in `js/config*.js`; currently amount is hardcoded to 50 ZMW in the frontend download flow).
- Entitlement is **best-effort**: after payment success, the client calls `POST /.netlify/functions/cv-mark-paid`; there is no server-side payment verification.
- Free re-download uses a stable hash: `stableStringify()` + `sha256Hex()` of `getCanonicalSnapshotForBilling()`.
  - If you add/rename CV fields, update `getCanonicalSnapshotForBilling()` or re-download eligibility will be wrong.
- AI output is post-processed client-side:
  - Summary/skills/duties prompts expect strict formats; duties are parsed by `parseBulletLines()` (one bullet per line, stripped of leading bullets/numbering, min length).
- Netlify Functions are CommonJS (`exports.handler`) and must stay Node-compatible; keep browser-only code out of [netlify/functions](../netlify/functions).
- Admin access is allow-listed via `ADMIN_EMAILS`/`ADMIN_SUBS` (see [netlify/functions/admin-ping.js](../netlify/functions/admin-ping.js) + [netlify/functions/admin-metrics.js](../netlify/functions/admin-metrics.js)).

## Where to look first when making changes
- Main UX/content/data shape: `js/app-standalone.v20260205.js`
- Serverless behavior + storage: [netlify/functions](../netlify/functions)
- Caching/security headers + functions dir: [netlify.toml](../netlify.toml)
