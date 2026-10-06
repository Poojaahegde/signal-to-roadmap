# Signal to Roadmap dashboard

A functional, browser-based customer intelligence workspace. The dashboard follows the supplied light SaaS design direction: Instrument Serif and Inter, indigo accents, a compact hero, and a frosted application frame.

## Run

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite. `pnpm build` creates a static `dist/` folder.

## Workflow

1. Paste one support ticket, sales/team note, or review per line. Prefix mixed lines with `support:`, `note:`, or `review:`. CSV and TXT uploads are also supported. CSV columns may include `text`/`content`, `source`, and `account`.
2. The app groups recurring issues, names themes, counts distinct input records, and keeps the source text visible. New topics outside the built-in taxonomy get a title from the first signal and can be renamed.
3. The draft roadmap proposes initiatives in Now, Next, and Later lanes. Teams can move them, inspect evidence, hide themes, and export a Markdown draft.

The sample data is synthetic. All processing and storage happen in the browser; no AI API or backend is connected to this standalone dashboard. Grouping uses a transparent keyword taxonomy plus a simple similarity fallback, so teams should review themes before making decisions. Repeat counts refer to input records, not unique customers. The cloned repository's older Python backend remains separate.
