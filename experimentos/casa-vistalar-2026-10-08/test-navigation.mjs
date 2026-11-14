import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createNavigation} from './navigation.mjs';
const geometry=JSON.parse(fs.readFileSync(new URL('./browser-geometry.json',import.meta.url),'utf8'));
const {config,boxes}=geometry, nav=createNavigation(config),results=[];
for(const room of config.rooms.filter(r=>r.id!=='fachada')){
 const [x,y,z]=room.position;
 const blocked=nav.blocked(x,y,z,boxes);results.push({room:room.id,spawnClear:!blocked});
}
let h=config.ground;const stair=[];
for(let y=1.3;y<6.76;y+=.025){const next=nav.height(-.60,y,h);if(next===null||!nav.canMove(-.60,y,h,boxes)){stair.push({y:+y.toFixed(3),height:h,next,blocked:nav.blocked(-.60,y,next??h,boxes)});break;}h=next;}
results.push({stairAscent:stair.length===0,arrivedHeight:h,failures:stair});
let descend=config.upper;const down=[];
for(let y=6.75;y>1.3;y-=.025){const next=nav.height(-.60,y,descend);if(next===null||!nav.canMove(-.60,y,descend,boxes)){down.push({y:+y.toFixed(3),height:descend,next,blocked:nav.blocked(-.60,y,next??descend,boxes)});break;}descend=next;}
results.push({stairDescent:down.length===0,arrivedHeight:descend,failures:down});
let point=[-.60,6.75],corridor=[];
for(const target of [[.34,6.75],[.34,1.10],[-2.05,1.10],[-2.05,1.45]]){
 const distance=Math.hypot(target[0]-point[0],target[1]-point[1]),start=[...point];
 for(let i=1;i<=Math.ceil(distance/.025);i++){const t=i/Math.ceil(distance/.025);const x=start[0]+(target[0]-start[0])*t,y=start[1]+(target[1]-start[1])*t;if(!nav.canMove(x,y,config.upper,boxes)){corridor.push({x,y});break;}}
 point=target;if(corridor.length)break;
}
results.push({upperCorridorClear:corridor.length===0,failures:corridor});
for(const level of [0,1]){
 const rooms=config.rooms.filter(r=>r.floor===level&&r.id!=='fachada'&&r.id!=='escada');
 const z=level?config.upper:config.ground, step=.07, xmin=-6.5,ymin=-.45;
 const cell=(x,y)=>[Math.round((x-xmin)/step),Math.round((y-ymin)/step)];
 const start=cell(...rooms[0].position),queue=[start],seen=new Set([start.join(',')]);
 for(let i=0;i<queue.length;i++){
  const [a,b]=queue[i];for(const [da,db]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const c=a+da,d=b+db,key=c+','+d,x=xmin+c*step,y=ymin+d*step;
   if(seen.has(key)||x<xmin||x>.58||y<ymin||y>7.27)continue;
   if(nav.canMove(x,y,z,boxes)){seen.add(key);queue.push([c,d]);}
  }
 }
 const accessible=rooms.map(r=>({room:r.id,reachable:seen.has(cell(...r.position).join(','))}));
 results.push({floor:level,connected:accessible.every(r=>r.reachable),accessible});
}
const wallBox=[{min:{x:0,y:0,z:0},max:{x:.2,y:3,z:4}}];
assert.equal(nav.canMove(.1,-2,.59,wallBox),false,'wall must block walking');
assert.equal(nav.height(8,3,3.71),null,'upper floor must stop at its boundary');
fs.writeFileSync(new URL('./navigation-tests.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
assert.ok(results.every(r=>r.spawnClear!==false&&r.stairAscent!==false&&r.stairDescent!==false&&r.upperCorridorClear!==false&&r.connected!==false),'room spawns, staircase and all room doorways must be connected');
