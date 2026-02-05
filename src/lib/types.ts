// Database types for Supabase

export interface User {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
    google_access_token: string | null
    google_refresh_token: string | null
    created_at: string
}

export interface Content {
    id: string
    user_id: string
    title: string | null
    description: string | null
    cloudinary_url: string
    cloudinary_public_id: string
    thumbnail_url: string | null
    duration_seconds: number | null
    order_index: number
    views: number
    likes: number
    comments: number
    created_at: string
}

export interface Meeting {
    id: string
    user_id: string
    title: string
    google_meet_link: string | null
    google_event_id: string | null
    status: 'pending' | 'active' | 'completed'
    scheduled_at: string | null
    created_at: string
}

export interface WaitingGuest {
    id: string
    meeting_id: string
    guest_name: string
    status: 'waiting' | 'admitted' | 'left'
    joined_at: string
    admitted_at: string | null
}

export interface Database {
    public: {
        Tables: {
            users: {
                Row: User
                Insert: Omit<User, 'id' | 'created_at'>
                Update: Partial<Omit<User, 'id' | 'created_at'>>
            }
            content: {
                Row: Content
                Insert: Omit<Content, 'id' | 'created_at'>
                Update: Partial<Omit<Content, 'id' | 'created_at'>>
            }
            meetings: {
                Row: Meeting
                Insert: Omit<Meeting, 'id' | 'created_at'>
                Update: Partial<Omit<Meeting, 'id' | 'created_at'>>
            }
            waiting_guests: {
                Row: WaitingGuest
                Insert: Omit<WaitingGuest, 'id' | 'joined_at'>
                Update: Partial<Omit<WaitingGuest, 'id' | 'joined_at'>>
            }
        }
    }
}
