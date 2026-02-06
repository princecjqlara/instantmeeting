import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST: Admit a waiting guest
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId } = await params
    const body = await req.json()
    const { guestId } = body

    // Verify meeting belongs to user
    const { data: user } = await supabase
        .from('users')
        .select('id, google_access_token, google_refresh_token')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', user.id)
        .single()

    if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    if (!meeting.google_meet_link) {
        if (!user.google_access_token || !user.google_refresh_token) {
            return NextResponse.json(
                { error: 'Missing Google tokens for host' },
                { status: 400 }
            )
        }

        try {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
            )

            oauth2Client.setCredentials({
                access_token: user.google_access_token,
                refresh_token: user.google_refresh_token,
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

            const meetLink = event.data.hangoutLink

            const { data: updatedMeeting, error: updateError } = await supabase
                .from('meetings')
                .update({
                    google_meet_link: meetLink,
                    google_event_id: event.data.id,
                    status: meeting.status === 'pending' ? 'active' : meeting.status,
                })
                .eq('id', meetingId)
                .select('*')
                .single()

            if (updateError || !updatedMeeting) {
                return NextResponse.json({ error: updateError?.message || 'Failed to update meeting' }, { status: 500 })
            }

            meeting = updatedMeeting
        } catch (error) {
            console.error('Error creating Google Meet:', error)
            return NextResponse.json({ error: 'Failed to create Google Meet' }, { status: 500 })
        }
    }

    // Admit the guest
    const { data: guest, error } = await supabase
        .from('waiting_guests')
        .update({
            status: 'admitted',
            admitted_at: new Date().toISOString(),
        })
        .eq('id', guestId)
        .eq('meeting_id', meetingId)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        guest,
        meet_link: meeting.google_meet_link,
    })
}
