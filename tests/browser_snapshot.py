"""Compare local renderer artifacts with fixed camera and a drained stream queue.

Usage: python tests/browser_snapshot.py PAGE OUTPUT_PREFIX [--diagnostics]
Uses an isolated Chrome profile; does not publish or modify the source artifact.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

PROBE = r'''
<script>
(function wait(n) {
  if (!window.__int || !__int.grupos().length) {
    if (n) return setTimeout(() => wait(n - 1), 300);
    console.log('SNAPSHOT ' + JSON.stringify({error: 'renderer did not start'})); return;
  }
  try {
    const I = __int, P = __perf;
    if (REQUIRE_DIAGNOSTICS && (!window.__qa || __qa.version !== 1)) throw Error('QA API missing');
    // Each manual step is complete; suppress competing automatic frame requests.
    window.requestAnimationFrame = () => 0;
    P.setStreamRadius(450);
    I.target.set(50000, 0, 50000); P.passo(1000000); P.bombeia(100000);
    I.target.set(-525, 0, -1598); I.sph.set(230, 1.05, .6);
    for (let k = 0; k < 4; k++) { P.passo(1001000 + k * 2000); P.bombeia(100000); }
    const measured = P.mede(3, false);
    const result = {camera: I.camera.position.toArray(), target: I.target.toArray(),
      groups: I.vivos().size, queue: P.fila(), calls: measured.calls, triangles: measured.tris,
      drawMs: measured.ms, geometries: I.renderer.info.memory.geometries,
      textures: I.renderer.info.memory.textures, urban: I.urban && I.urban.stats(),
      viewport: [innerWidth, innerHeight], dpr: P.dpr(), quality: P.nivel,
      diagnostics: window.__qa ? __qa.version : null};
    if (REQUIRE_DIAGNOSTICS) {
      result.height = __qa.terrainY(-525, -1598);
      if (__qa.cena().scene !== I.scene) throw Error('QA targets a different scene');
    }
    I.renderer.render(I.scene, I.camera);
    result.image = I.renderer.domElement.toDataURL('image/png').split(',')[1];
    console.log('SNAPSHOT ' + JSON.stringify(result));
  } catch (e) { console.log('SNAPSHOT ' + JSON.stringify({error: String(e), stack: e.stack})); }
})(140);
</script>
'''


def capture(page, output, diagnostics=False):
    page, output = Path(page).resolve(), Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    chrome = os.environ.get('CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    start = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='map-snapshot-') as folder:
        tmp = Path(folder)
        html = tmp / 'probe.html'
        # Preserve the resource base when the test file is outside the map directory.
        source = page.read_text(encoding='utf-8-sig')
        source = source.replace('<head>', '<head><base href="' + page.as_uri() + '">', 1)
        html.write_text(source + PROBE.replace('REQUIRE_DIAGNOSTICS', str(diagnostics).lower()), encoding='utf-8')
        cmd = [chrome, '--headless=new', '--user-data-dir=' + str(tmp / 'profile'),
               '--window-size=960,640', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
               '--hide-scrollbars', '--screenshot=' + str(tmp / 'page.png'),
               '--virtual-time-budget=60000', '--enable-logging=stderr', '--log-level=0',
               html.as_uri() + '?q=baixo']
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            stdout, stderr = process.communicate(timeout=180)
        except subprocess.TimeoutExpired:
            # Only the Chrome tree created by this capture is terminated.
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
            process.communicate()
            raise RuntimeError('Chrome capture exceeded 180 seconds')
    log = (stdout + stderr).decode('utf-8', errors='replace')
    result = None
    for line in log.splitlines():
        if 'SNAPSHOT ' in line:
            try:
                result = json.JSONDecoder().raw_decode(line.split('SNAPSHOT ', 1)[1])[0]
            except ValueError:
                continue
    if not result or 'error' in result:
        output.with_suffix('.log').write_text(log, encoding='utf-8')
        raise RuntimeError(result or 'No browser result; see capture log')
    output.with_suffix('.png').write_bytes(base64.b64decode(result.pop('image')))
    result.update(page=str(page), elapsedSeconds=round(time.monotonic() - start, 2))
    output.with_suffix('.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('page')
    parser.add_argument('output')
    parser.add_argument('--diagnostics', action='store_true')
    args = parser.parse_args()
    print(json.dumps(capture(args.page, args.output, args.diagnostics), indent=2))
