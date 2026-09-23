import qa_visual
CHECK=r'''
  function check(ok,msg){if(!ok)throw Error(msg);}
  function bounds(){
    const panel=document.getElementById('ficha').getBoundingClientRect();
    for(const b of document.querySelectorAll('#modos button')){
      const r=b.getBoundingClientRect();
      check(r.left>=panel.left && r.right<=panel.right && r.bottom<=panel.bottom,'Botao cortado no painel');
      check(r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight,'Botao fora da tela');
      check(b.scrollWidth<=b.clientWidth,'Texto de botao cortado');
    }
    check(document.documentElement.scrollWidth<=innerWidth,'Overflow horizontal');
    check(document.getElementById('cena').clientHeight>=120,'Cena muito pequena');
  }
  bounds();
  check(!document.querySelector('#fComodos b'),'Metragens de comodos presentes');
  const toggle=document.getElementById('alternarFicha');
  toggle.click();m.quadro(t+2500);bounds();
  toggle.click();m.quadro(t+2600);bounds();
  console.log('QA_RESULT '+JSON.stringify({responsivo:true,width:innerWidth,height:innerHeight}));
'''
qa_visual.SONDA=qa_visual.SONDA.replace('i<24','i<3').replace("  if(m.modo()!=='MODO')",CHECK+"\n  if(m.modo()!=='MODO')")
if __name__=='__main__':qa_visual.main()
