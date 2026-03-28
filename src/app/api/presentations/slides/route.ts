/**
 * Presentation Slides API
 * POST   — upload a new slide (signs Cloudinary upload + saves to DB)
 * DELETE — remove a slide
 * PATCH  — reorder slides
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Save slide after Cloudinary upload (client-side upload)
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { presentationId, mediaUrl, mediaType, cloudinaryPublicId, thumbnailUrl } = body

    if (!presentationId || !mediaUrl) {
        return NextResponse.json({ error: 'presentationId and mediaUrl required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get current max order_index
    const { data: existing } = await supabase
        .from('presentation_slides')
        .select('order_index')
        .eq('presentation_id', presentationId)
        .order('order_index', { ascending: false })
        .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].order_index + 1 : 0

    const { data, error } = await supabase
        .from('presentation_slides')
        .insert({
            presentation_id: presentationId,
            media_url: mediaUrl,
            media_type: mediaType || 'image',
            cloudinary_public_id: cloudinaryPublicId || null,
            thumbnail_url: thumbnailUrl || null,
            order_index: nextOrder,
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}

// Delete a slide
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { error } = await supabase
        .from('presentation_slides')
        .delete()
        .eq('id', id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}

// Reorder slides
export async function PATCH(req: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { items } = body // [{ id, order_index }]

    if (!items || !Array.isArray(items)) {
        return NextResponse.json({ error: 'items array required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Update each slide's order
    for (const item of items) {
        await supabase
            .from('presentation_slides')
            .update({ order_index: item.order_index })
            .eq('id', item.id)
    }

    return NextResponse.json({ success: true })
}
