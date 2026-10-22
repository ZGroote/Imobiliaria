"""MG-4: exporta a maquete de hoje para o pacote de dados do motor (maquete/motor).

    python pipeline/maquete_dados.py <imovel> --modo leve|premium --saida PASTA [--cidade sao-carlos]

O caminho (tasks/painel/maquete-geral.md §4):
  1. monta a página de hoje com o `pagina_maquete.py`, como o build: no LEVE, a do cadastro; no
     PREMIUM, a do padrão do Cedros (`padrao_atual.py`), com a luz calculada dele;
  2. abre a página num Chrome sem janela (sem placa de vídeo: o WebGL roda no SwiftShader) e lê a
     cena do `window.__maq`, como o `exportar_cena.py` do LIV. O relógio dos quadros fica parado:
     senão o giro sozinho e o pulso do pavimento mudariam a câmera e a cor a cada exportação;
  3. grava o pacote: `maquete.js` (a ficha e a planta, lidas da própria página), e `exterior/`, com
     a cena, o manifesto e, no PREMIUM, a luz do padrão no formato do motor.

Exportar duas vezes na mesma máquina dá os mesmos bytes: chaves em ordem, gzip sem data, nenhum
horário no manifesto. O que precisa de navegador fica em `extrair_cena`; o resto é testado sem ele
(tests/test_maquete_dados.py).
"""
import argparse
import base64
import gzip
import hashlib
import http.server
import json
import math
import struct
import subprocess
import sys
import tempfile
import threading
import time
from functools import partial
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MAQUETE = RAIZ / 'v1.5/miniaturas/pagina_maquete.py'
# A luz do exterior do Cedros, a mesma que o padrao_atual.py embute na página PREMIUM.
LUZ_DO_PADRAO = RAIZ / 'v1.5/miniaturas/padrao-atual/exterior-v3/lightmap.rgbm.gz'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
FAIXA_RGBM = 16

# Os quadros da página recebem sempre o mesmo instante: o `dt` dela fica 0, e a maquete não gira
# nem pulsa. Os tempos de verdade (performance.now, setTimeout) continuam andando.
RELOGIO_PARADO = 'const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(0));'

EXPORTAR = r"""() => {
  const m=window.__maq, geometries=[], materials=[], textures=[], meshes=[], lightMaps=new Set();
  const geometryIds=new Map(), materialIds=new Map(), textureIds=new Map();
  function encoded(array) {
    const bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
    let result='';
    for(let i=0;i<bytes.length;i+=32768) result+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {type:array.constructor.name,base64:btoa(result),length:array.length};
  }
  function attribute(a) {
    if(a.isInterleavedBufferAttribute) {
      const values=new a.data.array.constructor(a.count*a.itemSize);
      for(let i=0;i<a.count;i++) for(let c=0;c<a.itemSize;c++) values[i*a.itemSize+c]=a.data.array[i*a.data.stride+a.offset+c];
      return {...encoded(values),itemSize:a.itemSize,normalized:a.normalized};
    }
    return {...encoded(a.array),itemSize:a.itemSize,normalized:a.normalized};
  }
  function geometry(g) {
    if(geometryIds.has(g)) return geometryIds.get(g);
    const id=geometries.length; geometryIds.set(g,id);
    geometries.push({attributes:Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,attribute(a)])),
      index:g.index?attribute(g.index):null,groups:g.groups.map(({start,count,materialIndex})=>({start,count,materialIndex})),
      drawRange:{start:g.drawRange.start,count:Number.isFinite(g.drawRange.count)?g.drawRange.count:null}});
    return id;
  }
  function texture(t) {
    if(!t) return null;
    if(textureIds.has(t)) return textureIds.get(t);
    const id=textures.length; textureIds.set(t,id);
    const image=t.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');
    if(image.data) ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);
    else ctx.drawImage(image,0,0);
    textures.push({png:canvas.toDataURL('image/png').split(',')[1],width:image.width,height:image.height,
      colorSpace:t.colorSpace,flipY:t.flipY,premultiplyAlpha:t.premultiplyAlpha,channel:t.channel,
      wrapS:t.wrapS,wrapT:t.wrapT,minFilter:t.minFilter,magFilter:t.magFilter,generateMipmaps:t.generateMipmaps,
      repeat:t.repeat.toArray(),offset:t.offset.toArray(),center:t.center.toArray(),rotation:t.rotation,anisotropy:t.anisotropy});
    return id;
  }
  // A luz calculada vai à parte, como atlas: o material só diz que a usa (baked).
  function material(mat) {
    if(materialIds.has(mat)) return materialIds.get(mat);
    const id=materials.length;materialIds.set(mat,id);
    if(mat.lightMap)lightMaps.add(mat.lightMap);
    const item={name:mat.name,type:mat.type,baked:!!mat.lightMap,
      color:mat.color?.toArray(),emissive:mat.emissive?.toArray(),normalScale:mat.normalScale?.toArray()};
    for(const key of ['roughness','metalness','opacity','transparent','side','depthWrite','depthTest','alphaTest','vertexColors','emissiveIntensity','envMapIntensity','bumpScale','flatShading','polygonOffset','polygonOffsetFactor','polygonOffsetUnits','blending','visible','toneMapped']) if(mat[key]!==undefined) item[key]=mat[key];
    for(const key of ['map','bumpMap','normalMap','roughnessMap','metalnessMap','alphaMap','aoMap','emissiveMap']) if(mat[key]) item[key]=texture(mat[key]);
    materials.push(item);return id;
  }
  const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const plain=data=>Object.fromEntries(Object.entries(data).filter(([,v])=>['number','string','boolean'].includes(typeof v)));
  m.cena.updateMatrixWorld(true);
  // O enquadramento é o do prédio; o chão em volta (o do PREMIUM) não entra nele.
  const visibleBounds=new THREE.Box3();
  m.cena.traverse(o=>{
    if(!o.isMesh||!visible(o)) return;
    let inBuilding=false;for(let p=o;p;p=p.parent)if(p===m.predio)inBuilding=true;
    if(inBuilding)visibleBounds.expandByObject(o);
    meshes.push({name:o.name,geometry:geometry(o.geometry),material:Array.isArray(o.material)?o.material.map(material):material(o.material),
      matrix:o.matrixWorld.toArray(),castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,
      userData:plain(o.userData),instances:o.isInstancedMesh?{count:o.count,matrix:attribute(o.instanceMatrix),color:o.instanceColor?attribute(o.instanceColor):null}:null});
  });
  const lights=[];
  m.cena.traverse(o=>{if(o.isLight) lights.push({type:o.type,color:o.color.toArray(),groundColor:o.groundColor?.toArray()??null,intensity:o.intensity,
    position:o.position.toArray(),target:o.target?.position.toArray()??null,castShadow:o.castShadow,
    shadow:o.shadow?{bias:o.shadow.bias,normalBias:o.shadow.normalBias,mapSize:o.shadow.mapSize.toArray(),
      camera:{left:o.shadow.camera.left,right:o.shadow.camera.right,top:o.shadow.camera.top,bottom:o.shadow.camera.bottom,near:o.shadow.camera.near,far:o.shadow.camera.far}}:null});});
  const atlas=[...lightMaps].map(t=>({width:t.image.width,height:t.image.height}));
  return {geometries,materials,textures,meshes,lights,visibleBounds:{min:visibleBounds.min.toArray(),max:visibleBounds.max.toArray()},
    renderer:{exposure:m.ren.toneMappingExposure,toneMapping:m.ren.toneMapping,pixelRatio:1},
    camera:{fov:m.cam.fov,near:m.cam.near,far:m.cam.far,target:m.alvo.toArray(),orbit:{r:m.orb.r,th:m.orb.th,ph:m.orb.ph}},
    atlas,imovel:JSON.parse(document.getElementById('__imovel').textContent)};
}"""


def sha(dado):
    return hashlib.sha256(dado).hexdigest()


def gz(dado):
    # Sem data e com o byte do sistema fixo (255): o mesmo conteúdo dá os mesmos bytes.
    return gzip.compress(dado, compresslevel=9, mtime=0)


def montar_pagina(imovel, modo, cidade, pasta):
    """A página de hoje, como o build a monta, com fim de linha LF."""
    saida = pasta / 'maquete.html'
    subprocess.run([sys.executable, str(MAQUETE), '--cidade', cidade, '--unidade', imovel,
                    '--saida', str(saida), '--modo', modo], check=True, cwd=str(RAIZ), stdout=subprocess.DEVNULL)
    saida.write_bytes(saida.read_bytes().replace(b'\r\n', b'\n'))
    return saida


class Calado(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def extrair_cena(pagina, premium, chrome=CHROME):
    """Abre a página num Chrome sem janela e devolve a cena dela, mais a memória que o navegador usou."""
    from playwright.sync_api import sync_playwright

    servidor = http.server.ThreadingHTTPServer(('127.0.0.1', 0), partial(Calado, directory=str(pagina.parent)))
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    erros = []
    try:
        with sync_playwright() as pw:
            nav = pw.chromium.launch(executable_path=chrome if Path(chrome).exists() else None, headless=True,
                                     args=['--enable-unsafe-swiftshader'])
            page = nav.new_page(viewport={'width': 1280, 'height': 800}, device_scale_factor=1)
            page.on('pageerror', lambda e: erros.append(str(e)))
            page.add_init_script(RELOGIO_PARADO)
            page.goto(f'http://127.0.0.1:{servidor.server_address[1]}/{pagina.name}', wait_until='load', timeout=180000)
            page.wait_for_function('()=>window.__maq', timeout=180000)
            if premium:
                page.wait_for_function('()=>window.__exteriorV3?.ready||window.__exteriorV3?.error', timeout=300000)
                if page.evaluate('()=>__exteriorV3.error'):
                    raise RuntimeError('a luz do exterior não carregou: %s' % page.evaluate('()=>__exteriorV3.error'))
            cena = page.evaluate(EXPORTAR)
            cdp = page.context.new_cdp_session(page)
            cdp.send('Performance.enable')
            metricas = {m['name']: m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
            nav.close()
    finally:
        servidor.shutdown()
    if erros:
        raise RuntimeError('a página de hoje deu erro: %s' % erros)
    return cena, {'heap_js_mb': round(metricas.get('JSHeapUsedSize', 0) / 2**20, 1)}


def luz_do_padrao(caminho=LUZ_DO_PADRAO):
    """A luz do Cedros no formato do motor: o arquivo do padrão é gzip de [largura, altura (uint32 LE)]
    seguidos dos bytes RGBA; o motor lê só os bytes RGBA e confere largura × altura × 4."""
    bruto = gzip.decompress(caminho.read_bytes())
    largura, altura = struct.unpack('<II', bruto[:8])
    rgba = bruto[8:]
    if not largura or not altura or len(rgba) != largura * altura * 4:
        raise ValueError('luz do padrão inválida: %s' % caminho)
    return rgba, largura, altura


def vista(camera, r, ph):
    alvo, th = camera['target'], camera['orbit']['th']
    return {'type': 'PerspectiveCamera', 'fov': camera['fov'], 'near': camera['near'], 'far': camera['far'], 'zoom': 1,
            'aspect': 1280 / 800,
            'position': [alvo[0] + r * math.sin(th) * math.sin(ph), alvo[1] + r * math.cos(ph), alvo[2] + r * math.cos(th) * math.sin(ph)],
            'target': alvo, 'orbit': {'r': r, 'th': th, 'ph': ph}}


def dados_do_imovel(imovel, modo):
    """O `maquete.js` do pacote: a ficha e a planta da página de hoje (o `__imovel` que ela embute)."""
    uid = imovel['_id'] or 'imovel'
    andar, pavimentos = imovel.get('andar', 0), imovel['predio']['pavimentos']
    # ponytail: casa x apartamento pelo prédio; um térreo de prédio de 2 pavimentos sai "casa". O motor
    # trata os dois igual (uma unidade); quando o cadastro disser o tipo, ler de lá.
    tipo = 'apartamento' if andar > 0 or pavimentos > 2 else 'casa'
    planta = imovel['planta']
    return {
        'schema': 'maquete-dados-v1', 'tipo': tipo, 'imovel': uid, 'nome': imovel['empreendimento'], 'arquivo': uid,
        'paginaPreservada': None, 'mapa': {'pagina': 'tour.html', 'titulo': 'O que tem por perto de ' + imovel['empreendimento']},
        'edicoes': {modo: {'assets': 'dados/exterior/', 'units': None, 'glb': None,
                           'nome': '%s — %s' % (imovel['empreendimento'], 'com luz pré-calculada' if modo == 'premium' else 'sem luz pré-calculada')}},
        'edicaoPadrao': modo,
        'vistasDaCena': {'perspectiva': 'Perspectiva', 'aerea': 'Aérea'}, 'vistasExtras': {}, 'acabamentos': None,
        'ficha': {'tag': imovel['tag'], 'titulo': imovel['empreendimento'], 'subtitulo': imovel['unidade'],
                  'endereco': imovel['endereco'], 'preco': imovel['preco'], 'linhas': imovel['ficha']},
        'planta': {'pe_direito': planta['pe_direito'], 'comodos': planta['comodos'],
                   'portas': planta['portas'], 'janelas': planta['janelas']},
    }


def pacote(cena, pagina_sha, modo, luz=None):
    """Os arquivos do pacote ({caminho: bytes}), a partir da cena extraída. Só função de dados: o mesmo
    `cena` dá os mesmos bytes. `luz` é (rgba, largura, altura) no PREMIUM."""
    if bool(luz) != (modo == 'premium'):
        raise ValueError('o PREMIUM leva a luz calculada, e o LEVE não leva nenhuma')
    baked = sum(1 for m in cena['materials'] if m['baked'])
    if modo == 'premium':
        rgba, largura, altura = luz
        if cena['atlas'] != [{'width': largura, 'height': altura}] or not baked:
            raise ValueError('a página não usou a luz do padrão (%s)' % cena['atlas'])
    elif baked or cena['atlas']:
        raise ValueError('a página LEVE tem material com luz calculada')
    arquivos = {}
    texturas = []
    for i, t in enumerate(cena['textures']):
        nome = 'texture-%02d.png' % i
        arquivos['exterior/' + nome] = base64.b64decode(t['png'])
        texturas.append({**{k: v for k, v in t.items() if k != 'png'}, 'url': nome})
    cam = cena['camera']
    dado = {
        'schema': 'liv-exterior-proof-v1', 'sourceModelSHA256': pagina_sha,
        'geometries': cena['geometries'], 'materials': cena['materials'], 'textures': texturas, 'meshes': cena['meshes'],
        'lights': cena['lights'], 'visibleBounds': cena['visibleBounds'], 'renderer': cena['renderer'],
        'views': {'perspectiva': vista(cam, cam['orbit']['r'], cam['orbit']['ph']),
                  'aerea': vista(cam, cam['orbit']['r'] * 1.1, .55)},
        'rgbm': None,
    }
    if luz:
        arquivos['exterior/irradiance.rgbm.gz'] = gz(rgba)
        dado['rgbm'] = {'schema': 'liv-lightmap-v1', 'sourceSHA256': pagina_sha, 'textureURL': 'irradiance.rgbm.gz',
                        'textureCompression': 'gzip', 'textureEncoding': 'linear-rgbm-u8', 'textureSHA256': sha(rgba),
                        'width': largura, 'height': altura, 'range': FAIXA_RGBM, 'origin': 'bottom-left',
                        'premultiplyAlpha': False, 'lightMapIntensity': 3.141592653589793}
    json_cena = json.dumps(dado, ensure_ascii=True, separators=(',', ':')).encode()
    arquivos['exterior/scene.json.gz'] = gz(json_cena)
    manifesto = {'schema': 'liv-proof-manifest-v1', 'origem': 'pipeline/maquete_dados.py', 'modo': modo,
                 'sourceModelSHA256': pagina_sha, 'sceneJSONSHA256': sha(json_cena),
                 'files': {n[len('exterior/'):]: {'bytes': len(b), 'sha256': sha(b)} for n, b in sorted(arquivos.items())},
                 'meshCount': len(cena['meshes']),
                 'bakedMeshes': sum(1 for m in cena['meshes'] if isinstance(m['material'], int) and cena['materials'][m['material']]['baked'])}
    arquivos['exterior/manifest.json'] = (json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n').encode()
    dados = dados_do_imovel(cena['imovel'], modo)
    arquivos['maquete.js'] = ('// Pacote de dados de %s (%s), exportado por pipeline/maquete_dados.py da maquete de hoje.\n'
                              'export default %s;\n' % (dados['imovel'], modo.upper(), json.dumps(dados, ensure_ascii=False, indent=1))).encode()
    return arquivos


def exportar(imovel, modo, saida, cidade='sao-carlos', chrome=CHROME):
    """Monta, extrai e grava. Devolve o que foi gravado, com tamanho e tempo de cada etapa."""
    tempo = {}
    t = time.perf_counter()
    with tempfile.TemporaryDirectory(prefix='maquete-dados-') as tmp:
        pagina = montar_pagina(imovel, modo, cidade, Path(tmp))
        pagina_sha = sha(pagina.read_bytes())
        tempo['montar_s'] = round(time.perf_counter() - t, 1)
        t = time.perf_counter()
        cena, memoria = extrair_cena(pagina, modo == 'premium', chrome)
        tempo['extrair_s'] = round(time.perf_counter() - t, 1)
    t = time.perf_counter()
    arquivos = pacote(cena, pagina_sha, modo, luz_do_padrao() if modo == 'premium' else None)
    saida = Path(saida)
    for nome, dado in arquivos.items():
        (saida / nome).parent.mkdir(parents=True, exist_ok=True)
        (saida / nome).write_bytes(dado)
    tempo['gravar_s'] = round(time.perf_counter() - t, 1)
    return {'imovel': imovel, 'modo': modo, 'pagina_sha256': pagina_sha, **tempo, **memoria,
            'malhas': len(cena['meshes']), 'arquivos': {n: {'bytes': len(b), 'sha256': sha(b)} for n, b in sorted(arquivos.items())}}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('imovel')
    p.add_argument('--modo', choices=('leve', 'premium'), required=True)
    p.add_argument('--saida', type=Path, required=True)
    p.add_argument('--cidade', default='sao-carlos')
    a = p.parse_args(argv)
    print(json.dumps(exportar(a.imovel, a.modo, a.saida, a.cidade), ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
