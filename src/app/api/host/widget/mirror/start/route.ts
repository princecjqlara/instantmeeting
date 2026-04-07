import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: host } = await supabase.from('users').select('id, widget_mirror_enabled').eq('email', session.user.email).single()
    if (!host) return NextResponse.json({ error: 'No user' }, { status: 404 })
    if (!host.widget_mirror_enabled) return NextResponse.json({ error: 'Mirror not enabled' }, { status: 403 })

    await supabase
        .from('widget_visitors')
        .update({ mirror_active: true })
        .eq('host_id', host.id)
        .eq('session_id', sessionId)

    return NextResponse.json({ ok: true })
}
