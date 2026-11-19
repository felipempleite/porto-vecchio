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
Live at https://felipempleite.github.io/porto-vecchio/ (public repo felipempleite/porto-vecchio, GitHub Pages from main). Await Felipe's feedback; iterate on workflow/models.
