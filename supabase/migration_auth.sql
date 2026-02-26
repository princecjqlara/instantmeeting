-- Migration: Add email/password auth with organizer/tenant roles
-- Run this in Supabase SQL Editor

-- Add password_hash column for bcrypt-hashed passwords
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Add role column: 'organizer' can manage tenants, 'tenant' is a regular host
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'tenant' CHECK (role IN ('organizer', 'tenant'));
