import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * POST /api/auth/setup
 * One-time endpoint to bootstrap the organizer account.
 * Reads ORGANIZER_EMAIL and ORGANIZER_PASSWORD from env vars.
 * Returns 409 if an organizer already exists.
 */
export async function POST() {
    const email = process.env.ORGANIZER_EMAIL
    const password = process.env.ORGANIZER_PASSWORD

    if (!email || !password) {
        return NextResponse.json(
            { error: 'ORGANIZER_EMAIL and ORGANIZER_PASSWORD env vars are required' },
            { status: 400 }
        )
    }

    const supabase = getSupabaseClient()

    // Check if an organizer already exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'organizer')
        .limit(1)
        .single()

    if (existing) {
        return NextResponse.json(
            { error: 'Organizer account already exists' },
            { status: 409 }
        )
    }

    // Hash password and create organizer
    const password_hash = await bcrypt.hash(password, 12)

    const { data: user, error } = await supabase
        .from('users')
        .upsert({
            email: email.toLowerCase().trim(),
            name: 'Organizer',
            password_hash,
            role: 'organizer',
        }, {
            onConflict: 'email'
        })
        .select('id, email, role')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        message: 'Organizer account created successfully',
        user,
    })
}
