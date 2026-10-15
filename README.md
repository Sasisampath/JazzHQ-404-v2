# JazzHQ 404

Standalone, static JazzHQ 404 page: copy and a "Sorry" audio card on the left, an oversized three.js vinyl off the top-right.
No backend, APIs or connections to other JazzHQ projects.

```bash
npm install
npm run dev
```

- Audio: place the supplied track at `public/audio/sorry.mp3` (the card shows "Audio unavailable" until it exists).
- Logo: `public/branding/jazzhq-logo.svg` is the approved homepage wordmark, unchanged.
- Vinyl: `src/components/vinyl/` (plain three.js, lazy-loaded; static SVG fallback without WebGL).
- Checks: `npm run typecheck`, `npm run lint`, `npm run build`.
