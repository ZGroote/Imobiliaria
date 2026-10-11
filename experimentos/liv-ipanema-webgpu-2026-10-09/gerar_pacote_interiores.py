"""Package the frozen corner scene and the independently authored middle unit.

No Blender/browser execution. The corner snapshot can adopt its isolated,
approved molding union; its raw unit, other objects and materials are preserved.
The middle unit adopts only its own source/UV1/irradiance after validation.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path

EXP = Path(__file__).resolve().parent
RECIPE_ROOT = EXP
ROOT = EXP.parents[1]
INTERIOR = ROOT / "v1.5/miniaturas/liv-ipanema/interior"
SHARED = ROOT / "v1.5/renderizador-v16-moveis/interior"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encoded(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


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


def generate(typology: str = "all", refresh_shared: bool = False) -> dict:
    planned = {}

    def write(relative: str, data: bytes) -> dict:
        planned[relative] = data
        return {"path": relative, "bytes": len(data), "sha256": digest(data)}

    def compressed(relative: str, data: bytes) -> dict:
        return {**write(relative, gzip.compress(data, compresslevel=6, mtime=0)),
                "compression": "gzip", "decodedBytes": len(data), "decodedSHA256": digest(data)}

    destination = EXP / "interiores/catalogo.json"
    catalog = json.loads(destination.read_text(encoding="utf-8")) if destination.exists() else {
        "schema": "liv-interior-catalog-v1", "tipologias": {}}
    corner_bake = INTERIOR / "luz"
    corner_source = corner_bake / "source.json"
    own_corner = EXP / "interiores/canto/bake"
    if (own_corner / "manifest.json").exists():
        corner_bake = own_corner
        corner_source = EXP / "interiores/canto/source.json"
        repair = json.loads(corner_source.read_bytes())["metadata"]["moldingRepair"]
        expected_sources = {p.relative_to(ROOT).as_posix(): digest(p.read_bytes())
                            for p in [RECIPE_ROOT / "corrigir_rodateto.py", RECIPE_ROOT / "modelo/unir_paredes.py"]}
        if repair["parentSourceSHA256"] != digest((INTERIOR / "luz/source.json").read_bytes()) or repair["sources"] != expected_sources:
            raise ValueError("Corner molding revision uses another original scene or repair recipe")
    source_bytes = corner_source.read_bytes() if typology in ("all", "canto") or refresh_shared or "shared" not in catalog else None
    source = json.loads(source_bytes) if source_bytes else None
    # Native modules are copied verbatim. They are also used by the authoring viewer.
    if refresh_shared or "shared" not in catalog:
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
    else:
        # Packaging must not silently import unrelated working-tree changes.
        for asset in catalog["shared"].values():
            data = (EXP / asset["path"]).read_bytes()
            if len(data) != asset["bytes"] or digest(data) != asset["sha256"]:
                raise ValueError("Frozen shared resource changed: " + asset["path"])
    if typology in ("all", "canto"):
        unit_bytes = (INTERIOR / "previa/unidade.json").read_bytes()
        unit = json.loads(unit_bytes)
        compact_bytes = (corner_bake / "geometry-compact.json").read_bytes()
        compact = json.loads(compact_bytes)
        light_bytes = (corner_bake / "manifest.json").read_bytes()
        light = json.loads(light_bytes)
        if source["unitSHA256"] != digest(unit_bytes) or light["sourceSHA256"] != digest(source_bytes):
            raise ValueError("Frozen source identity differs from the approved corner unit")
        if compact["sourceSHA256"] != digest(source_bytes) or compact["unitSHA256"] != digest(unit_bytes):
            raise ValueError("Compact geometry belongs to another scene/unit")
        if light["geometrySHA256"] != digest(compact_bytes) or not light["geometryApproved"] or not light["ready"]:
            raise ValueError("Corner compact/lightmap has no valid approval")
        approval = (corner_bake / "approval.json").read_bytes()
        approved = json.loads(approval)
        if (not approved.get("approved") or approved["sourceSHA256"] != digest(source_bytes)
                or approved["unitSHA256"] != digest(unit_bytes) or light["approvalSHA256"] != digest(approval)
                or light["colorPass"] is not False):
            raise ValueError("Corner approval does not identify its actual source/unit/light transport")
        atlas = (corner_bake / "irradiance.rgbm.gz").read_bytes()
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
        bake_path = EXP / "interiores/meio/bake"
        if (bake_path / "manifest.json").exists():
            own_source_bytes = (EXP / "interiores/meio/source.json").read_bytes()
            own_source = json.loads(own_source_bytes)
            compact_bytes = (bake_path / "geometry-compact.json").read_bytes()
            compact = json.loads(compact_bytes)
            light_bytes = (bake_path / "manifest.json").read_bytes()
            light = json.loads(light_bytes)
            approval = (bake_path / "approval.json").read_bytes()
            atlas = (bake_path / "irradiance.rgbm.gz").read_bytes()
            if (own_source["schema"] != "liv-interior-scene-v1" or own_source["unitId"] != unit["id"]
                    or light["unitId"] != unit["id"] or compact["unitId"] != unit["id"]
                    or own_source["unitSHA256"] != digest(unit_bytes) or light["sourceSHA256"] != digest(own_source_bytes)
                    or compact["sourceSHA256"] != digest(own_source_bytes) or compact["unitSHA256"] != digest(unit_bytes)
                    or light["unitSHA256"] != digest(unit_bytes) or light["geometrySHA256"] != digest(compact_bytes)
                    or not light["geometryApproved"] or not light["ready"] or light["colorPass"] is not False
                    or not json.loads(approval).get("approved")
                    or light["approvalSHA256"] != digest(approval) or digest(gzip.decompress(atlas)) != light["textureSHA256"]):
                raise ValueError("Middle bake identity/approval differs from its own scene/unit")
            metadata = own_source["metadata"]
            if metadata["nativeRecipeSHA256"] != digest(recipe_bytes) or metadata["nativeAssetsSHA256"] != {
                    key: asset["sha256"] for key, asset in catalog["shared"].items()}:
                raise ValueError("Middle bake uses another native recipe/shared snapshot; export and qualify it again")
            renderer_source = (EXP / "interior-renderer.js").read_text(encoding="utf-8")
            factory_source = renderer_source[renderer_source.index("function nativeFactory("):renderer_source.index("function bindFrozenFurniture(")]
            if metadata["nativeFactorySHA256"] != digest(factory_source.encode()) or metadata["source2DSHA256"] != digest((EXP / "plantas2d/meio.jpg").read_bytes()):
                raise ValueError("Middle authoring code/reference changed after the approved export")
            mappings = metadata["furnitureSlots"]
            owners = {o["slot"]: o.get("furnitureId") for o in own_source["objects"]}
            assigned = [slot for m in mappings for slot in m["slots"]]
            if len(mappings) != len(unit["planta"]["moveis"]) or any(
                    m["index"] != i or m["id"] != f"movel-{i}" or not m["slots"]
                    or any(owners.get(slot) != m["id"] for slot in m["slots"])
                    for i, m in enumerate(mappings)) or len(set(assigned)) != len(assigned) or set(assigned) != {slot for slot, owner in owners.items() if owner}:
                raise ValueError("Middle furniture mapping lost nominal ownership")
            catalog["tipologias"]["meio"].update(
                sourceSHA256=digest(own_source_bytes), geometryKind="frozen-source", lighting="approved-rgbm",
                materialsOrigin="source", nativeRecipeSHA256=digest(recipe_bytes), furnitureSlots=mappings)
            catalog["tipologias"]["meio"]["files"].update({
                "source": compressed("interiores/meio/source.json.gz", own_source_bytes),
                "compact": compressed("interiores/meio/geometry-compact.json.gz", compact_bytes),
                "light": write("interiores/meio/light.json", light_bytes),
                "atlas": {**write("interiores/meio/irradiance.rgbm.gz", atlas), "compression": "gzip",
                          "decodedBytes": light["width"] * light["height"] * 4,
                          "decodedSHA256": light["textureSHA256"]},
            })
    write("interiores/catalogo.json", encoded(catalog))
    # Validate everything before writing, and adopt complete files atomically.
    # The catalog is inserted last and becomes visible after its resources.
    for relative, data in planned.items():
        path = EXP / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() == data:
            continue
        temporary = path.with_name(path.name + ".liv-pacote.tmp")
        temporary.write_bytes(data)
        temporary.replace(path)
    return catalog


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tipologia", choices=("all", "canto", "meio"), default="all")
    parser.add_argument("--atualizar-compartilhados", action="store_true", help="Importa fontes atuais; exige requalificar os interiores e bakes vinculados.")
    args = parser.parse_args()
    result = generate(args.tipologia, args.atualizar_compartilhados)
    print(json.dumps({"catalogo": str(EXP / "interiores/catalogo.json"),
                      "tipologias": {key: {"unitSHA256": value["unitSHA256"], "sourceSHA256": value["sourceSHA256"],
                                            "lighting": value["lighting"]} for key, value in result["tipologias"].items()}}, indent=2))
