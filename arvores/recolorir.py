# -*- coding: utf-8 -*-
"""Reescreve a COR da biblioteca sem abrir o Blender.

    python arvores/recolorir.py            # aplica; grava .bak antes
    python arvores/recolorir.py --conferir  # so relata, nao escreve

Existe porque a geometria e a cor tem donos diferentes na pratica: mexer em forma exige
o gerador (e o Blender aberto), mexer em cor nao. Pedir pro usuario reabrir o Blender
por causa de uma troca de tom seria trocar o trabalho dele pelo meu.

**Como a remocao da flor funciona.** O gerador pinta cada vertice como
`base_linear * k`, onde `k` junta o jitter por face e o gradiente vertical da copa. Duas
bases por especie: `leaf` e a cor da flor. Entao, por vertice:

  1. descobre de qual base ele veio, comparando a CROMATICIDADE (a direcao do vetor de
     cor), que `k` nao altera;
  2. mede o `k` daquele vertice na base de origem;
  3. reescreve como `base_nova * k`, preservando o brilho.

O `k` e medido pela mediana dos canais utilizavies -- canal saturado (>= 0,995 linear) ou
de base quase nula e descartado, senao a divisao mente. A flor amarela do ipe
(`#F2CE22`) satura o vermelho no topo da copa, e sem esse cuidado a arvore inteira
saia clara demais.
"""
import io, json, os, shutil, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from especies import SPECIES, cor_da_flor

LIB = os.path.join(AQUI, "arvores_lib.json")


def s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def l2s(v):
    v = max(0.0, min(1.0, v))
    s = v * 12.92 if v <= 0.0031308 else 1.055 * (v ** (1 / 2.4)) - 0.055
    return int(round(s * 255))


def hex_lin(h):
    h = h.lstrip("#")
    return [s2l(int(h[i:i + 2], 16)) for i in (0, 2, 4)]


def croma(v):
    n = sum(v) or 1e-9
    return [x / n for x in v]


def dist_croma(a, b):
    ca, cb = croma(a), croma(b)
    return sum(abs(x - y) for x, y in zip(ca, cb))


def fator(c, base):
    """O `k` daquele vertice, pela mediana dos canais que dao pra usar."""
    ks = [c[i] / base[i] for i in range(3) if base[i] > 0.02 and c[i] < 0.995]
    if not ks:
        return None
    ks.sort()
    return ks[len(ks) // 2]


def main():
    so_conferir = "--conferir" in sys.argv
    lib = json.load(io.open(LIB, encoding="utf-8"))
    porNome = {s["nome"]: s for s in SPECIES}
    total = trocados = 0

    for nome, e in lib["especies"].items():
        s = porNome.get(nome)
        if not s or not s.get("flower"):
            continue
        leaf = hex_lin(s["leaf"])
        flor = hex_lin(s["flower"])          # a base com que a biblioteca FOI pintada
        nova = hex_lin(cor_da_flor(s) or s["leaf"])   # a que entra no lugar
        # A CASCA entra como terceira candidata, e nao e detalhe: marrom (#4A3A2C) fica
        # cromaticamente MAIS PERTO do amarelo do ipe do que do verde da folha. Sem ela
        # na disputa, o tronco de toda arvore florida virava verde.
        bark = hex_lin(s.get("bark", "#4A3A2C"))
        if dist_croma(flor, nova) < 1e-6:
            continue

        for lod in e["lod"].values():
            col = lod["col"]
            n = len(col) // 3
            total += n
            for i in range(n):
                c = [s2l(col[i * 3 + j]) for j in range(3)]
                d = dist_croma(c, flor)
                if d >= dist_croma(c, leaf) or d >= dist_croma(c, bark):
                    continue                  # veio da folha ou da casca; nao mexe
                k = fator(c, flor)
                if k is None:
                    continue
                for j in range(3):
                    col[i * 3 + j] = l2s(nova[j] * k)
                trocados += 1
        print("%-20s %s -> %s" % (nome, s["flower"], cor_da_flor(s)))

    print("-" * 46)
    print("%d de %d vertices repintados" % (trocados, total))
    if so_conferir:
        print("(--conferir: nada foi escrito)")
        return 0
    shutil.copyfile(LIB, LIB + ".bak")
    io.open(LIB, "w", encoding="utf-8").write(json.dumps(lib, separators=(",", ":")))
    print("gravado: arvores_lib.json (anterior em arvores_lib.json.bak)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
