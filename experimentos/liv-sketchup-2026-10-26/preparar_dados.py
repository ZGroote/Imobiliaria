"""Converte os buffers públicos em malhas editáveis, mantendo instâncias e UVs."""
import base64
import gzip
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "dados"


def read(name):
    return json.loads(gzip.decompress((ROOT / "fontes" / (name + ".json.gz")).read_bytes()))


def decode(attribute):
    if attribute is None:
        return None
    formats = {"Float32Array": "f", "Float64Array": "d", "Uint32Array": "I",
               "Uint16Array": "H", "Uint8Array": "B", "Int16Array": "h"}
    return list(struct.unpack("<" + str(attribute["length"]) + formats[attribute["type"]],
                              base64.b64decode(attribute["base64"])))


def srgb(value):
    return round(255 * (12.92 * value if value <= .0031308 else 1.055 * value ** (1 / 2.4) - .055))


def texture_record(record, prefix, key):
    if record.get("data"):
        raw = base64.b64decode(record["data"].split(",", 1)[1])
        p = OUT / "texturas" / f"{prefix}-{key}.png"
        p.write_bytes(raw)
    elif record.get("url"):
        p = ROOT / "fontes" / record["url"]
    else:
        return None
    return {"path": p.as_posix(), "repeat": record.get("repeat", [1, 1]),
            "offset": record.get("offset", [0, 0]), "flipY": record.get("flipY", True)}


def materials(records, textures, prefix):
    result = {}
    iterator = records.items() if isinstance(records, dict) else enumerate(records)
    for key, value in iterator:
        entry = {"name": value.get("name") or f"{prefix}-{key}",
                 "color": [srgb(max(0, min(1, c))) for c in value.get("color", [1, 1, 1])],
                 "opacity": value.get("opacity", 1), "roughness": value.get("roughness", .7),
                 "metalness": value.get("metalness", 0), "vertexColors": value.get("vertexColors", False)}
        for source, dest in [("map", "texture"), ("normalMap", "normal"), ("roughnessMap", "roughnessMap")]:
            index = value.get(source)
            if index is not None and str(index) in textures:
                entry[dest] = textures[str(index)]
        result[str(key)] = entry
    return result


def save(name, data):
    for item in data["geometries"].values():
        positions = item["position"]
        assert len(positions) % 3 == 0 and all(math.isfinite(v) for v in positions)
        indices = item.get("index")
        if indices:
            assert len(indices) % 3 == 0 and min(indices) >= 0 and max(indices) < len(positions) // 3
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(name, "geometrias", len(data["geometries"]), "objetos", len(data["objects"]),
          "bytes", path.stat().st_size, flush=True)


def main():
    (OUT / "texturas").mkdir(parents=True, exist_ok=True)
    exterior = read("exterior")
    tex = {str(i): texture_record(t, "exterior", i) for i, t in enumerate(exterior["textures"])}
    geometry = {}
    for i, value in enumerate(exterior["geometries"]):
        a = value["attributes"]
        geometry[str(i)] = {k: decode(a.get(k)) for k in ("position", "normal", "uv", "color")}
        geometry[str(i)]["index"] = decode(value.get("index"))
    objects = []
    for item in exterior["meshes"]:
        instance = item.get("instances")
        matrices = [item["matrix"]]
        if instance:
            values = decode(instance["matrix"])
            matrices = [values[i:i + 16] for i in range(0, len(values), 16)]
        objects.append({"name": item["name"], "geometry": str(item["geometry"]),
                        "material": str(item["material"]), "matrix": item["matrix"],
                        "instances": matrices if instance else None,
                        "tower": item.get("userData", {}).get("tower", -1)})
    save("exterior", {"geometries": geometry, "materials": materials(exterior["materials"], tex, "Exterior"),
                       "objects": objects, "camera": exterior["camera"], "views": exterior["views"],
                       "bounds": exterior["visibleBounds"]})
    apartment = read("apartamento")
    tex = {key: texture_record(t, "apartamento", key) for key, t in apartment["textures"].items()}
    objects = []
    for i, item in enumerate(apartment["objects"]):
        if not item.get("include", True):
            continue
        objects.append({"slot": i, "name": item["name"], "geometry": item["geometry"],
                        "material": item["materials"][0], "matrix": item["matrix"],
                        "kind": item["kind"], "ceiling": item["name"] == "forro-original" or 7 <= i <= 19})
    save("apartamento", {"geometries": apartment["geometries"],
                          "materials": materials(apartment["materials"], tex, "Interior"),
                          "objects": objects, "rooms": apartment["rooms"]})


if __name__ == "__main__":
    main()
