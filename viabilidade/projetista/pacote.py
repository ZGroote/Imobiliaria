"""Pacote físico preliminar: revisão + avaliação + sondagem + cargas conferidas juntas.

Guarda só referências (id e sha de cada peça) e o estado de cada uma: `valida`, `invalida` (com o motivo que
a própria peça dá) ou `ausente`. Nada é copiado das peças; o `resumo` lê delas na hora, sem interpretar.

    python viabilidade/projetista/pacote.py <pasta> [--sondagem arq]
"""
import argparse
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.cargas import SELO as SELO_CARGAS, cargas_validas
from viabilidade.projetista.esquema import _canonico, carregar_json, gravar, selar, sha256
from viabilidade.projetista.sintese import avaliacao_valida
from viabilidade.projetista.sondagem import SELO as SELO_SONDAGEM, motivo_trava

METHOD_VERSION = "pacote/0.2.0"  # 0.2.0: a sondagem citada na avaliação tem que ser a do pacote
SELO = "pacote_sha256"
PECAS = ("revisao", "avaliacao", "sondagem", "cargas")


def _estado(motivo):
    return {"estado": "valida", "motivo": ""} if not motivo else {"estado": "invalida", "motivo": motivo}


def _revisao(rev):
    try:
        return "" if selar(rev)["content_sha256"] == rev.get("content_sha256") else "selo"
    except (ValueError, KeyError, TypeError, AttributeError):
        return "revisão malformada"


def _sondagem(s, rev):
    """A sondagem é do lote: o lote tem que bater; o estudo, quando ela declara um."""
    m = motivo_trava({"investigation_id": s.get("investigation_id"), "sha256": s.get(SELO_SONDAGEM)}, s)
    if m:
        return m
    ref, sr = s.get("referencia") or {}, rev.get("study_ref") or {}
    if ref.get("lote_id") != sr.get("lote_id"):
        return f"sondagem de outro lote: {ref.get('lote_id')} ≠ {sr.get('lote_id')}"
    if ref.get("study_id") is not None and ref["study_id"] != sr.get("study_id"):
        return f"sondagem de outro estudo: {ref['study_id']} ≠ {sr.get('study_id')}"
    return ""


def _avaliacao(a, revisao, sondagem):
    """`avaliacao_valida` e, se a avaliação cita uma sondagem, a citada tem que ser a do pacote (id e sha)."""
    ok, motivo = avaliacao_valida(a, revisao)
    citada = (a.get("evidencias") or {}).get("sondagem")
    if not ok or not isinstance(citada, dict):
        return motivo
    if not isinstance(sondagem, dict):
        return f"avaliação cita a sondagem {citada.get('investigation_id')}, ausente no pacote"
    if (citada.get("investigation_id"), citada.get("sha256")) != (sondagem.get("investigation_id"), sondagem.get(SELO_SONDAGEM)):
        return (f"avaliação cita outra sondagem: {citada.get('investigation_id')} ({str(citada.get('sha256'))[:12]}), "
                f"o pacote tem {sondagem.get('investigation_id')} ({str(sondagem.get(SELO_SONDAGEM))[:12]})")
    return ""


def _pecas(revisao, avaliacao, sondagem, cargas):
    """id e sha que cada peça carrega + estado conferido agora."""
    def ref(peca, id_, sha, conferir):
        if peca is None:
            return {"id": None, "sha256": None, "estado": "ausente", "motivo": ""}
        if not isinstance(peca, dict):
            return {"id": None, "sha256": None, "estado": "invalida", "motivo": "não é um objeto JSON"}
        return {"id": peca.get(id_), "sha256": peca.get(sha)} | _estado(conferir(peca))
    return {
        "revisao": ref(revisao, "revision_id", "content_sha256", _revisao),
        # Avaliação e cargas não têm id próprio: o id é a revisão a que elas dizem pertencer.
        "avaliacao": ref(avaliacao, "revision_id", "avaliacao_sha256", lambda a: _avaliacao(a, revisao, sondagem)),
        "sondagem": ref(sondagem, "investigation_id", SELO_SONDAGEM, lambda s: _sondagem(s, revisao)),
        "cargas": ref(cargas, "revision_id", SELO_CARGAS, lambda c: cargas_validas(c, revisao)[1]),
    }


def selar_pacote(pacote):
    p = _canonico(pacote)
    p.pop(SELO, None)
    p[SELO] = sha256(p)
    return p


def montar(revisao, avaliacao, sondagem=None, cargas=None):
    return selar_pacote({"method_version": METHOD_VERSION, "revision_id": revisao.get("revision_id"),
                         "pecas": _pecas(revisao, avaliacao, sondagem, cargas)})


def pacote_valido(pacote, revisao, avaliacao, sondagem=None, cargas=None):
    """(True, []) ou (False, motivos). Confere o selo do pacote e se cada peça é a mesma, no mesmo estado."""
    try:
        if selar_pacote(pacote)[SELO] != pacote.get(SELO):
            return False, ["selo do pacote"]
    except (ValueError, AttributeError):
        return False, ["selo do pacote"]
    if pacote.get("method_version") != METHOD_VERSION:
        return False, ["versão do método mudou"]
    motivos = []
    agora, antes = _pecas(revisao, avaliacao, sondagem, cargas), pacote.get("pecas") or {}
    for nome in PECAS:
        a, b = antes.get(nome) or {}, agora[nome]
        if (a.get("id"), a.get("sha256")) != (b["id"], b["sha256"]):
            motivos.append(f"{nome} mudou: não é a mesma peça do pacote")
        elif a.get("estado") != b["estado"]:
            motivos.append(f"{nome} mudou: era {a.get('estado')}, agora {b['estado']}"
                           + (f" ({b['motivo']})" if b["motivo"] else ""))
    return not motivos, motivos


def _texto(nome, p):
    rotulo = {"avaliacao": "avaliação", "revisao": "revisão"}.get(nome, nome)
    return f"{rotulo} ausente" if p["estado"] == "ausente" else f"{rotulo} inválida: {p['motivo']}"


def resumo(pacote, revisao, avaliacao, sondagem=None, cargas=None):
    """Dicionário pequeno para a tela. Só copia das peças válidas; peça inválida ou ausente vira uma frase."""
    ok, motivos = pacote_valido(pacote, revisao, avaliacao, sondagem, cargas)
    pecas = _pecas(revisao, avaliacao, sondagem, cargas)
    out = {"revision_id": pacote.get("revision_id"), "pacote_sha256": pacote.get(SELO),
           "pacote": {"valido": ok, "motivos": motivos},
           "pecas": {n: {"estado": p["estado"], "motivo": p["motivo"]} for n, p in pecas.items()}}
    if pecas["avaliacao"]["estado"] == "valida":
        s = avaliacao["sintese"]
        out["avaliacao"] = {k: s[k] for k in ("sintese", "regra_da_precedencia", "motivos_trava", "aviso")}
    else:
        out["avaliacao"] = _texto("avaliacao", pecas["avaliacao"])
    if pecas["cargas"]["estado"] == "valida":
        out["cargas"] = {"pavimentos": [{"id": p["id"], "total": p["total"], "total_por_m2": p["total_por_m2"]}
                                        for p in cargas["pavimentos"]],
                         "total_torre": cargas["total_torre"], "aviso": cargas["aviso"], "avisos": cargas["avisos"]}
    else:
        out["cargas"] = _texto("cargas", pecas["cargas"])
    if pecas["sondagem"]["estado"] == "valida":
        fs = sondagem["furos"]
        out["sondagem"] = {"furos": len(fs),
                           "profundidade_max": {"valor": max(f["profundidade_final_m"] for f in fs), "unidade": "m"},
                           "nivel_agua": [{"furo": f["id"], "leituras": f["nivel_agua"]} for f in fs]}
    else:
        out["sondagem"] = _texto("sondagem", pecas["sondagem"])
    return out


def _ultimo(pasta, prefixo):
    achados = {int(m[1]): p for p in pasta.glob(f"{prefixo}-*.json") if (m := re.fullmatch(rf"{prefixo}-(\d+)\.json", p.name))}
    return max(achados.items()) if achados else (None, None)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Monta o pacote físico preliminar da revisão de número mais alto da pasta.")
    ap.add_argument("pasta", type=Path)
    ap.add_argument("--sondagem", type=Path)
    a = ap.parse_args(argv)
    n, caminho = _ultimo(a.pasta, "revisao")
    if caminho is None:
        ap.error(f"nenhuma revisao-NN.json em {a.pasta}")
    ler = lambda p: carregar_json(p.read_bytes()) if p and p.exists() else None
    pecas = (ler(caminho), ler(a.pasta / f"avaliacao-{n:02d}.json"), ler(a.sondagem),
             ler(a.pasta / f"cargas-{n:02d}.json"))
    if a.sondagem and pecas[2] is None:
        ap.error(f"sondagem não encontrada: {a.sondagem}")
    p = gravar(a.pasta / f"pacote-{n:02d}.json", montar(*pecas), selador=selar_pacote)
    print(f"pacote-{n:02d}.json: " + ", ".join(f"{k} {v['estado']}" + (f" ({v['motivo']})" if v["motivo"] else "")
                                               for k, v in p["pecas"].items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
