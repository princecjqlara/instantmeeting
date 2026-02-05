import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST: Reorder content items
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    try {
        const { items } = await req.json()

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: 'Invalid items' }, { status: 400 })
        }

        // Update each item's order_index
        for (const item of items) {
            await supabase
                .from('content')
                .update({ order_index: item.order_index })
                .eq('id', item.id)
                .eq('user_id', user.id)
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Reorder error:', error)
        return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
    }
}
