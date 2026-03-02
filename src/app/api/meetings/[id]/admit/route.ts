import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { admitGuestLogic } from '@/lib/admit-logic'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST: Admit a waiting guest
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
    const body = await req.json()
    const { guestId } = body

    // Verify meeting belongs to user
    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    try {
        const result = await admitGuestLogic(meetingId, guestId)

        return NextResponse.json({
            success: true,
            guest: result.guest,
            meet_link: result.meet_link,
            join_link: `${req.nextUrl.origin}/api/join/${result.join_token}`,
            assigned_member: result.assigned_member || null,
            assignment_source: result.assignment_source || 'none',
        })
    } catch (error: any) {
        console.error('Admit error:', error)
        return NextResponse.json({ error: error.message || 'Failed to admit guest' }, { status: 400 })
    }
}
