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
