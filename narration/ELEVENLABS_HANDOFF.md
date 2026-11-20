# ElevenLabs Narration Handoff (Round 9 → Voice Pass)

This document is for the agent (or engineer) upgrading `assets/audio/film.mp3` from the temporary open-licence Piper voice (`fr_FR-siwis-medium`) to **ElevenLabs** (or a human French reading).

The copy in `index.html` and the spoken script in `narration/film.json` have been fully rewritten in Round 9 into a warm, literary French epistolary voice and are ready for recording. **Do not alter historical facts** — every claim is strictly verified in `CONTENT.md`.

---

## 1. Voice & Model Recommendation

- **Previously vetted in Round 2** (see `tools/build_narration.md`):
  - Model: `eleven_v4` (or `eleven_v3` / latest expressive French model)
  - Voice: **`Atma`** (`vq479zipNPD44hpCdbIh`) — already tested against `christophe` and `Max Beller`, with natural list pauses and wide dynamics.
  - Reference audio still in the repository: `assets/audio/lettre.mp3` (the old Round 2 recording using `Atma` — listen to a few seconds if you want to match its warmth and unhurried documentary cadence).
- **Vocal direction:** Unhurried, intimate, sober, warm — a family letter read aloud at dusk, never theatrical, never news-anchor fast. Aim for ~145–155 words/minute so the 3D camera moves and emotional turns breathe.
- **Keep `assets/audio/lettre.*` untouched** unless Felipe explicitly asks to delete it.

---

## 2. Crucial Architecture Rule: Generate by STEP, Not by Line

The robotic feel in Round 8 came partly from synthesizing 72 isolated lines independently (resetting intonation on every sentence with a rigid `0.45 s` gap).

**Instead, generate one continuous take per step** (25 steps total in `narration/film.json`) using ElevenLabs' **`/v1/text-to-speech/{voice_id}/with-timestamps`** endpoint:

1. For each step in `narration/film.json`, join the step's spoken lines (`line.say || line.text`) with natural paragraph/sentence breaks (a single space or `\n\n` where a longer breath belongs; note `line.pause >= 0.6` marks a deliberate breath).
2. Pass ElevenLabs **`previous_text`** (from the preceding step) and **`next_text`** (from the following step) on each call so tone, pitch, and pacing stay consistent across all 25 steps.
3. From ElevenLabs' returned `alignment` (`characters`, `character_start_times_seconds`, `character_end_times_seconds`), extract the exact `{ "at": <start>, "end": <end> }` timestamp (in seconds relative to the step's audio file) for each line in `step.lines`.
4. Save each step into `narration/takes/` (gitignored or kept local, only `assets/audio/film.mp3` and `src/film.js` are committed):
   - `narration/takes/<scene>.mp3` (or `.wav`)
   - `narration/takes/<scene>.json`:
     ```json
     {
       "lines": [
         { "at": 0.00, "end": 3.45 },
         { "at": 3.92, "end": 8.18 }
       ]
     }
     ```
   (Fallback: `tools/build_film.mjs` also supports one file per line as `narration/takes/<scene>-01.mp3`, `<scene>-02.mp3`, etc., if you ever need to patch a single line.)
5. Update `narration/film.json` metadata:
   - `"engine": "takes"`
   - `"voice": "elevenlabs-atma"` (or the actual chosen voice label)
6. Run the build:
   ```bash
   node tools/build_film.mjs
   npm run build
   ```
   `tools/build_film.mjs` automatically:
   - places every continuous step take on the timeline,
   - maps every `cue` (`sail`, `train`) and `pin` (`bastion`, `jp`, `jc`, `plan`, `analyses`, `habitants`) to the exact second that line starts,
   - recalculates `land` (so the citadel walls rise right when `"De 1541 à 1544, les remparts montent..."` begins),
   - normalizes loudness (`I=-17`, `TP=-1.5`) and outputs `assets/audio/film.mp3` (64 kb/s mono 24 kHz) + `src/film.js`.

---

## 3. Pronunciation Guide (Corsican & French Proper Nouns)

Do **not** blindly feed Piper's `ear` respellings (`Portivétiou`, `Abatoutchi`, etc.) to ElevenLabs — ElevenLabs handles natural French far better, and only needs phonetic nudges (or a Pronunciation Dictionary / alias rules) where Corsican or local pronunciation diverges from standard French spelling:

| Written | Target pronunciation | Notes for ElevenLabs |
|---|---|---|
| `Portivechju` | /pɔʁ.ti.ˈve.tju/ or /pɔʁ.ti.ˈve.cːu/ | Corsican *chj* is palatal, never French "ch-j". Test; alias `Portivétiou` if needed. |
| `Porto-Vecchio` | /pɔʁ.to.ve.kjo/ | Standard French-Corsican (`k`, not `ʃ`). |
| `Rocca Serra` | /ʁɔ.ka sɛ.ʁa/ | Clear open vowels. |
| `Serra-di-Scopamène` | /sɛ.ʁa di sko.pa.mɛn/ | Watch `Scopamène`. |
| `Abbatucci` | /a.ba.tu.tʃi/ | Italianate `cci` → `tchi`, `u` → `ou`. |
| `Zicavo` | /zi.ka.vo/ | Straightforward. |
| `Quenza` | /kwɛn.za/ or /kɛn.za/ | Corsican `Qu-` is `kw` (`Couènza`), not nasal `kan-za`. |
| `Zonza` | /zɔn.za/ | Soft `on`, non-nasalized in Corsican or lightly nasal in French. |
| `Levie` | /le.vi/ | Acute `é` (`Lévie`), not mute `Le-vie`. |
| `l’Ospédale` | /lɔs.pe.da.le/ or /lɔs.pe.dal/ | Corsican final `-é` (`l’Ospédalé`) sounds most authentic. |
| `l’Incudine` | /lɛ̃.ky.din/ | Standard French works well. |
| `Ponte Novu` | /pɔn.te no.vu/ | Final `-e` → `é`, `-u` → `ou` (`Ponté Novou`). |
| `Pasquale Paoli` | /pas.kwa.le pa.ɔ.li/ | Clear `Pa-oli` (three syllables, never collapsed to `Poli`). |
| `Sampiero Corso` | /sɑ̃.pje.ʁo kɔʁ.so/ | Italianate `Sampiéro`. |
| `Stabiacciu` | /sta.bja.tʃu/ | `cciu` → `tchou` (`Stabiatchou`). |
| `Palombaggia` | /pa.lɔ̃.ba.dʒa/ | Soft `gg` → `dj` (`Palombadja`), NEVER hard `g`! |
| `Santa Giulia` | /san.ta dʒu.lja/ | Soft `Giu` → `Djou` (`Santa Djoulia`), NEVER French `Jyulia`! |
| `Cala Rossa` | /ka.la ʁɔ.sa/ | Open `o`. |
| `Luddareddu` | /lu.da.ʁɛ.du/ | Corsican `u` → `ou` (`Loudarédou`). |
| `Gênes` | /ʒɛn/ | Must be distinct from `Genève` / `jeune`. |
| `Vintimille` | /vɛ̃.ti.mij/ | French `mille` → `-mij` (like *fille*), never *vingt mille*. |
| `Huningue` | /y.nɛ̃ɡ/ | Final hard `g`, never silent. |
| `Pace è salute` | /pa.tʃe e sa.lu.te/ | Corsican toast (`Patché é salouté`). |

### Corsican proverbs (`maquette` and `rue`)
In `narration/film.json`, the two proverb lines currently display the Corsican line with French `sub` underneath and use `say` in French because Piper cannot speak Corsican naturally:
- `Chì và è volta, bon viaghju face.` → *Celui qui part et revient a fait un bon voyage.*
- `A casa piglia, a casa rende.` → *La maison rend toujours ce qu’elle prend.*

With ElevenLabs, test both options:
- **Option A (safe, cohesive):** keep speaking the French translation right after the lead-in line (*« Un vieux proverbe corse le dit mieux que nous. »* / *« Car la maison n’oublie rien. »*) while the Corsican proverb glows on screen with its translation underneath.
- **Option B (if ElevenLabs nails Corsican phonology):** speak the Corsican proverb softly, pause 0.6 s, then speak the French translation.

---

## 4. Optional Ambient Sound Bed

`tools/build_film.mjs` already supports mixing a quiet ambient bed underneath the voice:

```bash
node tools/build_film.mjs --bed path/to/bed.wav --bed-db -28
```

- It loops/trims to the exact film length, adds a 2 s fade-in and 3.5 s fade-out, mixes at `-28 dB` (subtle warmth without competing with speech), and runs EBU R128 loudness normalization (`I=-17`).
- If you create a dawn-to-night bed (e.g., soft Mediterranean water at dawn → warm breeze/maquis → distant cicadas → quiet night stillness, or a very sparse warm piano/cello pad), keep it ultra-restrained so the voice stays intimate.
- Remember to keep `assets/audio/film.mp3` reasonable in size (~3–4 MB max for mobile streaming).

---

## 5. Mandatory Post-Generation Checklist

1. **Update credits & duration:**
   - Update the static `[data-film-length]` text in `index.html` (`aube` button) to match `Math.round(length / 60) + ' min'`.
   - Update `t-fabrique` in `index.html` and `CREDITS.md` to credit ElevenLabs (model + voice name, plus any ambient bed source/licence) instead of Piper/SIWIS.
   - Update `PLAN.md` and `tools/build_narration.md`.
   - Keep `narration/takes/` out of git (add `narration/takes/` to `.gitignore` if storing raw WAVs locally) — commit only `narration/film.json`, `src/film.js`, `assets/audio/film.mp3`, `js/lettre.min.js`, and docs.
2. **Rebuild bundle:** `npm run build`
3. **Verify audio & cues:**
   - Run an ASR transcription check against `narration/film.json` AND spot-listen to every tricky proper noun (`Portivechju`, `Gênes`, `Vintimille`, `Huningue`, `Abbatucci`, `Palombaggia`, `Santa Giulia`, `Luddareddu`, `Pace è salute`).
   - Verify in `src/film.js` that `cues.sail`, `cues.train`, and all 6 `pins` (`bastion`, `jp`, `jc`, `plan`, `analyses`, `habitants`) fire on the exact right timestamps.
   - Verify playback, pause/resume, `Sommaire` chapter jumping, and caption legibility in Playwright (desktop + iPhone viewport).
