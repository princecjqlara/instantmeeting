import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const supabase = getSupabaseClient()
    const { token } = await params

    const { data: guest } = await supabase
        .from('waiting_guests')
        .select('id, meeting_id, status')
        .eq('join_token', token)
        .single()

    if (!guest) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 })
    }

    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, google_meet_link, status, host_joined_at, reschedule_requested')
        .eq('id', guest.meeting_id)
        .single()

    if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const waitingUrl = `${req.nextUrl.origin}/waiting/${guest.meeting_id}`

    if (
        guest.status !== 'admitted' ||
        meeting.status === 'completed' ||
        !meeting.host_joined_at ||
        meeting.reschedule_requested ||
        !meeting.google_meet_link
    ) {
        return NextResponse.redirect(waitingUrl)
    }

    return NextResponse.redirect(meeting.google_meet_link)
}
