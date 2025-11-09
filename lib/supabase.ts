// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// استخدم المتغيرات من Expo (EXPO_PUBLIC_*)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase };