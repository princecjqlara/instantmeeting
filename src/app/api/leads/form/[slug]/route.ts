import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET: public form definition by slug (no AI criteria exposed)
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params
    const supabase = getSupabaseClient()

    const { data: form, error } = await supabase
        .from('lead_forms')
        .select('id, user_id, slug, title, description, is_active, unqualified_message')
        .eq('slug', slug)
        .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!form || !form.is_active) {
        return NextResponse.json({ error: 'Form not found' }, { status: 404 })
    }

    const { data: host } = await supabase
        .from('users')
        .select('id, name, username, avatar_url, bio')
        .eq('id', form.user_id)
        .single()

    const { data: questions } = await supabase
        .from('lead_form_questions')
        .select('id, order_index, question_text, help_text, type, options, required')
        .eq('form_id', form.id)
        .order('order_index', { ascending: true })

    return NextResponse.json({
        form: {
            id: form.id,
            slug: form.slug,
            title: form.title,
            description: form.description,
            unqualified_message: form.unqualified_message,
        },
        host,
        questions: questions || [],
    })
}
