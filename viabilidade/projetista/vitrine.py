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
import re
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
from viabilidade.projetista.validador import validar

PILOTOS = RAIZ / "viabilidade" / "motor" / "exemplos" / "pilotos"
PROGRAMAS = (10, 8, 6, 5, 4, 3, 2)  # unidades por andar; vale o que dá mais unidades no prédio inteiro (empate: o maior)
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


def _br(x):
    return f"{x:g}".replace(".", ",")


def _por_que_parou(parou):
    """O `parou` da torre em português simples para a tela; sem `parou`, diz isso."""
    if not parou:
        return "A torre não registrou motivo para parar."
    m = re.search(r"passa da altura máxima da caixa \(([\d.]+) m\)", parou)
    if m:
        return f"Chegou na altura máxima do terreno ({_br(float(m[1]))} m): o próximo andar passaria dela."
    m = re.search(r"\(z ([\d.]+) a ([\d.]+) m\) sai do envelope dessa altura: ([\d.]+) m² para fora", parou)
    if m:
        return (f"O recuo cresce com a altura: o andar entre {_br(float(m[1]))} e {_br(float(m[2]))} m não cabe "
                f"({_br(float(m[3]))} m² ficariam fora da área em que se pode construir).")
    return parou


def _por_que_unidades(por_andar, n, maiores):
    """Unidades por andar: o que o gerador faz (um núcleo, até n unidades) e o que a torre perde nos andares de cima."""
    tipo = [u for k, u in por_andar.items() if k != "terreo"]
    texto = f"O gerador desenha um núcleo só (escada, elevador e shaft), com até {n} unidades por andar."
    if maiores:
        texto += (f" Foi o programa que deu mais unidades no prédio inteiro: com {', '.join(map(str, maiores))} por andar "
                  "não coube ou o prédio ficou com menos unidades.")
    if tipo and min(tipo) < max(tipo):
        texto += f" Nos andares de cima o recuo tira unidades: de {max(tipo)} caem para {min(tipo)}."
    return texto


def _numeros(T, area_lote, n, terreo, maiores, ca):
    """`ca` = (texto do CA, cortou?) vindo de `_compor`: o CA máximo não é lei esquecida, é o que parou o prédio."""
    def med(valor, unidade):
        return {"valor": valor, "unidade": unidade}

    def v(chave):
        return T[chave]["valor"] or 0

    vagas = med(v("vagas"), "vagas") if terreo else {**med(None, "vagas"), "nota": "estudo sem térreo: sem garagem"}
    texto, cortou = ca
    andares = texto if cortou else _por_que_parou(T["parou"]) + (" " + texto if texto else "")
    return {"andares": med(v("pavimentos"), "pav"), "unidades": med(v("unidades"), "un"),
            "vagas": vagas, "area_privativa": med(v("privativa_total"), "m²"),
            "area_computavel": med(v("computavel_total"), "m²"), "area_lote": med(area_lote, "m²"),
            "limitante": {"andares": andares, "unidades": _por_que_unidades(T["unidades_por_andar"], n, maiores)}}


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


def _compor(rev, terreo):
    """Torre composta que não passa do `ca_maximo` (a regra `torre.ca` do validador só acusa, não recusa).
    Devolve (torre, (texto do CA, cortou?)): se cortou, o texto diz que o CA máximo foi o que parou o prédio; se não, só
    avisa quando o CA fica acima do básico (outorga onerosa, como o validador diz)."""
    t = compor(rev, terreo=terreo)
    motor, lote = rev["rules_ref"]["params"]["motor"], rev["site"]["area_m2"]
    basico, maximo, eps = motor.get("ca_basico"), motor.get("ca_maximo"), rev["tolerances"]["tol_area_m2"] / lote
    por_placa = {a["element_ids"][0]: a["measured"] for a in validar(t, t["site"], t["rules_ref"]) if a["rule_id"] == "areas.computavel"}
    acumulado, soma = [], 0.0
    for pl in t["floor_plates"]:
        soma += por_placa[pl["id"]]
        acumulado.append(soma / lote)
    ca, cortou = acumulado[-1], False
    if maximo is not None and ca > maximo + eps:
        k = sum(1 for pl, c in zip(t["floor_plates"], acumulado) if c <= maximo + eps and pl["id"] != "terreo")
        antes = max(c for c in acumulado if c <= maximo + eps)
        proximo = next(c for c in acumulado if c > maximo + eps)
        t, cortou, ca = compor(rev, terreo=terreo, pavimentos=k), True, antes
        texto = (f"Parou no CA máximo do terreno ({_br(maximo)}): com mais um andar o CA iria de {_br(round(antes, 2))} "
                 f"para {_br(round(proximo, 2))}.")
    else:
        texto = None
    if basico is not None and ca > basico + eps:
        aviso = f"CA {_br(round(ca, 2))}, acima do básico ({_br(basico)}): depende de outorga onerosa."
        texto = f"{texto} {aviso}" if texto else aviso
    return t, (texto, cortou)


def _escolher(caminho):
    """O programa (unidades por andar) que dá mais unidades no prédio inteiro, sem térreo; empate: o de mais unidades por andar.
    Devolve (revisão, n, (sem, com), programas maiores que não ganharam), cada versão = (torre composta, aviso de CA)."""
    estudo, site, regras = estudo_para_site(caminho)
    ultimo, erro, vistos = None, None, []
    for n in PROGRAMAS:
        r = gerar_pavimento(site, regras, {"unidades": n}, None, estudo)
        if r["outcome"] != "gerado":
            ultimo = r
            continue
        try:
            rev = r["revisoes"][0]
            sem, com = _compor(rev, False), _compor(rev, True)
        except EdicaoRecusada as e:  # este programa não vira torre nas duas versões: vale o próximo
            erro = e
            continue
        vistos.append((sem[0]["metrics_summary"]["torre"]["unidades"]["valor"], n, rev, sem, com))
    if vistos:
        unidades, n, rev, sem, com = max(vistos, key=lambda x: (x[0], x[1]))
        return rev, n, (sem, com), [m for m in PROGRAMAS if m > n]
    if erro:
        raise erro
    area = f"{site['area_m2']:.0f} m²"
    if ultimo["outcome"] == "inviavel":
        raise SemPavimento(f"O terreno ({area}) é pequeno demais para o pavimento mínimo do gerador.")
    simples = _EM_PORTUGUES.get(ultimo["motivo"], ultimo["motivo"])
    raise SemPavimento(f"Neste terreno ({area}) {simples}.")


def _terreno(caminho, numero, pasta):
    """Gera os arquivos do terreno e devolve o item do índice. Levanta exceção se algo falhar."""
    id_ = f"terreno-{numero}"
    rev, n, escolhidas, maiores = _escolher(caminho)
    versoes = {}
    for chave, (t, ca) in zip(("sem", "com"), escolhidas):
        versoes[chave] = (t["metrics_summary"]["torre"], revisao_para_estudo(t, caminho), ca)
    area = rev["site"]["area_m2"]
    contorno, centro = _lote(rev["site"]["polygon_utm"])
    resumo = {"id": id_, "nome": f"Terreno {numero}", "estudo": "estudo-previa.json", "estudo_terreo": "estudo-previa-terreo.json",
              "numeros": _numeros(versoes["sem"][0], area, n, False, maiores, versoes["sem"][2]),
              "numeros_terreo": _numeros(versoes["com"][0], area, n, True, maiores, versoes["com"][2])}
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
