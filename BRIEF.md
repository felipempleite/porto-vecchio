# Build brief for the coding agent

Build `index.html`, `css/style.css`, `js/main.js` in this folder: a single-page scrollytelling website in FRENCH, titled along the lines of « Portivechju — Lettre à ceux qui reviennent ».

## Audience & tone
A letter to the descendants of two Corsican lineages — the Rocca Serra (Porto-Vecchio, the sea) and the Abbatucci (Zicavo, the mountain). Elegant, poetic, native-quality literary French (vouvoiement or a tender « vous » addressed to the descendants), no anglicisms, short paragraphs, sensory: granite, salt, the smell of the maquis (myrte, ciste, immortelle), the sea, dusk on the old town, the return home. A few Corsican words/proverbs in italics with French translations. Moving, never kitsch or touristic.

## Facts
ONLY use facts from CONTENT.md. Do not invent dates, names, anecdotes or family links. The Abbatucci tie to Porto-Vecchio must be phrased as family tradition (escort of Paoli to Porto-Vecchio, 1769). Present the two families as « deux lignées corses », never as allied/related.

## Structure (one page)
1. Ouverture (hero, full-bleed `saline-reflet`): title « Portivechju », subtitle, a one-line dedication « Aux Rocca Serra et aux Abbatucci, et à tous ceux qui en descendent ». Scroll cue.
2. La lettre (image `lettre`): opening lines of the letter.
3. 1539 — La citadelle: `memoire-citadelle` (label it « évocation »), `porte-genoise`, `bastion-de-france`, `plan-bellin` (XVIIIe map). Genoese founding, malaria, families from Quenza, montagnards going up in summer.
4. 1769 — Le départ de Paoli (short, sober interlude, text-only on dark granite background, perhaps with `aube-baie`).
5. Le sel — `sauniers` (évocation) + `saline-reflet` or `vieille-ville`. « la cité du sel ».
6. Le liège — `chene-liege`, `demasclage` (évocation). Usine Saint-Joseph 1876–1975.
7. La montagne : l'Ospédale — `vue-ospedale`, `ospedale-lac`, `piscia-di-gallu`.
8. La mer — `palombaggia-aerien`, `santa-giulia`, `golfe`; mention Cala Rossa in text.
9. Le crépuscule sur la vieille ville — `vieille-ville`, `citadelle-ceccia`; Saint-Jean-Baptiste, Luddareddu.
10. La langue — proverbs, Corsican words, the first stanza of « Dio vi salvi Regina » with translation; background `ciste`.
11. Les Rocca Serra — « la lignée de la mer »: vertical timeline/family-tree feel (Giovan Paolo della Serra XVIe → mayors from 1803 → Camille 1880-1963 → Jean-Paul 1911-1998 → Camille né en 1954). No portraits (none freely licensed): use typographic design, the tower-and-balance coat of arms described in words, maybe an SVG line ornament.
12. Les Abbatucci — « la lignée de la montagne »: timeline (Jacques Pierre 1723-1813 with `jp-abbatucci` portrait; Jean-Charles 1770-1796 with `jc-abbatucci` and `huningue`; Jacques-Pierre-Charles 1791-1857; Séverin 1821-1888); background `coscione` (Zicavo highlands).
13. Deux lignées, une île: where sea and mountain meet (transhumance between mountain and Porto-Vecchio is a real link of the region). 
14. Envoi final (full-bleed `voie-lactee`): closing lines ending on « Ici commence toujours le retour. » and the proverb « Chì và è volta, bon viaghju face. » Then « Pace è salute ».
15. Crédits: generated from `assets/credits.json` (fetch it in JS or inline it) + a note listing the 4 AI « évocations » (memoire-citadelle, sauniers, demasclage, lettre). Sources: Wikipédia, Assemblée nationale, Mérimée/POP, Wiktionnaire.

## Images
All in `assets/img/<slug>-1920.webp` and `<slug>-960.webp`. Use `<img srcset>` with `sizes`, `loading="lazy"` (except hero: eager + fetchpriority=high), `decoding="async"`, width/height attributes to avoid layout shift, meaningful French alt text. Mark generated images with a small caption « Évocation (illustration générée) ». Captions for photos with author + licence in small type.
Sizes: citadelle-ceccia, ospedale-lac, huningue are max 1280 wide; generated ones 1344 (lettre 1024).

## Design
- Fonts (Google Fonts): Cormorant Garamond (display + body serif, italics) + a clean sans such as Inter or Manrope for labels/captions/nav.
- Palette CSS vars: granite #3b3a38 / #6b6862, salt white #f6f2ea, maquis green #4f5b3a, sea turquoise #2f8f8a / #7fc6bf, dusk ochre #c7843e / #e2b07a, night #14181c.
- Full-bleed imagery, slow parallax (GSAP ScrollTrigger, pinned CDN versions e.g. gsap@3.12.5 from cdn.jsdelivr.net), gentle reveal-on-scroll of text lines, large drop-cap for the letter, generous whitespace, chapter numbers in small caps, a thin progress line. Optional Lenis smooth scroll (pinned) — keep it subtle.
- `prefers-reduced-motion: reduce` → no parallax, no smooth scroll, content fully visible. Content must be visible even if JS fails (progressive enhancement: hide-before-reveal only when a `js` class is on <html>).
- Responsive down to 390px wide: no horizontal overflow, readable type (body >= 18px on mobile), timelines collapse to one column.
- Accessibility: semantic landmarks, lang="fr", skip link, sufficient contrast for text on images (gradient overlays), focus styles.
- No audio. No external analytics. No build step.

## Done when
`python3 -m http.server` serves index.html with no console errors, the page looks stunning at 1440px and 390px, and all images load.
