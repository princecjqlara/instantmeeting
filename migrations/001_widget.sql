-- Widget feature migration (Phases 1-6)
-- Run in Supabase SQL editor.

-- ============================================================
-- Phase 1: widget config columns on users
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_key TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_domains TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_form_fields JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_theme JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS widget_mirror_enabled BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_widget_key ON users(widget_key);

-- ============================================================
-- Phase 3: visitors
-- ============================================================
CREATE TABLE IF NOT EXISTS widget_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone TEXT,
  current_page_url TEXT,
  current_page_title TEXT,
  scroll_depth INTEGER DEFAULT 0,
  status TEXT DEFAULT 'browsing',
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  mirror_active BOOLEAN DEFAULT false,
  claimed_by UUID REFERENCES users(id),
  UNIQUE(host_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_visitors_host ON widget_visitors(host_id, last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON widget_visitors(host_id, status);

-- ============================================================
-- Phase 5: live broadcast + chat
-- ============================================================
CREATE TABLE IF NOT EXISTS live_engage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'live',
  stream_type TEXT DEFAULT 'video',
  livekit_room TEXT,
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS widget_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visitor_session_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_name TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON widget_chat_messages(host_id, visitor_session_id, created_at);

-- ============================================================
-- Phase 4: universal join tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_join_tokens (
  code TEXT PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  visitor_session_id TEXT,
  widget_context JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '10 minutes',
  consumed BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_join_tokens_expires ON meeting_join_tokens(expires_at) WHERE consumed = false;

-- ============================================================
-- Phase 6: optional DOM mirror persistence
-- ============================================================
CREATE TABLE IF NOT EXISTS dom_mirror_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_session_id TEXT NOT NULL,
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_data JSONB NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mirror_session ON dom_mirror_events(visitor_session_id, timestamp_ms);

-- meetings.source for analytics
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source TEXT;
