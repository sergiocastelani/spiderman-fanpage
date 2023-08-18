//import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let camera, scene, renderer, composer, controls;
const container = document.getElementById( 'webgl' );
let repaint = false;

init();

function init() 
{
  scene = new THREE.Scene();
  scene.background = new THREE.Color("#feff00");

  // load environment map
  new RGBELoader()
    .setPath( 'textures/' )
    .load( 'aristea_wreck_puresky_1k.hdr', function ( texture ) {

      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      const bgLoader = new THREE.TextureLoader();
      bgLoader.load( './textures/bg.png', 	( texture ) => {
        // in this example we create the material when the texture is loaded
        scene.background = texture;
      },
     );

      repaint = true;

      // load model
      const loader = new GLTFLoader().setPath( 'spiderman/' );
      loader.load( 'scene.gltf', function ( gltf ) {
        scene.add( gltf.scene );
        repaint = true;
        loadPage('page1.html');
      } );

    } );

  const containerStyle = getComputedStyle(container);
  const containerWidth = parseInt(containerStyle.width);
  const containerHeight = parseInt(containerStyle.height);

  renderer = new THREE.WebGLRenderer( 
    { 
      powerPreference: "high-performance",
      antialias: false,
      stencil: false,
      depth: false,
      outputColorSpace: THREE.SRGBColorSpace 
    } 
  );
  renderer.setPixelRatio( containerWidth / containerHeight );
  renderer.setSize( containerWidth, containerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild( renderer.domElement );

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 50 );
  camera.position.set( -24.05950171921488, 17.219333964816713, 61.96715866033636 );
  controls = new OrbitControls( camera, document.querySelector('#page-container') );
  controls.minDistance = 2;
  controls.maxDistance = 500;
  controls.target.set( 6.98, 38.82, 9.01 );
  controls.update();
  controls.enabled = false;
  controls.addEventListener('change', () => {
//    console.debug(camera.position, controls.target);
    repaint = true;
  });

  //postprocessing
  composer = new POSTPROCESSING.EffectComposer(renderer);
  composer.addPass(new POSTPROCESSING.RenderPass(scene, camera));
  prepareDoF();

  window.addEventListener( 'resize', onWindowResize );

  setupGUI();
}

function onWindowResize() 
{
  const containerStyle = getComputedStyle(container);
  const containerWidth = parseInt(containerStyle.width);
  const containerHeight = parseInt(containerStyle.height);

  camera.aspect = containerWidth / containerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( containerWidth, containerHeight );
  repaint = true;
}

//
function setupGUI(){
  // const gui = new dat.GUI();
  // gui.add(composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focusDistance, 'value', 0.01, 0.6).name('Focus').step(0.01).onChange(value => repaint=true);
  // gui.add(composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focalLength, 'value', 0.1, 0.3).name('Focal').step(0.01).onChange(value => repaint=true);
}

function prepareDoF()
{
  const depthOfFieldEffect = new POSTPROCESSING.DepthOfFieldEffect(camera, {
    focusDistance: 0.1,
    focalLength: 0.1,
    bokehScale: 5.0,
    height: 1024
  });
  composer.depthOfFieldEffect = depthOfFieldEffect;

  const cocTextureEffect = new POSTPROCESSING.TextureEffect({
    blendFunction: POSTPROCESSING.BlendFunction.SKIP,
    texture: depthOfFieldEffect.renderTargetCoC.texture
  });

  const effectPass = new POSTPROCESSING.EffectPass(
    camera,
    depthOfFieldEffect,
    cocTextureEffect,
  );

  const saturationEffect = new POSTPROCESSING.HueSaturationEffect({saturation: 0.7});
  const saturationPass = new POSTPROCESSING.EffectPass(camera, saturationEffect); 

  composer.addPass(saturationPass)
  composer.addPass(effectPass);
}

//
function render() 
{
  repaint = false;
  composer.render();
}

function animate() 
{
  requestAnimationFrame( animate );
  TWEEN.update();
  controls.update();

  if (repaint)
    render();
}
requestAnimationFrame( animate );

//camera angles
window.cameraFly = function(config = {position: {x:0,y:0,z:0}, target: {x:0,y:0,z:0}, focusDistance: 0.1, focalLength: 0.1, time: 2000, easing: TWEEN.Easing.Quartic.Out}) 
{
  new TWEEN.Tween(camera.position)
    .to(config.position, config.time)
    .easing(config.easing)
    .start()
    .onUpdate(() => repaint = true);

  new TWEEN.Tween(controls.target)
    .to(config.target, config.time)
    .easing(config.easing)
    .start();

  new TWEEN.Tween({v: composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focusDistance.value})
    .to({v: config.focusDistance}, config.time)
    .easing(config.easing)
    .start()
    .onUpdate((obj) => composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focusDistance.value = obj.v);

  new TWEEN.Tween({v: composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focalLength.value})
    .to({v: config.focalLength}, config.time)
    .easing(config.easing)
    .start()
    .onUpdate((obj) => composer.depthOfFieldEffect.circleOfConfusionMaterial.uniforms.focalLength.value = obj.v);
}

//helper functions
window.loadPage = async (pageUrl) =>
{
  const currentLoadId = performance.now();
  window._currentLoadId = currentLoadId;

  const pageContainer = document.querySelector('#page-container');
  pageContainer.classList.add('hide');

  const hidePromise = new Promise(resolve => setTimeout(resolve, 500));
  hidePromise.then(() => pageContainer.classList.remove('hide'));

  axios.get(pageUrl)
    .then(async (response) => {
      if (window._currentLoadId !== currentLoadId)
        return;

      await hidePromise;
      pageContainer.innerHTML = response.data;
      setTimeout(() => {
        document.querySelector('#this-page-content').classList.remove('hide');
      }, 100);
    });
}

window.toggle3DControls = () => {
  controls.enabled = !controls.enabled;
  document.getElementById('rotate-button').style.backgroundColor = controls.enabled ? '#7ed767' : 'white';
};

