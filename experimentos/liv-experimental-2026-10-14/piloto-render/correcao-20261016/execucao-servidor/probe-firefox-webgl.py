"""SERVER ONLY. Probe Firefox WebGL2; never render the apartment or modify app files."""
import argparse
import asyncio
import importlib.util
import json
import subprocess
import tempfile
import time
from pathlib import Path

spec = importlib.util.spec_from_file_location('liv_firefox_bidi', Path(__file__).with_name('validar-tour-firefox.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Bidi = module.Bidi

PROBE = """JSON.stringify((()=>{
const canvas=document.createElement('canvas');document.body.append(canvas);
const gl=canvas.getContext('webgl2');
if(!gl)return {webgl2:false,error:'getContext(webgl2) returned null',userAgent:navigator.userAgent};
const debug=gl.getExtension('WEBGL_debug_renderer_info');
gl.clearColor(.1,.6,.2,1);gl.clear(gl.COLOR_BUFFER_BIT);
const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
return {webgl2:true,renderer:gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),
version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,
maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxVertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
extensions:gl.getSupportedExtensions(),readPixel:Array.from(pixel),glError:gl.getError(),
contextLost:gl.isContextLost(),userAgent:navigator.userAgent};})())"""


async def probe(port, output):
    import websockets
    deadline = time.monotonic() + 25
    while True:
        try:
            ws = await websockets.connect(f'ws://127.0.0.1:{port}/session', max_size=10 * 1024 * 1024)
            break
        except (OSError, TimeoutError):
            if time.monotonic() >= deadline:
                raise TimeoutError('Firefox BiDi unavailable; inspect log')
            await asyncio.sleep(.5)
    bidi = Bidi(ws, output.with_suffix('.events.jsonl'))
    try:
        session = await bidi.command('session.new', {'capabilities': {}})
        await bidi.command('session.subscribe', {'events': ['log.entryAdded']})
        context = (await bidi.command('browsingContext.create', {'type': 'tab'}))['context']
        await bidi.command('browsingContext.navigate', {'context': context,
            'url': 'data:text/html,%3Ctitle%3ELIV-WebGL2-probe%3C/title%3E', 'wait': 'complete'})
        return {'session': session, 'probe': json.loads(await bidi.evaluate(context, PROBE)), 'events': bidi.events}
    finally:
        await bidi.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--firefox', default='/usr/bin/firefox')
    parser.add_argument('--port', type=int, default=8767)
    parser.add_argument('--out', type=Path, default=Path('/root/liv-corrigido-20261016/probe-firefox-webgl'))
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    results = []
    for forced in (False, True):
        name = 'forced-software' if forced else 'default'
        with tempfile.TemporaryDirectory(prefix='profile-', dir=args.out) as profile:
            if forced:
                Path(profile, 'user.js').write_text('user_pref("gfx.webrender.software", true);\nuser_pref("webgl.force-enabled", true);\n')
            with (args.out / f'{name}.log').open('wb') as logfile:
                process = subprocess.Popen([args.firefox, '--headless', '--no-remote', '--profile', profile,
                    '--remote-debugging-port', str(args.port), 'about:blank'], stdout=logfile, stderr=subprocess.STDOUT)
                try:
                    entry = asyncio.run(probe(args.port, args.out / name))
                except Exception as error:
                    entry = {'failure': repr(error)}
                finally:
                    if process.poll() is None:
                        process.terminate()
                        try:
                            process.wait(timeout=8)
                        except subprocess.TimeoutExpired:
                            process.kill(); process.wait()
            entry['profile'] = name
            results.append(entry)
            (args.out / 'resultado.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
            print(json.dumps(entry, ensure_ascii=False), flush=True)
        data = entry.get('probe', {})
        if data.get('webgl2') and not data.get('contextLost') and data.get('glError') == 0 and data.get('readPixel', [0, 0])[1] > 100:
            break


if __name__ == '__main__':
    main()
