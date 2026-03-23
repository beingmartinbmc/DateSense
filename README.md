# DateSense

AI-powered dating conversation analyzer. Upload a chat screenshot or paste your conversation to get brutally honest insights on attraction, ghosting risk, and what to say next.

**Live:** Deployed on GitHub Pages via CI/CD.

## Features

- **Screenshot Analysis** — Upload PNG/JPG/WebP screenshots of dating app conversations. Supports multiple images at once.
- **Manual Input** — Paste conversation text with optional profile context (names, ages, platform, bios).
- **Conversation Health Score** — 0-100 rating of how balanced and engaging the conversation is.
- **Attraction Score** — Evidence-based assessment of how interested the match seems.
- **Ghosting Risk** — Predictive probability the match will stop responding.
- **Fake / Golddigger Detection** — Risk assessment for fake profiles and transactional behavior.
- **Reply Suggestions** — 5 natural, tone-matched replies you can copy and send.
- **Date Ideas** — Casual, conversation-tailored date suggestions.

## Tech Stack

- Angular 21 (standalone components, signals)
- Angular Material (Material 3 theming)
- TypeScript 5.9
- OpenAI Vision API (via backend proxy)

## Development

```bash
npm install
npm start
```

Opens at `http://localhost:4200/`.

## Build

```bash
npm run build
```

Build artifacts go to `dist/DateSense/`.

## Deployment

Automatically deployed to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.
