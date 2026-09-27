# -*- coding: utf-8 -*-
"""Uma cidade = um JSON em `padrao/cidades/<slug>.json`. Nada de constante solta.

Tudo que muda de cidade pra cidade (projecao metrica, origem do mapa, largura de via,
tamanho de terreno padrao, limiares de QA, caminho dos arquivos) vive no JSON. O codigo
do pipeline nao pode ter numero de cidade escrito dentro dele - foi assim que a largura
da rua acabou escrita em quatro lugares com tres valores diferentes.

  from padrao.cidade import carrega
  c = carrega("sao-carlos")
  c.meia_largura("residential")     # 5.8125 m -> a borda que o renderizador desenha
  c.para_mapa(x_utm, y_utm)         # UTM -> coordenada do mapa 3D (metros)
"""
import json, math, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CIDADES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cidades")


class Cidade(object):
    def __init__(self, d):
        self._d = d
        self.slug = d["slug"]; self.nome = d["nome"]; self.uf = d.get("uf")
        self.epsg_geo = d["crs"]["geo"]; self.epsg_utm = d["crs"]["utm"]
        self.clat = d["centro"]["lat"]; self.clon = d["centro"]["lon"]
        # graus -> metros na latitude da cidade (o mapa 3D e plano, em metros)
        self.mlat = 111132.92
        self.mlon = 111319.49 * math.cos(math.radians(self.clat))
        v = d["vias"]
        self.mul_fita = v["mul_fita"]; self.mul_pista = v.get("mul_pista", 1.0)
        self.HW = list(v["ordem"]); self.ROAD_W = dict(v["largura"])
        self.dirigivel = set(v["dirigivel"])
        self.lote = d.get("lote", {})
        self.exame = d.get("exame_da_quadra", {})
        self.limiares = d.get("limiares_qa", {})
        self._fontes = d.get("fontes", {})
        # De qual cidade esta herda as plantas fornecidas. Hoje quem usa e o
        # `ribeirao-preto-oficial` (`plantas_de: "ribeirao-preto"`): slug proprio, pra ter
        # relatorio de QA proprio, mas o acervo de imovel e o mesmo da cidade de origem --
        # sem isto ele nasce sem nenhuma unidade, porque `unidade.json` diz `cidade:
        # "ribeirao-preto"` e o filtro do montar.py so aceitava o proprio slug. O campo
        # nasceu pra variante de experimento `ribeirao-preto-proxy`, removida no #41.
        self.plantas_de = d.get("plantas_de", self.slug)
        self._tr = {}

    # ---- caminhos -------------------------------------------------------
    def caminho(self, chave):
        """Caminho absoluto de uma fonte declarada no JSON."""
        if chave not in self._fontes:
            raise KeyError("fonte '%s' nao declarada em cidades/%s.json" % (chave, self.slug))
        return os.path.join(RAIZ, self._fontes[chave].replace("/", os.sep))

    def caminhos(self, chave, obrigatoria=True):
        """Lista de caminhos de uma fonte que pode ter MAIS DE UM arquivo.

        Uma prova nao anula a outra: o ponto de endereco da prefeitura e o do CNEFE
        cobrem a cidade de jeitos diferentes (o SigaSC tem 54.111 e o CNEFE 143.200
        em Sao Carlos, e nenhum contem o outro). Quem consome soma; quem so quer o
        cadastro proprio continua chamando `caminho`.

        Aceita string ou lista no JSON, e ignora arquivo declarado que nao existe --
        cidade nova nasce sem nenhum dos dois e a etapa tem que seguir mesmo assim.
        """
        v = self._fontes.get(chave)
        if v is None:
            if obrigatoria: raise KeyError("fonte '%s' nao declarada em cidades/%s.json" % (chave, self.slug))
            return []
        if isinstance(v, str): v = [v]
        fs = [os.path.join(RAIZ, x.replace("/", os.sep)) for x in v]
        return [f for f in fs if os.path.exists(f)]

    # ---- projecao -------------------------------------------------------
    def _transformer(self, de, para):
        k = (de, para)
        if k not in self._tr:
            from pyproj import Transformer
            self._tr[k] = Transformer.from_crs(de, para, always_xy=True)
        return self._tr[k]

    def para_utm(self, lon, lat):
        return self._transformer(self.epsg_geo, self.epsg_utm).transform(lon, lat)

    def para_geo(self, x, y):
        return self._transformer(self.epsg_utm, self.epsg_geo).transform(x, y)

    def geo_para_mapa(self, lon, lat):
        """lon/lat -> coordenada do mapa 3D, em METROS (X leste, Z sul)."""
        return ((lon - self.clon) * self.mlon, -(lat - self.clat) * self.mlat)

    def para_mapa(self, x, y):
        """UTM -> coordenada do mapa 3D, em METROS."""
        return self.geo_para_mapa(*self.para_geo(x, y))

    def mapa_para_utm(self, mx, mz):
        return self.para_utm(self.clon + mx / self.mlon, self.clat - mz / self.mlat)

    # ---- vias -----------------------------------------------------------
    def tipo_da_via(self, k):
        return self.HW[k] if 0 <= k < len(self.HW) else "other"

    def meia_largura(self, tipo, mul=None):
        """Distancia do EIXO ate a borda da fita desenhada. E esta a definicao de
        'onde a rua acaba' - lote, muro e casa param aqui."""
        m = self.mul_fita if mul is None else mul
        return self.ROAD_W.get(tipo, self.ROAD_W.get("other", 6)) / 2.0 * m

    def limiar(self, nome):
        return self.limiares.get(nome)


def carrega(slug="sao-carlos"):
    p = os.path.join(CIDADES, slug + ".json")
    if not os.path.exists(p):
        raise SystemExit("cidade desconhecida: %s (esperado %s)" % (slug, p))
    with open(p, encoding="utf-8") as fh:
        return Cidade(json.load(fh))


def lista():
    return sorted(f[:-5] for f in os.listdir(CIDADES) if f.endswith(".json"))
