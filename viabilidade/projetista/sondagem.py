"""PVF-G3: cadastro versionado de boletim de sondagem SPT (NBR 6484 declarada, não conferida).

Só cadastro. Nada de capacidade de carga, tensão admissível ou fundação: isso é do PVF-G4, com
método validado por engenheiro. Sem relógio: datas e leituras de nível d'água são texto informado.

Guarda os golpes e a penetração crus de cada segmento de 15 cm. O N-SPT é derivado (`n_spt`):
nunca é aceito digitado. Contrato (`sondagem/0.1.0`):

    {"schema_version", "investigation_id", "crs", "referencia": {"study_id", "lote_id"},
     "empresa", "profissional": {"nome", "conselho", "registro"},
     "metodo": {"reference", "verified"}, "data_ensaio",
     "furos": [{"id", "posicao_utm": [x, y], "cota_boca_m" (número ou null), "cota_boca_motivo",
                "profundidade_final_m", "criterio_paralisacao",
                "spt": [{"profundidade_m", "segmentos": [{"golpes", "penetracao_cm"}, ...até 3]}],
                "camadas": [{"topo_m", "base_m", "descricao", "classificacao"}],
                "nivel_agua": [{"profundidade", "leitura"}]}],
     "investigation_sha256"}
"""
import math

from shapely.geometry import Point, Polygon

from viabilidade.projetista.esquema import _canonico, carregar_json, serializar, sha256

SCHEMA = "sondagem/0.1.0"
SEGMENTO_CM = 15
TOL_M = 0.001
SELO = "investigation_sha256"


def _txt(v):
    return isinstance(v, str) and bool(v.strip())


def _num(v):
    return type(v) in (int, float) and math.isfinite(v)


def segmentos_completos(leitura):
    segs = leitura.get("segmentos") if isinstance(leitura, dict) else None
    return isinstance(segs, list) and len(segs) == 3 and all(
        isinstance(g, dict) and g.get("penetracao_cm") == SEGMENTO_CM for g in segs)


def n_spt(leitura):
    """N-SPT = golpes do 2º + 3º segmento. None quando a penetração não completou (o cru fica guardado)."""
    if not segmentos_completos(leitura):
        return None
    return leitura["segmentos"][1]["golpes"] + leitura["segmentos"][2]["golpes"]


def perfil(investigacao):
    """N-SPT derivado por furo e metro, com a marca de penetração incompleta. Não é capacidade de nada."""
    return {f["id"]: [{"profundidade_m": s["profundidade_m"], "n_spt": n_spt(s),
                       "penetracao_incompleta": not segmentos_completos(s)} for s in f["spt"]]
            for f in investigacao["furos"]}


def conferir(inv, lote_utm=None):
    """Lista de {nivel: erro|aviso, elemento, motivo}. Furo fora do lote é aviso (sondagem em vizinho existe)."""
    out = []

    def erro(el, motivo, nivel="erro"):
        out.append({"nivel": nivel, "elemento": el, "motivo": motivo})

    if not isinstance(inv, dict):
        return [{"nivel": "erro", "elemento": "investigacao", "motivo": "Cadastro não é um objeto"}]
    try:
        serializar(inv)
    except (ValueError, TypeError) as e:
        erro("investigacao", f"Não é JSON canônico: {e}")
        return out
    if inv.get("schema_version") != SCHEMA:
        erro("investigacao", f"schema_version deve ser {SCHEMA}")
    for k in ("investigation_id", "crs", "empresa", "data_ensaio"):
        if not _txt(inv.get(k)):
            erro(k, f"{k} obrigatório (texto)")
    ref = inv.get("referencia")
    if not isinstance(ref, dict) or not (_txt(ref.get("study_id")) or _txt(ref.get("lote_id"))):
        erro("referencia", "Referência de estudo ou lote obrigatória")
    pro = inv.get("profissional")
    pro = pro if isinstance(pro, dict) else {}
    for k in ("nome", "conselho", "registro"):
        if not _txt(pro.get(k)):
            erro("profissional", f"Profissional responsável sem {k}")
    met = inv.get("metodo")
    if not isinstance(met, dict) or not _txt(met.get("reference")) or type(met.get("verified")) is not bool:
        erro("metodo", "Método declarado em texto com verified true/false")
    furos = inv.get("furos")
    if not isinstance(furos, list) or not furos:
        erro("furos", "Ao menos um furo")
        return out
    lote = Polygon(lote_utm) if lote_utm else None
    ids = set()
    for i, f in enumerate(furos):
        el = f.get("id") if isinstance(f, dict) and _txt(f.get("id")) else f"furo[{i}]"
        if not isinstance(f, dict) or not _txt(f.get("id")):
            erro(el, "Furo sem id")
            continue
        if el in ids:
            erro(el, "id de furo repetido")
        ids.add(el)
        pos, fim = f.get("posicao_utm"), f.get("profundidade_final_m")
        if not (isinstance(pos, list) and len(pos) == 2 and all(map(_num, pos))):
            erro(el, "Posição UTM [x, y] obrigatória")
        elif lote is not None and not lote.covers(Point(pos)):
            erro(el, f"Furo fora do lote ({lote.exterior.distance(Point(pos)):.1f} m da divisa)", "aviso")
        if f.get("cota_boca_m") is None:
            if not _txt(f.get("cota_boca_motivo")):
                erro(el, "Cota da boca nula sem motivo")
        elif not _num(f.get("cota_boca_m")):
            erro(el, "Cota da boca deve ser número ou null com motivo")
        if not _num(fim) or fim <= 0:
            erro(el, "Profundidade final deve ser número positivo")
            fim = None
        if not _txt(f.get("criterio_paralisacao")):
            erro(el, "Critério de paralisação obrigatório (texto)")
        for s in f.get("spt") if isinstance(f.get("spt"), list) else [None]:
            _conferir_spt(s, el, fim, erro)
        _conferir_camadas(f.get("camadas"), el, fim, erro)
        na = f.get("nivel_agua")
        if not isinstance(na, list) or not na or not all(
                isinstance(x, dict) and _txt(x.get("profundidade")) and _txt(x.get("leitura")) for x in na):
            erro(el, "Nível d'água: ao menos uma leitura, profundidade (ou \"não encontrado\") e leitura em texto")
    return out


def _conferir_spt(s, el, fim, erro):
    if not isinstance(s, dict):
        erro(el, "Lista spt ausente ou leitura inválida")
        return
    p, segs = s.get("profundidade_m"), s.get("segmentos")
    nome = f"{el} a {p} m"
    if not _num(p) or p <= 0 or (fim is not None and p > fim + TOL_M):
        erro(nome, "Profundidade do SPT fora de (0, profundidade final]")
    if not isinstance(segs, list) or not segs:
        erro(nome, "N sem segmentos: guarde golpes e penetração de cada 15 cm")
        return
    if len(segs) > 3:
        erro(nome, "Mais de 3 segmentos")
    for j, g in enumerate(segs):
        if not isinstance(g, dict) or type(g.get("golpes")) is not int or not _num(g.get("penetracao_cm")):
            erro(nome, f"Segmento {j + 1} sem golpes inteiros e penetração numérica")
        elif g["golpes"] < 0 or g["penetracao_cm"] < 0:
            erro(nome, f"Segmento {j + 1} negativo")
    if not segmentos_completos(s):
        erro(nome, "Penetração incompleta: guardada como veio, N-SPT não derivado", "aviso")
    for k in sorted(set(s) - {"profundidade_m", "segmentos"}):
        erro(nome, f"Campo {k!r} não aceito: o N-SPT é derivado dos segmentos")


def _conferir_camadas(cs, el, fim, erro):
    if not isinstance(cs, list) or not cs or not all(
            isinstance(c, dict) and _num(c.get("topo_m")) and _num(c.get("base_m")) for c in cs):
        erro(el, "Camadas com topo_m e base_m numéricos obrigatórias")
        return
    anterior = 0.0
    for c in sorted(cs, key=lambda c: (c["topo_m"], c["base_m"])):
        nome = f"{el} camada {c['topo_m']}–{c['base_m']} m"
        if c["base_m"] <= c["topo_m"]:
            erro(nome, "Base da camada não está abaixo do topo")
        if c["topo_m"] > anterior + TOL_M:
            erro(nome, f"Buraco entre {anterior} e {c['topo_m']} m")
        elif c["topo_m"] < anterior - TOL_M:
            erro(nome, f"Camada sobreposta à anterior (que vai até {anterior} m)")
        if fim is not None and c["base_m"] > fim + TOL_M:
            erro(nome, f"Camada passa da profundidade final ({fim} m)")
        if not _txt(c.get("descricao")) or not isinstance(c.get("classificacao"), str):
            erro(nome, "Camada sem descrição do boletim ou classificação em texto")
        anterior = max(anterior, c["base_m"])
    if fim is not None and anterior < fim - TOL_M:
        erro(el, f"Buraco: camadas param em {anterior} m e o furo vai até {fim} m")


def erros(inv, lote_utm=None):
    return [c for c in conferir(inv, lote_utm) if c["nivel"] == "erro"]


def selo(inv):
    """SHA-256 do JSON canônico sem o próprio selo."""
    corpo = _canonico(inv)
    corpo.pop(SELO, None)
    return sha256(corpo)


def selar_sondagem(inv):
    """Cópia canônica e selada. Recusa cadastro com erro (aviso passa)."""
    e = erros(inv)
    if e:
        raise ValueError("Sondagem com erro: " + "; ".join(f"{x['elemento']}: {x['motivo']}" for x in e))
    out = _canonico(inv)
    out[SELO] = selo(out)
    return out


def ler_sondagem(caminho):
    from pathlib import Path
    inv = carregar_json(Path(caminho).read_bytes())
    if inv.get(SELO) != selo(inv) or serializar(selar_sondagem(inv)) != Path(caminho).read_bytes():
        raise ValueError("Selo da sondagem divergente ou arquivo fora da forma canônica")
    return inv


def referencia(inv):
    """O que vai em evidencias["sondagem"]."""
    return {"investigation_id": inv["investigation_id"], "sha256": inv[SELO]}


def motivo_trava(ref, cadastro):
    """None quando a referência aponta para um cadastro selado e sem erro; senão o motivo da trava."""
    if ref is True:
        return "sondagem declarada sem cadastro"
    if not isinstance(ref, dict) or not ref:
        return "Falta sondagem do terreno"
    if not isinstance(cadastro, dict) or cadastro.get("investigation_id") != ref.get("investigation_id"):
        return "Sondagem referenciada não está no cadastro"
    try:
        if not (ref.get("sha256") == cadastro.get(SELO) == selo(cadastro)):
            return "Selo da sondagem não bate com a referência"
    except ValueError:
        return "Selo da sondagem não bate com a referência"
    e = erros(cadastro)
    if e:
        return "Sondagem com erro no cadastro: " + "; ".join(f"{x['elemento']}: {x['motivo']}" for x in e)
    return None
