CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 email citext UNIQUE NOT NULL,
 "passwordHash" varchar(255) NOT NULL,
 "userType" varchar(20) NOT NULL CHECK ("userType" IN ('CANDIDATE','RECRUITER','ADMIN')),
 "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
 "isActive" boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS candidates (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "userId" varchar(50) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 "firstName" varchar(100) NOT NULL, "lastName" varchar(100) NOT NULL,
 phone varchar(20), location varchar(100), "createdAt" timestamptz NOT NULL DEFAULT now(),
 bio text, "linkedinUrl" text, "portfolioUrl" text
);
CREATE TABLE IF NOT EXISTS recruiters (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "userId" varchar(50) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 "companyName" varchar(150) NOT NULL, "firstName" varchar(100) NOT NULL, "lastName" varchar(100) NOT NULL,
 phone varchar(20), "createdAt" timestamptz NOT NULL DEFAULT now(), "companyWebsite" text
);
CREATE TABLE IF NOT EXISTS resumes (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "candidateId" varchar(50) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
 "fileName" varchar(255) NOT NULL, "fileUrl" varchar(500), version varchar(30),
 "uploadedAt" timestamptz NOT NULL DEFAULT now(), "extractedText" text NOT NULL DEFAULT '', "isDefault" boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS jobs (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "recruiterId" varchar(50) NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE,
 title varchar(150) NOT NULL, description text NOT NULL, location varchar(100),
 "employmentType" varchar(50), status varchar(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAUSED','CLOSED','DRAFT')),
 "postedAt" timestamptz NOT NULL DEFAULT now(), "closingDate" timestamptz,
 "salaryMin" integer, "salaryMax" integer, "workplaceType" varchar(30) DEFAULT 'ONSITE',
 CONSTRAINT valid_salary_range CHECK ("salaryMin" IS NULL OR "salaryMax" IS NULL OR "salaryMin" <= "salaryMax")
);
CREATE TABLE IF NOT EXISTS skills (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 name varchar(100) UNIQUE NOT NULL, description text, "normalizedName" varchar(100) UNIQUE
);
CREATE TABLE IF NOT EXISTS resume_skills (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "resumeId" varchar(50) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
 "skillId" varchar(50) NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
 "proficiencyLevel" varchar(30), "yearsOfExperience" numeric(4,1) CHECK ("yearsOfExperience" IS NULL OR "yearsOfExperience" >= 0),
 UNIQUE("resumeId","skillId")
);
CREATE TABLE IF NOT EXISTS job_skills (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "jobId" varchar(50) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 "skillId" varchar(50) NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
 "requiredLevel" varchar(30), "isRequired" boolean NOT NULL DEFAULT false,
 UNIQUE("jobId","skillId")
);
CREATE TABLE IF NOT EXISTS applications (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "candidateId" varchar(50) NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
 "jobId" varchar(50) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 "resumeId" varchar(50) NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
 status varchar(30) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED','IN_REVIEW','SHORTLISTED','INTERVIEW','OFFERED','HIRED','REJECTED','WITHDRAWN')),
 "appliedAt" timestamptz NOT NULL DEFAULT now(), "coverLetter" text,
 UNIQUE("candidateId","jobId")
);
CREATE TABLE IF NOT EXISTS resume_matches (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "resumeId" varchar(50) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
 "jobId" varchar(50) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 "matchingScore" numeric(5,2) NOT NULL CHECK ("matchingScore" BETWEEN 0 AND 100),
 "matchedSkills" text[] NOT NULL DEFAULT '{}', "missingSkills" text[] NOT NULL DEFAULT '{}',
 "matchedAt" timestamptz NOT NULL DEFAULT now(), "scoreBreakdown" jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE("resumeId","jobId")
);
CREATE TABLE IF NOT EXISTS interviews (
 id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "applicationId" varchar(50) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 "scheduledAt" timestamptz NOT NULL, "interviewType" varchar(30) DEFAULT 'VIDEO',
 status varchar(30) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','RESCHEDULED')),
 "interviewerName" varchar(100), notes text, "meetingLink" text, "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_open_recent ON jobs("postedAt" DESC) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_status ON jobs("recruiterId",status);
CREATE INDEX IF NOT EXISTS idx_apps_candidate_date ON applications("candidateId","appliedAt" DESC);
CREATE INDEX IF NOT EXISTS idx_apps_job_status ON applications("jobId",status);
CREATE INDEX IF NOT EXISTS idx_resume_matches_job_score ON resume_matches("jobId","matchingScore" DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_schedule ON interviews("scheduledAt") WHERE status='SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_resume_text_search ON resumes USING gin (to_tsvector('english',"extractedText"));
CREATE INDEX IF NOT EXISTS idx_job_text_search ON jobs USING gin (to_tsvector('english',title || ' ' || description));
CREATE INDEX IF NOT EXISTS idx_match_breakdown ON resume_matches USING gin ("scoreBreakdown");

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW."updatedAt"=now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION application_counts() RETURNS TABLE(job_id varchar, job_title varchar, applicant_count bigint, shortlisted_count bigint) LANGUAGE sql STABLE AS $$
 SELECT j.id,j.title,count(a.id),count(a.id) FILTER (WHERE a.status IN ('SHORTLISTED','INTERVIEW','OFFERED','HIRED'))
 FROM jobs j LEFT JOIN applications a ON a."jobId"=j.id GROUP BY j.id,j.title;
$$;
CREATE OR REPLACE VIEW recruiter_job_pipeline AS
 SELECT j.id AS job_id,j."recruiterId" AS recruiter_id,j.title,j.status,count(a.id) AS applicants,
 count(a.id) FILTER (WHERE a.status IN ('SHORTLISTED','INTERVIEW','OFFERED','HIRED')) AS advanced
 FROM jobs j LEFT JOIN applications a ON a."jobId"=j.id GROUP BY j.id;

COMMENT ON TABLE resume_matches IS 'Deterministic skill overlap score; scoreBreakdown stores auditable inputs. No protected attributes are considered.';
