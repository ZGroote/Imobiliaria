"""SERVER ONLY: compact viewer loading, camera, and full-model boundary evidence.

SparkControls provides free navigation. This test does not establish collisions,
original Tour integration, image quality, or performance on the user's computer.
"""
import argparse
import asyncio
import base64
import hashlib
import importlib.util
import json
import math
import os
import re
import subprocess
import tempfile
import time
import urllib.parse
from pathlib import Path


STATE = """JSON.stringify((()=>{const a=window.__splat;if(!a)return null;
const s=a.getState(),d=a.camera.getWorldDirection(a.camera.position.clone());
s.pitch=Math.asin(Math.max(-1,Math.min(1,d.y)))*180/Math.PI;
s.models=s.models.map(m=>({...m,gaussians:a.models.get(m.key)?.mesh?.packedSplats?.numSplats??a.models.get(m.key)?.mesh?.numSplats??null}));
return s;})())"""


def inside(poly, x, y):
    hit = False
    for a, b in zip(poly, poly[1:] + poly[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dy)
        dot = (x - a[0]) * dx + (y - a[1]) * dy
        if length and abs(dx * (y - a[1]) - dy * (x - a[0])) <= 1e-8 * length and -1e-8 <= dot <= length * length + 1e-8:
            return True
        if (a[1] > y) != (b[1] > y) and x < dx * (y - a[1]) / dy + a[0]:
            hit = not hit
    return hit


def room_at(config, point):
    return next((key for key in config['order'] if inside(config['polygons'][key], *point)), 'sala')


def boundaries(config):
    """Sample each critical polygon edge where the actual model selection changes."""
    result = []
    critical = set(config['critical'])
    for room in sorted(critical):
        poly = config['polygons'][room]
        candidates = []
        for a, b in zip(poly, poly[1:] + poly[:1]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dy)
            if length < .1:
                continue
            for fraction in (.5, .25, .75):
                center = [a[0] + fraction * dx, a[1] + fraction * dy]
                sides = [[center[0] + sign * .06 * -dy / length,
                          center[1] + sign * .06 * dx / length] for sign in (-1, 1)]
                rooms = [room_at(config, point) for point in sides]
                if room not in rooms or sum(key in critical for key in rooms) != 1:
                    continue
                new_index = rooms.index(room)
                old_index = 1 - new_index
                old_point = sides[old_index]
                # Prefer a real adjacent room over the default outside-all-polygons fallback.
                old_in_room = any(inside(config['polygons'][key], *old_point) for key in config['keys'] if key not in critical)
                candidates.append((old_in_room, length, {'critical_room': room, 'edge': [a, b],
                    'edge_fraction': fraction, 'offset_m': .06, 'old_xy': old_point,
                    'old_room': rooms[old_index], 'new_xy': sides[new_index],
                    'new_room': room, 'old_point_inside_old_room_polygon': old_in_room}))
        if not candidates:
            raise RuntimeError(f'No old/new boundary found for {room}')
        result.append(max(candidates, key=lambda item: (item[0], item[1]))[2])
    return result


async def run(args, config, output, report):
    import websockets
    spec = importlib.util.spec_from_file_location('liv_firefox_bidi', Path(__file__).with_name('validar-tour-firefox.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    deadline = time.monotonic() + 30
    while True:
        try:
            websocket = await websockets.connect(f'ws://127.0.0.1:{args.port}/session', max_size=100 * 1024 * 1024)
            break
        except (OSError, TimeoutError):
            if time.monotonic() >= deadline:
                raise TimeoutError('Firefox BiDi unavailable; inspect firefox.log')
            await asyncio.sleep(.5)
    bidi = module.Bidi(websocket, output / 'bidi-events.jsonl')
    def save():
        temp = output / 'resultado.partial.json'
        temp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        temp.replace(output / 'resultado.json')
    async def state():
        value = await bidi.evaluate(context, STATE)
        return json.loads(value) if value else None
    try:
        report['session'] = await bidi.command('session.new', {'capabilities': {}})
        await bidi.command('session.subscribe', {'events': ['log.entryAdded', 'network.responseCompleted', 'network.fetchError']})
        context = (await bidi.command('browsingContext.create', {'type': 'tab'}))['context']
        await bidi.command('browsingContext.setViewport', {'context': context, 'viewport': {'width': 1280, 'height': 720}, 'devicePixelRatio': 1})
        await bidi.command('browsingContext.navigate', {'context': context, 'url': args.url, 'wait': 'complete'}, timeout=90)

        async def wait_ready(expected=None, after_frames=-1, pitch=None, timeout=120):
            limit = time.monotonic() + timeout
            while time.monotonic() < limit:
                value = await state()
                report['last_state'] = value
                if value:
                    models = value.get('models', [])
                    errors = [item for item in models if item.get('error')]
                    if value.get('error') or errors:
                        raise RuntimeError(f'Viewer failed: {value}')
                    model = next((item for item in models if item['key'] == value.get('selected')), {})
                    all_loaded = len(models) == 2 and all(item.get('loaded') and (item.get('gaussians') or 0) > 0 for item in models)
                    visible = [item['key'] for item in models if item.get('visible')]
                    correct = expected is None or (value.get('selected') == expected == value.get('requested'))
                    angle_ok = pitch is None or abs(value['pitch'] - pitch) < .05
                    if all_loaded and value.get('ready') and correct and angle_ok and model.get('loaded') and visible == [value['selected']] and value['frames'] > after_frames + 2 and value['selectionFrames'] >= 2:
                        return value
                await asyncio.sleep(.25)
            raise TimeoutError(f'Not ready/model/pitch/frame mismatch: {report.get("last_state")}')

        report['initial'] = await wait_ready()
        report['views'] = []
        report['boundaries'] = boundaries(config)
        save()

        async def capture(label, pitch, expected, command, expected_room=None, position=None):
            previous = await state()
            await bidi.evaluate(context, command)
            value = await wait_ready(expected, previous['frames'], pitch)
            if expected_room is not None:
                assert value['room'] == expected_room, value
            if position is not None:
                assert max(abs(a - b) for a, b in zip(value['camera'], position)) < 1e-5, value
            png_url = await bidi.evaluate(context, 'window.__splat.capture()')
            assert isinstance(png_url, str) and png_url.startswith('data:image/png;base64,')
            png = output / f'{label}-pitch-{pitch:+d}-splat.png'
            png.write_bytes(base64.b64decode(png_url.split(',', 1)[1]))
            screenshot = await bidi.command('browsingContext.captureScreenshot', {'context': context,
                'format': {'type': 'image/jpeg', 'quality': .92}})
            jpeg = output / f'{label}-pitch-{pitch:+d}.jpg'
            jpeg.write_bytes(base64.b64decode(screenshot['data']))
            from PIL import Image, ImageStat
            with Image.open(png) as image:
                stats = ImageStat.Stat(image.convert('RGB'))
                image_stats = {'mean': stats.mean, 'stddev': stats.stddev, 'size': list(image.size),
                               'nearly_uniform': max(stats.stddev) < 1}
            entry = {'label': label, 'expected_model': expected, 'expected_model_url': config['models'][expected],
                     'expected_pitch': pitch, 'expected_room': expected_room,
                     'state': value, 'pixel_statistics': image_stats,
                     'files': [{'file': path.name, 'bytes': path.stat().st_size,
                                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in (jpeg, png)]}
            report['views'].append(entry)
            save()
            print(json.dumps({'captured': label, 'pitch': pitch, 'selected': value['selected'],
                              'room': value['room'], 'frames': value['frames']}), flush=True)

        for room in config['keys']:
            expected = 'new' if room in config['critical'] else 'old'
            for pitch in (-60, 0, 60):
                command = f'(()=>{{const a=window.__splat;a.goToRoom({json.dumps(room)});a.setPitch({pitch});return true}})()'
                await capture('room-' + room, pitch, expected, command, expected_room=room)
        for boundary in report['boundaries']:
            room = boundary['critical_room']
            height = config['views'][room]['transform'][2][3]
            # Use one heading across both sides, toward the critical room.
            dx = boundary['new_xy'][0] - boundary['old_xy'][0]
            dy = boundary['new_xy'][1] - boundary['old_xy'][1]
            for side, expected in (('old', 'old'), ('new', 'new')):
                point = boundary[side + '_xy']
                position = [point[0], height, -point[1]]
                for pitch in args.boundary_pitches:
                    command = ('(()=>{const a=window.__splat;'
                        f'a.camera.position.fromArray({json.dumps(position)});'
                        f'a.camera.lookAt(a.camera.position.x+({dx}),a.camera.position.y,a.camera.position.z-({dy}));'
                        f'a.setPitch({pitch});return true' + '})()')
                    await capture('boundary-' + room + '-' + side, pitch, expected, command,
                                  expected_room=boundary[side + '_room'], position=position)
        report['console_errors'] = [event for event in bidi.events if event.get('method') == 'log.entryAdded' and event.get('params', {}).get('level') == 'error']
        report['network_failures'] = [event for event in bidi.events if event.get('method') == 'network.fetchError' or (event.get('method') == 'network.responseCompleted' and event.get('params', {}).get('response', {}).get('status', 0) >= 400)]
        report['expected_views'] = 18 + 6 * len(args.boundary_pitches)
        report['all_model_camera_checks_passed'] = len(report['views']) == report['expected_views']
        report['nearly_uniform_images'] = [view['label'] + '/' + str(view['expected_pitch']) for view in report['views'] if view['pixel_statistics']['nearly_uniform']]
        report['complete'] = report['all_model_camera_checks_passed'] and not report['console_errors'] and not report['network_failures'] and not report['nearly_uniform_images']
        save()
    finally:
        await bidi.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('/root/liv-corrigido-20261016'))
    parser.add_argument('--url', default='http://127.0.0.1:8765/visita-compacta.html?dpr=1')
    parser.add_argument('--port', type=int, default=8768)
    parser.add_argument('--firefox', default='/usr/bin/firefox')
    parser.add_argument('--software', action='store_true', help='Use only if the WebGL probe required this profile')
    parser.add_argument('--headed', action='store_true', help='Omit --headless; inherit DISPLAY for an existing Xvfb server')
    parser.add_argument('--boundary-pitches', type=int, nargs='+', default=[0], choices=(-60, 0, 60))
    parser.add_argument('--max-seconds', type=int, default=600)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if os.name != 'posix':
        raise SystemExit('Server-only helper; never execute on the PC')
    assert urllib.parse.urlsplit(args.url).hostname in ('127.0.0.1', 'localhost', '::1')
    html_path = args.root / 'tour-regional/visita-compacta.html'
    html = html_path.read_text(encoding='utf-8')
    config = json.loads(re.search(r'const CFG = (.+);\r?\n', html).group(1))
    assert len(config['keys']) == 6 and len(config['critical']) == 3 and set(config['models']) == {'old', 'new'}
    assert config['models']['old'] != config['models']['new']
    assert len(set(args.boundary_pitches)) == len(args.boundary_pitches)
    output = args.out or args.root / 'compacto-browser-validacao'
    output.mkdir(parents=True, exist_ok=True)
    report = {'url': args.url, 'server_only': True, 'html_sha256': hashlib.sha256(html_path.read_bytes()).hexdigest(),
              'config': config, 'complete': False, 'software_preferences_requested': args.software,
              'headed': args.headed, 'DISPLAY': os.environ.get('DISPLAY'), 'boundary_pitches': args.boundary_pitches,
              'navigation': 'SparkControls free navigation; no collisions or original Tour controls tested',
              'boundary_note': 'Two poses 6 cm each side of each critical polygon edge; samples verify model selection, not collision-free door traversal',
              'visual_approval': 'pending; inspect all floor/ceiling and boundary captures'}
    with tempfile.TemporaryDirectory(prefix='compacto-firefox-', dir=output) as profile:
        if args.software:
            Path(profile, 'user.js').write_text('user_pref("gfx.webrender.software",true);\nuser_pref("webgl.force-enabled",true);\n')
        with (output / 'firefox.log').open('wb') as logfile:
            command = [args.firefox] + ([] if args.headed else ['--headless']) + ['--no-remote', '--profile', profile,
                '--remote-debugging-port', str(args.port), 'about:blank']
            process = subprocess.Popen(command, stdout=logfile, stderr=subprocess.STDOUT)
            try:
                async def limited_run():
                    await asyncio.wait_for(run(args, config, output, report), timeout=args.max_seconds)
                asyncio.run(limited_run())
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
                        process.kill()
                        process.wait()
    print(json.dumps({'report': str(output / 'resultado.json'), 'complete': report['complete']}))


if __name__ == '__main__':
    main()
