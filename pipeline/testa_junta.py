# -*- coding: utf-8 -*-
"""Portao da JUNTA PAREDE-TETO: reprova se o fio claro do z-fighting voltar.

    python pipeline/testa_junta.py            # sao-carlos, sanca-135-29

O defeito: `prismaQuad` emite tampa de topo em y1 com normal (0,+1,0); o forro e
desenhado no mesmo y=pd com normal (0,-1,0). Com a parede parando exatamente em pd as
duas ficam coplanares nos 6,5 cm de ESP/2 que caem dentro do comodo -- uma virada pro
sol, outra pra sombra, ambas DoubleSide -- e o z-fighting desenha um fio CLARO em toda
junta parede-teto. Conserto: a parede sobe SOBE_FORRO alem do forro (geoDaCasa).

Medida: no recorte que so tem parede e forro, por coluna, o quanto o pixel mais claro
supera os DOIS vizinhos a 4 px. Mediana das colunas -- o fio cruza todas, ruido de
textura nao. Medido: 30,2 com o defeito, 3,0 sem ele.
"""
import io, json, os, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTO = os.path.join(RAIZ, "unreal", "_junta.png")
CAIXA = (850, 0, 1100, 240)   # so parede e forro no enquadramento Cozinha->Sala
LIMITE = 12.0                 # entre os 3,0 do consertado e os 30,2 do defeito


def main():
    r = subprocess.run([sys.executable, os.path.join(RAIZ, "pipeline", "foto_interior.py"),
                        "sao-carlos", "--unidade", "sanca-135-29",
                        "--de", "Cozinha", "--para", "Sala", "--salvar", FOTO],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not os.path.exists(FOTO):
        print("nao fotografou:"); print((r.stdout or "") + (r.stderr or "")[-600:]); return 1

    from PIL import Image
    px = Image.open(FOTO).convert("RGB").load()
    x0, y0, x1, y1 = CAIXA
    lum = lambda x, y: 0.299*px[x, y][0] + 0.587*px[x, y][1] + 0.114*px[x, y][2]
    picos = []
    for x in range(x0, x1):
        col = [lum(x, y) for y in range(y0, y1)]
        picos.append(max(col[i] - max(col[i-4], col[i+4]) for i in range(4, len(col)-4)))
    picos.sort()
    crista = picos[len(picos)//2]
    ok = crista < LIMITE
    print("junta parede-teto: crista %.1f  (limite %.1f) %s" % (crista, LIMITE, "ok" if ok else "FORA"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
