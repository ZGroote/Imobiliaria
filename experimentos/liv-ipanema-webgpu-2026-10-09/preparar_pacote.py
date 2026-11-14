"""Reproduz a base strict-circle-v3, sem publicar nem reescrever o histórico."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import platform
import re
import tempfile

EXP = Path(__file__).resolve().parent
REPO = EXP.parents[1]
MAPA = REPO / "experimentos/mapa-liv-ipanema-5km-2026-10-08"
LIV = REPO / "v1.5/miniaturas/liv-ipanema"
BASELINE = REPO / "tasks/liv-ipanema-webgpu/baseline.json"
INVENTARIO = REPO / "backups/liv-webgpu-2026-10-09/inventario.json"
METADADOS_HISTORICOS = "manifesto-teste.json"


def carregar_preparador():
    spec = importlib.util.spec_from_file_location("liv_preparar_site", MAPA / "preparar_site.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def identidade(data: bytes) -> dict:
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def caminho_relativo(nome: str) -> Path:
    caminho = Path(nome)
    if caminho.is_absolute() or caminho.drive or ".." in caminho.parts or not caminho.parts:
        raise ValueError("Caminho inválido no inventário: " + nome)
    return caminho


def verificar_arquivos(pasta: Path, esperado: dict) -> None:
    """Confere o conjunto completo e os bytes, inclusive ausência de extras."""
    encontrados = set()
    for arquivo in pasta.rglob("*"):
        if arquivo.is_symlink():
            raise ValueError("Pacote contém link simbólico: " + str(arquivo))
        if arquivo.is_file():
            encontrados.add(arquivo.relative_to(pasta).as_posix())
    if encontrados != set(esperado):
        raise ValueError("Conjunto de arquivos divergente: " + json.dumps({
            "ausentes": sorted(set(esperado) - encontrados),
            "extras": sorted(encontrados - set(esperado)),
        }, ensure_ascii=False))
    for nome, registro in esperado.items():
        if identidade((pasta / caminho_relativo(nome)).read_bytes()) != registro:
            raise ValueError("Identidade divergente: " + nome)


def revisao_three(html: str) -> str:
    # O bundle r168 exporta REVISION apontando para uma variável minificada.
    export = re.search(r"REVISION:\(\)=>\s*([\w$]+)", html)
    if export:
        atribuicao = re.search(r"\b" + re.escape(export[1]) + r"\s*=\s*['\"](\d+)['\"]", html)
        if atribuicao:
            return atribuicao[1]
    raise ValueError("Não foi possível identificar a versão embutida do Three.js.")


def preparar(destino: Path = EXP / "site-baseline") -> dict:
    if destino.is_symlink():
        raise ValueError("O destino não pode ser um link simbólico.")
    destino = destino.resolve()
    if destino.parent != EXP.resolve() or not destino.name.startswith("site-baseline"):
        raise ValueError("O destino deve ser uma pasta site-baseline* diretamente neste experimento.")
    base = json.loads(BASELINE.read_text("utf8"))
    inventario = json.loads(INVENTARIO.read_text("utf8"))
    lista = inventario["files"]
    if len({item["path"] for item in lista}) != len(lista):
        raise ValueError("Inventário contém caminhos duplicados.")
    esperado = {item["path"]: {"bytes": item["bytes"], "sha256": item["sha256"]}
                for item in lista}
    for nome in esperado:
        caminho_relativo(nome)
    if (inventario["fileCount"] != len(esperado)
            or inventario["totalBytes"] != sum(item["bytes"] for item in esperado.values())
            or any(esperado.get(nome) != item for nome, item in base["artifacts"].items())):
        raise ValueError("O inventário e a identidade da base não concordam.")
    preservado = REPO / base["preservedPackage"]
    verificar_arquivos(preservado, esperado)
    preparador = carregar_preparador()
    fontes = [LIV / "maquete-liv-ipanema.html", LIV / "publicacao/publicacao.json",
              LIV / "liv-ipanema.glb", LIV / "liv-ipanema.blend",
              MAPA / "mapas-v3/mapa-liv-ipanema-5km.html", MAPA / "preparar_site.py",
              Path(__file__).resolve(), BASELINE, INVENTARIO]
    fontes.extend(sorted((MAPA / "mapas-v3/quintais").rglob("*.bin")))
    entradas = {fonte.relative_to(REPO).as_posix(): identidade(fonte.read_bytes()) for fonte in fontes}
    # A preparação histórica escreve uma configuração ao lado do site. Ela fica
    # restrita ao diretório temporário; este fluxo não gera comando de deploy.
    # Mesmo volume do destino: somente a árvore completa e validada é promovida.
    # Uma falha intermediária fica no staging e não expõe pacote incompleto.
    with tempfile.TemporaryDirectory(prefix=".liv-reproducao-", dir=EXP) as temporario:
        montado = Path(temporario) / "site"
        preparador.preparar(MAPA / "mapas-v3/mapa-liv-ipanema-5km.html", montado,
                           [MAPA / "mapas-v3/quintais"])
        gerado = {arquivo.relative_to(montado).as_posix(): identidade(arquivo.read_bytes())
                  for arquivo in montado.rglob("*") if arquivo.is_file()}
        # Só o manifesto ganha a separação fonte/publicação. Conteúdo servido,
        # downloads e tiles precisam reproduzir exatamente a edição escolhida.
        payload = {nome: item for nome, item in esperado.items() if nome != METADADOS_HISTORICOS}
        if set(gerado) != set(esperado):
            raise ValueError("A montagem não produziu o conjunto esperado da base.")
        if any(gerado[nome] != item for nome, item in payload.items()):
            raise ValueError("A montagem divergiu dos bytes da base publicada.")
        html = (montado / "maquete-liv-ipanema.html").read_text("utf8")
        if (set(re.findall(r'data-modo="([^"]+)"', html)) != {
                "maquete", "planta2d", "planta3d", "visita"}
                or 'href="mapa-liv-ipanema-5km.html"' not in html):
            raise ValueError("Contrato de modos/link da miniatura divergente.")
        runtime = revisao_three(html)
        # Uma execução repetida só aceita um destino idêntico. Nunca limpa nem
        # sobrepõe arquivos desconhecidos ou uma evolução feita por outra tarefa.
        verificar_arquivos(montado, gerado)
        if destino.exists():
            verificar_arquivos(destino, gerado)
        else:
            montado.rename(destino)
    manifesto = {
        "schemaVersion": 1,
        "experimento": EXP.name,
        "tarefa": "T01",
        "recordedAtUtc": datetime.now(timezone.utc).isoformat(),
        "baselineVersion": base["baselineVersion"],
        "baselineUrl": base["baselineUrl"],
        "destino": destino.relative_to(REPO).as_posix(),
        "sourceCommitIdentified": False,
        "proveniencia": "Fontes locais identificadas por bytes/SHA-256; HTML adaptado e mapa/tiles já gerados reproduzem o payload publicado. Geradores geométricos e recorte municipal não foram reexecutados.",
        "versoes": {"python": platform.python_version(), "threeMaquete": runtime,
                    "preparacao": "stdlib Python; geradores identificados em entradas"},
        "entradas": entradas,
        "reproducao": {"payloadArquivos": len(payload),
                       "payloadBytes": sum(item["bytes"] for item in payload.values()),
                       "payloadIdentico": True,
                       "metadadosAlterados": [METADADOS_HISTORICOS],
                       "motivoMetadados": "Identidade da fonte separada da publicação minificada anterior."},
        "arquivos": gerado,
        "publicado": False,
    }
    preparador.gravar(EXP / "manifesto.json", preparador.json_bytes(manifesto))
    return {"destino": str(destino), "manifesto": str(EXP / "manifesto.json"),
            "payloadIdentico": True, "arquivos": len(gerado), "publicado": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destino", type=Path, default=EXP / "site-baseline")
    args = parser.parse_args()
    print(json.dumps(preparar(args.destino), ensure_ascii=False, indent=2))
