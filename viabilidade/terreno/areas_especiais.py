"""Triagem dos Anexos 05/06/07; não substitui conferência cadastral ou DECEA."""
import cache
import gerar_lotes as gl
from sugerir_zona import MapaGeorreferenciado, DIVISA_M, recuperar_tracos

# Centros das amostras das legendas dos JPEGs verificados pelo manifesto.
LEGENDAS = {
    "05": [(1336, 11035, "controle_recuperacao_ambiental", "AECRA"),
           (1336, 11103, "interesse_ambiental", "AIA")],
    "06": [(3298, 11028, "interesse_social", "AEIS tipo 1"),
           (3298, 11116, "interesse_social", "AEIS tipo 2"),
           (3298, 11205, "interesse_social", "AEIS tipo 3"),
           (2131, 12158, "observatorio_usp", "Influência no Observatório da USP"),
           (2131, 12246, "interesse_historico", "Área de Interesse Histórico"),
           (2131, 12424, "interesse_industrial_servicos", "AEI Industrial e de Serviços")],
    "07": [(2900, 10980, "urbanizacao_especifica", "AEI de Urbanização Específica"),
           (2900, 11160, "logistica", "AEI de Logística"),
           (2900, 11250, "protecao_paisagistica", "AEI de Proteção Paisagística"),
           (2900, 11340, "agricultura_familiar", "AEI de Agricultura Familiar e Camponesa")],
}
FUNDOS = {
    "05": [(1336, y) for y in (11307, 11376, 11445, 11515, 11582, 11651, 11721)],
    "06": [(3298, y) for y in (11448, 11537, 11626, 11714, 11803, 11892, 11981, 12070)],
    "07": [(2900, y) for y in (11590, 11680, 11770, 11860, 11950, 12040, 12130, 12220, 12310)],
}


def registro(anexo, tipo, nome, incidencia, motivo, **evidencia):
    return {"tipo": tipo, "nome": nome, "incidencia": incidencia, "conferido": False,
            "fonte": f"Lei 18.053/2016, Anexo {anexo}, p. 1; raster conferido por SHA256 quando disponível",
            "observacoes": motivo + "; confirmar no cadastro e no órgão competente; sem altura numérica aplicada.",
            "evidencia": f"dados/zonas-mapas/anexo{anexo}.jpg; centros dos pixels do lote e margem de 10 m + 4 pixels",
            "anexo": anexo, **evidencia}


def nao_verificada(anexo, motivo):
    return registro(anexo, "nao_verificada", f"Áreas especiais do Anexo {anexo}: não verificada",
                    "nao_verificada", motivo)


class MapaEspecial(MapaGeorreferenciado):
    def __init__(self, anexo):
        super().__init__(anexo)
        self.anexo = anexo
        self.legenda = LEGENDAS[anexo]
        pontos = [(x, y) for x, y, *_ in self.legenda] + FUNDOS[anexo]
        self.paleta = gl.np.array([gl.np.median(gl.np.asarray(self.imagem.crop((x-10, y-10, x+10, y+10))),
                                             axis=(0, 1)) for x, y in pontos] + [[255, 255, 255]])
        if anexo == "07":
            # O contorno só depende do JPEG e deste código: guardado em .cache/ (0,8 s a menos por lote).
            import PIL
            partes = cache.poligonos("cones-07", [self.arquivo, __file__], lambda: gl.sh.get_parts(self.ler_cones()),
                                     f"Pillow {PIL.__version__}")
            self.cones = partes[0] if len(partes) == 1 else gl.sh.multipolygons(partes)

    def ler_cones(self):
        # shortcut: dois contornos convexos neste raster; revalidar as janelas se a fonte mudar.
        cones = []
        for caixa in ((4700, 2650, 5720, 5380), (4650, 5850, 5620, 8560)):
            rgb = gl.np.asarray(self.imagem.crop(caixa)).astype(float)
            yy, xx = gl.np.where(gl.np.linalg.norm(rgb - [97, 19, 190], axis=-1) <= 18)
            if len(xx) < 1000 or gl.np.ptp(xx) < 800 or gl.np.ptp(yy) < 2500:
                raise ValueError("Contorno tracejado do gabarito aeronáutico não recuperado")
            contorno = gl.sh.MultiPoint(gl.np.column_stack([xx + caixa[0] + .5, yy + caixa[1] + .5])).convex_hull
            cones.append(gl.Polygon(self.utm(contorno.exterior.coords)))
        return gl.sh.union_all(cones)

    def ler(self, pol):
        pix = gl.Polygon(self.pixel(pol.exterior.coords))
        margem_m = DIVISA_M + 4/self.escala_min
        margem = margem_m*self.escala_max + 2
        x0, y0, x1, y1 = pix.bounds
        caixa = (int(gl.np.floor(x0-margem)), int(gl.np.floor(y0-margem)),
                 int(gl.np.ceil(x1+margem)), int(gl.np.ceil(y1+margem)))
        quadro = gl.sh.box(250, 100, 8750, 10550 if self.anexo != "06" else 10450)
        janela = gl.sh.box(*caixa)
        if (not quadro.covers(janela) or pol.area > 1_000_000
                or (caixa[2]-caixa[0])*(caixa[3]-caixa[1]) > 2_000_000
                or (self.anexo == "06" and janela.intersects(gl.sh.box(250, 9900, 1900, 12746)))
                or (self.anexo == "07" and janela.intersects(gl.sh.box(250, 100, 3400, 8400)))):
            return [nao_verificada(self.anexo, "Fora do quadro georreferenciado, em encarte/legenda ou lote sem leitura local")]
        rgb = gl.np.asarray(self.imagem.crop(caixa))
        dist = gl.np.linalg.norm(rgb[..., None, :].astype(float) - self.paleta, axis=-1)
        classes = dist.argmin(axis=-1) + 1
        classes[dist.min(axis=-1) > 18] = 0
        _, leitura = recuperar_tracos(classes)
        yy, xx = gl.np.indices(classes.shape)
        xy = gl.np.column_stack([xx.ravel()+caixa[0]+.5, yy.ravel()+caixa[1]+.5])
        interior = gl.sh.contains_xy(pix, xy[:, 0], xy[:, 1])
        mundo = self.utm(xy)
        dist_lote = gl.sh.distance(pol, gl.sh.points(mundo))
        proximos = dist_lote <= margem_m
        resultado = []
        for codigo, (_, _, tipo, nome) in enumerate(self.legenda, 1):
            cor = classes.ravel() == codigo
            if not (cor & proximos).any():
                continue
            dentro = bool((cor & interior).any())
            d = max(0.0, float(dist_lote[cor].min()) - 4/self.escala_min)
            resultado.append(registro(self.anexo, tipo, nome,
                                      "sobreposicao_visual" if dentro else "possivel_incidencia",
                                      "Cor da legenda no lote" if dentro else "Possível incidência, confirmar: mancha a até ~10 m",
                                      distancia_conservadora_m=round(d, 2), pixels_no_lote=int((cor & interior).sum())))
        if self.anexo == "07" and pol.distance(self.cones) <= margem_m:
            resultado.append(registro("07", "gabarito_aeronautico", "Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes",
                                      "possivel_incidencia", "Possível incidência, confirmar: interior ou proximidade do contorno tracejado; consultar DECEA",
                                      distancia_conservadora_m=round(max(0.0, pol.distance(self.cones)-4/self.escala_min), 2)))
        if interior.sum() < 3 or (leitura.ravel()[proximos] == 0).any():
            resultado.append(nao_verificada(self.anexo, "Cor encoberta/sem correspondência segura no lote ou margem de ~10 m, ou resolução insuficiente"))
        return resultado


class AreasEspeciais:
    def __init__(self):
        self.mapas = {}
        for anexo in LEGENDAS:
            try:
                self.mapas[anexo] = MapaEspecial(anexo)
            except (OSError, ValueError) as erro:
                self.mapas[anexo] = str(erro)

    def ler(self, pol):
        if pol.geom_type != "Polygon" or pol.is_empty or not pol.is_valid or pol.interiors:
            raise ValueError("Áreas especiais exigem polígono válido, não vazio e sem buracos")
        resultado = []
        for anexo, mapa in self.mapas.items():
            if isinstance(mapa, str):
                resultado.append(nao_verificada(anexo, mapa))
            else:
                resultado.extend(mapa.ler(pol))
        return resultado
