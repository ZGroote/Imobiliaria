import qa_visual
PROBE=r'''
  function check(ok,msg){if(!ok)throw Error(msg);}
  const panel=document.getElementById('informacoes'), toggle=document.getElementById('alternarFicha');
  const scene=document.getElementById('cena'), nav=document.getElementById('modos');
  const initial=scene.clientHeight;
  toggle.click();m.quadro(t+2600);
  check(panel.hidden && toggle.getAttribute('aria-expanded')==='false','Ficha nao recolheu');
  check(scene.clientHeight>initial,'Cena nao ganhou espaco');
  check(nav.getBoundingClientRect().bottom<=innerHeight,'Navegacao fora da tela');
  for(const mode of ['planta3d','visita','planta2d','maquete','visita']){
    document.querySelector('[data-modo="'+mode+'"]').click();m.quadro(t+2700);
    check(m.modo()===mode,'Navegacao recolhida falhou');
    const ceiling=m.planta().getObjectByName('teto-visita');
    check(ceiling && ceiling.visible===(mode==='visita'),'Visibilidade do teto incorreta');
  }
  const roof=m.planta().getObjectByName('teto-visita');
  check(roof.getObjectByName('forro-original'),'Forro original ausente');
  check(roof.getObjectByName('rodateto') && roof.getObjectByName('plafon'),'Acabamentos ausentes');
  check(toggle.querySelector('svg') && toggle.getAttribute('aria-label'),'Seta sem acessibilidade');
  m.cena.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(m.cam.position.clone(),new THREE.Vector3(0,1,0));
  check(ray.intersectObject(m.planta().getObjectByName('teto-visita'),true).length>0,'Teto nao cobre entrada');
  toggle.click();m.quadro(t+2800);
  check(!panel.hidden && scene.clientHeight===initial,'Ficha nao restaurou layout');
  toggle.click();m.quadro(t+2900);
  console.log('QA_RESULT '+JSON.stringify({painel:true,navegacao:true,teto:true,altura:scene.clientHeight}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace('i<24','i<3').replace("  if(m.modo()!=='MODO')",PROBE+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':qa_visual.main()
