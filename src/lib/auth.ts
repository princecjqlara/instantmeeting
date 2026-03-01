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

export const authOptions: NextAuthOptions = {
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

                if (!user.password_hash) {
                    throw new Error('Account not configured. Contact your organizer.')
                }

                const isValid = await isValidCredentialPassword(
                    credentials.password,
                    user.password_hash
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
