import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createClient } from '@supabase/supabase-js'
import { authOptions } from '@/lib/auth'
import { generateWidgetKey } from '@/lib/widget-key'

export const dynamic = 'force-dynamic'

export async function POST() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const widgetKey = generateWidgetKey()
    const { error } = await supabase.from('users').update({ widget_key: widgetKey }).eq('email', session.user.email)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ widgetKey })
}
