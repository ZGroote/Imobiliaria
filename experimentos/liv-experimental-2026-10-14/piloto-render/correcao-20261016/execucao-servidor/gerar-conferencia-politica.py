"""Server-only review of the whole-model room policy; does not render a new model."""

import argparse
import hashlib
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

from PIL import Image, ImageChops, ImageDraw, ImageFont


SOURCES = (
    ("old60k", "60 mil anterior", "resultado-refino60k"),
    ("dense_corrected", "Denso corrigido", "resultado-denso16-corrigido"),
)
POLICY = {
    "Banho": "dense_corrected",
    "Banho suíte": "dense_corrected",
    "Dormitório 01": "old60k",
    "Sala integrada": "old60k",
    "Suíte": "old60k",
    "Varanda / serviço": "dense_corrected",
}
SLUGS = {
    "Banho": "banho",
    "Banho suíte": "banho-suite",
    "Dormitório 01": "dormitorio-01",
    "Sala integrada": "sala-integrada",
    "Suíte": "suite",
    "Varanda / serviço": "varanda-servico",
}
EXTRA_IDS = (
    "f1662", "f2269", "f0917", "f1960", "f0239", "f2449",
    "f0781", "f0896", "f0849",
)
KNOWN_DEFECTS = [
    "O antigo60k tem falhas próprias no Dormitório: f2221 (-60) contém véu bege sobre piso e móveis, f2418 (0) perde móveis/armário. Preservar o modelo antigo não resolve esses defeitos.",
    "Banho e Banho suíte melhoraram frente ao antigo60k em várias superfícies, mas box, porta, paredes refletivas e vidros ainda têm borrado/distorções. Conferir especialmente f0781 e f0896.",
    "Varanda f0849: a referência apresenta vidro escuro/refletivo; o denso corrigido ainda apresenta área leitosa/azulada. f1937: planta translúcida. f1341: caixilho/janela deformados.",
    "Sala f1832: o antigo60k preserva fios do pendente que o denso perdeu. Sala f1927 tem borrado lateral já presente no antigo.",
    "As vistas de piso da Suíte disponíveis no conjunto de validação mostram passagens e faixas estreitas; elas não comprovam piso amplo ao redor da cama.",
    "A política troca modelos completos por posição da câmera. Estas folhas são uma seleção de frames das avaliações já existentes, sem executar essa troca no navegador e sem medir continuidade ao atravessar portas.",
]
WIDTH, HEIGHT, LABEL_HEIGHT = 480, 270, 44
EXPECTED_VIEWS = 377


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def record(path, root):
    return {"file": str(path.relative_to(root)), "bytes": path.stat().st_size,
            "sha256": sha256(path)}


def write_json(path, value):
    partial = path.with_name(path.stem + ".partial.json")
    partial.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    partial.replace(path)


def eval_path(root, view):
    path = Path(view["eval_file"])
    path = (path if path.is_absolute() else root / path).resolve()
    path.relative_to(root)
    if not path.is_file():
        raise FileNotFoundError(path)
    return path


def read_pair(path):
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        width, height = rgb.size
        if width < 2 or width % 2 or height < 1:
            raise ValueError(f"Invalid evaluation image dimensions: {path}: {rgb.size}")
        half = width // 2
        return rgb.crop((0, 0, half, height)), rgb.crop((half, 0, width, height))


def pair_images(root, indexed, image_id):
    pairs = {key: read_pair(eval_path(root, indexed[key][image_id]))
             for key, _, _ in SOURCES}
    gt = pairs["old60k"][0]
    if any(part.size != gt.size for pair in pairs.values() for part in pair):
        raise ValueError(f"Source dimensions differ: {image_id}")
    error = max(high for _, high in ImageChops.difference(
        pairs["old60k"][0], pairs["dense_corrected"][0]).getextrema())
    if error > 1:
        raise ValueError(f"Ground truth differs: {image_id}: max absolute difference {error}")
    return pairs, error


def load_sources(root):
    indexed, reports = {}, {}
    for key, _, directory in SOURCES:
        path = root / directory / "analise-ambientes/metricas-por-ambiente.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        views = data["views"]
        by_file = {view["file"]: view for view in views}
        if len(views) != EXPECTED_VIEWS or len(by_file) != EXPECTED_VIEWS:
            raise ValueError(f"Incomplete or duplicated evaluation for {key}")
        indexed[key], reports[key] = by_file, record(path, root)
    if set(indexed["old60k"]) != set(indexed["dense_corrected"]):
        raise ValueError("Camera ID sets differ")
    return indexed, reports


def summarize(rows):
    result = {"views": len(rows),
              "independent_camera_origins": len({row["position_id"] for row in rows})}
    for key in ("old60k", "dense_corrected", "selected"):
        result[key] = {
            "psnr_mean": mean(row[key]["psnr"] for row in rows),
            "psnr_min": min(row[key]["psnr"] for row in rows),
            "ssim_mean": mean(row[key]["ssim"] for row in rows),
            "ssim_min": min(row[key]["ssim"] for row in rows),
        }
    result["selected_minus_old60k"] = {
        metric + "_mean": mean(row["selected"][metric] - row["old60k"][metric] for row in rows)
        for metric in ("psnr", "ssim")}
    result["selected_minus_dense_corrected"] = {
        metric + "_mean": mean(row["selected"][metric] - row["dense_corrected"][metric] for row in rows)
        for metric in ("psnr", "ssim")}
    return result


def build_sheet(root, out, indexed, rows, name, font, note):
    canvas = Image.new("RGB", (4 * WIDTH, len(rows) * (HEIGHT + LABEL_HEIGHT)), (240, 240, 240))
    draw = ImageDraw.Draw(canvas)
    entries = []
    for row_index, row in enumerate(rows):
        image_id = row["file"]
        pairs, error = pair_images(root, indexed, image_id)
        selected = row["selected_source"]
        parts = [("Referencia GT", pairs["old60k"][0]),
                 ("60 mil anterior", pairs["old60k"][1]),
                 ("Denso corrigido", pairs["dense_corrected"][1]),
                 (f"Selecionado: {selected}", pairs[selected][1])]
        for column, (label, part) in enumerate(parts):
            x, y = column * WIDTH, row_index * (HEIGHT + LABEL_HEIGHT)
            title = f"{row['room']} | {row['pitch']} | {image_id} | {row.get('selection', 'extra')}"
            draw.text((x + 6, y + 3), title, font=font, fill=(10, 10, 10))
            draw.text((x + 6, y + 23), label, font=font, fill=(10, 10, 10))
            canvas.paste(part.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS), (x, y + LABEL_HEIGHT))
        entries.append({**row, "gt_max_absolute_difference": error})
    target = out / f"{name}.jpg"
    partial = target.with_name(target.stem + ".partial.jpg")
    canvas.save(partial, format="JPEG", quality=94, subsampling=0)
    partial.replace(target)
    info = record(target, root)
    sidecar = target.with_suffix(".json")
    write_json(sidecar, {**info, "columns": ["GT", "old60k", "dense_corrected", "selected"],
                        "tile_size": [WIDTH, HEIGHT], "note": note,
                        "rows": entries})
    return {**info, "sidecar": record(sidecar, root), "rows": len(rows)}


def main():
    if os.name == "nt":
        raise SystemExit("Execute este helper apenas no servidor Linux; no PC faça somente verificação AST.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/root/liv-corrigido-20261016"))
    root = parser.parse_args().root.resolve()
    out = root / "conferencia-politica-modelos-completos"
    out.mkdir(parents=True, exist_ok=True)
    indexed, reports = load_sources(root)
    rows, gt_errors = [], {}
    for image_id in sorted(indexed["old60k"]):
        old, dense = indexed["old60k"][image_id], indexed["dense_corrected"][image_id]
        for field in ("comodo", "pitch", "position_id"):
            if old[field] != dense[field]:
                raise ValueError(f"Camera metadata mismatch: {image_id}: {field}")
        if old["comodo"] not in POLICY or old["pitch"] not in (-60, 0, 60):
            raise ValueError(f"Unexpected room or pitch: {image_id}")
        pairs, error = pair_images(root, indexed, image_id)
        for pair in pairs.values():
            for part in pair:
                part.close()
        gt_errors[image_id] = error
        selected = POLICY[old["comodo"]]
        row = {"file": image_id, "room": old["comodo"], "pitch": old["pitch"],
               "position_id": old["position_id"], "selected_source": selected,
               "gt_max_absolute_difference": error}
        for key in ("old60k", "dense_corrected"):
            view = indexed[key][image_id]
            row[key] = {"psnr": view["psnr"], "ssim": view["ssim"],
                        "eval_file": str(eval_path(root, view).relative_to(root))}
        row["selected"] = dict(row[selected])
        rows.append(row)
        if len(rows) % 50 == 0:
            print(f"Validated same-GT pairs: {len(rows)}/{EXPECTED_VIEWS}", flush=True)
    by_group = defaultdict(list)
    by_room = defaultdict(list)
    by_id = {row["file"]: row for row in rows}
    for row in rows:
        by_group[(row["room"], row["pitch"])].append(row)
        by_room[row["room"]].append(row)
    if len(by_group) != 18 or len(by_room) != 6:
        raise ValueError("Expected all 18 room/pitch groups and six rooms")
    note = ("Selecao de frames das avaliacoes anteriores dos modelos completos: nao e render "
            "de um novo modelo nem teste do navegador. Minimo/mediana usam PSNR do modelo "
            "selecionado em cada inclinacao. Mesmas cameras e GT verificado (erro maximo <=1). "
            "Nao implica aprovacao visual ou continuidade entre portas.")
    try:
        font = ImageFont.truetype("/usr/share/fonts/dejavu/DejaVuSans.ttf", 14)
    except OSError:
        font = ImageFont.load_default()
    sheets = []
    for room, slug in SLUGS.items():
        selected_rows = []
        for pitch in (-60, 0, 60):
            group = sorted(by_group[(room, pitch)], key=lambda row: (row["selected"]["psnr"], row["file"]))
            selected_rows.extend([{**group[0], "selection": "min PSNR"},
                                  {**group[len(group) // 2], "selection": "mediana PSNR"}])
        sheets.append(build_sheet(root, out, indexed, selected_rows, slug, font, note))
    extra_rows = [{**by_id[f"images/{short_id}.png"],
                   "selection": "piso visivel" if i < 6 else "vidro/conexao"}
                  for i, short_id in enumerate(EXTRA_IDS)]
    sheets.append(build_sheet(root, out, indexed, extra_rows,
                              "pisos-visiveis-vidros-conexoes", font, note))
    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "method": note,
        "policy": POLICY,
        "models_are_complete": True,
        "new_render_performed": False,
        "automatic_visual_approval": False,
        "browser_transition_validated_by_this_helper": False,
        "evaluation_limit": "377 paired views from only 16 independent held-out camera origins; no guarantee for arbitrary tour poses.",
        "source_reports": reports,
        "gt_validation": {"paired_views": len(rows), "max_absolute_difference": max(gt_errors.values()),
                          "per_view_max_absolute_difference": gt_errors},
        "overall": summarize(rows),
        "rooms": {room: summarize(group) for room, group in by_room.items()},
        "room_pitch": {f"{room} / {pitch}": summarize(by_group[(room, pitch)])
                       for room in POLICY for pitch in (-60, 0, 60)},
        "known_defects_and_limits": KNOWN_DEFECTS,
        "views": rows,
        "sheets": sheets,
    }
    report_path = out / "relatorio-politica.json"
    write_json(report_path, report)
    manifest = out / "manifesto-conferencia-politica.json"
    write_json(manifest, {"created_utc": report["created_utc"], "report": record(report_path, root),
                          "files": sheets, "policy": POLICY,
                          "note": note, "visual_approval": "pending_human_review"})
    print(json.dumps({"manifest": str(manifest.relative_to(root)), "sheets": len(sheets),
                      "same_gt_paired_views": len(rows)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
