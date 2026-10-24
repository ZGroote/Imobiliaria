import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import dados from './dados/maquete.js';

// Exercita a ponte real, sem GPU: câmera deve chegar antes de ready e erro deve devolver a malha.
// os imports do módulo viram nomes no sandbox, como no test_viewer_flow
const source = (await fs.readFile(new URL('./interior-splat.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');
const frames = new Map(), handlers = {};
let serial = 0, meshFrames = 0, removed = false, cameraSent = false, active = false;
const render = async () => { meshFrames++; };
const splat = {
  ready: false, error: null, file: null, setArquivo(file) { this.file = file; },
  setCamera() { cameraSent = true; }, setActive(value) { active = value; },
  prefetch() {}, getState() { return {ready: this.ready}; }
};
const iframe = {style: {}, contentWindow: {__splatVisita: splat}, setAttribute() {}, remove() { removed = true; }};
const state = {ready: true, active: true, mode: 'visita', typology: 'meio',
  renderer: {renderAsync: render}, scene: {}, camera: {
    fov: 48, aspect: 1.7, updateProjectionMatrix() {},
    position: {x: -3, z: 1, toArray: () => [-3,1.62,1]}, quaternion: {toArray: () => [0,0,0,1]}
  }};
const context = vm.createContext({dados, URLSearchParams, location: {search: ''}, window: {__livInterior: state},
  fetch: async () => ({ok: true, json: async () => ({sala:'sala.sog'})}),
  document: {querySelector: () => ({offsetLeft:0,offsetTop:0,offsetWidth:900,offsetHeight:600,after() {}}), createElement: () => iframe},
  ResizeObserver: class { observe() {} disconnect() {} },
  addEventListener(name, fn) { handlers[name] = fn; },
  requestAnimationFrame(fn) { frames.set(++serial, fn); return serial; },
  cancelAnimationFrame(id) { frames.delete(id); }, setTimeout
});
vm.runInContext(source, context);
await new Promise(resolve => setImmediate(resolve));
function step() { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(); }
step();
assert.equal(active, true);
assert.equal(cameraSent, true, 'Loading must not block camera synchronization');
assert.equal(state.splat.ligado, false);
await state.renderer.renderAsync(); assert.equal(meshFrames, 1);
splat.ready = true; step();
assert.equal(iframe.style.visibility, 'visible');
await state.renderer.renderAsync(); assert.equal(meshFrames, 1, 'Pause mesh only while splat is ready');
splat.error = 'HTTP 404'; step();
assert.equal(iframe.style.visibility, 'hidden');
await state.renderer.renderAsync(); assert.equal(meshFrames, 2);
state.active = false; step(); assert.equal(active, false);
state.disposed = true; step();
assert.equal(state.renderer.renderAsync, render);
assert.equal(removed, true);
assert.equal(frames.size, 0, 'Dispose must stop the bridge animation loop');
console.log('PASS: camera before ready, mesh fallback, pause and cleanup');

// O arquivo global deve continuar ativo também nas passagens sem retângulo de cômodo antigo.
let requestedManifest;
splat.error = null; splat.ready = true;
const globalState = {...state, active:true, disposed:false, splat:undefined,
  camera:{...state.camera, position:{x:.5,z:0,toArray:()=>[.5,1.62,0]}}};
const globalContext = vm.createContext({...context, location:{search:'?splat-piloto=global'},
  window:{__livInterior:globalState}, fetch:async path=>{
    requestedManifest=path;
    return {ok:true,json:async()=>({apto:'apartamento-continuo.sog'})};
  }});
vm.runInContext(source,globalContext);
await new Promise(resolve=>setImmediate(resolve));
step();
assert.equal(requestedManifest,'splat/comodos-global.json');
assert.equal(globalState.splat.ligado,true,'Global splat must cover passages outside legacy zones');
assert.equal(splat.file,'apartamento-continuo.sog');
globalState.disposed=true; step();
assert.equal(frames.size,0);
console.log('PASS: global model stays active through legacy zone gaps');
