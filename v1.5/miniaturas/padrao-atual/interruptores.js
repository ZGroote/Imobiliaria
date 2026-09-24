// Per-room luminaire switches. Static transport is invalidated on first change.
var ROOMLIGHTS={ready:false,rooms:[],group:new THREE.Group()};cena.add(ROOMLIGHTS.group);window.__roomLights=ROOMLIGHTS;
// Keep the atlas and shadow precision; reduce fill rate on small/touch screens.
ROOMLIGHTS.mobile=CELULAR||matchMedia('(pointer:coarse)').matches;
if(ROOMLIGHTS.mobile)ren.setPixelRatio(Math.min(devicePixelRatio,1.25));
function invalidateRoomShadows(){ROOMLIGHTS.rooms.forEach(r=>r.light.shadow.needsUpdate=true);}
ren.domElement.addEventListener('webglcontextrestored',()=>{ROOMLIGHTS.shadowKey=null;invalidateRoomShadows();});
var lightPanel=document.createElement('details');lightPanel.id='interruptores';lightPanel.hidden=true;
lightPanel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:95;max-width:280px;max-height:55vh;overflow:auto;background:#17252bf5;color:#eef4f1;padding:12px;border:1px solid #547366;border-radius:10px;font:14px system-ui';
var summary=document.createElement('summary');summary.textContent='💡 Luzes do apartamento';summary.style.cursor='pointer';lightPanel.appendChild(summary);document.body.appendChild(lightPanel);
function dynamicRoomLights(){
 V3.disabled=true;V2.mode=null;
 V3.materials.forEach(m=>{m.lightMapIntensity=0;if(m.userData.shader)m.userData.shader.uniforms.v3Active.value=0;});
 v3Status.textContent='Iluminação controlada pelos interruptores.';v3Status.hidden=false;
 setTimeout(()=>{v3Status.hidden=true;},3000);
}
function prepareRoomLights(){
 if(ROOMLIGHTS.ready||!V3.ready)return;ROOMLIGHTS.ready=true;
 var lamps=[];planta3d.traverse(o=>{if(o.name==='plafon'){o.material=o.material.clone();lamps.push(o);}});
 PL_R.comodos.forEach((c,i)=>{
  var x=c.cx-PL_R.ob.cx,z=c.cz-PL_R.ob.cz;
  var light=new THREE.SpotLight(0xfff1da,15,7,1.42,.85,1.5);light.position.set(x,PL_R.pd-.20,z);light.target.position.set(x,0,z);light.castShadow=true;
  light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.05;light.shadow.camera.far=7;light.shadow.bias=-.001;light.shadow.normalBias=.045;
  light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
  ROOMLIGHTS.group.add(light,light.target);
  var lamp=lamps[i],row={name:c.nome,on:true,light,lamp};ROOMLIGHTS.rooms.push(row);
  var button=document.createElement('button');button.type='button';button.setAttribute('role','switch');button.setAttribute('aria-checked','true');button.dataset.room=String(i);
  button.style.cssText='display:block;width:100%;padding:10px;margin-top:8px;text-align:left;color:inherit;background:#284439;border:1px solid #719987;border-radius:6px;cursor:pointer';
  function paint(){button.textContent=c.nome+' · '+(row.on?'Ligada':'Desligada');button.setAttribute('aria-checked',String(row.on));button.style.background=row.on?'#284439':'#30373b';}
  button.onclick=()=>{row.on=!row.on;dynamicRoomLights();paint();};paint();lightPanel.appendChild(button);
 });
}
var beforeRoomLights=aplicaEstudoV2;
aplicaEstudoV2=function(){
 beforeRoomLights();var inside=modo==='visita'||modo==='planta3d';lightPanel.hidden=!inside;
 prepareRoomLights();ROOMLIGHTS.group.visible=inside&&V3.disabled;
 // Zero intensity alone does not stop Three.js rendering a shadow map.
 cena.children.filter(o=>o.isDirectionalLight).forEach(o=>{
  if(o.userData.exteriorCastShadow===undefined)o.userData.exteriorCastShadow=o.castShadow;
  o.castShadow=inside?false:o.userData.exteriorCastShadow;
 });
 if(!inside||!V3.disabled)return;
 // No exterior sun projected through the open cutaway plan or a non-shadowing roof.
 // Dynamic interior is lit by the actual ceiling fixtures and a modest sky fill.
 V2.lights.visible=false;cena.children.filter(o=>o.isDirectionalLight).forEach(o=>o.intensity=0);
 var hemi=cena.children.find(o=>o.isHemisphereLight);if(hemi)hemi.intensity=.14;
 V3.materials.forEach(m=>m.envMapIntensity=.10);
 if(tetoVisita)tetoVisita.traverse(o=>{if(o.isMesh)o.castShadow=o.name!=='plafon';});
 ROOMLIGHTS.rooms.forEach(r=>{r.light.intensity=r.on?15:0;if(r.lamp)r.lamp.material.color.setHex(r.on?0xfff7e2:0x787976);});
 // The editor replaces meshes, including after undo/reset. Include identities,
 // transforms, switches and cutaway mode; camera movement does not change shadows.
 var key=modo+'|'+ROOMLIGHTS.rooms.map(r=>r.on?1:0).join('')+'|'+planta3d.children.filter(o=>o.userData.movel).map(o=>[o.id,...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray()].join(',')).join(';');
 if(key!==ROOMLIGHTS.shadowKey){ROOMLIGHTS.shadowKey=key;invalidateRoomShadows();}
};
