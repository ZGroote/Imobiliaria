/* Individual, photo-referenced exterior studies. Coordinates are metres, Y up. */
window.ListingModels = (() => {
  'use strict';
  const pack = JSON.parse(document.getElementById('__listingModels')?.textContent || '{"assets":[]}');
  const assets = new Map(pack.assets.map(a => [String(a.id), a]));
  let dialog, canvas, renderer, scene, camera, subject, note, title, priorFocus;
  let theta=.35, phi=1.12, distance=25, center, wholeCenter, front, radius=10, drag=null;
  function facade(){theta=0;phi=1.46;center=new THREE.Vector3(0,front.h/2,front.z);distance=Math.max(front.w/Math.max(.5,(canvas.clientWidth||960)/(canvas.clientHeight||400)),front.h)*1.95;}
  const decode=(s,Type)=>{const raw=atob(s),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new Type(bytes.buffer);};
  function render(){
    if(!dialog?.open)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    camera.position.set(center.x+distance*Math.sin(phi)*Math.sin(theta),center.y+distance*Math.cos(phi),center.z+distance*Math.sin(phi)*Math.cos(theta));
    camera.lookAt(center);renderer.render(scene,camera);
  }
  function setup(){
    dialog=document.createElement('dialog');dialog.className='listing-model-dialog';
    dialog.innerHTML='<header><div><small>ESTUDO DE EXTERIOR</small><h2 id="listing3d-title"></h2></div><button type="button" data-action="close" aria-label="Fechar modelo 3D">×</button></header><div class="listing-model-stage"><canvas aria-label="Modelo 3D do imóvel. Arraste para girar; use os controles para aproximar ou afastar."></canvas></div><footer><div class="listing-model-controls"><button type="button" data-action="front">Fachada</button><button type="button" data-action="overview">Vista geral</button><button type="button" data-action="in" aria-label="Aproximar modelo">+</button><button type="button" data-action="out" aria-label="Afastar modelo">−</button></div><p class="listing-model-note"></p><small>Arraste para girar · role para aproximar · Esc para fechar</small></footer>';
    dialog.setAttribute('aria-labelledby','listing3d-title');document.body.appendChild(dialog);
    canvas=dialog.querySelector('canvas');title=dialog.querySelector('h2');note=dialog.querySelector('.listing-model-note');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.outputEncoding=THREE.sRGBEncoding;renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xe5e9e3);
    scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.1,1000);
    scene.add(new THREE.HemisphereLight(0xffffff,0x747765,1));
    const sun=new THREE.DirectionalLight(0xfff2da,.8);sun.position.set(-15,30,25);scene.add(sun);
    dialog.querySelector('header button').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{drag=null;priorFocus?.focus();});
    dialog.querySelector('.listing-model-controls').onclick=e=>{
      const action=e.target.dataset.action;
      if(action==='front')facade();
      if(action==='overview'){theta=.55;phi=.95;center=wholeCenter.clone();distance=radius*2.8;}
      if(action==='in')distance=Math.max(3,distance*.8);
      if(action==='out')distance=Math.min(radius*7,distance*1.25);
      render();
    };
    canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;theta-=(e.clientX-drag.x)*.008;phi=Math.max(.12,Math.min(1.52,phi+(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY;render();});
    const end=()=>{drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(3,Math.min(radius*7,distance*Math.exp(e.deltaY*.001)));render();},{passive:false});
    new ResizeObserver(render).observe(canvas);
  }
  function open(id){
    const asset=assets.get(String(id));if(!asset)return false;
    if(!dialog)setup();priorFocus=document.activeElement;
    if(subject){scene.remove(subject);subject.geometry.dispose();subject.material.dispose();}
    const g=new THREE.BufferGeometry(),p=decode(asset.p,Int16Array),n=decode(asset.n,Int8Array);
    g.setAttribute('position',new THREE.BufferAttribute(Float32Array.from(p,v=>v/100),3));
    g.setAttribute('normal',new THREE.BufferAttribute(Float32Array.from(n,v=>v/127),3));
    g.setAttribute('color',new THREE.BufferAttribute(decode(asset.c,Uint8Array),3,true));g.setIndex(new THREE.BufferAttribute(decode(asset.i,Uint16Array),1));
    g.computeBoundingBox();g.computeBoundingSphere();wholeCenter=g.boundingBox.getCenter(new THREE.Vector3());center=wholeCenter.clone();radius=g.boundingSphere.radius;front=asset.front || {w:asset.size[0],h:asset.size[1],z:g.boundingBox.max.z};
    subject=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));scene.add(subject);
    title.textContent=asset.title;note.textContent=asset.note;
    dialog.showModal();facade();render();return true;
  }
  return {has:id=>assets.has(String(id)),open};
})();
