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

    return NextResponse.json(content, {
        headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=30' },
    })
}

// POST: Upload content
export async function POST(req: NextRequest) {
    const supabase = getSupabaseClient()
    const cloud = getCloudinary()
    const session = await getServerSession(authOptions)

    console.log('=== CONTENT UPLOAD === Starting upload process')
    console.log('Session email:', session?.user?.email)

    if (!session?.user?.email) {
        console.log('ERROR: No session email')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', session.user.email)
        .single()

    let userId = user?.id

    // Create user if doesn't exist
    if (!userId) {
        console.log('Creating new user...')
        const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert({ email: session.user.email, name: session.user.name })
            .select('id')
            .single()

        if (createError) {
            console.error('Error creating user:', createError)
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
        }
        userId = newUser.id
        console.log('Created user with ID:', userId)
    }

    try {
        const contentType = req.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
            const body = await req.json()
            const {
                title,
                description,
                cloudinary_url,
                cloudinary_public_id,
                thumbnail_url,
                duration_seconds,
                views,
                likes,
                comments,
            } = body

            if (!cloudinary_url || !cloudinary_public_id) {
                return NextResponse.json({ error: 'Missing upload data' }, { status: 400 })
            }

            const { data: maxOrder } = await supabase
                .from('content')
                .select('order_index')
                .eq('user_id', userId)
                .order('order_index', { ascending: false })
                .limit(1)
                .single()

            const nextOrder = (maxOrder?.order_index ?? -1) + 1

            const { data: content, error } = await supabase
                .from('content')
                .insert({
                    user_id: userId,
                    title,
                    description,
                    cloudinary_url,
                    cloudinary_public_id,
                    thumbnail_url: thumbnail_url || cloudinary_url.replace(/\.[^/.]+$/, '.jpg'),
                    duration_seconds: duration_seconds || 0,
                    order_index: nextOrder,
                    views: views || 0,
                    likes: likes || 0,
                    comments: comments || 0,
                })
                .select()
                .single()

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            return NextResponse.json(content)
        }

        const formData = await req.formData()
        const file = formData.get('file') as File
        const title = formData.get('title') as string
        const description = formData.get('description') as string
        const views = parseInt(formData.get('views') as string) || 0
        const likes = parseInt(formData.get('likes') as string) || 0
        const comments = parseInt(formData.get('comments') as string) || 0

        console.log('File received:', file?.name, 'Type:', file?.type, 'Size:', file?.size)
        console.log('Title:', title)

        if (!file) {
            console.log('ERROR: No file provided')
            return NextResponse.json({ error: 'File required' }, { status: 400 })
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        const dataUri = `data:${file.type};base64,${base64}`

        console.log('Uploading to Cloudinary...')

        const resourceType = file.type?.startsWith('image/') ? 'image' : 'video'

        // Upload to Cloudinary
        const uploadResult = await cloud.uploader.upload(dataUri, {
            resource_type: resourceType,
            folder: 'instantmeeting/reels',
        })

        console.log('Cloudinary upload success:', uploadResult.public_id)

        // Get current max order
        const { data: maxOrder } = await supabase
            .from('content')
            .select('order_index')
            .eq('user_id', userId)
            .order('order_index', { ascending: false })
            .limit(1)
            .single()

        const nextOrder = (maxOrder?.order_index ?? -1) + 1
        console.log('Next order index:', nextOrder)

        // Save to Supabase
        console.log('Saving to database...')
        const { data: content, error } = await supabase
            .from('content')
            .insert({
                user_id: userId,
                title,
                description,
                cloudinary_url: uploadResult.secure_url,
                cloudinary_public_id: uploadResult.public_id,
                thumbnail_url: resourceType === 'video'
                    ? uploadResult.secure_url.replace(/\.[^/.]+$/, '.jpg')
                    : uploadResult.secure_url,
                duration_seconds: resourceType === 'video' ? Math.round(uploadResult.duration || 0) : 0,
                order_index: nextOrder,
                views,
                likes,
                comments,
            })
            .select()
            .single()

        if (error) {
            console.error('Database error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('Content saved successfully:', content.id)
        return NextResponse.json(content)
    } catch (err) {
        console.error('Upload error:', err)
        return NextResponse.json(
            { error: 'Failed to upload content' },
            { status: 500 }
        )
    }
}

// PATCH: Update content engagement metrics
export async function PATCH(req: NextRequest) {
    console.log('=== CONTENT PATCH === Starting update')
    
    try {
        const supabase = getSupabaseClient()
        const session = await getServerSession(authOptions)

        console.log('Session email:', session?.user?.email)

        if (!session?.user?.email) {
            console.log('ERROR: No session email')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        console.log('PATCH Body:', body)
        const { id, views, likes, comments, title, description, caption } = body

        if (!id) {
            console.log('ERROR: No ID provided')
            return NextResponse.json({ error: 'Content ID required' }, { status: 400 })
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.user.email)
            .single()

        if (userError) {
            console.error('User lookup error:', userError)
            return NextResponse.json({ error: userError.message }, { status: 500 })
        }

        if (!user) {
            console.log('ERROR: User not found')
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Build update data, handle caption column carefully
        const updateData: Record<string, unknown> = {}
        if (views !== undefined) updateData.views = views
        if (likes !== undefined) updateData.likes = likes
        if (comments !== undefined) updateData.comments = comments
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (caption !== undefined) updateData.caption = caption

        console.log('Update data:', updateData)
        console.log('Updating content ID:', id, 'for user ID:', user.id)

        const { data: content, error } = await supabase
            .from('content')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            console.error('Supabase update error:', error)
            // If error is about caption column, try without it
            if (error.message.includes("'caption' column")) {
                console.log('Retrying without caption field...')
                delete updateData.caption
                
                const { data: retryData, error: retryError } = await supabase
                    .from('content')
                    .update(updateData)
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .select()
                    .single()
                    
                if (retryError) {
                    console.error('Retry also failed:', retryError)
                    return NextResponse.json({ error: retryError.message }, { status: 500 })
                }
                
                console.log('Successfully updated without caption:', retryData.id)
                return NextResponse.json(retryData)
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        console.log('Successfully updated content:', content.id)
        return NextResponse.json(content)
    } catch (err) {
        console.error('Unexpected error in PATCH:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
        try {
            await cloud.uploader.destroy(content.cloudinary_public_id, {
                resource_type: 'video',
            })
        } catch (error) {
            console.error('Cloudinary delete error:', error)
        }
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
