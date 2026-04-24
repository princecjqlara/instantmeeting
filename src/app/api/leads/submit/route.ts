import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { qualifyLead } from '@/lib/lead-qualifier'
import { deriveLeadPipelineStage } from '@/lib/lead-pipeline'
import { admitGuestLogic, isNoAvailableTeamMemberError } from '@/lib/admit-logic'
import type { LeadAnswer, LeadFormQuestion } from '@/lib/lead-forms-types'
import { buildGuestWaitingPath } from '@/lib/external-browser-handoff'
import { normalizeSubmittedLeadAnswers } from '@/lib/lead-answer-display'
import { maybeSendLeadFormQualifiedMetaEvent } from '@/lib/lead-form-qualified-capi'
import { insertWaitingGuestWithCompat, updateWaitingGuestWithCompat } from '@/lib/waiting-guests-column-compat'
import { isHostCurrentlyAvailable } from '@/lib/waiting-room-state'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function pickFromAnswers(answers: LeadAnswer[], type: string): string | null {
    const hit = answers.find((a) => a.type === type)
    if (!hit) return null
    const v = Array.isArray(hit.answer) ? hit.answer.join(', ') : String(hit.answer || '')
    return v.trim() || null
}

function deriveName(answers: LeadAnswer[], fallback: string): string {
    for (const a of answers) {
        const text = a.question_text.toLowerCase()
        if (text.includes('name')) {
            const v = Array.isArray(a.answer) ? a.answer.join(' ') : String(a.answer || '')
            if (v.trim()) return v.trim().slice(0, 80)
        }
    }
    return fallback
}

function normalizeLeadSessionToken(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const normalized = value.trim()
    return normalized || null
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

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { formSlug, sessionToken, answers, guestName, guestEmail, guestPhone, hp, page_url, fbclid, fbp, fbc } = body || {}

    if (!formSlug || !Array.isArray(answers)) {
        return NextResponse.json({ error: 'formSlug and answers required' }, { status: 400 })
    }

    // Honeypot: if filled, pretend success so bots don't retry
    if (typeof hp === 'string' && hp.trim().length > 0) {
        return NextResponse.json({
            verdict: 'unqualified',
            score: 0,
            reasoning: 'Filtered',
            message: 'Thanks for your response.',
        })
    }

    const supabase = getSupabaseClient()

    // Load form + questions + host
    const { data: form, error: formErr } = await supabase
        .from('lead_forms')
        .select('*')
        .eq('slug', formSlug)
        .maybeSingle()

    if (formErr || !form || !form.is_active) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const [{ data: questions }, { data: host }] = await Promise.all([
        supabase
            .from('lead_form_questions')
            .select('*')
            .eq('form_id', form.id)
            .order('order_index', { ascending: true }),
        supabase
            .from('users')
            .select(
                'id, name, availability_mode, available_from, available_to, timezone, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields'
            )
            .eq('id', form.user_id)
            .maybeSingle(),
    ])

    const qs = (questions || []) as LeadFormQuestion[]

    const hostActive = isHostCurrentlyAvailable({
        availabilityMode: host?.availability_mode as 'always' | 'never' | 'scheduled' | null | undefined,
        availableFrom: host?.available_from,
        availableTo: host?.available_to,
        timezone: host?.timezone,
    })
    const bookingHost = host
        ? {
              id: host.id,
              name: host.name,
              available_from: host.available_from,
              available_to: host.available_to,
              timezone: host.timezone,
              meeting_duration: host.meeting_duration,
              booking_title: host.booking_title,
              booking_description: host.booking_description,
              booking_note_placeholder: host.booking_note_placeholder,
              booking_form_fields: host.booking_form_fields,
              availability_mode: host.availability_mode,
          }
        : null

    // Validate required fields present
    for (const q of qs) {
        if (!q.required) continue
        const a = (answers as LeadAnswer[]).find((x) => x.question_id === q.id)
        const v = a ? (Array.isArray(a.answer) ? a.answer.join('') : a.answer) : ''
        if (!v || String(v).trim() === '') {
            return NextResponse.json(
                { error: `Missing required answer: ${q.question_text}` },
                { status: 400 }
            )
        }
    }

    const resolvedEmail = guestEmail || pickFromAnswers(answers, 'email')
    const resolvedPhone = guestPhone || pickFromAnswers(answers, 'phone')
    const resolvedName = guestName || deriveName(answers, 'Lead')
    const normalizedSessionToken = normalizeLeadSessionToken(sessionToken)
    const displayAnswers = normalizeSubmittedLeadAnswers(answers as LeadAnswer[], qs)

    const [qualification, existingLeadSessionResult] = await Promise.all([
        qualifyLead({
            criteria: form.ai_criteria || '',
            threshold: form.auto_admit_threshold || 70,
            questions: qs,
            answers: answers as LeadAnswer[],
        }),
        normalizedSessionToken
            ? supabase
                .from('waiting_guests')
                .select('*')
                .eq('lead_session_token', normalizedSessionToken)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ])

    const { data: existingLeadSession, error: existingLeadSessionErr } = existingLeadSessionResult

    if (existingLeadSessionErr) {
        console.error('Existing lead session lookup failed:', existingLeadSessionErr)
        return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    let meeting = existingLeadSession?.meeting_id ? { id: existingLeadSession.meeting_id } : null

    if (!meeting) {
        const { data: createdMeeting, error: meetingErr } = await supabase
            .from('meetings')
            .insert({
                user_id: form.user_id,
                title: `Lead: ${resolvedName}`,
                status: 'active',
            })
            .select('id')
            .single()

        if (meetingErr || !createdMeeting) {
            console.error('Meeting create failed:', meetingErr)
            return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
        }

        meeting = createdMeeting
    }

    const pipelineStage = deriveLeadPipelineStage({
        submittedAt: new Date().toISOString(),
        qualificationVerdict: qualification.verdict,
    })
    const guestPayload = {
        meeting_id: meeting.id,
        guest_name: resolvedName,
        guest_email: resolvedEmail,
        guest_phone: resolvedPhone,
        status: existingLeadSession?.status === 'admitted' ? 'admitted' : 'waiting',
        lead_form_id: form.id,
        lead_answers: displayAnswers,
        qualification_score: qualification.score,
        qualification_verdict: qualification.verdict,
        qualification_reasoning: qualification.reasoning,
        lead_session_token: normalizedSessionToken,
        submitted_at: new Date().toISOString(),
        pipeline_stage: pipelineStage,
        pipeline_stage_changed_at: new Date().toISOString(),
    }

    const guestResult = existingLeadSession?.id
        ? (() => {
            const { meeting_id: _ignoredMeetingId, ...guestUpdatePayload } = guestPayload
            return updateWaitingGuestWithCompat<{ id: string; status?: string | null; join_token?: string | null }>(
                supabase,
                existingLeadSession.id,
                guestUpdatePayload
            )
        })()
        : insertWaitingGuestWithCompat<{ id: string; status?: string | null; join_token?: string | null }>(supabase, guestPayload)

    const { data: guest, error: guestErr } = await guestResult

    if (guestErr || !guest) {
        console.error('Waiting guest insert failed:', guestErr)
        return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
    }

    // Clean up draft row if present
    if (sessionToken) {
        try {
            await supabase.from('lead_drafts').delete().eq('session_token', sessionToken)
        } catch {
            /* optional */
        }
    }

    // Qualified → auto-admit straight into the room, but only if a team
    // member is actually available to take the call. Solo hosts (no team)
    // still pass through; if a team exists but nobody is clocked in or
    // free, fall back to a booking calendar so the lead isn't dropped
    // into an empty room.
    if (qualification.verdict === 'qualified') {
        after(() =>
            maybeSendLeadFormQualifiedMetaEvent({
                supabase,
                leadForm: form,
                lead: {
                    id: guest.id,
                    guest_name: resolvedName,
                    guest_email: resolvedEmail,
                    guest_phone: resolvedPhone,
                    qualification_score: qualification.score,
                    qualification_verdict: qualification.verdict,
                    meta_qualified_sent_at:
                        typeof existingLeadSession?.meta_qualified_sent_at === 'string'
                            ? existingLeadSession.meta_qualified_sent_at
                            : null,
                },
                eventSourceUrl:
                    typeof page_url === 'string' && page_url.trim()
                        ? page_url
                        : `${req.nextUrl.origin}/leads/${form.slug}`,
                clientIpAddress: getClientIpAddress(req),
                clientUserAgent: req.headers.get('user-agent'),
                fbp: typeof fbp === 'string' ? fbp : null,
                fbc: typeof fbc === 'string' ? fbc : null,
                fbclid: typeof fbclid === 'string' ? fbclid : null,
            }).catch((error) => {
                console.error('Qualified Meta CAPI send failed:', error)
            })
        )

        const admitAndRespond = async (requireAvailableAssignee: boolean) => {
            const result = await admitGuestLogic(meeting.id, guest.id, {
                requireAvailableAssignee,
            })
            return NextResponse.json({
                verdict: 'qualified',
                score: qualification.score,
                reasoning: qualification.reasoning,
                meeting_id: meeting.id,
                guest_id: guest.id,
                join_url: `${req.nextUrl.origin}/api/join/${result.join_token}`,
                meet_link: result.meet_link,
            })
        }

        try {
            return await admitAndRespond(true)
        } catch (err) {
            if (isNoAvailableTeamMemberError(err)) {
                return NextResponse.json({
                    verdict: 'needs_booking',
                    score: qualification.score,
                    reasoning: qualification.reasoning,
                    meeting_id: meeting.id,
                    guest_id: guest.id,
                    host: bookingHost,
                    message:
                        form.unqualified_message ||
                        "Nobody is available to take your call right now — pick a time that works for you.",
                })
            }
            console.error('Auto-admit failed, falling back to waiting room:', err)
        }
    }

    // Host offline / outside availability window → show a booking
    // calendar instead of stranding the lead. Qualified leads already
    // got a chance to auto-admit via an available team member above.
    if (!hostActive) {
        return NextResponse.json({
            verdict: 'needs_booking',
            score: qualification.score,
            reasoning: qualification.reasoning,
            meeting_id: meeting.id,
            guest_id: guest.id,
            host: bookingHost,
            message:
                form.unqualified_message ||
                "The host isn't available right now — pick a time that works for you.",
        })
    }

    // Unqualified → stay out on hard disqualify or when host disables fallback
    if (
        qualification.verdict === 'unqualified' &&
        (qualification.hard || !form.fallback_to_waiting)
    ) {
        return NextResponse.json({
            verdict: 'unqualified',
            score: qualification.score,
            reasoning: qualification.reasoning,
            message: form.unqualified_message || 'Thanks for your response.',
        })
    }

    // Review or fallback → send to waiting room
    return NextResponse.json({
        verdict: qualification.verdict,
        score: qualification.score,
        reasoning: qualification.reasoning,
        meeting_id: meeting.id,
        guest_id: guest.id,
        waiting_url: `${req.nextUrl.origin}${buildGuestWaitingPath(meeting.id, guest.id, resolvedName)}`,
    })
}
