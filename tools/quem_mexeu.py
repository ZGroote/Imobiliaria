"""O que está solto no git e qual agente (Codex ou Claude) mexeu por último em cada arquivo.

    python -I tools/quem_mexeu.py [pasta-do-repo]

Só leitura. Cruza `git status` com o registro de edições do Codex (~/.codex/sessions,
item FileChange) e do Claude (~/.claude/projects/<repo>, ferramentas Edit/Write).
Arquivo gerado por comando (script, render, bake, cache) não entra em registro nenhum e
sai como "comando"; editado por outra ferramenta (Antigravity, editor à mão) também.
"""
import collections
import html
import json
import re
import subprocess
import sys
from pathlib import Path

EDITA = ('Edit', 'Write', 'MultiEdit', 'NotebookEdit')


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], capture_output=True,
                          text=True, encoding='utf-8', errors='replace').stdout


def titulo(texto):
    return ' '.join(html.unescape(texto).split())[:70]


def edicoes(repo, home):
    """{arquivo relativo: (quando, agente, conversa)} da última edição, e {conversa: título}."""
    pref = str(repo).replace('\\', '/').lower() + '/'
    ultimo, titulos = {}, {}

    def marca(caminho, quando, agente, conversa):
        caminho = caminho.replace('\\', '/')
        if caminho.lower().startswith(pref):
            rel = caminho[len(pref):]
            if rel not in ultimo or quando > ultimo[rel][0]:
                ultimo[rel] = (quando, agente, conversa)

    for raiz in (home / '.codex' / 'sessions', home / '.codex' / 'archived_sessions'):
        for f in raiz.rglob('*.jsonl'):
            conversa, principal = f.stem[-36:], True
            with open(f, encoding='utf-8', errors='replace') as h:
                for linha in h:
                    if '"session_meta"' in linha:
                        meta = json.loads(linha)['payload']
                        principal = not meta.get('parent_thread_id')
                        conversa = meta.get('parent_thread_id') or meta.get('id') or conversa
                    elif principal and conversa not in titulos and '"UserMessage"' in linha:
                        item = json.loads(linha)['payload'].get('item', {})
                        texto = ''.join(c.get('text', '') for c in item.get('content', []))
                        if texto.strip():
                            titulos[conversa] = titulo(texto)
                    elif '"FileChange"' in linha:
                        o = json.loads(linha)
                        item = o.get('payload', {}).get('item', {})
                        if item.get('type') == 'FileChange':
                            for caminho in item.get('changes', {}):
                                marca(caminho, o['timestamp'], 'codex', conversa)

    # o Claude guarda o subagente em <conversa>/subagents/agent-*.jsonl: conta pra conversa que o chamou
    proj = home / '.claude' / 'projects' / re.sub(r'[^A-Za-z0-9]', '-', str(repo))
    for f in proj.rglob('*.jsonl'):
        sub = 'subagents' in f.parts
        conversa = f.parent.parent.name if sub else f.stem
        with open(f, encoding='utf-8', errors='replace') as h:
            for linha in h:
                if not sub and conversa not in titulos and '"user"' in linha:
                    o = json.loads(linha)
                    texto = o.get('message', {}).get('content') if o.get('type') == 'user' else None
                    if isinstance(texto, str) and texto.strip():
                        titulos[conversa] = titulo(texto)
                if '"tool_use"' not in linha:
                    continue
                o = json.loads(linha)
                for c in o.get('message', {}).get('content') or []:
                    if isinstance(c, dict) and c.get('type') == 'tool_use' and c.get('name') in EDITA:
                        caminho = c.get('input', {}).get('file_path') or c.get('input', {}).get('notebook_path')
                        if caminho:
                            marca(caminho, o.get('timestamp', ''), 'claude', conversa)
    return ultimo, titulos


def soltos(repo):
    entradas, arquivos, i = git(repo, 'status', '--porcelain', '-z', '-uall').split('\0'), [], 0
    while i < len(entradas):
        e = entradas[i]
        i += 1
        if len(e) > 3:
            arquivos.append(e[3:])
            if e[0] in 'RC':  # renomeado/copiado: a próxima entrada é o nome antigo
                i += 1
    return arquivos


def main(arg='.'):
    sys.stdout.reconfigure(encoding='utf-8')
    repo = Path(git(Path(arg), 'rev-parse', '--show-toplevel').strip() or arg).resolve()
    ultimo, titulos = edicoes(repo, Path.home())
    arquivos = soltos(repo)
    nada = ('', 'comando', '')

    total = collections.Counter(ultimo.get(p, nada)[1] for p in arquivos)
    print(f'{len(arquivos)} arquivos soltos no git: '
          + (', '.join(f'{k} {v}' for k, v in total.most_common()) or 'nenhum'))

    pastas = collections.defaultdict(collections.Counter)
    for p in arquivos:
        partes = p.split('/')
        pastas['/'.join(partes[:2]) if len(partes) > 1 else '(raiz)'][ultimo.get(p, nada)[1]] += 1
    if pastas:
        print('\nPor pasta (20 maiores):')
        for pasta, c in sorted(pastas.items(), key=lambda x: -sum(x[1].values()))[:20]:
            print(f'  {sum(c.values()):5}  {pasta:50} ' + ' '.join(f'{k}={v}' for k, v in c.most_common()))

    conversas = collections.defaultdict(lambda: [0, ''])
    for p in arquivos:
        if p in ultimo:
            quando, agente, conversa = ultimo[p]
            c = conversas[(agente, conversa)]
            c[0] += 1
            c[1] = max(c[1], quando)
    if conversas:
        print('\nConversas que deixaram arquivo solto (15 maiores):')
        for (agente, conversa), (n, quando) in sorted(conversas.items(), key=lambda x: -x[1][0])[:15]:
            print(f'  {n:5}  {agente:6} {quando[:10]}  {conversa[:8]}  {titulos.get(conversa, "")}')

    log = git(repo, 'log', '-30', '--format=%h %ad %s%x1f%(trailers:key=Co-Authored-By,valueonly)%x1e',
              '--date=short')
    sem = [r.split('\x1f')[0].strip() for r in log.split('\x1e') if r.strip() and not r.split('\x1f')[1].strip()]
    if sem:
        print(f'\nCommits sem assinatura de agente: {len(sem)} dos últimos 30 (feitos à mão ou pelo Codex antes do hook)')
        for linha in sem[:10]:
            print('  ' + linha)


if __name__ == '__main__':
    main(*sys.argv[1:2])
