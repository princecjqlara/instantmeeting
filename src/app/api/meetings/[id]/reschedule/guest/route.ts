import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { combineDateAndTimeInTimeZone } from '@/lib/zoned-scheduling'
import { maybeSendLeadFormFunnelMetaEvent } from '@/lib/lead-form-qualified-capi'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = getSupabaseClient()
    const { id: meetingId } = await params
    const body = await req.json()
    const { guestId, date, time, guestName, guestEmail, note, customFields, pageUrl, fbclid, fbp, fbc } = body

    if (!guestId || !date || !time) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, status, reschedule_requested, user_id')
        .eq('id', meetingId)
        .single()

    if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (meeting.status === 'completed') {
        return NextResponse.json({ error: 'Meeting ended' }, { status: 400 })
    }

    if (!meeting.reschedule_requested) {
        return NextResponse.json({ error: 'Reschedule not requested' }, { status: 400 })
    }

    const { data: guest } = await supabase
        .from('waiting_guests')
        .select('id, guest_name, guest_email, guest_phone, qualification_score, qualification_verdict, lead_form_id')
        .eq('id', guestId)
        .eq('meeting_id', meetingId)
        .single()

    if (!guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    const { data: host } = await supabase
        .from('users')
        .select('timezone')
        .eq('id', meeting.user_id)
        .single()

    const scheduledAt = combineDateAndTimeInTimeZone(date, time, host?.timezone || 'UTC')

    const { data: updatedMeeting, error } = await supabase
        .from('meetings')
        .update({
            scheduled_at: scheduledAt,
            reschedule_requested: false,
        })
        .eq('id', meetingId)
        .select()
        .single()

    if (error || !updatedMeeting) {
        return NextResponse.json({ error: error?.message || 'Failed to reschedule' }, { status: 500 })
    }

    await supabase
        .from('waiting_guests')
        .update({
            guest_name: guestName || null,
            guest_email: guestEmail || null,
            note: note || null,
            custom_fields: Array.isArray(customFields) ? customFields : [],
        })
        .eq('id', guestId)

    if (guest.lead_form_id) {
        const { data: leadForm } = await supabase
            .from('lead_forms')
            .select('*')
            .eq('id', guest.lead_form_id)
            .maybeSingle()

        if (leadForm) {
            after(() =>
                maybeSendLeadFormFunnelMetaEvent({
                    supabase,
                    leadForm,
                    eventName: 'Schedule',
                    eventSourceUrl:
                        typeof pageUrl === 'string' && pageUrl.trim()
                            ? pageUrl
                            : `${req.nextUrl.origin}/leads/${leadForm.slug}`,
                    lead: {
                        id: guest.id,
                        guest_name: guestName || guest.guest_name,
                        guest_email: guestEmail || guest.guest_email,
                        guest_phone: guest.guest_phone,
                        qualification_score: guest.qualification_score,
                        qualification_verdict: guest.qualification_verdict,
                    },
                    clientIpAddress: getClientIpAddress(req),
                    clientUserAgent: req.headers.get('user-agent'),
                    fbp: typeof fbp === 'string' ? fbp : null,
                    fbc: typeof fbc === 'string' ? fbc : null,
                    fbclid: typeof fbclid === 'string' ? fbclid : null,
                }).catch((sendError) => {
                    console.error('Lead-form reschedule Meta CAPI send failed:', sendError)
                })
            )
        }
    }

    return NextResponse.json(updatedMeeting)
}
