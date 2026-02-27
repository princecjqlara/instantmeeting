import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { isMissingUsersColumnError } from '@/lib/users-column-compat'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const AUTO_ADMIT_COLUMN = 'auto_admit'

const AVAILABILITY_COLUMNS = [
    'availability_mode',
    AUTO_ADMIT_COLUMN,
    'available_from',
    'available_to',
    'timezone',
    'scroll_threshold',
    'meeting_duration',
    'booking_title',
    'booking_description',
    'booking_note_placeholder',
    'booking_form_fields',
]

interface AvailabilityQueryResult {
    data: Record<string, unknown> | null
    error: { message: string } | null
}

function availabilitySelect(includeAutoAdmit: boolean) {
    const columns = includeAutoAdmit
        ? AVAILABILITY_COLUMNS
        : AVAILABILITY_COLUMNS.filter(column => column !== AUTO_ADMIT_COLUMN)

    return columns.join(', ')
}

function defaultAvailabilityResponse() {
    return {
        availability_mode: 'always',
        auto_admit: false,
        available_from: null,
        available_to: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        scroll_threshold: 3,
        meeting_duration: 30,
        booking_title: 'Schedule a Meeting',
        booking_description: 'Share your details and pick a time that works.',
        booking_note_placeholder: "I'd like to discuss...",
        booking_form_fields: [],
    }
}

function toAvailabilityResponse(user: Record<string, unknown> | null) {
    if (!user) {
        return defaultAvailabilityResponse()
    }

    return {
        availability_mode: (user.availability_mode as string | null | undefined) || 'always',
        auto_admit: (user.auto_admit as boolean | null | undefined) ?? false,
        available_from: (user.available_from as string | null | undefined) || null,
        available_to: (user.available_to as string | null | undefined) || null,
        timezone: (user.timezone as string | null | undefined) || Intl.DateTimeFormat().resolvedOptions().timeZone,
        scroll_threshold: (user.scroll_threshold as number | null | undefined) || 3,
        meeting_duration: (user.meeting_duration as number | null | undefined) || 30,
        booking_title: (user.booking_title as string | null | undefined) || 'Schedule a Meeting',
        booking_description: (user.booking_description as string | null | undefined) || 'Share your details and pick a time that works.',
        booking_note_placeholder: (user.booking_note_placeholder as string | null | undefined) || "I'd like to discuss...",
        booking_form_fields: (user.booking_form_fields as unknown[] | null | undefined) || [],
    }
}

async function fetchAvailabilityByEmail(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    includeAutoAdmit = true
): Promise<AvailabilityQueryResult> {
    const queryResult = await supabase
        .from('users')
        .select(availabilitySelect(includeAutoAdmit))
        .eq('email', email)
        .maybeSingle()

    if (
        includeAutoAdmit &&
        isMissingUsersColumnError(queryResult.error, AUTO_ADMIT_COLUMN)
    ) {
        return fetchAvailabilityByEmail(supabase, email, false)
    }

    return {
        data: queryResult.data as Record<string, unknown> | null,
        error: queryResult.error ? { message: queryResult.error.message } : null,
    }
}

async function insertAvailability(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    name: string | null | undefined,
    updateData: Record<string, unknown>
) {
    const payload: Record<string, unknown> = {
        email,
        name,
        ...updateData,
    }

    let result = await supabase
        .from('users')
        .insert(payload)

    if (
        result.error &&
        AUTO_ADMIT_COLUMN in payload &&
        isMissingUsersColumnError(result.error, AUTO_ADMIT_COLUMN)
    ) {
        const fallbackPayload = { ...payload }
        delete fallbackPayload[AUTO_ADMIT_COLUMN]

        result = await supabase
            .from('users')
            .insert(fallbackPayload)
    }

    return result
}

async function updateAvailability(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    updateData: Record<string, unknown>
) {
    const payload = { ...updateData }

    let result = await supabase
        .from('users')
        .update(payload)
        .eq('email', email)

    if (
        result.error &&
        AUTO_ADMIT_COLUMN in payload &&
        isMissingUsersColumnError(result.error, AUTO_ADMIT_COLUMN)
    ) {
        delete payload[AUTO_ADMIT_COLUMN]

        result = await supabase
            .from('users')
            .update(payload)
            .eq('email', email)
    }

    return result
}

// GET: Get current availability settings
export async function GET() {
    const supabase = getSupabaseClient()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user, error } = await fetchAvailabilityByEmail(
        supabase,
        session.user.email
    )

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(toAvailabilityResponse(user))
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
    if (body.auto_admit !== undefined) updateData.auto_admit = body.auto_admit
    if (body.available_from !== undefined) updateData.available_from = body.available_from
    if (body.available_to !== undefined) updateData.available_to = body.available_to
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.scroll_threshold !== undefined) updateData.scroll_threshold = body.scroll_threshold
    if (body.meeting_duration !== undefined) updateData.meeting_duration = body.meeting_duration
    if (body.booking_title !== undefined) updateData.booking_title = body.booking_title
    if (body.booking_description !== undefined) updateData.booking_description = body.booking_description
    if (body.booking_note_placeholder !== undefined) updateData.booking_note_placeholder = body.booking_note_placeholder
    if (body.booking_form_fields !== undefined) updateData.booking_form_fields = body.booking_form_fields


    const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle()

    if (existingUserError) {
        return NextResponse.json({ error: existingUserError.message }, { status: 500 })
    }

    if (!existingUser) {
        const { error: createError } = await insertAvailability(
            supabase,
            session.user.email,
            session.user.name,
            updateData
        )

        if (createError) {
            return NextResponse.json({ error: createError.message }, { status: 500 })
        }
    } else {
        const { error: updateError } = await updateAvailability(
            supabase,
            session.user.email,
            updateData
        )

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
    }

    const { data: updatedUser, error: fetchError } = await fetchAvailabilityByEmail(
        supabase,
        session.user.email
    )

    if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    return NextResponse.json(toAvailabilityResponse(updatedUser))
}
