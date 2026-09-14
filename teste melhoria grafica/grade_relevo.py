# -*- coding: utf-8 -*-
"""
Baixa a grade de elevacao 44x44 da open-elevation e grava relevo.json.

O botao "Relevo" da pagina busca essa grade em runtime e guarda no
localStorage. Em file:// isso e um pedido cross-origin partindo de origem
opaca, e sem internet nao acontece de jeito nenhum -- entao o botao ficaria
morto justamente na versao de duplo clique. A grade sao 1.936 numeros: cabe
embutida na pagina e o botao passa a funcionar offline.

Reproduz exatamente o que fetchElevation() faz no navegador (mesmo centro,
mesma extensao, mediana 3x3 de uma passada, subtrai o ponto central), pra o
resultado ser indistinguivel do que a pagina baixaria sozinha.

  python "teste melhoria grafica/grade_relevo.py"
"""
import io, json, math, os, sys, time, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(BASE, "relevo.json")

LAT, LON = -22.01725, -47.89080          # Catedral de Sao Carlos
N, HALF  = 44, 5500                       # ELEV_N, ELEV_HALF
MLAT = 111132.92
MLON = 111319.49 * math.cos(math.radians(LAT))
API  = "https://api.open-elevation.com/api/v1/lookup?locations="


def baixa():
    pts = []
    for j in range(N):
        for i in range(N):
            x = -HALF + i/(N-1)*2*HALF
            z = -HALF + j/(N-1)*2*HALF
            pts.append((LAT - z/MLAT, LON + x/MLON))

    out, BATCH = [], 100
    total = (len(pts) + BATCH - 1)//BATCH
    for b in range(total):
        chunk = pts[b*BATCH:(b+1)*BATCH]
        locs = "|".join("%.5f,%.5f" % p for p in chunk)
        for tentativa in range(3):
            try:
                with urllib.request.urlopen(API + locs, timeout=30) as r:
                    res = json.load(r)["results"]
                break
            except Exception as e:
                if tentativa == 2:
                    raise SystemExit("open-elevation falhou no lote %d/%d: %s" % (b+1, total, e))
                time.sleep(2.0)
        out.extend(float(x.get("elevation") or 0) for x in res)
        sys.stdout.write("\r  lote %d/%d" % (b+1, total)); sys.stdout.flush()
        time.sleep(0.35)
    print()
    return out


def mediana3x3(src):
    """Mesma limpeza do medianGrid() da pagina: tira o ponto isolado ruim que a
    API livre as vezes devolve, sem achatar relevo de verdade."""
    out = [0.0]*(N*N)
    for j in range(N):
        for i in range(N):
            win = [src[jj*N+ii]
                   for dj in (-1, 0, 1) for di in (-1, 0, 1)
                   for jj, ii in [(j+dj, i+di)]
                   if 0 <= ii < N and 0 <= jj < N]
            win.sort()
            out[j*N+i] = win[len(win)//2]
    return out


def main():
    print("baixando %d pontos da open-elevation:" % (N*N))
    g = mediana3x3(baixa())
    c = g[(N-1)//2*N + (N-1)//2]                 # zera no centro, igual a pagina
    g = [round(v - c, 2) for v in g]
    io.open(OUT, "w", encoding="utf-8").write(json.dumps(g, separators=(",", ":")))
    print("relevo: %d..%d m  ->  %s (%.0f KB)"
          % (min(g), max(g), OUT, os.path.getsize(OUT)/1024))


if __name__ == "__main__":
    main()
