import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {iniciar, aplicar, desfazer, refazer, metrosParaMm, metros, snap, relacoes, problemas, exportar}
  from '../painel/src/components/construtor-planta/modelo.ts';

const add = (s, name='Sala', w=4000, d=3000) =>
  aplicar(s, {type:'add', name, widthMm:w, depthMm:d, ceilingHeightMm:2700});
const move = (s,id,xMm,yMm) => aplicar(s,{type:'move',id,xMm,yMm});
function layoutL() {
  let s=add(iniciar('leitura-teste'));
  s=add(s,'Quarto',3000,3000); s=move(s,'c2',4000,0);
  s=add(s,'Cozinha',4000,2000); return move(s,'c3',0,3000);
}

test('metros textuais: vírgula/ponto, sem arredondar casas extras',()=>{
  assert.equal(metros(-123),'-0,123');
  for(const [text,mm] of [['4,20',4200],['0.001',1],['1000',1000000],[' 1,005 ',1005]])
    assert.equal(metrosParaMm(text),mm);
  for(const text of ['', '0','-1','1e3','1.0000','4,2001','1,2.3','1000.001','NaN'])
    assert.throws(()=>metrosParaMm(text),undefined,text);
});

test('arquivo baixado no smoke mobile é reproduzível pela lógica e passa no M1-0',()=>{
  const file=new URL('./fixtures/leitura/v1/capturador-mobile.json',import.meta.url);
  const text=readFileSync(file,'utf8'), doc=JSON.parse(text);
  let s=layoutL();
  s=desfazer(move(s,'c3',0,2900));
  s=desfazer(aplicar(s,{type:'delete',id:'c3'}));
  assert.equal(exportar({...s,id:doc.id}),text);
  const result=execFileSync('python',['-m','pipeline.validar_leitura',fileURLToPath(file)],{encoding:'utf8'});
  assert.equal(JSON.parse(result).valid,true);
});

test('medidas e pé-direito exigem declaração, IDs não reciclam após undo',()=>{
  let s=iniciar('leitura-teste');
  assert.throws(()=>aplicar(s,{type:'add',name:'Sala',widthMm:4000,depthMm:3000,ceilingHeightMm:0}));
  assert.throws(()=>add(s,''));
  s=add(s); const id=s.present.rooms[0].id;
  s=move(s,id,13,-24);
  assert.equal(s.present.rooms[0].id,id);
  s=desfazer(desfazer(s)); s=add(s);
  assert.equal(s.present.rooms[0].id,'c2');
});

test('snap armazena parede exata, tolerância e contato ortogonal',()=>{
  let s=add(add(iniciar('leitura-teste')),'Quarto',3000,3000);
  assert.deepEqual(snap(s.present.rooms,'c2',4017,0,30),{xMm:4000,yMm:0});
  assert.deepEqual(snap(s.present.rooms,'c2',4031,0,30),{xMm:4031,yMm:0});
  assert.deepEqual(snap(s.present.rooms,'c2',0,3010,20),{xMm:0,yMm:3000});
  assert.deepEqual(snap(s.present.rooms,'c2',4017,9000,30),{xMm:4017,yMm:9000});
});

test('relações determinísticas, criadas/removidas e adjacência parcial',()=>{
  let s=move(add(add(iniciar('leitura-teste'))),'c2',4000,1500);
  const r=relacoes(s.present.rooms);
  assert.equal(r.length,1);
  assert.deepEqual(r,relacoes([...s.present.rooms].reverse()));
  assert.equal(relacoes(move(s,'c2',4001,1500).present.rooms).length,0);
  assert.equal(relacoes(move(s,'c2',4000,3000).present.rooms).length,0);
});

test('encaixe de parede também alinha extremidades próximas sem criar canto desconectado',()=>{
  let s=layoutL(); s=move(s,'c3',7500,0);
  assert.deepEqual(snap(s.present.rooms,'c3',13,3010,30),{xMm:0,yMm:3000});
  assert.deepEqual(snap(s.present.rooms,'c3',7100,3000,30),{xMm:7100,yMm:3000});
});

test('sobreposição e desconexão bloqueiam exportação sem reparo',()=>{
  let s=add(add(iniciar('leitura-teste')));
  assert.ok(problemas(s.present).some(p=>p.code==='DISCONNECTED_ROOM'));
  assert.throws(()=>exportar(s));
  s=move(s,'c2',2000,0);
  assert.ok(problemas(s.present).some(p=>p.code==='ROOM_OVERLAP'));
  const before=JSON.stringify(s); assert.throws(()=>exportar(s)); assert.equal(JSON.stringify(s),before);
});

test('undo/redo: adição, gesto único, dimensões, pé-direito e exclusão',()=>{
  let s=add(iniciar('leitura-teste')); const original=s.present;
  s=move(s,'c1',100,200);
  assert.deepEqual(desfazer(s).present,original);
  assert.deepEqual(refazer(desfazer(s)).present,s.present);
  s=aplicar(s,{type:'edit',id:'c1',name:'Estar',widthMm:5000,depthMm:3100,ceilingHeightMm:2800});
  assert.equal(desfazer(s).present.ceilingHeightMm,2700);
  const beforeDelete=s.present;
  s=aplicar(s,{type:'delete',id:'c1'});
  assert.deepEqual(desfazer(s).present,beforeDelete);
  s=add(desfazer(s),'Outro'); assert.equal(s.future.length,0);
});

test('exportação estável preserva IDs, origem e declarações; sem cadastro/aberturas',()=>{
  const s=layoutL(), before=JSON.stringify(s), text=exportar(s), d=JSON.parse(text);
  assert.equal(text,exportar(s)); assert.equal(JSON.stringify(s),before);
  assert.equal(d.rooms[0].walls.east,'c1-east');
  assert.equal(d.rooms[2].yMm,3000);
  assert.deepEqual(d.openings,[]); assert.deepEqual(d.references,[]);
  assert.equal(d.provenance.kind,'declared'); assert.equal(d.id,'leitura-teste');
  assert.equal(d.revision,s.revision);
  assert.equal(d.relations.length,2);
  assert.equal('propertyId' in d,false);
});

test('gate real: L de três cômodos produzido pelo frontend passa no M1-0 Python',()=>{
  const dir=mkdtempSync(join(tmpdir(),'capturador-'));
  try{
    const file=join(dir,'leitura.json'); writeFileSync(file,exportar(layoutL()),'utf8');
    const out=execFileSync('python',['-m','pipeline.validar_leitura',file],{encoding:'utf8'});
    assert.deepEqual(JSON.parse(out),{valid:true,errors:[]});
  }finally{rmSync(dir,{recursive:true,force:true});}
});
