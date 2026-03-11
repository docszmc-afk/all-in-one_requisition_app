/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Use environment variables if available, otherwise fallback to the provided keys
const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://lmzvinxrglcqgclvchch.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtenZpbnhyZ2xjcWdjbHZjaGNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDAyMzUsImV4cCI6MjA4ODM3NjIzNX0.wNCdH0zVxSRcDncWd6xSMHjiakdKHxIGD8tDTgC9AkQ';

console.log('Supabase Config:', { 
  url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'undefined', 
  hasKey: !!supabaseAnonKey 
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
