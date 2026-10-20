"""Confere os arquivos publicados e a ausência dos pacotes antigos."""
from pathlib import Path
import argparse
import hashlib
import json
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from gerar_mapa import blocos, BASE

PASTA = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--site-dir', type=Path, default=PASTA/'site-v3')
    args = parser.parse_args()
    manifest = json.loads((args.site_dir/'manifesto-teste.json').read_text('utf8'))
    report = {'base':args.base_url,'verificado_utc':datetime.now(timezone.utc).isoformat(),'arquivos':{}}
    tile = next(name for name in manifest['arquivos'] if name.endswith('.bin'))
    for name in ('mapa-liv-ipanema-5km.html','maquete-liv-ipanema.html','liv-ipanema.glb',tile):
        request = Request(args.base_url.rstrip('/')+'/'+name, headers={'Accept-Encoding':'identity'})
        with urlopen(request, timeout=120) as response:
            digest = hashlib.sha256()
            size = 0
            while chunk := response.read(1024*1024):
                digest.update(chunk)
                size += len(chunk)
            data = {'status':response.status,'bytes':size,'sha256':digest.hexdigest(),
                    'content_type':response.headers.get('Content-Type')}
        expected = manifest['arquivos'][name]
        assert data['status']==200 and data['bytes']==expected['bytes'] and data['sha256']==expected['sha256'], (name,data,expected)
        report['arquivos'][name] = data
        print(json.dumps({'arquivo':name,**data}),flush=True)
    source_tiles = json.loads(blocos(BASE.read_text('utf8'))['__exteriorModels'][1])['parcelTiles']
    old_tile = source_tiles['prefix'] + source_tiles['keys'][0] + '.bin'
    report['ausentes'] = {}
    for name in ('mapa-completo.html',old_tile,'quintais/liv-d998a9bc0d8b52fe/-10_-7.bin'):
        request = Request(args.base_url.rstrip('/')+'/'+name)
        try:
            with urlopen(request, timeout=30) as response:
                status = response.status
        except HTTPError as error:
            status = error.code
        assert status == 404, (name,status)
        report['ausentes'][name] = status
        print(json.dumps({'ausente':name,'status':status}),flush=True)
    report['status']='PASS'
    (PASTA/'http-verificado.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')


if __name__=='__main__':
    main()
