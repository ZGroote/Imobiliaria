"""Vitrine: os terrenos piloto prontos para a tela. Só dados; a tela não calcula nada.

    python -I -X utf8 viabilidade/projetista/vitrine.py <pasta-saida> [--pilotos <pasta>]

Para cada piloto: gerador (6 unidades por andar; se não couber, tenta 5, 4... até 2) -> torre sem e com térreo
-> prévia (estudo) -> coordenadas WGS84 [lon, lat]. Um piloto que falha vira `falhou` com motivo e não derruba os outros.
Nenhum dado pessoal: só geometria e números do próprio piloto (o piloto não traz nome, CPF nem endereço de pessoa).
"""
import argparse
import json
import math
import os
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.editor import EdicaoRecusada
from viabilidade.projetista.gerador import gerar_pavimento
from viabilidade.projetista.para_vista import revisao_para_estudo, serializar as serializar_estudo
from viabilidade.projetista.torre import compor

PILOTOS = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos"
PROGRAMAS = (6, 5, 4, 3, 2)  # unidades por andar, da mais cheia para a mais enxuta
# UTM 23S, SIRGAS 2000 (EPSG:31983): GRS80, meridiano central -45°, k0 0,9996, FE 500000, FN 10000000.
# Série de Krüger (6ª ordem, erro de nanômetros). Sem pyproj: o `python -I` não enxerga pacotes do usuário.
_A, _F, _K0, _FE, _FN, _L0 = 6378137.0, 1 / 298.257222101, 0.9996, 500000.0, 10000000.0, math.radians(-45)
_N = _F / (2 - _F)
_AA = _A / (1 + _N) * (1 + _N**2 / 4 + _N**4 / 64 + _N**6 / 256)
_n = _N
_BETA = (_n/2 - 2*_n**2/3 + 37*_n**3/96 - _n**4/360 - 81*_n**5/512 + 96199*_n**6/604800,
         _n**2/48 + _n**3/15 - 437*_n**4/1440 + 46*_n**5/105 - 1118711*_n**6/3870720,
         17*_n**3/480 - 37*_n**4/840 - 209*_n**5/4480 + 5569*_n**6/90720,
         4397*_n**4/161280 - 11*_n**5/504 - 830251*_n**6/7257600,
         4583*_n**5/161280 - 108847*_n**6/3991680, 20648693*_n**6/638668800)
_DELTA = (2*_n - 2*_n**2/3 - 2*_n**3 + 116*_n**4/45 + 26*_n**5/45 - 2854*_n**6/675,
          7*_n**2/3 - 8*_n**3/5 - 227*_n**4/45 + 2704*_n**5/315 + 2323*_n**6/945,
          56*_n**3/15 - 136*_n**4/35 - 1262*_n**5/105 + 73814*_n**6/2835,
          4279*_n**4/630 - 332*_n**5/35 - 399572*_n**6/14175,
          4174*_n**5/315 - 144838*_n**6/6237, 601676*_n**6/22275)
_ALFA = (_n/2 - 2*_n**2/3 + 5*_n**3/16 + 41*_n**4/180 - 127*_n**5/288 + 7891*_n**6/37800,
         13*_n**2/48 - 3*_n**3/5 + 557*_n**4/1440 + 281*_n**5/630 - 1983433*_n**6/1935360,
         61*_n**3/240 - 103*_n**4/140 + 15061*_n**5/26880 + 167603*_n**6/181440,
         49561*_n**4/161280 - 179*_n**5/168 + 6601661*_n**6/7257600,
         34729*_n**5/80640 - 3418889*_n**6/1995840, 212378941*_n**6/319334400)


def utm_para_graus(x, y):
    """(lon, lat) em graus, sem arredondar."""
    xi, eta = (y - _FN) / (_K0 * _AA), (x - _FE) / (_K0 * _AA)
    xi1 = xi - sum(b * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, b in enumerate(_BETA, 1))
    eta1 = eta - sum(b * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, b in enumerate(_BETA, 1))
    chi = math.asin(math.sin(xi1) / math.cosh(eta1))
    lat = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(_DELTA, 1))
    return math.degrees(_L0 + math.atan2(math.sinh(eta1), math.cos(xi1))), math.degrees(lat)


def graus_para_utm(lon, lat):
    """(x, y) em metros, UTM 23S."""
    phi, dl = math.radians(lat), math.radians(lon) - _L0
    c = 2 * math.sqrt(_N) / (1 + _N)
    t = math.sinh(math.atanh(math.sin(phi)) - c * math.atanh(c * math.sin(phi)))
    xi, eta = math.atan2(t, math.cos(dl)), math.atanh(math.sin(dl) / math.hypot(1, t))
    x = _FE + _K0 * _AA * (eta + sum(a * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, a in enumerate(_ALFA, 1)))
    y = _FN + _K0 * _AA * (xi + sum(a * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, a in enumerate(_ALFA, 1)))
    return x, y


def para_wgs84(x, y):
    """UTM 23S -> [lon, lat] com 7 casas (~1 cm)."""
    lon, lat = utm_para_graus(x, y)
    return [round(lon, 7), round(lat, 7)]


def _anel(pontos):
    pts = [para_wgs84(x, y) for x, y in pontos]
    return pts if pts[0] == pts[-1] else pts + [pts[0]]


def _gravar(caminho, dado):
    """Bytes ordenados e estáveis, gravados por arquivo temporário + os.replace.
    Não uso `esquema.gravar`: o selo dele arredonda a 4 casas e estragaria o WGS84 (7 casas)."""
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    bytes_ = dado if isinstance(dado, bytes) else (
        json.dumps(dado, ensure_ascii=False, sort_keys=True, indent=1, allow_nan=False) + "\n").encode("utf-8")
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(dir=caminho.parent, prefix=".vitrine-", suffix=".tmp", delete=False) as f:
            tmp = Path(f.name)
            f.write(bytes_)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, caminho)
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)


def _numeros(T, area_lote):
    def med(valor, unidade):
        return {"valor": valor, "unidade": unidade}

    def v(chave):
        return T[chave]["valor"] or 0

    return {"andares": med(v("pavimentos"), "pav"), "unidades": med(v("unidades"), "un"),
            "vagas": med(v("vagas"), "vagas"), "area_privativa": med(v("privativa_total"), "m²"),
            "area_computavel": med(v("computavel_total"), "m²"), "area_lote": med(area_lote, "m²")}


def _volumes_wgs84(estudo):
    opcao = next(o for o in estudo["opcoes"] if o["id"] == "projetista")
    return [{"id": v["id"], "base": _anel(v["base_utm"]), "z0_m": v["z0_m"], "altura_m": v["altura_m"], "uso": v["uso"]}
            for v in opcao["volumes"]]


def _lote(poligono_utm):
    """(contorno, centro) em WGS84; o centro é um ponto garantidamente dentro do lote."""
    poli = Polygon(poligono_utm)
    p = poli.representative_point()
    return _anel(poligono_utm), para_wgs84(p.x, p.y)


_EM_PORTUGUES = {"laje não cabe no envelope": "o pavimento mínimo do gerador não cabe dentro da área em que se pode construir",
                 "núcleo não cabe na profundidade da unidade": "escada e elevador não cabem na profundidade do terreno"}


class SemPavimento(ValueError):
    """O gerador não achou nem um pavimento; a mensagem já vem em português simples, com a área do terreno."""


def _motivo(erro):
    texto = str(erro)
    if isinstance(erro, SemPavimento):
        return texto
    if isinstance(erro, EdicaoRecusada):
        return f"A torre deste terreno foi recusada pelas regras: {texto}"
    return f"Não foi possível montar este terreno: {texto}"


def _gerar(caminho):
    """Revisão de um pavimento, com o menor recuo de programa que couber. Devolve (revisão, unidades por andar)."""
    estudo, site, regras = estudo_para_site(caminho)
    ultimo = None
    for n in PROGRAMAS:
        r = gerar_pavimento(site, regras, {"unidades": n}, None, estudo)
        if r["outcome"] == "gerado":
            return r["revisoes"][0], n
        ultimo = r
    area = f"{site['area_m2']:.0f} m²"
    if ultimo["outcome"] == "inviavel":
        raise SemPavimento(f"O terreno ({area}) é pequeno demais para o pavimento mínimo do gerador.")
    simples = _EM_PORTUGUES.get(ultimo["motivo"], ultimo["motivo"])
    raise SemPavimento(f"Neste terreno ({area}) {simples}.")


def _terreno(caminho, numero, pasta):
    """Gera os arquivos do terreno e devolve o item do índice. Levanta exceção se algo falhar."""
    id_ = f"terreno-{numero}"
    rev, n = _gerar(caminho)
    versoes = {}
    for chave, terreo in (("sem", False), ("com", True)):
        t = compor(rev, terreo=terreo)
        versoes[chave] = (t["metrics_summary"]["torre"], revisao_para_estudo(t, caminho))
    area = rev["site"]["area_m2"]
    contorno, centro = _lote(rev["site"]["polygon_utm"])
    resumo = {"id": id_, "nome": f"Terreno {numero}", "estudo": "estudo-previa.json", "estudo_terreo": "estudo-previa-terreo.json",
              "numeros": _numeros(versoes["sem"][0], area), "numeros_terreo": _numeros(versoes["com"][0], area)}
    # tudo calculado: só agora grava, para um terreno que falha não deixar pasta pela metade
    _gravar(pasta / id_ / "estudo-previa.json", serializar_estudo(versoes["sem"][1]))
    _gravar(pasta / id_ / "estudo-previa-terreo.json", serializar_estudo(versoes["com"][1]))
    _gravar(pasta / id_ / "resumo.json", resumo)
    return {"id": id_, "nome": resumo["nome"], "lote_ref": Path(caminho).stem, "centro": centro, "lote_wgs84": contorno,
            "volumes_wgs84": _volumes_wgs84(versoes["sem"][1]), "volumes_terreo_wgs84": _volumes_wgs84(versoes["com"][1]),
            "resumo": f"{id_}/resumo.json", "unidades_por_andar": n, "status": "ok", "motivo": None}


def gerar(saida, pilotos=PILOTOS):
    saida = Path(saida)
    itens = []
    for numero, caminho in enumerate(sorted(Path(pilotos).glob("*.json")), 1):
        try:
            itens.append(_terreno(caminho, numero, saida))
        except Exception as erro:  # um piloto ruim não derruba os outros
            item = {"id": f"terreno-{numero}", "nome": f"Terreno {numero}", "lote_ref": caminho.stem, "centro": None,
                    "lote_wgs84": None, "volumes_wgs84": [], "volumes_terreo_wgs84": [], "resumo": None,
                    "unidades_por_andar": None, "status": "falhou", "motivo": _motivo(erro)}
            try:  # o mapa ainda mostra onde fica o terreno, se o contorno do piloto for legível
                item["lote_wgs84"], item["centro"] = _lote(json.loads(caminho.read_bytes())["lote"]["poligono_utm"])
            except Exception:
                pass
            itens.append(item)
    _gravar(saida / "indice.json", {"terrenos": itens})
    return itens


def main(argv=None):
    ap = argparse.ArgumentParser(description="Gera os dados da vitrine dos terrenos piloto.")
    ap.add_argument("saida", type=Path)
    ap.add_argument("--pilotos", type=Path, default=PILOTOS)
    a = ap.parse_args(argv)
    for i in gerar(a.saida, a.pilotos):
        print(f"{i['id']} ({i['lote_ref']}): {i['status']}" + (f" - {i['motivo']}" if i["motivo"] else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
