import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Universal link - redirect to waiting room (which is the preview)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const supabase = getSupabaseClient()
    const resolvedParams = await params
    const username = resolvedParams.username

    console.log('=== UNIVERSAL LINK === /join/' + username)

    if (!username) {
        return NextResponse.redirect(new URL(`/?error=no_username`, req.url))
    }

    // Get user by username
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, username')
        .ilike('username', username)
        .single()

    if (userError || !user) {
        console.log('User not found for:', username)
        console.log('Error:', userError?.message, 'Code:', userError?.code)
        return NextResponse.redirect(new URL(`/profile/${username}?error=not_found`, req.url))
    }

    console.log('Found user:', user.name, user.username, user.id)

    // Get or create active meeting
    let { data: meeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    // Auto-create meeting if none exists
    if (!meeting) {
        const { data: newMeeting, error: createError } = await supabase
            .from('meetings')
            .insert({
                user_id: user.id,
                title: `${user.name || username}'s Room`,
                status: 'active'
            })
            .select('id')
            .single()
        
        if (createError || !newMeeting) {
            console.error('Failed to create meeting:', createError)
            return NextResponse.redirect(new URL(`/profile/${username}?error=create_failed`, req.url))
        }
        
        meeting = newMeeting
    }

    console.log('Redirecting to waiting room:', meeting.id)

    // Redirect to waiting room - this IS the preview/live experience
    return NextResponse.redirect(new URL(`/waiting/${meeting.id}`, req.url))
}
