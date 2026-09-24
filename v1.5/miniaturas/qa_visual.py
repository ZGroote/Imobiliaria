"""Renderiza a maquete offline e verifica os quatro modos no Chrome headless.

python v1.5/miniaturas/qa_visual.py maquete.html --nome depois
"""
import argparse
import html as html_lib
import json
from pathlib import Path
import subprocess
import tempfile

BASE = Path(__file__).resolve().parent
CHROME = Path(r'C:\Program Files\Google\Chrome\Application\chrome.exe')
SONDA = r'''
<style>*{transition:none!important;animation:none!important}</style>
<script>
addEventListener('error',e=>console.log('QA_ERROR '+e.message));
setTimeout(function(){
 try {
  const m=window.__maq;
  window.requestAnimationFrame=function(){return 0;};
  if(!m) throw Error('Maquete nao inicializou');
  document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',
    {bubbles:true,clientX:10,clientY:10,pointerId:1,button:0}));
  document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerup',
    {bubbles:true,clientX:10,clientY:10,pointerId:1,button:0}));
  m.vaiPara('MODO');
  if(CONJUNTO){
    const b=document.getElementById('verConjunto');
    if(!b || b.hidden)throw Error('Controle de conjunto indisponivel');
    b.click();
    if(b.getAttribute('aria-pressed')!=='true')throw Error('Conjunto nao abriu');
    b.click();
    if(m.predio.children.some(o=>o.isMesh && o.visible && o.userData.tower!==0))throw Error('Volta ao bloco falhou');
    b.click();
  }
  const t=performance.now();
  for(let i=0;i<24;i++)m.quadro(t+i*100);
  if(m.modo()!=='MODO')throw Error('Modo incorreto: '+m.modo());
  if(!Number.isFinite(m.cam.position.length()))throw Error('Camera invalida');
  const r={modo:m.modo(),calls:m.ren.info.render.calls,
    triangulos:m.ren.info.render.triangles,texturas:m.ren.info.memory.textures,
    largura:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,
    camera:m.cam.position.toArray(),alvo:m.alvo.toArray(),
    caixa:m.planta()?new THREE.Box3().setFromObject(m.planta()):null};
  r.fonte=m.predio.userData.fonte;
  r.blocosVisiveis=[...new Set(m.predio.children.filter(o=>o.visible && o.isMesh).map(o=>o.userData.tower))];
  if(r.overflow)throw Error('Overflow horizontal');
  if('MODO'==='planta2d'){
    const svg=document.querySelector('svg:not([hidden])');
    if(!svg || !svg.querySelector('path,polygon,rect'))throw Error('Planta 2D vazia');
  }
  if('MODO'!=='planta2d' && !r.triangulos)throw Error('Cena vazia');
  if('MODO'!=='planta2d'){
    const cv=m.ren.domElement, gl=m.ren.getContext();
    const pixels=new Uint8Array(cv.width*cv.height*4);
    gl.readPixels(0,0,cv.width,cv.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let visiveis=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)visiveis++;
    r.pixelsVisiveis=visiveis;
    if(!visiveis)throw Error('Render sem pixels visiveis');
    const foto=document.createElement('img');foto.src=cv.toDataURL();
    foto.style.cssText=cv.style.cssText;foto.style.width=cv.clientWidth+'px';
    foto.style.height=cv.clientHeight+'px';cv.replaceWith(foto);
  }
  console.log('QA_RESULT '+JSON.stringify(r));
 }catch(e){console.log('QA_ERROR '+e.stack)}
},1000);
</script>
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pagina')
    ap.add_argument('--nome', default='depois')
    ap.add_argument('--modo', default='maquete', choices=['maquete', 'planta2d', 'planta3d', 'visita'])
    ap.add_argument('--mobile', action='store_true')
    ap.add_argument('--viewport', help='Viewport exato em iframe: largura,altura')
    ap.add_argument('--conjunto', action='store_true')
    args = ap.parse_args()
    page = Path(args.pagina)
    if not page.is_absolute():
        page = BASE / page
    out = BASE / 'qa'
    out.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='maquete-qa-') as tmp:
        html = Path(tmp) / 'pagina.html'
        # O screenshot ocorre depois do rAF: preservar o buffer apenas nesta sonda.
        source = page.read_text(encoding='utf8').replace('canvas: cv, antialias:',
            'preserveDrawingBuffer: true, canvas: cv, antialias:')
        document = source + SONDA.replace('MODO', args.modo).replace('CONJUNTO',str(args.conjunto).lower())
        if args.viewport:
            width,height=map(int,args.viewport.split(','))
            document = '<style>body{margin:0}iframe{border:0;display:block}</style><iframe width="%d" height="%d" srcdoc="%s"></iframe>' % (width,height,html_lib.escape(document,quote=True))
        html.write_text(document, encoding='utf8')
        cmd = [str(CHROME), '--headless=new', '--user-data-dir='+str(Path(tmp)/'perfil'),
               '--window-size='+('390,844' if args.mobile else '1280,900'),
               '--force-device-scale-factor='+('1.75' if args.mobile else '1'),
               '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
               '--virtual-time-budget=3500', '--enable-logging=stderr', '--log-level=0',
               '--screenshot='+str(out/(args.nome+'.png')), html.as_uri()]
        proc = subprocess.run(cmd,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=90)
        log = proc.stdout + proc.stderr
        rows = []
        for line in log.splitlines():
            if 'QA_ERROR ' in line:
                raise RuntimeError(line)
            if 'QA_RESULT ' in line:
                rows.append(json.JSONDecoder().raw_decode(line.split('QA_RESULT ',1)[1])[0])
        if proc.returncode or not rows:
            raise RuntimeError(log[-4000:])
        (out/(args.nome+'.json')).write_text(json.dumps(rows,indent=2),encoding='utf8')
        print(json.dumps(rows))


if __name__ == '__main__':
    main()
