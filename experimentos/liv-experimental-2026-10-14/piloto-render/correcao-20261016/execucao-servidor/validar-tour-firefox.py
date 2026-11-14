"""SERVER ONLY: exercise the real tour through Firefox WebDriver BiDi.

Requires the server's existing websockets package; no Selenium or geckodriver.
Does not edit the app or its assets. All images and evidence stay on the server.
"""
import argparse
import asyncio
import base64
import hashlib
import json
import math
import subprocess
import tempfile
import time
import urllib.parse
from pathlib import Path


STATE = """JSON.stringify((()=>{const s=window.__livInterior;return {ready:!!s?.ready,error:s?.error||null,interior:s?.ready?s.getState():null,splat:s?.splat?.getState()||null}})())"""


class Bidi:
    def __init__(self, websocket, event_path):
        self.ws = websocket
        self.sequence = 0
        self.pending = {}
        self.events = []
        self.event_file = event_path.open('w', encoding='utf-8')
        self.reader_task = asyncio.create_task(self.reader())

    async def reader(self):
        try:
            async for raw in self.ws:
                message = json.loads(raw)
                if 'id' in message:
                    future = self.pending.get(message['id'])
                    if future is not None and not future.done():
                        future.set_result(message)
                else:
                    self.events.append(message)
                    self.event_file.write(json.dumps(message, ensure_ascii=False) + '\n')
                    self.event_file.flush()
        finally:
            for future in self.pending.values():
                if not future.done():
                    future.set_exception(RuntimeError('Firefox BiDi connection closed'))

    async def command(self, method, params, timeout=60):
        self.sequence += 1
        command_id = self.sequence
        future = asyncio.get_running_loop().create_future()
        self.pending[command_id] = future
        await self.ws.send(json.dumps({'id': command_id, 'method': method, 'params': params}))
        try:
            response = await asyncio.wait_for(future, timeout)
        finally:
            self.pending.pop(command_id, None)
        if response.get('type') == 'error':
            raise RuntimeError(f'{method}: {response}')
        return response['result']

    async def evaluate(self, context, expression):
        response = await self.command('script.evaluate', {
            'target': {'context': context}, 'expression': expression,
            'awaitPromise': True, 'resultOwnership': 'none'})
        if response.get('type') == 'exception':
            raise RuntimeError(response)
        return response.get('result', {}).get('value')

    async def close(self):
        await self.ws.close()
        await self.reader_task
        self.event_file.close()


async def run(args, output, result):
    import websockets
    websocket = None
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        try:
            websocket = await websockets.connect(f'ws://127.0.0.1:{args.port}/session', max_size=100 * 1024 * 1024)
            break
        except (OSError, TimeoutError):
            await asyncio.sleep(.5)
    if websocket is None:
        raise RuntimeError('Firefox did not expose the BiDi endpoint; inspect firefox.log')
    bidi = Bidi(websocket, output / 'bidi-events.jsonl')
    def save():
        (output / 'resultado.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        result['session'] = await bidi.command('session.new', {'capabilities': {}})
        await bidi.command('session.subscribe', {'events': ['log.entryAdded', 'network.responseCompleted', 'network.fetchError']})
        context = (await bidi.command('browsingContext.create', {'type': 'tab'}))['context']
        await bidi.command('browsingContext.setViewport', {'context': context, 'viewport': {'width': 1280, 'height': 720}, 'devicePixelRatio': 1})
        await bidi.command('browsingContext.navigate', {'context': context, 'url': args.url, 'wait': 'complete'}, timeout=90)

        async def ready(timeout=120):
            limit = time.monotonic() + timeout
            while time.monotonic() < limit:
                state = json.loads(await bidi.evaluate(context, STATE))
                splat = state.get('splat') or {}
                viewer = splat.get('viewer') or {}
                if state.get('error') or splat.get('error') or viewer.get('error'):
                    raise RuntimeError(f'Tour error: {state}')
                if state['ready'] and splat.get('ligado') and viewer.get('ready') and viewer.get('cameraReceived') and (viewer.get('gaussians') or 0) > 0 and viewer.get('presented') == viewer.get('selected'):
                    return state
                result['last_state'] = state
                await asyncio.sleep(.5)
            raise TimeoutError(f'Tour never reached an actual ready/presented splat: {result.get("last_state")}')

        result['initial'] = await ready()
        routes = json.loads(await bidi.evaluate(context, 'JSON.stringify(window.__livInterior.getRoomRoutes())'))
        result['routes'] = routes
        rooms = [route for route in routes if route.get('reachable')]
        assert len(rooms) == 6, f'Expected six reachable rooms: {routes}'
        result['views'] = []
        result['passages'] = []
        save()

        async def capture(label, pitch, position=None):
            set_pose = """(()=>{const s=window.__livInterior,v=s.getState();v.furniture=[];delete v.presentation;v.camera.pitch=PITCH;POSITION;return s.restoreState(v)})()"""
            expression = set_pose.replace('PITCH', repr(pitch * math.pi / 180)).replace('POSITION;',
                ('v.camera.position=' + json.dumps(position) + ';') if position is not None else '')
            assert await bidi.evaluate(context, expression) is True, label
            # Keep the app's navigation/camera loop running; wait for a fresh iframe draw.
            before = json.loads(await bidi.evaluate(context, STATE))
            await asyncio.sleep(.75)
            state = await ready()
            assert abs(state['interior']['camera']['pitch'] - pitch * math.pi / 180) < 1e-6, state
            image = await bidi.command('browsingContext.captureScreenshot', {
                'context': context, 'format': {'type': 'image/jpeg', 'quality': .9}})
            filename = f'{label}-pitch-{pitch:+d}.jpg'
            target = output / filename
            target.write_bytes(base64.b64decode(image['data']))
            # The child capture is taken inside renderer.render, avoiding a stale
            # WebGL drawing buffer. It also proves the presented viewer is callable.
            child_png = await bidi.evaluate(context,
                'window.__livInterior.splat.quadro.contentWindow.__splatVisita.capture()')
            assert isinstance(child_png, str) and child_png.startswith('data:image/png;base64,')
            child = output / f'{label}-pitch-{pitch:+d}-splat.png'
            child.write_bytes(base64.b64decode(child_png.split(',', 1)[1]))
            item = {'label': label, 'pitch': pitch, 'state': state,
                    'frames_before_wait': ((before.get('splat') or {}).get('viewer') or {}).get('frames'),
                    'screenshot': filename, 'bytes': target.stat().st_size,
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                    'splat_capture': child.name, 'splat_bytes': child.stat().st_size,
                    'splat_sha256': hashlib.sha256(child.read_bytes()).hexdigest()}
            result['views'].append(item)
            save()
            print(json.dumps({'captured': filename, 'selected': state['splat']['viewer']['selected']}), flush=True)

        for number, room in enumerate(rooms):
            assert await bidi.evaluate(context, f'window.__livInterior.goToRoom({json.dumps(room["id"])},{{instant:true}})') is True
            for pitch in (-60, 0, 60):
                await capture(f'room-{number + 1}', pitch)
        # Sample two actual navigation-path midpoints, never arbitrary wall positions.
        current_routes = json.loads(await bidi.evaluate(context, 'JSON.stringify(window.__livInterior.getRoomRoutes())'))
        passages = [route for route in current_routes if route.get('reachable') and len(route.get('path', [])) > 2][:2]
        assert len(passages) == 2, 'Need two nontrivial paths for passage diagnostics'
        for number, route in enumerate(passages):
            midpoint = route['path'][len(route['path']) // 2]
            result['passages'].append({'destination': route['id'], 'path': route['path'], 'midpoint': midpoint})
            for pitch in (-60, 60):
                await capture(f'passage-{number + 1}', pitch, [midpoint[0], 1.62, midpoint[1]])

        loaded = set()
        for view in result['views']:
            viewer = view['state']['splat']['viewer']
            loaded.update(item['file'] for item in viewer.get('files', []) if item.get('loaded') and not item.get('error'))
        result['loaded_sog_files'] = sorted(loaded)
        result['both_models_loaded'] = len(loaded) >= 2
        result['console_errors'] = [event for event in bidi.events if event.get('method') == 'log.entryAdded' and event.get('params', {}).get('level') == 'error']
        result['network_failures'] = [event for event in bidi.events if event.get('method') == 'network.fetchError' or (event.get('method') == 'network.responseCompleted' and event.get('params', {}).get('response', {}).get('status', 0) >= 400)]
        result['complete'] = len(result['views']) == 22 and result['both_models_loaded']
        result['visual_approval'] = 'pending: inspect images; browser loading alone does not establish sharpness'
        save()
    finally:
        await bidi.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8765/interior.html?tipologia=meio&modo=visita&splat-dpr=1')
    parser.add_argument('--out', type=Path, default=Path('/root/liv-corrigido-20261016/tour-browser-validacao'))
    parser.add_argument('--firefox', default='/usr/bin/firefox')
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    assert urllib.parse.urlsplit(args.url).hostname in ('127.0.0.1', 'localhost', '::1')
    args.out.mkdir(parents=True, exist_ok=True)
    result = {'url': args.url, 'server_only': True, 'complete': False}
    with tempfile.TemporaryDirectory(prefix='liv-firefox-', dir=args.out) as profile:
        with (args.out / 'firefox.log').open('wb') as logfile:
            process = subprocess.Popen([args.firefox, '--headless', '--no-remote', '--profile', profile,
                                        '--remote-debugging-port', str(args.port), 'about:blank'],
                                       stdout=logfile, stderr=subprocess.STDOUT)
            try:
                asyncio.run(run(args, args.out, result))
            except Exception as error:
                result['failure'] = repr(error)
                (args.out / 'resultado.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait()
    print(json.dumps({'report': str(args.out / 'resultado.json'), 'complete': result['complete']}))


if __name__ == '__main__':
    main()
