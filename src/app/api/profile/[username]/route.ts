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
    const resolvedParams = await params
    const username = resolvedParams.username

    console.log('=== PROFILE API === Fetching for username:', username)
    console.log('Full URL:', req.url)

    if (!username) {
        console.log('ERROR: No username provided')
        return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Get user profile - try case-insensitive match
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, username, bio, avatar_url, followers, following, created_at')
        .ilike('username', username)
        .single()

    if (userError) {
        console.error('Database error:', userError.code, userError.message)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user) {
        console.log('User not found for:', username)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('SUCCESS: Found user', user.username, user.id)

    // Get user's content
    const { data: content } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

    // Get user's total content stats
    const totalViews = content?.reduce((sum, c) => sum + (c.views || 0), 0) || 0
    const totalLikes = content?.reduce((sum, c) => sum + (c.likes || 0), 0) || 0

    // Get active meeting
    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    return NextResponse.json({
        user: {
            ...user,
            totalViews,
            totalLikes,
            contentCount: content?.length || 0,
            availability_mode: 'always'
        },
        content: content || [],
        isAvailable: true,
        activeMeeting: meeting
    })
}
