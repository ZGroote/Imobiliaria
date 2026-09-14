# -*- coding: utf-8 -*-
"""Etapa 0: grade de elevacao da open-elevation.

Saida: `relevo_wide.json` -- N*N alturas em metros, ja com o centro zerado.

O botao "Relevo" da pagina busca essa grade em runtime e guarda no localStorage. Em
`file://` isso e pedido cross-origin partindo de origem opaca, e sem internet nao
acontece -- o botao ficaria morto justamente na versao de duplo clique. Sao poucos
milhares de numeros: cabe embutida.

Reproduz exatamente o que o `fetchElevation()` faz no navegador (mesmo centro, mesma
extensao, mediana 3x3, subtrai o ponto central), pra o embutido ser indistinguivel do
que a pagina baixaria sozinha.

**Cuidado com o raio.** A grade original era +-5,5 km e a periferia ficava fora dela:
o `terrainY` extrapolava e o chao saltava. Passou pra +-9,5 km, 80x80. Cidade nova:
meca o bbox das quadras antes de escolher, `HALF` tem que sobrar folga sobre ele.

**A escala vertical NAO esta aqui.** O `TERRAIN_EXAG = 4,5` mora no renderizador e a
grade de Sao Carlos vai de -146 a +97 m: no mapa isso vira -657 a +437 m. E por isso
que o alvo da camera precisa seguir o terreno (ver v4/stream_block.js).

  python pipeline/fontes/relevo.py
"""
import io, json, math, os, sys, time, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega

CID = carrega(os.environ.get("CIDADE", "sao-carlos"))
# A grade sai do JSON da cidade -- o renderizador le a MESMA chave. Enquanto o valor
# morava aqui e la, mudar de +-5500 pra +-9500 exigia lembrar dos dois lugares.
N = CID._d["relevo_grade"]["n"]; HALF = CID._d["relevo_grade"]["half_m"]
API = "https://api.open-elevation.com/api/v1/lookup?locations="
LOTE = 100


def baixa():
    pts = []
    for j in range(N):
        for i in range(N):
            x = -HALF + i / (N - 1) * 2 * HALF
            z = -HALF + j / (N - 1) * 2 * HALF
            pts.append((CID.clat - z / CID.mlat, CID.clon + x / CID.mlon))
    out = []; total = (len(pts) + LOTE - 1) // LOTE
    for b in range(total):
        locs = "|".join("%.5f,%.5f" % p for p in pts[b * LOTE:(b + 1) * LOTE])
        for tentativa in range(3):
            try:
                with urllib.request.urlopen(API + locs, timeout=30) as r:
                    res = json.load(r)["results"]
                break
            except Exception as e:
                if tentativa == 2:
                    raise SystemExit("open-elevation falhou no lote %d/%d: %s" % (b + 1, total, e))
                time.sleep(2.0)
        out.extend(float(x.get("elevation") or 0) for x in res)
        sys.stdout.write("\r  lote %d/%d" % (b + 1, total)); sys.stdout.flush()
        time.sleep(0.35)
    print()
    return out


def mediana3x3(src):
    """Mesma limpeza do medianGrid() da pagina: mata o ponto isolado ruim que a API
    livre as vezes devolve, sem achatar relevo de verdade."""
    out = [0.0] * (N * N)
    for j in range(N):
        for i in range(N):
            win = sorted(src[jj * N + ii]
                         for dj in (-1, 0, 1) for di in (-1, 0, 1)
                         for jj, ii in [(j + dj, i + di)]
                         if 0 <= ii < N and 0 <= jj < N)
            out[j * N + i] = win[len(win) // 2]
    return out


def main():
    print("baixando %d pontos da open-elevation (%s, +-%d m):" % (N * N, CID.nome, HALF))
    g = mediana3x3(baixa())
    c = g[(N - 1) // 2 * N + (N - 1) // 2]
    g = [round(v - c, 2) for v in g]
    saida = CID.caminho("relevo")
    io.open(saida, "w", encoding="utf-8").write(json.dumps(g, separators=(",", ":")))
    print("relevo %.0f..%.0f m -> %s (%.0f KB)"
          % (min(g), max(g), saida, os.path.getsize(saida) / 1024))


if __name__ == "__main__":
    main()
