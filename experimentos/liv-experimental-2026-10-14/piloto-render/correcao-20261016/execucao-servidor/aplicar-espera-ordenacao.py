#!/usr/bin/env python3
"""Patch only the isolated server iframe: reveal after current-camera sorting."""
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile

BEGIN = "// BEGIN ESPERA_ORDENACAO"
BLOCK = r'''
// BEGIN ESPERA_ORDENACAO
let sortVersion = 0, sortAppliedVersion = -1, sortRunning = false;
const sortPending = () => sortRunning || sortAppliedVersion !== sortVersion;
function requestSortedPresentation() {
  sortVersion++; apresentado = null; sujo = true;
}
async function sortCurrentPresentation() {
  if (sortRunning || !cache.ready || !cameraRecebida || !ativo) return;
  const version = sortVersion, file = cache.selected;
  const previousAutoUpdate = spark.autoUpdate;
  const deadline = performance.now() + 45000;
  sortRunning = true; spark.autoUpdate = false;
  const pause = async () => {
    if (performance.now() > deadline) throw new Error("Tempo excedido ao ordenar o modelo para esta câmera.");
    await new Promise(resolve => setTimeout(resolve, 16));
  };
  try {
    // An earlier automatic update may still own the worker. Never mistake its
    // completion (or update()'s early return while sorting) for this request.
    while (spark.sorting) await pause();
    if (version !== sortVersion || file !== cache.selected) return;
    // Initialize viewport/uniform state while the parent still keeps us hidden.
    renderer.render(scene, camera);
    await spark.update({scene, camera});
    while (spark.sorting || spark.sortDirty) {
      if (!spark.sorting && spark.sortDirty) await spark.update({scene, camera});
      await pause();
    }
    if (version !== sortVersion || file !== cache.selected || !cache.ready) return;
    sortAppliedVersion = version; sujo = true;
  } catch (error) {
    falha = String(error); apresentado = null;
  } finally {
    spark.autoUpdate = previousAutoUpdate;
    sortRunning = false; sujo = true;
  }
}
// END ESPERA_ORDENACAO
'''


def once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("Unexpected iframe source; refusing a partial patch: " + old[:100])
    return source.replace(old, new, 1)


def patch(source):
    source = once(source, 'let sujo = true, ativo = true, cameraRecebida = false, apresentado = null, falha = null;',
                  'let sujo = true, ativo = true, cameraRecebida = false, apresentado = null, falha = null;\n' + BLOCK)
    source = once(source, 'scene.add(new SparkRenderer(ajustes));',
                  'const spark = new SparkRenderer(ajustes);\nscene.add(spark);')
    source = once(source, '  apresentado = null;\n  cache.select(arquivo);',
                  '  apresentado = null;\n  cache.select(arquivo);\n  requestSortedPresentation();')
    source = once(source, 'get: () => !api.error && cache.ready && apresentado === cache.selected',
                  'get: () => !api.error && cache.ready && apresentado === cache.selected && !sortPending()')
    source = once(source, 'presented: apresentado, active: ativo, cameraReceived: cameraRecebida, frames: api.quadros,',
                  'presented: apresentado, active: ativo, cameraReceived: cameraRecebida, frames: api.quadros,\n  sortPending: sortPending(), sortVersion, sortAppliedVersion, sorting: spark.sorting,')
    source = once(source, 'api.setCamera = (posicao, quaternion, fov, aspecto) => {\n  cameraRecebida = true;',
                  'api.setCamera = (posicao, quaternion, fov, aspecto) => {\n'
                  '  const jump = !cameraRecebida || camera.position.distanceTo(new THREE.Vector3().fromArray(posicao)) > 0.35 ||\n'
                  '    Math.abs(camera.quaternion.dot(new THREE.Quaternion().fromArray(quaternion).normalize())) < Math.cos(Math.PI / 12);\n'
                  '  cameraRecebida = true;')
    source = once(source, '  camera.position.fromArray(posicao); camera.quaternion.fromArray(quaternion);',
                  '  camera.position.fromArray(posicao); camera.quaternion.fromArray(quaternion);\n  if (jump) requestSortedPresentation();')
    source = once(source, '  if (!ativo || !cameraRecebida || !sujo || api.error) return;',
                  '  if (!ativo || !cameraRecebida || api.error) return;\n'
                  '  if (sortPending()) {\n'
                  '    if (cache.ready && !sortRunning) void sortCurrentPresentation();\n'
                  '    return;\n'
                  '  }\n'
                  '  if (!sujo) return;')
    return source


def main():
    if os.name != "posix":
        raise SystemExit("Server only; never execute on the PC")
    root = Path("/root/liv-corrigido-20261016").resolve(strict=True)
    target = root / "tour-regional" / "splat" / "visita.html"
    if not target.resolve(strict=True).is_relative_to(root / "tour-regional"):
        raise ValueError("Refusing another application path")
    old_bytes = target.read_bytes()
    original = old_bytes.decode("utf-8-sig").replace("\r\n", "\n")
    if BEGIN in original:
        print(json.dumps({"ok": True, "already_patched": True, "sha256": hashlib.sha256(old_bytes).hexdigest()}))
        return
    patched = patch(original).encode("utf-8")
    backup = target.with_name("visita.html.antes-espera-ordenacao")
    if backup.exists():
        raise RuntimeError("Original backup already exists; inspect it before attempting another patch")
    with backup.open("xb") as stream:
        stream.write(old_bytes)
    with tempfile.NamedTemporaryFile(dir=target.parent, prefix="visita-espera-", suffix=".tmp", delete=False) as stream:
        tmp = Path(stream.name)
        stream.write(patched)
        stream.flush()
        os.fsync(stream.fileno())
    try:
        os.replace(tmp, target)
    finally:
        tmp.unlink(missing_ok=True)
    report = {"schema": "liv-iframe-sorted-presentation-v1", "created_utc": datetime.now(timezone.utc).isoformat(),
              "target": str(target), "backup": str(backup), "before_sha256": hashlib.sha256(old_bytes).hexdigest(),
              "after_sha256": hashlib.sha256(patched).hexdigest(), "sort_metric": "unchanged",
              "invalidation": "model change or first camera or >0.35m jump or >30degree rotation",
              "ready_gate": "cache ready, current request sorted, then a matching frame rendered", "server_browser_validation": "pending"}
    proof = target.parent / "espera-ordenacao.json"
    with proof.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    print(json.dumps({"ok": True, **report}, ensure_ascii=False))


if __name__ == "__main__":
    main()
