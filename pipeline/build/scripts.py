"""Compoe scripts classicos locais em ordem explicita para o HTML offline."""
import json


def programa(config):
    root = config.fonte.resolve()
    names = json.loads((root / 'modules.json').read_text(encoding='utf-8'))
    if not isinstance(names, list) or not names or names[-1] != 'app.js':
        raise ValueError('modules.json deve listar scripts e terminar em app.js')
    if any(not isinstance(n, str) for n in names) or len(names) != len(set(names)):
        raise ValueError('modules.json contem nomes invalidos ou repetidos')
    chunks = []
    for name in names:
        p = (root / name).resolve()
        if not p.is_relative_to(root) or p.suffix != '.js':
            raise ValueError('modulo fora do renderizador: %s' % name)
        with p.open(encoding='utf-8', newline='') as stream:
            chunks.append(stream.read())
    return '\n'.join(chunks)
