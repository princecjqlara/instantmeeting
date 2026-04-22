import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { shouldAutoCompleteMeetingFromGuestStatuses } from '@/lib/meeting-presence'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: List user's meetings
export async function GET() {
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

    // Get meetings with waiting guests
    const { data: meetings, error } = await supabase
        .from('meetings')
        .select(`
      *,
      waiting_guests (
        id,
        meeting_id,
        guest_name,
        status,
        joined_at
      )
    `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const normalizedMeetings = (meetings || []).map((meeting) => ({
        ...meeting,
        waiting_guests: Array.isArray(meeting.waiting_guests) ? meeting.waiting_guests : [],
    }))

    const staleActiveMeetingIds = normalizedMeetings
        .filter((meeting) =>
            shouldAutoCompleteMeetingFromGuestStatuses(
                meeting.status,
                (meeting.waiting_guests || []).map((guest: { status?: string | null }) => guest.status)
            )
        )
        .map((meeting) => meeting.id)

    if (staleActiveMeetingIds.length > 0) {
        await supabase
            .from('meetings')
            .update({ status: 'completed', ended_at: new Date().toISOString() })
            .in('id', staleActiveMeetingIds)
            .eq('user_id', user.id)

        for (const meeting of normalizedMeetings) {
            if (staleActiveMeetingIds.includes(meeting.id)) {
                meeting.status = 'completed'
            }
        }
    }

    return NextResponse.json(normalizedMeetings, {
        headers: { 'Cache-Control': 'private, max-age=5, stale-while-revalidate=15' },
    })
}

// POST: Create a new meeting with in-app video room
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title } = body

    // Get user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    try {
        // Create meeting — the room link will be /room/{meetingId}
        const { data: meeting, error } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: title || 'Instant Meeting',
                status: 'pending',
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Store the in-app room link in google_meet_link column for backward compatibility
        // TODO: Rename column to 'room_link' in a future migration
        const roomLink = `/room/${meeting.id}`
        await supabase
            .from('meetings')
            .update({ google_meet_link: roomLink })
            .eq('id', meeting.id)

        return NextResponse.json({ ...meeting, google_meet_link: roomLink })
    } catch (err) {
        console.error('Error creating meeting:', err)
        return NextResponse.json(
            { error: 'Failed to create meeting' },
            { status: 500 }
        )
    }
}
