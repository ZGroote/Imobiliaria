"""Prepara a entrada Conecta no pacote existente, preservando os dois LIVs."""
import hashlib
import json
import shutil
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
sys.path.insert(0, str(SOURCE.parent))
from fachada.montar import PAGINAS, css_hash, montar

RELEASE = SOURCE.parent / 'publicacao/liv-duplo-20261017'
PUBLIC_ORIGIN = 'https://conectaimoveis3d.com.br'
PANEL_LOGIN = 'https://painel.conectaimoveis3d.com.br/login'
VERIFICATION_FILE = 'googled4c6adc6ff873f84.html'
INSTITUTIONAL_ROUTES = ['/', '/{' + ','.join(PAGINAS) + '}.html', '/institucional/**']
INSTITUTIONAL_HEADERS = [
    {'key': 'X-Frame-Options', 'value': 'DENY'},
    {'key': 'Permissions-Policy', 'value': 'camera=(), microphone=(), geolocation=()'},
    {'key': 'Content-Security-Policy', 'value': "default-src 'self'; script-src 'self'; style-src 'self' " + css_hash() + "; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'"},
]


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
    alias = classic.replace('<head>', '<head>\n  <base href="/liv-classico/">\n'
                            f'  <link rel="canonical" href="{PUBLIC_ORIGIN}/maquetes/liv/">', 1)
    alias = alias.replace('href="#stage"', 'href="/maquetes/liv/#stage"')
    build = montar(release / 'fachada-build')
    # Keep the original root and hosting configuration available for recovery.
    backup = release / 'backup-antes-conecta-20261022'
    backup.mkdir(exist_ok=True)
    for path in [config_path, payload / 'index.html']:
        if path.exists() and not (backup / path.name).exists():
            shutil.copy2(path, backup / path.name)
    institutional_backup = release / 'backup-antes-fachada-20261023'
    if not institutional_backup.exists():
        institutional_backup.mkdir()
        for path in [config_path, *(payload / f'{pagina}.html' for pagina in PAGINAS)]:
            if path.exists():
                shutil.copy2(path, institutional_backup / path.name)
    redirects = config['hosting'].setdefault('redirects', [])
    for source in ['/painel{,/}', '/login{,/}']:
        redirects[:] = [rule for rule in redirects if rule.get('source') != source]
        redirects.insert(0, {'source': source, 'destination': PANEL_LOGIN, 'type': 302})
    alias_path = payload / 'maquetes/liv/index.html'
    alias_path.parent.mkdir(parents=True, exist_ok=True)
    alias_path.write_text(alias, encoding='utf-8')
    institutional_files = []
    for pagina in PAGINAS:
        path = payload / f'{pagina}.html'
        text = (build / path.name).read_text(encoding='utf-8')
        robots = 'noindex, follow' if pagina == '404' else 'index, follow'
        text = text.replace('<meta name="robots" content="noindex, nofollow">',
                            f'<meta name="robots" content="{robots}">')
        if pagina != '404':
            canonical = PUBLIC_ORIGIN + ('/' if pagina == 'index' else f'/{pagina}.html')
            text = text.replace('<meta name="robots"',
                                f'<link rel="canonical" href="{canonical}">\n  <meta name="robots"', 1)
        path.write_text(text.replace('="assets/', '="/institucional/assets/'), encoding='utf-8')
        institutional_files.append(path)
    assets = payload / 'institucional/assets'
    shutil.copytree(build / 'assets', assets, dirs_exist_ok=True)
    institutional_files.extend(sorted(assets.iterdir()))
    # /favicon.ico na raiz do domínio, pedido pelo navegador em qualquer página (inclusive na maquete).
    shutil.copy2(build / 'favicon.ico', payload / 'favicon.ico')
    institutional_files.append(payload / 'favicon.ico')
    # O domínio público permite robôs; o robots restritivo fica só no preview isolado.
    robots_path = payload / 'robots.txt'
    robots_path.write_text(f'User-agent: *\nAllow: /\n\nSitemap: {PUBLIC_ORIGIN}/sitemap.xml\n', encoding='utf-8')
    institutional_files.append(robots_path)
    paths = ['/', *(f'/{pagina}.html' for pagina in PAGINAS if pagina not in ('index', '404')), '/maquetes/liv/']
    sitemap_path = payload / 'sitemap.xml'
    sitemap_path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                            + ''.join(f'  <url><loc>{PUBLIC_ORIGIN}{path}</loc></url>\n' for path in paths)
                            + '</urlset>\n', encoding='utf-8')
    institutional_files.append(sitemap_path)
    shutil.copy2(SOURCE / VERIFICATION_FILE, payload / VERIFICATION_FILE)
    institutional_files.append(payload / VERIFICATION_FILE)
    # As políticas restritivas são só da fachada: LIV e acesso individual usam outros recursos.
    headers = config['hosting'].setdefault('headers', [])
    headers[:] = [rule for rule in headers if rule.get('source') not in INSTITUTIONAL_ROUTES]
    headers.extend({'source': route, 'headers': INSTITUTIONAL_HEADERS} for route in INSTITUTIONAL_ROUTES)
    config['hosting']['cleanUrls'] = False
    # HTMLs do LIV passam pelo servidor; arquivos estáticos teriam prioridade sobre as rewrites.
    guarded = ['maquetes/liv', 'liv-classico', 'liv-novo', 'b/liv-ipanema']
    ignored = config['hosting'].setdefault('ignore', [])
    rewrites = config['hosting'].setdefault('rewrites', [])
    for prefix in guarded:
        pattern = f'{prefix}/**/*.html'
        if pattern not in ignored:
            ignored.append(pattern)
        route = f'/{prefix}' + '{,/**}'
        rewrites[:] = [rule for rule in rewrites if rule.get('source') != route]
        rewrites.insert(0, {'source': route, 'function': {
            'functionId': 'conectaTracking', 'region': 'southamerica-east1'}})
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files = {}
    for path in [*institutional_files, alias_path, config_path]:
        data = path.read_bytes()
        files[path.relative_to(release).as_posix()] = {
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    record = {'domain': 'conectaimoveis3d.com.br', 'files': files}
    (release / 'conecta-build.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    return record


if __name__ == '__main__':
    print(json.dumps(prepare(), ensure_ascii=False))
