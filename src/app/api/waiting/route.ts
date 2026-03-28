import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    admitGuestLogic,
    getAutoAssignableMember,
    isNoAvailableTeamMemberError,
} from '@/lib/admit-logic'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables')
    }

    return createClient(supabaseUrl, supabaseKey)
}

function toAutoScheduleReason(reason: string | null | undefined) {
    return reason === 'all_members_busy'
        ? 'all_members_busy'
        : 'no_online_members'
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

    console.log('Waiting API called with meetingId:', meetingId, 'guestId:', guestId)

    // Get meeting, host info, and content in parallel
    const [{ data: meeting, error: meetingError }, contentPromise, guestPromise, hostPromise, admittedGuestPromise] = await Promise.all([
        supabase
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
                user_id,
                assigned_member_id
            `)
            .eq('id', meetingId)
            .single(),

        // Content query - we'll execute it if meeting exists
        Promise.resolve(null),

        // Guest status if guestId provided
        guestId ? supabase
            .from('waiting_guests')
            .select('*')
            .eq('id', guestId)
            .single()
            : Promise.resolve({ data: null, error: null }),

        // Host info - we'll execute it if meeting exists
        Promise.resolve(null),

        // Admitted guest check
        supabase
            .from('waiting_guests')
            .select('id, guest_name')
            .eq('meeting_id', meetingId)
            .eq('status', 'admitted')
            .single()
    ])

    if (meetingError || !meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Now execute dependent queries in parallel
    const [{ data: content }, { data: host }, { data: guestStatus }] = await Promise.all([
        supabase
            .from('content')
            .select('*')
            .eq('user_id', meeting.user_id)
            .order('order_index', { ascending: true }),
        supabase
            .from('users')
            .select('id, name, username, avatar_url, bio, availability_mode, auto_admit, available_from, available_to, timezone, scroll_threshold, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields, welcome_audio_url')
            .eq('id', meeting.user_id)
            .single(),
        guestPromise
    ])

    const { data: admittedGuest } = admittedGuestPromise
    const origin = req.nextUrl.origin

    // If meeting has an assigned team member, fetch their data
    let assignedMember = null
    if (meeting.assigned_member_id) {
        const { data: member } = await supabase
            .from('team_members')
            .select('id, name, avatar_url, welcome_audio_url')
            .eq('id', meeting.assigned_member_id)
            .single()

        if (member) {
            assignedMember = member
        }
    }

    let autoScheduleRequired = false
    let autoScheduleReason: 'no_online_members' | 'all_members_busy' | null = null

    if (guestStatus?.status === 'waiting' && host?.auto_admit && !meeting.assigned_member_id) {
        const availability = await getAutoAssignableMember(meeting.user_id, meeting.id)

        if (!availability.nextMember) {
            // Only require scheduling when an actual team exists but no one is available.
            // Solo hosts (no_team / no_members) handle meetings themselves.
            const blockingReasons = ['no_clocked_in', 'all_members_busy', 'lookup_failed']
            if (blockingReasons.includes(availability.reason)) {
                autoScheduleRequired = true
                autoScheduleReason = toAutoScheduleReason(availability.reason)
            }
        }
    }

    return NextResponse.json({
        meeting: {
            id: meeting.id,
            title: meeting.title,
            status: meeting.status,
            host_joined_at: meeting.host_joined_at,
            ended_at: meeting.ended_at,
            reschedule_requested: meeting.reschedule_requested,
            reschedule_requested_at: meeting.reschedule_requested_at,
            assigned_member_id: meeting.assigned_member_id,
        },
        host,
        assignedMember,
        content: content || [],
        guest: guestStatus,
        admittedGuest: admittedGuest || null,
        autoScheduleRequired,
        autoScheduleReason,
        meetLink: guestStatus?.status === 'admitted' &&
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

    // Create waiting guest entry in the room
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

    // Check for auto-admit
    const { data: host } = await supabase
        .from('users')
        .select('auto_admit')
        .eq('id', originalMeeting.user_id)
        .single()

    if (host?.auto_admit) {
        try {
            const result = await admitGuestLogic(meetingId, guest.id, {
                requireAvailableAssignee: true,
            })

            return NextResponse.json({
                ...guest,
                status: 'admitted',
                admitted_at: result.guest.admitted_at,
                join_token: result.join_token,
                meet_link: result.meet_link,
                assigned_member: result.assigned_member || null,
                assignment_source: result.assignment_source,
                autoScheduleRequired: false,
                autoScheduleReason: null,
            })
        } catch (admitError) {
            if (isNoAvailableTeamMemberError(admitError)) {
                return NextResponse.json({
                    ...guest,
                    autoScheduleRequired: true,
                    autoScheduleReason: toAutoScheduleReason(admitError.availabilityReason),
                })
            }

            console.error('Auto-admit failed:', admitError)
            // If auto-admit fails, guest stays in waiting room
        }
    }

    return NextResponse.json(guest)
}

// PATCH: Guest leaves waiting room (navigates away or submits booking form)
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { guestId, status } = body

    if (!guestId) {
        return NextResponse.json({ error: 'Guest ID required' }, { status: 400 })
    }

    const allowedStatuses = ['left']
    if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Try updating with left_at first; fall back to status-only if column doesn't exist yet
    let data, error
    const withLeftAt = await supabase
        .from('waiting_guests')
        .update({ status, left_at: new Date().toISOString() })
        .eq('id', guestId)
        .select()
        .single()

    if (withLeftAt.error && withLeftAt.error.message.includes('left_at')) {
        // left_at column doesn't exist yet — update status only
        const fallback = await supabase
            .from('waiting_guests')
            .update({ status })
            .eq('id', guestId)
            .select()
            .single()
        data = fallback.data
        error = fallback.error
    } else {
        data = withLeftAt.data
        error = withLeftAt.error
    }

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}
