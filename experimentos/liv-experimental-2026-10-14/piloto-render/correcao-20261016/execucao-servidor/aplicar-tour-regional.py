#!/usr/bin/env python3
"""Patch the isolated server tour; never train, render, or edit the source app.

Run only on the rented Linux server after copying the existing tour and its
dependencies into /root/liv-corrigido-20261016/tour-regional. Model URLs resolve
relative to tour-regional/splat/visita.html, exactly as in the existing viewer.
"""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.parse import unquote, urlsplit


BEGIN = "// BEGIN TOUR_REGIONAL_POLYGONS"
END = "// END TOUR_REGIONAL_POLYGONS"
KEYS = ("sala", "varanda", "quarto", "suite", "banho-suite", "banho-social")
CRITICAL = {"varanda", "banho-suite", "banho-social"}
ORDER = ("banho-social", "banho-suite", "varanda", "sala", "quarto", "suite")
ALIASES = {
    "sala": "sala", "sala integrada": "sala", "sala cozinha": "sala",
    "varanda": "varanda", "varanda servico": "varanda",
    "quarto": "quarto", "dormitorio": "quarto", "dormitorio 01": "quarto",
    "dormitorio 1": "quarto", "suite": "suite",
    "banho suite": "banho-suite", "banheiro suite": "banho-suite",
    "banho": "banho-social", "banheiro": "banho-social",
    "banho social": "banho-social", "banheiro social": "banho-social",
}


def normalized(value):
    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9]+", " ", plain.lower()).split())


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(2 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def read_polygons(path):
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(raw, dict):
        raise ValueError("poligonos-comodos.json must be a room-name -> XY polygon object")
    polygons, original_names = {}, {}
    for name, polygon in raw.items():
        key = ALIASES.get(normalized(name))
        if key is None:
            raise ValueError(f"Unrecognized room name; no guess allowed: {name!r}")
        if key in polygons:
            raise ValueError(f"Duplicate room mapping for {key}: {name!r}")
        if not isinstance(polygon, list) or len(polygon) < 3:
            raise ValueError(f"Invalid polygon: {name!r}")
        points = []
        for point in polygon:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                raise ValueError(f"Expected 2D Blender XY point for {name!r}: {point!r}")
            if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in point):
                raise ValueError(f"Non-finite polygon point for {name!r}")
            points.append([float(point[0]), float(point[1])])
        area2 = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1]))
        if abs(area2) < 1e-8:
            raise ValueError(f"Zero-area polygon: {name!r}")
        polygons[key], original_names[key] = points, name
    if set(polygons) != set(KEYS):
        raise ValueError(f"Expected exactly six rooms; missing: {sorted(set(KEYS) - set(polygons))}")
    return {key: polygons[key] for key in ORDER}, original_names


def polygon_block(polygons):
    encoded = json.dumps(polygons, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return f"""{BEGIN}
// Real room polygons in unchanged Blender XY coordinates. The existing loop
// sends camera.position.x and -camera.position.z. Both SOGs remain complete.
const POLIGONOS_REGIONAIS = {encoded};
function dentroPoligonoRegional(poly, x, y) {{
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {{
    const a = poly[j], b = poly[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const comprimento = Math.hypot(dx, dy);
    const projecao = (x - a[0]) * dx + (y - a[1]) * dy;
    if (comprimento > 0 &&
        Math.abs(dx * (y - a[1]) - dy * (x - a[0])) <= 1e-8 * comprimento &&
        projecao >= -1e-8 && projecao <= comprimento * comprimento + 1e-8) return true;
    if ((a[1] > y) !== (b[1] > y) &&
        x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }}
  return dentro;
}}
// Critical rooms own shared boundary points; all other positions use old60k.
const COMODOS = Object.entries(POLIGONOS_REGIONAIS).map(([nome, poly]) =>
  [nome, (x, y) => dentroPoligonoRegional(poly, x, y)]);
{END}"""


def patch_source(source, polygons):
    block = polygon_block(polygons)
    if BEGIN in source:
        pattern = re.escape(BEGIN) + r".*?" + re.escape(END)
    else:
        pattern = r"^// Cômodos no espaço do Blender.*?^const COMODOS = \[.*?^\];"
    patched, count = re.subn(pattern, lambda match: block, source, flags=re.M | re.S)
    if count != 1:
        raise ValueError(f"Expected exactly one room-zone block, found {count}; source left unchanged")
    old = '(x, y) => COMODOS.find(([nome, dentro]) => arquivos[nome] && dentro(x, y))?.[0] ?? null;'
    new = '(x, y) => COMODOS.find(([nome, dentro]) => arquivos[nome] && dentro(x, y))?.[0] ?? (arquivos.sala ? "sala" : null);'
    if patched.count(old) == 1:
        patched = patched.replace(old, new)
    elif patched.count(new) != 1:
        raise ValueError("Regional locator differs from expected source; source left unchanged")
    patched = patched.replace(
        '// O ensaio global cobre todo o percurso; não depende dos retângulos aproximados do treino por cômodo.',
        '// Global mode remains unchanged; regional mode uses the real room polygons.'
    )
    for required in (
        'const global = query.get("splat-piloto") === "global";',
        'splat.setArquivo(arquivos[comodo]);',
        'splat.setCamera(p.toArray(), cam.quaternion.toArray(), cam.fov, cam.aspect);',
        'splat.prefetch(arquivos[vizinho]);',
        'const p = cam.position, x = p.x, y = -p.z;',
    ):
        if required not in patched:
            raise ValueError(f"Existing mode/camera/cache API missing: {required}")
    return patched


def model_file(root, viewer_dir, url):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or parts.query or parts.fragment or not parts.path:
        raise ValueError("Use local model URLs without query strings or fragments")
    path = (viewer_dir / unquote(parts.path)).resolve(strict=True)
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Model must be an existing file under the server work root: {url}")
    return path


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
        tmp = Path(stream.name)
        try:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
    try:
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def backup_once(path):
    backup = path.with_name(path.name + ".antes-regional")
    if path.exists() and not backup.exists():
        with backup.open("xb") as stream:
            stream.write(path.read_bytes())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/root/liv-corrigido-20261016")
    parser.add_argument("--old-model", default="old60k.sog")
    parser.add_argument("--new-model", default="denso-corrigido.sog")
    parser.add_argument("--include-piloto", action="store_true", help="Also update the regional piloto=1 manifest in this copy")
    args = parser.parse_args()
    if os.name != "posix":
        raise SystemExit("Server-only helper: execute on the rented Linux server, never on the PC")
    root = Path(args.root).resolve(strict=True)
    tour = (root / "tour-regional").resolve(strict=True)
    if tour.parent != root or tour.name != "tour-regional":
        raise ValueError("The isolated tour must be root/tour-regional; refusing another app path")
    source_path = tour / "interior-splat.js"
    polygons_path = root / "poligonos-comodos.json"
    polygons, names = read_polygons(polygons_path)
    original = source_path.read_text(encoding="utf-8-sig")
    patched = patch_source(original, polygons)
    models = {"old": model_file(root, tour / "splat", args.old_model),
              "new": model_file(root, tour / "splat", args.new_model)}
    if models["old"] == models["new"]:
        raise ValueError("Old and new models resolve to the same file")
    manifest = {key: args.new_model if key in CRITICAL else args.old_model for key in KEYS}
    payload = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    manifest_paths = [tour / "splat" / "comodos.json"]
    if args.include_piloto:
        manifest_paths.append(tour / "splat" / "comodos-piloto.json")
    provenance = {
        "schema": "liv-tour-regional-full-models-v1",
        "coordinate_system": "Blender XY; viewer camera XY = [position.x, -position.z]",
        "selection": "new complete model in the three critical room polygons; old complete model everywhere else",
        "critical_rooms": sorted(CRITICAL), "boundary_owner": "critical room first",
        "hysteresis_meters": 0, "crossfade": False, "model_cropping": False,
        "polygon_source": str(polygons_path), "polygon_sha256": sha256(polygons_path),
        "room_names": names, "polygons": polygons, "manifest": manifest,
        "models": {label: {"path": str(path), "bytes": path.stat().st_size, "sha256": sha256(path)} for label, path in models.items()},
        "source_before_sha256": sha256(source_path),
        "source_after_sha256": hashlib.sha256(patched.encode("utf-8")).hexdigest(),
        "entry": "interior.html?tipologia=meio&modo=visita",
    }
    # All validation is complete before changing any file. Originals survive once.
    for path in [source_path, *manifest_paths]:
        backup_once(path)
    for path in manifest_paths:
        atomic_write(path, payload)
    atomic_write(source_path, patched.encode("utf-8"))
    atomic_write(tour / "tour-regional.json", (json.dumps(provenance, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({"ok": True, "tour": str(tour), "entry": provenance["entry"], "manifest": manifest,
                      "model_bytes": {label: path.stat().st_size for label, path in models.items()}}, ensure_ascii=False))


if __name__ == "__main__":
    main()
