import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {prepararLeitura} from '../tools/leitura-api.mjs';
import {CATALOGO_MOVEIS} from '../painel/src/components/construtor-planta/catalogoMoveis.ts';

const leituraJson=readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8');
const terreo=JSON.parse(leituraJson),superior={...structuredClone(terreo),id:'leitura-superior'};
const movel={id:'m1',tipoCatalogo:'sofa-3',tipo3D:'sofa',nome:'Sofá',xMm:1000,yMm:1000,widthMm:1960,depthMm:920,rotDegrees:90,alturaMm:800,cor:'#4A5A6B'};
const editor=()=>({schemaVersion:'1.0.0',activeFloor:1,floors:[{floor:0,leitura:structuredClone(terreo),furniture:[structuredClone(movel)]},{floor:1,leitura:structuredClone(superior),furniture:[]}]});

test('gate Python preserva dois pisos e móveis mantendo leitura e hash geométricos',async()=>{
  const text=JSON.stringify(superior),state=editor();
  const original=await prepararLeitura(text),saved=await prepararLeitura(text,JSON.stringify(state));
  assert.deepEqual(saved.leitura,original.leitura);
  assert.equal(saved.contentSha256,original.contentSha256);
  assert.deepEqual(saved.editorState,state);
  assert.match(saved.editorStateSha256,/^[0-9a-f]{64}$/);
  const changed=structuredClone(state);changed.floors[0].furniture[0].xMm+=10;
  const next=await prepararLeitura(text,JSON.stringify(changed));
  assert.equal(next.contentSha256,saved.contentSha256);
  assert.notEqual(next.editorStateSha256,saved.editorStateSha256);
  const unicode=structuredClone(state);unicode.floors[0].furniture[0].nome='🛋'.repeat(100);
  assert.deepEqual((await prepararLeitura(text,JSON.stringify(unicode))).editorState,unicode);
});

test('todos os presets reais do catálogo UI passam sem perder dimensões ou altura',async()=>{
  const furniture=CATALOGO_MOVEIS.map((d,i)=>({id:'m'+(i+1),tipoCatalogo:d.id,tipo3D:d.tipo3D,nome:d.nome,xMm:0,yMm:0,widthMm:d.widthMm,depthMm:d.depthMm,alturaMm:d.alturaMm,rotDegrees:0,cor:d.corPadrao}));
  const state={schemaVersion:'1.0.0',activeFloor:0,floors:[{floor:0,leitura:terreo,furniture}]};
  const saved=await prepararLeitura(leituraJson,JSON.stringify(state));
  assert.deepEqual(saved.editorState.floors[0].furniture,furniture);
});

test('companion normativamente válido precisa reabrir no editor sem perder procedência',async()=>{
  const leitura=structuredClone(terreo);
  leitura.references=[{id:'fonte',kind:'document',description:'Planta declarada de teste',locator:'planta-original.pdf'}];
  leitura.provenance.referenceIds=['fonte'];
  const text=JSON.stringify(leitura),state={schemaVersion:'1.0.0',activeFloor:0,
    floors:[{floor:0,leitura,furniture:[]}]};
  // A leitura e o companion são válidos no contrato Python, mas a UI ainda não
  // representa references. O gate não pode salvar um projeto que perderia esse dado.
  const normative=spawnSync(process.env.PYTHON??'python',['-m','pipeline.preparar_leitura','--envelope'],
    {cwd:new URL('..',import.meta.url),encoding:'utf8',windowsHide:true,
      input:JSON.stringify({leituraJson:text,editorStateJson:JSON.stringify(state)})});
  assert.equal(normative.status,0,normative.stdout+normative.stderr);
  assert.deepEqual((await prepararLeitura(text)).leitura,leitura);
  await assert.rejects(prepararLeitura(text,JSON.stringify(state)),e=>e.status===422&&/EDITOR_STATE_NAO_REABRIVEL/.test(e.message));
});

test('companion rejeita leitura ativa divergente, piso inválido e catálogo/móvel adulterado',async()=>{
  for(const mutate of [
    s=>{s.floors[1].leitura.revision++},
    s=>{s.floors[0].leitura.rooms[0].widthMm=-1},
    s=>{s.floors[0].furniture[0].tipo3D='cama'},
    s=>{s.floors[0].furniture[0].xMm=1.5},
    s=>{s.floors[0].furniture[0].cor='<script>'},
    s=>{s.floors[0].furniture[0].nome=' '.repeat(100)+'Sofá'},
    s=>{s.floors[0].furniture[0].nome='🛋'.repeat(101)},
    s=>{s.floors[0].furniture[0].id='externo'},
    s=>{s.floors[0].furniture[0].id='m9007199254740991'},
    s=>{s.floors.reverse()},
    s=>{s.floors.push(structuredClone(s.floors[0]))},
    s=>{s.floors[0].furniture=Array.from({length:201},(_,i)=>({...movel,id:'m'+(i+1)}))},
  ]){
    const state=editor();mutate(state);
    await assert.rejects(prepararLeitura(JSON.stringify(superior),JSON.stringify(state)),e=>e.status===422);
  }
  await assert.rejects(prepararLeitura(leituraJson,'null'),/EDITOR_STATE_INVALIDO/);
  await assert.rejects(prepararLeitura(leituraJson,'{"schemaVersion":"1.0.0","activeFloor":0,"activeFloor":1,"floors":[]}'),/INVALID_JSON/);
});
