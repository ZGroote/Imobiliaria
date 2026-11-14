import {readFile,writeFile} from 'node:fs/promises';
import {HDRLoader} from '../experimentos/liv-experimental-2026-10-14/node_modules/three/examples/jsm/loaders/HDRLoader.js';
import {runInNewContext} from 'node:vm';
import * as THREE from '../experimentos/liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import {createDoors} from '../experimentos/liv-experimental-2026-10-14/interior-portas.js';
import {resolve,sep} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {geometryFromSpec,expandedGeometryFromSpec} from '../experimentos/liv-experimental-2026-10-14/interior-geometry.js';
const hash=data=>createHash('sha256').update(data).digest('hex');
const align=n=>(n+3)&~3;
export async function prepararInteriores(root){
 root=resolve(root);const path=name=>{const out=resolve(root,name);if(!out.startsWith(root+sep))throw Error('Recurso fora do pacote.');return out;};
 const {createLayout,createNavigation,inside,navigationKey}=await import(pathToFileURL(path('interior-navigation.js')).href);
 const runtime=await readFile(path('interiores/shared/runtime.js'),'utf8');runInNewContext(runtime,{URLSearchParams,location:{search:''},globalThis});
 const catalog=JSON.parse(await readFile(path('interiores/catalogo.json'),'utf8')),results=[];
 const load=async record=>{const packed=await readFile(path(record.path));if(packed.length!==record.bytes||hash(packed)!==record.sha256)throw Error('Recurso interior de outra revisão: '+record.path);
  const data=record.compression==='gzip'?gunzipSync(packed):packed;if(record.decodedSHA256&&hash(data)!==record.decodedSHA256)throw Error('Conteúdo interior inválido.');return JSON.parse(data);};
 for(const [typology,record]of Object.entries(catalog.tipologias)){
  if(record.geometryKind!=='frozen-source')continue;
  const [scene,compact]=await Promise.all([load(record.files.source),load(record.files.compact)]);
  if(record.files.source.decodedSHA256!==record.sourceSHA256||compact.sourceSHA256!==record.sourceSHA256)throw Error('Fonte interior sem identidade.');
  // Run the exact collision code once at build time, including the real door angle.
  const unit=await load(record.files.unit),layout=createLayout(unit),navScene=new THREE.Scene(),paint=[],alu=[],temporary=new Set();
  const own=g=>{temporary.add(g);return g;},color=new THREE.Color(unit.cores?.porta??0xEDE7DD);
  const openings=globalThis.Openings.create({THREE,ESP:.13,rgbDe:()=>[0,0,0],matEsq:new THREE.MeshStandardMaterial(),matAlum:new THREE.MeshStandardMaterial(),matVidro:new THREE.MeshStandardMaterial()});
  for(const mesh of openings.geoDasEsquadrias(layout.house))mesh.geometry.dispose();
  for(const object of scene.objects){
   if(!object.include||object.materials.length!==1||!['m3','m4'].includes(object.materials[0]))continue;
   const mesh=new THREE.Mesh(geometryFromSpec(scene.geometries[object.geometry],own));mesh.name=object.name;navScene.add(mesh);(object.materials[0]==='m3'?paint:alu).push(mesh);
  }
  const doors=createDoors({scene:navScene,layout,paint,alu,doorColor:color,own,roomAt:(x,z)=>layout.rooms.find(room=>inside(room.poly,x,z))?.name||null});
  for(const door of doors.doors)if(door.entrance)doors.setOpen(door.id,false,{instant:true});
  const navigation=createNavigation(layout),entry=navigation.entry();
  scene.preparedNavigation={key:navigationKey(layout,[],navigation.radius,navigation.step),entry,routes:navigation.routes(entry)};
  for(const geometry of temporary)geometry.dispose();
  const parts=[];let total=0;
  const buffer=array=>{const raw=Buffer.from(array.buffer,array.byteOffset,array.byteLength),spec={offset:total,length:array.length,type:array instanceof Float32Array?'f32':array instanceof Uint32Array?'u32':'u8'};
   parts.push(raw,Buffer.alloc(align(raw.length)-raw.length));total+=align(raw.length);return spec;};
  const packGeometry=(geometry,spec={})=>{
   const output={...spec,prepared:true,groups:geometry.groups.map(g=>({...g})),boundingSphere:{center:geometry.boundingSphere.center.toArray(),radius:geometry.boundingSphere.radius}};
   for(const name of ['position','normal','uv','uv1','color']){delete output[name];if(geometry.attributes[name])output[name]=buffer(geometry.attributes[name].array);}
   delete output.index;if(geometry.index)output.index=buffer(geometry.index.array instanceof Uint32Array?geometry.index.array:Uint32Array.from(geometry.index.array));geometry.dispose();return output;
  };
  const baked={...compact,objects:compact.objects.map(corner=>{
   const output={...corner};delete output.indicesU32;delete output.uv1U16;
   output.preparedGeometry=packGeometry(expandedGeometryFromSpec(scene.geometries[corner.geometry],corner));return output;
  })};
  for(const [id,spec]of Object.entries(scene.geometries))scene.geometries[id]=packGeometry(geometryFromSpec(spec),spec);
  for(const spec of Object.values(scene.textures||{}))if(spec.data){spec.preparedPNG=buffer(Buffer.from(spec.data.split(',')[1],'base64'));delete spec.data;}
  scene.preparedBake=baked;
  const header=Buffer.from(JSON.stringify({schema:'liv-prepared-interior-v1',sourceSHA256:record.sourceSHA256,compactSHA256:record.files.compact.decodedSHA256,scene}));
  const prefix=Buffer.alloc(align(12+header.length));prefix.write('LIVBUF01');prefix.writeUInt32LE(header.length,8);header.copy(prefix,12);
  const decoded=Buffer.concat([prefix,...parts]),packed=gzipSync(decoded,{level:9}),name=`interiores/${typology}/scene-runtime.bin.gz`;
  await writeFile(path(name),packed);record.files.runtimeScene={path:name,bytes:packed.length,sha256:hash(packed),compression:'gzip',decodedBytes:decoded.length,decodedSHA256:hash(decoded)};
  results.push({typology,bytes:packed.length,decodedBytes:decoded.length});
 }
 await writeFile(path('interiores/catalogo.json'),JSON.stringify(catalog)+'\n');
 const libraryPath='interiores/melhorias/catalogo.json',library=JSON.parse(await readFile(path(libraryPath),'utf8')),hdrCache=new Map();
 for(const record of [library.environment,library.background,...Object.values(library.reflectionEnvironments||{})].filter(Boolean)){
  const name=record.path.startsWith('interiores/melhorias/')?record.path:'interiores/melhorias/'+record.path;
  if(!hdrCache.has(name)){
   const raw=await readFile(path(name));if(raw.length!==record.bytes||hash(raw)!==record.sha256)throw Error('Ambiente HDR de outra revisão.');
   const hdr=new HDRLoader().parse(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
   if(!(hdr.data instanceof Uint16Array))throw Error('O ambiente deve usar half-float.');
   const header=Buffer.alloc(16);header.write('LIVHDR01');header.writeUInt32LE(hdr.width,8);header.writeUInt32LE(hdr.height,12);
   const decoded=Buffer.concat([header,Buffer.from(hdr.data.buffer,hdr.data.byteOffset,hdr.data.byteLength)]),packed=gzipSync(decoded,{level:9}),output=name+'.bin.gz';
   await writeFile(path(output),packed);hdrCache.set(name,{path:output,bytes:packed.length,sha256:hash(packed),decodedBytes:decoded.length,decodedSHA256:hash(decoded),sourceSHA256:record.sha256});
  }
  record.prepared=hdrCache.get(name);if(record.prepared.sourceSHA256!==record.sha256)throw Error('Ambientes divergentes com o mesmo nome.');
 }
 await writeFile(path(libraryPath),JSON.stringify(library)+'\n');return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){console.log(await prepararInteriores(process.argv[2]));}
