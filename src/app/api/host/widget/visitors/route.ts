import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data: user } = await supabase.from('users').select('id').eq('email', session.user.email).single()
    if (!user) return NextResponse.json({ error: 'No user' }, { status: 404 })

    // Active = heartbeat in the last 60s
    const cutoff = new Date(Date.now() - 60_000).toISOString()
    const { data: visitors } = await supabase
        .from('widget_visitors')
        .select('*')
        .eq('host_id', user.id)
        .gte('last_heartbeat_at', cutoff)
        .neq('status', 'left')
        .order('last_heartbeat_at', { ascending: false })
        .limit(100)

    return NextResponse.json({ visitors: visitors || [] })
}
