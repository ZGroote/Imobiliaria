import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('street labels filter, project, hide and recreate at an unchanged camera', () => {
  const ctx=vm.createContext({});
  for(const name of ['lib/three.min.js','ui/street-labels.js'])
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/'+name,import.meta.url),'utf8'),ctx);
  const children=[];
  const document={createElement:()=>({style:{},remove(){children.splice(children.indexOf(this),1);}})};
  let height=0;
  const labels=ctx.StreetLabels.create({THREE:ctx.THREE,document,overlay:{appendChild:e=>children.push(e)},terrainY:()=>height});
  const road={name:'Rua teste',pts:[[-80,0],[80,0]]};
  labels.addStreets([road,road,{name:'Curta',pts:[[0,0],[5,0]]},{pts:road.pts}]);
  assert.equal(children.length,1);assert.equal(children[0].textContent,'RUA TESTE');
  const camera=new ctx.THREE.PerspectiveCamera(50,1,1,1000);
  camera.position.set(0,160,180);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const frame={camera,W:800,H:800,reliefAmount:1,interior:false,showLab:true};
  labels.update(frame);assert.equal(children[0].style.display,'block');
  const before=children[0].style.transform;
  height=15;labels.recalcDyRotulos();labels.sujaRotulos();labels.update(frame);
  assert.notEqual(children[0].style.transform,before);
  labels.update({...frame,interior:true});assert.equal(children[0].style.display,'none');
  labels.update(frame);assert.equal(children[0].style.display,'block');
  labels.clear();assert.equal(children.length,0);
  labels.addStreets([road]);labels.update(frame);assert.equal(children[0].style.display,'block');
  labels.hide();assert.equal(children[0].style.display,'none');
});
