-- InstantHomes Integration Schema Additions for InstantMeeting
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Add IH integration columns to users table
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_linked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_tenant_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_tenant_slug TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_tenant_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_linked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ih_funnel_domains TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_ih_link ON users(ih_linked) WHERE ih_linked = true;

-- ============================================
-- 2. Integration tokens table
-- ============================================

CREATE TABLE IF NOT EXISTS integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                     -- 'instant_homes'
  remote_user_id TEXT NOT NULL,               -- IH's user CUID
  access_token TEXT,                          -- Encrypted
  refresh_token TEXT,                         -- Encrypted
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- ============================================
-- 3. Cross-platform analytics events
-- ============================================

CREATE TABLE IF NOT EXISTS cross_platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                       -- 'ih_funnel' | 'im_widget' | 'im_direct'
  source_id TEXT,                             -- funnel ID or widget config ID
  event_type TEXT NOT NULL,                   -- 'page_view' | 'cta_click' | 'booking' | 'meeting_start'
  visitor_session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_xp_events ON cross_platform_events(host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_source ON cross_platform_events(source, event_type);

-- ============================================
-- 4. RLS Policies
-- ============================================

ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_platform_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; these allow host to read their own data
CREATE POLICY IF NOT EXISTS "host_owns_tokens" ON integration_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "host_owns_xp_events" ON cross_platform_events
  FOR ALL USING (host_id = auth.uid());

SELECT 'InstantHomes integration schema created successfully!' as message;
