import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {separateGLB,makeImagePack} from '../pipeline/preparar_biblioteca.mjs';
import {selectImprovementAssets,decodeImagePack,createPackedImageLoader,selectPreparedDelivery} from '../experimentos/liv-experimental-2026-10-14/improvement-delivery.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const image=(text,mimeType='image/png')=>{const data=Buffer.from(text);return {data,mimeType,sha256:hash(data),bytes:data.length};};
const asset=(id,types=[],extra={})=>({id,types,...extra});

test('o helper entregue nos dois sites é o mesmo usado pelo gerador',()=>{
  const read=name=>readFileSync(new URL('../experimentos/'+name+'/improvement-delivery.js',import.meta.url),'utf8');
  assert.equal(read('liv-experimental-2026-10-14'),read('laranjeiras-2026-10-30/site'));
});

test('seleção conserva móveis e acabamentos usados, excluindo só dependências de decorações desativadas',()=>{
  const catalog={assets:[asset('sofa',['sofa']),asset('tecido',['cadeira'],{namePattern:'jantar'}),asset('parede'),asset('planta'),asset('tv',['tv'])],
    materialOverrides:[{assetId:'parede'}],decorations:[{assetId:'planta'},{assetId:'tv'}]};
  const options={items:[{tipo:'sofa'},{tipo:'cadeira',nome:'cadeira de jantar'},{tipo:'tv'}],includeDecorations:false};
  assert.deepEqual(selectImprovementAssets(catalog,options).map(a=>a.id),['sofa','tecido','parede','tv']);
  assert.equal(selectImprovementAssets(catalog,{...options,includeDecorations:true}).length,5);
  assert.equal(selectImprovementAssets(catalog,{includeDecorations:false}).length,5,'Sem cadastro, conserva a compatibilidade antiga.');
});
test('uma alternativa exclusiva da tipologia continua restrita, inclusive nas plantas espelhadas',()=>{
  const catalog={assets:[asset('comum',['cama']),asset('canto',['cama'],{typology:'canto'})]};
  assert.deepEqual(selectImprovementAssets(catalog,{typology:'canto-espelhado',items:[{tipo:'cama'}]}).map(a=>a.id),['comum']);
});
test('pacote mantém bytes exatos, MIME e views sobre um único buffer; rejeita limites e identidades inválidos',()=>{
  const images=[image('png original'),image('jpeg original','image/jpeg')],raw=makeImagePack(images),decoded=decodeImagePack(raw);
  for(const expected of images){const actual=decoded.get(expected.sha256);assert.deepEqual(Buffer.from(actual.data),expected.data);assert.equal(actual.data.buffer,raw.buffer);}
  assert.throws(()=>decodeImagePack(raw.subarray(0,raw.length-1)),/fora/);
  assert.throws(()=>decodeImagePack(makeImagePack([images[0],images[0]])),/fora/);
  assert.throws(()=>decodeImagePack(Buffer.from('inválido')),/inválido/);
});
test('download e decodificação de uma imagem são compartilhados entre modelos; release solta o índice',async()=>{
  const expected=image('png original'),raw=makeImagePack([expected]),pack={path:'pack.bin.gz',decodedBytes:raw.length,images:[expected]};
  let downloads=0,decodes=0;const owned=[];
  const loader=createPackedImageLoader({delivery:{packs:[pack]},resource:async()=>{downloads++;return {bytes:gzipSync(raw)};},onBitmap:b=>owned.push(b),
    createBitmap:async(blob,options)=>{decodes++;assert.deepEqual(options,{premultiplyAlpha:'none',colorSpaceConversion:'none'});assert.deepEqual(Buffer.from(await blob.arrayBuffer()),expected.data);return {close(){}};}});
  await Promise.all([loader.prepare([expected]),loader.prepare([expected])]);assert.equal(downloads,1);assert.equal(decodes,1);assert.equal(owned.length,1);
  const got=await new Promise((resolve,reject)=>loader.handler.load('https://example.invalid/otimizado/texturas/'+expected.sha256,resolve,null,reject));assert.equal(got,owned[0]);
  await assert.rejects(new Promise((resolve,reject)=>loader.handler.load('https://example.invalid/roubada',resolve,null,reject)),/não autorizada/);
  loader.release();await assert.rejects(loader.prepare([expected]),{name:'AbortError'});
});
test('corrupção e falha de decoder impedem um modelo preparado de entrar sem sua textura',async()=>{
  const expected=image('png original'),raw=makeImagePack([expected]);
  for(const failure of ['size','index','decoder']){
    const pack={path:'pack.bin.gz',decodedBytes:raw.length+(failure==='size'?1:0),images:[{...expected,bytes:expected.bytes+(failure==='index'?1:0)}]};
    const loader=createPackedImageLoader({delivery:{packs:[pack]},resource:async()=>({bytes:gzipSync(raw)}),onBitmap:()=>{},createBitmap:async()=>{throw Error('decoder');}});
    await assert.rejects(loader.prepare([pack.images[0]]),failure==='decoder'?/decoder/:/incompleto|divergente|revisão/);loader.release();
  }
});
test('cancelamento durante decode registra o bitmap para descarte, sem entregar textura após cancelar',async()=>{
  const controller=new AbortController(),expected=image('png original'),raw=makeImagePack([expected]),owned=[];
  const loader=createPackedImageLoader({delivery:{packs:[{path:'x.bin.gz',decodedBytes:raw.length,images:[expected]}]},signal:controller.signal,
    resource:async()=>({bytes:gzipSync(raw)}),onBitmap:b=>owned.push(b),createBitmap:async()=>{controller.abort();return {close(){}};}});
  await assert.rejects(loader.prepare([expected]),{name:'AbortError'});assert.equal(owned.length,1);loader.release();
});
test('edição que exige um modelo fora do pacote usa os originais, sem aplicar transporte de outra revisão',()=>{
  const assets=[{id:'sofa',sha256:'original'}],catalog={delivery:{schema:'liv-improvement-delivery-v1',models:{sofa:{sourceSHA256:'original'}},typologies:{canto:{assetIds:['sofa'],packs:[]}}}};
  assert.ok(selectPreparedDelivery(catalog,assets,'canto'));assert.equal(selectPreparedDelivery(catalog,[...assets,{id:'novo'}],'canto'),null);
  catalog.delivery.models.sofa.sourceSHA256='velho';assert.equal(selectPreparedDelivery(catalog,assets,'canto'),null);
});

function fixture(){
  const png=Buffer.from('original PNG encoded bytes'),positions=Buffer.from(new Float32Array([1,2,3,4,5,6,7,8,9]).buffer),bin=Buffer.concat([positions,png]);
  const json={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.length},{buffer:0,byteOffset:positions.length,byteLength:png.length}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[1,2,3],max:[7,8,9]}],images:[{bufferView:1,mimeType:'image/png',name:'nome original'}],
    textures:[{source:0,sampler:0}],samplers:[{wrapS:33071}],materials:[{name:'Acabamento aprovado',extensions:{KHR_materials_sheen:{sheenColorTexture:{index:0}}}}],
    nodes:[{name:'ID do editor',translation:[1,2,3],mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],extensionsUsed:['KHR_materials_sheen']};
  const text=Buffer.from(JSON.stringify(json)),length=Math.ceil(text.length/4)*4,padded=Buffer.alloc(Math.ceil(bin.length/4)*4),header=Buffer.alloc(28+length,32);bin.copy(padded);
  for(const [offset,value]of [[0,0x46546c67],[4,2],[8,header.length+padded.length],[12,length],[16,0x4e4f534a],[20+length,padded.length],[24+length,0x004e4942]])header.writeUInt32LE(value,offset);
  text.copy(header,20);return {bytes:Buffer.concat([header,padded]),positions,png,json};
}
test('separação mantém os bytes dos accessors e todos os materiais, samplers, extensões e IDs',()=>{
  const source=fixture(),out=separateGLB(source.bytes),length=out.bytes.readUInt32LE(12),json=JSON.parse(out.bytes.subarray(20,20+length)),bin=out.bytes.subarray(28+length);
  for(const key of ['accessors','materials','textures','samplers','nodes','meshes','extensionsUsed'])assert.deepEqual(json[key],source.json[key]);
  const view=json.bufferViews[0];assert.deepEqual(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength),source.positions);
  assert.deepEqual(out.images[0].data,source.png);assert.equal(json.images[0].name,'nome original');assert.equal(json.images[0].uri,'texturas/'+hash(source.png));assert.equal(json.images[0].bufferView,undefined);
  assert.throws(()=>separateGLB(source.bytes.subarray(0,source.bytes.length-1)),/GLB inválido/);
});
