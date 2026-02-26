import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: Get clock status for all members of a team (by team_id query param)
export async function GET(req: NextRequest) {
    const teamId = req.nextUrl.searchParams.get('team_id')
    if (!teamId) {
        return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    const supabase = getSupabaseClient()

    // Get members
    const { data: members } = await supabase
        .from('team_members')
        .select('id, name, avatar_url, is_active')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('name', { ascending: true })

    // Get open clock sessions
    const memberIds = (members || []).map(m => m.id)
    const { data: sessions } = await supabase
        .from('clock_sessions')
        .select('id, member_id, clocked_in_at')
        .in('member_id', memberIds.length > 0 ? memberIds : ['none'])
        .is('clocked_out_at', null)

    const sessionMap = new Map((sessions || []).map(s => [s.member_id, s]))

    const result = (members || []).map(m => ({
        ...m,
        is_clocked_in: sessionMap.has(m.id),
        clocked_in_at: sessionMap.get(m.id)?.clocked_in_at || null,
    }))

    return NextResponse.json(result)
}

// POST: Clock in a member
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { member_id } = body

    if (!member_id) {
        return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    // Check if already clocked in
    const { data: existing } = await supabase
        .from('clock_sessions')
        .select('id')
        .eq('member_id', member_id)
        .is('clocked_out_at', null)
        .single()

    if (existing) {
        return NextResponse.json({ error: 'Already clocked in' }, { status: 409 })
    }

    const { data: session, error } = await supabase
        .from('clock_sessions')
        .insert({
            member_id,
            clocked_in_at: new Date().toISOString(),
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(session, { status: 201 })
}

// PATCH: Clock out a member
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const body = await req.json()
    const { member_id } = body

    if (!member_id) {
        return NextResponse.json({ error: 'member_id is required' }, { status: 400 })
    }

    const { data: session, error } = await supabase
        .from('clock_sessions')
        .update({ clocked_out_at: new Date().toISOString() })
        .eq('member_id', member_id)
        .is('clocked_out_at', null)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error?.message || 'No active session' }, { status: 500 })
    }

    return NextResponse.json(session)
}
