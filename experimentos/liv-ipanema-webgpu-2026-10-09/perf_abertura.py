"""Perfila compilação e primeira renderização sem alterar fontes ou executar animação extra.

Execute isoladamente dos outros QAs. A instrumentação tem custo e serve para
localizar o gargalo; medir_runtime.py continua sendo o ensaio comparável de abertura.
"""
import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
DEFAULT_URL = (
    "http://127.0.0.1:8790/experimentos/"
    "liv-ipanema-webgpu-2026-10-09/maquete-liv-ipanema.html"
)

# Runs independently in every document. The renderer becomes public before its
# first fetch, giving the observer time to attach without intercepting page code.
INSTRUMENT = r"""(() => {
  const p = window.__livOpeningProfile = {
    events: [], longTasks: [], errors: [], patched: {}, dropped: 0,
    initializedAt: performance.now(), stopped: false, rendererAttachedAt: null
  };
  const limit = 12000;
  let sequence = 0, renderDepth = 0, compileDepth = 0, animationDepth = 0;
  const renderStack = [];
  const now = () => performance.now();
  const context = () => ({
    renderDepth, compileActive: compileDepth > 0,
    phase: animationDepth ? 'animation' : compileDepth ? 'compile' : 'external',
    renderScene: renderStack.at(-1)?.scene ?? null,
    renderMaterial: renderStack.at(-1)?.material ?? null
  });
  const record = value => {
    if (p.stopped) return;
    if (p.events.length >= limit) {p.dropped++; return;}
    p.events.push({id: ++sequence, ...value});
  };
  const span = (kind, started, extra, error = null) => record({
    kind, start: started, end: now(), ...extra,
    ...(error ? {error: String(error)} : {})
  });
  function patchMethod(target, name, factory, label) {
    if (!target || typeof target[name] !== 'function') {
      p.patched[label] = 'unavailable'; return;
    }
    try {
      target[name] = factory(target[name]);
      p.patched[label] = 'attached';
    } catch (error) {p.patched[label] = String(error);}
  }
  try {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!p.stopped) p.longTasks.push({
          start: entry.startTime, duration: entry.duration, name: entry.name,
          attribution: (entry.attribution || []).map(a => ({
            name: a.name, containerType: a.containerType, containerName: a.containerName
          }))
        });
      }
    });
    observer.observe({type: 'longtask', buffered: true});
    p.longTaskObserver = 'attached';
  } catch (error) {p.longTaskObserver = String(error);}

  // Record synchronous driver calls and async pipeline completion separately.
  // Original return values, including Promise identities, are retained.
  for (const [name, kind] of [
    ['createRenderPipeline', 'gpu-pipeline-sync'],
    ['createRenderPipelineAsync', 'gpu-pipeline-async'],
    ['createShaderModule', 'gpu-shader-module']
  ]) {
    patchMethod(window.GPUDevice?.prototype, name, original => function(...args) {
      const start = now(), info = {...context(), label: args[0]?.label || null};
      if (kind === 'gpu-shader-module') info.codeLength = args[0]?.code?.length || 0;
      let result;
      try {result = original.apply(this, args);}
      catch (error) {span(kind, start, info, error); throw error;}
      if (kind === 'gpu-pipeline-async') {
        const returnedAt = now();
        result.then(
          () => span(kind, start, {...info, returnedAt}),
          error => span(kind, start, {...info, returnedAt}, error)
        );
      } else span(kind, start, info);
      return result;
    }, 'GPUDevice.' + name);
  }
  patchMethod(window.GPUQueue?.prototype, 'writeTexture', original => function(...args) {
    const start = now(), data = args[1], size = args[3];
    const info = {...context(), bytes: data?.byteLength ?? null,
      size: Array.isArray(size) ? [...size] : size ? {
        width: size.width, height: size.height, depthOrArrayLayers: size.depthOrArrayLayers
      } : null};
    try {return original.apply(this, args);}
    catch (error) {info.error = String(error); throw error;}
    finally {span('gpu-texture-upload', start, info);}
  }, 'GPUQueue.writeTexture');

  const originalRAF = window.requestAnimationFrame;
  let rafId = 0, activeRAF = null;
  patchMethod(window, 'requestAnimationFrame', original => function(callback) {
    if (typeof callback !== 'function') return original.call(this, callback);
    const requestedAt = now(), id = ++rafId, parentRAF = activeRAF;
    // Call sites are captured only after compilation to identify renderer.js's
    // two ready-fence callbacks without stacking overhead during compilation.
    const compiled = window.__livProva?.timings?.compiled;
    const callsite = compiled === undefined ? null : String(new Error().stack)
      .split('\n').filter(line => line.includes('renderer.js')).slice(0, 2).join('\n') || null;
    return original.call(this, function(timestamp) {
      const previous = activeRAF, start = now(); activeRAF = id;
      try {return callback.call(this, timestamp);}
      catch (error) {p.errors.push(String(error)); throw error;}
      finally {
        activeRAF = previous;
        span('raf-callback', start, {rafId: id, parentRAF, requestedAt, timestamp, callsite});
      }
    });
  }, 'window.requestAnimationFrame');

  const poll = setInterval(() => {
    const state = window.__livProva, renderer = state?.renderer;
    // The integrated parent creates the iframe, but never owns a proof renderer.
    if (!state && window.__livViewer) {clearInterval(poll); return;}
    if (!renderer) return;
    clearInterval(poll);
    p.rendererAttachedAt = now();
    p.timingsAtAttachment = {...state.timings};
    patchMethod(renderer, 'compileAsync', original => function(...args) {
      const start = now(); compileDepth++;
      record({kind: 'compile-start', start, ...context()});
      let result;
      try {result = original.apply(this, args);}
      catch (error) {compileDepth--; span('compile-end', start, {}, error); throw error;}
      result.then(
        () => {compileDepth--; span('compile-end', start, {});},
        error => {compileDepth--; span('compile-end', start, {}, error);}
      );
      return result;
    }, 'renderer.compileAsync');
    patchMethod(renderer, 'render', original => function(scene, camera, ...rest) {
      const start = now(), info = {...context(), scene: scene?.name || scene?.type || null,
        material: scene?.overrideMaterial?.name || scene?.material?.name || null,
        camera: camera?.name || camera?.type || null};
      renderDepth++; renderStack.push(info);
      try {return original.call(this, scene, camera, ...rest);}
      catch (error) {info.error = String(error); throw error;}
      finally {renderStack.pop(); renderDepth--; span('render', start, info);}
    }, 'renderer.render');
    patchMethod(renderer, '_renderOutput', original => function(...args) {
      const start = now(), info = context();
      try {return original.apply(this, args);}
      catch (error) {info.error = String(error); throw error;}
      finally {span('output-pass', start, info);}
    }, 'renderer._renderOutput');
    patchMethod(renderer, 'setAnimationLoop', original => function(callback) {
      const observed = typeof callback !== 'function' ? callback : function(...args) {
        animationDepth++;
        try {return callback.apply(this, args);}
        finally {animationDepth--;}
      };
      return original.call(this, observed);
    }, 'renderer.setAnimationLoop');
  }, 1);
  // A document with no LIV renderer should not poll for its whole lifetime.
  setTimeout(() => clearInterval(poll), 120000);
  p.snapshot = () => {
    p.stopped = true;
    const state = window.__livProva;
    return {...p, snapshot: undefined, url: location.href, timeOrigin: performance.timeOrigin,
      timings: {...state?.timings}, backend: state?.backend, runtime: state?.runtime,
      adapterInfo: state?.adapterInfo, stateError: state?.error,
      canvas: state?.renderer ? [state.renderer.domElement.width, state.renderer.domElement.height] : null,
      animationInterleaved: p.events.filter(e => e.kind === 'render' && e.renderDepth === 0 &&
        e.phase === 'animation' && e.compileActive).length,
      originalRAFStillWrapped: window.requestAnimationFrame !== originalRAF};
  };
})();"""


def with_backend(url, backend):
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query['backend'] = backend
    return urlunsplit(parts._replace(query=urlencode(query)))


def summarize(profile):
    timings = profile['timings']
    compiled = timings.get('compiled')
    ready = timings.get('ready')
    events = profile['events']
    summary = {'instrumentationBeforeBuild': (
        profile['rendererAttachedAt'] is not None
        and profile['rendererAttachedAt'] < timings.get('sceneBuilt', float('inf'))
    ), 'dropped': profile['dropped'], 'animationRendersDuringCompile': profile['animationInterleaved']}
    if compiled is None or ready is None:
        summary['incomplete'] = True
        return summary
    explicit = sorted((e for e in events if e['kind'] == 'render'
                       and e['renderDepth'] == 0 and e['phase'] == 'external'
                       and e['start'] >= compiled), key=lambda e: e['start'])
    first = explicit[0] if explicit else None
    summary['compiledToReadyMs'] = ready - compiled
    summary['firstExplicitRenderAfterCompile'] = first
    if first:
        summary['compiledToRenderCallMs'] = first['start'] - compiled
        summary['renderCpuMs'] = first['end'] - first['start']
        summary['renderReturnedToReadyMs'] = ready - first['end']
        summary['readyFenceRAFs'] = sorted((e for e in events if e['kind'] == 'raf-callback'
            and e.get('callsite') and first['end'] <= e['start'] <= ready), key=lambda e: e['start'])
    summary['longTasksAfterCompile'] = [e for e in profile['longTasks']
        if e['start'] < ready and e['start'] + e['duration'] > compiled]
    critical = [e for e in events if e['start'] < ready and e.get('end', e['start']) >= compiled
                and e['kind'] in ['gpu-pipeline-sync', 'gpu-pipeline-async',
                                  'gpu-shader-module', 'gpu-texture-upload', 'output-pass']]
    summary['driverAndOutputAfterCompile'] = critical
    summary['longestCPUSpansBeforeReady'] = sorted((e for e in events
        if e.get('end') is not None and e['start'] < ready and e['kind'] not in ['compile-end', 'gpu-pipeline-async']),
        key=lambda e: e['end'] - e['start'], reverse=True)[:20]
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=DEFAULT_URL)
    parser.add_argument('--backends', choices=['webgl', 'webgpu'], nargs='+', default=['webgl', 'webgpu'])
    parser.add_argument('--rodadas', type=int, default=3)
    parser.add_argument('--warm', action='store_true', help='Inclui reload na mesma aba em cada rodada.')
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias'/'perfil-abertura')
    parser.add_argument('--chrome', default=r'C:\Program Files\Google\Chrome\Application\chrome.exe')
    args = parser.parse_args()
    if args.rodadas < 1:
        parser.error('--rodadas precisa ser positivo')
    args.saida.mkdir(parents=True, exist_ok=True)
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
        'purpose': 'Diagnóstico da compilação, render retornado e espera até ready; sem medida de FPS/tempo GPU.',
        'limits': 'Instrumentação adiciona custo. Executar sequencialmente sem QAs concorrentes; confirmar otimizações com medir_runtime.py sem este observer.',
        'platform': platform.platform(), 'headless': True, 'physicalMobile': False,
        'viewport': [1440, 900], 'url': args.url,
        'sourceSHA256': {name: hashlib.sha256((EXP/name).read_bytes()).hexdigest()
            for name in ['renderer.js', 'material-rgbm.js', 'viewer.js', 'maquete-liv-ipanema.html', 'perf_abertura.py']},
        'rounds': []}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=args.chrome, headless=True)
            report['browserVersion'] = browser.version
            for backend in args.backends:
                for number in range(args.rodadas):
                    context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                    context.add_init_script(INSTRUMENT)
                    page = context.new_page()
                    errors = []
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    row = {'backend': backend, 'round': number + 1, 'phases': {}}
                    report['rounds'].append(row)
                    for phase in (['cold', 'warm'] if args.warm else ['cold']):
                        if phase == 'cold':
                            page.goto(with_backend(args.url, backend), wait_until='load', timeout=120000)
                        else:
                            page.reload(wait_until='load', timeout=120000)
                        page.wait_for_function(
                            'window.__livViewer?.ready || window.__livProva?.ready', timeout=120000)
                        parent_ready = page.evaluate('performance.now()')
                        # Let buffered longtask records arrive without extending the recorded ready time.
                        page.wait_for_timeout(100)
                        proof_frames = [f for f in page.frames
                            if f.evaluate('Boolean(window.__livProva?.renderer)')]
                        if len(proof_frames) != 1:
                            raise AssertionError(f'Esperava uma cena exterior, encontrei {len(proof_frames)}')
                        profile = proof_frames[0].evaluate('window.__livOpeningProfile.snapshot()')
                        summary = summarize(profile)
                        row['phases'][phase] = {'parentReadyMs': parent_ready,
                            'profile': profile, 'summary': summary}
                        if profile['backend'] != backend:
                            raise AssertionError(f'Backend exigido {backend}, observado {profile["backend"]}')
                        if not summary['instrumentationBeforeBuild'] or profile['dropped']:
                            raise AssertionError('Instrumentação tardia ou eventos excederam o limite; diagnóstico inválido.')
                    if errors:
                        raise AssertionError(errors)
                    context.close()
            browser.close()
        report['status'] = 'PASS'
    except Exception as error:
        report['status'] = 'FAIL'
        report['failure'] = str(error)
        raise
    finally:
        output = args.saida/'perfil.json'
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'status': report['status'], 'rounds': len(report['rounds']),
                          'output': str(output)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
