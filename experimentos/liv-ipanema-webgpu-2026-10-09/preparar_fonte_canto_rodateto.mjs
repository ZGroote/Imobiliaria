// Stage the same runtime cornice on the pinned frozen Canto source. No GPU,
// Blender, texture re-encoding or modification of canonical source files.
import * as THREE from 'three/webgpu';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const EXP=import.meta.dirname,REPO=path.resolve(EXP,'../..'),NAME='rodateto-liso-continuo';
const HELPER='experimentos/liv-ipanema-webgpu-2026-10-09/interior-cornice.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encoded=value=>Buffer.from(JSON.stringify(value),'utf8');
// Capture before loading project code: another worker cannot make a loaded
// older implementation appear to have the fingerprint of its newer file.
const loadedDependencyBytes=Object.fromEntries(['preparar_fonte_canto_rodateto.mjs','interiores/shared/runtime.js',
  'exporter-native.js','interior-navigation.js','interior-cornice.js'].map(name=>[name,fs.readFileSync(path.join(EXP,name))]));
const [, , {createLayout},{installCornice}]=await Promise.all([import('./interiores/shared/runtime.js'),
  import('./exporter-native.js'),import('./interior-navigation.js'),import('./interior-cornice.js')]);
for(const [name,bytes]of Object.entries(loadedDependencyBytes))assert.ok(fs.readFileSync(path.join(EXP,name)).equals(bytes),'Dependency changed while loading: '+name);

function geometryQA(geometry){
  const positions=geometry.position,normals=geometry.normal,edges=new Map();let volume=0;
  for(let i=0;i<positions.length;i+=9){
    const [a,b,c]=[0,3,6].map(offset=>new THREE.Vector3(...positions.slice(i+offset,i+offset+3)));
    const cross=b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(cross.length()>1e-8,'Degenerate cornice triangle.');
    assert.ok(cross.clone().normalize().dot(new THREE.Vector3(...normals.slice(i,i+3)))>.99999,'Cornice face normal opposes its winding.');
    volume+=a.dot(b.clone().cross(c))/6;
    const points=[a,b,c].map(p=>p.toArray().map(value=>value.toFixed(6)).join(','));
    for(let j=0;j<3;j++){
      const key=[points[j],points[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(count=>count===2),'The cornice must be a closed surface.');
  assert.ok(volume>0,'The cornice must have positive volume.');
  return {triangles:positions.length/9,closedEdges:true,edges:edges.size,normalsFollowWinding:true,volumeM3:volume};
}
function preserved(source,data,legacyIndexes,fingerprintRefresh){
  const original=source.objects.filter((_,index)=>!legacyIndexes.includes(index));
  const current=data.objects.filter((_,index)=>!legacyIndexes.includes(index));
  assert.ok(encoded(original).equals(encoded(current)),'Non-cornice objects changed.');
  for(const table of ['materials','textures'])for(const [key,value]of Object.entries(source[table])){
    assert.ok(encoded(value).equals(encoded(data[table][key])),`${table}/${key} changed.`);
  }
  for(const [key,value]of Object.entries(source.geometries)){
    const {sha256:previous,...attributes}=value,{sha256:current,...after}=data.geometries[key];
    assert.ok(encoded(attributes).equals(encoded(after)),`Geometry attributes changed: ${key}`);
    for(const name of ['position','normal','uv','color','index']){
      const Type=name==='index'?Uint32Array:Float32Array;
      assert.ok(Buffer.from(new Type(value[name]||[]).buffer).equals(Buffer.from(new Type(data.geometries[key][name]||[]).buffer)),`Geometry buffer changed: ${key}/${name}`);
    }
    if(previous!==current)assert.ok(fingerprintRefresh.some(item=>item.key===key&&item.previousSHA256===previous&&item.actualSHA256===current));
  }
  for(const key of ['unitId','unitSHA256','height','rooms','lighting'])assert.deepEqual(data[key],source[key],key);
  assert.deepEqual(data.objects.map(o=>o.slot),source.objects.map(o=>o.slot),'Slots or object order changed.');
  return {status:'PASS',nonCorniceObjects:original.length,nonCorniceObjectSHA256:hash(encoded(original)),
    objectsAndSlotsPreserved:true,geometryAttributesPreserved:true,geometryTablesPreserved:fingerprintRefresh.length===0,
    geometryFingerprintMetadataRefreshed:fingerprintRefresh,materialTablesPreserved:true,texturesPreserved:true,
    parentGeometryTableSHA256:hash(encoded(source.geometries)),parentMaterialTableSHA256:hash(encoded(source.materials)),
    textureTableSHA256:hash(encoded(source.textures)),unitAndRoomMetadataPreserved:true};
}

export async function prepareCornerSource({source,unit,parentSourceSHA256,helperSHA256,preparationSources={}}){
  assert.equal(source.schema,'liv-interior-scene-v1');assert.equal(source.unitId,unit.id);
  assert.match(parentSourceSHA256,/^[a-f0-9]{64}$/);assert.match(helperSHA256,/^[a-f0-9]{64}$/);
  assert.equal(helperSHA256,hash(loadedDependencyBytes['interior-cornice.js']),'Helper fingerprint does not identify the loaded code.');
  const legacyIndexes=source.objects.flatMap((object,index)=>object.name==='rodateto'?[index]:[]);
  assert.ok(legacyIndexes.length,'Pinned Canto source has no legacy cornice to replace.');
  const primary=legacyIndexes.find(index=>source.objects[index].include);assert.notEqual(primary,undefined);
  assert.ok(!source.objects.some(object=>object.include&&object.name===NAME),'The source already contains a continuous cornice.');
  // FloorPlan reads only this URL option when it builds its ownership grid.
  // Supply the normal furnished default while running its exact code in Node.
  const previousLocation=globalThis.location;let layout;
  try{globalThis.location??={search:''};layout=createLayout(unit);}
  finally{if(previousLocation===undefined)delete globalThis.location;}
  const scene=new THREE.Scene(),owned=[];
  try {
    const cornice=installCornice({scene,layout,own:value=>{owned.push(value);return value;}});
    // Export only the new texture-free mesh through the exact browser exporter.
    // All frozen geometry/material/PNG dictionaries are copied without rebuild.
    const snippet=await globalThis.exportarCenaInteriorLiv({THREE,root:scene,unitId:source.unitId,
      unitHash:source.unitSHA256,height:source.height,mode:'visita'});
    assert.equal(snippet.objects.length,1);assert.equal(Object.keys(snippet.textures).length,0);
    const object=snippet.objects[0],geometry=snippet.geometries[object.geometry],material=snippet.materials[object.materials[0]];
    // The legacy source was reserialized after its hashes were computed. In
    // particular JSON loses Float32's negative-zero sign. Refresh only these
    // fingerprint fields, retaining the current visible attributes verbatim.
    for(const name of ['position','normal','uv','color'])if(geometry[name])geometry[name]=geometry[name].map(value=>value===0?0:value);
    geometry.sha256=await globalThis.hashGeometriaInteriorLiv(geometry);
    const qa=geometryQA(geometry),data=structuredClone(source),geometryKey=NAME,fingerprintRefresh=[];
    for(const [key,item]of Object.entries(data.geometries)){
      const actual=await globalThis.hashGeometriaInteriorLiv(item);
      if(actual!==item.sha256){fingerprintRefresh.push({key,previousSHA256:item.sha256,actualSHA256:actual});item.sha256=actual;}
    }
    assert.ok(!Object.hasOwn(data.geometries,geometryKey),'New cornice geometry key is occupied.');
    let materialIndex=0;while(Object.hasOwn(data.materials,'m'+materialIndex))materialIndex++;
    const materialKey='m'+materialIndex;data.geometries[geometryKey]=geometry;data.materials[materialKey]=material;
    for(const index of legacyIndexes)if(index!==primary)Object.assign(data.objects[index],{include:false,bake:false,visible:false});
    Object.assign(data.objects[primary],object,{slot:source.objects[primary].slot,geometry:geometryKey,
      materials:[materialKey],include:true,bake:true,visible:true});
    data.metadata??={};
    const preservation=preserved(source,data,legacyIndexes,fingerprintRefresh);
    // This QA has no final source SHA, so its hash can be embedded without a
    // circular source/report fingerprint. Keep it beside the staged source.
    const geometryReport={schema:'liv-canto-continuous-cornice-qa-v1',status:'PASS',parentSourceSHA256,
      unitSHA256:source.unitSHA256,helperSHA256,geometrySHA256:geometry.sha256,
      activeSlot:source.objects[primary].slot,activeMeshes:1,profile:cornice.metrics,geometryQA:qa,preservation};
    const geometryReportBytes=Buffer.concat([encoded(geometryReport),Buffer.from('\n')]);
    data.metadata.continuousCorniceRepair={parentSourceSHA256,unitSHA256:source.unitSHA256,
      sourceSlot:source.objects[primary].slot,originalSlots:legacyIndexes.map(index=>source.objects[index].slot),
      sources:{[HELPER]:helperSHA256},preparationSources,geometrySHA256:geometry.sha256,
      geometryQA:{path:'rodateto-geometria.json',sha256:hash(geometryReportBytes)},profile:cornice.metrics,rawUnitPreserved:true,
      scope:'Replace only the legacy Canto cornice with the exact runtime helper geometry; preserve the frozen scene and materials.'};
    data.metadata.bakeObjects=data.objects.filter(o=>o.bake).length;
    const sourceBytes=Buffer.concat([encoded(data),Buffer.from('\n')]);
    return {data,sourceBytes,geometryReportBytes,report:{schema:'liv-canto-continuous-cornice-staging-v1',status:'PASS',parentSourceSHA256,
      sourceSHA256:hash(sourceBytes),sourceBytes:sourceBytes.length,unitSHA256:source.unitSHA256,
      geometrySHA256:geometry.sha256,materialKey,sourceSlot:source.objects[primary].slot,
      helperSHA256,preparationSources,geometryQA:qa,profile:cornice.metrics,preservation,
      canonicalFilesModified:false,gpuExecuted:false,bakeApprovalRequired:true}};
  }finally{for(const value of owned)value.dispose();}
}

function pinnedFile(record){
  assert.ok(record&&typeof record.path==='string'&&!record.path.includes('..')&&!path.isAbsolute(record.path));
  const file=path.resolve(EXP,record.path);assert.ok(file.startsWith(EXP+path.sep));
  const bytes=fs.readFileSync(file);assert.equal(bytes.length,record.bytes);assert.equal(hash(bytes),record.sha256);
  const decoded=record.compression==='gzip'?gunzipSync(bytes):bytes;
  if(record.compression){assert.equal(decoded.length,record.decodedBytes);assert.equal(hash(decoded),record.decodedSHA256);}
  return {file,bytes,decoded};
}
function writeOnce(file,bytes){
  if(fs.existsSync(file)){assert.ok(fs.readFileSync(file).equals(bytes),'Staging already contains another revision: '+file);return;}
  const temporary=file+'.tmp';fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);
}
async function main(){
  const args=process.argv.slice(2);assert.ok(args.length===0||(args.length===2&&args[0]==='--out'),'Usage: node preparar_fonte_canto_rodateto.mjs [--out STAGING]');
  const destination=path.resolve(args[1]||path.join(EXP,'.liv-reproducao-canto-bake-20261013'));
  assert.equal(path.dirname(destination),EXP,'Staging must be a direct experiment subdirectory.');
  assert.ok(path.basename(destination).startsWith('.liv-reproducao-canto-bake-'),'Staging requires the Canto bake prefix.');
  if(fs.existsSync(destination))assert.ok(!fs.lstatSync(destination).isSymbolicLink(),'Staging must not be a symlink.');
  const catalogFile=path.join(EXP,'interiores/catalogo.json'),catalogBytes=fs.readFileSync(catalogFile);
  const catalog=JSON.parse(catalogBytes),record=catalog.tipologias.canto;
  assert.equal(record.geometryKind,'frozen-source');
  const snapshot=pinnedFile(record.files.source),unitFile=pinnedFile(record.files.unit),runtime=pinnedFile(catalog.shared.runtime);
  assert.equal(hash(snapshot.decoded),record.sourceSHA256);assert.equal(hash(unitFile.decoded),record.unitSHA256);
  const source=JSON.parse(snapshot.decoded),unit=JSON.parse(unitFile.decoded);assert.equal(source.unitSHA256,record.unitSHA256);
  const dependencies=['preparar_fonte_canto_rodateto.mjs','interior-cornice.js','interior-navigation.js','exporter-native.js'];
  const dependencyBytes=Object.fromEntries(dependencies.map(name=>[name,loadedDependencyBytes[name]]));
  assert.ok(runtime.bytes.equals(loadedDependencyBytes['interiores/shared/runtime.js']),'Loaded runtime is not the pinned dependency.');
  const preparationSources=Object.fromEntries([...Object.entries(dependencyBytes).filter(([name])=>name!=='interior-cornice.js').map(([name,bytes])=>[path.relative(REPO,path.join(EXP,name)).replaceAll('\\','/'),hash(bytes)]),
    [path.relative(REPO,runtime.file).replaceAll('\\','/'),hash(runtime.bytes)]]);
  const prepared=await prepareCornerSource({source,unit,parentSourceSHA256:record.sourceSHA256,
    helperSHA256:hash(dependencyBytes['interior-cornice.js']),preparationSources});
  // Fail rather than combining source/dependencies modified by another worker.
  for(const [file,bytes]of [[catalogFile,catalogBytes],[snapshot.file,snapshot.bytes],[unitFile.file,unitFile.bytes],[runtime.file,runtime.bytes],
    ...Object.entries(dependencyBytes).map(([name,bytes])=>[path.join(EXP,name),bytes])])assert.ok(fs.readFileSync(file).equals(bytes),'Input changed during preparation: '+file);
  fs.mkdirSync(destination,{recursive:true});
  writeOnce(path.join(destination,'rodateto-geometria.json'),prepared.geometryReportBytes);
  writeOnce(path.join(destination,'source.json'),prepared.sourceBytes);
  writeOnce(path.join(destination,'preservacao-canto.json'),Buffer.concat([encoded(prepared.report),Buffer.from('\n')]));
  console.log(JSON.stringify({directory:destination,...prepared.report}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
