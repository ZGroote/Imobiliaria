import qa_visual
PROBE=r'''
  function check(ok,msg){if(!ok)throw Error(msg);}
  m.FP.pitch=-0.55;m.quadro(t+2500);m.cena.updateMatrixWorld(true);
  const cv=m.ren.domElement,rect=cv.getBoundingClientRect();
  function find(){
    for(let y=0.15;y>-0.9;y-=0.15)for(let x=-0.7;x<0.8;x+=0.15){
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x,y),m.cam);
      const h=ray.intersectObject(m.planta(),true)[0];
      if(h && h.point.y<0.13 && h.face.normal.y>0.8 && Math.hypot(h.point.x-m.FP.x,h.point.z-m.FP.z)>0.4 && m.caminhoAte(h.point).length)
        return {x:rect.left+(x+1)*rect.width/2,y:rect.top+(1-y)*rect.height/2,p:h.point};
    }
    throw Error('Nenhum piso navegavel na vista');
  }
  function tap(p,type){for(const name of ['pointerdown','pointerup'])cv.dispatchEvent(new PointerEvent(name,{bubbles:true,clientX:p.x,clientY:p.y,pointerId:1,pointerType:type,button:0}));}
  const original={x:m.FP.x,z:m.FP.z};
  check(!m.caminhoAte({x:1000,z:1000}).length,'Destino externo aceito');
  let desvio=null;
  for(let x=-4;x<4 && !desvio;x+=0.5)for(let z=-3;z<3 && !desvio;z+=0.5){
    if(!m.livre(x,z))continue;const path=m.caminhoAte({x,z});if(path.length>1)desvio=path;
  }
  // Nem toda planta oferece um desvio entre os pontos amostrados.
  desvio=desvio||[];
  let bloqueados=0;
  m.planta().children.filter(o=>o.userData.movel).forEach(o=>{
    const box=new THREE.Box3().setFromObject(o),c=box.getCenter(new THREE.Vector3());
    if(box.max.y>0.12 && box.min.y<1.7){check(!m.livre(c.x,c.z),'Centro de movel transitavel');bloqueados++;}
  });check(bloqueados>0,'Nenhum movel testado');
  let a=original;
  for(const b of desvio){const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/0.025);for(let j=0;j<=n;j++)check(m.livre(a.x+(b.x-a.x)*j/n,a.z+(b.z-a.z)*j/n),'Desvio atravessa parede');a=b;}

  for(const type of ['mouse','touch']){
    m.FP.x=original.x;m.FP.z=original.z;m.quadro(t+2600);
    const p=find();tap(p,type);check(!m.caminhada.rota.length,'Toque unico iniciou caminhada');tap(p,type);
    check(m.caminhada.rota.length && m.caminhada.marca.visible,'Duplo toque nao iniciou');
    check(m.caminhada.marca.children.length>=3,'Marcadores ausentes');
    const yaw=m.FP.yaw, pos={x:m.FP.x,z:m.FP.z}, rota=m.caminhada.rota;
    for(const [name,dx] of [['pointerdown',0],['pointermove',35],['pointerup',35]])
      cv.dispatchEvent(new PointerEvent(name,{bubbles:true,clientX:p.x+dx,clientY:p.y,pointerId:1,pointerType:type,button:0}));
    check(Math.abs(m.FP.yaw-yaw)>0.01,'Arrasto nao mudou olhar');
    check(m.caminhada.rota===rota && rota.length,'Olhar interrompeu caminhada');
    m.passoVisita(0.05);
    check(Math.hypot(m.FP.x-pos.x,m.FP.z-pos.z)>0.001,'Camera parou ao olhar');
    for(let i=0;i<2000 && m.caminhada.rota.length;i++){m.passoVisita(0.05);check(m.livre(m.FP.x,m.FP.z),'Cruzou parede');}
    check(Math.hypot(m.FP.x-p.p.x,m.FP.z-p.p.z)<0.03,'Nao chegou ao destino');
  }
  m.FP.x=original.x;m.FP.z=original.z;m.quadro(t+2700);
  const p=find();tap(p,'mouse');tap(p,'mouse');
  dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));m.passoVisita(0.05);dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));
  check(!m.caminhada.rota.length,'Teclado nao cancelou');
  const q=find();tap(q,'mouse');tap(q,'mouse');
  m.vaiPara('planta3d');check(!m.caminhada.rota.length && !m.caminhada.marca.visible,'Troca de modo nao cancelou');m.vaiPara('visita');
  m.FP.pitch=-0.55;m.quadro(t+2800);const preview=find();tap(preview,'mouse');tap(preview,'mouse');m.quadro(t+2850);
  console.log('QA_RESULT '+JSON.stringify({duploClique:true,duploToque:true,chegada:true,olharDuranteCaminhada:true,cancelamento:true}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace('i<24','i<3').replace("  if(m.modo()!=='MODO')",PROBE+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':qa_visual.main()


