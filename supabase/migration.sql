-- Instant Meeting Database Schema
-- Run this in your Supabase SQL Editor

-- Users table (hosts only, stores Google OAuth tokens)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  username TEXT UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  google_access_token TEXT,
  google_refresh_token TEXT,
  availability_mode TEXT DEFAULT 'always' CHECK (availability_mode IN ('always', 'never', 'scheduled')),
  available_from TIME,
  available_to TIME,
  timezone TEXT DEFAULT 'UTC',
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content/Reels table (videos shown in waiting rooms)
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  caption TEXT,
  cloudinary_url TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  order_index INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  google_meet_link TEXT,
  google_event_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waiting guests (guests waiting in the waiting room)
CREATE TABLE IF NOT EXISTS waiting_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'admitted', 'left')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  admitted_at TIMESTAMPTZ
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_content_user_id ON content(user_id);
CREATE INDEX IF NOT EXISTS idx_content_order ON content(user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_waiting_guests_meeting ON waiting_guests(meeting_id);
CREATE INDEX IF NOT EXISTS idx_waiting_guests_status ON waiting_guests(meeting_id, status);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_guests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Only the user can see their own data
CREATE POLICY IF NOT EXISTS "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Content: Users can manage their own content, anyone can view
CREATE POLICY IF NOT EXISTS "Users can manage own content" ON content
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY IF NOT EXISTS "Anyone can view content" ON content
  FOR SELECT USING (true);

-- Meetings: Users can manage their own meetings
CREATE POLICY IF NOT EXISTS "Users can manage own meetings" ON meetings
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY IF NOT EXISTS "Anyone can view active meetings" ON meetings
  FOR SELECT USING (status IN ('pending', 'active'));

-- Waiting Guests: Anyone can join, only host can update
CREATE POLICY IF NOT EXISTS "Anyone can join waiting room" ON waiting_guests
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Anyone can view waiting guests" ON waiting_guests
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Host can admit guests" ON waiting_guests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = waiting_guests.meeting_id 
      AND meetings.user_id::text = auth.uid()::text
    )
  );

-- Enable realtime for waiting_guests and meetings
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_guests;
ALTER PUBLICATION supabase_realtime ADD TABLE meetings;

-- Success!
SELECT 'Database schema created successfully!' as message;

-- =========================================
-- Welcome Audio & Team System
-- =========================================

-- Add welcome audio to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_audio_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'tenant';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scroll_threshold INTEGER DEFAULT 3;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_duration INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_description TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_note_placeholder TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_form_fields JSONB;

-- Add columns to meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_joined_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reschedule_requested BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ;

-- Add columns to waiting_guests
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS custom_fields JSONB;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS join_token TEXT;

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'My Team',
    round_robin_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS teams_owner_id_idx ON teams(owner_id);

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    welcome_audio_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clock sessions
CREATE TABLE IF NOT EXISTS clock_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    clocked_in_at TIMESTAMPTZ DEFAULT now(),
    clocked_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Assigned team member on meetings
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS assigned_member_id UUID REFERENCES team_members(id);

-- Enable RLS on new tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables (service role bypasses RLS, these allow general access)
CREATE POLICY IF NOT EXISTS "Allow all teams" ON teams FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow all team_members" ON team_members FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow all clock_sessions" ON clock_sessions FOR ALL USING (true);
