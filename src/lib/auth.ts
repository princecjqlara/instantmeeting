import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import { isValidCredentialPassword } from '@/lib/password-auth'

type CredentialUser = {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
    password_hash: string | null
    role: string | null
}

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function normalizeCredentialEmail(email: string) {
    return email.toLowerCase().trim()
}

async function findCredentialUsers(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string
): Promise<CredentialUser[]> {
    const normalizedEmail = normalizeCredentialEmail(email)
    const { data, error } = await supabase
        .from('users')
        .select('id, email, name, avatar_url, password_hash, role')
        .ilike('email', normalizedEmail)
        .limit(10)

    if (error || !data) {
        return []
    }

    return data.filter((user) => normalizeCredentialEmail(user.email) === normalizedEmail)
}

async function recoverVerifiedSignupPasswordHash(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    email: string,
    inputPassword: string
) {
    const normalizedEmail = normalizeCredentialEmail(email)
    const { data: pending, error } = await supabase
        .from('pending_signups')
        .select('email, password_hash')
        .ilike('email', normalizedEmail)
        .eq('status', 'verified')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10)

    const verifiedPending = pending?.find(
        (signup) => normalizeCredentialEmail(signup.email) === normalizedEmail
    )

    if (error || !verifiedPending?.password_hash) {
        return null
    }

    const isValid = await isValidCredentialPassword(inputPassword, verifiedPending.password_hash)
    if (!isValid) {
        return null
    }

    const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: verifiedPending.password_hash })
        .eq('id', userId)
        .is('password_hash', null)

    if (updateError) {
        console.error('Failed to recover verified signup password hash:', updateError)
    }

    return verifiedPending.password_hash as string
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
                const users = await findCredentialUsers(supabase, credentials.email)

                if (users.length === 0) {
                    throw new Error('Invalid email or password')
                }

                for (const user of users) {
                    const passwordHash =
                        user.password_hash ||
                        await recoverVerifiedSignupPasswordHash(
                            supabase,
                            user.id,
                            credentials.email,
                            credentials.password
                        )

                    if (!passwordHash) {
                        continue
                    }

                    const isValid = await isValidCredentialPassword(
                        credentials.password,
                        passwordHash
                    )
                    if (!isValid) {
                        continue
                    }

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        image: user.avatar_url,
                        role: user.role,
                    }
                }

                const hasConfiguredAccount = users.some((user) => Boolean(user.password_hash))
                if (!hasConfiguredAccount) {
                    throw new Error('Account not configured. Contact your organizer.')
                }

                throw new Error('Invalid email or password')
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
