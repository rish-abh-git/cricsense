import { createClient } from '@supabase/supabase-js';

// We fallback to hardcoded keys exclusively to ensure the user's specific build works easily without forcing .env management immediately.
// We recommend the user moves these to VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Cloudflare.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jwiflooytbaojkprddxf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_05hYR3IMZWyFXDdKBZbIUA_REBxyNbp';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
