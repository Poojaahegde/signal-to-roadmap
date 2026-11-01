# Company workspace setup

This is a browser frontend with a Supabase Auth + Postgres backend. GitHub Pages can serve the frontend; private company records live in Supabase. Never put service-role keys or database passwords in this app.

## Connect your project
1. Create a Supabase project at https://supabase.com/dashboard. Choose a region close to your customers.
2. Run `schema.sql` in SQL Editor. The policies allow each authenticated owner to access only their own company row.
3. In Authentication, enable email signup. The app supports secure email links and OTP codes. For OTP codes, in the Magic Link email template use `{{ .Token }}` to display the sign-in code (instead of only a link). This app verifies email OTP codes.
4. Configure your Site URL as the actual frontend URL. For customer use, configure a custom SMTP provider in Supabase; the default email service is restricted and rate-limited.
5. Copy `.env.example` to `.env.local`. Fill the project URL and public publishable/anon API key from Supabase. Do not use a secret or service-role key. Keep `.env.local` out of Git.
6. Run `npm install` then `npm run build`. Publish `dist/` to GitHub Pages. The existing Pages configuration uses `/docs`; copy the build there, preserving asset paths. Rebuild after changing public config.

## Verify before inviting companies
- Sign in as owner A, create a company and two products, enter feedback, save, sign out, and sign back in. Verify persistence and product separation.
- Sign in as owner B in another browser profile. Verify A's workspace is inaccessible, including direct API requests targeting A's owner_id. An unauthenticated request must not read records.
- Open A in two sessions. Save in one; the stale session should report a version conflict rather than overwrite newer work. Export a backup before reloading the stale session.
- Test expired/incorrect codes, expired sessions, offline saves, SMTP delivery, and email rate limits.

## Free guest mode
Anyone can use feedback tracking, grouping, and roadmap lanes without signing in. Guest feedback and lane choices are saved locally on that browser/device, under a separate key from sample data. No company or product profile is stored in guest mode. Clearing browser storage removes guest work; export a backup or roadmap first. Guest data is not automatically uploaded when a user signs in.

## Current scope
One owner account per company; multiple products; editable product context; feedback paste/CSV import; local rule-based grouping; evidence review; roadmap lanes; cloud save; JSON backup export. Save changes explicitly before closing. Sessions last in the browser tab (sessionStorage), with access-token refresh on cloud requests. Sample data stays in a separate local demo store and is never uploaded automatically.

Not implemented: team invites/roles, billing, connector sync, file attachments, automatic AI interpretation of product profiles, restore-from-backup UI, or enterprise security certification. Do not market these as available. Product context is saved for the user's reference; the grouping model uses feedback language only.

Cloud authentication, tenant isolation, and persistence cannot be live-tested until a Supabase project is connected. The sample workspace is not a simulated secure company account.

## Connection status — November 1, 2026
- Project: `iwmpdcptiuvxliziikuy`, Free plan, West US (Oregon).
- Schema installed successfully. Live SQL verification: RLS enabled, four owner policies, anonymous SELECT denied. Anonymous REST read verified HTTP 401.
- Public project URL and publishable key are connected locally. No secret/service-role key is used in the frontend.
- Site URL: https://signal-to-roadmap.pages.dev/ ; exact local callback allowlisted: http://127.0.0.1:8781/ .
- Public sign-in remains disabled (`VITE_AUTH_EMAIL_READY=false`) until SMTP is configured. Supabase's default email service only sends to project-team addresses.
- Brevo Free is a candidate for SMTP (300 emails/day); account creation, sender verification, transactional activation, and delivery testing are still required. Provider acceptance is not guaranteed.
- Signed-in persistence and two-account isolation tests are still pending actual email delivery.
- Updated company app has not been deployed to GitHub Pages yet.

After SMTP is verified, set `VITE_AUTH_EMAIL_READY=true`, test sign-in and cloud persistence, and rebuild before publishing.

## Email delivery connected — November 1, 2026
Brevo custom SMTP is saved in Supabase (host smtp-relay.brevo.com, port 587). The SMTP password exists only in Supabase; it is not in this repository or frontend. Sign-up and sign-in templates include a code and secure link. A real confirmation email was accepted by the app and confirmed Delivered in Brevo's log. Brevo used its compliant @brevosend.com sender replacement for the verified Gmail sender. Owner login and cloud persistence are pending the user's code entry.

`.env.production` intentionally contains only browser-safe Supabase project configuration. Never add an SMTP password, secret API key, or service-role credential there.

## Public deployment — November 1, 2026
App: https://signal-to-roadmap.pages.dev/
Hosting: Cloudflare Pages direct upload, project signal-to-roadmap.
SMTP email delivery confirmed Delivered in Brevo; owner signed in successfully. A clearly labeled Setup test workspace and Setup test product were saved and reloaded from Supabase. These are test records, not customer outcomes.
Supabase Site URL now uses the Cloudflare app; local preview callback remains allowlisted for development. Guest and company modes remain separate.
Portfolio demo links and project documentation are being updated to this canonical URL.
