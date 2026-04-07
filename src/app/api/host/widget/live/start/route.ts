import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Start a live broadcast session.
 *
 * NOTE: LiveKit integration is left as a TODO. To finish wiring:
 *   1. npm i livekit-server-sdk livekit-client
 *   2. Set env: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
 *   3. Replace the placeholder accessToken below with AccessToken from livekit-server-sdk
 */
export async function POST() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: host } = await supabase.from('users').select('id, name').eq('email', session.user.email).single()
    if (!host) return NextResponse.json({ error: 'No user' }, { status: 404 })

    const livekitRoom = `live_${host.id}_${Date.now().toString(36)}`
    const { data: live, error } = await supabase
        .from('live_engage_sessions')
        .insert({ host_id: host.id, status: 'live', livekit_room: livekitRoom })
        .select()
        .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // TODO: generate real LiveKit access token here
    const accessToken = 'TODO_LIVEKIT_TOKEN'

    return NextResponse.json({
        sessionId: live.id,
        livekitRoom,
        livekitUrl: process.env.LIVEKIT_URL || null,
        accessToken,
    })
}
