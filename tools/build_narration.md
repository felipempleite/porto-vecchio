# Narration build (« Écouter la lettre »)

- Text: `narration/script.json` (one entry per chapter, written for the ear: years spelled out, diagrams dropped, lightly abridged).
- Voice: ElevenLabs `eleven_v4`, voice « Atma » (`vq479zipNPD44hpCdbIh`), one generation per chapter, 1 take each.
  Picked after a 145-character trial against « christophe » and « Max Beller »: best word accuracy on a Whisper
  check (myrte / ciste read correctly), most natural pauses on the list commas, widest dynamics.
- Post: each chapter loudness-normalised (ffmpeg loudnorm I=-18, TP=-1.5), joined with 1.4 s of silence.
  Chapter offsets in `narration/chapters.json` (also inlined in index.html for highlighting / follow-scroll).
- The November 2026 historical edit removes the sentence dating the surviving walls to 1589. The original voice is retained in both formats. Chapter offsets after the edit move back 3.54 seconds.
- Encodes: `assets/audio/lettre.webm` (Opus 32 kb/s mono, ~3.1 MB) and `assets/audio/lettre.mp3` (MP3 40 kb/s mono 22 kHz, ~3.7 MB, Safari fallback).
- QA: `tools/narration_check.py` (faster-whisper small) compares each chapter's transcript to the script; no dropped passages.
- No ambient bed: the ElevenLabs sound-effects budget was not worth it under the 10 % credit cap, and a voice alone keeps the files small.

## Round 8 — the film (« Regarder le film »)

The reading above is the round 2 one and is no longer linked. The film has its own, shorter text and its own build.

- Text: `narration/film.json`, one entry per step of the page, in the order of `src/scenes.js`. Each line is one caption and one audio clip. `say` is what the voice reads when it differs from what is shown; `ear` respells names for it; `quiet` lines are spoken but not captioned; `cue` and `pin` start something on the maquette when the line begins; `travel`, `lead`, `land` and `tail` time the camera around the lines.
- Build: `PIPER="<python> -m piper" PIPER_VOICE=<path>/fr_FR-siwis-medium.onnx node tools/build_film.mjs`, then `npm run build`. It speaks each line (cached in `.cache-film/`), lays the clips on the timeline, and writes `assets/audio/film.mp3` (mono, 24 kHz, 48 kb/s, loudnorm −17 LUFS) and `src/film.js` (the times the page follows). Piper: `pip install piper-tts`; the voice files are at `rhasspy/piper-voices` on Hugging Face (`fr/fr_FR/siwis/medium`).
- Voice: Piper `fr_FR-siwis-medium`, `pace` 1.2 (about 165 words a minute). Licence: SIWIS database, CC BY 4.0, credited on the page. `"engine": "say"` uses a macOS voice for a quick trial; Apple's licence limits system voices to personal use, so never commit a film.mp3 made with it.
- A person's voice: record one file per line of `film.json`, make `speak()` return each file and its length, run the build. Nothing else changes: the timeline is recomputed from the lengths.
- Check: transcribe `film.mp3` and read it against the script. Done with Qwen3-ASR on the current file: every sentence comes back. What it mishears: Gênes (three times: « Genève », « Gen »), Vintimille (« vingt mille »), Huningue (« une hague »), Levie (« Livy »), and « Le nom dit l’âge du lieu » comes back garbled. Whether that is the voice or the transcriber, only an ear can say, and nobody has listened to it yet.

## Round 9 — rewritten script & ElevenLabs handoff

- **Handoff guide:** [`narration/ELEVENLABS_HANDOFF.md`](../narration/ELEVENLABS_HANDOFF.md) — documents the vetted voice (`Atma`), the per-step continuous generation strategy, the `narration/takes/<scene>.mp3` + `<scene>.json` schema consumed directly by `tools/build_film.mjs` (`engine: "takes"`), the Corsican/French pronunciation table, and the optional `--bed` ambient mix flag.
- **Temporary Piper build (Round 9):** rebuilt with the rewritten epistolary script in `narration/film.json`, `pace` 1.12, `noiseScale` 0.6, `noiseW` 0.6, added `Palombaggia` → `Palombadja` and `Santa Giulia` → `Santa Djoulia` in `ear`, and handled ellipses cleanly.

## Round 10 — ElevenLabs voice pass (« Atma », `eleven_v4`)

- **Voice & generation:** ElevenLabs `eleven_v4`, voice « Atma » (`vq479zipNPD44hpCdbIh`), 25 continuous per-step takes (one per step of `narration/film.json`, saved locally in gitignored `narration/takes/<scene>.mp3`). Delivered with `[warmly]` on steps 01–23 and `[warmly] [softly]` on the dusk epilogue (`envoi`, `dedicace`), using paragraph breaks (`\n\n`) for mid-step breaths and `[pause]` on deliberate long beats (`aube`, `citadelle`, `train`, `dedicace`).
- **Pronunciation & proverbs:** tested all proper nouns before full generation and audited every step take with `vidscribe` (Qwen3-ASR 1.7B, French + Italian + English spot checks). Natural French spelling worked cleanly for `Gênes`, `Rocca Serra`, `Serra-di-Scopamène`, `Abbatucci`, `Zicavo`, `Quenza`, `Zonza`, `Ponte Novu`, `Pasquale Paoli`, `Porto-Vecchio`, `Huningue`, `Palombaggia`, `Santa Giulia`, `Cala Rossa`, `Syracuse`, `Bastia`. Targeted nudges applied where `eleven_v4` drifted: `Portivechju` → `Portivékiou`, `Stabiacciu` → `Stabiatchou`, `Levie` → `Lévie`, `Sampiero Corso` → `/sɑ̃.pje.ʁo kɔʁ.so/`, `Vintimille` → `/vɛ̃.ti.mij/`, `l’Ospédale` → `/lɔs.pe.da.le/`, `Luddareddu` → `/lu.da.ʁɛ.du/`, `Pace è salute.` → `/pa.tʃe ɛ sa.lu.te/.`. Kept Option A (French spoken translation while the Corsican text + subtitle display) for the two Corsican proverbs (`maquette`, `rue`) since `eleven_v4` garbled Corsican words on the Round 2 reference check.
- **Alignment & build:** word-level timestamps extracted for all 25 takes via ElevenLabs Scribe (`eleven_scribe_v1`, 0 credits) and refined against 10 ms RMS silence valleys into `narration/takes/<scene>.json` (`lines: [{at, end}, ...]`). Built with `"engine": "takes"`, `"voice": "elevenlabs-atma"` via `node tools/build_film.mjs` and `npm run build` — no ambient bed so intimate vocal clarity stays unmasked at 64 kb/s mono 24 kHz.
- **Output & QA:** `assets/audio/film.mp3` — 8:19 (498.98 s), 3.8 MB, integrated loudness −17.4 LUFS, LRA 6.8 LU, true peak −0.8 dBTP, ~148 wpm overall (~161 wpm within spoken steps). Full `vidscribe` ASR audit on the final mixed `film.mp3` confirms all 25 steps / 73 lines / 1,077 words present with no dropped passages. `assets/audio/lettre.*` left untouched.
