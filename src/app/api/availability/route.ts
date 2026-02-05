import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get current availability settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First get the user by email
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, availability_mode, available_from, available_to, timezone')
        .eq('email', session.user.email)
        .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is expected if user doesn't exist
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!existingUser) {
        // User doesn't exist, create them with default availability
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                email: session.user.email,
                name: session.user.name,
                availability_mode: 'always',
                available_from: null,
                available_to: null,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            })
            .select('availability_mode, available_from, available_to, timezone')
            .single()

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json(newUser)
    }

    return NextResponse.json(existingUser)
}

// PATCH: Update availability settings
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { availability_mode, available_from, available_to, timezone } = body

    // First get the user ID
    const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (fetchError) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (availability_mode !== undefined) updateData.availability_mode = availability_mode
    if (available_from !== undefined) updateData.available_from = available_from
    if (available_to !== undefined) updateData.available_to = available_to
    if (timezone !== undefined) updateData.timezone = timezone
    if (body.scroll_threshold !== undefined) updateData.scroll_threshold = body.scroll_threshold
    if (body.meeting_duration !== undefined) updateData.meeting_duration = body.meeting_duration

    // Update existing user
    const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
        .select('availability_mode, available_from, available_to, timezone')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(user)
}
