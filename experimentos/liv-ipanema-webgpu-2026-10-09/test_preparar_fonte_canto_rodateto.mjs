import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareCornerSource} from './preparar_fonte_canto_rodateto.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('a procedência rejeita um hash que não identifica o helper carregado',async()=>{
  await assert.rejects(prepareCornerSource({source:{schema:'liv-interior-scene-v1',unitId:'fixture'},unit:{id:'fixture'},
    parentSourceSHA256:'a'.repeat(64),helperSHA256:'0'.repeat(64)}),/fingerprint does not identify the loaded code/);
});
test('staging troca apenas o rodateto, conserva slots e usa os hashes reais do exporter',async()=>{
  const sourceBytes=readFileSync(new URL('./.liv-reproducao-canto-bake-20261013-qualified/preservado-canonico/source.json',import.meta.url));
  assert.equal(hash(sourceBytes),'e1db88f04d1658e296ec07e2a75f7336a0dae2b2e89480406d31f9cf4623efbd');
  const source=JSON.parse(sourceBytes),unit=JSON.parse(readFileSync(new URL('./interiores/canto/unidade.json',import.meta.url)));
  const before=JSON.stringify(source),helperHash=hash(readFileSync(new URL('./interior-cornice.js',import.meta.url)));
  const {data,sourceBytes:result,report}=await prepareCornerSource({source,unit,parentSourceSHA256:hash(sourceBytes),helperSHA256:helperHash});
  assert.equal(JSON.stringify(source),before,'The source object is an immutable input.');
  assert.equal(data.unitSHA256,source.unitSHA256);assert.equal(data.objects.length,source.objects.length);
  const current=data.objects.filter(o=>o.include&&o.name==='rodateto-liso-continuo');assert.equal(current.length,1);
  assert.equal(current[0].slot,19);assert.equal(current[0].bake,true);assert.equal(current[0].visible,true);
  assert.deepEqual(data.objects.map(o=>o.slot),source.objects.map(o=>o.slot));
  for(let i=0;i<source.objects.length;i++)if(source.objects[i].name!=='rodateto')assert.deepEqual(data.objects[i],source.objects[i]);
  for(const table of ['materials','textures'])for(const [key,value]of Object.entries(source[table]))assert.equal(JSON.stringify(data[table][key]),JSON.stringify(value),`${table}/${key}`);
  for(const [key,value]of Object.entries(source.geometries)){
    const {sha256:previous,...attributes}=value,{sha256:current,...after}=data.geometries[key];assert.deepEqual(after,attributes);
    assert.equal(current,await globalThis.hashGeometriaInteriorLiv(data.geometries[key]));
    if(previous!==current)assert.ok(report.preservation.geometryFingerprintMetadataRefreshed.some(item=>item.key===key));
  }
  assert.deepEqual(data.metadata.moldingRepair,source.metadata.moldingRepair);
  assert.equal(data.metadata.continuousCorniceRepair.parentSourceSHA256,hash(sourceBytes));
  assert.equal(data.metadata.continuousCorniceRepair.sources['experimentos/liv-ipanema-webgpu-2026-10-09/interior-cornice.js'],helperHash);
  assert.equal(report.sourceSHA256,hash(result));assert.equal(report.preservation.status,'PASS');
  assert.equal(report.preservation.nonCorniceObjects,62);assert.equal(report.preservation.geometryAttributesPreserved,true);
  const geometry=data.geometries[current[0].geometry];assert.equal(geometry.sha256,await globalThis.hashGeometriaInteriorLiv(geometry));
  const material=data.materials[current[0].materials[0]];assert.equal(material.roughness,.85);assert.equal(material.emissiveIntensity,0);
  assert.ok(report.geometryQA.closedEdges);assert.equal(report.geometryQA.triangles,240);
});
