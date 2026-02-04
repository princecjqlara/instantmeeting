import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: 'openid email profile https://www.googleapis.com/auth/calendar',
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === 'google') {
                try {
                    const supabase = getSupabaseClient()
                    const { error } = await supabase
                        .from('users')
                        .upsert({
                            email: user.email!,
                            name: user.name,
                            avatar_url: user.image,
                            google_access_token: account.access_token,
                            google_refresh_token: account.refresh_token,
                        }, {
                            onConflict: 'email'
                        })

                    if (error) {
                        console.error('Error upserting user:', error)
                        return false
                    }
                } catch (err) {
                    console.error('Error in signIn callback:', err)
                    return false
                }
            }
            return true
        },
        async jwt({ token, account, user }) {
            if (account) {
                token.accessToken = account.access_token
                token.refreshToken = account.refresh_token
            }
            if (user) {
                token.email = user.email
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.email = token.email as string
                const supabase = getSupabaseClient()
                const { data } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', token.email)
                    .single()

                if (data) {
                    (session.user as { id?: string }).id = data.id
                }
            }
            (session as { accessToken?: string }).accessToken = token.accessToken as string
            return session
        },
    },
    pages: {
        signIn: '/auth/signin',
    },
    session: {
        strategy: 'jwt',
    },
}
