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

function isMissingMeetingsAssignmentSourceColumnError(error: { message?: string | null } | null | undefined): boolean {
    if (!error?.message) {
        return false
    }

    const message = error.message.toLowerCase()

    const postgresMissingColumn =
        message.includes('does not exist') &&
        (
            message.includes('meetings.assignment_source') ||
            message.includes('meetings."assignment_source"')
        )

    const postgrestSchemaCacheMiss =
        message.includes('schema cache') &&
        message.includes("'assignment_source'") &&
        message.includes("column of 'meetings'")

    return postgresMissingColumn || postgrestSchemaCacheMiss
}

// POST: Manually assign a team member to a meeting
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const { meeting_id, member_id } = body

    if (!meeting_id || !member_id) {
        return NextResponse.json({ error: 'meeting_id and member_id are required' }, { status: 400 })
    }

    // Verify meeting belongs to this user
    const { data: meeting } = await supabase
        .from('meetings')
        .select('id, user_id')
        .eq('id', meeting_id)
        .eq('user_id', user.id)
        .single()

    if (!meeting) {
        return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    // Verify member belongs to user's team
    const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', user.id)
        .single()

    if (!team) {
        return NextResponse.json({ error: 'No team found' }, { status: 404 })
    }

    const { data: member } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('id', member_id)
        .eq('team_id', team.id)
        .single()

    if (!member) {
        return NextResponse.json({ error: 'Member not found in your team' }, { status: 404 })
    }

    // Assign member to meeting
    let result = await supabase
        .from('meetings')
        .update({ assigned_member_id: member_id, assignment_source: 'manual' })
        .eq('id', meeting_id)

    if (isMissingMeetingsAssignmentSourceColumnError(result.error)) {
        result = await supabase
            .from('meetings')
            .update({ assigned_member_id: member_id })
            .eq('id', meeting_id)
    }

    if (result.error) {
        return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json({
        success: true,
        assigned_member: member,
        assignment_source: 'manual',
    })
}
