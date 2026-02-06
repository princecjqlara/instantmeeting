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

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingId } = await params

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: meeting, error } = await supabase
        .from('meetings')
        .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
        })
        .eq('id', meetingId)
        .eq('user_id', user.id)
        .select()
        .single()

    if (error || !meeting) {
        return NextResponse.json({ error: error?.message || 'Meeting not found' }, { status: 500 })
    }

    await supabase
        .from('waiting_guests')
        .update({ status: 'left' })
        .eq('meeting_id', meetingId)
        .neq('status', 'left')

    return NextResponse.json(meeting)
}
