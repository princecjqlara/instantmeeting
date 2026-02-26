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

async function getUserTeam() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) return null

    const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    return team ? { userId: user.id, teamId: team.id } : null
}

// GET: List team members
export async function GET() {
    const ctx = await getUserTeam()
    if (!ctx) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const { data: members, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', ctx.teamId)
        .order('created_at', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(members)
}

// POST: Add a team member
export async function POST(req: NextRequest) {
    const ctx = await getUserTeam()
    if (!ctx) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const body = await req.json()
    const { name, email } = body

    if (!name) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: member, error } = await supabase
        .from('team_members')
        .insert({
            team_id: ctx.teamId,
            name,
            email: email || null,
            is_active: true,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(member, { status: 201 })
}

// PATCH: Update a team member
export async function PATCH(req: NextRequest) {
    const ctx = await getUserTeam()
    if (!ctx) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const body = await req.json()
    const { id, name, email, is_active } = body

    if (!id) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: member, error } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', id)
        .eq('team_id', ctx.teamId)
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(member)
}

// DELETE: Remove a team member
export async function DELETE(req: NextRequest) {
    const ctx = await getUserTeam()
    if (!ctx) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    const supabase = getSupabaseClient()
    const body = await req.json()
    const { id } = body

    if (!id) {
        return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id)
        .eq('team_id', ctx.teamId)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Member removed' })
}
