"""Prepara somente os nove mapas CC0 listados em assets.json, sem API no navegador.

python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --destino publicacao/piloto-qualidade-visual-2026-10-04/assets
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --verificar publicacao/piloto-qualidade-visual-2026-10-04/assets
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import platform
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import PIL
from PIL import Image, features

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUTPUT_ROOT = REPO / "publicacao" / "piloto-qualidade-visual-2026-10-04"
ROLES = ("color", "normal", "roughness")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_output(value: str) -> Path:
    path = Path(value).absolute()
    resolved = path.resolve()
    if not resolved.is_relative_to(OUTPUT_ROOT.resolve()) or resolved == OUTPUT_ROOT.resolve():
        raise ValueError("O destino deve ficar dentro de publicacao/piloto-qualidade-visual-2026-10-04/.")
    for ancestor in (path, *path.parents):
        if ancestor.is_symlink() or getattr(ancestor, "is_junction", lambda: False)():
            raise ValueError("O destino não pode atravessar links ou junctions.")
        if ancestor == REPO:
            break
    return resolved


def original_bytes(config: dict, material: dict, role: str, original_root: Path) -> bytes:
    source = material["maps"][role]
    url = urlparse(source["url"])
    if url.scheme != "https" or url.hostname != "dl.polyhaven.org" or not url.path.startswith("/file/ph-assets/Textures/"):
        raise ValueError("Origem de download fora do fornecedor CC0 permitido.")
    filename = f'{material["id"]}-{role}{Path(url.path).suffix}'
    cached = original_root / filename
    if cached.exists():
        if not cached.is_file() or cached.is_symlink():
            raise ValueError("Cache de origem inválido.")
        data = cached.read_bytes()
    else:
        request = Request(source["url"], headers={"User-Agent": config["userAgent"]})
        with urlopen(request, timeout=60) as response:
            data = response.read(source["bytes"] + 1)
    if len(data) != source["bytes"] or hashlib.md5(data).hexdigest() != source["md5"]:
        raise ValueError(f'Origem mudou: {material["id"]}/{role}; bytes ou MD5 oficial divergentes.')
    if source.get("sha256") and sha256(data) != source["sha256"]:
        raise ValueError(f'SHA-256 de origem divergente: {material["id"]}/{role}.')
    if not cached.exists():
        original_root.mkdir(parents=True, exist_ok=True)
        with cached.open("xb") as handle:
            handle.write(data)
    return data


def prepare(data: bytes, role: str, options: dict, max_dimension: int) -> tuple[bytes, dict]:
    with Image.open(io.BytesIO(data)) as source:
        source_info = {"width": source.width, "height": source.height, "mode": source.mode, "format": source.format}
        if role == "roughness":
            # PNG de 16 bits precisa ser escalado, não saturado por convert("L").
            if source.mode in ("I", "I;16", "I;16B", "I;16L"):
                image = source.convert("F").point(lambda value: value / 257.0).convert("L")
                source_info["conversion"] = "16-bit -> 8-bit /257"
            else:
                image = source.convert("L")
        else:
            image = source.convert("RGB")
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        if role == "normal":
            # Mantém Y+ OpenGL. Interpolação dos componentes seguida de normalização.
            pixels = image.tobytes()
            normalized = bytearray(len(pixels))
            for index in range(0, len(pixels), 3):
                vector = [(pixels[index + channel] - 127.5) / 127.5 for channel in range(3)]
                length = math.sqrt(sum(value * value for value in vector)) or 1.0
                for channel, value in enumerate(vector):
                    normalized[index + channel] = max(0, min(255, round((value / length + 1.0) * 127.5)))
            image = Image.frombytes("RGB", image.size, bytes(normalized))
        encoded = io.BytesIO()
        settings = {"method": options["method"]}
        if role == "color":
            settings["quality"] = options["quality"]
        else:
            settings.update(lossless=True, exact=True)
        image.save(encoded, "WEBP", **settings)
        return encoded.getvalue(), {"width": image.width, "height": image.height, "sourceImage": source_info}


def generate(destination: Path, config: dict) -> None:
    if destination.exists():
        raise ValueError("Destino ocupado: materiais preparados não são sobrescritos; use --verificar ou outro destino novo.")
    originals = local_output(str(destination.parent / "originais"))
    manifest = {"schema": 1, "license": config["license"], "licenseUrl": config["licenseUrl"], "credit": config["credit"],
                "sourceConfigSha256": sha256((HERE / "assets.json").read_bytes()), "materials": [],
                "processing": config["processing"], "runtime": {"python": platform.python_version(), "pillow": PIL.__version__, "libwebp": features.version("webp")},
                "originalsLocation": "../originais/", "maxPreparedBytes": config["maxPreparedBytes"]}
    outputs = {}
    for material in config["materials"]:
        prepared = {"id": material["id"], "name": material["name"], "tileMeters": material["tileMeters"],
                    "sourcePage": material["sourcePage"], "sourceId": material["sourceId"], "maps": {}}
        for role in ROLES:
            source = material["maps"][role]
            data = original_bytes(config, material, role, originals)
            payload, details = prepare(data, role, config["processing"][role], source["maxDimension"])
            filename = f'{material["id"]}-{role}.webp'
            if source.get("prepared") and source["prepared"] != {"file": filename, "width": details["width"], "height": details["height"], "bytes": len(payload), "sha256": sha256(payload)}:
                raise ValueError(f'Preparação divergente do inventário fixado: {filename}; confira versões do Pillow/libwebp antes de atualizar os hashes.')
            outputs[filename] = payload
            prepared["maps"][role] = {"file": filename, **details, "bytes": len(payload), "sha256": sha256(payload),
                                      "sourceUrl": source["url"], "sourceSha256": sha256(data), "sourceBytes": len(data), "sourceMd5": source["md5"],
                                      "colorSpace": config["processing"][role]["colorSpace"],
                                      **({"normalConvention": "OpenGL"} if role == "normal" else {})}
        manifest["materials"].append(prepared)
    manifest["totalPreparedBytes"] = sum(map(len, outputs.values()))
    if manifest["totalPreparedBytes"] > config["maxPreparedBytes"]:
        raise ValueError(f'Orçamento excedido: {manifest["totalPreparedBytes"]} > {config["maxPreparedBytes"]} bytes; nenhum asset final foi gravado.')
    destination.mkdir(parents=True)
    for filename, payload in outputs.items():
        with (destination / filename).open("xb") as handle:
            handle.write(payload)
    (destination / "manifesto.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"destination": str(destination), "maps": len(outputs), "totalPreparedBytes": manifest["totalPreparedBytes"], "originals": str(originals)}, ensure_ascii=False))


def verify(destination: Path, config: dict) -> None:
    manifest = json.loads((destination / "manifesto.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != 1 or manifest.get("license") != "CC0-1.0":
        raise ValueError("Manifesto ou licença inválidos.")
    if manifest["sourceConfigSha256"] != sha256((HERE / "assets.json").read_bytes()):
        raise ValueError("As fontes/opções de assets.json mudaram após a preparação.")
    if [material["id"] for material in manifest["materials"]] != ["madeira", "tecido", "frio"]:
        raise ValueError("Os três materiais previstos devem estar presentes.")
    expected = {"manifesto.json"}
    total = 0
    originals = local_output(str(destination.parent / "originais"))
    for material, source_material in zip(manifest["materials"], config["materials"], strict=True):
        if material["tileMeters"] != source_material["tileMeters"] or set(material["maps"]) != set(ROLES):
            raise ValueError("Escala ou conjunto de mapas divergente.")
        for role, record in material["maps"].items():
            filename = record["file"]
            if Path(filename).name != filename or filename != f'{material["id"]}-{role}.webp':
                raise ValueError("Nome de mapa inválido.")
            path = destination / filename
            if path.is_symlink() or not path.is_file():
                raise ValueError("Mapa ausente ou fora do destino.")
            payload = path.read_bytes()
            if len(payload) != record["bytes"] or sha256(payload) != record["sha256"]:
                raise ValueError(f'Hash/bytes divergentes: {filename}.')
            with Image.open(io.BytesIO(payload)) as image:
                if image.format != "WEBP" or image.size != (record["width"], record["height"]) or max(image.size) > source_material["maps"][role]["maxDimension"]:
                    raise ValueError(f'Dimensões/formato divergentes: {filename}.')
            source = source_material["maps"][role]
            original = originals / f'{material["id"]}-{role}{Path(urlparse(source["url"]).path).suffix}'
            data = original.read_bytes()
            if sha256(data) != record["sourceSha256"] or sha256(data) != source["sha256"] or len(data) != source["bytes"] or hashlib.md5(data).hexdigest() != source["md5"]:
                raise ValueError(f'Origem divergente: {filename}.')
            if source["prepared"] != {key: record[key] for key in ("file", "width", "height", "bytes", "sha256")}:
                raise ValueError(f'Inventário final divergente: {filename}.')
            if record["sourceUrl"] != source["url"] or record["colorSpace"] != config["processing"][role]["colorSpace"]:
                raise ValueError("Origem ou espaço de cor divergentes.")
            if role == "normal" and record.get("normalConvention") != "OpenGL":
                raise ValueError("Normal deve ser OpenGL.")
            expected.add(filename)
            total += len(payload)
    if {path.name for path in destination.iterdir()} != expected:
        raise ValueError("Arquivos extras não fazem parte do pacote de mapas.")
    if total != manifest["totalPreparedBytes"] or total > config["maxPreparedBytes"]:
        raise ValueError("Orçamento ou total de bytes divergente.")
    print(json.dumps({"verified": True, "maps": 9, "totalPreparedBytes": total, "license": "CC0-1.0"}))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--destino", help="Novo diretório de assets dentro da saída do piloto.")
    action.add_argument("--verificar", help="Conferir hashes, bytes, fontes, licença e dimensões sem baixar.")
    args = parser.parse_args()
    config = json.loads((HERE / "assets.json").read_text(encoding="utf-8"))
    destination = local_output(args.destino or args.verificar)
    if args.verificar:
        verify(destination, config)
    else:
        print(config["credit"])
        generate(destination, config)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(str(error)) from None
