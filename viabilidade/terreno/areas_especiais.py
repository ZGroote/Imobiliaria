"""Triagem dos Anexos 05/06/07; não substitui conferência cadastral ou DECEA."""
import math

import cache
import gerar_lotes as gl
from sugerir_zona import MapaGeorreferenciado, DIVISA_M, classificar, mancha, recuperar_tracos

# Centros das amostras das legendas dos JPEGs verificados pelo manifesto.
LEGENDAS = {
    "05": [(1336, 10832, "chacaras_recreio", "Chácaras de Recreio - Loteamentos rurais regulares"),
           (1336, 11035, "controle_recuperacao_ambiental", "AECRA"),
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
# O cinza das Chácaras é também o das ruas do Anexo 05: só conta mancha de 5x5 px ou mais (AUDITORIA-6).
SO_MANCHA = {"chacaras_recreio"}
# O Interesse Histórico do Anexo 06 foi pintado translúcido: no mapa sai legenda - (255 - fundo)/2
# (sobre a Z1 [180,108,182], sobre a Z3 [153,107,232], medidos a ~1 da previsão); a cor opaca quase não aparece.
TRANSLUCIDAS = {"06": {"interesse_historico"}}
# Subárea Especial de Restrição de Gabarito (art. 80, 9 m): só borda tracejada magenta no Centro, sem preenchimento.
SUBAREA_GABARITO = ((4250, 5100, 5200, 6250), (252, 1, 188))
# shortcut: a hachura da AEI do Transporte Aéreo (itens 09, 10 e 11 do Anexo 07) não tem cor própria; retângulo
# envolvente medido no raster, com folga. Revalidar se o JPEG mudar; trocar por vetor oficial quando houver.
AEI_TRANSPORTE_AEREO = (4940, 4940, 5560, 6260)


def registro(anexo, tipo, nome, incidencia, motivo, margem_m=DIVISA_M, **evidencia):
    return {"tipo": tipo, "nome": nome, "incidencia": incidencia, "conferido": False,
            "fonte": f"Lei 18.053/2016, Anexo {anexo}, p. 1; raster conferido por SHA256 quando disponível",
            "observacoes": motivo + "; confirmar no cadastro e no órgão competente; sem altura numérica aplicada.",
            "evidencia": f"dados/zonas-mapas/anexo{anexo}.jpg; centros dos pixels do lote e margem de {margem_m:g} m + 4 pixels",
            "anexo": anexo, **evidencia}


NADA_ENCONTRADO = "Leitura automática dos Anexos 05/06/07: nenhuma área especial encontrada — não conferida"


def nao_verificada(anexo, motivo, margem_m=DIVISA_M):
    return registro(anexo, "nao_verificada", f"Áreas especiais do Anexo {anexo}: não verificada",
                    "nao_verificada", motivo, margem_m)


class MapaEspecial(MapaGeorreferenciado):
    def __init__(self, anexo):
        super().__init__(anexo)
        self.anexo = anexo
        self.legenda = LEGENDAS[anexo]
        # Margem >= maior resíduo dos controles do anexo (06: 10,46 m; 07: 11,37 m), nunca menos que 10 m.
        self.divisa_m = max(DIVISA_M, float(math.ceil(self.residuo_max)))
        pontos = [(x, y) for x, y, *_ in self.legenda] + FUNDOS[anexo]
        cores = [gl.np.median(gl.np.asarray(self.imagem.crop((x-10, y-10, x+10, y+10))), axis=(0, 1)) for x, y in pontos]
        # paleta: legendas, fundos, branco e as cores compostas; `codigo` leva a classe da paleta ao código da legenda
        compostas, self.codigo = [], list(range(len(pontos) + 2))
        for i, (*_, tipo, _) in enumerate(self.legenda):
            if tipo in TRANSLUCIDAS.get(anexo, ()):
                for f in cores[len(self.legenda):]:
                    compostas.append(gl.np.clip(cores[i] - (255 - f)/2, 0, 255))
                    self.codigo.append(i + 1)
        self.paleta = gl.np.array(cores + [[255, 255, 255]] + compostas)
        self.codigo = gl.np.array(self.codigo)
        if anexo == "06":
            self.subarea = self.ler_subarea()
        if anexo == "07":
            # O contorno só depende do JPEG e deste código: guardado em .cache/ (0,8 s a menos por lote).
            import PIL
            partes = cache.poligonos("cones-07", [self.arquivo, __file__], lambda: gl.sh.get_parts(self.ler_cones()),
                                     f"Pillow {PIL.__version__}")
            self.cones = partes[0] if len(partes) == 1 else gl.sh.multipolygons(partes)
            self.aei_aerea = gl.Polygon(self.utm(gl.sh.box(*AEI_TRANSPORTE_AEREO).exterior.coords))

    def contorno(self, caixa, cor, tolerancia):
        rgb = gl.np.asarray(self.imagem.crop(caixa)).astype(float)
        yy, xx = gl.np.where(gl.np.linalg.norm(rgb - cor, axis=-1) <= tolerancia)
        return gl.np.column_stack([xx + caixa[0] + .5, yy + caixa[1] + .5])

    def ler_cones(self):
        # shortcut: os dois cones e a pista entre eles num contorno convexo só (o vão y=5380..5850 ficava
        # descoberto, AUDITORIA-6); maior que o desenho, nunca menor. Revalidar as janelas se a fonte mudar.
        pontos = [self.contorno(caixa, [97, 19, 190], 18) for caixa in ((4700, 2650, 5720, 5380), (4650, 5850, 5620, 8560))]
        for p in pontos:
            if len(p) < 1000 or gl.np.ptp(p[:, 0]) < 800 or gl.np.ptp(p[:, 1]) < 2500:
                raise ValueError("Contorno tracejado do gabarito aeronáutico não recuperado")
        return gl.Polygon(self.utm(gl.sh.MultiPoint(gl.np.vstack(pontos)).convex_hull.exterior.coords))

    def ler_subarea(self):
        # shortcut: contorno convexo do tracejado magenta no Centro (maior que a subárea, nunca menor).
        p = self.contorno(*SUBAREA_GABARITO, 30)
        if len(p) < 3000 or gl.np.ptp(p[:, 0]) < 400 or gl.np.ptp(p[:, 1]) < 700:
            raise ValueError("Contorno tracejado da Subárea de Restrição de Gabarito não recuperado")
        return gl.Polygon(self.utm(gl.sh.MultiPoint(p).convex_hull.exterior.coords))

    def perto(self, pol, alvo, margem_m, tipo, nome, motivo):
        d = pol.distance(alvo)
        if d > margem_m:
            return []
        return [registro(self.anexo, tipo, nome, "possivel_incidencia", motivo, self.divisa_m,
                         distancia_conservadora_m=round(max(0.0, d - 4/self.escala_min), 2))]

    def ler(self, pol):
        pix = gl.Polygon(self.pixel(pol.exterior.coords))
        margem_m = self.divisa_m + 4/self.escala_min
        margem = margem_m*self.escala_max + 2
        x0, y0, x1, y1 = pix.bounds
        caixa = (int(gl.np.floor(x0-margem)), int(gl.np.floor(y0-margem)),
                 int(gl.np.ceil(x1+margem)), int(gl.np.ceil(y1+margem)))
        quadro = gl.sh.box(250, 100, 8750, 10550 if self.anexo != "06" else 10450)
        janela = gl.sh.box(*caixa)
        if pol.area > 1_000_000 or (caixa[2]-caixa[0])*(caixa[3]-caixa[1]) > 2_000_000:
            return [nao_verificada(self.anexo, f"Lote grande demais para a leitura local ({pol.area:,.0f} m²; limite "
                                   "1 km² e 2 milhões de pixels): conferir a gleba no mapa", self.divisa_m)]
        if (not quadro.covers(janela)
                or (self.anexo == "06" and janela.intersects(gl.sh.box(250, 9900, 1900, 12746)))
                or (self.anexo == "07" and janela.intersects(gl.sh.box(250, 100, 3400, 8400)))):
            return [nao_verificada(self.anexo, "Fora do quadro georreferenciado, em encarte ou legenda", self.divisa_m)]
        rgb = gl.np.asarray(self.imagem.crop(caixa))
        classes = self.codigo[classificar(rgb, self.paleta)]
        for codigo, (*_, tipo, _) in enumerate(self.legenda, 1):
            if tipo in SO_MANCHA:
                classes[(classes == codigo) & ~mancha(classes == codigo, 5)] = 0
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
                                      "Cor da legenda no lote" if dentro else f"Possível incidência, confirmar: mancha a até ~{self.divisa_m:g} m",
                                      self.divisa_m, distancia_conservadora_m=round(d, 2), pixels_no_lote=int((cor & interior).sum())))
        if self.anexo == "06":
            resultado += self.perto(pol, self.subarea, margem_m, "restricao_gabarito_historico",
                                    "Subárea Especial de Restrição de Gabarito (art. 80: 9 m)",
                                    "Possível incidência, não verificada: dentro ou perto do contorno convexo do tracejado magenta")
        if self.anexo == "07":
            resultado += self.perto(pol, self.cones, margem_m, "gabarito_aeronautico",
                                    "Superfícies de aproximação e decolagem do Aeroporto Mário Pereira Lopes",
                                    "Possível incidência, confirmar: interior ou proximidade do contorno dos cones e da pista; consultar DECEA")
            resultado += self.perto(pol, self.aei_aerea, margem_m, "transporte_aereo",
                                    "AEI do Transporte Aéreo (itens 09, 10 e 11)",
                                    "Possível incidência, não verificada: hachura sem cor própria, lida pelo retângulo que a envolve")
        if interior.sum() < 3 or (leitura.ravel()[proximos] == 0).any():
            resultado.append(nao_verificada(self.anexo, "Cor encoberta/sem correspondência segura no lote ou margem de "
                                            f"~{self.divisa_m:g} m, ou resolução insuficiente", self.divisa_m))
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
        if not resultado:
            # Lista vazia não pode virar silêncio: o motor alerta todo registro sem altura e o resumo do
            # estudar.py lista os "nao_verificada", então "nada encontrado" sai como ressalva explícita.
            resultado.append(registro("05/06/07", "nao_verificada", NADA_ENCONTRADO, "nao_verificada",
                                      "Leitura automática sem cor da legenda nem cone no lote e na margem de ~10 a 12 m",
                                      evidencia="dados/zonas-mapas/anexo05.jpg, anexo06.jpg e anexo07.jpg; "
                                                "centros dos pixels do lote e margem de 10 a 12 m + 4 pixels"))
        return resultado
