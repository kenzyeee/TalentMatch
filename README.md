# TalentMatch — Intelligent Recruitment & Resume Matching

A full-stack recruitment platform based on the supplied DBMS project document. It keeps the original 11 core relations and builds working candidate, recruiter, and administrator workflows around them.

## Stack

- React, TypeScript, Vite, Tailwind CSS, Lucide icons
- Node.js, Express, TypeScript, Zod validation, JWT, bcrypt
- PostgreSQL 16 as the source of truth; Redis is optional and caches public job searches for 45 seconds
- PDF and DOCX resume text extraction with `pdf-parse` and `mammoth`
- Swagger UI at `/api/docs`

No MongoDB or Neo4j is used: the entities and relationships are relational, and no graph traversal workload justifies another datastore.

## Quick start with Docker

1. Copy `.env.example` to `.env` and replace `JWT_SECRET` for non-demo use.
2. Run `docker compose up --build`.
3. Open `http://localhost:5173`. API: `http://localhost:4000`; docs: `http://localhost:4000/api/docs`.
4. Seed the skill taxonomy, demo roles, and demo accounts with `npm --prefix server run seed` (after the database is ready). Demo admin: `admin@talentmatch.dev` / `Admin123!`; demo recruiter: `demo.recruiter@talentmatch.dev` / `Recruiter123!`.

The Postgres container applies `server/db/schema.sql` on first startup. To reinitialize a local Docker database, stop the stack and remove its `postgres_data` volume.

## Local development

Requires Node.js 20+ and PostgreSQL 15+. Redis can be omitted.

```sh
cp .env.example .env
npm install
npm --prefix server install
npm --prefix client install
npm run db:migrate
npm run db:seed
npm run dev
```

The frontend runs at `http://localhost:5173`, the API at `http://localhost:4000`. Configure `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, and optionally `REDIS_URL`. Uploads are written to `UPLOAD_DIR` (default `./uploads`).

## User flows

- Candidates can register, browse/search openings, upload multiple PDF/DOCX resumes, see detected skills, compare resume skills to job requirements, apply once per job, track application status, and view scheduled interviews.
- Recruiters can register a company, post roles with required and preferred skills, inspect applicants ordered by match score, advance/reject candidates, and schedule interviews.
- Admins can inspect platform counts/recent activity, list accounts, and pause/reactivate accounts.

Resume matching is deterministic and explainable. Required skills are worth two points and preferred skills one point; the result is the weighted overlap divided by total possible points. Case is normalized. Missing required skills and every scored input are persisted in `resume_matches`. With no listed skills the score is 0. The score does not use name, age, gender, location, or other protected traits. Skill extraction uses literal case-insensitive taxonomy matches in extracted text; this is a transparent baseline rather than an AI claim.

## API overview

Public: `GET /api/health`, `GET /api/jobs`, `GET /api/jobs/:id`, `GET /api/skills`, `POST /api/auth/register`, `POST /api/auth/login`.

Candidate: `GET /api/auth/me`, `POST/GET /api/resumes`, `GET /api/matches`, `POST /api/applications`, `GET /api/applications/mine`, `PATCH /api/applications/:id/withdraw`.

Recruiter: `POST /api/jobs`, `PATCH /api/jobs/:id`, `GET /api/recruiter/dashboard`, `GET /api/recruiter/jobs/:jobId/applications`, `PATCH /api/recruiter/applications/:id`, `POST /api/recruiter/applications/:id/interviews`, `PATCH /api/recruiter/interviews/:id`.

Admin: `GET /api/admin/dashboard`, `GET /api/admin/users`, `PATCH /api/admin/users/:id`.

Protected routes use `Authorization: Bearer <JWT>`. Swagger details are at `/api/docs`.

## Database documentation

See [docs/database.md](docs/database.md) for schema mapping, migration notes, constraints, indexes, view/function, transaction examples, CTE/window queries, and EXPLAIN recipes.

## Security and production notes

Passwords use bcrypt; JWTs expire after seven days; roles and profile ownership are checked server-side; writes validate with Zod; uploads are size-limited and restricted to PDF/DOCX; auth routes are rate-limited. In production, use TLS, a strong secret, private/object storage for resumes, malware scanning, retention controls, email verification/reset flows, stricter rate limits, and an explicit data privacy policy. Uploaded resume files are private in intent but currently served from the API's static `/uploads` path; production deployments should replace this with authenticated download URLs.
