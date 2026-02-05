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
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> } // params is a Promise in Next.js 15
) {
    const { id } = await params
    const supabase = getSupabaseClient()

    const { data: user, error } = await supabase
        .from('users')
        .select('id, name, username, bio, avatar_url, availability_mode, available_from, available_to, timezone, scroll_threshold, meeting_duration, followers, following')
        .eq('id', id)
        .single()

    if (error || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
}
