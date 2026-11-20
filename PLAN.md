# Portivechju — « Lettre à ceux qui reviennent »

## Goal
A French-language scrollytelling page about Porto-Vecchio (Corse-du-Sud): a homage to the Rocca Serra and Abbatucci lineages, written for their descendants. Main message: « Ici, partir n'a jamais été le contraire d'appartenir. »

## Scope (since round 6)
- One page, one fixed WebGL scene behind real HTML text. The scroll moves a camera over a plaster relief of the gulf from dawn to night; the Plan Terrier and the 1951, 1975 and 2024 aerials print onto it; today's buildings rise; the two family streets light up.
- Twelve sections: ouverture, le rocher, la citadelle, ceux d'en haut, 13 juin 1769, le sel, le liège, la fièvre, l'été, le soir, la maison, envoi; then sources.
- Sources in `src/` (scenes.js = the score, stage.js = the maquette, main.js = scroll, photos, labels, stills). `npm run build` bundles them with three into `js/lettre.min.js`, which is committed: GitHub Pages serves the repo as is. No GSAP, no CDN script.
- Fallback: without WebGL 2, with reduced motion, or with `?fixe`, each step shows a still plate instead.
- Facts only from CONTENT.md. No living private person is named, no house number, no detail about descendants.

## Out of scope
- CMS, analytics, genealogy of private individuals, 20th-century political quarrels.

## History
Rounds 1 to 5 built a long illustrated page (GSAP, narration, SVG map, hero video, separate 3D viewer). Round 6 replaced it; their notes are kept for the record.

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
11. [x] Round 4 — « Les mûriers » interlude at the end of ch. V Le liège (Genoese planting order 1548…1646, Porto-Vecchio royal mulberry nursery 1773-1789, 19th c. silk, modest scale). Facts in CONTENT.md. **Not covered by the narration audio** (lettre.webm/mp3 unchanged). Live 2026-11-20 (fd10114).
12. [x] Round 5 — « Les maisons d'Américains » interlude at the end of ch. XIII La maison (Corsican emigration to the Americas 1800–1920, Cap Corse palazzi, south's share marginal). Facts in CONTENT.md. **Not covered by the narration audio.** No image. [ ] Push after Felipe's OK.

Published 2026-11-19 on GitHub Pages. Round 2 (narration, OSM map, 'La maison') live 2026-11-20. Kling hero loop live 2026-11-20 (073d22d).

## Round 6 — scrollytelling rebuild (branch `scrollytelling`)
13. [x] Research: the two families are joined (Dr Camille born in Zicavo, Abbatucci mother); salt 1795–2000; malaria campaign; Luddareddu; Ventimiglia la Nuova. CONTENT.md corrected.
14. [x] New text, about 1,700 words, 24 steps. Margin notes kept: Abbatucci, Rocca Serra, mûriers, maisons d'Américains.
15. [x] Stage: regional relief from IGN elevation (tools/build_region.py), ink-bleed print of the four maps, buildings rising from the ground, day-to-night light, night windows, street ribbons, 31 July fire, projected labels.
16. [x] Checked in headless Chrome with a real GPU at 1024×640 and 473×1024, and in stills mode. Not checked: Safari, a real phone, WebGL context loss.
17. [x] Removed the old page code (js/main.js, relief.js, map.js, narration.js, hero-video.js, relief-viewer, four stylesheets).
18. [ ] Family review of the text, then merge to main (this publishes).
19. [ ] Narration: the old recording no longer matches the text and is not linked. Re-record once the text is approved.
20. [x] Citadel walls: done in round 7.

## Round 7 — what the maquette can do (branch `scrollytelling`, same PR)
21. [x] Opening match cut: the camera stands where the salines photograph was taken, so the photograph dissolves onto the plaster town in place. Heights are true (not doubled) at the start and the end. The letter ends from the same spot, at night.
22. [x] Citadel: standing walls and bastions from OpenStreetMap, the circuit between them restored in straight lines; they rise around the rock before the houses and stay when the town is razed. `tools/build_traces.mjs` writes `src/traces.js`.
23. [x] Journeys: beads coming down from Quenza, Zonza, Levie and l'Ospédale, then going up and down with the seasons; one ship leaving in 1769; the summer crowd arriving after 1950.
24. [x] New step « 1935 »: the east-coast railway draws itself, a train runs on it, and the line fades with the next step.
25. [x] La maison: hipped tile roofs, the bell tower, and a descent to street level that lands on the street photograph.
26. [x] Small things: salt pans whitening basin by basin, sunlight on the water.
27. [x] Upright screens can frame a scene differently (`tall` in `src/scenes.js`).
28. [ ] Not done, by choice: sound, free exploration at the end, family documents pinned in place.
29. [ ] Known: a hairline seam in the shore mesh shows over the 1951–2024 photographs (since round 6). Not checked: Safari, Firefox, a real phone, WebGL context loss.

## Next step
Live site (rounds 1–5) at https://felipempleite.github.io/porto-vecchio/, GitHub Pages from main. Round 6 waits on the family's review. To confirm with the family: the marriage that joins the lineages, presenting the salt pans as the family's, which General Abbatucci the street honours, and the generic line about reopened shutters.
