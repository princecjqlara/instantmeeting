import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import { isValidCredentialPassword } from '@/lib/password-auth'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function recoverVerifiedSignupPasswordHash(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    email: string,
    inputPassword: string
) {
    const { data: pending, error } = await supabase
        .from('pending_signups')
        .select('password_hash')
        .eq('email', email)
        .eq('status', 'verified')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error || !pending?.password_hash) {
        return null
    }

    const isValid = await isValidCredentialPassword(inputPassword, pending.password_hash)
    if (!isValid) {
        return null
    }

    const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: pending.password_hash })
        .eq('id', userId)
        .is('password_hash', null)

    if (updateError) {
        console.error('Failed to recover verified signup password hash:', updateError)
    }

    return pending.password_hash as string
}

export const authOptions: NextAuthOptions = {
    useSecureCookies: process.env.NODE_ENV === 'production',
    providers: [
        CredentialsProvider({
            name: 'Email & Password',
            credentials: {
                email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required')
                }

                const supabase = getSupabaseClient()
                const { data: user, error } = await supabase
                    .from('users')
                    .select('id, email, name, avatar_url, password_hash, role')
                    .eq('email', credentials.email.toLowerCase().trim())
                    .single()

                if (error || !user) {
                    throw new Error('Invalid email or password')
                }

                const passwordHash =
                    user.password_hash ||
                    await recoverVerifiedSignupPasswordHash(
                        supabase,
                        user.id,
                        user.email,
                        credentials.password
                    )

                if (!passwordHash) {
                    throw new Error('Account not configured. Contact your organizer.')
                }

                const isValid = await isValidCredentialPassword(
                    credentials.password,
                    passwordHash
                )
                if (!isValid) {
                    throw new Error('Invalid email or password')
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.avatar_url,
                    role: user.role,
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.email = user.email
                token.role = (user as { role?: string }).role || 'tenant'
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id?: string }).id = token.id as string
                session.user.email = token.email as string;
                (session.user as { role?: string }).role = token.role as string
            }
            return session
        },
    },
    pages: {
        signIn: '/',
    },
    session: {
        strategy: 'jwt',
    },
}
