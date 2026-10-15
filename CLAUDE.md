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
npm run seed-demo        # load ml/data/generated/demo_dataset.json into Mongo (replaces isDemo records only)
npm run seed-demo -- --clean   # remove demo records only

# client/
npm run dev              # http://localhost:5173
npm run build            # tsc -b && vite build (this is the type check)
npm run lint             # oxlint

# ml/  (Python 3.12, venv in ml/.venv)
py -3.12 -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python data/generate_synthetic.py --seed 42   # deterministic synthetic data -> ml/data/generated/ (gitignored)
```

There is no test suite in either project.

`start.bat` (repo root) opens server, client and, once it exists, the `ml/` service in separate terminals.

Planning docs: `docs/plan.md` is the roadmap (course-feedback analytics + ML service, phases 0–6). Each phase gets a spec in `docs/specs/faz-N-*.md` with acceptance criteria. Read the relevant spec before implementing a phase.

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
- Error JSON uses `message` in most controllers (some older ones use `mesaj`). The client's `getErrorMessage` reads either; use `message` in new code.
- Question types: `text`, `rating` (1–5), `radio`, `checkbox`. `radio` and `checkbox` require at least 2 non-empty options.

### Courses, topics, dimensions (analytics foundation)
- `Course` (`code` + `term` unique, `topics: [String]`) groups surveys. `Survey.course` is optional, so old surveys have none.
- Each question can have a `topic` (must be one of its survey's course topics; checked in `validateCourseAndTopics`, `surveyController.js`) and a `dimension` (`QUESTION_DIMENSIONS` in `models/Survey.js`; client labels in `client/src/lib/course.ts`).
- `courseController.js` blocks deleting a course that has surveys, and blocks removing a topic that questions still use.
- `GET /api/surveys` populates `course`, while `GET /api/surveys/:id` returns it as an id. The client type `Survey["course"]` covers both.

### Synthetic data and the ML service (`ml/`)
- `ml/data/generate_synthetic.py` is the single source of truth for demo data. It simulates hidden ("latent") quality per course × term × topic × dimension, and derives labels from that hidden quality (plus 8% noise), never from the observed ratings. It outputs the demo dataset JSON and the training CSVs.
- `server/scripts/seedDemoData.js` writes straight to the collections (bypassing Mongoose, so the extra `isDemo: true` field is kept), so it computes `startDate`/`endDate`/`slug` itself. Every demo response is checked with `validateAnswersAgainstSurvey` (exported from `responseController.js`) before anything is deleted.
- `ml/app/pipeline/features.py` computes model features for a topic (`TopicUnit` → `compute_features`). Training data and live analysis must both go through it. Comments are linked to topics by name match (`attribute_comment`).
- Project skill `.claude/skills/demo-veri-yenile` covers the regenerate-and-seed flow.

### Client
- Route tree is in `client/src/App.tsx`. Paths are Turkish (`/giris`, `/cevaplarim`, `/admin/anketler/:id/sonuclar`). `RequireStudent` and `RequireAdmin` are layout-route guards.
- `@/` is an alias for `client/src/`. Shared types are in `client/src/types/index.ts`. `components/ui/` holds generated shadcn components.
- Results exports: Excel is generated on the server (`exceljs`, `GET /api/responses/survey/:surveyId/export`, with student identity anonymized). PDF is generated on the client in `AdminSurveyResultsPage.tsx` (`html2canvas-pro` + `jspdf`).
