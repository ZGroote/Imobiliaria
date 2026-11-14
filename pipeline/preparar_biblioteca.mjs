// Transporte sem perdas: geometria original + pacotes de imagens únicas de até 4 MiB.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {imageURI,selectImprovementAssets} from '../experimentos/liv-experimental-2026-10-14/improvement-delivery.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const align=n=>Math.ceil(n/4)*4;

export function separateGLB(raw){
  if(raw.length<28||raw.readUInt32LE(0)!==0x46546c67||raw.readUInt32LE(4)!==2||raw.readUInt32LE(8)!==raw.length||raw.readUInt32LE(16)!==0x4e4f534a)throw Error('GLB inválido.');
  const jsonLength=raw.readUInt32LE(12),binBase=28+jsonLength;
  if(binBase>raw.length||raw.readUInt32LE(24+jsonLength)!==0x004e4942||raw.readUInt32LE(20+jsonLength)!==raw.length-binBase)throw Error('Bloco binário inválido.');
  const json=JSON.parse(raw.subarray(20,20+jsonLength)),images=new Map();
  if(json.buffers?.length!==1||json.buffers[0].uri||(json.extensionsUsed||[]).includes('EXT_meshopt_compression'))throw Error('Layout GLB não suportado para separação sem perdas.');
  const kept=new Set(),visit=value=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){
    if(key==='bufferView'&&Number.isInteger(child))kept.add(child);else visit(child);
  }};
  for(const [key,value]of Object.entries(json))if(key!=='images')visit(value);
  const removed=new Set();
  for(const image of json.images||[]){
    const view=json.bufferViews?.[image.bufferView];
    if(image.uri||!view||view.buffer!==0||!['image/png','image/jpeg','image/webp'].includes(image.mimeType))throw Error('Imagem GLB não suportada.');
    const start=view.byteOffset||0,end=start+view.byteLength;
    if(start<0||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end>raw.length-binBase||view.byteLength<=0)throw Error('Imagem fora do GLB.');
    const data=raw.subarray(binBase+start,binBase+end),sha256=hash(data);
    images.set(sha256,{sha256,mimeType:image.mimeType,bytes:data.length,data});
    if(!kept.has(image.bufferView))removed.add(image.bufferView);
    delete image.bufferView;image.uri=imageURI(sha256);
  }
  // Índices dos bufferViews/accessors e todos os demais metadados ficam intactos.
  // Views de imagens removidas recebem quatro bytes inertes; não são mais referidas.
  const parts=[Buffer.alloc(4)];let offset=4;
  for(let index=0;index<(json.bufferViews||[]).length;index++){
    const view=json.bufferViews[index];
    if(removed.has(index)){view.byteOffset=0;view.byteLength=4;continue;}
    const start=view.byteOffset||0,end=start+view.byteLength;
    if(view.buffer!==0||start<0||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end>raw.length-binBase)throw Error('BufferView fora do GLB.');
    const part=Buffer.alloc(align(view.byteLength));raw.copy(part,0,binBase+start,binBase+end);view.byteOffset=offset;parts.push(part);offset+=part.length;
  }
  const bin=Buffer.concat(parts);json.buffers[0].byteLength=bin.length;
  const text=Buffer.from(JSON.stringify(json)),header=Buffer.alloc(28+align(text.length),32);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(header.length+bin.length,8);
  header.writeUInt32LE(align(text.length),12);header.writeUInt32LE(0x4e4f534a,16);text.copy(header,20);
  header.writeUInt32LE(bin.length,20+align(text.length));header.writeUInt32LE(0x004e4942,24+align(text.length));
  return {bytes:Buffer.concat([header,bin]),images:[...images.values()]};
}

export function makeImagePack(images){
  let offset=0;const entries=images.map(({data,...image})=>{const entry={...image,offset};offset+=data.length;return entry;});
  const json=Buffer.from(JSON.stringify({schema:'liv-image-pack-v1',images:entries})),prefix=Buffer.alloc(align(12+json.length));
  prefix.write('LIVIMG01');prefix.writeUInt32LE(json.length,8);json.copy(prefix,12);
  return Buffer.concat([prefix,...images.map(image=>image.data)]);
}

export async function prepararBiblioteca(root,{includeDecorations=true}={}){
  root=resolve(root);const path=name=>{const out=resolve(root,name);if(!out.startsWith(root+sep))throw Error('Recurso fora do pacote.');return out;};
  const libraryPath='interiores/melhorias/catalogo.json',catalog=JSON.parse(await readFile(path(libraryPath),'utf8'));delete catalog.delivery;
  const delivery={schema:'liv-improvement-delivery-v1',models:{},typologies:{}},images=new Map(),results=[];
  const write=async(name,bytes)=>{await mkdir(dirname(path(name)),{recursive:true});await writeFile(path(name),bytes);return {path:name,bytes:bytes.length,sha256:hash(bytes)};};
  for(const asset of catalog.assets){
    const sourcePath=asset.path.startsWith('interiores/melhorias/')?asset.path:'interiores/melhorias/'+asset.path,raw=await readFile(path(sourcePath));
    if(raw.length!==asset.bytes||hash(raw)!==asset.sha256)throw Error('Móvel de outra revisão: '+asset.id);
    const model=separateGLB(raw);for(const image of model.images)images.set(image.sha256,image);
    delivery.models[asset.id]={sourceSHA256:asset.sha256,model:await write(`interiores/melhorias/otimizado/${hash(model.bytes)}.glb`,model.bytes),images:model.images.map(({data,...image})=>image)};
  }
  const interiors=JSON.parse(await readFile(path('interiores/catalogo.json'),'utf8'));
  for(const [typology,entry]of Object.entries(interiors.tipologias)){
    const record=entry.files.unit,unitRaw=await readFile(path(record.path));
    if(hash(unitRaw)!==record.sha256)throw Error('Cadastro de outra revisão.');
    const unit=JSON.parse(unitRaw),assets=selectImprovementAssets(catalog,{items:unit.planta.moveis,typology,includeDecorations});
    const needed=[...new Set(assets.flatMap(asset=>delivery.models[asset.id].images.map(image=>image.sha256)))].sort().map(key=>images.get(key));
    const groups=[];let group=[],bytes=0;
    for(const image of needed){if(group.length&&bytes+image.bytes>4*2**20){groups.push(group);group=[];bytes=0;}group.push(image);bytes+=image.bytes;}if(group.length)groups.push(group);
    const packs=[];
    for(const group of groups){const decoded=makeImagePack(group),packed=gzipSync(decoded,{level:9});
      packs.push({...await write(`interiores/melhorias/otimizado/${hash(packed)}.bin.gz`,packed),decodedBytes:decoded.length,images:group.map(({data,...image})=>image)});}
    delivery.typologies[typology]={assetIds:assets.map(asset=>asset.id),packs};
    results.push({typology,assets:assets.length,originalBytes:assets.reduce((n,a)=>n+a.bytes,0),preparedBytes:assets.reduce((n,a)=>n+delivery.models[a.id].model.bytes,0)+packs.reduce((n,p)=>n+p.bytes,0),images:needed.length,packs:packs.length});
  }
  catalog.delivery=delivery;await writeFile(path(libraryPath),JSON.stringify(catalog)+'\n');return results;
}
