"""Build the queue allowlist from the preserved, source-verified baseline."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLANTA_SHA = "a25114ef2c6fb455b38c787ae6b3c8420c81b534e19031a8cc0a34e4e1d95971"


def build(root=ROOT):
    original = json.loads((root / "manifesto.json").read_text(encoding="utf-8"))["arquivos"]
    files = []

    def add(path, group, record, essential=True):
        data = (root / path).read_bytes()
        if len(data) != record["bytes"] or hashlib.sha256(data).hexdigest() != record["sha256"]:
            raise ValueError(f"Recurso diverge da fonte preservada: {path}")
        files.append({"path": path, "group": group, **record, "essential": essential})

    add("site-baseline/maquete-liv-ipanema.html", "tour", original["maquete-liv-ipanema.html"])
    for path in ["mapa-liv-ipanema-5km.html", "liv-ipanema.glb"]:
        add("site-baseline/" + path, "map", original[path])
    tiles = sorted(path for path in original if path.startswith("quintais/") and path.endswith(".bin"))
    if len(tiles) != 120:
        raise ValueError("A versão preservada deve conter 120 tiles do mapa.")
    for path in tiles:
        add("site-baseline/" + path, "map", original[path], False)
    add("plantas2d/canto.jpg", "planta2d", {"bytes": 63548, "sha256": PLANTA_SHA})
    result = {
        "schema": "liv-transfer-manifest-v1",
        "order": ["tour", "map", "planta2d"],
        "groups": {"tour": {"label": "Tour 3D"}, "map": {"label": "Mapa"}, "planta2d": {"label": "Planta 2D"}},
        "files": files,
    }
    # Version represents the complete ordered catalog, independent of formatting.
    canonical = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    result["version"] = hashlib.sha256(canonical).hexdigest()
    return result


if __name__ == "__main__":
    manifest = build()
    (ROOT / "transfer-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(manifest["files"]), "bytes": sum(f["bytes"] for f in manifest["files"]), "version": manifest["version"]}))
