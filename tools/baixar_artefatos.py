# -*- coding: utf-8 -*-
"""Recupera as fontes privadas listadas em tools/artefatos-privados.json.

    python tools/baixar_artefatos.py              # baixa o que falta, conferindo cada um
    python tools/baixar_artefatos.py --conferir   # só confere o que está no disco, sem rede

O sha256 do manifesto é a autoridade. Para cada artefato:

- destino existe e bate com o manifesto: nada a fazer;
- destino existe e NÃO bate: recusa. Pode ser trabalho local, como uma geometria nova, e
  sobrescrever apagaria esse trabalho. Tire o arquivo do lugar e rode de novo;
- destino não existe: baixa o asset da release numa pasta temporária ao lado do destino, confere
  tamanho e sha256, e só então põe no lugar. Se não bater, o download é apagado e o comando
  falha: o destino nunca recebe um arquivo errado.

Baixa com o `gh`, que precisa estar autenticado e ter leitura no repositório privado de
artefatos. Sem acesso, o GitHub responde 404. Não há nova tentativa automática: erro de rede
ou de acesso aparece como erro.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath, PureWindowsPath

RAIZ = Path(__file__).resolve().parents[1]
MANIFESTO = RAIZ / 'tools' / 'artefatos-privados.json'


class Recusado(Exception):
    pass


def relativo_seguro(destino):
    """O destino é relativo e não sobe de pasta, lido como caminho POSIX e como caminho Windows.

    Só POSIX não basta no Windows: `C:/fora.json` não é absoluto para PurePosixPath, mas é para
    PureWindowsPath e para o Path do Windows, e `raiz / 'C:/fora.json'` vira `C:/fora.json`.
    Drive (`C:`), raiz (`/`, `\\`) e UNC (`\\\\srv\\share`) aparecem no `anchor`."""
    if not destino or '\\' in destino:
        return False
    return not any(p.anchor or '..' in p.parts for p in (PurePosixPath(destino), PureWindowsPath(destino)))


def dentro(raiz, destino):
    """O caminho montado e RESOLVIDO fica sob a raiz. Recusado se não."""
    if not relativo_seguro(destino):
        raise Recusado('destino fora do repositório: %r' % destino)
    base = Path(raiz).resolve()
    alvo = (base / destino).resolve()
    if base not in alvo.parents:
        raise Recusado('destino fora do repositório: %r resolve para %s' % (destino, alvo))
    return alvo


def carrega(caminho=MANIFESTO):
    m = json.loads(Path(caminho).read_text(encoding='utf-8'))
    if m.get('schema') != 1:
        raise Recusado('manifesto com schema desconhecido: %r' % m.get('schema'))
    for a in m['artefatos']:
        dentro(RAIZ, a['destino'])
    return m


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        for bloco in iter(lambda: f.read(1 << 20), b''):
            h.update(bloco)
    return h.hexdigest()


def confere(caminho, a):
    """Recusado se o arquivo não for exatamente o do manifesto: tamanho e sha256."""
    n = os.path.getsize(caminho)
    if n != a['bytes']:
        raise Recusado('%s: %d bytes, e o manifesto diz %d' % (a['destino'], n, a['bytes']))
    h = sha256(caminho)
    if h != a['sha256']:
        raise Recusado('%s: sha256 %s, e o manifesto diz %s' % (a['destino'], h, a['sha256']))


def baixa_com_gh(repo, a, pasta):
    subprocess.run(['gh', 'release', 'download', a['release'], '-R', repo,
                    '-p', a['asset'], '-D', str(pasta)], check=True)
    return Path(pasta) / a['asset']


def recupera(a, repo, raiz=RAIZ, baixar=baixa_com_gh):
    destino = dentro(raiz, a['destino'])
    if destino.exists():
        try:
            confere(destino, a)
        except Recusado as e:
            raise Recusado('%s: o arquivo local difere do manifesto e não será sobrescrito' % e) from None
        return 'já estava'
    destino.parent.mkdir(parents=True, exist_ok=True)
    pasta = Path(tempfile.mkdtemp(prefix='.artefato-', dir=destino.parent))
    try:
        baixado = baixar(repo, a, pasta)
        confere(baixado, a)
        os.replace(baixado, destino)
    finally:
        shutil.rmtree(pasta, ignore_errors=True)
    return 'baixado'


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument('--conferir', action='store_true', help='só confere o que está no disco, sem rede')
    args = p.parse_args(argv)
    m = carrega()
    falhas = 0
    for a in m['artefatos']:
        try:
            if args.conferir:
                confere(dentro(RAIZ, a['destino']), a)
                estado = 'confere'
            else:
                if shutil.which('gh') is None:
                    raise Recusado('precisa do gh autenticado, com leitura em ' + m['repositorio'])
                estado = recupera(a, m['repositorio'])
            print('ok    %-10s %s' % (estado, a['destino']))
        except (Recusado, OSError, subprocess.CalledProcessError) as e:
            falhas += 1
            print('ERRO  %s: %s' % (a['destino'], e), file=sys.stderr)
    return 1 if falhas else 0


if __name__ == '__main__':
    raise SystemExit(main())
