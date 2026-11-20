/* Shared geography. The maquette is in kilometres, x to the east, y up, z to the south,
   exactly as tools/export_relief.py writes it. */
export const WEST = 9.2685, SOUTH = 41.5774, EAST = 9.3032, NORTH = 41.604;
const MIDLAT = (NORTH + SOUTH) / 2, MIDLON = (WEST + EAST) / 2;
const XSCALE = 111.32 * Math.cos(MIDLAT * Math.PI / 180), YSCALE = 111.2;

/* Heights are doubled on the maquette, so the surrounding relief follows. */
export const EXAGGERATION = 2;

export const toX = lon => (lon - MIDLON) * XSCALE;
export const toZ = lat => -(lat - MIDLAT) * YSCALE;
export const toLon = x => x / XSCALE + MIDLON;
export const toLat = z => -z / YSCALE + MIDLAT;

/* The old town on its rock: every wipe and every ripple starts here. */
export const HEART = [9.2795, 41.5913];

/* Two streets of the old town, from assets/map/vieille-ville.svg (600 px = 0.0048 degrees). */
const fromPlan = ([x, y]) => [
  9.2765 + x / 600 * .0048,
  41.5922 - y / 600 * .0048 * Math.cos(41.591 * Math.PI / 180)
];
export const STREET_HOME = [[368.6, 119.3], [352.7, 139.2], [331.2, 166.4], [313.7, 187.6], [272.3, 237.7], [274.1, 244.5]].map(fromPlan);
export const STREET_ABBATUCCI = [[274.1, 244.5], [284.2, 261], [293.4, 278.4], [302.8, 296.3], [314.1, 316.9], [314.4, 328.4]].map(fromPlan);
