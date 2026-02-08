// Database types for Supabase

export interface BookingField {
    id: string
    label: string
    type: 'short_text' | 'long_text' | 'multiple_choice'
    required: boolean
    options?: string[]
}

export interface User {
    id: string
    email: string
    name: string | null
    username: string | null
    bio: string | null
    avatar_url: string | null
    google_access_token: string | null
    google_refresh_token: string | null
    availability_mode: 'always' | 'never' | 'scheduled'
    available_from: string | null  // HH:MM format
    available_to: string | null    // HH:MM format
    timezone: string | null
    followers: number
    following: number
    scroll_threshold: number
    meeting_duration: number
    booking_title: string | null
    booking_description: string | null
    booking_note_placeholder: string | null
    booking_form_fields?: BookingField[] | null
    created_at: string
}

export interface Content {
    id: string
    user_id: string
    title: string | null
    description: string | null
    caption: string | null
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
    host_joined_at?: string | null
    ended_at?: string | null
    reschedule_requested?: boolean
    reschedule_requested_at?: string | null
    created_at: string
    waiting_guests?: WaitingGuest[]
}

export interface WaitingGuest {
    id: string
    meeting_id: string
    guest_name: string
    guest_email?: string | null
    guest_phone?: string | null
    note?: string | null
    custom_fields?: Array<{ id: string; label: string; value: string }> | null
    join_token?: string | null
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
