import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'
import { createJoinToken } from '@/lib/join-tokens'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sessionId } = await req.json()
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: host } = await supabase.from('users').select('id, name').eq('email', session.user.email).single()
    if (!host) return NextResponse.json({ error: 'No user' }, { status: 404 })

    // Create a meeting record for this invite
    const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
            user_id: host.id,
            title: `Live invite from widget`,
            status: 'active',
            source: 'widget-invite',
        })
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Pull visitor context if any
    let widgetContext: Record<string, unknown> | null = null
    if (sessionId) {
        const { data: visitor } = await supabase
            .from('widget_visitors')
            .select('*')
            .eq('host_id', host.id)
            .eq('session_id', sessionId)
            .single()
        if (visitor) widgetContext = { visitor }
        await supabase
            .from('widget_visitors')
            .update({ status: 'invited' })
            .eq('host_id', host.id)
            .eq('session_id', sessionId)
    }

    const code = await createJoinToken({
        meetingId: meeting.id,
        visitorSessionId: sessionId || null,
        widgetContext,
    })

    // Stash invite code keyed by visitor session for the widget poller
    if (sessionId) {
        await supabase.from('widget_visitors').update({
            metadata: { ...(widgetContext as object || {}), pending_invite_code: code, host_name: host.name },
        }).eq('host_id', host.id).eq('session_id', sessionId)
    }

    return NextResponse.json({ code, hostName: host.name })
}
