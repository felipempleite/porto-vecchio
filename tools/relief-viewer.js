/* Optional WebGL view. Bundled with Three.js and meshoptimizer for static hosting. */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const directory = new URL('assets/relief/', document.baseURI);
const overview = new THREE.Vector3(0, .036, 0);
const town = new THREE.Vector3(-.404, .041, .078);
const direction = new THREE.Vector3(2.6, 4, 5.3);

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
  let model, ground, originalMaterial, houses, marks, observer;
  let closeView = false, viewToken = 0, disposed = false;

  function draw() { if (!disposed) renderer.render(scene,camera); }

  function resize() {
    const {width,height} = host.parentElement.getBoundingClientRect();
    if (!width || !height || disposed) return;
    const halfWidth = closeView ? .65 : 2.35;
    camera.left = -halfWidth; camera.right = halfWidth;
    camera.top = halfWidth*height/width; camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
    draw();
  }

  function frame(detail) {
    closeView = detail;
    controls.target.copy(detail ? town : overview);
    camera.position.copy(controls.target).add(direction);
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
      case 'Home': event.preventDefault(); frame(closeView); return;
      default: return;
    }
    event.preventDefault();
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }

  async function show(period) {
    const token = ++viewToken;
    let texture;
    if (period !== 'bati') {
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
    houses.visible = period === 'bati';
    marks.visible = period === 'terrier';
    if (texture) { photo.map = texture; photo.needsUpdate = true; }
    ground.material = texture ? photo : originalMaterial;
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
    if (ground) ground.material = originalMaterial;
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
    const result = await loader.loadAsync(new URL('portivechju.glb',directory).href);
    model = result.scene;
    if (disposed) { releaseModel(model); signal.throwIfAborted(); }
    const terrain = model.getObjectByName('Terrain');
    terrain.traverse(child=>{if(child.isMesh) ground=child;});
    originalMaterial = ground.material;
    houses = model.getObjectByName('Maisons');
    marks = model.getObjectByName('SignesDuTerrier');
    scene.add(model);
    controls.addEventListener('change',draw);
    if ('ResizeObserver' in window) {
      observer = new ResizeObserver(resize);
      observer.observe(host.parentElement);
    } else window.addEventListener('resize',resize);
    frame(false);
    return {frame,show,focus:()=>canvas.focus({preventScroll:true})};
  } catch (error) {
    dispose();
    throw error;
  }
}
