# PostgreSQL design and advanced SQL

## Preserved design

The supplied 11 relations remain the center of the schema: `users`, `candidates`, `recruiters`, `resumes`, `jobs`, `skills`, `resume_skills`, `job_skills`, `applications`, `resume_matches`, and `interviews`. Foreign-key direction and cardinalities follow the PDF: one user to one role profile; profiles to many resumes/jobs; skills linked through join tables; candidate/job via applications; resume/job via matches; and applications to interviews.

Identifiers remain `varchar(50)` for compatibility with the source design, with UUID text defaults. Original camel-case field names (`userId`, `fileName`, `matchingScore`, etc.) are retained. `citext` makes email uniqueness case-insensitive. `pgvector` stores a 384-value embedding on resumes and jobs, and `resume_matches.semanticScore` stores the semantic component of each candidate/job score. All schema DDL is in `server/db/schema.sql` and can be rerun safely.

## Additions and rationale

- `users.updatedAt`, `users.isActive`: account maintenance and admin controls.
- Candidate bio/portfolio links; recruiter company website.
- `resumes.extractedText`, `isDefault`: parsed resume source and active version.
- Job salary range and workplace type, plus range check.
- `skills.normalizedName` for taxonomy normalization.
- `resume_matches.scoreBreakdown jsonb`: auditable versioned semantic/skill match inputs; original match arrays become `text[]` to retain lists structurally.
- Interview meeting link and creation time.
- Explicit enum-like `CHECK` constraints and nonnegative/score range checks.

No separate vector service is needed: pgvector stores and searches the embeddings alongside the relational records. JSONB is limited to the flexible explanation payload; the rest remains normalized and relational.

## Semantic matching

The API uses the 384-dimensional `Xenova/all-MiniLM-L6-v2` Sentence Transformers model. It embeds extracted resume text and each job title plus description. PostgreSQL stores vectors using `vector(384)` and an HNSW index with `vector_cosine_ops`. The candidate match query uses cosine distance (`<=>`) to rank semantically related roles, including descriptions that use different wording. The final score combines semantic similarity (70%) with the existing weighted skill overlap (30%). Required skills count double within the skill component. The model name, metric, weights, sub-scores, and skill explanation are stored in `resume_matches.scoreBreakdown`.

The model files are fetched on first use and cached at `TRANSFORMERS_CACHE` (Docker uses a persistent `embedding_models` volume). The first resume upload or job creation therefore takes longer while the model loads.

## Constraints and transaction examples

- Foreign keys cascade when a user/profile/job is removed. Applications restrict deletion of a resume already referenced in an application.
- Unique email, profile-per-user, skill names, candidate/job application pair, and each resume/job match are enforced by the database.
- Application and interview workflows use transactions to keep related records consistent. Job creation also wraps the job and its skill associations in one transaction.

Example atomic interview scheduling (same transaction pattern used by the API):

```sql
BEGIN;
INSERT INTO interviews("applicationId", "scheduledAt", "interviewType", "meetingLink")
VALUES ('application-id', '2026-12-01 10:00:00+05:30', 'VIDEO', 'https://meet.example/room');
UPDATE applications SET status='INTERVIEW' WHERE id='application-id';
COMMIT;
```

Use `ROLLBACK` on any error. Never split the interview insert and application status update into independent commits.

## Indexes

The schema adds partial indexes for open jobs and upcoming scheduled interviews, composite indexes for recruiter/status, candidate timeline and job pipeline, and descending match score. GIN full-text indexes support future resume/job keyword search; a GIN index on match breakdown supports JSONB explanation filters. The API's current simple public search uses `ILIKE`; inspect actual plans before switching to full-text search.

## View and function

`recruiter_job_pipeline` summarizes applicants and advanced-stage candidates by job. `application_counts()` exposes the same core counts as a table-valued SQL function. `set_updated_at()` plus `users_updated_at` maintains user update timestamps.

## CTE and window-function examples

Rank the candidate's best resume match per open job while preserving ties:

```sql
WITH ranked AS (
  SELECT rm."jobId", rm."resumeId", rm."matchingScore", rm."matchedSkills",
         rank() OVER (PARTITION BY rm."jobId" ORDER BY rm."matchingScore" DESC) AS position
  FROM resume_matches rm
)
SELECT j.title, c."firstName", c."lastName", ranked."matchingScore", ranked."matchedSkills"
FROM ranked
JOIN resumes r ON r.id=ranked."resumeId"
JOIN candidates c ON c.id=r."candidateId"
JOIN jobs j ON j.id=ranked."jobId"
WHERE ranked.position <= 5 AND j.status='OPEN'
ORDER BY j.title, ranked.position;
```

Running application totals over time:

```sql
WITH daily AS (
  SELECT date_trunc('day', "appliedAt")::date AS day, count(*) AS applications
  FROM applications GROUP BY 1
)
SELECT day, applications,
       sum(applications) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_total,
       avg(applications) OVER (ORDER BY day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS seven_day_average
FROM daily ORDER BY day;
```

## EXPLAIN / EXPLAIN ANALYZE examples

Run `ANALYZE` after seeding representative data, then compare estimates and actual rows. `EXPLAIN ANALYZE` executes the statement, so use it for SELECT queries or wrap write experiments in a transaction and roll them back.

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, title, "postedAt" FROM jobs
WHERE status='OPEN' ORDER BY "postedAt" DESC LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.status, a."appliedAt" FROM applications a
WHERE a."candidateId"='candidate-id' ORDER BY a."appliedAt" DESC;

EXPLAIN (ANALYZE, BUFFERS)
SELECT "jobId", "matchingScore" FROM resume_matches
WHERE "jobId"='job-id' ORDER BY "matchingScore" DESC LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM resumes
WHERE to_tsvector('english', "extractedText") @@ plainto_tsquery('english', 'distributed systems');

EXPLAIN (ANALYZE, BUFFERS)
SELECT j.id, 1 - (r.embedding <=> j.embedding) AS cosine_similarity
FROM resumes r CROSS JOIN jobs j
WHERE r.id='resume-id' AND j.status='OPEN' AND j.embedding IS NOT NULL
ORDER BY r.embedding <=> j.embedding LIMIT 10;
```

Expected index candidates are `idx_jobs_open_recent`, `idx_apps_candidate_date`, `idx_resume_matches_job_score`, and `idx_resume_text_search`. PostgreSQL may choose sequential scans on small tables; that is normal. Compare plans with realistic table sizes rather than forcing an index.

## Seed account

`npm --prefix server run seed` inserts the skill taxonomy, three sample job postings, and demo admin/recruiter accounts using bcrypt. Change the demo passwords immediately if the seed is used outside a local demonstration.
