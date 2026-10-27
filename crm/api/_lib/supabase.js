import { createClient } from '@supabase/supabase-js';

let _client = null;

export function serviceClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _client = createClient(url, key, { auth: { persistSession: false }, db: { schema: 'app' } });
  return _client;
}

let _publicClient = null;

export function serviceClientPublic() {
  if (_publicClient) return _publicClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _publicClient = createClient(url, key, { auth: { persistSession: false }, db: { schema: 'public' } });
  return _publicClient;
}
