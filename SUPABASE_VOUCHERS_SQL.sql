-- SQL to create the vouchers table for the payment ledger feature
-- Run this in your Supabase SQL Editor

CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by TEXT,
    creator_email TEXT NOT NULL,
    department TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_requested NUMERIC NOT NULL,
    payee_name TEXT NOT NULL,
    memo TEXT,
    attachment_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'sent_back', 'final_payable', 'negotiated')),
    approver_email TEXT,
    approver_comments TEXT,
    final_amount NUMERIC,
    account_comments TEXT,
    is_queried BOOLEAN DEFAULT FALSE,
    query_notes TEXT
);

-- RLS Policies
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON vouchers FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON vouchers FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for users based on email" ON vouchers FOR UPDATE USING (true);
