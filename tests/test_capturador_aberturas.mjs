import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {iniciar,aplicar,desfazer,refazer,exportar,problemas,metrosParaMm}
  from '../painel/src/components/construtor-planta/modelo.ts';

const door={kind:'door',wallId:'c1-east',offsetMm:500,widthMm:900,heightMm:2100,sillMm:0};
function rooms(partial=false){
  let s=iniciar('leitura-aberturas');
  s=aplicar(s,{type:'add',name:'Sala',widthMm:4000,depthMm:4000,ceilingHeightMm:2700});
  s=aplicar(s,{type:'add',name:'Quarto',widthMm:3000,depthMm:partial?2000:4000,ceilingHeightMm:2700});
  return aplicar(s,{type:'move',id:'c2',xMm:4000,yMm:partial?2000:0});
}
const add=(s,opening=door)=>aplicar(s,{type:'opening-add',...opening});
const window={kind:'window',wallId:'c1-south',offsetMm:1000,widthMm:1200,heightMm:1000,sillMm:1100};
test('download mobile preservado byte a byte: export real passa M1-0 e M1-A',()=>{
  const text=readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8');
  const doc=JSON.parse(text);
  let s=iniciar(doc.id);
  s=aplicar(s,{type:'add',name:'Sala',widthMm:4000,depthMm:4000,ceilingHeightMm:2700});
  s=aplicar(s,{type:'add',name:'Quarto',widthMm:3000,depthMm:4000,ceilingHeightMm:2700});
  for(let x=4400;x>=4000;x-=100) s=aplicar(s,{type:'move',id:'c2',xMm:x,yMm:0});
  s=add(s,{...door,wallId:'c2-west'});
  s=aplicar(s,{type:'opening-edit',id:'a1',...door,wallId:'c2-west',widthMm:1000});
  s=desfazer(aplicar(s,{type:'opening-delete',id:'a1'}));
  s=add(s,window);
  assert.equal(exportar(s),text);
  pipeline(s,out=>{
    const d=out.planta.portas[0],w=out.planta.janelas[0];
    assert.equal(d.wallId,'c2-west');assert.equal(d.pairedWallId,'c1-east');
    assert.deepEqual(d.p,[4,1]);assert.deepEqual([d.largura,d.y0,d.y1],[1,0,2.1]);
    assert.equal(w.wallId,'c1-south');assert.equal('pairedWallId' in w,false);
    assert.deepEqual(w.p,[1.6,0]);assert.deepEqual([w.largura,w.y0,w.y1],[1.2,1.1,2.1]);
  });
});
function pipeline(s,check){
  const dir=mkdtempSync(join(tmpdir(),'aberturas-'));
  try{
    const file=join(dir,'leitura.json'), text=exportar(s);writeFileSync(file,text);
    assert.deepEqual(JSON.parse(execFileSync('python',['-m','pipeline.validar_leitura',file],{encoding:'utf8'})),{valid:true,errors:[]});
    const derived=JSON.parse(execFileSync('python',['-m','pipeline.normalizar_planta',file],{encoding:'utf8'}));
    assert.equal(readFileSync(file,'utf8'),text);check?.(derived,JSON.parse(text));
  }finally{rmSync(dir,{recursive:true,force:true});}
}
test('porta interna determina par correto e janela externa omite par',()=>{
  const s=add(add(rooms()),window), d=JSON.parse(exportar(s));
  assert.equal(d.openings[0].pairedWallId,'c2-west');
  assert.equal('pairedWallId' in d.openings[1],false);
  assert.equal(d.openings[0].provenance.kind,'declared');pipeline(s);
});
test('offset zero e limite exato permitidos; 1 mm além recusado sem mutação',()=>{
  assert.equal(metrosParaMm('0',true),0);
  assert.throws(()=>metrosParaMm('0'));
  const s=rooms(), before=JSON.stringify(s);
  pipeline(add(s,{...window,offsetMm:2800}));
  pipeline(add(s,{...window,offsetMm:0}));
  assert.throws(()=>add(s,{...window,offsetMm:2801}),/parede/i);
  assert.equal(JSON.stringify(s),before);
});
test('parede parcial: trecho interno ganha par; trecho externo não',()=>{
  const internal=add(rooms(true),{...door,offsetMm:2200});
  assert.equal(internal.present.openings[0].pairedWallId,'c2-west');pipeline(internal);
  const external=add(rooms(true),{...door,offsetMm:0});
  assert.equal('pairedWallId' in external.present.openings[0],false);pipeline(external);
});
test('cruzar fronteira interna/externa ou dois pares distintos é recusado',()=>{
  assert.throws(()=>add(rooms(true),{...door,offsetMm:1500}),/compartilhado/i);
  let s=rooms(true);
  s=aplicar(s,{type:'add',name:'Outro',widthMm:3000,depthMm:2000,ceilingHeightMm:2700});
  s=aplicar(s,{type:'move',id:'c3',xMm:4000,yMm:0});
  assert.throws(()=>add(s,{...door,offsetMm:1500}),/compartilhado/i);
});
test('sobreposição física: mesma parede e faces opostas são recusadas',()=>{
  const s=add(rooms());
  assert.throws(()=>add(s,{...door,offsetMm:600}),/sobrepo/i);
  assert.throws(()=>add(s,{...door,wallId:'c2-west',offsetMm:600}),/sobrepo/i);
});
test('aberturas lado a lado ou separadas verticalmente não se sobrepõem',()=>{
  pipeline(add(add(rooms()),{...door,offsetMm:1400}));
  pipeline(add(add(rooms()),{...door,kind:'window',heightMm:600,sillMm:2100}));
});
test('altura/peitoril: acima do teto, porta elevada e mm fracionário recusados',()=>{
  assert.throws(()=>add(rooms(),{...window,sillMm:1701}),/direito/i);
  assert.throws(()=>add(rooms(),{...door,sillMm:1}),/peitoril/i);
  assert.throws(()=>add(rooms(),{...door,widthMm:900.5}));
});
test('par inexistente ou indevido bloqueia exportação mesmo em estado adulterado',()=>{
  const s=add(rooms());
  for(const pairedWallId of ['c1-west',undefined]){
    const bad={...s,present:{...s.present,openings:[{...s.present.openings[0],pairedWallId}]}};
    assert.throws(()=>exportar(bad),/par/i);
  }
});
test('editar/excluir/undo/redo preserva ID; novo ID não recicla após undo',()=>{
  let s=add(rooms()), id=s.present.openings[0].id;
  s=aplicar(s,{type:'opening-edit',id,...door,widthMm:1000});
  assert.equal(s.present.openings[0].id,id);
  assert.equal(desfazer(s).present.openings[0].widthMm,900);
  assert.equal(refazer(desfazer(s)).present.openings[0].widthMm,1000);
  s=aplicar(s,{type:'opening-delete',id});
  assert.equal(s.present.openings.length,0);
  assert.equal(desfazer(s).present.openings[0].id,id);
  assert.equal(refazer(desfazer(s)).present.openings.length,0);
  const fresh=add(desfazer(desfazer(desfazer(s))),window);
  assert.notEqual(fresh.present.openings[0].id,id);
});
test('o par acompanha o cômodo; medida inválida não é reparada; excluir dono e undo são atômicos',()=>{
  let s=add(rooms());
  // o quarto sobe e a porta (y 500..1400) fica no trecho externo: dá para fora, sem erro
  const fora=aplicar(s,{type:'move',id:'c2',xMm:4000,yMm:3000});
  assert.equal('pairedWallId' in fora.present.openings[0],false);
  assert.equal(problemas(fora.present).length,0);pipeline(fora);
  // de volta ao lugar, a porta volta a ser comum aos dois
  assert.equal(aplicar(fora,{type:'move',id:'c2',xMm:4000,yMm:0}).present.openings[0].pairedWallId,'c2-west');
  // metade dentro, metade fora: não há par possível e continua erro
  const cruzando=aplicar(s,{type:'move',id:'c2',xMm:4000,yMm:1000});
  assert.ok(problemas(cruzando.present).some(p=>p.code==='INVALID_OPENING'&&/compartilhado/.test(p.message)));
  assert.throws(()=>exportar(cruzando));
  const lower=aplicar(s,{type:'edit',id:'c1',name:'Sala',widthMm:4000,depthMm:4000,ceilingHeightMm:2000});
  assert.throws(()=>exportar(lower));
  s=aplicar(s,{type:'delete',id:'c1'});
  assert.equal(s.present.openings.length,0);
  assert.equal(desfazer(s).present.openings.length,1);
});
test('export real → M1-0 → M1-A: pares, centro, largura, y0/y1 e revisão',()=>{
  const s=add(add(rooms()),window);
  pipeline(s,(out,doc)=>{
    const [d]=out.planta.portas,[w]=out.planta.janelas;
    assert.equal(d.wallId,'c1-east');assert.equal(d.pairedWallId,'c2-west');
    assert.deepEqual(d.p,[4,0.95]);assert.equal(d.largura,0.9);
    assert.deepEqual([d.y0,d.y1],[0,2.1]);
    assert.equal(w.wallId,'c1-south');assert.equal('pairedWallId' in w,false);
    assert.deepEqual(w.p,[1.6,0]);assert.equal(w.largura,1.2);
    assert.deepEqual([w.y0,w.y1],[1.1,2.1]);
    assert.equal(out.source.id,doc.id);assert.equal(out.source.revision,doc.revision);
  });
});
test('offset sempre progride na coordenada crescente, inclusive north/west e negativos',()=>{
  let s=aplicar(iniciar('leitura-origens'),{type:'add',name:'Sala',widthMm:4000,depthMm:3000,ceilingHeightMm:2700});
  s=aplicar(s,{type:'move',id:'c1',xMm:-2000,yMm:-1000});
  s=add(s,{...window,wallId:'c1-north',offsetMm:501,widthMm:901});
  s=add(s,{...door,wallId:'c1-west',offsetMm:501,widthMm:901});
  pipeline(s,out=>{
    assert.deepEqual(out.planta.janelas[0].p,[-1.0485,2]);
    assert.deepEqual(out.planta.portas[0].p,[-2,-0.0485]);
  });
});
test('cômodo encostado depois na parede da porta torna a porta comum aos dois',()=>{
  let s=aplicar(iniciar('leitura-par'),{type:'add',name:'Sala',widthMm:4000,depthMm:4000,ceilingHeightMm:2700});
  s=add(s);                                              // porta na parede leste, ainda externa
  assert.equal('pairedWallId' in s.present.openings[0],false);
  s=aplicar(s,{type:'add',name:'Quarto',widthMm:3000,depthMm:4000,ceilingHeightMm:2700,xMm:4000,yMm:0});
  assert.equal(s.present.openings[0].pairedWallId,'c2-west');
  assert.equal(problemas(s.present).length,0);pipeline(s);
  // excluir o quarto devolve a porta para fora; desfazer restaura o par
  const sem=aplicar(s,{type:'delete',id:'c2'});
  assert.equal('pairedWallId' in sem.present.openings[0],false);pipeline(sem);
  assert.equal(desfazer(sem).present.openings[0].pairedWallId,'c2-west');
});
