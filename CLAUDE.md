# CLAUDE.md — webclient repo

Browser client for Squaddle (TypeScript + vanilla UI, no framework). Protocol logic lives ONLY in
`org.squaddle:core`'s `js` target (sibling `../core`, ADR-0009), never re-implemented here. Read
`../spec/ROADMAP.md` (M5) and `../spec/adr/0009-web-client-stack.md` first.

## Hard rules
- Never log keys, seeds, invite secrets or URL fragments.
- Seed at rest: wrapped by a non-extractable WebCrypto key, stored in IndexedDB - never the raw
  seed, never localStorage/sessionStorage/cookies.
- The URL fragment (invite secret) is handled client-side only, never sent to any server (same
  rule as `website/CLAUDE.md`'s `/j/*` page).
- Relay host configurable; default `relay.squaddle.org`.
- No third-party scripts, fonts, analytics or trackers. Strict CSP (see `nginx.conf`) - no
  `unsafe-eval`.
- Local dev against an unreleased core: set `SQUADDLE_CORE_DIR=../core`, build core's `js` target
  first (`./gradlew :core:jsBrowserProductionWebpack` or equivalent from `../core`).

## Commands
```bash
npm run typecheck
npm run build
npm test
npm run e2e
```
