"""Run on the server: compare HTTP bytes with tour files, without rendering."""
import argparse
import hashlib
import json
import re
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path


def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--url', default='http://127.0.0.1:8000/')
    parser.add_argument('--entry', default='interior.html')
    parser.add_argument('--sog', action='append', required=True,
                        help='Relative SOG path; supply once for each of the two complete models')
    parser.add_argument('--asset', action='append', default=[], help='Additional explicit relative asset path')
    parser.add_argument('--out', type=Path, default=Path('/root/liv-corrigido-20261016/tour-http-validacao.json'))
    args = parser.parse_args()
    root = args.directory.resolve()
    base = args.url.rstrip('/') + '/'
    assert urllib.parse.urlsplit(base).hostname in ('127.0.0.1', 'localhost', '::1'), 'Use loopback HTTP on the server'
    assert len(set(args.sog)) >= 2, 'Validate both distinct SOG files'
    queue = [args.entry] + args.sog + args.asset
    seen = set()
    results = []
    while queue:
        relative = queue.pop(0)
        if relative in seen:
            continue
        seen.add(relative)
        path = (root / relative).resolve()
        assert path.is_relative_to(root) and path.is_file(), path
        url = urllib.parse.urljoin(base, urllib.parse.quote(relative, safe='/'))
        h = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(url, timeout=45) as response:
            assert response.status == 200, (url, response.status)
            content_type = response.headers.get('Content-Type', '')
            content_length = response.headers.get('Content-Length')
            for block in iter(lambda: response.read(1024 * 1024), b''):
                h.update(block)
                size += len(block)
        item = {'file': relative, 'url': url, 'bytes': size, 'content_type': content_type,
                'sha256': h.hexdigest(), 'local_sha256': sha_file(path)}
        assert size == path.stat().st_size and item['sha256'] == item['local_sha256'], item
        assert content_length is None or int(content_length) == size, item
        if path.suffix.lower() == '.sog':
            with zipfile.ZipFile(path) as archive:
                assert archive.testzip() is None, relative
                assert 'meta.json' in archive.namelist(), relative
                item['sog_meta'] = json.loads(archive.read('meta.json'))
                item['zip_members'] = archive.namelist()
        if path.suffix.lower() in ('.html', '.js', '.mjs'):
            assert 'html' not in content_type.lower() or path.suffix.lower() == '.html', item
            source = path.read_text(encoding='utf-8')
            # Include literal local module/importmap/assets references. Dynamic names
            # are supplied explicitly with --sog; this is not a JavaScript parser.
            references = re.findall(r'''["']([^"'\s<>]+\.(?:m?js|wasm|css|sog)(?:\?[^"'\s<>]*)?)["']''', source)
            for ref in references:
                parsed = urllib.parse.urlsplit(ref)
                if parsed.scheme or parsed.netloc or ref.startswith('/'):
                    continue
                candidate = (path.parent / urllib.parse.unquote(parsed.path)).resolve()
                if candidate.is_relative_to(root) and candidate.is_file():
                    queue.append(candidate.relative_to(root).as_posix())
            item['literal_asset_references'] = references
        results.append(item)
        assert len(seen) <= 100, 'Unexpected asset traversal'
    report = {'static_http_matches_local': True, 'directory': str(root), 'url': base,
              'browser_render_test': 'not performed by this helper', 'files': results}
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'report': str(args.out), 'files': len(results), 'sogs': args.sog}))


if __name__ == '__main__':
    main()
