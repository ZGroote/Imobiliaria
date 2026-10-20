#!/usr/bin/env python3
"""Rented-server-only immutable delivery of the verified complete regional tour."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
import zipfile


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def digest(stream):
    count, sha = 0, hashlib.sha256()
    for block in iter(lambda: stream.read(2 * 1024 * 1024), b""):
        count += len(block)
        sha.update(block)
    return {"bytes": count, "sha256": sha.hexdigest()}


def identity(path):
    with path.open("rb") as stream:
        return digest(stream)


def checked(path, root):
    path = path.resolve(strict=True)
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"File outside rented-server work root: {path}")
    return path


def atomic_new_json(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
        tmp = Path(stream.name)
        stream.write(encoded(value))
        stream.flush()
        os.fsync(stream.fileno())
    try:
        os.link(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def asset_paths(raw):
    value = raw
    if isinstance(raw, dict):
        for key in ("files", "assets", "paths", "arquivos"):
            if key in raw:
                value = raw[key]
                break
    if isinstance(value, dict):
        return list(value)
    if not isinstance(value, list):
        raise ValueError("Expected asset manifest to contain a list or path-keyed object")
    result = []
    for record in value:
        if isinstance(record, str):
            result.append(record)
            continue
        if not isinstance(record, dict):
            raise ValueError("Invalid asset record")
        path = next((record[k] for k in ("relative", "relative_path", "rel", "path", "remote", "file", "name") if isinstance(record.get(k), str)), None)
        if path is None:
            raise ValueError("Asset record has no recognized relative path")
        result.append(path)
    return result


def safe_member(value, root, tour):
    value = value.replace("\\", "/")
    prefix = str(tour).replace("\\", "/") + "/"
    if value.startswith(prefix):
        value = value[len(prefix):]
    if value.startswith("tour-regional/"):
        value = value[len("tour-regional/"):]
    member = PurePosixPath(value)
    if member.is_absolute() or ".." in member.parts or not member.parts or ":" in value:
        raise ValueError(f"Unsafe relative asset path: {value}")
    return member.as_posix()


def browser_summary(raw, expected):
    complete = raw.get("complete") is True
    found = {}
    for key in ("views", "poses", "captures", "snapshots", "results", "screenshots", "count", "total", "pose_count", "total_poses"):
        value = raw.get(key)
        if isinstance(value, list):
            found[key] = len(value)
        elif isinstance(value, int) and not isinstance(value, bool):
            found[key] = value
    errors = {key: raw[key] for key in ("error", "errors", "console_errors", "network_failures", "nearly_uniform_images", "failures", "failed") if raw.get(key) not in (None, False, 0, "", [], {})}
    for key in ("all_model_camera_checks_passed", "all_routes_passed", "all_models_passed"):
        if key in raw and raw[key] is not True:
            errors[key] = raw[key]
    routes = raw.get("routes", raw.get("room_routes"))
    route_summary = None
    if isinstance(routes, list):
        route_summary = {"count": len(routes), "unreachable": [r.get("name", r.get("id")) for r in routes if isinstance(r, dict) and r.get("reachable") is False]}
        if route_summary["unreachable"]:
            errors["unreachable_routes"] = route_summary["unreachable"]
    return {"complete": bool(complete and expected in found.values() and not errors),
            "expected_poses": expected, "recognized_counts": found, "errors": errors, "routes": route_summary}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/root/liv-corrigido-20261016")
    parser.add_argument("--nome-base", default="entrega-tour-regional")
    parser.add_argument("--teste", default="tour-browser-validacao-final/resultado.json")
    parser.add_argument("--poses-esperadas", type=int, default=22)
    args = parser.parse_args()
    if os.name != "posix":
        raise SystemExit("Execute only on the rented Linux server, never on the PC")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,79}", args.nome_base):
        raise ValueError("Invalid output filename")
    root = Path(args.root).resolve(strict=True)
    tour = (root / "tour-regional").resolve(strict=True)
    if tour.parent != root or tour.name != "tour-regional":
        raise ValueError("Only the isolated tour-regional server copy can be packed")
    archive, publication = root / (args.nome_base + ".zip"), root / (args.nome_base + ".json")
    if archive.exists() or publication.exists():
        if not archive.is_file() or not publication.is_file():
            raise RuntimeError("Existing output is incomplete; preserve it and choose another --nome-base")
        actual = identity(archive)
        old = json.loads(publication.read_text(encoding="utf-8"))
        if any(old.get(k) != actual[k] for k in actual):
            raise RuntimeError("Existing immutable ZIP does not match its published identity")
        print(json.dumps({"ok": True, "reused_immutable": True, "file": str(archive), **actual}))
        return

    expected_path = checked(root / "tour-assets-esperados.json", root)
    verified_path = checked(root / "tour-assets-verificados.json", root)
    expected = json.loads(expected_path.read_text(encoding="utf-8-sig"))
    verified = json.loads(verified_path.read_text(encoding="utf-8-sig"))
    if not isinstance(verified, dict) or verified.get("complete") is not True or verified.get("files") != 25 or verified.get("bad") != []:
        raise ValueError("The original 25-asset transfer has not passed its explicit integrity report")
    names = [safe_member(p, root, tour) for p in asset_paths(expected)]
    if len(set(names)) != 25:
        raise ValueError(f"Expected exactly 25 distinct declared assets; found {len(set(names))}")
    test_path = checked(root / args.teste, root)
    test = json.loads(test_path.read_text(encoding="utf-8-sig"))
    summary = browser_summary(test, args.poses_esperadas)
    if not summary["complete"]:
        raise RuntimeError("Complete final browser validation is required: " + json.dumps(summary, ensure_ascii=False))
    dynamic = ("interior.html", "interior-splat.js", "splat/visita.html", "splat/comodos.json")
    newest = max((tour / p).stat().st_mtime_ns for p in dynamic)
    if test_path.stat().st_mtime_ns < newest:
        raise RuntimeError("Browser result predates a current HTML/JS/manifest edit; rerun the final test")

    payload = {}
    def add_file(name, path):
        member = PurePosixPath(name)
        if member.is_absolute() or ".." in member.parts:
            raise ValueError("Unsafe ZIP member")
        source = checked(path, root)
        if name in payload:
            if payload[name][0] != source:
                raise ValueError("Conflicting duplicate ZIP member")
            return
        payload[name] = (source, None)
    def add_bytes(name, data):
        if name in payload:
            raise ValueError("Duplicate generated member")
        payload[name] = (None, data)
    for name in names:
        add_file(name, tour / name)
    for name in ("interior.html", "interior-splat.js", "splat/old60k.sog", "splat/denso-corrigido.sog", "splat/comodos.json", "tour-regional.json"):
        add_file(name, tour / name)
    # The earlier compact viewer is an audit artifact, not part of this final app.
    if (tour / "splat" / "espera-ordenacao.json").is_file():
        add_file("proveniencia/espera-ordenacao.json", tour / "splat" / "espera-ordenacao.json")
    if (tour / "splat" / "visita.html.antes-espera-ordenacao").is_file():
        add_file("proveniencia/visita-antes-espera-ordenacao.html.txt", tour / "splat" / "visita.html.antes-espera-ordenacao")
    add_file("proveniencia/tour-assets-esperados.json", expected_path)
    add_file("proveniencia/tour-assets-verificados.json", verified_path)
    if (root / "poligonos-comodos.json").is_file():
        add_file("proveniencia/poligonos-comodos.json", root / "poligonos-comodos.json")
    proof = json.loads((tour / "tour-regional.json").read_text(encoding="utf-8-sig"))
    sogs = {}
    for key, filename in (("old", "old60k.sog"), ("new", "denso-corrigido.sog")):
        actual = identity(tour / "splat" / filename)
        recorded = proof.get("models", {}).get(key, {})
        if actual["sha256"] != recorded.get("sha256") or actual["bytes"] != recorded.get("bytes"):
            raise ValueError(f"SOG differs from model provenance: {filename}")
        sogs[key] = actual

    excluded = []
    evidence_specs = ((test_path.parent, 8 * 1024 * 1024),
                      (root / "conferencia-politica-modelos-completos", 4 * 1024 * 1024),
                      (root / "verificacao-identidade-render", 4 * 1024 * 1024))
    for directory, budget in evidence_specs:
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.json")):
            add_file("conferencias/" + directory.name + "/" + path.name, path)
        used = 0
        for path in sorted(directory.iterdir()):
            if not path.is_file() or path.suffix.lower() not in (".jpg", ".jpeg"):
                continue
            size = path.stat().st_size
            if used + size > budget:
                excluded.append({"file": str(path.relative_to(root)), "bytes": size, "reason": "JPEG attachment budget"})
                continue
            add_file("conferencias/" + directory.name + "/" + path.name, path)
            used += size
    if not any(path == test_path for path, data in payload.values() if path is not None):
        add_file("conferencias/teste-final-resultado.json", test_path)
    created = datetime.now(timezone.utc).isoformat()
    readme = f"""# Tour regional do apartamento

Entrega gerada em {created}. O aplicativo original do PC não foi editado.
Este ZIP não publica site e não abre navegador automaticamente.

## Abrir

Extraia o ZIP. Em um terminal na pasta extraída, execute:

    python -m http.server 8765 --bind 127.0.0.1

Abra http://127.0.0.1:8765/interior.html?tipologia=meio&modo=visita

Os controles de navegação, seleção de ambientes e colisões são os do Tour
existente. O modo Planta 3D continua disponível. O viewer compacto anterior
permanece separado como auditoria e não integra este aplicativo final.

## Política dos modelos

Sala, quarto e suíte usam o modelo anterior de 60 mil passos. Banheiro, banheiro
da suíte e varanda usam o modelo global denso corrigido. Fora dos polígonos
críticos, utiliza-se o modelo anterior. Os dois SOGs permanecem COMPLETOS, na
mesma origem e escala; somente um fica visível por vez, conforme a câmera.
Não houve recorte/concatenação de Gaussianas. A troca nas fronteiras é direta.

## Conferência e limites

O relatório final anexado registra {args.poses_esperadas} poses e complete:true.
Foram preservados os relatórios de execução, seleção dos modelos e evidências
disponíveis de chão e teto. Aprovação de execução não significa perfeição visual.

Ainda podem existir borrado/distorções no box, portas, vidro e ripado. O quarto
da versão anterior conserva limitações de nitidez. A transparência não representa
uma vista externa real do imóvel. Não se afirma que todas as vistas estão boas.
Consulte os JPEGs e métricas anexos antes de promover esta entrega ao site.

O relatório de integridade da transferência original foi preservado. O viewer
Spark pode ter recebido ajuste de ordenação no servidor após essa transferência;
o manifesto deste ZIP registra os hashes FINAIS, sem exigir o hash antigo desse
arquivo. Os modelos e os dados gzip permanecem como foram validados.

## Integridade e backups

MANIFESTO-SHA256.json lista tamanho e SHA256 de cada arquivo do payload,
excluindo o próprio manifesto. O JSON externo de publicação contém tamanho e
SHA256 do ZIP inteiro, cobrindo também o manifesto. O arquivo publicado é
imutável. Checkpoints, PNGs de treino e cena Blender ficam nos backups separados.
"""
    add_bytes("LEIA-ME.md", readme.encode("utf-8"))
    add_bytes("proveniencia/entrega-final.json", encoded({"schema": "liv-full-regional-delivery-v1", "created_utc": created,
              "entry": "interior.html?tipologia=meio&modo=visita", "browser_test": summary,
              "browser_result": str(test_path.relative_to(root)), "source_transfer_report": identity(verified_path),
              "models": sogs, "excluded_attachments": excluded,
              "note": "No files rewritten; final viewer hashes are recorded below, including any server-only sort setting."}))
    entries = {name: identity(source) if source is not None else {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, (source, data) in sorted(payload.items())}
    manifest_data = encoded({"schema": "liv-payload-sha256-v1", "created_utc": created, "files": entries,
                             "note": "This manifest excludes itself; external ZIP SHA256 covers it too."})
    with tempfile.NamedTemporaryFile(dir=root, prefix=args.nome_base + ".", suffix=".zip.tmp", delete=False) as stream:
        tmp = Path(stream.name)
    try:
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
            for name, (source, data) in sorted(payload.items()):
                compression = zipfile.ZIP_STORED if name.lower().endswith((".sog", ".gz", ".jpg", ".jpeg")) else zipfile.ZIP_DEFLATED
                if source is not None:
                    zf.write(source, name, compress_type=compression)
                else:
                    zf.writestr(name, data, compress_type=compression)
            zf.writestr("MANIFESTO-SHA256.json", manifest_data)
        with zipfile.ZipFile(tmp) as zf:
            if set(zf.namelist()) != set(entries) | {"MANIFESTO-SHA256.json"}:
                raise RuntimeError("ZIP differs from whitelist")
            for name, expected_id in entries.items():
                with zf.open(name) as stream:
                    if digest(stream) != expected_id:
                        raise RuntimeError(f"File changed while packaging: {name}")
            if zf.read("MANIFESTO-SHA256.json") != manifest_data:
                raise RuntimeError("Manifest mismatch")
        final_id = identity(tmp)
        os.link(tmp, archive)
        report = {"schema": "liv-zip-publication-v1", "file": archive.name, "archive": str(archive), "created_utc": created,
                  **final_id, "payload_files": len(entries), "immutable": True, "browser_test": summary,
                  "entry": "interior.html?tipologia=meio&modo=visita"}
        atomic_new_json(publication, report)
        print(json.dumps({"ok": True, **report}, ensure_ascii=False))
    finally:
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
