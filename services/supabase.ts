import { createClient } from '@supabase/supabase-js';

// Helper to safely get environment variables
const getEnv = (key: string) => {
  try {
    // Try import.meta.env for Vite environments
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // ignore
  }

  try {
    // Try process.env for Node/CRA environments
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // ignore
  }

  return '';
};

// Get config from environment
const envUrl = getEnv('VITE_SUPABASE_URL');
const envKey = getEnv('VITE_SUPABASE_KEY');

// ⚠️ Fix for "Invalid URL" error:
// Ensure we always pass a valid URL string to createClient.
// If env vars are missing (e.g. not set yet), use a placeholder URL that is syntactically valid.
// This prevents the app from crashing on startup with "TypeError: Failed to construct 'URL'".
// Requests will simply fail with connection errors until the user configures the vars.
const supabaseUrl = (envUrl && envUrl.startsWith('http')) 
  ? envUrl 
  : 'https://placeholder-project.supabase.co';

const supabaseKey = envKey || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);