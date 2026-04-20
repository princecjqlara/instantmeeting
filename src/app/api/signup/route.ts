import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { v2 as cloudinary } from 'cloudinary'

import { sendInstantMeetingMetaCapiEvent } from '@/lib/instantmeeting-payment-capi-server'

export const dynamic = 'force-dynamic'

cloudinary.config({
    cloud_name:
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizeEmail(v: unknown) {
    return typeof v === 'string' ? v.toLowerCase().trim() : ''
}

function normalizeOptionalText(v: unknown) {
    return typeof v === 'string' ? v.trim() || null : null
}

function getClientIpAddress(req: NextRequest): string | null {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const first = forwarded.split(',')[0]?.trim()
        if (first) return first
    }

    const realIp = req.headers.get('x-real-ip')?.trim()
    return realIp || null
}

export async function POST(req: NextRequest) {
    let form: FormData
    try {
        form = await req.formData()
    } catch {
        return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const email = normalizeEmail(form.get('email'))
    const name = (form.get('name') as string | null)?.trim() || null
    const phone = (form.get('phone') as string | null)?.trim() || null
    const password = (form.get('password') as string | null) || ''
    const file = form.get('receipt') as File | null
    const fbp = normalizeOptionalText(form.get('fbp'))
    const fbc = normalizeOptionalText(form.get('fbc'))
    const fbclid = normalizeOptionalText(form.get('fbclid'))
    const pageUrl = normalizeOptionalText(form.get('page_url')) || req.nextUrl.origin

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
    }
    if (!name) {
        return NextResponse.json({ error: 'Your name is required.' }, { status: 400 })
    }
    if (!phone) {
        return NextResponse.json({ error: 'A phone number is required.' }, { status: 400 })
    }
    if (!password || password.length < 6) {
        return NextResponse.json(
            { error: 'Password must be at least 6 characters.' },
            { status: 400 }
        )
    }
    if (!file) {
        return NextResponse.json(
            { error: 'Upload a screenshot of your payment receipt.' },
            { status: 400 }
        )
    }
    if (file.size > 6 * 1024 * 1024) {
        return NextResponse.json({ error: 'Receipt file must be under 6MB.' }, { status: 400 })
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        return NextResponse.json(
            { error: 'Receipt must be an image or PDF.' },
            { status: 400 }
        )
    }

    const supabase = getSupabaseClient()

    // Reject if this email already has a verified account.
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
    if (existingUser) {
        return NextResponse.json(
            { error: 'An account with this email already exists. Try signing in.' },
            { status: 409 }
        )
    }

    // Reject if a pending signup exists for this email.
    const { data: existingPending } = await supabase
        .from('pending_signups')
        .select('id, status')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle()
    if (existingPending) {
        return NextResponse.json(
            {
                error:
                    'We already have a pending payment for this email. You will receive a confirmation email once verified.',
            },
            { status: 409 }
        )
    }

    // Upload receipt to Cloudinary.
    let receiptUrl: string | null = null
    try {
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    {
                        folder: 'instant-meeting-receipts',
                        resource_type: file.type === 'application/pdf' ? 'raw' : 'image',
                    },
                    (error, result) => {
                        if (error) reject(error)
                        else if (result?.secure_url) resolve({ secure_url: result.secure_url })
                        else reject(new Error('Upload did not return a URL'))
                    }
                )
                .end(buffer)
        })
        receiptUrl = uploaded.secure_url
    } catch (err) {
        console.error('Receipt upload failed:', err)
        return NextResponse.json(
            { error: 'Could not upload your receipt. Try again.' },
            { status: 500 }
        )
    }

    const password_hash = await bcrypt.hash(password, 12)

    const { data: pending, error } = await supabase
        .from('pending_signups')
        .insert({
            email,
            name,
            phone,
            password_hash,
            receipt_url: receiptUrl,
            amount: 699,
            plan: 'starter',
            status: 'pending',
        })
        .select('id, email, name, phone, status, created_at')
        .single()

    if (error) {
        console.error('Pending signup insert error:', error)
        return NextResponse.json(
            { error: 'Could not record your signup. Try again.' },
            { status: 500 }
        )
    }

    void sendInstantMeetingMetaCapiEvent(supabase, {
        trigger: 'payment_review_submit',
        eventSourceUrl: pageUrl,
        email,
        phone,
        name,
        clientIpAddress: getClientIpAddress(req),
        clientUserAgent: req.headers.get('user-agent'),
        fbp,
        fbc,
        fbclid,
    })

    return NextResponse.json({
        success: true,
        id: pending.id,
        message:
            "Payment received! We'll verify your receipt and email you once your account is active.",
    })
}
