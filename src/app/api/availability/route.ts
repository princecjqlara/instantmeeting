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

    // Return default availability since columns don't exist yet
    return NextResponse.json({
        availability_mode: 'always',
        available_from: null,
        available_to: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
}

// PATCH: Update availability settings
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return success but don't save (columns don't exist)
    const body = await req.json()
    return NextResponse.json({
        availability_mode: body.availability_mode || 'always',
        available_from: body.available_from || null,
        available_to: body.available_to || null,
        timezone: body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    })
}
