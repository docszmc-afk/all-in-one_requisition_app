-- SQL to add inspection fields to procurement_requests table
-- Run this in your Supabase SQL Editor

ALTER TABLE procurement_requests 
ADD COLUMN IF NOT EXISTS "isBought" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "isInspected" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "inspectedBy" TEXT,
ADD COLUMN IF NOT EXISTS "inspectedAt" TIMESTAMP WITH TIME ZONE;
