"""Lote do cadastro, sem alterar fontes ou pilotos.

python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 30516 --zona SC-Z4 --saida lote.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 19 --zona auto --saida lote.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 90050 --zona auto:SC-Z3 --saida lote.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --ponto "-22.0123, -47.8901" --listar-vizinhos
python -I -X utf8 viabilidade/terreno/novo_lote.py --testar

Índices começam em zero. Coordenadas: seis casas; área: três, como os pilotos.
LID, categoria, anotação de zoneamento e metadados manuais dos pilotos são omitidos.
Áreas especiais são triadas nos Anexos 05/06/07, sem certificar restrições legais.
"""
import argparse
import json
import math
from pathlib import Path
import re
import sys
import tempfile

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import cache
import gerar_lotes as gl
import preparar_relevo as relevo
from affine import Affine  # do rasterio, sem o custo de importar o rasterio
import pyproj  # gerar_lotes já pôs o site do usuário no caminho

DIVISA_PONTO_M = 0.5  # ponto mais perto que isso de duas feições não escolhe sozinho (AUDITORIA-6, achado 11)

OSM_VIAS = AQUI / "dados/osm-vias-sao-carlos.json.gz"  # osm_vias.py; © OpenStreetMap contributors (ODbL)
BASES = {"completo": gl.BASES[1], "antigo": gl.BASES[0]}
DESNIVEL_RAIO_M, DESNIVEL_GRADE_M = 25, 3  # os números do via.py da T26 do Motor
METODO_DESNIVEL = ("Copernicus GLO-30 (DSM de ~30 m: mede topo de prédio e árvore): cota no centroide do lote menos a mediana "
                   "das cotas do asfalto da malha a até 25 m da frente principal (grade de 3 m mais um ponto por pedaço). Só triagem: entre "
                   "fontes a diferença lote-rua variou mediana 0,6 m e p90 1,5 m (T26); não substitui levantamento planialtimétrico.")


def ler_ponto(texto):
    """Texto lat, lon em WGS84 → ponto em EPSG:31983, dentro do recorte do projeto."""
    numero = r"[+-]?\d+(?:\.\d+)?"
    if not re.fullmatch(rf"\s*{numero}\s*,\s*{numero}\s*", texto):
        raise ValueError('Ponto inválido: use "latitude, longitude", com ponto decimal, como "-22.0123, -47.8901"; não use vírgula decimal')
    lat, lon = map(float, texto.split(","))
    oeste, sul, leste, norte = gl.CONFIG["bbox"]
    if oeste <= lat <= leste and sul <= lon <= norte:
        raise ValueError('Coordenadas invertidas (longitude, latitude): use "latitude, longitude"')
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Coordenadas inválidas: latitude entre -90 e 90, longitude entre -180 e 180")
    # shortcut: recorte local, não limite municipal; substituir quando houver polígono oficial no projeto.
    if not (oeste <= lon <= leste and sul <= lat <= norte):
        raise ValueError("Ponto fora da área de São Carlos coberta pelo projeto (recorte de dados, não limite municipal)")
    return gl.Point(gl.UTM.transform(lon, lat))


def validar_zona(zona, *, permitir_auto=False):
    if zona == "auto" and permitir_auto:
        return
    if permitir_auto and zona.startswith("auto:"):  # candidata na divisa (T23); gerar() confere a lista
        zona = zona[5:]
    validas = sorted(z["id"] for z in gl.ler("viabilidade/lei/zonas.json"))
    if zona not in validas:
        raise ValueError(f"Zona inexistente: {zona!r}. Zonas válidas: {', '.join(validas)}")


def desnivel_lote_rua(g, frente, altura, malha, tree_ruas):
    """Cota do lote menos a da rua em frente (m, 0,1), pelo método da T26; None sem asfalto perto ou sem raster.

    A grade de 3 m da T26 cai pouco na malha (triângulos finos e picotados: 4 pontos no 22421), então cada pedaço de
    asfalto a até 25 m da frente também dá um ponto."""
    perto = gl.LineString(frente).buffer(DESNIVEL_RAIO_M).difference(g.buffer(1))
    x0, y0, x1, y1 = perto.bounds
    X, Y = gl.np.meshgrid(gl.np.arange(x0, x1, DESNIVEL_GRADE_M), gl.np.arange(y0, y1, DESNIVEL_GRADE_M))
    pts = gl.sh.points(X.ravel(), Y.ravel())
    pts = pts[gl.sh.contains(perto, pts)]
    pts = list(pts[gl.np.unique(tree_ruas.query(pts, predicate="within")[0])])
    pedacos = (malha[k].intersection(perto) for k in tree_ruas.query(perto, predicate="intersects"))
    pts += [p.representative_point() for p in pedacos if p.area > 0]
    if not pts:
        return None
    try:
        c = g.centroid
        return round(altura(c.x, c.y) - float(gl.np.median([altura(p.x, p.y) for p in pts])), 1) + 0.0
    except ValueError:  # fora do recorte de relevo ou pixel sem dado
        return None


def unir(partes):
    for i, p in enumerate(partes):
        # anel com buraco só entra junto do miolo que o fecha; a união é conferida abaixo
        if p.geom_type != "Polygon" or p.is_empty or not p.is_valid or (p.interiors and len(partes) == 1):
            raise ValueError(f"Componente {i + 1}: exige polígono válido, não vazio e sem buracos")
    if len(partes) == 1:
        return partes[0]  # preserva a ordem das arestas usada pelos pilotos de um lote só
    contatos = [set() for _ in partes]
    for i, p in enumerate(partes):
        for j in range(i):
            if p.intersection(partes[j]).area > 1e-6:
                raise ValueError("Remembramento: componentes se sobrepõem (mais de 1e-6 m²)")
            if p.intersects(partes[j]):
                contatos[i].add(j)
                contatos[j].add(i)
    ligados, fila = {0}, [0]
    while fila:
        for j in contatos[fila.pop()] - ligados:
            ligados.add(j)
            fila.append(j)
    if len(ligados) != len(partes):
        raise ValueError("Remembramento: índices não se tocam; há componentes separados")
    uniao = gl.sh.union_all(partes)
    if uniao.geom_type != "Polygon" or not uniao.is_valid or uniao.interiors:
        raise ValueError("Remembramento: a união deve ser um polígono só, válido e sem buracos")
    return uniao


class Cadastro:
    def __init__(self, base):
        if base not in BASES:
            raise ValueError("Base inválida: use completo ou antigo")
        self.base = base
        # Ler o GeoJSON e montar os polígonos levava ~7 s; o cache em .cache/ volta o mesmo array.
        codigo = [AQUI / "novo_lote.py", AQUI / "gerar_lotes.py"]
        versoes = f"pyproj {pyproj.__version__}; PROJ {pyproj.proj_version_str}"
        self.geos = cache.poligonos(f"base-{base}", [gl.ROOT / BASES[base], *codigo], lambda: gl.sh.transform(
            gl.np.array([gl.shape(f["geometry"]) for f in gl.ler(BASES[base])["features"]], dtype=object),
            gl.UTM.transform, interleaved=False), versoes)
        self.tree = gl.sh.STRtree(self.geos)
        self.malha = cache.poligonos("ruas", [gl.ROOT / "sao-carlos/dados/street_tris.json", *codigo],
                                     lambda: gl.ruas()[0], versoes)
        self.tree_ruas = gl.sh.STRtree(self.malha)
        if relevo.sha(relevo.RASTER) != relevo.ler(relevo.META)["sha256"]:
            raise ValueError("Raster Copernicus diferente do documentado; conferir os arquivos de relevo")
        def montar_raster():
            import rasterio
            with rasterio.open(relevo.RASTER) as src:
                if src.crs.to_epsg() != 4326:
                    raise ValueError("Raster Copernicus deve estar em EPSG:4326")
                return {"matriz": src.read(1), "transform": gl.np.array(src.transform[:6])}
        # GeoTIFF float32 sem perda: o sha256 do arquivo basta; sem o cache, importar rasterio custava ~0,2 s.
        with cache.carregar("relevo", [relevo.RASTER, AQUI / "novo_lote.py"], montar_raster) as r:
            self.matriz, self.transform = r["matriz"], Affine(*r["transform"])

    def altura(self, x, y):
        lon, lat = gl.GEO.transform(x, y)
        col, lin = ~self.transform * (lon, lat)
        return relevo.bilinear(self.matriz, col - 0.5, lin - 0.5)

    def localizar(self, ponto):
        """Encontra um único interior; divisas, sobreposições e lacunas exigem escolha explícita."""
        contatos = sorted(map(int, self.tree.query(ponto, predicate="intersects")))
        invalidos = [i for i in contatos if not self.geos[i].is_valid]
        if invalidos:
            raise ValueError(f"Ponto em geometria inválida na base {self.base}: índices {invalidos}; conferir antes de usar --indices")
        dentro = sorted(map(int, self.tree.query(ponto, predicate="within")))
        if len(contatos) > 1 and dentro:
            raise ValueError(f"Sobreposição/divisa na base {self.base}: índices {contatos}; "
                             f"contêm o ponto no interior: {dentro}. Confira e informe --indices; nenhuma feição escolhida")
        divisa = sorted(map(int, self.tree.query(ponto, predicate="dwithin", distance=DIVISA_PONTO_M)))
        if len(divisa) > 1:
            raise ValueError(f"Ponto a menos de {DIVISA_PONTO_M} m da divisa na base {self.base}: índices {divisa}; "
                             "coordenada arredondada pode cair em qualquer um. Confira e informe --indices; nenhuma feição escolhida")
        if len(dentro) == 1:
            return dentro[0]
        cercam = [int(i) for i in self.tree.query(ponto) if gl.Polygon(self.geos[i].exterior).contains(ponto)]
        if cercam:
            raise ValueError(f"Ponto no buraco interno da feição {cercam} na base {self.base}: {self.buracos(cercam[0])}")
        distancias = gl.sh.distance(self.geos, ponto)
        indices = gl.np.lexsort((gl.np.arange(len(self.geos)), distancias))[:3]
        proximas = "; ".join(f"índice {i}: {distancias[i]:.3f} m" for i in indices)
        raise ValueError(f"Nenhuma feição contém o ponto no interior na base {self.base} (rua, lacuna ou divisa). "
                         f"As 3 mais próximas, distância ao polígono: {proximas}. Confira e informe --indices; nenhuma feição escolhida")

    def buracos(self, indice):
        """Diz o que ocupa o buraco do anel (condomínio/gleba com miolo cadastrado à parte)."""
        anel = self.geos[indice]
        miolos = []
        for furo in anel.interiors:
            furo = gl.Polygon(furo)
            miolos += sorted(int(i) for i in self.tree.query(furo, predicate="intersects")
                             if i != indice and furo.intersection(self.geos[i]).area > 1)
        if miolos:
            return (f"a feição {indice} tem {len(anel.interiors)} buraco(s) ocupado(s) pelos índices {miolos}. "
                    f"Para o terreno inteiro, junte tudo: --indices {indice} {' '.join(map(str, miolos))}; "
                    "para só o miolo, use o índice dele. Lote grande pode passar de 1 km² e sair 'não verificada'")
        return (f"a feição {indice} tem {len(anel.interiors)} buraco(s) sem lote cadastrado dentro (praça, área "
                "comum ou falha da base): não dá para estudar o anel sozinho; conferir a planta do loteamento")

    def listar_vizinhos(self, indice):
        vizinhos = sorted(map(int, self.tree.query(self.geos[indice], predicate="touches")))
        print(f"Base {self.base}; índices começam em zero. Contato não comprova aptidão para remembramento.")
        for i in [indice, *vizinhos]:
            print(f"{'Feição achada' if i == indice else 'Vizinha'}: índice {i}; área {self.geos[i].area:.3f} m²")
        if not vizinhos:
            print("Nenhuma vizinha encosta na feição.")
        if self.geos[indice].interiors:
            print(f"AVISO: {self.buracos(indice)}.")

    def vias_osm(self):
        if not hasattr(self, "_osm"):
            self._osm = gl.vias_osm(OSM_VIAS, self.tree_ruas)
        return self._osm

    def motivo_recusa(self, g, indice, geos, tree):
        # avaliar() não expõe o motivo; diagnosticamos seus filtros sem repetir a seleção de frente.
        vizinhos = tree.query(g, predicate="intersects")
        vizinhos = vizinhos[vizinhos != indice]
        for k in vizinhos:
            area = g.intersection(geos[k]).area
            if area > 0.1:
                return f"Lote se sobrepõe ao vizinho de índice {k}: {area:.3f} m² (limite 0,1 m²)"
        perto = self.tree_ruas.query(g.buffer(12), predicate="intersects")
        rua = gl.sh.union_all(self.malha[perto])
        invasao = g.intersection(rua).area / g.area
        if not rua.is_empty and invasao > 0.02:
            return f"Lote invade o asfalto: {invasao:.2%} da área (limite 2%)"
        d = float(self.tree_ruas.query_nearest(g, return_distance=True)[1][0])
        return ("Lote sem frente para rua: nenhum lado de pelo menos 8 m a até 6 m do asfalto (nem juntando arestas "
                f"colineares, nem até {gl.TOLERANCIA_M} m sem lote no meio, nem pela borda da quadra com vão de 8 a 30 m "
                f"até a quadra da frente ligado ao asfalto, nem por rua do OSM a até {gl.OSM_EIXO_M} m e paralela); o asfalto mais próximo da malha está a {d:.1f} m. "
                "A malha de ruas tem buracos: se o lote dá pra rua, informe outro lote ou confira a base")

    def gerar(self, indices, zona):
        validar_zona(zona, permitir_auto=True)
        if not indices or any(type(i) is not int or i < 0 or i >= len(self.geos) for i in indices):
            raise ValueError(f"Índice inexistente: use índices inteiros entre 0 e {len(self.geos) - 1}")
        if len(set(indices)) != len(indices):
            raise ValueError("Índices repetidos: cada feição deve aparecer uma vez")
        indices = sorted(indices)
        furados = [i for i in indices if self.geos[i].interiors]
        if furados:
            uniao = gl.sh.union_all([self.geos[i] for i in indices])
            if uniao.geom_type != "Polygon" or uniao.interiors:
                raise ValueError(f"Polígono com buraco: {self.buracos(furados[0])}")
        g = unir([self.geos[i] for i in indices])
        geos, tree, indice = self.geos, self.tree, indices[0]
        if len(indices) > 1:
            geos = self.geos.copy()
            geos[indices] = gl.Polygon()  # componentes da união não são vizinhos externos
            tree, indice = gl.sh.STRtree(geos), -1
        # Vizinho inválido no cadastro (laço, anel torto): conserta com make_valid só para cruzar com o lote estudado,
        # que não muda. Se o conserto mexer na área mais de 1%, o desenho do vizinho é duvidoso demais: recusa.
        consertados = {}
        for k in map(int, tree.query(g, predicate="intersects")):
            if geos[k].is_valid:
                continue
            valido = gl.sh.make_valid(geos[k])
            mudou = abs(valido.area - geos[k].area) / geos[k].area if geos[k].area > 0 else math.inf
            if mudou > 0.01:
                raise ValueError(f"Não foi possível validar sobreposição: o vizinho de índice {k} tem geometria inválida "
                                 f"({gl.sh.is_valid_reason(geos[k])}) e consertá-la muda a área em {mudou:.1%} (limite 1%)")
            consertados[k] = (valido, mudou)
        if consertados:
            geos = geos.copy()
            for k, (valido, _) in consertados.items():
                geos[k] = valido
            tree = gl.sh.STRtree(geos)
        qualidade = gl.avaliar(g, indice, geos, tree, self.malha, self.tree_ruas, ampliar=True, osm=self.vias_osm)
        if qualidade is None:
            raise ValueError(self.motivo_recusa(g, indice, geos, tree))
        coords = [[round(x, 6), round(y, 6)] for x, y in g.exterior.coords]
        pol = gl.Polygon(coords)
        if not pol.is_valid or pol.area <= 0:
            raise ValueError("Polígono inválido após arredondamento das coordenadas")
        escolhida = qualidade["frentes"][0]
        arestas = escolhida.get("arestas", [escolhida["aresta"]])
        resumo = relevo.resumir(coords, (pol.centroid.x, pol.centroid.y), self.altura)
        desnivel = desnivel_lote_rua(pol, [coords[arestas[0]], coords[arestas[-1] + 1]], self.altura, self.malha, self.tree_ruas)
        if desnivel is not None:
            resumo.update(desnivel_lote_rua_m=desnivel, metodo_desnivel=METODO_DESNIVEL)
        obs = ("Geometria de ensaio derivada do cadastro/maquete, sem vistoria. Zona informada pelo usuário, não conferida. "
               "Frente inferida da malha de asfalto, por comprimento decrescente e índice da aresta. "
               "Áreas especiais: triagem raster dos Anexos 05/06/07, confirmar incidências e pendências em areas_especiais. "
               "Restrições do loteamento não verificadas. ")
        if len(qualidade["frentes"]) > 1:
            obs += "Há mais de uma frente candidata; as demais constam em qualidade.frentes. "
        if escolhida.get("regra") == "arestas_colineares":
            obs += f"Frente juntando {len(arestas)} arestas colineares contíguas ({arestas}), a até 6 m do asfalto. "
        elif escolhida.get("regra") == "borda_de_quadra":
            obs += (f"AVISO: frente presumida pela borda da quadra (sem asfalto no mapa): o lado dá para um vão de "
                    f"{escolhida['largura_vao_m']:g} m sem lote até a quadra da frente, e o asfalto mais próximo da malha "
                    f"está a {escolhida['distancia_max_asfalto_m']:g} m. Conferir no local que o vão é rua com acesso. ")
        elif escolhida.get("regra") == "rua_osm":
            via = escolhida["via_osm"]
            obs += (f"AVISO: frente pela rua do OSM ({via['nome'] or 'sem nome'}, way {via['id']}, {via['classe']}): o lado fica a "
                    f"{escolhida['distancia_eixo_osm_m']:g} m do eixo da via e a {escolhida['angulo_via_graus']:g}° dela, sem asfalto "
                    "na malha. O OSM indica uma frente provável, mas não prova testada legal nem acesso público "
                    f"(dados © OpenStreetMap contributors, ODbL, extrato de {via['data_osm'][:10]}). ")
            if len(qualidade["frentes"]) > 1:
                obs += "ALERTA: frente pela rua do OSM, conferir qual é a testada. "
        elif escolhida.get("regra"):
            obs += (f"AVISO: frente presumida, asfalto da malha a até {escolhida['distancia_max_asfalto_m']:g} m "
                    f"(acima dos 6 m da regra; sem lote entre o lado e o asfalto). A malha de ruas tem buracos: conferir no local. ")
        if consertados:
            qualidade["vizinhos_consertados"] = [{"indice": k, "mudanca_area": round(m, 6)} for k, (_, m) in consertados.items()]
            obs += (f"Vizinho(s) {sorted(consertados)} com geometria inválida no cadastro, consertado(s) com make_valid "
                    "só para conferir sobreposição e frente (área mudou até 1%); o lote estudado não muda. ")
        if qualidade["esquina_indicada_pela_malha"]:
            obs += "Esquina indicada pela malha de ruas, sem confirmação em campo. "
        lote = {"id": f"SC-{self.base}-{'-'.join(map(str, indices))}", "poligono_utm": coords,
                "frente": [coords[arestas[0]], coords[arestas[-1] + 1]], "area_m2": round(pol.area, 3),
                "crs": "EPSG:31983", "zona_id": zona, "zona_origem": "informada_pelo_usuario",
                "zona_conferida": False, "conferido": False, "relevo": resumo,
                "fonte": {"base": self.base, "arquivo": BASES[self.base], "indices_feicoes_zero_based": indices},
                "qualidade": qualidade, "observacoes": obs + relevo.AVISO}
        if zona.startswith("auto"):
            from sugerir_zona import MapaZonas, ZonaIncerta
            if not hasattr(self, "mapa_zonas"):
                self.mapa_zonas = MapaZonas()
        if zona == "auto":
            lote["zona_id"], lote["zona_sugestao"] = self.mapa_zonas.sugerir(pol)
            lote["zona_origem"] = "sugerida_pelo_mapa"
            lote["observacoes"] = lote["observacoes"].replace("Zona informada pelo usuário", "Zona sugerida pelo mapa")
        elif zona.startswith("auto:"):
            try:
                self.mapa_zonas.sugerir(pol)
            except ZonaIncerta as erro:
                s = erro.sugestao
            else:
                raise ValueError("O mapa não tem dúvida de zona neste lote: use --zona auto")
            if zona[5:] not in s["candidatas"]:
                raise ValueError(f"Zona {zona[5:]} fora das candidatas na divisa "
                                 f"({', '.join(s['candidatas']) or 'nenhuma: ' + s['motivo_duvida']})")
            lote["zona_id"], lote["zona_sugestao"], lote["zona_origem"] = zona[5:], s, "candidata_na_divisa"
            lote["observacoes"] = lote["observacoes"].replace(
                "Zona informada pelo usuário, não conferida.",
                f"Zona {zona[5:]} é uma das candidatas na divisa ({', '.join(s['candidatas'])}; divisa a "
                f"{s['distancia_divisa_m']:g} m, distância conservadora): confirmar a zona na Prefeitura.")
        from areas_especiais import AreasEspeciais
        if not hasattr(self, "areas_especiais"):
            self.areas_especiais = AreasEspeciais()
        lote["areas_especiais"] = self.areas_especiais.ler(pol)
        return lote


def gravar(saida, lote):
    saida = Path(saida)
    saida.parent.mkdir(parents=True, exist_ok=True)
    temporario = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=saida.parent, delete=False) as f:
            temporario = Path(f.name)
            json.dump(lote, f, ensure_ascii=False, indent=2, allow_nan=False)
            f.write("\n")
        temporario.replace(saida)
    finally:
        if temporario is not None:
            temporario.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", choices=BASES)
    selecao = parser.add_mutually_exclusive_group()
    selecao.add_argument("--indices", type=int, nargs="+")
    selecao.add_argument("--ponto", help='Latitude, longitude (WGS84), com ponto decimal')
    parser.add_argument("--listar-vizinhos", action="store_true", help="Só lista a feição e os contatos; exige --ponto")
    parser.add_argument("--zona")
    parser.add_argument("--saida", type=Path)
    parser.add_argument("--testar", action="store_true")
    argv = sys.argv[1:]
    # argparse confunde coordenada negativa sem espaço com uma opção.
    if "--ponto" in argv:
        i = argv.index("--ponto")
        if i + 1 < len(argv) and not argv[i+1].startswith("--"):
            argv[i:i+2] = [f"--ponto={argv[i+1]}"]
    args = parser.parse_args(argv)
    if args.testar:
        if any((args.base, args.indices, args.ponto, args.listar_vizinhos, args.zona, args.saida)):
            parser.error("--testar não aceita argumentos de geração")
        from test_novo_lote import testar
        testar()
        return
    if args.base is None or (args.indices is None and args.ponto is None):
        parser.error("Exige --base e uma seleção: --indices ou --ponto")
    if args.listar_vizinhos:
        if args.ponto is None or args.zona is not None or args.saida is not None:
            parser.error("--listar-vizinhos exige --ponto e não usa --zona nem --saida")
    elif args.zona is None or args.saida is None:
        parser.error("Geração exige --zona e --saida; para apenas consultar use --ponto com --listar-vizinhos")
    try:
        ponto = ler_ponto(args.ponto) if args.ponto is not None else None
        if not args.listar_vizinhos:
            validar_zona(args.zona, permitir_auto=True)
        cadastro = Cadastro(args.base)
        indices = [cadastro.localizar(ponto)] if ponto is not None else args.indices
        if args.listar_vizinhos:
            cadastro.listar_vizinhos(indices[0])
            return
        lote = cadastro.gerar(indices, args.zona)
        gravar(args.saida, lote)
    except (ValueError, OSError, gl.sh.errors.GEOSException) as erro:
        parser.exit(2, f"Erro: {erro}\n")
    print(f"{lote['id']}: {lote['area_m2']:.3f} m²; gravado em {args.saida}")


if __name__ == "__main__":
    main()
