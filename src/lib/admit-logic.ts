import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { randomUUID } from 'crypto'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function admitGuestLogic(meetingId: string, guestId: string) {
    const supabase = getSupabaseClient()

    // 1. Fetch meeting and host tokens
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

    // 2. Create Google Meet link if missing
    let meetLink = meeting.google_meet_link
    if (!meetLink) {
        if (!host.google_access_token || !host.google_refresh_token) {
            throw new Error('Missing Google tokens for host')
        }

        try {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            )

            oauth2Client.setCredentials({
                access_token: host.google_access_token,
                refresh_token: host.google_refresh_token,
            })

            const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

            const event = await calendar.events.insert({
                calendarId: 'primary',
                conferenceDataVersion: 1,
                requestBody: {
                    summary: meeting.title || 'Instant Meeting',
                    start: {
                        dateTime: new Date().toISOString(),
                        timeZone: 'UTC',
                    },
                    end: {
                        dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        timeZone: 'UTC',
                    },
                    conferenceData: {
                        createRequest: {
                            requestId: `meeting-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' },
                        },
                    },
                },
            })

            meetLink = event.data.hangoutLink

            await supabase
                .from('meetings')
                .update({
                    google_meet_link: meetLink,
                    google_event_id: event.data.id,
                    status: meeting.status === 'pending' ? 'active' : meeting.status,
                })
                .eq('id', meetingId)

        } catch (error) {
            console.error('Error creating Google Meet:', error)
            throw new Error('Failed to create Google Meet')
        }
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
        return { guest, meet_link: meetLink }
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

    return {
        guest: admittedGuest,
        meet_link: meetLink,
        join_token: joinToken
    }
}
