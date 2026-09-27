# -*- coding: utf-8 -*-
"""Recorta os blocos da pagina para um raio em volta de um ponto.

O montador continua montando a MESMA pagina; o que muda e que cada bloco passa por
aqui antes de virar texto. Sem recorte, nada disto roda e a saida e a de sempre.

O que o recorte devolve NAO e uma cidade menor: e a mesma cidade com menos coisa
dentro. Os indices tem que continuar batendo entre blocos -- `bm`, `fa` e `urbanLots`
sao todos indexados pelo numero do predio dentro de `b[]`, e `urbanLots` e
`placements` guardam o INDICE do modelo dentro da biblioteca. Tirar um predio do meio
sem remapear os tres desloca nome, altura e casa de todo mundo depois dele. Por isso
`citydata` guarda o mapa velho->novo e o conjunto de modelos que sobrou, e os outros
blocos consultam isso em vez de recalcular distancia por conta propria.

Ordem importa uma vez: `__citydata` tem que ser recortado antes de `__urbanModels`,
porque e ele que diz quais modelos de casa sobraram. O montador ja emite nessa ordem;
`urbanModels` levanta erro se for chamado fora dela, em vez de devolver biblioteca
vazia em silencio.

O RECORTE SE CONFERE (gate do build por imovel). Tamanho menor nao prova nada: um
recorte que trocasse o nome, a altura ou o modelo de casa dos predios produziria uma
pagina menor que renderiza. Por isso `citydata` e `urbanModels` guardam o bloco inteiro
e comparam com o recortado na propria montagem (`diverge`): cada predio que ficou tem
de ser O MESMO predio da cidade inteira, achado pela POSICAO, que e a unica coisa que o
recorte nao pode mexer. Divergencia levanta `IdentidadeQuebrada` e aborta a montagem,
antes de existir build. O gate so le: a saida e a mesma com ou sem ele.
`pipeline/testa_recorte.py` e o invocador manual da mesma funcao sobre paginas prontas.
"""
import json
import math

# Blocos que NAO dependem de posicao: biblioteca, tabela ou raster da cidade inteira.
# Entram inteiros de proposito -- recortar biblioteca de peca nao economiza (a peca e
# referenciada de qualquer canto do recorte) e recortar o raster de vegetacao mudaria
# a grade que o renderizador assume.
INTEIROS = ("__cidade", "__moveis", "__textura", "__arvores",
            "__vegetacao", "__elevdata", "__poidata")

# Quanta biblioteca o RENDERIZADOR exige. Nao sao numeros escolhidos aqui: sao a
# condicao que ele testa antes de aceitar o pacote, e reprovar nao quebra a pagina --
# ela cai no fallback de volumes simples e escreve um aviso no console, que foi
# exatamente como este recorte passou despercebido por dois testes.
#
#   world/urban-models.js:83   pack.assets.length < 40            -> throw
#   exterior-details.js:6      pack.assets.length !== 65          -> throw
#
# O exterior nao admite poda NENHUMA: e igualdade, nao minimo. O urbano admite, desde
# que nao passe do piso.
URBANO_MINIMO = 40
EXTERIOR_EXATO = 65


def _dist(x, z, cx, cz):
    return math.hypot(x - cx, z - cz)


class IdentidadeQuebrada(RuntimeError):
    """O recorte trocou a identidade de um predio: aborta a montagem."""


def _predios(c):
    """{(x, z) do primeiro vertice: [(cor, altura, n_vertices, indice), ...]}.

    Lista, e nao um valor so: dois predios podem comecar no mesmo ponto, e o casamento
    pela posicao nao pode escolher um deles por acaso."""
    b = c["b"]
    fora, i, n = {}, 0, 0
    while i < len(b):
        k = b[i + 2]
        fora.setdefault((b[i + 3], b[i + 4]), []).append((b[i], b[i + 1], k, n))
        i += 3 + 2 * k
        n += 1
    return fora


def _nomes(c):
    """indice do predio -> (nome, endereco), pelo `bm` e pela tabela `names`."""
    ns, bm, fora = c.get("names") or [], c.get("bm") or [], {}
    for i in range(0, len(bm), 3):
        fora[bm[i]] = (ns[bm[i + 1]] if bm[i + 1] < len(ns) else None,
                       ns[bm[i + 2]] if bm[i + 2] < len(ns) else None)
    return fora


def _modelo(lib, i):
    assets = (lib or {}).get("assets") or []
    return assets[i].get("id") if 0 <= i < len(assets) else None


def _emparelha(compativeis, n):
    """Casamento 1:1 entre os predios do recorte numa posicao e os `n` candidatos da cidade
    inteira nela (caminho de aumento). `compativeis[i]` sao os candidatos que batem em tudo
    com o predio i. Devolve, para cada predio, o candidato casado ou None."""
    dono = [None] * n

    def tenta(i, visto):
        for j in compativeis[i]:
            if j not in visto:
                visto.add(j)
                if dono[j] is None or tenta(dono[j], visto):
                    dono[j] = i
                    return True
        return False

    for i in range(len(compativeis)):
        tenta(i, set())
    par = [None] * len(compativeis)
    for j, i in enumerate(dono):
        if i is not None:
            par[i] = j
    return par


def diverge(cheia, corte, lib_cheia=None, lib_corte=None):
    """Onde o `__citydata` recortado deixou de ser a cidade inteira.

    Para cada predio do recorte, achado pela POSICAO do primeiro vertice: mesma cor,
    altura e numero de vertices; mesmo nome e endereco; mesma frente (`fa`); o mesmo
    `urbanLot`, com a mesma posicao e rotacao; e, quando as duas bibliotecas vierem, o
    mesmo modelo pelo ID (o indice muda, porque a biblioteca encolhe). Devolve a lista
    de divergencias `(tipo, posicao, recorte, cheia)`, vazia quando tudo bate.

    O casamento e 1:1: um predio da cidade inteira e par de UM predio do recorte, entao
    uma copia a mais no recorte reprova. E `fa` falha fechado: frente de um lado e nao do
    outro -- o array inteiro sumido, ou curto demais -- e divergencia."""
    pc, pr = _predios(cheia), _predios(corte)
    nc, nr = _nomes(cheia), _nomes(corte)
    ulc, ulr = cheia.get("urbanLots") or {}, corte.get("urbanLots") or {}
    fa_c, fa_r = cheia.get("fa") or [], corte.get("fa") or []
    modelos = lib_cheia is not None and lib_corte is not None
    ausente = object()

    def frente(fa, i):
        return fa[i] if 0 <= i < len(fa) else ausente

    def difere(pos, r, c):
        """A primeira diferenca entre o predio r do recorte e o candidato c, ou None."""
        (cor, alt, k, idx), (ccor, calt, ck, cidx) = r, c
        if (cor, alt, k) != (ccor, calt, ck):
            return ("geometria", pos, (cor, alt, k), (ccor, calt, ck))
        if nr.get(idx) != nc.get(cidx):
            return ("nome", pos, nr.get(idx), nc.get(cidx))
        fr, fc = frente(fa_r, idx), frente(fa_c, cidx)
        if (fr is ausente) != (fc is ausente):
            return ("fa ausente", pos, None if fr is ausente else fr,
                    None if fc is ausente else fc)
        if fr != fc:
            return ("fa", pos, fr, fc)
        vr, vc = ulr.get(str(idx)), ulc.get(str(cidx))
        if (vr is None) != (vc is None):
            return ("urbanLot ausente", pos, vr, vc)
        if vr is not None and vr[1:] != vc[1:]:
            return ("urbanLot", pos, vr[1:], vc[1:])
        if vr is not None and modelos and _modelo(lib_corte, vr[0]) != _modelo(lib_cheia, vc[0]):
            return ("modelo urbano", pos, _modelo(lib_corte, vr[0]), _modelo(lib_cheia, vc[0]))
        return None

    erros = []
    for pos, lista in pr.items():
        candidatos = pc.get(pos) or []
        compativeis = [[j for j, c in enumerate(candidatos) if difere(pos, r, c) is None]
                       for r in lista]
        for i, j in enumerate(_emparelha(compativeis, len(candidatos))):
            if j is not None:
                continue
            r = lista[i]
            if not candidatos:
                erros.append(("sem par", pos, r[:3], None))
            elif compativeis[i]:
                erros.append(("duplicado", pos, r[:3], "o par ja foi usado por outro predio"))
            else:
                erros.append(difere(pos, r, candidatos[0]))
    return erros


class Recorte:
    """Filtro de blocos em volta de (cx, cz), em metros do sistema do mapa."""

    def __init__(self, centro, raio, unidade=None, cid=None, prefixo_tiles=None):
        self.cx, self.cz = centro
        self.raio = float(raio)
        self.unidade = unidade
        self._cid = cid
        # Onde os tiles de quintal moram quando a pagina NAO fica ao lado do mapa
        # (ex.: "/quintais/<hash>/" na raiz do site). Sem ele, fica o prefixo do
        # mapa, relativo a pagina.
        self.prefixo_tiles = prefixo_tiles
        self._urbanos_manter = None     # indices de modelo urbano que sobraram, em ordem
        self._imoveis_dentro = None     # ids de anuncio dentro do raio
        self._unidades_dentro = None    # ids de planta cadastrada que ficaram
        self._cidade_par = None         # (cheia, recortada), para o gate conferir modelos
        self.relatorio = {}

    # ---- entrada ---------------------------------------------------------
    def aplica(self, ident, texto):
        if texto is None or ident in INTEIROS:
            return texto
        fn = getattr(self, ident.lstrip("_"), None)
        if fn is None:
            return texto
        antes = len(texto)
        saida = fn(texto)
        self.relatorio[ident] = (antes, len(saida))
        return saida

    def dentro(self, x, z):
        return _dist(x, z, self.cx, self.cz) <= self.raio

    def _geo(self, lon, lat):
        return self._cid.geo_para_mapa(lon, lat)

    # ---- gate ------------------------------------------------------------
    def _exige(self, erros, bloco):
        if erros:
            amostra = "; ".join("%s em %s: recorte=%s cheia=%s" % e for e in erros[:5])
            raise IdentidadeQuebrada("%s: o recorte trocou a identidade de %d predio(s). %s"
                                     % (bloco, len(erros), amostra))

    # ---- cidade ----------------------------------------------------------
    def citydata(self, texto):
        cheia = json.loads(texto)
        corte = self._corta_cidade(json.loads(texto))
        self._exige(diverge(cheia, corte), "__citydata")
        self._cidade_par = (cheia, corte)
        return json.dumps(corte, ensure_ascii=False, separators=(",", ":"))

    def _corta_cidade(self, c):
        """O recorte em si. Devolve o mesmo dicionario, cortado; quem confere e `citydata`."""
        Q = 10.0
        q = c.get("q", 10)
        escala = q / Q
        b, bl = c["b"], c["bl"]

        # Extensao de cada predio dentro de b[]: [cor, altura, n, (dx,dz)*n].
        lim, i = [], 0
        while i < len(b):
            ini = i
            i += 2
            n = b[i]
            i += 1 + 2 * n
            lim.append((ini, i))

        guardados, novo_bl = [], []
        for k in range(0, len(bl), 5):
            cx = bl[k] / Q * escala
            cz = bl[k + 1] / Q * escala
            rad = bl[k + 2] / Q * escala
            # O quarteirao entra INTEIRO quando encosta no raio: cortar predio pela
            # metade deixaria meia quadra no ar, e o streaming monta por quarteirao
            # de qualquer jeito.
            if _dist(cx, cz, self.cx, self.cz) - rad > self.raio:
                continue
            ini, n = bl[k + 3], bl[k + 4]
            novo_bl.append([bl[k], bl[k + 1], bl[k + 2], len(guardados), n])
            guardados.extend(range(ini, ini + n))

        novo_de_velho = {velho: novo for novo, velho in enumerate(guardados)}
        novo_b = []
        for velho in guardados:
            a, z = lim[velho]
            novo_b.extend(b[a:z])

        fa = c.get("fa")
        novo_bm = []
        for k in range(0, len(c.get("bm") or []), 3):
            n = novo_de_velho.get(c["bm"][k])
            if n is not None:
                novo_bm.extend([n, c["bm"][k + 1], c["bm"][k + 2]])

        # urbanLots: chave e o indice do predio; valor e [modelo, x, z, rot].
        #
        # O valor[0] e o indice do modelo DENTRO da biblioteca, e a biblioteca vai
        # encolher junto (so entra o modelo que alguem usa). Entao o indice tem que
        # ser reescrito AQUI, na mesma passada que decide quem fica -- deixar pra
        # `urbanModels` nao da: quando ele roda, este bloco ja virou texto. Foi
        # exatamente esse o defeito que o testa_recorte pegou: a pagina renderizava
        # com a casa do vizinho, e so divergia onde havia BURACO no conjunto usado,
        # entao tres das quatro paginas passavam por acaso.
        usados = set()
        for velho, v in (c.get("urbanLots") or {}).items():
            if novo_de_velho.get(int(velho)) is not None:
                usados.add(v[0])
        # O piso do renderizador (URBANO_MINIMO) vale mais que a economia: abaixo
        # dele o pacote inteiro e recusado e a cidade perde TODAS as casas modeladas,
        # nao so as podadas. Quando falta, completa-se com modelo nao usado -- o que
        # sobra e peso morto, mas peso morto que mantem o pacote valido.
        self._urbanos_manter = self._com_piso(usados, c.get("urbanLots"))
        remap = {velho: novo for novo, velho in enumerate(self._urbanos_manter)}
        lotes = {}
        for velho, v in (c.get("urbanLots") or {}).items():
            n = novo_de_velho.get(int(velho))
            if n is not None:
                lotes[str(n)] = [remap[v[0]]] + list(v[1:])

        c["b"] = novo_b
        c["bl"] = [v for linha in novo_bl for v in linha]
        c["bm"] = novo_bm
        if fa:
            c["fa"] = [fa[v] for v in guardados]
        if c.get("urbanLots") is not None:
            c["urbanLots"] = lotes
        # r[] e g[] sao via e chao de quadra: geometria solta, cortada por ponto.
        c["r"] = self._vias(c["r"], Q, escala)
        if c.get("g"):
            c["g"] = self._chaos(c["g"], Q, escala)
        self.relatorio["predios"] = (len(lim), len(guardados))
        self.relatorio["quarteiroes"] = (len(bl) // 5, len(novo_bl))
        return c

    def _com_piso(self, usados, urban_lots):
        """Indices a manter na biblioteca urbana, nunca menos que URBANO_MINIMO.

        Nao da pra saber aqui quantos modelos a biblioteca tem (ela chega depois),
        entao o completamento usa o maior indice visto no cadastro como limite. Se
        ainda assim faltar, `urbanModels` confere contra a biblioteca de verdade."""
        manter = set(usados)
        if len(manter) >= URBANO_MINIMO:
            return sorted(manter)
        teto = max((v[0] for v in (urban_lots or {}).values()), default=-1)
        for i in range(teto + 1):
            if len(manter) >= URBANO_MINIMO:
                break
            manter.add(i)
        return sorted(manter)

    def _vias(self, arr, Q, escala):
        """r[] = [tipo, nome, n, (dx,dz)*n] por via, delta-encodado dentro da via."""
        saida, i = [], 0
        while i < len(arr):
            ini = i
            i += 2                      # tipo, indice do nome
            n = arr[i]
            i += 1
            perto, lx, lz = False, 0, 0
            for _ in range(n):
                lx += arr[i]
                lz += arr[i + 1]
                i += 2
                if not perto and self.dentro(lx / Q * escala, lz / Q * escala):
                    perto = True
            if perto:
                saida.extend(arr[ini:i])
        return saida

    def _chaos(self, arr, Q, escala):
        """g[] = [n, (dx,dz)*n] por poligono de chao de quadra."""
        saida, i = [], 0
        while i < len(arr):
            ini = i
            n = arr[i]
            i += 1
            perto, lx, lz = False, 0, 0
            for _ in range(n):
                lx += arr[i]
                lz += arr[i + 1]
                i += 2
                if not perto and self.dentro(lx / Q * escala, lz / Q * escala):
                    perto = True
            if perto:
                saida.extend(arr[ini:i])
        return saida

    # ---- sopa de triangulo (rua e chao), ja em metros ---------------------
    def _triangulos(self, texto):
        a = json.loads(texto)
        saida = []
        for i in range(0, len(a) - 5, 6):
            mx = (a[i] + a[i + 2] + a[i + 4]) / 3.0
            mz = (a[i + 1] + a[i + 3] + a[i + 5]) / 3.0
            if self.dentro(mx, mz):
                saida.extend(a[i:i + 6])
        return json.dumps(saida, separators=(",", ":"))

    def streetdata(self, texto):
        return self._triangulos(texto)

    def grounddata(self, texto):
        return self._triangulos(texto)

    # ---- segmentos delta-encodados ---------------------------------------
    def _segmentos(self, texto, passo):
        """Reconstroi o absoluto, filtra, e re-encoda o delta do que sobrou.

        O delta e em relacao ao segmento ANTERIOR QUE FICOU, nao ao anterior no
        arquivo -- por isso nao da pra so copiar as tuplas escolhidas."""
        a = json.loads(texto)
        saida, x, z, px, pz = [], 0, 0, 0, 0
        for i in range(0, len(a) - passo + 1, passo):
            x += a[i]
            z += a[i + 1]
            if self.dentro(x / 10.0, z / 10.0):
                saida.append(x - px)
                saida.append(z - pz)
                saida.extend(a[i + 2:i + passo])
                px, pz = x, z
        return json.dumps(saida, separators=(",", ":"))

    def murosdata(self, texto):
        return self._segmentos(texto, 4)

    def portoes(self, texto):
        return self._segmentos(texto, 5)

    # ---- modelos ---------------------------------------------------------
    def urbanModels(self, texto):
        if self._urbanos_manter is None:
            raise RuntimeError("__urbanModels recortado antes de __citydata: sem a "
                               "cidade nao da pra saber qual casa sobrou")
        d = json.loads(texto)
        cheia = {"assets": d.get("assets") or []}
        d = self._corta_modelos(d)
        if self._cidade_par is not None:
            cidade, corte = self._cidade_par
            self._exige(diverge(cidade, corte, cheia, d), "__urbanModels")
        return json.dumps(d, separators=(",", ":"))

    def _corta_modelos(self, d):
        """A poda da biblioteca. Devolve o mesmo dicionario; quem confere e `urbanModels`."""
        antigos = d.get("assets") or []
        manter = self._urbanos_manter
        # `citydata` ja reescreveu urbanLots contando com ESTA ordem. Pular um indice
        # invalido aqui deslocaria todos os seguintes em silencio, que e o defeito que
        # esta correcao existe pra impedir -- entao e erro, nao remendo.
        if manter and manter[-1] >= len(antigos):
            raise RuntimeError("urbanLots aponta pro modelo %d, a biblioteca tem %d"
                               % (manter[-1], len(antigos)))
        # Completa ate o piso com modelo nao usado, se o cadastro nao deu indice alto
        # o bastante pra `_com_piso` chegar la sozinho.
        if len(manter) < URBANO_MINIMO:
            extras = [i for i in range(len(antigos)) if i not in set(manter)]
            manter = sorted(set(manter) | set(extras[:URBANO_MINIMO - len(manter)]))
            self._urbanos_manter = manter
        d["assets"] = [antigos[i] for i in manter]
        self.relatorio["urbanModels/assets"] = (len(antigos), len(manter))
        return d

    def exteriorModels(self, texto):
        d = json.loads(texto)
        antigos = d.get("assets") or []
        # A BIBLIOTECA FICA INTEIRA. `exterior-details.js:6` testa IGUALDADE
        # (`assets.length !== 65`), nao minimo: tirar um asset invalida o pacote e a
        # pagina perde muro, portao e quintal de uma vez, avisando so no console.
        # Como os indices nao mudam, `placements` tambem nao e remapeado -- so
        # filtrado. Sao 3,02 MB que este recorte NAO economiza, e o motivo esta aqui.
        if len(antigos) != EXTERIOR_EXATO:
            print("  (aviso: biblioteca de exteriores tem %d assets, o renderizador "
                  "espera %d)" % (len(antigos), EXTERIOR_EXATO))
        d["placements"] = [p for p in (d.get("placements") or [])
                           if self.dentro(p[1], p[2])]
        t = d.get("parcelTiles") or {}
        if t.get("keys"):
            lado = t.get("size", 640)
            dentro = []
            for chave in t["keys"]:
                try:
                    i, j = (int(v) for v in chave.split("_"))
                except ValueError:
                    continue
                # A chave e o canto do tile; o centro fica meio lado adiante. A folga
                # de um lado evita cortar o tile que a borda do raio atravessa.
                if _dist((i + 0.5) * lado, (j + 0.5) * lado,
                         self.cx, self.cz) <= self.raio + lado:
                    dentro.append(chave)
            self.relatorio["parcelTiles"] = (len(t["keys"]), len(dentro))
            t["keys"] = dentro
        if self.prefixo_tiles and t:
            t["prefix"] = self.prefixo_tiles
        self.relatorio["exteriorModels/assets"] = (len(antigos), len(antigos))
        return json.dumps(d, separators=(",", ":"))

    def imoveis(self, texto):
        """Anuncios da cidade; guarda os ids que ficaram pro listingModels usar."""
        d = json.loads(texto)
        if not isinstance(d, list):
            return texto
        fica = []
        for im in d:
            if im.get("lat") is None or im.get("lon") is None:
                continue
            x, z = self._geo(im["lon"], im["lat"])
            if self.dentro(x, z):
                fica.append(im)
        self._imoveis_dentro = {str(im.get("id")) for im in fica}
        self.relatorio["imoveis"] = (len(d), len(fica))
        return json.dumps(fica, ensure_ascii=False, separators=(",", ":"))

    def listingModels(self, texto):
        if self._imoveis_dentro is None:
            return texto
        d = json.loads(texto)
        antigos = d.get("assets") or []
        d["assets"] = [a for a in antigos if str(a.get("id")) in self._imoveis_dentro]
        self.relatorio["listingModels"] = (len(antigos), len(d["assets"]))
        return json.dumps(d, ensure_ascii=False, separators=(",", ":"))

    def unidades(self, texto):
        """Plantas cadastradas: as que caem dentro do raio.

        A pagina e de UM imovel, mas as vizinhas continuam clicaveis se estiverem no
        recorte -- e parte do "o que tem por perto". O que nao pode e listar unidade
        cujo interior nao viaja junto: o botao `planta 3D` abriria um comodo sem a luz
        assada. Por isso quem decide e esta funcao, e `luzue` apenas obedece."""
        d = json.loads(texto)
        if not isinstance(d, list):
            return texto
        fica = []
        for u in d:
            lote = u.get("lote") or {}
            if u.get("id") == self.unidade:
                fica.append(u)
                continue
            if lote.get("lat") is None or lote.get("lon") is None:
                continue          # sem lote nao da pra situar nem saber se esta perto
            x, z = self._geo(lote["lon"], lote["lat"])
            if self.dentro(x, z):
                fica.append(u)
        self._unidades_dentro = {u.get("id") for u in fica}
        self.relatorio["unidades"] = (len(d), len(fica))
        return json.dumps(fica, ensure_ascii=False)

    def luzue(self, texto):
        """Atlas de luz assada, exatamente das unidades que a pagina lista."""
        d = json.loads(texto)
        if not isinstance(d, dict):
            return texto
        if self._unidades_dentro is None:
            raise RuntimeError("__luzue recortado antes de __unidades: a luz tem que "
                               "seguir a lista, senao sobra planta sem interior")
        fica = {k: v for k, v in d.items() if k in self._unidades_dentro}
        self.relatorio["luzue"] = (len(d), len(fica))
        return json.dumps(fica, separators=(",", ":"))


def para_unidade(cid, unidade, raio, prefixo_tiles=None):
    """Recorte centrado no lote de uma unidade do cadastro."""
    lote = unidade.get("lote") or {}
    if lote.get("lat") is None or lote.get("lon") is None:
        raise SystemExit("unidade %s nao tem lote.lat/lon" % unidade.get("id"))
    centro = cid.geo_para_mapa(lote["lon"], lote["lat"])
    return Recorte(centro, raio, unidade=unidade.get("id"), cid=cid,
                   prefixo_tiles=prefixo_tiles)


class _CidFalsa:
    """geo_para_mapa de brinquedo: 1 grau = 111 km, o bastante pra prova."""
    def geo_para_mapa(self, lon, lat):
        return (lon * 111000.0, -lat * 111000.0)


def _prova():
    """Um predio dentro e um fora: o de fora sai, e o indice do que fica anda."""
    # Dois quarteiroes de um predio cada, a 0 m e a 1000 m do centro.
    # b[] e bl[] estao em DECIMETROS (q=10): 1000 m = 10000.
    cidade = {"v": 1, "c": [0, 0], "q": 10, "names": ["A", "B"],
              # predio 0: cor 1, altura 30, 1 ponto em (0,0)
              # predio 1: cor 2, altura 40, 1 ponto em (10000,0) = 1000 m
              "b": [1, 30, 1, 0, 0,
                    2, 40, 1, 10000, 0],
              "bm": [0, 0, 0, 1, 1, 1],
              "bl": [0, 0, 0, 0, 1, 10000, 0, 0, 1, 1],
              "fa": [400, 900],
              "r": [], "g": [],
              "urbanLots": {"0": [5, 0, 0, 0], "1": [7, 1000, 0, 0]}}
    r = Recorte((0, 0), 100)
    saida = json.loads(r.citydata(json.dumps(cidade)))
    assert r.relatorio["predios"] == (2, 1), r.relatorio
    assert saida["b"] == [1, 30, 1, 0, 0], saida["b"]
    assert saida["fa"] == [400], saida["fa"]
    assert saida["bm"] == [0, 0, 0], saida["bm"]
    # Com biblioteca pequena o PISO manda: nada e podado, e o indice fica onde
    # estava. Uma biblioteca de 8 modelos nunca poderia encolher pra 1 -- o
    # renderizador recusaria o pacote inteiro.
    biblioteca = {"assets": [{"id": "casa-%d" % i} for i in range(8)]}
    depois = json.loads(r.urbanModels(json.dumps(biblioteca)))
    assert len(depois["assets"]) == 8, depois["assets"]
    novo = saida["urbanLots"]["0"][0]
    assert depois["assets"][novo]["id"] == "casa-5", "o indice reescrito nao aponta"

    # Com biblioteca grande a poda acontece, e o par (urbanLots reescrito +
    # biblioteca na mesma ordem) tem que continuar apontando pro MESMO modelo. Foi
    # este o defeito que so o testa_recorte pegou: a pagina renderizava com a casa
    # do vizinho, e so divergia onde havia BURACO no conjunto usado.
    grande = dict(cidade)
    grande["urbanLots"] = {"0": [70, 0, 0, 0]}
    grande["urbanLots"].update({str(i): [i, 0, 0, 0] for i in range(1, 2)})
    rg = Recorte((0, 0), 100)
    sg = json.loads(rg.citydata(json.dumps(grande)))
    libg = {"assets": [{"id": "casa-%d" % i} for i in range(100)]}
    dg = json.loads(rg.urbanModels(json.dumps(libg)))
    assert len(dg["assets"]) == URBANO_MINIMO, len(dg["assets"])
    assert dg["assets"][sg["urbanLots"]["0"][0]]["id"] == "casa-70", dg["assets"][:3]

    # Exterior: a biblioteca NAO pode encolher (igualdade, nao minimo).
    ext = {"version": 1, "assets": [{"id": i} for i in range(EXTERIOR_EXATO)],
           "placements": [[3, 0, 0, 0], [4, 5000, 0, 0]], "props": [1, 2, 3]}
    de = json.loads(Recorte((0, 0), 100).exteriorModels(json.dumps(ext)))
    assert len(de["assets"]) == EXTERIOR_EXATO, len(de["assets"])
    assert de["placements"] == [[3, 0, 0, 0]], de["placements"]
    assert de["props"] == [1, 2, 3], "props sao referenciados pelos tiles, ficam"

    # O segundo quarteirao sobrevive e seu indice em b[] tem que virar 0.
    r2 = Recorte((1000, 0), 100)
    s2 = json.loads(r2.citydata(json.dumps(cidade)))
    assert s2["b"] == [2, 40, 1, 10000, 0], s2["b"]
    assert s2["bl"][3] == 0, s2["bl"]
    assert s2["bm"] == [0, 1, 1], s2["bm"]
    # Idem: biblioteca pequena, piso manda, indice preservado.
    assert s2["urbanLots"] == {"0": [7, 1000, 0, 0]}, s2["urbanLots"]

    # Segmento: o delta tem que ser em relacao ao ANTERIOR QUE FICOU.
    # tres muros em x = 0, 5000 (500 m) e 100 (10 m), delta-encodados.
    muros = json.dumps([0, 0, 10, 0,  5000, 0, 10, 0,  -4900, 0, 10, 0])
    r3 = Recorte((0, 0), 100)
    s3 = json.loads(r3.murosdata(muros))
    assert s3 == [0, 0, 10, 0, 100, 0, 10, 0], s3

    # Triangulo entra pelo centroide.
    tris = json.dumps([0, 0, 10, 0, 0, 10,   1000, 0, 1010, 0, 1000, 10])
    assert json.loads(Recorte((0, 0), 100)._triangulos(tris)) == [0, 0, 10, 0, 0, 10]

    # A luz assada segue a LISTA de unidades, nunca a lista inteira: planta
    # listada sem interior e um botao que abre comodo sem luz.
    ru = Recorte((0, 0), 100, unidade="alvo", cid=_CidFalsa())
    lista = [{"id": "alvo", "lote": {"lat": 0, "lon": 0}},
             {"id": "perto", "lote": {"lat": 0, "lon": 0.0005}},
             {"id": "longe", "lote": {"lat": 0, "lon": 0.05}},
             {"id": "sem-lote"}]
    fica = json.loads(ru.unidades(json.dumps(lista)))
    assert [u["id"] for u in fica] == ["alvo", "perto"], fica
    luz = json.loads(ru.luzue(json.dumps({"alvo": 1, "perto": 2, "longe": 3})))
    assert luz == {"alvo": 1, "perto": 2}, luz
    try:
        Recorte((0, 0), 100).luzue('{"x":1}')
    except RuntimeError:
        pass
    else:
        raise AssertionError("luzue aceitou rodar antes de unidades")

    # urbanModels fora de ordem tem que gritar, nao devolver biblioteca vazia.
    try:
        Recorte((0, 0), 100).urbanModels('{"assets":[]}')
    except RuntimeError:
        pass
    else:
        raise AssertionError("urbanModels aceitou rodar antes de citydata")
    print("recorte: prova ok")


if __name__ == "__main__":
    _prova()
