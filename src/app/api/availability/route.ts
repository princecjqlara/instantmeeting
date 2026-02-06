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

// GET: Get current availability settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('availability_mode, available_from, available_to, timezone, scroll_threshold, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields')
        .eq('email', session.user.email)
        .maybeSingle()

    if (!user) {
        return NextResponse.json({
            availability_mode: 'always',
            available_from: null,
            available_to: null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            scroll_threshold: 3,
            meeting_duration: 30,
            booking_title: 'Schedule a Meeting',
            booking_description: 'Share your details and pick a time that works.',
            booking_note_placeholder: "I'd like to discuss...",
            booking_form_fields: []
        })
    }

    return NextResponse.json({
        availability_mode: user.availability_mode || 'always',
        available_from: user.available_from || null,
        available_to: user.available_to || null,
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        scroll_threshold: user.scroll_threshold || 3,
        meeting_duration: user.meeting_duration || 30,
        booking_title: user.booking_title || 'Schedule a Meeting',
        booking_description: user.booking_description || 'Share your details and pick a time that works.',
        booking_note_placeholder: user.booking_note_placeholder || "I'd like to discuss...",
        booking_form_fields: user.booking_form_fields || []
    })
}

// PATCH: Update availability settings
export async function PATCH(req: NextRequest) {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const updateData: Record<string, unknown> = {}
    if (body.availability_mode !== undefined) updateData.availability_mode = body.availability_mode
    if (body.available_from !== undefined) updateData.available_from = body.available_from
    if (body.available_to !== undefined) updateData.available_to = body.available_to
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.scroll_threshold !== undefined) updateData.scroll_threshold = body.scroll_threshold
    if (body.meeting_duration !== undefined) updateData.meeting_duration = body.meeting_duration
    if (body.booking_title !== undefined) updateData.booking_title = body.booking_title
    if (body.booking_description !== undefined) updateData.booking_description = body.booking_description
    if (body.booking_note_placeholder !== undefined) updateData.booking_note_placeholder = body.booking_note_placeholder
    if (body.booking_form_fields !== undefined) updateData.booking_form_fields = body.booking_form_fields

    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle()

    if (!existingUser) {
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({
                email: session.user.email,
                name: session.user.name,
                ...updateData
            })
            .select('availability_mode, available_from, available_to, timezone, scroll_threshold, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields')
            .single()

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }

        return NextResponse.json({
            availability_mode: newUser.availability_mode || 'always',
            available_from: newUser.available_from || null,
            available_to: newUser.available_to || null,
            timezone: newUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            scroll_threshold: newUser.scroll_threshold || 3,
            meeting_duration: newUser.meeting_duration || 30,
            booking_title: newUser.booking_title || 'Schedule a Meeting',
            booking_description: newUser.booking_description || 'Share your details and pick a time that works.',
            booking_note_placeholder: newUser.booking_note_placeholder || "I'd like to discuss...",
            booking_form_fields: newUser.booking_form_fields || []
        })
    }

    const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', session.user.email)
        .select('availability_mode, available_from, available_to, timezone, scroll_threshold, meeting_duration, booking_title, booking_description, booking_note_placeholder, booking_form_fields')
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        availability_mode: updatedUser.availability_mode || 'always',
        available_from: updatedUser.available_from || null,
        available_to: updatedUser.available_to || null,
        timezone: updatedUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        scroll_threshold: updatedUser.scroll_threshold || 3,
        meeting_duration: updatedUser.meeting_duration || 30,
        booking_title: updatedUser.booking_title || 'Schedule a Meeting',
        booking_description: updatedUser.booking_description || 'Share your details and pick a time that works.',
        booking_note_placeholder: updatedUser.booking_note_placeholder || "I'd like to discuss...",
        booking_form_fields: updatedUser.booking_form_fields || []
    })
}
