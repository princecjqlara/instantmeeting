import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get waiting room info and host's content
export async function GET(req: NextRequest) {
    const supabase = getSupabaseClient()
    const { searchParams } = new URL(req.url)
    const meetingId = searchParams.get('meetingId')
    const guestId = searchParams.get('guestId')

    if (!meetingId) {
        return NextResponse.json({ error: 'Meeting ID required' }, { status: 400 })
    }

    // Get meeting with host info
    const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select(`
      id,
      title,
      status,
      google_meet_link,
      host_joined_at,
      ended_at,
      reschedule_requested,
      reschedule_requested_at,
      user_id
    `)
        .eq('id', meetingId)
        .single()

    if (meetingError || !meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Get host's content
    const { data: content } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', meeting.user_id)
        .order('order_index', { ascending: true })

    // Get guest status if guestId provided
    let guestStatus = null
    if (guestId) {
        const { data: guest } = await supabase
            .from('waiting_guests')
            .select('*')
            .eq('id', guestId)
            .single()
        guestStatus = guest
    }

    // Get host info
    const { data: host } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio, availability_mode, available_from, available_to, timezone, scroll_threshold, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields')
        .eq('id', meeting.user_id)
        .single()

    const origin = req.nextUrl.origin

    // Check if there's already an admitted guest
    const { data: admittedGuest } = await supabase
        .from('waiting_guests')
        .select('id, guest_name')
        .eq('meeting_id', meetingId)
        .eq('status', 'admitted')
        .single()

    return NextResponse.json({
        meeting: {
            id: meeting.id,
            title: meeting.title,
            status: meeting.status,
            host_joined_at: meeting.host_joined_at,
            ended_at: meeting.ended_at,
            reschedule_requested: meeting.reschedule_requested,
            reschedule_requested_at: meeting.reschedule_requested_at,
        },
        host,
        content: content || [],
        guest: guestStatus,
        admittedGuest: admittedGuest || null,
        meetLink: guestStatus?.status === 'admitted' &&
            meeting.host_joined_at &&
            meeting.status !== 'completed' &&
            !meeting.reschedule_requested &&
            guestStatus?.join_token
            ? `${origin}/api/join/${guestStatus.join_token}`
            : null,
    })
}

// POST: Guest joins waiting room
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { meetingId, guestName } = body

    if (!meetingId || !guestName) {
        return NextResponse.json(
            { error: 'Meeting ID and guest name required' },
            { status: 400 }
        )
    }

    // Verify meeting exists and is active
    const { data: originalMeeting } = await supabase
        .from('meetings')
        .select('id, status, title, user_id')
        .eq('id', meetingId)
        .single()

    if (!originalMeeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (originalMeeting.status === 'completed') {
        return NextResponse.json(
            { error: 'Meeting has ended' },
            { status: 400 }
        )
    }

    // Check if there's already a guest waiting or admitted
    const { data: existingGuest } = await supabase
        .from('waiting_guests')
        .select('id, guest_name, status')
        .eq('meeting_id', meetingId)
        .in('status', ['waiting', 'admitted'])
        .single()

    // If room is occupied, create a new meeting room
    if (existingGuest) {
        // Create new meeting room for this guest
        const { data: newMeeting, error: meetingError } = await supabase
            .from('meetings')
            .insert({
                user_id: originalMeeting.user_id,
                title: `${originalMeeting.title} (Guest)`,
                status: 'pending',
            })
            .select()
            .single()

        if (meetingError || !newMeeting) {
            return NextResponse.json(
                { error: 'Failed to create new room' },
                { status: 500 }
            )
        }

        // Create waiting guest entry in the new room
        const { data: guest, error } = await supabase
            .from('waiting_guests')
            .insert({
                meeting_id: newMeeting.id,
                guest_name: guestName,
                status: 'waiting',
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            ...guest,
            newMeetingId: newMeeting.id,
            isNewRoom: true,
        })
    }

    // Create waiting guest entry in original room
    const { data: guest, error } = await supabase
        .from('waiting_guests')
        .insert({
            meeting_id: meetingId,
            guest_name: guestName,
            status: 'waiting',
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(guest)
}
