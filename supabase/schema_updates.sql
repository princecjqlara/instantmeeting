-- Add missing columns to users table (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS availability_mode TEXT DEFAULT 'always' CHECK (availability_mode IN ('always', 'never', 'scheduled'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_from TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_to TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scroll_threshold INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_duration INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_note_placeholder TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_form_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure content table has all columns
ALTER TABLE content ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE content ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN IF NOT EXISTS comments INTEGER DEFAULT 0;

-- Ensure meetings table has all columns  
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed'));
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_joined_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reschedule_requested BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ;

-- Ensure waiting_guests table has all columns
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS guest_name TEXT NOT NULL;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]'::jsonb;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'admitted', 'left'));
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS admitted_at TIMESTAMPTZ;

-- Create content_engagement table if it doesn't exist
CREATE TABLE IF NOT EXISTS content_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('view', 'like', 'comment')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_engagement_content ON content_engagement(content_id);
CREATE INDEX IF NOT EXISTS idx_content_engagement_type ON content_engagement(type);

-- Enable RLS for content_engagement
ALTER TABLE content_engagement ENABLE ROW LEVEL SECURITY;

-- Anyone can insert engagement data
DROP POLICY IF EXISTS "Anyone can record engagement" ON content_engagement;
CREATE POLICY "Anyone can record engagement" ON content_engagement
    FOR INSERT WITH CHECK (true);

-- Only view own engagement data
DROP POLICY IF EXISTS "Users can view engagement for their content" ON content_engagement;
CREATE POLICY "Users can view engagement for their content" ON content_engagement
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM content 
            WHERE content.id = content_engagement.content_id 
            AND content.user_id::text = auth.uid()::text
        )
    );

-- Success message
SELECT 'Schema updated successfully' as message;
