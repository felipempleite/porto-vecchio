// Builds the film: one spoken line per caption, laid on a timeline with the camera's journeys.
//   PIPER="path/to/python -m piper" PIPER_VOICE=path/to/fr_FR-siwis-medium.onnx node tools/build_film.mjs
// Needs ffmpeg and ffprobe. Reads narration/film.json and src/scenes.js. Writes assets/audio/film.mp3 and src/film.js.
// Spoken lines are cached in .cache-film/, so only changed lines are spoken again.
// The voice is Piper's French voice « siwis » (trained on the SIWIS database, CC BY 4.0): its recordings may be published.
// "engine": "say" in film.json uses a macOS system voice instead, for trying a text quickly. Apple's licence keeps
// those voices to personal use: do not publish a film.mp3 made that way.
// To use another voice (a recording, another service), replace speak(): one audio file per line, and its length.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {SCENES} from '../src/scenes.js';

const root = new URL('..', import.meta.url).pathname;
const script = JSON.parse(readFileSync(root + 'narration/film.json', 'utf8'));
const cache = root + '.cache-film/';
mkdirSync(cache, {recursive: true});

const run = (command, args) => execFileSync(command, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
const plain = text => text.replace(/\u00a0|\u202f/g, ' ').replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();
/* French spacing for the screen: no line may begin with ; : ! ? or » */
const typeset = text => text.replace(/ ([;:!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
function forTheEar(line) {
  let text = line.say || line.text;
  for (const [written, spoken] of Object.entries(script.ear || {})) text = text.split(written).join(spoken);
  return plain(text);
}
const engine = script.engine || 'piper';
/* Piper leaves this much silence after every sentence, the last one included */
const BREATH = .3;
function speak(text) {
  const key = createHash('sha1').update([engine, script.voice, engine === 'say' ? script.rate : script.pace, text].join('|')).digest('hex').slice(0, 16);
  const file = cache + key + (engine === 'say' ? '.aiff' : '.wav');
  if (!existsSync(file)) {
    if (engine === 'say') run('say', ['-v', script.voice, '-r', String(script.rate), '-o', file, text]);
    else {
      const [command, ...args] = (process.env.PIPER || 'piper').split(' ');
      if (!process.env.PIPER_VOICE) throw new Error('PIPER_VOICE must point to ' + script.voice + '.onnx');
      writeFileSync(cache + key + '.txt', text + '\n');
      run(command, [...args, '-m', process.env.PIPER_VOICE, '-i', cache + key + '.txt', '-f', file, '--length-scale', String(script.pace ?? 1), '--sentence-silence', String(BREATH)]);
    }
  }
  const length = +run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return {file, length: engine === 'say' ? length : length - BREATH};
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
  const lines = step.lines.map(line => {
    const said = forTheEar(line), clip = speak(said);
    words += said.split(' ').length;
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
  const said = lines[lines.length - 1].end;
  /* land: the camera has finished moving when that line begins; what waits for it (walls, rails) follows */
  const travel = step.land != null ? (lines[step.land].at - from) / (1 - (scene.arrive || 0)) : step.travel ?? 5;
  const arrive = i ? from + travel : 0;
  leave = Math.max(said + (step.tail ?? .7), arrive + 1);
  steps.push({id: step.scene, from: +from.toFixed(2), arrive: +arrive.toFixed(2), voice: +voice.toFixed(2), leave: +leave.toFixed(2), lines, cues, pins});
});
const length = +leave.toFixed(2);

/* one file: every line at its place, then levelled */
const inputs = clips.flatMap(clip => ['-i', clip.file]);
const graph = clips.map((clip, k) => `[${k}:a]aresample=24000,adelay=${Math.round(clip.at * 1000)}:all=1[a${k}]`).join(';')
  + ';' + clips.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad=whole_dur=${length},loudnorm=I=-17:TP=-1.5:LRA=11[out]`;
run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[out]', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', root + 'assets/audio/film.mp3']);

writeFileSync(root + 'src/film.js', `/* Written by tools/build_film.mjs from narration/film.json: do not edit. Times are seconds. */
export const FILM = ${JSON.stringify({audio: 'assets/audio/film.mp3', voice: script.voice, length, steps})};
`);
const minutes = s => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
for (const step of steps) console.log(minutes(step.from).padStart(5), step.id.padEnd(15), 'voice', minutes(step.voice), 'lands', minutes(step.arrive), 'leaves', minutes(step.leave));
console.log(`${clips.length} lines, ${words} words, ${minutes(length)}`);
