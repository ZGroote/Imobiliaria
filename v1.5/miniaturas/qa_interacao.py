"""Regressao dos gestos usando eventos de ponteiro no Chrome real."""
import qa_visual

GESTOS = r'''
  const cv=m.ren.domElement, rect=cv.getBoundingClientRect();
  function assert(ok,msg){if(!ok)throw Error(msg);}
  function event(type,x,y){cv.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0}));}
  function project(v){const p=v.clone().project(m.cam);return new THREE.Vector2(rect.left+(p.x+1)*rect.width/2,rect.top+(1-p.y)*rect.height/2);}
  function pose(){return {p:m.cam.position.clone(),q:m.cam.quaternion.clone()};}
  function same(a){assert(a.p.distanceTo(m.cam.position)<1e-7,'Clique deslocou camera');assert(1-Math.abs(a.q.dot(m.cam.quaternion))<1e-9,'Clique reorientou camera');}
  const resultados=[];
  for(const angle of [0.5,1.1,0]){
    m.orb.ph=angle;m.poeCam();m.cena.updateMatrixWorld(true);
    document.getElementById('fGirar').click();
    let hit, pixel;
    const ray=new THREE.Raycaster();
    for(const nx of [0.16,-0.16,0.08,-0.08]){
      for(const ny of [0.08,-0.08,0]){
        ray.setFromCamera(new THREE.Vector2(nx,ny),m.cam);
        const hits=ray.intersectObject(m.planta(),true);
        if(hits.length){hit=hits[0].point.clone();pixel=project(hit);break;}
      }
      if(hit)break;
    }
    assert(hit,'Nao encontrou ponto fora do centro');
    const original=pose(), angles={th:m.orb.th,ph:m.orb.ph};
    event('pointerdown',pixel.x,pixel.y);same(original);
    m.poeCam();same(original);
    assert(m.orb.th===angles.th && m.orb.ph===angles.ph,'Pivo mudou eixos de giro');
    assert(m.alvo.distanceTo(hit)<1e-6,'Pivo nao corresponde ao clique');
    event('pointermove',pixel.x+20,pixel.y-8);m.poeCam();
    assert(m.cam.position.distanceTo(original.p)>0.01,'Arrasto nao girou');
    const right=new THREE.Vector3(1,0,0).applyQuaternion(m.cam.quaternion);
    assert(Math.abs(right.y)<1e-7,'Giro inclinou lateralmente a camera');
    assert(project(hit).distanceTo(pixel)<0.01,'Pivo saiu do pixel durante giro');
    event('pointerup',pixel.x+20,pixel.y-8);
    document.getElementById('fMover').click();
    for(const [dx,dy] of [[30,0],[-30,0],[0,25],[0,-25]]){
      const before=project(hit);
      event('pointerdown',pixel.x,pixel.y);
      event('pointermove',pixel.x+dx,pixel.y+dy);m.poeCam();
      event('pointerup',pixel.x+dx,pixel.y+dy);
      const delta=project(hit).sub(before);
      assert(dx===0?Math.abs(delta.x)<0.01:delta.x*dx>0,'Pan horizontal invertido');
      assert(dy===0?Math.abs(delta.y)<0.01:delta.y*dy>0,'Pan vertical invertido');
    }
    const saved=pose();m.vaiPara('maquete');m.vaiPara('planta3d');m.poeCam();same(saved);
    resultados.push({angulo:angle,pivoFixo:true,panCorreto:true});
  }
  console.log('QA_RESULT '+JSON.stringify({gestos:resultados}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace("  if(m.modo()!=='MODO')",GESTOS+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':
    qa_visual.main()
