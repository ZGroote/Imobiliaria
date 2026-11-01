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
                manifest = {"schema": "liv-transfer-manifest-v1", "version": digest,
                    "order": ["tour", "map", "planta2d"],
                    "groups": {name: {"label": name} for name in ["tour", "map", "planta2d"]},
                    "files": [{"path": "interiores/current.bin", "group": "tour", "essential": False,
                        "background": False, "bytes": len(payload), "sha256": digest}]}

                class Handler(BaseHTTPRequestHandler):
                    def log_message(self, *_): pass
                    def do_GET(self):
                        path = urlsplit(self.path).path
                        if path == resource:
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
                        self.wfile.write(body)

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
                    assert not errors, errors
                    report["cases"].append({"runtime": runtime, "status": "PASS", "startSeconds": elapsed,
                        "outsideScope": True, "onDemandOnly": True, "hashURLReused": True,
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
