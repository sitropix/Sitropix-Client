/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_CAL_EMBED_URL?: string;
  readonly VITE_PROJECT_EMBED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
