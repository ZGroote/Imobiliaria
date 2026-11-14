"""Build GT-only floor candidate sheets on the server, without visual approval."""

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOMS = (
    ("Suíte", "suite"),
    ("Dormitório 01", "dormitorio-01"),
    ("Sala integrada", "sala-integrada"),
)
COLUMNS = 4
TILE_WIDTH = 480
IMAGE_HEIGHT = 270
LABEL_HEIGHT = 40
PAGE_LIMIT = 24


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
    return {
        "file": str(path.relative_to(root)),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/root/liv-corrigido-20261016"))
    root = parser.parse_args().root.resolve()
    report_path = root / "resultado-denso16-corrigido/analise-ambientes/metricas-por-ambiente.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    views = report["views"]
    if len({view["file"] for view in views}) != len(views):
        raise ValueError("Duplicate image IDs in the corrected global report")

    out = root / "comparacao-piso-global"
    out.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/dejavu/DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    generated = []
    room_counts = {}

    for room, slug in ROOMS:
        candidates = sorted(
            (view for view in views if view["comodo"] == room and view["pitch"] == -60),
            key=lambda view: view["file"],
        )
        if not candidates:
            raise ValueError(f"No pitch -60 candidates for {room}")
        room_counts[room] = len(candidates)

        for offset in range(0, len(candidates), PAGE_LIMIT):
            page = offset // PAGE_LIMIT + 1
            selected = candidates[offset:offset + PAGE_LIMIT]
            rows = math.ceil(len(selected) / COLUMNS)
            canvas = Image.new("RGB", (COLUMNS * TILE_WIDTH, rows * (IMAGE_HEIGHT + LABEL_HEIGHT)), (240, 240, 240))
            draw = ImageDraw.Draw(canvas)
            entries = []

            for index, view in enumerate(selected):
                source = Path(view["eval_file"])
                source = (source if source.is_absolute() else root / source).resolve()
                source.relative_to(root)
                with Image.open(source) as image:
                    width, height = image.size
                    if width % 2 or width < 2 or height < 1:
                        raise ValueError(f"Invalid paired eval image size for {view['file']}: {image.size}")
                    gt = image.crop((0, 0, width // 2, height)).convert("RGB")
                    thumb = gt.resize((TILE_WIDTH, IMAGE_HEIGHT), Image.Resampling.LANCZOS)

                col, row = index % COLUMNS, index // COLUMNS
                x, y = col * TILE_WIDTH, row * (IMAGE_HEIGHT + LABEL_HEIGHT)
                draw.text((x + 8, y + 2), str(view["file"]), font=font, fill=(10, 10, 10))
                draw.text((x + 8, y + 20), f"{room} | -60 | pos {view.get('position_id', '?')} | GT", font=font, fill=(10, 10, 10))
                canvas.paste(thumb, (x, y + LABEL_HEIGHT))
                entries.append({
                    "tile": index + 1,
                    "row": row + 1,
                    "column": col + 1,
                    "file": view["file"],
                    "eval_file": str(source.relative_to(root)),
                    "position_id": view.get("position_id"),
                    "pitch": view["pitch"],
                    "gt_crop": [0, 0, width // 2, height],
                    "source_size": [width, height],
                })

            target = out / f"candidatos-piso-{slug}-{page}.jpg"
            partial = target.with_name(target.stem + ".partial.jpg")
            canvas.save(partial, format="JPEG", quality=94, subsampling=0)
            partial.replace(target)
            sheet = file_record(target, root)
            sheet.update({"room": room, "pitch": -60, "page": page, "tiles": len(entries)})
            sidecar = target.with_suffix(".json")
            write_json(sidecar, {
                **sheet,
                "note": "GT is the left half of each paired eval image. Candidates are not a visual approval or a guarantee that the floor is visible.",
                "tile_size": [TILE_WIDTH, IMAGE_HEIGHT],
                "label_height": LABEL_HEIGHT,
                "columns": COLUMNS,
                "views": entries,
            })
            sheet["sidecar"] = file_record(sidecar, root)
            generated.append(sheet)

    manifest = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "report": file_record(report_path, root),
        "source": "Ground truth only; left half of corrected global eval images",
        "pitch": -60,
        "room_views": room_counts,
        "total_views": sum(room_counts.values()),
        "files": generated,
    }
    manifest_path = out / "manifesto-candidatos-piso-global.json"
    write_json(manifest_path, manifest)
    print(json.dumps({"manifest": str(manifest_path.relative_to(root)), "pages": len(generated), "room_views": room_counts}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
