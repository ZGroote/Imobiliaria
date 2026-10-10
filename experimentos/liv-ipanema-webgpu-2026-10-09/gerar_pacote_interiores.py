"""Package the frozen corner scene and the independently authored middle unit.

No Blender/browser execution. Geometry, albedo and material snapshots of the
corner unit retain their original byte identity; the middle unit uses the native
FloorPlan/HouseMesh/FurnitureCatalog factories and has no lightmap.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
INTERIOR = ROOT / "v1.5/miniaturas/liv-ipanema/interior"
SHARED = ROOT / "v1.5/renderizador-v16-moveis/interior"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def write(relative: str, data: bytes) -> dict:
    path = EXP / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"path": relative, "bytes": len(data), "sha256": digest(data)}


def compressed(relative: str, data: bytes) -> dict:
    return {**write(relative, gzip.compress(data, compresslevel=6, mtime=0)),
            "compression": "gzip", "decodedBytes": len(data), "decodedSHA256": digest(data)}


def furniture_slots(source: dict, unit: dict) -> list[dict]:
    """Recover the original furniture group spans, not a nearest-mesh heuristic.

    Each native root starts at the exact nominal position, in nominal order.
    Its following child meshes belong to it until the next nominal root starts.
    This also retains the offset rack panel and the five veranda table parts.
    """
    points = [p for room in unit["planta"]["comodos"] for p in room["poly"]]
    center = [(min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in (0, 1)]
    objects = source["objects"]
    starts = []
    cursor = 0
    for item in unit["planta"]["moveis"]:
        position = [item["p"][0] - center[0], item["p"][1] - center[1]]
        found = next((i for i in range(cursor, len(objects))
                      if abs(objects[i]["matrix"][12] - position[0]) < 1e-7
                      and abs(objects[i]["matrix"][14] - position[1]) < 1e-7), None)
        if found is None:
            raise ValueError(f"Furniture root not found in frozen scene: {item['nome']}")
        starts.append(found)
        cursor = found + 1
    result = []
    for i, start in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(objects)
        result.append({"id": f"movel-{i}", "index": i,
                       "slots": [o["slot"] for o in objects[start:end]]})
    if any(objects[i]["kind"] == "architecture" for i in range(starts[0], len(objects))):
        raise ValueError("Furniture span unexpectedly contains architecture")
    return result


def generate(typology: str = "all") -> dict:
    destination = EXP / "interiores/catalogo.json"
    catalog = json.loads(destination.read_text(encoding="utf-8")) if destination.exists() else {
        "schema": "liv-interior-catalog-v1", "tipologias": {}}
    source_bytes = (INTERIOR / "luz/source.json").read_bytes()
    source = json.loads(source_bytes)
    # Native modules are copied verbatim. They are also used by the authoring viewer.
    module_names = ["floor-plan.js", "shell-geometry.js", "openings.js", "house-mesh.js",
                    "furniture-param.js", "furniture-catalog.js"]
    runtime = "\n".join((SHARED / name).read_text(encoding="utf-8") for name in module_names)
    # This helper corrects native wall normals only; canto-only material/polygon
    # customization is deliberately not included in the middle unit factories.
    extension = (ROOT / "v1.5/miniaturas/liv-ipanema/liv-interior.js").read_text(encoding="utf-8")
    normal_helper = extension[extension.index("global.corrigirNormaisCasaLiv="):extension.index("global.particionarPisoLiv=")]
    runtime += "\n(function(global){\n" + normal_helper + "\n})(globalThis);\n"
    catalog["shared"] = {
        "runtime": write("interiores/shared/runtime.js", runtime.encode()),
        "materials": compressed("interiores/shared/materials.json.gz", encoded({
            "schema": "liv-interior-native-materials-v1", "materials": source["materials"],
            "textures": source["textures"]})),
        "furniture": compressed("interiores/shared/furniture.json.gz", (ROOT / "moveis/moveis_lib.json").read_bytes()),
    }
    if typology in ("all", "canto"):
        unit_bytes = (INTERIOR / "previa/unidade.json").read_bytes()
        unit = json.loads(unit_bytes)
        compact_bytes = (INTERIOR / "luz/geometry-compact.json").read_bytes()
        compact = json.loads(compact_bytes)
        light_bytes = (INTERIOR / "luz/manifest.json").read_bytes()
        light = json.loads(light_bytes)
        if source["unitSHA256"] != digest(unit_bytes) or light["sourceSHA256"] != digest(source_bytes):
            raise ValueError("Frozen source identity differs from the approved corner unit")
        if compact["sourceSHA256"] != digest(source_bytes) or compact["unitSHA256"] != digest(unit_bytes):
            raise ValueError("Compact geometry belongs to another scene/unit")
        if light["geometrySHA256"] != digest(compact_bytes) or not light["geometryApproved"] or not light["ready"]:
            raise ValueError("Corner compact/lightmap has no valid approval")
        atlas = (INTERIOR / "luz/irradiance.rgbm.gz").read_bytes()
        if digest(gzip.decompress(atlas)) != light["textureSHA256"]:
            raise ValueError("Corner irradiance identity differs from approved manifest")
        catalog["tipologias"]["canto"] = {
            "id": "canto", "label": "Apartamento de canto", "area": 47.59,
            "unitId": unit["id"], "unitSHA256": digest(unit_bytes), "sourceSHA256": digest(source_bytes),
            "geometryKind": "frozen-source", "lighting": "approved-rgbm",
            "furnitureSlots": furniture_slots(source, unit),
            "files": {
                "unit": write("interiores/canto/unidade.json", unit_bytes),
                "source": compressed("interiores/canto/source.json.gz", source_bytes),
                "compact": compressed("interiores/canto/geometry-compact.json.gz", compact_bytes),
                "light": write("interiores/canto/light.json", light_bytes),
                "atlas": {**write("interiores/canto/irradiance.rgbm.gz", atlas), "compression": "gzip",
                          "decodedBytes": light["width"] * light["height"] * 4,
                          "decodedSHA256": light["textureSHA256"]},
            },
        }
    # A shared factory/material update also changes the middle recipe identity.
    # Refresh it when present even in a corner-only run; never leave a stale recipe.
    if typology in ("all", "meio") or (EXP / "interiores/meio/unidade.json").exists():
        path = EXP / "interiores/meio/unidade.json"
        if not path.exists():
            raise FileNotFoundError("The middle unit must first be authored independently")
        unit_bytes = path.read_bytes()
        unit = json.loads(unit_bytes)
        recipe = {"schema": "liv-interior-native-recipe-v1", "unitId": unit["id"],
                  "unitSHA256": digest(unit_bytes),
                  "runtimeSHA256": catalog["shared"]["runtime"]["sha256"],
                  "materialsSHA256": catalog["shared"]["materials"]["sha256"],
                  "furnitureSHA256": catalog["shared"]["furniture"]["sha256"],
                  "factories": ["FloorPlan", "HouseMesh", "Openings", "FurnitureParam", "FurnitureCatalog"],
                  "lighting": "dynamic", "cornerFloorPartition": False, "cornerCountertopCustomization": False}
        recipe_bytes = encoded(recipe)
        catalog["tipologias"]["meio"] = {
            "id": "meio", "label": "Apartamento de meio",
            "areaPublishedRange": [unit["ficha"]["area_publicada_min_m2"], unit["ficha"]["area_publicada_max_m2"]],
            "unitId": unit["id"], "unitSHA256": digest(unit_bytes), "sourceSHA256": digest(recipe_bytes),
            "geometryKind": "native-factories", "lighting": "dynamic",
            "files": {"unit": {"path": "interiores/meio/unidade.json", "bytes": len(unit_bytes), "sha256": digest(unit_bytes)},
                      "recipe": write("interiores/meio/recipe.json", recipe_bytes)},
        }
    write("interiores/catalogo.json", encoded(catalog))
    return catalog


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tipologia", choices=("all", "canto", "meio"), default="all")
    args = parser.parse_args()
    result = generate(args.tipologia)
    print(json.dumps({"catalogo": str(EXP / "interiores/catalogo.json"),
                      "tipologias": {key: {"unitSHA256": value["unitSHA256"], "sourceSHA256": value["sourceSHA256"],
                                            "lighting": value["lighting"]} for key, value in result["tipologias"].items()}}, indent=2))
