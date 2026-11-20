// MG-2 (tasks/painel/maquete-geral.md §10): o motor da maquete, com o pacote de teste. Roda no CI, sem
// placa de vídeo; abrir no WebGPU e no WebGL2 é o qa_abrir.py, que precisa dela.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import http from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {test} from 'node:test';
import dados from './dados/maquete.js';
import {gerar} from './gerar_pacote_teste.mjs';
import {EXTERIOR_EDITIONS,requestedEdition} from './edicoes.js';
import {validateUnits} from './unidades.js';
import {expandBuildingCatalog,floorLabel} from './catalogo-unidades.js';
import {buildingFacadeView,pilotFloorView} from './cameras.js';
import {typology,typologyIds} from './tipologias.js';

const pasta=new URL('./',import.meta.url);
const ler=nome=>readFileSync(new URL(nome,pasta));
const sha=b=>createHash('sha256').update(b).digest('hex');

// ── o motor não tem dado de imóvel ──

const PAGINAS=['interior.html','prova-rgbm.html'];
const ENTRADAS=['viewer.js','renderer.js','interior-renderer.js','decodificar-worker.js','transfer-worker.js'];
// O leitor do estoque (estoque-runtime.js) é do LIV e não veio para a main: ele é gerado do modelo de
// estoque do painel, que ainda descreve só o prédio do LIV. O viewer.js só o carrega com o estoque ligado.
const FORA=new Set(['estoque-runtime.js']);
function motor(){
  const vistos=new Set(),fila=[...ENTRADAS];
  for(const p of PAGINAS)for(const [,src] of ler(p).toString().matchAll(/<script[^>]*\ssrc="([^"?]+)/g))fila.push(src);
  while(fila.length){
    const nome=fila.pop().replace(/^\.\//,'');
    if(vistos.has(nome)||nome.startsWith('dados/')||FORA.has(nome))continue;
    vistos.add(nome);
    for(const [,dep] of ler(nome).toString().matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"](\.\/[^'"?]+)/g))fila.push(dep);
  }
  return [...vistos].sort();
}
const PROIBIDOS=[
  [/ipanema/i,'o nome do LIV'],[/\bLIV\b/,'o nome do LIV'],
  [/['"`](canto|meio)['"`]/,'uma tipologia do LIV'],[/['"`](lazer|estacionamento)['"`]/,'um lado da fachada do LIV'],
  [/['"`](varandas|acesso|portaria)['"`]/,'uma vista própria do LIV'],
  [/mapa-liv|maquete-liv|plantas2d\/|site-baseline|assets-prova|modelo\/(entrada|variante)|pavimento-modelo|MAT-entrada-/,'um caminho do LIV'],
  [/a25114ef|bc846b68|89f552ec/,'um hash do LIV'],
  [/\b(48\.45|23\.85|7\.02|6\.35|2\.85|4\.35|3\.02|5\.68)\b/,'uma medida do LIV'],
  [/[<>]=?\s*16\b/,'o último pavimento do LIV'],
];

test('o motor não tem nome, medida, caminho nem número de imóvel', () => {
  const modulos=motor();
  assert.ok(modulos.length>25,`só ${modulos.length} módulos: o grafo não foi seguido`);
  const achados=[];
  for(const nome of [...modulos,...PAGINAS])ler(nome).toString().split('\n').forEach((linha,i)=>{
    for(const [padrao,oQue] of PROIBIDOS)if(padrao.test(linha))achados.push(`${nome}:${i+1}: ${oQue}`);
  });
  assert.deepEqual(achados,[]);
});

// ── o pacote de teste ──

test('o pacote de teste sai igual ao gerar de novo', () => {
  const tmp=mkdtempSync(join(tmpdir(),'pacote-teste-'));
  try{
    const novo=gerar(tmp);
    for(const nome of Object.keys(novo))assert.equal(novo[nome],sha(ler('dados/'+nome)),`${nome} mudou: rode gerar_pacote_teste.mjs`);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('as identidades do manifesto batem com os arquivos', () => {
  const m=JSON.parse(ler('dados/exterior/manifest.json'));
  assert.equal(m.schema,'liv-proof-manifest-v1');
  for(const [nome,id] of Object.entries(m.files)){
    const b=ler('dados/exterior/'+nome);
    assert.deepEqual([b.length,sha(b)],[id.bytes,id.sha256],nome);
  }
  const json=gunzipSync(ler('dados/exterior/scene.json.gz')),cena=JSON.parse(json);
  assert.equal(sha(json),m.sceneJSONSHA256);
  assert.deepEqual([cena.schema,cena.sourceModelSHA256,cena.rgbm.sourceSHA256],['liv-exterior-proof-v1',m.sourceModelSHA256,m.sourceModelSHA256]);
  const atlas=gunzipSync(ler('dados/exterior/'+cena.rgbm.textureURL));
  assert.deepEqual([atlas.length,sha(atlas)],[cena.rgbm.width*cena.rgbm.height*4,cena.rgbm.textureSHA256]);
  // toda malha com luz pré-calculada tem a UV dela
  for(const malha of cena.meshes)if(cena.materials[malha.material].baked)assert.ok(cena.geometries[malha.geometry].attributes.uv1,malha.name);
  assert.deepEqual(Object.keys(cena.views).sort(),Object.keys(dados.vistasDaCena).sort());
});

// O ajudante que baixa, confere e descomprime (decodificar-worker.js), rodado de verdade no Node.
test('o motor recusa um recurso trocado', async () => {
  const m=JSON.parse(ler('dados/exterior/manifest.json')),cena=JSON.parse(gunzipSync(ler('dados/exterior/scene.json.gz')));
  const servidor=http.createServer((req,res)=>{
    try{res.writeHead(200).end(ler('dados/exterior/'+new URL(req.url,'http://x').pathname.slice(1)));}catch{res.writeHead(404).end();}
  });
  await new Promise(ok=>servidor.listen(0,'127.0.0.1',ok));
  const respostas=[];
  globalThis.self=globalThis;globalThis.postMessage=m=>respostas.push(m);
  await import('./decodificar-worker.js');
  const pedir=async pedido=>{respostas.length=0;await self.onmessage({data:{id:1,...pedido}});return respostas.find(r=>!r.progress);};
  const url=n=>`http://127.0.0.1:${servidor.address().port}/${n}`;
  try{
    const atlas={url:url('irradiance.rgbm.gz'),name:'irradiance.rgbm.gz',...m.files['irradiance.rgbm.gz'],decodedSHA256:cena.rgbm.textureSHA256};
    assert.equal((await pedir(atlas)).bytes.length,64*64*4);
    assert.match((await pedir({...atlas,sha256:'0'.repeat(64)})).error,/Identidade do recurso irradiance\.rgbm\.gz/);
    assert.match((await pedir({...atlas,decodedSHA256:'0'.repeat(64)})).error,/Atlas RGBM corrompido/);
    assert.match((await pedir({...atlas,bytes:atlas.bytes-1})).error,/Tamanho do recurso/);
    const lida=await pedir({url:url('scene.json.gz'),name:'scene.json.gz',...m.files['scene.json.gz'],decodedSHA256:m.sceneJSONSHA256,scene:true});
    assert.equal(lida.data.meshes.length,3);
    assert.match((await pedir({url:url('scene.json.gz'),name:'scene.json.gz',...m.files['scene.json.gz'],decodedSHA256:'0'.repeat(64),scene:true})).error,
      /Cena descomprimida não corresponde/);
  }finally{servidor.close();delete globalThis.postMessage;}
});

// ── o motor com os dados do pacote ──

test('as unidades, o prédio e as câmeras vêm dos dados', () => {
  assert.deepEqual(Object.keys(EXTERIOR_EDITIONS),['base']);
  assert.equal(requestedEdition('?geometria=outra'),'base');
  const piloto=JSON.parse(ler('dados/unidades.json'));
  assert.equal(validateUnits(piloto),piloto);
  const errado=n=>{const x=structuredClone(piloto);n(x);return x;};
  assert.throws(()=>validateUnits(errado(x=>{x.units[0].final='03';})));
  assert.throws(()=>validateUnits(errado(x=>{x.units[0].side='frente';})));                 // final ímpar no lado par
  assert.throws(()=>validateUnits(errado(x=>{x.units[1].bounds.min[1]=2.9;})));
  assert.throws(()=>validateUnits(errado(x=>{x.units.pop();})));
  const predio=expandBuildingCatalog(piloto);
  assert.deepEqual(predio.units.map(u=>u.id),['teste/pavimento-00/final-01','teste/pavimento-00/final-02','teste/pavimento-01/final-01','teste/pavimento-01/final-02']);
  assert.deepEqual([predio.units[0].bounds.min[1],predio.units[2].bounds.min[1]],[0,3]);
  assert.deepEqual([predio.reconciliation.modelLevels,predio.reconciliation.finalsPerLevel],[2,2]);
  assert.deepEqual([floorLabel(0),floorLabel(1)],['Térreo','1º pavimento tipo']);
  assert.throws(()=>floorLabel(2));
  assert.ok(pilotFloorView(1.6,'frente').position[2]>0 && pilotFloorView(1.6,'fundos').position[2]<0);
  assert.throws(()=>buildingFacadeView(1.6,'lateral'));
  assert.deepEqual(typologyIds,[]);
  assert.throws(()=>typology('qualquer'));
});
