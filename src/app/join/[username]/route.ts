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
    const rawUsername = resolvedParams.username
    const normalizedUsername = decodeURIComponent(rawUsername || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase()

    console.log('=== UNIVERSAL LINK === /join/' + rawUsername)

    if (!normalizedUsername) {
        return NextResponse.redirect(new URL(`/?error=no_username`, req.url))
    }

    // Get user by username
    let { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, username, availability_mode, available_from, available_to, timezone')
        .ilike('username', normalizedUsername)
        .single()

    if (!user) {
        const altUsername = `@${normalizedUsername}`
        const { data: altUser, error: altError } = await supabase
            .from('users')
            .select('id, name, username, availability_mode, available_from, available_to, timezone')
            .ilike('username', altUsername)
            .single()
        user = altUser || null
        userError = altError
    }

    if (userError || !user) {
        console.log('User not found for:', normalizedUsername)
        console.log('Error:', userError?.message, 'Code:', userError?.code)
        return NextResponse.redirect(new URL(`/?error=not_found&username=${encodeURIComponent(normalizedUsername)}`, req.url))
    }

    console.log('Found user:', user.name, user.username, user.id)

    // Create a NEW meeting for every guest to ensure privacy and "1 guest, 1 room"
    const { data: newMeeting, error: createError } = await supabase
        .from('meetings')
        .insert({
            user_id: user.id,
            title: `${user.name || normalizedUsername}'s Room`,
            status: 'active'
        })
        .select('id')
        .single()

    if (createError || !newMeeting) {
        console.error('Failed to create meeting:', createError)
        return NextResponse.redirect(new URL(`/?error=create_failed&username=${encodeURIComponent(normalizedUsername)}`, req.url))
    }

    const meeting = newMeeting

    console.log('Redirecting to waiting room:', meeting.id)

    // Redirect to waiting room - this IS the preview/live experience
    return NextResponse.redirect(new URL(`/waiting/${meeting.id}`, req.url))
}
