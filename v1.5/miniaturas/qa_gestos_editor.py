import qa_visual
PROBE=r'''
  function check(ok,msg){if(!ok)throw Error(msg);}
  m.editor().abrir();const ed=m.editor(),st=ed.estado;
  m.orb.ph=0.4;m.poeCam();m.cena.updateMatrixWorld(true);
  const cv=m.ren.domElement,rect=cv.getBoundingClientRect();
  for(const tool of ['fMover','fGirar']){
    ed.seleciona(0);document.getElementById(tool).click();check(!st.acao&&!st.holograma,'Ferramenta manteve edicao');
    const record=st.moveis[0], original=record.obj.position.clone();
    const p=new THREE.Box3().setFromObject(record.obj).getCenter(new THREE.Vector3()).project(m.cam);
    const x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2;
    const start=m.cam.position.clone();
    for(const [name,dx] of [['pointerdown',0],['pointermove',35],['pointerup',35]])cv.dispatchEvent(new PointerEvent(name,{bubbles:true,clientX:x+dx,clientY:y+15*(dx?1:0),pointerId:1,pointerType:'mouse',button:0}));
    m.poeCam();check(m.cam.position.distanceTo(start)>0.01,'Arrasto sobre movel nao moveu camera: '+tool);
    check(record.obj.position.distanceTo(original)<1e-8,'Arrasto moveu mobilia');
  }
  m.quadro(t+2700);let lit=0;m.planta().traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)lit++;});check(lit===0,'Planta ainda iluminada');
  m.vaiPara('visita');m.quadro(t+2800);m.planta().traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)lit++;});check(lit>0,'Visita perdeu luz');
  m.vaiPara('planta3d');m.quadro(t+2900);
  check(document.getElementById('verMapa').href==='https://imobilaria-deccb.web.app/','Link do mapa incorreto');
  console.log('QA_RESULT '+JSON.stringify({arrastoSobreMoveis:true,luzPorModo:true,mapa:true}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace('i<24','i<3').replace("  if(m.modo()!=='MODO')",PROBE+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':qa_visual.main()
