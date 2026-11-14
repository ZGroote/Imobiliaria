"""Publica a página aprovada num canal Firebase com expiração de três dias."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
OUT = ROOT / 'publicacao'
STAGE = OUT / 'staging'
CHANNEL = 'liv-ipanema-20261008'
SITE = 'imobilaria-deccb-miniaturas'
PROJECT = 'imobilaria-deccb'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    validation = json.loads((ROOT / 'validacao-interior.json').read_text('utf8'))
    exterior = json.loads((ROOT / 'validacao-visual.json').read_text('utf8'))
    smoke = json.loads((ROOT / 'qa/final-smoke.json').read_text('utf8'))
    assert validation['status'] == exterior['status'] == 'PASS'
    for relative, expected in validation['artefatosSHA256'].items():
        assert sha((ROOT / relative).read_bytes()) == expected, relative
    for relative, expected in exterior['capturasSHA256'].items():
        assert sha((ROOT / relative).read_bytes()) == expected, relative
    html = ROOT / 'maquete-liv-ipanema.html'
    data = html.read_bytes()
    assert sha(data) == smoke['htmlSHA256']
    assert smoke['offline'] and smoke['noHTTP'] and not smoke['erros']
    assert smoke['atlas']['active'] and smoke['atlas']['targetsMapped'] == 84
    STAGE.mkdir(parents=True, exist_ok=True)
    assert STAGE.resolve().is_relative_to(ROOT.resolve())
    assert {p.name for p in STAGE.iterdir()} <= {html.name}
    # Publica a versão minificada: sem comentários nem nomes locais legíveis. O esbuild
    # é determinístico, então o smoke rodado antes vale para estes bytes exatos.
    original_sha = sha(data)
    # Na web só vai o HTML: os botões "Modelo GLB"/"Projeto Blender" dariam 404 e expõem a
    # ferramenta. O pacote offline (empacotar.py) leva os arquivos e continua com os botões.
    texto, n = re.subn(r"var livDownloads = [\s\S]*?appendChild\(livDownloads\);\n", '', data.decode('utf8'))
    assert n == 1 and 'livDownloads' not in texto, 'bloco de downloads mudou no HTML'
    web = OUT / 'web-sem-downloads.html'
    web.write_bytes(texto.encode('utf8'))
    subprocess.run([shutil.which('node'), str(REPO / 'tools/minificar_html.mjs'), str(web), str(STAGE / html.name)],
                   cwd=REPO, check=True)
    web.unlink()
    data = (STAGE / html.name).read_bytes()
    if '--so-preparar' in sys.argv:
        print('STAGING_PREPARADO', STAGE / html.name, len(data), sha(data), flush=True)
        return
    smoke_min = json.loads((ROOT / 'qa/minificada/final-smoke.json').read_text('utf8'))
    assert sha(data) == smoke_min['htmlSHA256'], 'rode qa_viewer.py --smoke-final --html na versão minificada'
    assert not smoke_min['erros'] and smoke_min['atlas']['targetsMapped'] == 84

    config_path = REPO / 'firebase.miniaturas.json'
    original = config_path.read_bytes()
    config = json.loads(original)
    assert config['hosting']['site'] == SITE
    assert not config['hosting'].get('rewrites')
    config['hosting']['public'] = STAGE.relative_to(REPO).as_posix()
    config['hosting']['redirects'] = [{'source': '/', 'destination': '/' + html.name, 'type': 302}]
    prepared = (json.dumps(config, ensure_ascii=False, indent=2) + '\n').encode('utf8')
    (OUT / 'firebase.miniaturas.original.json').write_bytes(original)
    command = [shutil.which('node'), str(REPO / 'node_modules/firebase-tools/lib/bin/firebase.js'),
               'hosting:channel:deploy', CHANNEL, '--expires', '3d', '--no-authorized-domains',
               '--config', str(config_path), '--project', PROJECT, '--non-interactive', '--json']
    assert command[0], 'Node indisponível'
    print('PUBLICACAO_PREPARADA', html.name, len(data), sha(data), flush=True)
    config_path.write_bytes(prepared)
    try:
        if '--registrar' in sys.argv:
            result = json.loads((OUT / 'firebase-result.json').read_text('utf8'))
        else:
            process = subprocess.run(command, cwd=REPO, text=True, encoding='utf8', capture_output=True)
            (OUT / 'firebase-result.json').write_text(process.stdout, 'utf8')
            if process.returncode:
                raise RuntimeError(process.stdout + '\n' + process.stderr)
            result = json.loads(process.stdout)
        assert result['status'] == 'success', result
        deployed = result['result'][SITE]
        expires = datetime.fromisoformat(deployed['expireTime'].replace('Z', '+00:00'))
        remaining = (expires - datetime.now(timezone.utc)).total_seconds()
        # A expiração vem do servidor, cujo relógio pode divergir alguns segundos.
        assert 71 * 3600 < remaining <= 72 * 3600 + 300, deployed['expireTime']
    finally:
        if config_path.read_bytes() != prepared:
            raise RuntimeError('Configuração mudou durante o deploy; backup original preservado em publicacao.')
        config_path.write_bytes(original)
        assert config_path.read_bytes() == original
    record = {'project': PROJECT, 'site': SITE, 'channel': CHANNEL,
              'url': deployed['url'] + '/' + html.name,
              'expireTime': deployed['expireTime'], 'version': deployed['version'],
              'htmlSHA256': sha(data), 'htmlBytes': len(data), 'minificada': True, 'semBotoesDownload': True,
              'htmlOriginalSHA256': original_sha,
              'files': [html.name], 'firebaseConfigRestored': True,
              'firebaseConfigSHA256': sha(original)}
    (OUT / 'publicacao.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), 'utf8')
    print(json.dumps(record, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
