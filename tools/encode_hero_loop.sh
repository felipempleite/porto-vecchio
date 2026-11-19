#!/usr/bin/env bash
# Encode a generated hero loop (e.g. Kling 3.0 pro, start=end frame = saline-reflet) for the web.
# Usage: tools/encode_hero_loop.sh source.mp4   -> assets/video/hero-loop.webm + hero-loop.mp4 (each < ~3 MB)
# Optional: WIDTH=1920 WEBM_CRF=22 MP4_CRF=18 for near-static footage (keeps the loop as sharp as the poster).
# ipratio/pbratio=1 keeps keyframes and P-frames at the same quality, so the loop point does not "pop".
# Used for the Kling loop (round 3): WIDTH=1920 WEBM_CRF=22 MP4_CRF=18.
# Then add the data-ready attribute to <video class="hero__video"> in index.html.
set -euo pipefail
src="$1"; W="${WIDTH:-1600}"; WEBM_CRF="${WEBM_CRF:-40}"; MP4_CRF="${MP4_CRF:-28}"; X264="${X264_PARAMS:-ipratio=1.0:pbratio=1.0:aq-mode=0}"; out="$(dirname "$0")/../assets/video"; mkdir -p "$out"
ffmpeg -y -i "$src" -an -vf "scale=${W}:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf ${WEBM_CRF} -row-mt 1 -deadline good -auto-alt-ref 0 "$out/hero-loop.webm"
ffmpeg -y -i "$src" -an -vf "scale=${W}:-2,fps=24" -c:v libx264 -preset slow -crf ${MP4_CRF} -x264-params ${X264} -pix_fmt yuv420p -movflags +faststart "$out/hero-loop.mp4"
ls -la "$out"
