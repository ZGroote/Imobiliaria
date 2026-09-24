import qa_visual
PROBE=r'''
  function check(ok,msg){if(!ok)throw Error(msg);}
  document.getElementById('botaoMoveis').click();
  const ed=m.editor(),s=ed.estado;
  check(s.on && s.grade.visible,'Editor ou grade nao abriu');
  check(document.querySelectorAll('#modos button').length===4,'Modos alterados');
  check(document.getElementById('botaoMoveis').parentElement.id==='cena','Botao ainda no menu');
  const gradeBox=new THREE.Box3().setFromObject(s.grade);
  check(gradeBox.max.x-gradeBox.min.x<10 && gradeBox.max.z-gradeBox.min.z<5,'Grade ultrapassa planta');
  const n=s.moveis.length;check(n>0,'Moveis originais ausentes');
  ed.seleciona(0);const old=s.moveis[0].cor;ed.altera('cor',0x884422);check(s.moveis[0].cor===0x884422,'Cor nao mudou');
  document.getElementById('desfazMovel').click();check(s.moveis[0].cor===old,'Desfazer cor falhou');
  document.getElementById('catalogoMovel').value='cadeira';document.getElementById('catalogoMovel').dispatchEvent(new Event('change'));
  check(s.holograma && s.holograma.visible,'Escolha nao criou holograma');
  m.orb.ph=0.02;m.poeCam();m.cena.updateMatrixWorld(true);
  let place=null;
  for(let u=-5;u<5&&!place;u+=0.2)for(let v=-4;v<4&&!place;v+=0.2){
    const sample={tipo:'cadeira',u,v,rot:0,w:0.46,d:0.48,h:0.92,cor:0x7C6A55};
    if(ed.cabe(sample))place={u,v};
  }
  check(place,'Nao encontrou local para cadeira');
  const point=new THREE.Vector3(place.u,0.02,place.v).applyMatrix4(s.grade.matrixWorld);point.y=0.02;
  const p=point.clone().project(m.cam),rect=m.ren.domElement.getBoundingClientRect(),px=rect.left+(p.x+1)*rect.width/2,py=rect.top+(1-p.y)*rect.height/2;
  m.ren.domElement.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:px,clientY:py,pointerId:1,pointerType:'mouse'}));
  check(s.previaValida && s.holograma,'Holograma nao acompanha destino valido');
  for(const name of ['pointerdown','pointerup'])m.ren.domElement.dispatchEvent(new PointerEvent(name,{bubbles:true,clientX:px,clientY:py,pointerId:1,pointerType:'mouse',button:0}));
  check(s.moveis.length===n+1,'Adicionar falhou: '+document.getElementById('statusMoveis').textContent);
  const item=s.moveis[s.sel];ed.altera('w',0.3);check(item.w===0.3,'Redimensionar falhou');
  ed.altera('d',0.3);document.getElementById('giraMovel').click();check(item.rot===1,'Girar falhou');
  const oldU=item.u,oldV=item.v;
  document.getElementById('moveMovel').click();check(s.holograma,'Mover nao criou holograma');
  const outside=new THREE.Vector3(30,0.02,30).project(m.cam);
  m.ren.domElement.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:rect.left+(outside.x+1)*rect.width/2,clientY:rect.top+(1-outside.y)*rect.height/2,pointerId:1,pointerType:'mouse'}));
  check(!s.previaValida && item.u===oldU && item.v===oldV,'Preview invalida alterou original');
  let target=null;
  for(const du of [0.2,-0.2,0.4,-0.4])for(const dv of [0.2,-0.2,0.4,-0.4]){
    item.u=oldU+du;item.v=oldV+dv;if(ed.cabe(item))target={u:item.u,v:item.v};
  }item.u=oldU;item.v=oldV;check(target,'Sem destino para mover');
  document.getElementById('moveMovel').click();
  const dest=new THREE.Vector3(target.u,0.02,target.v).applyMatrix4(s.grade.matrixWorld);dest.y=0.02;dest.project(m.cam);
  for(const name of ['pointerdown','pointermove','pointerup'])m.ren.domElement.dispatchEvent(new PointerEvent(name,{bubbles:true,clientX:rect.left+(dest.x+1)*rect.width/2+(name==='pointerdown'?40:0),clientY:rect.top+(1-dest.y)*rect.height/2,pointerId:1,pointerType:'touch',button:0}));
  check(Math.abs(item.u-oldU)>0.01 || Math.abs(item.v-oldV)>0.01,'Mover falhou');
  check(JSON.parse(localStorage.getItem('miniaturas:cedros:moveis:v1')).length===n+1,'Salvar local falhou');
  document.getElementById('moveMovel').click();document.getElementById('cancelaMovel').click();check(!s.acao,'Cancelar falhou');
  document.getElementById('excluiMovel').click();check(s.moveis.length===n,'Excluir falhou');
  document.getElementById('desfazMovel').click();check(s.moveis.length===n+1,'Desfazer exclusao falhou');
  document.getElementById('restauraMoveis').click();check(s.moveis.length===n,'Restaurar falhou');
  const f=document.getElementById('ficha').getBoundingClientRect();
  for(const b of document.querySelectorAll('#modos button')){const r=b.getBoundingClientRect();check(r.right<=innerWidth && r.bottom<=innerHeight,'Navegacao fora da tela');}
  ed.fechar();check(!s.holograma,'Holograma vazou ao fechar');check(!s.on && !s.grade.visible,'Fechar falhou');
  m.vaiPara('visita');check(document.getElementById('botaoMoveis').hidden,'Moveis apareceu na visita');
  m.vaiPara('planta3d');check(!document.getElementById('botaoMoveis').hidden,'Botao sumiu da planta');
  ed.abrir();document.getElementById('catalogoMovel').value='sofa';document.getElementById('catalogoMovel').dispatchEvent(new Event('change'));m.quadro(t+2500);
  console.log('QA_RESULT '+JSON.stringify({editor:true,adicionar:true,mover:true,persistencia:true,redimensionar:true,girar:true,cor:true,excluir:true,desfazer:true}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace('i<24','i<3').replace("  if(m.modo()!=='MODO')",PROBE+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':qa_visual.main()
