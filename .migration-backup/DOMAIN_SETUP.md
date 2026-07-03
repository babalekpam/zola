# Domain setup

> Built and maintained by **Argilette Lab** · © 2026 · MIT License

Once Zola is deployed (Vercel/Replit/Netlify), here's how to point a custom domain at it.

## 1. Buy a domain

Pick a registrar:

- **Namecheap** — cheapest for `.com` (~$10/yr)
- **Cloudflare Registrar** — at-cost pricing, no markup
- **Porkbun** — clean UI, very cheap
- **Google Domains / Squarespace Domains** — easy if you already use Google

Search and buy something like `getzola.com`, `argilette.com`, `zola.dev`. Avoid hyphens.

## 2. Add the domain to Vercel

1. Vercel → your `zola` project → **Settings** → **Domains**.
2. Type your domain (e.g. `getzola.com`) → **Add**.
3. Also add `www.getzola.com` and set it to redirect to the bare domain (Vercel offers this with one click).

Vercel will show you DNS records to add.

## 3. Point DNS at Vercel

In your registrar's DNS panel, add the records Vercel showed you. They're usually:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

If your registrar is Cloudflare, **set the proxy status to DNS-only (grey cloud)** — Cloudflare's proxy interferes with Vercel's SSL.

## 4. Wait for DNS propagation

Usually < 5 minutes. Vercel will show **"Valid Configuration"** with a green checkmark when DNS resolves.

SSL is automatic — Vercel issues a Let's Encrypt certificate within ~1 minute of validation.

## 5. Update your Supabase + OAuth redirect URLs

This is the step everyone forgets and then auth breaks.

### Supabase
1. Supabase dashboard → **Project Settings** → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `https://getzola.com`.
3. Under **Redirect URLs**, add both:
   - `https://getzola.com/**`
   - `https://getzola.com/auth/callback`

### OAuth providers (Google, GitHub)
If you enabled OAuth in `lib/auth/oauth-buttons.tsx`:

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client → add `https://getzola.com/auth/callback` to authorized redirect URIs.
2. GitHub → Settings → Developer Settings → OAuth Apps → your app → set the callback URL to `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.

### Stripe
1. Stripe Dashboard → Developers → Webhooks → your webhook → update endpoint to `https://getzola.com/api/stripe/webhook`.

### Update `NEXT_PUBLIC_SITE_URL` env var
On Vercel: add `NEXT_PUBLIC_SITE_URL = https://getzola.com` for the **Production** environment. The sitemap, robots, and OAuth callbacks all use this.

## 6. Verify

1. Open `https://getzola.com` — should load the landing page.
2. Open `https://getzola.com/sitemap.xml` — should list all your pages.
3. Open `https://getzola.com/robots.txt` — should reference your sitemap.
4. Sign up with a fresh email — verification email link should go to `https://getzola.com/...`, not the Vercel preview URL.

If you hit any "redirect mismatch" errors at this stage, check step 5 again.
