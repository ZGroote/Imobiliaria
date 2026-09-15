"""Compare generated interior maps in real Chrome canvas against a fixed source checkpoint."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from padrao.pagina import roda


def main():
    source = subprocess.check_output([
        'git', '-c', 'safe.directory=' + ROOT.as_posix(), 'show',
        '0131e88:renderizador-v16-moveis/app.js'], cwd=ROOT).decode('utf-8')
    source = source[source.index('/* ---- textura sem arquivo'):source.index('const {matInt, matVidro')]
    names = 'texParede, texPiso, texMadeira, nrmParede, nrmPiso, nrmMadeira, rugParede, rugPiso, rugMadeira'
    renderer = ROOT / 'renderizador-v16-moveis'
    scripts = [
        (renderer / 'lib/three.min.js').read_text(encoding='utf-8'),
        'function before(){' + source + '\nreturn {' + names + '};}',
        (renderer / 'materials/interior-textures.js').read_text(encoding='utf-8')]
    html = '<!doctype html><meta charset="utf-8">' + ''.join('<script>' + s + '</script>' for s in scripts)
    # Control randomness only in this isolated test; production keeps its original sampling.
    js = r'''
    (() => {
      const originalRandom = Math.random;
      let seed, calls;
      const reset = () => {seed = 123456; calls = 0;};
      Math.random = () => {calls++; return (seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;};
      try {
        reset(); const a = before(), beforeCalls = calls;
        reset(); const b = InteriorTextures.create({THREE, document}), afterCalls = calls;
        if (beforeCalls !== afterCalls) throw Error('Random sampling order changed');
        const maps = {};
        for (const name of Object.keys(a)) {
          const x = a[name], y = b[name];
          const props = t => [t.image.width,t.image.height,t.wrapS,t.wrapT,t.anisotropy,
            t.colorSpace,t.repeat.x,t.repeat.y,t.minFilter,t.magFilter,t.flipY,t.generateMipmaps];
          if (JSON.stringify(props(x)) !== JSON.stringify(props(y))) throw Error(name + ' settings changed');
          const pixels = t => t.image.getContext('2d').getImageData(0,0,t.image.width,t.image.height).data;
          const p = pixels(x), q = pixels(y);
          for (let i=0;i<p.length;i++) if (p[i]!==q[i]) throw Error(name + ' pixel differs at ' + i);
          maps[name] = {width:x.image.width,height:x.image.height,bytes:p.length,identical:true};
          x.dispose(); y.dispose();
        }
        console.log('TEXTURES ' + JSON.stringify({maps,randomCalls:beforeCalls}));
      } catch(e) {console.log('TEXTURES ' + JSON.stringify({error:String(e)}));}
      finally {Math.random = originalRandom;}
    })();
    '''
    with tempfile.TemporaryDirectory() as directory:
        page = Path(directory) / 'textures.html'
        page.write_text(html, encoding='utf-8')
        result = roda(str(page), js, exporta=(), espera_ms=1000, marca='TEXTURES')
    if not result or result.get('error') or len(result.get('maps', {})) != 9:
        raise RuntimeError(result or 'Chrome texture probe did not respond')
    output = ROOT / 'tasks/modularizacao/baseline/texture-equivalence.json'
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
