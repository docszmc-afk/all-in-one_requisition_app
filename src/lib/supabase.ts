import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. App features that require a database will not work. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(
  supabaseUrl || 'https://khnixumobtnyqounfgsy.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtobml4dW1vYnRueXFvdW5mZ3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3OTMyMTcsImV4cCI6MjA4OTM2OTIxN30.0E9VAn9H3L7DDKM6DJRVB0yzBIZ1oqs-91K1RrG60Is'
);
