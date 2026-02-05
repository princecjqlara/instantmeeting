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
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

-- Content: Users can manage their own content, anyone can view
CREATE POLICY "Users can manage own content" ON content
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anyone can view content" ON content
  FOR SELECT USING (true);

-- Meetings: Users can manage their own meetings
CREATE POLICY "Users can manage own meetings" ON meetings
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Anyone can view active meetings" ON meetings
  FOR SELECT USING (status IN ('pending', 'active'));

-- Waiting Guests: Anyone can join, only host can update
CREATE POLICY "Anyone can join waiting room" ON waiting_guests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view waiting guests" ON waiting_guests
  FOR SELECT USING (true);

CREATE POLICY "Host can admit guests" ON waiting_guests
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
