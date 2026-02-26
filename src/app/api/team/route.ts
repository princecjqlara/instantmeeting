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

async function getUser() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    return user
}

// GET: Get current user's team with members and clock status
export async function GET() {
    const user = await getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    const { data: team } = await supabase
        .from('teams')
        .select('*')
        .eq('owner_id', user.id)
        .single()

    if (!team) {
        return NextResponse.json({ team: null, members: [] })
    }

    // Get members with clock-in status
    const { data: members } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', team.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

    // Check clock-in status for each member
    const membersWithClock = await Promise.all(
        (members || []).map(async (member) => {
            const { data: openSession } = await supabase
                .from('clock_sessions')
                .select('id, clocked_in_at')
                .eq('member_id', member.id)
                .is('clocked_out_at', null)
                .order('clocked_in_at', { ascending: false })
                .limit(1)
                .single()

            return {
                ...member,
                is_clocked_in: !!openSession,
                clocked_in_at: openSession?.clocked_in_at || null,
            }
        })
    )

    return NextResponse.json({ team, members: membersWithClock })
}

// POST: Create a team
export async function POST(req: NextRequest) {
    const user = await getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()

    // Check if team already exists
    const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (existing) {
        return NextResponse.json({ error: 'Team already exists' }, { status: 409 })
    }

    const body = await req.json()
    const { name } = body

    const { data: team, error } = await supabase
        .from('teams')
        .insert({
            owner_id: user.id,
            name: name || 'My Team',
            round_robin_index: 0,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ team, members: [] }, { status: 201 })
}

// PATCH: Update team name
export async function PATCH(req: NextRequest) {
    const user = await getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const body = await req.json()
    const { name } = body

    const { data: team, error } = await supabase
        .from('teams')
        .update({ name })
        .eq('owner_id', user.id)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ team })
}
