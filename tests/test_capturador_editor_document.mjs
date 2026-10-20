import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {iniciar,aplicar,carregar,documento,exportarMoveis} from '../painel/src/components/construtor-planta/modelo.ts';
import {CATALOGO_MOVEIS} from '../painel/src/components/construtor-planta/catalogoMoveis.ts';
import {documentoEditor,exportarEditor,carregarEditorState,carregarSnapshot} from '../painel/src/components/construtor-planta/editorDocument.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8'));
const add=(s,name,xMm,yMm,widthMm=3000,depthMm=3000)=>aplicar(s,{type:'add',name,xMm,yMm,widthMm,depthMm,ceilingHeightMm:2700});
const furniture=(s,id,xMm=500,yMm=600)=>{
  const d=CATALOGO_MOVEIS.find(d=>d.id===id);
  return aplicar(s,{type:'furniture-add',item:{tipoCatalogo:d.id,tipo3D:d.tipo3D,nome:d.nome,xMm,yMm,
    widthMm:d.widthMm,depthMm:d.depthMm,alturaMm:d.alturaMm,rotDegrees:90,cor:d.corPadrao}});
};
function project(){
  const ground=furniture(carregar(fixture),'sofa-3',-450,700);
  let upper=add(iniciar('leitura-superior'),'Sala',0,0);
  upper=add(upper,'Estar',3000,0,2000,2000);
  upper=aplicar(upper,{type:'merge',roomAId:'c1',roomBId:'c2'});
  upper=furniture(upper,'guardaroupa');
  upper=furniture(upper,'cama-casal',2000,-800);
  upper=aplicar(upper,{type:'furniture-delete',id:'m1'});
  return {0:ground,1:upper};
}

test('projeto completo restaura dois andares, mesclagem 1.1, aberturas, móveis e andar ativo',()=>{
  const sessions=project(),json=exportarEditor(sessions,1),doc=JSON.parse(json);
  const restored=carregarEditorState(doc,documento(sessions[1]));
  assert.equal(restored.activeFloor,1);
  assert.equal(exportarEditor(restored.sessions,1),json);
  assert.equal(restored.sessions[0].present.openings.length,fixture.openings.length);
  assert.equal(doc.floors[1].leitura.schemaVersion,'1.1.0');
  assert.deepEqual(restored.sessions[1].present.furniture,sessions[1].present.furniture);
  assert.equal(restored.sessions[1].nextFurnitureId,3);
  assert.equal(restored.sessions[1].past.length,0);
  const updated=furniture(restored.sessions[1],'criado');
  assert.equal(updated.present.furniture.at(-1).id,'m3');
  assert.equal(doc.floors[1].furniture.length,1);
  restored.sessions[0].present.furniture[0].xMm=1234;
  assert.equal(doc.floors[0].furniture[0].xMm,-450);
  assert.equal(documento(sessions[1]).furniture,undefined);
});

test('projeto exportado passa o gate Python e o snapshot retorna sem perder campos',()=>{
  const sessions=project(),leituraJson=JSON.stringify(documento(sessions[1])),editorStateJson=exportarEditor(sessions,1);
  const result=spawnSync('python',['-m','pipeline.preparar_leitura','--envelope'],{
    input:JSON.stringify({leituraJson,editorStateJson}),encoding:'utf8',cwd:new URL('..',import.meta.url)});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const snapshot=JSON.parse(result.stdout);
  assert.match(snapshot.editorStateSha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(snapshot.editorState,JSON.parse(editorStateJson));
  const restored=carregarSnapshot(snapshot.leitura,snapshot.editorState);
  assert.equal(exportarEditor(restored.sessions,restored.activeFloor),editorStateJson);
});

test('snapshot legado 1.0 e 1.1 abre sem companion e altura antiga usa catálogo real',()=>{
  for(const leitura of [fixture,documento(project()[1])]){
    const loaded=carregarSnapshot(leitura);
    assert.equal(loaded.activeFloor,0);
    assert.deepEqual(documento(loaded.sessions[0]),leitura);
  }
  const sessions=project();delete sessions[1].present.furniture[0].alturaMm;
  const json=exportarEditor(sessions,1),loaded=carregarEditorState(JSON.parse(json));
  assert.equal(exportarEditor(loaded.sessions,1),json);
  assert.equal(JSON.parse(exportarMoveis(loaded.sessions[1])).moveis[0].h,0.95);
});

test('andar superior vazio é omitido e dados inválidos em outro andar bloqueiam salvar',()=>{
  const s={0:project()[0],1:iniciar('vazio')};
  assert.deepEqual(documentoEditor(s,0).floors.map(f=>f.floor),[0]);
  assert.throws(()=>documentoEditor(s,1),/ativo está vazio/);
  assert.throws(()=>documentoEditor({1:project()[1]},1),/térreo/);
  s[1]=project()[1];s[1].present.ceilingHeightMm=null;
  assert.throws(()=>exportarEditor(s,0),/Superior/);
});

test('importação recusa conteúdo incompatível sem descartar móveis ou pavimentos',()=>{
  const base=documentoEditor(project(),1);
  const cases=[
    d=>d.schemaVersion='2.0.0',d=>d.extra=true,d=>d.floors.push(structuredClone(d.floors[0])),
    d=>d.floors[1].floor=0,d=>d.activeFloor=2,d=>d.floors[1].furniture[0].id='m9007199254740992',
    d=>d.floors[0].furniture[0].heightUnknown=900,d=>d.floors[0].furniture[0].widthMm=10001,
    d=>d.floors[0].furniture[0].xMm=0.5,d=>d.floors[0].furniture[0].cor='red',
    d=>d.floors[0].furniture[0].tipo3D='cama',d=>d.floors[0].furniture.push(structuredClone(d.floors[0].furniture[0])),
    d=>d.floors[0].leitura.references=[{id:'foto',kind:'photo',description:'Foto'}],
  ];
  for(const change of cases){const d=structuredClone(base);change(d);assert.throws(()=>carregarEditorState(d));}
  assert.throws(()=>carregarEditorState(base,base.floors[0].leitura),/andar ativo/);
});

test('nome do móvel segue 100 caracteres Unicode brutos, sem apagar espaços',()=>{
  const sessions=project(),state=documentoEditor(sessions,1);
  for(const nome of [' '+ 'a'.repeat(99),'🛋️'.repeat(50),'🎉'.repeat(100)]){
    const d=structuredClone(state);d.floors[0].furniture[0].nome=nome;
    const restored=carregarEditorState(d);
    assert.equal(restored.sessions[0].present.furniture[0].nome,nome);
    const result=spawnSync('python',['-m','pipeline.preparar_leitura','--envelope'],{
      input:JSON.stringify({leituraJson:JSON.stringify(d.floors[1].leitura),editorStateJson:JSON.stringify(d)}),
      encoding:'utf8',cwd:new URL('..',import.meta.url)});
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).editorState,d);
  }
  for(const nome of [' '+ 'a'.repeat(100),'🎉'.repeat(101),' '.repeat(100)]){
    const d=structuredClone(state);d.floors[0].furniture[0].nome=nome;
    assert.throws(()=>carregarEditorState(d),/móvel/);
    const result=spawnSync('python',['-m','pipeline.preparar_leitura','--envelope'],{
      input:JSON.stringify({leituraJson:JSON.stringify(d.floors[1].leitura),editorStateJson:JSON.stringify(d)}),
      encoding:'utf8',cwd:new URL('..',import.meta.url)});
    assert.equal(result.status,2,result.stdout+result.stderr);
  }
});
