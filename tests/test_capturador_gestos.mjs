// M1.1-B: o que o capturador em tela cheia pede ao modelo — soltar cômodo numa posição,
// achar a parede sob o dedo e sugerir a distância da abertura.
import assert from 'node:assert/strict';
import test from 'node:test';
import {iniciar, aplicar, geometriaParedes, paredeProxima, distanciaSugerida, exportar}
  from '../painel/src/components/construtor-planta/modelo.ts';

const add = (s, name, w, d, pos={}) => aplicar(s, {type:'add', name, widthMm:w, depthMm:d, ceilingHeightMm:2700, ...pos});
function layoutL() {
  let s=add(iniciar('leitura-gestos'),'Sala',4000,3000,{xMm:0,yMm:0});
  s=add(s,'Quarto',3000,3000,{xMm:4000,yMm:0});
  return add(s,'Cozinha',4000,2000,{xMm:0,yMm:3000});
}

test('cômodo solto fica onde foi solto; sem posição, o comportamento antigo continua',()=>{
  const s=add(iniciar('x'),'Sala',3430,2000,{xMm:-1250,yMm:775});
  assert.deepEqual(s.present.rooms[0],{id:'c1',name:'Sala',widthMm:3430,depthMm:2000,xMm:-1250,yMm:775});
  const antigo=add(add(iniciar('y'),'A',4000,3000),'B',3000,3000);
  assert.deepEqual(antigo.present.rooms.map(r=>[r.xMm,r.yMm]),[[0,0],[4500,0]]);
  for(const pos of [{xMm:1.5,yMm:0},{xMm:0},{yMm:0},{xMm:0,yMm:NaN}])
    assert.throws(()=>add(iniciar('z'),'S',1000,1000,pos),/milímetros inteiros/,JSON.stringify(pos));
  assert.match(exportar(layoutL()),/"geometry": "orthogonal-rectangles"/);
});

test('parede mais próxima: compartilhada vence pelo cômodo do dedo, longe não acha nada',()=>{
  const rooms=layoutL().present.rooms;
  assert.deepEqual(paredeProxima(rooms,4010,1500,300),{wall:geometriaParedes(rooms).find(w=>w.id==='c2-west'),t:1500});
  assert.equal(paredeProxima(rooms,3990,1500,300).wall.id,'c1-east');
  assert.deepEqual([paredeProxima(rooms,2000,100,300).wall.id,paredeProxima(rooms,2000,100,300).t],['c1-south',2000]);
  assert.equal(paredeProxima(rooms,2000,1500,300),null);
  assert.equal(paredeProxima(rooms,9000,9000,300),null);
  // na linha exata entre dois cômodos, os dois "contêm" o ponto: decide a ordem de ID
  assert.equal(paredeProxima(rooms,4000,1500,300).wall.id,'c1-east');
});

test('distância sugerida centraliza no dedo, a 1 cm, sem sair da parede',()=>{
  const w={id:'c1-south',roomId:'c1',label:'',axis:'x',fixed:0,start:0,end:4000};
  assert.equal(distanciaSugerida(w,2000,800),1600);
  assert.equal(distanciaSugerida(w,1234,800),830);
  assert.equal(distanciaSugerida(w,100,800),0);
  assert.equal(distanciaSugerida(w,3990,800),3200);
  assert.equal(distanciaSugerida({...w,end:3403},3400,800),2603);
  assert.equal(distanciaSugerida({...w,end:500},250,800),0);
});
