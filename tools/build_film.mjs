// Builds the film: captions and cues laid on a timeline with the camera's journeys.
//   PIPER="path/to/python -m piper" PIPER_VOICE=path/to/fr_FR-siwis-medium.onnx node tools/build_film.mjs
//   node tools/build_film.mjs --bed path/to/ambient.wav   (optional quiet ambient bed, -28 dB by default)
// Needs ffmpeg and ffprobe. Reads narration/film.json and src/scenes.js. Writes assets/audio/film.mp3 and src/film.js.
//
// Engines (set "engine" in narration/film.json):
//   - "piper": open-licence local TTS (fr_FR-siwis-medium, CC BY 4.0); lines cached in .cache-film/.
//   - "takes": pre-recorded or studio TTS audio in narration/takes/ (see narration/ELEVENLABS_HANDOFF.md):
//       * per-step continuous take (recommended): narration/takes/<scene>.mp3|.wav + <scene>.json
//         with { "lines": [{ "at": 0.0, "end": 3.4 }, ...] } (seconds relative to the step file).
//       * per-line takes: narration/takes/<scene>-01.mp3|.wav, <scene>-02.mp3|.wav, ...
//   - "say": macOS system voice for quick local drafts only (Apple licence forbids publishing).
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {SCENES} from '../src/scenes.js';

const root = new URL('..', import.meta.url).pathname;
const script = JSON.parse(readFileSync(root + 'narration/film.json', 'utf8'));
const cache = root + '.cache-film/';
const takesDir = root + 'narration/takes/';
mkdirSync(cache, {recursive: true});

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const bedFile = arg('--bed') || (script.bed ? root + script.bed : null);
const bedDb = Number(arg('--bed-db') ?? script.bedDb ?? -28);

const run = (command, args) => execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const duration = file => +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
const plain = text => text.replace(/\u00a0|\u202f/g, ' ').replace(/[«»]/g, '').replace(/…/g, '.').replace(/\s+/g, ' ').trim();
/* French spacing for the screen: no line may begin with ; : ! ? or » */
const typeset = text => text.replace(/ ([;:!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
function forTheEar(line) {
  let text = line.say || line.text;
  for (const [written, spoken] of Object.entries(script.ear || {})) text = text.split(written).join(spoken);
  return plain(text);
}

const engine = arg('--engine') || script.engine || 'piper';
/* Piper leaves this much silence after every sentence, the last one included */
const BREATH = .3;
function speak(text) {
  const params = engine === 'say'
    ? [script.rate]
    : [script.pace ?? 1, script.noiseScale ?? '', script.noiseW ?? ''];
  const key = createHash('sha1').update([engine, script.voice, ...params, text].join('|')).digest('hex').slice(0, 16);
  const file = cache + key + (engine === 'say' ? '.aiff' : '.wav');
  if (!existsSync(file)) {
    if (engine === 'say') run('say', ['-v', script.voice, '-r', String(script.rate), '-o', file, text]);
    else {
      const [command, ...args] = (process.env.PIPER || 'piper').split(' ');
      if (!process.env.PIPER_VOICE) throw new Error('PIPER_VOICE must point to ' + script.voice + '.onnx');
      writeFileSync(cache + key + '.txt', text + '\n');
      const flags = ['-m', process.env.PIPER_VOICE, '-i', cache + key + '.txt', '-f', file, '--length-scale', String(script.pace ?? 1), '--sentence-silence', String(BREATH)];
      if (script.noiseScale != null) flags.push('--noise-scale', String(script.noiseScale));
      if (script.noiseW != null) flags.push('--noise-w-scale', String(script.noiseW));
      run(command, [...args, ...flags]);
    }
  }
  const length = duration(file);
  return {file, length: engine === 'say' ? length : Math.max(.1, length - BREATH)};
}

function findTake(base) {
  for (const ext of ['.wav', '.mp3', '.flac', '.m4a', '.ogg']) {
    const file = takesDir + base + ext;
    if (existsSync(file)) return file;
  }
  return null;
}

/* The timeline. For each step: the camera leaves the one before at `leave`, the voice starts `lead` seconds later,
   the camera is in place at `arrive`. A step is left once its last line is over and the camera has had time to settle. */
const clips = [];
const steps = [];
let leave = 0, words = 0;
script.steps.forEach((step, i) => {
  const scene = SCENES.find(s => s.id === step.scene);
  if (!scene || SCENES.indexOf(scene) !== i) throw new Error(`Step ${i} should be « ${SCENES[i]?.id} », found « ${step.scene} »`);
  const from = leave;
  let t = i ? from + (step.lead ?? 1.4) : 1.2;
  const voice = t, cues = {}, pins = {};
  let lines, said;

  const stepAudio = engine === 'takes' ? findTake(step.scene) : null;
  const stepMeta = stepAudio && existsSync(takesDir + step.scene + '.json')
    ? JSON.parse(readFileSync(takesDir + step.scene + '.json', 'utf8'))
    : null;

  if (stepAudio && stepMeta) {
    if (!Array.isArray(stepMeta.lines) || stepMeta.lines.length !== step.lines.length) {
      throw new Error(`Take metadata ${step.scene}.json must list ${step.lines.length} line timings`);
    }
    clips.push({file: stepAudio, at: voice});
    lines = step.lines.map((line, k) => {
      const span = stepMeta.lines[k];
      words += plain(line.say || line.text).split(' ').length;
      const entry = {at: +(voice + span.at).toFixed(2), end: +(voice + span.end).toFixed(2), text: typeset(line.text)};
      if (line.sub) entry.sub = typeset(line.sub);
      if (line.kind) entry.kind = line.kind;
      if (line.quiet) entry.quiet = true;
      if (line.cue) cues[line.cue] = entry.at;
      if (line.pin) pins[line.pin] = entry.at;
      return entry;
    });
    said = Math.max(lines[lines.length - 1].end, voice + duration(stepAudio));
  } else {
    lines = step.lines.map((line, k) => {
      const text = forTheEar(line);
      words += text.split(' ').length;
      let clip;
      if (engine === 'takes') {
        const file = findTake(`${step.scene}-${String(k + 1).padStart(2, '0')}`);
        if (!file) throw new Error(`Missing take for ${step.scene} line ${k + 1} in narration/takes/`);
        clip = {file, length: duration(file)};
      } else {
        clip = speak(text);
      }
      clips.push({file: clip.file, at: t});
      const entry = {at: +t.toFixed(2), end: +(t + clip.length).toFixed(2), text: typeset(line.text)};
      if (line.sub) entry.sub = typeset(line.sub);
      if (line.kind) entry.kind = line.kind;
      if (line.quiet) entry.quiet = true;
      if (line.cue) cues[line.cue] = entry.at;
      if (line.pin) pins[line.pin] = entry.at;
      t += clip.length + (line.pause ?? script.gap);
      return entry;
    });
    said = lines[lines.length - 1].end;
  }

  /* land: the camera has finished moving when that line begins; what waits for it (walls, rails) follows */
  const travel = step.land != null ? (lines[step.land].at - from) / (1 - (scene.arrive || 0)) : step.travel ?? 5;
  const arrive = i ? from + travel : 0;
  leave = Math.max(said + (step.tail ?? .7), arrive + 1);
  steps.push({id: step.scene, from: +from.toFixed(2), arrive: +arrive.toFixed(2), voice: +voice.toFixed(2), leave: +leave.toFixed(2), lines, cues, pins});
});
const length = +leave.toFixed(2);

/* one file: every clip at its place, optional quiet ambient bed, then levelled */
const inputs = clips.flatMap(clip => ['-i', clip.file]);
let graph = clips.map((clip, k) => `[${k}:a]aresample=24000,adelay=${Math.round(clip.at * 1000)}:all=1[a${k}]`).join(';')
  + ';' + clips.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad=whole_dur=${length}[voice]`;

if (bedFile) {
  if (!existsSync(bedFile)) throw new Error('Ambient bed not found: ' + bedFile);
  const bedIndex = clips.length;
  inputs.push('-stream_loop', '-1', '-i', bedFile);
  const fadeOut = Math.max(0, +(length - 3.5).toFixed(2));
  graph += `;[${bedIndex}:a]aresample=24000,atrim=0:${length},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOut}:d=3.5,volume=${bedDb}dB[bed]`
    + ';[voice][bed]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-17:TP=-1.5:LRA=11[out]';
} else {
  graph += ';[voice]loudnorm=I=-17:TP=-1.5:LRA=11[out]';
}

const bitrate = engine === 'takes' ? '64k' : '48k';
run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', bitrate, root + 'assets/audio/film.mp3']);

writeFileSync(root + 'src/film.js', `/* Written by tools/build_film.mjs from narration/film.json: do not edit. Times are seconds. */
export const FILM = ${JSON.stringify({audio: 'assets/audio/film.mp3', voice: script.voice, length, steps})};
`);
const minutes = s => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
for (const step of steps) console.log(minutes(step.from).padStart(5), step.id.padEnd(15), 'voice', minutes(step.voice), 'lands', minutes(step.arrive), 'leaves', minutes(step.leave));
console.log(`${clips.length} clips, ${words} words, ${minutes(length)} (${engine}${bedFile ? ' + bed' : ''})`);
