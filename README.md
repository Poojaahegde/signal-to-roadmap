<!-- portfolio-reuse-policy -->
> **Portfolio review · reuse policy**  
> Copyright (c) 2026 Pooja Hegde for her original work. Public visibility is for inspection; reuse, copying, modification, and redistribution require written permission except where existing licenses or law permit them. GitHub viewing and forking rights remain unaffected. See [copyright and reuse policy](COPYRIGHT.md).
<!-- /portfolio-reuse-policy -->

# Signal to Roadmap

**[Open the website →](https://signal-to-roadmap.pages.dev/)**

Turn customer conversations, interviews, surveys and reviews into traceable themes and a Now / Next / Later roadmap. Works across software, retail, services and other industries; no Method CRM or QuickBooks dependency.

## Two ways to use it

- **Free guest mode:** no sign-in or product profile required. Add feedback, review themes, move roadmap lanes and export your work. Guest feedback stays on that browser/device.
- **Company workspace:** email sign-in, a company profile, multiple product profiles, product-specific feedback and private cloud save. This version supports one owner account per company.

## What works

Paste feedback or import CSV/TXT; inspect source wording; rename or hide themes; choose roadmap lanes; export Markdown or a workspace JSON backup. Company profiles include audience, problems, goals, features, alternatives, website and stage. Use **Save changes** to sync signed-in work.

Grouping uses transparent keyword rules and a word-similarity fallback. It does not call an AI API. Counts represent input records, not unique customers; scores do not include revenue, effort or strategy. Product context is saved for reference and does not automatically change grouping.

## Hosting and privacy

The frontend is hosted on **Cloudflare Pages**. Supabase provides email authentication and private Postgres storage with owner-based row policies. Brevo delivers authentication emails; its Gmail-sender replacement is used until a custom sender domain is configured. Never put SMTP passwords or secret/service-role keys in frontend files.

Example feedback is synthetic. Guest work is device-local; signed-in work is uploaded to Supabase only when saved. There are no team invitations, paid subscriptions or automatic feedback connectors in this release.

## Run and configure

The current app source is in [dashboard/](dashboard/). See [setup instructions](dashboard/SETUP.md).

```bash
cd dashboard
npm install
npm run dev
npm run build
```

Publish the contents of `dashboard/dist/` to Cloudflare Pages. Public browser configuration is in `dashboard/.env.production`; use your own Supabase project when deploying your own copy. The earlier experimental Python/Next.js code under `backend/` and `frontend/` is separate.

## Contact the developer

Questions, feedback or company pilots: **[poojagh1298@gmail.com](mailto:poojagh1298@gmail.com)**.

The old GitHub Pages address is retained as a forwarding page to the Cloudflare website. Customer adoption and business outcomes have not yet been measured.

