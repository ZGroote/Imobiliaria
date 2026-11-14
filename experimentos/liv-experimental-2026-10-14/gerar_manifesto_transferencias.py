"""Build the queue allowlist from the preserved, source-verified baseline."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLANTA_SHA = "a25114ef2c6fb455b38c787ae6b3c8420c81b534e19031a8cc0a34e4e1d95971"
MEIO_SHA = "bc846b68c7ce1204578336829d205ea3c60aee80258429aed6f45d331a3e032a"


def build(root=ROOT):
    original = json.loads((root / "manifesto.json").read_text(encoding="utf-8"))["arquivos"]
    files = []

    def add(path, group, record, essential=True):
        data = (root / path).read_bytes()
        if len(data) != record["bytes"] or hashlib.sha256(data).hexdigest() != record["sha256"]:
            raise ValueError(f"Recurso diverge da fonte preservada: {path}")
        files.append({"path": path, "group": group, **record, "essential": essential})

    catalog_path="interiores/catalogo.json"
    catalog_bytes=(root/catalog_path).read_bytes()
    catalog=json.loads(catalog_bytes)
    if catalog.get("schema")!="liv-interior-catalog-v1" or set(catalog.get("tipologias",{}))!={"canto","meio"}:
        raise ValueError("O catálogo deve conter as duas tipologias verificadas.")
    add(catalog_path,"tour",{"bytes":len(catalog_bytes),"sha256":hashlib.sha256(catalog_bytes).hexdigest()})
    interior_files={}
    def collect(value):
        if isinstance(value,dict):
            if {"path","bytes","sha256"}.issubset(value):
                record={key:value[key] for key in ["bytes","sha256"]}
                path=value["path"]
                if not path.startswith(("interiores/canto/","interiores/meio/","interiores/shared/")) or ".." in path.split("/"):
                    raise ValueError("Asset de interior fora do pacote.")
                if path in interior_files and interior_files[path]!=record:
                    raise ValueError("Identidades conflitantes de um asset.")
                interior_files[path]=record
            for child in value.values():collect(child)
        elif isinstance(value,list):
            for child in value:collect(child)
    collect(catalog)
    if not interior_files:raise ValueError("Catálogo de interiores sem arquivos.")
    # Shared inputs precede each independent typology; foreground demands can jump
    # directly to the chosen typology without treating the other one as a prerequisite.
    for prefix in ["interiores/shared/","interiores/canto/","interiores/meio/"]:
        for path in sorted(path for path in interior_files if path.startswith(prefix)):
            add(path,"tour",interior_files[path],False)
    map_runtime=json.loads((root/"mapa-2d-manifest.json").read_bytes())
    if map_runtime.get("schema")!="liv-map-2d-v1":
        raise ValueError("Manifesto do mapa 2D inválido.")
    for path, record in map_runtime["files"].items():
        add(path,"map",record)
    add("plantas2d/canto.jpg", "planta2d", {"bytes": 63548, "sha256": PLANTA_SHA},False)
    meio=(root/"plantas2d/meio.jpg").read_bytes()
    add("plantas2d/meio.jpg", "planta2d", {"bytes":len(meio),"sha256":MEIO_SHA},False)
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
