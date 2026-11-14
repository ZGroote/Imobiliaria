"""Confere o plano; --completo exige as imagens e pontos antes de liberar o treino."""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import re
import struct


def validar(pasta, completo=False, fonte=None):
    pasta = Path(pasta)
    plano = json.loads((pasta / "plano-captura.json").read_text(encoding="utf-8"))
    data = plano["dataset"]
    frames = data["frames"]
    if not frames: raise ValueError("Plano sem câmeras")
    if fonte:
        with open(fonte, "rb") as f: sha = hashlib.sha256(f.read()).hexdigest()
        if sha != plano["source_sha256"]: raise ValueError("Cena diferente da fonte do plano")
    nomes = [f["file_path"] for f in frames]
    if len(set(nomes)) != len(nomes): raise ValueError("Nomes de imagem duplicados")
    for nome in nomes:
        if not re.fullmatch(r"images/[\w-]+\.png", nome): raise ValueError("Caminho de imagem inválido")
    treino = set(data.get("train_filenames", []))
    teste = set(data.get("val_filenames", []))
    if treino & teste or treino | teste != set(nomes): raise ValueError("Divisão de treino/validação inválida")
    if set(data.get("test_filenames", [])) != teste: raise ValueError("Divisão test/val divergente")
    posicoes = {}
    ausentes = []
    for f in frames:
        m = f["transform_matrix"]
        if len(m) != 4 or any(len(r) != 4 for r in m) or not all(math.isfinite(x) for r in m for x in r):
            raise ValueError("Matriz de câmera inválida")
        if m[3] != [0, 0, 0, 1]: raise ValueError("Matriz não homogênea")
        if not f.get("comodo"): raise ValueError("Câmera fora dos cômodos")
        split = "train" if f["file_path"] in treino else "eval"
        key = tuple(round(m[k][3], 6) for k in range(3))
        if key in posicoes and posicoes[key] != split: raise ValueError("Mesma posição usada em treino e validação")
        posicoes[key] = split
        path = pasta / f["file_path"]
        if not path.is_file(): ausentes.append(f["file_path"]); continue
        with path.open("rb") as image:
            header = image.read(24)
            image.seek(-12, 2); trailer = image.read()
        if header[:8] != b"\x89PNG\r\n\x1a\n" or trailer[4:8] != b"IEND":
            raise ValueError(f"PNG incompleto: {path.name}")
        if struct.unpack(">II", header[16:24]) != (data["w"], data["h"]):
            raise ValueError(f"Resolução divergente: {path.name}")
    if completo:
        if ausentes: raise ValueError(f"Render pendente: {len(ausentes)} imagens")
        if not (pasta / data["ply_file_path"]).is_file(): raise ValueError("Pontos iniciais ausentes")
        if not treino or not teste: raise ValueError("Treino e validação precisam ter imagens")
        if not plano.get("diagnostico", False):
            for comodo in {f["comodo"] for f in frames}:
                splits = {"train" if f["file_path"] in treino else "eval" for f in frames if f["comodo"] == comodo}
                if splits != {"train", "eval"}: raise ValueError(f"Cômodo sem treino ou avaliação: {comodo}")
        transforms = pasta / "transforms.json"
        if not transforms.is_file() or json.loads(transforms.read_text(encoding="utf-8")) != data:
            raise ValueError("transforms.json não corresponde ao plano completo")
    return {"cameras": len(frames), "posicoes": len(posicoes), "treino": len(treino), "validacao": len(teste),
            "por_comodo": dict(Counter(f["comodo"] for f in frames)),
            "por_inclinacao": dict(Counter(f["pitch"] for f in frames)),
            "imagens_presentes": len(frames)-len(ausentes), "render_pendente": len(ausentes),
            "diagnostico": plano.get("diagnostico", False),
            "pronto_para_treino": completo and not ausentes and not plano.get("diagnostico", False)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pasta", type=Path)
    parser.add_argument("--completo", action="store_true")
    parser.add_argument("--fonte", type=Path)
    args = parser.parse_args()
    try: print(json.dumps(validar(args.pasta, args.completo, args.fonte), ensure_ascii=False, indent=2))
    except (ValueError, OSError, KeyError, struct.error) as error: parser.exit(1, f"ERRO: {error}\n")
