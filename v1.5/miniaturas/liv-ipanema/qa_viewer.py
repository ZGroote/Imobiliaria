"""Confere a miniatura LIV local ou publicada e salva evidência de desktop/celular."""
from pathlib import Path
import argparse
import json
import hashlib
import base64
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

PASTA = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", help="URL HTTP(S) da mesma miniatura aprovada")
parser.add_argument("--qa-dir", type=Path, help="Pasta para relatórios e fotos de QA")
parser.add_argument("--interior", action="store_true")
parser.add_argument("--smoke-final", action="store_true")
parser.add_argument("--export-interior", action="store_true")
parser.add_argument("--source-interior", type=Path)
parser.add_argument("--html", type=Path, help="HTML local de referência (ex.: a versão minificada publicada)")
args = parser.parse_args()
if args.url and urlparse(args.url).scheme not in ("http", "https"):
    parser.error("--url deve usar HTTP ou HTTPS")
if args.url and args.export_interior:
    parser.error("A exportação da fonte é feita apenas na versão local")
HTML = (args.html or PASTA / "maquete-liv-ipanema.html").resolve()
URL_ALVO = args.url or HTML.as_uri()
SAIDA = (args.qa_dir or (PASTA / "qa/publica" if args.url else PASTA / "qa")).resolve()
SAIDA.mkdir(parents=True, exist_ok=True)
HTML_HTTP_SHA256 = None


def abrir_pagina(pagina):
    global HTML_HTTP_SHA256
    esperado = hashlib.sha256(HTML.read_bytes()).hexdigest()
    atual = esperado
    if args.url:
        # A página excede o cache do inspetor Chrome. Um GET de referência pela
        # API HTTP confere os bytes uma vez; o browser verifica o runtime real.
        if HTML_HTTP_SHA256 is None:
            documento = pagina.request.get(URL_ALVO, timeout=120000)
            assert documento.ok, "O HTML público não respondeu com sucesso"
            HTML_HTTP_SHA256 = hashlib.sha256(documento.body()).hexdigest()
            documento.dispose()
        atual = HTML_HTTP_SHA256
        assert atual == esperado, "O HTML publicado difere da miniatura final aprovada"
    resposta = pagina.goto(URL_ALVO, wait_until="load", timeout=120000)
    if args.url:
        assert resposta and resposta.ok, "A miniatura pública não respondeu com sucesso"
    return {"url":pagina.url,"htmlSHA256":atual,"publica":bool(args.url),
            "verificacaoHTML":"GET HTTP de referência" if args.url else "arquivo local"}


def caminho_evidencia(nome):
    caminho = SAIDA / nome
    try:
        return caminho.relative_to(PASTA).as_posix()
    except ValueError:
        return caminho.as_posix()


def confere_interior():
    unidade_path = PASTA / "interior/previa/unidade.json"
    unidade = json.loads(unidade_path.read_text("utf8"))
    unidade_hash = hashlib.sha256(unidade_path.read_bytes()).hexdigest()
    erros, avisos = [], []
    capturas = {}
    def fotografar(pagina, nome, pose):
        dados = pagina.evaluate("window.__liv.captura()")
        png = base64.b64decode(dados.split(",", 1)[1])
        (SAIDA / nome).write_bytes(png)
        capturas[nome] = {"sha256": hashlib.sha256(png).hexdigest(), "pose": pose,
                         "canvas": pagina.evaluate("()=>({width:__maq.ren.domElement.width,height:__maq.ren.domElement.height})")}
    with sync_playwright() as pw:
        navegador = pw.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True, args=["--allow-file-access-from-files"])
        pagina = navegador.new_page(viewport={"width": 1600, "height": 1000}, device_scale_factor=2)
        pagina.on("pageerror", lambda e: erros.append(str(e)))
        pagina.on("console", lambda m: avisos.append(m.text)
                  if "sem catalogo" in m.text or "indisponivel" in m.text else None)
        alvo = abrir_pagina(pagina)
        pagina.evaluate("async()=>{await window.__liv.luzPronta;}")
        cadastro = pagina.evaluate("window.__liv.interior().cadastro")
        assert cadastro["planta"] == unidade["planta"], "Cadastro nominal foi alterado"
        assert cadastro["cores"] == unidade["cores"], "Cores do cadastro foram alteradas"
        assert pagina.evaluate("window.__liv.interior().fonte.unidadeSHA256") == unidade_hash
        pagina.locator("#alternarFicha").click()
        pagina.wait_for_timeout(250)
        pagina.locator('[data-modo="planta3d"]').click()
        pagina.wait_for_function("!window.__liv.interior().bake.fila", timeout=120000)
        atlas = pagina.evaluate("""async()=>{
          if(!__liv.luzInteriorPronta)return null;
          const s=await __liv.luzInteriorPronta;__maq.quadro(performance.now());
          return {ready:s.ready,active:s.active,targetsMapped:s.targetsMapped,sourceSHA256:s.sourceSHA256,
            textureSHA256:s.textureSHA256,geometryHashVerified:s.geometryHashVerified,textureHashVerified:s.textureHashVerified,
            layoutVerified:s.layoutVerified,materialsVerified:s.materialsVerified,sourceGeometryVerified:s.sourceGeometryVerified,
            semAOduplicado:s.semAOduplicado,approvedTexturesFrozen:s.approvedTexturesFrozen,error:s.error,reason:s.reason};
        }""")
        if atlas:
            assert atlas["ready"] and atlas["active"] and atlas["targetsMapped"] == 84, atlas
            assert all(atlas[k] for k in ("geometryHashVerified","textureHashVerified","layoutVerified","materialsVerified","sourceGeometryVerified","semAOduplicado")), atlas
        planta = pagina.evaluate("""()=>{
          const I=window.__liv.interior(),g=I.grupo,objetos=[];
          g.traverse(o=>{if(o.isMesh)objetos.push({name:o.name,vertices:o.geometry.getAttribute('position').count,
            albedo:!!o.userData.livAlbedo,uv:!!o.geometry.getAttribute('uv')});});
          return {modo:window.__maq.modo(),camera:window.__maq.cam.type,pd:I.planta.pd,
            comodos:I.planta.comodos.map(c=>({nome:c.nome,area:c.area,piso:c.pisoTipo})),
            paredes:I.planta.paredes.length,paredesColisao:I.paredes.paredes.length,normalRepair:g.userData.livNormalRepair,
            esquadrias:I.planta.esquadrias.map(e=>({tipo:e.tipo,L:e.L,porta:e.porta})),
            moveis:g.children.filter(o=>o.userData.movel).length,
            moveisNominais:I.planta.moveis.length,objetos,tetoVisivel:I.teto.visible};
        }""")
        assert planta["modo"] == "planta3d" and planta["camera"] == "PerspectiveCamera", planta
        assert planta["moveis"] == planta["moveisNominais"] == len(unidade["planta"]["moveis"]), planta
        assert planta["paredes"] == planta["paredesColisao"] and planta["paredes"] > 0, planta
        assert len(planta["esquadrias"]) == len(unidade["planta"]["portas"]) + len(unidade["planta"]["janelas"]), planta
        assert not planta["tetoVisivel"] and sum(o["albedo"] for o in planta["objetos"]) >= 3, planta
        assert planta["normalRepair"]["opposedAfter"] == 0, planta["normalRepair"]
        assert pagina.evaluate("__liv.interior().grupo.children.some(o=>o.name==='liv-mesa-varanda-circular' && o.userData.movel)")
        pose = pagina.evaluate("()=>({camera:__maq.cam.type,position:__maq.cam.position.toArray(),orb:__maq.orb,alvo:__maq.alvo.toArray()})")
        fotografar(pagina, "interior-planta3d.png", pose)
        topo = pagina.evaluate("""()=>{
          const M=__maq,I=__liv.interior(),lim=I.limites,aspect=M.ren.domElement.width/M.ren.domElement.height;
          const h=Math.max((lim.h+.30)/2,(lim.w+.30)/2/aspect)*1.04;
          const cam=new THREE.OrthographicCamera(-h*aspect,h*aspect,h,-h,.1,250);
          cam.up.set(0,0,-1);cam.position.set(lim.cx,100,lim.cz);cam.lookAt(lim.cx,0,lim.cz);
          cam.updateMatrixWorld();M.ren.render(M.cena,cam);
          return {png:M.ren.domElement.toDataURL('image/png'),pose:{camera:cam.type,position:cam.position.toArray(),up:cam.up.toArray(),bounds:[cam.left,cam.right,cam.top,cam.bottom]}};
        }""")
        png = base64.b64decode(topo["png"].split(",", 1)[1])
        (SAIDA / "interior-topo.png").write_bytes(png)
        capturas["interior-topo.png"] = {"sha256": hashlib.sha256(png).hexdigest(), "pose": topo["pose"], "canvas": capturas["interior-planta3d.png"]["canvas"]}
        pagina.locator('[data-modo="visita"]').click()
        pagina.wait_for_timeout(200)
        fotografar(pagina, "interior-visita.png", pagina.evaluate("()=>({...__maq.FP})"))
        navegacao = pagina.evaluate("""()=>{
          const I=window.__liv.interior(),step=.05,lim=I.limites;
          const toCell=(x,z)=>[Math.round((x-lim.x0)/step),Math.round((z-lim.z0)/step)];
          const point=(a,b)=>[lim.x0+a*step,lim.z0+b*step];
          const nx=Math.ceil(lim.w/step),nz=Math.ceil(lim.h/step),seen=new Set(),queue=[];
          const e=I.entrada(),start=toCell(e[0],e[1]);
          for(let dx=-2;dx<=2 && !queue.length;dx++)for(let dz=-2;dz<=2;dz++){
            const q=point(start[0]+dx,start[1]+dz);
            if(I.livre(q[0],q[1])){queue.push([start[0]+dx,start[1]+dz]);break;}
          }
          const reached=new Set(),targets={};
          for(let n=0;n<queue.length;n++){
            const [a,b]=queue[n],key=a+','+b;if(seen.has(key))continue;seen.add(key);
            const [x,z]=point(a,b);if(!I.livre(x,z))continue;
            I.comodosLocais.forEach(c=>{if(!I.dentro(c.poly,x,z))return;reached.add(c.nome);
              const cx=c.poly.reduce((s,p)=>s+p[0],0)/c.poly.length,cz=c.poly.reduce((s,p)=>s+p[1],0)/c.poly.length;
              const d=Math.hypot(x-cx,z-cz);if(!targets[c.nome] || d<targets[c.nome].d)targets[c.nome]={x,z,d};});
            for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]]){
              const aa=a+da,bb=b+db;
              if(aa>=0 && aa<=nx && bb>=0 && bb<=nz && !seen.has(aa+','+bb))queue.push([aa,bb]);
            }
          }
          const w=I.paredes.paredes.find(w=>w.y0<1.2 && w.y1>1.2);
          const routes=Object.entries(targets).map(([nome,t])=>{
            const r=__maq.caminhoAte(t);let from={x:__maq.FP.x,z:__maq.FP.z},seg=true;
            r.forEach(to=>{const n=Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/.025);
              for(let j=0;j<=n;j++)if(!I.livre(from.x+(to.x-from.x)*j/(n||1),from.z+(to.z-from.z)*j/(n||1)))seg=false;from=to;});
            return {nome,destino:[t.x,t.z],pontos:r.length,segmentosLivres:seg};});
          return {entrada:e,entradaLivre:I.livre(e[0],e[1]),camera:[I.visita.x,I.visita.z],rotasAutomaticas:routes,
            cameraLivre:I.livre(I.visita.x,I.visita.z),alcancaveis:Array.from(reached),
            totalAmbientes:I.comodosLocais.length,gradePasso:step,
            paredeBloqueia:!I.livre((w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2),
            tetoVisivel:I.teto.visible};
        }""")
        assert navegacao["entradaLivre"] and navegacao["cameraLivre"] and navegacao["paredeBloqueia"], navegacao
        assert len(navegacao["alcancaveis"]) == navegacao["totalAmbientes"], navegacao
        assert all(r["pontos"] > 0 and r["segmentosLivres"] for r in navegacao["rotasAutomaticas"]), navegacao
        assert navegacao["tetoVisivel"], navegacao
        for nome, x, z, tx, ty, tz in [("sala", .35, .10, .35, .8, 2.02),
                                      ("suite", -2.1, .25, -3.15, .8, -.775),
                                      ("teto", .35, .10, .35, 2.6, 2.02)]:
            pose = pagina.evaluate("""([x,z,tx,ty,tz])=>{
              const I=__liv.interior();if(!I.livre(x,z))throw Error('Pose fotográfica bloqueada');
              __maq.FP.x=x;__maq.FP.z=z;__maq.FP.yaw=Math.atan2(-(tx-x),-(tz-z));
              __maq.FP.pitch=Math.atan2(ty-1.65,Math.hypot(tx-x,tz-z));
              __maq.quadro(performance.now());return {...__maq.FP};
            }""", [x, z, tx, ty, tz])
            fotografar(pagina, f"interior-{nome}.png", pose)
        fallback = None
        if atlas:
            fallback = pagina.evaluate("""async()=>{
              const s=__liv.luzInterior,obj=__liv.interior().grupo.children.find(o=>o.userData.movel),old=obj.position.clone();
              obj.position.x+=.10;__maq.quadro(performance.now());
              const invalid={ready:s.ready,active:s.active,invalidated:s.invalidated,reason:s.reason,
                editPreserved:Math.abs(obj.position.x-old.x-.10)<1e-6,
                fallbackWithoutAtlas:!obj.children.some(o=>o.isMesh && o.material.lightMap)};
              obj.position.copy(old);const restored=await s.restore();__maq.quadro(performance.now());
              return {invalid,restored,active:s.active,ready:s.ready,targetsMapped:s.targetsMapped};
            }""")
            assert fallback["invalid"]["invalidated"] and not fallback["invalid"]["active"], fallback
            assert fallback["invalid"]["editPreserved"] and fallback["invalid"]["fallbackWithoutAtlas"], fallback
            assert fallback["restored"] and fallback["ready"] and fallback["active"], fallback
        if "--export-interior" in sys.argv:
            assert not atlas, "Exporte a fonte com --sem-luz-interior para preservar a geometria anterior ao atlas"
            pagina.add_script_tag(content=(PASTA / "interior/exporter-interior.js").read_text("utf8"))
            cena = pagina.evaluate("""async(unitPath)=>{
              const I=__liv.interior(),lighting=[];__maq.cena.traverse(o=>{if(o.isLight){o.updateMatrixWorld();
                lighting.push({type:o.type,color:o.color.toArray(),intensity:o.intensity,
                  position:o.getWorldPosition(new THREE.Vector3()).toArray(),
                  target:o.target?o.target.getWorldPosition(new THREE.Vector3()).toArray():null});}});
              const exported=await exportarCenaInteriorLiv({THREE,root:I.grupo,unitId:I.fonte.id,
                unitHash:I.fonte.unidadeSHA256,height:I.planta.pd,unit:I.cadastro,unitPath,mode:__maq.modo(),
                rooms:I.planta.comodos.map(c=>({name:c.nome,x:c.cx-I.planta.ob.cx,
                  z:c.cz-I.planta.ob.cz})),lighting:null});
              exported.metadata.runtimeLights=lighting;return exported;
            }""", str(unidade_path.resolve()))
            source_out = Path(sys.argv[sys.argv.index("--source-interior")+1]) if "--source-interior" in sys.argv else PASTA / "interior/luz/source.json"
            source_out.parent.mkdir(parents=True,exist_ok=True)
            cena["metadata"]["normalRepair"] = planta["normalRepair"]
            source_out.write_text(json.dumps(cena,separators=(',',':'),ensure_ascii=True),"utf8")
        pagina.locator('[data-modo="planta2d"]').click()
        assert pagina.locator("#p2d image").count() == 1
        pagina.locator('[data-modo="maquete"]').click()
        assert pagina.evaluate("__maq.modo() === 'maquete'")
        assert not erros and not avisos, {"erros": erros, "avisos": avisos}
        mobile = navegador.new_page(viewport={"width":390,"height":844},device_scale_factor=3,is_mobile=True,has_touch=True)
        mobile.on("pageerror", lambda e: erros.append(str(e)))
        abrir_pagina(mobile)
        mobile.locator("#alternarFicha").click();mobile.locator('[data-modo="planta3d"]').click()
        mobile.wait_for_function("!__liv.interior().bake.fila",timeout=120000)
        celular = mobile.evaluate("""async()=>{
          if(__liv.luzInteriorPronta)await __liv.luzInteriorPronta;__maq.quadro(performance.now());
          const s=__liv.luzInterior;return {width:innerWidth,document:document.documentElement.scrollWidth,
            ph:__maq.orb.ph,ready:s?s.ready:null,active:s?s.active:null,targetsMapped:s?s.targetsMapped:null};
        }""")
        assert celular["document"] <= celular["width"] and abs(celular["ph"]-.2)<1e-6, celular
        if atlas: assert celular["ready"] and celular["active"] and celular["targetsMapped"] == 84, celular
        mobile.screenshot(path=str(SAIDA / "interior-celular.png"))
        mobile.close();navegador.close()
        assert not erros and not avisos, {"erros": erros, "avisos": avisos}
    resultado = {"tipo": "interior-construtor", "alvo":alvo,
                 "modos":["maquete","planta3d","visita","planta2d","maquete"],"unidadeSHA256": unidade_hash,
                 "cadastroCruPreservado": True, "planta": planta, "navegacao": navegacao,
                 "atlas":atlas,"editFallbackRestauracao":fallback,"celular":celular,"erros": erros, "avisos": avisos}
    (SAIDA / "interior-runtime.json").write_text(json.dumps(resultado, indent=2, ensure_ascii=False), "utf8")
    prova = {"alvo":alvo,"unidadeSHA256": unidade_hash,
             "fonteSHA256": hashlib.sha256((PASTA / "referencias/planta-47-59.jpg").read_bytes()).hexdigest(),
             "textureSHA256": atlas["textureSHA256"] if atlas else None,
             "sourceSHA256":atlas["sourceSHA256"] if atlas else None,
             "etapa": "atlas-real-ativo" if atlas else "gate-visual-antes-do-atlas",
             "capturasSHA256": {caminho_evidencia(nome): dado["sha256"] for nome, dado in capturas.items()},
             "capturas": capturas, "giros": [{"nome":m["nome"],"rot":m["rot"]} for m in unidade["planta"]["moveis"]]}
    (SAIDA / "interior-capturas.json").write_text(json.dumps(prova, indent=2, ensure_ascii=False), "utf8")
    print(json.dumps({"tipo":resultado["tipo"],"alvo":alvo,"unidadeSHA256":unidade_hash,"ambientes":navegacao["alcancaveis"],
        "rotas":navegacao["rotasAutomaticas"],"capturas":list(capturas),"atlas":atlas,"fallback":fallback,"celular":celular,"erros":erros},ensure_ascii=False),flush=True)


def confere_html_final():
    html = HTML
    manifest = json.loads((PASTA / "interior/luz/manifest.json").read_text("utf8"))
    erros, requisicoes_http = [], []
    with sync_playwright() as pw:
        navegador = pw.chromium.launch(
            executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            headless=True, args=["--allow-file-access-from-files"])
        pagina = navegador.new_page(viewport={"width":1280,"height":900})
        pagina.on("pageerror",lambda erro:erros.append(str(erro)))
        pagina.on("request",lambda req:requisicoes_http.append(req.url)
                  if req.url.startswith(("http://","https://")) else None)
        alvo = abrir_pagina(pagina)
        pagina.evaluate("async()=>{await __liv.luzPronta;}")
        painel = {"pranchasInteriores":pagina.locator("#livReferencias .liv-prancha").count(),
                  "fotosInteriores":pagina.locator("#livReferencias img[alt^='Foto real da']").count()}
        assert painel == {"pranchasInteriores":1,"fotosInteriores":2},painel
        pagina.locator('[data-modo="planta3d"]').click()
        pagina.wait_for_function("!__liv.interior().bake.fila",timeout=120000)
        atlas = pagina.evaluate("""async()=>{
          const s=await __liv.luzInteriorPronta;__maq.quadro(performance.now());
          return {ready:s.ready,active:s.active,targetsMapped:s.targetsMapped,
            sourceSHA256:s.sourceSHA256,textureSHA256:s.textureSHA256};
        }""")
        assert atlas["ready"] and atlas["active"] and atlas["targetsMapped"] == 84,atlas
        assert atlas["sourceSHA256"] == manifest["sourceSHA256"]
        assert atlas["textureSHA256"] == manifest["textureSHA256"]
        pagina.locator('[data-modo="visita"]').click()
        assert pagina.evaluate("__liv.interior().teto.visible && __liv.luzInterior.active")
        pagina.locator('[data-modo="planta2d"]').click()
        assert pagina.locator("#p2d image").count() == 1
        pagina.locator('[data-modo="maquete"]').click()
        assert pagina.evaluate("__maq.modo() === 'maquete'")
        navegador.close()
        assert not erros,erros
        if not args.url:
            assert not requisicoes_http,requisicoes_http
    resultado = {"htmlSHA256":hashlib.sha256(html.read_bytes()).hexdigest(),"htmlBytes":html.stat().st_size,
                 "alvo":alvo,"offline":not bool(args.url),"noHTTP":not bool(requisicoes_http),"requisicoesHTTP":requisicoes_http,
                 "painel":painel,"atlas":atlas,"modos":["planta3d","visita","planta2d","maquete"],"erros":erros}
    (SAIDA / "final-smoke.json").write_text(json.dumps(resultado,indent=2),"utf8")
    print(json.dumps(resultado),flush=True)


if "--smoke-final" in sys.argv:
    confere_html_final()
    raise SystemExit(0)

if "--interior" in sys.argv:
    confere_interior()
    raise SystemExit(0)

resultados = []
with sync_playwright() as pw:
    navegador = pw.chromium.launch(
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        headless=True, args=["--allow-file-access-from-files"])
    for nome, tamanho in [("desktop", {"width": 1280, "height": 900}),
                          ("celular", {"width": 390, "height": 844})]:
        pagina = navegador.new_page(viewport=tamanho, is_mobile=nome == "celular",
                                    has_touch=nome == "celular", device_scale_factor=3 if nome == "celular" else 1)
        erros = []
        pagina.on("pageerror", lambda erro: erros.append(str(erro)))
        alvo = abrir_pagina(pagina)
        pagina.wait_for_timeout(1200)
        luz = pagina.evaluate("""async () => {
          if(window.__liv.luzPronta)await window.__liv.luzPronta;
          var estado=window.__liv.luz;
          return {embutida:typeof LIV_LIGHTMAP_DATA!=='undefined',
                  erro:window.__liv.erroLuz || null,
                  resultado:estado ? {ready:estado.ready,groups:estado.groups,
                    drawCalls:estado.drawCalls,triangles:estado.triangles,sourceSHA256:estado.sourceSHA256,
                    geometryHashVerified:estado.geometryHashVerified,
                    textureHashVerified:estado.textureHashVerified} : null};
        }""")
        modos = []
        for modo in ["maquete", "planta2d", "planta3d", "visita", "maquete"]:
            pagina.locator('[data-modo="' + modo + '"]').click()
            pagina.wait_for_timeout(180)
            modos.append(pagina.evaluate("window.__maq.modo()"))
        pagina.locator('#livAndar').select_option('7')
        selecao = pagina.evaluate("window.__maq.andar")
        pagina.locator('#verConjunto').click()
        pagina.wait_for_timeout(300)
        conjunto = pagina.evaluate("""() => {
          window.__maq.quadro(performance.now());window.__maq.quadro(performance.now()+16);
          return {visiveis:window.__maq.predio.children.filter(o=>o.isMesh && o.visible && o.userData.tower===-1).length,
            chamadas:window.__maq.ren.info.render.calls};
        }""")
        pagina.locator('#livAndar').select_option('-1')
        pagina.locator('[data-vista="fachada"]').click()
        with pagina.expect_download() as download:
            pagina.locator('#livFoto').click()
        download.value.save_as(str(SAIDA / (nome + "-fotografia.png")))
        pagina.screenshot(path=str(SAIDA / (nome + ".png")))
        metricas = pagina.evaluate("""() => ({
          largura:innerWidth, documento:document.documentElement.scrollWidth,
          canvas:document.getElementById('c').getBoundingClientRect().toJSON(),
          modos:document.getElementById('modos').getBoundingClientRect().toJSON(),
          meshes:window.__maq.predio.children.filter(o=>o.isMesh).length,
          drawCalls:window.__maq.ren.info.render.calls,
          origem:window.__maq.predio.userData.fonte,
          fonte:JSON.parse(document.getElementById('__imovel').textContent).fonte
        })""")
        assert not erros, erros
        assert not luz["erro"], luz
        assert not luz["embutida"] or luz["resultado"], luz
        if luz["embutida"]:
            assert luz["resultado"]["geometryHashVerified"], luz
            assert luz["resultado"]["textureHashVerified"], luz
            assert conjunto["chamadas"] < 70, conjunto
        assert conjunto["visiveis"] > 0, conjunto
        assert modos == ["maquete", "planta2d", "planta3d", "visita", "maquete"], modos
        assert selecao == 7, selecao
        assert metricas["documento"] <= metricas["largura"], metricas
        resultados.append({"tela": nome, "alvo":alvo,"erros": erros, "modos": modos, "luz": luz, "conjunto": conjunto,
                           "andar_selecionado": selecao, "metricas": metricas})
        pagina.close()
    navegador.close()
(SAIDA / "runtime.json").write_text(json.dumps(resultados, indent=2, ensure_ascii=False), encoding="utf8")
print(json.dumps(resultados, ensure_ascii=False))
