import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get public profile by username
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const supabase = getSupabaseClient()
    const { username } = await params

    console.log('Fetching profile for username:', username)

    if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Get user profile - try case-insensitive match
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, username, bio, avatar_url, followers, following, availability_mode, available_from, available_to, timezone, created_at')
        .ilike('username', username)
        .single()

    if (userError) {
        console.error('Database error fetching user:', userError)
        return NextResponse.json({ error: 'User not found', details: userError.message }, { status: 404 })
    }

    if (!user) {
        console.log('User not found for username:', username)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('Found user:', user.id, user.username)

    // Get user's content
    const { data: content } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

    // Get user's total content stats
    const totalViews = content?.reduce((sum, c) => sum + (c.views || 0), 0) || 0
    const totalLikes = content?.reduce((sum, c) => sum + (c.likes || 0), 0) || 0

    // Check if host is currently available
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

    // Get active meeting if available
    let activeMeeting = null
    if (isAvailable) {
        const { data: meeting } = await supabase
            .from('meetings')
            .select('id, title')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
        activeMeeting = meeting
    }

    return NextResponse.json({
        user: {
            ...user,
            totalViews,
            totalLikes,
            contentCount: content?.length || 0
        },
        content: content || [],
        isAvailable,
        activeMeeting
    })
}
