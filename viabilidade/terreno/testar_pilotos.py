"""Verifica entrega v4 e preservação integral dos cinco pilotos da entrega 1.

python -I viabilidade/terreno/testar_pilotos.py
python -I viabilidade/terreno/testar_pilotos.py --reproduzir
"""
import argparse
import copy
import hashlib
from io import BytesIO
import json
from pathlib import Path
import runpy
import site
import subprocess
import sys
from tempfile import TemporaryDirectory

try:
    from PIL import Image, ImageChops
except ModuleNotFoundError:
    sys.path.append(site.getusersitepackages())
    from PIL import Image, ImageChops

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
JSONS_TOLERANTES = {
    "dados/eixo-contiguidade.json", "dados/eixo-posicionamento.json", "dados/novo-z2.json",
}
# Objetos do commit 7f7dd15, sem o campo de origem de zona substituído no v4.
ORIGINAIS = {
    "SC-completo-30516": "292c94cd46e83bbd0702202b1e2173bf47f8515a3860f7ec8761c1d4c5e00a09",
    "SC-completo-37607": "a81b7ac676622186f0a22d8ad4e4e554b38446842326db5a3304ac122c528fee",
    "SC-completo-22426": "9cb631013fe065b9de1e01595acfe8ba188aee14acc9686d6873aefe4a0374ac",
    "SC-completo-22421": "bcd11ef5a43f2a9cfe7ba6bdc48ab567b91996ed685c51d6b9f6fd0685ef6cfb",
    "SC-completo-25297": "5707bc316289fd245925846d667c311d6bfd76d7a59de67d481fef60c5c69691",
}


def comparar_json(antes, depois, arquivo, campo="$"):
    local = f"{arquivo}: {campo}"
    assert type(antes) is type(depois), f"{local}: tipos diferentes: {type(antes).__name__} -> {type(depois).__name__}"
    if isinstance(antes, dict):
        assert antes.keys() == depois.keys(), f"{local}: chaves diferentes: {antes.keys() ^ depois.keys()}"
        for chave in antes:
            comparar_json(antes[chave], depois[chave], arquivo, f"{campo}.{chave}")
    elif isinstance(antes, list):
        assert len(antes) == len(depois), f"{local}: tamanho {len(antes)} -> {len(depois)}"
        for i, (a, b) in enumerate(zip(antes, depois)):
            comparar_json(a, b, arquivo, f"{campo}[{i}]")
    elif isinstance(antes, float):
        diferenca = abs(antes - depois)
        limite = 1e-11 if "lonlat" in campo else 1e-6  # graus: 1e-11 ≈ 1 µm; metros, m² e pixels: 1e-6
        assert diferenca <= limite, f"{local}: diferença {diferenca:.12g} > {limite:g} ou não finita ({antes!r} -> {depois!r})"
    else:
        assert antes == depois, f"{local}: valor diferente: {antes!r} -> {depois!r}"


def comparar_arquivo(nome, antes, depois):
    if nome in JSONS_TOLERANTES:
        comparar_json(json.loads(antes), json.loads(depois), nome)
    elif nome == "dados/z2-componentes.png":
        with Image.open(BytesIO(antes)) as a, Image.open(BytesIO(depois)) as b:
            assert a.size == b.size, f"{nome}: tamanho {a.size} -> {b.size}"
            diferenca = ImageChops.difference(a.convert("RGBA"), b.convert("RGBA"))
            maximo = max(limites[1] for limites in diferenca.getextrema())
            if maximo:
                i = diferenca.tobytes().index(maximo) // 4
                posicao = (i % a.width, i // a.width)
                raise AssertionError(f"{nome}: pixel {posicao}, diferença RGBA {diferenca.getpixel(posicao)}; máxima {maximo} > 0")
    else:
        assert len(antes) == len(depois), f"{nome}: tamanho em bytes {len(antes)} -> {len(depois)}"
        if antes != depois:
            i = next(i for i, (a, b) in enumerate(zip(antes, depois)) if a != b)
            raise AssertionError(f"{nome}: byte[{i}] {antes[i]} -> {depois[i]}, diferença {abs(antes[i] - depois[i])}")


def autotestar_comparacao():
    def deve_falhar(nome, antes, depois, campo):
        try:
            comparar_arquivo(nome, antes, depois)
        except AssertionError as erro:
            assert nome in str(erro) and campo in str(erro), str(erro)
        else:
            raise AssertionError(f"Autoteste aceitou adulteração: {nome}: {campo}")

    with TemporaryDirectory() as pasta:
        nome = "dados/eixo-contiguidade.json"
        antes = (AQUI / nome).read_bytes()
        copia = Path(pasta) / "eixo-contiguidade.json"
        valor = json.loads(antes)
        valor["area_uniao_m2"] += 1e-3
        copia.write_text(json.dumps(valor), encoding="utf-8")
        deve_falhar(nome, antes, copia.read_bytes(), "$.area_uniao_m2")
        nome_principal = "lotes-piloto.json"
        antes_principal = (AQUI / nome_principal).read_bytes()
        copia = Path(pasta) / nome_principal
        copia.write_bytes(bytes([antes_principal[0] ^ 1]) + antes_principal[1:])
        deve_falhar(nome_principal, antes_principal, copia.read_bytes(), "byte[0]")

    for nome in JSONS_TOLERANTES:
        comparar_arquivo(nome, b'{"x": [0.0]}', b'{"x": [0.000001]}')
        for antes, depois, campo in (
            (b'{"x": [0.0]}', b'{"x": [0.0000011]}', "$.x[0]"),
            (b'{"x": 1}', b'{"x": 1.0}', "$.x"),
            (b'{"x": true}', b'{"x": 1}', "$.x"),
            (b'{"x": 1}', b'{"x": 2}', "$.x"),
            (b'{"x": "a"}', b'{"x": "b"}', "$.x"),
            (b'{"x": []}', b'{"x": [0]}', "$.x"),
            (b'{"x": null}', b'{"y": null}', "$"),
            (b'{"x": 0.0}', b'{"x": NaN}', "$.x"),
            (b'{"centroide_lonlat": [0.0]}', b'{"centroide_lonlat": [0.00000001]}', "$.centroide_lonlat[0]"),
        ):
            deve_falhar(nome, antes, depois, campo)
    nome = "dados/z2-componentes.png"
    im = Image.new("RGB", (2, 2), "white")
    antes, depois = BytesIO(), BytesIO()
    im.save(antes, format="PNG", compress_level=0)
    im.save(depois, format="PNG", compress_level=9)
    assert antes.getvalue() != depois.getvalue()
    comparar_arquivo(nome, antes.getvalue(), depois.getvalue())
    im.putpixel((1, 0), (254, 255, 255))
    depois = BytesIO()
    im.save(depois, format="PNG")
    deve_falhar(nome, antes.getvalue(), depois.getvalue(), "pixel (1, 0)")
    depois = BytesIO()
    im.resize((3, 2)).save(depois, format="PNG")
    deve_falhar(nome, antes.getvalue(), depois.getvalue(), "tamanho")
    print("OK: autoteste rejeitou float +1e-3, byte adulterado, estrutura e pixels diferentes.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reproduzir", action="store_true")
    args = parser.parse_args()
    autotestar_comparacao()
    if args.reproduzir:
        caminhos = [AQUI / "lotes-piloto.json"] + [AQUI / "dados" / n for n in (
            "anotacoes-zonas.json", "relevo-pilotos.json", "novo-eixo.json", "novo-z2.json",
            "anotacao-eixo.json", "anotacao-z2.json", "eixo-contiguidade.json",
            "eixo-posicionamento.json", "z2-posicionamento.json", "z2-componentes.png")]
        antes = {p: p.read_bytes() for p in caminhos}
        for script in ("dados/eixo-reproduzir.py", "dados/z2-reproduzir.py", "adicionar_pilotos.py",
                       "dados/zonas-anotar.py", "preparar_zonas.py", "preparar_relevo.py"):
            subprocess.run([sys.executable, "-I", str(AQUI / script)], cwd=AQUI.parent.parent, check=True)
        for p, conteudo in antes.items():
            comparar_arquivo(p.relative_to(AQUI).as_posix(), conteudo, p.read_bytes())
        print("OK: reprodução preservou sete JSONs byte a byte, três JSONs com tolerância absoluta 1e-6 e PNG com pixels idênticos.")
    ler = lambda p: json.loads(p.read_text(encoding="utf-8"))
    lotes = ler(AQUI / "lotes-piloto.json")
    assert len(lotes) == 7
    runpy.run_path(str(AQUI / "gerar_lotes.py"))["checar"](lotes)
    anotacoes = ler(AQUI / "dados/anotacoes-zonas.json")
    zonas = {z["id"] for z in ler(AQUI.parent / "lei/zonas.json")}
    preparar = runpy.run_path(str(AQUI / "preparar_zonas.py"))["preparar"]
    assert preparar(copy.deepcopy(lotes), anotacoes, zonas) == lotes
    relevo = {l["id"]: l for l in ler(AQUI / "dados/relevo-pilotos.json")["lotes"]}
    assert set(relevo) == {l["id"] for l in lotes}
    for lote in lotes:
        assert lote["relevo"] is not None
        assert all(relevo[lote["id"]][k] == v for k, v in lote["relevo"].items())
        assert all((AQUI / e).is_file() for e in lote["anotacao_zoneamento"]["evidencias"])
        if lote["id"] in ORIGINAIS:
            original = {k: v for k, v in lote.items() if k not in ("zona_origem", "zona_conferida")}
            digest = hashlib.sha256(json.dumps(original, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()
            assert digest == ORIGINAIS[lote["id"]], "Dado original alterado: " + lote["id"]
        else:
            assert lote["zona_id"] in ("SC-EIXO", "SC-Z2")
            assert not any(e["tipo"] in ("interesse_ambiental", "interesse_industrial_servicos") for e in lote["areas_especiais"])
    print("OK: sete pilotos v4, cinco originais preservados, relevo e evidências presentes.")


if __name__ == "__main__":
    main()
