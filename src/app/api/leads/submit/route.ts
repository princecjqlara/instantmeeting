import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { qualifyLead } from '@/lib/lead-qualifier'
import { admitGuestLogic, isNoAvailableTeamMemberError } from '@/lib/admit-logic'
import type { LeadAnswer, LeadFormQuestion } from '@/lib/lead-forms-types'

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

function isHostActive(host: {
    availability_mode?: string | null
    available_from?: string | null
    available_to?: string | null
    timezone?: string | null
}): boolean {
    const mode = host.availability_mode || 'always'
    if (mode === 'always') return true
    if (mode === 'never') return false
    if (mode !== 'scheduled') return true

    const from = host.available_from
    const to = host.available_to
    if (!from || !to) return false

    try {
        const tz = host.timezone || 'UTC'
        const now = new Date()
        const fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        })
        const [h, m] = fmt.format(now).split(':').map(Number)
        const cur = h * 60 + m
        const toMin = (s: string) => {
            const [hh, mm] = s.split(':').map(Number)
            return (hh || 0) * 60 + (mm || 0)
        }
        const a = toMin(from)
        const b = toMin(to)
        if (a === b) return false
        return a < b ? cur >= a && cur < b : cur >= a || cur < b
    } catch {
        return false
    }
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

export async function POST(req: NextRequest) {
    const body = await req.json()
    const { formSlug, sessionToken, answers, guestName, guestEmail, guestPhone, hp } = body || {}

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

    const { data: questions } = await supabase
        .from('lead_form_questions')
        .select('*')
        .eq('form_id', form.id)
        .order('order_index', { ascending: true })

    const qs = (questions || []) as LeadFormQuestion[]

    const { data: host } = await supabase
        .from('users')
        .select(
            'id, name, availability_mode, available_from, available_to, timezone, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields'
        )
        .eq('id', form.user_id)
        .maybeSingle()

    const hostActive = isHostActive(host || {})
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

    // AI qualification
    const qualification = await qualifyLead({
        criteria: form.ai_criteria || '',
        threshold: form.auto_admit_threshold || 70,
        questions: qs,
        answers: answers as LeadAnswer[],
    })

    const resolvedEmail = guestEmail || pickFromAnswers(answers, 'email')
    const resolvedPhone = guestPhone || pickFromAnswers(answers, 'phone')
    const resolvedName = guestName || deriveName(answers, 'Lead')

    // Create a meeting row to host this conversation (reuses existing flow)
    const { data: meeting, error: meetingErr } = await supabase
        .from('meetings')
        .insert({
            user_id: form.user_id,
            title: `Lead: ${resolvedName}`,
            status: 'active',
        })
        .select('id')
        .single()

    if (meetingErr || !meeting) {
        console.error('Meeting create failed:', meetingErr)
        return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
    }

    // Persist the lead as a waiting_guest row
    const { data: guest, error: guestErr } = await supabase
        .from('waiting_guests')
        .insert({
            meeting_id: meeting.id,
            guest_name: resolvedName,
            guest_email: resolvedEmail,
            guest_phone: resolvedPhone,
            status: 'waiting',
            lead_form_id: form.id,
            lead_answers: answers,
            qualification_score: qualification.score,
            qualification_verdict: qualification.verdict,
            qualification_reasoning: qualification.reasoning,
            lead_session_token: sessionToken || null,
            submitted_at: new Date().toISOString(),
        })
        .select('*')
        .single()

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

    // Host offline / outside availability window → show a booking
    // calendar instead of stranding the lead. The lead is still saved.
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

    // Qualified → auto-admit straight into the room, but only if a team
    // member is actually available to take the call. Solo hosts (no team)
    // still pass through; if a team exists but nobody is clocked in or
    // free, fall back to a booking calendar so the lead isn't dropped
    // into an empty room.
    if (qualification.verdict === 'qualified') {
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
                // Host is active but the team clock isn't in use right now
                // (no teammates clocked in). The host handles the call
                // themselves instead of stranding the lead in a booking flow.
                if (err.availabilityReason === 'no_clocked_in') {
                    try {
                        return await admitAndRespond(false)
                    } catch (retryErr) {
                        console.error('Auto-admit retry without assignee failed:', retryErr)
                    }
                }
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
        waiting_url: `${req.nextUrl.origin}/waiting/${meeting.id}?guestId=${guest.id}`,
    })
}
