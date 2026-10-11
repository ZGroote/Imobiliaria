"""Servidor privado com gzip/ETag explícitos para ensaios de transporte local."""
import gzip
import hashlib
import mimetypes
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

TEXT = {'.html', '.js', '.mjs', '.json', '.css', '.svg'}


def accepts_gzip(header):
    explicit = None; wildcard = 0.
    for entry in header.lower().split(','):
        name, *params = entry.strip().split(';')
        if name not in ['gzip', '*']:
            continue
        quality = 1.
        for parameter in params:
            if parameter.strip().startswith('q='):
                try: quality = float(parameter.strip()[2:])
                except ValueError: quality = 0.
        if name == 'gzip': explicit = quality
        else: wildcard = quality
    return (explicit if explicit is not None else wildcard) > 0


class MeasuredServer:
    def __init__(self, root, compression=True):
        self.root = Path(root).resolve(); self.compression = compression
        self.cache = {}; self.records = []; self.lock = threading.Lock()
        owner = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                path = (owner.root / unquote(urlsplit(self.path).path).lstrip('/')).resolve()
                if not path.is_relative_to(owner.root) or not path.is_file():
                    self.send_error(404); return
                packed = owner.content(path, accepts_gzip(self.headers.get('Accept-Encoding', '')))
                body, encoding, etag, raw_size = packed
                status = 304 if self.headers.get('If-None-Match') == etag else 200
                self.send_response(status)
                mime = 'text/javascript' if path.suffix in ['.js', '.mjs'] else mimetypes.guess_type(path)[0] or 'application/octet-stream'
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(body) if status == 200 else 0))
                self.send_header('ETag', etag); self.send_header('Vary', 'Accept-Encoding')
                self.send_header('Cache-Control', 'no-cache' if path.suffix in ['.html', '.json'] else 'public,max-age=3600')
                if encoding: self.send_header('Content-Encoding', encoding)
                self.end_headers()
                with owner.lock:
                    owner.records.append({'path': path.relative_to(owner.root).as_posix(), 'status': status,
                                          'encoding': encoding or 'identity', 'contentBytes': raw_size,
                                          'bodyBytes': len(body) if status == 200 else 0})
                if status == 200:
                    try: self.wfile.write(body)
                    except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.url = f'http://127.0.0.1:{self.server.server_port}/'
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def content(self, path, gzip_enabled=True):
        compressed = self.compression and gzip_enabled and path.suffix in TEXT
        key = (path, compressed)
        if key not in self.cache:
            raw = path.read_bytes(); body = gzip.compress(raw, compresslevel=6, mtime=0) if compressed else raw
            etag = '"' + hashlib.sha256(body).hexdigest() + '"'
            self.cache[key] = (body, 'gzip' if compressed else None, etag, len(raw))
        return self.cache[key]

    def start(self):
        # Precompress large first-screen text before measuring CDN-like transfers.
        for path in [*self.root.glob('*.html'), *self.root.glob('*.js'), *self.root.glob('*.json'),
                     *self.root.glob('*.css'), self.root / 'site-baseline/maquete-liv-ipanema.html',
                     *self.root.glob('node_modules/three/build/*.js')]:
            if path.is_file(): self.content(path)
        self.thread.start(); return self

    def close(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=5)
