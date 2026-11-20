/* The score of the letter. Each step of the page names one entry here; scrolling
   interpolates between neighbours. Text lives in index.html, nothing here is prose. */
import {Color} from 'three';
import {HEART, STREET_ABBATUCCI, STREET_HOME} from './geo.js';

const c = hex => new Color(hex);

/* One day, from dawn to night. sunAz is a compass bearing, sunEl degrees above the horizon. */
export const LOOKS = {
  aube: {
    sunAz: 84, sunEl: 9, sun: c('#ffb98a'), sunPower: 3.3, above: c('#a9bbdc'), below: c('#75645a'), fill: 1.3,
    top: c('#4d6c9c'), haze: c('#f0c3a0'), hazeNear: 3, hazeFar: 46, exposure: 1.04, night: 0, glow: 1, glitter: 0.5
  },
  matin: {
    sunAz: 112, sunEl: 26, sun: c('#ffe3bf'), sunPower: 3.3, above: c('#c8dbf2'), below: c('#8a7d6c'), fill: 1.25,
    top: c('#5f95cf'), haze: c('#dbe6ea'), hazeNear: 6, hazeFar: 70, exposure: .9, night: 0, glow: .8, glitter: 0.22
  },
  midi: {
    sunAz: 165, sunEl: 58, sun: c('#fff3df'), sunPower: 3.4, above: c('#d5e6f8'), below: c('#93897a'), fill: 1.3,
    top: c('#4486cf'), haze: c('#cfe1ec'), hazeNear: 8, hazeFar: 85, exposure: .86, night: 0, glow: .6, glitter: 0.12
  },
  apresmidi: {
    sunAz: 232, sunEl: 40, sun: c('#ffe9c6'), sunPower: 3.3, above: c('#cfe0f4'), below: c('#8d8170'), fill: 1.25,
    top: c('#4f8ccd'), haze: c('#d6e2e6'), hazeNear: 7, hazeFar: 78, exposure: .88, night: 0, glow: .7, glitter: 0.28
  },
  dore: {
    sunAz: 262, sunEl: 19, sun: c('#ffd2a0'), sunPower: 3.5, above: c('#c3cfe6'), below: c('#8a7663'), fill: 1.3,
    top: c('#5a80b8'), haze: c('#f0d3b0'), hazeNear: 5, hazeFar: 64, exposure: 1.02, night: 0, glow: 1, glitter: 0.9
  },
  crepuscule: {
    sunAz: 287, sunEl: 3, sun: c('#ff8552'), sunPower: 1.5, above: c('#7786bd'), below: c('#4a3d47'), fill: .95,
    top: c('#253763'), haze: c('#d98a6c'), hazeNear: 3, hazeFar: 44, exposure: .95, night: .45, glow: 1, glitter: 1
  },
  nuit: {
    sunAz: 205, sunEl: 62, sun: c('#9db4e6'), sunPower: .34, above: c('#46578f'), below: c('#1a1f30'), fill: .8,
    top: c('#050814'), haze: c('#141d36'), hazeNear: 3, hazeFar: 50, exposure: 1, night: 1, glow: 0, glitter: 0.3
  }
};

const MARINE = [9.2863, 41.5901];
const SALINES = [9.2862, 41.5850];
const JUNCTION = STREET_HOME[STREET_HOME.length - 1];

/* Where the photograph that opens the letter was taken from, as nearly as the maquette can tell:
   the northern corner of the salt pans, a 55 mm lens on a full-frame camera (its EXIF says so).
   Found by laying the photograph over the maquette until the bell tower, the two bastions and
   the roofline agreed. focus is the part of the photograph a narrow screen keeps in the middle. */
const FROM_THE_PANS = {eye: [9.2884, 41.58571], alt: .0018, heading: 312.7, pitch: 1.65, reach: 1, fov: 24.6, frame: 1.5, focus: .4};
/* The street, at the height of someone walking down it towards the junction. */
const IN_THE_STREET = {eye: STREET_HOME[3], alt: .0017, heading: 219.6, pitch: 5, reach: .06, fov: 52, near: .0004};

/* cam is either a look from outside — at = [lon, lat], lift = kilometres above the ground there,
   az = bearing of the camera seen from that point, el = degrees above the horizon, dist = kilometres —
   or a place to stand: eye = [lon, lat], alt = kilometres above the ground, heading and pitch in
   degrees, reach = how far ahead the camera pivots, frame = the proportions of a photograph to match.

   stretch: 1 shows the heights doubled, as the maquette is built; .5 shows them true.
   walls, salt: 0 to 1. rail: 0 to 1 draws the line, 1 to 2 takes it away. folk, sail, guests: beads that travel.
   pins: pictures and figures set on the maquette (PINS below).
   hold: the share of the way out during which a photograph fades while the camera waits.
   arrive: the share of the way in kept for what happens once the camera has landed. */
export const SCENES = [
  {id: 'aube', cam: FROM_THE_PANS, look: 'aube', stretch: .5, rise: 1, core: 1, walls: 1, plate: 'img/saline-reflet', still: 'img/saline-reflet'},
  {id: 'maquette', cam: FROM_THE_PANS, look: 'aube', stretch: .5, rise: 1, core: 1, walls: 1, still: 'relief/depuis-les-salines', labels: ['ville']},
  {id: 'rocher', cam: {at: [9.298, 41.597], lift: 0, az: 104, el: 21, dist: 11.5}, look: 'matin', still: 'relief/ospedale-golfe', labels: ['ville', 'mare', 'machja']},
  {id: 'port-vieux', cam: {at: [9.2835, 41.5915], lift: .02, az: 62, el: 19, dist: 3.4}, look: 'matin', still: 'relief/ville-rocher', labels: ['ville']},
  {id: 'citadelle', arrive: .55, core: 1, walls: 1, pins: ['bastion'], cam: {at: HEART, lift: .03, az: 118, el: 33, dist: 1.25}, look: 'matin', still: 'relief/ville-rocher'},
  {id: 'ventimiglia', core: .3, walls: 1, cam: {at: HEART, lift: .03, az: 176, el: 36, dist: 1.0}, look: 'matin', still: 'relief/detail-bastion'},
  {id: 'ceux-d-en-haut', core: 1, walls: 1, folk: 1, cam: {at: [9.222, 41.652], lift: .2, az: 122, el: 24, dist: 25}, tall: {at: [9.215, 41.66], az: 132, dist: 27}, look: 'midi', still: 'relief/ospedale-golfe', labels: ['ville', 'quenza', 'zonza', 'levie', 'ospedale']},
  {id: 'estive', core: 1, walls: 1, folk: 1, tide: 1, cam: {at: [9.236, 41.632], lift: .1, az: 140, el: 23, dist: 17}, tall: {at: [9.215, 41.66], az: 132, el: 24, dist: 27}, look: 'midi', still: 'relief/ospedale-golfe', labels: ['ville', 'quenza', 'zonza', 'levie', 'ospedale']},
  {id: 'paoli', core: 1, walls: 1, sail: 1, era: 1, cam: {at: [9.305, 41.6], lift: .03, az: 258, el: 20, dist: 6.2}, look: 'midi', still: 'relief/golfe-terrier', labels: ['livourne', 'chiappa']},
  {id: 'abbatucci', core: 1, walls: 1, era: 1, pins: ['jp', 'jc'], cam: {at: [9.255, 41.618], lift: .1, az: 124, el: 19, dist: 11}, look: 'apresmidi', still: 'relief/golfe-terrier', labels: ['ville', 'zicavo']},
  {id: 'sel', core: 1, walls: 1, era: 1, salt: .3, cam: {at: SALINES, lift: .01, az: 158, el: 31, dist: 1.7}, look: 'apresmidi', still: 'relief/ville-terrier', labels: ['saline', 'ville']},
  {id: 'sauniers', core: 1, walls: 1, era: 1, salt: 1, pins: ['plan'], cam: {at: SALINES, lift: .01, az: 128, el: 43, dist: 2.3}, look: 'apresmidi', still: 'relief/salines-1802-detail', labels: ['saline']},
  {id: 'liege', core: 1, walls: 1, era: 2, cam: {at: MARINE, lift: .01, az: 72, el: 33, dist: 1.6}, look: 'apresmidi', still: 'relief/port-1951', labels: ['marina']},
  {id: 'ecorce', core: 1, walls: 1, era: 2, cam: {at: MARINE, lift: .01, az: 96, el: 30, dist: 1.8}, look: 'apresmidi', plate: 'img/chene-liege', still: 'img/chene-liege'},
  {id: 'train', arrive: .5, core: 1, walls: 1, era: 2, rail: 1, cam: {at: [9.31, 41.64], lift: .05, az: 168, el: 30, dist: 13}, tall: {at: [9.3, 41.64], az: 178, el: 36, dist: 15}, look: 'apresmidi', still: 'relief/golfe-1951', labels: ['ville', 'gare', 'bastia']},
  {id: 'fievre', core: 1, walls: 1, era: 2, rail: 2, cam: {at: MARINE, lift: .01, az: 152, el: 34, dist: 2.1}, look: 'apresmidi', still: 'relief/port-1951', labels: ['marina']},
  {id: 'rivage-1975', core: 1, walls: 1, era: 3, rail: 2, pins: ['analyses'], cam: {at: MARINE, lift: .01, az: 143, el: 37, dist: 2.05}, look: 'apresmidi', still: 'relief/port-1975'},
  {id: 'rivage-2024', core: 1, walls: 1, era: 4, rail: 2, cam: {at: MARINE, lift: .01, az: 134, el: 40, dist: 2}, look: 'dore', still: 'relief/port-2024'},
  {id: 'ete', core: 1, walls: 1, era: 4, rail: 2, rise: 1, guests: 1, pins: ['habitants'], cam: {at: [9.2835, 41.5905], lift: .02, az: 128, el: 27, dist: 4.4}, look: 'dore', still: 'relief/golfe-bati'},
  {id: 'plages', core: 1, walls: 1, era: 4, rail: 2, rise: 1, guests: 1, cam: {at: [9.2835, 41.5905], lift: .02, az: 120, el: 24, dist: 5}, look: 'dore', plate: 'img/palombaggia-aerien', still: 'img/palombaggia-aerien'},
  {id: 'soir', stretch: .5, core: 1, walls: 1, era: 4, rail: 2, rise: 1, fire: 1, cam: {at: HEART, lift: .03, az: 108, el: 17, dist: 1.3}, look: 'crepuscule', still: 'relief/ville-bati'},
  {id: 'deux-rues', stretch: .5, core: 1, walls: 1, era: 4, rail: 2, rise: 1, streets: 2, lamp: 1, cam: {at: JUNCTION, lift: .01, az: 40, el: 50, dist: .46}, look: 'crepuscule', still: 'relief/deux-rues', labels: ['rue-home', 'rue-abbatucci']},
  {id: 'rue', arrive: .4, hold: .35, stretch: .5, core: 1, walls: 1, era: 4, rail: 2, rise: 1, cam: IN_THE_STREET, look: 'crepuscule', plate: 'img/rue-camille', still: 'img/rue-camille'},
  {id: 'envoi', stretch: .5, core: 1, walls: 1, era: 4, rail: 2, rise: 1, streets: 2, lamp: 1, cam: FROM_THE_PANS, look: 'nuit', still: 'img/voie-lactee'},
  {id: 'dedicace', stretch: .5, core: 1, walls: 1, era: 4, rail: 2, rise: 1, streets: 2, lamp: 1, cam: {at: [9.2805, 41.59115], lift: .2, az: 137.6, el: 2, dist: 2.2}, look: 'nuit', still: 'img/voie-lactee'}
];

/* Words pinned to the maquette. lift is kilometres above the ground at that place. */
export const LABELS = {
  ville: {text: 'Portivechju', at: HEART, lift: .09, kind: 'place'},
  mare: {text: 'u mare', at: [9.322, 41.607], lift: .02, kind: 'word'},
  machja: {text: 'a machja', at: [9.236, 41.623], lift: .12, kind: 'word'},
  quenza: {text: 'Quenza', at: [9.138, 41.767], lift: .25, kind: 'place'},
  zonza: {text: 'Zonza', at: [9.171, 41.750], lift: .25, kind: 'place'},
  levie: {text: 'Levie', at: [9.123, 41.704], lift: .25, kind: 'place'},
  ospedale: {text: 'L’Ospédale', at: [9.1965, 41.654], lift: .25, kind: 'place'},
  zicavo: {text: 'vers Zicavo', at: [9.095, 41.795], lift: .45, kind: 'away'},
  livourne: {text: 'vers Livourne', at: [9.40, 41.625], lift: .05, kind: 'away'},
  chiappa: {text: 'Punta di a Chjappa', at: [9.3667, 41.5947], lift: .08, kind: 'place'},
  saline: {text: 'e saline', at: SALINES, lift: .03, kind: 'word'},
  marina: {text: 'a marina', at: MARINE, lift: .03, kind: 'word'},
  gare: {text: 'la gare', at: [9.28353, 41.59529], lift: .22, kind: 'word'},
  bastia: {text: 'vers Bastia', at: [9.32396, 41.68795], lift: .05, kind: 'away'},
  'rue-home': {text: 'rue du Docteur-Camille-de-Rocca-Serra', at: STREET_HOME[1], lift: .03, kind: 'street'},
  'rue-abbatucci': {text: 'rue du Général-Abbatucci', at: STREET_ABBATUCCI[4], lift: .03, kind: 'street'}
};

/* Pictures and figures set on the maquette. nudge moves one aside, in units of its own text size, so that two can share a place.
   film: true shows it only while the film plays, because the page already carries it in the text. */
export const PINS = {
  bastion: {
    image: true, src: 'assets/img/bastion-de-france-960.webp', ratio: '4 / 3', text: 'Le bastion de France aujourd’hui', note: 'Air fans, CC0',
    at: [9.28123, 41.59172], lift: .05, nudge: [7.5, -1], film: true
  },
  jp: {
    image: true, portrait: true, src: 'assets/img/jp-abbatucci-960.webp', ratio: '5 / 6', text: 'Jacques Pierre Abbatucci', note: '1723–1813',
    at: [9.095, 41.795], lift: .45, nudge: [-4.3, -3.4]
  },
  jc: {
    image: true, portrait: true, src: 'assets/img/jc-abbatucci-960.webp', ratio: '5 / 6', text: 'Jean-Charles Abbatucci', note: '1770–1796',
    at: [9.095, 41.795], lift: .45, nudge: [4.3, -3.4]
  },
  plan: {
    image: true, src: 'assets/relief/salines-1802-detail.webp', ratio: '13 / 15', text: 'Les salines sur le plan de l’an XI', note: 'BnF',
    at: SALINES, lift: .02, nudge: [-11, 4], film: true
  },
  analyses: {
    figures: [['1947', '≈ 200'], ['1948', '42'], ['1949', '4']], text: 'Analyses de sang positives, secteur de Porto-Vecchio (rapport de 1950)',
    at: [9.2885, 41.5815], lift: .06
  },
  habitants: {
    figures: [['1946', '3 339'], ['1975', '7 510'], ['2023', '11 198']], text: 'Habitants de la commune',
    at: HEART, lift: .16, film: true
  }
};
