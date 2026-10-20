"""Compare selected held-out regions on the server; no visual approval is inferred."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


SOURCES = (
    ("old60k", "60 mil anterior", "resultado-refino60k"),
    ("A", "Composicao A", "resultado-composicao"),
    ("B", "Composicao B", "resultado-composicao-denso-regional"),
)
GROUPS = (
    ("pisos-suite-dormitorio", ("f1662", "f2269", "f0917", "f1960")),
    ("pisos-sala-criticos", ("f0239", "f2449", "f0589", "f2156", "f2512")),
    ("box-vidros-conexoes", ("f0781", "f0140", "f0896", "f0540", "f0849")),
    ("regressao-sala-quartos", ("f0401", "f1802", "f1832", "f1928")),
)
WIDTH = 480
HEIGHT = 270
LABEL_HEIGHT = 40
EXPECTED_VIEWS = 377


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    partial = path.with_name(path.stem + ".partial.json")
    partial.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    partial.replace(path)


def file_record(path, root):
    return {"file": str(path.relative_to(root)), "bytes": path.stat().st_size, "sha256": sha256(path)}


def eval_path(root, view):
    source = Path(view["eval_file"])
    source = (source if source.is_absolute() else root / source).resolve()
    source.relative_to(root)
    if not source.is_file():
        raise FileNotFoundError(f"Evaluation image is not ready: {source}")
    return source


def load_sources(root):
    reports = {}
    indexed = {}
    for key, label, directory in SOURCES:
        path = root / directory / "analise-ambientes/metricas-por-ambiente.json"
        if not path.is_file():
            raise FileNotFoundError(f"{label} is not ready: missing {path}")
        report = json.loads(path.read_text(encoding="utf-8"))
        views = report["views"]
        by_id = {view["file"]: view for view in views}
        if len(by_id) != len(views) or len(views) != EXPECTED_VIEWS:
            raise ValueError(f"{label} is not a complete unique {EXPECTED_VIEWS}-view evaluation")
        reports[key] = file_record(path, root)
        indexed[key] = by_id

    reference_ids = set(indexed["old60k"])
    if any(set(indexed[key]) != reference_ids for key, _, _ in SOURCES):
        raise ValueError("The source evaluations do not contain the same camera IDs")

    for _, ids in GROUPS:
        for short_id in ids:
            image_id = f"images/{short_id}.png"
            reference = indexed["old60k"][image_id]
            for key, _, _ in SOURCES:
                view = indexed[key][image_id]
                if any(view[field] != reference[field] for field in ("comodo", "pitch", "position_id")):
                    raise ValueError(f"Camera metadata differs for {image_id} in {key}")
                eval_path(root, view)
    return reports, indexed


def read_pair(path):
    with Image.open(path) as image:
        image = image.convert("RGB")
        width, height = image.size
        if width < 2 or width % 2 or height < 1:
            raise ValueError(f"Invalid paired evaluation dimensions in {path}: {image.size}")
        half = width // 2
        return image.crop((0, 0, half, height)), image.crop((half, 0, width, height))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/root/liv-corrigido-20261016"))
    root = parser.parse_args().root.resolve()
    report_records, indexed = load_sources(root)
    out = root / "conferencia-final-regioes"
    out.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = ImageFont.load_default()

    generated = []
    for slug, ids in GROUPS:
        canvas = Image.new("RGB", (4 * WIDTH, len(ids) * (HEIGHT + LABEL_HEIGHT)), (240, 240, 240))
        draw = ImageDraw.Draw(canvas)
        entries = []
        for row, short_id in enumerate(ids):
            image_id = f"images/{short_id}.png"
            reference = indexed["old60k"][image_id]
            pairs = {}
            sources = {}
            for key, _, _ in SOURCES:
                view = indexed[key][image_id]
                path = eval_path(root, view)
                pairs[key] = read_pair(path)
                sources[key] = {
                    "eval_file": str(path.relative_to(root)),
                    "psnr": view["psnr"],
                    "ssim": view["ssim"],
                }

            gt = pairs["old60k"][0]
            errors = {}
            for key, _, _ in SOURCES:
                candidate_gt, prediction = pairs[key]
                if candidate_gt.size != gt.size or prediction.size != gt.size:
                    raise ValueError(f"Image dimensions differ for {image_id} in {key}")
            for source_index, (key, _, _) in enumerate(SOURCES):
                for other_key, _, _ in SOURCES[source_index + 1:]:
                    error = max(high for _, high in ImageChops.difference(pairs[key][0], pairs[other_key][0]).getextrema())
                    if error > 1:
                        raise ValueError(f"Ground truth differs for {image_id}, {key}/{other_key}: maximum error {error}")
                    errors[f"{key}/{other_key}"] = error

            parts = [("GT", gt)] + [(label, pairs[key][1]) for key, label, _ in SOURCES]
            for col, (label, part) in enumerate(parts):
                x, y = col * WIDTH, row * (HEIGHT + LABEL_HEIGHT)
                title = f"{reference['comodo']} | {reference['pitch']} | {image_id}"
                draw.text((x + 7, y + 2), title, font=font, fill=(10, 10, 10))
                draw.text((x + 7, y + 21), label, font=font, fill=(10, 10, 10))
                canvas.paste(part.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS), (x, y + LABEL_HEIGHT))

            entries.append({
                "row": row + 1,
                "file": image_id,
                "room": reference["comodo"],
                "pitch": reference["pitch"],
                "position_id": reference["position_id"],
                "gt_size": list(gt.size),
                "gt_max_absolute_difference_between_sources": errors,
                "sources": sources,
            })

        target = out / f"{slug}.jpg"
        partial = target.with_name(target.stem + ".partial.jpg")
        canvas.save(partial, format="JPEG", quality=94, subsampling=0)
        partial.replace(target)
        sheet = file_record(target, root)
        sheet["views"] = len(entries)
        sidecar = target.with_suffix(".json")
        write_json(sidecar, {
            **sheet,
            "columns": ["GT", "old60k", "A", "B"],
            "tile_size": [WIDTH, HEIGHT],
            "label_height": LABEL_HEIGHT,
            "note": "Selected held-out cameras, without ranking by room mean. These comparisons do not imply visual approval.",
            "camera_views": entries,
        })
        sheet["sidecar"] = file_record(sidecar, root)
        generated.append(sheet)

    manifest_path = out / "manifesto-conferencia-final-regioes.json"
    write_json(manifest_path, {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "columns": ["GT", "old60k", "A", "B"],
        "reports": report_records,
        "total_selected_views": sum(len(ids) for _, ids in GROUPS),
        "files": generated,
    })
    print(json.dumps({"manifest": str(manifest_path.relative_to(root)), "sheets": len(generated)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
