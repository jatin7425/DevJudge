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

-- Migration 002
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

-- Migration 003
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

-- Migration 004
-- Adds per-user analysis state columns used by the dashboard.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS analysis_requested_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS initial_data_collected_at TIMESTAMPTZ;

-- Migration 005
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
