# -*- coding: utf-8 -*-
"""Escreve `moveis/moveis_lib.json`. RODA DENTRO DO BLENDER:

    blender -b --factory-startup -P moveis/export_moveis.py

Mesmo formato da biblioteca de arvores (`arvores/arvores_lib.json`): malha indexada,
posicao em CENTIMETROS inteiros, normal em int8 (-127..127), cor em byte sRGB. O
consumidor no `app.js` ja sabe ler essa forma.

Os modificadores NAO sao aplicados por `bpy.ops` -- em headless o contexto de ops e
uma fonte de erro sem sintoma. O grafo de dependencia ja entrega a malha avaliada,
com bevel e subsurf dentro, e sem tocar na cena.
"""
import json, os, sys

import bpy

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(bpy.data.filepath or __file__)))
if not os.path.isdir(os.path.join(RAIZ, "moveis")):
    RAIZ = os.getcwd()
sys.path.insert(0, os.path.join(RAIZ, "moveis"))
import moveis as G


def malha(obs):
    """Junta os objetos numa malha indexada unica, ja triangulada."""
    dg = bpy.context.evaluated_depsgraph_get()
    pos, nrm, col, idx, herda = [], [], [], [], []
    mapa = {}
    for ob in obs:
        rgb = ob["cor"]
        h = 1 if rgb < 0 else 0
        c = (0, 0, 0) if h else ((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255)
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        # Costura por posicao+normal arredondadas: sem isso o subsurf entrega
        # ~4x mais vertices que o necessario e o JSON dobra de tamanho.
        for t in me.loop_triangles:
            for li in t.loops:
                v = me.vertices[me.loops[li].vertex_index].co
                n = me.corner_normals[li].vector
                # +Y do gerador e a FRENTE; no app a frente e +Z e o eixo pra cima
                # e Y. O X inverte junto pra manter a mao do sistema (senao a malha
                # sai espelhada e o puxador nasce do lado errado).
                p = (round(-v.x * 100), round(v.z * 100), round(v.y * 100))
                q = (max(-127, min(127, round(-n.x * 127))),
                     max(-127, min(127, round(n.z * 127))),
                     max(-127, min(127, round(n.y * 127))))
                k = (p, q, c, h)
                j = mapa.get(k)
                if j is None:
                    j = mapa[k] = len(pos) // 3
                    pos.extend(p); nrm.extend(q); col.extend(c); herda.append(h)
                idx.append(j)
        ob.evaluated_get(dg).to_mesh_clear()
    # A CAIXA ENVOLVENTE SAI MEDIDA, nao digitada. O bug da coifa (chamine parando
    # 60 cm abaixo do teto) era exatamente isto: `b:[.60,2.10,.50]` escrito a mao
    # contra uma geometria que media outra coisa. Ninguem digita mais.
    xs = pos[0::3]; ys = pos[1::3]; zs = pos[2::3]
    bb = [(max(xs) - min(xs)) / 100.0, max(ys) / 100.0, (max(zs) - min(zs)) / 100.0]
    return {"pos_cm": pos, "nrm_127": nrm, "col": col, "herda": herda, "idx": idx,
            "b": [round(v, 3) for v in bb],
            "tris": len(idx) // 3, "verts": len(pos) // 3}


def main():
    saida = {"unidade": "cm", "cor": "sRGB byte, aplicar como vertexColors",
             "obs": "origem no centro do CHAO, +Z pra frente, +Y pra cima (ja no "
                    "referencial do app)", "pecas": {}}
    for nome, fn in G.CATALOGO.items():
        G._limpa()
        saida["pecas"][nome] = malha(fn())
        d = saida["pecas"][nome]
        print("  %-12s %5d tris  %5d verts  b=%s" % (nome, d["tris"], d["verts"], d["b"]))
    cam = os.path.join(RAIZ, "moveis", "moveis_lib.json")
    with open(cam, "w", encoding="utf-8") as f:
        json.dump(saida, f, separators=(",", ":"))
    print("moveis_lib.json: %.1f KB" % (os.path.getsize(cam) / 1024.0))


main()
