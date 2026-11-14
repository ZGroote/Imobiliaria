import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, vec4, mix, float } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import { studioPixelRatio, CONTACT } from './quality-config.mjs';
import { upgradeExterior } from './model-exterior.js';
import { upgradeInterior } from './model-interior.js';
import { architecturalSurfaces } from './materials-pbr.js';

function studioEnvironment() {
  const width = 256, height = 128, data = new Uint16Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const sky = .20 + .65 * Math.max(0, Math.cos(v * Math.PI));
    const window = 3.8 * Math.exp(-(((u - .22) / .09) ** 6) - ((v - .4) / .2) ** 6);
    const fill = 1.8 * Math.exp(-(((u - .74) / .15) ** 6) - ((v - .38) / .15) ** 6);
    for (let c = 0; c < 3; c++) data[(y * width + x) * 4 + c] = THREE.DataUtils.toHalfFloat(
      sky * [1.02, 1.04, 1.08][c] + window * [1, .95, .87][c] + fill * [.88, .94, 1][c]);
    data[(y * width + x) * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function microSurface(fabric) {
  const size = 128, bytes = new Uint8Array(size * size * 4);
  let seed = 173;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = fabric ? 128 + 24 * Math.sin(x * Math.PI / 2) * Math.cos(y * Math.PI / 2)
      + (seed / 2 ** 32 - .5) * 12 : 115 + seed / 2 ** 32 * 30;
    const offset = (y * size + x) * 4;
    bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = value; bytes[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(fabric ? 20 : 10, fabric ? 20 : 10);
  texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createQuality({ renderer, scene, stage, kind, layout }) {
  const enabledAtStart = new URLSearchParams(location.search).get('qualidade') === 'estudio';
  const original = { exposure: renderer.toneMappingExposure, toneMapping: renderer.toneMapping,
    environment: scene.environment, intensity: scene.environmentIntensity, ratio: renderer.getPixelRatio() };
  const materials = new Set(), shadowLights = [], textures = new Map();
  scene.traverse(object => {
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    if (object.isLight && object.castShadow) shadowLights.push({ light: object });
  });
  const snapshots = [...materials].map(material => ({ material, color: material.color?.clone(),
    roughness: material.roughness, metalness: material.metalness, envMapIntensity: material.envMapIntensity,
    bumpMap: material.bumpMap, bumpScale: material.bumpScale }));
  for (const material of materials) for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) {
    const texture = material[key];
    if (texture && !textures.has(texture)) textures.set(texture, texture.anisotropy);
  }
  const surfaces = architecturalSurfaces({ THREE, scene, kind });
  const models = kind === 'exterior' ? upgradeExterior({ THREE, scene }) : upgradeInterior({ THREE, scene, layout });
  const environment = studioEnvironment(), plaster = microSurface(false), fabric = microSurface(true);
  // r186 pode reenviar comandos com ShadowDepthTexture destruída se o tamanho
  // muda após compilar. As duas aparências compartilham um atlas estático.
  for (const { light } of shadowLights) {
    const size = kind === 'exterior' ? 4096 : 2048;
    light.shadow.mapSize.set(size, size); light.shadow.needsUpdate = true;
  }
  const savedRenderState = {};
  let enabled = false, disposed = false, pipeline, scenePass, contact, filtered, currentCamera, effectError = null;

  function resize() {
    if (disposed) return;
    renderer.setPixelRatio(enabled ? studioPixelRatio(stage.clientWidth, stage.clientHeight, devicePixelRatio) : original.ratio);
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
  }
  const observer = new ResizeObserver(resize); observer.observe(stage);

  function setEnabled(value) {
    if (disposed) return;
    enabled = Boolean(value);
    renderer.toneMapping = original.toneMapping;
    renderer.toneMappingExposure = original.exposure * (enabled ? 1.04 : 1);
    scene.environment = enabled ? environment : original.environment;
    scene.environmentIntensity = enabled ? (kind === 'interior' ? .65 : .8) : original.intensity;
    for (const saved of snapshots) {
      const m = saved.material;
      if (saved.color) m.color.copy(saved.color);
      for (const key of ['roughness', 'metalness', 'envMapIntensity', 'bumpMap', 'bumpScale'])
        if (saved[key] !== undefined) m[key] = saved[key];
      if (enabled && (m.isMeshStandardMaterial || m.isMeshStandardNodeMaterial)) {
        const name = m.name.toLowerCase(), id = m.userData.studioId;
        if (kind === 'exterior') {
          if (/reboco|laje|peitoril/.test(name)) { m.color.lerp(new THREE.Color('#e3e0d6'), .24); m.roughness = .82; m.bumpMap = plaster; m.bumpScale = .018; }
          if (/vidro/.test(name)) { m.roughness = .12; m.envMapIntensity = .95; }
          if (/esquadria|metal/.test(name)) { m.roughness = .32; m.metalness = Math.max(.45, m.metalness); }
          if (/folha|grama|palmeira/.test(name)) m.color.lerp(new THREE.Color('#58674b'), .12);
        } else {
          if (id === 'm0') { m.bumpMap = plaster; m.bumpScale = .009; m.roughness = .88; }
          if (/tecido|linho|algodao|tapete/i.test(name)) { m.bumpMap = fabric; m.bumpScale = .012; m.roughness = .91; }
          if (id === 'm5') { m.roughness = .09; m.envMapIntensity = .85; }
          if (m.metalness > .5) m.roughness = Math.max(.22, Math.min(.38, m.roughness));
        }
      }
      m.needsUpdate = true;
    }
    for (const [texture, anisotropy] of textures) { texture.anisotropy = enabled ? 8 : anisotropy; texture.needsUpdate = true; }
    surfaces.setEnabled(enabled); models.setEnabled(enabled);
    for (const { light } of shadowLights) light.shadow.needsUpdate = true;
    stage.style.background = enabled ? 'radial-gradient(ellipse at 50% 42%, #f5f3ee, #e4e3dc)' : '';
    resize();
  }

  function prepare(camera) {
    // Os nós de profundidade guardam uniforms da câmera recebida no construtor.
    if (pipeline && currentCamera !== camera) {
      pipeline.dispose(); scenePass.dispose(); contact.dispose(); filtered.dispose(); pipeline = null;
    }
    if (!pipeline) {
      // Sem MSAA neste alvo: GTAO r186 precisa amostrar a profundidade resolvida.
      scenePass = pass(scene, camera, { samples: 0 });
      scenePass.setMRT(mrt({ output, normal: normalView }));
      const color = scenePass.getTextureNode('output'), depth = scenePass.getTextureNode('depth');
      const normal = scenePass.getTextureNode('normal'), settings = CONTACT[kind];
      contact = ao(depth, normal, camera);
      contact.radius.value = settings.radius; contact.thickness.value = settings.thickness;
      contact.samples.value = 16; contact.resolutionScale = .75;
      filtered = denoise(contact.getTextureNode(), depth, normal, camera); filtered.radius.value = 3;
      pipeline = new THREE.RenderPipeline(renderer);
      pipeline.outputNode = vec4(color.rgb.mul(mix(float(1), filtered.r, settings.strength)), color.a);
      currentCamera = camera;
    }
  }
  function render(camera) {
    if (disposed) return;
    if (enabled && !effectError) {
      THREE.RendererUtils.saveRendererAndSceneState(renderer, scene, savedRenderState);
      const xrEnabled = renderer.xr.enabled;
      try { prepare(camera); pipeline.render(); return; }
      catch (error) {
        THREE.RendererUtils.restoreRendererAndSceneState(renderer, scene, savedRenderState);
        renderer.xr.enabled = xrEnabled;
        effectError = String(error); console.warn('Estudo: efeito de contato indisponível.', error);
      }
    }
    renderer.render(scene, camera);
  }
  // O renderer da base serializa seus quadros; manter o mesmo contrato assíncrono.
  async function renderAsync(camera) { render(camera); }
  setEnabled(enabledAtStart);
  return { setEnabled, render, renderAsync, get enabled() { return enabled; },
    getState: () => ({ enabled, pixelRatio: renderer.getPixelRatio(), contact: Boolean(pipeline) && !effectError, effectError,
      shadowSize: shadowLights.map(({ light }) => light.shadow.mapSize.x), models: models.metrics, surfaces: surfaces.metrics }),
    dispose() {
      if (disposed) return; disposed = true; observer.disconnect();
      pipeline?.dispose(); scenePass?.dispose(); contact?.dispose(); filtered?.dispose();
      models.dispose(); surfaces.dispose();
      environment.dispose(); plaster.dispose(); fabric.dispose();
    } };
}
