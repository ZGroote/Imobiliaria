// Incremental frozen-source revision: regenerate only the active cornice with
// the runtime helper, preserve the existing room/furniture scene byte-values.
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
const encoded=value=>{
  // Older approved snapshots retain IEEE negative zero. Keep its JSON literal
  // rather than silently changing existing Float32 buffers or fingerprints.
  const marker='\u0000liv-preserved-negative-zero';
  const normal=JSON.stringify(value);assert.ok(!normal.includes(JSON.stringify(marker)),'Reserved serializer marker in source.');
  return Buffer.from(JSON.stringify(value,(_,item)=>Object.is(item,-0)?marker:item).replaceAll(JSON.stringify(marker),'-0.0'),'utf8');
};
function rawGeometryHash(geometry){
  // Match preparar_luz.py exactly for existing source arrays, including -0.
  const arrays=['position','normal','uv','color'].map(key=>new Float32Array(geometry[key]||[])),indices=new Uint32Array(geometry.index||[]);
  const parts=[new Uint32Array([...arrays.map(a=>a.length),indices.length]),...arrays,indices];
  return hash(Buffer.concat(parts.map(part=>Buffer.from(part.buffer,part.byteOffset,part.byteLength))));
}
const dependencyNames=['preparar_fonte_rodateto.mjs','interiores/shared/runtime.js','exporter-native.js','interior-navigation.js','interior-cornice.js'];
let loaded;
async function loadDependencies(){
  if(!loaded){
    const bytes=Object.fromEntries(dependencyNames.map(name=>[name,fs.readFileSync(path.join(EXP,name))]));
    const [, , {createLayout},{installCornice}]=await Promise.all([import('./interiores/shared/runtime.js'),
      import('./exporter-native.js'),import('./interior-navigation.js'),import('./interior-cornice.js')]);
    loaded={bytes,createLayout,installCornice};
  }
  for(const [name,bytes]of Object.entries(loaded.bytes))assert.ok(fs.readFileSync(path.join(EXP,name)).equals(bytes),'Dependency changed after loading: '+name);
  return loaded;
}
function geometryQA(geometry){
  const p=geometry.position,n=geometry.normal,edges=new Map();let volume=0;
  for(let i=0;i<p.length;i+=9){
    const [a,b,c]=[0,3,6].map(offset=>new THREE.Vector3(...p.slice(i+offset,i+offset+3)));
    const cross=b.clone().sub(a).cross(c.clone().sub(a));assert.ok(cross.length()>1e-8,'Degenerate cornice triangle.');
    assert.ok(cross.clone().normalize().dot(new THREE.Vector3(...n.slice(i,i+3)))>.99999,'Cornice winding opposes its normal.');
    volume+=a.dot(b.clone().cross(c))/6;
    const points=[a,b,c].map(point=>point.toArray().map(value=>value.toFixed(6)).join(','));
    for(let j=0;j<3;j++){const key=[points[j],points[(j+1)%3]].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(count=>count===2),'Cornice surface is not closed.');assert.ok(volume>0);
  return {triangles:p.length/9,closedEdges:true,edges:edges.size,normalsFollowWinding:true,volumeM3:volume,
    bounds:[0,1,2].map(axis=>{const values=p.filter((_,i)=>i%3===axis);return [Math.min(...values),Math.max(...values)];})};
}
function preservation(source,data,activeIndex){
  const unchanged=source.objects.filter((_,i)=>i!==activeIndex),after=data.objects.filter((_,i)=>i!==activeIndex);
  assert.ok(encoded(unchanged).equals(encoded(after)),'An object outside the cornice changed.');
  for(const table of ['geometries','materials','textures'])for(const [key,value]of Object.entries(source[table])){
    assert.ok(encoded(value).equals(encoded(data[table][key])),`${table}/${key} changed.`);
    if(table==='geometries')for(const name of ['position','normal','uv','color','index']){
      const Type=name==='index'?Uint32Array:Float32Array;
      assert.ok(Buffer.from(new Type(value[name]||[]).buffer).equals(Buffer.from(new Type(data[table][key][name]||[]).buffer)),`Geometry buffer changed: ${key}/${name}`);
    }
  }
  for(const key of ['unitId','unitSHA256','height','rooms','lighting'])assert.deepEqual(data[key],source[key]);
  assert.deepEqual(data.objects.map(o=>o.slot),source.objects.map(o=>o.slot));
  const before=source.objects[activeIndex],current=data.objects[activeIndex];
  for(const [key,value]of Object.entries(before))if(!['name','geometry','materials','matrix','bake','include','visible'].includes(key))assert.deepEqual(current[key],value,'Cornice ownership changed: '+key);
  assert.equal(data.metadata.unitPath,source.metadata.unitPath);assert.equal(data.metadata.nativeFactorySHA256,source.metadata.nativeFactorySHA256);
  return {status:'PASS',nonCorniceObjects:unchanged.length,nonCorniceObjectSHA256:hash(encoded(unchanged)),
    objectsAndSlotsPreserved:true,geometryAttributesPreserved:true,geometryTablesPreserved:true,materialTablesPreserved:true,
    texturesPreserved:true,unitAndRoomMetadataPreserved:true,nativeFactoryPreserved:true,frozenOwnershipPreserved:true,
    parentGeometryTableSHA256:hash(encoded(source.geometries)),parentMaterialTableSHA256:hash(encoded(source.materials)),textureTableSHA256:hash(encoded(source.textures))};
}

export async function prepareFrozenCornice({typology,source,unit,parentSourceSHA256,helperSHA256}){
  assert.ok(['canto','meio'].includes(typology));assert.equal(source.schema,'liv-interior-scene-v1');assert.equal(source.unitId,unit.id);
  assert.match(parentSourceSHA256,/^[a-f0-9]{64}$/);assert.match(helperSHA256,/^[a-f0-9]{64}$/);
  const dependencies=await loadDependencies();assert.equal(helperSHA256,hash(dependencies.bytes['interior-cornice.js']),'Helper fingerprint does not identify loaded code.');
  const activeIndexes=source.objects.flatMap((object,index)=>object.include&&object.name===NAME?[index]:[]);assert.equal(activeIndexes.length,1,'One active frozen cornice is required.');
  const activeIndex=activeIndexes[0],previousObject=source.objects[activeIndex];
  for(const [key,geometry]of Object.entries(source.geometries))assert.equal(rawGeometryHash(geometry),geometry.sha256,'Parent geometry fingerprint changed: '+key);
  const previousLocation=globalThis.location;let layout;
  try{globalThis.location??={search:''};layout=dependencies.createLayout(unit);}finally{if(previousLocation===undefined)delete globalThis.location;}
  const scene=new THREE.Scene(),owned=[];
  try{
    const cornice=dependencies.installCornice({scene,layout,own:value=>{owned.push(value);return value;}});
    const snippet=await globalThis.exportarCenaInteriorLiv({THREE,root:scene,unitId:source.unitId,unitHash:source.unitSHA256,height:source.height,mode:'visita'});
    assert.equal(snippet.objects.length,1);assert.equal(Object.keys(snippet.textures).length,0);
    const object=snippet.objects[0],geometry=snippet.geometries[object.geometry],material=snippet.materials[object.materials[0]];
    for(const key of ['position','normal','uv','color'])geometry[key]=geometry[key].map(value=>value===0?0:value);
    geometry.sha256=await globalThis.hashGeometriaInteriorLiv(geometry);
    const qa=geometryQA(geometry),data=structuredClone(source),geometryKey=NAME+':'+geometry.sha256.slice(0,16);
    assert.ok(!Object.hasOwn(data.geometries,geometryKey),'The source already contains this geometry revision.');
    let materialKey=Object.keys(data.materials).find(key=>encoded(data.materials[key]).equals(encoded(material)));
    if(!materialKey){let next=0;while(Object.hasOwn(data.materials,'m'+next))next++;materialKey='m'+next;data.materials[materialKey]=material;}
    data.geometries[geometryKey]=geometry;
    Object.assign(data.objects[activeIndex],{name:NAME,geometry:geometryKey,materials:[materialKey],matrix:object.matrix,bake:true,include:true,visible:true});
    const preserved=preservation(source,data,activeIndex);
    const preparationSources=Object.fromEntries(Object.entries(dependencies.bytes).filter(([name])=>name!=='interior-cornice.js')
      .map(([name,bytes])=>[path.relative(REPO,path.join(EXP,name)).replaceAll('\\','/'),hash(bytes)]));
    const report={schema:`liv-${typology}-continuous-cornice-qa-v1`,status:'PASS',typology,parentSourceSHA256,
      unitSHA256:source.unitSHA256,helperSHA256,geometrySHA256:geometry.sha256,activeSlot:previousObject.slot,activeMeshes:1,
      profile:cornice.metrics,geometryQA:qa,preservation:preserved};
    const geometryReportBytes=Buffer.concat([encoded(report),Buffer.from('\n')]);
    data.metadata.continuousCorniceRepair={parentSourceSHA256,unitSHA256:source.unitSHA256,sourceSlot:previousObject.slot,
      originalSlots:[previousObject.slot],sources:{[HELPER]:helperSHA256},preparationSources,geometrySHA256:geometry.sha256,
      geometryQA:{path:'rodateto-geometria.json',sha256:hash(geometryReportBytes)},profile:cornice.metrics,rawUnitPreserved:true,
      previousRevision:source.metadata.continuousCorniceRepair||null,
      scope:'Incremental frozen-source cornice revision; preserve all existing room, furniture, material and texture data.'};
    if(typology==='meio')data.metadata.nativeDependencySHA256={...(source.metadata.nativeDependencySHA256||{}),'interior-cornice.js':helperSHA256};
    data.metadata.bakeObjects=data.objects.filter(o=>o.bake).length;
    const sourceBytes=Buffer.concat([encoded(data),Buffer.from('\n')]);
    // Confirm that JSON round-trip also preserves every parent table/value.
    preservation(source,JSON.parse(sourceBytes),activeIndex);
    for(const [key,g]of Object.entries(JSON.parse(sourceBytes).geometries))assert.equal(rawGeometryHash(g),g.sha256,'Serialized geometry fingerprint changed: '+key);
    await loadDependencies();
    return {data,sourceBytes,geometryReportBytes,report:{...report,sourceSHA256:hash(sourceBytes),sourceBytes:sourceBytes.length,
      materialKey,geometryKey,sourceSlot:previousObject.slot,preparationSources,canonicalFilesModified:false,gpuExecuted:false,bakeApprovalRequired:true}};
  }finally{for(const resource of owned)resource.dispose();}
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
  if(fs.existsSync(file)){assert.ok(fs.readFileSync(file).equals(bytes),'Staging contains another revision: '+file);return;}
  const temporary=file+'.tmp';fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);
}
async function main(){
  const args=process.argv.slice(2);assert.ok(args.length===2||args.length===4,'Usage: node preparar_fonte_rodateto.mjs --tipologia canto|meio [--out STAGING]');
  assert.equal(args[0],'--tipologia');const typology=args[1];assert.ok(['canto','meio'].includes(typology));if(args.length===4)assert.equal(args[2],'--out');
  const destination=path.resolve(args[3]||path.join(EXP,`.liv-reproducao-${typology}-bake-20261013-selado`));
  assert.equal(path.dirname(destination),EXP);assert.ok(path.basename(destination).startsWith(`.liv-reproducao-${typology}-bake-`));
  if(fs.existsSync(destination))assert.ok(!fs.lstatSync(destination).isSymbolicLink());
  const catalogFile=path.join(EXP,'interiores/catalogo.json'),catalogBytes=fs.readFileSync(catalogFile),catalog=JSON.parse(catalogBytes),record=catalog.tipologias[typology];
  assert.equal(record.geometryKind,'frozen-source');const snapshot=pinnedFile(record.files.source),unitFile=pinnedFile(record.files.unit),runtime=pinnedFile(catalog.shared.runtime);
  assert.equal(hash(snapshot.decoded),record.sourceSHA256);assert.equal(hash(unitFile.decoded),record.unitSHA256);
  const dependencies=await loadDependencies();assert.ok(runtime.bytes.equals(dependencies.bytes['interiores/shared/runtime.js']));
  const source=JSON.parse(snapshot.decoded),unit=JSON.parse(unitFile.decoded);assert.equal(source.unitSHA256,record.unitSHA256);
  const prepared=await prepareFrozenCornice({typology,source,unit,parentSourceSHA256:record.sourceSHA256,helperSHA256:hash(dependencies.bytes['interior-cornice.js'])});
  for(const [file,bytes]of [[catalogFile,catalogBytes],[snapshot.file,snapshot.bytes],[unitFile.file,unitFile.bytes],[runtime.file,runtime.bytes]])assert.ok(fs.readFileSync(file).equals(bytes),'Input changed: '+file);
  fs.mkdirSync(destination,{recursive:true});writeOnce(path.join(destination,'rodateto-geometria.json'),prepared.geometryReportBytes);
  writeOnce(path.join(destination,'source.json'),prepared.sourceBytes);writeOnce(path.join(destination,`preservacao-${typology}.json`),Buffer.concat([encoded(prepared.report),Buffer.from('\n')]));
  console.log(JSON.stringify({directory:destination,...prepared.report}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
