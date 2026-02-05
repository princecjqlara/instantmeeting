import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Resolve username to active meeting and redirect
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const supabase = getSupabaseClient()
    const { username } = await params

    console.log('Join route - looking up username:', username)

    if (!username) {
        return NextResponse.redirect(new URL(`/?error=no_username`, req.url))
    }

    // Get user by username (case-insensitive)
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, availability_mode, available_from, available_to, timezone, name')
        .ilike('username', username)
        .single()

    if (userError) {
        console.error('Database error in join route:', userError)
        return NextResponse.redirect(new URL(`/profile/${username}?error=not_found`, req.url))
    }

    if (!user) {
        console.log('User not found in join route for username:', username)
        return NextResponse.redirect(new URL(`/profile/${username}?error=not_found`, req.url))
    }

    console.log('Join route - found user:', user.id)

    // Check availability
    let isAvailable = false
    if (user.availability_mode === 'always') {
        isAvailable = true
    } else if (user.availability_mode === 'scheduled' && user.available_from && user.available_to) {
        const now = new Date()
        const timezone = user.timezone || 'UTC'
        const currentTime = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone
        })
        isAvailable = currentTime >= user.available_from && currentTime <= user.available_to
    }

    if (!isAvailable) {
        // Host not available, redirect to profile with booking option
        return NextResponse.redirect(new URL(`/profile/${username}?error=unavailable`, req.url))
    }

    // Get most recent active meeting or pending meeting
    let { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    // If no active meeting exists, create one automatically
    if (!meeting) {
        const { data: newMeeting, error: createError } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: `Meeting with ${user.name || username}`,
                status: 'active',
                google_meet_link: null,
                google_event_id: null,
                scheduled_at: null
            })
            .select('id')
            .single()

        if (createError) {
            console.error('Error creating meeting:', createError)
            return NextResponse.redirect(new URL(`/profile/${username}?error=create_failed`, req.url))
        }

        meeting = newMeeting
    }

    // Redirect to waiting room
    return NextResponse.redirect(new URL(`/waiting/${meeting.id}`, req.url))
}
