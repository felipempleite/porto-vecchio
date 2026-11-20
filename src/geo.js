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

/* The salt pans as the 2024 aerial photograph shows them: the corners of the field, from the
   north and clockwise. The basins inside are drawn as a plain grid, not surveyed one by one. */
export const SALT_FIELD = [[9.28825, 41.58588], [9.29, 41.5854], [9.2896, 41.58329], [9.28652, 41.58406]];

/* The bell tower of Saint-Jean-Baptiste stands against the apse. BD TOPO has no volume for it:
   place and height (about 27 m) are read off the aerial photograph and the view from the salt pans. */
export const BELL_TOWER = {at: [9.279316, 41.591027], bearing: 38.9, side: 4.6, shaft: 23, spire: 4.5};
