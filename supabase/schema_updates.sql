-- Add missing columns to users table (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_mode TEXT DEFAULT 'always' CHECK (availability_mode IN ('always', 'never', 'scheduled'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_from TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_to TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scroll_threshold INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_duration INTEGER DEFAULT 30;

-- Success message
SELECT 'Schema updated successfully' as message;
