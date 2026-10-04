"""Comparativo visual isolado e medição estática dos bytes presentes no disco.

A base fica em plano-a.html; banners são removidos antes de gerar novamente.
Nenhum tempo de rede, FPS, VRAM, conversão ou custo é estimado como medição.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re

PASTA = Path(__file__).resolve().parent

js_planob_override = """
/* ==========================================================================
   PLANO B: ATIVAÇÃO DE TEXTURAS PROCEDURAIS PBR & STAGING DE ALTO PADRÃO
   ========================================================================== */
(function() {
  if (typeof THREE === 'undefined') return;
  var loader = new THREE.TextureLoader();
  var assetPath = 'assets_planob/';

  // 1. Texturas Procedurais de Piso de Madeira Nobre
  loader.load(assetPath + 'piso_madeira_albedo.jpg', function(texAlbedo) {
    texAlbedo.wrapS = texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.repeat.set(4, 4);
    if (THREE.SRGBColorSpace) texAlbedo.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'piso_madeira_normal.jpg', function(texNormal) {
      texNormal.wrapS = texNormal.wrapT = THREE.RepeatWrapping;
      texNormal.repeat.set(4, 4);
      
      loader.load(assetPath + 'piso_madeira_roughness.jpg', function(texRough) {
        texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
        texRough.repeat.set(4, 4);
        
        var mat = window.__MAT || (typeof MAT !== 'undefined' ? MAT : null);
        if (mat && mat.matMadeira) {
          mat.matMadeira.map = texAlbedo;
          mat.matMadeira.normalMap = texNormal;
          mat.matMadeira.normalScale.set(0.65, 0.65);
          mat.matMadeira.roughnessMap = texRough;
          mat.matMadeira.roughness = 0.85;
          mat.matMadeira.envMapIntensity = 0.65;
          mat.matMadeira.needsUpdate = true;
        }
      });
    });
  });

  // 2. Texturas Procedurais de Linho Procedural para Sofá e Cama
  loader.load(assetPath + 'tecido_linho_albedo.jpg', function(texAlbedo) {
    texAlbedo.wrapS = texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.repeat.set(5, 5);
    if (THREE.SRGBColorSpace) texAlbedo.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'tecido_linho_normal.jpg', function(texNormal) {
      texNormal.wrapS = texNormal.wrapT = THREE.RepeatWrapping;
      texNormal.repeat.set(5, 5);
      
      loader.load(assetPath + 'tecido_linho_roughness.jpg', function(texRough) {
        texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
        texRough.repeat.set(5, 5);
        
        var sTecido = window.__matSofaTecido || (typeof matSofaTecido !== 'undefined' ? matSofaTecido : null);
        if (sTecido) {
          sTecido.map = texAlbedo;
          sTecido.normalMap = texNormal;
          sTecido.normalScale.set(0.5, 0.5);
          sTecido.roughnessMap = texRough;
          sTecido.roughness = 0.75;
          sTecido.needsUpdate = true;
        }
        var cTecido = window.__matCamaTecido || (typeof matCamaTecido !== 'undefined' ? matCamaTecido : null);
        if (cTecido) {
          cTecido.map = texAlbedo;
          cTecido.normalMap = texNormal;
          cTecido.normalScale.set(0.45, 0.45);
          cTecido.roughnessMap = texRough;
          cTecido.needsUpdate = true;
        }
      });
    });
  });

  // 3. Mármore Procedural Calacatta para Bancadas
  loader.load(assetPath + 'marmore_albedo.jpg', function(texMarmore) {
    texMarmore.wrapS = texMarmore.wrapT = THREE.RepeatWrapping;
    texMarmore.repeat.set(2, 2);
    if (THREE.SRGBColorSpace) texMarmore.colorSpace = THREE.SRGBColorSpace;
    
    loader.load(assetPath + 'marmore_roughness.jpg', function(texRough) {
      texRough.wrapS = texRough.wrapT = THREE.RepeatWrapping;
      texRough.repeat.set(2, 2);
      
      var mat = window.__MAT || (typeof MAT !== 'undefined' ? MAT : null);
      if (mat && mat.matFrio) {
        mat.matFrio.map = texMarmore;
        mat.matFrio.roughnessMap = texRough;
        mat.matFrio.roughness = 0.28;
        mat.matFrio.metalness = 0.08;
        mat.matFrio.envMapIntensity = 0.95;
        mat.matFrio.needsUpdate = true;
      }
    });
  });

  // 4. Staging Decorativo Adicional: Tapete Nórdico & Livros de Design
  window.addEventListener('load', function() {
    setTimeout(function() {
      var cenaAlvo = window.__cena3D;
      if (!cenaAlvo || typeof cenaAlvo.add !== 'function') return;
      
      loader.load(assetPath + 'tapete_sala_albedo.jpg', function(texTapete) {
        if (THREE.SRGBColorSpace) texTapete.colorSpace = THREE.SRGBColorSpace;
        var matTapete = new THREE.MeshStandardMaterial({
          map: texTapete,
          roughness: 0.85,
          metalness: 0.0,
          envMap: (typeof ambientePBR !== 'undefined' ? ambientePBR : null),
          envMapIntensity: 0.25
        });
        
        // Tapete elegante na sala
        var tapeteGeo = new THREE.PlaneGeometry(2.2, 1.6);
        var tapeteMesh = new THREE.Mesh(tapeteGeo, matTapete);
        tapeteMesh.rotation.x = -Math.PI / 2;
        tapeteMesh.position.set(0.2, 0.015, -0.4);
        tapeteMesh.receiveShadow = true;
        cenaAlvo.add(tapeteMesh);
      });
      
      // Arranjo de livros de arte e vaso de cerâmica na mesa de centro
      var decorGroup = new THREE.Group();
      var matLivro1 = new THREE.MeshStandardMaterial({ color: 0x2A2E35, roughness: 0.5 });
      var matLivro2 = new THREE.MeshStandardMaterial({ color: 0xDCD5CB, roughness: 0.6 });
      var livro1 = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.035, 0.22), matLivro1);
      var livro2 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.030, 0.20), matLivro2);
      livro2.position.set(0.02, 0.035, 0.01);
      livro2.rotation.y = 0.12;
      
      // Vaso cerâmico nórdico
      var matVaso = new THREE.MeshStandardMaterial({ color: 0x9B8E80, roughness: 0.45, metalness: 0.05 });
      var vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.16, 16), matVaso);
      vaso.position.set(-0.25, 0.08, 0.0);
      
      decorGroup.add(livro1);
      decorGroup.add(livro2);
      decorGroup.add(vaso);
      decorGroup.position.set(0.2, 0.46, -0.4);
      cenaAlvo.add(decorGroup);
      
    }, 600);
  });
})();
"""


def sha256(dado):
    return hashlib.sha256(dado).hexdigest()


def base_sem_banner(source):
    source = re.sub(r'<style id="estiloComparativo">.*?</style>\s*', '', source, flags=re.S)
    source = re.sub(r'<(?:div|aside) id="badgePlano".*?</(?:div|aside)>\s*', '', source, flags=re.S)
    source = re.sub(r'(<title>)\[Plano A[^]]*\]\s*', r'\1', source)
    return re.sub(r'<body>\s*', '<body>\n', source, count=1)


def banner(plano):
    cor = '#4bdb7c' if plano == 'A' else '#60a5fa'
    texto = 'Materiais embutidos' if plano == 'A' else 'JPGs procedurais externos'
    return f"""<style id="estiloComparativo">
#badgePlano{{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;width:max-content;max-width:calc(100vw - 16px);box-sizing:border-box;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 10px;padding:6px 12px;border-radius:12px;background:#0c1219ef;border:1px solid {cor};color:#e7ebf0;font:12px system-ui;text-align:center}}
#badgePlano a{{color:{cor};padding:6px;min-height:32px;box-sizing:border-box}}
#badgePlano span{{white-space:normal}}
@media(max-width:480px){{#badgePlano{{font-size:11px;gap:2px 8px}}}}
</style>
<aside id="badgePlano" aria-label="Experimento comparativo"><strong>Plano {plano} · Experimento</strong><span>{texto} · Desempenho NÃO MEDIDO</span><a href="comparativo.html">Comparar</a></aside>"""


def prototipos(source):
    base = base_sem_banner(source)
    if '<body>' not in base or '</body>' not in base:
        raise ValueError('Fonte deve conter body; nenhum arquivo foi gerado.')
    a = base.replace('<body>\n', '<body>\n' + banner('A') + '\n', 1)
    a = a.replace('<title>', '<title>[Plano A · Experimento] ', 1)
    b = base.replace('var cena = new THREE.Scene();', 'var cena = window.__cena3D = new THREE.Scene();')
    b = b.replace('var MAT = InteriorMaterials.create({', 'var MAT = window.__MAT = InteriorMaterials.create({')
    b = b.replace('var matSofaTecido = new THREE.MeshStandardMaterial({', 'var matSofaTecido = window.__matSofaTecido = new THREE.MeshStandardMaterial({')
    b = b.replace('var matCamaTecido = new THREE.MeshStandardMaterial({', 'var matCamaTecido = window.__matCamaTecido = new THREE.MeshStandardMaterial({')
    b = b.replace('<body>\n', '<body>\n' + banner('B') + '\n', 1)
    b = b.replace('<title>', '<title>[Plano B · Experimento] ', 1)
    b = b.replace('</body>', '<script>\n' + js_planob_override + '\n</script>\n</body>', 1)
    return base, a, b


def arquivo(path, pasta):
    dado = path.read_bytes()
    return {'arquivo': path.relative_to(pasta).as_posix(), 'bytes': len(dado),
            'gzip_local_bytes': len(gzip.compress(dado, mtime=0)), 'sha256': sha256(dado)}


def medir(pasta):
    referencias = sorted(set(re.findall(r"loader\.load\(assetPath \+ '([^']+)'", js_planob_override)))
    planos = {}
    for nome in ('a', 'b'):
        principal = arquivo(pasta / f'plano-{nome}.html', pasta)
        assets = [arquivo(pasta / 'assets_planob' / ref, pasta) for ref in referencias] if nome == 'b' else []
        planos[nome] = {'html': principal, 'assets_referenciados_no_codigo': assets,
                       'bytes_assets_referenciados': sum(a['bytes'] for a in assets),
                       'bytes_pacote_referenciado': principal['bytes'] + sum(a['bytes'] for a in assets)}
    inventario = [arquivo(p, pasta) for p in sorted((pasta / 'assets_planob').glob('*.jpg'))]
    return {'schema': 2, 'classe': 'medicao-estatica-local',
            'metodo': 'Bytes e SHA-256 dos arquivos; gzip local com mtime=0. Referências de JPG identificadas no código, sem observar tráfego HTTP.',
            'planos': planos, 'inventario_assets': inventario,
            'assets_nao_referenciados_no_override': [a['arquivo'] for a in inventario if Path(a['arquivo']).name not in referencias],
            'nao_medido': {k: 'NÃO MEDIDO' for k in (
                'transferencia_http', 'requisicoes_http', 'abertura_3g_4g_wifi',
                'fps_mobile', 'vram', 'abandono', 'custo_cdn', 'qualidade_com_usuarios')},
            'conclusao': 'A diferença de bytes é verificável. Escolha de produto requer medições de rede, aparelho e usabilidade no mesmo protocolo.'}


def dashboard(metricas):
    def kb(n):
        return f'{n / 1024:.1f} KiB'
    cards = []
    for nome, titulo, texto in [('a', 'Plano A', 'Materiais embutidos na maquete.'),
                                ('b', 'Plano B', 'Mesma base com JPGs procedurais externos e decoração experimental.')]:
        p = metricas['planos'][nome]
        cards.append(f"""<article><h2>{titulo}</h2><p>{texto}</p><dl><dt>HTML em disco</dt><dd>{kb(p['html']['bytes'])}</dd><dt>HTML gzip local</dt><dd>{kb(p['html']['gzip_local_bytes'])}</dd><dt>JPGs referenciados no código</dt><dd>{len(p['assets_referenciados_no_codigo'])} · {kb(p['bytes_assets_referenciados'])}</dd></dl><a href="plano-{nome}.html?modo=planta3d">Abrir {titulo}</a></article>""")
    return """<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Experimento comparativo de maquetes 3D</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0c1219;color:#e7ebf0;font:16px/1.5 system-ui;padding:24px}main{max-width:1100px;margin:auto}h1{font-size:clamp(24px,4vw,36px)}p{color:#b4c0cc}a{color:#8cc2ff}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}article{background:#17202c;border:1px solid #334155;border-radius:14px;padding:20px;min-width:0}dl{display:grid;grid-template-columns:1fr auto;gap:10px}dd{margin:0;text-align:right}button{font:inherit;min-height:44px;border:1px solid #64748b;border-radius:8px;background:#263549;color:white;padding:8px 16px;margin:4px 8px 12px 0;cursor:pointer}button[aria-pressed=true]{background:#075985}iframe{width:100%;height:70vh;border:1px solid #334155;border-radius:12px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #334155}.table{overflow:auto}@media(max-width:620px){body{padding:16px}section{grid-template-columns:1fr}dl{grid-template-columns:1fr}dd{text-align:left}iframe{height:65vh}}</style>
<main><h1>Comparativo visual: Plano A e Plano B</h1><p>Protótipos sintéticos para investigação. Os números abaixo medem arquivos locais; gzip local não representa bytes transferidos pelo servidor.</p><section>""" + ''.join(cards) + """</section>
<h2>O que ainda precisa ser medido</h2><div class="table"><table><tr><th>Critério</th><th>Estado dos dois planos</th></tr><tr><td>Abertura em 3G/4G/Wi-Fi e requisições HTTP</td><td>NÃO MEDIDO</td></tr><tr><td>FPS em aparelho físico e memória GPU</td><td>NÃO MEDIDO</td></tr><tr><td>Abandono, conversão e custo de distribuição</td><td>NÃO MEDIDO</td></tr><tr><td>Qualidade e compreensão por usuários</td><td>NÃO MEDIDO</td></tr></table></div>
<p>Os JPGs são desenhados por NumPy/Pillow com sementes fixas. Não são fotos nem escaneamentos; o arquivo ambiente_hdri.jpg é um JPEG LDR sintético e não é referenciado pelo override atual. Referência no código não comprova download, aplicação visual ou enquadramento correto.</p>
<p><a href="metricas_comparativo.json">Métricas e hashes</a> · <a href="manifest.json">Manifesto da derivação</a></p><h2>Explorar os protótipos</h2><button type="button" aria-pressed="true" onclick="mostrar('a',this)">Plano A</button><button type="button" aria-pressed="false" onclick="mostrar('b',this)">Plano B</button><iframe id="visualizador" title="Maquete experimental Plano A" src="plano-a.html?modo=planta3d" loading="lazy"></iframe>
<script>function mostrar(plano,botao){document.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===botao)));const f=document.getElementById('visualizador');f.title='Maquete experimental Plano '+plano.toUpperCase();f.src='plano-'+plano+'.html?modo=planta3d'}</script></main></html>"""


def gerar(fonte=PASTA / 'plano-a.html', destino=PASTA):
    destino = Path(destino).resolve()
    base, a, b = prototipos(Path(fonte).read_text(encoding='utf-8'))
    # Confere assets antes de reescrever a comparação.
    refs = set(re.findall(r"loader\.load\(assetPath \+ '([^']+)'", js_planob_override))
    for ref in refs:
        if not (destino / 'assets_planob' / ref).is_file():
            raise ValueError(f'Asset ausente: {ref}. Execute gerar_texturas_planob.py --destino {destino / "assets_planob"}')
    destino.mkdir(parents=True, exist_ok=True)
    for nome, conteudo in [('plano-a.html', a), ('plano-b.html', b)]:
        (destino / nome).write_text(conteudo, encoding='utf-8', newline='\n')
    metricas = medir(destino)
    (destino / 'metricas_comparativo.json').write_text(json.dumps(metricas, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    (destino / 'comparativo.html').write_text(dashboard(metricas), encoding='utf-8', newline='\n')
    manifesto = {'schema': 1, 'classe': 'derivacao-experimental',
                 'fonte': {'arquivo_base': Path(fonte).name, 'sha256_sem_banner': sha256(base.encode('utf-8'))},
                 'gerador_sha256': sha256(Path(__file__).read_bytes()),
                 'transformacoes': ['banner responsivo', 'Plano B: override de materiais e decoração'],
                 'geometria_reverificada': False,
                 'arquivos': [arquivo(destino / n, destino) for n in ('plano-a.html', 'plano-b.html', 'comparativo.html', 'metricas_comparativo.json')] + metricas['inventario_assets']}
    (destino / 'manifest.json').write_text(json.dumps(manifesto, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    return metricas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fonte', type=Path, default=PASTA / 'plano-a.html')
    parser.add_argument('--destino', type=Path, default=PASTA)
    parser.add_argument('--medir', action='store_true', help='somente calcular métricas dos arquivos existentes')
    args = parser.parse_args()
    result = medir(args.destino) if args.medir else gerar(args.fonte, args.destino)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
