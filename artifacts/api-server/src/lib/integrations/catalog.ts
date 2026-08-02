// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT

/**
 * The Integrations catalog: third-party services a user connects once on their
 * account and then attaches to any project.
 *
 * Attaching does two concrete things, both visible to the user afterwards:
 *   1. writes the credential into the project's Secrets under a conventional
 *      env var name, so the running app in the WebContainer can use it; and
 *   2. when the service has an MCP server, registers it in the project's MCP
 *      tab so the Loop agent can call the service's tools while building.
 *
 * Nothing here talks to a vendor at connect time — the credential is verified
 * the first time it's used (the MCP "Test connection" button, or the app's own
 * request). That keeps the catalog honest: adding a service is data, not code.
 */

export type IntegrationCategory =
  | "agent"
  | "database"
  | "payments"
  | "auth"
  | "messaging"
  | "ai"
  | "devtools"
  | "analytics"
  | "media";

export interface IntegrationField {
  key: string;
  label: string;
  placeholder?: string;
  /** Written into project Secrets under this env var when attached. */
  envVar?: string;
  required?: boolean;
  /** Non-secret fields (region, account id) are shown in clear in the UI. */
  secret?: boolean;
  help?: string;
}

export interface IntegrationDescriptor {
  id: string;
  name: string;
  tagline: string;
  category: IntegrationCategory;
  docsUrl: string;
  /** Where the user creates the credential. */
  credentialsUrl: string;
  fields: IntegrationField[];
  /** MCP catalog id + the field whose value authenticates it. */
  mcp?: { catalogId: string; credentialField: string };
  /** Called out in the UI as the fastest way to get broad tool coverage. */
  featured?: boolean;
}

export const INTEGRATIONS: IntegrationDescriptor[] = [
  {
    id: "rube",
    name: "Rube (Composio)",
    tagline:
      "One key, 500+ app tools. Gmail, Slack, Notion, Linear, Sheets, Calendar and more — all callable by Loop.",
    category: "agent",
    docsUrl: "https://rube.app",
    credentialsUrl: "https://app.composio.dev/developers",
    featured: true,
    fields: [
      {
        key: "apiKey",
        label: "Composio API key",
        placeholder: "ak_…",
        envVar: "COMPOSIO_API_KEY",
        required: true,
        secret: true,
        help: "Create one in the Composio dashboard under Developers → API keys.",
      },
    ],
    mcp: { catalogId: "rube", credentialField: "apiKey" },
  },
  {
    id: "context7",
    name: "Context7",
    tagline: "Feeds Loop current, version-correct docs for whatever library you're using.",
    category: "agent",
    docsUrl: "https://context7.com",
    credentialsUrl: "https://context7.com/dashboard",
    featured: true,
    fields: [
      {
        key: "apiKey",
        label: "Context7 API key",
        placeholder: "ctx7sk-…",
        envVar: "CONTEXT7_API_KEY",
        secret: true,
        help: "Optional — Context7 serves anonymous requests at a lower rate limit.",
      },
    ],
    mcp: { catalogId: "context7", credentialField: "apiKey" },
  },
  {
    id: "supabase",
    name: "Supabase",
    tagline: "Postgres, auth, storage and realtime for the app you're building.",
    category: "database",
    docsUrl: "https://supabase.com/docs",
    credentialsUrl: "https://supabase.com/dashboard/account/tokens",
    featured: true,
    fields: [
      { key: "url", label: "Project URL", placeholder: "https://xxxx.supabase.co", envVar: "VITE_SUPABASE_URL", required: true },
      { key: "anonKey", label: "Anon (publishable) key", envVar: "VITE_SUPABASE_ANON_KEY", required: true, secret: true },
      { key: "accessToken", label: "Personal access token", placeholder: "sbp_…", envVar: "SUPABASE_ACCESS_TOKEN", secret: true, help: "Only needed for the MCP server — lets Loop inspect tables and run migrations." },
    ],
    mcp: { catalogId: "supabase", credentialField: "accessToken" },
  },
  {
    id: "neon",
    name: "Neon",
    tagline: "Serverless Postgres with instant database branches per preview.",
    category: "database",
    docsUrl: "https://neon.tech/docs",
    credentialsUrl: "https://console.neon.tech/app/settings/api-keys",
    fields: [
      { key: "databaseUrl", label: "Connection string", placeholder: "postgresql://…", envVar: "DATABASE_URL", secret: true },
      { key: "apiKey", label: "Neon API key", envVar: "NEON_API_KEY", secret: true },
    ],
    mcp: { catalogId: "neon", credentialField: "apiKey" },
  },
  {
    id: "upstash",
    name: "Upstash Redis",
    tagline: "Serverless Redis over HTTP — caching, rate limits and queues.",
    category: "database",
    docsUrl: "https://upstash.com/docs/redis",
    credentialsUrl: "https://console.upstash.com",
    fields: [
      { key: "url", label: "REST URL", envVar: "UPSTASH_REDIS_REST_URL", required: true },
      { key: "token", label: "REST token", envVar: "UPSTASH_REDIS_REST_TOKEN", required: true, secret: true },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    tagline: "Payments, subscriptions and checkout — and Loop can create products for you.",
    category: "payments",
    docsUrl: "https://docs.stripe.com",
    credentialsUrl: "https://dashboard.stripe.com/apikeys",
    featured: true,
    fields: [
      { key: "secretKey", label: "Secret key", placeholder: "sk_live_… or sk_test_…", envVar: "STRIPE_SECRET_KEY", required: true, secret: true },
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_…", envVar: "VITE_STRIPE_PUBLISHABLE_KEY" },
      { key: "webhookSecret", label: "Webhook signing secret", placeholder: "whsec_…", envVar: "STRIPE_WEBHOOK_SECRET", secret: true },
    ],
    mcp: { catalogId: "stripe", credentialField: "secretKey" },
  },
  {
    id: "paystack",
    name: "Paystack",
    tagline: "Card, bank and mobile-money payments across Africa.",
    category: "payments",
    docsUrl: "https://paystack.com/docs",
    credentialsUrl: "https://dashboard.paystack.com/#/settings/developers",
    fields: [
      { key: "secretKey", label: "Secret key", placeholder: "sk_live_…", envVar: "PAYSTACK_SECRET_KEY", required: true, secret: true },
      { key: "publicKey", label: "Public key", placeholder: "pk_live_…", envVar: "VITE_PAYSTACK_PUBLIC_KEY" },
    ],
  },
  {
    id: "clerk",
    name: "Clerk",
    tagline: "Drop-in sign-in, user profiles and organizations.",
    category: "auth",
    docsUrl: "https://clerk.com/docs",
    credentialsUrl: "https://dashboard.clerk.com",
    fields: [
      { key: "publishableKey", label: "Publishable key", placeholder: "pk_…", envVar: "VITE_CLERK_PUBLISHABLE_KEY", required: true },
      { key: "secretKey", label: "Secret key", placeholder: "sk_…", envVar: "CLERK_SECRET_KEY", required: true, secret: true },
    ],
  },
  {
    id: "resend",
    name: "Resend",
    tagline: "Transactional email with React templates.",
    category: "messaging",
    docsUrl: "https://resend.com/docs",
    credentialsUrl: "https://resend.com/api-keys",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "re_…", envVar: "RESEND_API_KEY", required: true, secret: true },
      { key: "fromEmail", label: "Default from address", placeholder: "hello@yourdomain.com", envVar: "RESEND_FROM_EMAIL" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    tagline: "SMS, WhatsApp and voice.",
    category: "messaging",
    docsUrl: "https://www.twilio.com/docs",
    credentialsUrl: "https://console.twilio.com",
    fields: [
      { key: "accountSid", label: "Account SID", placeholder: "AC…", envVar: "TWILIO_ACCOUNT_SID", required: true },
      { key: "authToken", label: "Auth token", envVar: "TWILIO_AUTH_TOKEN", required: true, secret: true },
      { key: "fromNumber", label: "From number", placeholder: "+1…", envVar: "TWILIO_FROM_NUMBER" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    tagline: "Post build notifications and app events into a channel.",
    category: "messaging",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    credentialsUrl: "https://api.slack.com/apps",
    fields: [
      { key: "webhookUrl", label: "Incoming webhook URL", placeholder: "https://hooks.slack.com/services/…", envVar: "SLACK_WEBHOOK_URL", required: true, secret: true },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    tagline: "Push your project, open pull requests, and let Loop read issues and CI.",
    category: "devtools",
    docsUrl: "https://docs.github.com/rest",
    credentialsUrl: "https://github.com/settings/tokens",
    featured: true,
    fields: [
      { key: "token", label: "Personal access token", placeholder: "ghp_… or github_pat_…", envVar: "GITHUB_TOKEN", required: true, secret: true, help: "Needs repo scope to push; add read:org for organization repositories." },
    ],
    mcp: { catalogId: "github", credentialField: "token" },
  },
  {
    id: "vercel",
    name: "Vercel",
    tagline: "Ship to Vercel and let Loop read build logs and runtime errors.",
    category: "devtools",
    docsUrl: "https://vercel.com/docs",
    credentialsUrl: "https://vercel.com/account/tokens",
    fields: [
      { key: "token", label: "Access token", envVar: "VERCEL_TOKEN", required: true, secret: true },
    ],
    mcp: { catalogId: "vercel", credentialField: "token" },
  },
  {
    id: "sentry",
    name: "Sentry",
    tagline: "Error tracking — and Loop can pull the stack trace before you paste it.",
    category: "devtools",
    docsUrl: "https://docs.sentry.io",
    credentialsUrl: "https://sentry.io/settings/account/api/auth-tokens/",
    fields: [
      { key: "dsn", label: "DSN", placeholder: "https://…@…ingest.sentry.io/…", envVar: "VITE_SENTRY_DSN" },
      { key: "authToken", label: "Auth token", envVar: "SENTRY_AUTH_TOKEN", secret: true },
    ],
    mcp: { catalogId: "sentry", credentialField: "authToken" },
  },
  {
    id: "linear",
    name: "Linear",
    tagline: "Turn a chat thread into tracked issues without leaving the workspace.",
    category: "devtools",
    docsUrl: "https://linear.app/developers",
    credentialsUrl: "https://linear.app/settings/api",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "lin_api_…", envVar: "LINEAR_API_KEY", required: true, secret: true },
    ],
    mcp: { catalogId: "linear", credentialField: "apiKey" },
  },
  {
    id: "notion",
    name: "Notion",
    tagline: "Read specs and write docs back to your workspace.",
    category: "devtools",
    docsUrl: "https://developers.notion.com",
    credentialsUrl: "https://www.notion.so/my-integrations",
    fields: [
      { key: "token", label: "Integration token", placeholder: "ntn_…", envVar: "NOTION_TOKEN", required: true, secret: true },
    ],
    mcp: { catalogId: "notion", credentialField: "token" },
  },
  {
    id: "openai",
    name: "OpenAI",
    tagline: "Give the app you're building its own OpenAI key (separate from Loop's models).",
    category: "ai",
    docsUrl: "https://platform.openai.com/docs",
    credentialsUrl: "https://platform.openai.com/api-keys",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-…", envVar: "OPENAI_API_KEY", required: true, secret: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    tagline: "Claude models for the app you're building.",
    category: "ai",
    docsUrl: "https://docs.anthropic.com",
    credentialsUrl: "https://console.anthropic.com/settings/keys",
    fields: [
      { key: "apiKey", label: "API key", placeholder: "sk-ant-…", envVar: "ANTHROPIC_API_KEY", required: true, secret: true },
    ],
  },
  {
    id: "huggingface",
    name: "Hugging Face",
    tagline: "Models, datasets and Spaces — searchable by Loop, callable by your app.",
    category: "ai",
    docsUrl: "https://huggingface.co/docs",
    credentialsUrl: "https://huggingface.co/settings/tokens",
    fields: [
      { key: "token", label: "Access token", placeholder: "hf_…", envVar: "HUGGINGFACE_TOKEN", required: true, secret: true },
    ],
    mcp: { catalogId: "huggingface", credentialField: "token" },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    tagline: "Text-to-speech and voice cloning.",
    category: "ai",
    docsUrl: "https://elevenlabs.io/docs",
    credentialsUrl: "https://elevenlabs.io/app/settings/api-keys",
    fields: [
      { key: "apiKey", label: "API key", envVar: "ELEVENLABS_API_KEY", required: true, secret: true },
    ],
  },
  {
    id: "posthog",
    name: "PostHog",
    tagline: "Product analytics, session replay and feature flags.",
    category: "analytics",
    docsUrl: "https://posthog.com/docs",
    credentialsUrl: "https://app.posthog.com/project/settings",
    fields: [
      { key: "apiKey", label: "Project API key", placeholder: "phc_…", envVar: "VITE_POSTHOG_KEY", required: true },
      { key: "host", label: "API host", placeholder: "https://eu.i.posthog.com", envVar: "VITE_POSTHOG_HOST" },
    ],
  },
  {
    id: "algolia",
    name: "Algolia",
    tagline: "Hosted search with typo tolerance and instant results.",
    category: "analytics",
    docsUrl: "https://www.algolia.com/doc",
    credentialsUrl: "https://dashboard.algolia.com/account/api-keys",
    fields: [
      { key: "appId", label: "Application ID", envVar: "VITE_ALGOLIA_APP_ID", required: true },
      { key: "searchKey", label: "Search-only API key", envVar: "VITE_ALGOLIA_SEARCH_KEY", required: true },
      { key: "adminKey", label: "Admin API key", envVar: "ALGOLIA_ADMIN_KEY", secret: true },
    ],
  },
  {
    id: "cloudinary",
    name: "Cloudinary",
    tagline: "Image and video uploads, transforms and delivery.",
    category: "media",
    docsUrl: "https://cloudinary.com/documentation",
    credentialsUrl: "https://console.cloudinary.com/settings/api-keys",
    fields: [
      { key: "cloudName", label: "Cloud name", envVar: "VITE_CLOUDINARY_CLOUD_NAME", required: true },
      { key: "apiKey", label: "API key", envVar: "CLOUDINARY_API_KEY", required: true },
      { key: "apiSecret", label: "API secret", envVar: "CLOUDINARY_API_SECRET", required: true, secret: true },
    ],
  },
  {
    id: "mapbox",
    name: "Mapbox",
    tagline: "Maps, geocoding and directions.",
    category: "media",
    docsUrl: "https://docs.mapbox.com",
    credentialsUrl: "https://account.mapbox.com/access-tokens/",
    fields: [
      { key: "token", label: "Public access token", placeholder: "pk.…", envVar: "VITE_MAPBOX_TOKEN", required: true },
    ],
  },
];

export function getIntegration(id: string): IntegrationDescriptor | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

/**
 * Public view of a descriptor's field list — the same shape minus anything the
 * client shouldn't need. (Today that's nothing; the function exists so adding a
 * server-only field later doesn't leak by default.)
 */
export function publicIntegration(descriptor: IntegrationDescriptor) {
  return {
    id: descriptor.id,
    name: descriptor.name,
    tagline: descriptor.tagline,
    category: descriptor.category,
    docsUrl: descriptor.docsUrl,
    credentialsUrl: descriptor.credentialsUrl,
    featured: !!descriptor.featured,
    hasMcp: !!descriptor.mcp,
    fields: descriptor.fields,
  };
}
