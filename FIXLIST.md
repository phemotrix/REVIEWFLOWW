# VORTRIX — Fix-list for upcoming versions

Running list of V2 problems to fix in V3+. Send new issues to Nyx as you spot them in daily use.

## Reported by MURK
_(none logged yet — send them as you find them)_

## Noted during build/debug (already queued)
- [ ] Admin "Connected ✓" status should actually TEST the worker + password (call `/admin/list`), not just check that a URL was typed. (Promised 2026-09-23.)
- [ ] Service worker caches tap.html aggressively — a stale cached copy can hide fresh deploys. Consider network-first for navigations, or versioned cache names per deploy.
- [ ] tap.html WORKER_URL now strips trailing slashes in code (fixed 2026-09-24) — keep this normalization in all future templates.
- [ ] Remove `/debug` block from the live Cloudflare worker (diagnostic only, added 2026-09-23).

## Ideas parked for V3
- 100-sector Mumbai map (one sector = one day of 50–70 pitches), per-sector niche research.
- 8 psychological questions as default set (short direct answers, no emojis): overall experience / what stood out / staff treatment / worth the money / feeling on leaving / come back? / tell a friend / one-line description.
- Per-question "write your own words" free-text option; generator weaves custom words verbatim into the review.
- Hybrid engine: local template generator builds review instantly (offline-proof); Groq polishes via worker endpoint when key exists — enhancement, not dependency.
- Niche-adaptable answer options (decision pending: universal set vs niche packs).
