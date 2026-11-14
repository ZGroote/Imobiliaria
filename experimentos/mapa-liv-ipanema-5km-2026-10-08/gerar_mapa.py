"""Teste de recorte a partir de um snapshot completo de São Carlos já montado.

O snapshot é lido uma vez no preparo; o navegador recebe somente o pacote regional.
Não modifica os dados originais, as coordenadas da cidade ou o mapa compartilhado.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import html
import json
import math
import re
import shutil
import sys
import zlib

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parents[1]
sys.path.insert(0, str(RAIZ))
from padrao.cidade import carrega

LAT = -21.988640293284593
LON = -47.921966616665976
RAIO = 5000
BASE = RAIZ / 'v16-moveis/publicado/mapa/sao-carlos-exteriores-f16b0250b705.html'
SCRIPT = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.S)


def blocos(texto):
    result = {}
    for match in SCRIPT.finditer(texto):
        ident = re.search(r'id="([^"]+)"', match['attrs'])
        if not ident:
            continue
        corpo = match['body']
        if 'data-zip=' in match['attrs']:
            corpo = zlib.decompress(base64.b64decode(corpo.strip()), -15).decode('utf8')
        result[ident[1]] = (match['attrs'], corpo)
    return result


def substituir(texto, corpos):
    def troca(match):
        ident = re.search(r'id="([^"]+)"', match['attrs'])
        if not ident or ident[1] not in corpos:
            return match[0]
        corpo = corpos[ident[1]]
        if 'data-zip=' in match['attrs']:
            compressor = zlib.compressobj(9, wbits=-15)
            corpo = base64.b64encode(compressor.compress(corpo.encode('utf8')) + compressor.flush()).decode('ascii')
        else:
            corpo = corpo.replace('</', '<\\/')
        return '<script' + match['attrs'] + '>' + corpo + '</script>'
    return SCRIPT.sub(troca, texto)


def inserir_ui(texto, barra):
    # Este snapshot é HTML com head/body implícitos, sem </body>. Inserir antes
    # dos scripts comprimidos garante posição pronta antes do boot assíncrono.
    match = re.search(r'<script[^>]*id="__three"[^>]*>', texto)
    if not match:
        raise ValueError('Biblioteca Three não encontrada no snapshot')
    return texto[:match.start()] + barra + texto[match.start():]


def limites_geometria(corpos):
    """Envelope conservador de diagnóstico, com margem dos modelos genéricos."""
    bounds = [math.inf, math.inf, -math.inf, -math.inf]
    def ponto(x, z):
        bounds[0] = min(bounds[0], x); bounds[1] = min(bounds[1], z)
        bounds[2] = max(bounds[2], x); bounds[3] = max(bounds[3], z)
    c = json.loads(corpos['__citydata'])
    assert c['q'] == 10
    b, i = c['b'], 0
    while i < len(b):
        n = b[i+2]; i += 3
        x = z = 0
        for _ in range(n):
            x += b[i]; z += b[i+1]; i += 2
            ponto(x/10, z/10)
    for key in ('r','g'):
        a, i = c.get(key) or [], 0
        while i < len(a):
            if key == 'r': i += 2
            n = a[i]; i += 1
            x = z = 0
            for _ in range(n):
                x += a[i]; z += a[i+1]; i += 2
                ponto(x/10, z/10)
    for ident in ('__grounddata','__streetdata'):
        a = json.loads(corpos[ident])
        for i in range(0,len(a),2): ponto(a[i],a[i+1])
    for ident, step in (('__murosdata',4),('__portoes',5)):
        a = json.loads(corpos[ident]); x = z = 0
        for i in range(0,len(a),step):
            x += a[i]; z += a[i+1]
            if ident == '__murosdata':
                ponto(x/10,z/10); ponto((x+a[i+2])/10,(z+a[i+3])/10)
            else:
                # Portão: ângulo e largura, em vez de dx/dz. Envelope conservador.
                width = abs(a[i+3])/10
                ponto(x/10-width,z/10-width); ponto(x/10+width,z/10+width)
    for p in json.loads(corpos['__exteriorModels']).get('placements') or []:
        ponto(p[1]-50,p[2]-50); ponto(p[1]+50,p[2]+50)
    return bounds


def ui(corpos, regional, centro):
    nome = 'LIV Ipanema · São Carlos · 5 km'
    # Executado depois do boot da aplicação, usando somente a porta de QA existente.
    marker = """
;(function () {
  var tentativas = 0;
  function iniciar() {
    var I = window.__int;
    if (!I || !I.scene || !I.camera || !I.target) {
      if (++tentativas < 300) setTimeout(iniciar, 100);
      return;
    }
    var x = CENTRO_X, z = CENTRO_Z;
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({color:0xffbf4b,depthTest:false});
    var pin = new THREE.Mesh(new THREE.ConeGeometry(14,50,12),mat);
    pin.rotation.z = Math.PI; pin.position.set(x,80,z); pin.renderOrder=100;
    group.add(pin);
    var points=[];
    for(var i=0;i<=720;i++) {var a=i*Math.PI/360; points.push(new THREE.Vector3(x+5000*Math.cos(a),3,z+5000*Math.sin(a)));}
    var ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xffbf4b,transparent:true,opacity:0.75,depthTest:false}));
    ring.renderOrder=99;group.add(ring);I.scene.add(group);
    var label=document.createElement('div');label.id='livLocalizacao';label.textContent='Liv Ipanema';
    label.style.cssText='position:fixed;z-index:60;pointer-events:none;background:#18242ee8;color:#ffbf4b;border:1px solid #ffbf4b;padding:5px 8px;border-radius:6px;font:600 12px system-ui;transform:translate(-50%,-100%)';
    document.body.appendChild(label);
    var pos=new THREE.Vector3(),lastHeight=null;
    function frame(){
      if(I.livTerrain){var h=I.livTerrain.sample(x,z);if(h!==lastHeight){lastHeight=h;var p=ring.geometry.attributes.position;for(var j=0;j<p.count;j++)p.setY(j,I.livTerrain.sample(p.getX(j),p.getZ(j))+1);p.needsUpdate=true;}}
      var model=window.__livModel;pos.set(model?model.object.position.x:x,model?model.object.position.y+65:110,model?model.object.position.z:z).project(I.camera);label.style.display=pos.z<1&&Math.abs(pos.x)<1&&Math.abs(pos.y)<1?'block':'none';label.style.left=((pos.x+1)*innerWidth/2)+'px';label.style.top=((1-pos.y)*innerHeight/2)+'px';requestAnimationFrame(frame);}
    frame();window.__livMapa={centro:[x,z],raio:5000,marker:group};
  }
  iniciar();
})();
""".replace('CENTRO_X', repr(centro[0])).replace('CENTRO_Z', repr(centro[1]))
    # A ponte lê a mesma altura e o mesmo estado do relevo que o renderizador usa.
    nearby_bridge = ('nearby:{catalog:()=>POIS,categories:CAT,'
                     'filter:keys=>{closePoiSheet();for(const k of CAT_KEYS)aplicaCat(k,keys.includes(k));setPins(keys.length>0);},'
                     'select:id=>{const p=POIS[id];if(!p)return false;openPoiSheet(p);psheet.classList.remove("on");return true;},'
                     'clear:()=>{closePoiSheet();setPins(false);}},')
    app, bridges = corpos['__app'].replace('window.__int = { INT,', 'window.__int = { '+nearby_bridge+' livTerrain:{sample:terrainY,amount:()=>reliefAmount,invalidate:sujaSombra,diagnostics:window.__livTerrainPatch.diagnostics,sampleOriginal:window.__livTerrainPatch.sampleOriginal}, INT,', 1), corpos['__app'].count('window.__int = { INT,')
    if bridges != 1:
        raise ValueError('Porta de integração do terreno mudou')
    # Quintais são um módulo IIFE separado; a política precisa estar acessível
    # tanto nele quanto no escopo principal do app.
    terrain_setup = ('window.__livTerrainPatch = LivTerrain.create({baseFit:TerrainFit,'
                     f'center:[{centro[0] + 8},{centro[1] - 6}],rotation:-Math.PI/3,'
                     'transitionMeters:12,stepMeters:5,exaggeration:TERRAIN_EXAG});\n')
    terrain_hooks = {
        'function terrainY(x, z) {': terrain_setup + 'function terrainY(x, z) {',
        'TerrainFit.sample(elevGrid,ELEV_N,ELEV_HALF,x,z)': 'window.__livTerrainPatch.sample(elevGrid,ELEV_N,ELEV_HALF,x,z)',
        'function registerTerrain(geo) {': 'function registerTerrain(geo) {\n  window.__livTerrainPatch.refine(THREE,geo);',
        'TerrainFit.refine(THREE,g,terrain);': 'TerrainFit.refine(THREE,g,terrain);\n      window.__livTerrainPatch.refine(THREE,g,true);',
    }
    for before, after in terrain_hooks.items():
        if app.count(before) != 1:
            raise ValueError('Gancho local de terreno mudou: ' + before)
        app = app.replace(before, after, 1)
    from app_estrito import aplicar
    app = aplicar(app, centro, RAIO)
    loader = (PASTA/'vendor/GLTFLoader-r128.js').read_text('utf8')
    factory = (PASTA/'maquete-no-mapa.js').read_text('utf8')
    attach = (PASTA/'inserir-maquete.js').read_text('utf8')
    terrace = (PASTA/'liv-terreno.js').read_text('utf8')
    circle = (PASTA/'limite-circular.js').read_text('utf8')
    ground = (PASTA/'chao-circular.js').read_text('utf8')
    interface = (PASTA/'mapa-interface.js').read_text('utf8')
    nearby = (PASTA/'busca-proximos.js').read_text('utf8')
    corpos['__app'] = '\n'.join((loader,factory,terrace,circle,ground,interface,nearby,app,marker,attach))
    return f"""
<style>
#livMapaBar{{position:fixed;left:260px;right:230px;bottom:10px;z-index:70;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:9px 12px;border:1px solid #ffffff30;border-radius:10px;background:#14212eef;color:#eef3f8;font:12px system-ui}}
#livMapaBar strong{{margin-right:auto}}#livMapaBar a{{color:#ffcf75;text-decoration:none;padding:5px}}#livFocar{{background:#263b47;color:#ffcf75;border:1px solid #ffffff40;border-radius:6px;padding:7px;cursor:pointer;font:inherit}}
@media(max-width:600px){{#livMapaBar{{left:10px;right:10px;font-size:11px;bottom:104px;padding:6px 8px;gap:3px}}}}
@media(max-width:600px){{body:has(#mOpcoes[aria-expanded="true"]) #livMapaBar{{display:none}}}}
</style>
<nav id="livMapaBar" aria-label="Mapa do Liv Ipanema"><strong>{html.escape(nome)}</strong><button id="livFocar" type="button">Centralizar</button><a href="maquete-liv-ipanema.html">Abrir maquete</a></nav>
<script>
(function(){{
 var p=new URLSearchParams(location.search);
 if(!p.has('em')){{p.set('em','{LAT},{LON}');p.set('r','400');p.set('p','1.05');p.set('t','-0.40');history.replaceState(null,'',location.pathname+'?'+p.toString());}}
}})();
</script>
"""


def copiar_tiles(bloco, origem, destino):
    info = json.loads(bloco).get('parcelTiles') or {}
    prefix = info.get('prefix', '')
    relative = Path(prefix)
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Prefixo de tiles fora do pacote')
    count = total = 0
    for key in info.get('keys', []):
        if not re.fullmatch(r'-?\d+_-?\d+', key):
            raise ValueError('Chave de tile inválida')
        source = origem / relative / (key + '.bin')
        target = destino / relative / source.name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        count += 1
        total += source.stat().st_size
    return {'arquivos': count, 'bytes': total}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', type=Path, default=BASE)
    parser.add_argument('--destino', type=Path, default=PASTA / 'mapas-v3')
    args = parser.parse_args()
    args.destino.mkdir(parents=True, exist_ok=True)
    source_bytes = args.base.read_bytes()
    source = source_bytes.decode('utf-8-sig')
    # O snapshot contém retorno para miniaturas antigas; o teste tem retorno próprio.
    source, removed = re.subn(r'<a id="voltarMiniatura"[^>]*>.*?</a>\s*<script>.*?</script>', '', source, count=1, flags=re.S)
    if removed != 1:
        raise ValueError('Revisar navegação de retorno do snapshot')
    antes = blocos(source)
    cidade = carrega('sao-carlos')
    assert json.loads(antes['__cidade'][1])['centro'] == {'lat':cidade.clat,'lon':cidade.clon}
    centro = cidade.geo_para_mapa(LON, LAT)
    from recorte_regional import RecorteRegional
    corte = RecorteRegional(centro, RAIO, cid=cidade)
    corte.prepare_assets(json.loads(antes['__urbanModels'][1]))
    # Preparar cidade e vínculos antes dos dados dependentes.
    corpos = {'__citydata':corte.aplica('__citydata',antes['__citydata'][1])}
    medidas = {}
    rasters = ('__vegetacao','__elevdata')
    for ident, (attrs, texto) in antes.items():
        if ident == '__citydata':
            result = corpos[ident]
        elif ident not in rasters and ident != '__app' and ('json' in attrs):
            result = corte.aplica(ident, texto)
        else:
            result = texto
        corpos[ident] = result
        medidas[ident] = {'antes':len(texto.encode('utf8')),'depois':len(result.encode('utf8'))}
    for ident, value in (('__imoveis',[]),('__unidades',[]),('__luzue',{})):
        corpos[ident] = json.dumps(value,separators=(',',':'))
        medidas[ident]['depois'] = len(corpos[ident].encode('utf8'))
    listing = json.loads(corpos['__listingModels'])
    listing['assets'] = []
    corpos['__listingModels'] = json.dumps(listing,separators=(',',':'))
    medidas['__listingModels']['depois'] = len(corpos['__listingModels'].encode('utf8'))
    from tiles_circulares import recortar_tiles
    exterior = json.loads(corpos['__exteriorModels'])
    # A âncora de um lote pode estar em outro tile enquanto seu chão cruza
    # o círculo. Ler toda a fonte offline e publicar somente interseções reais.
    exterior['parcelTiles']['keys'] = json.loads(antes['__exteriorModels'][1])['parcelTiles']['keys']
    tiles_regionais = recortar_tiles(exterior,args.base.parent,args.destino,corte)
    corte.relatorio['parcelTiles'] = (corte.relatorio['parcelTiles'][0],tiles_regionais['arquivos'])
    for name in ('imoveis','unidades','listingModels'):
        corte.relatorio[name] = (corte.relatorio[name][0],0)
    for ident in ('__imoveis','__unidades','__luzue','__listingModels'):
        corte.relatorio[ident] = (corte.relatorio[ident][0],len(corpos[ident].encode('utf8')))
    corpos['__exteriorModels'] = json.dumps(exterior,separators=(',',':'))
    medidas['__exteriorModels']['depois'] = len(corpos['__exteriorModels'].encode('utf8'))
    corte.geometry_bounds = limites_geometria(corpos)
    for ident in rasters:
        texto = antes[ident][1]
        corpos[ident] = corte.aplica(ident,texto)
        medidas[ident]['depois'] = len(corpos[ident].encode('utf8'))
    assert json.loads(corpos['__cidade']) == json.loads(antes['__cidade'][1])
    corpos['__app'] = (PASTA/'raster-regional.js').read_text('utf8') + '\n' + corpos['__app']
    barra = ui(corpos, True, centro)
    medidas['__app']['depois'] = len(corpos['__app'].encode('utf8'))
    regional = inserir_ui(substituir(source, corpos), barra)
    regional = re.sub(r'<title>.*?</title>', '<title>Liv Ipanema · mapa de 5 km</title>', regional, count=1)
    # A posição deve ser escrita antes do carregador assíncrono executar o app.
    # A barra já está no body quando o carregador chega ao primeiro await.
    alvo = args.destino/'mapa-liv-ipanema-5km.html'
    alvo.write_text(regional, encoding='utf8', newline='')
    base_tiles = json.loads(antes['__exteriorModels'][1])['parcelTiles']
    tiles_completos = {'arquivos':len(base_tiles['keys']),
                      'bytes':sum((args.base.parent/base_tiles['prefix']/(k+'.bin')).stat().st_size for k in base_tiles['keys'])}
    glb = RAIZ/'v1.5/miniaturas/liv-ipanema/liv-ipanema.glb'
    shutil.copyfile(glb,args.destino/glb.name)
    report = {
        'cidade':'sao-carlos','empreendimento':'liv-ipanema','lat':LAT,'lon':LON,
        'referencia_localizacao':'Ponto Google Maps publicado pela Livon; precisão cadastral não confirmada',
        'raio_m':RAIO,'area_circulo_km2':math.pi*(RAIO/1000)**2,'centro_m':centro,
        'envelope_conservador_com_margem_m':corte.geometry_bounds,
        'maquete':{'arquivo':glb.name,'bytes':glb.stat().st_size,'sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),
                    'scale':1,'rotation_radians':-math.pi/3,'offset_m':[8,-6],'posicao_aproximada':True,'iluminacao':'Luzes do mapa'},
        'source':str(args.base.resolve()),'sourceSHA256':hashlib.sha256(source_bytes).hexdigest(),
        'mapa_base_bytes':len(source_bytes),'mapa_regional_bytes':alvo.stat().st_size,
        'reducao_pct':round(100*(1-alvo.stat().st_size/len(source_bytes)),2),
        'blocos':medidas,'contagens':corte.relatorio,
        'rasters':{k:{field:value for field,value in v.items() if field not in ('indices','values','ndvi_b64')} for k,v in corte.rasters.items()},
        'tiles_regionais':tiles_regionais,'tiles_base':tiles_completos,
        'geometrias':'Geometria cortada antes de download; amostras raster apenas internas; tiles reescritos. Chão contínuo gerado somente dentro do círculo de 5km.',
        'versao':'strict-circle-v3','ground_policy':'full-circle',
        'escopo':'Teste de transferência/renderização com snapshot já montado; consulta espacial em banco ainda não implementada.'
    }
    (PASTA/'medicoes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:report[k] for k in ('mapa_base_bytes','mapa_regional_bytes','reducao_pct','contagens','rasters')},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
