# -*- coding: utf-8 -*-
"""Prova que a grade de NDVI esta ALINHADA com o mapa, e nao so que ela existe.

Um espelhamento de eixo ou uma troca de linha por coluna passa despercebido olhando o
arquivo -- os percentis continuam bonitos e a grade fica inutil. O teste usa duas
populacoes que o mapa ja conhece e cujo NDVI tem que ser OPOSTO:

    celula COM edificacao (b[] do city.json)  ->  NDVI baixo
    celula SEM nenhuma                        ->  NDVI alto

Onde ha casa nao ha copa, e isso vale em qualquer cidade. A primeira versao comparava
com a AREA VERDE do OSM e reprovava Sao Jose do Rio Preto acusando "eixo trocado" --
mas a cidade so tem praca pequena (2.495 poligonos de mediana 1.058 m2, que a 10 m se
misturam com calcada). O dado estava certo; o teste e que media a coisa errada.

Depois de medir, o script varre DESLOCAMENTOS da grade: se algum deles pontuar melhor
que o zero, ai sim ela esta torta. Sem essa varredura nao da pra separar "grade torta"
de "cidade sem contraste".

    python pipeline/fontes/_confere_vegetacao.py
"""
import base64, io, json, os, sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))


def carrega_grade():
    d = json.load(io.open(CID.caminho("vegetacao"), encoding="utf-8"))
    n = d["n"]
    b = np.frombuffer(base64.b64decode(d["ndvi_b64"]), dtype=np.uint8).reshape(n, n)
    return d, b.astype(np.float32) / 255.0 * 1.1 - 0.2


def amostra(g, half, xs, zs):
    n = g.shape[0]
    ci = np.clip(((np.asarray(xs) + half) / (2 * half) * (n - 1)).astype(int), 0, n - 1)
    ri = np.clip(((np.asarray(zs) + half) / (2 * half) * (n - 1)).astype(int), 0, n - 1)
    return g[ri, ci]


def centroides_predio(city):
    b = city["b"]; Q = city.get("q", 10); out = []
    i = 0; n = len(b)
    while i < n:
        _cls, _h, npt = b[i], b[i + 1], b[i + 2]; i += 3
        lx = lz = 0; sx = sz = 0.0
        for _ in range(npt):
            lx += b[i]; lz += b[i + 1]; i += 2
            sx += lx; sz += lz
        if npt: out.append((sx / npt / Q, sz / npt / Q))
    return out


def centroides_verde(city):
    g = city["g"]; Q = city.get("q", 10); out = []
    i = 0; n = len(g)
    while i + 1 < n:
        npt = g[i]; i += 1
        if npt <= 0 or i + npt * 2 > n: break
        lx = lz = 0; sx = sz = 0.0
        for _ in range(npt):
            lx += g[i]; lz += g[i + 1]; i += 2
            sx += lx; sz += lz
        out.append((sx / npt / Q, sz / npt / Q))
    return out


def densidade_predio(city, half, n):
    """Quantas edificacoes caem em cada celula da grade."""
    c = np.zeros((n, n), dtype=np.int32)
    for x, z in centroides_predio(city):
        if abs(x) >= half or abs(z) >= half:
            continue
        ci = int((x + half) / (2 * half) * (n - 1))
        ri = int((z + half) / (2 * half) * (n - 1))
        c[ri, ci] += 1
    return c


def main():
    d, grade = carrega_grade()
    half = d["half_m"]; n = d["n"]
    city = json.load(io.open(CID.caminho("city_saida"), encoding="utf-8"))
    print("cena %s (%s, %.1f%% de nuvem) | grade %dx%d"
          % (d["cena"], d["data"], d["nuvem_pct"], n, n))

    # ---- teste principal: NDVI contra DENSIDADE DE EDIFICACAO ------------------
    # Nao depende de como o OSM etiquetou area verde -- e foi por isso que ele virou o
    # principal. Em Sao Jose do Rio Preto o teste antigo (verde do OSM x telhado) dava
    # +0,009 e gritava "eixo trocado", quando na verdade a cidade so tem praca pequena:
    # 2.495 poligonos de mediana 1.058 m2, que a 10 m se misturam com calcada. Onde ha
    # casa nao ha copa, e ISSO vale em qualquer cidade.
    dens = densidade_predio(city, half, n)
    tem = dens > 0
    cheio = dens >= 4
    vazio = dens == 0
    m_cheio = float(np.median(grade[cheio])) if cheio.sum() > 50 else float("nan")
    m_vazio = float(np.median(grade[vazio])) if vazio.sum() > 50 else float("nan")
    print("  celulas com >=4 edificacoes: %6d  ndvi mediano %.3f" % (cheio.sum(), m_cheio))
    print("  celulas sem nenhuma:         %6d  ndvi mediano %.3f" % (vazio.sum(), m_vazio))
    queda = m_vazio - m_cheio

    # ---- prova de que nao e deslocamento ---------------------------------------
    # Se a grade estivesse torta, ALGUM deslocamento pontuaria bem melhor que o zero.
    melhor = (-9, 0, 0)
    for dr in (-16, -8, 0, 8, 16):
        for dc in (-16, -8, 0, 8, 16):
            g2 = np.roll(np.roll(grade, dr, axis=0), dc, axis=1)
            v = float(np.median(g2[vazio])) - float(np.median(g2[cheio]))
            if v > melhor[0]:
                melhor = (v, dr, dc)
    print("  melhor deslocamento: %+.3f em (%+d, %+d)  [zero = %+.3f]"
          % (melhor[0], melhor[1], melhor[2], queda))

    # ---- informativo: o teste antigo -------------------------------------------
    verde = [p for p in centroides_verde(city) if abs(p[0]) < half and abs(p[1]) < half]
    if verde:
        v = amostra(grade, half, [p[0] for p in verde], [p[1] for p in verde])
        print("  (area verde do OSM: n=%d, ndvi mediano %.3f)" % (len(v), float(np.median(v))))

    print("-" * 62)
    print("queda de NDVI do vazio pro construido: %+.3f" % queda)
    if not (queda > 0.05):
        print("REPROVADO: onde ha casa o NDVI nao cai -- grade suspeita")
        return 1
    # Dois criterios juntos, e os dois sao necessarios. Limiar ABSOLUTO sozinho reprova
    # cidade com gradiente de paisagem: em Sorocaba o pico ficou em (-16,0) com +0,496
    # contra +0,462 no zero -- mas era um PLATO de -24 a 0, com a coluna exata em todas
    # as linhas, ou seja mata ao norte, nao grade torta. Deslocamento de verdade da
    # pico AGUDO e LONGE do zero, com o zero visivelmente pior.
    if melhor[0] > queda * 1.15 + 0.02 and (abs(melhor[1]) > 8 or abs(melhor[2]) > 8):
        print("REPROVADO: deslocamento de (%+d,%+d) pontua %.3f contra %.3f no zero -- grade torta"
              % (melhor[1], melhor[2], melhor[0], queda))
        return 1
    if queda < 0.09:
        print("ATENCAO: contraste fraco (%.3f). A grade passa, mas a densidade de arvore "
              "vai variar pouco nesta cidade." % queda)
    print("APROVADO: a grade esta alinhada com o mapa")
    return 0


if __name__ == "__main__":
    sys.exit(main())
