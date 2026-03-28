-- =============================================
-- Presentation Feature Migration
-- =============================================

-- 1. Presentations table
CREATE TABLE IF NOT EXISTS presentations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Presentation',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentations_user ON presentations(user_id);

-- 2. Presentation slides table
CREATE TABLE IF NOT EXISTS presentation_slides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    presentation_id UUID NOT NULL REFERENCES presentations(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'image', -- 'image' or 'video'
    cloudinary_public_id TEXT,
    thumbnail_url TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slides_presentation ON presentation_slides(presentation_id);
CREATE INDEX IF NOT EXISTS idx_slides_order ON presentation_slides(presentation_id, order_index);

-- 3. RLS policies
ALTER TABLE presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all presentations" ON presentations;
CREATE POLICY "Allow all presentations" ON presentations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all presentation_slides" ON presentation_slides;
CREATE POLICY "Allow all presentation_slides" ON presentation_slides FOR ALL USING (true);

SELECT 'Presentation migration completed!' as message;
