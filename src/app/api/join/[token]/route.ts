import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildGuestRoomPath, buildGuestWaitingPath } from '@/lib/external-browser-handoff'
import { getAutoAssignableMember } from '@/lib/admit-logic'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function isAssignedMemberClockedIn(supabase: ReturnType<typeof getSupabaseClient>, memberId: string) {
    const { data, error } = await supabase
        .from('clock_sessions')
        .select('id')
        .eq('member_id', memberId)
        .is('clocked_out_at', null)
        .maybeSingle()

    if (error) {
        console.error('Assigned member clock lookup failed:', error)
        return false
    }

    return Boolean(data?.id)
}

async function shouldRouteAdmittedGuestToBooking(
    supabase: ReturnType<typeof getSupabaseClient>,
    meeting: {
        id: string
        user_id: string
        assigned_member_id?: string | null
    }
) {
    if (meeting.assigned_member_id) {
        return !(await isAssignedMemberClockedIn(supabase, meeting.assigned_member_id))
    }

    const availability = await getAutoAssignableMember(meeting.user_id, meeting.id)

    return ['no_clocked_in', 'all_members_busy', 'lookup_failed'].includes(availability.reason)
}

function normalizeQualifiedMediaMode(value: unknown) {
    return (
        value === 'audio_video' ||
        value === 'audio_only' ||
        value === 'video_only' ||
        value === 'none'
    )
        ? value
        : 'audio_video'
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const supabase = getSupabaseClient()
    const { token } = await params

    const { data: guest } = await supabase
        .from('waiting_guests')
        .select('id, meeting_id, status, guest_name, lead_form_id')
        .eq('join_token', token)
        .single()

    if (!guest) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, user_id, google_meet_link, status, host_joined_at, reschedule_requested, assigned_member_id')
        .eq('id', guest.meeting_id)
        .single()

    if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const origin = req.nextUrl.origin
    const waitingUrl = `${origin}${buildGuestWaitingPath(guest.meeting_id, guest.id, guest.guest_name)}`

    if (
        guest.status !== 'admitted' ||
        meeting.status === 'completed' ||
        meeting.reschedule_requested ||
        await shouldRouteAdmittedGuestToBooking(supabase, meeting)
    ) {
        return NextResponse.redirect(waitingUrl)
    }

    // Redirect to the in-app video room
    // google_meet_link now stores a relative path like /room/{meetingId}
    let qualifiedMediaMode: string | null = null
    if (guest.lead_form_id) {
        const { data: form, error: formError } = await supabase
            .from('lead_forms')
            .select('qualified_media_mode')
            .eq('id', guest.lead_form_id)
            .maybeSingle()

        if (formError) {
            console.error('Lead form media mode lookup failed:', formError)
        }

        qualifiedMediaMode = normalizeQualifiedMediaMode(form?.qualified_media_mode)
    }

    const roomPath = buildGuestRoomPath(guest.meeting_id, guest.id, guest.guest_name, {
        media: qualifiedMediaMode,
    })
    return NextResponse.redirect(`${origin}${roomPath}`)
}
