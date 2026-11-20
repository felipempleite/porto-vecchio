// Run after gltfpack. The viewer applies aerials on demand, so every surface must
// retain its coordinates on the original photograph even without an embedded map.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {Box3, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const file = process.argv[2] || 'assets/relief/portivechju.glb';
const bytes = await readFile(file);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const {scene} = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
scene.updateMatrixWorld(true);

const bounds = new Box3().setFromObject(scene.getObjectByName('Terrain'),true);
const extent = bounds.getSize(new Vector3());
const point = new Vector3();
const south = 41.5774, north = 41.604;
const mercator = lat => Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));
const top = mercator(north), depth = top - mercator(south);

for (const name of ['Terrain','RiveDeReference','Rivage1951','Rivage1975','Rivage2024']) {
  const part = scene.getObjectByName(name);
  assert.ok(part,'Missing surface '+name);
  let largestError = 0, count = 0;
  part.traverse(mesh => {
    if (!mesh.isMesh) return;
    const {position, uv} = mesh.geometry.attributes;
    for (let i=0; i<position.count; i++) {
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      const x = (point.x-bounds.min.x)/extent.x;
      const row = (point.z-bounds.min.z)/extent.z;
      const latitude = north-row*(north-south);
      const y = (top-mercator(latitude))/depth;
      largestError = Math.max(largestError,1536*Math.abs(uv.getX(i)-x),1575*Math.abs(uv.getY(i)-y));
    }
    count += position.count;
  });
  assert.ok(count>0 && largestError<1,`${name}: ${largestError.toFixed(2)} pixels of registration error`);
  console.log(`${name}: ${count} vertices, maximum displacement ${largestError.toFixed(2)} px`);
}

for (const view of ['golfe','ville','port']) {
  const hashes = new Set();
  for (const year of ['1951','1975','2024']) {
    const image = await readFile(join(dirname(file),view+'-'+year+'.webp'));
    hashes.add(createHash('sha256').update(image).digest('hex'));
  }
  assert.equal(hashes.size,3,'The three dated '+view+' plates must have distinct images');
}
