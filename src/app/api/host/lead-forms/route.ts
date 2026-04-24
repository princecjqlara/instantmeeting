import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { insertLeadFormWithCompat, updateLeadFormWithCompat } from '@/lib/lead-forms-column-compat'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function getUser(email: string) {
    const supabase = getSupabaseClient()
    const { data } = await supabase.from('users').select('id, username').eq('email', email).single()
    return data
}

function computeMaxPoints(q: any): number {
    const type = q.type || 'short_answer'
    if (type === 'single_choice') {
        const points = (q.options || []).map((o: any) => Number(o.points) || 0)
        return points.length ? Math.max(...points) : 0
    }
    if (type === 'multi_choice') {
        return (q.options || []).reduce((sum: number, o: any) => sum + Math.max(0, Number(o.points) || 0), 0)
    }
    // Text-like: ideal answer worth 10, plus the sum of rule points
    const rulePoints = Array.isArray(q.scoring_rules)
        ? q.scoring_rules.reduce((sum: number, r: any) => sum + Math.max(0, Number(r.points) || 0), 0)
        : 0
    const idealPoints = q.ideal_answer && String(q.ideal_answer).trim() ? 10 : 0
    return rulePoints + idealPoints
}

function buildQuestionRow(formId: string, q: any, i: number) {
    return {
        form_id: formId,
        order_index: i,
        question_text: String(q.question_text || ''),
        help_text: q.help_text || null,
        type: q.type || 'short_answer',
        options: Array.isArray(q.options) ? q.options : [],
        required: q.required !== false,
        ai_weight: Number.isFinite(q.ai_weight) ? q.ai_weight : 1.0,
        disqualify_on: q.disqualify_on || null,
        scoring_rules: Array.isArray(q.scoring_rules) ? q.scoring_rules : [],
        ideal_answer: q.ideal_answer || null,
        max_points: computeMaxPoints(q),
    }
}

function normalizeMetaField(value: unknown) {
    return typeof value === 'string' ? value.trim() || null : null
}

function normalizeBooleanField(value: unknown, fallback = false) {
    return typeof value === 'boolean' ? value : fallback
}

function normalizePurchaseValue(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 699
}

function slugify(input: string) {
    return (input || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 48)
}

// GET: list host's forms (with questions if ?id=)
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUser(session.user.email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const supabase = getSupabaseClient()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (id) {
        const { data: form, error } = await supabase
            .from('lead_forms')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .maybeSingle()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const { data: questions } = await supabase
            .from('lead_form_questions')
            .select('*')
            .eq('form_id', id)
            .order('order_index', { ascending: true })

        return NextResponse.json({ ...form, questions: questions || [] })
    }

    const { data: forms, error } = await supabase
        .from('lead_forms')
        .select('id, slug, title, is_active, auto_admit_threshold, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(forms || [])
}

// POST: create a new form (with optional questions)
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUser(session.user.email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const {
        title,
        description,
        ai_criteria,
        auto_admit_threshold,
        unqualified_message,
        fallback_to_waiting,
        meta_capi_access_token,
        meta_capi_dataset_id,
        meta_capi_test_event_code,
        facebook_purchase_value,
        send_qualified_to_facebook,
        send_purchase_to_facebook,
        questions,
    } = body || {}

    if (!title || typeof title !== 'string') {
        return NextResponse.json({ error: 'Title required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()
    const base = slugify(title) || 'form'
    const slug = `${base}-${randomUUID().slice(0, 6)}`

    const { data: form, error } = await insertLeadFormWithCompat<any>(supabase, {
        user_id: user.id,
        slug,
        title,
        description: description || null,
        ai_criteria: ai_criteria || null,
        auto_admit_threshold: Number.isFinite(auto_admit_threshold) ? auto_admit_threshold : 70,
        unqualified_message: unqualified_message || null,
        fallback_to_waiting: fallback_to_waiting !== false,
        meta_capi_access_token: normalizeMetaField(meta_capi_access_token),
        meta_capi_dataset_id: normalizeMetaField(meta_capi_dataset_id),
        meta_capi_test_event_code: normalizeMetaField(meta_capi_test_event_code),
        facebook_purchase_value: normalizePurchaseValue(facebook_purchase_value),
        send_qualified_to_facebook: normalizeBooleanField(send_qualified_to_facebook, true),
        send_purchase_to_facebook: normalizeBooleanField(send_purchase_to_facebook, false),
        is_active: true,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(questions) && questions.length > 0) {
        const rows = questions.map((q: any, i: number) => buildQuestionRow(form.id, q, i))
        await supabase.from('lead_form_questions').insert(rows)
    }

    return NextResponse.json(form)
}

// PATCH: update a form and replace its questions
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUser(session.user.email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const { id, questions, ...updates } = body || {}
    if (!id) return NextResponse.json({ error: 'Form id required' }, { status: 400 })

    const supabase = getSupabaseClient()
    // ownership check
    const { data: existing } = await supabase
        .from('lead_forms')
        .select('id, user_id')
        .eq('id', id)
        .maybeSingle()
    if (!existing || existing.user_id !== user.id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    const allowed = [
        'title',
        'description',
        'ai_criteria',
        'auto_admit_threshold',
        'unqualified_message',
        'fallback_to_waiting',
        'is_active',
        'meta_capi_access_token',
        'meta_capi_dataset_id',
        'meta_capi_test_event_code',
        'facebook_purchase_value',
        'send_qualified_to_facebook',
        'send_purchase_to_facebook',
    ]
    for (const key of allowed) {
        if (!(key in updates)) continue

        if (
            key === 'meta_capi_access_token' ||
            key === 'meta_capi_dataset_id' ||
            key === 'meta_capi_test_event_code'
        ) {
            patch[key] = normalizeMetaField((updates as Record<string, unknown>)[key])
            continue
        }

        if (key === 'facebook_purchase_value') {
            patch[key] = normalizePurchaseValue((updates as Record<string, unknown>)[key])
            continue
        }

        if (key === 'send_qualified_to_facebook' || key === 'send_purchase_to_facebook') {
            patch[key] = normalizeBooleanField((updates as Record<string, unknown>)[key], false)
            continue
        }

        patch[key] = (updates as Record<string, unknown>)[key]
    }
    patch.updated_at = new Date().toISOString()

    const { error: upErr } = await updateLeadFormWithCompat<any>(supabase, id, patch)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    if (Array.isArray(questions)) {
        await supabase.from('lead_form_questions').delete().eq('form_id', id)
        if (questions.length > 0) {
            const rows = questions.map((q: any, i: number) => buildQuestionRow(id, q, i))
            const { error: qErr } = await supabase.from('lead_form_questions').insert(rows)
            if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
        }
    }

    return NextResponse.json({ success: true })
}

// DELETE: remove a form
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getUser(session.user.email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Form id required' }, { status: 400 })

    const supabase = getSupabaseClient()
    const { error } = await supabase
        .from('lead_forms')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
