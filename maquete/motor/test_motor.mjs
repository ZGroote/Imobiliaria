// MG-2 e MG-3 (tasks/painel/maquete-geral.md §10): o motor da maquete, com os pacotes de teste. Roda no CI,
// sem placa de vídeo; abrir no WebGPU e no WebGL2 é o qa_abrir.py (o prédio) e o qa_casa.py (a casa).
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
import {gerar,gerarCasa} from './gerar_pacote_teste.mjs';
import casa from './pacote-casa/maquete.js';
import {EXTERIOR_EDITIONS,requestedEdition} from './edicoes.js';
import {validateUnits} from './unidades.js';
import {expandBuildingCatalog,floorLabel} from './catalogo-unidades.js';
import {buildingFacadeView,pilotFloorView} from './cameras.js';
import {typology,typologyIds} from './tipologias.js';

const pasta=new URL('./',import.meta.url);
const ler=nome=>readFileSync(new URL(nome,pasta));
const sha=b=>createHash('sha256').update(b).digest('hex');

// ── o motor não tem dado de imóvel ──

const PAGINAS=['interior.html','prova-rgbm.html','maquete.html'];
const ENTRADAS=['viewer.js','renderer.js','interior-renderer.js','decodificar-worker.js','transfer-worker.js'];
// O leitor do estoque (estoque-runtime.js) é do LIV e não veio para a main: ele é gerado do modelo de
// estoque do painel, que ainda descreve só o prédio do LIV. O viewer.js só o carrega com o estoque ligado.
const FORA=new Set(['estoque-runtime.js']);
function motor(){
  const vistos=new Set(),fila=[...ENTRADAS];
  for(const p of PAGINAS)for(const [,src] of ler(p).toString().matchAll(/<script[^>]*\ssrc="([^"?]+)/g))fila.push(src);
  while(fila.length){
    const nome=fila.pop().replace(/^\.\//,'');
    if(vistos.has(nome)||nome.startsWith('dados/')||nome.startsWith('pacote-casa/')||FORA.has(nome))continue;
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

test('os pacotes de teste saem iguais ao gerar de novo', () => {
  for(const [pasta,gerador] of [['dados/',gerar],['pacote-casa/',gerarCasa]]){
    const tmp=mkdtempSync(join(tmpdir(),'pacote-teste-'));
    try{
      const novo=gerador(tmp);
      for(const nome of Object.keys(novo))assert.equal(novo[nome],sha(ler(pasta+nome)),`${pasta}${nome} mudou: rode gerar_pacote_teste.mjs`);
    }finally{rmSync(tmp,{recursive:true,force:true});}
  }
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

// ── a casa (MG-3): uma unidade, sem e com luz pré-calculada ──

test('a casa sem luz pré-calculada: nenhum material a pede, e o sol da cena faz a sombra', () => {
  const edicao=nome=>{
    const m=JSON.parse(ler(`pacote-casa/${nome}/manifest.json`)),cena=JSON.parse(gunzipSync(ler(`pacote-casa/${nome}/scene.json.gz`)));
    assert.equal(sha(gunzipSync(ler(`pacote-casa/${nome}/scene.json.gz`))),m.sceneJSONSHA256);
    return {m,cena};
  };
  const leve=edicao('leve'),premium=edicao('premium');
  assert.deepEqual([Object.keys(leve.m.files),leve.m.bakedMeshes,leve.cena.rgbm],[['scene.json.gz'],0,null]);
  assert.ok(leve.cena.materials.every(m=>!m.baked));
  assert.ok(leve.cena.geometries.every(g=>!g.attributes.uv1),'sem luz pré-calculada, nenhuma malha leva a UV dela');
  const sol=leve.cena.lights.filter(l=>l.castShadow);
  assert.deepEqual(sol.map(l=>l.type),['DirectionalLight']);
  assert.ok(leve.cena.meshes.some(m=>m.castShadow)&&leve.cena.meshes.some(m=>m.receiveShadow&&!m.castShadow),'a casa projeta, o chão recebe');
  // A premium é o mesmo modelo, com a luz.
  assert.equal(premium.m.sourceModelSHA256,leve.m.sourceModelSHA256);
  assert.deepEqual([premium.m.bakedMeshes,premium.cena.rgbm.textureURL],[2,'irradiance.rgbm.gz']);
  // O que a página da casa (maquete.html) lê dos dados.
  assert.equal(casa.tipo,'casa');
  assert.ok(Object.values(casa.edicoes).every(e=>e.units===null),'uma unidade não tem cadastro de pavimento');
  assert.deepEqual(Object.keys(casa.edicoes).map(e=>casa.edicoes[e].assets),['dados/leve/','dados/premium/']);
  assert.equal(casa.edicaoPadrao,'leve');
  assert.ok(casa.ficha.preco&&casa.ficha.linhas.length&&casa.planta.comodos.length&&casa.mapa.pagina);
});

test('a Planta 2D sai da planta do cadastro pelo floor-plan.js do v16', async () => {
  globalThis.location??={search:''};               // o floor-plan.js lê a URL ao ser criado
  const {desenharPlanta}=await import('./planta-desenho.js');
  const conta=(svg,classe)=>svg.split(`class="${classe}"`).length-1;
  const svg=desenharPlanta(casa.planta,800,520);
  // 4 portas de giro com folha e arco; as 2 passagens largas (sala-cozinha, sala-circulação) sem nada.
  assert.deepEqual(['comodo','janela','folha','arco','correr','rotulo','area'].map(c=>conta(svg,c)),[6,5,4,4,0,6,6]);
  assert.ok(conta(svg,'parede')>=casa.planta.comodos.length);
  // Só o corte a 1,2 m: cada janela parte a parede em duas, e o peitoril e a verga dela não são desenhados.
  const semJanela=desenharPlanta({...casa.planta,janelas:[]},800,520);
  assert.equal(conta(svg,'parede'),conta(semJanela,'parede')+casa.planta.janelas.length);
  // O nome vem do cadastro: marcação nele não pode virar marcação no SVG.
  const nomes=desenharPlanta({...casa.planta,comodos:casa.planta.comodos.map((c,i)=>i?c:{...c,nome:'<b>Sala & Jantar</b>'})},800,520);
  assert.ok(nomes.includes('&lt;b&gt;Sala &amp; Jantar&lt;/b&gt;')&&!nomes.includes('<b>'));
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
