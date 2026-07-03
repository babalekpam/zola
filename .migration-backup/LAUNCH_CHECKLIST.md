# Launch checklist

> Built and maintained by **Argilette Lab** · © 2026 · MIT License

Run through this before you announce Zola to real users.

## 1. Database

- [ ] Run `supabase/schema.sql` in Supabase SQL editor
- [ ] Run `supabase/migrations/002_production_hardening.sql`
- [ ] Run `supabase/migrations/003_billing.sql`
- [ ] In Supabase → Auth → Providers → Email, **enable email confirmations**
- [ ] In Supabase → Auth → URL Configuration, set Site URL + redirect URLs to your production domain

## 2. Environment variables (Vercel/Replit, Production scope)

### Required
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (for account deletion + Stripe webhook)
- [ ] At least one of: `NVIDIA_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENROUTER_API_KEY`

### Highly recommended
- [ ] `NEXT_PUBLIC_SITE_URL` — your custom domain, no trailing slash
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (and configure the matching secret in Supabase Auth → Bot & Abuse)
- [ ] `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN`

### For paid plans
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `STRIPE_PRICE_PRO` (Stripe Price ID for the Pro plan)
- [ ] `STRIPE_PRICE_TEAM` (Stripe Price ID for the Team plan)

## 3. Stripe setup

- [ ] Create products + monthly prices for Pro ($19) and Team ($49) in Stripe Dashboard
- [ ] Copy the Price IDs to env vars above
- [ ] Add a webhook endpoint at `https://YOUR-DOMAIN/api/stripe/webhook`
  listening for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy the signing secret to `STRIPE_WEBHOOK_SECRET`
- [ ] Test a real subscription end-to-end with Stripe test mode

## 4. OAuth (optional but recommended)

- [ ] Enable Google provider in Supabase Auth → Providers
- [ ] Enable GitHub provider in Supabase Auth → Providers
- [ ] For each, register an OAuth app and paste the client ID + secret into Supabase
- [ ] OAuth redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

## 5. Custom domain

- [ ] Domain bought
- [ ] DNS records added (see `DOMAIN_SETUP.md`)
- [ ] Domain verified in Vercel with green checkmark
- [ ] SSL working (`https://`)
- [ ] `www` redirects to bare domain (or vice versa)

## 6. Email deliverability

Supabase free tier sends ~4 emails/hour and from a `supabase.io` address — fine for testing, **not for launch**.

- [ ] Sign up for [Resend](https://resend.com) (free tier: 3k emails/mo from your domain)
- [ ] Verify your sending domain (SPF + DKIM records)
- [ ] In Supabase → Auth → SMTP Settings, plug in Resend SMTP
- [ ] Customize email templates: confirmation, password reset, magic link

## 7. Smoke tests

After deploy, do all of these manually:

- [ ] Open landing page → renders
- [ ] Click Sign up → create account → land on /projects
- [ ] Open verification email → click link → redirects to /projects logged in
- [ ] Create a new project → workspace loads
- [ ] Send chat message → file blocks appear → preview boots
- [ ] Close workspace → reopen → chat history is still there
- [ ] Hit rate limit (16 fast messages on Free plan) → friendly toast
- [ ] Sign out → sign back in → state preserved
- [ ] Forgot password → email arrives → reset works
- [ ] If Stripe enabled: subscribe to Pro → webhook fires → /billing shows Pro
- [ ] Delete account → all data cleared

## 8. SEO + social

- [ ] Open `https://YOUR-DOMAIN/sitemap.xml` — lists all public pages
- [ ] Open `https://YOUR-DOMAIN/robots.txt` — references sitemap
- [ ] Test OG preview at https://www.opengraph.xyz/ — should show the dynamic OG image
- [ ] Submit sitemap to Google Search Console

## 9. Monitoring

- [ ] Sentry receiving errors (trigger one intentionally to verify)
- [ ] Set up Stripe email alerts for failed payments
- [ ] Set up a basic uptime check (Better Uptime free tier, or Cloudflare)

## 10. Legal + brand

- [ ] Replace placeholder addresses in `/terms` and `/privacy` with your real legal entity + jurisdiction
- [ ] Update `support@argilette.com`, `legal@argilette.com`, etc. on /contact to your actual mailboxes (or set up the aliases)
- [ ] Decide on launch communication (X/Twitter, Product Hunt, Hacker News Show HN)

---

When every box is ticked, you're ready to ship. 🚀
