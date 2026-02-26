/**
 * Admit Logic — Handles guest admission to a meeting
 * 
 * Updated to use in-app WebRTC video rooms instead of Google Meet.
 * The room link is simply /room/{meetingId} — no external APIs needed.
 * 
 * NOTE: Google Calendar integration has been removed for the video call.
 * If you still need Calendar events for scheduling purposes, that logic
 * should be handled separately (e.g., in the booking flow).
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function admitGuestLogic(meetingId: string, guestId: string) {
    const supabase = getSupabaseClient()

    // 1. Fetch meeting data
    const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*, users(*)')
        .eq('id', meetingId)
        .single()

    if (meetingError || !meeting) {
        throw new Error('Meeting not found')
    }

    if (meeting.status === 'completed') {
        throw new Error('Meeting has ended')
    }

    const host = meeting.users
    if (!host) {
        throw new Error('Host not found')
    }

    // 2. Generate in-app room link (replaces Google Meet link)
    // The room link is a simple path to our WebRTC video room page
    const roomLink = `/room/${meetingId}`

    // Update meeting status to active if it was pending
    if (meeting.status === 'pending') {
        await supabase
            .from('meetings')
            .update({
                status: 'active',
                // Store the room link in google_meet_link field for backward compatibility
                // TODO: Consider renaming this column to 'room_link' in a future migration
                google_meet_link: roomLink,
            })
            .eq('id', meetingId)
    } else if (!meeting.google_meet_link) {
        // Ensure room link is stored even for already-active meetings
        await supabase
            .from('meetings')
            .update({ google_meet_link: roomLink })
            .eq('id', meetingId)
    }

    // 3. Verify guest and admit
    const { data: guest, error: guestError } = await supabase
        .from('waiting_guests')
        .select('*')
        .eq('id', guestId)
        .eq('meeting_id', meetingId)
        .maybeSingle()

    if (guestError || !guest) {
        throw new Error('Guest not found')
    }

    if (guest.status === 'admitted') {
        return { guest, meet_link: roomLink }
    }

    const joinToken = randomUUID()
    const { data: admittedGuest, error: updateError } = await supabase
        .from('waiting_guests')
        .update({
            status: 'admitted',
            admitted_at: new Date().toISOString(),
            join_token: joinToken,
        })
        .eq('id', guestId)
        .select()
        .single()

    if (updateError) {
        throw new Error(updateError.message)
    }

    // 4. Round-robin team member assignment
    let assignedMember = null
    try {
        const { data: team } = await supabase
            .from('teams')
            .select('id, round_robin_index')
            .eq('owner_id', meeting.user_id)
            .single()

        if (team) {
            // Get clocked-in members
            const { data: members } = await supabase
                .from('team_members')
                .select('id, name, welcome_audio_url')
                .eq('team_id', team.id)
                .eq('is_active', true)
                .order('created_at', { ascending: true })

            if (members && members.length > 0) {
                // Filter to only clocked-in members
                const clockedInMembers = []
                for (const member of members) {
                    const { data: openSession } = await supabase
                        .from('clock_sessions')
                        .select('id')
                        .eq('member_id', member.id)
                        .is('clocked_out_at', null)
                        .limit(1)
                        .single()

                    if (openSession) {
                        clockedInMembers.push(member)
                    }
                }

                if (clockedInMembers.length > 0) {
                    // Round-robin: pick next available member
                    const index = team.round_robin_index % clockedInMembers.length
                    assignedMember = clockedInMembers[index]

                    // Assign member to meeting
                    await supabase
                        .from('meetings')
                        .update({ assigned_member_id: assignedMember.id })
                        .eq('id', meetingId)

                    // Increment round-robin index
                    await supabase
                        .from('teams')
                        .update({ round_robin_index: team.round_robin_index + 1 })
                        .eq('id', team.id)
                }
            }
        }
    } catch (err) {
        // Non-fatal: if team assignment fails, host handles the meeting
        console.error('Team assignment error (non-fatal):', err)
    }

    return {
        guest: admittedGuest,
        meet_link: roomLink,
        join_token: joinToken,
        assigned_member: assignedMember
    }
}
