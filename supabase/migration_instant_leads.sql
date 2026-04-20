-- Instant Leads feature: forms, questions, and lead qualification
-- Idempotent migration

CREATE TABLE IF NOT EXISTS lead_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    auto_admit_threshold INTEGER DEFAULT 70 CHECK (auto_admit_threshold BETWEEN 0 AND 100),
    ai_criteria TEXT,
    unqualified_message TEXT DEFAULT 'Thanks for your response. We''ll be in touch.',
    fallback_to_waiting BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_forms_user ON lead_forms(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_forms_slug ON lead_forms(slug);

CREATE TABLE IF NOT EXISTS lead_form_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    question_text TEXT NOT NULL,
    help_text TEXT,
    type TEXT NOT NULL DEFAULT 'short_answer'
        CHECK (type IN ('short_answer','long_answer','email','phone','single_choice','multi_choice','date')),
    options JSONB DEFAULT '[]'::jsonb,
    required BOOLEAN DEFAULT true,
    ai_weight NUMERIC(3,2) DEFAULT 1.0 CHECK (ai_weight BETWEEN 0 AND 1),
    disqualify_on TEXT,
    scoring_rules JSONB DEFAULT '[]'::jsonb,
    ideal_answer TEXT,
    max_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For upgrades from earlier version of this migration
-- Allow 'date' type on existing installs
ALTER TABLE lead_form_questions DROP CONSTRAINT IF EXISTS lead_form_questions_type_check;
ALTER TABLE lead_form_questions ADD CONSTRAINT lead_form_questions_type_check
    CHECK (type IN ('short_answer','long_answer','email','phone','single_choice','multi_choice','date'));

ALTER TABLE lead_form_questions ADD COLUMN IF NOT EXISTS scoring_rules JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lead_form_questions ADD COLUMN IF NOT EXISTS ideal_answer TEXT;
ALTER TABLE lead_form_questions ADD COLUMN IF NOT EXISTS max_points INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lead_form_questions_form ON lead_form_questions(form_id);

-- Extend waiting_guests for lead qualification
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS lead_form_id UUID REFERENCES lead_forms(id) ON DELETE SET NULL;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS qualification_score INTEGER;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS qualification_verdict TEXT
    CHECK (qualification_verdict IN ('qualified','unqualified','review'));
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS qualification_reasoning TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS lead_answers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS lead_session_token TEXT;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'prospect';
ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS pipeline_stage_changed_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_waiting_guests_lead_form ON waiting_guests(lead_form_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waiting_guests_lead_session ON waiting_guests(lead_session_token)
    WHERE lead_session_token IS NOT NULL;

-- RLS
ALTER TABLE lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_form_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts manage their lead forms" ON lead_forms;
CREATE POLICY "Hosts manage their lead forms" ON lead_forms
    FOR ALL USING (user_id::text = auth.uid()::text);

DROP POLICY IF EXISTS "Anyone can view active lead forms" ON lead_forms;
CREATE POLICY "Anyone can view active lead forms" ON lead_forms
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Hosts manage their form questions" ON lead_form_questions;
CREATE POLICY "Hosts manage their form questions" ON lead_form_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM lead_forms
            WHERE lead_forms.id = lead_form_questions.form_id
            AND lead_forms.user_id::text = auth.uid()::text
        )
    );

DROP POLICY IF EXISTS "Anyone can view questions for active forms" ON lead_form_questions;
CREATE POLICY "Anyone can view questions for active forms" ON lead_form_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM lead_forms
            WHERE lead_forms.id = lead_form_questions.form_id
            AND lead_forms.is_active = true
        )
    );

-- Optional: lead drafts (autosave of abandoned forms)
CREATE TABLE IF NOT EXISTS lead_drafts (
    session_token TEXT PRIMARY KEY,
    form_slug TEXT NOT NULL,
    answers JSONB DEFAULT '[]'::jsonb,
    guest_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    pipeline_stage TEXT DEFAULT 'prospect',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_drafts ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'prospect';

ALTER TABLE users ADD COLUMN IF NOT EXISTS leads_pipeline_stages JSONB DEFAULT '["prospect","qualified","unqualified","sold"]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meta_capi_dataset_id TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_drafts_form_slug ON lead_drafts(form_slug);

ALTER TABLE lead_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can write drafts" ON lead_drafts;
CREATE POLICY "Anyone can write drafts" ON lead_drafts FOR ALL USING (true) WITH CHECK (true);

SELECT 'Instant leads schema installed' AS message;
