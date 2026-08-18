-- SQL updates for Vouchers to support post-completion receipts and query responses
-- Run this in your Supabase SQL Editor

-- 1. Add new columns to the existing vouchers table for post-completion receipts and query responses
ALTER TABLE public.vouchers 
ADD COLUMN IF NOT EXISTS post_completion_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS creator_query_response TEXT;

-- 2. Create a view for the payment voucher report to see total amount spent, payee, and frequency
CREATE OR REPLACE VIEW public.payment_voucher_report AS
SELECT 
    payee_name,
    COUNT(id) AS payment_frequency,
    SUM(COALESCE(final_amount, amount_requested)) AS total_amount_spent
FROM public.vouchers
WHERE status = 'final_payable' OR status = 'approved' OR status = 'negotiated'
GROUP BY payee_name;

-- 3. Grant appropriate permissions on the view so authenticated users (accounts and audit) can read from it
GRANT SELECT ON public.payment_voucher_report TO authenticated;
GRANT SELECT ON public.payment_voucher_report TO anon;
