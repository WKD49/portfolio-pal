import { createClient } from '@supabase/supabase-js'

// Anon (read-only) client — safe for server components and API routes.
// Never use the service role key in Portfolio Pal — we only need to read
// from macro_indicators, which the anon key can access via Supabase RLS.
export function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }
  return createClient(url, key)
}
