# -*- coding: utf-8 -*-
"""Monta a pasta que o Cloud Build recebe para construir a imagem de um serviço.

    python deploy/contexto.py rastreabilidade <pasta-nova>
    python deploy/contexto.py leituras <pasta-nova>
    gcloud builds submit <pasta-nova> --tag <imagem>        (ver deploy/README.md)

Só vai o que o serviço usa: o repositório inteiro tem centenas de MB que nenhum dos dois lê.
A lista de LEITURAS saiu de uma auditoria dos arquivos que o Python abre ao gerar uma prévia
(teste real de /gerar-maquete); `tests/test_deploy_contexto.py` gera uma prévia dentro da pasta
montada e quebra se faltar alguma coisa. O Dockerfile do serviço vai para a raiz da pasta.
A última linha do stdout é um JSON com o resultado.
"""
import json
from pathlib import Path
import shutil
import sys

RAIZ = Path(__file__).resolve().parents[1]
COMUNS = ['deploy/servicos/package.json', 'deploy/servicos/package-lock.json']
ARQUIVOS = {
    'rastreabilidade': COMUNS + [
        'rastreabilidade/servidor.mjs', 'rastreabilidade/modelo.mjs', 'rastreabilidade/relatorios.mjs',
    ],
    'leituras': COMUNS + [
        'tools/leitura-api.mjs', 'tools/sonda-maquete.mjs',
        # o modelo do editor que a API usa para conferir o companion (TypeScript puro, Node 24)
        'painel/src/components/construtor-planta/editorDocument.ts',
        'painel/src/components/construtor-planta/modelo.ts',
        'painel/src/components/construtor-planta/catalogoMoveis.ts',
        'pipeline', 'schemas/leitura', 'schemas/planta-derivada', 'schemas/editor-state',
        'moveis/moveis_lib.json', 'v1.5/renderizador-v16-moveis',
        'v1.5/miniaturas/pagina_maquete.py', 'v1.5/miniaturas/padrao_atual.py', 'v1.5/miniaturas/caminhada.js',
    ],
}
IGNORAR = shutil.ignore_patterns('__pycache__', '*.pyc')


def montar(servico, destino):
    if servico not in ARQUIVOS:
        raise ValueError('serviço desconhecido: %s (use %s)' % (servico, ' ou '.join(ARQUIVOS)))
    destino = Path(destino)
    if destino.exists() and any(destino.iterdir()):
        raise ValueError('%s já tem conteúdo: use uma pasta nova' % destino)
    destino.mkdir(parents=True, exist_ok=True)
    for rel in ARQUIVOS[servico]:
        origem, alvo = RAIZ / rel, destino / rel
        if origem.is_dir():
            shutil.copytree(origem, alvo, ignore=IGNORAR)
        elif origem.is_file():
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(origem, alvo)
        else:
            raise ValueError('falta %s no repositório' % rel)
    shutil.copy2(RAIZ / 'deploy' / ('%s.Dockerfile' % servico), destino / 'Dockerfile')
    arquivos = sorted(p.relative_to(destino).as_posix() for p in destino.rglob('*') if p.is_file())
    return {'servico': servico, 'destino': str(destino), 'arquivos': len(arquivos),
            'bytes': sum((destino / a).stat().st_size for a in arquivos)}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    try:
        print(json.dumps(montar(sys.argv[1], sys.argv[2]), ensure_ascii=False))
    except (ValueError, OSError) as exc:
        sys.exit(str(exc))
