"""Prepara a cópia de teste do LIV e seu mapa, sem publicar ou alterar o original.

    python experimentos/mapa-liv-ipanema-5km-2026-10-08/preparar_site.py \
      --mapa CAMINHO --destino experimentos/mapa-liv-ipanema-5km-2026-10-08/site

Dependências do mapa são explícitas: --recursos CAMINHO copia o diretório com
o mesmo nome para o site. Passe somente o conjunto regional de tiles.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

EXPERIMENTO = Path(__file__).resolve().parent
REPO = EXPERIMENTO.parents[1]
LIV = REPO / "v1.5/miniaturas/liv-ipanema"
MAPA_NOME = "mapa-liv-ipanema-5km.html"
MINIATURA_NOME = "maquete-liv-ipanema.html"
COMPARATIVO_NOME = "mapa-completo.html"
DOWNLOADS = ("liv-ipanema.glb", "liv-ipanema.blend")
SITE = "imobilaria-deccb-miniaturas"
PROJECT = "imobilaria-deccb"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def gravar(caminho: Path, data: bytes) -> None:
    """Substitui somente o arquivo indicado; não remove outros arquivos do site."""
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=caminho.parent, delete=False) as arq:
        temporario = Path(arq.name)
        arq.write(data)
    try:
        os.replace(temporario, caminho)
    finally:
        temporario.unlink(missing_ok=True)


def json_bytes(valor: dict) -> bytes:
    return (json.dumps(valor, ensure_ascii=False, indent=2) + "\n").encode("utf8")


def verificar_origem(original: bytes, release: dict) -> dict:
    """Distingue a fonte registrada do HTML publicado, sem aceitar hash novo."""
    identidade = {"bytes": len(original), "sha256": sha(original)}
    if (identidade["sha256"] == release["htmlSHA256"]
            and identidade["bytes"] == release["htmlBytes"]):
        return {"tipo": "publicacao", **identidade}
    # A publicação minificada registra o hash anterior à transformação. Esse
    # hash identifica a fonte; htmlBytes pertence somente ao artefato público.
    if (release.get("minificada") is True
            and identidade["sha256"] == release.get("htmlOriginalSHA256")
            and ("htmlOriginalBytes" not in release
                 or identidade["bytes"] == release["htmlOriginalBytes"])):
        return {"tipo": "fonte", **identidade}
    raise ValueError("A miniatura local não corresponde à fonte ou ao release público registrado.")


def miniatura_experimental(data: bytes) -> bytes:
    texto = data.decode("utf8")
    if 'id="verMapa"' in texto:
        raise ValueError("A miniatura de origem já tem Ver mapa: revisar a integração.")
    padrao = r'(<nav id="modos"[^>]*>)(.*?)(</nav>)'
    matches = list(re.finditer(padrao, texto, re.S))
    if len(matches) != 1:
        raise ValueError("Grupo de modos da miniatura não é único.")
    grupo = matches[0]
    if set(re.findall(r'data-modo="([^"]+)"', grupo.group(2))) != {
        "maquete", "planta2d", "planta3d", "visita"
    }:
        raise ValueError("Os quatro modos publicados não correspondem ao esperado.")
    modos = grupo.group(2)
    rotulos = {"maquete": "Maquete completa", "planta2d": "Planta 2D",
               "planta3d": "Planta 3D", "visita": "Tour 3D"}
    for modo, rotulo in rotulos.items():
        modos, count = re.subn(r'(<button data-modo="' + modo + r'"[^>]*>).*?(</button>)',
                              lambda m: m.group(1) + rotulo + m.group(2), modos, flags=re.S)
        if count != 1:
            raise ValueError("Botão de modo não é único: " + modo)
    botao = ('    <a id="verMapa" href="' + MAPA_NOME
             + '" aria-label="O que tem por perto?">O que tem por perto?</a>\n  ')
    texto = texto[:grupo.start(2)] + modos.rstrip() + "\n" + botao + texto[grupo.start(3):]
    # As referências de produção não fazem parte da experiência pública.
    # Remove também as imagens embutidas, em vez de apenas ocultar a seção.
    texto, referencias = re.subn(r'<details id="livReferencias">.*?</details>',
                                "", texto, flags=re.S)
    if referencias != 1:
        raise ValueError("A seção de fotos comparativas da miniatura mudou.")
    texto, downloads_referencias = re.subn(
        r"// Downloads[^\n]*\nvar livDownloads =.*?"
        r"document\.getElementById\('livReferencias'\)\.appendChild\(livDownloads\);",
        "", texto, flags=re.S)
    if downloads_referencias != 1:
        raise ValueError("Os downloads da seção de referências da miniatura mudaram.")
    # Mantém o nó de compatibilidade do botão removido para os handlers do
    # template. Planta, tour, câmera, destaque e fotografia seguem canônicos.
    for ident in ("verConjunto",):
        texto = texto.replace("document.getElementById('" + ident + "')",
                              "window.__livUiNodes." + ident)
        texto = texto.replace('document.getElementById("' + ident + '")',
                              "window.__livUiNodes." + ident)
    texto, conjunto = re.subn(r'<button id="verConjunto"[^>]*>.*?</button>',
                             "", texto, count=1, flags=re.S)
    if conjunto != 1:
        raise ValueError("O controle de isolamento da maquete mudou.")
    mudancas = {
        "conjuntoCompleto = false;": "conjuntoCompleto = true;",
        "conjuntoCompleto = Boolean(mostrar);": "conjuntoCompleto = true;",
        "if (!livModo || livModo === 'maquete')livView(livParams.get('vista') || 'perspectiva');":
            "if (!livModo || livModo === 'maquete') { livSetConjunto(true, true); livView(livParams.get('vista') || 'perspectiva'); }",
    }
    for anterior, novo in mudancas.items():
        if texto.count(anterior) != 1:
            raise ValueError("Inicialização da maquete completa mudou: " + anterior)
        texto = texto.replace(anterior, novo, 1)
    estilo = ('\n<style id="mapa-liv-experimental">\n'
              '#modos button{min-height:44px}\n'
              '#modos #verMapa{grid-column:1 / -1;min-height:44px;display:flex;align-items:center;justify-content:center;text-decoration:none}\n'
              '</style>\n')
    compatibilidade = ('<script>window.__livUiNodes={'
                      'verConjunto:document.createElement("button")};</script>\n')
    if texto.count("</head>") != 1:
        raise ValueError("Cabeçalho da miniatura não é único.")
    return texto.replace("</head>", estilo + compatibilidade + "</head>", 1).encode("utf8")


def preparar(mapa: Path, destino: Path, recursos: list[Path],
             comparativo: Path | None = None) -> dict:
    mapa = mapa.resolve(strict=True)
    destino = destino.resolve()
    if not mapa.is_file() or destino == LIV.resolve() or destino.is_relative_to(LIV.resolve()):
        raise ValueError("Informe um mapa válido e um destino fora da miniatura canônica.")
    if comparativo is not None:
        comparativo = comparativo.resolve(strict=True)
        if not comparativo.is_file():
            raise ValueError("O comparativo precisa ser um arquivo HTML.")
    origem = LIV / MINIATURA_NOME
    release = json.loads((LIV / "publicacao/publicacao.json").read_text("utf8"))
    original = origem.read_bytes()
    identidade_origem = verificar_origem(original, release)
    for nome in DOWNLOADS:
        if not (LIV / nome).is_file():
            raise ValueError("Download da miniatura ausente: " + str(LIV / nome))
    # Recursos são validados antes de qualquer cópia. Rejeitar links simbólicos
    # evita incluir acidentalmente uma árvore fora do conjunto regional escolhido.
    fontes = []
    nomes = {MINIATURA_NOME, MAPA_NOME, COMPARATIVO_NOME, *DOWNLOADS,
             "index.html", "manifesto-teste.json"}
    for recurso in recursos:
        fonte = recurso.resolve(strict=True)
        if not fonte.is_dir() or fonte.name in nomes:
            raise ValueError("Dependência deve ser um diretório com nome único: " + str(fonte))
        arquivos = []
        for arquivo in sorted(fonte.rglob("*")):
            if arquivo.is_symlink():
                raise ValueError("Dependência contém link simbólico: " + str(arquivo))
            if arquivo.is_file():
                arquivos.append(arquivo)
        if fonte == destino or destino.is_relative_to(fonte):
            raise ValueError("A dependência não pode conter o destino.")
        nomes.add(fonte.name)
        fontes.append((fonte, arquivos))
    arquivos_site = {
        MINIATURA_NOME: miniatura_experimental(original),
        MAPA_NOME: mapa.read_bytes(),
        "index.html": ('<!doctype html><meta charset="utf-8">'
                       '<title>LIV Ipanema · teste do mapa de São Carlos</title>'
                       '<meta http-equiv="refresh" content="0;url=' + MINIATURA_NOME + '">'
                       '<a href="' + MINIATURA_NOME + '">Abrir LIV Ipanema</a>').encode("utf8"),
    }
    if comparativo is not None:
        arquivos_site[COMPARATIVO_NOME] = comparativo.read_bytes()
    hashes = {}
    for nome, data in arquivos_site.items():
        gravar(destino / nome, data)
        hashes[nome] = {"bytes": len(data), "sha256": sha(data)}
    # Estes são os dois downloads referenciados pela página publicada. Mantém
    # a lista explícita; cenas auxiliares e demais arquivos do LIV ficam fora.
    for nome in DOWNLOADS:
        data = (LIV / nome).read_bytes()
        gravar(destino / nome, data)
        hashes[nome] = {"bytes": len(data), "sha256": sha(data)}
    for fonte, arquivos in fontes:
        for arquivo in arquivos:
            relativo = Path(fonte.name) / arquivo.relative_to(fonte)
            alvo = destino / relativo
            alvo.parent.mkdir(parents=True, exist_ok=True)
            if arquivo.resolve() != alvo.resolve():
                shutil.copy2(arquivo, alvo)
            hashes[relativo.as_posix()] = {
                "bytes": alvo.stat().st_size, "sha256": sha(alvo.read_bytes())
            }
    manifesto = {
        "experimento": "mapa-liv-ipanema-5km-2026-10-08",
        "origemMiniatura": release["url"],
        "miniaturaOriginalSHA256": sha(original),
        "identidadeOrigem": identidade_origem,
        "identidadePublicacao": {"bytes": release["htmlBytes"],
                                "sha256": release["htmlSHA256"]},
        "adaptacao": "Vista externa sempre completa, sem isolamento da torre; plantas, tour e controles canônicos preservados. Entrada O que tem por perto? para o mapa. Seção de fotos comparativas e referências removida, inclusive suas imagens embutidas. Geometria e atlas canônicos preservados.",
        "mapaOrigem": str(mapa),
        "comparativoOrigem": str(comparativo) if comparativo is not None else None,
        "arquivos": hashes,
        "site": SITE,
        "project": PROJECT,
    }
    gravar(destino / "manifesto-teste.json", json_bytes(manifesto))
    config = destino.parent / "firebase.experimento.json"
    gravar(config, json_bytes({"hosting": {
        "site": SITE,
        "public": destino.name,
        "ignore": ["**/.*", "**/node_modules/**", "manifesto-teste.json"],
        "headers": [{"source": "**", "headers": [
            {"key": "Cache-Control", "value": "public, max-age=0, must-revalidate"},
            {"key": "X-Content-Type-Options", "value": "nosniff"},
        ]}, {"source": "**/*.blend", "headers": [
            {"key": "Content-Type", "value": "application/octet-stream"},
            {"key": "Content-Disposition", "value": "attachment"},
        ]}, {"source": "**/*.glb", "headers": [
            {"key": "Content-Type", "value": "model/gltf-binary"},
            {"key": "Content-Disposition", "value": "attachment"},
        ]}],
    }}))
    return {"destino": str(destino), "config": str(config),
            "miniatura": str(destino / MINIATURA_NOME),
            "mapa": str(destino / MAPA_NOME),
            "arquivosPreparados": len(hashes), "publicado": False}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mapa", type=Path, required=True)
    parser.add_argument("--destino", type=Path, required=True)
    parser.add_argument("--recursos", type=Path, action="append", default=[])
    parser.add_argument("--comparativo", type=Path,
                        help="Mapa completo de referência, copiado para mapa-completo.html")
    args = parser.parse_args()
    print(json.dumps(preparar(args.mapa, args.destino, args.recursos, args.comparativo),
                     ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
