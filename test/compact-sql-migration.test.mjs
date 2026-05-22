import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

test('compact lead-form and payment CAPI SQL can be run once idempotently', () => {
    const sqlPath = new URL('../supabase/compact_lead_form_facebook_events.sql', import.meta.url)

    assert.ok(existsSync(sqlPath), 'expected a compact one-run SQL migration file')

    const sql = readFileSync(sqlPath, 'utf8')

    assert.ok(sql.includes('BEGIN;'))
    assert.ok(sql.includes('COMMIT;'))
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS lead_forms'))
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS lead_form_questions'))
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS lead_drafts'))
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS pending_signups'))
    assert.ok(sql.includes('ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS meta_capi_access_token TEXT'))
    assert.ok(sql.includes('ALTER TABLE lead_forms ALTER COLUMN send_qualified_to_facebook SET DEFAULT true'))
    assert.ok(sql.includes('ALTER TABLE lead_forms ADD COLUMN IF NOT EXISTS qualified_media_mode TEXT DEFAULT'))
    assert.ok(sql.includes('ALTER TABLE users ADD COLUMN IF NOT EXISTS instantmeeting_payment_purchase_value_php INTEGER DEFAULT 699'))
    assert.ok(sql.includes('ALTER TABLE waiting_guests ADD COLUMN IF NOT EXISTS meta_qualified_sent_at TIMESTAMPTZ'))
    assert.ok(sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_signups_email_pending'))
    assert.ok(!sql.includes('DROP TABLE'))
})
