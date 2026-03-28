-- =============================================
-- AI Assistant Database Migration
-- Requires pgvector extension enabled in Supabase
-- Dashboard → Database → Extensions → Enable "vector"
-- =============================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. AI Knowledge Bases (per-user collections)
CREATE TABLE IF NOT EXISTS ai_knowledge_bases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    document_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_kb_user ON ai_knowledge_bases(user_id);

-- 3. AI Knowledge Chunks (embedded document pieces)
CREATE TABLE IF NOT EXISTS ai_knowledge_chunks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    knowledge_base_id UUID NOT NULL REFERENCES ai_knowledge_bases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source_name TEXT,
    token_count INTEGER DEFAULT 0,
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_kb ON ai_knowledge_chunks(knowledge_base_id);

-- IVFFlat index for fast similarity search (rebuild after inserting data)
-- Use cosine distance for NV-Embed models
CREATE INDEX IF NOT EXISTS idx_ai_chunks_embedding
    ON ai_knowledge_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 4. Add AI columns to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_objective TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_flow JSONB;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_knowledge_base_id UUID REFERENCES ai_knowledge_bases(id);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_meeting_notes JSONB;

-- 4b. Add default AI config columns to profiles table (applies to all meetings)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_default_objective TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_default_flow JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_default_knowledge_base_id UUID;

-- 5. Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding vector(1024),
    match_knowledge_base_id UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source_name TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ai_knowledge_chunks.id,
        ai_knowledge_chunks.content,
        ai_knowledge_chunks.source_name,
        1 - (ai_knowledge_chunks.embedding <=> query_embedding) AS similarity
    FROM ai_knowledge_chunks
    WHERE ai_knowledge_chunks.knowledge_base_id = match_knowledge_base_id
        AND 1 - (ai_knowledge_chunks.embedding <=> query_embedding) > match_threshold
    ORDER BY ai_knowledge_chunks.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. RLS policies
ALTER TABLE ai_knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all ai_knowledge_bases" ON ai_knowledge_bases;
CREATE POLICY "Allow all ai_knowledge_bases" ON ai_knowledge_bases FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all ai_knowledge_chunks" ON ai_knowledge_chunks;
CREATE POLICY "Allow all ai_knowledge_chunks" ON ai_knowledge_chunks FOR ALL USING (true);

-- Enable realtime (optional, for live updates)
-- ALTER PUBLICATION supabase_realtime ADD TABLE ai_knowledge_bases;

SELECT 'AI Assistant migration completed!' as message;
