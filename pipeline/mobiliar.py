# -*- coding: utf-8 -*-
"""Mobilia a unidade LENDO A PLANTA, em vez de alguem posicionar movel a movel.

    python pipeline/mobiliar.py                 # todas as unidades cadastradas
    python pipeline/mobiliar.py <id>            # so uma
    python pipeline/mobiliar.py --listar        # so mostra o que faria

Escreve `plantas_fornecidas/<id>/moveis.auto.json`. **Nao toca no `unidade.json`.**
`montar.py` usa o arquivo automatico so quando `planta.moveis` esta vazio -- entao
mobilia posta a mao por uma pessoa sempre ganha, e apagar o `.auto.json` devolve o
apartamento vazio. Cadastro e de quem cadastra.

**Por que gerar em vez de modelar.** A cozinha de um render de arquitetura e quase
toda MARCENARIA RETILINEA: caixa, porta, puxador, tampo, frontao. Isso o catalogo de
caixas chanfradas ja sabe fazer, e cada peca custa UMA chamada de desenho. O que
faltava nao era geometria, era LAYOUT -- e layout se deduz da planta: a bancada vai
na parede livre mais longa da cozinha, o fogao no meio dela, a coifa em cima do
fogao, a cama na parede longa do quarto sem porta nem janela. Regra escrita uma vez
serve as quatro unidades de Sao Carlos e as proximas, sem artista no meio.

**As tres coisas que a regra precisa saber, e que a planta nao diz de graca:**

  1. QUAL LADO DA PAREDE E O COMODO. O poligono pode estar em qualquer sentido, entao
     a normal interna e achada por teste: anda 10 cm na normal e pergunta se ainda
     esta dentro.
  2. ONDE NAO PODE ENCOSTAR. Porta e janela sao projetadas na parede e viram intervalo
     bloqueado, com folga. Sem isso a cama nasce na frente da porta -- e o pior e que
     fica plausivel na planta e absurdo na visita.
  3. SE JA TEM ALGUEM ALI. Cada peca posta guarda a propria caixa; a proxima que
     encostar e recusada. E o que impede a geladeira de nascer dentro do balcao.

A FRENTE DE TODO MOVEL E O +Z do catalogo, e `rot` gira de 90 em 90 (0 = frente pro
+y da planta, 1 = +x, 2 = -y, 3 = -x). Errar isso encosta a porta do armario na
parede e mostra o fundo pro comodo -- e nao da erro nenhum.
"""
import io, json, math, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, "plantas_fornecidas")

FOLGA_VAO = 0.22      # quanto se afasta da borda de uma porta/janela
RECUO = 0.015         # folga entre o fundo do movel e a FACE da parede

# O SEGMENTO DE PAREDE CORRE NO EIXO DELA, e nao na face. O renderizador desenha cada
# parede como um prisma de ESP = 0,13 CENTRADO no segmento, entao a face interna esta
# 6,5 cm pra dentro do comodo. Sem somar isso, todo movel encostado nascia 5 cm DENTRO
# da parede: num armario de 60 cm ninguem ve, mas a cortina tem 12 cm de profundidade
# e ficava com MAIS DA METADE enterrada, e o rodape (que se projeta 1,2 cm) sumia
# atras de cada movel. Era a mesma causa dos dois defeitos.
MEIA_PAREDE = 0.065

# ---- folga de circulacao: DUAS familias, e nao uma ----------------------
#
# A ABNT NBR 15575-1, Anexo G, Tabela 6 da o MINIMO -- abaixo dele o comodo nao
# atende a norma de desempenho, e um layout que viole isso e defeito, nao aperto.
# A NKBA e a tradicao ergonomica (Panero-Zelnik, 1979) dao o CONFORTAVEL -- acima
# dele a peca nao so cabe, ela funciona. Os dois conjuntos diferem por quase o
# dobro (0,85 m frontal ao fogao na norma, 1,07 m de corredor de trabalho na NKBA)
# e a tentacao de escolher UM dos dois e o erro:
#
#   - so o minimo: o gerador aceita tudo que nao colide e nunca sabe dizer que o
#     apartamento e apertado -- que num anuncio e INFORMACAO, nao defeito;
#   - so o confortavel: recusa layout que existe de verdade no estoque brasileiro.
#
# Yu et al. (SIGGRAPH 2011) dizem isso com todas as letras: diretriz de conforto,
# em termos de otimizacao, e "soft constraint". Entao MIN e portao e OK e alvo.
#
# A chave (nao o numero) e que viaja com a peca: quem posta sabe se aquela `pia` e
# bancada de cozinha ou gabinete de banheiro, e o aferidor nao teria como deduzir.
MIN = {                      # ABNT NBR 15575-1, Anexo G, Tabela 6
    "parede":  0.50,         # entre mobiliario e/ou paredes, dormitorio
    "camas":   0.60,         # entre duas camas de solteiro
    "cozinha": 0.85,         # frontal a pia, fogao e geladeira
    "assento": 0.50,         # frente do sofa e da poltrona
    "mesa":    0.75,         # a partir da borda da mesa de jantar
    "louca":   0.40,         # frontal ao lavatorio, vaso e bide
    "tanque":  0.50,         # frontal ao tanque e a maquina de lavar
}
OK = {                       # NKBA / Panero-Zelnik: onde o comodo fica bom
    "parede":  0.76,         # lado principal da cama
    "camas":   0.76,
    "cozinha": 1.07,         # corredor de trabalho, um cozinheiro (42")
    "assento": 0.90,
    "mesa":    0.90,
    "louca":   0.76,
    "tanque":  0.76,
}
# Largura minima do ambiente amarrada ao mobiliario, da mesma tabela. Nao e checada
# na hora de postar (o comodo ja existe, a planta e o que e) -- e relatada.
MIN_LARG = {"sala": 2.40, "cozinha": 1.50, "banho": 1.10}


# ---- geometria de poligono ----------------------------------------------
def area2(poly):
    s = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        s += a[0] * b[1] - b[0] * a[1]
    return s / 2.0


def dentro(poly, x, y):
    hit = False
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        if (a[1] > y) != (b[1] > y):
            xx = a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if x < xx:
                hit = not hit
    return hit


def paredes(poly):
    """Cada aresta com direcao, comprimento e NORMAL INTERNA (achada por teste)."""
    out = []
    n = len(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 0.35:
            continue
        ux, uy = dx / L, dy / L
        nx, ny = -uy, ux
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if not dentro(poly, mx + nx * 0.10, my + ny * 0.10):
            nx, ny = -nx, -ny
        out.append({"a": a, "u": (ux, uy), "n": (nx, ny), "L": L})
    out.sort(key=lambda w: -w["L"])
    return out


def rot_de(n):
    """A normal interna vira o `rot` do catalogo: 0=+y, 1=+x, 2=-y, 3=-x."""
    nx, ny = n
    if abs(ny) >= abs(nx):
        return 0 if ny > 0 else 2
    return 1 if nx > 0 else 3


def projeta(w, p):
    """Distancia do ponto a reta da parede e onde ele cai ao longo dela."""
    ax, ay = w["a"]
    ux, uy = w["u"]
    dx, dy = p[0] - ax, p[1] - ay
    t = dx * ux + dy * uy
    d = abs(dx * (-uy) + dy * ux)
    return t, d


def livres(w, aberturas):
    """Trechos da parede onde da pra encostar: o comprimento menos os vaos."""
    blocos = []
    for ab in aberturas:
        t, d = projeta(w, ab["p"])
        if d > 0.30:
            continue
        meia = ab.get("largura", 0.9) / 2.0 + FOLGA_VAO
        blocos.append((t - meia, t + meia))
    blocos.sort()
    saida, t0 = [], 0.0
    for b0, b1 in blocos:
        if b0 - t0 > 0.30:
            saida.append((t0, min(b0, w["L"])))
        t0 = max(t0, b1)
    if w["L"] - t0 > 0.30:
        saida.append((t0, w["L"]))
    return [(a, b) for a, b in saida if b > a]


# ---- o aferidor de folga ------------------------------------------------
# `rot` do catalogo: 0 = frente pro +y, 1 = +x, 2 = -y, 3 = -x.
DIR = ((0.0, 1.0), (1.0, 0.0), (0.0, -1.0), (-1.0, 0.0))


def folga_frente(poly, postos, m, limite=1.60):
    """Espaco livre na FRENTE da peca, ate a parede ou o proximo movel.

    A profundidade da peca ao longo do rumo da frente e sempre `d/2`, em qualquer
    `rot` -- `cabe()` troca a extensao em X e Y, mas nunca troca qual eixo e a
    profundidade. Tres sondas em vez de uma: uma sonda no eixo passa entre duas
    pecas vizinhas e devolve folga que ninguem tem.

    As sondas laterais medem a FAIXA CENTRAL (25 cm de cada lado), nao as quinas.
    Medir na quina foi o defeito da primeira versao, e ele fabricava o proprio
    achado: num banheiro de 1,62 m o vaso encosta na ponta da bancada e bloqueia
    17 cm dos 90 dela, entao a quina media 0,05 m e o aferidor reprovava um
    banheiro correto -- enquanto o meio da bancada, que e onde a pessoa fica,
    tinha 1,06 m livre. A norma pede circulacao FRONTAL ao lavatorio, e frontal e
    onde se para de frente pra ele, nao o retangulo varrido pela peca inteira.

    O poligono do comodo corre no EIXO da parede, e a face dela esta MEIA_PAREDE
    pra dentro -- sem descontar isso toda medida contra parede sai 6,5 cm generosa,
    e e justamente na casa do centimetro que 0,85 vira 0,79."""
    r = m["rot"] & 3
    fx, fy = DIR[r]
    lx, ly = -fy, fx
    px = m["p"][0] + fx * m["d"] / 2.0
    py = m["p"][1] + fy * m["d"] / 2.0
    lado = min(0.25, max(0.0, m["w"] / 2.0 - 0.06))
    passo, s = 0.05, 0.0
    while s < limite:
        s += passo
        for o in (-lado, 0.0, lado):
            x, y = px + fx * s + lx * o, py + fy * s + ly * o
            if not dentro(poly, x, y):
                return max(0.0, s - passo - MEIA_PAREDE)
            for (a0, b0, a1, b1) in postos:
                if a0 < x < a1 and b0 < y < b1:
                    return max(0.0, s - passo)
    return limite


def confere(c):
    """O que o comodo tem de errado e o que ele tem de apertado.

    Duas listas separadas de proposito. `erro` e violacao de norma -- e um numero
    que da pra defender. `aperto` e o que fica abaixo do confortavel: nao impede
    nada, mas e o que faz a visita parecer estreita sem que ninguem saiba dizer
    por que. Nenhum dos dois recusa o layout: quem decide se um apartamento de
    verdade cabe no gerador e a planta, nao esta tabela."""
    erro, aperto = [], []
    larg = MIN_LARG.get(c.tipo)
    if larg and c.paredes:
        # largura do comodo = o menor vao entre duas paredes opostas, aproximado
        # pela razao entre area e a maior parede. Aproximacao grosseira de
        # proposito: comodo em L nao tem "largura", e forcar um numero mentiria.
        est = c.area / c.paredes[0]["L"]
        if est < larg - 0.05:
            erro.append("%s: largura ~%.2f m, norma pede %.2f" % (c.nome, est, larg))
    for m in c.moveis:
        k = m.get("_folga")
        if not k or m.get("_aereo"):
            continue
        f = folga_frente(c.poly, c.postos, m)
        if f < MIN[k] - 0.02:
            erro.append("%s/%s: folga %.2f m, norma pede %.2f"
                        % (c.nome, m["tipo"], f, MIN[k]))
        elif f < OK[k] - 0.02:
            aperto.append("%s/%s: folga %.2f m, confortavel e %.2f"
                          % (c.nome, m["tipo"], f, OK[k]))
    return erro, aperto


# ---- o comodo em construcao ---------------------------------------------
class Comodo(object):
    def __init__(self, c, aberturas, pd=2.70):
        self.pd = pd
        self.nome = c["nome"]
        self.tipo = tipo_de(c["nome"])
        self.poly = c["poly"]
        self.area = c.get("area") or abs(area2(c["poly"]))
        self.paredes = paredes(c["poly"])
        # so as aberturas que tocam este comodo
        self.aberturas = [a for a in aberturas
                          if min(min(projeta(w, a["p"])[1] for w in self.paredes)
                                 for _ in [0]) < 0.30] if self.paredes else []
        self.postos = []      # caixas ja ocupadas: (x0,y0,x1,y1)
        self.reservas = []    # a FAIXA DE CIRCULACAO na frente de cada peca
        self.frouxo = False   # segunda volta: aceita invadir a faixa alheia
        self.moveis = []

    def faixa(self, cx, cy, w, d, rot, prof):
        """AABB da circulacao reservada na frente da peca.

        Na FAIXA CENTRAL, que e a mesma que `folga_frente` mede -- reservar a
        largura inteira barraria o vaso ao lado da bancada, que e exatamente onde
        ele fica em banheiro de apartamento. Como `rot` e sempre alinhado ao eixo,
        o retangulo girado ja E a caixa envolvente."""
        fx, fy = DIR[rot & 3]
        lx, ly = -fy, fx
        px, py = cx + fx * d / 2.0, cy + fy * d / 2.0
        lado = min(0.25, max(0.05, w / 2.0 - 0.06))
        xs, ys = [], []
        for s in (0.0, prof):
            for o in (-lado, lado):
                xs.append(px + fx * s + lx * o)
                ys.append(py + fy * s + ly * o)
        return (min(xs), min(ys), max(xs), max(ys))

    def cabe(self, cx, cy, w, d, rot, h=1.0):
        """Caixa AABB do movel, ja girada, dentro do comodo e sem colidir."""
        ww, dd = (w, d) if rot % 2 == 0 else (d, w)
        x0, x1 = cx - ww / 2, cx + ww / 2
        y0, y1 = cy - dd / 2, cy + dd / 2
        # os quatro cantos, encolhidos, tem que estar dentro
        e = 0.04
        for px, py in ((x0+e, y0+e), (x1-e, y0+e), (x1-e, y1-e), (x0+e, y1-e)):
            if not dentro(self.poly, px, py):
                return None
        for (a0, b0, a1, b1) in self.postos:
            if x0 < a1 - 0.03 and a0 < x1 - 0.03 and y0 < b1 - 0.03 and b0 < y1 - 0.03:
                return None
        # A CIRCULACAO DE QUEM JA ESTA POSTO tambem e lugar ocupado. Sem isto,
        # `cabe()` so olhava sobreposicao de volume -- e volume que nao se toca
        # passava, entao a geladeira nascia de frente pra bancada, o box na frente
        # do lavatorio e o guarda-roupa a 18 cm do pe da cama. Os tres eram O MESMO
        # defeito, e nao tres: e o termo de acessibilidade que faltava.
        #
        # So barra quem tem ALTURA pra atrapalhar: tapete na frente do sofa e
        # tapete, nao obstaculo, e o renderizador usa o mesmo corte de 0,35 m.
        if h >= 0.35 and not self.frouxo:
            for (a0, b0, a1, b1) in self.reservas:
                if (x0 < a1 - 0.03 and a0 < x1 - 0.03
                        and y0 < b1 - 0.03 and b0 < y1 - 0.03):
                    return None
        # Nao pode tapar PORTA. E porta com folha, nao vao.
        #
        # A primeira versao barrava qualquer abertura com uma caixa inflada de 55 cm,
        # e isso recusou a bancada inteira da cozinha da sanca-135: entre a cozinha e
        # a circulacao ha um VAO de 2,05 m, e o ponto dele fica a 45 cm da ponta do
        # balcao -- que e onde balcao fica mesmo, na vida. Vao e passagem aberta: a
        # parede do lado dele e util. Porta com folha e que precisa de espaco livre
        # pra abrir, e a folga se mede do BURACO, nao do centro dele.
        for ab in self.aberturas:
            if ab.get("janela") or ab.get("vao"):
                continue
            px, py = ab["p"]
            r = ab.get("largura", 0.85) / 2.0 + 0.25
            qx = min(max(px, x0), x1)
            qy = min(max(py, y0), y1)
            if (qx-px)**2 + (qy-py)**2 < r*r:
                return None
        return (x0, y0, x1, y1)

    def poe(self, tipo, w, h, d, cx, cy, rot, cor=None, aereo=False, folga=None):
        """`folga` e a CHAVE de MIN/OK, nao o numero.

        Quem posta sabe o que esta postando: a mesma `pia` e bancada de cozinha
        (0,85 m frontal) num comodo e gabinete de banheiro (0,40 m) no outro. Uma
        tabela tipo->folga teria que adivinhar isso pelo nome do comodo e erraria
        na lavanderia, que tambem tem pia. As chaves `_folga` e `_aereo` saem do
        dicionario em `mobilia()`, antes de virar JSON."""
        cx, cy = round(cx, 3), round(cy, 3)
        if not aereo:
            cx4 = self.cabe(cx, cy, w, d, rot, h)
            if cx4 is None:
                return False
            self.postos.append(cx4)
            if folga:
                self.reservas.append(self.faixa(cx, cy, w, d, rot, MIN[folga]))
        m = {"tipo": tipo, "p": [cx, cy], "rot": rot,
             "w": round(w, 3), "h": round(h, 3), "d": round(d, 3)}
        if cor:
            m["cor"] = cor
        if folga:
            m["_folga"] = folga
        if aereo:
            m["_aereo"] = 1
        self.moveis.append(m)
        return True

    def encosta(self, tipo, w, h, d, wall, t, cor=None, aereo=False, recuo=RECUO,
                folga=None):
        """Poe a peca com o FUNDO na parede, centrada em `t` ao longo dela."""
        ax, ay = wall["a"]
        ux, uy = wall["u"]
        nx, ny = wall["n"]
        cx = ax + ux * t + nx * (d / 2 + recuo + MEIA_PAREDE)
        cy = ay + uy * t + ny * (d / 2 + recuo + MEIA_PAREDE)
        return self.poe(tipo, w, h, d, cx, cy, rot_de(wall["n"]), cor, aereo, folga)


# ---- as regras, por tipo de comodo --------------------------------------
import re

TIPO = [
    (re.compile(r"^(sala|estar|jantar|living)", re.I), "sala"),
    (re.compile(r"^(cozinha|coz\b)", re.I), "cozinha"),
    (re.compile(r"^(quarto|dorm|su[íi]te)", re.I), "quarto"),
    (re.compile(r"^(banh|wc|lavabo|sanit)", re.I), "banho"),
    (re.compile(r"^([áa]rea|servi|lavand)", re.I), "servico"),
    (re.compile(r"^(varanda|sacada|terra[çc]o)", re.I), "varanda"),
    (re.compile(r"^(circula|corredor|hall|entrada|acesso)", re.I), "nada"),
]

# A marcenaria e o TAMPO sao a ancora escura da paleta -- os dois unicos elementos
# de um apartamento vazio que legitimamente vivem abaixo de 60 de valor. O verde saiu
# de 0x7C8466 pra 0x5A6249 pelo mesmo motivo do aluminio: em tom medio ele sumia na
# parede clara, e a cozinha inteira lia como um bloco so.
VERDE = "#5A6249"      # marcenaria da cozinha (o anuncio diz verde-oliva)
BRANCO = "#E4DFD5"
MADEIRA = "#8A6A45"    # painel ripado da sala


def tipo_de(nome):
    for rx, t in TIPO:
        if rx.match(nome or ""):
            return t
    return "outro"


def encosta_onde_couber(c, tipo, w, h, d, cor=None, folga=None, passo=0.15,
                        paredes=None, insistir=False):
    """Anda pela parede ate a peca caber, em vez de tentar so o meio do trecho.

    `livres()` desconta VAO, nao movel ja posto. Entao o meio do maior trecho
    livre e exatamente onde a primeira peca daquela parede ja esta, e `maior_livre`
    so sabe devolver esse meio -- a segunda peca da parede nunca tinha chance.

    Era isso que barrava o box num banheiro de 2,33 x 1,51 onde ele cabe folgado:
    0,90 de bancada mais 0,80 de box sao 1,70 numa parede de 2,33. A unica posicao
    testada era a ocupada, `cabe()` recusava, e o banheiro saia sem box sem que
    nada acusasse -- porque nao ha erro nenhum em nao postar um movel."""
    for tentativa in (0, 1):
        # SEGUNDA VOLTA SEM AS RESERVAS. Respeitar a circulacao alheia e o certo, mas
        # so ate o ponto em que a peca deixa de existir: cozinha sem geladeira e
        # banheiro sem box sao pior defeito que geladeira apertada, e a norma lista
        # as duas como mobiliario MINIMO. Entao a peca entra e o aferidor denuncia --
        # que e a diferenca entre um portao que informa e um que apaga o problema
        # deixando o comodo vazio.
        if tentativa and not insistir:
            break
        c.frouxo = bool(tentativa)
        try:
            for wall in (c.paredes if paredes is None else paredes):
                for a, b in livres(wall, c.aberturas):
                    if b - a < w:
                        continue
                    t = a + w / 2.0
                    while t <= b - w / 2.0 + 1e-6:
                        if c.encosta(tipo, w, h, d, wall, t, cor, folga=folga):
                            return True
                        t += passo
        finally:
            c.frouxo = False
    return False


def cabe_de_frente(c, wa, da, wb, db, folga):
    """As duas pecas cabem uma DE FRENTE pra outra nessas duas paredes?

    Era o furo que produzia os tres defeitos que o aferidor achou, e os tres tem a
    mesma forma: escolher a segunda parede so pelo tamanho do trecho livre, sem
    perguntar se o comodo tem PROFUNDIDADE pras duas pecas. Numa cozinha de 1,75 m
    a geladeira nascia de frente pra bancada e sobravam 0,47 m de passagem onde a
    norma pede 0,85; num banheiro de 1,38 m o vaso ia pra parede oposta a pia; e o
    guarda-roupa parava a 18 cm do pe da cama, com as portas sem abrir.

    Paredes que nao se enfrentam nao tem problema nenhum -- a resposta e sim, e e
    por isso que a checagem nao aperta layout em L, que e a maioria."""
    na, nb = wa["n"], wb["n"]
    if na[0] * nb[0] + na[1] * nb[1] > -0.7:
        return True
    dx = wb["a"][0] - wa["a"][0]
    dy = wb["a"][1] - wa["a"][1]
    vao = abs(dx * na[0] + dy * na[1]) - 2 * MEIA_PAREDE   # entre as FACES
    return vao - da - db >= folga


def maior_livre(c, minimo, usadas=(), filtro=None):
    """A parede com o maior trecho livre, e onde e o meio desse trecho."""
    melhor = None
    for i, w in enumerate(c.paredes):
        if i in usadas:
            continue
        if filtro and not filtro(w):
            continue
        for a, b in livres(w, c.aberturas):
            if b - a < minimo:
                continue
            if melhor is None or (b - a) > melhor[3]:
                melhor = (i, w, (a + b) / 2, b - a, a, b)
    return melhor


def mobilia_cozinha(c):
    """Bancada corrida na parede mais longa livre; fogao no meio; coifa em cima;
       aereos onde nao ha coifa; geladeira em outra parede."""
    alvo = maior_livre(c, 1.10)
    if not alvo:
        return
    i, w, _, _, a, b = alvo
    corr = b - a
    # a sequencia: pia (1,30) + fogao (0,62) + balcao no que sobrar
    pecas = []
    resto = corr
    if resto >= 1.20:
        pecas.append(("pia", min(1.30, resto))); resto -= pecas[-1][1]
    if resto >= 0.62:
        pecas.append(("fogao", 0.62)); resto -= 0.62
    while resto >= 0.60:
        L = min(1.00, resto)
        pecas.append(("balcao", L)); resto -= L
    t = a + (corr - sum(p[1] for p in pecas)) / 2.0
    for tipo, L in pecas:
        meio = t + L / 2
        prof = 0.60 if tipo != "fogao" else 0.62
        c.encosta(tipo, L, 0.92, prof, w, meio, VERDE if tipo != "fogao" else None,
                  folga="cozinha")
        if tipo == "fogao":
            # A chamine vai ate o TETO, e teto varia por unidade: com 2,70 fixo ela
            # ATRAVESSA a laje num apartamento de pe-direito 2,60 (o `sanca-135-29`).
            # O defeito nao aparece na vista de planta, so andando por baixo dela.
            c.encosta("coifa", 0.60, c.pd, 0.50, w, meio, aereo=True)
        elif L >= 0.70:
            c.encosta("aereo", L, 2.20, 0.35, w, meio, VERDE, aereo=True)
        t += L
    # GELADEIRA. Outra parede, no canto -- mas so numa parede onde ela nao fique de
    # frente pra bancada sem os 0,85 m da norma entre as duas. Numa cozinha corredor
    # de 1,75 m nenhuma parede oposta serve: 0,60 de bancada + 0,68 de geladeira
    # deixam 0,47 de passagem. Ali a geladeira vai no FIM da bancada, que e onde ela
    # esta em qualquer cozinha estreita de verdade.
    cabe = lambda w2: cabe_de_frente(c, w, 0.60, w2, 0.68, MIN["cozinha"])
    outras = [w2 for j, w2 in enumerate(c.paredes) if j != i and cabe(w2)]
    if not encosta_onde_couber(c, "geladeira", 0.68, 1.78, 0.68, paredes=outras,
                               folga="cozinha"):
        # Nenhuma parede tem os 0,85 da norma. Numa cozinha corredor de 1,75 m
        # nenhuma TEM COMO ter, e a geladeira vai pra parede oposta assim mesmo --
        # e onde ela esta em todo apartamento desse tamanho, e o aferidor acusa.
        # A parede da bancada fica por ultimo: ali quase nunca sobra vao.
        todas = [w2 for j, w2 in enumerate(c.paredes) if j != i] + [w]
        encosta_onde_couber(c, "geladeira", 0.68, 1.78, 0.68, paredes=todas,
                            folga="cozinha", insistir=True)


SOLTEIRO = 0.90    # cama de solteiro: colchao de 0,80 (NBR 13579) + estrutura


def mobilia_quarto(c):
    """TRES tipologias, como na norma -- nao uma.

    O Anexo G da NBR 15575-1 distingue dormitorio de casal (cama 1,40 x 1,90 +
    guarda-roupa + criado-mudo), de duas pessoas (DUAS camas de solteiro com 0,60 m
    entre elas) e de uma pessoa. A versao anterior tinha um caminho so e escolhia a
    largura da cama pelo tamanho da parede -- entao um apartamento de dois
    dormitorios saia com DUAS CAMAS DE CASAL. E o tipo de defeito que ninguem
    reporta, porque na visita parece decisao de quem cadastrou.

    Casal quando a parede comporta a cama de 1,45 E o comodo tem area de quarto de
    casal; nao havendo, tenta o par de solteiros com o afastamento da norma entre
    eles; nao cabendo o par, e cama unica e o que sobra de parede vira mesa de
    estudo, que a norma lista como movel opcional do 2o e do 3o dormitorio.

    O criado subiu de 0,45 x 0,40 para os 0,50 x 0,50 da norma."""
    alvo = maior_livre(c, 1.55)
    if not alvo:
        return
    i, w, meio, larg, a, b = alvo
    casal = larg >= 1.75 and c.area >= 9.0
    duplo = False
    if casal:
        c.encosta("cama", 1.45, 1.05, 2.05, w, meio, folga="parede")
        for lado in (-1, 1):
            t = meio + lado * (1.45 / 2 + 0.28)
            if a + 0.25 < t < b - 0.25:
                c.encosta("criado", 0.50, 0.55, 0.50, w, t)
    else:
        duplo = larg >= 2 * SOLTEIRO + MIN["camas"]
        meia = (SOLTEIRO + MIN["camas"]) / 2.0
        ts = (meio - meia, meio + meia) if duplo else (meio,)
        for t in ts:
            # `camas` (0,60) e o afastamento LATERAL entre duas camas, e ele ja esta
            # garantido por construcao no `meia` acima. O que `folga_frente` mede e o
            # PE da cama, e ali vale o 0,50 de mobiliario-contra-parede.
            c.encosta("cama", SOLTEIRO, 1.05, 2.05, w, t, folga="parede")
        if not duplo:
            t = meio + SOLTEIRO / 2 + 0.28
            if a + 0.25 < t < b - 0.25:
                c.encosta("criado", 0.50, 0.55, 0.50, w, t)
    # GUARDA-ROUPA. A cama ocupa 2,05 m de fundo a partir da parede dela; um armario
    # de 0,60 na parede oposta so cabe se sobrarem os 0,50 m da norma entre o PE da
    # cama e a porta do armario. Sem isso ele nascia a 18 cm da cama -- as portas nao
    # abriam, e nada acusava, porque em planta os dois volumes nao se tocam.
    cabe = lambda w2: cabe_de_frente(c, w, 2.05, w2, 0.60, MIN["parede"])
    g = maior_livre(c, 1.10, usadas=(i,), filtro=cabe)
    usadas = (i,)
    if g:
        j, gw, gmeio, glarg, _, _ = g
        usadas = (i, j)
        # A norma pede 1,60 (casal) / 1,50 (duplo) / 1,20 (solteiro) de largura e
        # 0,50 de PROFUNDIDADE. A marcenaria planejada brasileira trabalha com
        # 0,55-0,60, e e o que se ve nas fotos: fica o valor de mercado, de
        # proposito, e nao por descuido.
        c.encosta("guardaroupa", min(2.00, glarg - 0.10), 2.35, 0.60, gw, gmeio, BRANCO,
                  folga="parede")
    else:
        # Nenhuma parede com fundo pro armario. Ele entra assim mesmo e o aferidor
        # acusa: guarda-roupa e mobiliario MINIMO de dormitorio na norma, e quarto
        # sem armario nao le como quarto sobrio, le como quarto incompleto.
        encosta_onde_couber(c, "guardaroupa", 1.20, 2.35, 0.60, BRANCO,
                            folga="parede", insistir=True)
    # Mesa de estudo: movel opcional dos dormitorios que nao sao de casal.
    if not casal:
        e = maior_livre(c, 0.95, usadas=usadas)
        if e:
            _, ew, emeio, _, _, _ = e
            if c.encosta("mesa", 0.80, 0.74, 0.60, ew, emeio, "#8A7660"):
                # A cadeira olha pra MESA, logo pra PAREDE. `encosta` poe todo movel
                # de frente pro comodo, e cadeira de estudo de costas pra
                # escrivaninha e defeito que nao levanta erro nenhum.
                ax, ay = ew["a"]
                ux, uy = ew["u"]
                nx, ny = ew["n"]
                fora = 0.60 + 0.30 + MEIA_PAREDE
                c.poe("cadeira", 0.46, 0.92, 0.48,
                      ax + ux * emeio + nx * fora, ay + uy * emeio + ny * fora,
                      (rot_de(ew["n"]) + 2) & 3)
    cortinas(c)


def mobilia_sala(c):
    alvo = maior_livre(c, 2.05)
    if not alvo:
        alvo = maior_livre(c, 1.45)
    if not alvo:
        return
    i, w, meio, larg, _, _ = alvo
    sofa_w = min(1.95, larg - 0.20)
    c.encosta("sofa", sofa_w, 0.80, 0.92, w, meio, folga="assento")
    # TV na parede de frente: a que tem normal mais oposta a do sofa
    n = w["n"]
    frente = None
    for j, w2 in enumerate(c.paredes):
        if j == i:
            continue
        if w2["n"][0] * n[0] + w2["n"][1] * n[1] > -0.7:
            continue
        for a2, b2 in livres(w2, c.aberturas):
            if b2 - a2 >= 1.25 and (frente is None or b2 - a2 > frente[2]):
                frente = (w2, (a2 + b2) / 2, b2 - a2)
    # A TV so entra se houver DISTANCIA de sala pra ela: numa parede a 1,8 m do
    # sofa ela nao e televisao, e um painel preto encostado na cara de quem entra --
    # e foi assim que ela apareceu atravessada no corredor no primeiro teste.
    if frente:
        n2 = frente[0]["n"]
        dist = abs((frente[0]["a"][0] - w["a"][0]) * n2[0] +
                   (frente[0]["a"][1] - w["a"][1]) * n2[1])
        if dist >= 2.30:
            # A parede da TV sao TRES pecas, e nenhuma sala de referencia tem menos:
            # painel ripado colado na parede, rack suspenso embaixo e a TV PENDURADA.
            # TV em pedestal no meio do chao nao aparece em foto de apartamento desde
            # que existe suporte de parede. As tres sao `aereo=True` porque dividem o
            # mesmo lugar: sem isso cada uma acusa colisao com as outras duas.
            # O ripado cola na face da parede (recuo 0); o rack e a TV ficam
            # 5 cm a frente dele, que e a espessura do painel.
            larg = frente[2]
            c.encosta("ripado", min(2.60, larg - 0.10), min(2.40, c.pd - 0.20), 0.05,
                      frente[0], frente[1], MADEIRA, aereo=True, recuo=0.0)
            c.encosta("rack", min(1.90, larg - 0.30), 0.70, 0.38,
                      frente[0], frente[1], aereo=True, recuo=0.05)
            c.encosta("tv", min(1.35, larg - 0.60), 1.62, 0.14,
                      frente[0], frente[1], aereo=True, recuo=0.05)
    # POLTRONA. Esta na lista de mobiliario de estar da norma (0,80 x 0,70 com braco)
    # e faltava. Vai numa parede PERPENDICULAR a do sofa, que e onde ela esta em toda
    # foto de sala -- na mesma parede ela vira sofa de quatro lugares.
    #
    # Reusa o tipo `sofa`: `sofaParam` monta por MODULO, e com um modulo so ele ja e
    # uma poltrona. Nao vale menos que ~1,00 porque o param embute os dois bracos e
    # trava a largura em `2*braco + 0,62` -- pedir 0,80 nao daria uma poltrona
    # menor, daria a mesma peca com a medida do cadastro mentindo.
    if c.area >= 12.0:
        perp = [w2 for j, w2 in enumerate(c.paredes)
                if j != i and abs(w2["n"][0] * n[0] + w2["n"][1] * n[1]) < 0.6]
        encosta_onde_couber(c, "sofa", 1.00, 0.80, 0.92, paredes=perp,
                            folga="assento")
    if c.area >= 8.5:
        cx = sum(p[0] for p in c.poly) / len(c.poly)
        cy = sum(p[1] for p in c.poly) / len(c.poly)
        c.poe("tapete", 1.90, 0.02, 1.35, cx, cy, 0)
    cortinas(c)


def mobilia_banho(c):
    """Lavatorio, vaso e BOX -- os tres itens minimos da norma.

    O box faltava. A NBR 15575-1 lista lavatorio, vaso e box como o minimo do
    banheiro, e um banheiro renderizado sem box le como inacabado -- e essa e a
    falta que o comprador ve primeiro, porque e a peca que ocupa o canto."""
    alvo = maior_livre(c, 0.70)
    if not alvo:
        return
    i, w, meio, larg, a, b = alvo
    c.encosta("pia", min(0.90, larg - 0.10), 0.92, 0.48, w, meio, BRANCO,
              folga="louca")
    usadas = (i,)
    # O vaso so vai pra parede oposta a bancada se o banheiro tiver fundo pras duas:
    # 0,48 + 0,66 + 0,40 pedem 1,54 m, e banheiro de apartamento tem 1,38. Nao tendo,
    # ele vai pra outra parede qualquer -- ou pra MESMA da bancada, ao lado dela.
    cabe = lambda w2: cabe_de_frente(c, w, 0.48, w2, 0.66, MIN["louca"])
    outras = [w2 for j, w2 in enumerate(c.paredes) if j != i and cabe(w2)]
    encosta_onde_couber(c, "vaso", 0.40, 0.80, 0.66,
                        paredes=outras or c.paredes, folga="louca", insistir=True)
    # Box quadrado 0,80 x 0,80; onde nao cabe, o retangular 0,70 x 0,90 da norma,
    # que e o mesmo box virado de lado. Anda pelas paredes: box de apartamento fica
    # no canto AO LADO da bancada, e o canto nunca e o meio do trecho livre.
    for bw, bd in ((0.80, 0.80), (0.70, 0.90), (0.90, 0.70)):
        if encosta_onde_couber(c, "box", bw, 2.00, bd, insistir=True):
            break


def mobilia_servico(c):
    """Tanque E maquina de lavar -- a norma pede os dois.

    Havia uma "pia" de 1,00 x 0,55 no lugar das duas pecas, com a medida de
    nenhuma delas. O tanque da norma e 0,52 x 0,53 e reusa o tipo `pia`, que ja e
    gabinete com cuba nessa profundidade; a maquina tem tipo proprio."""
    alvo = maior_livre(c, 0.60)
    if not alvo:
        return
    i, w, meio, larg, a, b = alvo
    par = larg >= 0.52 + 0.60 + 0.10
    if par:
        c.encosta("pia", 0.52, 0.92, 0.53, w, meio - 0.35, BRANCO, folga="tanque")
        c.encosta("maquina", 0.60, 0.85, 0.65, w, meio + 0.32, folga="tanque")
        return
    c.encosta("pia", min(0.60, larg - 0.06), 0.92, 0.53, w, meio, BRANCO,
              folga="tanque")
    g = maior_livre(c, 0.65, usadas=(i,))
    if g:
        _, gw, gmeio, _, _, _ = g
        c.encosta("maquina", 0.60, 0.85, 0.65, gw, gmeio, folga="tanque")


def mobilia_varanda(c):
    if c.area < 2.2:
        return
    cx = sum(p[0] for p in c.poly) / len(c.poly)
    cy = sum(p[1] for p in c.poly) / len(c.poly)
    if c.poe("mesa", 0.80, 0.74, 0.80, cx, cy, 0, "#8A7660", folga="mesa"):
        for dx, dy, rot in ((0, -0.66, 0), (0, 0.66, 2)):
            c.poe("cadeira", 0.46, 0.92, 0.48, cx + dx, cy + dy, rot)


def cortinas(c):
    """Cortina so onde ha JANELA.

    A primeira versao aceitava qualquer abertura com mais de 1,1 m, e pendurou dois
    paineis de 2,3 m no vao entre a cozinha e a sala -- ou seja, uma cortina no meio
    do apartamento, tapando justamente a vista que o enquadramento existe pra
    mostrar. Vao interno nao tem cortina; janela tem."""
    for w in c.paredes:
        for ab in c.aberturas:
            if not ab.get("janela"):
                continue
            t, d = projeta(w, ab["p"])
            if d > 0.30 or not (0 < t < w["L"]):
                continue
            larg = ab.get("largura", 0)
            if larg < 1.10:
                continue
            c.encosta("cortina", min(larg + 0.35, w["L"] - 0.05), 2.40, 0.12,
                      w, t, recuo=0.02, aereo=True)


REGRAS = {"cozinha": mobilia_cozinha, "quarto": mobilia_quarto, "sala": mobilia_sala,
          "banho": mobilia_banho, "servico": mobilia_servico, "varanda": mobilia_varanda}


# ---- por unidade ---------------------------------------------------------
def mobilia(u):
    P = u["planta"]
    aberturas = []
    for p in (P.get("portas") or []):
        aberturas.append({"p": p["p"], "largura": p.get("largura", 0.85),
                          "vao": p.get("tipo") == "vao"})
    for j in (P.get("janelas") or []):
        aberturas.append({"p": j["p"], "largura": j.get("largura", 1.40), "janela": True})
    saida, relato, erros, apertos = [], [], [], []
    for c0 in P["comodos"]:
        t = tipo_de(c0["nome"])
        c = Comodo(c0, aberturas, P.get("pe_direito") or 2.70)
        fn = REGRAS.get(t)
        if fn:
            fn(c)
        if c.moveis:
            e, ap = confere(c)
            erros.extend(e)
            apertos.extend(ap)
        for m in c.moveis:
            m.pop("_folga", None)      # metadado do aferidor, nao geometria: o
            m.pop("_aereo", None)      # renderizador nunca ve estas duas chaves
        saida.extend(c.moveis)
        relato.append((c0["nome"], t, len(c.moveis)))
    return saida, relato, erros, apertos


def demo():
    """Conferidor minimo: `python pipeline/mobiliar.py --demo`.

    Mede as duas contas que erram CALADAS. A tabela `DIR` e um sinal trocado longe
    de qualquer excecao: invertido, `folga_frente` mede o espaco atras da peca e
    aprova uma cozinha impossivel. E o desconto de MEIA_PAREDE e a diferenca entre
    medir ate o EIXO da parede e ate a FACE dela -- 6,5 cm, que e exatamente a casa
    em que 0,85 vira 0,79 e o portao passa a mentir a favor."""
    L = 3.2
    quad = [(0, 0), (L, 0), (L, L), (0, L)]
    base = {"nome": "cozinha", "poly": quad, "area": L * L}

    # 1. a MESMA peca nas quatro paredes tem que medir a mesma folga
    vals = []
    for k in range(4):
        c = Comodo(dict(base), [])
        w = c.paredes[k]
        assert c.encosta("pia", 1.00, 0.92, 0.60, w, w["L"] / 2, folga="cozinha")
        vals.append(folga_frente(c.poly, c.postos, c.moveis[0], limite=3.0))
    assert max(vals) - min(vals) < 0.06, "DIR fora de fase: %s" % vals

    # 2. e o valor tem que bater com a conta feita a mao, ate a face da parede
    esperado = L - (0.60 / 2 + RECUO + MEIA_PAREDE) - 0.60 / 2 - MEIA_PAREDE
    assert abs(vals[0] - esperado) < 0.08, (vals[0], esperado)

    # 3. um movel na frente encurta a folga; sem isso o aferidor so ve parede
    c = Comodo(dict(base), [])
    w = c.paredes[0]
    c.encosta("pia", 1.00, 0.92, 0.60, w, w["L"] / 2, folga="cozinha")
    livre0 = folga_frente(c.poly, c.postos, c.moveis[0], limite=3.0)
    nx, ny = w["n"]
    ax, ay = w["a"]
    ux, uy = w["u"]
    # 2,00 e o primeiro rumo LEGAL: a faixa reservada da pia vai ate 1,53, e a
    # geladeira a 1,60 (o que esta sonda tentava antes) e recusada de proposito.
    assert c.poe("geladeira", 0.68, 1.78, 0.68,
                 ax + ux * w["L"] / 2 + nx * 2.00, ay + uy * w["L"] / 2 + ny * 2.00,
                 (rot_de(w["n"]) + 2) & 3)
    livre1 = folga_frente(c.poly, c.postos, c.moveis[0], limite=3.0)
    assert livre1 < livre0 - 0.5, (livre0, livre1)

    # 3b. e a faixa reservada BARRA quem tem altura pra atrapalhar, so isso
    c = Comodo(dict(base), [])
    w = c.paredes[0]
    c.encosta("pia", 1.00, 0.92, 0.60, w, w["L"] / 2, folga="cozinha")
    nx, ny = w["n"]
    ax, ay = w["a"]
    ux, uy = w["u"]
    fx = ax + ux * w["L"] / 2 + nx * 1.10
    fy = ay + uy * w["L"] / 2 + ny * 1.10
    tras = (rot_de(w["n"]) + 2) & 3
    assert not c.poe("geladeira", 0.68, 1.78, 0.68, fx, fy, tras), "reserva nao barrou"
    # tapete pequeno DE PROPOSITO: um de 1,90 x 1,35 encostaria na caixa da propria
    # pia e a sonda passaria a medir colisao de volume, que nao e o que ela testa.
    assert c.poe("tapete", 0.60, 0.02, 0.40, fx, fy, 0), "tapete nao e obstaculo"

    # 4. as tres tipologias de dormitorio da norma
    def cama_de(poly, area):
        c = Comodo({"nome": "quarto", "poly": poly, "area": area}, [])
        mobilia_quarto(c)
        return [m for m in c.moveis if m["tipo"] == "cama"]

    casal = cama_de([(0, 0), (3.6, 0), (3.6, 3.0), (0, 3.0)], 10.8)
    assert len(casal) == 1 and casal[0]["w"] > 1.4, casal
    duplo = cama_de([(0, 0), (2.6, 0), (2.6, 2.6), (0, 2.6)], 6.8)
    assert len(duplo) == 2, duplo
    assert all(abs(m["w"] - SOLTEIRO) < 0.01 for m in duplo), duplo
    # 2,30 de parede nao comporta o par com os 0,60 da norma entre as camas, e os
    # 2,20 de fundo ainda comportam a cama deitada -- e o 3o dormitorio.
    unico = cama_de([(0, 0), (2.3, 0), (2.3, 2.2), (0, 2.2)], 5.06)
    assert len(unico) == 1 and abs(unico[0]["w"] - SOLTEIRO) < 0.01, unico

    # 5. o aferidor separa violacao de norma de aperto, e nao confunde as duas
    c = Comodo(dict(base), [])
    w = c.paredes[0]
    c.encosta("pia", 1.00, 0.92, 0.60, w, w["L"] / 2, folga="cozinha")
    erro, aperto = confere(c)
    assert not erro, erro                      # 2,4 m de folga passa na norma
    assert not aperto, aperto                  # e passa no confortavel tambem
    print("mobiliar: 6 sondas OK  (folga nas 4 paredes %.2f m)" % vals[0])
    return 0


def main():
    if "--demo" in sys.argv:
        return demo()
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    alvo = args[0] if args else None
    so_listar = "--listar" in sys.argv
    n = 0
    for nome in sorted(os.listdir(BASE)):
        cam = os.path.join(BASE, nome, "unidade.json")
        if not os.path.exists(cam):
            continue
        if alvo and nome != alvo:
            continue
        u = json.load(io.open(cam, encoding="utf-8"))
        if not (u.get("planta") or {}).get("comodos"):
            continue
        moveis, relato, erros, apertos = mobilia(u)
        print("  %-24s %2d moveis   %s" % (
            nome, len(moveis),
            "  ".join("%s:%d" % (r[0][:9], r[2]) for r in relato if r[2])))
        # Nenhum dos dois recusa nada: quem decide se um apartamento cabe no
        # gerador e a planta. Mas calar sobre isso era o que fazia o gerador nao
        # ter como dizer que o apartamento e apertado -- que num anuncio e
        # informacao de produto, nao defeito de render.
        for l in erros:
            print("      ! %s" % l)
        for l in apertos:
            print("      ~ %s" % l)
        if not so_listar:
            io.open(os.path.join(BASE, nome, "moveis.auto.json"), "w",
                    encoding="utf-8").write(json.dumps(
                        {"_gerado_por": "pipeline/mobiliar.py",
                         "_nota": "layout automatico; mobilia posta a mao em "
                                  "unidade.json.planta.moveis GANHA deste arquivo",
                         "_norma": "folgas conferidas contra ABNT NBR 15575-1 "
                                   "Anexo G (minimo) e NKBA/Panero-Zelnik (conforto)",
                         "_erros": erros, "_apertos": apertos,
                         "moveis": moveis}, ensure_ascii=False, indent=1))
        n += 1
    return 0 if n else 1


if __name__ == "__main__":
    sys.exit(main())
