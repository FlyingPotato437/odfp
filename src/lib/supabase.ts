import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : null;

export const supabaseAdmin = supabaseUrl && supabaseService
  ? createClient(supabaseUrl, supabaseService)
  : null;
