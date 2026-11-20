/* Optional WebGL view. Bundled with Three.js and meshoptimizer for static hosting. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const directory = new URL('assets/relief/', document.baseURI);
const overview = new THREE.Vector3(0, .036, 0);
const town = new THREE.Vector3(-.404, .041, .078);
const direction = new THREE.Vector3(2.6, 4, 5.3);
// Match the orthographic cameras used to render the plates (Blender Z-up to Three.js Y-up).
const frames = {
  golfe: {target:overview, direction, halfWidth:2.35},
  ville: {target:town, direction, halfWidth:.65},
  port: {target:new THREE.Vector3(.034668,.027,.064815), direction:new THREE.Vector3(1.25,1.08,2.3), halfWidth:1.075}
};

function releaseModel(model) {
  const materials = new Set();
  model.traverse(object => {
    object.geometry?.dispose();
    if (object.material) {
      for (const material of [].concat(object.material)) materials.add(material);
    }
  });
  materials.forEach(material => material.dispose());
}

export async function createViewer(host, signal, onContextLoss) {
  signal.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label','Maquette de Porto-Vecchio en trois dimensions');
  canvas.setAttribute('aria-describedby','relief-help');
  host.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x383e3a);
  scene.add(new THREE.HemisphereLight(0xfff2d9,0x90968a,1.9));
  const sun = new THREE.DirectionalLight(0xffefd6,2.1);
  sun.position.set(-4,5,2);
  scene.add(sun);
  const camera = new THREE.OrthographicCamera(-2.35,2.35,1.32,-1.32,.01,60);
  const controls = new OrbitControls(camera,canvas);
  controls.minPolarAngle = .10;
  controls.maxPolarAngle = 1.42;
  controls.minZoom = .75;
  controls.maxZoom = 12;
  controls.enablePan = true;
  controls.enableDamping = false;
  const photo = new THREE.MeshBasicMaterial({color:0xffffff});
  const textures = new Map();
  const printable = new Map();
  const shores = new Map();
  let model, terrain, reference, sides, houses, marks, observer;
  let currentFrame = 'golfe', viewToken = 0, disposed = false;

  function draw() { if (!disposed) renderer.render(scene,camera); }

  function resize() {
    const {width,height} = host.parentElement.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const {halfWidth} = frames[currentFrame];
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfWidth*height/width; camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    draw();
  }

  function frame(view) {
    currentFrame = view;
    const cameraFrame = frames[view];
    controls.target.copy(cameraFrame.target);
    camera.position.copy(cameraFrame.target).add(cameraFrame.direction);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    resize();
  }

  function key(event) {
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    switch (event.key) {
      case 'ArrowLeft': spherical.theta -= .12; break;
      case 'ArrowRight': spherical.theta += .12; break;
      case 'ArrowUp': spherical.phi = Math.max(controls.minPolarAngle,spherical.phi-.1); break;
      case 'ArrowDown': spherical.phi = Math.min(controls.maxPolarAngle,spherical.phi+.1); break;
      case '+': case '=': camera.zoom = Math.min(controls.maxZoom,camera.zoom*1.2); break;
      case '-': camera.zoom = Math.max(controls.minZoom,camera.zoom/1.2); break;
      case 'Home': event.preventDefault(); frame(currentFrame); return;
      default: return;
    }
    event.preventDefault();
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }

  async function show(period, shoreView) {
    const token = ++viewToken;
    let texture;
    if (period !== 'bati' && !shoreView) {
      let request = textures.get(period);
      if (!request) {
        request = new THREE.TextureLoader().loadAsync(new URL('carte-'+period+'.webp',directory).href)
          .then(loaded => {
            loaded.flipY = false;
            loaded.colorSpace = THREE.SRGBColorSpace;
            loaded.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());
            if (disposed) loaded.dispose();
            return loaded;
          });
        textures.set(period, request);
      }
      texture = await request;
    }
    if (disposed || token !== viewToken) return;
    terrain.visible = sides.visible = !shoreView;
    reference.visible = !shores.has(period);
    shores.forEach((object,era)=>object.visible=era===period);
    scene.background.setHex(shoreView ? 0xbcbdb6 : 0x383e3a);
    houses.visible = period === 'bati';
    marks.visible = period === 'terrier';
    if (texture) { photo.map = texture; photo.needsUpdate = true; }
    printable.forEach((original,mesh)=>mesh.material=texture ? photo : original);
    draw();
  }

  function lost(event) {event.preventDefault(); if (!disposed) onContextLoss();}

  function dispose() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    window.removeEventListener('resize',resize);
    canvas.removeEventListener('webglcontextlost',lost);
    canvas.removeEventListener('keydown',key);
    controls.dispose();
    printable.forEach((original,mesh)=>mesh.material=original);
    if (model) releaseModel(model);
    for (const request of textures.values()) request.then(t=>t.dispose(),()=>{});
    photo.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    signal.removeEventListener('abort',dispose);
  }

  signal.addEventListener('abort',dispose,{once:true});
  canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('keydown',key);
  try {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const result = await loader.loadAsync(new URL('portivechju.glb?v=rivages-1',directory).href);
    model = result.scene;
    if (disposed) { releaseModel(model); signal.throwIfAborted(); }
    terrain = model.getObjectByName('Terrain');
    reference = model.getObjectByName('RiveDeReference');
    sides = model.getObjectByName('Tranche');
    for (const era of ['1951','1975','2024']) shores.set(era,model.getObjectByName('Rivage'+era));
    const surfaces = new Set(['Patine du relief','Terre du golfe','Eau du golfe','Ouvrages du port']);
    for (const part of [terrain,reference,...shores.values()]) {
      part.traverse(mesh=>{
        if (mesh.isMesh && surfaces.has(mesh.material.name)) printable.set(mesh,mesh.material);
      });
    }
    houses = model.getObjectByName('Maisons');
    marks = model.getObjectByName('SignesDuTerrier');
    scene.add(model);
    controls.addEventListener('change',draw);
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(resize);
      observer.observe(host.parentElement);
    } else window.addEventListener('resize',resize);
    frame('golfe');
    return {frame,show,focus:()=>canvas.focus({preventScroll:true})};
  } catch (error) {
    dispose();
    throw error;
  }
}
