"""Lote do cadastro, sem alterar fontes ou pilotos.

python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 30516 --zona SC-Z4 --saida lote.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --base completo --indices 19 --zona auto --saida lote.json
python -I -X utf8 viabilidade/terreno/novo_lote.py --testar

Índices começam em zero. Coordenadas: seis casas; área: três, como os pilotos.
LID, categoria, anotação de zoneamento e metadados manuais dos pilotos são omitidos.
Áreas especiais são triadas nos Anexos 05/06/07, sem certificar restrições legais.
"""
import argparse
import json
from pathlib import Path
import sys
import tempfile

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import gerar_lotes as gl
import preparar_relevo as relevo

BASES = {"completo": gl.BASES[1], "antigo": gl.BASES[0]}


def validar_zona(zona, *, permitir_auto=False):
    if zona == "auto" and permitir_auto:
        return
    validas = sorted(z["id"] for z in gl.ler("viabilidade/lei/zonas.json"))
    if zona not in validas:
        raise ValueError(f"Zona inexistente: {zona!r}. Zonas válidas: {', '.join(validas)}")


def unir(partes):
    for i, p in enumerate(partes):
        if p.geom_type != "Polygon" or p.is_empty or not p.is_valid or p.interiors:
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
        features = gl.ler(BASES[base])["features"]
        self.geos = gl.sh.transform(gl.np.array([gl.shape(f["geometry"]) for f in features], dtype=object),
                                    gl.UTM.transform, interleaved=False)
        self.tree = gl.sh.STRtree(self.geos)
        self.malha, _ = gl.ruas()
        self.tree_ruas = gl.sh.STRtree(self.malha)
        if relevo.sha(relevo.RASTER) != relevo.ler(relevo.META)["sha256"]:
            raise ValueError("Raster Copernicus diferente do documentado; conferir os arquivos de relevo")
        with relevo.rasterio.open(relevo.RASTER) as src:
            if src.crs.to_epsg() != 4326:
                raise ValueError("Raster Copernicus deve estar em EPSG:4326")
            self.matriz, self.transform = src.read(1), src.transform

    def altura(self, x, y):
        lon, lat = gl.GEO.transform(x, y)
        col, lin = ~self.transform * (lon, lat)
        return relevo.bilinear(self.matriz, col - 0.5, lin - 0.5)

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
        return "Lote sem frente para rua: nenhuma aresta de pelo menos 8 m aprovada por avaliar() a até 6 m do asfalto"

    def gerar(self, indices, zona):
        validar_zona(zona, permitir_auto=True)
        if not indices or any(type(i) is not int or i < 0 or i >= len(self.geos) for i in indices):
            raise ValueError(f"Índice inexistente: use índices inteiros entre 0 e {len(self.geos) - 1}")
        if len(set(indices)) != len(indices):
            raise ValueError("Índices repetidos: cada feição deve aparecer uma vez")
        indices = sorted(indices)
        g = unir([self.geos[i] for i in indices])
        geos, tree, indice = self.geos, self.tree, indices[0]
        if len(indices) > 1:
            geos = self.geos.copy()
            geos[indices] = gl.Polygon()  # componentes da união não são vizinhos externos
            tree, indice = gl.sh.STRtree(geos), -1
        vizinhos = tree.query(g, predicate="intersects")
        invalidos = [int(k) for k in vizinhos if not geos[k].is_valid]
        if invalidos:
            raise ValueError(f"Não foi possível validar sobreposição: vizinhos com geometria inválida {invalidos}")
        qualidade = gl.avaliar(g, indice, geos, tree, self.malha, self.tree_ruas)
        if qualidade is None:
            raise ValueError(self.motivo_recusa(g, indice, geos, tree))
        coords = [[round(x, 6), round(y, 6)] for x, y in g.exterior.coords]
        pol = gl.Polygon(coords)
        if not pol.is_valid or pol.area <= 0:
            raise ValueError("Polígono inválido após arredondamento das coordenadas")
        aresta = qualidade["frentes"][0]["aresta"]
        resumo = relevo.resumir(coords, (pol.centroid.x, pol.centroid.y), self.altura)
        obs = ("Geometria de ensaio derivada do cadastro/maquete, sem vistoria. Zona informada pelo usuário, não conferida. "
               "Frente inferida da malha de asfalto, por comprimento decrescente e índice da aresta. "
               "Áreas especiais: triagem raster dos Anexos 05/06/07, confirmar incidências e pendências em areas_especiais. "
               "Restrições do loteamento não verificadas. ")
        if len(qualidade["frentes"]) > 1:
            obs += "Há mais de uma frente candidata; as demais constam em qualidade.frentes. "
        if qualidade["esquina_indicada_pela_malha"]:
            obs += "Esquina indicada pela malha de ruas, sem confirmação em campo. "
        lote = {"id": f"SC-{self.base}-{'-'.join(map(str, indices))}", "poligono_utm": coords,
                "frente": [coords[aresta], coords[aresta + 1]], "area_m2": round(pol.area, 3),
                "crs": "EPSG:31983", "zona_id": zona, "zona_origem": "informada_pelo_usuario",
                "zona_conferida": False, "conferido": False, "relevo": resumo,
                "fonte": {"base": self.base, "arquivo": BASES[self.base], "indices_feicoes_zero_based": indices},
                "qualidade": qualidade, "observacoes": obs + relevo.AVISO}
        if zona == "auto":
            from sugerir_zona import MapaZonas
            if not hasattr(self, "mapa_zonas"):
                self.mapa_zonas = MapaZonas()
            lote["zona_id"], lote["zona_sugestao"] = self.mapa_zonas.sugerir(pol)
            lote["zona_origem"] = "sugerida_pelo_mapa"
            lote["observacoes"] = lote["observacoes"].replace("Zona informada pelo usuário", "Zona sugerida pelo mapa")
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
    parser.add_argument("--indices", type=int, nargs="+")
    parser.add_argument("--zona")
    parser.add_argument("--saida", type=Path)
    parser.add_argument("--testar", action="store_true")
    args = parser.parse_args()
    if args.testar:
        if any((args.base, args.indices, args.zona, args.saida)):
            parser.error("--testar não aceita argumentos de geração")
        from test_novo_lote import testar
        testar()
        return
    if any(x is None for x in (args.base, args.indices, args.zona, args.saida)):
        parser.error("Geração exige --base, --indices, --zona e --saida")
    try:
        validar_zona(args.zona, permitir_auto=True)
        lote = Cadastro(args.base).gerar(args.indices, args.zona)
        gravar(args.saida, lote)
    except (ValueError, OSError, gl.sh.errors.GEOSException) as erro:
        parser.exit(2, f"Erro: {erro}\n")
    print(f"{lote['id']}: {lote['area_m2']:.3f} m²; gravado em {args.saida}")


if __name__ == "__main__":
    main()
