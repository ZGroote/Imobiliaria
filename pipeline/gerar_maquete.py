"""Prévia LEVE a partir da leitura; contexto declarado ou demonstração local explícita.

python -m pipeline.gerar_maquete leitura.json --contexto contexto.json --saida maquete.html
python -m pipeline.gerar_maquete leitura.json --demo --saida previa.html
"""
import argparse
from copy import deepcopy
import json
import math
from pathlib import Path
import shutil
import sys
import tempfile

from pipeline import e2e_leitura as e2e
from pipeline import validar_leitura
from pipeline.avaliar_captura import embrulhar
from pipeline.editor_state import validar_moveis
from pipeline.normalizar_planta import serializar


def _json(text):
    return json.loads(text, object_pairs_hook=validar_leitura._unique_object,
                      parse_constant=validar_leitura._invalid_constant)


def _recusa(code, message, path=""):
    return e2e.Recusa([{"code": code, "path": path, "message": message}])


def sintetizar_contexto(leitura, caso="demo-local", agency_id="demo-local"):
    """Envelope ilustrativo do renderer; não deduz ficha comercial da geometria."""
    rooms = leitura["rooms"]
    xs = [r["xMm"] for r in rooms] + [r["xMm"] + r["widthMm"] for r in rooms]
    ys = [r["yMm"] for r in rooms] + [r["yMm"] + r["depthMm"] for r in rooms]
    dim = math.ceil(max(max(xs) - min(xs), max(ys) - min(ys)) / 1000 + 2 * e2e.RECUO_CASCA_M + 2)
    return {
        "schema": 1, "propertyId": caso, "agencyId": agency_id, "andar": 0,
        "ficha": {"titulo": "Prévia demonstrativa", "empreendimento": "Prévia demonstrativa · prédio ilustrativo"},
        "cores": {"parede": "#D8D2C8", "piso_frio": "#CFC7BB", "piso_madeira": "#9A7B57", "teto": "#F2F0EC"},
        "lote": {"predio": {"largura_m": dim, "profundidade_m": dim, "pavimentos": 1}},
    }


def extrair_moveis_3d(payload):
    """Aceita o companion nominal exportado pelo capturador, sem alterar a leitura."""
    if isinstance(payload, dict) and set(payload) <= {"_gerado_por", "moveis"}:
        payload = payload.get("moveis")
    errors = validar_moveis(payload)
    if errors:
        raise e2e.Recusa(errors)
    return deepcopy(payload)


def gerar_maquete_da_leitura(leitura, contexto=None, caso="demo-local", destino=None, *, demo=False, moveis=None, agency_id="demo-local"):
    """Gera prévia validada, sem gravar sobre destino ocupado nem modificar entradas."""
    if destino is not None:
        target = Path(destino)
        if target.is_symlink() or target.exists() and (not target.is_dir() or any(target.iterdir())):
            raise _recusa("DESTINO_OCUPADO", "O destino já existe e não está vazio.", str(target))
    errors = validar_leitura.validar(leitura)
    if errors:
        raise e2e.Recusa(errors)
    if demo and contexto is not None:
        raise _recusa("CONTEXTO_INVALIDO", "Escolha contexto declarado ou demonstração; não combine os dois modos.")
    if contexto is None:
        if not demo:
            raise _recusa("CONTEXTO_OBRIGATORIO", "Declare o contexto do imóvel ou use --demo para uma prévia ilustrativa.")
        contexto = sintetizar_contexto(leitura, caso, agency_id)
    else:
        contexto = deepcopy(contexto)
    if moveis is not None:
        if not isinstance(contexto, dict) or "moveis" in contexto:
            raise _recusa("CONTEXTO_INVALIDO", "Declare móveis em uma única fonte, no contexto ou no companion.", "/moveis")
        contexto["moveis"] = extrair_moveis_3d(moveis)
    entrada = embrulhar(leitura, caso, contexto)
    if destino is not None:
        relatorio = e2e.executar(entrada, contexto, Path(destino))
        html = (Path(destino) / "maquete.html").read_text(encoding="utf-8")
    else:
        tmp = Path(tempfile.mkdtemp(prefix="maquete-leitura-"))
        try:
            pasta = tmp / "artefato"
            relatorio = e2e.executar(entrada, contexto, pasta)
            html = (pasta / "maquete.html").read_text(encoding="utf-8")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return html, relatorio


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("leitura", help="leitura.json ou '-' para stdin")
    parser.add_argument("--contexto", help="contexto completo declarado do imóvel")
    parser.add_argument("--caso", default="demo-local")
    parser.add_argument("--demo", action="store_true", help="contexto ilustrativo explícito; não é produção")
    parser.add_argument("--saida", help="novo arquivo HTML")
    parser.add_argument("--destino", help="pasta nova ou vazia para artefato e relatório")
    parser.add_argument("--moveis", help="companion de móveis nominal")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--envelope", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        text = sys.stdin.read() if args.leitura == "-" else Path(args.leitura).read_text(encoding="utf-8")
        payload = _json(text)
        contexto, moveis, demo, caso, agency_id = None, None, args.demo, args.caso, "demo-local"
        if args.envelope:
            if not isinstance(payload, dict) or set(payload) - {"leituraJson", "contextoJson", "moveisJson", "demo", "propertyId", "agencyId"}:
                raise _recusa("ENTRADA_INVALIDA", "Envelope de geração inválido.")
            leitura = _json(payload["leituraJson"])
            contexto = _json(payload["contextoJson"]) if payload.get("contextoJson") is not None else None
            moveis = _json(payload["moveisJson"]) if payload.get("moveisJson") is not None else None
            demo = payload.get("demo") is True
            caso, agency_id = payload.get("propertyId", caso), payload.get("agencyId", agency_id)
        else:
            leitura = payload
            contexto = _json(Path(args.contexto).read_text(encoding="utf-8")) if args.contexto else None
            moveis = _json(Path(args.moveis).read_text(encoding="utf-8")) if args.moveis else None
        if args.saida and Path(args.saida).exists():
            raise _recusa("DESTINO_OCUPADO", "O arquivo de saída já existe.", args.saida)
        if isinstance(contexto, dict):
            if args.envelope and (contexto.get("propertyId") != caso or contexto.get("agencyId") != agency_id):
                raise _recusa("CONTEXTO_DE_OUTRO_IMOVEL", "O contexto não corresponde ao imóvel/agência autorizado.")
            caso = contexto.get("propertyId", caso)
        html, relatorio = gerar_maquete_da_leitura(leitura, contexto, caso, args.destino,
                                                  demo=demo, moveis=moveis, agency_id=agency_id)
        if args.saida:
            with Path(args.saida).open("x", encoding="utf-8", newline="") as out:
                out.write(html)
        result = {"ok": True, "relatorio": relatorio, "bytes": len(html.encode("utf-8")), "html": html}
    except e2e.Recusa as exc:
        result, status = {"ok": False, "errors": exc.errors}, 2
    except (ValueError, UnicodeError, RecursionError, TypeError, KeyError):
        result, status = {"ok": False, "errors": [{"code": "INVALID_JSON", "message": "JSON inválido ou ambíguo.", "path": ""}]}, 2
    except OSError:
        result, status = {"ok": False, "errors": [{"code": "ERRO_ARQUIVO", "message": "Não foi possível ler ou criar o arquivo.", "path": ""}]}, 1
    except Exception:
        result, status = {"ok": False, "errors": [{"code": "FALHA_GERACAO", "message": "Não foi possível gerar a prévia 3D.", "path": ""}]}, 1
    else:
        status = 0
    if args.json:
        sys.stdout.buffer.write(serializar(result))
    elif status:
        sys.stderr.write(json.dumps(result, ensure_ascii=False) + "\n")
    else:
        sys.stdout.write("Prévia gerada com sucesso.\n")
    return status


if __name__ == "__main__":
    raise SystemExit(main())
