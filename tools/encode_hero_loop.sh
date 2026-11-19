#!/usr/bin/env bash
# Encode a generated hero loop (e.g. Kling 3.0 pro, start=end frame = saline-reflet) for the web.
# Usage: tools/encode_hero_loop.sh source.mp4   -> assets/video/hero-loop.webm + hero-loop.mp4 (each < ~3 MB)
# Then add the data-ready attribute to <video class="hero__video"> in index.html.
set -euo pipefail
src="$1"; out="$(dirname "$0")/../assets/video"; mkdir -p "$out"
ffmpeg -y -i "$src" -an -vf "scale=1600:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 -deadline good "$out/hero-loop.webm"
ffmpeg -y -i "$src" -an -vf "scale=1600:-2,fps=24" -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -movflags +faststart "$out/hero-loop.mp4"
ls -la "$out"
