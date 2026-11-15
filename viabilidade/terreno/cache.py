"""Cache local em .cache/ (fora do git): polígonos já em UTM e anexos decodificados em blocos.

Cada arquivo guarda o sha256 das fontes (dados e código que os montam) e as versões das bibliotecas;
se algo mudar, é refeito. Só numpy/shapely/zlib, sem pickle.
"""
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
import tempfile
import zipfile
import zlib

import numpy as np
import shapely as sh

PASTA = Path(__file__).resolve().parent / ".cache"
BLOCO = 256  # lado, em pixels, de cada bloco comprimido da imagem


def sha(caminho):
    """sha256 do arquivo; repetido no mesmo processo (JPEG conferido no manifesto e no cache), não relê."""
    info = os.stat(caminho)
    return _sha(str(Path(caminho).resolve()), info.st_size, info.st_mtime_ns)


@lru_cache(maxsize=None)
def _sha(caminho, tamanho, mtime_ns):
    return hashlib.sha256(Path(caminho).read_bytes()).hexdigest()


def carregar(nome, fontes, montar, extra="", pasta=None):
    """NpzFile aberto do cache; refaz com montar() -> dict de arrays quando a chave muda."""
    pasta = Path(pasta or PASTA)
    chave = json.dumps({"fontes": [sha(f) for f in fontes], "extra": extra})
    arquivo = pasta / f"{nome}.npz"
    try:
        dados = np.load(arquivo, allow_pickle=False)
        if str(dados["_chave"]) == chave:
            return dados
        dados.close()
    except (OSError, KeyError, ValueError, zipfile.BadZipFile):
        pass  # ausente ou corrompido: refaz
    arrays = montar()
    tmp = None
    try:
        pasta.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=pasta, suffix=".tmp", delete=False) as f:
            tmp = f.name
            np.savez(f, _chave=np.array(chave), **arrays)
        os.replace(tmp, arquivo)
        return np.load(arquivo, allow_pickle=False)
    except OSError:
        # Windows: outro processo está com o .npz aberto (ou acabou de gravá-lo) e a troca dá "acesso negado".
        # O cache nunca derruba o estudo: segue com o que acabou de montar, em memória, e outro processo grava depois.
        if tmp:
            try:
                os.remove(tmp)
            except OSError:
                pass
        return _Memoria(arrays)


class _Memoria(dict):
    """Mesmo uso do NpzFile (`with`, `[nome]`, close) quando o cache não pôde ser gravado."""

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def close(self):
        pass


def poligonos(nome, fontes, montar, extra="", pasta=None):
    """Array de Polygons idêntico ao de montar(), guardado como coordenadas + offsets."""
    def montar_arrays():
        tipo, coords, (aneis, partes) = sh.to_ragged_array(montar())
        if tipo != sh.GeometryType.POLYGON:
            raise ValueError(f"Cache {nome}: esperava só Polygon")
        return {"coords": coords, "aneis": aneis, "partes": partes}
    with carregar(nome, fontes, montar_arrays, f"shapely {sh.__version__}; {extra}", pasta) as d:
        return sh.from_ragged_array(sh.GeometryType.POLYGON, d["coords"], (d["aneis"], d["partes"]))


class Imagem:
    """Recortes iguais a np.asarray(PIL.Image.crop(caixa)), sem decodificar o JPEG inteiro."""

    def __init__(self, arquivo, pil, pasta=None):
        import PIL
        if pil.mode != "RGB":
            raise ValueError(f"{arquivo}: esperava RGB, veio {pil.mode}")
        self.size = pil.size

        def montar():
            rgb = np.asarray(pil)
            return {f"b{i}_{j}": np.frombuffer(zlib.compress(rgb[i:i+BLOCO, j:j+BLOCO].tobytes(), 1), np.uint8)
                    for i in range(0, rgb.shape[0], BLOCO) for j in range(0, rgb.shape[1], BLOCO)}
        self.dados = carregar(f"imagem-{Path(arquivo).stem}", [arquivo], montar, f"Pillow {PIL.__version__}", pasta)
        self.bloco = lru_cache(maxsize=64)(self._bloco)

    def _bloco(self, i, j):
        largura = min(BLOCO, self.size[0] - j)
        return np.frombuffer(zlib.decompress(self.dados[f"b{i}_{j}"].tobytes()), np.uint8).reshape(-1, largura, 3)

    def crop(self, caixa):
        x0, y0, x1, y1 = caixa
        largura, altura = self.size
        saida = np.zeros((y1 - y0, x1 - x0, 3), np.uint8)  # fora da imagem: preto, como o PIL
        ya, yb, xa, xb = max(y0, 0), min(y1, altura), max(x0, 0), min(x1, largura)
        if ya >= yb or xa >= xb:
            return saida
        for i in range(ya // BLOCO * BLOCO, yb, BLOCO):
            a, b = max(ya, i), min(yb, i + BLOCO)
            for j in range(xa // BLOCO * BLOCO, xb, BLOCO):
                c, d = max(xa, j), min(xb, j + BLOCO)
                saida[a - y0:b - y0, c - x0:d - x0] = self.bloco(i, j)[a - i:b - i, c - j:d - j]
        return saida
