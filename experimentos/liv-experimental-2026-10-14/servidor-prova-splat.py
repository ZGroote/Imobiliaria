"""Servidor local do diagnóstico; salva somente evidências PNG dentro do experimento."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os

root=Path(__file__).resolve().parents[2]
output=Path(__file__).resolve().parent/'piloto-render/cobertura-20261015/evidencias'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root),**kwargs)
    def do_POST(self):
        if self.path != '/_qa/vista' or self.headers.get('Origin') != 'http://127.0.0.1:8876':
            self.send_error(403); return
        size=int(self.headers.get('Content-Length','0'))
        if not 8<size<=12*1024*1024:
            self.send_error(413); return
        data=self.rfile.read(size)
        if not data.startswith(b'\x89PNG\r\n\x1a\n') or data[-8:-4] != b'IEND':
            self.send_error(415); return
        output.mkdir(parents=True,exist_ok=True)
        destination=output/'vista-atual.png'
        partial=output/'vista-atual.partial'
        partial.write_bytes(data)
        os.replace(partial,destination)
        payload=json.dumps({'url':'/'+destination.relative_to(root).as_posix()}).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(payload)))
        self.end_headers(); self.wfile.write(payload)

if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1',8876),Handler).serve_forever()
