# Portivechju — « Lettre à ceux qui reviennent »

## Goal
A French-language scrollytelling page about Porto-Vecchio (Corse-du-Sud): a homage to the Rocca Serra and Abbatucci lineages, written for their descendants. Main message: « Ici, partir n'a jamais été le contraire d'appartenir. »

## Scope (since round 6)
- One page, one fixed WebGL scene behind real HTML text. The scroll moves a camera over a plaster relief of the gulf from dawn to night; the Plan Terrier and the 1951, 1975 and 2024 aerials print onto it; today's buildings rise; the two family streets light up.
- Twelve sections: ouverture, le rocher, la citadelle, ceux d'en haut, 13 juin 1769, le sel, le liège, la fièvre, l'été, le soir, la maison, envoi; then sources.
- Sources in `src/` (scenes.js = the score, stage.js = the maquette, main.js = scroll, photos, labels, stills). `npm run build` bundles them with three into `js/lettre.min.js`, which is committed: GitHub Pages serves the repo as is. No GSAP, no CDN script.
- Fallback: without WebGL 2, with reduced motion, or with `?fixe`, each step shows a still plate instead.
- Since round 8 the same score can play as a film (`src/cinema.js`), with a spoken, shorter text (`narration/film.json`).
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
18. [x] Merged to main and published 2026-11-20 (#4). [ ] Family review of the text.
19. [ ] Narration: the old recording no longer matches the text and is not linked. Re-record once the text is approved.
20. [x] Citadel walls: done in round 7.

## Round 7 — what the maquette can do (branch `journeys`)
21. [x] Opening match cut: the camera stands where the salines photograph was taken, so the photograph dissolves onto the plaster town in place. Heights are true (not doubled) at the start and the end. The letter ends from the same spot, at night.
22. [x] Citadel: standing walls and bastions from OpenStreetMap, the circuit between them restored in straight lines; they rise around the rock before the houses and stay when the town is razed. `tools/build_traces.mjs` writes `src/traces.js`.
23. [x] Journeys: beads coming down from Quenza, Zonza, Levie and l'Ospédale, then going up and down with the seasons; one ship leaving in 1769; the summer crowd arriving after 1950.
24. [x] New step « 1935 »: the east-coast railway draws itself, a train runs on it, and the line fades with the next step.
25. [x] La maison: hipped tile roofs, the bell tower, and a descent to street level that lands on the street photograph.
26. [x] Small things: salt pans whitening basin by basin, sunlight on the water.
27. [x] Upright screens can frame a scene differently (`tall` in `src/scenes.js`).
28. [ ] Not done, by choice: sound, free exploration at the end, family documents pinned in place.
29. [ ] Known: a hairline seam in the shore mesh shows over the 1951–2024 photographs (since round 6). Not checked: Safari, Firefox, a real phone, WebGL context loss.

## Round 8 — the film (branch `film`)
30. [x] « Regarder le film »: the letter plays by itself, about 8 minutes. The voice is the clock (`narration/film.json` → `tools/build_film.mjs` → `assets/audio/film.mp3` + `src/film.js`); `src/cinema.js` turns its time into a place in the score and `src/main.js` moves the page there, so the reader who scrolls finds the letter where the film left it. Any wheel, swipe or scroll key pauses it; « Reprendre le film » continues from the same word, or from the start of the chapter the reader has moved to. Space pauses. While it plays, the cards are hidden and each spoken line is shown as a caption; chapter titles show while the camera travels.
31. [x] Film script: 973 words, 72 lines, only facts already on the page. Events follow the sentence: the walls rise on « Les murs montent », the ship leaves on « embarque », the train runs on « le train atteint enfin ».
32. [x] Voice: synthetic, Piper « fr_FR-siwis-medium » (SIWIS database, CC BY 4.0), 165 words a minute. Corsican names are respelled for it (`ear` in film.json); the two proverbs are shown in Corsican and said in French. A macOS system voice was used for the first drafts and dropped: Apple's licence does not allow publishing it. A person's reading can replace it: one audio file per line, see `tools/build_narration.md`.
33. [x] Pinned to the maquette: the two Abbatucci portraits over Zicavo, the bastion de France photograph on the citadel, the 1802 plan over the salt pans, the three malaria counts, the three census figures. Some only show during the film, where the card that carries them is hidden.
34. [x] Weak spots from round 7: the shore seam is closed (the shore piece now overlaps the relief by a hair); the plaster around the tile takes the tone of the period's photograph and fades with distance; inland ponds no longer show as holes; house fronts have stone courses, window frames and shutters at street level; the train has an engine, wagons and steam, and beads are larger, more so on phones.
35. [x] Checked in WebKit 27.2 (Playwright) as an iPhone 14 and as a desktop window: the maquette renders, the film plays with sound, pauses on scroll and resumes, 60 frames a second, no console errors. Phone on a 9 Mbit/s line with the processor slowed four times: text at 0.4 s, maquette at 2.0 s after 1.95 MB, 3.7 MB once the four period maps are in; the film adds 2.8 MB, streamed. On 1.6 Mbit/s the maquette takes 10 s; the still images cover the wait.
36. [ ] Not checked: a real iPhone (Playwright's WebKit is the Mac build), Firefox, WebGL context loss, the film with a screen reader. The voice has been checked by transcription, not by a French ear: Gênes, Vintimille, Huningue and Levie come back wrong, and so does « Le nom dit l’âge du lieu ».
37. [ ] `assets/audio/lettre.*` (the round 2 reading of the old text, 6.7 MB) is still in the repository and still unused.

## Round 9 — copy & narration rewrite + ElevenLabs handoff (branch `narration-rewrite`)
- **Full handoff guide for the next agent with ElevenLabs access:** read [`narration/ELEVENLABS_HANDOFF.md`](narration/ELEVENLABS_HANDOFF.md) first.
- **Voice & copy rewrite (`index.html`, `narration/film.json`):** shifted from museum-placard prose to a warm literary French letter; removed meta-references to the maquette/UI/IGN from the story flow (all transparency notes consolidated in `#credits`); fixed the 1951/Camille anachronism; restored key verified payoffs in the film (salines photo tie-back, Paoli/Abbatucci twist, cork factory → theatre, train's eight summers, l'Ospédale + beaches, Luddareddu irony); split long lines for clean mobile captions; varied natural pauses instead of a flat 0.45 s gap.
- **Audio build (`tools/build_film.mjs`):** added `engine: "takes"` (per-step continuous audio + line-timing JSON, or per-line takes in `narration/takes/`) and optional `--bed` ambient mixing for the upcoming ElevenLabs or human-voice pass. Rebuilt the temporary Piper draft with `pace: 1.12`, `noiseScale: 0.6`, `noiseW: 0.6`, and `Palombaggia` / `Santa Giulia` phonetic fixes.
- **Film UX polish (`src/cinema.js`, `src/main.js`, `css/lettre.css`, `index.html`):** clicking a chapter in `Sommaire` during film mode now jumps straight to that chapter without pausing the film (`cinema.jump`); bumped `.film__line` weight to 500 with a slightly stronger bottom veil for sunlit photos; added `aria-live="polite"` on `.film__words`.

## Round 10 — ElevenLabs voice pass (branch `elevenlabs-narration`)
- **Voice upgrade (`narration/film.json`, `src/film.js`, `assets/audio/film.mp3`):** replaced temporary Piper TTS with 25 continuous per-step ElevenLabs takes (`eleven_v4`, voice `Atma` `vq479zipNPD44hpCdbIh`, `"engine": "takes"`), aligned per line via `eleven_scribe_v1` word timestamps + RMS silence-valley checks (`narration/takes/<scene>.mp3` + `<scene>.json`, gitignored). Spoken cleanly without an ambient bed so the intimate narration stays crisp and mobile-friendly (8:19, 3.8 MB at 64 kb/s mono 24 kHz, −17.4 LUFS, −0.8 dBTP). `assets/audio/lettre.*` left untouched.
- **Pronunciation & proverbs:** verified all Corsican and French proper nouns (`Portivechju`, `Gênes`, `Sampiero Corso`, `Vintimille`, `Quenza`, `Zonza`, `Levie`, `l’Ospédale`, `Ponte Novu`, `Pasquale Paoli`, `Abbatucci`, `Zicavo`, `Huningue`, `Stabiacciu`, `Palombaggia`, `Santa Giulia`, `Cala Rossa`, `Luddareddu`, `Pace è salute`) via targeted probes and multi-language `vidscribe` (Qwen3-ASR) checks; kept Option A (French spoken translation while the Corsican proverb displays with its translation) for `maquette` and `rue`.
- **Credits & duration (`index.html`, `CREDITS.md`, `tools/build_narration.md`):** updated static `[data-film-length]` to `8 min`, updated `t-fabrique` and credits to ElevenLabs `eleven_v4` / `Atma`, rebuilt `js/lettre.min.js`, and verified cues, pins, captions, `Sommaire` jumps, and `#credits` pause in Playwright (desktop 1440×900 and iPhone 390×844).

## Next step
Live site at https://felipempleite.github.io/porto-vecchio/. To confirm with the family: the marriage that joins the lineages, presenting the salt pans as the family's, which General Abbatucci the street honours, and the generic line about reopened shutters.
