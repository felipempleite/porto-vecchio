/* The score of the letter. Each step of the page names one entry here; scrolling
   interpolates between neighbours. Text lives in index.html, nothing here is prose. */
import {Color} from 'three';
import {HEART, STREET_ABBATUCCI, STREET_HOME} from './geo.js';

const c = hex => new Color(hex);

/* One day, from dawn to night. sunAz is a compass bearing, sunEl degrees above the horizon. */
export const LOOKS = {
  aube: {
    sunAz: 84, sunEl: 7, sun: c('#ffb07c'), sunPower: 3.1, above: c('#9db2d8'), below: c('#6b5a4c'), fill: 1.05,
    top: c('#4d6c9c'), haze: c('#f0c3a0'), hazeNear: 3, hazeFar: 46, exposure: .92, night: 0, glow: 1
  },
  matin: {
    sunAz: 112, sunEl: 26, sun: c('#ffe3bf'), sunPower: 3.3, above: c('#c8dbf2'), below: c('#8a7d6c'), fill: 1.25,
    top: c('#5f95cf'), haze: c('#dbe6ea'), hazeNear: 6, hazeFar: 70, exposure: .9, night: 0, glow: .8
  },
  midi: {
    sunAz: 165, sunEl: 58, sun: c('#fff3df'), sunPower: 3.4, above: c('#d5e6f8'), below: c('#93897a'), fill: 1.3,
    top: c('#4486cf'), haze: c('#cfe1ec'), hazeNear: 8, hazeFar: 85, exposure: .86, night: 0, glow: .6
  },
  apresmidi: {
    sunAz: 232, sunEl: 40, sun: c('#ffe9c6'), sunPower: 3.3, above: c('#cfe0f4'), below: c('#8d8170'), fill: 1.25,
    top: c('#4f8ccd'), haze: c('#d6e2e6'), hazeNear: 7, hazeFar: 78, exposure: .88, night: 0, glow: .7
  },
  dore: {
    sunAz: 262, sunEl: 19, sun: c('#ffd2a0'), sunPower: 3.5, above: c('#c3cfe6'), below: c('#8a7663'), fill: 1.3,
    top: c('#5a80b8'), haze: c('#f0d3b0'), hazeNear: 5, hazeFar: 64, exposure: 1.02, night: 0, glow: 1
  },
  crepuscule: {
    sunAz: 287, sunEl: 3, sun: c('#ff8552'), sunPower: 1.5, above: c('#7786bd'), below: c('#4a3d47'), fill: .95,
    top: c('#253763'), haze: c('#d98a6c'), hazeNear: 3, hazeFar: 44, exposure: .95, night: .45, glow: 1
  },
  nuit: {
    sunAz: 205, sunEl: 62, sun: c('#9db4e6'), sunPower: .34, above: c('#46578f'), below: c('#1a1f30'), fill: .8,
    top: c('#050814'), haze: c('#141d36'), hazeNear: 3, hazeFar: 50, exposure: 1, night: 1, glow: 0
  }
};

const TOWN = [9.2800, 41.5910];
const MARINE = [9.2863, 41.5901];
const SALINES = [9.2862, 41.5850];
const JUNCTION = STREET_HOME[STREET_HOME.length - 1];

/* cam: at = [lon, lat], lift = kilometres above the ground there, az = bearing of the camera
   seen from that point, el = degrees above the horizon, dist = kilometres. */
export const SCENES = [
  {id: 'aube', cam: {at: [9.2805, 41.59115], lift: 0, az: 146.5, el: 1.5, dist: 1.2}, look: 'aube', era: 0, rise: 1, core: 1, plate: 'img/saline-reflet', still: 'img/saline-reflet'},
  {id: 'maquette', cam: {at: [9.2805, 41.59115], lift: 0, az: 146.5, el: 4, dist: 1.3}, look: 'aube', era: 0, rise: 1, core: 1, still: 'relief/depuis-les-salines', labels: ['ville']},
  {id: 'rocher', cam: {at: [9.298, 41.597], lift: 0, az: 104, el: 21, dist: 11.5}, look: 'matin', era: 0, still: 'relief/ospedale-golfe', labels: ['ville', 'mare', 'machja']},
  {id: 'port-vieux', cam: {at: [9.2835, 41.5915], lift: .02, az: 62, el: 19, dist: 3.4}, look: 'matin', era: 0, still: 'relief/ville-rocher', labels: ['ville']},
  {id: 'citadelle', core: 1, cam: {at: HEART, lift: .03, az: 118, el: 33, dist: 1.25}, look: 'matin', era: 0, still: 'relief/ville-rocher'},
  {id: 'ventimiglia', core: .3, cam: {at: HEART, lift: .03, az: 176, el: 36, dist: 1.0}, look: 'matin', era: 0, still: 'relief/detail-bastion'},
  {id: 'ceux-d-en-haut', core: 1, cam: {at: [9.212, 41.668], lift: .4, az: 118, el: 23, dist: 25}, look: 'midi', era: 0, still: 'relief/ospedale-golfe', labels: ['ville', 'quenza', 'zonza', 'levie', 'ospedale']},
  {id: 'estive', core: 1, cam: {at: [9.268, 41.603], lift: .1, az: 311, el: 13, dist: 10.5}, look: 'midi', era: 0, still: 'relief/ospedale-golfe', labels: ['ville', 'mare']},
  {id: 'paoli', core: 1, cam: {at: [9.2875, 41.5925], lift: .03, az: 208, el: 27, dist: 3.4}, look: 'midi', era: 1, still: 'relief/golfe-terrier', labels: ['livourne', 'chiappa']},
  {id: 'abbatucci', core: 1, cam: {at: [9.255, 41.618], lift: .1, az: 124, el: 19, dist: 11}, look: 'apresmidi', era: 1, still: 'relief/golfe-terrier', labels: ['ville', 'zicavo']},
  {id: 'sel', core: 1, cam: {at: SALINES, lift: .01, az: 158, el: 31, dist: 1.7}, look: 'apresmidi', era: 1, still: 'relief/ville-terrier', labels: ['saline', 'ville']},
  {id: 'sauniers', core: 1, cam: {at: SALINES, lift: .01, az: 128, el: 43, dist: 2.3}, look: 'apresmidi', era: 1, still: 'relief/salines-1802-detail', labels: ['saline']},
  {id: 'liege', core: 1, cam: {at: MARINE, lift: .01, az: 72, el: 33, dist: 1.6}, look: 'apresmidi', era: 2, still: 'relief/port-1951', labels: ['marina']},
  {id: 'ecorce', core: 1, cam: {at: MARINE, lift: .01, az: 96, el: 30, dist: 1.8}, look: 'apresmidi', era: 2, plate: 'img/chene-liege', still: 'img/chene-liege'},
  {id: 'fievre', core: 1, cam: {at: MARINE, lift: .01, az: 152, el: 34, dist: 2.1}, look: 'apresmidi', era: 2, still: 'relief/port-1951', labels: ['marina']},
  {id: 'rivage-1975', core: 1, cam: {at: MARINE, lift: .01, az: 143, el: 37, dist: 2.05}, look: 'apresmidi', era: 3, still: 'relief/port-1975'},
  {id: 'rivage-2024', core: 1, cam: {at: MARINE, lift: .01, az: 134, el: 40, dist: 2}, look: 'dore', era: 4, still: 'relief/port-2024'},
  {id: 'ete', core: 1, cam: {at: [9.2835, 41.5905], lift: .02, az: 128, el: 27, dist: 4.4}, look: 'dore', era: 4, rise: 1, still: 'relief/golfe-bati'},
  {id: 'plages', core: 1, cam: {at: [9.2835, 41.5905], lift: .02, az: 120, el: 24, dist: 5}, look: 'dore', era: 4, rise: 1, plate: 'img/palombaggia-aerien', still: 'img/palombaggia-aerien'},
  {id: 'soir', core: 1, cam: {at: HEART, lift: .03, az: 108, el: 17, dist: 1.3}, look: 'crepuscule', era: 4, rise: 1, fire: 1, still: 'relief/ville-bati'},
  {id: 'deux-rues', core: 1, cam: {at: JUNCTION, lift: .01, az: 152, el: 50, dist: .46}, look: 'crepuscule', era: 4, rise: 1, streets: 2, lamp: 1, still: 'relief/deux-rues', labels: ['rue-home', 'rue-abbatucci']},
  {id: 'rue', core: 1, cam: {at: JUNCTION, lift: .01, az: 160, el: 42, dist: .36}, look: 'crepuscule', era: 4, rise: 1, streets: 2, lamp: 1, plate: 'img/rue-camille', still: 'img/rue-camille'},
  {id: 'envoi', core: 1, cam: {at: [9.2805, 41.59115], lift: .02, az: 146.5, el: 5, dist: 1.5}, look: 'nuit', era: 4, rise: 1, streets: 2, lamp: 1, still: 'img/voie-lactee'},
  {id: 'dedicace', core: 1, cam: {at: [9.2805, 41.59115], lift: .38, az: 150, el: 3.5, dist: 2.4}, look: 'nuit', era: 4, rise: 1, streets: 2, lamp: 1, still: 'img/voie-lactee'}
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
  'rue-home': {text: 'rue du Docteur-Camille-de-Rocca-Serra', at: STREET_HOME[1], lift: .03, kind: 'street'},
  'rue-abbatucci': {text: 'rue du Général-Abbatucci', at: STREET_ABBATUCCI[4], lift: .03, kind: 'street'}
};
