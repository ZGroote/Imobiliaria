"""SERVER ONLY: identical heldout cameras, GT / NS raw / browser Spark SOG."""
import argparse
import asyncio
import base64
import hashlib
import importlib.util
import io
import json
import math
import os
import subprocess
import tempfile
import time
from pathlib import Path

DEFAULT_IDS = ('f0226', 'f1832')
CRITICAL = {'Banho', 'Banho suíte', 'Varanda / serviço'}


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_data(root, ids):
    metadata = json.loads((root / 'dataset-denso/transforms.json').read_text(encoding='utf-8-sig'))
    frames = {Path(frame['file_path']).name: frame for frame in metadata['frames']}
    reports = {}
    for key, directory in (('old', 'resultado-refino60k'), ('new', 'resultado-denso16-corrigido')):
        report = json.loads((root / directory / 'analise-ambientes/metricas-por-ambiente.json').read_text(encoding='utf-8'))
        reports[key] = {Path(view['file']).name: view for view in report['views']}
    records = []
    for frame_id in ids:
        name = frame_id + '.png'
        frame = frames[name]
        old, new = reports['old'][name], reports['new'][name]
        assert (old['comodo'], old['pitch']) == (new['comodo'], new['pitch'])
        model = 'new' if new['comodo'] in CRITICAL else 'old'
        records.append({'id': frame_id, 'frame': frame, 'view': reports[model][name], 'model': model})
    return metadata, [dict(record, repeat=repeat) for record in records for repeat in (1, 2)]


async def run(args, output, report):
    import websockets
    import numpy as np
    from PIL import Image, ImageDraw
    viewer = load_module('liv_compact_validation', 'validar-compacto-firefox.py')
    bidi_module = load_module('liv_bidi', 'validar-tour-firefox.py')
    metadata, records = read_data(args.root, args.ids)
    deadline = time.monotonic() + 30
    while True:
        try:
            ws = await websockets.connect(f'ws://127.0.0.1:{args.port}/session', max_size=100 * 1024 * 1024)
            break
        except (OSError, TimeoutError):
            if time.monotonic() >= deadline:
                raise TimeoutError('Firefox BiDi endpoint unavailable')
            await asyncio.sleep(.5)
    bidi = bidi_module.Bidi(ws, output / 'bidi-events.jsonl')
    def save():
        temporary = output / 'resultado.partial.json'
        temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        temporary.replace(output / 'resultado.json')
    async def state():
        value = await bidi.evaluate(context, viewer.STATE)
        return json.loads(value) if value else None
    async def ready(expected=None, after=-1):
        limit = time.monotonic() + 120
        while time.monotonic() < limit:
            value = await state()
            report['last_state'] = value
            if value:
                if value.get('error') or any(model.get('error') for model in value['models']):
                    raise RuntimeError(value)
                models = value['models']
                loaded = len(models) == 2 and all(model.get('loaded') and (model.get('gaussians') or 0) > 0 for model in models)
                correct = expected is None or value['selected'] == expected == value['requested']
                visible = [model['key'] for model in models if model.get('visible')]
                if loaded and value['ready'] and correct and visible == [value['selected']] and value['frames'] >= after + 3 and value['selectionFrames'] >= 3:
                    return value
            await asyncio.sleep(.25)
        raise TimeoutError(f'Viewer not ready for expected model {expected}: {report.get("last_state")}')
    def metrics(a, b):
        delta = a.astype(np.float64) - b.astype(np.float64)
        mse = float(np.mean(delta * delta))
        return {'psnr_db': 10 * math.log10(255 ** 2 / mse) if mse else None,
                'psnr_is_infinite': mse == 0, 'mae_uint8': float(np.abs(delta).mean()),
                'max_abs_error_uint8': int(np.abs(delta).max()), 'mse_uint8': mse}
    try:
        report['session'] = await bidi.command('session.new', {'capabilities': {}})
        await bidi.command('session.subscribe', {'events': ['log.entryAdded', 'network.responseCompleted', 'network.fetchError']})
        context = (await bidi.command('browsingContext.create', {'type': 'tab'}))['context']
        await bidi.command('browsingContext.setViewport', {'context': context, 'viewport': {'width': 1280, 'height': 720}, 'devicePixelRatio': 1})
        await bidi.command('browsingContext.navigate', {'context': context, 'url': args.url, 'wait': 'complete'}, timeout=90)
        await ready()
        report['views'] = []
        save()
        for record in records:
            view, frame = record['view'], record['frame']
            eval_file = args.root / view['eval_file']
            with Image.open(eval_file) as image:
                pair = np.asarray(image.convert('RGB'))
            height, full_width, channels = pair.shape
            assert full_width % 2 == 0 and channels == 3
            width = full_width // 2
            assert (width, height) == (1280, 720), (record['id'], width, height)
            gt, raw = pair[:, :width].copy(), pair[:, width:].copy()
            with Image.open(args.root / 'dataset-denso' / frame['file_path']) as source:
                source_gt = np.asarray(source.convert('RGB'))
            assert source_gt.shape == gt.shape
            gt_error = int(np.abs(source_gt.astype(np.int16) - gt.astype(np.int16)).max())
            assert gt_error <= 1, (record['id'], gt_error)
            def field(name, fallback=None):
                value = frame.get(name, metadata.get(name, fallback))
                if value is None:
                    raise ValueError(f'Missing intrinsic {name}')
                return float(value)
            fx, fy = field('fl_x'), field('fl_y')
            cx, cy = field('cx', width / 2), field('cy', height / 2)
            assert int(field('w', width)) == width and int(field('h', height)) == height
            assert fx > 0 and fy > 0 and all(math.isfinite(value) for value in (fx, fy, cx, cy))
            fov = math.degrees(2 * math.atan(height / (2 * fy)))
            matrix = frame['transform_matrix']
            assert len(matrix) == 4 and all(len(row) == 4 and all(math.isfinite(value) for value in row) for row in matrix)
            before = await state()
            command = """(async()=>{const T=await import('/splat/lib/three/build/three.module.js');
const a=window.__splat,c=a.camera,m=new T.Matrix4().set(...MATRIX.flat());
m.premultiply(new T.Matrix4().makeRotationX(-Math.PI/2)).decompose(c.position,c.quaternion,new T.Vector3());
c.up.set(0,1,0);c.fov=FOV;c.aspect=WIDTH/HEIGHT;c.updateProjectionMatrix();
// Match the original K also for an off-center principal point or unequal fx/fy.
c.projectionMatrix.elements[0]=2*FX/WIDTH;c.projectionMatrix.elements[5]=2*FY/HEIGHT;
c.projectionMatrix.elements[8]=1-2*CX/WIDTH;c.projectionMatrix.elements[9]=2*CY/HEIGHT-1;
c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
a.renderer.setPixelRatio(1);a.renderer.setSize(WIDTH,HEIGHT,false);
return JSON.stringify({position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect,near:c.near,far:c.far,projection:c.projectionMatrix.toArray(),canvas:[a.renderer.domElement.width,a.renderer.domElement.height]});})()"""
            for key, value in {'MATRIX': matrix, 'FOV': fov, 'WIDTH': width, 'HEIGHT': height, 'FX': fx, 'FY': fy, 'CX': cx, 'CY': cy}.items():
                command = command.replace(key, json.dumps(value))
            applied_camera = json.loads(await bidi.evaluate(context, command))
            value = await ready(record['model'], before['frames'])
            await asyncio.sleep(.5)
            value = await ready(record['model'], before['frames'])
            # Deliberately allow asynchronous sort/GPU state to settle at this exact pose.
            await asyncio.sleep(15)
            value = await ready(record['model'], before['frames'])
            assert max(abs(a - b) for a, b in zip(value['camera'], applied_camera['position'])) < 1e-5, value
            assert abs(sum(a * b for a, b in zip(value['quaternion'], applied_camera['quaternion']))) > .999999, value
            data_url = await bidi.evaluate(context, 'window.__splat.capture()')
            assert data_url.startswith('data:image/png;base64,')
            png = output / (record['id'] + '-r' + str(record['repeat']) + '-sog.png')
            png.write_bytes(base64.b64decode(data_url.split(',', 1)[1]))
            with Image.open(png) as image:
                sog = np.asarray(image.convert('RGB'))
            assert sog.shape == gt.shape, (record['id'], sog.shape, gt.shape)
            comparisons = {'ns_vs_gt': metrics(raw, gt), 'sog_vs_gt': metrics(sog, gt), 'sog_vs_ns': metrics(sog, raw)}
            sheet = Image.new('RGB', (width * 3, height + 65), (240, 240, 240))
            draw = ImageDraw.Draw(sheet)
            for column, (pixels, label) in enumerate(((gt, 'GT'), (raw, 'NS raw'), (sog, 'Spark SOG'))):
                draw.text((column * width + 10, 7), f"{record['id']} | {view['comodo']} | pitch {view['pitch']} | {label}", fill=(0, 0, 0))
                if column:
                    psnr = comparisons['ns_vs_gt' if column == 1 else 'sog_vs_gt']['psnr_db']
                    draw.text((column * width + 10, 28), f'PSNR vs GT: {psnr}', fill=(0, 0, 0))
                sheet.paste(Image.fromarray(pixels), (column * width, 65))
            jpeg = output / (record['id'] + '-r' + str(record['repeat']) + '-gt-ns-sog.jpg')
            sheet.save(jpeg, quality=95)
            entry = {'id': record['id'], 'repeat': record['repeat'], 'settle_seconds': 15, 'room': view['comodo'], 'pitch': view['pitch'],
                     'expected_model': record['model'], 'ns_eval_file': str(eval_file), 'gt_max_error': gt_error,
                     'intrinsics': {'fx': fx, 'fy': fy, 'cx': cx, 'cy': cy, 'width': width, 'height': height},
                     'original_transform_matrix': matrix, 'applied_camera': applied_camera,
                     'browser_state': value, 'comparisons': comparisons,
                     'files': [{'file': path.name, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in (jpeg, png)]}
            report['views'].append(entry)
            save()
            print(json.dumps({'id': record['id'], 'repeat': record['repeat'], 'settle_seconds': 15, 'model': value['selected'], 'comparisons': comparisons}), flush=True)
        report['complete'] = len(report['views']) == len(records)
        report['console_errors'] = [event for event in bidi.events if event.get('method') == 'log.entryAdded' and event.get('params', {}).get('level') == 'error']
        save()
    finally:
        await bidi.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/root/liv-corrigido-20261016'))
    parser.add_argument('--url', default='http://127.0.0.1:8765/visita-compacta.html?dpr=1')
    parser.add_argument('--ids', nargs='+', default=list(DEFAULT_IDS))
    parser.add_argument('--port', type=int, default=8771)
    parser.add_argument('--firefox', default='/usr/bin/firefox')
    parser.add_argument('--headless', action='store_true', help='Default inherits DISPLAY and uses headed Firefox')
    parser.add_argument('--max-seconds', type=int, default=600)
    args = parser.parse_args()
    if os.name != 'posix':
        raise SystemExit('Server-only helper; never execute on the PC')
    args.ids = ['f' + str(int(value.removesuffix('.png').removeprefix('f'))).zfill(4) for value in args.ids]
    output = args.root / 'comparacao-sog-raw-lento'
    output.mkdir(exist_ok=True)
    report = {'url': args.url, 'ids': args.ids, 'settle_seconds': 15, 'repeats_per_pose': 2, 'complete': False, 'DISPLAY': os.environ.get('DISPLAY'),
              'comparison': 'Full original models: identical source c2w and pinhole K at native resolution; no spatial Gaussian cuts',
              'limitations': 'Different renderers and SOG quantization; PSNR differences do not alone isolate conversion from rendering.',
              'visual_approval': 'pending'}
    with tempfile.TemporaryDirectory(prefix='sog-raw-lento-firefox-', dir=output) as profile:
        Path(profile, 'user.js').write_text('user_pref("gfx.webrender.software",true);\nuser_pref("webgl.force-enabled",true);\n')
        with (output / 'firefox.log').open('wb') as log:
            command = [args.firefox] + (['--headless'] if args.headless else []) + ['--no-remote', '--profile', profile,
                '--remote-debugging-port', str(args.port), 'about:blank']
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
            try:
                async def limited():
                    await asyncio.wait_for(run(args, output, report), timeout=args.max_seconds)
                asyncio.run(limited())
            except Exception as error:
                report['failure'] = repr(error)
                (output / 'resultado.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=8)
                    except subprocess.TimeoutExpired:
                        process.kill(); process.wait()
    print(json.dumps({'report': str(output / 'resultado.json'), 'complete': report['complete']}))


if __name__ == '__main__':
    main()
