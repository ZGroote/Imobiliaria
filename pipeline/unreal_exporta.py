# -*- coding: utf-8 -*-
"""Etapa 1 do caminho Unreal: a planta vira malha (.obj) + plano de atlas (.tiles.json).

    python pipeline/unreal_exporta.py            # todas as unidades de unreal/plantas/
    python pipeline/unreal_exporta.py <id>       # so uma

Entra `unreal/plantas/<id>.json` (gabarito tirado da PROPRIA pagina por
`dump_planta.py` -- ver o cabecalho de la pra saber por que nao se porta
`paredesDaGrade` no escuro). Sai:

    unreal/malhas/<id>.obj          a casa em CENTIMETROS, que e a unidade da UE
    unreal/malhas/<id>.tiles.json   o atlas: uma peca por FACE, com o retangulo dela

**O que e uma peca (tile).** O renderizador desenha cada parede como um PRISMA
(`quadDoSeg` + `prismaQuad`): quatro faces laterais na ordem [+n, tampa em b, -n,
tampa em a] e uma tampa em cima. Piso e teto sao poligonos. Cada uma dessas faces
recebe um retangulo proprio no atlas, porque cada uma pega luz diferente -- as duas
faces longas da MESMA parede olham pra comodos diferentes, e assar as duas no mesmo
lugar do atlas misturaria a sala com o banheiro.

**Por que a ordem importa.** O `app.js` vai calcular a UV de lightmap na hora, com a
mesma regra e a mesma ordem: peca `i` da parede `w` face `f`. Se a ordem divergir, o
lightmap assenta na parede errada -- e o defeito aparece como sombra no lugar errado,
que e dificil de ler como "indice trocado". Por isso a ordem esta escrita aqui e
espelhada la, e o `unreal_confere.py` compara as duas listas.

**Densidade.** 24 texels por metro (4 cm por texel). Irradiancia e campo de baixa
frequencia; o que se ganha em resolucao a partir dai e ruido do bake, nao detalhe.
"""
import io, json, math, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTAS = os.path.join(RAIZ, "unreal", "plantas")
MALHAS = os.path.join(RAIZ, "unreal", "malhas")

ESP = 0.13          # espessura de parede interna, igual ao app.js
ROD_ESP = ESP + 0.024
TEXELS_M = 24.0     # densidade do atlas
ATLAS = 1024        # lado do atlas, em texels
MARGEM = 2          # texels de folga entre pecas (evita vazamento na interpolacao)
MIN_LADO = 2        # peca menor que isto nao vale um retangulo


def quad_do_seg(a, b, esp):
    dx, dz = b[0]-a[0], b[1]-a[1]
    L = math.hypot(dx, dz) or 1.0
    dx /= L; dz /= L
    nx, nz = -dz*esp/2, dx*esp/2
    return [[a[0]+nx, a[1]+nz], [b[0]+nx, b[1]+nz], [b[0]-nx, b[1]-nz], [a[0]-nx, a[1]-nz]]


def faces_do_prisma(q, y0, y1):
    """As 5 faces que `prismaQuad` emite, na MESMA ordem.

    Devolve (canto_inferior_esquerdo, vetor_u, vetor_v, normal), tudo em 3D e em
    metros. `u` corre no comprimento da face e `v` na altura -- que e a
    parametrizacao que o atlas usa."""
    saida = []
    for i in range(4):
        a, b = q[i], q[(i+1) % 4]
        nx, nz = b[1]-a[1], -(b[0]-a[0])
        L = math.hypot(nx, nz) or 1.0
        nx /= L; nz /= L
        comp = math.hypot(b[0]-a[0], b[1]-a[1])
        saida.append((( a[0], y0, a[1]),
                      ( b[0]-a[0], 0.0, b[1]-a[1]),
                      ( 0.0, y1-y0, 0.0),
                      ( nx, 0.0, nz), comp, y1-y0))
    # tampa de cima, em y1
    u0, u1 = q[0], q[1]
    v0 = q[3]
    saida.append((( u0[0], y1, u0[1]),
                  ( u1[0]-u0[0], 0.0, u1[1]-u0[1]),
                  ( v0[0]-u0[0], 0.0, v0[1]-u0[1]),
                  ( 0.0, 1.0, 0.0),
                  math.hypot(u1[0]-u0[0], u1[1]-u0[1]),
                  math.hypot(v0[0]-u0[0], v0[1]-u0[1])))
    return saida


def face_de_poligono(poly, y, para_cima):
    """Piso ou teto: um retangulo de atlas sobre a caixa envolvente do poligono."""
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    x0, x1 = min(xs), max(xs); z0, z1 = min(zs), max(zs)
    n = (0.0, 1.0, 0.0) if para_cima else (0.0, -1.0, 0.0)
    return ((x0, y, z0), (x1-x0, 0.0, 0.0), (0.0, 0.0, z1-z0), n, x1-x0, z1-z0)


class Atlas(object):
    """Empacotamento por prateleira. Peca alta primeiro, que e o que fecha o buraco."""
    def __init__(self, lado):
        self.lado = lado
        self.x = MARGEM; self.y = MARGEM; self.alt = 0

    def poe(self, w, h):
        if self.x + w + MARGEM > self.lado:
            self.x = MARGEM; self.y += self.alt + MARGEM; self.alt = 0
        if self.y + h + MARGEM > self.lado:
            return None
        r = (self.x, self.y, w, h)
        self.x += w + MARGEM
        self.alt = max(self.alt, h)
        return r


def monta(dados):
    """Lista ordenada de pecas + a geometria pra escrever no OBJ."""
    pecas = []

    def poe(origem, chave, f):
        p0, du, dv, n, cw, ch = f
        tw = max(MIN_LADO, int(round(cw * TEXELS_M)))
        th = max(MIN_LADO, int(round(ch * TEXELS_M)))
        pecas.append({"origem": origem, "chave": chave,
                      "p0": [round(v, 5) for v in p0],
                      "du": [round(v, 5) for v in du],
                      "dv": [round(v, 5) for v in dv],
                      "n": [round(v, 5) for v in n],
                      "m": [round(cw, 4), round(ch, 4)],
                      "tex": [tw, th]})

    pd = dados["pd"]
    # 1. paredes: prisma principal e, quando nasce no chao, o rodape
    for i, w in enumerate(dados["paredes"]):
        q = quad_do_seg(w["a"], w["b"], ESP)
        for f, face in enumerate(faces_do_prisma(q, w["y0"], w["y1"])):
            poe("parede", [i, f], face)
        if w["y0"] < 0.05:
            qr = quad_do_seg(w["a"], w["b"], ROD_ESP)
            for f, face in enumerate(faces_do_prisma(qr, 0.02, 0.10)):
                poe("rodape", [i, f], face)
    # 2. pisos, um por comodo
    for i, c in enumerate(dados["comodos"]):
        poe("piso", [i, 0], face_de_poligono(c["poly"], 0.02, True))
    # 3. forro, um por contorno
    for i, poly in enumerate(dados["contorno"]):
        poe("teto", [i, 0], face_de_poligono(poly, pd, False))

    # empacota da mais alta pra mais baixa, mas guardando a ordem original: o app.js
    # indexa por ORDEM DE CRIACAO, nao por posicao no atlas.
    ordem = sorted(range(len(pecas)), key=lambda k: -pecas[k]["tex"][1])
    at = Atlas(ATLAS)
    for k in ordem:
        p = pecas[k]
        r = at.poe(p["tex"][0], p["tex"][1])
        if r is None:
            raise SystemExit("atlas de %d nao coube (peca %d de %d)" % (ATLAS, k, len(pecas)))
        p["rect"] = list(r)
    return pecas


def escreve_obj(caminho, pecas, nome):
    """OBJ em CENTIMETROS (unidade da UE), com UV1 no atlas.

    OBJ so tem um canal de UV. O que vai nele e a UV DO ATLAS -- que e a que a UE
    precisa pra assar. A UV de material (regua de madeira, placa de porcelanato) o
    renderizador ja calcula sozinho e nunca precisou vir daqui."""
    v, vt, vn, faces = [], [], [], []
    for p in pecas:
        p0, du, dv, n = p["p0"], p["du"], p["dv"], p["n"]
        rx, ry, rw, rh = p["rect"]
        # os 4 cantos, no sentido que deixa a normal pra fora
        cantos = [(0, 0), (1, 0), (1, 1), (0, 1)]
        base = len(v)
        for (a, b) in cantos:
            v.append((100*(p0[0] + du[0]*a + dv[0]*b),
                      100*(p0[1] + du[1]*a + dv[1]*b),
                      100*(p0[2] + du[2]*a + dv[2]*b)))
            vt.append(((rx + rw*a)/ATLAS, 1.0 - (ry + rh*b)/ATLAS))
        vn.append(n)
        ni = len(vn)
        faces.append((base+1, base+2, base+3, base+4, ni))
    with io.open(caminho, "w", encoding="utf-8", newline="\n") as f:
        f.write("# %s -- gerado por pipeline/unreal_exporta.py\n" % nome)
        f.write("mtllib %s.mtl\n" % nome)
        for x, y, z in v:
            f.write("v %.4f %.4f %.4f\n" % (x, z, y))          # UE: Z pra cima
        for u, w in vt:
            f.write("vt %.6f %.6f\n" % (u, w))
        for nx, ny, nz in vn:
            f.write("vn %.5f %.5f %.5f\n" % (nx, nz, ny))
        f.write("usemtl branco\ns off\n")
        for a, b, c, d, ni in faces:
            f.write("f %d/%d/%d %d/%d/%d %d/%d/%d %d/%d/%d\n"
                    % (a, a, ni, b, b, ni, c, c, ni, d, d, ni))
    with io.open(caminho[:-4] + ".mtl", "w", encoding="utf-8", newline="\n") as f:
        # BRANCO PURO de proposito: o que se quer assar e a IRRADIANCIA, nao a cor.
        # Com albedo 1,0 o que a captura mostra e exatamente quanta luz chega ali --
        # e o Three multiplica isso pela cor que ele ja tem. Assar cor junto
        # congelaria a paleta do cadastro dentro de uma imagem.
        f.write("newmtl branco\nKd 1.0 1.0 1.0\nKs 0 0 0\nNs 1\nd 1\nillum 1\n")


def main():
    alvo = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(MALHAS, exist_ok=True)
    n = 0
    for nome in sorted(os.listdir(PLANTAS)):
        if not nome.endswith(".json"):
            continue
        ident = nome[:-5]
        if alvo and ident != alvo:
            continue
        dados = json.load(io.open(os.path.join(PLANTAS, nome), encoding="utf-8"))
        pecas = monta(dados)
        obj = os.path.join(MALHAS, "%s.obj" % ident)
        escreve_obj(obj, pecas, ident)
        io.open(os.path.join(MALHAS, "%s.tiles.json" % ident), "w", encoding="utf-8").write(
            json.dumps({"id": ident, "atlas": ATLAS, "texels_m": TEXELS_M,
                        "pd": dados["pd"], "rumo": dados["rumo"],
                        "pecas": pecas}, ensure_ascii=False))
        usados = sum(p["tex"][0]*p["tex"][1] for p in pecas)
        print("  %-24s %4d pecas  %6.1f%% do atlas %d  -> %s"
              % (ident, len(pecas), 100.0*usados/(ATLAS*ATLAS), ATLAS,
                 os.path.relpath(obj, RAIZ)))
        n += 1
    if not n:
        print("nada em %s (rode pipeline/dump_planta.py antes)" % PLANTAS)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
