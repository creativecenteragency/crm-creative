import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in your Supabase project values.'
  )
}

// Capturado antes de crear el cliente: supabase-js procesa y limpia el hash de la URL
// de forma asíncrona al inicializarse, así que si lo leemos después puede ya no estar.
// Lo necesitamos porque los links de invitación (type=invite) emiten el evento
// SIGNED_IN, no PASSWORD_RECOVERY, y sin esto no hay forma de detectarlos.
export const initialAuthHashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
