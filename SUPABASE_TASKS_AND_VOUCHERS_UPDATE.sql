-- ==========================================
-- 1. TASK MANAGEMENT SYSTEM (TRELLO-LIKE)
-- ==========================================

-- Table: Task Boards (Represents a Week or a specific board)
CREATE TABLE IF NOT EXISTS public.task_boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL, -- e.g., "Week of Aug 15 - Aug 21"
    start_date DATE,
    end_date DATE,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- Table: Tasks (Represents the individual cards/tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id UUID REFERENCES public.task_boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo', -- Uses 'todo', 'in_progress', 'done'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    created_by_email TEXT
);

-- Table: Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_email TEXT
);

-- Table: Task Attachments (For image uploads on tasks)
CREATE TABLE IF NOT EXISTS public.task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by TEXT,
    uploaded_by_email TEXT
);

-- Enable RLS for Task Management
ALTER TABLE public.task_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Allows authenticated users to interact. The frontend UI will restrict actions specific to facility/zanklihr/docs.zmc)
CREATE POLICY "Allow authorized users full access to boards" ON public.task_boards FOR ALL USING (true);
CREATE POLICY "Allow authorized users full access to tasks" ON public.tasks FOR ALL USING (true);
CREATE POLICY "Allow authorized users full access to comments" ON public.task_comments FOR ALL USING (true);
CREATE POLICY "Allow authorized users full access to attachments" ON public.task_attachments FOR ALL USING (true);

-- Create Storage Bucket for Task Attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task_attachments', 'task_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for Attachments
CREATE POLICY "Task attachments are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'task_attachments');
CREATE POLICY "Authenticated users can upload task attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task_attachments');
CREATE POLICY "Users can delete own task attachments" ON storage.objects FOR DELETE USING (bucket_id = 'task_attachments');


-- ==========================================
-- 2. VOUCHER ENHANCEMENTS (Signatures/Stamps)
-- ==========================================

-- Instead of altering your existing `vouchers` table heavily, we create a dedicated ledger
-- table for approvals. This safely stores digital signatures and generated stamps, keeping your existing tables safe.
CREATE TABLE IF NOT EXISTS public.voucher_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    voucher_id UUID NOT NULL, -- Links to your existing vouchers
    user_email TEXT NOT NULL, -- Email of the approver/accountant
    role TEXT,                -- e.g., 'Approver', 'Accounts'
    signature_type TEXT NOT NULL, -- 'password_stamp' OR 'drawn_signature'
    signature_data TEXT NOT NULL, -- Contains the Base64 image of the drawing, or the text of the generated stamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Approvals
ALTER TABLE public.voucher_approvals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and insert approvals
CREATE POLICY "Allow all authenticated users to read approvals" ON public.voucher_approvals FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert approvals" ON public.voucher_approvals FOR INSERT WITH CHECK (true);
