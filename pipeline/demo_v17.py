# -*- coding: utf-8 -*-
"""Monta uma pagina de DEMONSTRACAO do v17 com cidade sintetica.

Existe por um motivo pratico: o acervo de Sao Carlos (`city.json`, relevo, plantas
fornecidas) sao artefatos grandes que nao vivem no repositorio, entao uma maquina que
so tem o codigo nao consegue montar a pagina de verdade -- nem pra conferir as tres
etapas, nem pra mostrar o resultado pra alguem. Aqui a cidade e FABRICADA: malha viaria
em grade, quarteiroes com predios de altura variada, e no centro uma torre com uma
unidade cadastrada (planta de cinco comodos e mobilia parametrica).

NAO substitui o `montar.py`. As pecas do renderizador sao as mesmas, byte a byte -- o
que muda e so a origem do dado. Serve pra demonstrar e pra provar comportamento (e o
que o `testa_etapas.py` mediria contra o acervo de verdade).

    python pipeline/demo_v17.py                      # -> v17/demo-v17.html
    python pipeline/demo_v17.py --saida /tmp/x.html
"""
import io, json, os, random, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, "renderizador-v17")


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SAIDA = arg("--saida", os.path.join(RAIZ, "v17", "demo-v17.html"))
UNIDADE_ID = "demo-1204"
Q = 10                      # decimetros: a mesma quantizacao do acervo real
ELEV_N = 8                  # grade de relevo NxN (plana, nesta demo)
QUADRA = 120.0              # lado do quarteirao, em metros
ALCANCE = 1320.0            # meia-largura da cidade fabricada
rnd = random.Random(20260919)   # semente fixa: a mesma demo em toda maquina


def caminho(pts):
    """Um anel/linha no formato do city.json: n seguido de deltas inteiros."""
    out = [len(pts)]
    lx = lz = 0
    for x, z in pts:
        out += [int(round(x)) - lx, int(round(z)) - lz]
        lx, lz = int(round(x)), int(round(z))
    return out


def anel(cx, cz, larg, prof):
    """Retangulo em DECIMETROS, com enrolamento negativo (shoelace < 0).

       O sinal nao e detalhe: `plantaDaUnidade` le `shoelace(rec.r) > 0` como "contorno
       GERADO" e inverte o anel antes de recortar a casca. Um retangulo no sentido
       errado faz a planta nascer maior que o predio."""
    x0, x1 = (cx - larg / 2) * Q, (cx + larg / 2) * Q
    z0, z1 = (cz - prof / 2) * Q, (cz + prof / 2) * Q
    return [(x0, z1), (x1, z1), (x1, z0), (x0, z0)]


def ret(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


# ---- a malha viaria: grade simples, uma avenida no meio de cada eixo -----------
ruas, nomes = [], []
def via(k, nome, pts):
    nomes.append(nome)
    ruas.extend([k, len(nomes) - 1] + caminho([(x * Q, z * Q) for x, z in pts]))

# As ruas ficam em (i + 1/2) x QUADRA, e nao em i x QUADRA. O motivo nao e estetico: a
# `ancora` da unidade e o CENTRO do mapa, e `predioDaUnidade` resolve isso pelo predio
# mais proximo da origem -- entao a torre TEM que estar em (0, 0). Com a grade deslocada
# de meia quadra, o quarteirao do meio e centrado na origem e o lote do meio dele tambem.
# Alinhando as ruas na origem, a torre cairia em (60, 60) e o farol do link acenderia
# num predio qualquer do lado -- foi exatamente o que aconteceu no primeiro print.
n = int(ALCANCE / QUADRA)
for i in range(-n, n + 1):
    c = (i + 0.5) * QUADRA
    avenida = (abs(i) % 5 == 0)
    # 2 = primary (13 m) nas avenidas; 6 = residential (7,5 m) no resto
    via(2 if avenida else 6,
        ("Avenida %d Norte-Sul" % abs(i)) if avenida else ("Rua %d Norte-Sul" % abs(i)),
        [(c, -ALCANCE), (c, ALCANCE)])
    via(2 if avenida else 6,
        ("Avenida %d Leste-Oeste" % abs(i)) if avenida else ("Rua %d Leste-Oeste" % abs(i)),
        [(-ALCANCE, c), (ALCANCE, c)])

# ---- os quarteiroes: predios de altura variada, e a TORRE no centro ------------
predios, grupos, meta, fa = [], [], [], []
RECUO = 11.0            # da rua ate a testada: meia pista + calcada + recuo

for gi in range(-n, n + 1):
    for gj in range(-n, n + 1):
        cx, cz = gi * QUADRA, gj * QUADRA
        miolo = QUADRA - 2 * RECUO
        inicio = len(fa)
        central = (gi == 0 and gj == 0)
        # 3 x 3 lotes por quadra. No quarteirao central, o do meio e a torre da unidade.
        for li in range(3):
            for lj in range(3):
                lx = cx + (li - 1) * (miolo / 3.0)
                lz = cz + (lj - 1) * (miolo / 3.0)
                torre = central and li == 1 and lj == 1
                if torre:
                    # 45 m = ~14 pavimentos. A unidade mora no 12o andar, e o piso dela
                    # nasce em `andar x LV` (3,15 m) = 37,8 m: num predio de 12 m o
                    # apartamento flutuaria acima do proprio telhado. A planta tem
                    # 10,2 x 8,0 m, entao a torre e so um pouco maior que ela.
                    larg, prof, alt, cls = 13.0, 10.5, 45.0, 1
                else:
                    if rnd.random() < 0.18:
                        continue                      # lote vazio: a quadra respira
                    larg = rnd.uniform(8.0, 15.0)
                    prof = rnd.uniform(8.0, 14.0)
                    alt = rnd.choice([3.2, 3.2, 6.0, 6.0, 9.0, 15.0, 24.0])
                    cls = 1 if rnd.random() < 0.82 else 2
                predios.extend([cls, int(round(alt * Q))] + caminho(anel(lx, lz, larg, prof)))
                if torre:
                    nomes.append("Edificio Mirante")
                    meta.extend([len(fa), len(nomes) - 1, 0])
                fa.append(400)
        if len(fa) > inicio:
            grupos.extend([int(cx * Q), int(cz * Q), int(QUADRA * 0.75 * Q),
                           inicio, len(fa) - inicio])

city = {"q": Q, "b": predios, "r": ruas, "g": [], "bl": grupos,
        "names": nomes, "bm": meta, "fa": fa}

cidade = {"slug": "demo", "nome": "Cidade de demonstração", "uf": "SP",
          "centro": {"lat": -22.01725, "lon": -47.8908},
          "quantizacao": Q,
          "relevo_grade": {"n": ELEV_N, "half_m": 2000},
          "arborizacao": {}, "aparencia": {},
          "arquivo_base": "demo.city.json"}

# ---- a unidade: planta de cinco comodos na torre do centro --------------------
# So mobilia PARAMETRICA: sem `moveis/moveis_lib.json` as pecas de malha (cama, mesa,
# geladeira...) nasceriam vazias. Limite do dado da demo, nao do renderizador.
unidade = {
    "id": UNIDADE_ID, "cidade": "demo", "andar": 12,
    "ficha": {"empreendimento": "Edifício Mirante", "titulo": "Apartamento 1204",
              "bairro": "Centro", "municipio": "Demonstração/SP",
              "preco": 690000, "tipo": "venda", "area_util": 96,
              "quartos": 3, "suites": 1, "banheiros": 2, "vagas": 2},
    "predio_id": None,
    "ancora": {"lat": -22.01725, "lon": -47.8908, "confirmado": True},
    "planta": {
        "pe_direito": 2.7,
        "comodos": [
            {"nome": "Sala",     "poly": ret(0.0, 0.0, 6.4, 4.2), "piso": "quente"},
            {"nome": "Cozinha",  "poly": ret(6.4, 0.0, 10.2, 4.2), "piso": "frio"},
            {"nome": "Suíte",   "poly": ret(0.0, 4.2, 4.0, 8.0), "piso": "quente"},
            {"nome": "Quarto 2", "poly": ret(4.0, 4.2, 7.4, 8.0), "piso": "quente"},
            {"nome": "Banho",    "poly": ret(7.4, 4.2, 10.2, 8.0), "piso": "frio"}
        ],
        "portas": [{"p": [6.4, 2.1], "largura": 0.9},
                   {"p": [2.0, 4.2], "largura": 0.8},
                   {"p": [5.7, 4.2], "largura": 0.8},
                   {"p": [8.8, 4.2], "largura": 0.7}],
        "janelas": [{"p": [3.2, 0.0], "largura": 2.0},
                    {"p": [2.0, 8.0], "largura": 1.6},
                    {"p": [5.7, 8.0], "largura": 1.6},
                    {"p": [10.2, 2.1], "largura": 1.2}],
        "moveis": [{"tipo": "sofa",        "p": [1.6, 1.2], "rot": 0},
                   {"tipo": "tv",          "p": [5.9, 1.2], "rot": 2},
                   {"tipo": "rack",        "p": [5.9, 1.6], "rot": 2},
                   {"tipo": "guardaroupa", "p": [0.6, 6.2], "rot": 1},
                   {"tipo": "armario",     "p": [6.9, 6.2], "rot": 3},
                   {"tipo": "pia",         "p": [9.6, 0.6], "rot": 0},
                   {"tipo": "balcao",      "p": [7.2, 0.6], "rot": 0},
                   {"tipo": "box",         "p": [9.6, 7.4], "rot": 0},
                   {"tipo": "maquina",     "p": [7.9, 7.4], "rot": 0}]
    }
}

BLOCOS = [
    ("__cidade", json.dumps(cidade, ensure_ascii=False)),
    ("__unidades", json.dumps([unidade], ensure_ascii=False)),
    ("__luzue", "{}"),
    ("__moveis", "{}"),
    ("__textura", "{}"),
    ("__imoveis", "[]"),
    ("__grounddata", "[]"),
    ("__murosdata", "[]"),
    ("__streetdata", "[]"),
    ("__elevdata", json.dumps([0.0] * (ELEV_N * ELEV_N))),
    ("__portoes", "[]"),
    ("__vegetacao", "[]"),
    ("__citydata", json.dumps(city, separators=(",", ":"))),
    ("__arvores", '{"especies":{}}'),
    ("__poidata", "[]"),
    ("__urbanModels", "{}"),
]


def le(rel):
    return io.open(os.path.join(FONTE, rel.replace("/", os.sep)),
                   encoding="utf-8", newline="").read()


def main():
    titulo = "Mapa 3D · v17 · três etapas (demonstração)"
    cabeca = le("cabeca.html")
    if cabeca and cabeca[0] == u"﻿":
        cabeca = cabeca[1:]          # o BOM vira caractere invisivel quando hospedado
    import re
    cabeca = re.sub(r"<title>[^<]*</title>", "<title>%s</title>" % titulo, cabeca, count=1)

    partes = [cabeca]
    for ident, dado in BLOCOS:
        partes += ['<script type="application/json" id="%s">' % ident, dado, "</script>\n"]
    partes += ["<script>", le("lib/three.min.js"), "</script>\n",
               "<script>", le("lib/earcut.min.js"), "</script>\n",
               "<style>", le("estilo.css"), "</style>\n",
               le("corpo.html"),
               "<script>", le("terrain-fit.js"), "\n", le("road-clearance.js"), "\n",
               le("urban-models.js"), "\n", le("app.js"), "</script>", le("rabo.html")]
    s = "".join(partes)
    os.makedirs(os.path.dirname(os.path.abspath(SAIDA)), exist_ok=True)
    io.open(SAIDA, "w", encoding="utf-8", newline="").write(s)
    print("%.2f MB -> %s" % (len(s.encode("utf-8")) / 1e6, SAIDA))
    print("  %d predios, %d quarteiroes, %d vias" %
          (len(fa), len(grupos) // 5, len(nomes)))
    print("  link direto: <url>?imovel=%s  (&etapa=interior | &etapa=planta)" % UNIDADE_ID)
    return 0


if __name__ == "__main__":
    sys.exit(main())
