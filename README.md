# DateSense

AI-powered dating conversation analyzer. Upload or paste a chat screenshot to get brutally honest insights on attraction, ghosting risk, and what to say next.

**Live:** Deployed on GitHub Pages via CI/CD.

## Features

- **Screenshot Analysis** — Upload or paste PNG/JPG/WebP screenshots of dating app conversations. Supports multiple images at once.
- **Sample Chat** — One click runs the full analysis on a built-in demo conversation, no upload needed.
- **Conversation Health Score** — 0-100 rating of how balanced and engaging the conversation is.
- **Attraction Score** — Evidence-based assessment of how interested the match seems.
- **Rizz Score** — A separate read on *your* texting game, scored independently of how keen they are.
- **Ghosting Risk** — Predictive probability the match will stop responding.
- **Brutal Verdict & Roast** — A one-line headline verdict plus an honest jab at your own texting.
- **Confidence Score** — Flags when a chat was too short or too cropped to read reliably.
- **Fake / Golddigger Detection** — Risk assessment for fake profiles and transactional behavior.
- **Reply Suggestions** — 5 natural, tone-matched replies you can copy and send, regenerable in 8 different tones.
- **Date Ideas** — Casual, conversation-tailored date suggestions.
- **Shareable Verdict** — Copy a link that encodes only the verdict and scores. Chats, names and screenshots never leave your device.

## Tech Stack

- Angular 21 (standalone components, signals)
- Angular Material (Material 3 theming)
- TypeScript 5.9
- OpenAI Vision API (via Railway `ai-gateway` backend proxy)

## Development

```bash
npm install
npm start
```

Opens at `http://localhost:4200/`.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

Build artifacts go to `dist/DateSense/`.

## Link-preview image

`public/og-image.png` is rendered from `scripts/og-image.html` — edit the HTML and
follow the regeneration command in its header comment to produce a new 1200x630 card.

## Deployment

Automatically deployed to GitHub Pages on push to `main` via `.github/workflows/deploy.yml`.
