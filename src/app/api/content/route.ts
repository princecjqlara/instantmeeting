import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function getCloudinary() {
    cloudinary.config({
        cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    return cloudinary
}

// GET: Get user's content
export async function GET() {
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

    const { data: content, error } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(content)
}

// POST: Upload content
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const cloud = getCloudinary()
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
        const formData = await req.formData()
        const file = formData.get('file') as File
        const title = formData.get('title') as string
        const description = formData.get('description') as string

        if (!file) {
            return NextResponse.json({ error: 'File required' }, { status: 400 })
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        const dataUri = `data:${file.type};base64,${base64}`

        // Upload to Cloudinary
        const uploadResult = await cloud.uploader.upload(dataUri, {
            resource_type: 'video',
            folder: 'instantmeeting/reels',
        })

        // Get current max order
        const { data: maxOrder } = await supabase
            .from('content')
            .select('order_index')
            .eq('user_id', user.id)
            .order('order_index', { ascending: false })
            .limit(1)
            .single()

        const nextOrder = (maxOrder?.order_index ?? -1) + 1

        // Save to Supabase
        const { data: content, error } = await supabase
            .from('content')
            .insert({
                user_id: user.id,
                title,
                description,
                cloudinary_url: uploadResult.secure_url,
                cloudinary_public_id: uploadResult.public_id,
                thumbnail_url: uploadResult.secure_url.replace(/\.[^/.]+$/, '.jpg'),
                duration_seconds: Math.round(uploadResult.duration || 0),
                order_index: nextOrder,
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(content)
    } catch (err) {
        console.error('Upload error:', err)
        return NextResponse.json(
            { error: 'Failed to upload content' },
            { status: 500 }
        )
    }
}

// DELETE: Remove content
export async function DELETE(req: NextRequest) {
    const supabase = getSupabaseClient()
    const cloud = getCloudinary()
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const contentId = searchParams.get('id')

    if (!contentId) {
        return NextResponse.json({ error: 'Content ID required' }, { status: 400 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get content to delete from Cloudinary
    const { data: content } = await supabase
        .from('content')
        .select('cloudinary_public_id')
        .eq('id', contentId)
        .eq('user_id', user.id)
        .single()

    if (content?.cloudinary_public_id) {
        await cloud.uploader.destroy(content.cloudinary_public_id, {
            resource_type: 'video',
        })
    }

    const { error } = await supabase
        .from('content')
        .delete()
        .eq('id', contentId)
        .eq('user_id', user.id)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
