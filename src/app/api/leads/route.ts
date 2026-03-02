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

// GET: Get all leads (waiting guests) with meeting details for the host
export async function GET(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'

    // Build query to get all waiting guests for host's meetings
    let query = supabase
        .from('waiting_guests')
        .select(`
            *,
            meetings!inner(
                id,
                title,
                scheduled_at,
                status,
                user_id
            )
        `)
        .eq('meetings.user_id', user.id)
        .order('joined_at', { ascending: false })

    if (status !== 'all') {
        query = query.eq('status', status)
    }

    const { data: leads, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(leads)
}

// DELETE: Delete a lead owned by current host
export async function DELETE(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('id')

    if (!leadId) {
        return NextResponse.json({ error: 'Lead ID required' }, { status: 400 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: lead, error: leadError } = await supabase
        .from('waiting_guests')
        .select('id, meetings!inner(user_id)')
        .eq('id', leadId)
        .eq('meetings.user_id', user.id)
        .maybeSingle()

    if (leadError) {
        return NextResponse.json({ error: leadError.message }, { status: 500 })
    }

    if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
        .from('waiting_guests')
        .delete()
        .eq('id', leadId)

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
