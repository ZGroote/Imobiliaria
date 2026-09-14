import fs from 'node:fs';import vm from 'node:vm';
const root=new URL('../../../',import.meta.url);
const app=fs.readFileSync(new URL('renderizador-v16-moveis/app.js',root),'utf8');
vm.runInThisContext(fs.readFileSync(new URL('renderizador-v16-moveis/road-clearance.js',root),'utf8'));
vm.runInThisContext('const Q=10;'+app.slice(app.indexOf('const HW ='),app.indexOf('const BIGROAD'))+app.slice(app.indexOf('const shoelace ='),app.indexOf('/* ============================================================',app.indexOf('function decode(data)'))));
const html=fs.readFileSync(new URL('v16-moveis/sao-carlos-v16-moveis-aberto.html',root),'utf8');
const data=JSON.parse(html.match(/id="__citydata">([\s\S]*?)<\/script>/)[1]);
const {B,R}=decode(data),index=RoadClearance.create(R,w=>vm.runInThisContext('ROAD_W[HW['+w.k+']]')||6,0);
const hits=[];
for(const b of B){const road=index.hit(b.r);if(road)hits.push({x:b.r.reduce((n,p)=>n+p[0],0)/b.r.length,z:b.r.reduce((n,p)=>n+p[1],0)/b.r.length,h:b.h,road:road.name,ring:b.r});}
const result={buildings:B.length,roads:R.length,overlaps:hits.length,nearSanca:hits.filter(p=>Math.hypot(p.x+525,p.z+1598)<600).slice(0,12)};
fs.writeFileSync(new URL('modelos_urbanos/v1/integracao/auditoria-sobreposicao.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
