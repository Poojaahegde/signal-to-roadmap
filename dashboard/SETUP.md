# Signal to Roadmap: deployment and configuration

Live app: **https://signal-to-roadmap.pages.dev/**
Developer contact: **poojagh1298@gmail.com**

## Current deployment

- Frontend: Cloudflare Pages, project `signal-to-roadmap`, direct upload of `dist/`.
- Authentication and storage: Supabase Auth + Postgres.
- Sign-in emails: Brevo custom SMTP, configured only in Supabase. Email templates contain both a code and a secure link.
- Supabase Site URL: `https://signal-to-roadmap.pages.dev/`. The exact development callback `http://127.0.0.1:8781/` remains allowlisted.
- The previous GitHub Pages address forwards to the Cloudflare app.

No SMTP password, secret API key, or service-role credential belongs in this repository. `.env.production` intentionally contains only browser-safe project configuration and a publishable key.

## Run locally

```bash
npm install
npm run dev
npm run build
node check.mjs
```

Serve or deploy the contents of `dist/`. This is a static Vite application; the backend is Supabase, not a server running in this repository. The earlier Python/Next.js experiments elsewhere in the repository are separate.

## Configure a new Supabase project

1. Create a Supabase project and run `schema.sql` once in that new project's SQL Editor. It creates the workspace table and owner-based row policies.
2. Copy `.env.example` to `.env.local`. Set the project URL and browser-safe publishable/anon key. Never use a secret or service-role key.
3. Enable email signup. Configure custom SMTP in Supabase Authentication → Emails → SMTP Settings. Keep its password exclusively in Supabase. Supabase's default email service only sends to project-team members.
4. Configure both the Confirm sign up and Magic link/OTP templates to include `{{ .Token }}` and optionally `{{ .ConfirmationURL }}`. The app supports code entry and verified email-link callbacks.
5. Set the Site URL to your actual app URL. Allowlist exact development callback URLs if needed. Avoid broad wildcard redirect rules.
6. After configuring and testing delivery, set `VITE_AUTH_EMAIL_READY=true` and rebuild. Changing a Vite environment setting requires a new build and deployment.
7. Do not reuse this project's public configuration for your own business deployment; create your own Supabase project and email sender.

## Usage and privacy

**Free guests:** no sign-in or company/product profile required. Feedback, theme edits, and roadmap lanes stay on that browser/device. Clearing browser storage removes guest work. Export a backup or roadmap before clearing it.

**Company accounts:** one owner account per company in this release, with multiple products. Product-specific feedback and roadmap choices are stored privately in Supabase when the owner chooses Save changes. Sample and guest data are never uploaded automatically. Sessions use tab-scoped browser storage with token refresh on cloud requests. Sign-out clears the displayed company state.

Grouping uses local keyword rules and a word-similarity fallback. It does not use an AI API. Scores count records and source diversity; they do not measure unique customers, revenue, effort, or strategic fit. Product profiles provide context for the reviewer and do not automatically change grouping.

## Verified checks (November 1, 2026)

- Real sign-in email confirmed Delivered in Brevo; owner entered its code and signed in successfully.
- A clearly labeled Setup test workspace and Setup test product saved to Supabase and reloaded after a browser refresh.
- Live SQL check: row security enabled, four owner policies, anonymous SELECT denied. Anonymous REST read returned HTTP 401.
- Public guest access works without profile controls. CSV import of three sample feedback records produced delivery, product-quality, and booking themes.
- TypeScript and production builds pass. `check.mjs` uses mocked cloud requests for session, save, stale-version rejection, and sign-out checks; it does not replace live security testing.

The labeled setup records remain in the owner's account and can be renamed. They are test data, not real customer evidence.

## Current limits

No team invitations or member roles, billing, automatic connector sync, file attachments, backup-restore UI, or enterprise security certification. Separate-account cross-tenant penetration testing is not complete. Customer adoption and business outcomes have not been measured.

For company pilots, test authentication, data isolation with separate accounts, backup/export behavior, email delivery limits, and stale-session conflicts before handling sensitive customer data. Brevo currently uses its compliant sender-domain replacement for the verified Gmail sender; a custom sender domain can be configured later.
