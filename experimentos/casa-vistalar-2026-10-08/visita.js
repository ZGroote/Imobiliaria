import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createNavigation} from './navigation.mjs';

const $=id=>document.getElementById(id), canvas=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color('#bdd0d6');scene.fog=new THREE.Fog('#bdd0d6',40,100);
const camera=new THREE.PerspectiveCamera(57,1,.06,150);camera.position.set(6.5,4.8,18);
const orbit=new OrbitControls(camera,canvas);orbit.target.set(-.8,2.4,-2.2);orbit.enableDamping=true;orbit.maxPolarAngle=Math.PI*.49;orbit.minDistance=10;orbit.maxDistance=42;orbit.maxTargetRadius=12;
const pmrem=new THREE.PMREMGenerator(renderer);const env=new RoomEnvironment();scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();scene.environmentIntensity=.55;
const hemisphere=new THREE.HemisphereLight('#dbeaf0','#968970',1.6);scene.add(hemisphere);
const sun=new THREE.DirectionalLight('#fff0d5',3.1);sun.position.set(-10,15,10);sun.target.position.set(-1,1,-3);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.5,far:50});sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;
const practicals=[];
for(const [x,y,z,p] of [[-4.9,2.95,-3.2,20],[-4.8,2.8,-6,16],[-2.3,2.7,-6,17],[-4.8,6.2,-4,18],[-2.4,6.2,-5.8,15],[4,3,-2.5,28]]){const light=new THREE.PointLight('#ffd29d',p,8,2);light.position.set(x,y,z);scene.add(light);practicals.push(light);}
const conf=await fetch('./navigation.json').then(r=>r.json()), nav=createNavigation(conf);
const FP={pos:new THREE.Vector3(-3.55,conf.ground+conf.eye,-1.45),yaw:0,mov:{x:0,z:0}},keys={};let feet=conf.ground,pitch=0,walking=false,model,doors=[],staticBoxes=[],nearest=null,lastRoom='',mapFloor=0;
const touch=matchMedia('(pointer:coarse)').matches;
const walker=FirstPerson.create({FP,teclas:keys,livre:(x,z)=>nav.canMove(x,-z,feet,[...staticBoxes,...doors.map(d=>d.box)]),joy:$('joystick'),TOQUE:touch});
const toThree=a=>new THREE.Vector3(a[0],a[2],-a[1]);
function exteriorPose(){const factor=Math.max(1,.90/camera.aspect);camera.position.set(-.8+7.3*factor,2.4+2.4*factor,-2.2+20.2*factor);orbit.target.set(-.8,2.4,-2.2);}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();if(!walking)exteriorPose();}
new ResizeObserver(resize).observe(canvas);resize();
function setMode(w){walking=w;orbit.enabled=!w;$('walk').classList.toggle('selected',w);$('exterior').classList.toggle('selected',!w);$('crosshair').hidden=!w;$('enter').hidden=w;walker.mostraJoy(w);$('hint').textContent=w?(touch?'Arraste para olhar · use o controle para andar':'WASD para andar · arraste para olhar · F abre portas'):'Arraste para girar · role para aproximar';if(!w){exteriorPose();$('floor').textContent='VISTA EXTERNA';$('room-title').textContent='Linhas puras. Luz natural.';nearest=null;$('door').hidden=true;}canvas.focus({preventScroll:true});}
function visit(id){const room=conf.rooms.find(r=>r.id===id);if(!room)return;if(room.id==='fachada'){setMode(false);return;}setMode(true);feet=room.position[2];FP.pos.copy(toThree(room.position));FP.pos.y+=conf.eye;const t=toThree(room.target).sub(FP.pos);FP.yaw=Math.atan2(-t.x,-t.z);pitch=Math.max(-.45,Math.min(.45,Math.atan2(t.y,Math.hypot(t.x,t.z))));lastRoom='';updateRoom();}
function updateRoom(){if(!walking)return;const level=feet>2?1:0;$('floor').textContent=level?'PAVIMENTO SUPERIOR':'TÉRREO';const room=conf.rooms.find(r=>r.id!=='fachada'&&r.floor===level&&nav.inside(FP.pos.x,-FP.pos.z,r.bounds));const id=room?.id||'escada';if(lastRoom===id&&mapFloor===level)return;lastRoom=id;$('room-title').textContent=room?.name||'Escada e circulação';for(const b of $('room-list').children)b.classList.toggle('active',b.dataset.room===id);mapFloor=level;drawMap();}
function toggleDoor(d=nearest){if(!d)return;d.open=!d.open;}
function daylight(dusk){$('day').classList.toggle('selected',!dusk);$('dusk').classList.toggle('selected',dusk);scene.background.set(dusk?'#889297':'#bdd0d6');scene.fog.color.copy(scene.background);sun.color.set(dusk?'#ffc68b':'#fff0d5');sun.intensity=dusk?1.8:3.1;sun.position.set(-12,dusk?4:15,10);hemisphere.intensity=dusk?1.0:1.6;scene.environmentIntensity=dusk?.40:.55;practicals.forEach(l=>l.intensity=l.userData.day*(dusk?2.4:1));renderer.toneMappingExposure=dusk?1.1:1.05;sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;}
for(const l of practicals)l.userData.day=l.intensity;
$('exterior').onclick=()=>setMode(false);$('walk').onclick=$('enter').onclick=()=>{const entry=doors.find(d=>d.root.userData.label==='Entrada principal');if(entry)entry.open=true;visit('sala');};$('day').onclick=()=>daylight(false);$('dusk').onclick=()=>daylight(true);$('door').onclick=()=>toggleDoor();
for(const room of conf.rooms){const b=document.createElement('button');b.textContent=room.name;b.dataset.room=room.id;b.onclick=()=>visit(room.id);$('room-list').append(b);}
function drawMap(){const svg=$('plan');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';function element(tag,attrs,parent=svg){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}const mx=x=>25+(x+6.6)*37,my=y=>305-y*37;
 for(const r of conf.rooms.filter(r=>r.id!=='fachada'&&r.floor===mapFloor).sort((a,b)=>(b.id==='escada')-(a.id==='escada'))){const g=element('g',{tabindex:0,role:'button','aria-label':r.name});const b=r.bounds;element('rect',{x:mx(b[0]),y:my(b[3]),width:(b[1]-b[0])*37,height:(b[3]-b[2])*37,rx:2},g);const t=element('text',{x:mx((b[0]+b[1])/2),y:my((b[2]+b[3])/2),'text-anchor':'middle'},g);t.textContent=r.name.replace('Sala de estar','Sala').replace('Hall superior','Hall');g.onclick=()=>visit(r.id);g.onkeydown=e=>{if(e.key==='Enter')visit(r.id);};}
 if(walking&&(feet>2?1:0)===mapFloor)element('circle',{id:'you',cx:mx(FP.pos.x),cy:my(-FP.pos.z),r:5});$('map-ground').classList.toggle('selected',mapFloor===0);$('map-upper').classList.toggle('selected',mapFloor===1);
}
$('map-toggle').onclick=()=>{$('map').hidden=!$('map').hidden;$('map-toggle').setAttribute('aria-expanded',String(!$('map').hidden));drawMap();};$('map-close').onclick=()=>{$('map').hidden=true;$('map-toggle').setAttribute('aria-expanded','false');};$('map-ground').onclick=()=>{mapFloor=0;drawMap();};$('map-upper').onclick=()=>{mapFloor=1;drawMap();};
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const k=e.key.toLowerCase();if(['w','a','s','d','q','e','shift'].includes(k)){keys[k]=true;if(walking)e.preventDefault();}if(k==='f'&&!e.repeat)toggleDoor();if(k==='escape'){Object.keys(keys).forEach(k=>keys[k]=false);}});addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);addEventListener('blur',()=>Object.keys(keys).forEach(k=>keys[k]=false));
let drag=null;canvas.addEventListener('pointerdown',e=>{if(!walking)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!walking||!drag||drag.id!==e.pointerId)return;FP.yaw-=(e.clientX-drag.x)*.004;pitch=Math.max(-1.15,Math.min(1.15,pitch-(e.clientY-drag.y)*.003));drag.x=e.clientX;drag.y=e.clientY;});for(const ev of ['pointerup','pointercancel'])canvas.addEventListener(ev,()=>drag=null);
function isUnderDoor(o){for(let p=o.parent;p;p=p.parent)if(p.userData.door)return true;return false;}
try{
 const decoder=new DRACOLoader().setDecoderPath('./vendor/draco/').setWorkerLimit(2);
 const gltf=await new GLTFLoader().setDRACOLoader(decoder).loadAsync('./casa-vistalar-web-draco.glb',e=>{$('progress').textContent=e.total?`Carregando a casa · ${Math.round(e.loaded/e.total*100)}%`:'Carregando geometria e materiais…';});decoder.dispose();model=gltf.scene;scene.add(model);model.updateMatrixWorld(true);
 model.traverse(o=>{if(o.userData.door){doors.push({root:o,base:o.position.clone(),angle:o.rotation.y,open:false,value:0,box:new THREE.Box3().setFromObject(o)});}if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.transmission>.1){m.transmission=0;m.transparent=true;m.opacity=.16;m.depthWrite=false;m.roughness=.08;m.side=THREE.DoubleSide;o.castShadow=false;}if(m.name.includes('Foliage')){m.side=THREE.DoubleSide;o.castShadow=false;}}if(o.userData.collidable&&!isUnderDoor(o)){const box=new THREE.Box3().setFromObject(o);box.slopedStairGuard=o.name.replaceAll('_',' ').includes('Stair glass guard');staticBoxes.push(box);}});
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;sun.shadow.needsUpdate=true;$('loading').hidden=true;drawMap();
 canvas.dataset.geometry=JSON.stringify({config:conf,boxes:staticBoxes.map(b=>({slopedStairGuard:!!b.slopedStairGuard,min:{x:b.min.x,y:b.min.y,z:b.min.z},max:{x:b.max.x,y:b.max.y,z:b.max.z}})),doors:doors.map(d=>({name:d.root.userData.label,min:d.box.min.toArray(),max:d.box.max.toArray()}))});
}catch(error){console.error(error);$('progress').textContent='Não foi possível carregar a visita. Recarregue a página pelo servidor local.';$('loading').querySelector('.spinner').hidden=true;}
let last=performance.now(),frame=0;
function animate(now){requestAnimationFrame(animate);if(now-last<32||document.hidden)return;const dt=Math.min(.05,(now-last)/1000);last=now;frame++;let moved=false;
 for(const d of doors){const target=d.open?1:0;if(Math.abs(target-d.value)>.001){d.value=THREE.MathUtils.damp(d.value,target,7,dt);if(d.root.userData.slide)d.root.position.x=d.base.x-d.value*d.root.userData.travel;else d.root.rotation.y=d.angle+d.value*d.root.userData.travel;d.root.updateMatrixWorld(true);d.box.setFromObject(d.root);moved=true;}}
 if(moved){sun.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;}
 if(walking){walker.fpPasso(dt);feet=nav.height(FP.pos.x,-FP.pos.z,feet)??feet;FP.pos.y=THREE.MathUtils.damp(FP.pos.y,feet+conf.eye,16,dt);camera.position.copy(FP.pos);camera.rotation.order='YXZ';camera.rotation.set(pitch,FP.yaw,0);updateRoom();if(frame%15===0){nearest=doors.filter(d=>Math.abs(d.root.position.y-feet)<.5).sort((a,b)=>a.box.distanceToPoint(FP.pos)-b.box.distanceToPoint(FP.pos))[0];if(nearest&&nearest.box.distanceToPoint(FP.pos)>2.1)nearest=null;$('door').hidden=!nearest;if(nearest)$('door').textContent=`${nearest.open?'Fechar':'Abrir'} ${nearest.root.userData.label} · F`;if(!$('map').hidden)drawMap();}}
 else orbit.update();renderer.render(scene,camera);if(frame%30===0)canvas.dataset.state=JSON.stringify({ready:!!model,walking,feet,position:FP.pos.toArray(),room:lastRoom,doors:doors.map(d=>({name:d.root.userData.label,open:d.open,value:d.value})),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
}requestAnimationFrame(animate);
