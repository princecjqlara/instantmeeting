import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get current user's profile settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('username, name, bio, avatar_url')
        .eq('email', session.user.email)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        username: user.username || '',
        name: user.name || '',
        bio: user.bio || '',
        avatar_url: user.avatar_url
    })
}

// PATCH: Update profile settings
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { username, name, bio } = body

    // Validate username
    if (username) {
        // Check if username is already taken by another user
        const { data: existing } = await supabase
            .from('users')
            .select('email')
            .eq('username', username)
            .neq('email', session.user.email)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
        }

        // Validate username format
        if (!/^[a-z0-9_]{3,20}$/.test(username)) {
            return NextResponse.json({
                error: 'Username must be 3-20 characters, lowercase letters, numbers and underscores only'
            }, { status: 400 })
        }
    }

    const updateData: Record<string, unknown> = {}
    if (username !== undefined) updateData.username = username
    if (name !== undefined) updateData.name = name
    if (bio !== undefined) updateData.bio = bio

    const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', session.user.email)
        .select('username, name, bio, avatar_url')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        username: user.username || '',
        name: user.name || '',
        bio: user.bio || '',
        avatar_url: user.avatar_url
    })
}
