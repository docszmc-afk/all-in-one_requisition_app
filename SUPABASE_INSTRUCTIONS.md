# Supabase Database Setup Instructions

If you are experiencing issues with data not saving (especially "disappearing" requests or details), it might be due to the database table not being set up correctly or having a restrictive size limit.

Please run the following SQL commands in your Supabase SQL Editor to ensure the `app_state` table is configured correctly.

## 1. Create the Table (if it doesn't exist)

This table stores the application state as a JSON object. We use `jsonb` for better performance and flexibility.

```sql
CREATE TABLE IF NOT EXISTS public.app_state (
    key TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. Enable Row Level Security (RLS)

This is important for security, but for this internal app, we'll allow public access for simplicity (or you can configure policies as needed).

```sql
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
```

## 3. Create Access Policies

Allow anyone to read and write to this table (since authentication is handled in the app via mock users, the database connection uses the anon key).

```sql
-- Allow read access
CREATE POLICY "Allow public read access"
ON public.app_state
FOR SELECT
USING (true);

-- Allow insert/update access
CREATE POLICY "Allow public insert/update access"
ON public.app_state
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access"
ON public.app_state
FOR UPDATE
USING (true);
```

## 4. Verify Table Storage

If you are storing large files (PDFs/Images) directly in the JSON, you might hit row size limits.
Ideally, files should be stored in Supabase Storage buckets, and only the URL stored in the database.
However, for the current implementation, ensure your `data` column is `JSONB`.

## 5. Check for Errors

If data is still disappearing, check the browser console (F12) for any red error messages starting with "Failed to save...".
This usually indicates a network timeout or payload size issue.

## Troubleshooting "Disappearing" Data

If requests disappear after being created:
1. **Race Conditions**: Since all requests are stored in a single row, if two users save at the same time, one might overwrite the other. This is a limitation of the current "sync" architecture.
2. **Size Limit**: If a request has many large attachments, the save might fail. Try creating a request without attachments to verify.
