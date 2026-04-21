import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { canManuallyMoveLeadToStage, deriveLeadPipelineStage, resolveStoredLeadPipelineStage } from '@/lib/lead-pipeline'
import {
    maybeSendLeadFormQualifiedMetaEvent,
    maybeSendLeadFormPurchaseMetaEvent,
    shouldSendLeadFormQualifiedMetaEvent,
} from '@/lib/lead-form-qualified-capi'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizeOptionalText(value: unknown, maxLength = 500) {
    if (value == null) return null
    const text = String(value).trim()
    return text ? text.slice(0, maxLength) : null
}

function getClientIpAddress(req: NextRequest): string | null {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim()
        if (first) return first
    }

    const realIp = req.headers.get('x-real-ip')?.trim()
    return realIp || null
}

function normalizeTags(value: unknown) {
    return Array.isArray(value)
        ? Array.from(
              new Set(
                  value
                      .filter((x): x is string => typeof x === 'string')
                      .map((tag) => tag.trim().slice(0, 40))
                      .filter(Boolean)
              )
          )
        : []
}

function normalizeCustomFields(value: unknown) {
    if (!Array.isArray(value)) return []

    return value
        .map((item, index) => {
            if (!item || typeof item !== 'object') return null
            const record = item as { id?: unknown; label?: unknown; value?: unknown }
            const label = normalizeOptionalText(record.label, 80)
            const fieldValue = normalizeOptionalText(record.value, 500)
            if (!label && !fieldValue) return null
            return {
                id: normalizeOptionalText(record.id, 80) || `field-${index + 1}`,
                label: label || `Field ${index + 1}`,
                value: fieldValue || '',
            }
        })
        .filter(Boolean)
}

// GET: Get all leads (waiting guests) with meeting details for the host
export async function GET(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'

    // Build query to get all waiting guests for host's meetings
    let query = supabase
        .from('waiting_guests')
        .select(`
            *,
            meetings!inner(
                id,
                title,
                scheduled_at,
                status,
                user_id
            )
        `)
        .eq('meetings.user_id', user.id)
        .order('joined_at', { ascending: false })

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    const [{ data: leads, error }, { data: forms, error: formsError }] = await Promise.all([
        query,
        supabase.from('lead_forms').select('id, slug, title').eq('user_id', user.id),
    ])

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (formsError) {
        return NextResponse.json({ error: formsError.message }, { status: 500 })
    }

    const formList = forms || []
    const formBySlug = new Map(formList.map((form) => [form.slug, form]))
    let draftLeads: Array<Record<string, unknown>> = []

    if (formList.length > 0) {
        const { data: drafts, error: draftsError } = await supabase
            .from('lead_drafts')
            .select('*')
            .in('form_slug', formList.map((form) => form.slug))
            .order('updated_at', { ascending: false })

        if (draftsError) {
            return NextResponse.json({ error: draftsError.message }, { status: 500 })
        }

        draftLeads = (drafts || []).map((draft) => {
            const form = formBySlug.get(draft.form_slug)
            const joinedAt = draft.updated_at || draft.created_at || new Date().toISOString()
            return {
                id: `draft:${draft.session_token}`,
                guest_name: draft.guest_name || 'Untitled prospect',
                guest_email: draft.guest_email || null,
                guest_phone: draft.guest_phone || null,
                status: 'draft',
                joined_at: joinedAt,
                admitted_at: null,
                note: 'Form started but not submitted yet.',
                custom_fields: [],
                lead_form_id: form?.id || null,
                qualification_score: null,
                qualification_verdict: null,
                qualification_reasoning: 'Incomplete lead form draft',
                lead_answers: Array.isArray(draft.answers) ? draft.answers : [],
                tags: [],
                pipeline_stage:
                    draft.pipeline_stage ||
                    deriveLeadPipelineStage({ submittedAt: null, qualificationVerdict: null, isDraft: true }),
                is_draft: true,
                meetings: {
                    id: form?.id || draft.session_token,
                    title: form?.title ? `Draft · ${form.title}` : 'Draft lead form',
                    scheduled_at: null,
                    status: 'draft',
                },
            }
        })
    }

    const normalizedLeads = (leads || []).map((lead: Record<string, unknown>) => ({
        ...lead,
        pipeline_stage: resolveStoredLeadPipelineStage({
            currentStage: typeof lead.pipeline_stage === 'string' ? lead.pipeline_stage : null,
            submittedAt: typeof lead.submitted_at === 'string' ? lead.submitted_at : null,
            qualificationVerdict:
                lead.qualification_verdict === 'qualified' ||
                lead.qualification_verdict === 'unqualified' ||
                lead.qualification_verdict === 'review'
                    ? lead.qualification_verdict
                    : null,
            isDraft: false,
        }),
        is_draft: false,
    }))

    return NextResponse.json([...(draftLeads as never[]), ...(normalizedLeads as never[])])
}

// DELETE: delete one or many leads owned by current host.
// Supports ?id=<uuid> OR ?ids=<uuid,uuid,...> OR a JSON body { ids: [...] }.
export async function DELETE(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const singleId = searchParams.get('id')
    if (singleId?.startsWith('draft:')) {
        const sessionToken = singleId.slice('draft:'.length)
        const { data: userForms } = await supabase
            .from('lead_forms')
            .select('slug')
            .eq('user_id', user.id)

        const allowedSlugs = (userForms || []).map((form: { slug: string }) => form.slug)
        if (allowedSlugs.length === 0) {
            return NextResponse.json({ error: 'No matching leads' }, { status: 404 })
        }
        const { error: deleteDraftError } = await supabase
            .from('lead_drafts')
            .delete()
            .eq('session_token', sessionToken)
            .in('form_slug', allowedSlugs)

        if (deleteDraftError) {
            return NextResponse.json({ error: deleteDraftError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, deleted: 1 })
    }
    const multiParam = searchParams.get('ids')
    let ids: string[] = []
    if (singleId) ids.push(singleId)
    if (multiParam) ids.push(...multiParam.split(',').map((s) => s.trim()).filter(Boolean))
    if (ids.length === 0) {
        try {
            const body = await req.json()
            if (Array.isArray(body?.ids)) {
                ids = body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
            }
        } catch {
            /* no body */
        }
    }
    ids = Array.from(new Set(ids))
    if (ids.length === 0) {
        return NextResponse.json({ error: 'Lead id(s) required' }, { status: 400 })
    }

    // Only delete rows that belong to this host's meetings.
    const { data: owned, error: ownedErr } = await supabase
        .from('waiting_guests')
        .select('id, meetings!inner(user_id)')
        .in('id', ids)
        .eq('meetings.user_id', user.id)

    if (ownedErr) {
        return NextResponse.json({ error: ownedErr.message }, { status: 500 })
    }

    const deletableIds = (owned || []).map((r: { id: string }) => r.id)
    if (deletableIds.length === 0) {
        return NextResponse.json({ error: 'No matching leads' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
        .from('waiting_guests')
        .delete()
        .in('id', deletableIds)

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: deletableIds.length })
}

// PATCH: update tags on one or many leads.
// Body: { ids: string[], tags: string[], mode?: 'set' | 'add' | 'remove' }
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: {
        ids?: unknown
        id?: unknown
        tags?: unknown
        mode?: unknown
        guest_name?: unknown
        guest_email?: unknown
        guest_phone?: unknown
        note?: unknown
        custom_fields?: unknown
        pipeline_stage?: unknown
    }
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const ids = Array.isArray(body.ids)
        ? body.ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
        : []
    const tags = Array.isArray(body.tags)
        ? body.tags
              .filter((x: unknown): x is string => typeof x === 'string')
              .map((t) => t.trim().slice(0, 40))
              .filter(Boolean)
        : []
    const mode = body.mode === 'add' || body.mode === 'remove' || body.mode === 'set' ? body.mode : 'set'

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const singleId = typeof body.id === 'string' ? body.id : null

    if (singleId) {
        if (singleId.startsWith('draft:')) {
            const token = singleId.slice('draft:'.length)
            const { data: draft } = await supabase
                .from('lead_drafts')
                .select('*')
                .eq('session_token', token)
                .maybeSingle()

            if (!draft) {
                return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
            }

            const { data: form } = await supabase
                .from('lead_forms')
                .select('id')
                .eq('slug', draft.form_slug)
                .eq('user_id', user.id)
                .maybeSingle()

            if (!form) {
                return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
            }

            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if ('guest_name' in body) patch.guest_name = normalizeOptionalText(body.guest_name, 80)
            if ('guest_email' in body) patch.guest_email = normalizeOptionalText(body.guest_email, 160)
            if ('guest_phone' in body) patch.guest_phone = normalizeOptionalText(body.guest_phone, 40)
            if ('pipeline_stage' in body) patch.pipeline_stage = normalizeOptionalText(body.pipeline_stage, 40) || 'prospect'

            const { error: updateDraftError } = await supabase
                .from('lead_drafts')
                .update(patch)
                .eq('session_token', token)

            if (updateDraftError) {
                return NextResponse.json({ error: updateDraftError.message }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        const { data: ownedLead, error: leadError } = await supabase
            .from('waiting_guests')
            .select('*, meetings!inner(user_id)')
            .eq('id', singleId)
            .eq('meetings.user_id', user.id)
            .maybeSingle()

        if (leadError) {
            return NextResponse.json({ error: leadError.message }, { status: 500 })
        }
        if (!ownedLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }

        const patch: Record<string, unknown> = {}
        let nextStage: string | null = null
        let movedToQualified = false
        let movedToSold = false
        if ('guest_name' in body) patch.guest_name = normalizeOptionalText(body.guest_name, 80)
        if ('guest_email' in body) patch.guest_email = normalizeOptionalText(body.guest_email, 160)
        if ('guest_phone' in body) patch.guest_phone = normalizeOptionalText(body.guest_phone, 40)
        if ('note' in body) patch.note = normalizeOptionalText(body.note, 2000)
        if ('custom_fields' in body) patch.custom_fields = normalizeCustomFields(body.custom_fields)
        if ('pipeline_stage' in body) {
            nextStage = normalizeOptionalText(body.pipeline_stage, 40) || 'prospect'
            if (
                !canManuallyMoveLeadToStage({
                    from: (ownedLead as { pipeline_stage?: string | null }).pipeline_stage,
                    to: nextStage,
                })
            ) {
                return NextResponse.json(
                    { error: 'Only qualified leads can be moved to sold' },
                    { status: 400 }
                )
            }
            movedToQualified = nextStage === 'qualified'
            movedToSold =
                nextStage === 'sold' &&
                (
                    (ownedLead as { pipeline_stage?: string | null }).pipeline_stage !== 'sold' ||
                    !((ownedLead as { meta_purchase_sent_at?: string | null }).meta_purchase_sent_at)
                )
            patch.pipeline_stage = nextStage
            patch.pipeline_stage_changed_at = new Date().toISOString()
        }

        const { error: updateError } = await supabase
            .from('waiting_guests')
            .update(patch)
            .eq('id', singleId)

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }

        if (
            movedToQualified &&
            shouldSendLeadFormQualifiedMetaEvent(
                (ownedLead as { meta_qualified_sent_at?: string | null }).meta_qualified_sent_at
            ) &&
            (ownedLead as { lead_form_id?: string | null }).lead_form_id
        ) {
            const { data: leadForm } = await supabase
                .from('lead_forms')
                .select('id, slug, meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code, facebook_purchase_value, send_qualified_to_facebook, send_purchase_to_facebook')
                .eq('id', (ownedLead as { lead_form_id?: string | null }).lead_form_id)
                .maybeSingle()

            if (leadForm) {
                await maybeSendLeadFormQualifiedMetaEvent({
                    supabase,
                    leadForm,
                    lead: {
                        id: singleId,
                        guest_name:
                            ('guest_name' in patch ? (patch.guest_name as string | null) : null) ??
                            ((ownedLead as { guest_name?: string | null }).guest_name ?? null),
                        guest_email:
                            ('guest_email' in patch ? (patch.guest_email as string | null) : null) ??
                            ((ownedLead as { guest_email?: string | null }).guest_email ?? null),
                        guest_phone:
                            ('guest_phone' in patch ? (patch.guest_phone as string | null) : null) ??
                            ((ownedLead as { guest_phone?: string | null }).guest_phone ?? null),
                        meta_qualified_sent_at:
                            (ownedLead as { meta_qualified_sent_at?: string | null }).meta_qualified_sent_at ?? null,
                    },
                    eventSourceUrl:
                        leadForm.slug
                            ? `${req.nextUrl.origin}/leads/${leadForm.slug}`
                            : `${req.nextUrl.origin}/host/leads`,
                    clientIpAddress: getClientIpAddress(req),
                    clientUserAgent: req.headers.get('user-agent'),
                })
            }
        }

        if (movedToSold && (ownedLead as { lead_form_id?: string | null }).lead_form_id) {
            const { data: leadForm } = await supabase
                .from('lead_forms')
                .select('id, slug, meta_capi_access_token, meta_capi_dataset_id, meta_capi_test_event_code, facebook_purchase_value, send_qualified_to_facebook, send_purchase_to_facebook')
                .eq('id', (ownedLead as { lead_form_id?: string | null }).lead_form_id)
                .maybeSingle()

            if (leadForm) {
                await maybeSendLeadFormPurchaseMetaEvent({
                    supabase,
                    leadForm,
                    lead: {
                        id: singleId,
                        guest_name:
                            ('guest_name' in patch ? (patch.guest_name as string | null) : null) ??
                            ((ownedLead as { guest_name?: string | null }).guest_name ?? null),
                        guest_email:
                            ('guest_email' in patch ? (patch.guest_email as string | null) : null) ??
                            ((ownedLead as { guest_email?: string | null }).guest_email ?? null),
                        guest_phone:
                            ('guest_phone' in patch ? (patch.guest_phone as string | null) : null) ??
                            ((ownedLead as { guest_phone?: string | null }).guest_phone ?? null),
                        meta_purchase_sent_at:
                            (ownedLead as { meta_purchase_sent_at?: string | null }).meta_purchase_sent_at ?? null,
                    },
                    eventSourceUrl:
                        leadForm.slug
                            ? `${req.nextUrl.origin}/leads/${leadForm.slug}`
                            : `${req.nextUrl.origin}/host/leads`,
                    clientIpAddress: getClientIpAddress(req),
                    clientUserAgent: req.headers.get('user-agent'),
                })
            }
        }

        return NextResponse.json({ success: true })
    }

    if (ids.length === 0) {
        return NextResponse.json({ error: 'id or ids required' }, { status: 400 })
    }

    // Fetch current tags for owned rows only.
    const { data: owned, error: fetchErr } = await supabase
        .from('waiting_guests')
        .select('id, tags, meetings!inner(user_id)')
        .in('id', ids)
        .eq('meetings.user_id', user.id)

    if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!owned || owned.length === 0) {
        return NextResponse.json({ error: 'No matching leads' }, { status: 404 })
    }

    const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)))

    const updates = (owned as Array<{ id: string; tags?: string[] | null }>).map((row) => {
        const current = Array.isArray(row.tags) ? row.tags : []
        let next: string[]
        if (mode === 'set') next = uniq(tags)
        else if (mode === 'add') next = uniq([...current, ...tags])
        else next = current.filter((t) => !tags.includes(t))
        return { id: row.id, tags: next }
    })

    // Supabase doesn't have a single-shot per-row patch, so run in parallel.
    const results = await Promise.all(
        updates.map((u) =>
            supabase.from('waiting_guests').update({ tags: u.tags }).eq('id', u.id)
        )
    )
    const firstErr = results.find((r) => r.error)
    if (firstErr?.error) {
        return NextResponse.json({ error: firstErr.error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: updates.length })
}
