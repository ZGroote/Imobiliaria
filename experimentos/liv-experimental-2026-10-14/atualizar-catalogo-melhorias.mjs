// Reaplica as transferências validadas após regenerar os GLBs base do Blender.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const directory=new URL('interiores/melhorias/',import.meta.url);
const readJSON=async name=>JSON.parse(await readFile(new URL(name,directory),'utf8'));
const catalog=await readJSON('catalogo.json');
assert.equal(catalog.schema,'liv-interior-improvements-v1');
assert(catalog.complete!==false,'A exportação base precisa estar completa.');
const sourceSHA=catalog.sourceBlend?.sha256||catalog.sourceBlendSha256;
assert.equal(sourceSHA,'517be435ec7072839a9088f2675c264e7fd297ff7c0f98c2bb2534035017db88');
async function verified(name){
  const item=await readJSON(name);
  assert.equal(item.sourceBlendSHA256,sourceSHA,`Fonte de ${name}`);
  assert(/^[a-zA-Z0-9._-]+\.(?:glb|hdr|bin)$/.test(item.path),`Caminho de ${name}`);
  const bytes=await readFile(new URL(item.path,directory));
  assert.equal(bytes.length,item.bytes,`Tamanho de ${name}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256,`SHA de ${name}`);
  return item;
}
const complement=await readJSON('complementos.json');
assert.equal(complement.sourceBlendSHA256After,sourceSHA);
for(const item of complement.assets){
  assert(/^[a-zA-Z0-9._-]+\.glb$/.test(item.path));
  const bytes=await readFile(new URL(item.path,directory));
  assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
}
const ids=new Set(complement.assets.map(item=>item.id));
catalog.assets=[...catalog.assets.filter(item=>!ids.has(item.id)),...complement.assets];
catalog.decorations=[...(catalog.decorations||[]).filter(item=>!ids.has(item.assetId)),...complement.decorations];
catalog.environment=await verified('ambiente-interior-limpo.json');
catalog.background=await verified('ceu.json');
catalog.reflectionEnvironments={...catalog.reflectionEnvironments,jantar:await verified('ambiente-jantar-limpo.json'),
  cozinha:await verified('ambiente-cozinha.json')};
// O inox da cozinha reflete a sonda tirada na frente da bancada (exportar-ambiente-cozinha-web.py);
// a do jantar fica para a mesa. A da sala, alaranjada pelo piso, deixava geladeira e cuba bronzeadas.
for(const item of catalog.assets){
  if(item.id==='mesa-jantar')item.environment='jantar';
  if(['geladeira','fogao','pia-cozinha'].includes(item.id))item.environment='cozinha';
}
const look=await verified('look-agx-medio-baixo.json');assert(look.validationPassed);
catalog.look=Object.fromEntries(['schema','path','bytes','sha256','edge','domainMinEV','domainMaxEV','axisOrder','encoding','input','output',
  'sourceLook','sourceViewTransform','sourceDisplayDevice','sourceExposureEV','lookupExposureEV','sourceBlendSHA256','validationPassed'].map(key=>[key,look[key]]));
const path=new URL('catalogo.json',directory),text=JSON.stringify(catalog,null,2)+'\n';
if(await readFile(path,'utf8')!==text){
  const temporary=new URL('catalogo.tmp.json',directory);await writeFile(temporary,text);await rename(temporary,path);
}
console.log(JSON.stringify({catalog:fileURLToPath(path),assets:catalog.assets.length,decorations:catalog.decorations.length,
  environment:catalog.environment.path,reflections:Object.keys(catalog.reflectionEnvironments),look:catalog.look.sourceLook}));
