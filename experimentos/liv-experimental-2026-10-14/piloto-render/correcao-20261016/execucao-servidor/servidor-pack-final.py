#!/usr/bin/env python3
"""Build an immutable, self-contained compact tour ZIP on the rented server."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile


CRITICAL = {"banho-social", "banho-suite", "varanda"}
LIBRARIES = (
    "splat/lib/spark.module.min.js",
    "splat/lib/three/build/three.module.js",
    "splat/lib/three/build/three.core.js",
    "splat/lib/three/examples/jsm/postprocessing/Pass.js",
)


def digest_stream(stream):
    digest = hashlib.sha256()
    size = 0
    for block in iter(lambda: stream.read(2 * 1024 * 1024), b""):
        size += len(block)
        digest.update(block)
    return size, digest.hexdigest()


def identity(path):
    with path.open("rb") as stream:
        size, digest = digest_stream(stream)
    return {"bytes": size, "sha256": digest}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")


def inside_root(path, root):
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root) or not resolved.is_file():
        raise ValueError(f"Not an existing file in the rented-server work root: {path}")
    return resolved


def local_url_path(url, base, root):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or parts.query or parts.fragment or parts.path.startswith("/"):
        raise ValueError(f"Expected a relative local model URL: {url}")
    return inside_root(base / unquote(parts.path), root)


def test_summary(raw, expected):
    """Require an explicit completion signal and a matching pose count."""
    completion_keys = ("complete", "completed", "concluido", "concluida", "ok", "success", "passed")
    complete = any(raw.get(key) is True for key in completion_keys)
    complete = complete or str(raw.get("status", "")).lower() in {"complete", "completed", "concluido", "concluida", "ok", "success", "passed"}
    lists = ("poses", "results", "views", "captures", "snapshots", "screenshots", "registros", "capturas")
    counts = ("total", "pose_count", "poses_count", "total_poses", "count", "completed_poses", "num_poses", "capturas")
    found = []
    for key in lists:
        if isinstance(raw.get(key), list):
            found.append((key, len(raw[key])))
    for key in counts:
        value = raw.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            found.append((key, value))
    # Some scripts put the counters alongside details inside a summary object.
    if isinstance(raw.get("summary"), dict):
        for key in counts:
            value = raw["summary"].get(key)
            if isinstance(value, int) and not isinstance(value, bool):
                found.append(("summary." + key, value))
    exact = [item for item in found if item[1] == expected]
    failures = {key: raw[key] for key in ("error", "errors", "failures", "failed", "console_errors", "network_failures", "nearly_uniform_images") if raw.get(key) not in (None, False, 0, "", [], {})}
    if raw.get("all_model_camera_checks_passed") is not True:
        failures["all_model_camera_checks_passed"] = raw.get("all_model_camera_checks_passed", "missing")
    return {"complete": bool(complete and exact and not failures), "expected_poses": expected,
            "recognized_counts": dict(found), "failures": failures,
            "note": "Browser execution and model selection checks do not imply all visual defects were fixed."}


def publish_json_once(path, value):
    payload = json_bytes(value)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name + ".", suffix=".tmp", delete=False) as stream:
        tmp = Path(stream.name)
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        # Linux hard-link creation is atomic and refuses an existing destination.
        os.link(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/root/liv-corrigido-20261016")
    parser.add_argument("--nome-base", default="entrega-regional-compacta", help="Output name only; payload remains the compact tour")
    parser.add_argument("--teste", default="compacto-browser-validacao/resultado.json", help="Result JSON relative to the work root")
    parser.add_argument("--poses-esperadas", type=int, default=36)
    parser.add_argument("--permitir-teste-pendente", action="store_true", help="Preserve an explicitly unapproved backup if the final browser test is unavailable")
    args = parser.parse_args()
    if os.name != "posix":
        raise SystemExit("Server-only packer; never execute on the PC")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,79}", args.nome_base) or args.poses_esperadas < 1:
        raise ValueError("Invalid output name or expected pose count")
    root = Path(args.root).resolve(strict=True)
    tour = (root / "tour-regional").resolve(strict=True)
    if tour.parent != root or tour.name != "tour-regional":
        raise ValueError("Refusing another application path")
    archive = root / (args.nome_base + ".zip")
    published = root / (args.nome_base + ".json")
    if archive.exists():
        if not published.exists():
            raise RuntimeError("ZIP already exists without a publication JSON; preserve it and use a different --nome-base")
        recorded = json.loads(published.read_text(encoding="utf-8"))
        actual = identity(archive)
        if any(recorded.get(key) != actual[key] for key in ("bytes", "sha256")):
            raise RuntimeError("Existing immutable ZIP does not match its publication JSON")
        print(json.dumps({"ok": True, "reused_immutable": True, "archive": str(archive), **actual}))
        return
    if published.exists():
        raise RuntimeError("Publication JSON already exists; refusing to replace it")

    source_html = inside_root(tour / "visita-compacta.html", root)
    proof_path = inside_root(tour / "visita-compacta.json", root)
    proof = json.loads(proof_path.read_text(encoding="utf-8"))
    html_identity = identity(source_html)
    if html_identity["sha256"] != proof.get("html_sha256"):
        raise ValueError("HTML differs from compact-viewer provenance; do not package an untested modification")
    html = source_html.read_text(encoding="utf-8")
    match = re.search(r"const CFG = (.*?);\s*\nconst query", html, re.S)
    if not match:
        raise ValueError("The compact HTML configuration differs from the expected source")
    config = json.loads(match.group(1))
    if set(config.get("models", {})) != {"old", "new"} or set(config.get("critical", [])) != CRITICAL:
        raise ValueError("Unexpected complete-model regional policy")

    payload = {}  # archive path -> (source file, generated bytes)
    def add_file(name, path):
        if name in payload or PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts:
            raise ValueError(f"Unsafe or duplicated ZIP member: {name}")
        payload[name] = (inside_root(path, root), None)
    def add_bytes(name, value):
        if name in payload:
            raise ValueError(f"Duplicated generated member: {name}")
        payload[name] = (None, value)

    source_model_ids = {}
    source_model_paths = {}
    model_archive_paths = {}
    for label in ("old", "new"):
        url = config["models"][label]
        member = PurePosixPath(unquote(urlsplit(url).path))
        if member.is_absolute() or ".." in member.parts or len(member.parts) < 2 or member.parts[0] != "splat":
            raise ValueError("Model URL must be self-contained under ./splat/; HTML will not be rewritten")
        path = local_url_path(url, tour, root)
        actual = identity(path)
        expected = proof.get("models", {}).get(label, {})
        if actual["sha256"] != expected.get("sha256") or actual["bytes"] != expected.get("bytes"):
            raise ValueError(f"SOG differs from the recorded compact-viewer provenance: {label}")
        source_model_ids[label] = {"source": str(path), **actual}
        source_model_paths[label] = path
        model_archive_paths[label] = member.as_posix()
        add_file(member.as_posix(), path)
    add_file("visita-compacta.html", source_html)
    add_file("proveniencia/visita-compacta-servidor.json", proof_path)
    for name in LIBRARIES:
        add_file(name, tour / name)
    add_file("proveniencia/poligonos-comodos.json", root / "poligonos-comodos.json")
    for name in ("tour-regional.json",):
        if (tour / name).is_file():
            add_file("proveniencia/" + name, tour / name)
    integration_js = inside_root(tour / "interior-splat.js", root)
    if "BEGIN TOUR_REGIONAL_POLYGONS" not in integration_js.read_text(encoding="utf-8-sig"):
        raise ValueError("Integration script has not received the real-polygon patch")
    add_file("integracao/interior-splat.js", integration_js)
    old_manifest = inside_root(tour / "splat" / "comodos.json", root)
    add_file("proveniencia/comodos-servidor.json", old_manifest)
    integration_manifest = json.loads(old_manifest.read_text(encoding="utf-8-sig"))
    if set(integration_manifest) != set(config["keys"]):
        raise ValueError("Integration manifest does not map the same six rooms")
    for key, url in integration_manifest.items():
        label = "new" if key in CRITICAL else "old"
        if local_url_path(url, tour / "splat", root) != source_model_paths[label]:
            raise ValueError(f"Integration manifest uses an unexpected model in {key}")
        member = PurePosixPath("splat") / PurePosixPath(unquote(urlsplit(url).path))
        if member.as_posix() != model_archive_paths[label]:
            raise ValueError("Integration manifest aliases differ from packaged model URLs; keep the tested HTML unchanged")
    add_file("integracao/splat/comodos.json", old_manifest)

    test_path = root / args.teste
    summary = {"complete": False, "expected_poses": args.poses_esperadas, "recognized_counts": {}, "failures": {"reason": "result JSON unavailable"}}
    if test_path.is_file():
        test_path = inside_root(test_path, root)
        raw_test = json.loads(test_path.read_text(encoding="utf-8"))
        if not isinstance(raw_test, dict):
            raise ValueError("Browser result must be a JSON object")
        summary = test_summary(raw_test, args.poses_esperadas)
        if raw_test.get("html_sha256") != html_identity["sha256"]:
            summary["complete"] = False
            summary["failures"]["html_sha256"] = "Browser result does not identify the current exact HTML bytes"
    if not summary["complete"] and not args.permitir_teste_pendente:
        raise RuntimeError("Final browser test not explicitly complete for the expected poses: " + json.dumps(summary, ensure_ascii=False))

    excluded = []
    evidence_specs = (
        ("compacto-browser-validacao", 36, 6 * 1024 * 1024),
        ("conferencia-politica-modelos-completos", 7, 12 * 1024 * 1024),
        ("verificacao-identidade-render", 7, 6 * 1024 * 1024),
    )
    for dirname, jpeg_limit, byte_limit in evidence_specs:
        directory = root / dirname
        if not directory.is_dir():
            excluded.append({"directory": dirname, "reason": "not present"})
            continue
        for path in sorted(directory.glob("*.json")):
            add_file("conferencias/" + dirname + "/" + path.name, path)
        used = 0
        count = 0
        candidates = sorted([p for p in directory.iterdir() if p.is_file() and p.suffix.lower() in (".jpg", ".jpeg")])
        for path in candidates:
            size = path.stat().st_size
            if count >= jpeg_limit or used + size > byte_limit:
                excluded.append({"file": dirname + "/" + path.name, "bytes": size, "reason": "JPEG attachment count/size limit"})
                continue
            add_file("conferencias/" + dirname + "/" + path.name, path)
            used += size
            count += 1
    # Keep a custom result path even when it is outside the three known evidence directories.
    if test_path.is_file() and not any(path == test_path.resolve() for path, data in payload.values() if path is not None):
        add_file("conferencias/teste-browser-resultado.json", test_path)

    utc = datetime.now(timezone.utc).isoformat()
    test_text = (f"O teste automatizado do visualizador concluiu {args.poses_esperadas} poses, conforme o resultado JSON anexado. "
                 "Isso verifica execução e seleção dos modelos; não comprova ausência de defeitos visuais.") if summary["complete"] else (
                 "O teste automatizado final está PENDENTE. Este pacote é um backup preservado e não está aprovado visualmente.")
    readme = f"""# Visita regional compacta do apartamento

Gerada em {utc}.

## Abrir

1. Extraia este ZIP em uma pasta.
2. Abra um terminal nessa pasta e execute:

   python -m http.server 8765 --bind 127.0.0.1

3. Abra http://127.0.0.1:8765/visita-compacta.html no navegador.

O empacotador não abre navegador, não inicia servidor no PC e não publica site.

Arraste para olhar; use WASD para andar. No celular, toque e segure para avançar.
Os seis botões levam a câmeras reais das capturas. Chão e Teto mudam a inclinação
para -60 e +60 graus, sem mover a câmera para outro ponto.

## Modelos utilizados

- Sala, quarto e suíte: versão anterior de 60 mil passos.
- Banheiro, banheiro da suíte e varanda: modelo global denso corrigido.
- Fora dos polígonos críticos: versão anterior de 60 mil passos.

Os dois modelos ficam completos e na mesma origem/escala. Somente um é desenhado
por vez, escolhido pela posição da câmera. Nenhuma gaussiana foi recortada ou
concatenada neste visualizador. Há troca direta de modelo nas fronteiras.

## Conferência e limitações

{test_text}

Foram preservadas evidências numéricas e JPEGs disponíveis, incluindo chão e
teto. Os JSONs anexos registram resultados e eventuais falhas. A presença de uma
imagem ou a média de um cômodo não significa que todas as vistas estejam boas.

Ainda podem existir distorções/manchas no box, portas e vidro dos banheiros.
O quarto da versão anterior também conserva limitações de nitidez. Este pacote
não afirma que todo o borrado foi eliminado.

Esta visita compacta usa navegação livre SparkControls. Não inclui colisões com
paredes/móveis, rotas guiadas nem o restante dos controles do Tour original.
As cópias em integracao/ servem para incorporar a política regional ao aplicativo
completo após revisão: copie o JS para a raiz do aplicativo e o manifesto para
splat/comodos.json, junto com os dois SOGs e os recursos do viewer já existentes.
O aplicativo completo não está incluído neste ZIP compacto.

## Integridade

MANIFESTO-SHA256.json contém tamanho e SHA256 de cada arquivo do payload,
excluindo o próprio manifesto. O JSON externo de publicação registra tamanho e
SHA256 do ZIP inteiro, cobrindo também o manifesto. Os SOGs foram comparados com
a proveniência do visualizador antes de empacotar. Não altere o ZIP publicado.
Checkpoints, capturas PNG e a cena Blender ficam nos backups separados.
"""
    add_bytes("LEIA-ME.md", readme.encode("utf-8"))
    packaged_proof = {"schema": "liv-regional-compact-delivery-v1", "created_utc": utc,
                      "entry": "visita-compacta.html", "models": source_model_ids,
                      "packaged_model_urls": config["models"], "critical_rooms": sorted(CRITICAL),
                      "browser_test": summary, "excluded_attachments": excluded,
                      "html_change": "None; exact source HTML bytes preserved, with the same relative model URLs",
                      "html_sha256": html_identity["sha256"],
                      "limitations": ["remaining bathroom shower/glass artifacts", "old bedroom sharpness limits", "free navigation without collisions", "direct boundary switching"]}
    add_bytes("visita-compacta.json", json_bytes(packaged_proof))

    entries = {}
    for name, (source, data) in sorted(payload.items()):
        entries[name] = identity(source) if source is not None else {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    manifest = {"schema": "liv-payload-sha256-v1", "created_utc": utc, "files": entries,
                "note": "This manifest excludes itself; the external ZIP SHA256 covers the entire archive."}
    manifest_data = json_bytes(manifest)
    with tempfile.NamedTemporaryFile(dir=root, prefix=args.nome_base + ".", suffix=".zip.tmp", delete=False) as stream:
        tmp_zip = Path(stream.name)
    try:
        with zipfile.ZipFile(tmp_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
            for name, (source, data) in sorted(payload.items()):
                compression = zipfile.ZIP_STORED if name.lower().endswith((".sog", ".jpg", ".jpeg")) else zipfile.ZIP_DEFLATED
                if source is not None:
                    zf.write(source, name, compress_type=compression)
                else:
                    zf.writestr(name, data, compress_type=compression)
            zf.writestr("MANIFESTO-SHA256.json", manifest_data)
        with zipfile.ZipFile(tmp_zip) as zf:
            if set(zf.namelist()) != set(entries) | {"MANIFESTO-SHA256.json"}:
                raise RuntimeError("ZIP member list differs from the whitelist")
            for name, expected in entries.items():
                with zf.open(name) as stream:
                    size, digest = digest_stream(stream)
                if {"bytes": size, "sha256": digest} != expected:
                    raise RuntimeError(f"Payload changed during packing: {name}")
            if zf.read("MANIFESTO-SHA256.json") != manifest_data:
                raise RuntimeError("Manifest changed during packing")
        final_id = identity(tmp_zip)
        os.link(tmp_zip, archive)  # Atomic, never overwrites an existing archive.
        publication = {"schema": "liv-zip-publication-v1", "file": archive.name, "archive": str(archive),
                       "created_utc": utc, **final_id, "payload_files": len(entries),
                       "browser_test": summary, "immutable": True, "entry": "visita-compacta.html"}
        publish_json_once(published, publication)
        print(json.dumps({"ok": True, **publication}, ensure_ascii=False))
    finally:
        tmp_zip.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
