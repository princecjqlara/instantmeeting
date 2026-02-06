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

    // Get meetings with waiting guests count
    const { data: meetings, error } = await supabase
        .from('meetings')
        .select(`
      *,
      waiting_guests (
        id,
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

    return NextResponse.json(meetings)
}

// POST: Create a new meeting with Google Meet link
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title } = body

    // Get user with tokens
    const { data: user } = await supabase
        .from('users')
        .select('id, google_access_token, google_refresh_token')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.google_access_token || !user.google_refresh_token) {
        return NextResponse.json({ error: 'Missing Google tokens for host' }, { status: 400 })
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
                summary: title || 'Instant Meeting',
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
                        conferenceSolutionKey: {
                            type: 'hangoutsMeet',
                        },
                    },
                },
            },
        })

        const meetLink = event.data.hangoutLink

        const { data: meeting, error } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: title || 'Instant Meeting',
                google_meet_link: meetLink,
                google_event_id: event.data.id,
                status: 'active',
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(meeting)
    } catch (err) {
        console.error('Error creating meeting:', err)
        return NextResponse.json(
            { error: 'Failed to create Google Meet' },
            { status: 500 }
        )
    }
}
