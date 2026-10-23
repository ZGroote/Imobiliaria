"""Prepara a entrada Conecta no pacote existente, preservando os dois LIVs."""
import hashlib
import json
import shutil
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
RELEASE = SOURCE.parent / 'publicacao/liv-duplo-20261017'
PANEL_LOGIN = 'https://imobilaria-deccb-painel.web.app/login'


def prepare(release=RELEASE):
    release = Path(release)
    payload = release / 'payload'
    config_path = release / 'firebase.json'
    config = json.loads(config_path.read_text(encoding='utf-8'))
    if config['hosting']['site'] != 'imobilaria-deccb-miniaturas':
        raise ValueError('O destino precisa ser o Hosting das miniaturas.')
    classic = (payload / 'liv-classico/maquete-liv-ipanema.html').read_text(encoding='utf-8')
    if classic.count('<head>') != 1 or '<base ' in classic:
        raise ValueError('Cabeçalho inesperado na maquete clássica.')
    alias = classic.replace('<head>', '<head>\n  <base href="/liv-classico/">', 1)
    alias = alias.replace('href="#stage"', 'href="/maquetes/liv/#stage"')
    homepage = (SOURCE / 'index.html').read_bytes()
    # Keep the original root and hosting configuration available for recovery.
    backup = release / 'backup-antes-conecta-20261022'
    backup.mkdir(exist_ok=True)
    for path in [config_path, payload / 'index.html']:
        if path.exists() and not (backup / path.name).exists():
            shutil.copy2(path, backup / path.name)
    redirects = config['hosting'].setdefault('redirects', [])
    for source in ['/painel{,/}', '/login{,/}']:
        redirects[:] = [rule for rule in redirects if rule.get('source') != source]
        redirects.insert(0, {'source': source, 'destination': PANEL_LOGIN, 'type': 302})
    alias_path = payload / 'maquetes/liv/index.html'
    alias_path.parent.mkdir(parents=True, exist_ok=True)
    alias_path.write_text(alias, encoding='utf-8')
    (payload / 'index.html').write_bytes(homepage)
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files = {}
    for path in [payload / 'index.html', alias_path, config_path]:
        data = path.read_bytes()
        files[path.relative_to(release).as_posix()] = {
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    record = {'domain': 'conectaimoveis3d.com.br', 'files': files}
    (release / 'conecta-build.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    return record


if __name__ == '__main__':
    print(json.dumps(prepare(), ensure_ascii=False))
