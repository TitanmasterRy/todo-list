/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly LITE?: boolean;
  /** Supabase project URL for email/password accounts (optional). */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase public anon key (safe to ship; row-level security protects data). */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** URL of a games.json manifest for the arcade (optional). */
  readonly VITE_ARCADE_MANIFEST?: string;
}
