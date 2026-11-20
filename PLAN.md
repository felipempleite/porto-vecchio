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
8. [x] C — Hero loop code path (js/hero-video.js, tools/encode_hero_loop.sh): inert until <video data-ready>; muted/playsinline/loop, poster = still, off for reduced motion / save-data / 2g, pauses off-screen. [x] Generated (round 3, cap 60): Kling 3.0 pro 6 s (10.5 cr) vs Seedance 2.5 720p 6 s (42 cr), salines photo as start+end frame. Picked Kling (frames match the photo, SSIM 0.99+, no building warp; Seedance added mist that clears → cannot loop). Loop = 4.4 s, tail crossfaded into head and pasted into the 3:2 still so it matches the poster framing exactly (tools/hero_loop_crossfade.py). webm 0.80 MB, mp4 2.38 MB. data-ready on; credit line shows only while the video plays. [ ] Push after Felipe reviews /workspace/porto-vecchio-shots/hero-compare.mp4.
9. [x] D — Chapter XIII « La maison »: rue du Docteur-Camille-de-Rocca-Serra (street name only, never the number), warm point on both maps, real Commons photo of the street (plate blurred), the rue du Général-Abbatucci continuing it (OSM). Included in the narration.
10. [ ] Push / deploy — waiting for Felipe's go.

## Status
Published 2026-11-19 on GitHub Pages. Round 2 (narration, OSM map, 'La maison') live 2026-11-20. Kling hero loop live 2026-11-20 (073d22d).

## Next step
Live at https://felipempleite.github.io/porto-vecchio/ (public repo felipempleite/porto-vecchio, GitHub Pages from main). Waiting on personal family material (photos, names, stories) for idea 1; iterate on workflow/models.
