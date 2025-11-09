// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// استخدم المتغيرات من Expo (EXPO_PUBLIC_*)
const supabaseUrl = 'https://krsiywpyvpcslwtnhnts.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyc2l5d3B5dnBjc2x3dG5obnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMzU3MzIsImV4cCI6MjA3NTYxMTczMn0.ZkBAS1OD8siznGy6oQvVcvpHQ_yapvAVZxrJ7Y__Mbs';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };