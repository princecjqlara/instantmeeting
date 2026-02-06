-- Check current database schema
-- Run this in Supabase SQL Editor to see what columns exist

-- Check users table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check content table  
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'content'
ORDER BY ordinal_position;

-- Check meetings table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'meetings'
ORDER BY ordinal_position;

-- Check waiting_guests table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'waiting_guests'
ORDER BY ordinal_position;