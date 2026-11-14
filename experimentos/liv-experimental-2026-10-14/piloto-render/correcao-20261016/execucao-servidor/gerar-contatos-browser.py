"""SERVER ONLY: contact sheets of existing real Spark/Firefox SOG captures."""

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


LABELS = {
    "sala": "Sala integrada", "quarto": "Dormitório 01", "suite": "Suíte",
    "varanda": "Varanda / serviço", "banho-suite": "Banho suíte",
    "banho-social": "Banho", "banho": "Banho",
}
PITCHES = (-60, 0, 60)


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def record(path, root):
    return {"file": str(path.relative_to(root)), "bytes": path.stat().st_size,
            "sha256": sha256(path)}


def write_json(path, data):
    partial = path.with_name(path.stem + ".partial.json")
    partial.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    partial.replace(path)


def font(size):
    try:
        return ImageFont.truetype("/usr/share/fonts/dejavu/DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()


def load_source(root):
    source = root / "compacto-browser-validacao"
    path = source / "resultado.json"
    report = json.loads(path.read_text(encoding="utf-8"))
    config = report["config"]
    rooms = config["keys"]
    critical = sorted(config["critical"])
    if len(rooms) != 6 or len(set(rooms)) != 6 or len(critical) != 3:
        raise ValueError("Expected six rooms and three critical regions")
    if not report.get("complete"):
        raise ValueError("Browser validation is not complete; preserve its failure report before generating final contacts")
    expected = {(f"room-{room}", pitch) for room in rooms for pitch in PITCHES}
    expected.update((f"boundary-{room}-{side}", pitch)
                    for room in critical for side in ("old", "new") for pitch in PITCHES)
    indexed = {}
    for view in report["views"]:
        key = (view["label"], view["expected_pitch"])
        if key in indexed:
            raise ValueError(f"Duplicate capture: {key}")
        if key not in expected:
            raise ValueError(f"Unexpected capture: {key}")
        state = view["state"]
        selected = state["selected"]
        if selected != view["expected_model"] or state.get("requested") != selected:
            raise ValueError(f"Model selection mismatch: {key}")
        if abs(state["pitch"] - view["expected_pitch"]) >= .05:
            raise ValueError(f"Pitch mismatch: {key}")
        visible = [model["key"] for model in state["models"] if model.get("visible")]
        if visible != [selected]:
            raise ValueError(f"Not exactly one selected model visible: {key}")
        files = [entry for entry in view["files"] if Path(entry["file"]).suffix.lower() in (".jpg", ".jpeg")]
        if len(files) != 1:
            raise ValueError(f"Expected one JPEG capture: {key}")
        entry = files[0]
        image = (source / entry["file"]).resolve()
        image.relative_to(source.resolve())
        if not image.is_file() or image.stat().st_size != entry["bytes"] or sha256(image) != entry["sha256"]:
            raise ValueError(f"Capture integrity failure: {image}")
        indexed[key] = {"view": view, "path": image, "source_record": record(image, root)}
    if set(indexed) != expected or len(indexed) != 36:
        raise ValueError(f"Expected all 36 captures (18 room and 18 boundary poses), found {len(indexed)}")
    return report, indexed, record(path, root), rooms, critical


def sheet(root, out, indexed, rows, slug, width, height, label_height, note):
    columns = len(rows[0])
    if any(len(row) != columns for row in rows):
        raise ValueError("Non-rectangular contact layout")
    canvas = Image.new("RGB", (columns * width, len(rows) * (height + label_height)), (240, 240, 240))
    draw = ImageDraw.Draw(canvas)
    label_font = font(15 if width >= 640 else 13)
    entries = []
    for row_index, row in enumerate(rows):
        for column_index, (key, title, subtitle) in enumerate(row):
            item = indexed[key]
            x, y = column_index * width, row_index * (height + label_height)
            draw.text((x + 6, y + 3), title, font=label_font, fill=(10, 10, 10))
            draw.text((x + 6, y + 24), subtitle, font=label_font, fill=(10, 10, 10))
            with Image.open(item["path"]) as image:
                image = image.convert("RGB")
                resized = ImageOps.contain(image, (width, height), Image.Resampling.LANCZOS)
                tile = Image.new("RGB", (width, height), (0, 0, 0))
                tile.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
                canvas.paste(tile, (x, y + label_height))
                original_size = list(image.size)
            view = item["view"]
            state = view["state"]
            entries.append({"row": row_index + 1, "column": column_index + 1,
                            "label": key[0], "pitch": key[1], "title": title,
                            "subtitle": subtitle, "capture": item["source_record"],
                            "original_size": original_size, "selected": state["selected"],
                            "room": state["room"], "camera": state["camera"],
                            "expected_model_url": view["expected_model_url"],
                            "selection_frames": state.get("selectionFrames"),
                            "visual_approval": "pending"})
    target = out / f"{slug}.jpg"
    partial = target.with_name(target.stem + ".partial.jpg")
    canvas.save(partial, format="JPEG", quality=94, subsampling=0)
    partial.replace(target)
    info = record(target, root)
    sidecar = target.with_suffix(".json")
    write_json(sidecar, {**info, "note": note, "rows": len(rows), "columns": columns,
                        "tile_size": [width, height], "label_height": label_height,
                        "captures": entries, "automatic_visual_approval": False})
    return {**info, "sidecar": record(sidecar, root), "captures": len(entries)}


def main():
    if os.name != "posix":
        raise SystemExit("Execute apenas no servidor Linux. No PC, somente AST.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/root/liv-corrigido-20261016"))
    root = parser.parse_args().root.resolve()
    report, indexed, source_record, rooms, critical = load_source(root)
    out = root / "compacto-browser-contatos"
    out.mkdir(parents=True, exist_ok=True)
    note = ("Capturas JPEG reais do Firefox/Spark exibindo os SOG completos. Contatos apenas "
            "redimensionam capturas existentes, sem retreino, novo render ou alteracao de modelo. "
            "Checagens tecnicas de carregamento/posicao/modelo nao comprovam qualidade visual, "
            "colisoes, passagem real por portas ou desempenho no PC. Revisao visual pendente.")

    floor_ceiling_rows = []
    for room in rooms:
        label = LABELS.get(room, room)
        floor_ceiling_rows.append([
            ((f"room-{room}", -60), f"{label} | CHAO (-60)", "Spark real | " + indexed[(f"room-{room}", -60)]["view"]["expected_model"]),
            ((f"room-{room}", 60), f"{label} | TETO (+60)", "Spark real | " + indexed[(f"room-{room}", 60)]["view"]["expected_model"]),
        ])
    horizontal_tiles = [((f"room-{room}", 0), f"{LABELS.get(room, room)} | HORIZONTAL (0)",
                         "Spark real | " + indexed[(f"room-{room}", 0)]["view"]["expected_model"])
                        for room in rooms]
    horizontal_rows = [horizontal_tiles[i:i + 2] for i in range(0, len(horizontal_tiles), 2)]
    boundary_rows = []
    for room in critical:
        row = []
        for pitch in PITCHES:
            pitch_label = {-60: "CHAO", 0: "HORIZONTAL", 60: "TETO"}[pitch]
            for side, side_label in (("old", "ANTES / antigo"), ("new", "DEPOIS / denso")):
                key = (f"boundary-{room}-{side}", pitch)
                row.append((key, f"{LABELS.get(room, room)} | {pitch_label}",
                            f"{side_label} | {pitch:+d}"))
        boundary_rows.append(row)

    files = [sheet(root, out, indexed, floor_ceiling_rows, "pisos-e-tetos", 640, 360, 48, note),
             sheet(root, out, indexed, horizontal_rows, "horizontais", 640, 360, 48, note),
             sheet(root, out, indexed, boundary_rows, "limites", 320, 180, 48, note)]
    manifest = out / "manifesto-contatos-browser.json"
    write_json(manifest, {"created_utc": datetime.now(timezone.utc).isoformat(),
                          "source_report": source_record,
                          "source_browser_complete": report["complete"],
                          "source_html_sha256": report.get("html_sha256"),
                          "source_navigation_limit": report.get("navigation"),
                          "source_boundary_limit": report.get("boundary_note"),
                          "source_software_preferences_requested": report.get("software_preferences_requested"),
                          "source_boundaries": report.get("boundaries"),
                          "note": note, "visual_approval": "pending", "total_captures": 36,
                          "layout_limites": "Rows are three critical regions. Each row: floor before/after, horizontal before/after, ceiling before/after.",
                          "files": files})
    print(json.dumps({"manifest": str(manifest.relative_to(root)), "sheets": len(files),
                      "captures": 36}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
