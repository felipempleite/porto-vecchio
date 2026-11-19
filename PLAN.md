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

## Round 2 (approved by Felipe)
6. [x] A — Narration « Écouter la lettre »: ElevenLabs eleven_v4, voice Atma (picked over christophe / Max Beller on a 145-char trial), 15 chapter takes joined → assets/audio/lettre.webm (Opus, 3.1 MB) + lettre.mp3 (3.7 MB), 12:21. Header button + inline CTA in ch. I + floating player (play/pause, seek, chapter ticks, « Suivre » follow-scroll, chapter highlight). Never autoplays. No ambient bed (budget/size). See tools/build_narration.md.
7. [x] B — Scroll-linked SVG map from OSM (tools/build_map.py → inlined): floating pill + mini-map peek (≥1180px), tap/click to expand, active place lit per chapter; old-town plan in ch. XIII. ODbL credit in map, figure and footer. Reduced motion: no peek/pulse/transitions.
8. [x] C — Hero loop code path (js/hero-video.js, tools/encode_hero_loop.sh): inert until <video data-ready>; muted/playsinline/loop, poster = still, off for reduced motion / save-data / 2g, pauses off-screen. [ ] Generation waits for Felipe's Higgsfield cap (recommended: Kling 3.0 pro, 6 s, start=end frame, 10.5 credits).
9. [x] D — Chapter XIII « La maison »: rue du Docteur-Camille-de-Rocca-Serra (street name only, never the number), warm point on both maps, real Commons photo of the street (plate blurred), the rue du Général-Abbatucci continuing it (OSM). Included in the narration.
10. [ ] Push / deploy — waiting for Felipe's go.

## Status
Published 2026-11-19 on GitHub Pages.

## Next step
Live at https://felipempleite.github.io/porto-vecchio/ (public repo felipempleite/porto-vecchio, GitHub Pages from main). Await Felipe's feedback; iterate on workflow/models.
