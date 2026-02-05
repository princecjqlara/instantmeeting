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

// GET: Get current availability settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('availability_mode, available_from, available_to, timezone')
        .eq('email', session.user.email)
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(user)
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

    const updateData: Record<string, unknown> = {
        email: session.user.email
    }
    if (availability_mode !== undefined) updateData.availability_mode = availability_mode
    if (available_from !== undefined) updateData.available_from = available_from
    if (available_to !== undefined) updateData.available_to = available_to
    if (timezone !== undefined) updateData.timezone = timezone

    // Use upsert to create user if they don't exist
    const { data: user, error } = await supabase
        .from('users')
        .upsert(updateData, { onConflict: 'email' })
        .select('availability_mode, available_from, available_to, timezone')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(user)
}
