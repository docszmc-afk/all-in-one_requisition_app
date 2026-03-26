# Supabase Database Setup Instructions

If you are experiencing issues with data not saving (especially "disappearing" requests or details), it might be due to the database table not being set up correctly or having a restrictive size limit.

Please run the following SQL commands in your Supabase SQL Editor to ensure the `app_state` table is configured correctly.

## 1. Create the Tables (if they don't exist)

This table stores the application state as a JSON object. We use `jsonb` for better performance and flexibility.

```sql
CREATE TABLE IF NOT EXISTS public.app_state (
    key TEXT PRIMARY KEY,
    data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

You also need to create the `emails` table for the internal email system to work correctly:

```sql
CREATE TABLE IF NOT EXISTS public.emails (
    id TEXT PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "toIds" JSONB DEFAULT '[]'::jsonb,
    "ccIds" JSONB DEFAULT '[]'::jsonb,
    "bccIds" JSONB DEFAULT '[]'::jsonb,
    subject TEXT NOT NULL,
    body TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "replyToId" TEXT,
    "readBy" JSONB DEFAULT '[]'::jsonb,
    "archivedBy" JSONB DEFAULT '[]'::jsonb,
    "deletedBy" JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    link TEXT
);
```

## 2. Enable Row Level Security (RLS)

This is important for security, but for this internal app, we'll allow public access for simplicity (or you can configure policies as needed).

```sql
ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
```

## 3. Create Access Policies

Allow anyone to read and write to these tables (since authentication is handled in the app via mock users, the database connection uses the anon key).

```sql
-- Allow read access
CREATE POLICY "Allow public read access" ON public.app_state FOR SELECT USING (true);
CREATE POLICY "Allow public read access emails" ON public.emails FOR SELECT USING (true);
CREATE POLICY "Allow public read access notifications" ON public.notifications FOR SELECT USING (true);

-- Allow insert access
CREATE POLICY "Allow public insert access" ON public.app_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert access emails" ON public.emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert access notifications" ON public.notifications FOR INSERT WITH CHECK (true);

-- Allow update access
CREATE POLICY "Allow public update access" ON public.app_state FOR UPDATE USING (true);
CREATE POLICY "Allow public update access emails" ON public.emails FOR UPDATE USING (true);
CREATE POLICY "Allow public update access notifications" ON public.notifications FOR UPDATE USING (true);

-- Allow delete access
CREATE POLICY "Allow public delete access emails" ON public.emails FOR DELETE USING (true);
CREATE POLICY "Allow public delete access notifications" ON public.notifications FOR DELETE USING (true);
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
6. **Size Limit**: If a request has many large attachments, the save might fail. Try creating a request without attachments to verify.

## 6. Overdue Inspection Reminders (pg_cron)

To automatically send notifications to the Audit team for overdue inspections, you can set up a background job in Supabase using the `pg_cron` extension.

Run the following SQL in your Supabase SQL Editor:

```sql
-- Enable pg_cron extension (requires superuser privileges, usually done in Supabase dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to check for overdue inspections and create notifications
CREATE OR REPLACE FUNCTION check_overdue_inspections()
RETURNS void AS $$
DECLARE
    req RECORD;
    is_eligible BOOLEAN;
    has_uninspected_items BOOLEAN;
BEGIN
    -- Loop through approved requests older than 7 days
    FOR req IN 
        SELECT * FROM procurement_requests 
        WHERE status = 'Approved' 
        AND "updatedAt" < NOW() - INTERVAL '7 days'
        AND "isInspected" IS NOT TRUE
    LOOP
        -- Check if request type is eligible for inspection
        is_eligible := req."requestType" IN (
            'Diesel Request', 
            'Equipment Request', 
            'Lab Purchase Order', 
            'Product Procurement', 
            'Store Requisition', 
            'Pharmacy Purchase Order', 
            'IT Request'
        );

        IF is_eligible THEN
            -- Check if there are uninspected items (if items exist)
            has_uninspected_items := FALSE;
            
            IF req.items IS NOT NULL AND jsonb_array_length(req.items) > 0 THEN
                has_uninspected_items := EXISTS (
                    SELECT 1 FROM jsonb_array_elements(req.items) AS item
                    WHERE NOT (item ? 'isInspected' AND (item->>'isInspected')::boolean = true)
                );
            ELSE
                -- If no items, the request itself must be inspected
                has_uninspected_items := TRUE;
            END IF;

            IF has_uninspected_items THEN
                -- Insert a notification for the Audit department
                IF NOT EXISTS (
                    SELECT 1 FROM notifications 
                    WHERE "userId" = 'Audit' 
                    AND title = 'Overdue Inspection Reminder' 
                    AND message LIKE '%' || req.id || '%'
                    AND "createdAt" > NOW() - INTERVAL '1 day'
                ) THEN
                    INSERT INTO notifications (id, title, message, type, "userId", read, "createdAt")
                    VALUES (
                        gen_random_uuid()::text,
                        'Overdue Inspection Reminder',
                        'Request ' || req.id || ' (' || req."requestType" || ') has been approved for over a week and is pending inspection.',
                        'warning',
                        'Audit',
                        false,
                        NOW()
                    );
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule the job to run daily at 8:00 AM
SELECT cron.schedule('check-overdue-inspections-daily', '0 8 * * *', 'SELECT check_overdue_inspections()');
```
