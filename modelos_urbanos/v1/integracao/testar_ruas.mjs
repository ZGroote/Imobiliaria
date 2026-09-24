import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url);
vm.runInThisContext(fs.readFileSync(new URL('v1.5/renderizador-v16-moveis/lib/three.min.js',root),'utf8'));
const src=fs.readFileSync(new URL('v1.5/renderizador-v16-moveis/app.js',root),'utf8');
const begin=src.indexOf('const viaJunctions ='),end=src.indexOf('/* O ruido',begin);
vm.runInThisContext(`const registerTerrain=()=>{};const ROAD_W={residential:8,primary:24},HW=['residential','primary'];
const meshOf=P=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;};
${src.slice(begin,end)}`);
const T=globalThis.THREE, opt={de:1,junta:false,meiofio:true,y_baixo:.1};
const road=[{k:0,pts:[[0,0],[100,0]]}];
const asphalt=buildRibbons(road,.1,1),walk=buildRibbons(road,.32,1.55,opt);
const mesh=new T.Mesh(walk,new T.MeshBasicMaterial());mesh.updateMatrixWorld();
const ray=(o,d)=>new T.Raycaster(new T.Vector3(...o),new T.Vector3(...d)).intersectObject(mesh);
for(const sg of [-1,1]){
 const top=ray([50,2,sg*5],[0,-1,0]);assert(top.length,'visible sidewalk top on both sides');
 assert(Math.abs(top[0].point.y-.32)<1e-6);assert(top[0].face.normal.y>.99);
 const curb=ray([50,.2,0],[0,0,sg]);assert(curb.length,'curb faces street');
 assert(Math.abs(curb[0].point.z-sg*4)<1e-6);
 assert(curb[0].face.normal.z*sg<-.99);
 const cap=ray([0,.2,sg*5],[1,0,0]);assert(cap.length,'closed end cap');assert(cap[0].point.x>4);
}
const ap=asphalt.attributes.position;for(let i=0;i<ap.count;i++)assert(Math.abs(ap.getY(i)-.1)<1e-6);
assert.equal(walk.attributes.aVia.count,walk.attributes.position.count);
assert.equal(walk.attributes.aViaSurface.count,walk.attributes.position.count);
// Same terrain displacement used by the app: vertical faces remain visible and
// the sidewalk remains 22 cm above the reference road surface on a slope.
const p=walk.attributes.position;
for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+p.getX(i)*.02+p.getZ(i)*.03);
p.needsUpdate=true;walk.computeVertexNormals();walk.computeBoundingSphere();
for(const sg of [-1,1]){
 const hit=ray([50,5,sg*5],[0,-1,0])[0];assert(hit);
 assert(Math.abs(hit.point.y-(.32+1+sg*.15))<1e-5,'terrain preserves step');
}
walk.dispose();asphalt.dispose();mesh.material.dispose();
// A narrow residential street meets a wide avenue. Its raised sidewalk must
// stop outside the avenue even when the crossing is an intermediate polyline node.
const side={k:0,pts:[[0,-60],[0,0],[0,60]]},avenue={k:1,pts:[[-70,0],[0,0],[70,0]]};
indexaJuncoes([side,avenue]);
const crossing=buildRibbons([side],.32,1.55,opt),cp=crossing.attributes.position;
for(let i=0;i<cp.count;i++)assert(Math.abs(cp.getZ(i))>=12.29,'sidewalk cannot cross avenue');
const acute={k:1,pts:[[0,0],[50,50]]};indexaJuncoes([side,acute]);
assert(recuoJuncao(side,[0,0],0,1,6.2)>20,'acute angle reserves outer sidewalk corner');
crossing.dispose();indexaJuncoes([]);
console.log('PASS: both sidewalk tops, street-facing curbs, end caps, 22 cm elevation, terrain, vertex attributes.');
