import * as THREE from 'three/webgpu';

export const dimensionsOf=item=>({w:item.w,h:item.h,d:item.d});
export function validFurnitureDimensions(value,height){
  return Boolean(value&&['w','d'].every(key=>Number.isFinite(value[key])&&value[key]>=.2&&value[key]<=3.5)&&
    Number.isFinite(value.h)&&value.h>=.01&&value.h<=height);
}
export const sameFurnitureDimensions=(a,b)=>['w','h','d'].every(key=>Math.abs(a[key]-b[key])<1e-9);

// Editor local: usa as mesmas fábricas paramétricas da mobília original.
export function createFurnitureEditor({canvas,camera,scene,furniture,state,listen}){
  const panel=document.querySelector('#furniture-panel'),select=document.querySelector('#furniture-select');
  const fields=Object.fromEntries(['w','d','h'].map(key=>[key,document.querySelector('#furniture-'+key)]));
  const message=document.querySelector('#furniture-editor-status'),place=document.querySelector('#furniture-place');
  const finish=document.querySelector('#furniture-finish'),ray=new THREE.Raycaster(),point=new THREE.Vector2();
  const floor=new THREE.Plane(new THREE.Vector3(0,1,0),0),destination=new THREE.Vector3();
  let outline=null,pressed=null,placing=false;
  const selected=()=>furniture.find(item=>item.id===select.value);
  const editing=()=>panel.open&&panel.getClientRects().length>0&&state.mode==='planta3d'&&state.ready;
  function clearOutline(){if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}}
  function cancelPlacement(){placing=false;place.setAttribute('aria-pressed','false');canvas.style.cursor='';}
  function refresh(){
    clearOutline();const item=selected();
    for(const [key,field]of Object.entries(fields)){
      field.disabled=!item;
      if(item&&document.activeElement!==field){field.value=String(Number(item[key].toFixed(2)));field.setCustomValidity('');}
    }
    if(item&&editing()){
      item.group.updateWorldMatrix(true,true);outline=new THREE.BoxHelper(item.group,0x63dba2);
      outline.raycast=()=>{};scene.add(outline);
    }
  }
  function choose(id){select.value=id;cancelPlacement();refresh();const item=selected();if(item)message.textContent=item.name+' selecionado.';}
  listen(select,'change',()=>choose(select.value));
  listen(panel,'toggle',()=>{cancelPlacement();refresh();});
  listen(window.matchMedia('(min-width:480px) and (hover:hover) and (pointer:fine)'),'change',()=>{cancelPlacement();refresh();});
  for(const [key,field]of Object.entries(fields))listen(field,'input',()=>{
    const item=selected();if(!item)return;
    const dimensions={...dimensionsOf(item),[key]:field.valueAsNumber};
    if(!validFurnitureDimensions(dimensions,state.ceilingHeight)){
      field.setCustomValidity('Informe uma medida válida dentro dos limites indicados.');
      message.textContent='Confira a medida: largura e profundidade de 0,20 a 3,50 m; altura até o teto.';return;
    }
    field.setCustomValidity('');
    if(state.resizeFurniture(item.id,dimensions)){refresh();message.textContent='Medidas aplicadas ao móvel. Clique em Concluir ao terminar.';}
  });
  listen(place,'click',()=>{
    if(!selected())return;placing=!placing;place.setAttribute('aria-pressed',String(placing));
    canvas.style.cursor=placing?'crosshair':'';
    message.textContent=placing?'Clique no novo lugar na planta. Arrastar continua girando a câmera.':'Movimento cancelado.';
  });
  listen(window,'keydown',event=>{if(event.key==='Escape')cancelPlacement();});
  listen(canvas,'pointerdown',event=>{
    if(editing()&&event.button===0&&event.isPrimary)pressed={id:event.pointerId,x:event.clientX,y:event.clientY};
  },{capture:true});
  listen(canvas,'pointercancel',()=>{pressed=null;});
  listen(canvas,'pointerup',event=>{
    const start=pressed;pressed=null;
    if(!editing()||!start||start.id!==event.pointerId||Math.hypot(event.clientX-start.x,event.clientY-start.y)>6)return;
    const box=canvas.getBoundingClientRect();point.set((event.clientX-box.left)/box.width*2-1,1-(event.clientY-box.top)/box.height*2);
    ray.setFromCamera(point,camera);
    if(placing){
      const item=selected();if(!item||!ray.ray.intersectPlane(floor,destination))return;
      const x=Math.round(destination.x*10)/10,z=Math.round(destination.z*10)/10;
      if(state.moveFurniture(item.id,x-item.position[0],z-item.position[1])){
        cancelPlacement();refresh();message.textContent='Móvel posicionado. Clique em Concluir ao terminar.';
      }else message.textContent='Escolha um ponto dentro do apartamento.';
      return;
    }
    const meshes=[];
    for(const item of furniture)item.group.traverse(mesh=>{if(mesh.isMesh&&mesh.visible)meshes.push(mesh);});
    scene.updateMatrixWorld(true);
    const hit=ray.intersectObjects(meshes,false)[0];if(hit)choose(hit.object.userData.furnitureId);
  },{capture:true});
  listen(finish,'click',async()=>{
    if(!editing())return;
    if(Object.values(fields).some(field=>!field.reportValidity()))return;
    cancelPlacement();finish.disabled=true;finish.textContent='Atualizando luz…';message.textContent='Atualizando a iluminação e as sombras do novo layout…';
    try{
      if(await state.finishFurnitureEditing()){
        message.textContent='Concluído. Iluminação e sombras atualizadas neste navegador.';
        panel.open=false;clearOutline();panel.querySelector('summary').focus();
      }
    }catch(error){message.textContent='Não foi possível atualizar a iluminação. Suas alterações foram mantidas; tente novamente.';}
    finally{finish.disabled=false;finish.textContent='Concluir';}
  });
  fields.h.max=String(state.ceilingHeight);refresh();
  return {refresh,stop(){cancelPlacement();clearOutline();},dispose(){cancelPlacement();clearOutline();}};
}
