"""Catálogo verificável dos recursos efetivamente usados por uma maquete empacotada."""
import argparse
import hashlib
import json
from pathlib import Path


def build(root):
    root = Path(root).resolve()
    files = {}

    def add(path, group="tour", record=None, essential=False, background=False):
        target = (root / path).resolve()
        if not target.is_relative_to(root) or target == root:
            raise ValueError(f"Recurso fora do pacote: {path}")
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if record and (record.get("bytes") != len(data) or record.get("sha256") != digest):
            raise ValueError(f"Recurso diferente de seu catálogo: {path}")
        files[path] = {"path": path, "group": group, "bytes": len(data), "sha256": digest,
                       "essential": essential, **({"background": False} if not background else {})}

    def collect(value):
        if isinstance(value, dict):
            if {"path", "bytes", "sha256"} <= value.keys():
                add(value["path"], record=value)
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)

    old = root / "transfer-manifest.json"
    if old.exists():
        for record in json.loads(old.read_text(encoding="utf-8"))["files"]:
            if record["group"] == "map" and (root / record["path"]).is_file():
                add(record["path"], "map", record, record["essential"], background=False)

    catalog_path = "interiores/catalogo.json"
    catalog = json.loads((root / catalog_path).read_text(encoding="utf-8"))
    if catalog.get("schema") != "liv-interior-catalog-v1" or not catalog.get("tipologias"):
        raise ValueError("Catálogo de interiores inválido.")
    add(catalog_path, essential=True, background=True)
    collect(catalog["shared"])
    for typology, entry in catalog["tipologias"].items():
        timed = root / "interiores" / typology / "luz-horario/manifest.json"
        for name, record in entry["files"].items():
            if name == "atlas" and timed.exists():
                continue  # O runtime usa só os UVs antigos; a luz vem do horário.
            collect(record)
        if timed.exists():
            add(timed.relative_to(root).as_posix())
            lighting = json.loads(timed.read_text(encoding="utf-8"))
            collect(lighting["keys"])
            collect(lighting["night"])

    library_path = "interiores/melhorias/catalogo.json"
    library = json.loads((root / library_path).read_text(encoding="utf-8"))
    add(library_path)
    resources = library["assets"] + [library.get("environment"), library.get("background"),
        library.get("look"), *library.get("reflectionEnvironments", {}).values()]
    for record in filter(None, resources):
        path = record["path"]
        if not path.startswith("interiores/melhorias/"):
            path = "interiores/melhorias/" + path
        add(path, record=record)
    for image in sorted((root / "plantas2d").glob("*.jpg")):
        add(image.relative_to(root).as_posix(), "planta2d", background=True)

    result = {"schema": "liv-transfer-manifest-v1", "order": ["tour", "map", "planta2d"],
        "groups": {"tour": {"label": "Tour 3D"}, "map": {"label": "Mapa"}, "planta2d": {"label": "Planta 2D"}},
        "files": list(files.values())}
    canonical = json.dumps(result, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    result["version"] = hashlib.sha256(canonical).hexdigest()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    result = build(args.root)
    (args.root / "transfer-manifest.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"files": len(result["files"]), "bytes": sum(x["bytes"] for x in result["files"])}))


if __name__ == "__main__":
    main()
