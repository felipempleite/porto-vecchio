# Porto-Vecchio — « Lettre aux descendants »

## Goal
A stunning, moving, French-language single-page site about Porto-Vecchio (Corse-du-Sud), written as a letter to descendants of the Abbatucci and Rocca Serra families.

## Scope
- Single-page scrollytelling, plain HTML/CSS/JS (pinned CDN libs only: GSAP + ScrollTrigger, Lenis).
- Sections: ouverture, la citadelle (1539), les salines, le liège, l'Ospédale, les plages et le golfe, le crépuscule dans la vieille ville, langue et chants corses, Rocca Serra, Abbatucci, envoi final, crédits.
- Real, freely licensed photos (Wikimedia Commons) + max 6 generated illustrations (no real named people).
- Responsive (390px), accessible (alt, reduced motion), fast (webp, lazy-load).

## Out of scope
- Public hosting/deploy (needs Felipe's OK), audio, CMS, analytics, genealogy of private individuals.

## Milestones
1. [x] Research + fact sheet (CONTENT.md)
2. [x] Images sourced/generated, compressed to webp, credits (CREDITS.md)
3. [x] First build with agy (claude-opus-5-5-high: index.html + prose; Claude quota hit → gemini-4-neon-high: CSS/JS)
4. [x] Review + hand edits (facts, credits, legibility, OG tags, mobile title), screenshots desktop 1440 / mobile 390
5. [x] Polish pass, final commit (local preview only)

## Status
Local preview done (http://localhost:8765/). Not published.

## Next step
Felipe reviews the preview, then picks a host (Cloudflare Pages / Netlify / GitHub Pages / Origin+Vercel) and okays publishing.

## Workflow log
- Research: web search + Wikipédia / Assemblée nationale / POP-Mérimée / Wiktionnaire → CONTENT.md (only allowed facts).
- Images: 20 Wikimedia Commons files (API + 1920/960 WebP via Pillow, CREDITS.md + assets/credits.json). Gemini image API returned 402 (prepaid credits depleted) → 4 illustrations on Higgsfield gpt_image_2_6 (0.25 credit each, ~1 credit total).
- Code: agy headless with `--mode accept-edits` (no dangerous flag; shell tools denied, so prompts say "file tools only"). Opus 5.5 high wrote index.html (~13 min, then hit Claude quota, resets ~4h); Gemini 4 Neon high wrote css/js (~6 min).
- QA: Playwright (playwright-core + system Chrome), desktop 1440 / mobile 390, console + HTTP errors, overflow, reduced-motion visibility check.
