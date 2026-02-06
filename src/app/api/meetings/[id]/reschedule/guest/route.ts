import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = getSupabaseClient()
    const { id: meetingId } = await params
    const body = await req.json()
    const { guestId, date, time, guestName, guestEmail, note, customFields } = body

    if (!guestId || !date || !time) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const scheduledAt = new Date(`${date}T${time}`)

    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, status, reschedule_requested')
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
        .select('id')
        .eq('id', guestId)
        .eq('meeting_id', meetingId)
        .single()

    if (!guest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 })
    }

    const { data: updatedMeeting, error } = await supabase
        .from('meetings')
        .update({
            scheduled_at: scheduledAt.toISOString(),
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

    return NextResponse.json(updatedMeeting)
}
