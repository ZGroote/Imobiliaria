"""Serve um diretório como a hospedagem faria: gzip nos tipos de texto, binários .gz/.png crus."""
import functools, gzip, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
PORT = int(sys.argv[2])
TEXTO = {'.html', '.js', '.mjs', '.json', '.css', '.svg', '.txt'}


@functools.lru_cache(maxsize=64)
def comprimido(path, mtime):
    return gzip.compress(Path(path).read_bytes(), 6)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def log_message(self, *a):
        pass

    def do_GET(self):
        path = Path(self.translate_path(self.path))
        if path.is_file() and path.suffix in TEXTO and 'gzip' in self.headers.get('Accept-Encoding', ''):
            body = comprimido(str(path), path.stat().st_mtime)
            self.send_response(200)
            self.send_header('Content-Type', self.guess_type(str(path)))
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
