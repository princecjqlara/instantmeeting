import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function GET() {
    try {
        const supabase = getSupabaseClient()
        
        // Check if caption column exists
        const { data: columnCheck, error: columnError } = await supabase
            .from('content')
            .select('id')
            .limit(1)
            .single()
            
        if (columnError) {
            return NextResponse.json({ 
                error: 'Failed to query content table',
                details: columnError.message 
            }, { status: 500 })
        }
        
        // Try to get table schema info
        let schemaInfo = null
        let schemaError = null
        try {
            const result = await supabase.rpc('get_table_columns', {
                table_name: 'content'
            })
            schemaInfo = result.data
            schemaError = result.error
        } catch {
            schemaError = new Error('RPC not available')
        }
        
        return NextResponse.json({
            status: 'Database connected',
            columnCheck: 'Content table accessible',
            captionColumnExists: 'Unknown (check Supabase dashboard)',
            suggestion: 'Run the SQL in supabase/schema_updates.sql to add missing columns'
        })
    } catch (err) {
        return NextResponse.json({ 
            error: 'Diagnostic failed',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 })
    }
}