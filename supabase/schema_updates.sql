-- Add scroll_threshold and meeting_duration to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS scroll_threshold INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_duration INTEGER DEFAULT 30;

-- Success message
SELECT 'Schema updated successfully' as message;
