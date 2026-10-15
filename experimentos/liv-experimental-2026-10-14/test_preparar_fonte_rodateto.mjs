import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareFrozenCornice} from './preparar_fonte_rodateto.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),read=name=>readFileSync(new URL(name,import.meta.url));
const helperSHA256=hash(read('./interior-cornice.js'));
// Pin the pre-sealing parents. Promotion changes the live catalog, while these
// tests must keep proving an incremental revision of the same frozen inputs.
const parents={
  canto:{path:'./.liv-reproducao-canto-bake-20261013-qualified/source.json',sha256:'89f9e2707c68ac332f1133ac9cae484db681b94c336bea0177ee3d78cfb85e16'},
  meio:{path:'./.liv-reproducao-meio-bake-20261013-selado/preservado-canonico/source.json',sha256:'dd6770c311e3efadc857f7da73ea04ef434aa16ed4c8fee1972207d85f471315'},
};
for(const typology of ['canto','meio'])test(`${typology}: revisão selada preserva a fonte e muda só o rodateto ativo`,async()=>{
  const parent=parents[typology],decoded=read(parent.path);assert.equal(hash(decoded),parent.sha256,'The frozen test parent changed.');
  const source=JSON.parse(decoded),unitBytes=read(`./interiores/${typology}/unidade.json`),unit=JSON.parse(unitBytes);
  assert.equal(hash(unitBytes),source.unitSHA256,'The nominal unit must match the pinned parent.');
  const before=JSON.stringify(source),activeIndex=source.objects.findIndex(o=>o.include&&o.name==='rodateto-liso-continuo');
  const result=await prepareFrozenCornice({typology,source,unit,parentSourceSHA256:hash(decoded),helperSHA256}),data=JSON.parse(result.sourceBytes);
  assert.equal(JSON.stringify(source),before);assert.equal(data.unitSHA256,source.unitSHA256);assert.equal(data.objects.length,source.objects.length);
  assert.deepEqual(data.objects.map(o=>o.slot),source.objects.map(o=>o.slot));
  for(let i=0;i<source.objects.length;i++)if(i!==activeIndex)assert.deepEqual(data.objects[i],source.objects[i]);
  for(const table of ['geometries','materials','textures'])for(const [key,value]of Object.entries(source[table]))assert.deepEqual(data[table][key],value,`${table}/${key}`);
  const active=data.objects[activeIndex];assert.equal(active.slot,source.objects[activeIndex].slot);assert.equal(active.bake,true);assert.equal(active.visible,true);
  assert.notEqual(active.geometry,source.objects[activeIndex].geometry);assert.equal(active.furnitureId,source.objects[activeIndex].furnitureId);
  const material=data.materials[active.materials[0]];assert.equal(material.emissiveIntensity,0);assert.equal(material.roughness,.85);
  assert.equal(data.metadata.unitPath,source.metadata.unitPath);assert.equal(data.metadata.nativeFactorySHA256,source.metadata.nativeFactorySHA256);
  assert.deepEqual(data.metadata.moldingRepair,source.metadata.moldingRepair);assert.equal(data.metadata.continuousCorniceRepair.parentSourceSHA256,hash(decoded));
  assert.equal(data.metadata.continuousCorniceRepair.sources['experimentos/liv-experimental-2026-10-14/interior-cornice.js'],helperSHA256);
  assert.equal(data.metadata.continuousCorniceRepair.geometryQA.sha256,hash(result.geometryReportBytes));
  assert.equal(result.report.sourceSHA256,hash(result.sourceBytes));assert.equal(result.report.preservation.status,'PASS');
  assert.equal(result.report.preservation.geometryTablesPreserved,true);assert.equal(result.report.preservation.geometryAttributesPreserved,true);
  const qa=result.report.geometryQA;assert.ok(qa.closedEdges);assert.ok(qa.normalsFollowWinding);
  assert.ok(Math.abs(qa.bounds[1][0]-2.65)<1e-6);assert.ok(Math.abs(qa.bounds[1][1]-2.704)<1e-6);
  assert.equal(result.report.profile.height,.05);assert.equal(result.report.profile.projection,.02);
  assert.equal(result.report.profile.ceilingOverlap,.004);assert.equal(result.report.profile.wallOverlap,.003);
  if(typology==='meio')assert.deepEqual(data.metadata.nativeDependencySHA256,{...source.metadata.nativeDependencySHA256,'interior-cornice.js':helperSHA256});
});
test('hash incompatível com o helper carregado é rejeitado',async()=>{
  await assert.rejects(prepareFrozenCornice({typology:'canto',source:{schema:'liv-interior-scene-v1',unitId:'fixture'},unit:{id:'fixture'},
    parentSourceSHA256:'a'.repeat(64),helperSHA256:'0'.repeat(64)}),/fingerprint does not identify loaded code/);
});
