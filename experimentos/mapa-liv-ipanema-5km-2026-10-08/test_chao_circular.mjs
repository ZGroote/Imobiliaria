import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import vm from 'node:vm';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const snapshot=readFileSync(resolve(here,'../../v16-moveis/publicado/mapa/sao-carlos-exteriores-f16b0250b705.html'),'utf8');
const tag=[...snapshot.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].find(m=>/id="__three"/.test(m[1]));
const context=vm.createContext({console});
vm.runInContext(inflateRawSync(Buffer.from(tag[2].trim(),'base64')).toString('utf8'),context);
vm.runInContext(readFileSync(resolve(here,'chao-circular.js'),'utf8'),context);
const T=context.THREE,center=[-3216.4283207855997,-3179.4802476268346],radius=5000;
function build(registry=[]){
  return context.LivCircularGround.build({THREE:T,scene:new T.Scene(),center,radius,
    elevation:new Float32Array(80*80).fill(150),n:80,half:9500,subdivisions:4,exaggeration:1,
    sampleHeight:()=>150,sampleNDVI:()=>.35,registry,noiseGLSL:'',registerTerrain:()=>{}});
}
function area(g){const p=g.attributes.position,idx=g.index.array;let sum=0;
  for(let i=0;i<idx.length;i+=3){const [a,b,c]=[idx[i],idx[i+1],idx[i+2]];
    sum+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;}
  return sum;
}
function covers(g,x,z){const p=g.attributes.position,idx=g.index.array;
  for(let i=0;i<idx.length;i+=3){const [a,b,c]=[idx[i],idx[i+1],idx[i+2]],ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
    const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(!d)continue;
    const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;
    if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)return true;
  }return false;
}
test('continuous circle covers empty centre and interior without external vertices',()=>{
  const m=build(),g=m.geometry,p=g.attributes.position,certificate=m.userData.circularGround;
  for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i)-center[0],p.getZ(i)-center[1])<=radius);
  const expected=720/2*(radius-.01)**2*Math.sin(2*Math.PI/720);
  assert.ok(Math.abs(area(g)-expected)<4,'whole inscribed disc, without overlap or missing cells');
  assert.ok(area(g)>Math.PI*radius**2*.99995);
  for(const d of [0,1000,2500,4500])for(let j=0;j<12;j++)assert.ok(covers(g,center[0]+d*Math.cos(j*Math.PI/6),center[1]+d*Math.sin(j*Math.PI/6)));
  assert.ok(certificate.vertices<30000&&certificate.triangles<50000);
  assert.equal(certificate.policy,'continuous-circle');
});
test('source clearance keeps circular base beneath lower detail surfaces',()=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array([
    center[0]-100,0,center[1]-100,center[0]+100,0,center[1]-100,center[0],0,center[1]+100]),3));
  g.userData.chaoDetalhe=true;g.userData.terrain={dy:new Float32Array([100,100,100])};
  const m=build([g]);assert.ok(m.userData.desceMax>=50);assert.ok(m.userData.folga>=1.5);
  const p=m.geometry.attributes.position;
  for(let i=0;i<p.count;i++)if(Math.hypot(p.getX(i)-center[0],p.getZ(i)-center[1])<40)assert.ok(p.getY(i)+150<100);
});
