"""Monta a miniatura LIV Ipanema usando o visualizador habitual, sem alterar Cedros.

    python v1.5/miniaturas/liv-ipanema/gerar_pagina.py

O HTML inclui a geometria, a planta oficial e as imagens comparativas disponíveis.
As medidas modeladas são aproximações visuais; a ficha reproduz os dados da Livon.
"""
from __future__ import annotations

import argparse
import base64
import importlib.util
import hashlib
import json
import mimetypes
import sys
from pathlib import Path

PASTA = Path(__file__).resolve().parent
REFERENCIAS = PASTA / "referencias"
COMPARACOES = PASTA / "comparacoes"
FONTE = "https://www.livonincorporadora.com.br/produtos/liv-ipanema/"
UNIDADE_INTERIOR = PASTA / "interior" / "previa" / "unidade.json"


def imagem_embutida(caminho: Path) -> str:
    mime = mimetypes.guess_type(caminho.name)[0] or "image/jpeg"
    return "data:" + mime + ";base64," + base64.b64encode(caminho.read_bytes()).decode("ascii")


def dados_imovel(pagina, unidade: dict) -> dict:
    # O construtor fornece a planta e a mobília. da_unidade mantém o cadastro cru
    # para FloorPlan.plantaDaUnidade; o wrapper sobrepõe apenas a apresentação LIV.
    imovel = pagina.da_unidade(unidade, acervo=False)
    imovel.update({
        "empreendimento": "LIV Ipanema",
        "unidade": "São Carlos",
        "endereco": "Rua João de Guzzy, 5151 · Jardim Bandeirantes · São Carlos, SP",
        "tag": "Empreendimento · Livon Incorporadora",
        "preco": "",
        "andar": -1,
        "_id": "liv-ipanema",
        "predio": {"pegada": [[-23.85, 6.35], [23.85, 6.35], [23.85, -6.35], [-23.85, -6.35]],
                   "pavimentos": 17, "pe_direito_pav": 2.85},
        "ficha": [["Torres", "1"], ["Pavimentos", "17"], ["Apartamentos", "170"],
                  ["Dormitórios", "2 · 1 suíte"], ["Áreas publicadas", "47,50–47,89 m²"],
                  ["Vagas totais", "175"]],
        "fonte": FONTE,
    })
    return imovel


def painel_interior() -> str:
    prancha = COMPARACOES / "comparativo-interior.png"
    prova_path = PASTA / "qa/interior-capturas.json"
    manifest_path = PASTA / "interior/luz/manifest.json"
    if not all(p.is_file() for p in (prancha, prova_path, manifest_path)):
        return ""
    prova = json.loads(prova_path.read_text("utf8"))
    manifest = json.loads(manifest_path.read_text("utf8"))
    if (prova.get("etapa") != "atlas-real-ativo" or not manifest.get("ready")
            or prova.get("textureSHA256") != manifest.get("textureSHA256")
            or prova.get("sourceSHA256") != manifest.get("sourceSHA256")
            or prova.get("unidadeSHA256") != manifest.get("unitSHA256")
            or prancha.stat().st_mtime_ns < prova_path.stat().st_mtime_ns):
        return ""
    for rel, esperado in prova["capturasSHA256"].items():
        foto = PASTA / rel
        if not foto.is_file() or hashlib.sha256(foto.read_bytes()).hexdigest() != esperado:
            return ""
    fotos = []
    for nome, titulo in (("sala", "Sala"), ("suite", "Suíte")):
        foto = PASTA / ("qa/interior-" + nome + ".png")
        fotos.append('<figure><img src="' + imagem_embutida(foto)
                     + '" alt="Foto real da ' + titulo.lower() + ' na miniatura" loading="lazy">'
                     + '<figcaption>' + titulo + ' · captura da miniatura</figcaption></figure>')
    return ('<section class="liv-par"><h3>Distribuição e interiores</h3>'
            + '<figure class="liv-prancha"><img src="' + imagem_embutida(prancha)
            + '" alt="Planta oficial comparada com a vista de topo da planta 3D" loading="lazy">'
            + '<figcaption>Planta publicada e captura da planta 3D</figcaption></figure>'
            + '<div class="liv-imagens">' + ''.join(fotos) + '</div></section>')


def painel_referencias() -> str:
    pares = []
    for chave, titulo in [("fachada", "Fachada"), ("aerea", "Perspectiva aérea"),
                          ("portaria", "Portaria"), ("implantacao", "Implantação")]:
        referencia = REFERENCIAS / (chave + ".jpg")
        if not referencia.is_file():
            continue
        render = COMPARACOES / (chave + ".png")
        if not render.is_file():
            render = None
        original = ('<figure><img src="' + imagem_embutida(referencia)
                    + '" alt="' + titulo + ' oficial publicada pela Livon" loading="lazy">'
                    + '<figcaption>Referência oficial · Livon</figcaption></figure>')
        reconstruido = ('<figure><img src="' + imagem_embutida(render)
                        + '" alt="' + titulo + ' da maquete 3D reconstruída" loading="lazy">'
                        + '<figcaption>Captura da maquete 3D</figcaption></figure>') if render else ""
        pares.append('<section class="liv-par"><h3>' + titulo + '</h3><div class="liv-imagens">'
                     + original + reconstruido + '</div></section>')
    return ('<details id="livReferencias"><summary>Fotos comparativas e referências</summary>'
            + '<p>Imagens publicadas pela incorporadora e capturas da maquete no navegador. '
              'A reconstrução aproxima proporções, materiais e implantação a partir dessas imagens.</p>'
            + ''.join(pares) + painel_interior() + '<p><a href="' + FONTE + '" target="_blank" rel="noopener">'
              'Ver empreendimento e planta na Livon</a></p></details>')


ESTILOS = """
<style>
#fPreco{display:none} #fNome{font-size:18px} #dica{opacity:.75;line-height:1.5}
#notaModelo{color:#a5b2bd!important} #selo i{animation:none}
@media(min-width:641px) and (min-height:501px){#cena{height:clamp(220px,calc(100dvh - 510px),560px)}}
.liv-controles{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.liv-controles button,.liv-controles select,.liv-downloads a{font:inherit;font-size:11px;
  min-height:38px;padding:7px 10px;border:1px solid var(--line);border-radius:7px;
  background:#202b32;color:var(--txt);cursor:pointer;text-decoration:none}
.liv-controles label{font-size:11px;color:#b5c1cd}
.liv-controles[hidden]{display:none}
.liv-controles button[aria-pressed=true]{border-color:#4bdb7c;background:#213d32;color:#bff3d2}
.liv-controles button:focus-visible,.liv-controles select:focus-visible,summary:focus-visible{
  outline:2px solid #4bdb7c;outline-offset:3px}
details#livReferencias{border-top:1px solid var(--line);margin-top:12px;padding-top:10px;font-size:11px}
#livReferencias summary{cursor:pointer;color:#c3d4df;padding:4px 0}
#livReferencias p{line-height:1.5;color:#a7b4c0;margin:8px 0}
#livReferencias a,.liv-downloads a{color:#bad9ed}
.liv-par{margin-top:10px}.liv-par h3{font-size:12px;font-weight:600;margin:0 0 5px}
.liv-imagens{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.liv-imagens figure{margin:0;background:#111a23;border-radius:6px;overflow:hidden}
.liv-imagens img{display:block;width:100%;height:180px;object-fit:contain;background:#edf0ef}
.liv-imagens figcaption{padding:5px;font-size:10px;color:#b8c5d0}
.liv-prancha{margin:0 0 6px;background:#111a23;border-radius:6px;overflow:hidden}
.liv-prancha img{display:block;width:100%;height:auto}
.liv-prancha figcaption{padding:5px;font-size:10px;color:#b8c5d0}
.liv-downloads{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#cena:has(#p2d:not([hidden])){background:#fff;border-radius:8px}
@media(max-width:640px){.liv-controles{gap:4px}.liv-controles button,.liv-controles select{min-height:44px}
  .liv-imagens img{height:125px}#livReferencias summary{min-height:38px}}
</style>
"""


def adaptar_template(template: str, luz_interior: bool = True) -> str:
    controles = """
  <div class="liv-controles" id="livCameras" role="group" aria-label="Vistas da maquete">
    <button data-vista="perspectiva" aria-pressed="true">Perspectiva</button>
    <button data-vista="fachada" aria-pressed="false">Frente</button>
    <button data-vista="aerea" aria-pressed="false">Aérea</button>
    <button data-vista="portaria" aria-pressed="false">Portaria</button>
    <button data-vista="implantacao" aria-pressed="false">Implantação</button>
    <button id="livFoto" type="button">Fotografar PNG</button>
    <label for="livAndar">Pavimento</label><select id="livAndar" aria-label="Destacar pavimento">
      <option value="-1">Sem destaque</option>""" + ''.join(
        '<option value="%d">%dº</option>' % (n, n + 1) for n in range(17)) + """</select>
  </div>"""
    template = template.replace("</head>", ESTILOS + "\n</head>", 1)
    template = template.replace('<div class="stats" id="fStats"></div>',
                                '<div class="stats" id="fStats"></div>' + painel_referencias())
    template = template.replace('<div id="dica">', controles + '\n<div id="dica">', 1)
    template = template.replace('>Pr&eacute;dio</button>', '>Torre</button>')
    template = template.replace('>Planta 2D</button>', '>Planta oficial</button>')
    template = template.replace('>Visita 3D</button>', '>Visita ilustrativa</button>')
    template = template.replace('var modeloMontes = /^monte-d[ao]s-/.test(D._id || \'\');',
                                "var modeloMontes = false;\npredio.children.forEach(function(o){"
                                "if(o.isMesh)o.visible=o.userData.tower===0;});")
    # Esses pontos de extensão estão apenas na cópia em memória do template LIV.
    template = template.replace('function desenhaPlanta2D() {',
        'function desenhaPlanta2D() {\n'
        '  p2d.setAttribute("viewBox","100 215 790 600");\n'
        '  p2d.innerHTML=\'<image href="\'+LIV_PLANTA_OFICIAL+\'" width="1000" height="1000"/>\';\n'
        '  return;\n', 1)
    template = template.replace('var p2d = document.getElementById("p2d");',
                                'var LIV_PLANTA_OFICIAL = ' + json.dumps(imagem_embutida(
                                    REFERENCIAS / "planta-47-59.jpg")) + ';\n'
                                'var p2d = document.getElementById("p2d");')
    template = template.replace('window.__maq = {', (PASTA / "liv-viewer.js").read_text(encoding="utf8")
                                + '\nwindow.__maq = {', 1)
    # A grade de 18 cm perde vãos reais desta planta compacta. Mesma navegação,
    # mesmo raio de 30 cm; somente a resolução do caminho passa a 5 cm no LIV.
    caminhada = (PASTA.parent / "caminhada.js").read_text(encoding="utf8")
    assert caminhada.count('var passo=0.18,') == 1
    template = template.replace('@@CAMINHADA@@', caminhada.replace('var passo=0.18,', 'var passo=0.05,')
                                .replace('/0.07));','/0.02));'))
    template = template.replace('if (!obj) continue;\n    /* A peca mora',
        'if (!obj) continue;\n    if(livAcabamentos)obj=livAcabamentos.personalizar(obj,m);\n    /* A peca mora', 1)
    template = template.replace('estilo: m.estilo });','estilo: m.estilo, livNome: m.livNome });',1)
    template = template.replace('if (!def.param) obj.scale.set(m.w/def.b[0], m.h/def.b[1], m.d/def.b[2]);',
        'if (!def.param && !obj.userData.livDimensaoFinal) obj.scale.set(m.w/def.b[0], m.h/def.b[1], m.d/def.b[2]);',1)
    navegacao = PASTA.parent.parent / "renderizador-v16-moveis" / "interior" / "navigation.js"
    template = template.replace('<script>@@HOUSEMESH@@</script>',
                                '<script>@@HOUSEMESH@@</script>\n<script>'
                                + navegacao.read_text(encoding="utf8") + '</script>', 1)
    template = template.replace('<script>@@HOUSEMESH@@</script>',
                                '<script>@@HOUSEMESH@@</script>\n<script>'
                                + (PASTA / "liv-interior.js").read_text(encoding="utf8") + '</script>', 1)
    template = template.replace('antialias: !CELULAR, alpha: true,',
                                'antialias: !CELULAR, alpha: true, preserveDrawingBuffer:true,')
    template = template.replace('sol.position.set(sx - 30, 46 + sy, sz + 22);\n  sol.target.position.set(sx, sy, sz);',
        'if(modo === "maquete" && livManifest){\n'
        '    sol.position.fromArray(livManifest.sunWebPosition);\n'
        '    sol.target.position.fromArray(livManifest.sunWebTarget);\n'
        '    sol.intensity=livManifest.sunIntensity;\n'
        '  } else if((modo==="planta3d" || modo==="visita") && livInteriorManifest '
        '&& window.__liv.luzInterior && window.__liv.luzInterior.ready){\n'
        '    sol.position.fromArray(livInteriorManifest.lighting.sun.position);\n'
        '    sol.target.position.fromArray(livInteriorManifest.lighting.sun.target);\n'
        '    sol.intensity=livInteriorManifest.lighting.sun.energy;\n'
        '  } else {\n'
        '    sol.position.set(sx - 30, 46 + sy, sz + 22);\n'
        '    sol.target.position.set(sx, sy, sz); sol.intensity=2.6;\n'
        '  }')
    pasta_luz = PASTA / "luz"
    biblioteca_luz = PASTA / "liv-lightmap.js"
    if (pasta_luz / "manifest.json").is_file() and biblioteca_luz.is_file():
        jsons = {nome: json.loads((pasta_luz / nome).read_text(encoding="utf8"))
                 for nome in ("manifest.json", "geometry-compact.json")}
        gzip = {"irradiance.rgbm.gz": base64.b64encode(
            (pasta_luz / "irradiance.rgbm.gz").read_bytes()).decode("ascii")}
        embutido = {"json": jsons, "gzip": gzip,
                    "modeloHash": hashlib.sha256((PASTA / "modelo.json").read_bytes()).hexdigest()}
        bloco = '<script>var LIV_LIGHTMAP_DATA=' + json.dumps(embutido, separators=(',', ':')) + ';</script>\n'
        bloco += '<script>' + biblioteca_luz.read_text(encoding="utf8") + '</script>\n'
        template = template.replace('<script>@@HOUSEMESH@@</script>',
                                    '<script>@@HOUSEMESH@@</script>\n' + bloco, 1)
    interior_luz = PASTA / "interior" / "luz"
    manifest_interior = interior_luz / "manifest.json"
    if luz_interior and manifest_interior.is_file() and json.loads(manifest_interior.read_text("utf8")).get("ready"):
        source_bytes = (interior_luz / "source.json").read_bytes()
        source = json.loads(source_bytes)
        proof = {"sourceSHA256": hashlib.sha256(source_bytes).hexdigest(),
                 "unitSHA256": source["unitSHA256"], "meshSlots": source["metadata"]["meshSlots"],
                 "approvalSHA256": hashlib.sha256((interior_luz / "approval.json").read_bytes()).hexdigest(),
                 "objects": [{"slot":o["slot"],"instance":o["instance"],"matrix":o["matrix"],
                              "materials":o["materials"],"geometrySHA256":source["geometries"][o["geometry"]]["sha256"]}
                             for o in source["objects"]],
                 "materials": source["materials"],
                 # O ruído procedural compartilhado varia a cada carregamento.
                 # Estes PNGs fixam o albedo/normal aprovado usado no cálculo LIV.
                 "textures": source["textures"]}
        data_interior = {"proof":proof,
                         "json":{"interior/luz/"+nome:json.loads((interior_luz / nome).read_text("utf8"))
                                 for nome in ("manifest.json","geometry-compact.json")},
                         "gzip":{"interior/luz/irradiance.rgbm.gz":base64.b64encode(
                             (interior_luz / "irradiance.rgbm.gz").read_bytes()).decode("ascii")}}
        script = '<script>var LIV_INTERIOR_LIGHTMAP_DATA='+json.dumps(data_interior,separators=(',',':'))+';</script>\n'
        script += '<script>'+(PASTA / "liv-interior-lightmap.js").read_text("utf8")+'</script>\n'
        template = template.replace('<script>@@HOUSEMESH@@</script>','<script>@@HOUSEMESH@@</script>\n'+script,1)
    return template


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--saida", type=Path, default=PASTA / "maquete-liv-ipanema.html")
    parser.add_argument("--unidade-interior", type=Path, default=UNIDADE_INTERIOR)
    parser.add_argument("--sem-luz-interior", action="store_true", help="Prévia antes da aprovação de um atlas novo")
    args = parser.parse_args()
    modelo = PASTA / "modelo.json"
    if not modelo.is_file():
        raise SystemExit("Execute modelar_liv_ipanema.py no Blender antes de montar a página.")
    if not args.unidade_interior.is_file():
        raise SystemExit("Falta a unidade do construtor: " + str(args.unidade_interior))
    unidade = json.loads(args.unidade_interior.read_text(encoding="utf8"))
    spec = importlib.util.spec_from_file_location("pagina_maquete_liv", PASTA.parent / "pagina_maquete.py")
    modulo = importlib.util.module_from_spec(spec)
    argv_original = sys.argv[:]
    try:
        sys.argv = [str(PASTA.parent / "pagina_maquete.py")]
        spec.loader.exec_module(modulo)
        modulo.SAIDA = str(args.saida.resolve())
        modulo.MODO = "leve"
        modulo.UNIDADE = modulo.CADASTRO = modulo.MAPA = None
        modulo.IMOVEL = dados_imovel(modulo, unidade)
        modulo.IMOVEL["interiorFonte"] = {
            "id": unidade.get("id"),
            "unidadeSHA256": hashlib.sha256(args.unidade_interior.read_bytes()).hexdigest(),
            "pipeline": "construtor-planta",
        }
        modulo.artefato_leve = lambda uid: {"modelo": modelo}
        modulo.bloco_luz = lambda imovel: '<script id="__luzue" type="application/json">{}</script>'
        modulo.PAGINA = adaptar_template(modulo.PAGINA, not args.sem_luz_interior)
        return modulo.main()
    finally:
        sys.argv = argv_original


if __name__ == "__main__":
    raise SystemExit(main())
