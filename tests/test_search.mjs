import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/ui/search.js',import.meta.url),'utf8'),ctx);

function city(target={x:0,z:0}){
  const pois=[{n:'Farmácia Central',cfg:{curto:'Farmácia',col:'#2FE0C8'},x:500,z:0},
    {n:'Farmácia Leste',cfg:{curto:'Farmácia',col:'#2FE0C8'},x:-3000,z:0},{n:'Catedral',cfg:{curto:'Igreja',col:'#B7A588'},x:10,z:0}];
  const s=ctx.CitySearch.create({pois,cls:['none','res','biz','civic'],target});
  s.indexaBusca(
    [{name:'CATEDRAL',c:3,r:[[0,0],[2,0]]},{name:'Farmácia Norte',c:2,r:[[0,0],[4,0],[4,4],[0,4]]},{c:1,r:[[0,0]]}],
    [{name:'Rua Farmácia',pts:[[0,0],[10,0],[10,100]]},{name:'Rua Farmácia',pts:[[900,0],[950,0]]},{name:'Sem pontos',pts:[[0,0]]},{pts:[[0,0],[1,1]]}]);
  return s;
}

test('index keeps POIs, one entry per street name at its longest segment, and buildings not already POIs',()=>{
  const s=city();
  assert.equal(JSON.stringify(s.BUSCA.map(i=>[i.k,i.n,i.s])),JSON.stringify([['poi','Farmácia Central','Farmácia'],['poi','Farmácia Leste','Farmácia'],
    ['poi','Catedral','Igreja'],['rua','Rua Farmácia','via'],['predio','Farmácia Norte','comércio']]));
  const rua=s.BUSCA[3];assert.equal(rua.x,10);assert.equal(rua.z,50);
  const predio=s.BUSCA[4];assert.equal(predio.x,2);assert.equal(predio.z,2);assert.equal(predio.q,'farmacia norte');
  s.indexaBusca([],[]);assert.equal(s.BUSCA.length,3);
});

test('query ignores accents and ranks prefix, kind and distance from the target',()=>{
  const target={x:0,z:0},s=city(target);
  assert.equal(JSON.stringify(s.buscaAgora('f')),JSON.stringify([]));
  assert.equal(JSON.stringify(s.buscaAgora(' FARMACIA ').map(i=>i.n)),JSON.stringify(['Farmácia Central','Farmácia Leste','Farmácia Norte','Rua Farmácia']));
  target.x=-3000;
  assert.equal(JSON.stringify(s.buscaAgora('farmacia').map(i=>i.n)),JSON.stringify(['Farmácia Leste','Farmácia Central','Farmácia Norte','Rua Farmácia']));
  assert.equal(s.semAcento('São JOSÉ'),'sao jose');
});
