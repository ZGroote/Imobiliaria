# -*- coding: utf-8 -*-
"""Monta uma pagina do v18 com UM predio: o da planta enviada em 19/09/2026.

O v18 acrescenta a MAQUETE: a miniatura que nasce em cima da ficha, pisca o pavimento
da unidade em verde e cresce ate a tela pra entregar a visita 3D ou a planta.

Existe por um motivo pratico: o acervo de Sao Carlos (`city.json`, relevo, plantas
fornecidas) sao artefatos grandes que nao vivem no repositorio, entao uma maquina que
so tem o codigo nao consegue montar pagina nenhuma -- nem pra conferir as tres etapas,
nem pra mostrar o resultado pra alguem.

Aqui a "cidade" e o predio e mais nada: uma torre com a pegada da planta e duas ruas
pra dar chao. Quem precisa de cidade cheia usa o `montar.py` com o acervo.

AS MEDIDAS SAO AS DA PLANTA ENVIADA, lidas do `planta-apartamento-3d.html`: piso de
16,5 x 9,2 m, pe-direito 2,6 m, o recuo no canto sudeste, e cada divisoria na mesma
coordenada em que ela esta la. O que muda e a FORMA do dado, nao o numero: aquele
arquivo declara PAREDE (uma caixa por parede); o v18 declara COMODO, e deriva a parede
de toda fronteira entre donos diferentes (ver `paredesDaGrade` no app.js). Por isso o
que esta escrito abaixo e o retangulo de cada ambiente, e nao a lista de paredes.

    python miniaturas/demo_v18.py                          # -> v18/demo-v18.html
    python miniaturas/demo_v18.py --abre planta            # abre direto na etapa 3
    python miniaturas/demo_v18.py --saida /tmp/x.html
"""
import io, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, "renderizador-v18")


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SAIDA = arg("--saida", os.path.join(RAIZ, "v18", "demo-v18.html"))
ABRE = arg("--abre", "")            # "", "mapa", "interior" ou "planta"
UNIDADE_ID = "planta-1"
Q = 10                              # decimetros: a mesma quantizacao do acervo real
ELEV_N = 8                          # grade de relevo NxN (plana aqui)
PD = 2.6                            # pe-direito da planta enviada
ANDAR = 3                           # o piso nasce em andar x 3,15 m (LV, no app.js)

# ---- a planta, em metros, no referencial do desenho enviado -------------------
# Linhas de EIXO de parede, nao faces: a parede do v18 nasce sobre a fronteira entre
# dois comodos, com 13 cm centrados nela. Sao os mesmos numeros do arquivo enviado.
O, L = -8.15, 8.15                  # oeste / leste
N, S = -4.50, 4.50                  # norte / sul
RX, RZ = 3.00, 1.90                 # o recuo do canto sudeste comeca aqui
QX = -2.70                          # a prumada que fecha os dois quartos
Q1S, Q2N = -1.30, 1.60              # fundo do quarto 1 e testada do quarto 2
BX0, BX1, BZ0, BZ1 = -1.10, 1.50, -1.40, 1.00   # banho
CX0, CX1, CZ1 = 2.00, 4.80, -2.40               # cozinha (encosta no norte)
PX = 4.80                           # prumada que separa a sala da area privativa


def ret(x0, z0, x1, z1):
    return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]


# A ORDEM IMPORTA. `paredesDaGrade` pergunta "de quem e esta celula?" e fica no PRIMEIRO
# comodo que a contem. A sala e o poligono que sobra -- um hexagono que passa por cima
# do banho e da cozinha --, entao ela vem por ultimo e os dois vencem dentro da area
# deles. Sem isso a sala seria um poligono COM BURACO, que `inside()` nao sabe tratar.
COMODOS = [
    {"nome": "Banho",           "poly": ret(BX0, BZ0, BX1, BZ1), "piso": "frio"},
    {"nome": "Cozinha",         "poly": ret(CX0, N, CX1, CZ1),   "piso": "frio"},
    {"nome": "Quarto 1",        "poly": ret(O, N, QX, Q1S),      "piso": "quente"},
    {"nome": "Quarto 2",        "poly": ret(O, Q2N, QX, S),      "piso": "quente"},
    {"nome": "Hall",            "poly": ret(O, Q1S, QX, Q2N),    "piso": "quente"},
    {"nome": "Área privativa",  "poly": ret(PX, N, L, RZ),       "piso": "frio"},
    # O hexagono da sala: desce pelo leste ate o recuo, corta pra dentro e fecha no sul.
    {"nome": "Sala", "piso": "quente",
     # Area MEDIDA (o hexagono menos banho e cozinha). Sem ela a ficha somaria a area
     # dos dois duas vezes -- o poligono passa por cima deles de proposito.
     "area": round((PX - QX) * (RZ - N) + (RX - QX) * (S - RZ)
                   - (BX1 - BX0) * (BZ1 - BZ0) - (CX1 - CX0) * (CZ1 - N), 2),
     "poly": [[QX, N], [PX, N], [PX, RZ], [RX, RZ], [RX, S], [QX, S]]},
]

# Vao e PONTO + largura: ele procura sozinho a parede mais proxima (35 cm de alcance).
PORTAS = [
    {"p": [-4.00, Q1S], "largura": 0.80},          # quarto 1 -> hall
    {"p": [-4.00, Q2N], "largura": 0.80},          # quarto 2 -> hall
    # O hall e a sala sao o MESMO espaco no desenho enviado: ali nao ha parede nenhuma
    # em x = -2,70 entre os dois quartos. Uma abertura da largura inteira do trecho
    # (2,90 m) reproduz isso sem precisar de um comodo em L.
    {"p": [QX, (Q1S + Q2N) / 2], "largura": 2.90},
    # O desenho enviado nao fecha o lado leste do banho -- nao ha parede em x = 1,50.
    # Deixado assim o banheiro fica aberto pra sala, que e defeito de croqui e nao
    # projeto: aqui ele ganha porta, e essa e a UNICA licenca tomada sobre o original.
    {"p": [BX1, -0.20], "largura": 0.80},
    {"p": [(CX0 + CX1) / 2, CZ1], "largura": 0.90},   # cozinha -> sala
    {"p": [PX, -3.75], "largura": 1.50},              # sala -> area privativa
]
JANELAS = [
    {"p": [O, -3.00], "largura": 1.60},    # quarto 1, oeste
    {"p": [O,  2.50], "largura": 1.60},    # quarto 2, oeste
    {"p": [L, -1.50], "largura": 2.20},    # leste
    {"p": [5.50, RZ], "largura": 1.80},    # sobre o recuo
    {"p": [-4.00, N], "largura": 2.00},    # quarto 1, norte
    {"p": [ 1.50, N], "largura": 2.00},    # sala, norte
]
MOVEIS = [
    {"tipo": "sofa",        "p": [0.20, -3.40], "rot": 0},
    {"tipo": "rack",        "p": [0.20, -4.30], "rot": 2},
    {"tipo": "tv",          "p": [0.20, -4.35], "rot": 2},
    {"tipo": "guardaroupa", "p": [-7.70, -3.00], "rot": 1},
    {"tipo": "armario",     "p": [-7.70,  3.00], "rot": 1},
    {"tipo": "pia",         "p": [ 2.60, -4.10], "rot": 0},
    {"tipo": "balcao",      "p": [ 4.30, -4.10], "rot": 0},
    {"tipo": "box",         "p": [-0.60,  0.40], "rot": 0},
    {"tipo": "maquina",     "p": [ 7.60,  1.30], "rot": 0},
]

# ---- o predio: a pegada da planta, seis pavimentos ---------------------------
LARG, PROF = 16.90, 9.60            # 40 cm a mais que a planta: a casca e por fora dela
ALT = 19.00                         # ~6 pavimentos; o piso do 3o andar fica em 9,45 m


def caminho(pts):
    out = [len(pts)]
    lx = lz = 0
    for x, z in pts:
        out += [int(round(x)) - lx, int(round(z)) - lz]
        lx, lz = int(round(x)), int(round(z))
    return out


# Enrolamento NEGATIVO: `plantaDaUnidade` le `shoelace(rec.r) > 0` como "contorno
# gerado" e inverte o anel antes de recortar a casca. No sentido errado a planta nasce
# maior que o predio.
anel = [(-LARG / 2 * Q,  PROF / 2 * Q), ( LARG / 2 * Q,  PROF / 2 * Q),
        ( LARG / 2 * Q, -PROF / 2 * Q), (-LARG / 2 * Q, -PROF / 2 * Q)]

nomes = ["Edifício da planta", "Rua da Planta", "Rua Lateral"]
city = {
    "q": Q,
    "b": [1, int(ALT * Q)] + caminho(anel),
    # Duas ruas so pra dar chao e escala -- sem via nenhuma o minimapa e a busca
    # abrem vazios e a etapa 1 vira um predio boiando no nada.
    "r": ([6, 1] + caminho([(-1200, 130), (1200, 130)]) +
          [6, 2] + caminho([(-150, -600), (-150, 600)])),
    "g": [], "bl": [0, 0, 200, 0, 1],
    "names": nomes, "bm": [0, 0, 0], "fa": [400],
}

cidade = {"slug": "planta", "nome": "Planta enviada", "uf": "SP",
          "centro": {"lat": -22.01725, "lon": -47.8908},
          "quantizacao": Q,
          "relevo_grade": {"n": ELEV_N, "half_m": 2000},
          "arborizacao": {}, "aparencia": {},
          "arquivo_base": "planta.city.json"}

area_util = round(sum(
    c.get("area") or abs(
        sum(c["poly"][i - 1][0] * c["poly"][i][1] - c["poly"][i][0] * c["poly"][i - 1][1]
            for i in range(len(c["poly"])))) / 2.0
    for c in COMODOS), 1)

unidade = {
    "id": UNIDADE_ID, "cidade": "planta", "andar": ANDAR,
    "ficha": {"empreendimento": "Edifício da planta",
              "titulo": "Apartamento da planta enviada",
              "bairro": "—", "municipio": "—",
              "area_util": area_util, "quartos": 2, "banheiros": 1},
    "predio_id": None,
    "ancora": {"lat": -22.01725, "lon": -47.8908, "confirmado": True},
    "planta": {"pe_direito": PD, "comodos": COMODOS,
               "portas": PORTAS, "janelas": JANELAS, "moveis": MOVEIS},
}

BLOCOS = [
    ("__cidade", json.dumps(cidade, ensure_ascii=False)),
    ("__unidades", json.dumps([unidade], ensure_ascii=False)),
    ("__luzue", "{}"), ("__moveis", "{}"), ("__textura", "{}"),
    ("__imoveis", "[]"), ("__grounddata", "[]"), ("__murosdata", "[]"),
    ("__streetdata", "[]"),
    ("__elevdata", json.dumps([0.0] * (ELEV_N * ELEV_N))),
    ("__portoes", "[]"), ("__vegetacao", "[]"),
    ("__citydata", json.dumps(city, separators=(",", ":"))),
    ("__arvores", '{"especies":{}}'), ("__poidata", "[]"),
    ("__urbanModels", "{}"),
]


def le(rel):
    return io.open(os.path.join(FONTE, rel.replace("/", os.sep)),
                   encoding="utf-8", newline="").read()


def main():
    titulo = "Imóvel 3D · v18 · maquete, visita e planta"
    cabeca = le("cabeca.html")
    if cabeca and cabeca[0] == u"﻿":
        cabeca = cabeca[1:]      # o BOM vira caractere invisivel quando hospedado
    cabeca = re.sub(r"<title>[^<]*</title>", "<title>%s</title>" % titulo, cabeca, count=1)

    partes = [cabeca]
    for ident, dado in BLOCOS:
        partes += ['<script type="application/json" id="%s">' % ident, dado, "</script>\n"]
    partes += ["<script>", le("lib/three.min.js"), "</script>\n",
               "<script>", le("lib/earcut.min.js"), "</script>\n",
               "<style>", le("estilo.css"), "</style>\n",
               le("corpo.html")]
    if ABRE:
        # O app le `location.search` na inicializacao do modulo. Quando a pagina e
        # hospedada num lugar que nao deixa acrescentar parametro na URL, este
        # `replaceState` -- ANTES do app.js -- e o que entrega o link direto mesmo
        # assim. Um `?imovel=` explicito na URL continua ganhando.
        partes += ["<script>try{if(!/[?&]imovel=/.test(location.search))"
                   "history.replaceState(null,'',location.pathname+"
                   "'?imovel=%s&etapa=%s'+location.hash)}catch(e){}</script>\n"
                   % (UNIDADE_ID, ABRE)]
    partes += ["<script>", le("terrain-fit.js"), "\n", le("road-clearance.js"), "\n",
               le("urban-models.js"), "\n", le("app.js"), "</script>", le("rabo.html")]
    s = "".join(partes)
    os.makedirs(os.path.dirname(os.path.abspath(SAIDA)), exist_ok=True)
    io.open(SAIDA, "w", encoding="utf-8", newline="").write(s)
    print("%.2f MB -> %s" % (len(s.encode("utf-8")) / 1e6, SAIDA))
    print("  planta %.1f x %.1f m · %d cômodos · %.1f m² úteis · pe-direito %.2f m"
          % (L - O, S - N, len(COMODOS), area_util, PD))
    print("  predio %.1f x %.1f x %.1f m · unidade no %dº andar (piso em %.2f m)"
          % (LARG, PROF, ALT, ANDAR, ANDAR * 3.15))
    print("  link direto: <url>?imovel=%s  (&etapa=mapa | interior | planta)" % UNIDADE_ID)
    return 0


if __name__ == "__main__":
    sys.exit(main())
