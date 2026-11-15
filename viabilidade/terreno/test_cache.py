"""Regressões da tarefa 8 (cache em .cache/), executadas por novo_lote.py --testar."""
from pathlib import Path
import shutil
from unittest.mock import patch

import cache
from novo_lote import Cadastro, gl, gravar

# (índices, piloto cuja zona é usada, ou a zona); o último exercita o Anexo 02 (zona auto).
LOTES = [([i], f"SC-completo-{i}") for i in (30516, 37607, 22426, 22421, 25297)]
LOTES += [(list(range(11984, 11989)), "SC-completo-q1382-11984-11988"), ([30516], "auto")]


def gerar_bytes(cadastro, pilotos, pasta, prefixo):
    saidas = []
    for indices, zona in LOTES:
        zona = pilotos[zona]["zona_id"] if zona in pilotos else zona
        saida = Path(pasta) / f"{prefixo}-{indices[0]}-{zona}.json"
        try:
            gravar(saida, cadastro.gerar(indices, zona))
        except ValueError as erro:  # zona automática pode recusar; a recusa também tem de ser igual
            saida.write_text(str(erro), encoding="utf-8")
        saidas.append(saida.read_bytes())
    return saidas


def testar(cadastro, pilotos, pasta):
    com = gerar_bytes(cadastro, pilotos, pasta, "com")
    # Sem cache: o caminho antigo (GeoJSON/ruas montados na hora, JPEG decodificado inteiro).
    sem_imagem = lambda arquivo, pil, *a: (pil.load(), pil)[1]
    with patch.object(cache, "poligonos", lambda nome, fontes, montar, *a: montar()), patch.object(cache, "Imagem", sem_imagem):
        sem_cadastro = Cadastro("completo")
        assert all(gl.sh.equals_exact(sem_cadastro.geos, cadastro.geos, tolerance=0))
        assert all(gl.sh.equals_exact(sem_cadastro.malha, cadastro.malha, tolerance=0))
        sem = gerar_bytes(sem_cadastro, pilotos, pasta, "sem")
    assert com == sem, "Saída com cache difere da saída sem cache"
    print(f"OK: 5 pilotos, remembramento e zona auto byte a byte iguais com e sem cache ({len(com)} arquivos).", flush=True)

    # Fonte alterada: cópia temporária com um byte trocado refaz o cache.
    fonte = Path(pasta) / "street_tris.json"
    shutil.copyfile(gl.ROOT / "sao-carlos/dados/street_tris.json", fonte)
    montagens = []
    montar = lambda: (montagens.append(1), gl.sh.polygons([[[0, 0], [1, 0], [0, len(montagens)]]]))[1]
    pasta_cache = Path(pasta) / "cache"
    for _ in range(2):
        primeira = cache.poligonos("teste", [fonte], montar, pasta=pasta_cache)
    assert len(montagens) == 1, "Cache quente não deveria remontar"
    dados = bytearray(fonte.read_bytes())
    dados[100] = ord("9") if dados[100] != ord("9") else ord("8")
    fonte.write_bytes(bytes(dados))
    segunda = cache.poligonos("teste", [fonte], montar, pasta=pasta_cache)
    assert len(montagens) == 2 and not gl.sh.equals(primeira[0], segunda[0]), "Fonte alterada não refez o cache"
    imagem = (gl.np.arange(600 * 300 * 3) % 251).astype(gl.np.uint8).reshape(300, 600, 3)
    from PIL import Image
    pil = Image.fromarray(imagem)
    (Path(pasta) / "img.png").write_bytes(b"x")
    recorte = cache.Imagem(Path(pasta) / "img.png", pil, pasta=pasta_cache)
    for caixa in ((0, 0, 600, 300), (-2, 250, 3, 270), (250, 250, 520, 262), (590, 299, 609, 305), (700, 0, 709, 3)):
        assert gl.np.array_equal(recorte.crop(caixa), gl.np.asarray(pil.crop(caixa))), caixa
    recorte.dados.close()
    print("OK: byte trocado na fonte refez o cache; recortes por bloco iguais ao PIL, inclusive fora da imagem.", flush=True)
