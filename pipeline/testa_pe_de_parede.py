# -*- coding: utf-8 -*-
"""Portao do PE DE PAREDE: reprova se a base da parede voltar a CLAREAR.

    python pipeline/testa_pe_de_parede.py     # ribeirao-preto, mirra-114

O defeito (o "vazamento de luz pela quina perto do chao"): a parede nasce em y=0 e o
piso esta em y=0,02, entao a base do prisma -- e o rodape inteiro -- fica no nivel do
piso ou abaixo dele. Em `bakeRaio` o piso so conta como oclusor quando o raio o cruza a
mais de 3 cm; desses vertices o cruzamento da t <= 0, o raio que DESCE nao bate em nada
e cai no teste de pertinencia a 6 m, que numa parede externa cai FORA da planta e volta
como ceu (peso 1,0 contra 0,30 de superficie). A base ganhava ate ~50% de ceu que ela
nao ve e o valor escorria pra cima. Conserto: `bakePrepara` amostra o vertice no minimo
4 cm acima do piso -- o mesmo clamp que a junta parede-teto ja tinha por cima.

E preciso ser RIBEIRAO: em Sao Carlos a unidade do outro portao tem atlas do Unreal, e
com atlas o bake em JS nem roda -- a foto sairia limpa com o defeito no lugar.

Medida: na parede lisa da esquerda, coluna a coluna, a luminancia dos ultimos 8 px de
parede (a borda com o piso e achada pelo salto, e o rodape fica de fora) contra a
MEDIANA da coluna. Mediana das colunas. Medido no mirra-114: 1,10 com o defeito,
0,82 sem ele -- e com o defeito um terco das colunas nem acha a borda, porque o pe da
parede fica claro demais pra o salto aparecer.
"""
import os, subprocess, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTO = os.path.join(RAIZ, "unreal", "_pe_parede.png")
COLS = range(40, 300, 4)      # so a parede lisa da esquerda no enquadramento Sala->Cozinha
Y0 = 330                      # abaixo da junta com o forro
FOLGA = 6                     # px descartados junto a borda: e o rodape, que e branco
LIMITE = 0.95                 # no meio dos 0,81 do consertado e dos 1,10 do defeito


def main():
    r = subprocess.run([sys.executable, os.path.join(RAIZ, "pipeline", "foto_interior.py"),
                        "ribeirao-preto", "--de", "Sala", "--para", "Cozinha",
                        "--pitch", "-0.35", "--salvar", FOTO],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode or not os.path.exists(FOTO):
        print("nao fotografou:"); print((r.stdout or "") + (r.stderr or "")[-600:]); return 1

    from PIL import Image
    px = Image.open(FOTO).convert("RGB").load()
    lum = lambda x, y: 0.299*px[x, y][0] + 0.587*px[x, y][1] + 0.114*px[x, y][2]
    razoes = []
    for x in COLS:
        col, borda = [], None
        for y in range(Y0, 758):
            v = lum(x, y)
            # o piso e o rodape sao MUITO mais claros que o pe da parede: o salto marca
            # a borda melhor que qualquer y fixo, que muda com a perspectiva. RELATIVO e
            # nao absoluto: com limiar de 35 niveis o teste passou a reprovar sozinho
            # quando a cena clareou (a isotropizacao da sonda subiu a media 12%) -- a
            # borda deixava de ser achada em metade das colunas e a media do "pe" caia
            # dentro do rodape, que e branco.
            if col and v - col[-1] > 0.25 * col[-1]: borda = y; break
            col.append(v)
        if borda is None or len(col) < 60: continue
        pe = col[-(FOLGA+8):-FOLGA]
        meio = sorted(col)[len(col)//2]
        if meio > 1: razoes.append((sum(pe)/len(pe)) / meio)
    if not razoes:
        print("pe de parede: nao achei parede no enquadramento"); return 1

    razoes.sort()
    r50 = razoes[len(razoes)//2]
    ok = r50 < LIMITE
    print("pe de parede: base/meio %.2f  (limite %.2f, %d colunas) %s"
          % (r50, LIMITE, len(razoes), "ok" if ok else "FORA"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
