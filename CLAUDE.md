# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Survey system for Samsun University: admins create course/exam evaluation surveys, students (only `@samsun.edu.tr` accounts) answer them. UI text, code comments, and API error messages are in Turkish — keep new ones Turkish too.

Two independent npm projects, no root package.json. Run commands inside each folder:

- `server/`: Express 5 + Mongoose (ESM, plain JS)
- `client/`: React 19 + TypeScript + Vite SPA (Tailwind v4, shadcn/ui on Base UI, TanStack Query, React Router 7)

## Commands

```bash
# server/
npm run dev              # nodemon
npm start
npm run seed             # one-time: create the admin user from ADMIN_USERNAME/ADMIN_PASSWORD
npm run backfill-slugs   # one-time: generate slugs for surveys created before the slug field existed

# client/
npm run dev              # http://localhost:5173
npm run build            # tsc -b && vite build (this is the type check)
npm run lint             # oxlint
```

There is no test suite in either project.

Env: `server/.env` needs `MONGO_URI`, `JWT_SECRET`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` (the server exits on startup if any are missing), plus `PORT`, `CLIENT_URL` (comma-separated CORS allowlist), `ADMIN_USERNAME`/`ADMIN_PASSWORD`, and optionally `TRUST_PROXY` (set only behind a real reverse proxy). `client/.env` needs `VITE_API_URL` (e.g. `http://localhost:5000/api`) and `VITE_CLERK_PUBLISHABLE_KEY`.

## Architecture

### Two separate auth systems
- **Students**: Clerk (Google SSO). `clerkMiddleware()` runs globally in `server/index.js`. `requireAuth` in `server/middlewares/auth.js` lazily creates the local `User` on the first request by fetching the user from the Clerk REST API, and rejects emails that are not `@samsun.edu.tr`. On the client, `useStudentApi()` (`client/src/hooks/useStudentApi.ts`) returns an axios instance that attaches the Clerk token.
- **Admin**: username/password → JWT. `requireAdmin` verifies the JWT and checks `role === "admin"`. On the client, `adminApi` (`client/src/lib/api.ts`) reads the token from localStorage (`samu_admin_token`), and on a 401 clears it and redirects to `/admin/login`.
- The domain restriction is enforced on purpose in both places (`server/middlewares/auth.js` and `client/src/routes/RequireStudent.tsx`). Clerk itself does not restrict sign-ups.
- Both roles live in the same `User` model: admins use `username` and `password`, students use `clerkId`.

### Survey scheduling
Admins only set `examDate`. `startDate` and `endDate` are always derived by `computeSurveyWindow` (`server/utils/surveySchedule.js`): the survey opens 10 minutes before the exam and closes at 23:59:59.999 Turkey time on the exam day. Turkey time is a fixed UTC+3, and the client always sends `examDate` with a `+03:00` offset. The calculation runs in two Survey model hooks: `pre("validate")` for save and `pre("findOneAndUpdate")` for updates. Keep both in sync when changing it. A survey is visible and answerable to students only when `isActive && startDate <= now <= endDate`.

### Slugs vs IDs
Student-facing survey links use `slug` (`/anketler/:slug` → `GET /api/surveys/student/:slug`). Admin routes still use the Mongo `_id`. The slug is generated once, on creation (`server/utils/slug.js` handles the Turkish character mapping and adds a `-2`, `-3` suffix when a slug is taken), and is never regenerated when the title changes, so shared links keep working.

### Server conventions
- Mass-assignment protection: controllers copy only whitelisted fields (e.g. `ALLOWED_SURVEY_FIELDS` in `surveyController.js`). `startDate`/`endDate` are deliberately left off that list. Validate input types before using them in queries to prevent NoSQL injection.
- Deleting a survey also deletes its responses inside a Mongo transaction, which requires a replica set (Atlas works).
- `Response` has a unique `(survey, user)` index: one response per student per survey. Students edit their response through `PUT /api/responses/:id` (with an ownership check) while the survey window is open.
- Error JSON uses the key `mesaj`. The client's `getErrorMessage` reads `message` or `mesaj`.
- Question types: `text`, `rating` (1–5), `radio`, `checkbox`. `radio` and `checkbox` require at least 2 non-empty options.

### Client
- Route tree is in `client/src/App.tsx`. Paths are Turkish (`/giris`, `/cevaplarim`, `/admin/anketler/:id/sonuclar`). `RequireStudent` and `RequireAdmin` are layout-route guards.
- `@/` is an alias for `client/src/`. Shared types are in `client/src/types/index.ts`. `components/ui/` holds generated shadcn components.
- Results exports: Excel is generated on the server (`exceljs`, `GET /api/responses/survey/:surveyId/export`, with student identity anonymized). PDF is generated on the client in `AdminSurveyResultsPage.tsx` (`html2canvas-pro` + `jspdf`).
