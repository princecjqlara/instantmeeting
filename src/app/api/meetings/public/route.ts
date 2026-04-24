import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { BookingField } from '@/lib/types'
import { combineDateAndTimeInTimeZone } from '@/lib/zoned-scheduling'
import { maybeSendLeadFormFunnelMetaEvent } from '@/lib/lead-form-qualified-capi'

// Force dynamic to prevent static generation
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

// POST: Create a new meeting request from a guest
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { hostId, guestName, guestEmail, guestPhone, note, date, time, customFields, sourceGuestId, pageUrl, fbclid, fbp, fbc } = body

    if (!hostId || !guestName || !date || !time) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Verify host exists
    const { data: host, error: hostError } = await supabase
        .from('users')
        .select('id, email, name, availability_mode, available_from, available_to, timezone, booking_form_fields')
        .eq('id', hostId)
        .single()

    if (hostError || !host) {
        return NextResponse.json({ error: 'Host not found' }, { status: 404 })
    }

    const requiredFields = (host.booking_form_fields || []).filter((field: BookingField) => field.required)
    if (requiredFields.length > 0) {
        const customFieldMap = new Map(
            Array.isArray(customFields)
                ? customFields.map((field: { id: string; value: string }) => [field.id, field.value])
                : []
        )
        const missingRequired = requiredFields.some((field: BookingField) => {
            const value = customFieldMap.get(field.id)
            return !value || String(value).trim() === ''
        })
        if (missingRequired) {
            return NextResponse.json({ error: 'Missing required form fields' }, { status: 400 })
        }
    }

    // 2. Create meeting in "pending" status
    // Note: We don't create a Google Calendar event yet until the host approves (or we could, but let's stick to simple DB first)
    // Actually, for "Instant Meeting" flow, maybe we should just create it?
    // The requirement says "non user will book an appoint ment".
    // Let's create a meeting record.

    const scheduledAt = combineDateAndTimeInTimeZone(date, time, host.timezone || 'UTC')

    const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
            user_id: host.id,
            title: `Meeting with ${guestName}`,
            status: 'pending',
            scheduled_at: scheduledAt,
            // We can store guest info in description or separate table if needed.
            // For now, let's append to title or rely on waiting_guests table concept? 
            // The prompt says "fill up form... then show calendar".
            // Let's assume we store the guest details in the meeting title or similar for now.
        })
        .select()
        .single()

    if (meetingError) {
        return NextResponse.json({ error: meetingError.message }, { status: 500 })
    }

    // 3. Add guest to waiting_guests (or similar lead table) so we have their info?
    // Using waiting_guests as a lead storage for now since it has guest_name.
    await supabase.from('waiting_guests').insert({
        meeting_id: meeting.id,
        guest_name: guestName,
        guest_email: guestEmail || null,
        guest_phone: guestPhone || null,
        note: note || null,
        custom_fields: Array.isArray(customFields) ? customFields : [],
        status: 'waiting'
    })

    if (typeof sourceGuestId === 'string' && sourceGuestId.trim()) {
        const { data: sourceGuest } = await supabase
            .from('waiting_guests')
            .select('id, guest_name, guest_email, guest_phone, qualification_score, qualification_verdict, lead_form_id')
            .eq('id', sourceGuestId.trim())
            .maybeSingle()

        if (sourceGuest?.lead_form_id) {
            const { data: leadForm } = await supabase
                .from('lead_forms')
                .select('*')
                .eq('id', sourceGuest.lead_form_id)
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
                            id: sourceGuest.id,
                            guest_name: sourceGuest.guest_name,
                            guest_email: sourceGuest.guest_email,
                            guest_phone: sourceGuest.guest_phone,
                            qualification_score: sourceGuest.qualification_score,
                            qualification_verdict: sourceGuest.qualification_verdict,
                        },
                        clientIpAddress: getClientIpAddress(req),
                        clientUserAgent: req.headers.get('user-agent'),
                        fbp: typeof fbp === 'string' ? fbp : null,
                        fbc: typeof fbc === 'string' ? fbc : null,
                        fbclid: typeof fbclid === 'string' ? fbclid : null,
                    }).catch((sendError) => {
                        console.error('Lead-form Schedule Meta CAPI send failed:', sendError)
                    })
                )
            }
        }
    }

    return NextResponse.json(meeting)
}
