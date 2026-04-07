-- DevJudge database migrations
-- Append schema changes here over time.

-- Migration 001
-- Creates the migration ledger table used to track applied schema changes.
CREATE TABLE IF NOT EXISTS db_migration (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    migration_version TEXT NOT NULL,
    migration_description TEXT,
    migration_key TEXT NOT NULL UNIQUE,
    migration_name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration 001
-- Creates the application users table for GitHub-linked user records.
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    github_id BIGINT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    access_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration 001
-- Seeds the migration ledger with the initial schema creation entry.
INSERT INTO db_migration (
    table_name,
    migration_version,
    migration_description,
    migration_key,
    migration_name
)
SELECT
    'users',
    '001',
    'Create db_migration and users tables',
    '001_create_db_migration_and_users',
    'create_db_migration_and_users'
WHERE NOT EXISTS (
    SELECT 1
    FROM db_migration
    WHERE migration_key = '001_create_db_migration_and_users'
);

-- Migration 002
-- Adds per-user analysis state columns used by the dashboard.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS analysis_requested_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS initial_data_collected_at TIMESTAMPTZ;

-- Migration 002
-- Seeds the migration ledger with the dashboard analysis state schema entry.
INSERT INTO db_migration (
    table_name,
    migration_version,
    migration_description,
    migration_key,
    migration_name
)
SELECT
    'users',
    '002',
    'Add analysis state columns to users',
    '002_add_analysis_state_to_users',
    'add_analysis_state_to_users'
WHERE NOT EXISTS (
    SELECT 1
    FROM db_migration
    WHERE migration_key = '002_add_analysis_state_to_users'
);

-- ================================================================================================

-- Migration 003
-- Creates analysis_jobs table for queue + pipeline tracking

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id BIGSERIAL PRIMARY KEY,

    job_id UUID NOT NULL UNIQUE, -- public job identifier

    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    status TEXT NOT NULL CHECK (
        status IN ('queued', 'running', 'completed', 'failed')
    ) DEFAULT 'queued',

    position INTEGER, -- optional cached position

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    result JSONB, -- final pipeline result
    error TEXT,   -- error message if failed

    meta JSONB,   -- optional: store extra data (logs, config, etc.)

    CONSTRAINT idx_analysis_jobs_user_id_idx UNIQUE (job_id)
);

-- Fast queue queries
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status_created
ON analysis_jobs(status, created_at);

-- Fetch user jobs
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user
ON analysis_jobs(user_id);

-- For sorting queue
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_queue
ON analysis_jobs(created_at)
WHERE status = 'queued';

-- Migration 003
-- Register analysis_jobs table

INSERT INTO db_migration (
    table_name,
    migration_version,
    migration_description,
    migration_key,
    migration_name
)
SELECT
    'analysis_jobs',
    '003',
    'Create analysis_jobs table',
    '003_create_analysis_jobs',
    'create_analysis_jobs'
WHERE NOT EXISTS (
    SELECT 1
    FROM db_migration
    WHERE migration_key = '003_create_analysis_jobs'
);

-- Migration 004
-- Hardens analysis_jobs schema for resumable pipeline metadata + status tracking.

ALTER TABLE analysis_jobs
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE analysis_jobs
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE analysis_jobs
ADD COLUMN IF NOT EXISTS result JSONB;

ALTER TABLE analysis_jobs
ADD COLUMN IF NOT EXISTS error TEXT;

ALTER TABLE analysis_jobs
ADD COLUMN IF NOT EXISTS meta JSONB;

ALTER TABLE analysis_jobs
ALTER COLUMN meta SET DEFAULT '{}'::jsonb;

UPDATE analysis_jobs
SET meta = '{}'::jsonb
WHERE meta IS NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_status
ON analysis_jobs(user_id, status);

-- Migration 004
-- Register analysis_jobs hardening entry.

INSERT INTO db_migration (
    table_name,
    migration_version,
    migration_description,
    migration_key,
    migration_name
)
SELECT
    'analysis_jobs',
    '004',
    'Harden analysis_jobs columns/defaults for resumable pipeline metadata',
    '004_harden_analysis_jobs_schema',
    'harden_analysis_jobs_schema'
WHERE NOT EXISTS (
    SELECT 1
    FROM db_migration
    WHERE migration_key = '004_harden_analysis_jobs_schema'
);
