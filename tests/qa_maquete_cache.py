"""Testa o cliente e worker reais, inclusive host fora do escopo e URLs por hash."""
import argparse
import hashlib
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"


def run(out):
    out.mkdir(parents=True, exist_ok=True)
    report = {"status": "FAIL", "cases": []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME, headless=True)
            for runtime in ["liv-experimental-2026-10-14", "laranjeiras-2026-10-30/site"]:
                source = ROOT / "experimentos" / runtime
                payload = b"immutable foreground texture" * 2048
                digest = hashlib.sha256(payload).hexdigest()
                resource = "/assets/interiores/current.bin"
                requests = []
                parallel = {f"/assets/interiores/p{i}.bin": (f"resource-{i}:".encode() + b"x" * 65536) for i in range(10)}
                lock = threading.Lock()
                network = {"active": 0, "peak": 0, "corrupt": True}
                manifest = {"schema": "liv-transfer-manifest-v1", "version": digest,
                    "order": ["tour", "map", "planta2d"],
                    "groups": {name: {"label": name} for name in ["tour", "map", "planta2d"]},
                    "files": [{"path": "interiores/current.bin", "group": "tour", "essential": False,
                        "background": False, "bytes": len(payload), "sha256": digest}]}

                for path, body in parallel.items():
                    manifest["files"].append({"path": path.removeprefix("/assets/"), "group": "tour", "essential": False,
                        "background": False, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest()})

                class Handler(BaseHTTPRequestHandler):
                    def log_message(self, *_): pass
                    def do_GET(self):
                        path = urlsplit(self.path).path
                        counted = path in parallel
                        if counted:
                            with lock:
                                network["active"] += 1
                                network["peak"] = max(network["peak"], network["active"])
                            requests.append(self.path)
                            time.sleep(.35)
                            body = parallel[path]
                            if path.endswith("p8.bin") and network["corrupt"]: body = b"!" + body[1:]
                            kind = "application/octet-stream"
                        elif path == resource:
                            requests.append(self.path)
                            body, kind = payload, "application/octet-stream"
                        elif path.endswith("transfer-manifest.json"):
                            body, kind = json.dumps(manifest).encode(), "application/json"
                        elif path.endswith(("transfers.js", "transfer-worker.js")):
                            body, kind = (source / Path(path).name).read_bytes(), "application/javascript"
                        else:
                            body, kind = b"<!doctype html><meta charset=utf-8><title>Fixture</title>", "text/html"
                        self.send_response(200)
                        self.send_header("Content-Type", kind)
                        self.send_header("Content-Length", str(len(body)))
                        self.send_header("Cache-Control", "no-store")
                        self.end_headers()
                        try: self.wfile.write(body)
                        except (BrokenPipeError, ConnectionResetError): pass
                        finally:
                            if counted:
                                with lock: network["active"] -= 1

                server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
                threading.Thread(target=server.serve_forever, daemon=True).start()
                context = browser.new_context()
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                try:
                    origin = f"http://127.0.0.1:{server.server_port}"
                    page.goto(origin + "/outside/")
                    started = time.monotonic()
                    reply = page.evaluate("""async()=>{
                        window.events=[];navigator.serviceWorker.addEventListener('message',e=>events.push(e.data));
                        const {transfers}=await import('/assets/transfers.js');window.client=transfers;
                        return transfers.start();
                    }""")
                    elapsed = time.monotonic() - started
                    assert reply["ok"] and reply["state"]["enabled"], reply
                    assert elapsed < 5, elapsed
                    assert page.evaluate("navigator.serviceWorker.controller===null")
                    page.wait_for_timeout(250)
                    assert not requests, "Recursos sob demanda foram baixados em segundo plano."
                    page.evaluate("""async()=>{
                        const frame=document.createElement('iframe');frame.src='/assets/child.html';
                        const ready=new Promise(resolve=>frame.onload=resolve);document.body.append(frame);await ready;
                    }""")
                    frame = page.frames[1]
                    frame.wait_for_function("navigator.serviceWorker.controller!==null")
                    fetch = """async path=>{const r=await fetch(path);return {status:r.status,sha:r.headers.get('X-Liv-Sha256'),bytes:(await r.arrayBuffer()).byteLength};}"""
                    first = frame.evaluate(fetch, resource + "?v=" + digest)
                    second = frame.evaluate(fetch, resource + "?v=" + digest)
                    assert first == second and first["sha"] == digest, (first, second)
                    assert first["bytes"] == len(payload) and len(requests) == 1, requests
                    page.wait_for_function("client.getState().groups.tour.cached===1")
                    assert page.evaluate("events.some(e=>e.type==='LIV_TRANSFER_STATE'&&e.state.groups.tour.cached===1)")
                    stale = frame.evaluate(fetch, resource + "?v=" + "0" * 64)
                    assert stale["sha"] is None and len(requests) == 2, requests
                    paths = [path + "?v=" + hashlib.sha256(body).hexdigest() for path, body in list(parallel.items())[:8]]
                    begun = time.monotonic()
                    many = frame.evaluate("""async paths=>Promise.all([...paths,paths[0],paths[1]].map(async path=>{
                        const r=await fetch(path);return {sha:r.headers.get('X-Liv-Sha256'),bytes:(await r.arrayBuffer()).byteLength};}))""", paths)
                    parallel_seconds = time.monotonic() - begun
                    assert 2 <= network["peak"] <= 4, network
                    assert all(r["sha"] and r["bytes"] == len(next(iter(parallel.values()))) for r in many), many
                    for path in list(parallel)[:8]: assert sum(urlsplit(r).path == path for r in requests) == 1, requests
                    bad = list(parallel)[8] + "?v=" + hashlib.sha256(list(parallel.values())[8]).hexdigest()
                    failure = frame.evaluate("async path=>fetch(path).then(()=>null,e=>String(e))", bad)
                    assert failure, "Arquivo corrompido foi entregue como válido."
                    network["corrupt"] = False
                    repaired = frame.evaluate(fetch, bad)
                    assert repaired["sha"] == hashlib.sha256(list(parallel.values())[8]).hexdigest(), repaired
                    assert sum(urlsplit(r).path == list(parallel)[8] for r in requests) == 2, requests
                    shared = list(parallel)[9] + "?v=" + hashlib.sha256(list(parallel.values())[9]).hexdigest()
                    other = context.new_page();other.goto(origin + "/assets/other.html");other.wait_for_function("navigator.serviceWorker.controller!==null")
                    frame.evaluate("""path=>{window.stopShared=new AbortController();window.firstShared=fetch(path,{signal:stopShared.signal}).then(()=>null,e=>e.name);}""", shared)
                    other.evaluate("""path=>{window.secondShared=fetch(path).then(async r=>({sha:r.headers.get('X-Liv-Sha256'),bytes:(await r.arrayBuffer()).byteLength}));}""", shared)
                    page.wait_for_timeout(100);frame.evaluate("stopShared.abort()")
                    assert frame.evaluate("firstShared") == "AbortError"
                    shared_result = other.evaluate("secondShared")
                    assert shared_result["sha"] == hashlib.sha256(list(parallel.values())[9]).hexdigest()
                    assert sum(urlsplit(r).path == list(parallel)[9] for r in requests) == 1, requests
                    other.close()
                    assert not errors, errors
                    report["cases"].append({"runtime": runtime, "status": "PASS", "startSeconds": elapsed,
                        "outsideScope": True, "onDemandOnly": True, "foregroundPeak": network["peak"],
                        "parallelSeconds": parallel_seconds, "sharedRequests": True, "abortedConsumerPreservesOtherTab": True, "corruptionRejectedAndRetried": True, "hashURLReused": True,
                        "staleHashBypassed": True, "parentReceivedProgress": True, "requests": requests})
                    print(runtime, "PASS", flush=True)
                finally:
                    context.close()
                    server.shutdown()
                    server.server_close()
            browser.close()
        report["status"] = "PASS"
    except Exception as error:
        report["failure"] = repr(error)
        raise
    finally:
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--saida", type=Path, required=True)
    run(parser.parse_args().saida)
