import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Get user by username
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, availability_mode, available_from, available_to, timezone')
        .eq('username', username)
        .single()

    if (userError || !user) {
        // Redirect to 404 or profile page with error
        return NextResponse.redirect(new URL(`/profile/${username}?error=not_found`, req.url))
    }

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
        // Host not available, redirect to profile
        return NextResponse.redirect(new URL(`/profile/${username}?error=unavailable`, req.url))
    }

    // Get most recent active meeting or pending meeting
    const { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (!meeting) {
        // No active meeting, redirect to profile
        return NextResponse.redirect(new URL(`/profile/${username}?error=no_meeting`, req.url))
    }

    // Redirect to waiting room
    return NextResponse.redirect(new URL(`/waiting/${meeting.id}`, req.url))
}
