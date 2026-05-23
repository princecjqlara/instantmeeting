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

type VerifiedPendingSignup = {
    email: string
    name: string | null
    password_hash: string
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

async function findVerifiedPendingSignup(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string
): Promise<VerifiedPendingSignup[]> {
    const normalizedEmail = normalizeCredentialEmail(email)
    const { data, error } = await supabase
        .from('pending_signups')
        .select('email, name, password_hash')
        .ilike('email', normalizedEmail)
        .eq('status', 'verified')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(10)

    if (error || !data) {
        return []
    }

    return data.filter(
        (signup) =>
            normalizeCredentialEmail(signup.email) === normalizedEmail &&
            typeof signup.password_hash === 'string' &&
            signup.password_hash.length > 0
    )
}

async function findMatchingVerifiedPendingSignup(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    inputPassword: string
): Promise<VerifiedPendingSignup | null> {
    const verifiedSignups = await findVerifiedPendingSignup(supabase, email)

    for (const signup of verifiedSignups) {
        const isValid = await isValidCredentialPassword(inputPassword, signup.password_hash)
        if (isValid) {
            return signup
        }
    }

    return null
}

async function recoverVerifiedSignupPasswordHash(
    supabase: ReturnType<typeof getSupabaseClient>,
    userId: string,
    email: string,
    inputPassword: string,
    replaceExistingHash = false
) {
    const verifiedPending = await findMatchingVerifiedPendingSignup(
        supabase,
        email,
        inputPassword
    )

    if (!verifiedPending?.password_hash) {
        return null
    }

    let updateQuery = supabase
        .from('users')
        .update({ password_hash: verifiedPending.password_hash })
        .eq('id', userId)

    if (!replaceExistingHash) {
        updateQuery = updateQuery.is('password_hash', null)
    }

    const { error: updateError } = await updateQuery

    if (updateError) {
        console.error('Failed to recover verified signup password hash:', updateError)
    }

    return verifiedPending.password_hash as string
}

async function provisionVerifiedSignupUser(
    supabase: ReturnType<typeof getSupabaseClient>,
    email: string,
    inputPassword: string
): Promise<CredentialUser | null> {
    const verifiedPending = await findMatchingVerifiedPendingSignup(
        supabase,
        email,
        inputPassword
    )
    if (!verifiedPending) {
        return null
    }

    const { data: user, error } = await supabase
        .from('users')
        .insert({
            email: normalizeCredentialEmail(verifiedPending.email),
            name: verifiedPending.name,
            password_hash: verifiedPending.password_hash,
            role: 'tenant',
        })
        .select('id, email, name, avatar_url, password_hash, role')
        .single()

    if (error || !user) {
        console.error('Failed to provision verified signup user during login:', error)
        return null
    }

    return user
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
                    const provisionedUser = await provisionVerifiedSignupUser(
                        supabase,
                        credentials.email,
                        credentials.password
                    )

                    if (provisionedUser) {
                        return {
                            id: provisionedUser.id,
                            email: provisionedUser.email,
                            name: provisionedUser.name,
                            image: provisionedUser.avatar_url,
                            role: provisionedUser.role,
                        }
                    }

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
                        const recoveredPasswordHash = user.password_hash
                            ? await recoverVerifiedSignupPasswordHash(
                                supabase,
                                user.id,
                                credentials.email,
                                credentials.password,
                                true
                            )
                            : null

                        if (recoveredPasswordHash) {
                            return {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                image: user.avatar_url,
                                role: user.role,
                            }
                        }

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
