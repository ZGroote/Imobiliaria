#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Planta baixa (imagem) -> unidade.json.

Sao duas etapas, de proposito, porque exigem coisas diferentes:

  1. LINHAS  (visao computacional, deterministica)
     A parede de uma planta e um traco escuro, longo e reto. Isso a CV le com
     precisao de poucos pixels -- melhor que qualquer estimativa a olho.
         python extrair_planta.py linhas <imagem.png>

  2. MONTAR  (leitura + aritmetica)
     Alguem -- pessoa ou modelo de visao -- diz QUAL retangulo e qual comodo e
     copia a area rotulada no desenho. Isso a CV erra feio: numa prova com
     watershed a dispersao de px/m entre comodos ficou em 26%, porque a segmentacao
     nao sabe que o branco a direita e "fora" e nao a suite. O que este script faz
     com a leitura, ai sim, e deterministico: encaixa nas paredes, calibra e CONFERE.
         python extrair_planta.py montar <leitura.json>

A escala NAO e chutada: sai das areas rotuladas no proprio desenho. E a conferencia
e o produto principal -- `escala_conferida` so vira true quando toda area fechada
bate com a rotulada dentro da tolerancia.
"""
import json, sys, os
import numpy as np

TOL_AREA = 0.05   # 5% -- acima disto o comodo entra no relatorio como suspeito
TOL_SNAP = 12     # px -- distancia maxima pra encaixar uma borda numa parede


# ---------------------------  1. LINHAS  ---------------------------

def achar_linhas(caminho, escuro=60, comprimento=60, minimo=60):
    """Devolve (xs, ys, shape): coordenadas em px das paredes vert. e horiz."""
    import cv2
    from PIL import Image
    g = cv2.cvtColor(np.asarray(Image.open(caminho).convert("RGB")), cv2.COLOR_RGB2GRAY)
    esc = (g < escuro).astype(np.uint8)
    # abertura direcional: so sobrevive traco longo e reto -- movel e texto morrem
    ver = cv2.morphologyEx(esc, cv2.MORPH_OPEN, np.ones((comprimento, 1), np.uint8))
    hor = cv2.morphologyEx(esc, cv2.MORPH_OPEN, np.ones((1, comprimento), np.uint8))

    def picos(perfil):
        idx = np.where(perfil > minimo)[0]
        grupos = []
        for i in idx:
            if grupos and i - grupos[-1][-1] <= 6:
                grupos[-1].append(i)
            else:
                grupos.append([i])
        return [int(np.mean(gp)) for gp in grupos], [len(gp) for gp in grupos]

    xs, ex = picos(ver.sum(0))
    ys, ey = picos(hor.sum(1))
    # espessura tipica da parede, em px. Mediana e nao media: a borda externa do
    # desenho costuma ser bem mais grossa que a divisoria interna.
    espessura = float(np.median([e for e in ex + ey if e >= 3])) if (ex + ey) else 0.0
    return xs, ys, g.shape, espessura


def cmd_linhas(caminho):
    xs, ys, (h, w), esp = achar_linhas(caminho)
    print("imagem %dx%d   parede ~%.0f px de espessura" % (w, h, esp))
    print("%d paredes verticais   x = %s" % (len(xs), xs))
    print("%d paredes horizontais y = %s" % (len(ys), ys))
    print("\nUse estes numeros como bordas dos retangulos na leitura.json.")
    return xs, ys


# ---------------------------  2. MONTAR  ---------------------------

def encaixar(v, linhas, tol=TOL_SNAP):
    """Puxa a borda pra parede mais proxima, se houver uma dentro da tolerancia."""
    if not linhas:
        return v, False
    d = [abs(v - L) for L in linhas]
    i = int(np.argmin(d))
    return (linhas[i], True) if d[i] <= tol else (v, False)


def calibrar(areas_px, areas_m):
    """
    px por metro a partir das areas rotuladas.
    Media GEOMETRICA das razoes, nao aritmetica: assim o erro que conta e o
    relativo. Com media simples a suite de 11,5 m2 mandaria sozinha e a area
    tecnica de 1,4 m2 nao teria voz nenhuma.
    """
    r = [np.sqrt(px / m) for px, m in zip(areas_px, areas_m)]
    return float(np.exp(np.mean(np.log(r))))


def unificar_bordas(caixas, tol=TOL_SNAP):
    """
    Junta bordas quase-iguais entre comodos vizinhos.
    O renderizador exige que comodo ENCOSTE em comodo: uma folga de 15 cm nao
    vira parede, vira DUAS paredes paralelas com uma faixa morta no meio.
    """
    for eixo in (0, 1):
        vals = sorted({v for cx in caixas for v in (cx[eixo], cx[eixo + 2])})
        mapa, grupo = {}, [vals[0]]
        for v in vals[1:]:
            if v - grupo[-1] <= tol:
                grupo.append(v)
            else:
                for u in grupo:
                    mapa[u] = int(np.mean(grupo))
                grupo = [v]
        for u in grupo:
            mapa[u] = int(np.mean(grupo))
        for cx in caixas:
            cx[eixo] = mapa[cx[eixo]]
            cx[eixo + 2] = mapa[cx[eixo + 2]]
    return caixas


def ajustar_recuo(caixas, areas_m, esp):
    """
    Acha o recuo (px) que cada borda sofre por causa da espessura da parede.

    Nao da pra saber de fora se uma linha detectada e o EIXO da parede ou uma de
    suas FACES -- depende de como a planta foi desenhada, e as duas convencoes
    aparecem na mesma imagem. Entao o recuo nao e chutado: e ajustado contra as
    areas rotuladas. Um unico parametro contra N areas, o que ele nao consegue
    e maquiar erro de leitura -- esse continua aparecendo no relatorio.

    O sinal e o comodo PEQUENO: meia parede pesa muito num banho de 3 m2 e quase
    nada numa sala de 9 m2.

    O ajuste e PRESO a meia parede medida (+-3 px) de proposito. Solto ele e quase
    degenerado com a escala -- numa prova com leitura ruim ele foi pra 12 px e
    arrastou a escala pra 100 px/m, contra os ~109 que a propria imagem sustenta.
    Preso, ele conserta o vies de espessura e deixa erro de leitura aparecer, que
    e o comportamento que se quer de um conferidor.
    """
    meio = int(round(esp / 2.0))
    melhor, alvo = meio, None
    for r in range(max(0, meio - 3), meio + 4):
        px = [max(1, (x1 - x0 - 2 * r)) * max(1, (y1 - y0 - 2 * r))
              for x0, y0, x1, y1 in caixas]
        raz = [np.sqrt(p / m) for p, m in zip(px, areas_m)]
        disp = float(np.std(np.log(raz)))          # dispersao relativa
        if alvo is None or disp < alvo:
            alvo, melhor = disp, r
    return melhor, alvo


def montar(leitura, dir_base="."):
    comodos_in = leitura["comodos"]
    xs = ys = []
    esp = 0.0
    img = leitura.get("imagem")
    if img:
        p = img if os.path.isabs(img) else os.path.join(dir_base, img)
        if os.path.exists(p):
            xs, ys, _, esp = achar_linhas(p)
        else:
            print("  aviso: imagem '%s' nao encontrada; sem encaixe em parede" % img)

    encaixadas = 0
    caixas = []
    for c in comodos_in:
        x0, y0, x1, y1 = c["px"]
        x0, a = encaixar(x0, xs)
        x1, b = encaixar(x1, xs)
        y0, cc = encaixar(y0, ys)
        y1, dd = encaixar(y1, ys)
        encaixadas += sum((a, b, cc, dd))
        caixas.append([x0, y0, x1, y1])

    caixas = unificar_bordas(caixas)

    areas_rot = [c.get("area_rotulada") for c in comodos_in]
    escala_conhecida = leitura.get("escala_px_por_m")
    recuo = leitura.get("recuo_px")
    if recuo is None:
        if all(a is not None and a > 0 for a in areas_rot):
            recuo, _ = ajustar_recuo(caixas, areas_rot, esp)
        else:
            recuo = int(round(esp / 2.0))

    areas_px = [(x1 - x0 - 2 * recuo) * (y1 - y0 - 2 * recuo)
                for x0, y0, x1, y1 in caixas]
    if escala_conhecida is not None:
        s = float(escala_conhecida)
        if not np.isfinite(s) or s <= 0:
            raise ValueError("escala_px_por_m precisa ser positiva")
    else:
        if not all(a is not None and a > 0 for a in areas_rot):
            raise ValueError("sem escala_px_por_m, todo comodo precisa de area_rotulada")
        s = calibrar(areas_px, areas_rot)

    # o recuo some da AREA mas nao da POSICAO: o comodo tem que continuar
    # encostando no vizinho, senao a derivacao de parede quebra.
    ox = min(cx[0] for cx in caixas)
    oy = min(cx[1] for cx in caixas)
    saida, relatorio = [], []
    for c, (x0, y0, x1, y1) in zip(comodos_in, caixas):
        X0, Y0 = (x0 - ox) / s, (y0 - oy) / s
        X1, Y1 = (x1 - ox) / s, (y1 - oy) / s
        # area CONFERIDA e a do interior (poligono menos meia parede em cada lado),
        # que e o que o rotulo do desenho descreve. O poligono em si continua cheio.
        area = round((X1 - X0 - 2 * recuo / s) * (Y1 - Y0 - 2 * recuo / s), 2)
        rot = c.get("area_rotulada")
        erro = (area - rot) / rot if rot is not None and rot > 0 else 0.0
        relatorio.append({"nome": c["nome"], "area": area, "rotulada": rot,
                          "erro": erro, "conferida_por_area": rot is not None})
        saida.append({
            "nome": c["nome"],
            "area": rot if rot is not None else area,
            "piso": c.get("piso", "frio"),
            "poly": [[round(X0, 2), round(Y0, 2)], [round(X1, 2), round(Y0, 2)],
                     [round(X1, 2), round(Y1, 2)], [round(X0, 2), round(Y1, 2)]],
        })
    return saida, relatorio, s, encaixadas, recuo, esp


def cmd_montar(caminho):
    dir_base = os.path.dirname(os.path.abspath(caminho))
    with open(caminho, encoding="utf-8") as fp:
        leitura = json.load(fp)
    comodos, rel, s, enc, recuo, esp = montar(leitura, dir_base)

    print("\nescala calibrada: %.1f px/m   (%d bordas encaixadas em parede)" % (s, enc))
    print("parede ~%.0f px no desenho; recuo ajustado %d px = %.2f m por borda\n"
          % (esp, recuo, recuo / s))
    print("  %-18s %8s %8s %8s" % ("comodo", "fechou", "rotulo", "erro"))
    ruins = 0
    for r in rel:
        fora = r["conferida_por_area"] and abs(r["erro"]) > TOL_AREA
        ruins += fora
        rot = ("%.2f" % r["rotulada"]) if r["rotulada"] is not None else "-"
        err = ("%6.1f%%" % (r["erro"] * 100)) if r["conferida_por_area"] else "   n/a"
        print("  %-18s %8.2f %8s %7s%s" % (
            r["nome"], r["area"], rot, err, "  <-- FORA" if fora else ""))
    sf = sum(r["area"] for r in rel)
    rotulos = [r["rotulada"] for r in rel if r["rotulada"] is not None]
    if len(rotulos) == len(rel) and rotulos:
        sr = sum(rotulos)
        print("  %-18s %8.2f %8.2f %7.1f%%" % ("TOTAL", sf, sr, (sf - sr) / sr * 100))
    else:
        print("  %-18s %8.2f %8s %7s" % ("TOTAL", sf, "-", "n/a"))

    conferida = ruins == 0 and (bool(leitura.get("escala_px_por_m")) or
                                all(r["conferida_por_area"] for r in rel))
    print("\n%d comodo(s) fora da tolerancia de %.0f%%  ->  escala_conferida: %s"
          % (ruins, TOL_AREA * 100, str(conferida).lower()))

    unidade = {
        "id": leitura.get("id", "sem-id"),
        "cidade": leitura.get("cidade"),
        "predio_id": leitura.get("predio_id"),
        "andar": leitura.get("andar", 0),
        "ficha": leitura.get("ficha", {}),
        "planta": {
            "origem": leitura.get("imagem", "?"),
            "escala_conferida": conferida,
            "escala_px_por_m": round(s, 1),
            "pe_direito": leitura.get("pe_direito", 2.70),
            "_extraido_por": "pipeline/extrair_planta.py",
            "comodos": comodos,
            "portas": leitura.get("portas", []),
            "janelas": leitura.get("janelas", []),
            "moveis": [],
        },
        "cores": leitura.get("cores", {}),
        "fotos": leitura.get("fotos", []),
    }
    destino = os.path.join(dir_base, "unidade.extraida.json")
    with open(destino, "w", encoding="utf-8") as fp:
        json.dump(unidade, fp, ensure_ascii=False, indent=2)
    print("gravado: %s" % destino)
    return 0 if conferida else 1


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    if sys.argv[1] == "linhas":
        cmd_linhas(sys.argv[2])
    elif sys.argv[1] == "montar":
        sys.exit(cmd_montar(sys.argv[2]))
    else:
        print(__doc__)
        sys.exit(2)
